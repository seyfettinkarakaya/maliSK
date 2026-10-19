// Piyasa verisi kaynakları. Ayrıştırıcılar saf fonksiyonlardır (testlerde örnek yanıtla sınanır);
// ağ çağrısı yalnız fetchText içinde. Anahtarlar ortam değişkeninden okunur; hata metinlerine URL
// ya da anahtar yazılmaz.
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';

const pad = (n) => String(n).padStart(2, '0');
const isoUTC = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

// Tarih biçimlerini YYYY-MM-DD'ye çevirir. Aylık dönem (YYYY-M) ayın ilk günü olur.
export function normDate(x) {
  if (x === null || x === undefined || x === '') return null;
  if (typeof x === 'number') return x > 1e11 ? isoUTC(new Date(x)) : x > 19000000 && x < 21000000 ? normDate(String(x)) : isoUTC(new Date(x * 1000));
  const s = String(x).trim();
  let m;
  if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})/))) return `${m[1]}-${m[2]}-${m[3]}`;
  if ((m = s.match(/^(\d{4})(\d{2})(\d{2})$/))) return `${m[1]}-${m[2]}-${m[3]}`;
  if ((m = s.match(/^(\d{1,2})[-./](\d{1,2})[-./](\d{4})/))) return `${m[3]}-${pad(m[2])}-${pad(m[1])}`;
  if ((m = s.match(/^(\d{4})-(\d{1,2})$/))) return `${m[1]}-${pad(m[2])}-01`;
  if ((m = s.match(/^(\d{4})-Q(\d)$/))) return `${m[1]}-${pad((Number(m[2]) - 1) * 3 + 1)}-01`;
  return null;
}

const num = (v) => {
  if (v === null || v === undefined || v === '' || v === '.') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/\s/g, ''));
  return Number.isFinite(n) ? n : null;
};

// [{date, value}] tarih sırasıyla, boşlar ve tekrarlar atılmış.
function clean(rows) {
  const m = new Map();
  for (const r of rows) if (r.date && r.value !== null) m.set(r.date, r.value);
  return [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, value]) => ({ date, value }));
}

export const parsers = {
  evds(text, code) {
    const j = JSON.parse(text);
    const k = code.replace(/\./g, '_');
    return clean((j.items || []).map((it) => ({ date: normDate(it.Tarih), value: num(it[k]) })));
  },
  fred(text) {
    const j = JSON.parse(text);
    if (!j.observations) throw new Error(j.error_message || 'gözlem yok');
    return clean(j.observations.map((o) => ({ date: normDate(o.date), value: num(o.value) })));
  },
  alphavantage_metal(text) {
    const j = JSON.parse(text);
    if (j.Note || j.Information || j['Error Message']) throw new Error(String(j.Note || j.Information || j['Error Message']).slice(0, 120));
    if (!Array.isArray(j.data)) throw new Error('beklenmeyen biçim');
    return clean(j.data.map((r) => ({ date: normDate(r.date), value: num(r.price ?? r.value ?? r.close) })));
  },
  alphavantage_fx(text) {
    const j = JSON.parse(text);
    if (j.Note || j.Information || j['Error Message']) throw new Error(String(j.Note || j.Information || j['Error Message']).slice(0, 120));
    const ts = j['Time Series FX (Daily)'];
    if (!ts) throw new Error('beklenmeyen biçim');
    return clean(Object.entries(ts).map(([d, v]) => ({ date: normDate(d), value: num(v['4. close']) })));
  },
  tcmb_xml(text, code) {
    const date = text.match(/Tarih="(\d{2}\.\d{2}\.\d{4})"/)?.[1];
    const block = text.match(new RegExp(`CurrencyCode="${code}"[\\s\\S]*?</Currency>`))?.[0] || '';
    const unit = num(block.match(/<Unit>([\d.]+)<\/Unit>/)?.[1]) || 1;
    const v = num(block.match(/<ForexBuying>([\d.]+)<\/ForexBuying>/)?.[1]);
    return clean([{ date: normDate(date), value: v === null ? null : v / unit }]);
  },
  bist_graphic(text) {
    const j = JSON.parse(text);
    const arr = Array.isArray(j) ? j : j.data || j.result || [];
    return clean(arr.map((r) => ({ date: normDate(r.hisTs ?? r.date ?? r.tarih), value: num(r.clval ?? r.close ?? r.value) })));
  },
  isyatirim(text) {
    const j = JSON.parse(text);
    return clean((j.data || []).map((r) => ({ date: normDate(r[0]), value: num(r[1]) })));
  },
  msci(text) {
    const j = JSON.parse(text);
    const l = j.indexes?.INDEX_LEVELS || [];
    return clean(l.map((r) => ({ date: normDate(r.calc_date), value: num(r.level_eod) })));
  },
};

export async function fetchText(url, { headers = {}, redirect = 'follow', timeout = 45000 } = {}) {
  let res;
  try {
    res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json,text/xml,*/*', ...headers }, redirect, signal: AbortSignal.timeout(timeout) });
  } catch (e) {
    throw new Error(`bağlantı: ${e.cause?.code || e.name}`);
  }
  const text = await res.text();
  if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
  return text;
}

const ddmmyyyy = (iso) => `${iso.slice(8, 10)}-${iso.slice(5, 7)}-${iso.slice(0, 4)}`;
const ymd = (iso) => iso.replace(/-/g, '');
const addDays = (iso, n) => isoUTC(new Date(Date.parse(iso) + n * 864e5));

// Pencereleri böler (EVDS en çok 1000 satır döndürür).
export function windows(from, to, days) {
  const out = [];
  for (let a = from; a <= to; a = addDays(a, days + 1)) out.push([a, addDays(a, days) < to ? addDays(a, days) : to]);
  return out;
}

const EVDS_WINDOW = { daily: 1000, weekly: 5000, monthly: 20000 };

// Her kaynak: (source, {from, to, freq}, env, get) → [{date, value}]. get testte değiştirilebilir.
export const providers = {
  async evds(src, { from, to, freq }, env, get = fetchText) {
    if (!env.EVDS_KEY) throw new Error('EVDS anahtarı yok');
    const out = [];
    for (const [a, b] of windows(from, to, EVDS_WINDOW[freq] || 1000)) {
      const text = await get(`https://evds3.tcmb.gov.tr/igmevdsms-dis/series=${src.code}&startDate=${ddmmyyyy(a)}&endDate=${ddmmyyyy(b)}&type=json`, { headers: { key: env.EVDS_KEY }, redirect: 'manual' });
      out.push(...parsers.evds(text, src.code));
    }
    return clean(out);
  },
  async fred(src, { from }, env, get = fetchText) {
    if (!env.FRED_API_KEY) throw new Error('FRED anahtarı yok');
    return parsers.fred(await get(`https://api.stlouisfed.org/fred/series/observations?series_id=${src.code}&api_key=${env.FRED_API_KEY}&file_type=json&observation_start=${from}`));
  },
  async alphavantage_metal(src, { from }, env, get = fetchText) {
    if (!env.ALPHAVANTAGE_KEY) throw new Error('Alpha Vantage anahtarı yok');
    const rows = parsers.alphavantage_metal(await get(`https://www.alphavantage.co/query?function=GOLD_SILVER_HISTORY&symbol=${src.code}&interval=daily&apikey=${env.ALPHAVANTAGE_KEY}`));
    return rows.filter((r) => r.date >= from);
  },
  async alphavantage_fx(src, { from }, env, get = fetchText) {
    if (!env.ALPHAVANTAGE_KEY) throw new Error('Alpha Vantage anahtarı yok');
    const rows = parsers.alphavantage_fx(await get(`https://www.alphavantage.co/query?function=FX_DAILY&from_symbol=${src.code}&to_symbol=TRY&outputsize=full&apikey=${env.ALPHAVANTAGE_KEY}`));
    return rows.filter((r) => r.date >= from);
  },
  // Günlük kur dosyası: yalnız yakın günler için (en çok 15 gün); geçmiş yükleme için uygun değil.
  async tcmb_xml(src, { from, to }, env, get = fetchText) {
    const out = [];
    const start = from > addDays(to, -15) ? from : addDays(to, -15);
    for (let d = start; d <= to; d = addDays(d, 1)) {
      const wd = new Date(d).getUTCDay();
      if (wd === 0 || wd === 6) continue;
      try {
        out.push(...parsers.tcmb_xml(await get(`https://www.tcmb.gov.tr/kurlar/${ymd(d).slice(0, 6)}/${ymd(d).slice(6, 8)}${ymd(d).slice(4, 6)}${ymd(d).slice(0, 4)}.xml`), src.code));
      } catch { /* tatil günü: dosya yok */ }
    }
    return clean(out);
  },
  async bist_graphic(src, { from }, env, get = fetchText) {
    return parsers.bist_graphic(await get(`https://www.borsaistanbul.com/graphic.php?veriTuru=endeks-graphic&indexCode=${src.code}`)).filter((r) => r.date >= from);
  },
  async isyatirim(src, { from, to }, env, get = fetchText) {
    return parsers.isyatirim(await get(`https://www.isyatirim.com.tr/_layouts/15/Isyatirim.Website/Common/ChartData.aspx/IndexHistoricalAll?period=1440&from=${ymd(from)}000000&to=${ymd(to)}235959&endeks=${src.code}`));
  },
  async msci(src, { from, to }, env, get = fetchText) {
    return parsers.msci(await get(`https://app2.msci.com/products/service/index/indexmaster/getLevelDataForGraph?currency_symbol=USD&index_variant=STRD&start_date=${ymd(from)}&end_date=${ymd(to)}&data_frequency=DAILY&index_codes=${src.code}`));
  },
};
