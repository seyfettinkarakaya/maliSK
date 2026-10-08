// Fon kalitesi puanı (docs/model.md, Bölüm 9): medyan ölçeği, eksik bileşenin ağırlığı
// diğerlerine dağılır, kısa geçmişli fonun puanı 50'ye çekilir.

export function median(values) {
  const v = values.filter((x) => x !== null && x !== undefined && !Number.isNaN(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

const clip01 = (x) => Math.min(1, Math.max(0, x));

// Medyandaki fon 0,5; medyandan bir "ölçek" iyi olan 1, bir ölçek kötü olan 0.
export function medianScaled(value, med, scale, higher_is_better = true) {
  if (value === null || value === undefined || med === null) return null;
  const sign = higher_is_better ? 1 : -1;
  return clip01(0.5 + (sign * (value - med)) / (2 * scale));
}

export function weightedScore(components, weights) {
  let num = 0;
  let den = 0;
  for (const [name, w] of Object.entries(weights)) {
    const c = components[name];
    if (c === null || c === undefined) continue;
    num += w * c;
    den += w;
  }
  return den ? (100 * num) / den : null;
}

export function shrinkScore(raw, history_months, full_months) {
  if (raw === null) return null;
  const confidence = Math.min(1, history_months / full_months);
  return { score: 50 + confidence * (raw - 50), confidence };
}

// Ücret ya da azami gider bilinmiyorsa o koşul cezalandırılmaz.
export function hygiene(fee, max_ter, size_tl, small_fund_tl) {
  const overFee = fee !== null && fee !== undefined && max_ter !== null && max_ter !== undefined && fee > max_ter;
  return Math.max(0, 1 - 0.5 * (overFee ? 1 : 0) - 0.5 * (size_tl < small_fund_tl ? 1 : 0));
}

// Dönem sürekliliği: fonun değeri olan ve kategoride en az min_peers değer bulunan her dönemde
// fonun getirisi kategori medyanına eşit veya büyükse isabet.
export function periodConsistency(code, peers, periods, min_peers) {
  let hits = 0;
  let valid = 0;
  const own = peers.find((p) => p.code === code);
  for (const p of periods) {
    const vals = peers.map((f) => f.returns[p]).filter((x) => x !== null && x !== undefined);
    const mine = own.returns[p];
    if (mine === null || mine === undefined || vals.length < min_peers) continue;
    valid++;
    if (mine >= median(vals)) hits++;
  }
  return valid ? { value: hits / valid, hits, valid } : { value: null, hits: 0, valid: 0 };
}

// metrics: { code, history_months, consistency, excess_index, tracking_error?, mdd?, sortino?, fee, hygiene }
export function scoreCategory(metrics, { passive, params }) {
  const fq = params.fund_quality;
  const s = fq.scales;
  const scored = metrics.filter((m) => m.history_months >= fq.min_history_months);
  const med = (k) => median(scored.map((m) => m[k]));
  const meds = {
    excess_index: med('excess_index'),
    fee: med('fee'),
    tracking_error: med('tracking_error'),
    mdd: med('mdd'),
    sortino: med('sortino'),
  };
  return metrics.map((m) => {
    if (m.history_months < fq.min_history_months) {
      return { code: m.code, score: null, new_fund: true, components: {} };
    }
    let risk;
    if (passive) {
      risk = medianScaled(m.tracking_error, meds.tracking_error, s.tracking_error_pts, false);
    } else {
      const a = medianScaled(m.mdd, meds.mdd, s.mdd_pts, false);
      const b = medianScaled(m.sortino, meds.sortino, s.sortino, true);
      risk = a === null ? b : b === null ? a : (a + b) / 2;
    }
    const components = {
      consistency: m.consistency,
      excess_index: medianScaled(m.excess_index, meds.excess_index, s.excess_monthly_pts, true),
      risk,
      cost: medianScaled(m.fee, meds.fee, s.cost_pts, false),
      hygiene: m.hygiene,
    };
    const raw = weightedScore(components, fq.weights);
    const shrunk = shrinkScore(raw, m.history_months, fq.full_confidence_months);
    return { code: m.code, raw_score: raw, score: shrunk?.score ?? null, confidence: shrunk?.confidence ?? null, components, medians: meds };
  });
}
