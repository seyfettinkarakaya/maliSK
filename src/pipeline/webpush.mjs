// Web Push (RFC 8291 aes128gcm şifreleme + RFC 8292 VAPID). Bağımlılık yok, yalnız node:crypto.
// Anahtarlar GitHub Secret'tan gelir; hiçbir anahtar ya da abonelik bilgisi loglanmaz.
import crypto from 'node:crypto';

const b64u = (buf) => Buffer.from(buf).toString('base64url');
const fromB64u = (s) => Buffer.from(s, 'base64url');

// payload: Buffer; sub: { endpoint, keys: { p256dh, auth } }. Dönen gövde aes128gcm biçiminde.
export function encrypt(payload, sub, { salt = crypto.randomBytes(16), ecdh = null } = {}) {
  const uaPublic = fromB64u(sub.keys.p256dh);
  const authSecret = fromB64u(sub.keys.auth);
  const as = ecdh || crypto.createECDH('prime256v1');
  if (!ecdh) as.generateKeys();
  const asPublic = as.getPublicKey();
  const shared = as.computeSecret(uaPublic);
  const keyInfo = Buffer.concat([Buffer.from('WebPush: info\0'), uaPublic, asPublic]);
  const ikm = Buffer.from(crypto.hkdfSync('sha256', shared, authSecret, keyInfo, 32));
  const cek = Buffer.from(crypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16));
  const nonce = Buffer.from(crypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12));
  const cipher = crypto.createCipheriv('aes-128-gcm', cek, nonce);
  const body = Buffer.concat([cipher.update(Buffer.concat([payload, Buffer.from([2])])), cipher.final(), cipher.getAuthTag()]);
  const header = Buffer.alloc(21);
  salt.copy(header, 0);
  header.writeUInt32BE(4096, 16);
  header.writeUInt8(asPublic.length, 20);
  return Buffer.concat([header, asPublic, body]);
}

// Alıcı tarafı (yalnız testte): uaEcdh alıcının özel anahtarı.
export function decrypt(body, uaEcdh, authSecret) {
  const salt = body.subarray(0, 16);
  const idlen = body.readUInt8(20);
  const asPublic = body.subarray(21, 21 + idlen);
  const data = body.subarray(21 + idlen);
  const shared = uaEcdh.computeSecret(asPublic);
  const keyInfo = Buffer.concat([Buffer.from('WebPush: info\0'), uaEcdh.getPublicKey(), asPublic]);
  const ikm = Buffer.from(crypto.hkdfSync('sha256', shared, authSecret, keyInfo, 32));
  const cek = Buffer.from(crypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16));
  const nonce = Buffer.from(crypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12));
  const d = crypto.createDecipheriv('aes-128-gcm', cek, nonce);
  d.setAuthTag(data.subarray(data.length - 16));
  const plain = Buffer.concat([d.update(data.subarray(0, data.length - 16)), d.final()]);
  return plain.subarray(0, plain.lastIndexOf(2));
}

// jwk: telefonda üretilen P-256 özel anahtarı ({ kty, crv, x, y, d }).
export function vapidHeaders(endpoint, jwk, subject, now = Math.floor(Date.now() / 1000)) {
  const header = b64u(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const claims = b64u(JSON.stringify({ aud: new URL(endpoint).origin, exp: now + 12 * 3600, sub: subject }));
  const key = crypto.createPrivateKey({ key: jwk, format: 'jwk' });
  const sig = crypto.sign('sha256', Buffer.from(`${header}.${claims}`), { key, dsaEncoding: 'ieee-p1363' });
  const pub = Buffer.concat([Buffer.from([4]), fromB64u(jwk.x), fromB64u(jwk.y)]);
  return { Authorization: `vapid t=${header}.${claims}.${b64u(sig)}, k=${b64u(pub)}` };
}

// secret: telefonun ürettiği "bildirim anahtarı" (base64url JSON { s: abonelik, k: özel JWK }).
export function parseSecret(secret) {
  const doc = JSON.parse(fromB64u(String(secret).trim()).toString('utf8'));
  if (!doc?.s?.endpoint || !doc?.s?.keys?.p256dh || !doc?.k?.d) throw new Error('bildirim anahtarı okunamadı');
  return doc;
}

export async function sendPush(secret, payloadObj, { subject, ttl = 86400, fetchImpl = fetch } = {}) {
  const { s, k } = parseSecret(secret);
  const body = encrypt(Buffer.from(JSON.stringify(payloadObj)), s);
  const res = await fetchImpl(s.endpoint, {
    method: 'POST',
    headers: { ...vapidHeaders(s.endpoint, k, subject), 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream', TTL: String(ttl), Urgency: 'normal' },
    body,
  });
  return { status: res.status, gone: res.status === 404 || res.status === 410 };
}
