#!/usr/bin/env node
// TEFAS sayfasını gerçek bir tarayıcıyla açar (bot korumasını tarayıcı geçer), sayfanın yaptığı
// API çağrılarını, JavaScript içindeki uç noktaları ve fon türü / katılım seçeneklerini kaydeder.
// Sonuç: docs/tefas_browser.md. GitHub Actions'ta çalışır (tefas-browser.yml).
import { chromium } from 'playwright';
import fs from 'node:fs';

const URL = 'https://www.tefas.gov.tr/tr/fon-verileri';
const KEY_RE = /(s?fonTur\w*|fonGrub\w*|fonUnvanTip\w*|semsiye\w*|katil[iı]m\w*|faizsiz\w*|fonTipi\w*)/gi;
const API_RE = /["'`]([^"'`\s]{0,40}api\/[A-Za-z0-9_\-\/]+)["'`]/g;
const NAME_RE = /["'`]([a-z][A-Za-z]{3,}(?:Getir|Getirir|Liste|Listesi|SiraliGetir\w*))["'`]/g;

const calls = [];
const scripts = [];
const L = ['# TEFAS tarayıcı keşfi', '', `Üretildi: ${new Date().toISOString()} · \`tools/tefas_browser.mjs\``, ''];

const browser = await chromium.launch();
const page = await browser.newPage({ locale: 'tr-TR', viewport: { width: 1366, height: 900 } });
page.on('response', async (res) => {
  const url = res.url();
  try {
    if (/\/api\//.test(url)) {
      const req = res.request();
      calls.push({ method: req.method(), url, post: req.postData(), status: res.status(), body: (await res.text()).slice(0, 2500) });
    } else if (/\.js(\?|$)/.test(url)) {
      scripts.push({ url, text: await res.text() });
    }
  } catch { /* yanıt gövdesi okunamadı */ }
});

let gotoError = null;
try {
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 120000 });
} catch (e) {
  gotoError = e.message;
}
await page.waitForTimeout(8000);
L.push(`- Açılış: ${gotoError ? 'hata: ' + gotoError : 'tamam'} · başlık: ${await page.title()}`, '');

// Sayfadaki seçenekler: select, liste kutusu ve tür/katılım geçen öğeler.
const ui = await page.evaluate(() => {
  const out = { selects: [], texts: [], body: document.body.innerText.slice(0, 6000) };
  for (const s of document.querySelectorAll('select')) {
    out.selects.push({ name: s.name || s.id || s.getAttribute('aria-label') || '', options: [...s.options].map((o) => `${o.value} = ${o.textContent.trim()}`) });
  }
  const re = /(tür|tur|katılım|katilim|şemsiye|faizsiz)/i;
  for (const el of document.querySelectorAll('label, button, [role="option"], [role="tab"], li, span, div')) {
    const t = (el.childElementCount === 0 ? el.textContent : '').trim();
    if (t && t.length < 80 && re.test(t)) out.texts.push(t);
  }
  out.texts = [...new Set(out.texts)].slice(0, 200);
  return out;
});

// "Emeklilik" sekmesi/düğmesi varsa tıkla; tür filtresini açmayı dene.
for (const label of ['Emeklilik', 'EMK', 'Fon Türü', 'Şemsiye Fon Türü', 'Fon Grubu']) {
  try {
    const el = page.getByText(label, { exact: false }).first();
    if (await el.count()) {
      await el.click({ timeout: 5000 });
      await page.waitForTimeout(3000);
      L.push(`- "${label}" tıklandı`);
    }
  } catch { /* öğe yok ya da tıklanamadı */ }
}
const after = await page.evaluate(() => {
  const re = /(tür|tur|katılım|katilim|şemsiye|faizsiz)/i;
  const t = [];
  for (const el of document.querySelectorAll('[role="option"], li, label, span, div, button')) {
    const s = (el.childElementCount === 0 ? el.textContent : '').trim();
    if (s && s.length < 80 && re.test(s)) t.push(s);
  }
  return [...new Set(t)].slice(0, 200);
});

L.push('', '## Sayfadaki seçim kutuları', '');
for (const s of ui.selects) L.push(`- **${s.name}**: ${s.options.slice(0, 60).join(' · ')}`);
L.push('', '## Tür / katılım geçen metinler (açılışta)', '', ui.texts.map((t) => `- ${t}`).join('\n'));
L.push('', '## Tür / katılım geçen metinler (tıklamalardan sonra)', '', after.map((t) => `- ${t}`).join('\n'));

L.push('', `## Sayfanın API çağrıları (${calls.length})`, '');
for (const c of calls) {
  L.push(`### ${c.method} ${c.url} → ${c.status}`, '', c.post ? '```json\n' + c.post.slice(0, 1500) + '\n```' : '', '```', c.body.replace(/```/g, "'''"), '```', '');
}

const apis = new Set();
const names = new Set();
const keys = new Map();
for (const s of scripts) {
  for (const m of s.text.matchAll(API_RE)) apis.add(m[1]);
  for (const m of s.text.matchAll(NAME_RE)) names.add(m[1]);
  for (const m of s.text.matchAll(KEY_RE)) {
    const list = keys.get(m[1]) || [];
    if (list.length < 3) {
      list.push(s.text.slice(Math.max(0, m.index - 120), m.index + 140).replace(/\s+/g, ' '));
      keys.set(m[1], list);
    }
  }
}
L.push(`## JavaScript içindeki API yolları (${scripts.length} dosya)`, '', [...apis].sort().map((a) => `- \`${a}\``).join('\n'));
L.push('', '## Uç nokta adları', '', [...names].sort().map((a) => `- \`${a}\``).join('\n'));
L.push('', '## Anahtar kelimeler (bağlam)', '');
for (const [k, list] of [...keys].sort()) {
  L.push(`### ${k}`, '');
  for (const ctx of list) L.push('```', ctx.replace(/```/g, "'''"), '```');
}
L.push('', '<details><summary>Sayfa metni</summary>', '', '```', ui.body, '```', '</details>');

fs.mkdirSync('docs', { recursive: true });
fs.writeFileSync('docs/tefas_browser.md', L.join('\n') + '\n');
console.log(`Yazıldı: docs/tefas_browser.md · ${calls.length} API çağrısı · ${scripts.length} JS · ${apis.size} yol · ${keys.size} anahtar`);
await browser.close();
