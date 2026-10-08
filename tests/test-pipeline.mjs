// Günlük hesabın sentetik veriyle uçtan uca testi ve seri yardımcıları.
import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PARAMS as P } from '../src/model/params.mjs';
import { computeLatest } from '../src/pipeline/compute.mjs';
import { shiftMonths, periodReturn, monthlyReturns, maxDrawdown, medianSeries, dailyReturns } from '../src/pipeline/series.mjs';
import { normalizeDist, normalizeInfo, splitRange } from '../src/data/tefas.mjs';

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} beklenen ${b}, bulunan ${a}`);

test('seri yardımcıları', () => {
  assert.equal(shiftMonths('2026-03-31', 1), '2026-02-28');
  assert.equal(shiftMonths('2026-01-15', 3), '2025-10-15');
  const dates = ['2026-01-02', '2026-02-02', '2026-03-02'];
  assert.equal(periodReturn(dates, [100, 110, 121], '2026-03-02', '3m'), null, 'seri 3 ay önce başlamıyor');
  near(periodReturn(dates, [100, 110, 121], '2026-03-02', '1m'), 10, 1e-9);
  near(maxDrawdown([1, 1.2, 0.9, 1.3]), 25, 1e-9);
  const m = monthlyReturns(['2026-01-30', '2026-02-27', '2026-03-31', '2026-04-03'], [1, 1.1, 1.21, 1.3], 12);
  assert.deepEqual(Object.keys(m), ['2026-02', '2026-03']);
  const s = medianSeries(['a', 'b'], [new Map([['b', 0.1]]), new Map([['b', 0.3]]), new Map([['b', 0.2]])]);
  assert.deepEqual(s.dates, ['b']);
  near(s.returns[0], 0.2, 1e-12);
  assert.equal(dailyReturns(['a', 'b'], [1, 2]).get('b'), 1);
});

test('TEFAS satırlarının normalleştirilmesi ve aralık bölme', () => {
  const info = normalizeInfo({ fonKodu: 'VGA', fonUnvan: 'X KATILIM', tarih: '2026-10-07', fiyat: 0.74301, tedPaySayisi: 1, kisiSayisi: 2, portfoyBuyukluk: 3, rn: 5 });
  assert.deepEqual(info, { date: '2026-10-07', code: 'VGA', name: 'X KATILIM', price: 0.74301, shares: 1, investors: 2, size_tl: 3 });
  const dist = normalizeDist({ fonKodu: 'ACV', fonUnvan: 'A', tarih: '2026-10-07', khtl: 95.62, kkstl: 4.38, hs: 0, bilFiyat: '179140' });
  assert.deepEqual(dist.content, { khtl: 95.62, kkstl: 4.38 });
  const parts = splitRange(new Date('2026-01-01'), new Date('2026-03-01'));
  assert.equal(parts.length, 3);
  assert.equal(parts[0][1].toISOString().slice(0, 10), '2026-01-28');
});

// Tekrarlanabilir rastgele sayı.
function rng(seed) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647) - 0.5;
}

function businessDays(start, n) {
  const out = [];
  let d = Date.parse(start + 'T00:00:00Z');
  while (out.length < n) {
    const wd = new Date(d).getUTCDay();
    if (wd !== 0 && wd !== 6) out.push(new Date(d).toISOString().slice(0, 10));
    d += 86400000;
  }
  return out;
}

function syntheticMarket() {
  const r = rng(99);
  const days = businessDays('2024-01-01', 520);
  const funds = {
    GA1: { name: 'A ALTIN KATILIM EYF', content: { km: 90, kkstl: 10 }, drift: 0.0012, vol: 0.011, f: 'gold' },
    GA2: { name: 'B ALTIN KATILIM EYF', content: { km: 85, khtl: 15 }, drift: 0.0011, vol: 0.011, f: 'gold' },
    GA3: { name: 'C ALTIN KATILIM EYF', content: { km: 88, yyf: 12 }, drift: 0.001, vol: 0.011, f: 'gold' },
    GA4: { name: 'D ALTIN KATILIM EYF', content: { km: 80, kibd: 4, khtl: 16 }, drift: 0.001, vol: 0.011, f: 'gold' },
    PP1: { name: 'E PARA PİYASASI KATILIM EYF', content: { khtl: 60, kkstl: 40 }, drift: 0.0014, vol: 0.0003, f: 'mm' },
    PP2: { name: 'F PARA PİYASASI KATILIM EYF', content: { khtl: 70, osks: 30 }, drift: 0.0013, vol: 0.0003, f: 'mm' },
    PP3: { name: 'G PARA PİYASASI KATILIM EYF', content: { khtl: 50, btas: 50 }, drift: 0.0013, vol: 0.0003, f: 'mm' },
    HS1: { name: 'H KATILIM HİSSE SENEDİ EYF', content: { hs: 90, yyf: 10 }, drift: 0.0012, vol: 0.016, f: 'eq' },
    HS2: { name: 'I KATILIM HİSSE SENEDİ EYF', content: { hs: 95, khtl: 5 }, drift: 0.001, vol: 0.016, f: 'eq' },
    HS3: { name: 'J KATILIM HİSSE SENEDİ EYF', content: { hs: 85, kkstl: 15 }, drift: 0.0011, vol: 0.016, f: 'eq' },
    GU1: { name: 'K GÜMÜŞ KATILIM EYF', content: { km: 90, d: 10 }, drift: 0.001, vol: 0.02, f: 'silver' },
    YN1: { name: 'L KATILIM EYF', content: { khtl: 100 }, drift: 0.0012, vol: 0.0005, f: 'mm', late: 300 },
  };
  const factors = { gold: [], mm: [], eq: [], silver: [] };
  for (let i = 0; i < days.length; i++) {
    const g = r() * 0.02;
    factors.gold.push(g);
    factors.silver.push(g * 1.3 + r() * 0.02);
    factors.mm.push(0);
    factors.eq.push(r() * 0.03);
  }
  const prices = {};
  const meta = {};
  for (const [code, f] of Object.entries(funds)) {
    let p = 1;
    const list = [];
    days.forEach((d, i) => {
      if (f.late && i < f.late) return;
      p *= 1 + f.drift + factors[f.f][i] + r() * f.vol * 0.2;
      list.push({ date: d, price: p, shares: 1, investors: 1000 + i, size_tl: code === 'GA3' ? 1e8 : 1e9 });
    });
    prices[code] = list;
    meta[code] = { name: f.name };
  }
  const contents = [];
  for (let i = 0; i < days.length; i += 21) {
    contents.push({ date: days[i], map: Object.fromEntries(Object.entries(funds).map(([c, f]) => [c, f.content])) });
  }
  return { prices, meta, contents, days };
}

test('computeLatest: sentetik piyasa uçtan uca', () => {
  const { prices, meta, contents, days } = syntheticMarket();
  const out = computeLatest({ fundsMeta: meta, prices, contents, params: P, generatedAt: '2026-01-01 10:30' });
  const byCode = Object.fromEntries(out.funds.map((f) => [f.code, f]));
  assert.equal(out.data_date, days[days.length - 1]);
  // Helal filtresi: kibd içeren GA4 dışarıda.
  assert.equal(byCode.GA4.halal, false);
  assert.match(byCode.GA4.halal_reason, /kibd/);
  assert.equal(out.sources.tefas.halal, 11);
  // Sınıf serileri: altında 3 helal fon var, gümüşte 1 (yetersiz).
  assert.equal(out.classes.gold.series_ok, true);
  assert.equal(out.classes.gold.n_funds, 3);
  assert.equal(out.classes.silver.series_ok, false);
  assert.equal(out.classes.tl_fixed.series_ok, true);
  assert.ok(out.classes.gold.trend.signals.ma === 1 || out.classes.gold.trend.signals.ma === -1);
  // Çapa: altın ve yurtiçi hisse ile hazır, toplam 100.
  assert.equal(out.anchor.ok, true, out.anchor.reason);
  assert.deepEqual(out.anchor.ids, ['gold', 'equity_tr']);
  near(Object.values(out.anchor.user_groups.weights).reduce((a, b) => a + b, 0), 100, 0.05);
  // Fon puanı: kategori içinde sıralı; yeni fon puanlanmaz; küçük fon hijyeni 0,5.
  assert.ok(byCode.GA1.score !== null && byCode.GA1.rank >= 1);
  assert.equal(byCode.GA3.components.hygiene, 0.5);
  assert.ok(byCode.YN1.flags.includes('yeni_fon'));
  assert.equal(byCode.YN1.score, null);
  assert.equal(byCode.GU1.score !== undefined, true);
  // Maruziyet: fon sepeti ana sınıfa (altın), 'd' altın fonunda Belirsiz.
  near(byCode.GA3.exposure.gold, 100, 1e-9);
  near(byCode.GU1.exposure.unclassified, 10, 1e-9);
  // Telefon için fiyat kuyruğu.
  assert.equal(out.prices_tail.dates.length, 130);
  assert.equal(out.prices_tail.prices.GA1.length, 130);
  // Ind5/Ind7 ve fazla getiri indisleri hesaplanmış.
  assert.ok(Number.isFinite(byCode.HS1.indices.ind5_compound));
  assert.ok(Number.isFinite(byCode.HS1.indices.excess));
});

test('TEFAS fon türü ve ücret: normalleştirme, kategori, helal dayanağı, maliyet', async () => {
  const { normalizeMeta, trDecimal } = await import('../src/data/tefas.mjs');
  assert.equal(trDecimal('0,85'), 0.85);
  assert.equal(trDecimal('1'), 1);
  assert.equal(trDecimal(''), null);
  const meta = normalizeMeta(
    [{ fonKodu: 'GA1', fonUnvan: 'A', fonTurAciklama: 'Altın Katılım Fonu', fonTurKod: 167, kurucuKod: 'X', uygulananYu1Y: '0,90', fonIcTuzukYu1G: '0,90', fonTopGiderKesoran: '1,09', tefasDurum: false }],
    [{ fonKodu: 'GA1', riskDegeri: '6' }],
  );
  assert.deepEqual(meta.GA1, { name: 'A', type: 'Altın Katılım Fonu', type_code: 167, founder: 'X', fee: 0.9, fee_prospectus: 0.9, max_ter: 1.09, tefas_status: false, risk: 6 });

  const { prices, meta: names, contents } = syntheticMarket();
  const typeMeta = {
    as_of: '2026-01-01',
    funds: {
      GA1: { type: 'Altın Katılım Fonu', fee: 0.9, max_ter: 1.09 },
      GA2: { type: 'Altın Katılım Fonu', fee: 1.2, max_ter: 1.09 },
      PP1: { type: 'Para Piyasası Fonu', fee: 0.8, max_ter: 1.09 },
      YN1: { type: 'Başlangıç Katılım Fonu', fee: 0.85, max_ter: 1.09 },
    },
  };
  const out = computeLatest({ fundsMeta: names, typeMeta, prices, contents, params: P, generatedAt: 'x' });
  const f = Object.fromEntries(out.funds.map((x) => [x.code, x]));
  assert.equal(f.YN1.category, 'starter', 'kategori TEFAS türünden');
  assert.equal(f.GA1.halal_basis, 'TEFAS türü: Altın Katılım Fonu');
  assert.equal(f.PP1.halal_basis, 'adında KATILIM (TEFAS türü: Para Piyasası Fonu)');
  assert.equal(f.GA2.components.hygiene, 0.5, 'ücret azami gideri aşıyor');
  assert.ok(f.GA1.components.cost > f.GA2.components.cost, 'düşük ücret daha iyi');
  assert.equal(out.sources.tefas.meta_as_of, '2026-01-01');
});
