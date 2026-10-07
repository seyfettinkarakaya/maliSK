// Başarı indisleri (docs/model.md, Bölüm 9.2). Getiriler yüzde, sonuçlar aylık eşdeğer yüzde.

export const PERIOD_MONTHS = { '1m': 1, '3m': 3, '6m': 6, '1y': 12, '3y': 36, '5y': 60 };

export function ytdMonths(date) {
  const d = new Date(date);
  const start = Date.UTC(d.getUTCFullYear(), 0, 1);
  const days = (Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - start) / 86400000;
  return Math.max(1, days / 30.4375);
}

export function periodMonths(period, ytd_months) {
  return period === 'ytd' ? ytd_months : PERIOD_MONTHS[period];
}

// Bileşik: (1 + r)^(1/m) − 1. Basit: r / m (kullanıcının eski Excel yöntemi).
export function monthlyEquivalent(r_pct, months, method = 'compound') {
  if (method === 'simple') return r_pct / months;
  return (Math.pow(1 + r_pct / 100, 1 / months) - 1) * 100;
}

const has = (v) => v !== null && v !== undefined && !Number.isNaN(v);

// Ind5 / Ind7: geçerli dönemlerin aylık eşdeğerlerinin ortalaması; bölen daima geçerli dönem sayısı.
export function periodIndex(returns, periods, { method = 'compound', ytd_months }) {
  const vals = periods
    .filter((p) => has(returns[p]))
    .map((p) => monthlyEquivalent(returns[p], periodMonths(p, ytd_months), method));
  if (!vals.length) return { value: null, n: 0 };
  return { value: vals.reduce((a, b) => a + b, 0) / vals.length, n: vals.length };
}

// Uzun vade indisi: bileşik aylık eşdeğerlerin ağırlıklı ortalaması; eksik dönemin ağırlığı diğerlerine dağılır.
export function longTermIndex(returns, weights) {
  let sum = 0;
  let wsum = 0;
  for (const [p, w] of Object.entries(weights)) {
    if (!has(returns[p])) continue;
    sum += w * monthlyEquivalent(returns[p], PERIOD_MONTHS[p], 'compound');
    wsum += w;
  }
  return wsum ? sum / wsum : null;
}

// Fazla getiri: fonun dönem getirisi ile içerikten beklenen getirinin farkı, sonra uzun vade indisi.
export function excessReturns(fund_returns, expected_returns) {
  const out = {};
  for (const p of Object.keys(fund_returns)) {
    if (has(fund_returns[p]) && has(expected_returns[p])) {
      // Bileşik fark: (1 + r_f) / (1 + r_b) − 1
      out[p] = ((1 + fund_returns[p] / 100) / (1 + expected_returns[p] / 100) - 1) * 100;
    }
  }
  return out;
}
