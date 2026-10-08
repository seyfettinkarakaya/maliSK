// Kişisel hesaplar (telefonda): kayan ağırlıklar, hedef, bant sayaçları, eylem önerisi.
// Girdi: data/latest.json (piyasa tarafı) + kullanıcının dağılımı, çapası ve görüşleri.
import { CLASSES } from '../model/params.mjs';
import { portfolioExposure } from '../model/exposure.mjs';
import { compositeScore, tilt, viewLabel } from '../model/tactical.mjs';
import { normalizeAnchor, classAnchor, treeTargets, treeBandCheck, groupOf, targetDistance } from '../model/tree.mjs';
import { checkAlert } from '../model/bands.mjs';
import { weightedScore } from '../model/scoring.mjs';
import { anchorSuggestion } from '../model/riskparity.mjs';
import { optimizeAllocation, roundLargestRemainder, noInstrumentGaps } from '../model/optimize.mjs';

export const ANCHOR_CLASSES = ['gold', 'silver', 'tl_fixed', 'equity_tr', 'equity_foreign', 'fx_fixed'];

// Kullanıcı parametreleri telefonda: acil uyarı, fon puanı ve çapa önerisi hattan gelen girdilerle
// (sınıf endeksi, puan bileşenleri, kovaryans) yeniden hesaplanır. Varsayılan parametrelerle sonuç hatla aynıdır.
export function applyParams(latest, P) {
  const classes = Object.fromEntries(Object.entries(latest.classes).map(([c, e]) => {
    if (!e.index_tail || !e.vol_annual_pct) return [c, e];
    const a = checkAlert(e.index_tail, e.vol_annual_pct, P.decision);
    return [c, { ...e, alert: a && { change_pct: a.change, threshold_pct: a.threshold, sigma_multiple: a.sigma_multiple, triggered: a.triggered } }];
  }));
  const funds = latest.funds.map((f) => {
    if (!f.components || f.score === null) return f;
    const raw = weightedScore(f.components, P.fund_quality.weights);
    return { ...f, raw_score: raw, score: raw === null ? null : 50 + (f.confidence ?? 1) * (raw - 50) };
  });
  const byCat = {};
  for (const f of funds) if (f.halal && f.score !== null) (byCat[f.category] ||= []).push(f);
  for (const list of Object.values(byCat)) list.sort((a, b) => b.score - a.score).forEach((f, i) => { f.rank = i + 1; f.peers = list.length; });
  let anchor = latest.anchor;
  if (anchor?.ok && anchor.cov) {
    const a = anchorSuggestion(anchor.cov, anchor.ids, P.anchor);
    anchor = { ...anchor, user_groups: { ...anchor.user_groups, weights: a.weights, risky_vol_pct: a.risky_vol_pct, k: a.k, warnings: a.warnings } };
  }
  return { ...latest, classes, funds, anchor };
}

export function fundIndex(latest) {
  return Object.fromEntries(latest.funds.map((f) => [f.code, f]));
}

// Dağılım tarihinden bugüne fiyatla kayan ağırlıklar ve o günden bu yana getiri.
export function driftWeights(latest, allocation) {
  const { dates, prices } = latest.prices_tail;
  let i0 = dates.findIndex((d) => d >= allocation.date);
  const stale = allocation.date < dates[0];
  if (i0 < 0) i0 = dates.length - 1;
  const codes = Object.keys(allocation.weights).filter((c) => allocation.weights[c] > 0);
  const missing = codes.filter((c) => !prices[c]);
  const base = {};
  const lastSeen = {};
  for (const c of codes) {
    const p = prices[c] || [];
    let k = i0;
    while (k < p.length && (p[k] === null || p[k] === undefined)) k++;
    base[c] = p[k] ?? null;
  }
  const series = [];
  for (let t = i0; t < dates.length; t++) {
    const raw = {};
    let value = 0;
    let total = 0;
    for (const c of codes) {
      const p = prices[c]?.[t];
      if (p !== null && p !== undefined) lastSeen[c] = p;
      const rel = base[c] && lastSeen[c] ? lastSeen[c] / base[c] : 1;
      raw[c] = allocation.weights[c] * rel;
      value += (allocation.weights[c] / 100) * rel;
      total += raw[c];
    }
    const weights = Object.fromEntries(codes.map((c) => [c, (raw[c] * 100) / total]));
    series.push({ date: dates[t], weights, value });
  }
  const last = series[series.length - 1];
  return {
    start_date: dates[i0],
    stale,
    missing,
    series,
    current: last.weights,
    return_pct: (last.value - 1) * 100,
  };
}

// ---------- Sözleşmeler (docs/model.md, Bölüm 9) ----------
// contracts: [{ no, date, weights: { kod: yüzde } }]; shares: { date, values: { no: yüzde } } — sözleşmelerin
// toplam birikimdeki payı, shares.date itibarıyla. Her sözleşme kendi fon fiyatlarıyla kayar; toplam, payların
// o günden bu yana kaymasıyla ağırlıklandırılır. Sonuç driftWeights ile aynı biçimdedir.
function valueAt(drift, date) {
  let v = 1;
  for (const p of drift.series) { if (p.date > date) break; v = p.value; }
  return v;
}

export function combineContracts(latest, contracts, shares) {
  const list = contracts.filter((c) => Object.keys(c.weights || {}).length);
  const drifts = Object.fromEntries(list.map((c) => [c.no, driftWeights(latest, { date: c.date, weights: c.weights })]));
  const raw = Object.fromEntries(list.map((c) => [c.no, Math.max(0, Number(shares?.values?.[c.no] ?? 0))]));
  let tot = Object.values(raw).reduce((a, b) => a + b, 0);
  if (!tot) { list.forEach((c) => { raw[c.no] = 1; }); tot = list.length; }
  const s0 = Object.fromEntries(list.map((c) => [c.no, raw[c.no] / tot]));
  const sd = shares?.date || latest.data_date;
  const base = Object.fromEntries(list.map((c) => [c.no, valueAt(drifts[c.no], sd)]));
  const start = list.map((c) => drifts[c.no].start_date).sort().pop();
  const dates = latest.prices_tail.dates.filter((d) => d >= start);
  const at = (drift, d) => drift.series.find((p) => p.date === d) || drift.series[drift.series.length - 1];
  const series = dates.map((d) => {
    const parts = list.map((c) => { const p = at(drifts[c.no], d); return [c.no, p, s0[c.no] * (p.value / base[c.no])]; });
    const value = parts.reduce((a, [, , v]) => a + v, 0);
    const weights = {};
    const sharesNow = {};
    for (const [no, p, v] of parts) {
      sharesNow[no] = (v * 100) / value;
      for (const [code, w] of Object.entries(p.weights)) weights[code] = (weights[code] || 0) + (v / value) * w;
    }
    return { date: d, weights, value, shares: sharesNow };
  });
  const v0 = series[0].value;
  series.forEach((p) => { p.value /= v0; });
  const last = series[series.length - 1];
  return {
    start_date: series[0].date,
    stale: list.some((c) => drifts[c.no].stale),
    missing: [...new Set(list.flatMap((c) => drifts[c.no].missing))],
    series,
    current: last.weights,
    shares_now: last.shares,
    return_pct: (last.value - 1) * 100,
    contracts: drifts,
  };
}

// Eski tek dağılımı sözleşme yapısına taşır.
export function migrateState(state) {
  if (state.contracts?.length || !state.allocation) return state;
  return { ...state, contracts: [{ no: '1', date: state.allocation.date, weights: state.allocation.weights }], shares: { date: state.allocation.date, values: { 1: 100 } } };
}

// Öneri tüm sözleşmelere aynı oranlarla uygulanır (karar b). Her sözleşme için mevcut → yeni adımlar ve
// önerilen fon sözleşmenin şirketinde yoksa uyarı (fon kurucusu farklıysa).
export function contractSteps(latest, combined, proposalWeights) {
  const funds = fundIndex(latest);
  return Object.entries(combined.contracts).map(([no, d]) => {
    const founders = [...new Set(Object.keys(d.current).map((c) => funds[c]?.founder).filter(Boolean))];
    const codes = [...new Set([...Object.keys(d.current), ...Object.keys(proposalWeights)])];
    const steps = codes.map((code) => ({ code, from: d.current[code] ?? 0, to: proposalWeights[code] ?? 0 }))
      .filter((x) => Math.round(x.from) !== x.to).sort((a, b) => (a.to - a.from) - (b.to - b.from));
    const keep = codes.filter((code) => Math.round(d.current[code] ?? 0) === (proposalWeights[code] ?? 0) && proposalWeights[code]);
    const foreign = Object.keys(proposalWeights).filter((c) => founders.length === 1 && funds[c]?.founder && funds[c].founder !== founders[0]);
    return { no, share: combined.shares_now[no], steps, keep, foreign };
  });
}

// Hedef (docs/model.md, Bölüm 5): sınıf görüşü S = 0,50·T + 0,25·M + 0,25·K; grup görüşü
// S_g = Σ grup içi pay · S; eğim yalnız gruba uygulanır, grup içi pay çapadaki gibi kalır.
// Çapada değeri olmayan sınıf "izlenir": hedefi ve bandı yoktur, mevcut payı korunur;
// yönetilen grupların hedefleri (100 − izlenen sınıfların mevcut payı)'na ölçeklenir.
// anchor: ağaç biçimi { groups, splits } ya da eski düz { sınıf: yüzde }.
export function targetsToday(latest, anchor, views, params, exposure = null) {
  const t = params.tactical;
  const tree = params.anchor.tree;
  const a = normalizeAnchor(tree, anchor);
  const ca = classAnchor(tree, a);
  const rows = {};
  const classS = {};
  for (const cls of ANCHOR_CLASSES) {
    const c = latest.classes[cls] || {};
    const T = c.trend?.T ?? 0;
    const M = c.macro ?? 0;
    const K = views[cls] ?? 0;
    const S = compositeScore({ trend: T, macro: M, user: K }, t.weights);
    classS[cls] = S;
    const managed = cls in ca;
    rows[cls] = { T, M, K, S, tilt: tilt(S, t), label: viewLabel(S, t), group: groupOf(tree, cls), anchor: managed ? ca[cls] : null, managed, target: null };
  }
  const unmanaged = ANCHOR_CLASSES.filter((c) => !rows[c].managed);
  const unmanagedShare = exposure ? unmanaged.reduce((s, c) => s + (exposure[c] || 0), 0) : 0;
  const tt = treeTargets(tree, a, classS, t, unmanagedShare);
  for (const c of Object.keys(tt.targets)) rows[c].target = tt.targets[c];
  return { anchor: a, rows, groups: tt.groups, group_targets: tt.group_targets, targets: tt.targets, unmanaged, unmanaged_share: unmanagedShare, raw_sum: tt.raw_sum };
}

export function currentExposure(latest, weights) {
  const funds = fundIndex(latest);
  const exposures = Object.fromEntries(Object.keys(weights).map((c) => [c, funds[c]?.exposure]).filter(([, e]) => e));
  return portfolioExposure(weights, exposures);
}

// Her gün için maruziyet ve iki düzeyli bant durumu. Sayaçlar ('group:<grup>', 'split:<grup>') =
// sondan geriye kesintisiz bant dışı gün sayısı. Geçmiş günler bugünün hedefiyle değerlendirilir.
export function bandHistory(latest, drift, targets, params) {
  const funds = fundIndex(latest);
  const tree = params.anchor.tree;
  const exposures = Object.fromEntries(Object.keys(drift.current).map((c) => [c, funds[c]?.exposure]).filter(([, e]) => e));
  const days = drift.series.map((s) => {
    const exposure = portfolioExposure(s.weights, exposures);
    return { date: s.date, exposure, check: treeBandCheck(tree, targets.anchor, exposure, targets.group_targets, params.decision) };
  });
  const today = days[days.length - 1];
  const keys = [
    ...Object.keys(targets.group_targets).map((g) => ['group:' + g, (ck) => ck.groups[g].status !== 'inside']),
    ...Object.keys(today.check.splits).map((g) => ['split:' + g, (ck) => Object.values(ck.splits[g] || {}).some((x) => x.status !== 'inside')]),
  ];
  const counters = {};
  for (const [key, out] of keys) {
    let n = 0;
    for (let i = days.length - 1; i >= 0 && out(days[i].check); i--) n++;
    counters[key] = n;
  }
  const history = days.map((d) => ({ date: d.date, group_exposure: d.check.group_exposure }));
  const distance = targetDistance(today.check.group_exposure, targets.group_targets);
  return { exposure: today.exposure, ...today.check, counters, history, distance, days_observed: days.length };
}

function businessDaysBetween(a, b) {
  let n = 0;
  for (let d = Date.parse(a + 'T00:00:00Z') + 86400000; d <= Date.parse(b + 'T00:00:00Z'); d += 86400000) {
    const wd = new Date(d).getUTCDay();
    if (wd !== 0 && wd !== 6) n++;
  }
  return n;
}

// Öneri koşulu: bir grubun ya da grup içi payın sayacı teyit süresine ulaştı ve son 20 iş gününde reddedilmiş öneri yok.
export function recommendationDue(bands, decisions, today, params) {
  const due = Object.entries(bands.counters).filter(([, n]) => n >= params.decision.confirm_days).map(([c]) => c);
  const lastReject = decisions.filter((d) => d.action === 'reddedildi').map((d) => d.date).sort().pop();
  const suppressed = lastReject && businessDaysBetween(lastReject, today) < params.decision.confirm_days;
  return { due, suppressed: !!suppressed, active: due.length > 0 && !suppressed };
}

// Eylem önerisi: ana sınıfı (grubu ve grup içi payı) bant içindeki fonlar sabit; aynı kategorideki aday ancak puanı ≥ 20 yüksekse değiştirir.
export function buildProposal(latest, current, bands, targets, params) {
  const funds = fundIndex(latest);
  const gap = params.decision.switch_score_gap;
  const best = {};
  for (const f of latest.funds) {
    if (!f.halal || f.score === null || f.category === 'unclassified' || params.allocation.excluded_categories.includes(f.category)) continue;
    if (!best[f.category] || f.score > best[f.category].score) best[f.category] = f;
  }
  const bounds = {};
  const notes = [];
  const candidates = new Set();
  for (const [code, w] of Object.entries(current)) {
    const f = funds[code];
    candidates.add(code);
    if (!f || !bands.class_out[f.main_class]) {
      bounds[code] = [w, w];
      notes.push({ code, kind: 'sabit', text: f ? 'ana sınıfı bant içinde' : 'veride yok' });
    } else if (f.flags.includes('yeni_fon')) {
      bounds[code] = [0, Math.min(w, params.fund_quality.new_fund_cap_pct)];
    }
  }
  for (const [cat, b] of Object.entries(best)) {
    if (candidates.has(b.code)) continue;
    const mine = Object.keys(current).map((c) => funds[c]).filter((f) => f && f.category === cat && f.score !== null);
    const blocking = mine.find((f) => b.score - f.score < gap);
    if (blocking) {
      notes.push({ code: b.code, kind: 'aday_degil', text: `${blocking.code} ile puan farkı ${(b.score - blocking.score).toFixed(0)} (< ${gap})` });
      continue;
    }
    candidates.add(b.code);
    if (b.flags.includes('yeni_fon')) bounds[b.code] = [0, params.fund_quality.new_fund_cap_pct];
  }
  const list = [...candidates];
  const exposures = Object.fromEntries(list.map((c) => [c, funds[c]?.exposure || Object.fromEntries(CLASSES.map((k) => [k, 0]))]));
  // İzlenen (çapada olmayan) sınıflar mevcut paylarında tutulur.
  const unmanaged = ANCHOR_CLASSES.filter((c) => !(c in targets));
  const fullTargets = { ...Object.fromEntries(CLASSES.map((c) => [c, 0])), ...Object.fromEntries(unmanaged.map((c) => [c, bands.exposure[c] || 0])), ...targets };
  const opt = optimizeAllocation({ candidates: list, exposures, targets: fullTargets, fees: {}, bounds, lambda: params.allocation.fee_lambda });
  const weights = roundLargestRemainder(opt.weights);
  const exposure = portfolioExposure(weights, exposures);
  const changes = [...new Set([...Object.keys(current), ...Object.keys(weights)])]
    .map((code) => ({ code, from: current[code] ?? 0, to: weights[code] ?? 0 }))
    .sort((a, b) => b.to - a.to || b.from - a.from);
  return {
    weights,
    exposure,
    changes,
    notes,
    gaps: noInstrumentGaps(exposure, targets, params.allocation.no_instrument_pts),
  };
}
