// Türkçe sayı ve metin biçimleri.

export function num(x, d = 1) {
  if (x === null || x === undefined || Number.isNaN(x)) return '—';
  return Math.abs(x).toLocaleString('tr-TR', { minimumFractionDigits: d, maximumFractionDigits: d });
}

// −%0,9 · %12,3 · +%5,0 (sign=true)
export function pct(x, d = 1, sign = false) {
  if (x === null || x === undefined || Number.isNaN(x)) return '—';
  const s = x < 0 ? '−' : sign && x > 0 ? '+' : '';
  return `${s}%${num(x, d)}`;
}

export function signed(x, d = 1) {
  if (x === null || x === undefined || Number.isNaN(x)) return '—';
  return (x < 0 ? '−' : x > 0 ? '+' : '') + num(x, d);
}

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

const TR_MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

export function dateTr(d) {
  if (!d) return '—';
  return `${Number(d.slice(8, 10))} ${TR_MONTHS[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}`;
}

export function moneyTl(x) {
  if (!x) return '—';
  if (x >= 1e9) return `${num(x / 1e9, 1)} milyar ₺`;
  if (x >= 1e6) return `${num(x / 1e6, 0)} milyon ₺`;
  return `${num(x, 0)} ₺`;
}

export function people(x) {
  if (!x) return '—';
  if (x >= 1e6) return `${num(x / 1e6, 2)} milyon kişi`;
  if (x >= 1e3) return `${num(x / 1e3, 0)} bin kişi`;
  return `${num(x, 0)} kişi`;
}

// "TÜRKİYE HAYAT VE EMEKLİLİK A.Ş. ALTIN KATILIM EMEKLİLİK YATIRIM FONU" → şirket "Türkiye Hayat", ad "Altın Katılım"
function titleTr(s) {
  return s.toLocaleLowerCase('tr-TR').replace(/(^|[\s(])(\p{L})/gu, (m, a, b) => a + b.toLocaleUpperCase('tr-TR'));
}

export function fundNames(name) {
  const raw = String(name || '');
  const i = raw.indexOf('A.Ş.');
  const company = i > 0 ? raw.slice(0, i) : '';
  let short = i > 0 ? raw.slice(i + 4) : raw;
  short = short.replace(/EMEKLİLİK YATIRIM FONU\s*$/u, '').replace(/\bEYF\s*$/u, '').trim();
  const comp = company.replace(/\b(HAYAT|YAŞAM|SİGORTA|VE|EMEKLİLİK)\b/gu, ' ').replace(/\s+/g, ' ').trim();
  // Yabancı adlar ve kısaltmalar Türkçe büyük-küçük harf kuralına uymaz.
  const fix = { Allıanz: 'Allianz', Hdı: 'HDI', Qnb: 'QNB', Bnp: 'BNP', Axa: 'AXA', Nn: 'NN' };
  const companyTr = titleTr(comp || company).split(' ').map((w) => fix[w] || w).join(' ');
  return { short: titleTr(short || raw), company: companyTr };
}

export const FLAG_LABELS = {
  yeni_fon: 'Yeni fon',
  isinma: 'Isınma',
  strateji_kaymasi: 'Strateji kayması',
  supheli_veri: 'Şüpheli veri',
  helal_uyarisi: 'Helal dışı',
  donusum: 'Strateji değişti',
};

export function todayIstanbul() {
  return new Date(Date.now() + 3 * 3600000).toISOString().slice(0, 10);
}
