// "Claude'a danış": günün özetini, dağılımı ve öneriyi Claude'a yapıştırılacak bir metne çevirir.
import { CLASS_LABELS, GROUP_LABELS } from '../model/params.mjs';
import { ANCHOR_CLASSES } from './personal.mjs';
import { num, pct, signed, fundNames } from './format.mjs';

const VIEW = { positive: 'Olumlu', neutral: 'Nötr', negative: 'Olumsuz' };

export function buildPrompt({ latest, state, drift, targets, bands, due, proposal }) {
  const L = [];
  const funds = Object.fromEntries(latest.funds.map((f) => [f.code, f]));
  L.push('maliSK verilerimle helal (katılım) BES dağılımımı birlikte değerlendirmeni istiyorum.');
  L.push(`Fon verisi tarihi: ${latest.data_date} · model ${latest.model_version} · parametre sürümü ${latest.param_version}.`);
  L.push('Yatırım tavsiyesi değil karar desteği istiyorum; gerekçeni ve emin olmadığın noktaları açıkça yaz.');
  L.push('');
  if (drift) {
    const contracts = state.contracts?.length ? state.contracts : state.allocation ? [{ no: '1', date: state.allocation.date, weights: state.allocation.weights }] : [];
    L.push('## Dağılımım (toplam, bugün fiyatla kaymış hâli)');
    for (const [code, w] of Object.entries(drift.current).sort((a, b) => b[1] - a[1])) {
      const f = funds[code];
      const nm = f ? fundNames(f.name).short : '';
      L.push(`- ${code} ${nm}${f?.tefas_type ? ` [${f.tefas_type}]` : ''}: bugün %${num(w, 1)}` + (f?.score !== null && f?.score !== undefined ? `, puan ${num(f.score, 0)} (${f.rank}/${f.peers})` : '') + (f?.fee !== null && f?.fee !== undefined ? `, ücret %${num(f.fee, 2)}` : ''));
    }
    if (contracts.length > 1) {
      L.push('Sözleşmeler (toplamdaki pay):');
      for (const c of contracts) L.push(`- ${c.no}: %${num(drift.shares_now?.[c.no] ?? 0, 1)} · ` + Object.entries(c.weights).map(([k, v]) => `${k} %${num(v, 0)}`).join(', ') + ` (${c.date})`);
    }
    L.push(`Başlangıçtan bu yana toplam getiri: ${pct(drift.return_pct, 1)}.`);
    L.push('');
  }
  if (targets) {
    L.push('## Çapa ağacı: grup maruziyeti, hedef, bant (görüş yalnız grubu kaydırır)');
    for (const [g, r] of Object.entries(targets.groups)) {
      const b = bands?.groups[g];
      L.push(`- ${GROUP_LABELS[g]}: maruziyet ${b ? num(b.value, 1) : '—'}, çapa ${num(r.anchor, 1)}, eğim ${signed(r.tilt, 1)} (S ${signed(r.S, 2)}), hedef ${num(r.target, 1)}, bant ${b ? `${num(b.low, 1)}–${num(b.high, 1)}` : '—'}, bant dışı ${bands?.counters['group:' + g] ?? 0} iş günü`);
      const sp = bands?.splits[g];
      if (r.classes.length > 1) {
        L.push('  - Grup içi pay: ' + r.classes.map((c) => `${CLASS_LABELS[c]} ${sp ? num(sp[c].value, 0) : '—'} (hedef ${num(r.splits[c], 0)}, bant ${sp ? `${num(sp[c].low, 0)}–${num(sp[c].high, 0)}` : '—'})`).join(', ')
          + (sp ? `, bant dışı ${bands.counters['split:' + g] ?? 0} iş günü` : ''));
      }
    }
    L.push('Sınıf görüşleri:');
    for (const c of ANCHOR_CLASSES) {
      const r = targets.rows[c];
      L.push(`- ${CLASS_LABELS[c]}: ${VIEW[r.label]} (S ${signed(r.S, 2)} = 0,5·T ${signed(r.T, 2)} + 0,25·M ${signed(r.M, 0)} + 0,25·K ${signed(r.K, 0)})${r.managed ? `, hedef ${num(r.target, 1)}` : ', çapada yok (izleniyor)'}${bands ? `, maruziyet ${num(bands.exposure[c], 1)}` : ''}`);
    }
    if (bands) L.push(`- Belirsiz: ${num(bands.exposure.unclassified, 1)}`);
    L.push('');
  }
  const alerts = Object.entries(latest.classes).filter(([, c]) => c.alert?.triggered);
  if (alerts.length) {
    L.push('## Acil uyarılar');
    for (const [c, v] of alerts) L.push(`- ${CLASS_LABELS[c]}: 20 iş gününde ${pct(v.alert.change_pct, 1)}, eşik −%${num(v.alert.threshold_pct, 1)} (normal oynaklığın ${num(v.alert.sigma_multiple, 1)} katı)`);
    L.push('');
  }
  if (proposal) {
    L.push(`## Modelin eylem önerisi${due?.active ? '' : ' (henüz teyit edilmedi)'}`);
    for (const ch of proposal.changes) L.push(`- ${ch.code}: %${ch.from.toFixed(0)} → %${ch.to}`);
    if (proposal.gaps.length) L.push(`Uygun araç bulunamayan sınıflar: ${proposal.gaps.map((g) => CLASS_LABELS[g.cls]).join(', ')}.`);
    L.push('');
  }
  if (latest.anchor?.ok) {
    const a = latest.anchor;
    L.push(`## Uygulamanın çapa önerisi (${a.weeks} haftalık veri, risk eşitliği)`);
    L.push('- Gruplu: ' + Object.entries(a.user_groups.weights).map(([c, w]) => `${CLASS_LABELS[c]} ${num(w, 0)}`).join(', '));
    L.push('- Veriden gruplama: ' + a.suggested.groups.map((g) => g.map((c) => CLASS_LABELS[c]).join('+')).join(' / '));
    L.push('');
  }
  L.push('## Kategorilerin ilk sıradaki fonları');
  const best = {};
  for (const f of latest.funds) if (f.halal && f.score !== null && (!best[f.category] || f.score > best[f.category].score)) best[f.category] = f;
  for (const [cat, f] of Object.entries(best)) {
    L.push(`- ${latest.category_labels[cat] || cat}: ${f.code} ${fundNames(f.name).short}, puan ${num(f.score, 0)}, 1 yıl ${pct(f.returns?.['1y'], 1)}, fazla getiri indisi ${signed(f.indices?.excess, 2)}, ücret ${pct(f.fee, 2)}`);
  }
  L.push('');
  L.push('Sorularım: Dağılımım hedeften neden ve ne kadar sapıyor? Modelin önerisi mantıklı mı, gözden kaçan bir risk var mı? Çapamı değiştirmem gerekir mi?');
  return L.join('\n');
}

// Tek fon için soru metni (fon ayrıntısındaki "Bu fonu Claude'a sor").
export function buildFundPrompt({ latest, fund: f, weight = null }) {
  const L = [];
  const n = fundNames(f.name);
  L.push(`maliSK verileriyle bir helal (katılım) BES fonunu değerlendirmeni istiyorum: ${f.code} ${n.short} (${n.company}).`);
  L.push(`Fon verisi tarihi: ${latest.data_date} · model ${latest.model_version} · parametre sürümü ${latest.param_version}.`);
  L.push('Yatırım tavsiyesi değil karar desteği istiyorum; gerekçeni ve emin olmadığın noktaları açıkça yaz.');
  L.push('');
  L.push(`- TEFAS türü: ${f.tefas_type || '—'} · kategori: ${latest.category_labels[f.category] || f.category} · helal dayanağı: ${f.halal_basis || '—'}`);
  L.push(`- Puan: ${f.score === null ? 'yok' : `${num(f.score, 0)} (${f.rank}/${f.peers})`} · ücret %${num(f.fee, 2)} · SPK risk ${f.risk ?? '—'}/7 · büyüklük ${num((f.size_tl || 0) / 1e6, 0)} milyon TL`);
  L.push('- İçerik: ' + Object.entries(f.exposure).filter(([, v]) => v > 0.05).map(([c, v]) => `${CLASS_LABELS[c]} %${num(v, 1)}`).join(', '));
  L.push('- Getiri: ' + ['1m', '3m', '6m', 'ytd', '1y', '3y', '5y'].filter((p) => f.returns?.[p] !== null && f.returns?.[p] !== undefined).map((p) => `${p} ${pct(f.returns[p], 1)} (fazla ${signed(f.excess?.[p], 1)})`).join(', '));
  if (f.flags.length) L.push('- Bayraklar: ' + f.flags.join(', '));
  if (weight !== null) L.push(`- Dağılımımdaki payı: %${num(weight, 1)}`);
  L.push('');
  L.push('Sorum: Bu fonu dağılımımda tutmalı mıyım, aynı kategoride daha iyi bir seçenek var mı?');
  return L.join('\n');
}
