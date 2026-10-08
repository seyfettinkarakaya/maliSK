// Çapa ağacı (docs/model.md, Bölüm 4, 5 ve 8): 1. katman grup, 2. katman grup içi pay.
// Görüş yalnız grup hedefini kaydırır; grup içi pay çapadaki gibi kalır. Bant iki düzeylidir.
import { tilt, viewLabel, targetsFromAnchor } from './tactical.mjs';
import { bandCheck } from './bands.mjs';

const isNum = (x) => typeof x === 'number' && Number.isFinite(x);

export function groupOf(tree, cls) {
  return tree.find((g) => g.classes.includes(cls))?.id ?? null;
}

// Kullanıcı çapası { groups: { grup: yüzde }, splits: { grup: { sınıf: yüzde } } }.
// Eski düz biçim { sınıf: yüzde } de kabul edilir: grup = sınıfların toplamı, pay = oranları.
// Çok sınıflı grupta pays'ta olmayan sınıf izlenir (hedefi yok).
export function normalizeAnchor(tree, anchor) {
  if (!anchor) return null;
  if (anchor.groups) {
    const groups = {};
    const splits = {};
    for (const g of tree) {
      if (!isNum(anchor.groups[g.id])) continue;
      groups[g.id] = anchor.groups[g.id];
      if (g.classes.length < 2) continue;
      const s = anchor.splits?.[g.id] || {};
      const set = g.classes.filter((c) => isNum(s[c]));
      const sum = set.reduce((t, c) => t + s[c], 0);
      splits[g.id] = set.length && sum > 0
        ? Object.fromEntries(set.map((c) => [c, (s[c] * 100) / sum]))
        : Object.fromEntries(g.classes.map((c) => [c, 100 / g.classes.length]));
    }
    return { groups, splits };
  }
  const groups = {};
  const splits = {};
  for (const g of tree) {
    const set = g.classes.filter((c) => isNum(anchor[c]));
    if (!set.length) continue;
    const sum = set.reduce((t, c) => t + anchor[c], 0);
    groups[g.id] = sum;
    if (g.classes.length > 1) {
      splits[g.id] = Object.fromEntries(set.map((c) => [c, sum > 0 ? (anchor[c] * 100) / sum : 100 / set.length]));
    }
  }
  return { groups, splits };
}

// Grubun yönetilen sınıfları: tek sınıflı grupta o sınıf, çok sınıflıda paydaki sınıflar.
export function managedClasses(tree, a, gid) {
  const g = tree.find((x) => x.id === gid);
  if (!g || !a || !isNum(a.groups[gid])) return [];
  return g.classes.length === 1 ? [...g.classes] : g.classes.filter((c) => isNum(a.splits[gid]?.[c]));
}

export function splitShare(tree, a, gid, cls) {
  const g = tree.find((x) => x.id === gid);
  return g.classes.length === 1 ? 100 : a.splits[gid][cls];
}

// Sınıf düzeyinde çapa = grup çapası × grup içi pay.
export function classAnchor(tree, a) {
  const out = {};
  for (const g of tree) for (const c of managedClasses(tree, a, g.id)) out[c] = (a.groups[g.id] * splitShare(tree, a, g.id, c)) / 100;
  return out;
}

// classS: { sınıf: S }. Grup görüşü S_g = Σ pay_c · S_c / 100; eğim grup düzeyinde.
// Grup hedefi = (çapa + eğim) × 100 / Σ, sonra izlenen pay düşülerek ölçeklenir.
// Sınıf hedefi = grup hedefi × grup içi pay.
export function treeTargets(tree, a, classS, t, unmanagedShare = 0) {
  const groups = {};
  const managed = tree.filter((g) => managedClasses(tree, a, g.id).length);
  for (const g of managed) {
    const classes = managedClasses(tree, a, g.id);
    const S = classes.reduce((s, c) => s + (splitShare(tree, a, g.id, c) * (classS[c] ?? 0)) / 100, 0);
    groups[g.id] = { anchor: a.groups[g.id], S, tilt: tilt(S, t), label: viewLabel(S, t), classes };
  }
  const raw_sum = managed.reduce((s, g) => s + Math.max(0, groups[g.id].anchor + groups[g.id].tilt), 0);
  const base = targetsFromAnchor(
    Object.fromEntries(managed.map((g) => [g.id, groups[g.id].anchor])),
    Object.fromEntries(managed.map((g) => [g.id, groups[g.id].tilt])),
  );
  const scale = (100 - unmanagedShare) / 100;
  const group_targets = {};
  const targets = {};
  for (const g of managed) {
    group_targets[g.id] = base[g.id] * scale;
    groups[g.id].target = group_targets[g.id];
    groups[g.id].splits = Object.fromEntries(groups[g.id].classes.map((c) => [c, splitShare(tree, a, g.id, c)]));
    for (const c of groups[g.id].classes) targets[c] = (group_targets[g.id] * groups[g.id].splits[c]) / 100;
  }
  return { groups, group_targets, targets, raw_sum, scale };
}

// Grup maruziyeti = yönetilen sınıflarının maruziyet toplamı.
export function groupExposure(tree, a, exposure) {
  const out = {};
  for (const g of tree) {
    const classes = managedClasses(tree, a, g.id);
    if (classes.length) out[g.id] = classes.reduce((s, c) => s + (exposure[c] || 0), 0);
  }
  return out;
}

// İki düzeyli bant. Grup: göreli bant (bands.mjs). Grup içi pay: hedef pay ± split_band_pts;
// grup portföyün split_min_group_pct'inden küçükse pay denetlenmez.
export function treeBandCheck(tree, a, exposure, groupTargets, d) {
  const gx = groupExposure(tree, a, exposure);
  const groups = bandCheck(gx, groupTargets, d);
  const splits = {};
  const class_out = {};
  for (const gid of Object.keys(groupTargets)) {
    const classes = managedClasses(tree, a, gid);
    for (const c of classes) class_out[c] = groups[gid].status !== 'inside';
    if (classes.length < 2) continue;
    const skipped = gx[gid] < d.split_min_group_pct;
    splits[gid] = {};
    for (const c of classes) {
      const target = a.splits[gid][c];
      const value = gx[gid] > 0 ? ((exposure[c] || 0) * 100) / gx[gid] : target;
      const low = Math.max(0, target - d.split_band_pts);
      const high = Math.min(100, target + d.split_band_pts);
      const status = skipped ? 'inside' : value > high ? 'above' : value < low ? 'below' : 'inside';
      splits[gid][c] = { target, value, low, high, status, skipped };
      if (status !== 'inside') class_out[c] = true;
    }
  }
  return { group_exposure: gx, groups, splits, class_out };
}

// Hedefe uzaklık (docs/model.md, Bölüm 8): yönetilen grupların hedefin üstündeki fazlalarının toplamı.
// Dengelemek için toplam birikimin yaklaşık bu kadar puanının başka fonlara taşınması gerekir.
export function targetDistance(groupExposure, groupTargets) {
  return Object.keys(groupTargets).reduce((s, g) => s + Math.max(0, (groupExposure[g] || 0) - groupTargets[g]), 0);
}
