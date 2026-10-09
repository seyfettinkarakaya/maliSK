// Kullanıcı parametreleri: varsayılan + telefonda kaydedilen değişiklikler (docs/model.md, Bölüm 12).
// Her kayıt yeni sürümdür; sonuçlar "varsayılan sürüm.kullanıcı sürümü" etiketiyle gösterilir.

export function getPath(obj, key) {
  return key.split('.').reduce((o, k) => (o === undefined || o === null ? undefined : o[k]), obj);
}

function setPath(obj, key, value) {
  const parts = key.split('.');
  let o = obj;
  for (const k of parts.slice(0, -1)) o = o[k];
  o[parts[parts.length - 1]] = value;
}

// values: { 'decision.yellow_rel_pct': 15, ... } — yalnız meta listesindeki anahtarlar uygulanır.
export function effectiveParams(base, values = {}, meta = []) {
  const p = structuredClone(base);
  const allowed = new Set(meta.map((m) => m.key));
  for (const [k, v] of Object.entries(values || {})) {
    if (allowed.has(k) && typeof v === 'number' && Number.isFinite(v) && getPath(p, k) !== undefined) setPath(p, k, v);
  }
  return p;
}

export function paramVersion(base, user) {
  return user?.n ? `${base.version}.${user.n}` : String(base.version);
}

// Tutarlılık denetimi; boş dizi = geçerli.
export function validateParams(p) {
  const errors = [];
  const tw = p.tactical.weights;
  if (Math.abs(tw.trend + tw.macro + tw.user - 1) > 1e-6) errors.push('Görüş ağırlıklarının toplamı 1 olmalı');
  if (p.decision.yellow_rel_pct >= p.decision.red_rel_pct) errors.push('Kırmızı eşik sarıdan büyük olmalı');
  const fw = Object.values(p.fund_quality.weights).reduce((a, b) => a + b, 0);
  if (fw <= 0) errors.push('Fon puanı ağırlıklarından en az biri sıfırdan büyük olmalı');
  return errors;
}
