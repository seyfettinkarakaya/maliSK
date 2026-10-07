// Depodaki veri dosyaları. Geçmiş aylar hiç değişmez; içinde bulunulan ayın dosyasına yalnız gün eklenir.
//   data/funds.json              { kod: { name, first_seen, last_seen } }
//   data/prices/YYYY-MM.json     { fields, days: { 'YYYY-MM-DD': [[kod, fiyat, pay, kişi, büyüklük], ...] } }
//   data/contents/YYYY-MM.json   { snapshots: { 'YYYY-MM-DD': { kod: { alan: yüzde } } } }  (ayın ilk ve son günü)
import fs from 'node:fs';
import path from 'node:path';

const PRICE_FIELDS = ['code', 'price', 'shares', 'investors', 'size_tl'];

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(file, obj) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(obj) + '\n');
}

export class Store {
  constructor(dir) {
    this.dir = dir;
  }

  funds() {
    return readJson(path.join(this.dir, 'funds.json'), {});
  }

  saveFunds(funds) {
    writeJson(path.join(this.dir, 'funds.json'), funds);
  }

  priceMonths() {
    const d = path.join(this.dir, 'prices');
    return fs.existsSync(d) ? fs.readdirSync(d).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, 7)).sort() : [];
  }

  // rows: normalizeInfo çıktısı. Var olan günün satırları yenisiyle değişir (aynı gün yeniden çekilirse).
  addPrices(rows) {
    const byMonth = {};
    for (const r of rows) (byMonth[r.date.slice(0, 7)] ||= []).push(r);
    for (const [month, list] of Object.entries(byMonth)) {
      const file = path.join(this.dir, 'prices', month + '.json');
      const doc = readJson(file, { fields: PRICE_FIELDS, days: {} });
      const days = {};
      for (const r of list) (days[r.date] ||= []).push(PRICE_FIELDS.map((f) => r[f]));
      Object.assign(doc.days, days);
      doc.days = Object.fromEntries(Object.entries(doc.days).sort(([a], [b]) => a.localeCompare(b)));
      writeJson(file, doc);
    }
  }

  // { kod: [{ date, price, shares, investors, size_tl }] } tarih sırasıyla.
  loadPrices() {
    const out = {};
    for (const month of this.priceMonths()) {
      const doc = readJson(path.join(this.dir, 'prices', month + '.json'), { days: {} });
      for (const [date, rows] of Object.entries(doc.days)) {
        for (const row of rows) {
          const r = Object.fromEntries(PRICE_FIELDS.map((f, i) => [f, row[i]]));
          (out[r.code] ||= []).push({ date, price: r.price, shares: r.shares, investors: r.investors, size_tl: r.size_tl });
        }
      }
    }
    for (const list of Object.values(out)) list.sort((a, b) => a.date.localeCompare(b.date));
    return out;
  }

  // Ayın ilk görüntüsü korunur, son görüntü her gün güncellenir.
  addContentSnapshot(date, map) {
    const file = path.join(this.dir, 'contents', date.slice(0, 7) + '.json');
    const doc = readJson(file, { snapshots: {} });
    const dates = Object.keys(doc.snapshots).sort();
    if (dates.length >= 2 && date > dates[dates.length - 1]) delete doc.snapshots[dates[dates.length - 1]];
    doc.snapshots[date] = map;
    doc.snapshots = Object.fromEntries(Object.entries(doc.snapshots).sort(([a], [b]) => a.localeCompare(b)));
    writeJson(file, doc);
  }

  contentMonths() {
    const d = path.join(this.dir, 'contents');
    return fs.existsSync(d) ? fs.readdirSync(d).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, 7)).sort() : [];
  }

  // [{ date, map }] tarih sırasıyla.
  loadContents() {
    const out = [];
    for (const month of this.contentMonths()) {
      const doc = readJson(path.join(this.dir, 'contents', month + '.json'), { snapshots: {} });
      for (const [date, map] of Object.entries(doc.snapshots)) out.push({ date, map });
    }
    return out.sort((a, b) => a.date.localeCompare(b.date));
  }

  writeLatest(obj) {
    writeJson(path.join(this.dir, 'latest.json'), obj);
  }
}
