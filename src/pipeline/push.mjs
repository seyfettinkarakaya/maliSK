// Günlük bildirim: veri güncellenince telefona şifreli kısa bir sinyal gönderir. Bildirim metnini telefon
// kendi verisiyle hesaplar (dağılım telefondan çıkmaz). MALISK_PUSH yoksa sessizce çıkar.
import fs from 'node:fs';
import { sendPush } from './webpush.mjs';

const SITE = 'https://seyfettinkarakaya.github.io/maliSK/';

async function waitForPages(generatedAt, tries = 20) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(`${SITE}data/latest.json?t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok && (await res.json()).generated_at === generatedAt) return true;
    } catch { /* yeniden dene */ }
    await new Promise((r) => setTimeout(r, 15000));
  }
  return false;
}

async function main() {
  const secret = process.env.MALISK_PUSH;
  if (!secret) return console.log('Bildirim anahtarı tanımlı değil; bildirim gönderilmedi.');
  const latest = JSON.parse(fs.readFileSync('data/latest.json', 'utf8'));
  const ready = await waitForPages(latest.generated_at);
  console.log(ready ? 'Site güncel.' : 'Site henüz güncellenmedi; yine de gönderiliyor.');
  const r = await sendPush(secret, { t: 'daily', d: latest.data_date, g: latest.generated_at }, { subject: SITE });
  if (r.gone) console.log('Abonelik kapalı (telefonda bildirimler kapatılmış). Gönderim atlandı.');
  else if (r.status >= 200 && r.status < 300) console.log('Bildirim gönderildi.');
  else { console.log(`Bildirim servisi yanıtı: ${r.status}`); process.exitCode = 1; }
}

main().catch((err) => { console.error(`Bildirim gönderilemedi: ${err.message}`); process.exitCode = 1; });
