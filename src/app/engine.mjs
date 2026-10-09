// Telefondaki tüm kişisel hesap tek yerde: uygulama ekranları da bildirim (service worker) da bunu kullanır.
// DOM ve ağ erişimi yok; latest.json ve kişisel durum girdi olarak gelir.
import { DEFAULT_PARAMS, PARAM_META } from '../model/params.mjs';
import { effectiveParams, paramVersion } from '../model/paramedit.mjs';
import { applyParams, combineContracts, currentExposure, targetsToday, bandHistory, recommendationDue, buildProposal, contractSteps, migrateState, fundSignals, promisingFunds, restrictFounders } from './personal.mjs';

export function compute(latestRaw, stateIn, { withProposal = false } = {}) {
  const state = migrateState(stateIn);
  const P = effectiveParams(DEFAULT_PARAMS, state.params?.values, PARAM_META);
  const latest = restrictFounders(applyParams(latestRaw, P), stateIn?.founders);
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
  m.promising = promisingFunds(latest, P);
  if (m.drift) m.funds = fundSignals(latest, m.drift.current, P);
  if (m.drift && m.targets) {
    m.bands = bandHistory(latest, m.drift, m.targets, P);
    m.due = recommendationDue(m.bands, state.decisions || [], latest.data_date, P);
    // Fon değişiklikleri: riskli olanlar her zaman, diğerleri "şimdi değil" beklemesi dışında.
    const switches = m.funds.switches.filter((x) => x.risk || !m.due.suppressed);
    m.rec = { rebalance: m.due.active, switches, active: m.due.active || switches.length > 0 };
    // Önizleme (öneri yokken Dengele açıldıysa): tüm fon değişiklikleri ve aralık dışında grup varsa yeniden dağıtım.
    const preview = !m.rec.active && withProposal;
    if (m.rec.active || preview) {
      try {
        const opts = preview ? { switches: m.funds.switches, rebalance: m.due.due.length + m.due.pending.length > 0 } : { switches, rebalance: m.due.active };
        m.proposal = buildProposal(latest, m.drift.current, m.bands, m.targets.targets, P, opts);
        m.proposal.preview = preview;
        m.steps = contractSteps(latest, m.drift, m.proposal.weights);
      } catch (e) { m.proposalError = e.message; }
    }
  }
  return m;
}

// Bildirim metni (günlük): fon değişikliği, dağılım önerisi, riskli fon, acil uyarı ya da kısa durum.
export function dailyNotice(m, groupLabels, classLabels) {
  const alerts = Object.entries(m.latest.classes).filter(([, c]) => c.alert?.triggered);
  const parts = [];
  if (m.rec?.switches.length) parts.push(`${m.rec.switches.length} fon değişikliği`);
  if (m.rec?.rebalance) {
    const g = Object.entries(m.bands.groups).filter(([, b]) => b.status !== 'inside').map(([id, b]) => `${groupLabels[id]} ${b.status === 'above' ? 'fazla' : 'eksik'}`);
    parts.push(`dağılım: ${g.join(', ') || 'grup içi pay aralık dışında'}`);
  }
  if (parts.length) {
    const n = m.steps ? m.steps.reduce((s, c) => s + c.steps.length, 0) : 0;
    const title = m.rec.switches.some((x) => x.risk) ? 'Riskli fon: değiştir' : m.rec.rebalance ? 'Dengeleme zamanı' : 'Fon değişikliği önerisi';
    return { title, body: `${parts.join(' · ')}.${n ? ` Toplam ${n} adım.` : ''}`, tag: 'malisk-oneri' };
  }
  if (m.funds?.risks.length) {
    const r = m.funds.risks[0];
    return { title: `Uyarı: ${r.code}`, body: `${r.text}. Fonu incele.`, tag: 'malisk-uyari' };
  }
  if (alerts.length) {
    const [c, v] = alerts[0];
    return { title: `Acil uyarı: ${classLabels[c]}`, body: `20 iş gününde %${Math.abs(v.alert.change_pct).toFixed(1).replace('.', ',')} düştü. İnceleme çağrısı, öneri değil.`, tag: 'malisk-uyari' };
  }
  const watch = [];
  if (m.funds?.weak.length) watch.push(`${m.funds.weak.length} fon akran grubunda ilk ${m.P.decision.fund_top_n}’te değil`);
  if (m.due?.pending.length) {
    const p = m.due.pending.sort((a, b) => a.left - b.left)[0];
    const [kind, id] = p.key.split(':');
    watch.push(`${groupLabels[id]}${kind === 'split' ? ' grup içi pay' : ''} aralık dışında, öneriye ${p.left} iş günü`);
  }
  const r = m.drift ? `Toplam ${m.drift.return_pct >= 0 ? '+' : '−'}%${Math.abs(m.drift.return_pct).toFixed(1).replace('.', ',')}. ` : '';
  return { title: 'maliSK', body: `${r}${watch.length ? watch.join(' · ') + '.' : 'Bugün yapılacak bir şey yok.'}`, tag: 'malisk-gunluk' };
}
