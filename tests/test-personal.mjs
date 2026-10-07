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
  // Altın T = 1 → S = 0,5 → eğim +5 → (55, 50) → 100'e ölçek.
  near(t.targets.gold, (55 * 100) / 105, 1e-9);
  const drift = driftWeights(latest, { date: '2026-09-01', weights: { GLD: 50, MMF: 50 } });
  const bands = bandHistory(latest, drift, t.targets, P);
  assert.equal(bands.check.gold.status, 'above');
  assert.ok(bands.counters.gold >= 1 && bands.counters.gold <= 30);
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
  const bands = bandHistory(latest, drift, targets.targets, P);
  const text = buildPrompt({ latest, state, drift, targets, bands, due: null, proposal: null });
  assert.match(text, /GLD/);
  assert.match(text, /Altın: maruziyet/);
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
