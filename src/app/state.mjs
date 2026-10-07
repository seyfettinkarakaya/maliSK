// Kişisel durum yalnız telefonda (localStorage). Depoya ya da sunucuya gitmez.
const KEY = 'malisk.v1';

export const EMPTY_STATE = {
  allocation: null, // { date: 'YYYY-MM-DD', weights: { kod: yüzde } } — mevcut birikimin dağılımı
  allocation_history: [],
  anchor: null, // { sınıf: yüzde } — kullanıcının çapası
  anchor_date: null,
  views: {}, // { sınıf: −1 | 0 | 1 } — K
  decisions: [], // { date, action: 'uygulandi' | 'reddedildi', weights? }
};

export function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...EMPTY_STATE, ...JSON.parse(raw) } : { ...EMPTY_STATE };
  } catch {
    return { ...EMPTY_STATE };
  }
}

export function saveState(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function exportState(state) {
  return JSON.stringify({ app: 'maliSK', version: 1, saved_at: new Date().toISOString(), state }, null, 1);
}

export function importState(text) {
  const doc = JSON.parse(text);
  if (doc.app !== 'maliSK' || !doc.state) throw new Error('Bu metin bir maliSK yedeği değil.');
  return { ...EMPTY_STATE, ...doc.state };
}
