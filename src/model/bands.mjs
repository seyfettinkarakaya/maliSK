// Göreli bant ve oynaklığa göre acil uyarı (docs/model.md, Bölüm 11).

export function bandWidth(target, d) {
  return Math.min(d.band_max_pts, Math.max(d.band_min_pts, (target * d.band_rel_pct) / 100));
}

export function bandCheck(exposure, targets, d) {
  const out = {};
  for (const [cls, t] of Object.entries(targets)) {
    const w = bandWidth(t, d);
    const low = Math.max(0, t - w);
    const high = t + w;
    const x = exposure[cls] ?? 0;
    out[cls] = { target: t, width: w, low, high, value: x, status: x > high ? 'above' : x < low ? 'below' : 'inside' };
  }
  return out;
}

// Eşik = çarpan × yıllık oynaklık × √(gün / 252), yüzde.
export function alertThreshold(annual_vol_pct, d) {
  return d.alert_sigma_mult * annual_vol_pct * Math.sqrt(d.alert_window_days / 252);
}

// index: günlük sınıf endeksi (eskiden yeniye). Son pencere içindeki düşüş eşiği aşarsa uyarı.
export function checkAlert(index, annual_vol_pct, d) {
  const n = d.alert_window_days;
  if (index.length <= n) return null;
  const last = index[index.length - 1];
  const prev = index[index.length - 1 - n];
  const change = (last / prev - 1) * 100;
  const threshold = alertThreshold(annual_vol_pct, d);
  const sigma20 = annual_vol_pct * Math.sqrt(n / 252);
  return { change, threshold, sigma_multiple: -change / sigma20, triggered: -change > threshold };
}
