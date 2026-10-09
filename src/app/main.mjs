// maliSK telefon arayüzü (Cüzdan tasarımı). Veri: data/latest.json; kişisel durum: localStorage + IndexedDB kopyası.
import { DEFAULT_PARAMS, PARAM_META, PARAM_GROUPS, CLASS_LABELS, CATEGORY_LABELS, GROUP_LABELS, PEER_LABELS } from '../model/params.mjs';
import { effectiveParams, validateParams, paramVersion, getPath } from '../model/paramedit.mjs';
import { alertThreshold } from '../model/bands.mjs';
import { tilt } from '../model/tactical.mjs';
import { normalizeAnchor, classAnchor, managedClasses } from '../model/tree.mjs';
import { backtest } from '../model/backtest.mjs';
import { loadState, saveState, exportState, importState } from './state.mjs';
import { compute, dailyNotice } from './engine.mjs';
import { currentExposure, migrateState, ANCHOR_CLASSES, fundIndex, peerOf } from './personal.mjs';
import { parseAllocationTable } from './importer.mjs';
import { buildPrompt, buildFundPrompt } from './claude.mjs';
import { idbSet } from './idb.mjs';
import { num, pct, signed, esc, dateTr, moneyTl, people, fundNames, FLAG_LABELS, todayIstanbul } from './format.mjs';

const TREE = DEFAULT_PARAMS.anchor.tree;
const REPO_SECRETS = 'https://github.com/seyfettinkarakaya/maliSK/settings/secrets/actions/new';
const CV = { gold: '--gold', silver: '--silver', tl_fixed: '--tl', equity_tr: '--eq', equity_foreign: '--yd', fx_fixed: '--fx', unclassified: '--unc' };
const GV = { precious_metals: '--gold', equity: '--eq', tl_fixed: '--tl', fx: '--fx' };
const CARD_BG = ['--card-a', '--card-b', '--card-c', '--card-d'];
const CATEGORY_ORDER = ['gold', 'precious_metals', 'silver', 'equity', 'mixed', 'money_market', 'lease_tl', 'fx', 'standard', 'starter', 'state_contribution', 'receivables', 'unclassified'];
const KIND = { gold: 'gold', precious_metals: 'gold', silver: 'silver', equity: 'equity', money_market: 'tl', lease_tl: 'tl', starter: 'tl', standard: 'tl', state_contribution: 'tl', receivables: 'tl', fx: 'fx' };
const KIND_VAR = { gold: '--gold', silver: '--silver', equity: '--eq', tl: '--tl', fx: '--fx', mixed: '--mint' };
const VIEW = { positive: ['↑ Olumlu', 'pos'], neutral: ['→ Nötr', 'mut'], negative: ['↓ Olumsuz', 'neg'] };
const PERIOD_LABELS = { '1m': '1 ay', '3m': '3 ay', '6m': '6 ay', ytd: 'Yılbaşı', '1y': '1 yıl', '3y': '3 yıl', '5y': '5 yıl' };
const DAYS_TR = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
const MONTHS_TR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

const I = {
  home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  cards: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 10h18"/>',
  list: '<path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/>',
  chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  back: '<path d="m15 18-6-6 6-6"/>', right: '<path d="m9 18 6-6-6-6"/>', chev2: '<path d="m7 6 6 6-6 6"/><path d="m13 6 6 6-6 6"/>',
  check: '<path d="m5 12 5 5 9-10"/>',
  gold: '<path d="M3 19h18l-3.5-8h-11z"/><path d="M8 11l1.5-5h5L16 11"/>', silver: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/>',
  equity: '<path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 6-7"/>', tl: '<path d="M9 3v14a4 4 0 0 0 8-1"/><path d="m5 10 10-4"/><path d="m5 14 10-4"/>',
  fx: '<path d="M12 2v20"/><path d="M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>', mixed: '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>',
};
const svg = (n, s = 24, w = 2.2) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[n]}</svg>`;
const chev = () => `<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I.right}</svg>`;
const cvar = (c) => `var(${CV[c] || '--unc'})`;
const gvar = (g) => `var(${GV[g]})`;

let state = loadState();
let latest = null;
let loadError = null;
const ui = { tab: 'ozet', stack: [], range: 'all', frange: 'all', seg: 'total', category: null, sheet: null, toast: null, chat: [], paste: '', parsed: null, pasteShares: null, shareDraft: null, anchorDraft: null, paramDraft: null, confirmDelete: null };
const root = document.getElementById('app');
const page = () => ui.stack[ui.stack.length - 1] || null;

// ---------- Durum ----------
function mirror() {
  idbSet('state', JSON.parse(JSON.stringify({ ...state, push: null }))).catch(() => {});
}

function persist() {
  if (!saveState(state)) showToast('Telefon hafızasına yazılamadı. Yedeği kopyalamayı unutma.');
  mirror();
}

function applyPrefs() {
  const html = document.documentElement;
  const { size, theme } = state.prefs;
  if (size === 'l') delete html.dataset.size; else html.dataset.size = size;
  if (theme === 'auto') delete html.dataset.theme; else html.dataset.theme = theme;
  const dark = theme === 'dark' || (theme === 'auto' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  document.querySelectorAll('meta[name="theme-color"]').forEach((el) => el.setAttribute('content', theme === 'auto' ? (el.media.includes('dark') ? '#000000' : '#F2F2F7') : dark ? '#000000' : '#F2F2F7'));
}

function showToast(text) {
  ui.toast = text;
  render();
  setTimeout(() => { if (ui.toast === text) { ui.toast = null; render(); } }, 3000);
}

async function copyText(text, okMsg) {
  try {
    await navigator.clipboard.writeText(text);
    showToast(okMsg);
  } catch {
    ui.sheet = { title: 'Metni kopyala', html: `<p>Otomatik kopyalanamadı. Metni seçip kopyala.</p><textarea class="paste" style="margin:0;width:100%" readonly>${esc(text)}</textarea>` };
    render();
  }
}

function go(p) { ui.stack.push(p); window.scrollTo(0, 0); }

// ---------- Yardımcılar ----------
function todayLong() {
  const d = new Date(todayIstanbul() + 'T12:00:00Z');
  return `${DAYS_TR[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTHS_TR[d.getUTCMonth()]}`;
}

function strip(parts, cls = 'strip') {
  return `<div class="${cls}">${parts.filter(([p]) => p > 0.05).map(([p, c]) => `<i style="width:${p}%;background:${c}"></i>`).join('')}</div>`;
}

function exposureParts(expo) {
  return [...ANCHOR_CLASSES, 'unclassified'].map((c) => [expo[c] || 0, cvar(c)]);
}

function groupParts(values) {
  const parts = TREE.map((g) => [values[g.id] || 0, gvar(g.id)]);
  if (values.rest) parts.push([values.rest, 'var(--unc)']);
  return parts;
}

function area(points, color, w = 358, h = 150, band = null) {
  if (points.length < 2) return '';
  let lo = Math.min(...points);
  let hi = Math.max(...points);
  if (band) { lo = Math.min(lo, band.low); hi = Math.max(hi, band.high); }
  if (hi - lo < 1e-9) { hi += 1; lo -= 1; }
  const pad = (hi - lo) * 0.08;
  lo -= pad; hi += pad;
  const y = (v) => h - 6 - ((v - lo) / (hi - lo)) * (h - 18);
  const xy = points.map((v, i) => [(i / (points.length - 1)) * (w - 8), y(v)]);
  let d = `M${xy[0][0].toFixed(1)},${xy[0][1].toFixed(1)}`;
  for (let i = 1; i < xy.length; i++) {
    const [x0, y0] = xy[i - 1];
    const [x1, y1] = xy[i];
    const cx = (x0 + x1) / 2;
    d += ` C${cx.toFixed(1)},${y0.toFixed(1)} ${cx.toFixed(1)},${y1.toFixed(1)} ${x1.toFixed(1)},${y1.toFixed(1)}`;
  }
  const L = xy[xy.length - 1];
  const id = 'g' + Math.random().toString(36).slice(2, 8);
  const bandSvg = band ? `<rect x="0" y="${y(band.high).toFixed(1)}" width="${w}" height="${(y(band.low) - y(band.high)).toFixed(1)}" rx="6" style="fill:var(--tx);opacity:.09"/>
    <line x1="0" x2="${w}" y1="${y(band.target).toFixed(1)}" y2="${y(band.target).toFixed(1)}" style="stroke:var(--tx)" stroke-width="2" stroke-dasharray="6 6" opacity=".85"/>` : '';
  return `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Grafik"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:${color};stop-opacity:.4"/><stop offset="1" style="stop-color:${color};stop-opacity:0"/></linearGradient></defs>
    ${bandSvg}<path d="${d} L${L[0].toFixed(1)},${h} L0,${h} Z" fill="url(#${id})"/><path d="${d}" fill="none" style="stroke:${color}" stroke-width="3.5" stroke-linecap="round"/>
    <circle cx="${L[0].toFixed(1)}" cy="${L[1].toFixed(1)}" r="6.5" style="fill:${color};stroke:var(--bg)" stroke-width="3"/></svg>`;
}

function rangeSlice(arr, r) {
  const n = { m1: 22, m3: 64, all: arr.length }[r] || arr.length;
  return arr.slice(Math.max(0, arr.length - n));
}

function ranges(key, cur) {
  return `<div class="ranges">${[['m1', '1A'], ['m3', '3A'], ['all', 'Tümü']].map(([k, l]) => `<button data-act="range" data-key="${key}" data-v="${k}" class="${cur === k ? 'on' : ''}">${l}</button>`).join('')}</div>`;
}

function groupStatus(m, g) {
  const b = m.bands?.groups[g];
  if (!b) return { text: 'izleniyor', cls: 'mut' };
  const C = m.P.decision.confirm_days;
  const n = m.bands.counters['group:' + g] || 0;
  const sp = m.bands.splits[g];
  const spOut = sp && Object.values(sp).some((x) => x.status !== 'inside');
  const ns = m.bands.counters['split:' + g] || 0;
  if (b.status !== 'inside') {
    const d = Math.abs(b.value - b.target);
    const now = m.due?.due.includes('group:' + g);
    return now || n >= C ? { text: `${num(d, 1)} ${b.status === 'above' ? 'fazla' : 'eksik'}`, cls: 'neg' } : { text: `sarı · öneriye ${C - n} gün`, cls: 'warnc' };
  }
  if (spOut) return ns >= C || m.due?.due.includes('split:' + g) ? { text: 'grup içi pay dışı', cls: 'neg' } : { text: `grup içi pay · öneriye ${C - ns} gün`, cls: 'warnc' };
  return { text: 'dengede', cls: 'pos' };
}

function trendSentence(cls) {
  const sig = latest.classes[cls]?.trend?.signals || {};
  const ref = cls === 'tl_fixed' ? 'enflasyonun' : 'para piyasasının';
  const per = [['r1m', '1'], ['r3m', '3'], ['r12m', '12']];
  const join = (a) => (a.length > 1 ? `${a.slice(0, -1).join(', ')} ve ${a[a.length - 1]}` : a[0]);
  const up = per.filter(([k]) => sig[k] === 1).map(([, l]) => l);
  const dn = per.filter(([k]) => sig[k] === -1).map(([, l]) => l);
  const parts = [];
  if (up.length) parts.push(`Son ${join(up)} ayda ${ref} önünde.`);
  if (dn.length) parts.push(`Son ${join(dn)} ayda ${ref} gerisinde.`);
  if (sig.ma === 1) parts.push('Fiyat 210 günlük ortalamasının üstünde.');
  if (sig.ma === -1) parts.push('Fiyat 210 günlük ortalamasının altında.');
  return parts.join(' ') || 'Trend sinyali yok.';
}

const grade = (v) => (v === null || v === undefined ? ['—', 'mut'] : v >= 0.65 ? ['Çok iyi', 'pos'] : v >= 0.55 ? ['İyi', 'pos'] : v >= 0.45 ? ['Orta', 'warnc'] : ['Zayıf', 'neg']);

// Akran grubunun adı: aile ise aile adı, değilse kategori adı.
const peerName = (f) => PEER_LABELS[peerOf(f)] || CATEGORY_LABELS[f.category] || '';

function fundReason(f, P) {
  if (f.score === null) return f.flags.includes('yeni_fon') ? 'Yeni fon · henüz puanı yok' : 'Puanı hesaplanamadı';
  const c = f.components || {};
  const passive = P.universe.passive_categories.includes(f.category);
  const good = { consistency: 'Her dönemde istikrarlı', excess_index: passive ? 'Kıyasından iyi getiri' : 'İçeriğine göre iyi getiri', risk: passive ? 'Kıyasını yakından izliyor' : 'Düşüşlerde dayanıklı', cost: 'Düşük ücret' };
  const bad = { consistency: 'Çoğu dönemde ortalamanın gerisinde', excess_index: 'Kıyasının gerisinde kalıyor', risk: passive ? 'Kıyasından sapıyor' : 'Düşüşleri derin', cost: 'Ücreti yüksek' };
  const keys = Object.keys(good).filter((k) => c[k] !== null && c[k] !== undefined);
  if (!keys.length) return 'Ortalama';
  if (f.score >= 55) return good[keys.reduce((a, b) => (c[b] > c[a] ? b : a))];
  if (f.score < 45) return bad[keys.reduce((a, b) => (c[b] < c[a] ? b : a))];
  return 'Ortalama';
}

function back(label) {
  return `<div class="bar"><button class="back" data-act="back">${svg('back', 26, 2.6)}${esc(label)}</button></div>`;
}

function backLabel() {
  const prev = ui.stack[ui.stack.length - 2];
  if (prev) return { dagilim: 'Dağılım', dengele: 'Dengele', fonsinyal: 'Fonlarım', grup: GROUP_LABELS[prev.id] || 'Geri', fon: prev.code, sozlesme: `Sözleşme ${prev.id}`, capa: 'Çapa', ayarlar: 'Ayarlar', yapistir: 'Yapıştır' }[prev.kind] || 'Geri';
  return { ozet: 'Özet', sozlesmeler: 'Sözleşmeler', fonlar: 'Fonlar', sor: 'Sor' }[ui.tab];
}

const title = (t, sub = '') => `<div class="title"><h1>${t}</h1>${sub ? `<p>${sub}</p>` : ''}</div>`;
const noData = () => `<button class="banner" data-act="go" data-kind="yapistir"><span class="app-i">m</span><span><b>Başlamak için</b><span>Sözleşmelerinin dağılımını tablodan kopyalayıp yapıştır.</span></span>${chev()}</button>`;
const worstGroup = (m) => Object.entries(m.bands.groups).sort((a, b) => Math.abs(b[1].value - b[1].target) - Math.abs(a[1].value - a[1].target))[0];

// ---------- Açıklama sayfaları ----------
function sheetTable(rows, sumRow) {
  return `<table>${rows.map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join('')}${sumRow ? `<tr class="sum"><td>${sumRow[0]}</td><td>${sumRow[1]}</td></tr>` : ''}</table>`;
}

function explain(key, m) {
  const [kind, id] = key.split(':');
  const funds = fundIndex(m.latest);
  const P = m.P;
  const t = P.tactical;
  const foot = `<p class="mut" style="font-size:.85rem">Parametre sürümü ${m.param_version} · veri ${dateTr(m.data_date)}</p>`;
  if (kind === 'target') {
    const g = m.targets.groups[id];
    return {
      title: `${GROUP_LABELS[id]} hedefi`,
      html: `<div class="formula">S (sınıf) = ${t.weights.trend} × T + ${t.weights.macro} × M + ${t.weights.user} × K<br>S (grup) = Σ grup içi pay × S<br>eğim = ${t.max_tilt_pts} × S / ${num(t.full_tilt_at, 2)} (en çok ±${t.max_tilt_pts})<br>hedef = (çapa + eğim) × 100 / Σ × (100 − izlenen) / 100</div>`
        + sheetTable([...g.classes.map((c) => [`${CLASS_LABELS[c]} S × pay`, `${signed(m.targets.rows[c].S, 2)} × %${num(g.splits[c], 0)}`]),
          ['S (grup)', signed(g.S, 2)], ['Eğim', signed(g.tilt, 2) + ' puan'], ['Çapa', num(g.anchor, 1)], ['Tüm grupların toplamı', num(m.targets.raw_sum, 2)],
          ['İzlenen sınıfların payı', num(m.targets.unmanaged_share, 2)]], ['Hedef', num(g.target, 2)]) + foot,
    };
  }
  if (kind === 'band') {
    const b = m.bands.groups[id];
    const d = P.decision;
    return {
      title: `${GROUP_LABELS[id]} aralığı`,
      html: `<div class="formula">sarı: sapma ≥ hedef × %${d.yellow_rel_pct}<br>kırmızı: sapma ≥ hedef × %${d.red_rel_pct} → beklemeden öneri</div>`
        + sheetTable([['Hedef', num(b.target, 2)], ['Sarı eşik', '±' + num(b.width, 2)], ['Normal aralık', `${num(b.low, 2)} – ${num(b.high, 2)}`], ['Kırmızı eşik', '±' + num(b.red, 2)], ['Şu an', `${num(b.value, 2)}${b.level ? ` · ${b.level === 'red' ? 'kırmızı' : 'sarı'}` : ''}`],
          ['Aralık dışında', `${m.bands.counters['group:' + id] || 0} iş günü (öneri ${d.confirm_days} günde)`]])
        + managedClasses(TREE, m.targets.anchor, id).map((c) => `<button class="btn" data-act="explain" data-key="expo:${c}">${CLASS_LABELS[c]} payı nasıl hesaplandı?</button>`).join('') + foot,
    };
  }
  if (kind === 'split') {
    const sp = m.bands.splits[id];
    const d = P.decision;
    return {
      title: `${GROUP_LABELS[id]} grup içi pay`,
      html: `<div class="formula">grup içi pay = sınıf payı / grup payı × 100<br>aralık = hedef pay ± ${d.split_band_pts} puan; grup %${d.split_min_group_pct}'ten küçükse denetlenmez</div>`
        + sheetTable(Object.entries(sp).map(([c, x]) => [CLASS_LABELS[c], `${num(x.value, 1)} · hedef ${num(x.target, 0)} · ${num(x.low, 0)}–${num(x.high, 0)}${x.skipped ? ' · denetlenmiyor' : ''}`])) + foot,
    };
  }
  if (kind === 'expo') {
    const rows = Object.entries(m.drift.current).map(([code, w]) => [`${esc(code)}: %${num(w, 1)} × %${num(funds[code]?.exposure?.[id] ?? 0, 1)}`, (w * (funds[code]?.exposure?.[id] ?? 0)) / 100]).filter((r) => r[1] > 0.005);
    return { title: `${CLASS_LABELS[id]} payı`, html: '<div class="formula">pay = Σ fon ağırlığı × fonun bu sınıftaki içerik payı<br>fon ağırlığı = sözleşmelerin toplamı, fiyatla kaydırılmış</div>' + sheetTable(rows.map(([a, b]) => [a, num(b, 2)]), ['Toplam', num(m.bands.exposure[id], 2)]) + foot };
  }
  if (kind === 'distance') {
    const rows = Object.entries(m.bands.groups).map(([g, b]) => [GROUP_LABELS[g], `${num(b.value, 1)} − ${num(b.target, 1)} → ${b.value > b.target ? num(b.value - b.target, 1) : '0'}`]);
    return { title: 'Hedefe uzaklık', html: '<div class="formula">uzaklık = Σ max(0, grup payı − grup hedefi)</div>' + sheetTable(rows, ['Toplam', num(m.bands.distance, 1) + ' puan']) + '<p class="mut">Dengelemek için toplam birikimin yaklaşık bu kadar puanını başka fonlara taşıman gerekir.</p>' + foot };
  }
  if (kind === 'view') {
    const r = m.targets.rows[id];
    const info = m.latest.classes[id] || {};
    const sig = info.trend?.signals || {};
    const sl = (k) => (sig[k] === 1 ? '+1' : sig[k] === -1 ? '−1' : 'yok');
    return {
      title: `${CLASS_LABELS[id]} görüşü`,
      html: `<p>${esc(trendSentence(id))}</p><div class="formula">T = dört sinyalin ortalaması<br>S = ${t.weights.trend} × T + ${t.weights.macro} × M + ${t.weights.user} × K<br>S ≥ ${num(t.positive_threshold, 2)} Olumlu · S ≤ ${num(t.negative_threshold, 2)} Olumsuz</div>`
        + sheetTable([['1 ay', sl('r1m')], ['3 ay', sl('r3m')], ['12 ay', sl('r12m')], ['210 gün ortalama', sl('ma')], ['T', signed(r.T, 2)], ['M (makro)', signed(r.M, 0)], ['K (senin görüşün)', signed(r.K, 0)]], ['S', signed(r.S, 2)]) + foot,
    };
  }
  if (kind === 'ret') {
    const s = m.drift.series;
    return { title: 'Toplam getiri', html: '<div class="formula">getiri = Σ sözleşme payı × (bugünkü değer / başlangıç değeri) − 1<br>sözleşme değeri = Σ giriş ağırlığı × fiyat oranı</div>' + sheetTable([['Başlangıç', dateTr(m.drift.start_date)], ['Bugün', dateTr(s[s.length - 1].date)]], ['Toplam', pct(m.drift.return_pct, 2, true)]) + '<p class="mut">Katkı payları ve fon giriş-çıkışları hesaba katılmaz; yalnız fiyat değişimi.</p>' + foot };
  }
  if (kind === 'score') {
    const f = funds[id];
    const w = P.fund_quality.weights;
    const c = f.components || {};
    const passive = P.universe.passive_categories.includes(f.category);
    const names = { consistency: 'İstikrar', excess_index: 'Fazla getiri', risk: passive ? 'İzleme hatası' : 'Düşüş riski', cost: 'Ücret', hygiene: 'Düzen' };
    return {
      title: `${esc(f.code)} puanı`,
      html: '<div class="formula">puan = 100 × Σ ağırlık × bileşen / Σ ağırlık<br>bileşen = 0,5 + (değer − akran grubu medyanı) / (2 × ölçek)<br>puan = 50 + güven × (ham − 50)</div>'
        + sheetTable([...Object.keys(w).map((k) => [names[k], c[k] === null || c[k] === undefined ? 'veri yok' : `${num(w[k], 2)} × ${num(c[k], 3)}`]), ['Akran grubu', `${esc(peerName(f))} · ${f.peers_all} fon`], ...(m.latest.founders_on ? [['Sıra: tüm BES / seçtiğin firmalar', `${f.rank_all ?? '—'}. / ${f.rank ? `${f.peers} fonda ${f.rank}.` : 'dışarıda'}`]] : []), ['Ham puan', num(f.raw_score, 1)], ['Güven (geçmiş / 36 ay)', `${num(f.history_months, 0)} ay → %${num((f.confidence ?? 1) * 100, 0)}`]], ['Puan', num(f.score, 1)]) + foot,
    };
  }
  if (kind === 'alert') {
    const a = m.latest.classes[id];
    return { title: `${CLASS_LABELS[id]} acil uyarı`, html: `<div class="formula">eşik = ${num(P.decision.alert_sigma_mult, 2)} × yıllık oynaklık × √(${P.decision.alert_window_days} / 252)</div>` + sheetTable([['Son 20 iş günü', pct(a.alert.change_pct, 2)], ['Yıllık oynaklık', pct(a.vol_annual_pct, 1)], ['Eşik', '−' + pct(alertThreshold(a.vol_annual_pct, P.decision), 2)]]) + foot };
  }
  if (kind === 'anchor') {
    const a = m.latest.anchor;
    const u = a.user_groups;
    const missing = ANCHOR_CLASSES.filter((c) => c !== 'tl_fixed' && !a.ids.includes(c)).map((c) => CLASS_LABELS[c]);
    return {
      title: 'Çapa önerisi nasıl hesaplandı?',
      html: `<div class="formula">1. Son ${a.weeks} haftanın getirilerinden risk ve ilişki<br>2. Önce grup içinde, sonra gruplar arasında eşit risk<br>3. k = min(1, %${P.anchor.target_vol_pct} / riskli oynaklık); kalan TL sabit<br>4. Sınıf tavanı %${P.anchor.class_cap_pct}</div>`
        + sheetTable([['Riskli sepet oynaklığı', pct(u.risky_vol_pct, 1)], ['Riskli pay (k)', pct(u.k * 100, 0)], ...Object.entries(u.weights).map(([c, w]) => [CLASS_LABELS[c], num(w, 1)])])
        + (missing.length ? `<p class="mut">Yeterli verisi olmayan sınıflar öneride yok: ${missing.join(', ')}.</p>` : '') + foot,
    };
  }
  if (kind === 'backtest') {
    return { title: 'Geri test', html: '<div class="formula">Son 60 ayın ay sonu sınıf endeksleri; her ay çapaya dönülür. Verisi olmayan sınıfın ağırlığı diğerlerine dağılır. TÜFE verisi gelene kadar getiriler nominal (enflasyon dahil).</div><p>En büyük düşüş: zirveden dibe en derin kayıp. En kötü 12 ay: art arda 12 ayın en düşük toplam getirisi.</p>' + foot };
  }
  if (kind === 'proposal') {
    const p = m.proposal;
    return {
      title: 'Öneri nasıl hesaplandı?',
      html: `<div class="formula">en küçük Σ (sınıf payı − hedef)² + ${P.allocation.fee_lambda} × Σ ağırlık × ücret<br>ağırlıklar ≥ 0, toplam 100; yeni fon en çok %${P.fund_quality.new_fund_cap_pct}</div><p>Toplam dağılım üzerinden tek bir dağılım hesaplanır ve tüm sözleşmelere aynı oranlarla uygulanır. Ana sınıfı aralık içinde olan fonlar sabit tutulur; aynı kategorideki fon ancak puanı ${P.decision.switch_score_gap} puan yüksekse aday olur.</p>`
        + (p.notes.length ? sheetTable(p.notes.map((n) => [esc(n.code), esc(n.kind === 'sabit' ? 'sabit: ' + n.text : 'aday değil: ' + n.text)])) : '') + foot,
    };
  }
  return { title: '', html: '' };
}

// ---------- Özet ----------
function walletCards(m, overlap = true) {
  const list = state.contracts;
  const html = list.map((c, i) => {
    const d = m.drift?.contracts?.[c.no];
    const expo = d ? currentExposure(m.latest, d.current) : {};
    const share = m.drift?.shares_now?.[c.no];
    const top = overlap ? `top:${i * 5.2}rem;` : '';
    return `<button class="card" style="${top}background:var(${CARD_BG[i % CARD_BG.length]})" data-act="go" data-kind="sozlesme" data-id="${esc(c.no)}">
      <div class="top"><div><div class="nm">Sözleşme ${esc(c.no)}</div><div class="ds">${Object.keys(c.weights).length} fon · ${dateTr(c.date)}</div></div>
      <div class="sh"><small>TOPLAMIN</small><b>%${num(share ?? 0, 0)}</b></div></div>${strip(exposureParts(expo))}</button>`;
  }).join('');
  if (!overlap) return `<div class="cards">${html}</div>`;
  return `<div class="wallet" style="height:${(list.length - 1) * 5.2 + 10.5}rem">${html}</div>`;
}

function viewOzet(m) {
  const parts = [`<div class="bar"><span class="date">${todayLong()}</span><button class="iconbtn" data-act="go" data-kind="ayarlar" aria-label="Ayarlar">${svg('user', 22)}</button></div>`];
  if (!state.contracts.length) parts.push(noData());
  else if (m.rec?.active) {
    const n = dailyNotice(m, GROUP_LABELS, CLASS_LABELS);
    parts.push(`<button class="banner" data-act="go" data-kind="dengele"><span class="app-i${m.rec.switches.some((x) => x.risk) ? ' warn' : ''}">m</span><span><b>${esc(n.title)}</b><span>${esc(n.body)}</span></span>${chev()}</button>`);
  } else if (m.due?.suppressed) {
    parts.push(`<div class="banner"><span class="app-i ok">${svg('check', 20, 2.6)}</span><span><b>Öneri ertelendi</b><span>“Şimdi değil” dedin; ${m.P.decision.snooze_days} iş günü yeni öneri gelmez. Riskli fon uyarıları gelmeye devam eder.</span></span></div>`);
  } else if (m.bands) {
    const n = dailyNotice(m, GROUP_LABELS, CLASS_LABELS);
    parts.push(`<button class="banner" data-act="go" data-kind="dagilim"><span class="app-i ok">${svg('check', 20, 2.6)}</span><span><b>${m.due.pending.length || m.funds?.weak.length ? 'Takipte' : 'Bugün yapılacak bir şey yok'}</b><span>${esc(n.body)}</span></span>${chev()}</button>`);
  }
  for (const r of m.funds?.risks || []) {
    parts.push(`<button class="banner" data-act="go" data-kind="fon" data-code="${esc(r.code)}"><span class="app-i warn">!</span><span><b>${esc(r.code)}: ${esc(r.text)}</b><span>${r.kind === 'helal' ? 'Fondan çıkmayı düşün; öneri Dengele ekranında.' : 'Fonu incele.'}</span></span>${chev()}</button>`);
  }
  for (const [c, v] of Object.entries(m.latest.classes).filter(([, x]) => x.alert?.triggered)) {
    parts.push(`<button class="banner" data-act="explain" data-key="alert:${c}"><span class="app-i warn">!</span><span><b>Acil uyarı: ${CLASS_LABELS[c]}</b><span>20 iş gününde ${pct(v.alert.change_pct, 1)}. İnceleme çağrısı, öneri değil.</span></span></button>`);
  }
  if (m.bands) {
    const d = m.due;
    const C = m.P.decision.confirm_days;
    const pend = d.pending.slice().sort((a, b) => a.left - b.left)[0];
    const [ak, ag] = pend ? pend.key.split(':') : [];
    const alloc = d.due.length ? [`Öneri hazır${d.immediate.length ? ' · büyük sapma' : ''}`, 'neg'] : pend ? [`${GROUP_LABELS[ag]}${ak === 'split' ? ' grup içi' : ''} · öneriye ${pend.left} gün`, 'warnc'] : ['Dengede', 'pos'];
    const fs = m.funds;
    const fund = fs.switches.length ? [`${fs.switches.length} fon değişikliği`, 'neg'] : fs.weak.length ? [`${fs.weak.length} fon ilk ${m.P.decision.fund_top_n}’te değil`, 'warnc'] : [fs.good.length ? `Hepsi ilk ${m.P.decision.fund_top_n}’te` : 'puanlı fon yok', fs.good.length ? 'pos' : 'mut'];
    parts.push(`<div class="label">Sinyaller</div><div class="group">
      <button class="row" data-act="go" data-kind="${d.due.length || pend ? 'dengele' : 'dagilim'}"><span class="l"><b>Dağılım</b><small>aralık dışı ${d.due.length + d.pending.length} grup · teyit ${C} iş günü</small></span><span class="r"><span class="num ${alloc[1]}" style="font-size:1rem">${alloc[0]}</span>${chev()}</span></button>
      <button class="row" data-act="go" data-kind="fonsinyal"><span class="l"><b>Fonlar</b><small>akran grubunda sıra · tüm BES</small></span><span class="r"><span class="num ${fund[1]}" style="font-size:1rem">${fund[0]}</span>${chev()}</span></button></div>`);
  }
  if (m.drift) {
    const vals = rangeSlice(m.drift.series.map((p) => p.value), ui.range);
    const r = (vals[vals.length - 1] / vals[0] - 1) * 100;
    const since = ui.range === 'all' ? `${dateTr(m.drift.start_date)}'den beri` : ui.range === 'm1' ? 'son 1 ay' : 'son 3 ay';
    parts.push(`<button class="hero" data-act="explain" data-key="ret"><div class="k">Toplam birikimin</div><div class="v"><strong class="${r < 0 ? 'neg' : 'pos'}">${pct(r, 1, true)}</strong><span>${since}</span></div></button>`);
    parts.push(`<div class="chart">${area(vals, r < 0 ? 'var(--red)' : 'var(--green)')}</div>${ranges('range', ui.range)}`);
  }
  if (m.bands) {
    const now = Object.fromEntries(TREE.map((g) => [g.id, m.bands.group_exposure[g.id] || 0]));
    now.rest = Math.max(0, 100 - Object.values(now).reduce((a, b) => a + b, 0));
    parts.push(`<div class="sec"><h2>Dağılım</h2><button class="link" data-act="go" data-kind="dagilim">Ayrıntı ›</button></div>
      <div class="strips"><div class="strip-row"><span>Şu an</span>${strip(groupParts(now))}</div><div class="strip-row"><span>Hedef</span>${strip(groupParts(m.targets.group_targets))}</div></div>
      <div class="legend">${TREE.map((g) => `<span><i style="background:${gvar(g.id)}"></i>${GROUP_LABELS[g.id]}</span>`).join('')}<span><i style="background:var(--unc)"></i>İzlenen</span></div>`);
  }
  if (state.contracts.length) parts.push(`<div class="sec"><h2>Sözleşmelerim</h2><button class="link" data-act="go" data-kind="yapistir">+ Yapıştır</button></div>${walletCards(m)}`);
  if (m.targets) {
    const rows = ANCHOR_CLASSES.filter((c) => m.latest.classes[c]).map((c) => {
      const ok = m.latest.classes[c].series_ok;
      const [lbl, cls] = ok ? VIEW[m.targets.rows[c].label] : ['veri az', 'mut'];
      return `<button class="row" data-act="explain" data-key="view:${c}"><span class="l"><b><span class="dot" style="--c:${cvar(c)}"></span>${CLASS_LABELS[c]}</b></span><span class="r"><span class="num ${cls}" style="font-size:1rem">${lbl}</span></span></button>`;
    }).join('');
    parts.push(`<div class="label">Piyasa görüşü</div><div class="group">${rows}</div>`);
  }
  parts.push(`<p class="note center" style="padding-top:1rem">Veri ${dateTr(m.data_date)} · ${m.latest.sources.tefas.halal} helal fon · model ${esc(m.latest.model_version)} · parametre ${m.param_version}</p>`);
  return parts.join('');
}

// ---------- Dağılım ----------
function viewDagilim(m) {
  const parts = [back(backLabel()), title('Dağılım', `Fon içeriklerine göre · ${dateTr(m.data_date)}`)];
  if (!m.bands) return parts.join('') + noData();
  if (state.contracts.length > 1) parts.push(`<div class="seg">${[['total', 'Toplam'], ...state.contracts.map((c) => [c.no, c.no])].map(([k, l]) => `<button data-act="seg" data-v="${esc(k)}" class="${ui.seg === k ? 'on' : ''}">${esc(l)}</button>`).join('')}</div>`);
  const single = ui.seg !== 'total' && m.drift.contracts[ui.seg];
  const expo = single ? currentExposure(m.latest, m.drift.contracts[ui.seg].current) : m.bands.exposure;
  if (!single) {
    const over = Object.entries(m.bands.groups).filter(([, b]) => b.value > b.target).sort((a, b) => (b[1].value - b[1].target) - (a[1].value - a[1].target))[0];
    parts.push(`<button class="hero" data-act="explain" data-key="distance"><div class="k">Hedefe uzaklık</div><div class="v"><strong>${num(m.bands.distance, 0)}</strong><span>puan${over ? ` · en çok ${GROUP_LABELS[over[0]].toLocaleLowerCase('tr-TR')}` : ''}</span></div></button>`);
  } else {
    parts.push(`<p class="note" style="padding-top:1rem">Sözleşme ${esc(ui.seg)} tek başına. Hedef toplam birikime göre konur; bu sözleşmenin farklı olması sorun değil.</p>`);
  }
  const rows = [];
  for (const g of TREE) {
    const tg = m.targets.groups[g.id];
    if (!tg) continue;
    const gx = tg.classes.reduce((s, c) => s + (expo[c] || 0), 0);
    const st = single ? { text: '', cls: '' } : groupStatus(m, g.id);
    rows.push(`<button class="row" data-act="go" data-kind="grup" data-id="${g.id}"><span class="l" style="flex:1"><b><span class="dot" style="--c:${gvar(g.id)}"></span>${GROUP_LABELS[g.id]}</b>
      <small>hedef %${num(tg.target, 0)}${single ? '' : ` · aralık ${num(m.bands.groups[g.id].low, 0)}–${num(m.bands.groups[g.id].high, 0)}`}</small>
      <span class="track" style="--c:${gvar(g.id)}"><i style="width:${Math.min(100, gx * 1.4)}%"></i><b style="left:${Math.min(100, tg.target * 1.4)}%"></b></span></span>
      <span class="r" style="flex-direction:column;align-items:flex-end"><span class="num" style="font-size:1.35rem">%${num(gx, 1)}</span><small class="${st.cls}">${st.text}</small></span></button>`);
    if (tg.classes.length > 1) {
      for (const c of tg.classes) {
        const x = !single && m.bands.splits[g.id]?.[c];
        const out = x && x.status !== 'inside';
        rows.push(`<div class="row sub"><span class="l"><b><span class="dot" style="--c:${cvar(c)}"></span>${CLASS_LABELS[c]}</b><small>${x ? `grup içinde %${num(x.value, 0)} · hedef %${num(x.target, 0)}` : `hedef pay %${num(tg.splits[c], 0)}`}</small></span><span class="r" style="flex-direction:column;align-items:flex-end"><span class="num">%${num(expo[c] || 0, 1)}</span>${out ? `<small class="neg">${x.status === 'above' ? 'fazla' : 'az'}</small>` : ''}</span></div>`);
      }
    }
  }
  for (const c of [...m.targets.unmanaged, 'unclassified']) {
    if ((expo[c] || 0) < 0.05) continue;
    rows.push(`<div class="row"><span class="l"><b><span class="dot" style="--c:${cvar(c)}"></span>${CLASS_LABELS[c]}</b><small>hedefi yok</small></span><span class="r" style="flex-direction:column;align-items:flex-end"><span class="num">%${num(expo[c], 1)}</span><small class="mut">izleniyor</small></span></div>`);
  }
  parts.push(`<div class="label">Gruplar</div><div class="group">${rows.join('')}</div>`);
  if (!single) {
    const w = worstGroup(m);
    if (w) {
      const [g, b] = w;
      const h = m.bands.history.map((d) => d.group_exposure[g] ?? 0);
      parts.push(`<div class="label">${GROUP_LABELS[g]} · dağılım tarihinden beri</div><div class="group" style="padding:.8rem 0 .6rem"><div class="chart" style="padding:0 .4rem">${area(h, gvar(g), 358, 160, b)}</div>
        <p class="note" style="padding:.4rem .95rem 0">Açık bant izin verilen aralık, kesikli çizgi hedef. ${m.bands.counters['group:' + g] || 0} iş günüdür ${b.status === 'inside' ? 'içinde' : 'dışında'}.</p></div>`);
    }
    parts.push(`<div style="height:1rem"></div><div class="group"><button class="row" data-act="go" data-kind="capa"><span class="l"><b>Hedefler nereden geliyor?</b><small>Çapa ağacı ve piyasa görüşü</small></span>${chev()}</button></div>`);
  }
  return parts.join('');
}

// ---------- Grup ----------
function viewGrup(m, g) {
  const tg = m.targets?.groups[g];
  const parts = [back(backLabel()), `<div class="title"><h1 style="display:flex;align-items:center;gap:.6rem"><span class="dot" style="--c:${gvar(g)};width:1rem;height:1rem"></span>${GROUP_LABELS[g]}</h1></div>`];
  if (!tg || !m.bands) return parts.join('') + '<p class="empty">Bu grup çapanda yok ya da dağılım girilmedi.</p>';
  const b = m.bands.groups[g];
  const st = groupStatus(m, g);
  parts.push(`<button class="hero" data-act="explain" data-key="band:${g}"><div class="k">Şu an</div><div class="v"><strong>%${num(b.value, 1)}</strong><span>hedef %${num(b.target, 0)} · aralık %${num(b.low, 0)}–${num(b.high, 0)}</span></div><div class="${st.cls}" style="font-weight:800;margin-top:.3rem">${st.text}</div></button>`);
  parts.push(`<div class="chart">${area(m.bands.history.map((d) => d.group_exposure[g] ?? 0), gvar(g), 358, 160, b)}</div>`);
  if (tg.classes.length > 1) {
    const sp = m.bands.splits[g];
    const bar = (vals) => `<div class="strip" style="height:1.6rem">${tg.classes.map((c) => `<i style="width:${vals[c]}%;background:${cvar(c)};display:flex;align-items:center;padding-left:.4rem;color:#000;font-size:.8rem;font-weight:800;white-space:nowrap;overflow:hidden">${vals[c] >= 18 ? `${CLASS_LABELS[c].replace(' hisse', '')} %${num(vals[c], 0)}` : ''}</i>`).join('')}</div>`;
    parts.push(`<div class="label">Grup içi pay</div><button class="group" style="width:calc(100% - 1.7rem);padding:.9rem .95rem;display:flex;flex-direction:column;gap:.55rem;text-align:left" data-act="explain" data-key="split:${g}">
      <div class="strip-row" style="width:100%"><span>Şu an</span>${bar(Object.fromEntries(tg.classes.map((c) => [c, sp[c].value])))}</div>
      <div class="strip-row" style="width:100%"><span>Hedef</span>${bar(tg.splits)}</div></button>`);
  }
  for (const c of tg.classes) {
    const r = m.targets.rows[c];
    const ok = m.latest.classes[c]?.series_ok;
    const [lbl, cls] = ok ? VIEW[r.label] : ['veri az', 'mut'];
    const k = state.views[c] ?? 0;
    parts.push(`<div class="label">${CLASS_LABELS[c]} için görüş</div><div class="group" style="padding:.85rem .95rem;display:flex;flex-direction:column;gap:.6rem">
      <button data-act="explain" data-key="view:${c}" style="display:flex;justify-content:space-between;gap:.5rem;font-size:1.05rem;line-height:1.4;text-align:left"><span>${ok ? esc(trendSentence(c)) : 'Veri az, görüş üretilmiyor.'}</span><b class="${cls}" style="white-space:nowrap">${lbl}</b></button>
      <div style="display:flex;justify-content:space-between;align-items:center"><span class="mut" style="font-weight:700">Senin görüşün (K)</span><div class="seg" style="margin:0;width:9.5rem">${[-1, 0, 1].map((v) => `<button data-act="view" data-cls="${c}" data-v="${v}" class="${k === v ? 'on' : ''}">${v > 0 ? '+1' : v < 0 ? '−1' : '0'}</button>`).join('')}</div></div></div>`);
  }
  const funds = fundIndex(m.latest);
  const mine = Object.entries(m.drift.current).filter(([code]) => tg.classes.includes(funds[code]?.main_class)).sort((a, b) => b[1] - a[1]);
  if (mine.length) {
    parts.push(`<div class="label">Fonların</div><div class="group">${mine.map(([code, w]) => `<button class="row" data-act="go" data-kind="fon" data-code="${esc(code)}"><span class="l"><b>${esc(code)}</b><small>${esc(CATEGORY_LABELS[funds[code].category] || '')} · puan ${funds[code].score === null ? '—' : num(funds[code].score, 0)}</small></span><span class="r"><span class="num">%${num(w, 1)}</span>${chev()}</span></button>`).join('')}</div>`);
  }
  parts.push(`<div class="label">Hesap</div><div class="group"><button class="row" data-act="explain" data-key="target:${g}"><span class="l"><b>Hedef %${num(tg.target, 1)}</b><small>çapa %${num(tg.anchor, 1)} ${tg.tilt < 0 ? '−' : '+'} görüş ${num(Math.abs(tg.tilt), 1)}</small></span>${chev()}</button>
    <button class="row" data-act="explain" data-key="band:${g}"><span class="l"><b>Aralık %${num(b.low, 0)}–${num(b.high, 0)}</b><small>%${num(b.target, 1)} ± ${num(b.width, 1)}</small></span>${chev()}</button></div>`);
  return parts.join('');
}

// ---------- Fon sinyali ----------
function viewFonSinyal(m) {
  const parts = [back(backLabel()), title('Fonlarım', `Akran grubundaki sıraya göre · tüm BES · ilk ${m.P.decision.fund_top_n} iyi`)];
  if (!m.funds) return parts.join('') + noData();
  const funds = fundIndex(m.latest);
  const sw = Object.fromEntries(m.funds.switches.map((x) => [x.from, x]));
  const risk = Object.fromEntries(m.funds.risks.map((x) => [x.code, x]));
  const weak = Object.fromEntries(m.funds.weak.map((x) => [x.code, x]));
  const outside = Object.fromEntries(m.funds.outside.map((x) => [x.code, x]));
  const order = Object.entries(m.drift.current).sort((a, b) => {
    const k = (c) => (risk[c] ? 0 : sw[c] ? 1 : weak[c] || outside[c] ? 2 : funds[c]?.score === null ? 3 : 4);
    return k(a[0]) - k(b[0]) || b[1] - a[1];
  });
  const rows = order.map(([code, w]) => {
    const f = funds[code];
    let st = ['iyi', 'pos'];
    let sub = f && f.score !== null ? `${esc(peerName(f))} · ${f.peers} fonda ${f.rank}.` : 'puanı yok';
    if (risk[code]) st = [risk[code].text, 'neg'];
    if (sw[code]) { st = [`→ ${sw[code].to}`, 'neg']; sub = esc(sw[code].reason); }
    else if (weak[code]) { st = [`${weak[code].rank}.`, 'warnc']; sub = `${weak[code].best_of_kind ? 'türünün en iyisi · ' : ''}ilk ${m.P.decision.fund_top_n}: ${weak[code].top.map((x) => `${esc(x.code)} ${num(x.score, 0)}`).join(' · ')}`; }
    else if (outside[code]) { st = ['dışarıda', 'warnc']; sub = 'seçmediğin firma · seçtiklerinde aynı türden fon yok'; }
    else if (f && f.score === null) st = ['yeni', 'mut'];
    return `<button class="row" data-act="go" data-kind="fon" data-code="${esc(code)}"><span class="l" style="flex:1"><b>${esc(code)} <span class="mut" style="font-weight:700;font-size:.9rem">%${num(w, 0)}</span></b><small>${sub}</small></span><span class="r"><span class="num ${st[1]}" style="font-size:1rem">${st[0]}</span>${chev()}</span></button>`;
  }).join('');
  parts.push(`<div style="height:.8rem"></div><div class="group">${rows}</div>`);
  parts.push(`<p class="note">Sıra akran grubunda: kendi kategorisi; az fonlu kategorilerde aynı varlık ailesi (Altın ve gümüş · Kira ve para piyasası). Zayıf: ilk ${m.P.decision.fund_top_n}’te değil. Değiştir: aynı türün en iyisinden en az ${m.P.decision.switch_score_gap} puan geride. Eşikler Ayarlar → Model ayarları’nda.</p>`);
  if (m.funds.switches.length) parts.push('<div class="btns"><button class="btn primary" data-act="go" data-kind="dengele">Değişiklikleri gör</button></div>');
  return parts.join('');
}

// ---------- Dengele ----------
function viewDengele(m) {
  const parts = [back(backLabel())];
  if (m.proposalError) return parts.join('') + title('Dengele') + `<p class="note">Öneri üretilemedi: ${esc(m.proposalError)}</p>`;
  const p = m.proposal;
  if (!p) return parts.join('') + title('Dengele') + '<p class="empty">Şu an öneri yok.</p>';
  const total = m.steps.reduce((s, c) => s + c.steps.length, 0);
  const k = m.steps.filter((c) => c.steps.length).length;
  parts.push(title('Dengele', total ? `${k} sözleşmede ${total} değişiklik${p.preview ? ' · önizleme' : ''}` : 'Değişiklik gerekmiyor'));
  if (p.preview) parts.push(`<p class="note">Henüz kesin öneri değil; ${m.due.pending.length ? 'aralık dışı süre teyit süresine ulaşınca' : 'koşullar oluşunca'} öneri olur. Şimdi uygulamak istersen yine de kullanabilirsin.</p>`);
  if (p.switches.length) {
    parts.push(`<div class="label">Fon değişiklikleri</div><div class="group">${p.switches.map((x) => `<button class="row" data-act="go" data-kind="fon" data-code="${esc(x.to)}"><span class="l" style="flex:1"><b>${esc(x.from)} → ${esc(x.to)}</b><small>${esc(x.reason)}</small></span><span class="r"><span class="num ${x.risk ? 'neg' : ''}">%${num(x.weight, 0)}</span>${chev()}</span></button>`).join('')}</div>`);
  }
  if (p.rebalance) {
    const why = Object.entries(m.bands.groups).filter(([, b]) => b.status !== 'inside').map(([g, b]) => `${GROUP_LABELS[g]} %${num(b.value, 0)}, hedef %${num(b.target, 0)}`);
    parts.push(`<p class="note">Yeniden dağıtım: ${esc(why.join(' · ') || 'grup içi pay aralık dışında')}.</p>`);
  }
  const after = (g) => m.targets.groups[g].classes.reduce((s, c) => s + (p.exposure[c] || 0), 0);
  const w = worstGroup(m);
  if (w) {
    const [g, b] = w;
    parts.push(`<div class="hero"><div class="k">Bitince ${GROUP_LABELS[g].toLocaleLowerCase('tr-TR')}</div><div class="v"><strong>%${num(after(g), 0)}</strong><span>şimdi %${num(b.value, 0)} · hedef %${num(b.target, 0)}</span></div></div>`);
  }
  const nowG = Object.fromEntries(TREE.map((g) => [g.id, m.bands.group_exposure[g.id] || 0]));
  const aftG = Object.fromEntries(Object.keys(m.targets.groups).map((g) => [g, after(g)]));
  nowG.rest = Math.max(0, 100 - Object.values(nowG).reduce((a, b) => a + b, 0));
  aftG.rest = Math.max(0, 100 - Object.values(aftG).reduce((a, b) => a + b, 0));
  parts.push(`<div class="strips" style="padding-top:1rem"><div class="strip-row"><span>Şimdi</span>${strip(groupParts(nowG))}</div><div class="strip-row"><span>Sonra</span>${strip(groupParts(aftG))}</div><div class="strip-row"><span>Hedef</span>${strip(groupParts(m.targets.group_targets))}</div></div>`);
  const key = JSON.stringify(p.weights);
  if (state.checklist?.key !== key) state.checklist = { key, done: [] };
  const done = new Set(state.checklist.done);
  const funds = fundIndex(m.latest);
  for (const c of m.steps) {
    parts.push(`<div class="label">Sözleşme ${esc(c.no)} · toplamın %${num(c.share, 0)}'i</div>`);
    if (!c.steps.length) { parts.push('<div class="group"><div class="row"><span class="l"><b>Değişiklik yok</b></span></div></div>'); continue; }
    const rows = c.steps.map((s) => {
      const id = `${c.no}:${s.code}`;
      const on = done.has(id);
      const f = funds[s.code];
      const d = s.to - Math.round(s.from);
      return `<button class="row${on ? ' done' : ''}" data-act="tick" data-id="${esc(id)}"><span class="check${on ? ' on' : ''}">${on ? svg('check', 16, 3.2) : ''}</span>
        <span class="l" style="flex:1"><b>${esc(s.code)}</b><small>${esc(f ? CATEGORY_LABELS[f.category] || '' : '')}${!s.from ? ' · yeni fon' : ''}</small></span>
        <span class="r" style="flex-direction:column;align-items:flex-end"><span class="num">%${num(s.from, 0)} → %${s.to}</span><small class="${d > 0 ? 'pos' : 'neg'}">${d > 0 ? '+' : '−'}${Math.abs(d)}</small></span></button>`;
    }).join('');
    const keep = c.keep.length ? `<div class="row"><span class="l"><small>${c.keep.map((x) => `${esc(x)} %${p.weights[x]}`).join(', ')} aynı kalır</small></span></div>` : '';
    parts.push(`<div class="group">${rows}${keep}</div>`);
  }
  parts.push('<p class="note">Oranlar her sözleşmede gireceğin yüzdeler; hepsine aynı dağılım uygulanır. Yaptıkça işaretle.</p>');
  if (p.gaps.length) parts.push(`<p class="note neg">Uygun araç yok: ${p.gaps.map((g) => `${CLASS_LABELS[g.cls]} hedefe ${num(Math.abs(g.gap), 1)} puan uzak`).join(', ')}.</p>`);
  parts.push('<div class="btns"><button class="btn" data-act="explain" data-key="proposal">Hesabı göster</button></div>');
  parts.push(`<div class="slide"><input type="range" min="0" max="100" value="0" data-in="slide" aria-label="Hepsini yaptım, kaydır"><span class="knob">${svg('chev2', 26, 2.8)}</span>Hepsini yaptım · kaydır</div>`);
  if (m.rec?.active) parts.push('<div class="btns"><button class="btn plain" data-act="reject">Şimdi değil</button></div>');
  return parts.join('');
}

// ---------- Sözleşmeler ----------
function viewSozlesmeler(m) {
  const parts = [title('Sözleşmeler', state.contracts.length ? `${state.contracts.length} sözleşme · paylar toplam birikime göre` : '')];
  if (!state.contracts.length) return parts.join('') + noData();
  parts.push(`<div style="height:1rem"></div>${walletCards(m, false)}`);
  parts.push('<div class="btns"><button class="btn primary" data-act="go" data-kind="yapistir">Tablodan yapıştır</button><button class="btn" data-act="go" data-kind="paylar">Payları düzenle</button></div>');
  return parts.join('');
}

function viewSozlesme(m, no) {
  const c = state.contracts.find((x) => x.no === no);
  const parts = [back(backLabel())];
  const d = m.drift?.contracts?.[no];
  if (!c || !d) return parts.join('') + '<p class="empty">Sözleşme bulunamadı.</p>';
  const i = state.contracts.indexOf(c);
  const expo = currentExposure(m.latest, d.current);
  parts.push(`<div style="padding:.6rem .85rem 0"><div class="card" style="background:var(${CARD_BG[i % CARD_BG.length]});min-height:12rem"><div class="top"><div><div class="nm">Sözleşme ${esc(no)}</div><div class="ds">${Object.keys(c.weights).length} fon · ${dateTr(c.date)} tarihli</div></div>
    <div class="sh"><small>TOPLAMIN</small><b>%${num(m.drift.shares_now[no], 0)}</b></div></div><div class="big">${pct(d.return_pct, 1, true)} <span>${dateTr(d.start_date)}'den beri</span></div>${strip(exposureParts(expo))}</div></div>`);
  parts.push(`<div class="btns"><button class="btn" data-act="go" data-kind="yapistir" data-id="${esc(no)}">Dağılımı güncelle</button><button class="btn" data-act="go" data-kind="paylar">Payı düzenle</button></div>`);
  const funds = fundIndex(m.latest);
  parts.push(`<div class="label">Bu sözleşmedeki fonlar</div><div class="group">${Object.entries(d.current).sort((a, b) => b[1] - a[1]).map(([code, w]) => {
    const f = funds[code];
    return `<button class="row" data-act="go" data-kind="fon" data-code="${esc(code)}"><span class="l"><b>${esc(code)}</b><small>${esc(f ? CATEGORY_LABELS[f.category] || '' : 'veride yok')}${f && f.score !== null ? ` · puan ${num(f.score, 0)}` : ''}</small></span>
      <span class="r" style="flex-direction:column;align-items:flex-end"><span class="num">%${num(w, 0)}</span><small class="mut">girişte %${num(c.weights[code], 0)}</small></span></button>`;
  }).join('')}</div>`);
  parts.push(`<div class="label">Bu sözleşmenin içi</div><div class="group">${[...ANCHOR_CLASSES, 'unclassified'].filter((k) => expo[k] > 0.05).sort((a, b) => expo[b] - expo[a]).map((k) => `<div class="row"><span class="l" style="flex:1"><b><span class="dot" style="--c:${cvar(k)}"></span>${CLASS_LABELS[k]}</b><span class="track" style="--c:${cvar(k)}"><i style="width:${expo[k]}%"></i></span></span><span class="r"><span class="num">%${num(expo[k], 1)}</span></span></div>`).join('')}</div>`);
  parts.push('<p class="note">Hedef toplam birikime göre konur; sözleşmelerin farklı olması sorun değil.</p>');
  parts.push(`<div class="btns"><button class="btn plain" data-act="delete-contract" data-id="${esc(no)}">${ui.confirmDelete === no ? 'Silmek için tekrar dokun' : 'Sözleşmeyi sil'}</button></div>`);
  return parts.join('');
}

// ---------- Yapıştır ve paylar ----------
function shareRows(values, key) {
  const sum = Object.values(values).reduce((a, b) => a + (Number(b) || 0), 0);
  return `<div class="group">${Object.entries(values).map(([no, v]) => `<div class="row"><span class="l"><b>Sözleşme ${esc(no)}</b></span><div class="stepper"><button data-act="share-step" data-key="${key}" data-id="${esc(no)}" data-d="-1" aria-label="Azalt">−</button>
    <input inputmode="decimal" data-in="share" data-key="${key}" data-id="${esc(no)}" value="${num(Number(v) || 0, 0)}" aria-label="Sözleşme ${esc(no)} payı"><button data-act="share-step" data-key="${key}" data-id="${esc(no)}" data-d="1" aria-label="Artır">+</button></div></div>`).join('')}</div>
    <p class="note" id="share-sum-${key}">Toplam %${num(sum, 0)}${Math.abs(sum - 100) > 0.5 ? ' · 100 olmalı' : ' ✓'}</p>`;
}

function viewYapistir(m, forNo) {
  const parts = [back(backLabel()), title('Yapıştır', forNo ? `Sözleşme ${esc(forNo)} için tablodan kopyala` : 'Tablodan kopyala, uygulama çözsün')];
  parts.push(`<textarea class="paste" data-in="paste" placeholder="Kod&#9;Dağılım (%)&#9;Sözleşme no&#10;KJM&#9;30&#9;123&#10;KGC&#9;20&#9;123&#10;…" aria-label="Dağılım tablosu">${esc(ui.paste)}</textarea>`);
  parts.push('<div class="btns"><button class="btn primary" style="flex:2" data-act="parse">Çöz</button><button class="btn plain" style="flex:1" data-act="paste-clear">Temizle</button></div>');
  parts.push('<p class="note">Sütunlar: Kod · Dağılım (%) · Sözleşme no. Excel, Numbers ya da Notlar’dan kopyalayabilirsin; başlık satırı olsa da olur.</p>');
  const r = ui.parsed;
  if (r) {
    const n = Object.keys(r.contracts).length;
    parts.push(`<div class="hero"><div class="v"><strong class="${r.ok ? 'pos' : 'neg'}">${n}</strong><span>sözleşme · ${r.rows} fon satırı · ${r.errors.length ? `${r.errors.length} hata` : 'hata yok'}</span></div></div>`);
    if (r.errors.length || r.warnings.length) parts.push(`<div class="label">Kontrol et</div><div class="group">${[...r.errors.map((e) => [e, 'neg']), ...r.warnings.map((e) => [e, 'warnc'])].map(([e, cls]) => `<div class="row"><span class="l"><b class="${cls}" style="font-size:1rem">${esc(e.msg)}</b>${e.line ? `<small>satır ${e.line}</small>` : ''}</span></div>`).join('')}</div>`);
    parts.push(`<div class="label">Bulunanlar</div><div class="group">${Object.entries(r.contracts).map(([no, c]) => `<div class="row"><span class="l"><b>Sözleşme ${esc(no)}</b><small>${Object.entries(c.weights).map(([k, v]) => `${esc(k)} ${num(v, 0)}`).join(' · ')}</small></span><span class="r"><span class="num ${c.ok ? 'pos' : 'neg'}">%${num(c.sum, 0)}${c.ok ? ' ✓' : ''}</span></span></div>`).join('')}</div>`);
    if (r.ok) {
      parts.push(`<div class="label">Toplamdaki payları</div>${shareRows(ui.pasteShares, 'paste')}`);
      parts.push(`<p class="note">Tutar gerekmez: şirket ekranındaki birikimlerin oranını bir kez gir; sonra fiyatlarla kendiliğinden güncellenir.${!forNo && state.contracts.some((c) => !r.contracts[c.no]) ? ' Tabloda olmayan sözleşmeler silinir.' : ''}</p>`);
      parts.push(`<div class="btns"><button class="btn primary" data-act="paste-save">${n} sözleşmeyi kaydet</button></div>`);
    }
  }
  return parts.join('');
}

function viewPaylar(m) {
  if (!ui.shareDraft) ui.shareDraft = Object.fromEntries(state.contracts.map((c) => [c.no, Math.round(m.drift?.shares_now?.[c.no] ?? 100 / state.contracts.length)]));
  if (!state.contracts.length) return back(backLabel()) + title('Paylar') + noData();
  return back(backLabel()) + title('Paylar', 'Sözleşmelerin toplam birikimdeki payı, bugün itibarıyla') + '<div style="height:1rem"></div>' + shareRows(ui.shareDraft, 'draft')
    + '<div class="btns"><button class="btn primary" data-act="shares-save">Kaydet</button></div>';
}

// ---------- Fonlar ----------
function viewFonlar(m) {
  const helal = m.latest.funds.filter((f) => f.halal);
  const groups = [...new Set(CATEGORY_ORDER.flatMap((c) => helal.filter((f) => f.category === c).map(peerOf)))];
  const pr = m.promising || { promising: [], watch: [] };
  const keys = ['promising', ...groups, 'nonhalal'];
  if (!keys.includes(ui.category)) ui.category = groups[0];
  const mine = m.drift?.current || {};
  const parts = [title('Fonlar', `${helal.length} helal fon · ${helal.filter((f) => f.score !== null).length} puanlı${m.latest.founders_on ? ` · sıra seçtiğin ${state.founders.length} firmada` : ''}`)];
  const label = (k) => (k === 'promising' ? `Ümit vaat eden${pr.promising.length ? ` · ${pr.promising.length}` : ''}` : k === 'nonhalal' ? 'Helal dışı' : PEER_LABELS[k] || CATEGORY_LABELS[k] || k);
  parts.push(`<div class="pillrow">${keys.map((k) => `<button data-act="cat" data-cat="${k}" class="${ui.category === k ? 'on' : ''}">${esc(label(k))}</button>`).join('')}</div>`);
  if (ui.category === 'nonhalal') {
    parts.push(`<div class="label">Faizli araç ya da strateji değişimi</div><div class="group">${m.latest.funds.filter((f) => !f.halal).map((f) => `<button class="row" data-act="go" data-kind="fon" data-code="${esc(f.code)}"><span class="l"><b>${esc(f.code)}</b><small>${esc(f.halal_reason || '')}</small></span>${chev()}</button>`).join('')}</div>`);
    return parts.join('');
  }
  if (ui.category === 'promising') return parts.join('') + promisingList(m, pr, mine);
  const family = !!PEER_LABELS[ui.category];
  const list = helal.filter((f) => peerOf(f) === ui.category).sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || a.code.localeCompare(b.code));
  parts.push(`<div class="label">Puana göre · 50 grup ortası</div><div class="group">${list.map((f) => `<button class="row${f.allowed === false ? ' dim' : ''}" data-act="go" data-kind="fon" data-code="${esc(f.code)}">
    <span class="l" style="flex:1"><b>${f.rank ? `<span class="mut" style="font-size:.9rem">${f.rank}.</span> ` : ''}${esc(f.code)}${mine[f.code] ? ` <span class="tag${f.rank && f.rank > m.P.decision.fund_top_n ? ' warn' : ''}">sende %${num(mine[f.code], 0)}</span>` : ''}${f.allowed === false ? ' <span class="tag">seçmediğin firma</span>' : ''}${f.flags.filter((x) => x !== 'yeni_fon').map((x) => ` <span class="tag warn">${FLAG_LABELS[x]}</span>`).join('')}</b>
    <small>${family ? `${esc(CATEGORY_LABELS[f.category] || '')} · ` : ''}${esc(fundReason(f, m.P))} · ücret ${pct(f.fee, 2)}</small>${strip(exposureParts(f.exposure), 'strip thin')}</span>
    <span class="r"><span class="num ${f.score === null ? 'mut' : f.score >= 55 ? 'pos' : f.score < 45 ? 'neg' : ''}" style="font-size:1.4rem">${f.score === null ? 'yeni' : num(f.score, 0)}</span>${chev()}</span></button>`).join('')}</div>`);
  if (family) parts.push(`<p class="note">Bu ailedeki kategorilerden birinde ${m.P.fund_quality.min_peers}’ten az puanlı fon olduğu için fonlar birlikte puanlanıp sıralanıyor. Değiştir önerisi yine aynı türe gider.</p>`);
  return parts.join('');
}

// Ümit vaat eden: kısa geçmiş yüzünden puanı 50'ye çekilmiş ama ham puanı güçlü fonlar; izlemede: yeni fonlar.
function promisingList(m, pr, mine) {
  const fq = m.P.fund_quality;
  const funds = fundIndex(m.latest);
  const parts = [];
  parts.push(`<div class="label">Ümit vaat eden · ${num(fq.min_history_months, 0)}–${num(fq.full_confidence_months, 0)} ay</div>`);
  parts.push(pr.promising.length ? `<div class="group">${pr.promising.map((x) => `<button class="row" data-act="go" data-kind="fon" data-code="${esc(x.code)}"><span class="l" style="flex:1"><b>${esc(x.code)}${mine[x.code] ? ` <span class="tag">sende %${num(mine[x.code], 0)}</span>` : ''}${x.allowed ? '' : ' <span class="tag">seçmediğin firma</span>'}</b><small>${esc(peerName(funds[x.code]))} · ${num(x.months, 0)} ay · ham puanla ${x.peers} fonda ${x.raw_rank}.</small></span><span class="r"><span class="num pos" style="font-size:1.4rem">${num(x.raw, 0)}</span>${chev()}</span></button>`).join('')}</div>` : '<p class="empty">Şu an koşulu sağlayan fon yok.</p>');
  parts.push(`<p class="note">Büyük sayı ham puan: kısa geçmiş düzeltmesi yapılmadan. Koşul: ham puanla akran grubunda ilk ${fq.promising_top_n} ya da ham puan ${fq.promising_min_raw} ve üstü. Yalnız bilgi; değiştir önerisi üretmez. ${num(fq.full_confidence_months, 0)} ayı doldurunca tam puanla sıralanır.</p>`);
  if (pr.watch.length) {
    parts.push(`<div class="label">İzlemede · ${num(fq.min_history_months, 0)} aydan kısa</div><div class="group">${pr.watch.map((x) => `<button class="row" data-act="go" data-kind="fon" data-code="${esc(x.code)}"><span class="l" style="flex:1"><b>${esc(x.code)}${x.allowed ? '' : ' <span class="tag">seçmediğin firma</span>'}</b><small>${esc(peerName(funds[x.code]))} · ${num(x.months, 0)} ay · puanı ${num(fq.min_history_months, 0)} ayda başlar</small></span>${chev()}</button>`).join('')}</div>`);
  }
  return parts.join('');
}

function viewFon(m, code) {
  const f = fundIndex(m.latest)[code];
  const parts = [back(backLabel())];
  if (!f) return parts.join('') + '<p class="empty">Fon bulunamadı.</p>';
  const k = KIND[f.category] || 'mixed';
  const n = fundNames(f.name);
  const passive = m.P.universe.passive_categories.includes(f.category);
  const mine = m.drift?.current?.[code];
  parts.push(`<div class="fid"><span class="ico" style="--c:var(${KIND_VAR[k]})">${svg(k, 30, 2)}</span><div><h1>${esc(code)}</h1><p>${esc(n.short)}${mine ? ` · sende %${num(mine, 1)}` : ''}</p></div></div>`);
  if (f.allowed === false && f.halal) parts.push(`<p class="note"><span class="tag">seçmediğin firma</span> Sıra ve öneriler bu fonu dışarıda tutar.</p>`);
  if (!f.halal) parts.push(`<div class="banner"><span class="app-i warn">!</span><span><b>Helal dışı</b><span>${esc(f.halal_reason || '')}</span></span></div>`);
  if (f.flags.length) parts.push(`<p class="note">${f.flags.map((x) => `<span class="tag warn">${FLAG_LABELS[x]}</span>`).join(' ')}</p>`);
  const sig = mine && m.funds ? (m.funds.switches.find((x) => x.from === code) || m.funds.weak.find((x) => x.code === code)) : null;
  if (sig) parts.push(`<button class="banner" ${sig.to ? `data-act="go" data-kind="fon" data-code="${esc(sig.to)}"` : ''}><span class="app-i warn">!</span><span><b>${sig.to ? `Değiştir: ${esc(sig.to)}` : `${esc(peerName(f))} grubunda ${sig.rank}.`}</b><span>${sig.to ? esc(sig.reason) : `İlk ${m.P.decision.fund_top_n}: ${sig.top.map((x) => `${esc(x.code)} ${num(x.score, 0)}`).join(' · ')}`}</span></span>${sig.to ? chev() : ''}</button>`);
  const prom = m.promising?.promising.find((x) => x.code === code);
  if (prom) parts.push(`<button class="banner" data-act="explain" data-key="score:${esc(code)}"><span class="app-i">↗</span><span><b>Ümit vaat eden</b><span>${num(prom.months, 0)} ay · ham puan ${num(prom.raw, 0)} · ham puanla ${prom.peers} fonda ${prom.raw_rank}. ${num(m.P.fund_quality.full_confidence_months, 0)} ayda tam puana ulaşır.</span></span></button>`);
  const y1 = f.returns?.['1y'];
  const ex = f.excess?.['1y'];
  parts.push(`<div class="hero"><div class="k">Son 1 yıl</div><div class="v"><strong class="${(y1 ?? 0) < 0 ? 'neg' : 'pos'}">${pct(y1, 1, true)}</strong><span>${ex === null || ex === undefined ? '' : `${passive ? 'kıyasından' : 'içeriğinden'} ${num(Math.abs(ex), 1)} puan ${ex >= 0 ? 'fazla' : 'geride'}`}</span></div></div>`);
  const pr = (m.latest.prices_tail.prices[code] || []).filter((v) => v !== null);
  if (pr.length > 2) parts.push(`<div class="chart">${area(rangeSlice(pr, ui.frange), `var(${KIND_VAR[k]})`, 358, 140)}</div>${ranges('frange', ui.frange)}`);
  parts.push(`<div class="stats"><button data-act="${f.score === null ? 'noop' : 'explain'}" data-key="score:${esc(code)}"><small>Puan</small><b>${f.score === null ? '—' : num(f.score, 0)}</b><span>${f.score === null ? (f.flags.includes('yeni_fon') ? 'yeni fon' : 'yok') : f.rank ? `${f.peers} fonda ${f.rank}.` : `tüm BES’te ${f.rank_all}.`}</span></button>
    <div><small>Ücret</small><b>${pct(f.fee, 2)}</b><span>yıllık</span></div><div><small>Risk</small><b>${f.risk ?? '—'}/7</b><span>SPK</span></div></div>`);
  if (f.components) {
    const c = f.components;
    const names = [['consistency', 'Her dönemde iyi'], ['excess_index', passive ? 'Kıyasına göre getiri' : 'İçeriğine göre getiri'], ['risk', passive ? 'Kıyasını yakından izleme' : 'Düşüşlerde dayanıklılık'], ['cost', 'Ücret']];
    parts.push(`<div class="label">Neden ${num(f.score, 0)}?</div><div class="group">${names.filter(([key]) => c[key] !== null && c[key] !== undefined).map(([key, l]) => { const [g, cls] = grade(c[key]); return `<button class="row" data-act="explain" data-key="score:${esc(code)}"><span class="l"><b style="font-weight:700">${l}</b></span><span class="r"><span class="num ${cls}" style="font-size:1.05rem">${g}</span></span></button>`; }).join('')}</div>`);
  }
  const cls = [...ANCHOR_CLASSES, 'unclassified'].filter((x) => f.exposure[x] > 0.05).sort((a, b) => f.exposure[b] - f.exposure[a]);
  parts.push(`<div class="label">İçinde · ${dateTr(f.content_date)}</div><div class="group" style="padding:.9rem .95rem">${strip(exposureParts(f.exposure))}<div class="legend" style="padding:.6rem 0 0">${cls.map((x) => `<span><i style="background:${cvar(x)}"></i>${CLASS_LABELS[x]} %${num(f.exposure[x], 1)}</span>`).join('')}</div></div>`);
  const per = ['1m', '3m', '6m', 'ytd', '1y', '3y', '5y'];
  const ix = f.indices || {};
  parts.push(`<div class="label">Ayrıntı</div><div class="group">
    <details class="fold"><summary>Dönem getirileri ${chev()}</summary><div class="body">${per.map((x) => `<div class="kv"><span>${PERIOD_LABELS[x]}</span><span>${pct(f.returns?.[x], 1)} · fazla ${signed(f.excess?.[x], 1)}</span></div>`).join('')}</div></details>
    <details class="fold"><summary>Helal dayanağı ${chev()}</summary><div class="body"><div class="kv"><span>Dayanak</span><span>${esc(f.halal_basis || '—')}</span></div><div class="kv"><span>İçerik</span><span>${f.halal ? 'faizli araç yok' : esc(f.halal_reason || '')}</span></div></div></details>
    <details class="fold"><summary>Risk ve indisler ${chev()}</summary><div class="body"><div class="kv"><span>İzleme hatası</span><span>${pct(f.tracking_error, 2)}</span></div><div class="kv"><span>En büyük düşüş (fazla getiri)</span><span>${f.mdd === null || f.mdd === undefined ? '—' : '−' + pct(f.mdd, 2)}</span></div><div class="kv"><span>Sortino</span><span>${num(f.sortino, 2)}</span></div><div class="kv"><span>Ind5 / Ind7 basit</span><span>${num(ix.ind5_simple, 2)} / ${num(ix.ind7_simple, 2)}</span></div><div class="kv"><span>Uzun vade · fazla getiri</span><span>${num(ix.long_term, 2)} · ${signed(ix.excess, 2)}</span></div></div></details>
    <details class="fold"><summary>Fon bilgileri ${chev()}</summary><div class="body"><div class="kv"><span>Şirket</span><span>${esc(n.company)}</span></div><div class="kv"><span>TEFAS türü</span><span>${esc(f.tefas_type || '—')}</span></div><div class="kv"><span>Ücret ayrıntısı</span><span>iç tüzük ${pct(f.fee_prospectus, 2)} · azami ${pct(f.max_ter, 2)}</span></div><div class="kv"><span>Büyüklük</span><span>${moneyTl(f.size_tl)}</span></div><div class="kv"><span>Yatırımcı</span><span>${people(f.investors)}</span></div><div class="kv"><span>Veri başlangıcı</span><span>${dateTr(f.first_date)}</span></div></div></details></div>`);
  parts.push(`<button class="banner" data-act="claude-fund" data-code="${esc(code)}"><span class="app-i">m</span><span><b>Bu fonu tutmalı mıyım?</b><span>Soru metnini kopyala, Claude'a yapıştır</span></span>${chev()}</button>`);
  return parts.join('');
}

// ---------- Çapa ----------
function anchorDraftFrom(anchor, m) {
  const a = normalizeAnchor(TREE, anchor) || { groups: {}, splits: {} };
  const expo = m.expoNow || {};
  const splits = {};
  for (const g of TREE.filter((x) => x.classes.length > 1)) {
    const sp = a.splits[g.id];
    const [c1, c2] = g.classes;
    if (sp && c1 in sp && c2 in sp) { splits[g.id] = Math.round(sp[c1]); continue; }
    const tot = (expo[c1] || 0) + (expo[c2] || 0);
    splits[g.id] = tot > 0 ? Math.round(((expo[c1] || 0) / tot) * 20) * 5 : 50;
  }
  return { groups: Object.fromEntries(TREE.map((g) => [g.id, a.groups[g.id] === undefined ? '' : String(Math.round(a.groups[g.id]))])), splits };
}

function draftAnchor(d) {
  const groups = {};
  const splits = {};
  for (const g of TREE) {
    if (String(d.groups[g.id]).trim() === '' || !Number.isFinite(Number(d.groups[g.id]))) continue;
    groups[g.id] = Number(d.groups[g.id]);
    if (g.classes.length > 1) splits[g.id] = { [g.classes[0]]: d.splits[g.id], [g.classes[1]]: 100 - d.splits[g.id] };
  }
  return { groups, splits };
}

function btBlock(weights) {
  if (!latest.class_monthly) return '<p class="note">Geri test verisi bir sonraki günlük güncellemeyle gelecek.</p>';
  const bt = backtest(weights, latest.class_monthly);
  if (!bt.ok) return '<p class="note">Geri test için yeterli aylık veri yok.</p>';
  return `<div class="stats" style="margin-top:0"><button data-act="explain" data-key="backtest"><small>Yıllık getiri</small><b>${pct(bt.annual_return_pct, 0)}</b><span>nominal</span></button>
    <button data-act="explain" data-key="backtest"><small>En büyük düşüş</small><b class="neg">${pct(bt.max_drawdown_pct, 0)}</b><span>zirveden</span></button>
    <button data-act="explain" data-key="backtest"><small>En kötü 12 ay</small><b class="${bt.worst_12m_pct < 0 ? 'neg' : ''}">${pct(bt.worst_12m_pct, 0, true)}</b><span>${bt.months} ay</span></button></div>
    ${bt.missing.length ? `<p class="note">Verisi olmayan: ${bt.missing.map((c) => CLASS_LABELS[c]).join(', ')} (ağırlıkları diğerlerine dağıtıldı).</p>` : ''}`;
}

function viewCapa(m) {
  if (!ui.anchorDraft) ui.anchorDraft = anchorDraftFrom(state.anchor || (m.latest.anchor?.ok ? m.latest.anchor.user_groups.weights : null), m);
  const d = ui.anchorDraft;
  const parts = [back(backLabel()), title('Çapa', `Uzun vadeli denge noktan. Görüş grup hedefini en çok ±${m.P.tactical.max_tilt_pts} puan oynatır.`)];
  const rows = TREE.map((g) => {
    const split = g.classes.length > 1 ? (() => {
      const p = d.splits[g.id];
      const [c1, c2] = g.classes;
      return `<div style="padding:0 0 .8rem 1.2rem;border-bottom:1px solid var(--sep)"><div style="display:flex;justify-content:space-between;font-size:.95rem;font-weight:800"><span>${CLASS_LABELS[c1]} %<span data-out="s1-${g.id}">${p}</span></span><span>${CLASS_LABELS[c2]} %<span data-out="s2-${g.id}">${100 - p}</span></span></div>
        <input class="split" type="range" min="0" max="100" step="5" value="${p}" data-in="split" data-g="${g.id}" aria-label="${GROUP_LABELS[g.id]} grup içi pay" style="--p:${p}%;--c1:${cvar(c1)};--c2:${cvar(c2)}"></div>`;
    })() : '';
    return `<div class="row" style="${split ? 'border-bottom:0' : ''}"><span class="l"><b><span class="dot" style="--c:${gvar(g.id)}"></span>${GROUP_LABELS[g.id]}</b></span>
      <div class="stepper"><button data-act="astep" data-g="${g.id}" data-d="-1" aria-label="Azalt">−</button><input inputmode="decimal" data-in="agroup" data-g="${g.id}" value="${esc(d.groups[g.id])}" placeholder="izle" aria-label="${GROUP_LABELS[g.id]} çapan"><button data-act="astep" data-g="${g.id}" data-d="1" aria-label="Artır">+</button></div></div>${split}`;
  }).join('');
  const sum = Object.values(d.groups).reduce((a, b) => a + (Number(b) || 0), 0);
  parts.push(`<div style="height:.8rem"></div><div class="group">${rows}</div><p class="note" id="anchor-sum">Toplam %${num(sum, 0)}${Math.abs(sum - 100) > 0.5 ? ' · 100 olmalı' : ' ✓'} · boş bırakılan grup izlenir</p>`);
  parts.push(`<div class="label">Bu çapayla son 5 yıl</div><div id="bt">${btBlock(classAnchor(TREE, normalizeAnchor(TREE, draftAnchor(d))))}</div>`);
  const a = m.latest.anchor;
  if (a?.ok) {
    const sg = normalizeAnchor(TREE, a.user_groups.weights);
    parts.push(`<div class="label">Uygulamanın önerisi</div><div class="group" style="padding:.9rem .95rem"><b style="font-size:1.1rem;line-height:1.4;display:block">${TREE.filter((g) => sg.groups[g.id] !== undefined).map((g) => `${GROUP_LABELS[g.id]} %${num(sg.groups[g.id], 0)}`).join(' · ')}</b>
      <p class="mut" style="font-weight:700;margin-top:.3rem">Son ${a.weeks} haftanın verisinden, her grup yaklaşık eşit risk katsın diye. Önerisi olmayan grup izlenir.</p></div>
      <div class="btns"><button class="btn" data-act="anchor-copy">Öneriyi kullan</button><button class="btn plain" data-act="explain" data-key="anchor">Nasıl?</button></div>`);
  }
  parts.push(`<div class="btns"><button class="btn primary" data-act="anchor-save">Kaydet</button></div><p class="note center">${state.anchor_date ? `Son kayıt ${dateTr(state.anchor_date)}.` : 'Şimdilik uygulamanın önerisi kullanılıyor.'} Belirsiz kısım çapaya girmez.</p>`);
  return parts.join('');
}

// ---------- Sor ----------
function answer(m, q) {
  if (q === 'today') {
    if (!m.bands) return { text: 'Önce sözleşmelerini yapıştır; sonra durumu söyleyebilirim.', go: 'yapistir' };
    const n = dailyNotice(m, GROUP_LABELS, CLASS_LABELS);
    return { text: `<b>${esc(n.title)}.</b> ${esc(n.body)}`, go: m.due?.active ? 'dengele' : null };
  }
  if (q === 'why') {
    if (!m.bands) return { text: 'Önce sözleşmelerini yapıştır.' };
    const [g, b] = worstGroup(m);
    const cls = m.targets.groups[g].classes[0];
    return { text: `En büyük sapma <b>${GROUP_LABELS[g].toLocaleLowerCase('tr-TR')}</b>: %${num(b.value, 1)}, hedef %${num(b.target, 0)}. ${m.bands.counters['group:' + g] || 0} iş günüdür ${b.status === 'inside' ? 'aralıkta' : 'aralık dışında'}. ${CLASS_LABELS[cls]} için görüş: ${esc(trendSentence(cls))}`, go: 'grup:' + g };
  }
  if (q === 'funds') {
    if (!m.funds) return { text: 'Önce sözleşmelerini yapıştır.' };
    const fs = m.funds;
    const lines = [
      ...fs.switches.map((x) => `<b>${esc(x.from)} → ${esc(x.to)}</b>: ${esc(x.reason)}.`),
      ...fs.weak.filter((x) => !fs.switches.some((s) => s.from === x.code)).map((x) => `<b>${esc(x.code)}</b> ${x.peers} fonda ${x.rank}.; fark küçük, şimdilik izle.`),
      ...fs.good.map((x) => `<b>${esc(x.code)}</b> ${x.peers} fonda ${x.rank}. — iyi.`),
      ...fs.fresh.map((x) => `<b>${esc(x.code)}</b>: henüz puanı yok.`),
    ];
    return { text: lines.join('<br>') || 'Puanlı fonun yok.', go: fs.switches.length ? 'dengele' : 'fonsinyal' };
  }
  return { text: '' };
}

function viewSor(m) {
  const parts = [title('Sor', 'maliSK verinle yanıtlar')];
  parts.push(`<div class="qs">${[['today', 'Bugün ne yapmalıyım?'], ['why', 'En büyük sapma neden?'], ['funds', 'Fonlarım iyi mi?']].map(([k, l]) => `<button data-act="ask" data-q="${k}">${l}</button>`).join('')}<button data-act="claude">Claude'a sor</button></div>`);
  if (!ui.chat.length) parts.push('<p class="note" style="padding-top:1rem">Bir soruya dokun. “Claude\'a sor” tüm durumunu hazır bir metin olarak kopyalar; Claude uygulamasına yapıştırırsın.</p>');
  parts.push(`<div class="chat">${ui.chat.map((c) => `<div class="me">${esc(c.q)}</div><div class="ai"><span class="av">m</span><div class="bub"><span>${c.a.text}</span>${c.a.go ? `<button class="btn" style="min-height:2.6rem" data-act="go" data-kind="${c.a.go.split(':')[0]}" data-id="${c.a.go.split(':')[1] || ''}">Aç ›</button>` : ''}</div></div>`).join('')}</div>`);
  return parts.join('');
}

// ---------- Ayarlar ----------
function viewAyarlar(m) {
  const p = state.prefs;
  const link = (kind, label, right = '') => `<button class="row" data-act="go" data-kind="${kind}"><span class="l"><b style="font-weight:700">${label}</b></span><span class="r"><span class="mut" style="font-weight:700">${right}</span>${chev()}</span></button>`;
  return back(backLabel()) + title('Ayarlar') + `
    <div class="label">Yazı boyutu</div><div class="seg" style="margin-top:0">${[['m', 'Büyük'], ['l', 'Daha büyük'], ['xl', 'En büyük']].map(([k, l]) => `<button data-act="size" data-v="${k}" class="${p.size === k ? 'on' : ''}">${l}</button>`).join('')}</div>
    <div class="label">Görünüm</div><div class="seg" style="margin-top:0">${[['auto', 'Otomatik'], ['dark', 'Koyu'], ['light', 'Açık']].map(([k, l]) => `<button data-act="theme" data-v="${k}" class="${p.theme === k ? 'on' : ''}">${l}</button>`).join('')}</div>
    <div class="label">Model ve veri</div><div class="group">${link('firmalar', 'Fon firmaları', state.founders?.length ? `${state.founders.length} firma` : 'hepsi')}${link('bildirim', 'Bildirimler', p.notify ? 'açık' : 'kapalı')}${link('parametreler', 'Model ayarları', 'sürüm ' + m.param_version)}${link('capa', 'Çapa', state.anchor ? dateTr(state.anchor_date) : 'öneri')}${link('paylar', 'Sözleşme payları')}${link('yedek', 'Yedekle ve geri yükle')}${link('veri', 'Veri kaynakları', 'TEFAS')}</div>
    <p class="note center" style="padding-top:1rem">Dağılımın yalnız bu telefonda saklanır.</p>`;
}

// Fon seçilecek firmalar: yalnız telefonda; sıra ve öneri bu firmaların fonlarından.
function companies(m) {
  const out = {};
  for (const f of m.latest.funds) {
    if (!f.halal || !f.founder) continue;
    (out[f.founder] ||= { code: f.founder, name: fundNames(f.name).company || f.founder, n: 0 }).n++;
  }
  return Object.values(out).sort((a, b) => a.name.localeCompare(b.name, 'tr'));
}

function viewFirmalar(m) {
  const list = companies(m);
  const on = (c) => !state.founders?.length || state.founders.includes(c);
  const parts = [back(backLabel()), title('Fon firmaları', state.founders?.length ? `${state.founders.length} / ${list.length} firma seçili` : `${list.length} firmanın hepsi`)];
  parts.push(`<div style="height:.8rem"></div><div class="group">${list.map((c) => `<button class="row" data-act="founder-toggle" data-v="${esc(c.code)}"><span class="l"><b>${esc(c.name)}</b><small>${c.n} helal fon</small></span><span class="toggle${on(c.code) ? ' on' : ''}"></span></button>`).join('')}</div>`);
  if (state.founders?.length) parts.push('<div class="btns"><button class="btn plain" data-act="founders-all">Hepsini seç</button></div>');
  parts.push('<p class="note">Puan tüm BES’e göre kalır. Sıra, zayıf uyarısı, değiştir ve dengeleme önerisi yalnız seçtiğin firmaların fonlarından. Seçmediğin firmanın fonunu tutuyorsan, seçtiklerindeki aynı türün en iyisine geçiş önerilir. Seçim yalnız bu telefonda durur.</p>');
  return parts.join('');
}

// Ayar örnekleri: kullanıcının bugünkü hedefleriyle ve taslaktaki değerlerle hesaplanır.
function paramExample(key, P, m) {
  const d = P.decision;
  const gt = Object.entries(m.targets?.group_targets || {}).sort((a, b) => b[1] - a[1]);
  const [gid, t] = gt[0] || [null, 30];
  const gl = gid ? GROUP_LABELS[gid] : 'Bir grup';
  const small = gt.length > 1 ? gt[gt.length - 1] : null;
  const rng = (tt, pct) => `%${num(tt * (1 - pct / 100), 1)}–${num(tt * (1 + pct / 100), 1)}`;
  const fw = P.fund_quality.weights;
  const fsum = Object.values(fw).reduce((x, y) => x + y, 0);
  switch (key) {
    case 'decision.yellow_rel_pct':
      return `Örnek: ${gl} hedefin %${num(t, 0)} → ${rng(t, d.yellow_rel_pct)} arası normal.${small ? ` ${GROUP_LABELS[small[0]]} hedefin %${num(small[1], 0)} → ${rng(small[1], d.yellow_rel_pct)}.` : ''}`;
    case 'decision.red_rel_pct':
      return `Örnek: ${gl} %${num(t * (1 - d.red_rel_pct / 100), 1)} altına iner ya da %${num(t * (1 + d.red_rel_pct / 100), 1)} üstüne çıkarsa.`;
    case 'decision.confirm_days':
      return `Şu an yaklaşık ${num(d.confirm_days / 21, 1)} ay.`;
    case 'decision.split_band_pts': {
      const sp = m.targets?.groups?.precious_metals?.splits;
      let g = sp && Object.entries(sp).sort((a, b) => b[1] - a[1])[0];
      if (!g || g[1] >= 99) g = ['gold', 70];
      return g ? `Örnek: kıymetli madende ${CLASS_LABELS[g[0]].toLocaleLowerCase('tr-TR')} hedefi %${num(g[1], 0)} → payı %${num(Math.max(0, g[1] - d.split_band_pts), 0)}–${num(Math.min(100, g[1] + d.split_band_pts), 0)} arası normal.` : '';
    }
    case 'decision.fund_top_n':
      return `Örnek: 11 fonluk grupta ${d.fund_top_n + 1}. sıradaki fon zayıf sayılır.`;
    case 'decision.switch_score_gap':
      return d.switch_score_gap > 1 ? `Örnek: senin fonun 60, en iyisi ${60 + d.switch_score_gap + 1} → fark ${d.switch_score_gap + 1}, öneri gelir. En iyisi ${60 + d.switch_score_gap - 1} olsaydı gelmezdi.` : '';
    case 'tactical.max_tilt_pts':
      return `Örnek: ${gl.toLocaleLowerCase('tr-TR')} çapan %${num(t, 0)} ise görüşe göre hedef %${num(t - P.tactical.max_tilt_pts, 1)}–${num(t + P.tactical.max_tilt_pts, 1)} arasında olur.`;
    case 'tactical.full_tilt_at':
      return `Örnek: S = 0,25 iken hedef ${num(Math.abs(tilt(0.25, P.tactical)), 1)} puan, S = ${num(P.tactical.full_tilt_at, 2)} ve üstünde ${num(P.tactical.max_tilt_pts, 1)} puan kayar.`;
    case 'tactical.weights.user': {
      const w = P.tactical.weights;
      return `Şu an toplam ${num(w.trend + w.macro + w.user, 2)}.`;
    }
    case 'decision.alert_sigma_mult': {
      const v = m.latest.classes?.gold?.vol_annual_pct;
      return v ? `Bugün altın için yaklaşık %${num(alertThreshold(v, d), 1)} düşüşte uyarır.` : '';
    }
    default:
      if (key.startsWith('fund_quality.weights.')) return fsum > 0 ? `Puandaki payı %${num((fw[key.split('.').pop()] * 100) / fsum, 0)}.` : '';
      return '';
  }
}

function viewParametreler(m) {
  if (!ui.paramDraft) ui.paramDraft = { ...(state.params.values || {}) };
  const eff = effectiveParams(DEFAULT_PARAMS, ui.paramDraft, PARAM_META);
  const errors = validateParams(eff);
  const fmtv = (meta, v) => (meta.step < 1 && meta.step !== 0.5 ? num(v, 2) : num(v, meta.step % 1 ? 1 : 0));
  const parts = [back(backLabel()), title('Model ayarları', `Sürüm ${m.param_version} · değişiklikler telefonda hesaplanır`)];
  for (const [gk, g] of Object.entries(PARAM_GROUPS)) {
    const items = PARAM_META.filter((x) => x.group === gk);
    if (!items.length) continue;
    parts.push(`<div class="label">${esc(g.title)}</div>${g.note ? `<p class="note ptop">${esc(g.note)}</p>` : ''}<div class="group">${items.map((meta) => {
      const v = getPath(eff, meta.key);
      const def = getPath(DEFAULT_PARAMS, meta.key);
      const ex = paramExample(meta.key, eff, m);
      return `<div class="prow"><b>${esc(meta.label)}</b>${meta.help ? `<small>${esc(meta.help)}</small>` : ''}${ex ? `<small class="ex">${esc(ex)}</small>` : ''}
        <div class="pctl"><span class="mut">${v !== def ? `varsayılan ${fmtv(meta, def)}` : ''} ${esc(meta.unit)}</span><div class="stepper"><button data-act="pstep" data-key="${meta.key}" data-d="-1" aria-label="Azalt">−</button><input readonly value="${fmtv(meta, v)}" class="${v !== def ? 'pos' : ''}" aria-label="${esc(meta.label)}"><button data-act="pstep" data-key="${meta.key}" data-d="1" aria-label="Artır">+</button></div></div></div>`;
    }).join('')}</div>`);
  }
  if (errors.length) parts.push(`<p class="note neg">${errors.map(esc).join(' · ')}</p>`);
  parts.push(`<div class="btns"><button class="btn primary" data-act="params-save">Kaydet (sürüm ${DEFAULT_PARAMS.version}.${(state.params.n || 0) + 1})</button></div><div class="btns"><button class="btn plain" data-act="params-reset">Varsayılana dön</button></div>`);
  if (state.param_history.length) parts.push(`<div class="label">Geçmiş</div><div class="group">${state.param_history.slice().reverse().map((h) => `<div class="row"><span class="l"><b style="font-size:1rem">Sürüm ${DEFAULT_PARAMS.version}.${h.n}</b><small>${dateTr(h.date)} · ${Object.keys(h.values).length} değişiklik</small></span></div>`).join('')}</div>`);
  parts.push('<p class="note">Fon puanı ağırlıkları, acil uyarı eşiği ve çapa önerisi de telefonda yeniden hesaplanır; sunucudaki veri değişmez.</p>');
  return parts.join('');
}

function pushSupport() {
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone;
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return standalone ? 'Bu telefon bildirimi desteklemiyor (iOS 16.4 ve üstü gerekir).' : 'Bildirim için uygulamayı Safari’de Paylaş → Ana Ekrana Ekle ile kurup oradan aç.';
  return null;
}

function viewBildirim() {
  const p = state.prefs;
  const unsupported = pushSupport();
  const parts = [back(backLabel()), title('Bildirimler', 'Her iş günü veri güncellenince telefonuna kısa bir özet')];
  parts.push(`<div style="height:.8rem"></div><div class="group"><button class="row" data-act="notify-toggle" ${unsupported ? 'disabled' : ''}><span class="l"><b>Günlük bildirim</b><small>${p.notify ? 'açık' : 'kapalı'}</small></span><span class="toggle${p.notify ? ' on' : ''}"></span></button></div>`);
  if (unsupported) parts.push(`<p class="note warnc">${unsupported}</p>`);
  parts.push('<p class="note">Öneri hazırsa “Dengeleme zamanı”, büyük düşüşte “Acil uyarı”, diğer günlerde kısa bir durum yazar. Metin telefonunda hesaplanır; dağılımın telefondan çıkmaz. İstediğin an buradan kapatabilirsin.</p>');
  if (p.notify && state.push?.secret) {
    parts.push(`<div class="label">Son adım: anahtarı GitHub'a ekle (bir kez)</div><div class="group">
      <div class="row"><span class="l"><b style="font-size:1rem">1. Anahtarı kopyala</b></span><button class="btn" style="width:auto;padding:0 .9rem;min-height:2.4rem" data-act="copy-key">Kopyala</button></div>
      <div class="row"><span class="l"><b style="font-size:1rem">2. GitHub'da yeni gizli değer aç</b><small>Ad: MALISK_PUSH · Değer: yapıştır · Add secret</small></span><a class="btn" style="width:auto;padding:0 .9rem;min-height:2.4rem;text-decoration:none" href="${REPO_SECRETS}" target="_blank" rel="noopener">Aç</a></div></div>
      <div class="keybox">${esc(state.push.secret.slice(0, 48))}…</div>
      <p class="note">Anahtar yalnız bu telefonda ve GitHub gizli değerlerinde durur; kimseyle paylaşma. Bildirimi kapatıp açarsan yeni anahtar oluşur; GitHub'daki değeri de güncellemen gerekir.</p>
      <div class="btns"><button class="btn" data-act="notify-test">Deneme bildirimi</button></div>`);
  }
  return parts.join('');
}

function viewYedek() {
  return back(backLabel()) + title('Yedek', 'Verilerin yalnız bu telefonda. Yedeği Notlar gibi güvenli bir yere yapıştır.')
    + '<div class="btns"><button class="btn primary" data-act="backup">Yedeği kopyala</button></div>'
    + '<div class="label">Yedekten geri yükle</div><textarea class="paste" id="restore-text" placeholder="Yedek metnini buraya yapıştır" style="margin-top:0"></textarea><div class="btns"><button class="btn" data-act="restore-do">Geri yükle</button></div>';
}

function viewVeri(m) {
  const s = m.latest.sources;
  return back(backLabel()) + title('Veri kaynakları') + `<div style="height:.8rem"></div><div class="group" style="padding:.6rem .95rem">
    <div class="kv"><span>TEFAS</span><span>${s.tefas.funds} fon · ${s.tefas.halal} helal</span></div><div class="kv"><span>Fiyat aralığı</span><span>${dateTr(s.tefas.first_date)} – ${dateTr(s.tefas.last_date)}</span></div>
    <div class="kv"><span>İçerik</span><span>${dateTr(m.latest.content_date)}</span></div><div class="kv"><span>EVDS · FRED</span><span>${esc(s.evds.status)} · ${esc(s.fred.status)}</span></div>
    <div class="kv"><span>Hesap</span><span>${esc(m.latest.generated_at)}</span></div><div class="kv"><span>Model · parametre</span><span>${esc(m.latest.model_version)} · ${m.param_version}</span></div></div>
    <div class="btns"><button class="btn" data-act="reload">Veriyi yenile</button></div>`;
}

// ---------- Çizim ----------
function tabbar() {
  const t = [['ozet', 'Özet', 'home'], ['sozlesmeler', 'Sözleşme', 'cards'], ['fonlar', 'Fonlar', 'list'], ['sor', 'Sor', 'chat']];
  return `<nav class="tabbar" aria-label="Sekmeler">${t.map(([k, l, i]) => `<button data-act="tab" data-tab="${k}" class="${ui.tab === k ? 'on' : ''}"${ui.tab === k ? ' aria-current="page"' : ''}>${svg(i, 26, 2.1)}${l}</button>`).join('')}</nav>`;
}

function render() {
  if (loadError) { root.innerHTML = `<p class="empty">Veri yüklenemedi: ${esc(loadError)}</p><div class="btns"><button class="btn primary" data-act="reload">Yeniden dene</button></div>`; return; }
  if (!latest) { root.innerHTML = '<p class="empty">maliSK yükleniyor…</p>'; return; }
  const p = page();
  const m = compute(latest, state, { withProposal: p?.kind === 'dengele' });
  render.m = m;
  const views = {
    dagilim: () => viewDagilim(m), dengele: () => viewDengele(m), fonsinyal: () => viewFonSinyal(m), grup: () => viewGrup(m, p.id), fon: () => viewFon(m, p.code),
    sozlesme: () => viewSozlesme(m, p.id), yapistir: () => viewYapistir(m, p.id), paylar: () => viewPaylar(m), capa: () => viewCapa(m),
    ayarlar: () => viewAyarlar(m), firmalar: () => viewFirmalar(m), parametreler: () => viewParametreler(m), bildirim: () => viewBildirim(), yedek: () => viewYedek(), veri: () => viewVeri(m),
  };
  const tabs = { ozet: () => viewOzet(m), sozlesmeler: () => viewSozlesmeler(m), fonlar: () => viewFonlar(m), sor: () => viewSor(m) };
  const html = p ? views[p.kind]() : tabs[ui.tab]();
  const sheet = ui.sheet ? `<div class="sheet-bg" data-act="sheet-close"><div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(ui.sheet.title)}"><div class="grab"></div><h3>${ui.sheet.title}</h3>${ui.sheet.html}<button class="btn" data-act="sheet-close">Kapat</button></div></div>` : '';
  const toast = ui.toast ? `<div class="toast" role="status">${esc(ui.toast)}</div>` : '';
  root.innerHTML = `<div class="app">${html}</div>${tabbar()}${sheet}${toast}`;
}

// ---------- Bildirim aboneliği ----------
const b64u = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function swReady() {
  await navigator.serviceWorker.register('sw.js', { type: 'module', scope: './' });
  return navigator.serviceWorker.ready;
}

async function notifyOn() {
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return showToast('Bildirim izni verilmedi. iPhone Ayarlar → maliSK → Bildirimler.');
  const reg = await swReady();
  const keys = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const raw = await crypto.subtle.exportKey('raw', keys.publicKey);
  const jwk = await crypto.subtle.exportKey('jwk', keys.privateKey);
  const old = await reg.pushManager.getSubscription();
  if (old) await old.unsubscribe();
  const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: new Uint8Array(raw) });
  const secret = b64u(new TextEncoder().encode(JSON.stringify({ s: sub.toJSON(), k: { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y, d: jwk.d } })));
  state.prefs.notify = true;
  state.push = { secret, date: todayIstanbul() };
  persist();
  showToast('Bildirim açıldı. Son adım: anahtarı GitHub’a ekle.');
}

async function notifyOff() {
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) await sub.unsubscribe();
  } catch { /* zaten kapalı */ }
  state.prefs.notify = false;
  state.push = null;
  persist();
  showToast('Bildirim kapatıldı.');
}

// ---------- Olaylar ----------
function stepNum(v, d, meta) {
  const x = Math.round(((Number(v) || 0) + d * meta.step) / meta.step) * meta.step;
  return Math.min(meta.max, Math.max(meta.min, Number(x.toFixed(4))));
}

const sumShares = (values) => Object.values(values).reduce((a, b) => a + (Number(b) || 0), 0);

function applyProposal() {
  const m = render.m;
  const p = m.proposal;
  if (!p) return;
  const date = latest.data_date;
  state.contracts_history.push(structuredClone(state.contracts));
  state.shares = { date, values: Object.fromEntries(Object.entries(m.drift.shares_now).map(([k, v]) => [k, Math.round(v * 10) / 10])) };
  state.contracts = state.contracts.map((c) => ({ ...c, date, weights: { ...p.weights } }));
  state.decisions.push({ date, action: 'uygulandi', weights: p.weights });
  state.checklist = null;
  ui.stack = [];
  persist();
  showToast('Yeni dağılım tüm sözleşmelere kaydedildi. Sayaçlar sıfırlandı.');
}

root.addEventListener('click', async (e) => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act;
  const m = render.m;
  if (act === 'sheet-close') {
    if (el.classList.contains('sheet-bg') && e.target.closest('.sheet')) return;
    ui.sheet = null;
  } else if (act === 'tab') {
    ui.tab = el.dataset.tab; ui.stack = []; ui.anchorDraft = null; ui.paramDraft = null; ui.shareDraft = null; window.scrollTo(0, 0);
  } else if (act === 'go') {
    const kind = el.dataset.kind;
    if (kind === 'capa') ui.anchorDraft = null;
    if (kind === 'parametreler') ui.paramDraft = null;
    if (kind === 'paylar') ui.shareDraft = null;
    if (kind === 'yapistir') { ui.parsed = null; ui.paste = ''; }
    go({ kind, id: el.dataset.id || null, code: el.dataset.code || null });
  } else if (act === 'back') {
    ui.stack.pop(); ui.confirmDelete = null; window.scrollTo(0, 0);
  } else if (act === 'range') {
    ui[el.dataset.key] = el.dataset.v;
  } else if (act === 'seg') {
    ui.seg = el.dataset.v;
  } else if (act === 'cat') {
    ui.category = el.dataset.cat;
  } else if (act === 'explain') {
    try { ui.sheet = explain(el.dataset.key, m); } catch { ui.sheet = { title: 'Hesap', html: '<p>Bu hesap için yeterli veri yok.</p>' }; }
  } else if (act === 'view') {
    state.views[el.dataset.cls] = Number(el.dataset.v); persist();
  } else if (act === 'tick') {
    const set = new Set(state.checklist?.done || []);
    if (set.has(el.dataset.id)) set.delete(el.dataset.id); else set.add(el.dataset.id);
    state.checklist = { ...state.checklist, done: [...set] }; persist();
  } else if (act === 'reject') {
    state.decisions.push({ date: latest.data_date, action: 'reddedildi' }); ui.stack = []; persist();
    return showToast(`Tamam; ${m.P.decision.confirm_days} iş günü yeni öneri gelmez.`);
  } else if (act === 'parse') {
    // Sözleşme için açıldıysa yalnız o güncellenir; değilse tablo tüm sözleşmelerin yerini alır.
    const forNo = page()?.id || null;
    const known = new Set(latest.funds.map((f) => f.code));
    const halal = new Set(latest.funds.filter((f) => f.halal).map((f) => f.code));
    ui.parsed = parseAllocationTable(ui.paste, { knownCodes: known, halalCodes: halal, defaultContract: forNo || '1' });
    const pasted = Object.keys(ui.parsed.contracts);
    const nos = forNo ? [...new Set([...state.contracts.map((c) => c.no), ...pasted])] : pasted;
    const cur = m.drift?.shares_now || {};
    const kept = nos.filter((no) => cur[no] !== undefined);
    const keptSum = kept.reduce((a, no) => a + cur[no], 0);
    const fresh = nos.filter((no) => cur[no] === undefined);
    const shares = {};
    if (!kept.length) nos.forEach((no) => { shares[no] = Math.round(100 / nos.length); });
    else if (!fresh.length) kept.forEach((no) => { shares[no] = Math.round((cur[no] * 100) / keptSum); });
    else { kept.forEach((no) => { shares[no] = Math.round(cur[no]); }); const left = Math.max(0, 100 - kept.reduce((a, no) => a + Math.round(cur[no]), 0)); fresh.forEach((no) => { shares[no] = Math.round(left / fresh.length); }); }
    ui.pasteShares = Object.fromEntries(nos.map((no) => [no, shares[no]]));
    ui.pasteReplace = !forNo;
  } else if (act === 'paste-clear') {
    ui.paste = ''; ui.parsed = null;
  } else if (act === 'paste-save') {
    if (Math.abs(sumShares(ui.pasteShares) - 100) > 0.5) return showToast('Payların toplamı 100 olmalı.');
    const date = latest.data_date;
    const n = Object.keys(ui.parsed.contracts).length;
    if (state.contracts.length) state.contracts_history.push(structuredClone(state.contracts));
    const byNo = ui.pasteReplace ? {} : Object.fromEntries(state.contracts.map((c) => [c.no, c]));
    for (const [no, c] of Object.entries(ui.parsed.contracts)) byNo[no] = { no, date, weights: Object.fromEntries(Object.entries(c.weights).map(([k, v]) => [k, (v * 100) / c.sum])) };
    state.contracts = Object.values(byNo);
    state.shares = { date, values: { ...ui.pasteShares } };
    state.allocation = null;
    ui.stack = []; ui.tab = 'ozet'; ui.parsed = null; ui.paste = ''; persist();
    return showToast(`${n} sözleşme kaydedildi.`);
  } else if (act === 'share-step') {
    const obj = el.dataset.key === 'paste' ? ui.pasteShares : ui.shareDraft;
    obj[el.dataset.id] = Math.max(0, Math.min(100, Math.round((Number(obj[el.dataset.id]) || 0) + Number(el.dataset.d))));
  } else if (act === 'shares-save') {
    if (Math.abs(sumShares(ui.shareDraft) - 100) > 0.5) return showToast('Payların toplamı 100 olmalı.');
    state.shares = { date: latest.data_date, values: { ...ui.shareDraft } }; ui.shareDraft = null; ui.stack.pop(); persist();
    return showToast('Paylar kaydedildi.');
  } else if (act === 'delete-contract') {
    if (ui.confirmDelete !== el.dataset.id) { ui.confirmDelete = el.dataset.id; }
    else {
      state.contracts_history.push(structuredClone(state.contracts));
      state.contracts = state.contracts.filter((c) => c.no !== el.dataset.id);
      if (state.shares?.values) delete state.shares.values[el.dataset.id];
      ui.confirmDelete = null; ui.stack.pop(); persist();
      return showToast('Sözleşme silindi. Payları kontrol et.');
    }
  } else if (act === 'astep') {
    const d = ui.anchorDraft;
    d.groups[el.dataset.g] = String(Math.max(0, Math.min(100, (Number(d.groups[el.dataset.g]) || 0) + Number(el.dataset.d))));
  } else if (act === 'anchor-copy') {
    ui.anchorDraft = anchorDraftFrom(latest.anchor.user_groups.weights, m);
  } else if (act === 'anchor-save') {
    const a = draftAnchor(ui.anchorDraft);
    const sum = Object.values(a.groups).reduce((x, y) => x + y, 0);
    if (!Object.keys(a.groups).length || Math.abs(sum - 100) > 0.5) return showToast(`Çapa toplamı ${num(sum, 0)}; 100 olmalı.`);
    state.anchor = a; state.anchor_date = todayIstanbul(); ui.anchorDraft = null; ui.stack.pop(); persist();
    return showToast('Çapan kaydedildi.');
  } else if (act === 'pstep') {
    const meta = PARAM_META.find((x) => x.key === el.dataset.key);
    const cur = getPath(effectiveParams(DEFAULT_PARAMS, ui.paramDraft, PARAM_META), meta.key);
    const v = stepNum(cur, Number(el.dataset.d), meta);
    if (v === getPath(DEFAULT_PARAMS, meta.key)) delete ui.paramDraft[meta.key]; else ui.paramDraft[meta.key] = v;
  } else if (act === 'params-reset') {
    ui.paramDraft = {};
  } else if (act === 'params-save') {
    const errs = validateParams(effectiveParams(DEFAULT_PARAMS, ui.paramDraft, PARAM_META));
    if (errs.length) return showToast(errs[0]);
    const n = (state.params.n || 0) + 1;
    state.params = { n, date: todayIstanbul(), values: { ...ui.paramDraft } };
    state.param_history.push(structuredClone(state.params));
    ui.stack.pop(); ui.paramDraft = null; persist();
    return showToast(`Parametre sürümü ${paramVersion(DEFAULT_PARAMS, state.params)} kaydedildi.`);
  } else if (act === 'size' || act === 'theme') {
    state.prefs[act] = el.dataset.v; applyPrefs(); persist();
  } else if (act === 'founder-toggle') {
    const all = companies(compute(latest, state)).map((c) => c.code);
    const cur = new Set(state.founders?.length ? state.founders : all);
    if (cur.has(el.dataset.v)) cur.delete(el.dataset.v); else cur.add(el.dataset.v);
    if (!cur.size) return showToast('En az bir firma seçili kalmalı.');
    state.founders = cur.size === all.length ? null : all.filter((c) => cur.has(c));
    persist();
  } else if (act === 'founders-all') {
    state.founders = null; persist();
  } else if (act === 'notify-toggle') {
    try { if (state.prefs.notify) await notifyOff(); else await notifyOn(); } catch (err) { showToast(`Bildirim açılamadı: ${err.message}`); }
    return;
  } else if (act === 'notify-test') {
    try {
      const reg = await swReady();
      const n = dailyNotice(compute(latest, state, { withProposal: true }), GROUP_LABELS, CLASS_LABELS);
      await reg.showNotification(n.title, { body: n.body, tag: 'malisk-test', icon: 'icons/icon-192.png' });
    } catch (err) { showToast(`Gösterilemedi: ${err.message}`); }
    return;
  } else if (act === 'copy-key') {
    return copyText(state.push.secret, 'Anahtar kopyalandı. GitHub’da MALISK_PUSH olarak ekle.');
  } else if (act === 'ask') {
    const labels = { today: 'Bugün ne yapmalıyım?', why: 'En büyük sapma neden?', funds: 'Fonlarım iyi mi?' };
    ui.chat.push({ q: labels[el.dataset.q], a: answer(m, el.dataset.q) });
  } else if (act === 'claude') {
    const mm = compute(latest, state, { withProposal: true });
    return copyText(buildPrompt({ latest: mm.latest, state: mm.state, drift: mm.drift, targets: mm.targets, bands: mm.bands, due: mm.due, proposal: mm.proposal }), 'Kopyalandı. Claude uygulamasını açıp yapıştır.');
  } else if (act === 'claude-fund') {
    const f = fundIndex(m.latest)[el.dataset.code];
    return copyText(buildFundPrompt({ latest: m.latest, fund: f, weight: m.drift?.current?.[f.code] ?? null }), 'Kopyalandı. Claude uygulamasını açıp yapıştır.');
  } else if (act === 'backup') {
    return copyText(exportState(state), 'Yedek kopyalandı. Güvenli bir yere yapıştır.');
  } else if (act === 'restore-do') {
    try { state = migrateState(importState(document.getElementById('restore-text').value)); persist(); applyPrefs(); ui.stack.pop(); return showToast('Yedek geri yüklendi.'); } catch (err) { return showToast(err.message || 'Yedek okunamadı.'); }
  } else if (act === 'reload') {
    return load();
  } else if (act === 'noop') {
    return;
  }
  render();
});

root.addEventListener('input', (e) => {
  const el = e.target;
  const kind = el.dataset.in;
  if (kind === 'paste') ui.paste = el.value;
  else if (kind === 'share') {
    const obj = el.dataset.key === 'paste' ? ui.pasteShares : ui.shareDraft;
    obj[el.dataset.id] = Number(el.value.replace(',', '.')) || 0;
    const s = sumShares(obj);
    const out = document.getElementById(`share-sum-${el.dataset.key}`);
    if (out) out.textContent = `Toplam %${num(s, 0)}${Math.abs(s - 100) > 0.5 ? ' · 100 olmalı' : ' ✓'}`;
  } else if (kind === 'agroup') {
    ui.anchorDraft.groups[el.dataset.g] = el.value.replace(',', '.');
    const s = Object.values(ui.anchorDraft.groups).reduce((a, b) => a + (Number(b) || 0), 0);
    document.getElementById('anchor-sum').textContent = `Toplam %${num(s, 0)}${Math.abs(s - 100) > 0.5 ? ' · 100 olmalı' : ' ✓'} · boş bırakılan grup izlenir`;
  } else if (kind === 'split') {
    const g = el.dataset.g;
    const v = Number(el.value);
    ui.anchorDraft.splits[g] = v;
    el.style.setProperty('--p', v + '%');
    document.querySelector(`[data-out="s1-${g}"]`).textContent = v;
    document.querySelector(`[data-out="s2-${g}"]`).textContent = 100 - v;
    const bt = document.getElementById('bt');
    if (bt) bt.innerHTML = btBlock(classAnchor(TREE, normalizeAnchor(TREE, draftAnchor(ui.anchorDraft))));
  } else if (kind === 'slide') {
    const knob = el.parentElement.querySelector('.knob');
    const w = el.parentElement.clientWidth - knob.clientWidth - 10;
    knob.style.transform = `translateX(${(Number(el.value) / 100) * w}px)`;
  }
});

root.addEventListener('change', (e) => {
  const el = e.target;
  if (el.dataset.in === 'slide') {
    if (Number(el.value) >= 92) applyProposal();
    else { el.value = 0; el.parentElement.querySelector('.knob').style.transform = ''; }
  } else if (el.dataset.in === 'agroup') {
    const bt = document.getElementById('bt');
    if (bt) bt.innerHTML = btBlock(classAnchor(TREE, normalizeAnchor(TREE, draftAnchor(ui.anchorDraft))));
  }
});

window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', applyPrefs);

async function load() {
  loadError = null;
  try {
    const res = await fetch('data/latest.json?t=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    latest = await res.json();
  } catch (err) {
    if (!latest) loadError = err.message;
  }
  render();
}

// İlk açılış: eski tek dağılımı sözleşme 1'e taşı; bildirim açıksa service worker'ı tazele.
if (!state.contracts.length && state.allocation) { state = migrateState(state); state.allocation = null; persist(); } else mirror();
if (state.prefs.notify && 'serviceWorker' in navigator) swReady().catch(() => {});
applyPrefs();
load();
