// Telefondan değiştirilen parametreler.
import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PARAMS as P, PARAM_META } from '../src/model/params.mjs';
import { effectiveParams, paramVersion, validateParams, getPath } from '../src/model/paramedit.mjs';

test('meta listesindeki her anahtar varsayılanlarda var', () => {
  for (const m of PARAM_META) {
    const v = getPath(P, m.key);
    assert.equal(typeof v, 'number', m.key);
    assert.ok(v >= m.min && v <= m.max, `${m.key} varsayılanı aralıkta`);
  }
});

test('değişiklik uygulanır, varsayılan bozulmaz, listede olmayan yok sayılır', () => {
  const e = effectiveParams(P, { 'decision.band_rel_pct': 30, 'anchor.window_years': 9 }, PARAM_META);
  assert.equal(e.decision.band_rel_pct, 30);
  assert.equal(e.anchor.window_years, P.anchor.window_years);
  assert.equal(P.decision.band_rel_pct, 25);
  assert.equal(paramVersion(P, { n: 3 }), `${P.version}.3`);
  assert.deepEqual(validateParams(P), []);
  const bad = effectiveParams(P, { 'tactical.weights.trend': 0.7, 'decision.band_min_pts': 12 }, PARAM_META);
  assert.equal(validateParams(bad).length, 2);
});

test('telefonda yeniden hesap: puan ağırlığı ve uyarı eşiği', async () => {
  const { applyParams } = await import('../src/app/personal.mjs');
  const latest = {
    classes: { gold: { index_tail: Array.from({ length: 30 }, (_, i) => (i < 10 ? 1 : 0.9)), vol_annual_pct: 20 } },
    funds: [
      { code: 'A', category: 'gold', halal: true, score: 60, confidence: 1, components: { consistency: 1, excess_index: 0.5, risk: 0.5, cost: 0.5, hygiene: 1 } },
      { code: 'B', category: 'gold', halal: true, score: 55, confidence: 0.5, components: { consistency: 0, excess_index: 0.9, risk: 0.9, cost: 0.9, hygiene: 1 } },
    ],
    anchor: { ok: false },
  };
  const a = applyParams(latest, P);
  const w = P.fund_quality.weights;
  const rawA = 100 * (w.consistency + 0.5 * (w.excess_index + w.risk + w.cost) + w.hygiene);
  assert.ok(Math.abs(a.funds[0].score - rawA) < 1e-9);
  assert.equal(a.funds[0].rank, 1);
  // −%10 düşüş: varsayılan eşik 2,5 × 20 × √(20/252) ≈ %14,1 → uyarı yok; çarpan 1,5 → eşik %8,5 → uyarı.
  assert.equal(a.classes.gold.alert.triggered, false);
  const e = effectiveParams(P, { 'decision.alert_sigma_mult': 1.5 }, PARAM_META);
  assert.equal(applyParams(latest, e).classes.gold.alert.triggered, true);
});
