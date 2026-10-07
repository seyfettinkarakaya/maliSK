// Taktik görüş ve eğim (docs/model.md, Bölüm 8.3–8.4).

export function trendScore(signals) {
  const v = signals.filter((x) => x === 1 || x === -1);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0;
}

export function compositeScore({ trend = 0, macro = 0, user = 0 }, weights) {
  return weights.trend * trend + weights.macro * macro + weights.user * user;
}

export function viewLabel(s, t) {
  if (s >= t.positive_threshold) return 'positive';
  if (s <= t.negative_threshold) return 'negative';
  return 'neutral';
}

export function tilt(s, t) {
  if (t.tilt_mode === 'stepwise') {
    if (s >= t.positive_threshold) return t.max_tilt_pts;
    if (s <= t.negative_threshold) return -t.max_tilt_pts;
    return 0;
  }
  return t.max_tilt_pts * Math.max(-1, Math.min(1, s / t.full_tilt_at));
}

// Makro sinyal: rejim matrisi; TL sabit ve döviz sabit için reel faiz kuralı önce gelir.
export function macroSignal(cls, { regimes, real_rate_pct }, t) {
  if (cls in t.real_rate_rule && real_rate_pct !== null && real_rate_pct !== undefined && real_rate_pct !== 0) {
    const sign = real_rate_pct > 0 ? 1 : -1;
    return sign * t.real_rate_rule[cls];
  }
  const src = t.regime_source[cls];
  const regime = src && regimes?.[src];
  if (!regime) return 0;
  return t.regime_matrix[regime]?.[cls] ?? 0;
}

// hedef = çapa + eğim; negatif hedef 0'a çekilir, sonra toplam 100'e ölçeklenir.
export function targetsFromAnchor(anchor, tilts) {
  const raw = {};
  let sum = 0;
  for (const [cls, a] of Object.entries(anchor)) {
    raw[cls] = Math.max(0, a + (tilts[cls] || 0));
    sum += raw[cls];
  }
  const out = {};
  for (const cls of Object.keys(raw)) out[cls] = sum ? (raw[cls] * 100) / sum : 0;
  return out;
}
