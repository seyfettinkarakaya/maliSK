// Geri test (docs/model.md, Bölüm 4.4): bir çapanın geçmiş aylık sınıf getirileriyle davranışı.
// Her ay başında çapa ağırlıklarına dönülür (aylık yeniden dengeleme). O ay verisi olmayan sınıfın
// ağırlığı diğerlerine orantılı dağılır. Getiriler nominaldir (TÜFE verisi gelince reel de hesaplanır).

// monthly: { dates: [ay sonu tarihleri], series: { sınıf: [endeks | null] } }; weights: { sınıf: yüzde }.
export function backtest(weights, monthly) {
  const classes = Object.keys(weights).filter((c) => weights[c] > 0);
  const has = classes.filter((c) => monthly.series[c]?.some((v) => v !== null && v !== undefined));
  const missing = classes.filter((c) => !has.includes(c));
  const rets = [];
  const dates = [];
  for (let i = 1; i < monthly.dates.length; i++) {
    let num = 0;
    let den = 0;
    for (const c of has) {
      const a = monthly.series[c][i - 1];
      const b = monthly.series[c][i];
      if (a === null || a === undefined || b === null || b === undefined) continue;
      num += weights[c] * (b / a - 1);
      den += weights[c];
    }
    if (!den) continue;
    rets.push(num / den);
    dates.push(monthly.dates[i]);
  }
  if (rets.length < 12) return { ok: false, months: rets.length, missing };
  let level = 1;
  let peak = 1;
  let mdd = 0;
  const path = [1];
  for (const r of rets) {
    level *= 1 + r;
    path.push(level);
    peak = Math.max(peak, level);
    mdd = Math.min(mdd, level / peak - 1);
  }
  let worst = Infinity;
  let best = -Infinity;
  for (let i = 12; i < path.length; i++) {
    const r = path[i] / path[i - 12] - 1;
    worst = Math.min(worst, r);
    best = Math.max(best, r);
  }
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const sd = Math.sqrt(rets.reduce((a, b) => a + (b - mean) ** 2, 0) / (rets.length - 1));
  return {
    ok: true,
    months: rets.length,
    start: dates[0],
    end: dates[dates.length - 1],
    annual_return_pct: (level ** (12 / rets.length) - 1) * 100,
    annual_vol_pct: sd * Math.sqrt(12) * 100,
    max_drawdown_pct: mdd * 100,
    worst_12m_pct: worst * 100,
    best_12m_pct: best * 100,
    missing,
  };
}
