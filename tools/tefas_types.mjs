#!/usr/bin/env node
// TEFAS fon türü (fonTurAciklama) ve ücret alanlarını inceler.
// Uç noktalar borsapy 0.11.0'dan: fonYonetimBazliBilgiGetir, fonGetiriBazliBilgiGetir.
// Sonuç: docs/tefas_types.md ve docs/probe/tefas_types_sample.json
import https from 'node:https';
import fs from 'node:fs';

const BASE = 'https://www.tefas.gov.tr/api/funds/';
const HEADERS = {
  Accept: 'application/json', 'Content-Type': 'application/json', Origin: 'https://www.tefas.gov.tr',
  Referer: 'https://www.tefas.gov.tr/tr/fon-verileri',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
};
const agent = new https.Agent({ keepAlive: true, maxSockets: 1 });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function post(path, body) {
  const payload = JSON.stringify(body);
  return new Promise((resolve) => {
    const req = https.request(BASE + path, { method: 'POST', agent, timeout: 90000, headers: { ...HEADERS, 'Content-Length': Buffer.byteLength(payload) } }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        try { resolve({ status: res.statusCode, data: JSON.parse(text) }); } catch { resolve({ status: res.statusCode, text: text.slice(0, 500) }); }
      });
    });
    req.on('timeout', () => req.destroy(new Error('zaman aşımı')));
    req.on('error', (e) => resolve({ status: null, error: e.message }));
    req.end(payload);
  });
}

async function call(path, body) {
  for (let attempt = 1; attempt <= 5; attempt++) {
    await sleep(attempt === 1 ? 12000 : 25000);
    const r = await post(path, body);
    if (r.status !== null && r.status !== 429) return r;
  }
  return { status: null, error: 'cevap yok' };
}

const isKat = (n) => String(n || '').toLocaleUpperCase('tr-TR').includes('KATILIM');
const L = ['# TEFAS fon türü ve ücret alanları', '', `Üretildi: ${new Date().toISOString()} · \`tools/tefas_types.mjs\``, ''];
const samples = {};

const requests = [
  ['fonYonetimBazliBilgiGetir', { fonTipi: 'EMK', dil: 'TR' }],
  ['fonGetiriBazliBilgiGetir', { fonTipi: 'EMK', dil: 'TR', calismaTipi: 2, donemGetiri1a: '1', donemGetiri3a: '1', donemGetiri6a: '1', donemGetiriyb: '1', donemGetiri1y: '1', donemGetiri3y: '1', donemGetiri5y: '1' }],
];
const typeOf = {};
for (const [path, body] of requests) {
  const r = await call(path, body);
  const rows = r.data?.resultList || [];
  L.push(`## ${path}`, '', `HTTP ${r.status} · ${rows.length} satır${r.data?.errorMessage ? ' · ' + r.data.errorMessage : ''}${r.error ? ' · ' + r.error : ''}${r.text ? ' · ' + r.text : ''}`, '');
  if (!rows.length) continue;
  const keys = [...new Set(rows.flatMap((x) => Object.keys(x)))];
  L.push(`Alanlar: ${keys.map((k) => '`' + k + '`').join(', ')}`, '');
  samples[path] = rows.slice(0, 3);
  const typeKey = keys.find((k) => k === 'fonTurAciklama');
  if (typeKey) {
    const groups = {};
    for (const x of rows) {
      const t = x.fonTurAciklama ?? '(boş)';
      const g = (groups[t] ||= { n: 0, kat: 0, codes: new Set(), nonKat: [], katSample: [] });
      g.n++;
      if (x.fonTurKod !== undefined) g.codes.add(x.fonTurKod);
      if (isKat(x.fonUnvan)) { g.kat++; if (g.katSample.length < 3) g.katSample.push(x.fonKodu); } else if (g.nonKat.length < 3) g.nonKat.push(x.fonKodu);
      typeOf[x.fonKodu] = t;
    }
    L.push('| fonTurAciklama | fon | adında KATILIM | fonTurKod | KATILIM örnek | KATILIM olmayan örnek |', '|---|---|---|---|---|---|');
    for (const [t, g] of Object.entries(groups).sort((a, b) => b[1].n - a[1].n)) {
      L.push(`| ${t} | ${g.n} | ${g.kat} | ${[...g.codes].join(', ')} | ${g.katSample.join(', ')} | ${g.nonKat.join(', ')} |`);
    }
    L.push('');
    // Adında KATILIM geçip tür açıklaması katılım olmayan ve tersi.
    const typeSaysKat = (t) => /katılım|katilim|faizsiz/i.test(t);
    const a = rows.filter((x) => isKat(x.fonUnvan) && !typeSaysKat(x.fonTurAciklama || '')).map((x) => `${x.fonKodu} (${x.fonTurAciklama})`);
    const b = rows.filter((x) => !isKat(x.fonUnvan) && typeSaysKat(x.fonTurAciklama || '')).map((x) => `${x.fonKodu} (${x.fonTurAciklama})`);
    L.push(`- Adında KATILIM olup türü katılım olmayan: ${a.length ? a.join(', ') : 'yok'}`);
    L.push(`- Türü katılım olup adında KATILIM olmayan: ${b.length ? b.join(', ') : 'yok'}`, '');
  }
}

fs.mkdirSync('docs/probe', { recursive: true });
fs.writeFileSync('docs/probe/tefas_types_sample.json', JSON.stringify(samples, null, 1) + '\n');
fs.writeFileSync('docs/tefas_types.md', L.join('\n') + '\n');
console.log('Yazıldı: docs/tefas_types.md');
