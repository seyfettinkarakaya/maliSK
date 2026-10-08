// Telefondaki kişisel hesaplar: kayan ağırlık, hedef, bant sayacı, öneri, Claude metni.
import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PARAMS as P, CLASSES } from '../src/model/params.mjs';
import { driftWeights, targetsToday, bandHistory, recommendationDue, buildProposal } from '../src/app/personal.mjs';
import { buildPrompt } from '../src/app/claude.mjs';
import { fundNames, pct } from '../src/app/format.mjs';

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} beklenen ${b}, bulunan ${a}`);
const expo = (o) => ({ ...Object.fromEntries(CLASSES.map((c) => [c, 0])), ...o });

// 30 günlük küçük bir piyasa: altın fonu %2/gün artar, para piyasası sabit.
function market() {
  const dates = Array.from({ length: 30 }, (_, i) => `2026-09-${String(i + 1).padStart(2, '0')}`).slice(0, 30);
  const gold = dates.map((_, i) => 1.02 ** i);
  const mm = dates.map(() => 1);
  const fund = (code, name, category, e, score, extra = {}) => ({
    code, name, category, halal: true, main_class: Object.entries(e).sort((a, b) => b[1] - a[1])[0][0],
    exposure: expo(e), score, rank: 1, peers: 2, flags: [], returns: { '1m': 1, '1y': 20 }, indices: { excess: 0.1 }, ...extra,
  });
  return {
    data_date: dates[dates.length - 1], model_version: '2.1', param_version: 1, category_labels: { gold: 'Altın', money_market: 'Para piyasası' },
    classes: {
      gold: { trend: { T: 1 }, macro: null }, silver: { trend: { T: 0 } }, tl_fixed: { trend: { T: 0 } },
      equity_tr: { trend: { T: 0 } }, equity_foreign: { trend: { T: 0 } }, fx_fixed: { trend: { T: 0 } },
    },
    anchor: { ok: false },
    funds: [
      fund('GLD', 'X A.Ş. ALTIN KATILIM EMEKLİLİK YATIRIM FONU', 'gold', { gold: 100 }, 55),
      fund('GL2', 'Y A.Ş. ALTIN KATILIM EMEKLİLİK YATIRIM FONU', 'gold', { gold: 100 }, 80),
      fund('MMF', 'Z A.Ş. PARA PİYASASI KATILIM EMEKLİLİK YATIRIM FONU', 'money_market', { tl_fixed: 100 }, 50),
    ],
    prices_tail: { dates, prices: { GLD: gold, GL2: gold, MMF: mm } },
  };
}

test('kayan ağırlık ve dağılım getirisi', () => {
  const latest = market();
  const d = driftWeights(latest, { date: '2026-09-01', weights: { GLD: 50, MMF: 50 } });
  const g = 1.02 ** 29;
  near(d.current.GLD, (50 * g * 100) / (50 * g + 50), 1e-9);
  near(d.return_pct, ((g + 1) / 2 - 1) * 100, 1e-9);
  assert.equal(d.stale, false);
  assert.equal(driftWeights(latest, { date: '2026-08-01', weights: { GLD: 100 } }).stale, true);
});

test('hedef, bant sayacı ve öneri', () => {
  const latest = market();
  const anchor = { gold: 50, tl_fixed: 50 };
  const t = targetsToday(latest, anchor, {}, P);
  // Altın T = 1 → S = 0,5 → kıymetli maden grubunun eğimi +5 → (55, 50) → 100'e ölçek.
  near(t.targets.gold, (55 * 100) / 105, 1e-9);
  near(t.group_targets.precious_metals, (55 * 100) / 105, 1e-9);
  const drift = driftWeights(latest, { date: '2026-09-01', weights: { GLD: 50, MMF: 50 } });
  const bands = bandHistory(latest, drift, t, P);
  assert.equal(bands.groups.precious_metals.status, 'above');
  assert.equal(bands.class_out.gold, true);
  assert.ok(bands.counters['group:precious_metals'] >= 1 && bands.counters['group:precious_metals'] <= 30);
  const due = recommendationDue({ counters: { gold: 20 } }, [], '2026-09-30', P);
  assert.equal(due.active, true);
  const rejected = recommendationDue({ counters: { gold: 20 } }, [{ date: '2026-09-25', action: 'reddedildi' }], '2026-09-30', P);
  assert.equal(rejected.active, false);
  // Öneri: GL2 puanı GLD'den 25 yüksek → aday; toplam 100, altın hedefe yaklaşır.
  const p = buildProposal(latest, drift.current, bands, t.targets, P);
  assert.equal(Object.values(p.weights).reduce((a, b) => a + b, 0), 100);
  near(p.exposure.gold, t.targets.gold, 1.5);
  assert.ok(p.changes.some((c) => c.code === 'MMF'));
});

test('Claude metni ve biçimler', () => {
  const latest = market();
  const state = { allocation: { date: '2026-09-01', weights: { GLD: 50, MMF: 50 } } };
  const drift = driftWeights(latest, state.allocation);
  const targets = targetsToday(latest, { gold: 50, tl_fixed: 50 }, {}, P);
  const bands = bandHistory(latest, drift, targets, P);
  const text = buildPrompt({ latest, state, drift, targets, bands, due: null, proposal: null });
  assert.match(text, /GLD/);
  assert.match(text, /Kıymetli maden: maruziyet/);
  assert.deepEqual(fundNames('TÜRKİYE HAYAT VE EMEKLİLİK A.Ş. ALTIN KATILIM EMEKLİLİK YATIRIM FONU'), { short: 'Altın Katılım', company: 'Türkiye' });
  assert.equal(pct(-0.94, 1), '−%0,9');
});

test('çapada olmayan sınıf izlenir: hedefi yok, kalan paya ölçek', () => {
  const latest = market();
  const t = targetsToday(latest, { gold: 50, tl_fixed: 50 }, {}, P, { silver: 20, gold: 40, tl_fixed: 40 });
  assert.deepEqual(t.unmanaged, ['silver', 'equity_tr', 'equity_foreign', 'fx_fixed']);
  near(t.unmanaged_share, 20, 1e-9);
  near(t.targets.gold + t.targets.tl_fixed, 80, 1e-9);
  assert.equal('silver' in t.targets, false);
  assert.equal(t.rows.silver.managed, false);
});

test('çapa ağacı: eğim yalnız grupta, grup içi pay sabit', () => {
  const latest = market();
  latest.classes.silver = { trend: { T: -1 } };
  const anchor = { groups: { precious_metals: 40, equity: 30, tl_fixed: 25, fx: 5 }, splits: { precious_metals: { gold: 85, silver: 15 }, equity: { equity_tr: 70, equity_foreign: 30 } } };
  const t = targetsToday(latest, anchor, {}, P);
  // S_grup = 0,85·0,5 + 0,15·(−0,5) = 0,35 → eğim 3,5; toplam 103,5'e göre ölçek.
  near(t.groups.precious_metals.S, 0.35, 1e-12);
  near(t.group_targets.precious_metals, (43.5 * 100) / 103.5, 1e-9);
  near(t.targets.gold / t.group_targets.precious_metals, 0.85, 1e-12);
  near(t.targets.silver / t.group_targets.precious_metals, 0.15, 1e-12);
  near(Object.values(t.targets).reduce((a, b) => a + b, 0), 100, 1e-9);
});

test('çapa ağacı: düz çapa ağaca çevrilir, eksik sınıf izlenir', () => {
  const latest = market();
  const t = targetsToday(latest, { gold: 34, tl_fixed: 33, equity_tr: 21, equity_foreign: 9, fx_fixed: 3 }, {}, P, { silver: 10, gold: 50, tl_fixed: 40 });
  assert.deepEqual(t.anchor.splits.precious_metals, { gold: 100 });
  near(t.anchor.splits.equity.equity_tr, 70, 1e-12);
  assert.deepEqual(t.unmanaged, ['silver']);
  near(Object.values(t.targets).reduce((a, b) => a + b, 0), 90, 1e-9);
});

test('grup içi pay bandı: grup bant içindeyken gümüş payı tetikler', () => {
  const latest = market();
  latest.classes.gold = { trend: { T: 0 } };
  latest.funds.push({ code: 'SLV', name: 'S', category: 'silver', halal: true, main_class: 'silver', exposure: expo({ silver: 100 }), score: 60, rank: 1, peers: 1, flags: [] });
  latest.prices_tail.prices.SLV = latest.prices_tail.dates.map(() => 1);
  latest.prices_tail.prices.GLD = latest.prices_tail.dates.map(() => 1);
  const anchor = { groups: { precious_metals: 40, tl_fixed: 60 }, splits: { precious_metals: { gold: 85, silver: 15 } } };
  const t = targetsToday(latest, anchor, {}, P);
  const drift = driftWeights(latest, { date: '2026-09-01', weights: { GLD: 28, SLV: 12, MMF: 60 } });
  const b = bandHistory(latest, drift, t, P);
  assert.equal(b.groups.precious_metals.status, 'inside');
  near(b.splits.precious_metals.silver.value, 30, 1e-9);
  assert.equal(b.splits.precious_metals.silver.status, 'above');
  assert.equal(b.class_out.silver, true);
  assert.equal(b.counters['split:precious_metals'], 30);
  assert.equal(recommendationDue(b, [], '2026-09-30', P).due.includes('split:precious_metals'), true);
  // Grup portföyün %5'inden küçükse pay denetlenmez.
  const small = bandHistory(latest, driftWeights(latest, { date: '2026-09-01', weights: { GLD: 2, SLV: 2, MMF: 96 } }), t, P);
  assert.equal(small.splits.precious_metals.silver.skipped, true);
});

test('sözleşmeler: toplam, kayan paylar ve tek sözleşmede eşdeğerlik', async () => {
  const { combineContracts, migrateState, contractSteps } = await import('../src/app/personal.mjs');
  const latest = market();
  // Tek sözleşme = eski tek dağılım.
  const one = combineContracts(latest, [{ no: '1', date: '2026-09-01', weights: { GLD: 50, MMF: 50 } }], { date: '2026-09-01', values: { 1: 100 } });
  const d = driftWeights(latest, { date: '2026-09-01', weights: { GLD: 50, MMF: 50 } });
  near(one.current.GLD, d.current.GLD, 1e-9);
  near(one.return_pct, d.return_pct, 1e-9);
  // İki sözleşme: altın ağırlıklı olanın payı fiyatla büyür.
  const two = combineContracts(latest, [
    { no: '123', date: '2026-09-01', weights: { GLD: 100 } },
    { no: '456', date: '2026-09-01', weights: { MMF: 100 } },
  ], { date: '2026-09-01', values: { 123: 50, 456: 50 } });
  near(two.current.GLD, d.current.GLD, 1e-9);
  near(two.shares_now['123'], d.current.GLD, 1e-9);
  near(Object.values(two.current).reduce((a, b) => a + b, 0), 100, 1e-9);
  // Paylar başka bir günde girilmişse o günden kayar.
  const later = combineContracts(latest, [
    { no: '123', date: '2026-09-01', weights: { GLD: 100 } },
    { no: '456', date: '2026-09-01', weights: { MMF: 100 } },
  ], { date: '2026-09-30', values: { 123: 50, 456: 50 } });
  near(later.shares_now['123'], 50, 1e-9);
  // Taşıma ve adımlar.
  const m = migrateState({ allocation: { date: '2026-09-01', weights: { GLD: 60, MMF: 40 } } });
  assert.deepEqual(m.contracts[0], { no: '1', date: '2026-09-01', weights: { GLD: 60, MMF: 40 } });
  const steps = contractSteps(latest, two, { GLD: 40, MMF: 60 });
  assert.equal(steps.length, 2);
  assert.deepEqual(steps.find((x) => x.no === '123').steps.map((x) => [x.code, x.from, x.to]), [['GLD', 100, 40], ['MMF', 0, 60]]);
});

test('hedefe uzaklık: hedef üstü fazlaların toplamı', async () => {
  const { targetDistance } = await import('../src/model/tree.mjs');
  near(targetDistance({ a: 64.9, b: 22.1, c: 3.6, d: 4 }, { a: 35, b: 30, c: 30, d: 5 }), 29.9, 1e-9);
});
