// Ham yanıt örnekleri (ayrıştırıcı testleri için). Anahtar ve URL loglanmaz; yalnız gövdenin başı ve sonu.
const EVDS = process.env.EVDS_KEY || '';
const AV = process.env.ALPHAVANTAGE_KEY || '';
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';
async function show(name, url, headers = {}, redirect = 'follow') {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, ...headers }, redirect, signal: AbortSignal.timeout(30000) });
    const t = await r.text();
    console.log(`=== ${name} · ${r.status} · ${t.length} bayt · content-type ${r.headers.get('content-type')}`);
    console.log('BAŞ: ' + t.slice(0, 500).replace(/\s+/g, ' '));
    console.log('SON: ' + t.slice(-300).replace(/\s+/g, ' '));
  } catch (e) { console.log(`=== ${name} · HATA ${e.cause?.code || e.message}`); }
}
await show('EVDS günlük', `https://evds3.tcmb.gov.tr/igmevdsms-dis/series=TP.DK.USD.A.YTL-TP.MK.F.BILESIK&startDate=10-10-2026&endDate=19-10-2026&type=json`, { key: EVDS }, 'manual');
await show('EVDS aylık', `https://evds3.tcmb.gov.tr/igmevdsms-dis/series=TP.TUKFIY2025.GENEL&startDate=01-06-2026&endDate=19-10-2026&type=json`, { key: EVDS }, 'manual');
await show('EVDS haftalık', `https://evds3.tcmb.gov.tr/igmevdsms-dis/series=TP.TRY.MT06&startDate=01-09-2026&endDate=19-10-2026&type=json`, { key: EVDS }, 'manual');
await show('EVDS hatalı kod', `https://evds3.tcmb.gov.tr/igmevdsms-dis/series=TP.YOK.BOYLE&startDate=01-09-2026&endDate=19-10-2026&type=json`, { key: EVDS }, 'manual');
await show('AV gold', `https://www.alphavantage.co/query?function=GOLD_SILVER_HISTORY&symbol=GOLD&interval=daily&apikey=${AV}`);
await show('BorsaIstanbul XKTUM', 'https://www.borsaistanbul.com/graphic.php?veriTuru=endeks-graphic&indexCode=XKTUM');
const to = new Date().toISOString().slice(0, 10).replace(/-/g, '');
await show('IsYatirim XKTUM', `https://www.isyatirim.com.tr/_layouts/15/Isyatirim.Website/Common/ChartData.aspx/IndexHistoricalAll?period=1440&from=20261001000000&to=${to}235959&endeks=XKTUM`);
await show('MSCI daily', `https://app2.msci.com/products/service/index/indexmaster/getLevelDataForGraph?currency_symbol=USD&index_variant=STRD&start_date=20261001&end_date=${to}&data_frequency=DAILY&index_codes=990100`);
await show('TCMB XML', 'https://www.tcmb.gov.tr/kurlar/today.xml');
