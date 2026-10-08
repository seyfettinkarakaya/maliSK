// Tablodan yapıştırılan dağılımı çözer (Excel, Numbers, Notlar). DOM ve ağ erişimi yok.
// Beklenen sütunlar: Kod · Dağılım (%) · Sözleşme no. Başlık satırı varsa sütun sırası ondan okunur.
// Ayraç: sekme, noktalı virgül ya da boşluk. Ondalık virgül ("12,5") ve "%" işareti kabul edilir.

const CODE_RE = /^[A-ZÇĞİÖŞÜ0-9]{3}$/u;
const HEADER_KEYS = {
  code: ['kod', 'fon', 'code'],
  pct: ['dağılım', 'dagilim', 'oran', 'pay', 'yüzde', '%'],
  contract: ['sözleşme', 'sozlesme', 'no', 'poliçe', 'police'],
};

function splitLine(line) {
  if (line.includes('\t')) return line.split('\t').map((s) => s.trim());
  if (line.includes(';')) return line.split(';').map((s) => s.trim());
  return line.trim().split(/\s+/);
}

function toNumber(s) {
  const t = String(s ?? '').replace(/%/g, '').replace(/\s/g, '').replace(',', '.');
  return t !== '' && /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : null;
}

function headerMap(cells) {
  const low = cells.map((c) => c.toLocaleLowerCase('tr-TR'));
  const find = (keys) => low.findIndex((c) => keys.some((k) => c.includes(k)));
  const code = find(HEADER_KEYS.code);
  const contract = find(HEADER_KEYS.contract);
  const pct = low.findIndex((c, i) => i !== code && i !== contract && HEADER_KEYS.pct.some((k) => c.includes(k)));
  return code >= 0 && pct >= 0 ? { code, pct, contract } : null;
}

// knownCodes: veri setindeki fon kodları (Set); verilmezse kod denetimi yapılmaz.
// defaultContract: sözleşme sütunu olmayan satırlara verilen numara.
export function parseAllocationTable(text, { knownCodes = null, halalCodes = null, defaultContract = '1', tolerance = 0.5 } = {}) {
  const errors = [];
  const warnings = [];
  const contracts = {};
  let map = { code: 0, pct: 1, contract: 2 };
  let rows = 0;
  const lines = String(text || '').split(/\r?\n/);
  lines.forEach((raw, idx) => {
    const line = raw.trim();
    if (!line) return;
    const cells = splitLine(line);
    const hm = headerMap(cells);
    if (hm && toNumber(cells[hm.pct]) === null) {
      map = hm;
      return;
    }
    const n = idx + 1;
    const code = (cells[map.code] || '').toLocaleUpperCase('tr-TR');
    const pct = toNumber(cells[map.pct]);
    const contract = map.contract >= 0 && cells[map.contract] ? String(cells[map.contract]).replace(/\s/g, '') : defaultContract;
    if (!CODE_RE.test(code)) return errors.push({ line: n, msg: `“${cells[map.code] ?? ''}” bir fon kodu değil` });
    if (pct === null || pct < 0 || pct > 100) return errors.push({ line: n, msg: `${code}: yüzde okunamadı` });
    if (knownCodes && !knownCodes.has(code)) warnings.push({ line: n, msg: `${code} veride bulunamadı` });
    else if (halalCodes && !halalCodes.has(code)) warnings.push({ line: n, msg: `${code} helal listesinde değil` });
    const c = (contracts[contract] ||= { weights: {}, sum: 0 });
    if (c.weights[code] !== undefined) warnings.push({ line: n, msg: `${code} sözleşme ${contract} içinde iki kez; toplandı` });
    c.weights[code] = (c.weights[code] || 0) + pct;
    c.sum += pct;
    rows++;
  });
  for (const [no, c] of Object.entries(contracts)) {
    c.sum = Math.round(c.sum * 100) / 100;
    c.ok = Math.abs(c.sum - 100) <= tolerance;
    if (!c.ok) errors.push({ line: null, msg: `Sözleşme ${no}: toplam %${String(c.sum).replace('.', ',')}, 100 olmalı` });
  }
  if (!rows && !errors.length) errors.push({ line: null, msg: 'Tabloda satır bulunamadı' });
  return { contracts, rows, errors, warnings, ok: errors.length === 0 };
}
