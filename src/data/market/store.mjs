// Piyasa serilerinin deposu: her seri bir CSV (data/market/<id>.csv: date,value,source).
// GitHub CSV'yi tablo olarak gösterir; geçmişi git tutar. Durum özeti data/market/status.json.
import fs from 'node:fs';
import path from 'node:path';

export function parseCsv(text) {
  const rows = [];
  for (const line of String(text || '').split('\n').slice(1)) {
    if (!line.trim()) continue;
    const [date, value, source] = line.split(',');
    const v = Number(value);
    if (/^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(v)) rows.push({ date, value: v, source: source || '' });
  }
  return rows;
}

export function toCsv(rows) {
  return 'date,value,source\n' + rows.map((r) => `${r.date},${r.value},${r.source}`).join('\n') + (rows.length ? '\n' : '');
}

// Yeni satırlar eskilerin üstüne yazar (aynı gün düzeltilmiş değer gelebilir); tarih sırasıyla döner.
export function mergeRows(oldRows, newRows) {
  const m = new Map(oldRows.map((r) => [r.date, r]));
  for (const r of newRows) m.set(r.date, r);
  return [...m.values()].sort((a, b) => a.date.localeCompare(b.date));
}

// Yedek kaynağın ölçeği kayıtlı seriyle aynı mı? Örtüşen günlerin medyan oranına bakılır.
// Örtüşme yoksa (ilk yükleme) kabul edilir.
export function consistent(oldRows, newRows, tol) {
  const old = new Map(oldRows.map((r) => [r.date, r.value]));
  const ratios = newRows.filter((r) => old.has(r.date) && old.get(r.date) !== 0).map((r) => r.value / old.get(r.date)).sort((a, b) => a - b);
  if (!ratios.length) return { ok: true, overlap: 0 };
  const med = ratios[Math.floor(ratios.length / 2)];
  return { ok: Math.abs(med - 1) <= tol, overlap: ratios.length, ratio: med };
}

export class MarketStore {
  constructor(dir) {
    this.dir = dir;
  }

  file(id) {
    return path.join(this.dir, `${id}.csv`);
  }

  load(id) {
    try { return parseCsv(fs.readFileSync(this.file(id), 'utf8')); } catch { return []; }
  }

  save(id, rows) {
    fs.mkdirSync(this.dir, { recursive: true });
    fs.writeFileSync(this.file(id), toCsv(rows));
  }

  status() {
    try { return JSON.parse(fs.readFileSync(path.join(this.dir, 'status.json'), 'utf8')); } catch { return { series: {} }; }
  }

  saveStatus(st) {
    fs.mkdirSync(this.dir, { recursive: true });
    fs.writeFileSync(path.join(this.dir, 'status.json'), JSON.stringify(st, null, 1) + '\n');
  }
}
