// maliSK telefon arayüzü. Veri: data/latest.json; kişisel durum: localStorage.
// Özetten ayrıntıya: Özet → Dağılım → Grup → Fon → Hesap (dokununca açılan sayfa).
import { DEFAULT_PARAMS as P, CLASS_LABELS, CATEGORY_LABELS, GROUP_LABELS } from '../model/params.mjs';
import { alertThreshold } from '../model/bands.mjs';
import { normalizeAnchor, managedClasses } from '../model/tree.mjs';
import { loadState, saveState, exportState, importState } from './state.mjs';
import { driftWeights, targetsToday, bandHistory, recommendationDue, buildProposal, currentExposure, ANCHOR_CLASSES, fundIndex } from './personal.mjs';
import { buildPrompt, buildFundPrompt } from './claude.mjs';
import { num, pct, signed, esc, dateTr, moneyTl, people, fundNames, FLAG_LABELS, todayIstanbul } from './format.mjs';

const TREE = P.anchor.tree;
const C_DAYS = P.decision.confirm_days;
const CLASS_VAR = { gold: '--c-gold', silver: '--c-silver', tl_fixed: '--c-tl', equity_tr: '--c-yi', equity_foreign: '--c-yd', fx_fixed: '--c-fx', unclassified: '--c-unc' };
const GROUP_VAR = { precious_metals: '--c-gold', equity: '--c-yi', tl_fixed: '--c-tl', fx: '--c-fx' };
const CATEGORY_ORDER = ['gold', 'precious_metals', 'silver', 'equity', 'mixed', 'money_market', 'lease_tl', 'fx', 'standard', 'starter', 'state_contribution', 'receivables', 'unclassified'];
const HEAD_KIND = { gold: 'gold', precious_metals: 'gold', silver: 'silver', equity: 'equity', money_market: 'tl', lease_tl: 'tl', starter: 'tl', standard: 'tl', state_contribution: 'tl', receivables: 'tl', fx: 'fx' };
const VIEW = { positive: ['↑ Olumlu', 'pos'], neutral: ['→ Nötr', 'mut'], negative: ['↓ Olumsuz', 'neg'] };
const PERIOD_LABELS = { '1m': '1 ay', '3m': '3 ay', '6m': '6 ay', ytd: 'Yılbaşı', '1y': '1 yıl', '3y': '3 yıl', '5y': '5 yıl' };
const SIZES = [['m', 'Büyük'], ['l', 'Daha büyük'], ['xl', 'En büyük'], ['sys', 'iPhone ayarı']];
const THEMES = [['auto', 'Otomatik'], ['light', 'Açık'], ['dark', 'Koyu']];
const DAYS_TR = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
const MONTHS_TR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

const ICON = {
  home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  pie: '<path d="M21.2 15.9A10 10 0 1 1 8 2.8"/><path d="M22 12A10 10 0 0 0 12 2v10z"/>',
  list: '<path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  bell: '<path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  check: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
  arrow: '<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>',
  back: '<path d="m15 18-6-6 6-6"/>',
  right: '<path d="m9 18 6-6-6-6"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
  bulb: '<path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"/>',
  gold: '<path d="M3 19h18l-3.5-8h-11z"/><path d="M8 11l1.5-5h5L16 11"/>',
  silver: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/>',
  equity: '<path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 6-7"/>',
  tl: '<path d="M9 3v14a4 4 0 0 0 8-1"/><path d="m5 10 10-4"/><path d="m5 14 10-4"/>',
  fx: '<path d="M12 2v20"/><path d="M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
  mixed: '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>',
};
const svg = (name, size = 24, sw = 2.2) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[name]}</svg>`;
const chev = (dir = 'right') => `<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[dir]}</svg>`;
const cv = (c) => `style="--cls: var(${CLASS_VAR[c]})"`;
const gv = (g) => `style="--cls: var(${GROUP_VAR[g]})"`;

let state = loadState();
let latest = null;
let loadError = null;
const ui = { tab: 'ozet', stack: [], category: null, open: new Set(['precious_metals']), sheet: null, toast: null, alloc: null, anchorDraft: null };
const root = document.getElementById('app');
const page = () => ui.stack[ui.stack.length - 1] || null;

function applyPrefs() {
  const html = document.documentElement;
  const { size, theme } = state.prefs;
  if (size === 'l') delete html.dataset.size; else html.dataset.size = size;
  if (theme === 'auto') delete html.dataset.theme; else html.dataset.theme = theme;
  const dark = theme === 'dark' || (theme === 'auto' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => {
    if (theme === 'auto') m.setAttribute('content', m.media.includes('dark') ? '#1A1D1C' : '#F3F5F4');
    else m.setAttribute('content', dark ? '#1A1D1C' : '#F3F5F4');
  });
}

function persist() {
  if (!saveState(state)) showToast('Telefon hafızasına yazılamadı. Yedeği kopyalamayı unutma.');
}

function showToast(text) {
  ui.toast = text;
  render();
  setTimeout(() => { if (ui.toast === text) { ui.toast = null; render(); } }, 2800);
}

async function copyText(text, okMsg) {
  try {
    await navigator.clipboard.writeText(text);
    showToast(okMsg);
  } catch {
    ui.sheet = { title: 'Metni kopyala', html: `<p>Otomatik kopyalanamadı. Metni seçip kopyala.</p><textarea class="inp" readonly>${esc(text)}</textarea>` };
    render();
  }
}

function go(p) {
  ui.stack.push(p);
  window.scrollTo(0, 0);
}

// ---------- Kişisel hesap ----------
function suggestedAnchor() {
  return latest.anchor?.ok ? latest.anchor.user_groups.weights : null;
}

function derive() {
  if (!latest) return {};
  const suggested = suggestedAnchor();
  const anchor = state.anchor || suggested;
  const m = { anchorIsDefault: !state.anchor && !!suggested };
  if (state.allocation) {
    m.drift = driftWeights(latest, state.allocation);
    m.expoNow = currentExposure(latest, m.drift.current);
  }
  if (anchor) m.targets = targetsToday(latest, anchor, state.views, P, m.expoNow || null);
  if (m.drift && m.targets) {
    m.bands = bandHistory(latest, m.drift, m.targets, P);
    m.due = recommendationDue(m.bands, state.decisions, latest.data_date, P);
    if (m.due.active || page()?.kind === 'oneri') {
      try { m.proposal = buildProposal(latest, m.drift.current, m.bands, m.targets.targets, P); } catch (e) { m.proposalError = e.message; }
    }
  }
  return m;
}

function groupStatus(m, g) {
  const b = m.bands?.groups[g];
  if (!b) return { text: '◌ İzleniyor', tone: 'n' };
  const n = m.bands.counters['group:' + g] || 0;
  const sp = m.bands.splits[g];
  const spOut = sp && Object.values(sp).some((x) => x.status !== 'inside');
  const ns = m.bands.counters['split:' + g] || 0;
  if (b.status !== 'inside') return n >= C_DAYS ? { text: b.status === 'above' ? '↑ Fazla' : '↓ Eksik', tone: 'bad', days: n } : { text: '◷ Takipte', tone: 'warn', days: n };
  if (spOut) return ns >= C_DAYS ? { text: '⇄ Grup içi', tone: 'bad', days: ns } : { text: '◷ Takipte', tone: 'warn', days: ns };
  return { text: '✓ Dengede', tone: 'ok', days: 0 };
}

function dueText(m, key) {
  const [kind, g] = key.split(':');
  if (kind === 'group') return `${GROUP_LABELS[g]} hedefinin ${m.bands.groups[g].status === 'above' ? 'üstünde' : 'altında'}`;
  const out = Object.entries(m.bands.splits[g]).filter(([, x]) => x.status !== 'inside').map(([c, x]) => `${CLASS_LABELS[c]} payı ${x.status === 'above' ? 'fazla' : 'az'}`);
  return `${GROUP_LABELS[g]} içinde ${out.join(', ')}`;
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

function fundReason(f) {
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

const scoreTone = (s) => (s === null ? '' : s >= 55 ? 'ok' : s < 45 ? 'bad' : '');

function stripe(exposure, cls = 'stack thin') {
  const parts = [...ANCHOR_CLASSES, 'unclassified'].filter((c) => exposure[c] > 0.05);
  return `<div class="${cls}">${parts.map((c) => `<i style="width:${exposure[c]}%;background:var(${CLASS_VAR[c]})"></i>`).join('')}</div>`;
}

// ---------- Açıklama sayfaları (her hesaplanmış sayı dokununca) ----------
function sheetTable(rows, sumRow) {
  return `<table>${rows.map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join('')}${sumRow ? `<tr class="sum"><td>${sumRow[0]}</td><td>${sumRow[1]}</td></tr>` : ''}</table>`;
}

function explain(key, m) {
  const [kind, id] = key.split(':');
  const funds = fundIndex(latest);
  const t = P.tactical;
  if (kind === 'target') {
    const g = m.targets.groups[id];
    const rows = g.classes.map((c) => [`${CLASS_LABELS[c]} S × pay`, `${signed(m.targets.rows[c].S, 2)} × %${num(g.splits[c], 0)}`]);
    return {
      title: `${GROUP_LABELS[id]} hedefi`,
      html: `<div class="formula">S (sınıf) = 0,50 × T + 0,25 × M + 0,25 × K<br>S (grup) = Σ grup içi pay × S<br>eğim = ${t.max_tilt_pts} × S / ${num(t.full_tilt_at, 1)} (en çok ±${t.max_tilt_pts})<br>hedef = (çapa + eğim) × 100 / Σ(çapa + eğim) × (100 − izlenen) / 100<br>sınıf hedefi = grup hedefi × grup içi pay</div>`
        + sheetTable([...rows, ['S (grup)', signed(g.S, 2)], ['Eğim', signed(g.tilt, 2) + ' puan'], ['Çapa', num(g.anchor, 1)],
          ['Çapa + eğim', num(Math.max(0, g.anchor + g.tilt), 2)], ['Tüm grupların toplamı', num(m.targets.raw_sum, 2)],
          ['İzlenen sınıfların payı', num(m.targets.unmanaged_share, 2)]], ['Hedef', num(g.target, 2)])
        + (g.classes.length > 1 ? sheetTable(g.classes.map((c) => [`${CLASS_LABELS[c]} hedefi`, `${num(g.target, 2)} × %${num(g.splits[c], 0)} = ${num(m.targets.targets[c], 2)}`])) : '')
        + '<p class="mut">Görüş yalnız grubu kaydırır; grup içi pay çapadaki gibi kalır.</p>',
    };
  }
  if (kind === 'band') {
    const b = m.bands.groups[id];
    const d = P.decision;
    return {
      title: `${GROUP_LABELS[id]} aralığı`,
      html: `<div class="formula">genişlik = hedef × %${d.band_rel_pct}, en az ${d.band_min_pts}, en çok ${d.band_max_pts} puan<br>grup payı = yönetilen sınıflarının toplamı</div>`
        + sheetTable([['Hedef', num(b.target, 2)], ['Genişlik', '±' + num(b.width, 2)], ['Aralık', `${num(b.low, 2)} – ${num(b.high, 2)}`],
          ['Şu an', num(b.value, 2)], ['Aralık dışında', `${m.bands.counters['group:' + id] || 0} iş günü (öneri ${C_DAYS} günde)`]])
        + '<p class="mut">Sayaç geçmiş günleri bugünkü hedefle değerlendirir.</p>'
        + managedClasses(TREE, m.targets.anchor, id).map((c) => `<button class="more" data-act="explain" data-key="expo:${c}">${CLASS_LABELS[c]} payı nasıl hesaplandı? ›</button>`).join(''),
    };
  }
  if (kind === 'split') {
    const sp = m.bands.splits[id];
    const d = P.decision;
    return {
      title: `${GROUP_LABELS[id]} grup içi pay`,
      html: `<div class="formula">grup içi pay = sınıf payı / grup payı × 100<br>aralık = hedef pay ± ${d.split_band_pts} puan<br>grup %${d.split_min_group_pct}'ten küçükse denetlenmez</div>`
        + sheetTable(Object.entries(sp).map(([c, x]) => [CLASS_LABELS[c], `${num(x.value, 1)} · hedef ${num(x.target, 0)} · ${num(x.low, 0)}–${num(x.high, 0)}${x.skipped ? ' · denetlenmiyor' : ''}`]))
        + sheetTable([['Aralık dışında', `${m.bands.counters['split:' + id] || 0} iş günü (öneri ${C_DAYS} günde)`]]),
    };
  }
  if (kind === 'expo') {
    const rows = Object.entries(m.drift.current).map(([code, w]) => {
      const e = funds[code]?.exposure?.[id] ?? 0;
      return [`${esc(code)}: %${num(w, 1)} × %${num(e, 1)}`, num((w * e) / 100, 2)];
    }).filter((r) => r[1] !== '0,00');
    return {
      title: `${CLASS_LABELS[id]} payı`,
      html: '<div class="formula">pay = Σ fon ağırlığı × fonun bu sınıftaki içerik payı<br>fon ağırlığı = girişteki ağırlık, fiyatla kaydırılmış</div>' + sheetTable(rows, ['Toplam', num(m.bands.exposure[id], 2)]),
    };
  }
  if (kind === 'view') {
    const r = m.targets.rows[id];
    const info = latest.classes[id] || {};
    const sig = info.trend?.signals || {};
    const sl = (k) => (sig[k] === 1 ? '+1' : sig[k] === -1 ? '−1' : 'yok');
    return {
      title: `${CLASS_LABELS[id]} görüşü`,
      html: `<p>${esc(trendSentence(id))}</p><div class="formula">T = dört sinyalin ortalaması<br>S = 0,50 × T + 0,25 × M + 0,25 × K<br>S ≥ ${num(t.positive_threshold, 2)} Olumlu · S ≤ ${num(t.negative_threshold, 2)} Olumsuz</div>`
        + sheetTable([['1 ay', sl('r1m')], ['3 ay', sl('r3m')], ['12 ay', sl('r12m')], ['210 gün ortalama', sl('ma')], ['T', signed(r.T, 2)],
          ['M (makro)', signed(r.M, 0) + (info.macro === null || info.macro === undefined ? ' · veri yok' : '')], ['K (senin görüşün)', signed(r.K, 0)]], ['S', signed(r.S, 2)])
        + (info.series_ok ? '' : '<p class="mut">Bu sınıfta yeterli veri yok; görüş nötr sayılır.</p>'),
    };
  }
  if (kind === 'ret') {
    const s = m.drift.series;
    const prev = s.length > 1 ? s[s.length - 2].value : 1;
    return {
      title: 'Dağılım getirisi',
      html: '<div class="formula">getiri = Σ giriş ağırlığı × (bugünkü fiyat / giriş günündeki fiyat) − 1</div>'
        + sheetTable([['Başlangıç', dateTr(m.drift.start_date)], ['Bugün', dateTr(s[s.length - 1].date)], ['Son gün', pct((s[s.length - 1].value / prev - 1) * 100, 2, true)]], ['Toplam', pct(m.drift.return_pct, 2, true)])
        + '<p class="mut">Katkı payları ve fon giriş-çıkışları hesaba katılmaz; yalnız fiyat değişimi.</p>',
    };
  }
  if (kind === 'score') {
    const f = funds[id];
    const w = P.fund_quality.weights;
    const c = f.components || {};
    const passive = P.universe.passive_categories.includes(f.category);
    const names = { consistency: 'Süreklilik', excess_index: 'Fazla getiri indisi', risk: passive ? 'İzleme hatası' : 'Düşüş riski', cost: 'Maliyet', hygiene: 'Düzen' };
    const used = Object.keys(w).filter((k) => c[k] !== null && c[k] !== undefined);
    const den = used.reduce((s, k) => s + w[k], 0);
    const rows = Object.keys(w).map((k) => [names[k], c[k] === null || c[k] === undefined ? 'veri yok' : `${num(w[k], 2)} × ${num(c[k], 3)}`]);
    return {
      title: `${esc(f.code)} puanı`,
      html: '<div class="formula">puan = 100 × Σ ağırlık × bileşen / Σ ağırlık<br>bileşen = 0,5 + (değer − kategori medyanı) / (2 × ölçek)<br>puan = 50 + güven × (ham − 50)</div>'
        + sheetTable([...rows, ['Kullanılan ağırlık', num(den, 2)], ['Ham puan', num(f.raw_score, 1)],
          ['Güven (geçmiş / 36 ay)', `${num(f.history_months, 0)} ay → %${num((f.confidence ?? 1) * 100, 0)}`]], ['Puan', num(f.score, 1)])
        + `<p class="mut">50 puan kategori ortasıdır. Ücret ${pct(f.fee, 2)} (TEFAS).</p>`,
    };
  }
  if (kind === 'alert') {
    const a = latest.classes[id];
    return {
      title: `${CLASS_LABELS[id]} acil uyarı`,
      html: `<div class="formula">eşik = ${num(P.decision.alert_sigma_mult, 1)} × yıllık oynaklık × √(${P.decision.alert_window_days} / 252)</div>`
        + sheetTable([['Son 20 iş günü', pct(a.alert.change_pct, 2)], ['Yıllık oynaklık', pct(a.vol_annual_pct, 1)],
          ['Eşik', '−' + pct(alertThreshold(a.vol_annual_pct, P.decision), 2)], ['Normal 20 günlük oynaklığın katı', num(a.alert.sigma_multiple, 2)]]),
    };
  }
  if (kind === 'anchor') {
    const a = latest.anchor;
    const u = a.user_groups;
    const missing = ANCHOR_CLASSES.filter((c) => c !== 'tl_fixed' && !a.ids.includes(c)).map((c) => CLASS_LABELS[c]);
    return {
      title: 'Çapa önerisi nasıl hesaplandı?',
      html: `<div class="formula">1. Son ${a.weeks} haftanın getirilerinden risk ve ilişki<br>2. Önce grup içinde, sonra gruplar arasında eşit risk<br>3. k = min(1, %${P.anchor.target_vol_pct} / riskli oynaklık); kalan TL sabit<br>4. Sınıf tavanı %${P.anchor.class_cap_pct}</div>`
        + sheetTable([['Riskli sepet oynaklığı', pct(u.risky_vol_pct, 1)], ['Riskli pay (k)', pct(u.k * 100, 0)],
          ...Object.entries(u.weights).map(([c, w]) => [CLASS_LABELS[c], num(w, 1)])])
        + (missing.length ? `<p class="mut">Yeterli verisi olmayan sınıflar öneride yok: ${missing.join(', ')}.</p>` : '')
        + `<p class="mut">Veriye göre gruplama: ${a.suggested.groups.map((g) => g.map((c) => CLASS_LABELS[c]).join(' + ')).join(' · ')}</p>`
        + (u.warnings.includes('negative_real_rate') ? '<p class="neg">Reel faiz negatif: TL sabit önerisi yarıya indirildi.</p>' : ''),
    };
  }
  if (kind === 'proposal') {
    const p = m.proposal;
    return {
      title: 'Öneri nasıl hesaplandı?',
      html: `<div class="formula">en küçük Σ (sınıf payı − hedef)² + ${P.allocation.fee_lambda} × Σ ağırlık × ücret<br>ağırlıklar ≥ 0, toplam 100; yeni fon en çok %${P.fund_quality.new_fund_cap_pct}</div>`
        + `<p>Ana sınıfı aralık içinde olan fonlar sabit tutulur. Aynı kategorideki fon ancak puanı ${P.decision.switch_score_gap} puan yüksekse aday olur.</p>`
        + (p.notes.length ? sheetTable(p.notes.map((n) => [esc(n.code), esc(n.kind === 'sabit' ? 'sabit: ' + n.text : 'aday değil: ' + n.text)])) : '')
        + `<p class="mut">Parametre sürümü ${latest.param_version} · veri ${dateTr(latest.data_date)}</p>`,
    };
  }
  return { title: '', html: '' };
}

// ---------- Ortak parçalar ----------
function tabbar() {
  const t = [['ozet', 'Özet', 'home'], ['dagilim', 'Dağılım', 'pie'], ['fonlar', 'Fonlar', 'list'], ['ayarlar', 'Ayarlar', 'gear']];
  return `<nav class="tabbar" aria-label="Sekmeler">${t.map(([k, l, i]) => `<button data-act="tab" data-tab="${k}" class="${ui.tab === k ? 'on' : ''}"${ui.tab === k ? ' aria-current="page"' : ''}>${svg(i, 28, ui.tab === k ? 2.2 : 2)}${l}</button>`).join('')}</nav>`;
}

function topMain(title, kicker, extra = '') {
  return `<header class="top"><div>${kicker ? `<span class="kicker">${kicker}</span>` : ''}<h1>${title}</h1></div>${extra}</header>`;
}

function topSub(title, backLabel, lead = '', dot = '') {
  return `<header class="top sub"><button class="back" data-act="back">${svg('back', 24, 2.5)}${backLabel}</button><h1>${dot}${title}</h1>${lead ? `<p class="lead">${lead}</p>` : ''}</header>`;
}

function backLabel() {
  const prev = ui.stack[ui.stack.length - 2];
  if (prev) return { oneri: 'Öneri', grup: GROUP_LABELS[prev.id] || 'Geri', fon: prev.code, capa: 'Çapa' }[prev.kind] || 'Geri';
  return { ozet: 'Özet', dagilim: 'Dağılım', fonlar: 'Fonlar', ayarlar: 'Ayarlar' }[ui.tab];
}

function todayLong() {
  const d = new Date(todayIstanbul() + 'T12:00:00Z');
  return `${DAYS_TR[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTHS_TR[d.getUTCMonth()]}`;
}

function noAllocation() {
  return `<section class="hero"><div class="kick">${svg('bell', 24, 2)}BAŞLAMAK İÇİN</div><h2>Dağılımını gir</h2>
    <p>Emeklilik şirketinin ekranındaki birikiminin fon yüzdelerini gir. Tutar gerekmez; bilgi yalnız bu telefonda kalır.</p>
    <button class="go" data-act="go" data-kind="alloc">Dağılımımı gir ${svg('arrow', 22, 2.5)}</button></section>`;
}

// ---------- Özet ----------
function viewOzet(m) {
  const parts = [];
  for (const [c, v] of Object.entries(latest.classes)) {
    if (!v.alert?.triggered) continue;
    const share = m.bands ? ` Dağılımındaki payı %${num(m.bands.exposure[c], 1)}.` : '';
    parts.push(`<button class="alertbox" data-act="explain" data-key="alert:${c}"><span class="t">ACİL UYARI</span>
      <p><b>${CLASS_LABELS[c]} 20 iş gününde ${pct(v.alert.change_pct, 1)}.</b> Normal oynaklığının ${num(v.alert.sigma_multiple, 1)} katı.${share}</p>
      <p class="mut">İnceleme çağrısı; dağılım önerisi değil.</p></button>`);
  }
  if (!state.allocation) parts.push(noAllocation());
  else if (m.due?.active) {
    const steps = m.proposal ? m.proposal.changes.filter((c) => Math.round(c.from) !== c.to).length : 0;
    const why = m.due.due.map((k) => dueText(m, k));
    parts.push(`<section class="hero"><div class="kick">${svg('bell', 24, 2)}BUGÜN</div><h2>1 önerin var</h2>
      <p>${esc(why.join('; '))}.${steps ? ` ${steps} adımda dengelenir.` : ''}</p>
      <button class="go" data-act="go" data-kind="oneri">Öneriyi gör ${svg('arrow', 22, 2.5)}</button></section>`);
  } else if (m.due?.suppressed) {
    parts.push(`<section class="hero calm"><div class="kick">${svg('clock', 24, 2)}BEKLEMEDE</div><h2>Öneri ertelendi</h2><p>Son öneriye "Şimdi değil" dedin; ${C_DAYS} iş günü yeni öneri gelmez.</p></section>`);
  } else if (m.bands) {
    const watch = Object.keys(m.targets.groups).map((g) => [g, groupStatus(m, g)]).filter(([, s]) => s.tone === 'warn');
    parts.push(`<section class="hero calm"><div class="kick">${svg('check', 24, 2)}BUGÜN</div><h2>Yapılacak bir şey yok</h2>
      <p>${watch.length ? watch.map(([g, s]) => `${GROUP_LABELS[g]} ${s.days}/${C_DAYS} gündür aralık dışında; izleniyor.`).join(' ') : 'Dağılımın hedeflerinin aralığında.'}</p></section>`);
  }
  if (m.anchorIsDefault) {
    parts.push(`<div class="infobox"><span class="t">Çapa</span><p>Kendi çapan yok; uygulamanın önerisi kullanılıyor.</p><button class="more" data-act="go" data-kind="capa">Çapanı belirle ›</button></div>`);
  }
  if (m.bands) {
    const rows = Object.keys(m.targets.groups).map((g) => {
      const b = m.bands.groups[g];
      const s = groupStatus(m, g);
      return `<button class="row" data-act="go" data-kind="grup" data-id="${g}"><span class="l"><span class="nm" ${gv(g)}><span class="dot"></span>${GROUP_LABELS[g]}</span>
        <span class="s ind">%${num(b.value, 1)} · hedef %${num(b.target, 0)}</span></span><span class="r"><span class="chip ${s.tone}">${s.text}</span></span></button>`;
    }).join('');
    parts.push(`<section class="card list"><div class="cardhead" style="padding-top:.75rem"><h2>Dağılımın</h2><button class="more" data-act="tab" data-tab="dagilim">Tümü ›</button></div>${rows}</section>`);
    const s = m.drift.series;
    const day = s.length > 1 ? (s[s.length - 1].value / s[s.length - 2].value - 1) * 100 : null;
    parts.push(`<button class="card" data-act="explain" data-key="ret" style="border:0;text-align:left;color:inherit"><span class="mut" style="font-size:1rem;font-weight:500">Dağılım tarihinden bu yana</span>
      <span class="bignum ${m.drift.return_pct < 0 ? 'neg' : 'pos'}">${pct(m.drift.return_pct, 1, true)}</span>
      <span class="mut">${dateTr(m.drift.start_date)}'den beri${day !== null ? ` · son gün ${pct(day, 1, true)}` : ''}</span></button>`);
    if (m.drift.stale) parts.push(`<p class="note">Dağılım tarihin ${dateTr(state.allocation.date)}; hesap ${dateTr(m.drift.start_date)} tarihinden başlıyor. Şirket ekranından güncellemeni öneririm.</p>`);
    if (m.drift.missing.length) parts.push(`<p class="note neg">Veride bulunamayan fon: ${m.drift.missing.map(esc).join(', ')}</p>`);
  }
  if (m.targets) {
    const chips = ANCHOR_CLASSES.filter((c) => latest.classes[c]).map((c) => {
      const r = m.targets.rows[c];
      const ok = latest.classes[c].series_ok;
      const [lbl, tone] = ok ? VIEW[r.label] : ['Veri az', 'mut'];
      return `<button class="vchip" data-act="explain" data-key="view:${c}"><b>${CLASS_LABELS[c]}</b><span class="${tone}">${lbl}</span></button>`;
    }).join('');
    parts.push(`<section class="card"><div class="cardhead"><h2>Piyasa görüşü</h2></div><div class="views">${chips}</div><p class="note" style="margin:0">Görüş hedefi en çok ±${P.tactical.max_tilt_pts} puan kaydırır; öneriyi aralık dışına çıkış başlatır.</p></section>`);
  }
  parts.push(`<button class="btn outline" data-act="claude">${svg('chat', 24, 2)}Claude'a danış</button>`);
  parts.push(`<p class="note center">Veri ${dateTr(latest.data_date)} · ${latest.sources.tefas.halal} helal fon · model ${esc(latest.model_version)}</p>`);
  return topMain('Özet', todayLong(), '<button class="round" data-act="tab" data-tab="ayarlar" aria-label="Yazı boyutu ve ayarlar">Aa</button>') + `<main>${parts.join('')}</main>`;
}

// ---------- Öneri ----------
function viewOneri(m) {
  const top = topSub('Öneri', backLabel());
  if (m.proposalError) return top + `<main><div class="warnbox"><span class="t">Öneri üretilemedi</span><p>${esc(m.proposalError)}</p></div></main>`;
  const p = m.proposal;
  if (!p) return top + '<main><p class="empty">Şu an öneri yok.</p></main>';
  const funds = fundIndex(latest);
  const parts = [];
  if (m.due?.due.length) {
    parts.push(`<section class="card">${m.due.due.map((k) => {
      const [kind, g] = k.split(':');
      const b = m.bands.groups[g];
      const chip = kind === 'group' ? `<span class="chip bad" style="align-self:flex-start">${b.status === 'above' ? '↑' : '↓'} ${GROUP_LABELS[g]} ${b.status === 'above' ? 'fazla' : 'eksik'}</span>` : `<span class="chip bad" style="align-self:flex-start">⇄ ${GROUP_LABELS[g]} grup içi</span>`;
      const body = kind === 'group'
        ? `<p style="font-size:1.1rem"><button class="tap" data-act="explain" data-key="band:${g}">${GROUP_LABELS[g]} %${num(b.value, 1)}</button>. Hedef %${num(b.target, 0)}, izin verilen aralık %${num(b.low, 0)}–${num(b.high, 0)}.</p>`
        : `<p style="font-size:1.1rem"><button class="tap" data-act="explain" data-key="split:${g}">${esc(dueText(m, k))}</button>.</p>`;
      return chip + body + `<p class="mut">${m.bands.counters[k]} iş günüdür aralığın dışında, bu yüzden öneri oluştu.</p>`;
    }).join('')}</section>`);
  } else {
    parts.push('<p class="note">Henüz teyit edilmiş bir aralık dışı yok; bu öneri bilgi içindir.</p>');
  }
  const moves = p.changes.filter((c) => Math.round(c.from) !== c.to);
  const keep = p.changes.filter((c) => Math.round(c.from) === c.to && c.to > 0);
  parts.push('<h2 class="sectitle">Yapılacaklar</h2>');
  parts.push(`<section class="card list">${moves.map((c, i) => {
    const f = funds[c.code];
    const cat = f ? CATEGORY_LABELS[f.category] || '' : '';
    const [txt, tone] = !c.from ? ['＋ Ekle', 'ok'] : !c.to ? ['× Çıkar', 'bad'] : c.to > c.from ? ['+ Artır', 'ok'] : ['− Azalt', 'bad'];
    return `<button class="step" data-act="go" data-kind="fon" data-code="${esc(c.code)}"><span class="n">${i + 1}</span><span class="l"><b>${esc(c.code)} · ${esc(cat)}</b><strong>%${num(c.from, 0)} → %${c.to}</strong></span><span class="chip ${tone}">${txt}</span></button>`;
  }).join('') || '<p class="mut" style="padding:.8rem 0">Değişiklik gerekmiyor.</p>'}</section>`);
  if (keep.length) parts.push(`<p class="note">Değişmeyenler: ${keep.map((c) => `${esc(c.code)} %${c.to}`).join(', ')}. Fona dokununca neden seçildiğini görürsün.</p>`);
  const blocked = p.notes.filter((n) => n.kind === 'aday_degil');
  if (blocked.length) parts.push(`<p class="note">${blocked.map((n) => `${esc(n.code)} aday değil: ${esc(n.text)}.`).join(' ')}</p>`);
  parts.push('<h2 class="sectitle">Sonuç</h2>');
  const res = Object.keys(m.targets.groups).map((g) => {
    const b = m.bands.groups[g];
    const after = m.targets.groups[g].classes.reduce((s, c) => s + (p.exposure[c] || 0), 0);
    const inside = after >= b.low && after <= b.high;
    return `<div class="result" ${gv(g)}><div class="hd"><b>${GROUP_LABELS[g]}</b><b>%${num(b.value, 1)} → %${num(after, 1)}</b></div>
      <div class="bandbar"><div class="rg" style="left:${b.low}%;width:${b.high - b.low}%"></div><div class="fill" style="width:${Math.min(100, after)}%"></div><div class="tg" style="left:${b.target}%"></div></div>
      <span class="st ${inside ? 'pos' : 'neg'}">${inside ? '✓ Aralıkta' : '✗ Aralık dışında'} · hedef %${num(b.target, 1)}</span></div>`;
  }).join('');
  parts.push(`<section class="card">${res}<p class="note" style="margin:0">Açık yeşil alan izin verilen aralık, ince çizgi hedef.</p></section>`);
  if (p.gaps.length) parts.push(`<div class="warnbox"><span class="t">Uygun araç yok</span><p>${p.gaps.map((g) => `${CLASS_LABELS[g.cls]} hedefe ${num(Math.abs(g.gap), 1)} puan uzak kalıyor.`).join(' ')}</p></div>`);
  parts.push('<button class="more" data-act="explain" data-key="proposal">Hesabı göster ›</button>');
  parts.push(`<div class="btns"><button class="btn primary" data-act="apply">Uyguladım</button><button class="btn" data-act="reject">Şimdi değil</button></div>
    <p class="note center">“Uyguladım” dağılımını bu oranlarla bugünün tarihiyle günceller.</p>`);
  return top + `<main>${parts.join('')}</main>`;
}

// ---------- Dağılım ----------
function viewDagilim(m) {
  const head = topMain('Dağılımım', 'Fon içeriklerine göre', state.allocation ? '<button class="pillbtn" data-act="go" data-kind="alloc">Düzenle</button>' : '');
  if (!state.allocation) return head + `<main>${noAllocation()}</main>`;
  if (!m.bands) return head + `<main><p class="empty">Çapa olmadan hedef hesaplanamıyor.</p><button class="btn primary" data-act="go" data-kind="capa">Çapanı belirle</button></main>`;
  const groups = Object.keys(m.targets.groups);
  const unmanaged = [...m.targets.unmanaged, 'unclassified'].filter((c) => (m.bands.exposure[c] || 0) > 0.05);
  const nowBar = groups.map((g) => `<i style="width:${m.bands.groups[g].value}%;background:var(${GROUP_VAR[g]})"></i>`).join('')
    + unmanaged.map((c) => `<i style="width:${m.bands.exposure[c]}%;background:var(--c-unc)"></i>`).join('');
  const tgtBar = groups.map((g) => `<i style="width:${m.targets.group_targets[g]}%;background:var(${GROUP_VAR[g]})"></i>`).join('');
  const parts = [`<section class="card"><div class="stackrow"><span>Şu an</span><div class="stack">${nowBar}</div></div><div class="stackrow"><span>Hedef</span><div class="stack">${tgtBar}</div></div></section>`];
  const rows = groups.map((g) => {
    const b = m.bands.groups[g];
    const s = groupStatus(m, g);
    const cls = m.targets.groups[g].classes;
    const multi = cls.length > 1;
    const open = multi && ui.open.has(g);
    const kids = open ? `<div class="tree">${cls.map((c) => {
      const x = m.bands.splits[g]?.[c];
      const out = x && x.status !== 'inside';
      return `<div class="kid"><div><b>${CLASS_LABELS[c]}</b><small class="${out ? 'neg' : ''}">grup içinde %${num(x?.value, 0)} · hedef %${num(m.targets.groups[g].splits[c], 0)}${out ? (x.status === 'above' ? ' ↑' : ' ↓') : ''}</small></div><span class="v">%${num(m.bands.exposure[c], 1)}</span></div>`;
    }).join('')}<button class="more" style="text-align:left" data-act="go" data-kind="grup" data-id="${g}">Grup ayrıntısı ›</button></div>` : '';
    const sub = multi && !open ? `<span class="s ind">${cls.map((c) => `${CLASS_LABELS[c].replace(' hisse', '')} %${num(m.bands.exposure[c], 1)}`).join(' · ')}</span>` : '';
    return `<div class="grp"><button class="row" data-act="${multi ? 'toggle' : 'go'}" data-kind="grup" data-id="${g}" aria-expanded="${open}"><span class="l"><span class="nm big" ${gv(g)}><span class="dot"></span>${GROUP_LABELS[g]}</span>
      <span class="s ind">%${num(b.value, 1)} · hedef %${num(b.target, 0)}</span>${sub}</span><span class="r"><span class="chip ${s.tone}">${s.text}</span>${chev(open ? 'down' : 'right')}</span></button>${kids}</div>`;
  }).join('');
  const um = unmanaged.map((c) => `<div class="grp"><div class="row"><span class="l"><span class="nm big" style="--cls: var(--c-unc)"><span class="dot"></span>${CLASS_LABELS[c]}</span><span class="s ind">%${num(m.bands.exposure[c], 1)} · hedefi yok</span></span><span class="r"><span class="chip n">◌ İzleniyor</span></span></div></div>`).join('');
  parts.push(`<section class="card list">${rows}${um}</section>`);
  if (unmanaged.length) parts.push('<p class="note">Belirsiz: karma fonların sınıflanamayan kısmı. Çapada olmayan sınıflar da hedefe girmez, yalnız izlenir.</p>');
  const funds = fundIndex(latest);
  const frows = Object.entries(m.drift.current).sort((a, b) => b[1] - a[1]).map(([code, w]) => {
    const f = funds[code];
    return `<button class="frow" data-act="go" data-kind="fon" data-code="${esc(code)}"><span class="badge ${scoreTone(f?.score ?? null)}${f?.score === null || !f ? ' small' : ''}">${f && f.score !== null ? num(f.score, 0) : f?.flags.includes('yeni_fon') ? 'Yeni' : '—'}</span>
      <span class="l"><b>${esc(code)}</b><small>${esc(f ? fundNames(f.name).short : 'veride yok')} · girişte %${num(state.allocation.weights[code], 0)}</small>${f ? stripe(f.exposure) : ''}</span><span class="v" style="font-size:1.1rem;font-weight:800">%${num(w, 1)}</span></button>`;
  }).join('');
  parts.push(`<h2 class="sectitle">Fonlarım</h2><section class="card list">${frows}</section>`);
  parts.push(`<button class="card linkcard" data-act="go" data-kind="capa"><span class="l"><span class="nm big">Hedefler nereden geliyor?</span><span class="s">Çapa ağacı ve piyasa görüşü</span></span>${chev()}</button>`);
  return head + `<main>${parts.join('')}</main>`;
}

function sparkline(m, g) {
  const h = m.bands.history.map((d) => d.group_exposure[g] ?? 0);
  if (h.length < 2) return '';
  const b = m.bands.groups[g];
  const lo = Math.max(0, Math.min(b.low, ...h) - 3);
  const hi = Math.max(b.high, ...h) + 3;
  const W = 350;
  const H = 120;
  const y = (v) => (H - ((v - lo) / (hi - lo)) * H).toFixed(1);
  const x = (i) => ((i / (h.length - 1)) * W).toFixed(1);
  const pts = h.map((v, i) => `${x(i)},${y(v)}`).join(' ');
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" role="img" aria-label="Payın ve izin verilen aralık">
    <rect x="0" y="${y(b.high)}" width="${W}" height="${(y(b.low) - y(b.high)).toFixed(1)}" fill="var(--range)"/>
    <line x1="0" x2="${W}" y1="${y(b.target)}" y2="${y(b.target)}" stroke="var(--ink)" stroke-width="2" stroke-dasharray="5 4"/>
    <polyline points="${pts}" fill="none" stroke="var(${GROUP_VAR[g]})" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/>
    <circle cx="${x(h.length - 1)}" cy="${y(h[h.length - 1])}" r="6" fill="var(${GROUP_VAR[g]})"/></svg>`;
}

// ---------- Grup ayrıntısı ----------
function viewGrup(m, g) {
  const tg = m.targets?.groups[g];
  const dot = `<span class="dot" style="--cls: var(${GROUP_VAR[g]}); width:1rem; height:1rem"></span>`;
  const top = topSub(GROUP_LABELS[g], backLabel(), '', dot);
  if (!tg || !m.bands) return top + '<main><p class="empty">Bu grup çapanda yok ya da dağılım girilmedi.</p></main>';
  const b = m.bands.groups[g];
  const s = groupStatus(m, g);
  const n = m.bands.counters['group:' + g] || 0;
  const parts = [];
  parts.push(`<section class="card"><div style="display:flex;justify-content:space-between;align-items:flex-end;gap:.5rem">
      <button class="tap" data-act="explain" data-key="band:${g}" style="text-decoration:none;display:flex;flex-direction:column"><span class="bignum">%${num(b.value, 1)}</span><span class="mut">hedef %${num(b.target, 0)} · aralık %${num(b.low, 0)}–${num(b.high, 0)}</span></button>
      <span class="chip ${s.tone}">${s.text}</span></div>
    ${sparkline(m, g)}<span class="note" style="margin:0">Dağılım tarihinden beri · yeşil alan izin verilen aralık</span>
    <div class="infobox" style="flex-direction:row;align-items:center;gap:.6rem;background:var(--bg)">${svg('clock', 24, 2.2)}<span style="font-weight:700">${b.status === 'inside' ? 'Aralığın içinde' : n >= C_DAYS ? `${n} iş günüdür aralık dışında · öneri hazır` : `${n} / ${C_DAYS} iş günü aralık dışında`}</span></div></section>`);
  if (tg.classes.length > 1) {
    const sp = m.bands.splits[g];
    const bar = (vals) => `<div class="split">${tg.classes.map((c) => `<i style="width:${vals[c]}%;background:var(${CLASS_VAR[c]})">${vals[c] >= 22 ? `${CLASS_LABELS[c].replace(' hisse', '')} %${num(vals[c], 0)}` : vals[c] >= 9 ? `%${num(vals[c], 0)}` : ''}</i>`).join('')}</div>`;
    const out = Object.entries(sp).filter(([, x]) => x.status !== 'inside');
    parts.push(`<button class="card" data-act="explain" data-key="split:${g}" style="border:0;text-align:left;color:inherit"><h2>Grup içi pay</h2>
      <div class="stackrow"><span>Şu an</span>${bar(Object.fromEntries(tg.classes.map((c) => [c, sp[c].value])))}</div>
      <div class="stackrow"><span>Hedef</span>${bar(tg.splits)}</div>
      <span class="${out.length ? 'neg' : 'pos'}" style="font-weight:700">${out.length ? out.map(([c, x]) => `${x.status === 'above' ? '↑' : '↓'} ${CLASS_LABELS[c]} grup içinde ${x.status === 'above' ? 'fazla' : 'az'}`).join(' · ') : Object.values(sp)[0].skipped ? `Grup %${P.decision.split_min_group_pct}'ten küçük; pay denetlenmiyor` : '✓ Grup içi pay aralıkta'}</span></button>`);
  }
  for (const c of tg.classes) {
    const r = m.targets.rows[c];
    const ok = latest.classes[c]?.series_ok;
    const [lbl, tone] = ok ? VIEW[r.label] : ['Veri az', 'mut'];
    const k = state.views[c] ?? 0;
    parts.push(`<section class="card"><div class="cardhead"><h2>${CLASS_LABELS[c]} için görüş</h2><button class="tap ${tone}" style="font-weight:800" data-act="explain" data-key="view:${c}">${lbl}</button></div>
      <p style="font-size:1.05rem;line-height:1.45">${ok ? esc(trendSentence(c)) : 'Veri az, görüş üretilmiyor.'}</p>
      <div style="display:flex;justify-content:space-between;align-items:center;gap:.5rem"><span class="mut">Senin görüşün (K)</span><span class="kseg">${[-1, 0, 1].map((v) => `<button data-act="view" data-cls="${c}" data-v="${v}" class="${k === v ? 'on' : ''}" aria-label="Görüş ${v}">${v > 0 ? '+1' : v < 0 ? '−1' : '0'}</button>`).join('')}</span></div></section>`);
  }
  const funds = fundIndex(latest);
  const mine = Object.entries(m.drift.current).filter(([code]) => tg.classes.includes(funds[code]?.main_class)).sort((a, b) => b[1] - a[1]);
  if (mine.length) {
    parts.push(`<section class="card list">${mine.map(([code, w]) => {
      const f = funds[code];
      return `<button class="row" data-act="go" data-kind="fon" data-code="${esc(code)}"><span class="l"><span class="nm">${esc(code)}</span><span class="s">${esc(CATEGORY_LABELS[f.category] || '')} · puan ${f.score === null ? '—' : num(f.score, 0)}</span></span><span class="r"><span class="v">%${num(w, 1)}</span>${chev()}</span></button>`;
    }).join('')}</section>`);
  }
  parts.push(`<button class="infobox" data-act="explain" data-key="target:${g}" style="border:0;text-align:left;color:inherit"><span class="t">Hesap</span>
    <span>Hedef = çapa %${num(tg.anchor, 1)} ${tg.tilt < 0 ? '−' : '+'} görüş ${num(Math.abs(tg.tilt), 1)} → <b>%${num(tg.target, 1)}</b></span>
    <span>Aralık = %${num(b.target, 1)} ± ${num(b.width, 1)} = <b>%${num(b.low, 0)}–${num(b.high, 0)}</b></span>
    <span class="mut" style="font-size:.84rem">Parametre sürümü ${latest.param_version} · veri ${dateTr(latest.data_date)} · dokun: ayrıntı</span></button>`);
  return top + `<main>${parts.join('')}</main>`;
}

// ---------- Fonlar ----------
function viewFonlar() {
  const helal = latest.funds.filter((f) => f.halal);
  const cats = CATEGORY_ORDER.filter((c) => helal.some((f) => f.category === c));
  if (!ui.category) ui.category = cats[0];
  const chips = [...cats.map((c) => `<button data-act="cat" data-cat="${c}" class="${ui.category === c ? 'on' : ''}">${esc(CATEGORY_LABELS[c] || c)}</button>`),
    `<button data-act="cat" data-cat="nonhalal" class="${ui.category === 'nonhalal' ? 'on' : ''}">Helal dışı</button>`].join('');
  const mine = state.allocation?.weights || {};
  let body;
  if (ui.category === 'nonhalal') {
    const list = latest.funds.filter((f) => !f.halal);
    body = `<p class="note">İçeriğinde faizli araç bulunan ya da strateji değiştiren fonlar.</p><section class="card list">${list.map((f) => `<button class="frow" data-act="go" data-kind="fon" data-code="${esc(f.code)}"><span class="badge small">—</span><span class="l"><b>${esc(f.code)}</b><small>${esc(fundNames(f.name).short)} · ${esc(f.halal_reason || '')}</small></span>${chev()}</button>`).join('') || '<p class="mut" style="padding:.8rem 0">Yok.</p>'}</section>`;
  } else {
    const list = helal.filter((f) => f.category === ui.category).sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || a.code.localeCompare(b.code));
    body = `<p class="note">${esc(CATEGORY_LABELS[ui.category] || '')} · ${list.length} fon. Puan 0–100: 50 kategori ortası.</p>
      <section class="card list">${list.map((f) => `<button class="frow" data-act="go" data-kind="fon" data-code="${esc(f.code)}"><span class="badge ${scoreTone(f.score)}${f.score === null ? ' small' : ''}">${f.score === null ? (f.flags.includes('yeni_fon') ? 'Yeni' : '—') : num(f.score, 0)}</span>
        <span class="l"><b>${esc(f.code)}${mine[f.code] ? ` <span class="tag">Sende %${num(mine[f.code], 0)}</span>` : ''}${f.flags.filter((x) => x !== 'yeni_fon').map((x) => ` <span class="tag warn">${FLAG_LABELS[x]}</span>`).join('')}</b>
        <small>${esc(fundReason(f))} · ücret ${pct(f.fee, 2)}</small>${stripe(f.exposure)}</span>${chev()}</button>`).join('')}</section>
      <div class="card" style="flex-direction:row;gap:.6rem;align-items:flex-start"><span class="pos">${svg('shield', 24, 2.2)}</span><span>Hepsi helal: TEFAS katılım türü ya da adında “Katılım”, içerikte faizli araç yok.</span></div>`;
  }
  return topMain('Fonlar', `${helal.length} helal fon · ${helal.filter((f) => f.score !== null).length} puanlı`) + `<main><div class="cats">${chips}</div>${body}</main>`;
}

// ---------- Fon ayrıntısı ----------
function viewFon(code) {
  const f = fundIndex(latest)[code];
  if (!f) return topSub('Fon yok', backLabel()) + '<main></main>';
  const k = HEAD_KIND[f.category] || 'mixed';
  const n = fundNames(f.name);
  const passive = P.universe.passive_categories.includes(f.category);
  const w = state.allocation ? render.m?.drift?.current?.[code] ?? null : null;
  const parts = [];
  if (f.flags.length) parts.push(`<div class="flags">${f.flags.map((x) => `<span class="chip warn">${FLAG_LABELS[x]}</span>`).join('')}</div>`);
  if (!f.halal) parts.push(`<div class="alertbox"><span class="t">HELAL DIŞI</span><p>${esc(f.halal_reason)}</p></div>`);
  parts.push(f.score !== null
    ? `<button class="card scorecard" data-act="explain" data-key="score:${esc(code)}"><span class="sc">${num(f.score, 0)}</span><span><b>${esc(CATEGORY_LABELS[f.category] || '')} fonlarında ${f.rank}.</b><span>${f.peers} fon arasında. 50 kategori ortası demek. Dokun: hesap.</span></span></button>`
    : `<section class="card scorecard"><span class="sc small">${f.flags.includes('yeni_fon') ? 'Yeni fon' : 'Puan yok'}</span><span><b>Henüz puanlanmadı</b><span>En az ${P.fund_quality.min_history_months} aylık geçmiş gerekir; yeni fon en çok %${P.fund_quality.new_fund_cap_pct} alır.</span></span></section>`);
  const ex = f.excess?.['1y'];
  parts.push(`<section class="facts"><div class="fact"><small>Yıllık ücret</small><strong>${pct(f.fee, 2)}</strong></div><div class="fact"><small>Risk</small><strong>${f.risk ?? '—'} / 7</strong></div>
    <div class="fact"><small>Son 1 yıl</small><strong class="${(f.returns?.['1y'] ?? 0) < 0 ? 'neg' : 'pos'}">${pct(f.returns?.['1y'], 1, true)}</strong></div>
    <div class="fact"><small>${passive ? 'Kıyasından fazla' : 'İçeriğinden fazla'}</small><strong class="${(ex ?? 0) < 0 ? 'neg' : 'pos'}">${ex === null || ex === undefined ? '—' : signed(ex, 1) + ' puan'}</strong></div></section>`);
  const cls = [...ANCHOR_CLASSES, 'unclassified'].filter((c) => f.exposure[c] > 0.05).sort((a, b) => f.exposure[b] - f.exposure[a]);
  parts.push(`<section class="card"><h2>Fonun içinde ne var?</h2>${stripe(f.exposure, 'stack')}
    ${cls.map((c) => `<div class="legend" ${cv(c)}><span><i></i>${CLASS_LABELS[c]}</span><b>%${num(f.exposure[c], 1)}</b></div>`).join('')}
    <p class="note" style="margin:0">İçerik ${dateTr(f.content_date)}.${cls.length > 2 ? ' Kıyası bu karışımdan hesaplanır; dağılımında her parça kendi sınıfına sayılır.' : ''}</p>
    ${f.unknown_fields ? `<p class="note" style="margin:0">Eşlenmemiş içerik alanı: ${f.unknown_fields.map(esc).join(', ')}</p>` : ''}</section>`);
  if (f.components) {
    const c = f.components;
    const fw = P.fund_quality.weights;
    const names = [['consistency', 'Her dönemde iyi'], ['excess_index', passive ? 'Kıyasına göre getiri' : 'İçeriğine göre getiri'], ['risk', passive ? 'Kıyasını yakından izleme' : 'Düşüşlerde dayanıklılık'], ['cost', 'Ücret']];
    parts.push(`<button class="card" data-act="explain" data-key="score:${esc(code)}" style="border:0;text-align:left;color:inherit"><h2>Neden ${num(f.score, 0)}?</h2>
      ${names.filter(([key]) => c[key] !== null && c[key] !== undefined).map(([key, l]) => `<div class="comp"><div class="hd"><span>${l}</span><b>${num(c[key] * 100, 0)}</b></div><div class="meter"><i style="width:${(c[key] * 100).toFixed(1)}%"></i></div></div>`).join('')}
      <span class="note" style="margin:0">Ağırlıklar: istikrar %${fw.consistency * 100}, getiri %${fw.excess_index * 100}, ${passive ? 'izleme' : 'düşüş'} %${fw.risk * 100}, ücret %${fw.cost * 100}, düzen %${fw.hygiene * 100}.</span></button>`);
  }
  const per = ['1m', '3m', '6m', 'ytd', '1y', '3y', '5y'];
  const ix = f.indices || {};
  parts.push(`<section class="card list">
    <details class="fold"><summary>Dönem getirileri ${chev('down')}</summary><div class="body">${per.map((p) => `<div class="kv"><span>${PERIOD_LABELS[p]}</span><span>${pct(f.returns?.[p], 1)} <span class="mut">· fazla ${signed(f.excess?.[p], 1)}</span></span></div>`).join('')}</div></details>
    <details class="fold"><summary>Helal dayanağı <span class="r ${f.halal ? 'pos' : 'neg'}">${f.halal ? '✓ ' + esc((f.halal_basis || '').split(':')[0]) : '✗ Helal dışı'} ${chev('down')}</span></summary><div class="body">
      <div class="kv"><span>Dayanak</span><span>${esc(f.halal_basis || '—')}</span></div><div class="kv"><span>İçerik</span><span>${f.halal ? 'faizli araç yok' : esc(f.halal_reason || '')}</span></div></div></details>
    <details class="fold"><summary>Risk ve indisler ${chev('down')}</summary><div class="body">
      <div class="kv"><span>İzleme hatası (yıllık)</span><span>${pct(f.tracking_error, 2)}</span></div>
      <div class="kv"><span>Fazla getirinin en büyük düşüşü</span><span>${f.mdd === null || f.mdd === undefined ? '—' : '−' + pct(f.mdd, 2)}</span></div>
      <div class="kv"><span>Sortino</span><span>${num(f.sortino, 2)}</span></div>
      <div class="kv"><span>Ind5 / Ind7 basit</span><span>${num(ix.ind5_simple, 2)} / ${num(ix.ind7_simple, 2)}</span></div>
      <div class="kv"><span>Ind5 / Ind7 bileşik</span><span>${num(ix.ind5_compound, 2)} / ${num(ix.ind7_compound, 2)}</span></div>
      <div class="kv"><span>Uzun vade · fazla getiri</span><span>${num(ix.long_term, 2)} · ${signed(ix.excess, 2)}</span></div></div></details>
    <details class="fold"><summary>Fon bilgileri ${chev('down')}</summary><div class="body">
      <div class="kv"><span>Şirket</span><span>${esc(n.company)}</span></div>
      <div class="kv"><span>TEFAS türü</span><span>${esc(f.tefas_type || '—')}</span></div>
      <div class="kv"><span>Ücret ayrıntısı</span><span>iç tüzük ${pct(f.fee_prospectus, 2)} · azami ${pct(f.max_ter, 2)}</span></div>
      <div class="kv"><span>Büyüklük</span><span>${moneyTl(f.size_tl)}</span></div>
      <div class="kv"><span>Yatırımcı</span><span>${people(f.investors)}</span></div>
      <div class="kv"><span>Fiyat</span><span>${num(f.price, 6)} · ${dateTr(f.price_date)}</span></div>
      <div class="kv"><span>Veri başlangıcı</span><span>${dateTr(f.first_date)} · ${num(f.history_months, 0)} ay</span></div></div></details></section>`);
  parts.push(`<button class="btn outline" data-act="claude-fund" data-code="${esc(code)}">${svg('chat', 24, 2)}Bu fonu Claude'a sor</button>`);
  const head = `<header class="fhead" data-k="${k}"><button class="back" data-act="back">${svg('back', 24, 2.5)}${backLabel()}</button>
    <div class="id"><span class="ico">${svg(k, 32, 2)}</span><div><h1>${esc(code)}</h1><span class="ty">${esc(n.short)}${w !== null ? ` · sende %${num(w, 1)}` : ''}</span></div></div>${stripe(f.exposure)}</header>`;
  return `<div class="fpage" data-k="${k}">${head}<main>${parts.join('')}</main></div>`;
}

// ---------- Çapa ----------
// Çapa taslağı. Kaynakta grup içi payı eksik sınıf varsa (öneride verisi yok) pay, şu anki
// dağılımdaki orandan alınır; dağılım yoksa eşit. Böylece "Öneriyi kullan" bir sınıfı sessizce %0'a çekmez.
function anchorDraftFrom(anchor) {
  const a = normalizeAnchor(TREE, anchor) || { groups: {}, splits: {} };
  const expo = render.m?.expoNow || {};
  const inferred = [];
  const splits = {};
  for (const g of TREE.filter((x) => x.classes.length > 1)) {
    const sp = a.splits[g.id];
    const [c1, c2] = g.classes;
    if (sp && c1 in sp && c2 in sp) { splits[g.id] = Math.round(sp[c1]); continue; }
    const tot = (expo[c1] || 0) + (expo[c2] || 0);
    splits[g.id] = tot > 0 ? Math.round(((expo[c1] || 0) / tot) * 20) * 5 : 50;
    if (a.groups[g.id] !== undefined) inferred.push(g.id);
  }
  return {
    groups: Object.fromEntries(TREE.map((g) => [g.id, a.groups[g.id] === undefined ? '' : String(Math.round(a.groups[g.id] * 2) / 2)])),
    splits,
    inferred,
  };
}

function draftSum(d) {
  return Object.values(d.groups).reduce((s, v) => s + (Number(v) || 0), 0);
}

function viewCapa() {
  if (!ui.anchorDraft) ui.anchorDraft = anchorDraftFrom(state.anchor || suggestedAnchor());
  const d = ui.anchorDraft;
  const rows = TREE.map((g) => {
    const v = d.groups[g.id];
    const split = g.classes.length > 1 ? (() => {
      const p = d.splits[g.id];
      const [c1, c2] = g.classes;
      return `<div class="splitedit"><div class="lab"><span>${CLASS_LABELS[c1]} %<span data-out="s1-${g.id}">${p}</span></span><span>${CLASS_LABELS[c2]} %<span data-out="s2-${g.id}">${100 - p}</span></span></div>
        <input type="range" min="0" max="100" step="5" value="${p}" data-in="split" data-g="${g.id}" aria-label="${GROUP_LABELS[g.id]} grup içi pay" style="--p:${p}%;--c1:var(${CLASS_VAR[c1]});--c2:var(${CLASS_VAR[c2]})">
        ${d.inferred?.includes(g.id) ? '<span class="note" style="margin:0">Öneride bu pay için yeterli veri yok; şu anki dağılımındaki oran kondu. İstediğin gibi ayarla.</span>' : ''}</div>`;
    })() : '';
    return `<div class="arow"><div class="top2"><span ${gv(g.id)}><span class="dot"></span>${GROUP_LABELS[g.id]}</span>
      <div class="stepper"><button data-act="step" data-g="${g.id}" data-d="-1" aria-label="${GROUP_LABELS[g.id]} azalt">−</button>
      <input inputmode="decimal" data-in="agroup" data-g="${g.id}" value="${esc(v)}" placeholder="izle" aria-label="${GROUP_LABELS[g.id]} çapan">
      <button data-act="step" data-g="${g.id}" data-d="1" aria-label="${GROUP_LABELS[g.id]} artır">+</button></div></div>${split}</div>`;
  }).join('');
  const sum = draftSum(d);
  const parts = [`<section class="card list">${rows}</section>`,
    `<div class="total"><span>Toplam</span><span id="anchor-sum" class="${Math.abs(sum - 100) <= 0.5 ? 'pos' : 'neg'}">%${num(sum, 1)} ${Math.abs(sum - 100) <= 0.5 ? '✓' : '(100 olmalı)'}</span></div>`];
  const a = latest.anchor;
  if (a?.ok) {
    const sg = normalizeAnchor(TREE, a.user_groups.weights);
    parts.push(`<section class="infobox"><div style="display:flex;align-items:center;gap:.5rem;color:var(--accent)">${svg('bulb', 24, 2.2)}<span class="t" style="font-size:1.1rem">Uygulamanın önerisi</span></div>
      <span style="font-size:1.05rem;font-weight:800;line-height:1.4">${TREE.filter((g) => sg.groups[g.id] !== undefined).map((g) => `${GROUP_LABELS[g.id]} %${num(sg.groups[g.id], 0)}`).join(' · ')}</span>
      <span class="mut">Son ${a.weeks} haftanın verisinden: her grup portföye yaklaşık eşit risk katsın diye. Önerisi olmayan grup izlenir.</span>
      <div class="btns two"><button class="btn outline" data-act="anchor-copy">Kullan</button><button class="btn" data-act="explain" data-key="anchor">Nasıl?</button></div></section>`);
  }
  parts.push(`<button class="btn primary" data-act="anchor-save">Kaydet</button>
    <p class="note center">${state.anchor_date ? `Son kayıt ${dateTr(state.anchor_date)}.` : 'Henüz kendi çapanı kaydetmedin.'} Boş bıraktığın grup izlenir. Belirsiz kısım çapaya girmez.</p>`);
  return topSub('Çapa', backLabel(), `Uzun vadeli denge noktan. Piyasa görüşü grup hedefini en çok ±${P.tactical.max_tilt_pts} puan oynatır.`) + `<main>${parts.join('')}</main>`;
}

// ---------- Dağılım girişi ----------
function allocSum() {
  return ui.alloc ? ui.alloc.rows.reduce((s, r) => s + (Number(String(r.pct).replace(',', '.')) || 0), 0) : 0;
}

function viewAlloc() {
  if (!ui.alloc) {
    const w = state.allocation?.weights || {};
    ui.alloc = { date: todayIstanbul(), rows: Object.keys(w).length ? Object.entries(w).map(([code, v]) => ({ code, pct: Math.round(v * 10) / 10 })) : [{ code: '', pct: '' }] };
  }
  const a = ui.alloc;
  const options = (sel) => latest.funds.slice().sort((x, y) => x.code.localeCompare(y.code)).map((f) => `<option value="${esc(f.code)}"${f.code === sel ? ' selected' : ''}>${esc(f.code)} · ${esc(fundNames(f.name).short)}${f.halal ? '' : ' (helal dışı)'}</option>`).join('');
  const rows = a.rows.map((r, i) => `<div class="arow2"><select data-in="alloc-code" data-i="${i}" aria-label="Fon ${i + 1}"><option value="">Fon seç</option>${options(r.code)}</select>
    <input data-in="alloc-pct" data-i="${i}" inputmode="decimal" value="${r.pct ?? ''}" placeholder="%" aria-label="Yüzde ${i + 1}"><button class="x" data-act="alloc-del" data-i="${i}" aria-label="Satırı sil">×</button></div>`).join('');
  return topSub('Dağılımım', backLabel(), 'Şirket ekranındaki mevcut birikiminin fon yüzdeleri. Ayda bir güncelle.') + `<main><section class="card form">
    <label for="alloc-date">Dağılım tarihi</label><input class="inp" id="alloc-date" type="date" data-in="alloc-date" value="${a.date}">
    ${rows}<button class="more" style="text-align:left" data-act="alloc-add">+ Fon ekle</button>
    <p style="font-weight:700">Toplam: <span id="alloc-sum">${num(allocSum(), 1)}</span> / 100</p></section>
    <div class="btns"><button class="btn primary" data-act="alloc-save">Kaydet</button><button class="btn" data-act="back">Vazgeç</button></div>
    <p class="note center">Bilgi yalnız bu telefonda saklanır.</p></main>`;
}

// ---------- Ayarlar ----------
function viewAyarlar() {
  const p = state.prefs;
  const sizes = SIZES.map(([k, l]) => `<button data-act="size" data-v="${k}" class="${p.size === k ? 'on' : ''}"><b style="font-size:${{ m: '1.05rem', l: '1.3rem', xl: '1.55rem', sys: '1.2rem' }[k]}">A</b><span>${l}</span></button>`).join('');
  const themes = THEMES.map(([k, l]) => `<button data-act="theme" data-v="${k}" class="${p.theme === k ? 'on' : ''}">${l}</button>`).join('');
  const link = (kind, label, right = '') => `<button class="row" data-act="go" data-kind="${kind}"><span class="nm">${label}</span><span class="r"><span class="mut">${right}</span>${chev()}</span></button>`;
  return topMain('Ayarlar', '') + `<main>
    <section class="card"><h2>Yazı boyutu</h2><div class="preview"><b>Kıymetli maden</b><span>%64,9 · hedef %35</span></div><div class="sizes">${sizes}</div>
      <p class="note" style="margin:0">“iPhone ayarı” telefonun Metin Boyutu ayarını izler.</p></section>
    <section class="card"><h2>Görünüm</h2><div class="seg">${themes}</div><p class="note" style="margin:0">Otomatik: telefon koyu moddaysa koyu zemin.</p></section>
    <section class="card list">${link('capa', 'Çapa')}${link('alloc', 'Dağılımım', state.allocation ? dateTr(state.allocation.date) : 'girilmedi')}${link('model', 'Model ayarları', 'sürüm ' + latest.param_version)}${link('yedek', 'Yedekle ve geri yükle')}${link('veri', 'Veri kaynakları', 'TEFAS')}</section>
    <p class="note center">Dağılımın yalnız bu telefonda saklanır.</p></main>`;
}

function viewModel() {
  const d = P.decision;
  const rules = [
    ['Grup aralığı', `hedefin ±%${d.band_rel_pct}'i, en az ${d.band_min_pts}, en çok ${d.band_max_pts} puan`],
    ['Grup içi pay aralığı', `±${d.split_band_pts} puan; grup %${d.split_min_group_pct}'ten küçükse denetlenmez`],
    ['Teyit süresi', `${d.confirm_days} iş günü`],
    ['Görüş', `S = 0,50·T + 0,25·M + 0,25·K; yalnız grubu kaydırır, en çok ±${P.tactical.max_tilt_pts} puan`],
    ['Görüş öneri üretir mi', 'Hayır; öneriyi aralık dışı başlatır'],
    ['Acil uyarı', `20 günlük düşüş > ${num(d.alert_sigma_mult, 1)} × normal oynaklık`],
    ['Fon değiştirme', `puan farkı ≥ ${d.switch_score_gap}`],
    ['Yeni fon tavanı', `%${P.fund_quality.new_fund_cap_pct}`],
    ['Çapa önerisi', `risk eşitliği, hedef oynaklık %${P.anchor.target_vol_pct}, sınıf tavanı %${P.anchor.class_cap_pct}`],
  ].map(([l, v]) => `<div class="kv" style="flex-direction:column;gap:.1rem;border-bottom:1px solid var(--line);padding:.6rem 0"><span>${l}</span><span style="text-align:left">${v}</span></div>`).join('');
  return topSub('Model ayarları', backLabel(), `Model ${esc(latest.model_version)} · parametre sürümü ${latest.param_version}`) + `<main><section class="card">${rules}</section>
    <p class="note">Parametreleri değiştirmek için şimdilik bana yaz; her değişiklik yeni sürüm olarak kaydedilir.</p></main>`;
}

function viewYedek() {
  return topSub('Yedek', backLabel(), 'Verilerin yalnız bu telefonda. Yedeği Notlar gibi güvenli bir yere yapıştır.') + `<main>
    <button class="btn primary" data-act="backup">Yedeği kopyala</button>
    <section class="card form"><label for="restore-text">Yedekten geri yükle</label><textarea class="inp" id="restore-text" placeholder="Yedek metnini buraya yapıştır"></textarea>
      <button class="btn" data-act="restore-do">Geri yükle</button></section></main>`;
}

function viewVeri() {
  const s = latest.sources;
  return topSub('Veri kaynakları', backLabel()) + `<main><section class="card">
    <div class="kv"><span>TEFAS</span><span>${s.tefas.funds} fon · ${s.tefas.halal} helal</span></div>
    <div class="kv"><span>Fiyat aralığı</span><span>${dateTr(s.tefas.first_date)} – ${dateTr(s.tefas.last_date)}</span></div>
    <div class="kv"><span>İçerik</span><span>${dateTr(latest.content_date)}</span></div>
    <div class="kv"><span>EVDS · FRED</span><span>${esc(s.evds.status)} · ${esc(s.fred.status)}</span></div>
    <div class="kv"><span>Hesap</span><span>${esc(latest.generated_at)}</span></div></section>
    <button class="btn" data-act="reload">Veriyi yenile</button></main>`;
}

// ---------- Çizim ----------
function render() {
  if (loadError) {
    root.innerHTML = `<main><p class="empty">Veri yüklenemedi: ${esc(loadError)}</p><button class="btn primary" data-act="reload">Yeniden dene</button></main>`;
    return;
  }
  if (!latest) {
    root.innerHTML = '<p class="empty">maliSK yükleniyor…</p>';
    return;
  }
  const m = derive();
  render.m = m;
  const p = page();
  let html;
  if (p?.kind === 'oneri') html = viewOneri(m);
  else if (p?.kind === 'grup') html = viewGrup(m, p.id);
  else if (p?.kind === 'fon') html = viewFon(p.code);
  else if (p?.kind === 'capa') html = viewCapa();
  else if (p?.kind === 'alloc') html = viewAlloc();
  else if (p?.kind === 'model') html = viewModel();
  else if (p?.kind === 'yedek') html = viewYedek();
  else if (p?.kind === 'veri') html = viewVeri();
  else if (ui.tab === 'dagilim') html = viewDagilim(m);
  else if (ui.tab === 'fonlar') html = viewFonlar();
  else if (ui.tab === 'ayarlar') html = viewAyarlar();
  else html = viewOzet(m);
  const sheet = ui.sheet ? `<div class="sheet-bg" data-act="sheet-close"><div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(ui.sheet.title)}"><h3>${ui.sheet.title}</h3>${ui.sheet.html}<button class="btn" data-act="sheet-close">Kapat</button></div></div>` : '';
  const toast = ui.toast ? `<div class="toast" role="status">${esc(ui.toast)}</div>` : '';
  root.innerHTML = html + tabbar() + sheet + toast;
}

// ---------- Olaylar ----------
root.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act;
  if (act === 'sheet-close') {
    if (el.classList.contains('sheet-bg') && e.target.closest('.sheet')) return;
    ui.sheet = null;
  } else if (act === 'tab') {
    ui.tab = el.dataset.tab;
    ui.stack = [];
    ui.anchorDraft = null;
    ui.alloc = null;
    window.scrollTo(0, 0);
  } else if (act === 'go') {
    const kind = el.dataset.kind;
    if (kind === 'capa') ui.anchorDraft = null;
    if (kind === 'alloc') ui.alloc = null;
    go({ kind, id: el.dataset.id, code: el.dataset.code });
  } else if (act === 'back') {
    const prev = ui.stack.pop();
    if (prev?.kind === 'capa') ui.anchorDraft = null;
    if (prev?.kind === 'alloc') ui.alloc = null;
    window.scrollTo(0, 0);
  } else if (act === 'toggle') {
    const g = el.dataset.id;
    if (ui.open.has(g)) ui.open.delete(g); else ui.open.add(g);
  } else if (act === 'cat') {
    ui.category = el.dataset.cat;
  } else if (act === 'explain') {
    try { ui.sheet = explain(el.dataset.key, render.m); } catch { ui.sheet = { title: 'Hesap', html: '<p>Bu hesap için yeterli veri yok.</p>' }; }
  } else if (act === 'view') {
    state.views[el.dataset.cls] = Number(el.dataset.v);
    persist();
  } else if (act === 'apply') {
    const p = render.m.proposal;
    if (state.allocation) state.allocation_history.push(state.allocation);
    state.allocation = { date: latest.data_date, weights: p.weights };
    state.decisions.push({ date: latest.data_date, action: 'uygulandi', weights: p.weights });
    ui.stack = [];
    persist();
    showToast('Yeni dağılımın kaydedildi. Sayaçlar sıfırlandı.');
    return;
  } else if (act === 'reject') {
    state.decisions.push({ date: latest.data_date, action: 'reddedildi' });
    ui.stack = [];
    persist();
    showToast(`Tamam; ${C_DAYS} iş günü yeni öneri gelmez.`);
    return;
  } else if (act === 'alloc-add') {
    ui.alloc.rows.push({ code: '', pct: '' });
  } else if (act === 'alloc-del') {
    ui.alloc.rows.splice(Number(el.dataset.i), 1);
  } else if (act === 'alloc-save') {
    const rows = ui.alloc.rows.filter((r) => r.code && Number(String(r.pct).replace(',', '.')) > 0);
    const sum = rows.reduce((s, r) => s + Number(String(r.pct).replace(',', '.')), 0);
    if (!rows.length) return showToast('En az bir fon ve yüzde gir.');
    if (new Set(rows.map((r) => r.code)).size !== rows.length) return showToast('Aynı fon iki kez girilmiş.');
    if (Math.abs(sum - 100) > 0.5) return showToast(`Toplam ${num(sum, 1)}; 100 olmalı.`);
    if (state.allocation) state.allocation_history.push(state.allocation);
    state.allocation = { date: ui.alloc.date || todayIstanbul(), weights: Object.fromEntries(rows.map((r) => [r.code, (Number(String(r.pct).replace(',', '.')) * 100) / sum])) };
    ui.alloc = null;
    ui.stack.pop();
    persist();
    showToast('Dağılımın kaydedildi.');
    return;
  } else if (act === 'step') {
    const d = ui.anchorDraft;
    const g = el.dataset.g;
    d.groups[g] = String(Math.max(0, Math.min(100, (Number(d.groups[g]) || 0) + Number(el.dataset.d))));
  } else if (act === 'anchor-copy') {
    ui.anchorDraft = anchorDraftFrom(latest.anchor.user_groups.weights);
  } else if (act === 'anchor-save') {
    const d = ui.anchorDraft;
    const set = TREE.filter((g) => String(d.groups[g.id]).trim() !== '' && Number.isFinite(Number(d.groups[g.id])));
    const sum = set.reduce((s, g) => s + Number(d.groups[g.id]), 0);
    if (!set.length || Math.abs(sum - 100) > 0.5) return showToast(`Çapa toplamı ${num(sum, 1)}; 100 olmalı.`);
    state.anchor = {
      groups: Object.fromEntries(set.map((g) => [g.id, Number(d.groups[g.id])])),
      splits: Object.fromEntries(set.filter((g) => g.classes.length > 1).map((g) => [g.id, { [g.classes[0]]: d.splits[g.id], [g.classes[1]]: 100 - d.splits[g.id] }])),
    };
    state.anchor_date = todayIstanbul();
    ui.anchorDraft = null;
    ui.stack.pop();
    persist();
    showToast('Çapan kaydedildi.');
    return;
  } else if (act === 'size' || act === 'theme') {
    state.prefs[act] = el.dataset.v;
    applyPrefs();
    persist();
  } else if (act === 'claude') {
    const m = render.m;
    let proposal = m.proposal;
    if (!proposal && m.bands) { try { proposal = buildProposal(latest, m.drift.current, m.bands, m.targets.targets, P); } catch { proposal = null; } }
    copyText(buildPrompt({ latest, state, drift: m.drift, targets: m.targets, bands: m.bands, due: m.due, proposal }), 'Kopyalandı. Claude uygulamasını açıp yapıştır.');
    return;
  } else if (act === 'claude-fund') {
    const f = fundIndex(latest)[el.dataset.code];
    copyText(buildFundPrompt({ latest, fund: f, weight: render.m?.drift?.current?.[f.code] ?? null }), 'Kopyalandı. Claude uygulamasını açıp yapıştır.');
    return;
  } else if (act === 'backup') {
    copyText(exportState(state), 'Yedek kopyalandı. Güvenli bir yere yapıştır.');
    return;
  } else if (act === 'restore-do') {
    try {
      state = importState(document.getElementById('restore-text').value);
      persist();
      applyPrefs();
      ui.stack.pop();
      showToast('Yedek geri yüklendi.');
    } catch (err) {
      showToast(err.message || 'Yedek okunamadı.');
    }
    return;
  } else if (act === 'reload') {
    load();
    return;
  }
  render();
});

root.addEventListener('input', (e) => {
  const el = e.target;
  const kind = el.dataset.in;
  if (kind === 'alloc-pct') {
    ui.alloc.rows[Number(el.dataset.i)].pct = el.value;
    const s = document.getElementById('alloc-sum');
    if (s) s.textContent = num(allocSum(), 1);
  } else if (kind === 'alloc-date') {
    ui.alloc.date = el.value;
  } else if (kind === 'agroup') {
    ui.anchorDraft.groups[el.dataset.g] = el.value.replace(',', '.');
    const sum = draftSum(ui.anchorDraft);
    const out = document.getElementById('anchor-sum');
    const ok = Math.abs(sum - 100) <= 0.5;
    out.textContent = `%${num(sum, 1)} ${ok ? '✓' : '(100 olmalı)'}`;
    out.className = ok ? 'pos' : 'neg';
  } else if (kind === 'split') {
    const g = el.dataset.g;
    const v = Number(el.value);
    ui.anchorDraft.splits[g] = v;
    el.style.setProperty('--p', v + '%');
    document.querySelector(`[data-out="s1-${g}"]`).textContent = v;
    document.querySelector(`[data-out="s2-${g}"]`).textContent = 100 - v;
  }
});

root.addEventListener('change', (e) => {
  const el = e.target;
  if (el.dataset.in === 'alloc-code') ui.alloc.rows[Number(el.dataset.i)].code = el.value;
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

applyPrefs();
load();
