// Veri kaynağı denemesi (elle çalışan iş akışı). Her kaynaktan az sayıda istek atar; durum, satır sayısı,
// ilk/son tarih ve son değeri yazar. Anahtarlar yalnız ortam değişkeninden okunur; URL ve başlıklar loglanmaz.
const EVDS = process.env.EVDS_KEY || '';
const FRED = process.env.FRED_API_KEY || '';
const AV = process.env.ALPHAVANTAGE_KEY || '';
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';
const results = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ddmmyyyy = (d) => `${String(d.getUTCDate()).padStart(2, '0')}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${d.getUTCFullYear()}`;
const iso = (d) => d.toISOString().slice(0, 10);
const today = new Date();
const ago = (days) => new Date(Date.now() - days * 864e5);

async function get(url, { headers = {}, redirect = 'follow', timeout = 25000 } = {}) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeout);
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, ...headers }, redirect, signal: ctl.signal });
    const text = await res.text();
    return { status: res.status, text };
  } catch (e) {
    return { status: 0, text: '', error: String(e.cause?.code || e.name || e.message) };
  } finally { clearTimeout(t); }
}

function record(group, name, r, parse) {
  let info = { rows: 0 };
  if (r.status === 200) {
    try { info = parse(r.text) || info; } catch (e) { info = { rows: 0, note: `ayrıştırılamadı: ${String(e.message).slice(0, 80)}` }; }
  }
  const row = { group, name, status: r.status || r.error, ...info };
  if (r.status !== 200 && !info.note) row.note = r.text.replace(/\s+/g, ' ').slice(0, 120);
  results.push(row);
  console.log(`${row.status === 200 && row.rows ? 'OK  ' : 'FAIL'} [${group}] ${name} · durum ${row.status} · ${row.rows} satır · ${row.first || '-'} → ${row.last || '-'} · son ${row.value ?? '-'}${row.note ? ` · ${row.note}` : ''}`);
}

// 1. TCMB EVDS3 (anahtar başlıkta; yönlendirme izlenmez).
async function evds(code, years = 1) {
  if (!EVDS) return record('EVDS', code, { status: 'anahtar yok', text: '' }, () => null);
  const url = `https://evds3.tcmb.gov.tr/igmevdsms-dis/series=${code}&startDate=${ddmmyyyy(ago(365 * years))}&endDate=${ddmmyyyy(today)}&type=json`;
  const r = await get(url, { headers: { key: EVDS }, redirect: 'manual' });
  record('EVDS', code, r, (text) => {
    const j = JSON.parse(text);
    const items = j.items || [];
    const k = code.replace(/\./g, '_');
    const vals = items.filter((x) => x[k] !== null && x[k] !== undefined && x[k] !== '');
    return { rows: vals.length, first: vals[0]?.Tarih, last: vals.at(-1)?.Tarih, value: vals.at(-1)?.[k] };
  });
}

// 2. TCMB günlük kur XML (anahtarsız).
async function tcmbXml() {
  for (let i = 0; i < 6; i++) {
    const d = ago(i);
    const p = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    const f = `${String(d.getUTCDate()).padStart(2, '0')}${String(d.getUTCMonth() + 1).padStart(2, '0')}${d.getUTCFullYear()}`;
    const r = await get(`https://www.tcmb.gov.tr/kurlar/${p}/${f}.xml`);
    if (r.status === 200) {
      return record('TCMB XML', `kurlar ${iso(d)}`, r, (t) => {
        const m = t.match(/CurrencyCode="USD"[\s\S]*?<ForexBuying>([\d.]+)<\/ForexBuying>/);
        return { rows: m ? 1 : 0, first: iso(d), last: iso(d), value: m?.[1] };
      });
    }
  }
  record('TCMB XML', 'kurlar (son 6 gün)', { status: 404, text: 'bulunamadı' }, () => null);
}

// 3. FRED (anahtar sorgu parametresinde; URL loglanmaz).
async function fred(id) {
  if (!FRED) return record('FRED', id, { status: 'anahtar yok', text: '' }, () => null);
  const r = await get(`https://api.stlouisfed.org/fred/series/observations?series_id=${id}&api_key=${FRED}&file_type=json&observation_start=1900-01-01&sort_order=asc`);
  record('FRED', id, r, (t) => {
    const obs = JSON.parse(t).observations.filter((o) => o.value !== '.');
    return { rows: obs.length, first: obs[0]?.date, last: obs.at(-1)?.date, value: obs.at(-1)?.value };
  });
}

// 4. Alpha Vantage (günde 25 istek; burada 3).
async function av(params, name) {
  if (!AV) return record('AlphaVantage', name, { status: 'anahtar yok', text: '' }, () => null);
  const r = await get(`https://www.alphavantage.co/query?${params}&apikey=${AV}`);
  record('AlphaVantage', name, r, (t) => {
    const j = JSON.parse(t);
    if (j.Note || j.Information || j['Error Message']) return { rows: 0, note: String(j.Note || j.Information || j['Error Message']).slice(0, 120) };
    const series = j.data || Object.values(j).find((v) => v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length > 20);
    if (Array.isArray(series)) {
      const s = series.slice().sort((a, b) => String(a.date).localeCompare(String(b.date)));
      return { rows: s.length, first: s[0]?.date, last: s.at(-1)?.date, value: s.at(-1)?.price ?? s.at(-1)?.value };
    }
    const dates = Object.keys(series || {}).sort();
    const lastv = series?.[dates.at(-1)];
    return { rows: dates.length, first: dates[0], last: dates.at(-1), value: lastv && (lastv['4. close'] || Object.values(lastv)[0]) };
  });
  await sleep(1500);
}

// 5. Yahoo grafik servisi (gayriresmî): aylık tüm geçmiş (derinlik) tek istekte.
async function yahoo(sym) {
  const r = await get(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=max&interval=1mo`);
  record('Yahoo', sym, r, (t) => {
    const res = JSON.parse(t).chart.result?.[0];
    const ts = res?.timestamp || [];
    const cl = res?.indicators?.quote?.[0]?.close || [];
    const ok = ts.map((x, i) => [x, cl[i]]).filter(([, c]) => c !== null && c !== undefined);
    return { rows: ok.length, first: ok[0] && iso(new Date(ok[0][0] * 1000)), last: ok.at(-1) && iso(new Date(ok.at(-1)[0] * 1000)), value: ok.at(-1)?.[1]?.toFixed?.(2), note: res?.meta?.currency };
  });
  await sleep(700);
}

// 6. Borsa İstanbul ve İş Yatırım endeks uçları (gayriresmî yedek).
async function bist(code) {
  const r = await get(`https://www.borsaistanbul.com/graphic.php?veriTuru=endeks-graphic&indexCode=${code}`);
  record('BorsaIstanbul', code, r, (t) => {
    const j = JSON.parse(t);
    const arr = Array.isArray(j) ? j : j.data || j.result || [];
    const pick = (x) => x.hisTs || x.date || x.tarih;
    return { rows: arr.length, first: arr[0] && String(pick(arr[0])).slice(0, 10), last: arr.at(-1) && String(pick(arr.at(-1))).slice(0, 10), value: arr.at(-1)?.clval };
  });
}
async function isyatirim(code) {
  const from = `${iso(ago(3650)).replace(/-/g, '')}000000`;
  const to = `${iso(today).replace(/-/g, '')}235959`;
  const r = await get(`https://www.isyatirim.com.tr/_layouts/15/Isyatirim.Website/Common/ChartData.aspx/IndexHistoricalAll?period=1440&from=${from}&to=${to}&endeks=${code}`);
  record('IsYatirim', code, r, (t) => {
    const j = JSON.parse(t);
    const d = j.data || [];
    return { rows: d.length, first: d[0] && iso(new Date(d[0][0])), last: d.at(-1) && iso(new Date(d.at(-1)[0])), value: d.at(-1)?.[1] };
  });
}

// 7. MSCI endeks uçları (gayriresmî).
async function msci(code, name) {
  const r = await get(`https://app2.msci.com/products/service/index/indexmaster/getLevelDataForGraph?currency_symbol=USD&index_variant=STRD&start_date=19970101&end_date=${iso(today).replace(/-/g, '')}&data_frequency=END_OF_MONTH&index_codes=${code}`);
  record('MSCI', name, r, (t) => {
    const j = JSON.parse(t);
    const l = j.indexes?.INDEX_LEVELS || [];
    return { rows: l.length, first: l[0]?.calc_date, last: l.at(-1)?.calc_date, value: l.at(-1)?.level_eod };
  });
}

console.log(`Anahtarlar: EVDS ${EVDS ? 'var' : 'yok'} · FRED ${FRED ? 'var' : 'yok'} · AlphaVantage ${AV ? 'var' : 'yok'}`);
for (const c of ['TP.DK.USD.A.YTL', 'TP.DK.EUR.A.YTL', 'TP.MK.F.BILESIK', 'TP.ALTINPIYASA.KAP02', 'TP.PY.P02.1H', 'TP.APIFON4', 'TP.TRY.MT06']) await evds(c);
await evds('TP.TUKFIY2025.GENEL', 3);
await evds('TP.DK.USD.A.YTL', 2); // 1000 satır sınırı denemesi için ikinci pencere
await tcmbXml();
for (const id of ['DGS10', 'DFII10', 'DTWEXBGS', 'DCOILBRENTEU', 'VIXCLS', 'SP500']) await fred(id);
await av('function=GOLD_SILVER_HISTORY&symbol=GOLD&interval=daily', 'GOLD_SILVER_HISTORY GOLD');
await av('function=GOLD_SILVER_HISTORY&symbol=SILVER&interval=daily', 'GOLD_SILVER_HISTORY SILVER');
await av('function=FX_DAILY&from_symbol=USD&to_symbol=TRY&outputsize=full', 'FX_DAILY USD/TRY');
for (const s of ['GC=F', 'SI=F', 'XU100.IS', 'XKTUM.IS', 'XK030.IS', 'XK050.IS', 'XK100.IS', '^GSPC', 'SPUS', 'HLAL', 'UMMA', 'SPWO', 'ISWD.L', 'ISDW.L', 'ISUS.L', 'ISDU.L', 'AMAGX', 'SPSK', 'DX-Y.NYB', 'BZ=F', 'USDTRY=X', 'XAUUSD=X']) await yahoo(s);
for (const c of ['XU100', 'XKTUM', 'XK030']) await bist(c);
for (const c of ['XU100', 'XKTUM', 'XK030']) await isyatirim(c);
await msci('990100', 'MSCI World (990100)');
await msci('892400', 'MSCI ACWI (892400)');

const ok = results.filter((r) => r.status === 200 && r.rows > 0).length;
console.log(`\nÖZET: ${ok}/${results.length} kaynak veri döndürdü.`);
if (process.env.GITHUB_STEP_SUMMARY) {
  const fs = await import('node:fs');
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, ['| Kaynak | Seri | Durum | Satır | İlk | Son | Son değer | Not |', '|---|---|---|---|---|---|---|---|',
    ...results.map((r) => `| ${r.group} | ${r.name} | ${r.status} | ${r.rows} | ${r.first || ''} | ${r.last || ''} | ${r.value ?? ''} | ${(r.note || '').replace(/\|/g, '/')} |`)].join('\n') + '\n');
}
