// Telefondaki tüm kişisel hesap tek yerde: uygulama ekranları da bildirim (service worker) da bunu kullanır.
// DOM ve ağ erişimi yok; latest.json ve kişisel durum girdi olarak gelir.
import { DEFAULT_PARAMS, PARAM_META } from '../model/params.mjs';
import { effectiveParams, paramVersion } from '../model/paramedit.mjs';
import { applyParams, combineContracts, currentExposure, targetsToday, bandHistory, recommendationDue, buildProposal, contractSteps, migrateState } from './personal.mjs';

export function compute(latestRaw, stateIn, { withProposal = false } = {}) {
  const state = migrateState(stateIn);
  const P = effectiveParams(DEFAULT_PARAMS, state.params?.values, PARAM_META);
  const latest = applyParams(latestRaw, P);
  const m = { P, param_version: paramVersion(DEFAULT_PARAMS, state.params), latest, state, data_date: latest.data_date };
  const suggested = latest.anchor?.ok ? latest.anchor.user_groups.weights : null;
  const anchor = state.anchor || suggested;
  m.anchorIsDefault = !state.anchor && !!suggested;
  const contracts = (state.contracts || []).filter((c) => Object.keys(c.weights || {}).length);
  if (contracts.length) {
    m.drift = combineContracts(latest, contracts, state.shares);
    m.expoNow = currentExposure(latest, m.drift.current);
  }
  if (anchor) m.targets = targetsToday(latest, anchor, state.views || {}, P, m.expoNow || null);
  if (m.drift && m.targets) {
    m.bands = bandHistory(latest, m.drift, m.targets, P);
    m.due = recommendationDue(m.bands, state.decisions || [], latest.data_date, P);
    if (m.due.active || withProposal) {
      try {
        m.proposal = buildProposal(latest, m.drift.current, m.bands, m.targets.targets, P);
        m.steps = contractSteps(latest, m.drift, m.proposal.weights);
      } catch (e) { m.proposalError = e.message; }
    }
  }
  return m;
}

// Bildirim metni (günlük): öneri, acil uyarı ya da kısa durum.
export function dailyNotice(m, groupLabels, classLabels) {
  const alerts = Object.entries(m.latest.classes).filter(([, c]) => c.alert?.triggered);
  if (m.due?.active && m.steps) {
    const n = m.steps.reduce((s, c) => s + c.steps.length, 0);
    const k = m.steps.filter((c) => c.steps.length).length;
    const g = Object.entries(m.bands.groups).filter(([, b]) => b.status !== 'inside').map(([id, b]) => `${groupLabels[id]} ${b.status === 'above' ? 'fazla' : 'eksik'}`);
    return { title: 'Dengeleme zamanı', body: `${g.join(', ') || 'Grup içi pay aralık dışında'}. ${k} sözleşmede ${n} değişiklik.`, tag: 'malisk-oneri' };
  }
  if (alerts.length) {
    const [c, v] = alerts[0];
    return { title: `Acil uyarı: ${classLabels[c]}`, body: `20 iş gününde %${Math.abs(v.alert.change_pct).toFixed(1).replace('.', ',')} düştü. İnceleme çağrısı, öneri değil.`, tag: 'malisk-uyari' };
  }
  const r = m.drift ? `Toplam ${m.drift.return_pct >= 0 ? '+' : '−'}%${Math.abs(m.drift.return_pct).toFixed(1).replace('.', ',')}. ` : '';
  return { title: 'maliSK', body: `${r}Bugün yapılacak bir şey yok.`, tag: 'malisk-gunluk' };
}
