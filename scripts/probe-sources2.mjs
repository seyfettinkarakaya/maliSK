// İkinci deneme: MSCI İslami endeks kodları ve günlük seri, EVDS geçmiş derinliği, S&P DJI dışa aktarımı.
const EVDS = process.env.EVDS_KEY || '';
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';
async function get(url, headers = {}, redirect = 'follow') {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json,text/plain,*/*', ...headers }, redirect, signal: AbortSignal.timeout(25000) });
    return { status: r.status, text: await r.text() };
  } catch (e) { return { status: 0, text: String(e.cause?.code || e.message) }; }
}
const short = (t) => t.replace(/\s+/g, ' ').slice(0, 300);
// MSCI arama (birkaç olası parametre adı).
for (const q of ['index_search=islamic', 'search=islamic', 'q=islamic', 'index_name=islamic']) {
  const r = await get(`https://app2.msci.com/products/service/index/indexmaster/searchIndexes?${q}`);
  console.log(`MSCI searchIndexes ${q} · ${r.status} · ${short(r.text)}`);
}
// MSCI günlük seri (World) ve olası İslami kodlar.
const d = new Date().toISOString().slice(0, 10).replace(/-/g, '');
for (const code of ['990100', '701020', '703997', '139259', '702010']) {
  const r = await get(`https://app2.msci.com/products/service/index/indexmaster/getLevelDataForGraph?currency_symbol=USD&index_variant=STRD&start_date=20260901&end_date=${d}&data_frequency=DAILY&index_codes=${code}`);
  let info = short(r.text);
  try { const j = JSON.parse(r.text); const l = j.indexes?.INDEX_LEVELS || []; info = `${l.length} satır · ${l[0]?.calc_date} → ${l.at(-1)?.calc_date} · ${j.msci_index_code || ''}`; } catch {}
  console.log(`MSCI DAILY ${code} · ${r.status} · ${info}`);
}
// EVDS geçmiş derinliği: 2005 ve 2011 pencereleri.
for (const [code, s, e] of [['TP.ALTINPIYASA.KAP02', '01-01-2005', '31-12-2005'], ['TP.ALTINPIYASA.KAP02', '01-01-2011', '31-12-2011'], ['TP.MK.F.BILESIK', '01-01-2005', '31-12-2005'], ['TP.TUKFIY2025.GENEL', '01-01-2005', '31-12-2010'], ['TP.GENENDEKS.T1', '01-01-2003', '31-12-2004']]) {
  const r = await get(`https://evds3.tcmb.gov.tr/igmevdsms-dis/series=${code}&startDate=${s}&endDate=${e}&type=json`, { key: EVDS }, 'manual');
  let info = short(r.text).slice(0, 120);
  try { const k = code.replace(/\./g, '_'); const it = JSON.parse(r.text).items.filter((x) => x[k] != null); info = `${it.length} satır · ${it[0]?.Tarih} → ${it.at(-1)?.Tarih} · ${it[0]?.[k]}`; } catch {}
  console.log(`EVDS ${code} ${s}…${e} · ${r.status} · ${info}`);
}
// S&P DJI dışa aktarım (S&P 500 Shariah, DJ Islamic Market World) — olası kimlikler.
for (const id of ['5458214', '92016', '1236']) {
  const r = await get(`https://www.spglobal.com/spdji/en/idsexport/file.xls?redesignExport=true&selectedModule=PerformanceGraphView&selectedSubModule=Graph&yearFlag=tenYearFlag&indexId=${id}`);
  console.log(`SPDJI ${id} · ${r.status} · ${r.text.length} bayt · ${short(r.text).slice(0, 100)}`);
}
// Yahoo ikinci uç (query2) bir kez.
const y = await get('https://query2.finance.yahoo.com/v8/finance/chart/SPUS?range=1mo&interval=1d');
console.log(`Yahoo query2 SPUS · ${y.status} · ${short(y.text).slice(0, 100)}`);
