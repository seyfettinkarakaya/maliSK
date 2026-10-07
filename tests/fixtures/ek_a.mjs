// Spesifikasyon Ek A: kullanıcının geçen yılki Excel'inden 8 fon. Yalnızca testler içindir.
// Getiriler yüzde, içerik payları yüzde, ücretler yıllık yüzde. Boş hücre = veri yok.

const CSV = `code,name,category,w_current,r_1m,r_3m,r_6m,r_ytd,r_1y,r_3y,r_5y,precious_metal,equity,equity_foreign,lease_tl,lease_fx,participation_tl,participation_fx,fund_basket,other,investors,size_tl,mgmt_fee,max_ter
KJM,KATILIM EMEKLİLİK KIYMETLİ MADENLER KATILIM EYF,Kıymetli maden,30,7.94,26.91,45.13,85.35,70.66,426.88,,91.65,0,0,0,0,0,0,4.02,4.33,92207,3456446911,1.06,1.09
KGC,KATILIM EMEKLİLİK GÜMÜŞ KATILIM EYF,Gümüş,20,4.61,,,,,,,82.81,0,0,0,0,0,0,11.55,5.64,3531,249083171,1.06,1.09
AGA,BEREKET EMEKLİLİK ALTIN KATILIM EYF,Altın,20,11.23,32.00,39.43,91.55,93.63,565.17,1251.29,81.35,10.81,0,0.12,0,0.60,0.50,5.18,1.44,66299,8723305936,1.00,1.09
AGH,BEREKET EMEKLİLİK KATILIM HİSSE SENEDİ EYF,Hisse,10,-1.00,7.18,25.81,24.73,41.00,261.60,1199.00,0,87.91,0,0,0,0,0,12.05,0.04,53023,1614492395,2.19,2.28
KRM,TÜRKİYE HAYAT KATILIM KARMA EYF,Karma,20,3.56,11.25,28.97,34.11,45.56,,,0,25.73,23.92,15.40,19.54,1.81,0,4.10,9.50,19468,520408274,2.20,2.28
VGA,TÜRKİYE HAYAT ALTIN KATILIM EYF,Altın,0,12.50,32.15,38.96,87.32,82.67,501.50,1128.10,84.04,3.00,0,0.14,0,0.06,0.68,11.92,0.16,2036255,231354815767,0.91,1.09
VGD,TÜRKİYE HAYAT KIYMETLİ MADENLER KATILIM EYF,Kıymetli maden,0,9.33,28.18,40.49,85.53,77.83,443.50,657.13,62.89,0,0,0,0,1.86,0,25.82,9.43,201035,11704053137,1.19,1.10
VEY,TÜRKİYE HAYAT PARA PİYASASI KATILIM EYF,Para piyasası,0,3.08,10.69,23.83,34.93,47.47,295.93,840.76,0,0,0,46.36,0,5.56,0,0,48.08,14282,1034421285,0.90,1.09`;

const CATEGORY = {
  'Kıymetli maden': 'precious_metals',
  'Gümüş': 'silver',
  'Altın': 'gold',
  'Hisse': 'equity',
  'Karma': 'mixed',
  'Para piyasası': 'money_market',
};
const PERIODS = { r_1m: '1m', r_3m: '3m', r_6m: '6m', r_ytd: 'ytd', r_1y: '1y', r_3y: '3y', r_5y: '5y' };
const CONTENT = ['precious_metal', 'equity', 'equity_foreign', 'lease_tl', 'lease_fx', 'participation_tl', 'participation_fx', 'fund_basket', 'other'];

const num = (s) => (s === '' ? null : Number(s));

const [header, ...lines] = CSV.split('\n');
const cols = header.split(',');

export const FUNDS = Object.fromEntries(
  lines.map((line) => {
    const v = Object.fromEntries(line.split(',').map((x, i) => [cols[i], x]));
    const fund = {
      code: v.code,
      name: v.name,
      category: CATEGORY[v.category],
      w_current: num(v.w_current),
      returns: Object.fromEntries(Object.entries(PERIODS).map(([k, p]) => [p, num(v[k])])),
      content: Object.fromEntries(CONTENT.map((k) => [k, num(v[k])])),
      investors: num(v.investors),
      size_tl: num(v.size_tl),
      mgmt_fee: num(v.mgmt_fee),
      max_ter: num(v.max_ter),
    };
    return [v.code, fund];
  }),
);

export const YTD_MONTHS = 9;
