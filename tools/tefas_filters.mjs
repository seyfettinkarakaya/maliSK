#!/usr/bin/env node
// TEFAS veri isteğindeki tür filtrelerini dener: her alan/değer için dönen fon kümesini kaydeder.
// Amaç: TEFAS'ın katılım (faizsiz) sınıflamasını bulmak. Sonuç: docs/tefas_filters.md
import https from 'node:https';
import fs from 'node:fs';

const URL = 'https://www.tefas.gov.tr/api/funds/fonGnlBlgSiraliGetir';
const HEADERS = {
  Accept: '*/*', 'Content-Type': 'application/json', Origin: 'https://www.tefas.gov.tr',
  Referer: 'https://www.tefas.gov.tr/tr/fon-verileri',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
};
const agent = new https.Agent({ keepAlive: true, maxSockets: 1 });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function post(body) {
  const payload = JSON.stringify(body);
  return new Promise((resolve) => {
    const req = https.request(URL, { method: 'POST', agent, timeout: 60000, headers: { ...HEADERS, 'Content-Length': Buffer.byteLength(payload) } }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(Buffer.concat(chunks).toString('utf8')) }); } catch { resolve({ status: res.statusCode, data: null }); }
      });
    });
    req.on('timeout', () => req.destroy(new Error('zaman aşımı')));
    req.on('error', (e) => resolve({ status: null, error: e.message }));
    req.end(payload);
  });
}

async function call(overrides) {
  const d = new Date(Date.now() + 3 * 3600000);
  for (let back = 1; back <= 6; back++) {
    // Son iş gününü bul (tek gün).
    const day = new Date(d.getTime() - back * 86400000);
    if ([0, 6].includes(day.getUTCDay())) continue;
    const ymd = day.toISOString().slice(0, 10).replaceAll('-', '');
    const body = {
      fonTipi: 'EMK', fonKodu: null, aramaMetni: null, fonTurKod: null, fonGrubu: null, sfonTurKod: null,
      fonTurAciklama: null, kurucuKod: null, basTarih: ymd, bitTarih: ymd, basSira: 1, bitSira: 100000, dil: 'TR',
      sFonTurKod: '', fonKod: '', fonGrup: '', fonUnvanTip: '', ...overrides,
    };
    for (let attempt = 1; attempt <= 4; attempt++) {
      await sleep(attempt === 1 ? 11000 : 20000);
      const r = await post(body);
      if (r.status !== null) return { ...r, day: ymd };
    }
    return { status: null, error: 'bağlantı yok', day: ymd };
  }
}

const isKat = (n) => String(n || '').toLocaleUpperCase('tr-TR').includes('KATILIM');
const tests = [];
for (const v of ['KATILIM', 'FAIZSIZ', 'FAİZSİZ', 'K', 'F', 'Y', '1', '2', '3', '4']) tests.push({ fonUnvanTip: v });
for (let i = 1; i <= 16; i++) tests.push({ sFonTurKod: String(i) });
for (let i = 1; i <= 16; i++) tests.push({ fonTurKod: String(i) });
for (const v of ['KATILIM', 'K', '1', '2']) tests.push({ fonGrup: v });

const L = ['# TEFAS tür filtresi denemesi', '', `Üretildi: ${new Date().toISOString()} · \`tools/tefas_filters.mjs\``, '',
  'Her satır: filtre alanı = değer → dönen fon sayısı, adında KATILIM geçen sayısı, örnek adlar.', ''];
const base = await call({});
const baseRows = base.data?.resultList || [];
const baseKat = baseRows.filter((r) => isKat(r.fonUnvan)).length;
L.push(`- **Filtresiz** (${base.day}): ${baseRows.length} fon, ${baseKat} KATILIM`, '');
for (const t of tests) {
  const [k, v] = Object.entries(t)[0];
  const r = await call(t);
  const rows = r.data?.resultList || [];
  const kat = rows.filter((x) => isKat(x.fonUnvan)).length;
  const msg = r.data?.errorMessage || r.error || '';
  const sample = rows.slice(0, 4).map((x) => `${x.fonKodu} ${String(x.fonUnvan).replace(/EMEKLİLİK YATIRIM FONU/g, '').slice(0, 60)}`).join('; ');
  const nonKat = rows.filter((x) => !isKat(x.fonUnvan)).slice(0, 3).map((x) => x.fonKodu).join(', ');
  const note = rows.length && rows.length !== baseRows.length ? ' ⟵ FARKLI KÜME' : '';
  L.push(`- \`${k} = ${v}\` → HTTP ${r.status} · ${rows.length} fon · ${kat} KATILIM${nonKat ? ` · KATILIM olmayan örnek: ${nonKat}` : ''}${msg ? ' · ' + msg : ''}${note}${sample && note ? `\n  - örnek: ${sample}` : ''}`);
  fs.mkdirSync('docs', { recursive: true });
  fs.writeFileSync('docs/tefas_filters.md', L.join('\n') + '\n');
}
console.log('Yazıldı: docs/tefas_filters.md');
