// maliSK service worker: yalnız bildirim. Önbellek yok (her açılışta güncel kod ve veri).
// Günlük sinyal gelince güncel latest.json'u indirir, kişisel durumu IndexedDB'den okur ve bildirimi
// telefonda hesaplar; dağılım telefondan çıkmaz.
import { compute, dailyNotice } from './src/app/engine.mjs';
import { GROUP_LABELS, CLASS_LABELS } from './src/model/params.mjs';
import { idbGet } from './src/app/idb.mjs';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

async function notice() {
  try {
    const res = await fetch(`./data/latest.json?t=${Date.now()}`, { cache: 'no-store' });
    const latest = await res.json();
    const state = await idbGet('state');
    if (!state) return { title: 'maliSK', body: `Veri ${latest.data_date} güncellendi.`, tag: 'malisk-gunluk' };
    return dailyNotice(compute(latest, state, { withProposal: true }), GROUP_LABELS, CLASS_LABELS);
  } catch {
    return { title: 'maliSK', body: 'Günlük veri güncellendi.', tag: 'malisk-gunluk' };
  }
}

self.addEventListener('push', (event) => {
  event.waitUntil(notice().then((n) => self.registration.showNotification(n.title, { body: n.body, tag: n.tag, icon: './icons/icon-192.png', badge: './icons/icon-192.png' })));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (all.length) return all[0].focus();
    return self.clients.openWindow('./');
  })());
});
