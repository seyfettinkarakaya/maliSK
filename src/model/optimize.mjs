// Katman 3: fon dağılımı (docs/model.md, Bölüm 10).
// min_w Σ_s (Σ_f w_f · i_(f,s) − h_s)² + λ · Σ_f w_f · u_f,  lo_f ≤ w_f ≤ hi_f,  Σ w_f = 1
import { CLASSES } from './params.mjs';

// v'yi { Σ w = 1, lo ≤ w ≤ hi } kümesine izdüşürür (τ üzerinde ikiye bölme).
function project(v, lo, hi) {
  const f = (tau) => v.reduce((s, x, i) => s + Math.min(hi[i], Math.max(lo[i], x - tau)), 0);
  let a = Math.min(...v.map((x, i) => x - hi[i])) - 1;
  let b = Math.max(...v.map((x, i) => x - lo[i])) + 1;
  for (let it = 0; it < 200; it++) {
    const m = (a + b) / 2;
    if (f(m) > 1) a = m;
    else b = m;
  }
  const tau = (a + b) / 2;
  return v.map((x, i) => Math.min(hi[i], Math.max(lo[i], x - tau)));
}

export function objective(w, A, h, u, lambda) {
  let err = 0;
  for (let s = 0; s < A.length; s++) {
    const e = A[s].reduce((acc, a, f) => acc + a * w[f], 0) - h[s];
    err += e * e;
  }
  return err + lambda * w.reduce((acc, x, f) => acc + x * u[f], 0);
}

// candidates: fon kodları; exposures/targets yüzde; fees yüzde; bounds: { kod: [alt, üst] } yüzde.
export function optimizeAllocation({ candidates, exposures, targets, fees, bounds = {}, lambda, classes = CLASSES, max_iter = 20000 }) {
  const n = candidates.length;
  const A = classes.map((c) => candidates.map((f) => (exposures[f][c] || 0) / 100));
  const h = classes.map((c) => (targets[c] || 0) / 100);
  const u = candidates.map((f) => fees[f] || 0);
  const lo = candidates.map((f) => (bounds[f]?.[0] ?? 0) / 100);
  const hi = candidates.map((f) => (bounds[f]?.[1] ?? 100) / 100);
  if (lo.reduce((s, x) => s + x, 0) > 1 + 1e-9 || hi.reduce((s, x) => s + x, 0) < 1 - 1e-9) {
    throw new Error('Kısıtlar sağlanamıyor: alt sınırların toplamı 100\'ü aşıyor ya da üst sınırların toplamı 100\'e ulaşmıyor.');
  }
  let lip = 0;
  for (const row of A) for (const a of row) lip += a * a;
  const step = 1 / (2 * lip + 1e-12);
  let w = project(new Array(n).fill(1 / n), lo, hi);
  let y = w.slice();
  let t = 1;
  for (let it = 0; it < max_iter; it++) {
    const r = A.map((row, s) => row.reduce((acc, a, f) => acc + a * y[f], 0) - h[s]);
    const grad = candidates.map((_, f) => 2 * A.reduce((acc, row, s) => acc + row[f] * r[s], 0) + lambda * u[f]);
    const next = project(y.map((x, f) => x - step * grad[f]), lo, hi);
    const tn = (1 + Math.sqrt(1 + 4 * t * t)) / 2;
    y = next.map((x, f) => x + ((t - 1) / tn) * (x - w[f]));
    const moved = next.reduce((acc, x, f) => acc + Math.abs(x - w[f]), 0);
    w = next;
    t = tn;
    if (moved < 1e-13) break;
  }
  const weights = Object.fromEntries(candidates.map((f, i) => [f, w[i] * 100]));
  return { weights, objective: objective(w, A, h, u, lambda) };
}

// En büyük kalan yöntemi: tam sayı yüzdeler, toplam tam 100.
export function roundLargestRemainder(weights) {
  const entries = Object.entries(weights);
  const floors = entries.map(([k, v]) => [k, Math.floor(v + 1e-9), v - Math.floor(v + 1e-9)]);
  let rest = 100 - floors.reduce((s, [, f]) => s + f, 0);
  floors.sort((a, b) => b[2] - a[2]);
  for (const row of floors) {
    if (rest <= 0) break;
    row[1] += 1;
    rest--;
  }
  return Object.fromEntries(floors.filter(([, f]) => f > 0).map(([k, f]) => [k, f]));
}

export function noInstrumentGaps(exposure, targets, pts) {
  return Object.entries(targets)
    .filter(([c, t]) => Math.abs((exposure[c] || 0) - t) > pts)
    .map(([c, t]) => ({ cls: c, target: t, value: exposure[c] || 0, gap: (exposure[c] || 0) - t }));
}
