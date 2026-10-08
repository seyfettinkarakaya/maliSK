// Kişisel durum yalnız telefonda (localStorage; bildirim için IndexedDB kopyası). Depoya ya da sunucuya gitmez.
const KEY = 'malisk.v1';

export const EMPTY_STATE = {
  contracts: [], // [{ no, date, weights: { kod: yüzde } }] — BES sözleşmeleri
  contracts_history: [],
  shares: null, // { date, values: { no: yüzde } } — sözleşmelerin toplam birikimdeki payı
  allocation: null, // eski tek dağılım (ilk açılışta sözleşme 1'e taşınır)
  allocation_history: [],
  anchor: null, // { groups, splits } — çapa ağacı
  anchor_date: null,
  views: {}, // { sınıf: −1 | 0 | 1 } — K
  decisions: [], // { date, action: 'uygulandi' | 'reddedildi', weights? }
  checklist: null, // { key, done: ['no:kod'] } — Dengele adımları
  params: { n: 0, date: null, values: {} }, // kullanıcı parametreleri (sürüm n)
  param_history: [],
  prefs: { size: 'l', theme: 'auto', notify: false },
  push: null, // { secret, date } — bildirim anahtarı (yedeğe girmez)
};

const fresh = () => structuredClone(EMPTY_STATE);

function merge(raw) {
  const st = { ...fresh(), ...(raw || {}) };
  st.prefs = { ...EMPTY_STATE.prefs, ...(raw?.prefs || {}) };
  st.params = { ...EMPTY_STATE.params, ...(raw?.params || {}) };
  return st;
}

export function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    return merge(raw ? JSON.parse(raw) : null);
  } catch {
    return fresh();
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
  const { push, ...rest } = state;
  return JSON.stringify({ app: 'maliSK', version: 2, saved_at: new Date().toISOString(), state: rest }, null, 1);
}

export function importState(text) {
  const doc = JSON.parse(text);
  if (doc.app !== 'maliSK' || !doc.state) throw new Error('Bu metin bir maliSK yedeği değil.');
  return merge(doc.state);
}
