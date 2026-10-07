// Fon içeriğinden varlık sınıfına eşleme ve portföy maruziyeti (docs/model.md, Bölüm 6).
import { CLASSES } from './params.mjs';

export function categoryFromName(name, keywords) {
  const upper = String(name || '').toLocaleUpperCase('tr-TR');
  for (const [kw, cat] of keywords) {
    if (upper.includes(kw)) return cat;
  }
  return 'unclassified';
}

function emptyClasses() {
  return Object.fromEntries(CLASSES.map((c) => [c, 0]));
}

function argmax(obj) {
  let best = null;
  for (const [k, v] of Object.entries(obj)) {
    if (v > 0 && (best === null || v > obj[best])) best = k;
  }
  return best;
}

// fund: { category, content: { alan: yüzde } } → { sınıf: yüzde }, bilinmeyen alanlar Belirsiz'e.
export function fundExposure(fund, universe) {
  const out = emptyClasses();
  let basket = 0;
  let other = 0;
  const unknown = [];
  for (const [field, raw] of Object.entries(fund.content || {})) {
    const v = Number(raw) || 0;
    if (!v) continue;
    const rule = universe.content_map[field];
    if (rule === 'metal') out[fund.category === 'silver' ? 'silver' : 'gold'] += v;
    else if (rule === 'basket') basket += v;
    else if (rule === 'other') other += v;
    else if (rule && rule in out) out[rule] += v;
    else {
      out.unclassified += v;
      unknown.push(field);
    }
  }
  if (basket) {
    const main = universe.basket_unclassified_categories.includes(fund.category) ? null : argmax(out);
    out[main || 'unclassified'] += basket;
  }
  if (other) {
    out[universe.other_tl_categories.includes(fund.category) ? 'tl_fixed' : 'unclassified'] += other;
  }
  return { exposure: out, unknown_fields: unknown };
}

export function mainClass(exposure) {
  return argmax(exposure) || 'unclassified';
}

// weights: { fon_kodu: yüzde }, exposures: { fon_kodu: { sınıf: yüzde } } → { sınıf: yüzde }
export function portfolioExposure(weights, exposures) {
  const out = emptyClasses();
  for (const [code, w] of Object.entries(weights)) {
    const e = exposures[code];
    if (!e) continue;
    for (const c of CLASSES) out[c] += (w * e[c]) / 100;
  }
  return out;
}

export function weightedFee(weights, fees) {
  let s = 0;
  for (const [code, w] of Object.entries(weights)) s += (w * (fees[code] ?? 0)) / 100;
  return s;
}
