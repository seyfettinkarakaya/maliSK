// TEFAS erişimi tek yerde. Site değişirse yalnız bu dosya değişir.
import https from 'node:https';
// Kurallar (docs/data_fields.md): tek istekte en çok 1 ay, en çok 5 yıl geriye, dakikada 6 istek;
// TEFAS bazen bağlantıyı keser, yeniden denemede cevap verir.

const BASE = 'https://www.tefas.gov.tr/api/funds/';
const URLS = { info: BASE + 'fonGnlBlgSiraliGetir', dist: BASE + 'dagilimSiraliGetirT' };
const HEADERS = {
  Accept: '*/*',
  'Content-Type': 'application/json',
  Origin: 'https://www.tefas.gov.tr',
  Referer: 'https://www.tefas.gov.tr/tr/fon-verileri',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
};
export const MAX_DAYS = 28;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ymd = (d) => d.toISOString().slice(0, 10).replaceAll('-', '');

// Bağlantıyı açık tutan istemci: TEFAS kısa aralıkla açılan yeni bağlantıları düşürüyor.
const agent = new https.Agent({ keepAlive: true, maxSockets: 1, keepAliveMsecs: 10000 });

function postJson(url, body, { connectTimeoutMs, timeoutMs }) {
  const payload = JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: 'POST', agent, timeout: timeoutMs,
      headers: { ...HEADERS, 'Content-Length': Buffer.byteLength(payload) },
    }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, text: Buffer.concat(chunks).toString('utf8') }));
      res.on('error', reject);
    });
    req.on('socket', (sock) => {
      if (!sock.connecting) return;
      const timer = setTimeout(() => req.destroy(new Error('bağlantı kurulamadı')), connectTimeoutMs);
      sock.once('connect', () => clearTimeout(timer));
      sock.once('close', () => clearTimeout(timer));
    });
    req.on('timeout', () => req.destroy(new Error('yanıt zaman aşımı')));
    req.on('error', reject);
    req.end(payload);
  });
}

export function splitRange(start, end, maxDays = MAX_DAYS) {
  const out = [];
  let cur = new Date(start);
  const last = new Date(end);
  while (cur <= last) {
    const e = new Date(Math.min(cur.getTime() + (maxDays - 1) * 86400000, last.getTime()));
    out.push([new Date(cur), e]);
    cur = new Date(e.getTime() + 86400000);
  }
  return out;
}

export class TefasClient {
  constructor({ pauseMs = 11000, retries = 5, retryWaitMs = 15000, connectTimeoutMs = 15000, timeoutMs = 90000, log = () => {} } = {}) {
    Object.assign(this, { pauseMs, retries, retryWaitMs, connectTimeoutMs, timeoutMs, log });
    this.last = 0;
    this.requests = 0;
  }

  async post(kind, start, end, fundCode = null) {
    const body = {
      fonTipi: 'EMK', fonKodu: fundCode, aramaMetni: null, fonTurKod: null, fonGrubu: null,
      sfonTurKod: null, fonTurAciklama: null, kurucuKod: null,
      basTarih: ymd(start), bitTarih: ymd(end), basSira: 1, bitSira: 100000, dil: 'TR',
      sFonTurKod: '', fonKod: '', fonGrup: '', fonUnvanTip: '',
    };
    return this.request(URLS[kind], body, `${kind} ${ymd(start)}-${ymd(end)}`);
  }

  // Fon türü (fonTurAciklama, fonTurKod), kurucu, ücretler ve SPK risk değeri — tek istekte tüm EMK fonları.
  async fundMeta() {
    const fees = await this.request(BASE + 'fonYonetimBazliBilgiGetir', { fonTipi: 'EMK', dil: 'TR' }, 'fon türü ve ücret');
    const rets = await this.request(BASE + 'fonGetiriBazliBilgiGetir', {
      fonTipi: 'EMK', dil: 'TR', calismaTipi: 2, donemGetiri1a: '1', donemGetiri3a: '1', donemGetiri6a: '1',
      donemGetiriyb: '1', donemGetiri1y: '1', donemGetiri3y: '1', donemGetiri5y: '1',
    }, 'risk değeri');
    return normalizeMeta(fees, rets);
  }

  async request(url, body, label) {
    let lastErr;
    for (let attempt = 1; attempt <= this.retries; attempt++) {
      const wait = this.last + this.pauseMs - Date.now();
      if (wait > 0) await sleep(wait);
      this.last = Date.now();
      this.requests++;
      try {
        const res = await postJson(url, body, { connectTimeoutMs: this.connectTimeoutMs, timeoutMs: this.timeoutMs });
        if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`);
        const text = res.text;
        if (!text.trim()) throw new Error('boş yanıt');
        const data = JSON.parse(text);
        const msg = data.errorMessage || '';
        if (/out of bounds|veri bulunamadı/i.test(msg)) return [];
        if (msg) throw Object.assign(new Error(`TEFAS: ${msg}`), { fatal: true });
        return data.resultList || [];
      } catch (err) {
        if (err.fatal) throw err;
        lastErr = err;
        this.log(`TEFAS ${label} deneme ${attempt}: ${err.message}`);
        if (attempt < this.retries) await sleep(this.retryWaitMs);
      }
    }
    throw new Error(`TEFAS ${label}: ${this.retries} denemede cevap yok (${lastErr?.message})`);
  }

  async range(kind, start, end) {
    const rows = [];
    for (const [s, e] of splitRange(start, end)) rows.push(...(await this.post(kind, s, e)));
    return rows;
  }
}

export const isKatilim = (name) => String(name || '').toLocaleUpperCase('tr-TR').includes('KATILIM');

// "0,85" → 0.85; boş → null
export function trDecimal(v) {
  if (v === null || v === undefined || v === '') return null;
  const x = Number(String(v).replace(',', '.'));
  return Number.isFinite(x) ? x : null;
}

// { kod: { type, type_code, founder, fee, fee_prospectus, max_ter, tefas_status, risk } }
export function normalizeMeta(feeRows, returnRows = []) {
  const risk = Object.fromEntries(returnRows.map((r) => [r.fonKodu, trDecimal(r.riskDegeri)]));
  return Object.fromEntries(feeRows.map((r) => [r.fonKodu, {
    name: r.fonUnvan,
    type: r.fonTurAciklama ?? null,
    type_code: r.fonTurKod ?? null,
    founder: r.kurucuKod ?? null,
    fee: trDecimal(r.uygulananYu1Y),
    fee_prospectus: trDecimal(r.fonIcTuzukYu1G),
    max_ter: trDecimal(r.fonTopGiderKesoran),
    tefas_status: r.tefasDurum ?? null,
    risk: risk[r.fonKodu] ?? null,
  }]));
}

export function normalizeInfo(r) {
  return {
    date: String(r.tarih).slice(0, 10),
    code: r.fonKodu,
    name: r.fonUnvan,
    price: Number(r.fiyat),
    shares: Number(r.tedPaySayisi),
    investors: Number(r.kisiSayisi),
    size_tl: Number(r.portfoyBuyukluk),
  };
}

const NON_CONTENT = new Set(['fonKodu', 'fonUnvan', 'tarih', 'bilFiyat', 'rn']);

export function normalizeDist(r) {
  const content = {};
  for (const [k, v] of Object.entries(r)) {
    if (NON_CONTENT.has(k)) continue;
    const x = Number(v);
    if (x) content[k] = x;
  }
  return { date: String(r.tarih).slice(0, 10), code: r.fonKodu, content };
}
