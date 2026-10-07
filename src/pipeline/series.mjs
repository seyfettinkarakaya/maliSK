// Zaman serisi yardımcıları. Tarihler 'YYYY-MM-DD' dizgesi; getiriler oran.
import { PERIOD_MONTHS } from '../model/indices.mjs';

// Ay kaydırma; ayın son gününü taşırmaz (31 Mart − 1 ay = 28/29 Şubat).
export function shiftMonths(date, months) {
  const y = Number(date.slice(0, 4));
  const m = Number(date.slice(5, 7)) - 1 - months;
  const d = Number(date.slice(8, 10));
  const ty = y + Math.floor(m / 12);
  const tm = ((m % 12) + 12) % 12;
  const last = new Date(Date.UTC(ty, tm + 1, 0)).getUTCDate();
  return `${ty}-${String(tm + 1).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`;
}

export function shiftDays(date, days) {
  return new Date(Date.parse(date + 'T00:00:00Z') + days * 86400000).toISOString().slice(0, 10);
}

export function periodStart(end, period) {
  if (period === 'ytd') return `${Number(end.slice(0, 4)) - 1}-12-31`;
  return shiftMonths(end, PERIOD_MONTHS[period]);
}

// Sıralı tarih dizisinde date'e eşit veya önceki son konum; yoksa −1.
export function onOrBefore(dates, date) {
  let lo = 0;
  let hi = dates.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (dates[mid] <= date) {
      ans = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return ans;
}

// values: fiyat ya da endeks. Başlangıç tarihinde değer yoksa (seri daha geç başlıyorsa) null.
export function periodReturn(dates, values, end, period) {
  const j = onOrBefore(dates, end);
  const i = onOrBefore(dates, periodStart(end, period));
  if (i < 0 || j < 0 || i >= j) return null;
  return (values[j] / values[i] - 1) * 100;
}

export function periodReturns(dates, values, end, periods) {
  return Object.fromEntries(periods.map((p) => [p, periodReturn(dates, values, end, p)]));
}

export function dailyReturns(dates, values) {
  const out = new Map();
  for (let i = 1; i < dates.length; i++) out.set(dates[i], values[i] / values[i - 1] - 1);
  return out;
}

export function medianOf(arr) {
  if (!arr.length) return null;
  const v = arr.slice().sort((a, b) => a - b);
  const m = v.length >> 1;
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

// Üye fonların günlük getirilerinin medyanı → { dates, returns, index } (endeks 1'den başlar).
export function medianSeries(calendar, memberReturns) {
  const dates = [];
  const returns = [];
  const index = [];
  let level = 1;
  for (const d of calendar) {
    const vals = [];
    for (const m of memberReturns) {
      const r = m.get(d);
      if (r !== undefined) vals.push(r);
    }
    if (!vals.length) continue;
    const r = medianOf(vals);
    level *= 1 + r;
    dates.push(d);
    returns.push(r);
    index.push(level);
  }
  return { dates, returns, index };
}

export function stdev(arr) {
  if (arr.length < 2) return null;
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  return Math.sqrt(arr.reduce((a, b) => a + (b - mean) ** 2, 0) / (arr.length - 1));
}

// En büyük düşüş, yüzde (pozitif sayı).
export function maxDrawdown(index) {
  let peak = -Infinity;
  let mdd = 0;
  for (const v of index) {
    peak = Math.max(peak, v);
    mdd = Math.max(mdd, 1 - v / peak);
  }
  return mdd * 100;
}

export function sortino(returns, periodsPerYear) {
  if (returns.length < 20) return null;
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const down = Math.sqrt(returns.reduce((a, r) => a + Math.min(0, r) ** 2, 0) / returns.length);
  return down ? (mean * periodsPerYear) / (down * Math.sqrt(periodsPerYear)) : null;
}

// Her 'step' iş gününde bir nokta, sondan geriye; en çok maxPoints nokta.
export function sampleEvery(values, step, maxPoints) {
  const out = [];
  for (let i = values.length - 1; i >= 0 && out.length < maxPoints; i -= step) out.unshift(values[i]);
  return out;
}

// Ay sonu endeks değerlerinden son n tamamlanmış ayın getirileri: { 'YYYY-MM': oran }.
export function monthlyReturns(dates, index, n) {
  const ends = [];
  for (let i = 0; i < dates.length; i++) {
    if (i === dates.length - 1 || dates[i + 1].slice(0, 7) !== dates[i].slice(0, 7)) ends.push(i);
  }
  const complete = ends.slice(0, -1); // son ay henüz bitmemiş sayılır
  const out = {};
  for (let k = Math.max(1, complete.length - n); k < complete.length; k++) {
    out[dates[complete[k]].slice(0, 7)] = index[complete[k]] / index[complete[k - 1]] - 1;
  }
  return out;
}
