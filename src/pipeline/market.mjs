// Piyasa verisi işi: katalogdaki her seriyi kaynak sırasıyla çeker, CSV'ye ekler, durumu yazar.
//   node src/pipeline/market.mjs            artımlı (son kayıttan örtüşmeyle bugüne)
//   node src/pipeline/market.mjs --backfill  katalogdaki başlangıçtan bugüne eksik geçmiş
//   node src/pipeline/market.mjs --only=usd_try,bist100
// Bir serinin hatası diğerlerini durdurmaz. Anahtarlar ve URL'ler loglanmaz.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MARKET_SERIES, FREQ_RULES, CONSISTENCY_TOL } from '../data/market/catalog.mjs';
import { providers } from '../data/market/providers.mjs';
import { MarketStore, mergeRows, consistent } from '../data/market/store.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const pad = (n) => String(n).padStart(2, '0');
const isoUTC = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const addDays = (iso, n) => isoUTC(new Date(Date.parse(iso) + n * 864e5));
const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);

// Bir seriyi günceller. Kaynaklar sırayla denenir; boş dönen ya da ölçeği tutmayan kaynak atlanır.
export async function updateSeries(spec, oldRows, { today, backfill = false, env = process.env, impl = providers } = {}) {
  const rule = FREQ_RULES[spec.freq];
  const last = oldRows.at(-1)?.date;
  const from = backfill || !last ? spec.start : addDays(last, -rule.overlap_days);
  const attempts = [];
  for (const src of spec.sources) {
    const fn = impl[src.provider];
    if (!fn) { attempts.push({ provider: src.provider, error: 'tanımsız kaynak' }); continue; }
    try {
      const rows = (await fn(src, { from, to: today, freq: spec.freq }, env)).filter((r) => r.date <= today);
      if (!rows.length) { attempts.push({ provider: src.provider, error: 'boş' }); continue; }
      const c = consistent(oldRows, rows, CONSISTENCY_TOL);
      if (!c.ok) { attempts.push({ provider: src.provider, error: `ölçek tutmuyor (oran ${c.ratio.toFixed(3)})` }); continue; }
      const tagged = rows.map((r) => ({ ...r, source: src.provider }));
      return { rows: mergeRows(oldRows, tagged), added: tagged.filter((r) => !last || r.date > last).length, source: src.provider, attempts, from };
    } catch (e) {
      attempts.push({ provider: src.provider, error: String(e.message).slice(0, 120) });
    }
  }
  return { rows: oldRows, added: 0, source: null, attempts, from };
}

export function seriesStatus(spec, rows, result, today) {
  const lastDate = rows.at(-1)?.date || null;
  const age = lastDate ? daysBetween(lastDate, today) : null;
  return {
    label: spec.label, freq: spec.freq, role: spec.role, asset: spec.asset,
    first_date: rows[0]?.date || null, last_date: lastDate, rows: rows.length,
    source: result.source, ok: !!result.source, stale: age === null || age > FREQ_RULES[spec.freq].stale_days, age_days: age,
    errors: result.attempts.map((a) => `${a.provider}: ${a.error}`),
  };
}

async function main() {
  const args = process.argv.slice(2);
  const backfill = args.includes('--backfill');
  const only = args.find((a) => a.startsWith('--only='))?.slice(7).split(',');
  const store = new MarketStore(path.join(ROOT, 'data', 'market'));
  const today = isoUTC(new Date());
  const status = store.status();
  status.series ||= {};
  // Zamanlanmış ikinci ve üçüncü çalışma: bugün tüm seriler başarıyla güncellendiyse çık.
  if (args.includes('--skip-if-done') && status.generated_at?.slice(0, 10) === today && Object.values(status.series).every((s) => s.ok)) {
    console.log('Piyasa verisi bugün güncellendi; atlanıyor.');
    return;
  }
  for (const spec of MARKET_SERIES.filter((s) => !only || only.includes(s.id))) {
    const old = store.load(spec.id);
    const res = await updateSeries(spec, old, { today, backfill });
    if (res.source) store.save(spec.id, res.rows);
    const st = seriesStatus(spec, res.rows, res, today);
    status.series[spec.id] = { ...st, checked_at: new Date().toISOString() };
    console.log(`${res.source ? 'OK  ' : 'FAIL'} ${spec.id.padEnd(18)} ${res.source || '-'} · +${res.added} · ${st.first_date || '-'} → ${st.last_date || '-'} · ${st.rows} satır${st.stale ? ' · BAYAT' : ''}${st.errors.length ? ` · ${st.errors.join(' | ')}` : ''}`);
  }
  status.generated_at = new Date().toISOString();
  store.saveStatus(status);
  const vals = Object.values(status.series);
  console.log(`Piyasa verisi: ${vals.filter((s) => s.ok).length}/${vals.length} seri güncel kaynaktan, ${vals.filter((s) => s.stale).length} bayat.`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main();
