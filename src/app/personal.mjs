// Kişisel hesaplar (telefonda): kayan ağırlıklar, hedef, bant sayaçları, eylem önerisi.
// Girdi: data/latest.json (piyasa tarafı) + kullanıcının dağılımı, çapası ve görüşleri.
import { CLASSES } from '../model/params.mjs';
import { portfolioExposure } from '../model/exposure.mjs';
import { compositeScore, tilt, targetsFromAnchor, viewLabel } from '../model/tactical.mjs';
import { bandCheck } from '../model/bands.mjs';
import { optimizeAllocation, roundLargestRemainder, noInstrumentGaps } from '../model/optimize.mjs';

export const ANCHOR_CLASSES = ['gold', 'silver', 'tl_fixed', 'equity_tr', 'equity_foreign', 'fx_fixed'];

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

export const isManaged = (anchor, cls) => typeof anchor?.[cls] === 'number' && Number.isFinite(anchor[cls]);

// Hedef = çapa + eğim(S); S = 0,50·T + 0,25·M + 0,25·K.
// Çapada değeri olmayan sınıf "izlenir": hedefi ve bandı yoktur, mevcut payı korunur;
// yönetilen sınıfların hedefleri (100 − izlenen sınıfların mevcut payı)'na ölçeklenir.
export function targetsToday(latest, anchor, views, params, exposure = null) {
  const t = params.tactical;
  const rows = {};
  const tilts = {};
  const managed = ANCHOR_CLASSES.filter((c) => isManaged(anchor, c));
  const unmanaged = ANCHOR_CLASSES.filter((c) => !isManaged(anchor, c));
  for (const cls of ANCHOR_CLASSES) {
    const c = latest.classes[cls] || {};
    const T = c.trend?.T ?? 0;
    const M = c.macro ?? 0;
    const K = views[cls] ?? 0;
    const S = compositeScore({ trend: T, macro: M, user: K }, t.weights);
    tilts[cls] = tilt(S, t);
    rows[cls] = { T, M, K, S, tilt: tilts[cls], label: viewLabel(S, t), anchor: isManaged(anchor, cls) ? anchor[cls] : null, managed: isManaged(anchor, cls), target: null };
  }
  const unmanagedShare = exposure ? unmanaged.reduce((s, c) => s + (exposure[c] || 0), 0) : 0;
  const scale = (100 - unmanagedShare) / 100;
  const base = targetsFromAnchor(Object.fromEntries(managed.map((c) => [c, anchor[c]])), tilts);
  const targets = Object.fromEntries(managed.map((c) => [c, base[c] * scale]));
  const rawSum = managed.reduce((s, c) => s + Math.max(0, anchor[c] + tilts[c]), 0);
  for (const c of managed) rows[c].target = targets[c];
  return { rows, targets, unmanaged, unmanaged_share: unmanagedShare, raw_sum: rawSum };
}

export function currentExposure(latest, weights) {
  const funds = fundIndex(latest);
  const exposures = Object.fromEntries(Object.keys(weights).map((c) => [c, funds[c]?.exposure]).filter(([, e]) => e));
  return portfolioExposure(weights, exposures);
}

// Her gün için maruziyet ve bant durumu; sayaç = sondan geriye kesintisiz bant dışı gün sayısı.
// Not: geçmiş günler bugünün hedefiyle değerlendirilir (ilk sürüm sadeleştirmesi).
export function bandHistory(latest, drift, targets, params) {
  const funds = fundIndex(latest);
  const exposures = Object.fromEntries(Object.keys(drift.current).map((c) => [c, funds[c]?.exposure]).filter(([, e]) => e));
  const days = drift.series.map((s) => ({ date: s.date, exposure: portfolioExposure(s.weights, exposures) }));
  const today = days[days.length - 1];
  const check = bandCheck(today.exposure, targets, params.decision);
  const counters = {};
  for (const cls of Object.keys(targets)) {
    let n = 0;
    for (let i = days.length - 1; i >= 0; i--) {
      const st = bandCheck(days[i].exposure, { [cls]: targets[cls] }, params.decision)[cls].status;
      if (st === 'inside') break;
      n++;
    }
    counters[cls] = n;
  }
  return { exposure: today.exposure, check, counters, days_observed: days.length };
}

function businessDaysBetween(a, b) {
  let n = 0;
  for (let d = Date.parse(a + 'T00:00:00Z') + 86400000; d <= Date.parse(b + 'T00:00:00Z'); d += 86400000) {
    const wd = new Date(d).getUTCDay();
    if (wd !== 0 && wd !== 6) n++;
  }
  return n;
}

// Öneri koşulu: bir sınıfın sayacı teyit süresine ulaştı ve son 20 iş gününde reddedilmiş öneri yok.
export function recommendationDue(bands, decisions, today, params) {
  const due = Object.entries(bands.counters).filter(([, n]) => n >= params.decision.confirm_days).map(([c]) => c);
  const lastReject = decisions.filter((d) => d.action === 'reddedildi').map((d) => d.date).sort().pop();
  const suppressed = lastReject && businessDaysBetween(lastReject, today) < params.decision.confirm_days;
  return { due, suppressed: !!suppressed, active: due.length > 0 && !suppressed };
}

// Eylem önerisi: bant içindeki sınıfların fonları sabit; aynı kategorideki aday ancak puanı ≥ 20 yüksekse değiştirir.
export function buildProposal(latest, current, bands, targets, params) {
  const funds = fundIndex(latest);
  const gap = params.decision.switch_score_gap;
  const best = {};
  for (const f of latest.funds) {
    if (!f.halal || f.score === null || f.category === 'unclassified') continue;
    if (!best[f.category] || f.score > best[f.category].score) best[f.category] = f;
  }
  const bounds = {};
  const notes = [];
  const candidates = new Set();
  for (const [code, w] of Object.entries(current)) {
    const f = funds[code];
    candidates.add(code);
    const st = f && bands.check[f.main_class]?.status;
    if (!f || !st || st === 'inside') {
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
