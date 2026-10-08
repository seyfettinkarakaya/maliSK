#!/usr/bin/env node
// Günlük iş: TEFAS'tan veri çeker, data/ altına yazar, data/latest.json'u üretir.
//   node src/pipeline/update.mjs              günlük (son 10 gün fiyat, son içerik)
//   node src/pipeline/update.mjs --backfill   eksik ayları 5 yıl geriye kadar doldurur
//   node src/pipeline/update.mjs --compute    yalnız hesap (veri çekmez)
//   node src/pipeline/update.mjs --skip-if-done  bugün başarılı çalışma varsa çıkar
import fs from 'node:fs';
import { TefasClient, isKatilim, normalizeInfo, normalizeDist } from '../data/tefas.mjs';
import { Store } from '../data/store.mjs';
import { computeLatest } from './compute.mjs';
import { DEFAULT_PARAMS } from '../model/params.mjs';
import { shiftDays } from './series.mjs';

const args = new Set(process.argv.slice(2));
const DATA = process.env.MALISK_DATA || 'data';
const store = new Store(DATA);
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const client = new TefasClient({ log });
const nowIstanbul = () => new Date(Date.now() + 3 * 3600000).toISOString();
const today = nowIstanbul().slice(0, 10);
const asDate = (s) => new Date(s + 'T00:00:00Z');

function rememberFunds(rows) {
  const funds = store.funds();
  for (const r of rows) {
    const f = (funds[r.code] ||= { name: r.name, first_seen: r.date, last_seen: r.date });
    f.name = r.name || f.name;
    if (r.date < f.first_seen) f.first_seen = r.date;
    if (r.date > f.last_seen) f.last_seen = r.date;
  }
  store.saveFunds(funds);
}

async function fetchPrices(start, end) {
  const rows = (await client.range('info', asDate(start), asDate(end))).filter((r) => isKatilim(r.fonUnvan)).map(normalizeInfo);
  rememberFunds(rows);
  store.addPrices(rows);
  return rows.length;
}

// Aralıktaki en erken (first=true) ya da en geç günün içerik görüntüsü.
async function fetchContent(start, end, first) {
  const rows = (await client.post('dist', asDate(start), asDate(end))).filter((r) => isKatilim(r.fonUnvan)).map(normalizeDist);
  if (!rows.length) return null;
  const dates = [...new Set(rows.map((r) => r.date))].sort();
  const date = first ? dates[0] : dates[dates.length - 1];
  const map = Object.fromEntries(rows.filter((r) => r.date === date).map((r) => [r.code, r.content]));
  store.addContentSnapshot(date, map);
  return date;
}

function monthsBack(years) {
  const earliest = shiftDays(today, -(years * 365) + 2);
  const out = [];
  let y = Number(earliest.slice(0, 4));
  let m = Number(earliest.slice(5, 7));
  while (`${y}-${String(m).padStart(2, '0')}` <= today.slice(0, 7)) {
    const key = `${y}-${String(m).padStart(2, '0')}`;
    const first = key === earliest.slice(0, 7) ? earliest : `${key}-01`;
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const last = `${key}-${String(lastDay).padStart(2, '0')}` > today ? today : `${key}-${String(lastDay).padStart(2, '0')}`;
    out.push({ key, first, last });
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return out;
}

async function backfill() {
  const haveP = new Set(store.priceMonths());
  const haveC = new Set(store.contentMonths());
  const months = monthsBack(5);
  const current = today.slice(0, 7);
  for (const mo of months) {
    // İçinde bulunulan ay her seferinde baştan çekilir; geçmiş aylar yalnız eksikse.
    if (mo.key === current || !haveP.has(mo.key)) log(`fiyat ${mo.key}: ${await fetchPrices(mo.first, mo.last)} satır`);
    if (mo.key !== current && !haveC.has(mo.key)) log(`içerik ${mo.key}: ${await fetchContent(mo.first, shiftDays(mo.first, 6), true)}`);
  }
}

async function daily() {
  log(`fiyat son 10 gün: ${await fetchPrices(shiftDays(today, -10), today)} satır`);
  const monthStart = today.slice(0, 8) + '01';
  if (!store.contentMonths().includes(today.slice(0, 7))) {
    log(`içerik ayın ilk günü: ${await fetchContent(monthStart, shiftDays(monthStart, 6), true)}`);
  }
  log(`içerik son: ${await fetchContent(shiftDays(today, -6), today, false)}`);
  try {
    const all = await client.fundMeta();
    const keep = Object.fromEntries(Object.entries(all).filter(([, m]) => isKatilim(m.name) || /katılım/i.test(m.type || '')));
    store.saveMeta(today, keep);
    log(`fon türü ve ücret: ${Object.keys(keep).length} katılım fonu`);
  } catch (err) {
    log(`fon türü ve ücret alınamadı, önceki kayıt kullanılacak: ${err.message}`);
  }
}

function compute() {
  const latest = computeLatest({
    fundsMeta: store.funds(),
    typeMeta: store.meta(),
    prices: store.loadPrices(),
    contents: store.loadContents(),
    params: DEFAULT_PARAMS,
    generatedAt: nowIstanbul().slice(0, 16).replace('T', ' '),
  });
  store.writeLatest(latest);
  const scored = latest.funds.filter((f) => f.score !== null).length;
  log(`latest.json: veri ${latest.data_date}, ${latest.funds.length} fon, ${latest.sources.tefas.halal} helal, ${scored} puanlı, çapa ${latest.anchor.ok ? 'hazır' : latest.anchor.reason}`);
}

async function main() {
  if (args.has('--skip-if-done')) {
    try {
      const prev = JSON.parse(fs.readFileSync(`${DATA}/latest.json`, 'utf8'));
      if (prev.generated_at?.slice(0, 10) === today) {
        log(`bugün zaten çalıştı (${prev.generated_at}); çıkılıyor`);
        return;
      }
    } catch { /* ilk çalışma */ }
  }
  if (!args.has('--compute')) {
    if (args.has('--backfill')) await backfill();
    await daily();
  }
  compute();
  // Bildirim adımı yalnız bu çalışma yeni hesap ürettiyse çalışır (günde bir bildirim).
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, 'computed=true\n');
  log(`TEFAS isteği: ${client.requests}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
