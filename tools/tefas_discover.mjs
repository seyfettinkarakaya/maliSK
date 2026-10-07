#!/usr/bin/env node
// TEFAS keşfi: sitenin sayfalarını ve JavaScript dosyalarını indirip API uç noktalarını,
// fon türü ve katılım etiketlerini arar; sonucu docs/tefas_discovery.md'ye yazar.
// GitHub Actions'ta çalışır (tefas-discover.yml).
import https from 'node:https';
import fs from 'node:fs';

const ORIGIN = 'https://www.tefas.gov.tr';
const HEADERS = {
  Accept: '*/*',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
  Referer: ORIGIN + '/tr/fon-verileri',
  Origin: ORIGIN,
};
const agent = new https.Agent({ keepAlive: true, maxSockets: 1 });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function request(url, { method = 'GET', body = null } = {}, redirects = 3) {
  const payload = body ? JSON.stringify(body) : null;
  return new Promise((resolve) => {
    const req = https.request(url, {
      method, agent, timeout: 60000,
      headers: { ...HEADERS, ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}) },
    }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && redirects > 0) {
        res.resume();
        resolve(request(new URL(res.headers.location, url).href, { method, body }, redirects - 1));
        return;
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, type: res.headers['content-type'] || '', text: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('timeout', () => req.destroy(new Error('zaman aşımı')));
    req.on('error', (e) => resolve({ status: null, type: '', text: '', error: e.message }));
    if (payload) req.end(payload);
    else req.end();
  });
}

const PAGES = ['/tr/fon-verileri', '/tr', '/tr/fon-karsilastirma', '/tr/fon-analiz', '/tr/fon-detayli-analiz'];
const KEY_RE = /(s?fonTur\w*|fonGrub\w*|fonUnvanTip\w*|semsiye\w*|şemsiye\w*|katil[iı]m\w*|katılım\w*|faizsiz\w*|islami\w*|icazet\w*|danışma kurulu\w*)/gi;
const API_RE = /["'`]([^"'`\s]{0,40}api\/[A-Za-z0-9_\-\/]+)["'`]/g;
const JS_RE = /["'`]((?:\.{0,2}\/)?[A-Za-z0-9_\-\/\.]+\.js)["'`]/g;
const ENDPOINT_RE = /["'`]([A-Za-z]{4,}(?:Getir|Liste|Listesi|Getirir|Sirali\w*))["'`]/g;

async function main() {
  const L = ['# TEFAS keşfi', '', `Üretildi: ${new Date().toISOString()} · \`tools/tefas_discover.mjs\``, ''];
  const scripts = new Set();
  const pages = {};
  for (const p of PAGES) {
    const r = await request(ORIGIN + p);
    pages[p] = r;
    L.push(`- Sayfa \`${p}\`: HTTP ${r.status} · ${r.text.length} bayt${r.error ? ' · ' + r.error : ''}`);
    for (const m of r.text.matchAll(/<script[^>]+src="([^"]+)"/g)) scripts.add(new URL(m[1], ORIGIN).href);
    for (const m of r.text.matchAll(/["'](\/_next\/static\/[^"']+\.js)["']/g)) scripts.add(ORIGIN + m[1]);
    await sleep(1500);
  }
  L.push('', `Bulunan JavaScript dosyası: ${scripts.size}`, '');

  const apis = new Map();
  const names = new Map();
  const keys = new Map();
  const sources = [...Object.entries(pages).map(([p, r]) => [p, r.text])];
  // Betiklerin içinden çağrılan diğer JavaScript parçalarını da izle (en çok 150 dosya).
  const queue = [...scripts];
  const seen = new Set();
  while (queue.length && seen.size < 150) {
    const url = queue.shift();
    if (seen.has(url)) continue;
    seen.add(url);
    const r = await request(url);
    sources.push([url.replace(ORIGIN, ''), r.text]);
    for (const m of r.text.matchAll(JS_RE)) {
      try {
        const next = new URL(m[1], url).href;
        if (next.startsWith(ORIGIN) && !seen.has(next)) queue.push(next);
      } catch { /* geçersiz yol */ }
    }
    await sleep(300);
  }
  L.push(`İncelenen JavaScript dosyası: ${seen.size}`, '', '<details><summary>fon-verileri HTML</summary>', '', '```html', (pages['/tr/fon-verileri']?.text || '').slice(0, 4000), '```', '</details>', '');
  for (const [src, text] of sources) {
    for (const m of text.matchAll(API_RE)) apis.set(m[1], src);
    for (const m of text.matchAll(ENDPOINT_RE)) names.set(m[1], src);
    for (const m of text.matchAll(KEY_RE)) {
      const k = m[1];
      const list = keys.get(k) || [];
      if (list.length < 4) {
        const s = Math.max(0, m.index - 90);
        list.push(text.slice(s, m.index + 110).replace(/\s+/g, ' '));
        keys.set(k, list);
      }
    }
  }

  L.push('## API yolları', '');
  for (const [a, src] of [...apis].sort()) L.push(`- \`${a}\` (${src.slice(0, 60)})`);
  L.push('', '## Uç nokta adları', '');
  for (const [a] of [...names].sort()) L.push(`- \`${a}\``);
  L.push('', '## Tür / katılım anahtar kelimeleri (bağlam)', '');
  for (const [k, list] of [...keys].sort()) {
    L.push(`### ${k}`, '');
    for (const ctx of list) L.push('```', ctx, '```');
  }

  // Liste döndürmesi muhtemel uç noktaları dene.
  const candidates = [...new Set([...apis.keys()].filter((a) => /tur|tür|grup|liste|kurucu|semsiye|tip/i.test(a))
    .concat([...names.keys()].filter((a) => /tur|grup|liste|kurucu|semsiye|tip/i.test(a)).map((a) => '/api/funds/' + a)))].slice(0, 20);
  L.push('', '## Aday uç nokta denemeleri', '');
  for (const path of candidates) {
    for (const [method, body] of [['POST', { fonTipi: 'EMK', dil: 'TR' }], ['GET', null]]) {
      await sleep(11000);
      const r = await request(ORIGIN + path, { method, body });
      L.push(`### ${method} ${path} → HTTP ${r.status}`, '', '```', r.text.slice(0, 1500).replace(/```/g, "'''"), '```', '');
      if (r.status === 200 && r.text.trim().startsWith('{')) break;
    }
  }

  fs.mkdirSync('docs', { recursive: true });
  fs.writeFileSync('docs/tefas_discovery.md', L.join('\n') + '\n');
  console.log(`Yazıldı: docs/tefas_discovery.md · ${apis.size} API yolu · ${keys.size} anahtar kelime · ${candidates.length} aday`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
