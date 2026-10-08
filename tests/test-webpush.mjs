// Web Push şifreleme ve VAPID imzası (alıcı tarafıyla gidiş-dönüş).
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { encrypt, decrypt, vapidHeaders, parseSecret, sendPush } from '../src/pipeline/webpush.mjs';

function receiver() {
  const ua = crypto.createECDH('prime256v1');
  ua.generateKeys();
  const auth = crypto.randomBytes(16);
  return { ua, auth, sub: { endpoint: 'https://web.push.apple.com/abc', keys: { p256dh: ua.getPublicKey().toString('base64url'), auth: auth.toString('base64url') } } };
}

test('aes128gcm: şifrele ve çöz', () => {
  const { ua, auth, sub } = receiver();
  const msg = Buffer.from(JSON.stringify({ t: 'daily', d: '2026-10-08' }));
  const body = encrypt(msg, sub);
  assert.equal(body.readUInt32BE(16), 4096);
  assert.equal(body.readUInt8(20), 65);
  assert.deepEqual(decrypt(body, ua, auth), msg);
});

test('VAPID: ES256 imzası açık anahtarla doğrulanır', () => {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const jwk = privateKey.export({ format: 'jwk' });
  const h = vapidHeaders('https://web.push.apple.com/abc', jwk, 'https://example.org/', 1000);
  const [, token, k] = h.Authorization.match(/^vapid t=(.+), k=(.+)$/);
  const [hd, cl, sig] = token.split('.');
  const claims = JSON.parse(Buffer.from(cl, 'base64url'));
  assert.equal(claims.aud, 'https://web.push.apple.com');
  assert.equal(claims.exp, 1000 + 43200);
  assert.ok(crypto.verify('sha256', Buffer.from(`${hd}.${cl}`), { key: publicKey, dsaEncoding: 'ieee-p1363' }, Buffer.from(sig, 'base64url')));
  assert.equal(Buffer.from(k, 'base64url').length, 65);
});

test('bildirim anahtarı ve gönderim (sahte servis)', async () => {
  const { ua, auth, sub } = receiver();
  const { privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const secret = Buffer.from(JSON.stringify({ s: sub, k: privateKey.export({ format: 'jwk' }) })).toString('base64url');
  assert.equal(parseSecret(secret).s.endpoint, sub.endpoint);
  let seen = null;
  const r = await sendPush(secret, { t: 'daily' }, { subject: 'https://example.org/', fetchImpl: async (url, init) => { seen = { url, init }; return { status: 201 }; } });
  assert.equal(r.status, 201);
  assert.equal(seen.init.headers['Content-Encoding'], 'aes128gcm');
  assert.deepEqual(JSON.parse(decrypt(seen.init.body, ua, auth)), { t: 'daily' });
  const gone = await sendPush(secret, {}, { subject: 'x:', fetchImpl: async () => ({ status: 410 }) });
  assert.equal(gone.gone, true);
});
