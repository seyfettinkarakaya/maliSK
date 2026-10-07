// Sürüm 2.1 kararlarının birim testleri: medyan ölçeği, kısa geçmiş güveni, sürekli eğim,
// reel faiz kuralı, oynaklığa göre acil uyarı, iki katmanlı risk eşitliği, optimizasyon.
import test from 'node:test';
import assert from 'node:assert/strict';
import { FUNDS } from './fixtures/ek_a.mjs';
import { DEFAULT_PARAMS as P } from '../src/model/params.mjs';
import { fundExposure, portfolioExposure } from '../src/model/exposure.mjs';
import { medianScaled, weightedScore, shrinkScore, scoreCategory } from '../src/model/scoring.mjs';
import { compositeScore, tilt, targetsFromAnchor, macroSignal, viewLabel } from '../src/model/tactical.mjs';
import { alertThreshold, checkAlert } from '../src/model/bands.mjs';
import { ercWeights, riskContributions, hierarchicalErc, anchorSuggestion, applyCap, suggestGroups, portfolioVol, covariance } from '../src/model/riskparity.mjs';
import { optimizeAllocation, roundLargestRemainder, objective } from '../src/model/optimize.mjs';
import { CLASSES } from '../src/model/params.mjs';

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} beklenen ${b}, bulunan ${a}`);

test('M3: medyan ölçeği iki fonlu kategoride yapay uç değer üretmez', () => {
  near(medianScaled(0.9, 0.905, 0.5, false), 0.505, 1e-9);
  near(medianScaled(0.91, 0.905, 0.5, false), 0.495, 1e-9);
  assert.equal(medianScaled(0.2, 0.9, 0.5, false), 1, 'üst sınır 1');
});

test('M3: örnek ekrandaki VGA puanı', () => {
  const s = weightedScore({ consistency: 0.52, excess_index: 0.58, risk: 0.62, cost: 0.545, hygiene: 1 }, P.fund_quality.weights);
  near(s, 58.075, 1e-9);
  // Hesaplanamayan bileşenin ağırlığı diğerlerine dağılır.
  near(weightedScore({ consistency: 1, excess_index: null, risk: null, cost: 0, hygiene: null }, P.fund_quality.weights), 70, 1e-9);
});

test('Ö1: kısa geçmişli fonun puanı 50\'ye çekilir', () => {
  const r = shrinkScore(74, 20, 36);
  near(r.score, 63.33, 0.01);
  near(shrinkScore(74, 48, 36).score, 74, 1e-9);
});

test('scoreCategory: yeni fon puanlanmaz, medyan ve güven uygulanır', () => {
  const base = { consistency: 0.5, excess_index: 0, tracking_error: 1, hygiene: 1 };
  const out = scoreCategory(
    [
      { code: 'A', history_months: 60, fee: 0.9, ...base },
      { code: 'B', history_months: 60, fee: 0.91, ...base },
      { code: 'C', history_months: 6, fee: 0.5, ...base },
    ],
    { passive: true, params: P },
  );
  near(out[0].components.cost, 0.505, 1e-9);
  near(out[1].components.cost, 0.495, 1e-9);
  assert.equal(out[2].score, null);
  assert.equal(out[2].new_fund, true);
  assert.ok(out[0].score > out[1].score && out[0].score - out[1].score < 1, 'fark küçük kalır');
});

test('Ö3: sürekli eğim ve hedefler (örnek ekran 3)', () => {
  const t = P.tactical;
  near(compositeScore({ trend: 1, macro: 1, user: 0 }, t.weights), 0.75, 1e-12);
  const S = { gold: 0.75, silver: 0.25, equity_tr: -0.25, equity_foreign: 0, fx_fixed: -0.25, tl_fixed: 0.75 };
  const tilts = Object.fromEntries(Object.entries(S).map(([c, s]) => [c, tilt(s, t)]));
  assert.deepEqual(tilts, { gold: 5, silver: 2.5, equity_tr: -2.5, equity_foreign: 0, fx_fixed: -2.5, tl_fixed: 5 });
  const anchor = { gold: 33, silver: 5, equity_tr: 18, equity_foreign: 10, fx_fixed: 4, tl_fixed: 30 };
  const tg = targetsFromAnchor(anchor, tilts);
  const want = { gold: 35.35, silver: 6.98, equity_tr: 14.42, equity_foreign: 9.3, fx_fixed: 1.4, tl_fixed: 32.56 };
  for (const [c, v] of Object.entries(want)) near(tg[c], v, 0.01, c);
  // Kademeli kural (spesifikasyon 2.0) hâlâ seçilebilir.
  const step = { ...t, tilt_mode: 'stepwise' };
  assert.deepEqual([tilt(0.25, step), tilt(-0.25, step), tilt(0.4, step)], [0, -5, 5]);
  assert.equal(viewLabel(-0.25, t), 'negative');
});

test('Reel faiz kuralı: TL sabit ve döviz sabit aynalı', () => {
  const t = P.tactical;
  const ctx = { regimes: { tr: 'down_up', us: 'down_up' }, real_rate_pct: 3.2 };
  assert.equal(macroSignal('tl_fixed', ctx, t), 1);
  assert.equal(macroSignal('fx_fixed', ctx, t), -1);
  assert.equal(macroSignal('gold', ctx, t), 1);
  assert.equal(macroSignal('equity_tr', ctx, t), -1);
  const neg = { ...ctx, real_rate_pct: -20 };
  assert.equal(macroSignal('tl_fixed', neg, t), -1);
  assert.equal(macroSignal('fx_fixed', neg, t), 1);
});

test('M6: oynaklığa göre acil uyarı eşiği', () => {
  near(alertThreshold(17, P.decision), 11.97, 0.01, 'altın');
  near(alertThreshold(30, P.decision), 21.13, 0.01, 'gümüş');
  const idx = new Array(21).fill(100);
  idx[20] = 86.9; // −%13,1
  const r = checkAlert(idx, 17, P.decision);
  assert.equal(r.triggered, true);
  near(r.sigma_multiple, 2.74, 0.01);
});

// Rastgele ama tekrarlanabilir kovaryans.
function seededCov(n, seed) {
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647) - 0.5;
  const rows = Array.from({ length: 300 }, () => {
    const common = rnd();
    return Array.from({ length: n }, (_, i) => (0.02 + 0.01 * i) * (rnd() + 0.6 * common));
  });
  return covariance(rows, 52);
}

test('Risk eşitliği: köşegen kovaryansta ters oynaklık, genel durumda eşit katkı', () => {
  const w = ercWeights([[0.04, 0, 0], [0, 0.09, 0], [0, 0, 0.01]]);
  near(w[0], 5 / 18.3333, 1e-6);
  near(w[2], 10 / 18.3333, 1e-6);
  const cov = seededCov(5, 42);
  const rc = riskContributions(ercWeights(cov), cov);
  const total = rc.reduce((a, b) => a + b, 0);
  rc.forEach((v) => near(v / total, 0.2, 1e-6));
});

test('S: iki katmanlı risk eşitliğinde grupların risk payı eşit', () => {
  const ids = ['gold', 'silver', 'fx_fixed', 'equity_tr', 'equity_foreign'];
  const cov = seededCov(5, 7);
  const { weights } = hierarchicalErc(cov, ids, P.anchor.groups);
  const w = ids.map((id) => weights[id]);
  near(w.reduce((a, b) => a + b, 0), 1, 1e-9);
  const rc = riskContributions(w, cov);
  const g1 = rc[0] + rc[1] + rc[2];
  const g2 = rc[3] + rc[4];
  near(g1 / (g1 + g2), 0.5, 1e-6);
});

test('Çapa önerisi: hedef oynaklık, tavan ve negatif reel faiz', () => {
  const ids = ['gold', 'silver', 'fx_fixed', 'equity_tr', 'equity_foreign'];
  const cov = seededCov(5, 11).map((r) => r.map((c) => c * 40));
  const a = anchorSuggestion(cov, ids, P.anchor);
  const sum = Object.values(a.weights).reduce((x, y) => x + y, 0);
  near(sum, 100, 1e-9);
  if (a.k < 1) near(portfolioVol(ids.map((id) => a.weights[id] / 100), cov) * 100, P.anchor.target_vol_pct, 1e-6);
  Object.values(a.weights).forEach((v) => assert.ok(v <= P.anchor.class_cap_pct + 1e-9 || v === a.weights.tl_fixed));
  const neg = anchorSuggestion(cov, ids, P.anchor, { real_rate_pct: -5 });
  near(neg.weights.tl_fixed, a.weights.tl_fixed * 0.5, 1e-6);
  assert.ok(neg.warnings.includes('negative_real_rate'));
  const capped = applyCap({ a: 60, b: 20, c: 10 }, 40).weights;
  near(capped.a, 40, 1e-9);
  near(capped.b, 33.333, 0.001);
  near(capped.c, 16.667, 0.001);
});

test('Gruplama önerisi: birlikte hareket eden sınıfları aynı kümeye koyar', () => {
  const rho = [
    [1, 0.85, 0.1, 0.05],
    [0.85, 1, 0.05, 0.1],
    [0.1, 0.05, 1, 0.8],
    [0.05, 0.1, 0.8, 1],
  ];
  const sd = [0.17, 0.3, 0.26, 0.18];
  const cov = rho.map((r, i) => r.map((c, j) => c * sd[i] * sd[j]));
  const groups = suggestGroups(cov, ['gold', 'silver', 'equity_tr', 'equity_foreign'], 2).map((g) => g.sort());
  assert.deepEqual(groups.sort(), [['equity_foreign', 'equity_tr'], ['gold', 'silver']]);
});

test('Optimizasyon: tam çözülebilir durum, kısıtlar ve yuvarlama', () => {
  const ex = {
    X: { ...Object.fromEntries(CLASSES.map((c) => [c, 0])), gold: 100 },
    Y: { ...Object.fromEntries(CLASSES.map((c) => [c, 0])), tl_fixed: 100 },
    Z: { ...Object.fromEntries(CLASSES.map((c) => [c, 0])), equity_tr: 100 },
  };
  const r = optimizeAllocation({ candidates: ['X', 'Y', 'Z'], exposures: ex, targets: { gold: 40, tl_fixed: 35, equity_tr: 25 }, fees: {}, lambda: 0 });
  near(r.weights.X, 40, 0.01);
  near(r.weights.Y, 35, 0.01);
  near(r.weights.Z, 25, 0.01);
  const rounded = roundLargestRemainder({ a: 33.4, b: 33.3, c: 33.3 });
  assert.equal(Object.values(rounded).reduce((s, v) => s + v, 0), 100);
});

test('Optimizasyon: Ek A adaylarıyla Test 5 dağılımından kötü olamaz', () => {
  const exposures = Object.fromEntries(Object.values(FUNDS).map((f) => [f.code, fundExposure(f, P.universe).exposure]));
  const fees = Object.fromEntries(Object.values(FUNDS).map((f) => [f.code, f.mgmt_fee]));
  const targets = { gold: 35, silver: 5, tl_fixed: 30, equity_tr: 20, equity_foreign: 10, fx_fixed: 0, unclassified: 0 };
  const candidates = ['VGA', 'KGC', 'VEY', 'AGH', 'KRM'];
  const r = optimizeAllocation({ candidates, exposures, targets, fees, bounds: { KGC: [0, 5], AGH: [10, 10] }, lambda: P.allocation.fee_lambda });
  const sum = Object.values(r.weights).reduce((a, b) => a + b, 0);
  near(sum, 100, 1e-6);
  assert.ok(r.weights.KGC <= 5 + 1e-6, 'yeni fon tavanı');
  near(r.weights.AGH, 10, 1e-6, 'sabit tutulan fon');
  const A = CLASSES.map((c) => candidates.map((f) => exposures[f][c] / 100));
  const h = CLASSES.map((c) => targets[c] / 100);
  const u = candidates.map((f) => fees[f]);
  const t5 = [37, 5, 28, 10, 20].map((x) => x / 100);
  assert.ok(r.objective <= objective(t5, A, h, u, P.allocation.fee_lambda) + 1e-12);
  const rounded = roundLargestRemainder(r.weights);
  assert.equal(Object.values(rounded).reduce((s, v) => s + v, 0), 100);
  const e = portfolioExposure(rounded, exposures);
  assert.ok(Math.abs(e.gold - 35) < 3, 'altın hedefe yakın');
});
