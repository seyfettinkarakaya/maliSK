// Kabul testleri (docs/model.md, Bölüm 16) — Ek A verisiyle, yılbaşı = 9 ay.
import test from 'node:test';
import assert from 'node:assert/strict';
import { FUNDS, YTD_MONTHS } from './fixtures/ek_a.mjs';
import { DEFAULT_PARAMS as P } from '../src/model/params.mjs';
import { periodIndex, monthlyEquivalent, longTermIndex } from '../src/model/indices.mjs';
import { fundExposure, portfolioExposure, weightedFee } from '../src/model/exposure.mjs';
import { periodConsistency, hygiene } from '../src/model/scoring.mjs';
import { bandCheck } from '../src/model/bands.mjs';

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} beklenen ${b}, bulunan ${a}`);
const IND7 = ['1m', '3m', '6m', 'ytd', '1y', '3y', '5y'];
const IND5 = IND7.slice(0, 5);
const opt = (method) => ({ method, ytd_months: YTD_MONTHS });
const exposures = Object.fromEntries(Object.values(FUNDS).map((f) => [f.code, fundExposure(f, P.universe).exposure]));
const fees = Object.fromEntries(Object.values(FUNDS).map((f) => [f.code, f.mgmt_fee]));

test('Test 1: basit indis (kullanıcının yöntemi, bölen hatasız)', () => {
  near(periodIndex(FUNDS.KJM.returns, IND7, opt('simple')).value, 8.61, 0.01, 'KJM Ind7');
  near(periodIndex(FUNDS.AGA.returns, IND7, opt('simple')).value, 11.86, 0.01, 'AGA Ind7');
  near(periodIndex(FUNDS.KJM.returns, IND5, opt('simple')).value, 7.96, 0.01, 'KJM Ind5');
  assert.equal(periodIndex(FUNDS.KJM.returns, IND7, opt('simple')).n, 6, 'KJM 6 geçerli dönem');
});

test('Test 2: bileşik indis', () => {
  near(periodIndex(FUNDS.KJM.returns, IND7, opt('compound')).value, 6.5, 0.01, 'KJM 6 dönem');
  near(monthlyEquivalent(FUNDS.AGA.returns['5y'], 60, 'compound'), 4.43, 0.01, 'AGA 5y bileşik');
  near(monthlyEquivalent(FUNDS.AGA.returns['5y'], 60, 'simple'), 20.85, 0.01, 'AGA 5y basit');
});

test('Test 3a: altın grubu ortak dönem indisi ve dönem sürekliliği', () => {
  const common = ['1m', '3m', '6m', 'ytd', '1y', '3y'];
  const expected = { VGA: 7.56, AGA: 7.53, KJM: 6.5, VGD: 6.77 };
  for (const [code, v] of Object.entries(expected)) {
    near(periodIndex(FUNDS[code].returns, common, opt('compound')).value, v, 0.01, `${code} indis`);
  }
  const peers = ['VGA', 'AGA', 'KJM', 'VGD'].map((c) => FUNDS[c]);
  const cons = (c) => periodConsistency(c, peers, IND7, 3);
  assert.deepEqual([cons('VGA').hits, cons('VGA').valid], [6, 7]);
  assert.deepEqual([cons('AGA').hits, cons('AGA').valid], [6, 7]);
  assert.deepEqual([cons('KJM').hits, cons('KJM').valid], [1, 6]);
  assert.deepEqual([cons('VGD').hits, cons('VGD').valid], [1, 7]);
  const h = (c) => hygiene(FUNDS[c].mgmt_fee, FUNDS[c].max_ter, FUNDS[c].size_tl, P.fund_quality.small_fund_tl);
  assert.equal(h('VGD'), 0.5);
  assert.equal(h('VGA'), 1);
  assert.equal(h('KGC'), 0.5, 'KGC küçük fon (249 milyon TL)');
});

test('Test 3b: uzun vade indisi (yeni)', () => {
  near(longTermIndex(FUNDS.VGA.returns, P.fund_quality.long_term_weights), 4.7, 0.01, 'VGA');
  // KRM'de 3y ve 5y yok: ağırlık yalnız 1y'ye kalır.
  near(longTermIndex(FUNDS.KRM.returns, P.fund_quality.long_term_weights), monthlyEquivalent(45.56, 12), 1e-9, 'KRM');
});

test('Test 4: mevcut maruziyet', () => {
  const e = portfolioExposure({ KJM: 30, KGC: 20, AGA: 20, AGH: 10, KRM: 20 }, exposures);
  const want = { gold: 46.0, silver: 18.9, tl_fixed: 3.6, equity_tr: 17.3, equity_foreign: 4.8, fx_fixed: 4.0, unclassified: 5.4 };
  for (const [c, v] of Object.entries(want)) near(e[c], v, 0.05, c);
  near(weightedFee({ KJM: 30, KGC: 20, AGA: 20, AGH: 10, KRM: 20 }, fees), 1.39, 0.005, 'ücret');
});

test('Test 5: önerilen dağılımın maruziyeti ve ücreti', () => {
  const w = { VGA: 37, KGC: 5, VEY: 28, AGH: 10, KRM: 20 };
  const e = portfolioExposure(w, exposures);
  const want = { gold: 35.5, silver: 4.7, tl_fixed: 31.5, equity_tr: 16.3, equity_foreign: 4.8, fx_fixed: 4.2, unclassified: 3.1 };
  for (const [c, v] of Object.entries(want)) near(e[c], v, 0.05, c);
  near(weightedFee(w, fees), 1.3, 0.005, 'ücret');
});

test('Test 6: bant kontrolü (sarı eşik hedefin yüzdesi, sürüm 2.7)', () => {
  const e = portfolioExposure({ KJM: 30, KGC: 20, AGA: 20, AGH: 10, KRM: 20 }, exposures);
  const targets = { gold: 35, silver: 5, tl_fixed: 30, equity_tr: 20, equity_foreign: 10 };
  const st = (d) => Object.fromEntries(Object.entries(bandCheck(e, targets, d)).map(([c, r]) => [c, r.status]));
  // Sarı %15: Yurtiçi hisse (17,3) 17–23 içinde, Yabancı hisse (4,8) 8,5–11,5 altında.
  assert.deepEqual(st(P.decision), { gold: 'above', silver: 'above', tl_fixed: 'below', equity_tr: 'inside', equity_foreign: 'below' });
  // Sarı %10: Yurtiçi hisse 18–22 altında.
  const tight = { ...P.decision, yellow_rel_pct: 10, red_rel_pct: 20 };
  assert.deepEqual(st(tight), { gold: 'above', silver: 'above', tl_fixed: 'below', equity_tr: 'below', equity_foreign: 'below' });
  // Sarı %25: Yurtiçi hisse 15–25 içinde, Yabancı hisse (4,8) 7,5–12,5 altında.
  const wide = { ...P.decision, yellow_rel_pct: 25, red_rel_pct: 50 };
  assert.deepEqual(st(wide), { gold: 'above', silver: 'above', tl_fixed: 'below', equity_tr: 'inside', equity_foreign: 'below' });
  // Seviye (%10/%20): Yurtiçi hisse sapması 2,7 < kırmızı 4 → sarı. Varsayılan (%15/%30): Altın sapması 11 ≥ 10,5 → kırmızı.
  assert.equal(bandCheck(e, targets, tight).equity_tr.level, 'yellow');
  const lv = bandCheck(e, targets, P.decision);
  assert.equal(lv.equity_tr.level, null);
  assert.equal(lv.gold.level, 'red');
});
