// maliSK telefon arayüzü. Veri: data/latest.json; kişisel durum: localStorage.
import { DEFAULT_PARAMS as P, CLASS_LABELS, CATEGORY_LABELS } from '../model/params.mjs';
import { bandWidth, alertThreshold } from '../model/bands.mjs';
import { loadState, saveState, exportState, importState } from './state.mjs';
import { driftWeights, targetsToday, bandHistory, recommendationDue, buildProposal, currentExposure, ANCHOR_CLASSES, fundIndex } from './personal.mjs';
import { buildPrompt } from './claude.mjs';
import { num, pct, signed, esc, dateTr, moneyTl, people, fundNames, FLAG_LABELS, todayIstanbul } from './format.mjs';

const CLASS_VAR = { gold: '--c-altin', silver: '--c-gumus', tl_fixed: '--c-tl', equity_tr: '--c-yi', equity_foreign: '--c-yd', fx_fixed: '--c-doviz', unclassified: '--c-bel' };
const CATEGORY_ORDER = ['gold', 'precious_metals', 'silver', 'equity', 'mixed', 'money_market', 'lease_tl', 'fx', 'standard', 'starter', 'state_contribution', 'receivables', 'unclassified'];
const VIEW = { positive: ['Olumlu', 'ok'], neutral: ['Nötr', 'n'], negative: ['Olumsuz', 'bad'] };
const PERIOD_LABELS = { '1m': '1 ay', '3m': '3 ay', '6m': '6 ay', ytd: 'Yılbaşı', '1y': '1 yıl', '3y': '3 yıl', '5y': '5 yıl' };
const ANCHOR_VARIANTS = { user_groups: 'Gruplu', flat: 'Düz', suggested: 'Veriden' };

let state = loadState();
let latest = null;
let loadError = null;
const ui = { tab: 'bugun', category: null, fund: null, alloc: null, anchorDraft: null, anchorVariant: 'user_groups', showProposal: false, sheet: null, toast: null, restore: false };
const root = document.getElementById('app');
const cls = (c) => `style="--cls: var(${CLASS_VAR[c]})"`;

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
    ui.sheet = { title: 'Metni kopyala', html: `<p class="sub">Otomatik kopyalanamadı. Metni seçip kopyala.</p><textarea class="inp" readonly>${esc(text)}</textarea>` };
    render();
  }
}

// ---------- Kişisel hesap ----------
function derive() {
  if (!latest) return {};
  const suggested = latest.anchor?.ok ? latest.anchor.user_groups.weights : null;
  const anchor = state.anchor || suggested;
  const m = { anchor, anchorIsDefault: !state.anchor && !!suggested };
  if (state.allocation) {
    m.drift = driftWeights(latest, state.allocation);
    m.expoNow = currentExposure(latest, m.drift.current);
  }
  if (anchor) m.targets = targetsToday(latest, anchor, state.views, P, m.expoNow || null);
  if (m.drift) {
    if (m.targets) {
      m.bands = bandHistory(latest, m.drift, m.targets.targets, P);
      m.due = recommendationDue(m.bands, state.decisions, latest.data_date, P);
      if (m.due.active || ui.showProposal) {
        try { m.proposal = buildProposal(latest, m.drift.current, m.bands, m.targets.targets, P); } catch (e) { m.proposalError = e.message; }
      }
    }
  }
  return m;
}

// ---------- Açıklama sayfaları ----------
function sheetTable(rows, sumRow) {
  return `<table>${rows.map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join('')}${sumRow ? `<tr class="sum"><td>${sumRow[0]}</td><td>${sumRow[1]}</td></tr>` : ''}</table>`;
}

function explain(key, m) {
  const [kind, id] = key.split(':');
  const funds = fundIndex(latest);
  if (kind === 'target') {
    const r = m.targets.rows[id];
    const t = P.tactical;
    if (!r.managed) {
      return { title: `${CLASS_LABELS[id]} hedefi`, html: '<p>Bu sınıf çapanda yok; izleniyor. Hedefi ve bandı yok, öneri mevcut payını korur. Ayarlar → Çapa\'dan değer verirsen yönetilir.</p>' };
    }
    return {
      title: `${CLASS_LABELS[id]} hedefi`,
      html: `<div class="formula">S = 0,50 × T + 0,25 × M + 0,25 × K<br>eğim = ${t.max_tilt_pts} × S / ${num(t.full_tilt_at, 1)} (en çok ±${t.max_tilt_pts})<br>hedef = (çapa + eğim) × 100 / Σ(çapa + eğim)</div>`
        + sheetTable([
          ['T (trend)', signed(r.T, 2)], ['M (makro)', signed(r.M, 0) + (latest.classes[id]?.macro === null ? ' · veri yok' : '')], ['K (senin görüşün)', signed(r.K, 0)],
          ['S', signed(r.S, 2)], ['Eğim', signed(r.tilt, 2) + ' puan'], ['Çapa', num(r.anchor, 1)],
          ['Çapa + eğim', num(Math.max(0, r.anchor + r.tilt), 2)], ['Yönetilen sınıfların toplamı', num(m.targets.raw_sum, 2)],
          ['İzlenen sınıfların mevcut payı', num(m.targets.unmanaged_share, 2)],
        ], ['Hedef', num(r.target, 2)])
        + (m.targets.unmanaged.length ? `<p class="ex">İzlenen sınıflar (${m.targets.unmanaged.map((c) => CLASS_LABELS[c]).join(', ')}) çapanda yok; hedefler kalan paya ölçeklenir.</p>` : ''),
    };
  }
  if (kind === 'band') {
    const b = m.bands.check[id];
    return {
      title: `${CLASS_LABELS[id]} bandı`,
      html: `<div class="formula">genişlik = hedef × %${P.decision.band_rel_pct}, en az ${P.decision.band_min_pts}, en çok ${P.decision.band_max_pts} puan</div>`
        + sheetTable([
          ['Hedef', num(b.target, 2)], ['Genişlik', '±' + num(b.width, 2)], ['Bant', `${num(b.low, 2)} – ${num(b.high, 2)}`],
          ['Maruziyet', num(b.value, 2)], ['Bant dışında', `${m.bands.counters[id]} iş günü (öneri ${P.decision.confirm_days} günde)`],
        ]) + '<p class="ex">Sayaç, geçmiş günleri bugünkü hedefle değerlendirir.</p>'
        + `<button class="link" data-act="explain" data-key="expo:${id}">Maruziyet nasıl hesaplandı?</button>`,
    };
  }
  if (kind === 'expo') {
    const rows = Object.entries(m.drift.current).map(([code, w]) => {
      const e = funds[code]?.exposure?.[id] ?? 0;
      return [`${esc(code)}: %${num(w, 1)} × %${num(e, 1)}`, num((w * e) / 100, 2)];
    });
    return {
      title: `${CLASS_LABELS[id]} maruziyeti`,
      html: '<div class="formula">E = Σ fon ağırlığı × fonun bu sınıftaki içerik payı</div>' + sheetTable(rows, ['Toplam', num(m.bands.exposure[id], 2)]),
    };
  }
  if (kind === 'score') {
    const f = funds[id];
    const w = P.fund_quality.weights;
    const c = f.components || {};
    const passive = P.universe.passive_categories.includes(f.category);
    const names = { consistency: 'Süreklilik', excess_index: 'Fazla getiri indisi', risk: passive ? 'İzleme hatası' : 'Düşüş riski', cost: 'Maliyet', hygiene: 'Hijyen' };
    const used = Object.keys(w).filter((k) => c[k] !== null && c[k] !== undefined);
    const den = used.reduce((s, k) => s + w[k], 0);
    const rows = Object.keys(w).map((k) => [names[k], c[k] === null || c[k] === undefined ? 'veri yok' : `${num(w[k], 2)} × ${num(c[k], 3)}`]);
    return {
      title: `${esc(f.code)} puanı`,
      html: '<div class="formula">Puan = 100 × Σ ağırlık × bileşen / Σ ağırlık (yalnız hesaplanabilen bileşenler)<br>Bileşen = 0,5 + (değer − kategori medyanı) / (2 × ölçek)</div>'
        + sheetTable([...rows, ['Kullanılan ağırlık toplamı', num(den, 2)], ['Ham puan', num(f.raw_score, 1)],
          ['Güven (geçmiş / 36 ay)', `${num(f.history_months, 0)} ay → ${num((f.confidence ?? 1) * 100, 0)}%`]], ['Puan = 50 + güven × (ham − 50)', num(f.score, 1)])
        + `<p class="ex">Fon işletim gideri ${pct(f.fee, 2)} (TEFAS). 50 puan kategori ortasıdır.</p>`,
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
  return { title: '', html: '' };
}

// ---------- Görünümler ----------
function header(title, small, extra = '') {
  return `<header class="top"><div>${title}<small>${small}</small></div>${extra}</header>`;
}

function tabbar() {
  const t = [['bugun', 'Bugün'], ['model', 'Model'], ['fonlar', 'Fonlar'], ['ayarlar', 'Ayarlar']];
  return `<nav class="tabbar" aria-label="Sekmeler">${t.map(([k, l]) => `<button data-act="tab" data-tab="${k}" class="${ui.tab === k && !ui.fund ? 'on' : ''}">${l}</button>`).join('')}</nav>`;
}

function bandsBlock(m) {
  if (!m.bands) return '';
  const all = [...ANCHOR_CLASSES, 'unclassified'];
  const max = Math.max(50, ...all.map((c) => Math.max(m.bands.exposure[c] || 0, m.bands.check[c]?.high || 0)));
  const scale = Math.ceil(max / 10) * 10;
  const x = (v) => `${Math.min(100, (v / scale) * 100).toFixed(2)}%`;
  const rows = all.map((c) => {
    const b = m.bands.check[c];
    const v = m.bands.exposure[c] || 0;
    if (!b) {
      return `<div class="brow" ${cls(c)}><span class="nm">${CLASS_LABELS[c]}</span><span class="val">${num(v, 1)} · ${c === 'unclassified' ? 'hedefi yok' : 'izleniyor'}</span><div class="track"><div class="dot" style="left:${x(v)}"></div></div></div>`;
    }
    const out = b.status !== 'inside';
    const status = out ? `${m.bands.counters[c]}/${P.decision.confirm_days} gün` : 'içinde';
    return `<button class="brow" data-act="explain" data-key="band:${c}" ${cls(c)}><span class="nm">${CLASS_LABELS[c]}</span>
      <span class="val"><b class="${out ? 'neg' : ''}">${num(v, 1)}</b> · hedef ${num(b.target, 1)} · ${status}</span>
      <div class="track"><div class="range" style="left:${x(b.low)};width:calc(${x(b.high)} - ${x(b.low)})"></div><div class="tick" style="left:${x(b.target)}"></div><div class="dot${out ? ' out' : ''}" style="left:${x(v)}"></div></div></button>`;
  });
  return `<section class="sec"><h2>Sınıf maruziyeti <small>dokun: hesap</small></h2><div class="card"><div class="bands">${rows.join('')}</div>
    <div class="blegend"><span><i class="r"></i>bant</span><span><i class="t"></i>hedef</span><span><i class="d"></i>mevcut</span><span>ölçek 0–%${scale}</span></div></div></section>`;
}

function proposalBlock(m) {
  if (m.proposalError) return `<div class="box warn"><span class="t">Öneri üretilemedi</span><p>${esc(m.proposalError)}</p></div>`;
  const p = m.proposal;
  if (!p) return '';
  const funds = fundIndex(latest);
  const reasons = m.due.due.map((c) => {
    const b = m.bands.check[c];
    return `<div class="row"><span class="l">${CLASS_LABELS[c]}<small>bant ${num(b.low, 1)}–${num(b.high, 1)}</small></span><span class="r"><b class="neg">${num(b.value, 1)}</b><small>${m.bands.counters[c]} iş günü</small></span></div>`;
  }).join('');
  const changes = p.changes.map((ch) => {
    const f = funds[ch.code];
    const isNew = !ch.from;
    const note = p.notes.find((n) => n.code === ch.code && n.kind === 'sabit');
    return `<div class="row"><span class="l"><b>${esc(ch.code)}</b>${isNew && ch.to ? ' <span class="pill ok">yeni</span>' : ''}<small>${esc(f ? fundNames(f.name).short : '')}${note ? ' · ' + esc(note.text) : ''}</small></span>
      <span class="r">%${num(ch.from, 0)} <span class="arrow">→</span> <b>%${ch.to}</b></span></div>`;
  }).join('');
  const blocked = p.notes.filter((n) => n.kind === 'aday_degil').map((n) => `<p class="sub">${esc(n.code)} aday değil: ${esc(n.text)}.</p>`).join('');
  const expo = ANCHOR_CLASSES.map((c) => `<div class="row"><span class="l">${CLASS_LABELS[c]}</span><span class="r">${num(m.bands.exposure[c], 1)} <span class="arrow">→</span> <b>${num(p.exposure[c], 1)}</b><small>${c in m.targets.targets ? 'hedef ' + num(m.targets.targets[c], 1) : 'izleniyor'}</small></span></div>`).join('');
  const gaps = p.gaps.length ? `<div class="box warn"><span class="t">Uygun araç yok</span><p>${p.gaps.map((g) => `${CLASS_LABELS[g.cls]} hedefe ${num(Math.abs(g.gap), 1)} puan uzak kalıyor.`).join(' ')}</p></div>` : '';
  return `<section class="sec"><h2>Eylem önerisi <small>param v${latest.param_version}</small></h2>
    <div class="card"><b>Neden</b><div class="rows">${reasons}</div></div>
    <div class="card"><b>Yeni dağılım</b><div class="rows">${changes}</div>${blocked}</div>
    <div class="card"><b>Sonuç maruziyeti</b><div class="rows">${expo}</div></div>
    ${gaps}
    <div class="btns"><button class="btn primary" data-act="apply">Uyguladım</button><button class="btn" data-act="reject">Reddet</button></div>
    <p class="ex">"Uyguladım" bu dağılımı bugünün tarihiyle senin dağılımın yapar. Yıllık 12 değişiklik sınırını sen izliyorsun.</p></section>`;
}

function viewBugun(m) {
  const parts = [];
  for (const [c, v] of Object.entries(latest.classes)) {
    if (!v.alert?.triggered) continue;
    const share = m.bands ? ` Portföydeki payı %${num(m.bands.exposure[c], 1)}.` : '';
    parts.push(`<button class="box alert" data-act="explain" data-key="alert:${c}"><span class="t">Acil uyarı</span>
      <p><b>${CLASS_LABELS[c]} 20 iş gününde ${pct(v.alert.change_pct, 1)}.</b> Normal oynaklığının ${num(v.alert.sigma_multiple, 1)} katı.${share}</p>
      <p class="sub">İnceleme çağrısı; dağılım önerisi değil.</p></button>`);
  }
  if (!state.allocation) {
    parts.push(`<div class="box act"><span class="t">Başlamak için</span><p>Emeklilik şirketinin ekranındaki mevcut birikiminin fon yüzdelerini gir. Tutar gerekmez.</p>
      <div class="btns"><button class="btn primary" data-act="go-alloc">Dağılımımı gir</button></div></div>`);
  }
  if (m.anchorIsDefault) {
    parts.push(`<div class="box plain"><span class="t">Çapa</span><p>Kendi çapan yok; uygulamanın önerisi kullanılıyor.</p><button class="link" data-act="tab" data-tab="ayarlar">Çapanı belirle ›</button></div>`);
  }
  if (m.due?.active) {
    parts.push(`<div class="box act"><span class="t">Eylem önerisi hazır</span><p>${m.due.due.map((c) => CLASS_LABELS[c]).join(', ')} ${P.decision.confirm_days} iş günüdür bandın dışında.</p>
      <button class="link" data-act="toggle-proposal">${ui.showProposal ? 'Öneriyi gizle' : 'Öneriyi aç ›'}</button></div>`);
  } else if (m.due?.suppressed) {
    parts.push('<div class="box plain"><span class="t">Öneri beklemede</span><p>Son öneriyi reddettin; 20 iş günü yeni öneri üretilmez.</p></div>');
  }
  if (ui.showProposal && m.proposal) parts.push(proposalBlock(m));
  if (m.drift) {
    const funds = fundIndex(latest);
    const stale = m.drift.stale ? `<p class="sub">Dağılım tarihin ${dateTr(state.allocation.date)}; hesap ${dateTr(m.drift.start_date)} tarihinden başlıyor. Şirket ekranından güncellemeni öneririm.</p>` : '';
    const missing = m.drift.missing.length ? `<p class="sub neg">Veride bulunamayan fon: ${m.drift.missing.map(esc).join(', ')}</p>` : '';
    parts.push(`<div class="kpis"><div class="kpi"><small>Dağılım tarihi</small><strong>${dateTr(state.allocation.date)}</strong></div>
      <div class="kpi"><small>O günden bu yana</small><strong class="${m.drift.return_pct < 0 ? 'neg' : ''}">${pct(m.drift.return_pct, 1, true)}</strong></div></div>${stale}${missing}`);
    const rows = Object.entries(m.drift.current).sort((a, b) => b[1] - a[1]).map(([code, w]) => {
      const f = funds[code];
      const score = !f ? '—' : f.score === null ? (f.flags.includes('yeni_fon') ? '<span class="pill n">Yeni</span>' : '—') : num(f.score, 0);
      return `<tr class="click" data-act="fund" data-code="${esc(code)}"><td><b>${esc(code)}</b><small>${esc(f ? fundNames(f.name).short : '')}</small></td>
        <td>%${num(w, 1)}<small>girişte %${num(state.allocation.weights[code], 0)}</small></td><td>${pct(f?.returns?.['1m'], 1)}<small>1 ay</small></td><td>${score}</td></tr>`;
    }).join('');
    parts.push(`<section class="sec"><h2>Fonlarım</h2><div class="card"><table class="ft"><thead><tr><th>Fon</th><th>Ağırlık</th><th>Getiri</th><th>Puan</th></tr></thead><tbody>${rows}</tbody></table></div></section>`);
    parts.push(bandsBlock(m));
  }
  parts.push(`<div class="btns"><button class="btn primary" data-act="claude">Claude'a danış</button></div>
    <p class="ex">Günün özeti, dağılımın ve öneri hazır bir metin olarak kopyalanır; Claude uygulamasına yapıştır.</p>`);
  const s = latest.sources;
  parts.push(`<p class="sub">TEFAS: ${s.tefas.funds} katılım fonu, ${s.tefas.halal} helal · ${dateTr(s.tefas.first_date)} – ${dateTr(s.tefas.last_date)} · EVDS ve FRED: ${esc(s.evds.status)}</p>`);
  return header('<h1>Bugün</h1>', `${dateTr(latest.data_date)} fon verisi · hesap ${esc(latest.generated_at)}`, `<button class="ver" data-act="reload">Yenile</button>`) + `<main>${parts.join('')}</main>`;
}

function viewModel(m) {
  const a = latest.anchor;
  const chips = `<div class="chips"><div class="chip"><b>Risk</b> haftalık getiri${a?.ok ? ` · ${a.weeks} hafta` : ''} · küçültme kapalı</div>
    <div class="chip"><b>Makro</b> EVDS ve FRED anahtarı eklenmedi; M = 0</div></div>`;
  if (!m.targets) return header('<h1>Model</h1>', 'Sınıf görüşleri') + `<main>${chips}<p class="empty">Çapa önerisi için yeterli veri yok: ${esc(a?.reason || '')}</p></main>`;
  const rows = ANCHOR_CLASSES.map((c) => {
    const r = m.targets.rows[c];
    const info = latest.classes[c] || {};
    const sig = info.trend?.signals || {};
    const sigTxt = [['r1m', '1a'], ['r3m', '3a'], ['r12m', '12a'], ['ma', '210g']].filter(([k]) => sig[k] !== undefined && sig[k] !== null)
      .map(([k, l]) => `${l} ${sig[k] > 0 ? '+' : '−'}`).join(' · ');
    const [lbl, tone] = VIEW[r.label];
    const pill = info.series_ok ? `<span class="pill ${tone}">${lbl}</span>` : '<span class="pill n">Veri yetersiz</span>';
    const k = state.views[c] ?? 0;
    const seg = [-1, 0, 1].map((v) => `<button data-act="view" data-cls="${c}" data-v="${v}" class="${k === v ? 'on' : ''}">${v > 0 ? '+1' : v < 0 ? '−1' : '0'}</button>`).join('');
    return `<div class="cls" ${cls(c)}><div class="top2"><b>${CLASS_LABELS[c]}</b>${pill}</div>
      <div class="sig">${sigTxt ? `<span>${sigTxt}</span>` : '<span>trend sinyali yok</span>'}</div>
      <div class="sig">T <strong>${signed(r.T, 2)}</strong> M <strong>${signed(r.M, 0)}</strong> K <span class="seg">${seg}</span> S <strong>${signed(r.S, 2)}</strong></div>
      <div class="sig">${r.managed
        ? `çapa ${num(r.anchor, 1)} <span class="arrow">→</span> eğim <strong>${signed(r.tilt, 1)}</strong> <span class="arrow">→</span>
        <button class="tappable" data-act="explain" data-key="target:${c}">hedef <strong>${num(r.target, 1)}</strong></button>`
        : `<button class="tappable" data-act="explain" data-key="target:${c}">çapada yok · izleniyor</button>`}</div></div>`;
  }).join('');
  return header('<h1>Model</h1>', 'Sınıf görüşleri') + `<main>${chips}<section class="sec"><h2>Sınıflar <small>K: senin görüşün</small></h2><div class="card">${rows}</div>
    <p class="ex">S = 0,50 × T + 0,25 × M + 0,25 × K. Görüş yalnız hedefi kaydırır; öneriyi bant aşımı tetikler.</p></section></main>`;
}

function fundCard(f) {
  const n = fundNames(f.name);
  const c = f.components || {};
  const passive = P.universe.passive_categories.includes(f.category);
  const bars = [['Süreklilik', c.consistency], ['Fazla getiri', c.excess_index], [passive ? 'İzleme hatası' : 'Düşüş riski', c.risk], ['Maliyet', c.cost], ['Hijyen', c.hygiene]]
    .map(([l, v]) => `<span>${l}</span><span class="bar">${v === null || v === undefined ? '' : `<i style="width:${(v * 100).toFixed(1)}%"></i>`}</span><span>${v === null || v === undefined ? '—' : num(v, 2)}</span>`).join('');
  const score = f.score !== null ? `${num(f.score, 0)}<small>${f.rank}/${f.peers}</small>` : `<small>${f.flags.includes('yeni_fon') ? 'Yeni fon' : 'puan yok'}</small>`;
  const flags = f.flags.filter((x) => x !== 'yeni_fon').map((x) => `<span class="pill warn">${FLAG_LABELS[x]}</span>`).join(' ');
  return `<button class="fund" data-act="fund" data-code="${esc(f.code)}"><div class="hd"><div><b>${esc(f.code)}</b><small>${esc(n.short)} · ${esc(n.company)}</small></div><div class="score">${score}</div></div>
    ${f.components ? `<div class="comps">${bars}</div>` : ''}
    <div class="meta"><span>1 yıl ${pct(f.returns?.['1y'], 1)}</span><span>ücret ${pct(f.fee, 2)}</span><span>${moneyTl(f.size_tl)}</span><span>${people(f.investors)}</span>${flags}</div></button>`;
}

function viewFonlar() {
  const helal = latest.funds.filter((f) => f.halal);
  const cats = CATEGORY_ORDER.filter((c) => helal.some((f) => f.category === c));
  if (!ui.category) ui.category = cats[0];
  const chips = [...cats.map((c) => `<button data-act="cat" data-cat="${c}" class="${ui.category === c ? 'on' : ''}">${esc(CATEGORY_LABELS[c] || c)}</button>`),
    `<button data-act="cat" data-cat="nonhalal" class="${ui.category === 'nonhalal' ? 'on' : ''}">Helal dışı</button>`].join('');
  let body;
  if (ui.category === 'nonhalal') {
    body = latest.funds.filter((f) => !f.halal).map((f) => `<div class="row"><span class="l"><b>${esc(f.code)}</b><small>${esc(fundNames(f.name).short)}</small></span><span class="r"><small>${esc(f.halal_reason)}</small></span></div>`).join('');
    body = `<div class="card"><div class="rows">${body || '<p class="sub">Yok.</p>'}</div></div><p class="ex">Beyaz listeye almak için şimdilik bana yaz; Ayarlar'a eklenecek.</p>`;
  } else {
    const list = helal.filter((f) => f.category === ui.category).sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || a.code.localeCompare(b.code));
    const passive = P.universe.passive_categories.includes(ui.category);
    body = `<p class="sub">${passive ? 'Pasife yakın kategori: risk = izleme hatası.' : 'Aktif kategori: risk = fazla getirinin düşüşü ve Sortino.'} Puan 50 kategori ortasıdır.</p>${list.map(fundCard).join('')}`;
  }
  return header('<h1>Fonlar</h1>', `${helal.length} helal katılım fonu · ${dateTr(latest.data_date)}`) + `<main><div class="cats">${chips}</div>${body}</main>`;
}

function viewFund(code) {
  const f = fundIndex(latest)[code];
  if (!f) return header('<button class="back" data-act="back">‹ Geri</button><h1>Fon yok</h1>', '') + '<main></main>';
  const n = fundNames(f.name);
  const per = ['1m', '3m', '6m', 'ytd', '1y', '3y', '5y'];
  const rets = per.map((p) => `<tr><td>${PERIOD_LABELS[p]}</td><td>${pct(f.returns?.[p], 2)}</td><td>${pct(f.excess?.[p], 2, true)}</td></tr>`).join('');
  const ix = f.indices || {};
  const stack = ANCHOR_CLASSES.concat('unclassified').filter((c) => f.exposure[c] > 0.05);
  const scoreBtn = f.score !== null ? `<button class="tappable score" data-act="explain" data-key="score:${esc(f.code)}">${num(f.score, 0)}<small>puan · ${f.rank}/${f.peers}</small></button>` : `<div class="score"><small>${f.flags.includes('yeni_fon') ? 'Yeni fon' : 'puan yok'}</small></div>`;
  const flags = f.flags.map((x) => `<span class="pill warn">${FLAG_LABELS[x]}</span>`).join(' ');
  return header(`<button class="back" data-act="back">‹ Geri</button><h1>${esc(f.code)}</h1>`, `${esc(n.short)} · ${esc(n.company)}`, scoreBtn) + `<main>
    ${flags ? `<div class="btns">${flags}</div>` : ''}
    ${!f.halal ? `<div class="box alert"><span class="t">Helal dışı</span><p>${esc(f.halal_reason)}</p></div>` : ''}
    <section class="sec"><h2>Getiri <small>fazla = içerikten beklenene göre</small></h2><div class="card"><table class="ft"><thead><tr><th>Dönem</th><th>Getiri</th><th>Fazla</th></tr></thead><tbody>${rets}</tbody></table></div></section>
    <section class="sec"><h2>İndisler <small>aylık eşdeğer</small></h2><div class="idx">
      <div><small>Ind5 basit</small><strong>${num(ix.ind5_simple, 2)}</strong></div><div><small>Ind7 basit</small><strong>${num(ix.ind7_simple, 2)}</strong></div>
      <div><small>Ind5 bileşik</small><strong>${num(ix.ind5_compound, 2)}</strong></div><div><small>Ind7 bileşik</small><strong>${num(ix.ind7_compound, 2)}</strong></div>
      <div><small>Uzun vade (1y·3y·5y)</small><strong>${num(ix.long_term, 2)}</strong></div><div class="main"><small>Fazla getiri · puana giren</small><strong>${signed(ix.excess, 2)}</strong></div></div></section>
    <section class="sec"><h2>Risk</h2><div class="card"><div class="rows">
      <div class="row"><span class="l">İzleme hatası (yıllık)</span><span class="r">${pct(f.tracking_error, 2)}</span></div>
      <div class="row"><span class="l">Fazla getirinin en büyük düşüşü</span><span class="r">${f.mdd === null || f.mdd === undefined ? '—' : '−' + pct(f.mdd, 2)}</span></div>
      <div class="row"><span class="l">Sortino (fazla getiri)</span><span class="r">${num(f.sortino, 2)}</span></div></div></div></section>
    <section class="sec"><h2>İçerik <small>${dateTr(f.content_date)}</small></h2><div class="card">
      <div class="stack">${stack.map((c) => `<i style="width:${f.exposure[c]}%;background:var(${CLASS_VAR[c]})"></i>`).join('')}</div>
      <div class="leg2">${stack.map((c) => `<span ${cls(c)}>${CLASS_LABELS[c]} %${num(f.exposure[c], 1)}</span>`).join('')}</div>
      ${f.unknown_fields ? `<p class="sub">Eşlenmemiş içerik alanı: ${f.unknown_fields.map(esc).join(', ')}</p>` : ''}</div></section>
    <section class="sec"><h2>Bilgi</h2><div class="card"><div class="rows">
      <div class="row"><span class="l">TEFAS fon türü</span><span class="r">${esc(f.tefas_type || '—')}${f.type_code ? `<small>kod ${f.type_code}</small>` : ''}</span></div>
      <div class="row"><span class="l">Helal dayanağı</span><span class="r">${esc(f.halal_basis || '—')}<small>${f.halal ? 'faizli araç yok' : esc(f.halal_reason || '')}</small></span></div>
      <div class="row"><span class="l">Kategori</span><span class="r">${esc(CATEGORY_LABELS[f.category] || f.category)}</span></div>
      <div class="row"><span class="l">Fon işletim gideri (yıllık)</span><span class="r">${pct(f.fee, 2)}<small>iç tüzük ${pct(f.fee_prospectus, 2)} · azami toplam ${pct(f.max_ter, 2)}</small></span></div>
      <div class="row"><span class="l">SPK risk değeri</span><span class="r">${f.risk ?? '—'} / 7</span></div>
      <div class="row"><span class="l">Ana sınıf</span><span class="r">${CLASS_LABELS[f.main_class]}</span></div>
      <div class="row"><span class="l">Fiyat</span><span class="r">${num(f.price, 6)}<small>${dateTr(f.price_date)}</small></span></div>
      <div class="row"><span class="l">Büyüklük</span><span class="r">${moneyTl(f.size_tl)}</span></div>
      <div class="row"><span class="l">Yatırımcı</span><span class="r">${people(f.investors)}</span></div>
      <div class="row"><span class="l">Veri başlangıcı</span><span class="r">${dateTr(f.first_date)}<small>${num(f.history_months, 0)} ay</small></span></div></div></div></section>
  </main>`;
}

function allocEditor() {
  const a = ui.alloc;
  const options = (sel) => latest.funds.map((f) => `<option value="${esc(f.code)}"${f.code === sel ? ' selected' : ''}>${esc(f.code)} · ${esc(fundNames(f.name).short)}${f.halal ? '' : ' (helal dışı)'}</option>`).join('');
  const rows = a.rows.map((r, i) => `<div class="frow"><select data-in="alloc-code" data-i="${i}" aria-label="Fon ${i + 1}"><option value="">Fon seç</option>${options(r.code)}</select>
    <input data-in="alloc-pct" data-i="${i}" inputmode="decimal" value="${r.pct ?? ''}" placeholder="%" aria-label="Yüzde ${i + 1}"><button class="x" data-act="alloc-del" data-i="${i}" aria-label="Satırı sil">×</button></div>`).join('');
  return `<div class="card form"><label class="sub" for="alloc-date">Dağılım tarihi</label><input class="inp" id="alloc-date" type="date" data-in="alloc-date" value="${a.date}">
    ${rows}<button class="link" data-act="alloc-add">+ Fon ekle</button>
    <p class="sub">Toplam: <b id="alloc-sum">${num(allocSum(), 1)}</b> / 100</p>
    <div class="btns"><button class="btn primary" data-act="alloc-save">Kaydet</button><button class="btn" data-act="alloc-cancel">Vazgeç</button></div></div>`;
}

function allocSum() {
  return ui.alloc ? ui.alloc.rows.reduce((s, r) => s + (Number(String(r.pct).replace(',', '.')) || 0), 0) : 0;
}

function anchorBlock(m) {
  const a = latest.anchor;
  if (!a?.ok) return `<div class="card"><p class="sub">Çapa önerisi için yeterli veri yok: ${esc(a?.reason || '')}</p></div>`;
  const sug = a[ui.anchorVariant];
  if (!ui.anchorDraft) {
    const src = state.anchor || a.user_groups.weights;
    ui.anchorDraft = Object.fromEntries(ANCHOR_CLASSES.map((c) => [c, typeof src[c] === 'number' ? String(Math.round(src[c])) : '']));
  }
  const d = ui.anchorDraft;
  const groups = sug.groups.map((g) => g.map((c) => CLASS_LABELS[c]).join(' + ')).join(' · ');
  const rows = ANCHOR_CLASSES.map((c) => {
    const s = sug.weights[c];
    const diff = s === undefined || d[c] === '' ? '' : signed((Number(d[c]) || 0) - s, 0);
    return `<tr><td>${CLASS_LABELS[c]}</td><td>${s === undefined ? '—' : num(s, 0)}</td><td><input data-in="anchor" data-cls="${c}" inputmode="decimal" value="${esc(d[c])}" placeholder="izle" aria-label="${CLASS_LABELS[c]} çapan"></td><td data-diff="${c}">${diff}</td></tr>`;
  }).join('');
  const sum = ANCHOR_CLASSES.reduce((s, c) => s + (Number(d[c]) || 0), 0);
  const seg = Object.entries(ANCHOR_VARIANTS).map(([k, l]) => `<button data-act="anchor-variant" data-v="${k}" class="${ui.anchorVariant === k ? 'on' : ''}">${l}</button>`).join('');
  return `<div class="card"><p class="sub">${a.weeks} haftalık veriyle risk eşitliği. Riskli sepetin oynaklığı ${pct(sug.risky_vol_pct, 1)}; hedef %${P.anchor.target_vol_pct} için riskli pay ${pct(sug.k * 100, 0)}, kalan TL sabit.</p>
    <div class="seg wide">${seg}</div><p class="sub">Gruplar: ${esc(groups)}</p>
    <table class="anchor"><thead><tr><th>Sınıf</th><th>Öneri</th><th>Senin</th><th>Fark</th></tr></thead><tbody>${rows}
    <tr class="sum"><td>Toplam</td><td>100</td><td id="anchor-sum">${num(sum, 0)}</td><td></td></tr></tbody></table>
    ${sug.warnings.length ? `<p class="sub neg">${sug.warnings.includes('negative_real_rate') ? 'Reel faiz negatif: TL sabit önerisi yarıya indirildi. ' : ''}${sug.warnings.includes('cap_spill') ? 'Sınıf tavanı nedeniyle fazlalık TL sabite gitti.' : ''}</p>` : ''}
    <p class="sub">Boş bıraktığın sınıf izlenir: hedefi ve bandı olmaz, öneri mevcut payını korur. "—" görünen sınıflarda öneri için yeterli veri yok.</p>
    <div class="btns"><button class="btn" data-act="anchor-copy">Öneriyi çapam yap</button><button class="btn primary" data-act="anchor-save">Çapamı kaydet</button></div>
    ${state.anchor_date ? `<p class="sub">Son kayıt: ${dateTr(state.anchor_date)}</p>` : '<p class="sub">Henüz kendi çapanı kaydetmedin.</p>'}</div>`;
}

function viewAyarlar(m) {
  const funds = fundIndex(latest);
  const alloc = ui.alloc ? allocEditor() : state.allocation
    ? `<div class="card"><div class="rows">${Object.entries(state.allocation.weights).sort((a, b) => b[1] - a[1]).map(([c, w]) => `<div class="row"><span class="l"><b>${esc(c)}</b><small>${esc(funds[c] ? fundNames(funds[c].name).short : 'veride yok')}</small></span><span class="r">%${num(w, 1)}</span></div>`).join('')}</div>
      <p class="sub">${dateTr(state.allocation.date)} tarihli. Şirket ekranındaki mevcut birikim yüzdelerini ayda bir güncelle.</p><div class="btns"><button class="btn" data-act="alloc-edit">Dağılımı güncelle</button></div></div>`
    : `<div class="card"><p class="sub">Henüz dağılım girmedin.</p><div class="btns"><button class="btn primary" data-act="alloc-edit">Dağılımımı gir</button></div></div>`;
  const d = P.decision;
  const rules = [
    ['Bant', `hedefin ±%${d.band_rel_pct}'i, en az ${d.band_min_pts}, en çok ${d.band_max_pts} puan`],
    ['Teyit süresi', `${d.confirm_days} iş günü`],
    ['Acil uyarı', `20 günlük düşüş > ${num(d.alert_sigma_mult, 1)} × normal oynaklık`],
    ['Eğim', `sürekli, en çok ±${P.tactical.max_tilt_pts}; tam eğim |S| ≥ ${num(P.tactical.full_tilt_at, 1)}`],
    ['Görüş öneri üretir mi', 'Hayır (A)'],
    ['Fon değiştirme', `puan farkı ≥ ${d.switch_score_gap}`],
    ['Yeni fon tavanı', `%${P.fund_quality.new_fund_cap_pct}`],
    ['Hedef oynaklık', `%${P.anchor.target_vol_pct} · somut karşılığı geri testten sonra`],
  ].map(([l, v]) => `<div class="row"><span class="l">${l}</span><span class="r">${v}</span></div>`).join('');
  const s = latest.sources;
  const restore = ui.restore ? `<textarea class="inp" id="restore-text" placeholder="Yedek metnini buraya yapıştır"></textarea><div class="btns"><button class="btn primary" data-act="restore-do">Geri yükle</button><button class="btn" data-act="restore-cancel">Vazgeç</button></div>` : '';
  return header('<h1>Ayarlar</h1>', `Model ${latest.model_version} · parametre v${latest.param_version}`) + `<main>
    <section class="sec" id="alloc"><h2>Dağılımım</h2>${alloc}</section>
    <section class="sec"><h2>Çapa <small>öneri uygulamanın, karar senin</small></h2>${anchorBlock(m)}</section>
    <section class="sec"><h2>Kurallar <small>parametreler</small></h2><div class="card"><div class="rows">${rules}</div></div></section>
    <section class="sec"><h2>Veri</h2><div class="card"><div class="rows">
      <div class="row"><span class="l">TEFAS</span><span class="r">${s.tefas.funds} fon · ${s.tefas.halal} helal<small>${dateTr(s.tefas.first_date)} – ${dateTr(s.tefas.last_date)}</small></span></div>
      <div class="row"><span class="l">İçerik</span><span class="r">${dateTr(latest.content_date)}</span></div>
      <div class="row"><span class="l">EVDS · FRED</span><span class="r">${esc(s.evds.status)} · ${esc(s.fred.status)}</span></div>
      <div class="row"><span class="l">Hesap</span><span class="r">${esc(latest.generated_at)}</span></div></div></div></section>
    <section class="sec"><h2>Yedek <small>veriler yalnız bu telefonda</small></h2><div class="card">
      <div class="btns"><button class="btn" data-act="backup">Yedeği kopyala</button><button class="btn" data-act="restore">Yedekten geri yükle</button></div>${restore}</div></section>
  </main>`;
}

function render() {
  if (loadError) {
    root.innerHTML = `<main><p class="empty">Veri yüklenemedi: ${esc(loadError)}</p><div class="btns"><button class="btn primary" data-act="reload">Yeniden dene</button></div></main>`;
    return;
  }
  if (!latest) {
    root.innerHTML = '<p class="empty">maliSK yükleniyor…</p>';
    return;
  }
  const m = derive();
  let html;
  if (ui.fund) html = viewFund(ui.fund);
  else if (ui.tab === 'model') html = viewModel(m);
  else if (ui.tab === 'fonlar') html = viewFonlar();
  else if (ui.tab === 'ayarlar') html = viewAyarlar(m);
  else html = viewBugun(m);
  const sheet = ui.sheet ? `<div class="sheet-bg" data-act="sheet-close"><div class="sheet" role="dialog" aria-modal="true"><h3>${ui.sheet.title}</h3>${ui.sheet.html}<button class="btn" data-act="sheet-close">Kapat</button></div></div>` : '';
  const toast = ui.toast ? `<div class="toast" role="status">${esc(ui.toast)}</div>` : '';
  root.innerHTML = html + tabbar() + sheet + toast;
  render.m = m;
}

// ---------- Olaylar ----------
root.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act;
  if (act === 'sheet-close') {
    if (e.target.closest('.sheet') && el.classList.contains('sheet-bg')) return;
    ui.sheet = null;
  } else if (act === 'tab') {
    ui.tab = el.dataset.tab;
    ui.fund = null;
    window.scrollTo(0, 0);
  } else if (act === 'fund') {
    ui.fund = el.dataset.code;
    window.scrollTo(0, 0);
  } else if (act === 'back') {
    ui.fund = null;
  } else if (act === 'cat') {
    ui.category = el.dataset.cat;
  } else if (act === 'explain') {
    ui.sheet = explain(el.dataset.key, render.m);
  } else if (act === 'view') {
    state.views[el.dataset.cls] = Number(el.dataset.v);
    persist();
  } else if (act === 'toggle-proposal') {
    ui.showProposal = !ui.showProposal;
  } else if (act === 'apply') {
    const p = render.m.proposal;
    state.allocation_history.push(state.allocation);
    state.allocation = { date: latest.data_date, weights: p.weights };
    state.decisions.push({ date: latest.data_date, action: 'uygulandi', weights: p.weights });
    ui.showProposal = false;
    persist();
    showToast('Yeni dağılımın kaydedildi. Sayaçlar sıfırlandı.');
    return;
  } else if (act === 'reject') {
    state.decisions.push({ date: latest.data_date, action: 'reddedildi' });
    ui.showProposal = false;
    persist();
    showToast('Öneri reddedildi; 20 iş günü yeni öneri gelmez.');
    return;
  } else if (act === 'go-alloc' || act === 'alloc-edit') {
    ui.tab = 'ayarlar';
    ui.fund = null;
    const w = state.allocation?.weights || {};
    ui.alloc = { date: todayIstanbul(), rows: Object.keys(w).length ? Object.entries(w).map(([code, v]) => ({ code, pct: Math.round(v * 10) / 10 })) : [{ code: '', pct: '' }] };
  } else if (act === 'alloc-add') {
    ui.alloc.rows.push({ code: '', pct: '' });
  } else if (act === 'alloc-del') {
    ui.alloc.rows.splice(Number(el.dataset.i), 1);
  } else if (act === 'alloc-cancel') {
    ui.alloc = null;
  } else if (act === 'alloc-save') {
    const rows = ui.alloc.rows.filter((r) => r.code && Number(String(r.pct).replace(',', '.')) > 0);
    const sum = rows.reduce((s, r) => s + Number(String(r.pct).replace(',', '.')), 0);
    const codes = new Set(rows.map((r) => r.code));
    if (!rows.length) return showToast('En az bir fon ve yüzde gir.');
    if (codes.size !== rows.length) return showToast('Aynı fon iki kez girilmiş.');
    if (Math.abs(sum - 100) > 0.5) return showToast(`Toplam ${num(sum, 1)}; 100 olmalı.`);
    if (state.allocation) state.allocation_history.push(state.allocation);
    state.allocation = { date: ui.alloc.date || todayIstanbul(), weights: Object.fromEntries(rows.map((r) => [r.code, (Number(String(r.pct).replace(',', '.')) * 100) / sum])) };
    ui.alloc = null;
    persist();
    showToast('Dağılımın kaydedildi.');
    return;
  } else if (act === 'anchor-variant') {
    ui.anchorVariant = el.dataset.v;
  } else if (act === 'anchor-copy') {
    const w = latest.anchor[ui.anchorVariant].weights;
    ui.anchorDraft = Object.fromEntries(ANCHOR_CLASSES.map((c) => [c, typeof w[c] === 'number' ? String(Math.round(w[c])) : '']));
  } else if (act === 'anchor-save') {
    const d = ui.anchorDraft;
    const set = ANCHOR_CLASSES.filter((c) => String(d[c]).trim() !== '' && Number.isFinite(Number(d[c])));
    const sum = set.reduce((s, c) => s + Number(d[c]), 0);
    if (Math.abs(sum - 100) > 0.5) return showToast(`Çapa toplamı ${num(sum, 0)}; 100 olmalı.`);
    state.anchor = Object.fromEntries(set.map((c) => [c, Number(d[c])]));
    state.anchor_date = todayIstanbul();
    persist();
    showToast('Çapan kaydedildi.');
    return;
  } else if (act === 'claude') {
    const m = render.m;
    let proposal = m.proposal;
    if (!proposal && m.bands) { try { proposal = buildProposal(latest, m.drift.current, m.bands, m.targets.targets, P); } catch { proposal = null; } }
    const text = buildPrompt({ latest, state, drift: m.drift, targets: m.targets, bands: m.bands, due: m.due, proposal });
    copyText(text, 'Kopyalandı. Claude uygulamasını açıp yapıştır.');
    return;
  } else if (act === 'backup') {
    copyText(exportState(state), 'Yedek kopyalandı. Notlar gibi güvenli bir yere yapıştır.');
    return;
  } else if (act === 'restore') {
    ui.restore = true;
  } else if (act === 'restore-cancel') {
    ui.restore = false;
  } else if (act === 'restore-do') {
    try {
      state = importState(document.getElementById('restore-text').value);
      persist();
      ui.restore = false;
      ui.anchorDraft = null;
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
  } else if (kind === 'anchor') {
    ui.anchorDraft[el.dataset.cls] = el.value.replace(',', '.');
    const sum = ANCHOR_CLASSES.reduce((s, c) => s + (Number(ui.anchorDraft[c]) || 0), 0);
    document.getElementById('anchor-sum').textContent = num(sum, 0);
    const sug = latest.anchor[ui.anchorVariant].weights[el.dataset.cls];
    const cell = document.querySelector(`[data-diff="${el.dataset.cls}"]`);
    if (cell && sug !== undefined) cell.textContent = signed((Number(ui.anchorDraft[el.dataset.cls]) || 0) - sug, 0);
  }
});

root.addEventListener('change', (e) => {
  const el = e.target;
  if (el.dataset.in === 'alloc-code') ui.alloc.rows[Number(el.dataset.i)].code = el.value;
});

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

load();
