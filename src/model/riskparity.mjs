// Çapa önerisi: iki katmanlı risk eşitliği, hedef oynaklık, sınıf tavanı ve
// verilerden gruplama önerisi (docs/model.md, Bölüm 8.2).

// rows: T × N getiri matrisi (oran). Yıllıklaştırılmış örneklem kovaryansı.
export function covariance(rows, periods_per_year) {
  const t = rows.length;
  const n = rows[0].length;
  const mean = new Array(n).fill(0);
  for (const r of rows) for (let i = 0; i < n; i++) mean[i] += r[i] / t;
  const cov = Array.from({ length: n }, () => new Array(n).fill(0));
  for (const r of rows) {
    for (let i = 0; i < n; i++) {
      const di = r[i] - mean[i];
      for (let j = i; j < n; j++) cov[i][j] += di * (r[j] - mean[j]);
    }
  }
  for (let i = 0; i < n; i++) {
    for (let j = i; j < n; j++) {
      cov[i][j] = (cov[i][j] / (t - 1)) * periods_per_year;
      cov[j][i] = cov[i][j];
    }
  }
  return cov;
}

function mulVec(cov, w) {
  return cov.map((row) => row.reduce((s, c, j) => s + c * w[j], 0));
}

export function portfolioVol(w, cov) {
  const cw = mulVec(cov, w);
  return Math.sqrt(w.reduce((s, x, i) => s + x * cw[i], 0));
}

export function riskContributions(w, cov) {
  const cw = mulVec(cov, w);
  const sigma = portfolioVol(w, cov);
  return w.map((x, i) => (x * cw[i]) / sigma);
}

// Eşit risk katkısı: döngüsel koordinat inişi (Griveau-Billion, Richard, Roncalli 2013).
export function ercWeights(cov, { budgets, tol = 1e-10, max_iter = 10000 } = {}) {
  const n = cov.length;
  if (n === 1) return [1];
  const b = budgets || new Array(n).fill(1 / n);
  const x = cov.map((row, i) => 1 / Math.sqrt(row[i]));
  for (let it = 0; it < max_iter; it++) {
    for (let i = 0; i < n; i++) {
      let c = 0;
      for (let j = 0; j < n; j++) if (j !== i) c += cov[i][j] * x[j];
      const sigma = portfolioVol(x, cov);
      x[i] = (-c + Math.sqrt(c * c + 4 * cov[i][i] * b[i] * sigma)) / (2 * cov[i][i]);
    }
    const rc = riskContributions(x, cov);
    const total = rc.reduce((s, v) => s + v, 0);
    if (rc.every((v, i) => Math.abs(v / total - b[i]) < tol)) break;
  }
  const sum = x.reduce((s, v) => s + v, 0);
  return x.map((v) => v / sum);
}

function subCov(cov, idx) {
  return idx.map((i) => idx.map((j) => cov[i][j]));
}

// Önce grup içinde, sonra gruplar arasında eşit risk. Grupta olmayan sınıf tek başına grup olur.
export function hierarchicalErc(cov, ids, groups) {
  const pos = Object.fromEntries(ids.map((id, i) => [id, i]));
  const used = new Set();
  const gs = [];
  for (const g of groups || []) {
    const members = g.filter((id) => id in pos && !used.has(id));
    members.forEach((m) => used.add(m));
    if (members.length) gs.push(members);
  }
  for (const id of ids) if (!used.has(id)) gs.push([id]);
  const inner = gs.map((g) => ercWeights(subCov(cov, g.map((id) => pos[id]))));
  const gcov = gs.map((ga, a) =>
    gs.map((gb, b) => {
      let s = 0;
      ga.forEach((ia, p) => gb.forEach((ib, q) => { s += inner[a][p] * inner[b][q] * cov[pos[ia]][pos[ib]]; }));
      return s;
    }),
  );
  const outer = ercWeights(gcov);
  const weights = {};
  gs.forEach((g, a) => g.forEach((id, p) => { weights[id] = outer[a] * inner[a][p]; }));
  return { weights, groups: gs };
}

// Tavanı aşan sınıfın fazlası tavanın altındaki riskli sınıflara orantılı dağıtılır;
// yer kalmazsa fazlalık TL sabite gider.
export function applyCap(weights, cap) {
  const w = { ...weights };
  let spill = 0;
  for (let round = 0; round < 50; round++) {
    let excess = 0;
    for (const k of Object.keys(w)) if (w[k] > cap) { excess += w[k] - cap; w[k] = cap; }
    if (excess < 1e-12) break;
    const room = Object.keys(w).filter((k) => w[k] < cap - 1e-12);
    const base = room.reduce((s, k) => s + w[k], 0);
    if (!room.length || base <= 0) { spill += excess; break; }
    for (const k of room) w[k] += (excess * w[k]) / base;
  }
  return { weights: w, spill };
}

// cov: riskli sınıfların yıllık kovaryansı (oran). Sonuç yüzde; TL sabit kalan pay.
export function anchorSuggestion(cov, ids, a, { real_rate_pct = null } = {}) {
  const { weights: rw, groups } = hierarchicalErc(cov, ids, a.groups);
  const risky_vol_pct = portfolioVol(ids.map((id) => rw[id]), cov) * 100;
  const k = Math.min(1, a.target_vol_pct / risky_vol_pct);
  let risky = Object.fromEntries(ids.map((id) => [id, rw[id] * k * 100]));
  let tl = (1 - k) * 100;
  const warnings = [];
  if (real_rate_pct !== null && real_rate_pct < 0 && tl > 0) {
    const freed = tl * (1 - a.tl_fixed_factor_negative_real_rate);
    const base = Object.values(risky).reduce((s, v) => s + v, 0);
    for (const id of ids) risky[id] += (freed * risky[id]) / base;
    tl -= freed;
    warnings.push('negative_real_rate');
  }
  const capped = applyCap(risky, a.class_cap_pct);
  if (capped.spill > 0) warnings.push('cap_spill');
  return {
    weights: { ...capped.weights, tl_fixed: tl + capped.spill },
    risky_vol_pct,
    k,
    groups,
    warnings,
  };
}

export function correlation(cov) {
  return cov.map((row, i) => row.map((c, j) => c / Math.sqrt(cov[i][i] * cov[j][j])));
}

// Ortalama bağlantılı kümeleme, uzaklık = √((1 − ρ) / 2). k küme döner.
export function suggestGroups(cov, ids, k) {
  const rho = correlation(cov);
  const dist = (i, j) => Math.sqrt(Math.max(0, (1 - rho[i][j]) / 2));
  let clusters = ids.map((_, i) => [i]);
  while (clusters.length > k) {
    let best = null;
    for (let a = 0; a < clusters.length; a++) {
      for (let b = a + 1; b < clusters.length; b++) {
        let s = 0;
        for (const i of clusters[a]) for (const j of clusters[b]) s += dist(i, j);
        const d = s / (clusters[a].length * clusters[b].length);
        if (!best || d < best.d) best = { a, b, d };
      }
    }
    clusters[best.a] = clusters[best.a].concat(clusters[best.b]);
    clusters.splice(best.b, 1);
  }
  return clusters.map((c) => c.map((i) => ids[i]));
}
