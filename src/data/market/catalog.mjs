// Piyasa serileri kataloğu (BES'ten bağımsız). Her seri için kaynaklar öncelik sırasıyla denenir:
// ilki çalışmazsa ya da boş dönerse sıradaki. Yedek kaynağın değeri, kayıtlı seriyle örtüşen günde
// tutarlı değilse (ölçek farkı) kullanılmaz. Kimlikler İngilizce snake_case.
//   role: main (piyasa yönü) · halal (alım-satım ve ölçü) · macro (makro ve risk)
//   freq: daily · weekly · monthly  (bayatlık eşiği ve artımlı çekme penceresi buna göre)
export const MARKET_SERIES = [
  // Döviz
  { id: 'usd_try', label: 'Dolar/TL', asset: 'fx', role: 'main', freq: 'daily', unit: 'TRY', start: '2000-01-01',
    sources: [{ provider: 'evds', code: 'TP.DK.USD.A.YTL' }, { provider: 'tcmb_xml', code: 'USD' }, { provider: 'alphavantage_fx', code: 'USD' }] },
  { id: 'eur_try', label: 'Euro/TL', asset: 'fx', role: 'main', freq: 'daily', unit: 'TRY', start: '2000-01-01',
    sources: [{ provider: 'evds', code: 'TP.DK.EUR.A.YTL' }, { provider: 'tcmb_xml', code: 'EUR' }, { provider: 'alphavantage_fx', code: 'EUR' }] },
  // Kıymetli madenler
  { id: 'gold_usd', label: 'Ons altın', asset: 'gold', role: 'main', freq: 'daily', unit: 'USD/oz', start: '2011-06-01',
    sources: [{ provider: 'alphavantage_metal', code: 'GOLD' }, { provider: 'evds', code: 'TP.ALTINPIYASA.KAP03' }] },
  { id: 'silver_usd', label: 'Ons gümüş', asset: 'silver', role: 'main', freq: 'daily', unit: 'USD/oz', start: '2011-06-01',
    sources: [{ provider: 'alphavantage_metal', code: 'SILVER' }, { provider: 'evds', code: 'TP.GUMUSPIYASA.KAP03' }] },
  { id: 'gold_try_bist', label: 'Borsa İstanbul altın', asset: 'gold', role: 'halal', freq: 'daily', unit: 'TRY/kg', start: '2015-01-01',
    sources: [{ provider: 'evds', code: 'TP.ALTINPIYASA.KAP02' }] },
  // Yurtiçi hisse
  { id: 'bist100', label: 'BIST 100', asset: 'equity_tr', role: 'main', freq: 'daily', unit: 'puan', start: '2000-01-01',
    sources: [{ provider: 'evds', code: 'TP.MK.F.BILESIK' }, { provider: 'bist_graphic', code: 'XU100' }, { provider: 'isyatirim', code: 'XU100' }] },
  { id: 'bist_katilim_tum', label: 'BIST Katılım Tüm', asset: 'equity_tr', role: 'halal', freq: 'daily', unit: 'puan', start: '2021-10-01',
    sources: [{ provider: 'bist_graphic', code: 'XKTUM' }, { provider: 'isyatirim', code: 'XKTUM' }] },
  { id: 'bist_katilim_30', label: 'BIST Katılım 30', asset: 'equity_tr', role: 'halal', freq: 'daily', unit: 'puan', start: '2021-10-01',
    sources: [{ provider: 'bist_graphic', code: 'XK030' }, { provider: 'isyatirim', code: 'XK030' }] },
  // Yabancı hisse
  { id: 'msci_world', label: 'MSCI Dünya', asset: 'equity_foreign', role: 'main', freq: 'daily', unit: 'USD', start: '1997-01-01',
    sources: [{ provider: 'msci', code: '990100' }] },
  { id: 'msci_acwi', label: 'MSCI Tüm Dünya', asset: 'equity_foreign', role: 'main', freq: 'daily', unit: 'USD', start: '1997-01-01',
    sources: [{ provider: 'msci', code: '892400' }] },
  { id: 'msci_world_islamic', label: 'MSCI Dünya İslami', asset: 'equity_foreign', role: 'halal', freq: 'daily', unit: 'USD', start: '1997-01-01',
    sources: [{ provider: 'msci', code: '136123' }] },
  { id: 'msci_acwi_islamic', label: 'MSCI Tüm Dünya İslami', asset: 'equity_foreign', role: 'halal', freq: 'daily', unit: 'USD', start: '1997-01-01',
    sources: [{ provider: 'msci', code: '136210' }] },
  { id: 'msci_usa_islamic', label: 'MSCI ABD İslami', asset: 'equity_foreign', role: 'halal', freq: 'daily', unit: 'USD', start: '1997-01-01',
    sources: [{ provider: 'msci', code: '136353' }] },
  { id: 'msci_usa', label: 'MSCI ABD', asset: 'equity_foreign', role: 'main', freq: 'daily', unit: 'USD', start: '1997-01-01',
    sources: [{ provider: 'msci', code: '984000' }] },
  { id: 'sp500', label: 'S&P 500', asset: 'equity_foreign', role: 'main', freq: 'daily', unit: 'USD', start: '2016-01-01',
    sources: [{ provider: 'fred', code: 'SP500' }] },
  // Türkiye makro
  { id: 'cpi_tr', label: 'TÜFE (2025=100)', asset: 'macro', role: 'macro', freq: 'monthly', unit: 'endeks', start: '2005-01-01',
    sources: [{ provider: 'evds', code: 'TP.TUKFIY2025.GENEL' }] },
  { id: 'cpi_tr_2003', label: 'TÜFE (2003=100)', asset: 'macro', role: 'macro', freq: 'monthly', unit: 'endeks', start: '2003-01-01',
    sources: [{ provider: 'evds', code: 'TP.GENENDEKS.T1' }] },
  { id: 'cpi_expect_12m_tr', label: '12 ay sonrası enflasyon beklentisi', asset: 'macro', role: 'macro', freq: 'monthly', unit: '%', start: '2013-01-01',
    sources: [{ provider: 'evds', code: 'TP.PKAUO.S01.E.U' }] },
  { id: 'policy_rate_tr', label: 'TCMB politika faizi', asset: 'tl_fixed', role: 'macro', freq: 'daily', unit: '%', start: '2010-01-01',
    sources: [{ provider: 'evds', code: 'TP.PY.P02.1H' }] },
  { id: 'funding_rate_tr', label: 'TCMB ortalama fonlama', asset: 'tl_fixed', role: 'macro', freq: 'daily', unit: '%', start: '2010-01-01',
    sources: [{ provider: 'evds', code: 'TP.APIFON4' }] },
  { id: 'deposit_rate_tr', label: 'TL mevduat faizi', asset: 'tl_fixed', role: 'macro', freq: 'weekly', unit: '%', start: '2002-01-01',
    sources: [{ provider: 'evds', code: 'TP.TRY.MT06' }] },
  // Küresel makro ve risk
  { id: 'us_10y', label: 'ABD 10 yıllık faiz', asset: 'macro', role: 'macro', freq: 'daily', unit: '%', start: '1990-01-01', sources: [{ provider: 'fred', code: 'DGS10' }] },
  { id: 'us_real_10y', label: 'ABD 10 yıllık reel faiz', asset: 'macro', role: 'macro', freq: 'daily', unit: '%', start: '2003-01-01', sources: [{ provider: 'fred', code: 'DFII10' }] },
  { id: 'usd_broad', label: 'Geniş dolar endeksi', asset: 'macro', role: 'macro', freq: 'weekly', unit: 'endeks', start: '2006-01-01', sources: [{ provider: 'fred', code: 'DTWEXBGS' }] },
  { id: 'brent', label: 'Brent petrol', asset: 'macro', role: 'macro', freq: 'daily', unit: 'USD', start: '1990-01-01', sources: [{ provider: 'fred', code: 'DCOILBRENTEU' }] },
  { id: 'vix', label: 'VIX', asset: 'macro', role: 'macro', freq: 'daily', unit: 'puan', start: '1990-01-01', sources: [{ provider: 'fred', code: 'VIXCLS' }] },
];

// Bayatlık eşiği (takvim günü) ve artımlı çekmede geriye örtüşme (takvim günü).
export const FREQ_RULES = {
  daily: { stale_days: 5, overlap_days: 14 },
  weekly: { stale_days: 12, overlap_days: 35 },
  monthly: { stale_days: 50, overlap_days: 100 },
};

// Yedek kaynak, kayıtlı seriyle örtüşen günlerde bu orandan fazla farklıysa reddedilir.
export const CONSISTENCY_TOL = 0.02;
