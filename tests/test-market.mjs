// Piyasa verisi katmanı: ayrıştırıcılar, birleştirme, ölçek denetimi, kaynak sırası (ağ yok).
import test from 'node:test';
import assert from 'node:assert/strict';
import { normDate, parsers, windows, providers } from '../src/data/market/providers.mjs';
import { parseCsv, toCsv, mergeRows, consistent } from '../src/data/market/store.mjs';
import { updateSeries, seriesStatus } from '../src/pipeline/market.mjs';
import { MARKET_SERIES, FREQ_RULES } from '../src/data/market/catalog.mjs';

test('tarih biçimleri', () => {
  assert.equal(normDate('19-10-2026'), '2026-10-19');
  assert.equal(normDate('2026-9'), '2026-09-01');
  assert.equal(normDate('20260930'), '2026-09-30');
  assert.equal(normDate(20260930), '2026-09-30');
  assert.equal(normDate(Date.UTC(2026, 9, 16)), '2026-10-16');
  assert.equal(normDate('2026-10-16T00:00:00'), '2026-10-16');
  assert.equal(normDate('16.10.2026'), '2026-10-16');
  assert.equal(normDate(''), null);
});

test('ayrıştırıcılar', () => {
  const evds = JSON.stringify({ totalCount: 3, items: [{ Tarih: '17-10-2026', TP_DK_USD_A_YTL: null }, { Tarih: '16-10-2026', TP_DK_USD_A_YTL: '49.30000000' }, { Tarih: '19-10-2026', TP_DK_USD_A_YTL: '49.35730000' }] });
  assert.deepEqual(parsers.evds(evds, 'TP.DK.USD.A.YTL'), [{ date: '2026-10-16', value: 49.3 }, { date: '2026-10-19', value: 49.3573 }]);
  const evdsM = JSON.stringify({ items: [{ Tarih: '2026-9', TP_TUKFIY2025_GENEL: '137.23' }] });
  assert.deepEqual(parsers.evds(evdsM, 'TP.TUKFIY2025.GENEL'), [{ date: '2026-09-01', value: 137.23 }]);
  const fred = JSON.stringify({ observations: [{ date: '2026-10-14', value: '.' }, { date: '2026-10-15', value: '5.1' }] });
  assert.deepEqual(parsers.fred(fred), [{ date: '2026-10-15', value: 5.1 }]);
  assert.throws(() => parsers.fred(JSON.stringify({ error_message: 'Bad Request' })), /Bad Request/);
  const av = JSON.stringify({ data: [{ date: '2026-10-18', price: '4165.27' }, { date: '2026-10-17', price: '4150' }] });
  assert.deepEqual(parsers.alphavantage_metal(av).map((r) => r.date), ['2026-10-17', '2026-10-18']);
  assert.throws(() => parsers.alphavantage_metal(JSON.stringify({ Information: 'rate limit' })), /rate limit/);
  const fx = JSON.stringify({ 'Time Series FX (Daily)': { '2026-10-16': { '4. close': '49.50910' } } });
  assert.deepEqual(parsers.alphavantage_fx(fx), [{ date: '2026-10-16', value: 49.5091 }]);
  const xml = '<Tarih_Date Tarih="19.10.2026" Date="10/19/2026"><Currency CrossOrder="0" Kod="USD" CurrencyCode="USD"><Unit>1</Unit><ForexBuying>49.4632</ForexBuying></Currency><Currency Kod="JPY" CurrencyCode="JPY"><Unit>100</Unit><ForexBuying>33.10</ForexBuying></Currency></Tarih_Date>';
  assert.deepEqual(parsers.tcmb_xml(xml, 'USD'), [{ date: '2026-10-19', value: 49.4632 }]);
  assert.deepEqual(parsers.tcmb_xml(xml, 'JPY'), [{ date: '2026-10-19', value: 0.331 }]);
  const bist = JSON.stringify([{ hisTs: '2026-10-16', clval: 14767.51 }, { hisTs: '2021-10-01', clval: 1406.41 }]);
  assert.deepEqual(parsers.bist_graphic(bist).map((r) => r.date), ['2021-10-01', '2026-10-16']);
  const isy = JSON.stringify({ data: [[Date.UTC(2026, 9, 16), 14767.51]] });
  assert.deepEqual(parsers.isyatirim(isy), [{ date: '2026-10-16', value: 14767.51 }]);
  const msci = JSON.stringify({ msci_index_code: '990100', indexes: { INDEX_LEVELS: [{ level_eod: 4902.6, calc_date: 20260930 }] } });
  assert.deepEqual(parsers.msci(msci), [{ date: '2026-09-30', value: 4902.6 }]);
});

test('EVDS pencereleri 1000 günü aşmaz', () => {
  const w = windows('2000-01-01', '2026-10-19', 1000);
  assert.equal(w[0][0], '2000-01-01');
  assert.equal(w.at(-1)[1], '2026-10-19');
  for (let i = 1; i < w.length; i++) assert.ok(w[i][0] > w[i - 1][1]);
});

test('CSV, birleştirme ve ölçek denetimi', () => {
  const a = [{ date: '2026-10-15', value: 10, source: 'evds' }, { date: '2026-10-16', value: 11, source: 'evds' }];
  assert.deepEqual(parseCsv(toCsv(a)), a);
  const m = mergeRows(a, [{ date: '2026-10-16', value: 11.5, source: 'evds' }, { date: '2026-10-17', value: 12, source: 'evds' }]);
  assert.deepEqual(m.map((r) => r.value), [10, 11.5, 12]);
  assert.equal(consistent(a, [{ date: '2026-10-16', value: 11.1 }], 0.02).ok, true);
  assert.equal(consistent(a, [{ date: '2026-10-16', value: 110 }], 0.02).ok, false);
  assert.equal(consistent([], [{ date: '2026-10-16', value: 110 }], 0.02).ok, true);
});

test('kaynak sırası: ilk kaynak hata verirse yedek; ölçeği tutmayan yedek reddedilir', async () => {
  const spec = { id: 'x', label: 'X', freq: 'daily', start: '2026-01-01', sources: [{ provider: 'a', code: 'A' }, { provider: 'b', code: 'B' }, { provider: 'c', code: 'C' }] };
  const old = [{ date: '2026-10-10', value: 100, source: 'a' }];
  const impl = {
    a: async () => { throw new Error('HTTP 429'); },
    b: async () => [{ date: '2026-10-10', value: 1000 }, { date: '2026-10-11', value: 1010 }], // 10 kat ölçek
    c: async () => [{ date: '2026-10-10', value: 100.5 }, { date: '2026-10-11', value: 101 }],
  };
  const r = await updateSeries(spec, old, { today: '2026-10-19', impl });
  assert.equal(r.source, 'c');
  assert.equal(r.added, 1);
  assert.deepEqual(r.attempts.map((x) => x.provider), ['a', 'b']);
  assert.match(r.attempts[1].error, /ölçek/);
  assert.equal(r.rows.at(-1).source, 'c');
  // Artımlı pencere: son kayıttan örtüşme kadar geri.
  assert.equal(r.from, '2026-09-26');
  const st = seriesStatus(spec, r.rows, r, '2026-10-19');
  assert.equal(st.last_date, '2026-10-11');
  assert.equal(st.stale, true); // 8 gün > 5
  // Hiçbir kaynak çalışmazsa eski satırlar korunur.
  const none = await updateSeries(spec, old, { today: '2026-10-19', impl: { a: impl.a } });
  assert.equal(none.source, null);
  assert.deepEqual(none.rows, old);
});

test('EVDS sağlayıcısı: anahtar başlıkta, yönlendirme izlenmez, pencere pencere çeker', async () => {
  const calls = [];
  const get = async (url, opt) => {
    calls.push({ url, opt });
    return JSON.stringify({ items: [{ Tarih: '02-01-2024', TP_DK_USD_A_YTL: '30' }] });
  };
  const rows = await providers.evds({ code: 'TP.DK.USD.A.YTL' }, { from: '2020-01-01', to: '2026-10-19', freq: 'daily' }, { EVDS_KEY: 'k' }, get);
  assert.ok(calls.length >= 3);
  assert.equal(calls[0].opt.headers.key, 'k');
  assert.equal(calls[0].opt.redirect, 'manual');
  assert.ok(!calls[0].url.includes('k&') && !calls[0].url.includes('key='));
  assert.deepEqual(rows, [{ date: '2024-01-02', value: 30 }]);
  await assert.rejects(providers.evds({ code: 'X' }, { from: '2026-01-01', to: '2026-01-02', freq: 'daily' }, {}, get), /anahtar/);
});

test('katalog: kimlikler tekil, kaynaklar tanımlı, sıklık kuralı var', () => {
  const ids = MARKET_SERIES.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const s of MARKET_SERIES) {
    assert.ok(FREQ_RULES[s.freq], s.id);
    assert.ok(/^[a-z0-9_]+$/.test(s.id), s.id);
    for (const src of s.sources) assert.ok(providers[src.provider], `${s.id}: ${src.provider}`);
  }
});
