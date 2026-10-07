#!/usr/bin/env python3
"""F0 canlı veri denemesi.

TEFAS, TCMB EVDS ve FRED'e birkaç gerçek istek atar; dönen alan adlarını
docs/data_fields.md dosyasına, ham örnekleri docs/probe/ altına yazar.
GitHub Actions'ta "F0 veri denemesi" iş akışıyla çalışır.

Anahtarlar ortam değişkeninden okunur (EVDS_API_KEY, FRED_API_KEY); anahtar
yoksa o kaynak atlanır ve raporda belirtilir. Hiçbir kaynak hatası betiği
durdurmaz: amaç neyin çalışıp neyin çalışmadığını görmek.
"""
from __future__ import annotations

import json
import os
import time
import traceback
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

import requests

ROOT = Path(__file__).resolve().parent.parent
DOCS = ROOT / "docs"
PROBE_DIR = DOCS / "probe"
TZ = ZoneInfo("Europe/Istanbul")
TIMEOUT = 60

SECRETS = [v for v in (os.environ.get("EVDS_API_KEY"), os.environ.get("FRED_API_KEY")) if v]

# --- TEFAS -----------------------------------------------------------------

TEFAS_INFO_URL = "https://www.tefas.gov.tr/api/funds/fonGnlBlgSiraliGetir"
TEFAS_DIST_URL = "https://www.tefas.gov.tr/api/funds/dagilimSiraliGetirT"
TEFAS_HEADERS = {
    "Accept": "*/*",
    "Content-Type": "application/json",
    "Origin": "https://www.tefas.gov.tr",
    "Referer": "https://www.tefas.gov.tr/tr/fon-verileri",
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
    ),
}
TEFAS_PAUSE_S = 11  # dakikada 6 istek sınırı

# pytefas 0.4.1 schema.py eşlemesi; ham alanlarla karşılaştırmak için.
PYTEFAS_INFO = {
    "fonKodu": "fund_code", "fonUnvan": "fund_name", "tarih": "date",
    "fiyat": "price", "tedPaySayisi": "shares_outstanding",
    "kisiSayisi": "investor_count", "portfoyBuyukluk": "portfolio_size",
    "borsaBultenFiyat": "exchange_bulletin_price",
}
PYTEFAS_DIST = {
    "fonKodu": "fund_code", "fonUnvan": "fund_name", "tarih": "date",
    "hs": "stock_pct", "dt": "government_bond_pct", "hb": "treasury_bill_pct",
    "fb": "financing_bill_pct", "ost": "private_sector_bond_pct",
    "bb": "bank_bill_pct", "vdm": "asset_backed_securities_pct",
    "eut": "eurobond_pct", "kibd": "government_external_debt_pct",
    "osdb": "private_sector_external_debt_pct",
    "kba": "fx_government_internal_debt_pct", "dot": "fx_payable_bill_pct",
    "db": "fx_payable_bond_pct", "tpp": "takasbank_money_market_pct",
    "bpp": "bist_money_market_pct", "btaa": "bist_committed_buy_pct",
    "btas": "bist_committed_sell_pct", "r": "repo_pct", "tr": "reverse_repo_pct",
    "vm": "term_deposit_pct", "vmtl": "deposit_tl_pct", "vmd": "deposit_fx_pct",
    "vmau": "deposit_gold_pct", "kh": "participation_account_pct",
    "khtl": "participation_account_tl_pct", "khd": "participation_account_fx_pct",
    "khau": "participation_account_gold_pct",
    "kks": "government_lease_certificate_pct",
    "kkstl": "government_lease_certificate_tl_pct",
    "kksd": "government_lease_certificate_fx_pct",
    "kksyd": "government_foreign_lease_certificate_pct",
    "osks": "private_sector_lease_certificate_pct",
    "oksyd": "private_sector_foreign_lease_certificate_pct",
    "km": "precious_metals_pct", "kmbyf": "precious_metals_etf_pct",
    "kmkba": "precious_metals_government_debt_pct",
    "kmkks": "precious_metals_lease_certificate_pct",
    "ymk": "foreign_security_pct", "yba": "foreign_debt_security_pct",
    "ybkb": "foreign_government_debt_pct",
    "ybosb": "foreign_private_sector_debt_pct", "yhs": "foreign_stock_pct",
    "ybyf": "foreign_etf_pct", "fkb": "fund_participation_certificate_pct",
    "yyf": "investment_fund_pct", "byf": "etf_pct",
    "gykb": "real_estate_fund_pct", "gyy": "real_estate_investment_pct",
    "gsykb": "venture_capital_fund_pct", "gsyy": "venture_capital_investment_pct",
    "t": "derivative_pct", "vint": "futures_cash_collateral_pct",
    "gas": "real_estate_certificate_pct", "d": "other_pct",
}
META_KEYS = {"fonKodu", "fonUnvan", "tarih"}

# Faizli araç adayları (Bölüm 6.1). Yalnızca rapor içindir; kesin liste
# kullanıcı onayıyla parametre deposuna girer.
INTEREST_CANDIDATES = [
    "dt", "hb", "fb", "ost", "bb", "vdm", "eut", "kibd", "osdb", "kba", "dot",
    "db", "tpp", "bpp", "r", "tr", "vm", "vmtl", "vmd", "vmau", "kmkba",
    "yba", "ybkb", "ybosb",
]

# --- EVDS ------------------------------------------------------------------

EVDS_BASES = [
    "https://evds3.tcmb.gov.tr/igmevdsms-dis/",
    "https://evds2.tcmb.gov.tr/service/evds/",
]
EVDS_PAUSE_S = 0.5
EVDS_TARGETS = {
    "TÜFE": {
        "group_kw": ["tüketici fiyat"],
        "serie_kw": ["genel", "tüfe"],
        "candidates": ["TP.FG.J0"],
    },
    "Politika faizi": {
        "group_kw": ["politika faiz", "açık piyasa", "repo"],
        "serie_kw": ["politika", "bir hafta", "1 hafta"],
        "candidates": [],
    },
    "USD/TRY": {
        "group_kw": ["döviz kur"],
        "serie_kw": ["abd doları"],
        "candidates": ["TP.DK.USD.A.YTL", "TP.DK.USD.S.YTL"],
    },
    "Gram altın": {
        "group_kw": ["altın"],
        "serie_kw": ["gram", "külçe"],
        "candidates": ["TP.MK.KUL.YTL"],
    },
    "Sanayi üretimi": {
        "group_kw": ["sanayi üretim"],
        "serie_kw": ["sanayi", "imalat"],
        "candidates": [],
    },
    "İmalat PMI": {
        "group_kw": ["pmi", "satın alma yöneticileri"],
        "serie_kw": ["pmi", "imalat"],
        "candidates": [],
    },
}

# --- FRED ------------------------------------------------------------------

FRED_BASE = "https://api.stlouisfed.org/fred/"
FRED_SERIES = ["CPIAUCSL", "FEDFUNDS", "DGS10", "INDPRO"]


# --- Yardımcılar -----------------------------------------------------------

def redact(text: str) -> str:
    for s in SECRETS:
        text = text.replace(s, "***")
    return text


def tr_lower(s: str) -> str:
    return s.replace("I", "ı").replace("İ", "i").lower()


def today_istanbul() -> date:
    return datetime.now(TZ).date()


@dataclass
class Call:
    name: str
    url: str
    status: int | None = None
    ok: bool = False
    error: str | None = None
    elapsed_s: float = 0.0
    headers: dict = field(default_factory=dict)
    data: object = None

    def summary(self) -> dict:
        return {
            "name": self.name, "url": self.url, "status": self.status,
            "ok": self.ok, "error": self.error, "elapsed_s": self.elapsed_s,
            "headers": self.headers,
        }


def call(name: str, method: str, url: str, *, headers=None, json_body=None,
         params=None) -> Call:
    c = Call(name=name, url=url)
    t0 = time.monotonic()
    try:
        r = requests.request(method, url, headers=headers, json=json_body,
                             params=params, timeout=TIMEOUT)
        c.status = r.status_code
        c.headers = {
            k.lower(): v for k, v in r.headers.items()
            if k.lower().startswith(("ratelimit", "content-type", "server", "retry-after"))
        }
        try:
            c.data = r.json()
        except ValueError:
            c.error = f"JSON değil: {r.text[:300]!r}"
        c.ok = r.ok and c.data is not None
        if not r.ok and c.error is None:
            c.error = f"HTTP {r.status_code}: {str(c.data)[:300]}"
    except requests.RequestException as exc:
        c.error = f"{type(exc).__name__}: {exc}"
    c.elapsed_s = round(time.monotonic() - t0, 2)
    if c.error:
        c.error = redact(c.error)
    return c


def md_table(header: list[str], rows: list[list]) -> list[str]:
    def cell(v) -> str:
        return str(v).replace("|", "\\|").replace("\n", " ")
    out = ["| " + " | ".join(header) + " |", "|" + "---|" * len(header)]
    out += ["| " + " | ".join(cell(v) for v in r) + " |" for r in rows]
    return out


def key_union(rows: list[dict]) -> list[str]:
    seen: dict[str, None] = {}
    for r in rows:
        for k in r:
            seen.setdefault(k, None)
    return list(seen)


def pick(d: dict, *names: str, contains: str | None = None):
    for n in names:
        if n in d:
            return d[n]
    if contains:
        for k, v in d.items():
            if contains in k.upper():
                return v
    return None


def as_float(v) -> float:
    try:
        return float(v)
    except (TypeError, ValueError):
        return 0.0


def write_json(name: str, obj) -> None:
    PROBE_DIR.mkdir(parents=True, exist_ok=True)
    text = json.dumps(obj, ensure_ascii=False, indent=2, default=str)
    (PROBE_DIR / name).write_text(redact(text) + "\n", encoding="utf-8")


# --- TEFAS analizi ---------------------------------------------------------

def tefas_body(kind: str, start: date, end: date, fund_code: str | None = None) -> dict:
    # pytefas 0.4.1 ile aynı gövde.
    return {
        "fonTipi": kind, "fonKodu": fund_code, "aramaMetni": None,
        "fonTurKod": None, "fonGrubu": None, "sfonTurKod": None,
        "fonTurAciklama": None, "kurucuKod": None,
        "basTarih": start.strftime("%Y%m%d"), "bitTarih": end.strftime("%Y%m%d"),
        "basSira": 1, "bitSira": 100000, "dil": "TR",
        "sFonTurKod": "", "fonKod": "", "fonGrup": "", "fonUnvanTip": "",
    }


def tefas_rows(c: Call) -> list[dict]:
    if isinstance(c.data, dict):
        return c.data.get("resultList") or []
    return []


def is_katilim(row: dict) -> bool:
    return "KATILIM" in str(row.get("fonUnvan", "")).upper()


def latest_rows(rows: list[dict]) -> list[dict]:
    dates = [r.get("tarih") for r in rows if r.get("tarih") is not None]
    if not dates:
        return rows
    last = max(dates, key=str)
    return [r for r in rows if r.get("tarih") == last]


def analyze_info(rows: list[dict]) -> dict:
    keys = key_union(rows)
    latest = latest_rows(rows)
    kat = [r for r in latest if is_katilim(r)]
    sample = next((r for r in latest if r.get("fonKodu") == "VGA"), kat[0] if kat else (latest[0] if latest else {}))
    return {
        "row_count": len(rows),
        "fund_count": len({r.get("fonKodu") for r in rows}),
        "dates": sorted({str(r.get("tarih")) for r in rows}),
        "latest_fund_count": len(latest),
        "latest_katilim_count": len(kat),
        "katilim_names_sample": sorted(str(r.get("fonUnvan")) for r in kat)[:8],
        "fields": [
            {"raw": k, "pytefas": PYTEFAS_INFO.get(k, "—(pytefas'ta yok)"),
             "example": sample.get(k)}
            for k in keys
        ],
        "sample_code": sample.get("fonKodu"),
    }


def analyze_dist(rows: list[dict]) -> dict:
    keys = key_union(rows)
    latest = latest_rows(rows)
    kat = [r for r in latest if is_katilim(r)]
    fields = []
    for k in keys:
        if k in META_KEYS:
            continue
        kat_vals = [as_float(r.get(k)) for r in kat]
        all_vals = [as_float(r.get(k)) for r in latest]
        fields.append({
            "raw": k,
            "pytefas": PYTEFAS_DIST.get(k, "—(pytefas'ta yok)"),
            "katilim_nonzero": sum(v > 0 for v in kat_vals),
            "katilim_max": round(max(kat_vals, default=0.0), 2),
            "all_nonzero": sum(v > 0 for v in all_vals),
        })
    pct_keys = [k for k in keys if k not in META_KEYS]
    sums = [sum(as_float(r.get(k)) for k in pct_keys) for r in kat]
    helal_flags = []
    for r in kat:
        hits = {k: as_float(r.get(k)) for k in INTEREST_CANDIDATES if as_float(r.get(k)) > 0}
        if hits:
            helal_flags.append({"code": r.get("fonKodu"), "name": r.get("fonUnvan"), "hits": hits})
    return {
        "row_count": len(rows),
        "latest_fund_count": len(latest),
        "latest_katilim_count": len(kat),
        "unknown_keys": [k for k in keys if k not in PYTEFAS_DIST],
        "missing_keys": [k for k in PYTEFAS_DIST if k not in keys] if rows else [],
        "katilim_row_sum_min": round(min(sums), 2) if sums else None,
        "katilim_row_sum_max": round(max(sums), 2) if sums else None,
        "fields": fields,
        "helal_flags": helal_flags,
    }


def tefas_call(name: str, url: str, body: dict, attempts: int = 3) -> Call:
    """Bağlantı hatasında 20 sn arayla yeniden dener; TEFAS hata mesajını hataya çevirir."""
    for i in range(attempts):
        c = call(name if i == 0 else f"{name} (deneme {i + 1})", "POST", url,
                 headers=TEFAS_HEADERS, json_body=body)
        if c.status is not None:
            break
        time.sleep(20)
    if isinstance(c.data, dict):
        msg = c.data.get("errorMessage")
        empty = msg and any(m in msg.lower() for m in ("out of bounds", "veri bulunamadı"))
        if msg and not empty:
            c.ok = False
            c.error = msg
    return c


def probe_tefas() -> dict:
    end = today_istanbul()
    start = end - timedelta(days=9)
    out: dict = {"calls": []}
    plan = [
        ("info", "info EMK son 10 gün", TEFAS_INFO_URL, tefas_body("EMK", start, end)),
        ("dist", "dağılım EMK son 10 gün", TEFAS_DIST_URL, tefas_body("EMK", start, end)),
        ("dist_3y", "dağılım EMK, 3 yıl önce (5 gün)", TEFAS_DIST_URL,
         tefas_body("EMK", end - timedelta(days=3 * 365 + 4), end - timedelta(days=3 * 365))),
        ("info_5y", "info EMK, 5 yıl önce (5 gün)", TEFAS_INFO_URL,
         tefas_body("EMK", end - timedelta(days=5 * 365 + 4), end - timedelta(days=5 * 365))),
        ("info_31", "info EMK 31 gün (sınır)", TEFAS_INFO_URL,
         tefas_body("EMK", end - timedelta(days=30), end)),
    ]
    calls = {}
    for i, (key, name, url, body) in enumerate(plan):
        if i:
            time.sleep(TEFAS_PAUSE_S)
        calls[key] = tefas_call(name, url, body)
        out["calls"].append(calls[key].summary())

    for c in calls.values():
        if isinstance(c.data, dict):
            out.setdefault("top_level", {})[c.name] = {k: v for k, v in c.data.items() if k != "resultList"}

    info_rows, dist_rows = tefas_rows(calls["info"]), tefas_rows(calls["dist"])
    out["info"] = analyze_info(info_rows)
    out["dist"] = analyze_dist(dist_rows)
    for key, title in (("dist_3y", "Dağılım, 3 yıl önce"), ("info_5y", "Fiyat, 5 yıl önce"), ("info_31", "Fiyat, 31 gün")):
        rows = tefas_rows(calls[key])
        out.setdefault("ranges", []).append({
            "title": title,
            "rows": len(rows),
            "funds": len({r.get("fonKodu") for r in rows}),
            "dates": sorted({str(r.get("tarih")) for r in rows}),
            "error": calls[key].error,
        })

    kat_info = [r for r in latest_rows(info_rows) if is_katilim(r)][:3]
    kat_codes = {r.get("fonKodu") for r in kat_info}
    write_json("tefas_info_sample.json", kat_info)
    write_json("tefas_dagilim_sample.json",
               [r for r in latest_rows(dist_rows) if r.get("fonKodu") in kat_codes])
    return out


# --- EVDS ------------------------------------------------------------------

def evds_get(base: str, path: str, key: str, name: str) -> Call:
    c = call(name, "GET", base + path, headers={"key": key})
    time.sleep(EVDS_PAUSE_S)
    return c


def as_list(data) -> list:
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        for v in data.values():
            if isinstance(v, list):
                return v
    return []


def probe_evds() -> dict:
    key = os.environ.get("EVDS_API_KEY")
    if not key:
        return {"skipped": "EVDS_API_KEY tanımlı değil"}
    out: dict = {"base_attempts": []}

    base, categories = None, []
    for b in EVDS_BASES:
        c = evds_get(b, "categories/type=json", key, "kategoriler")
        out["base_attempts"].append({"base": b, **c.summary()})
        cats = as_list(c.data)
        if c.ok and cats:
            base, categories = b, cats
            break
    if not base:
        return out
    out["base"] = base
    out["category_keys"] = key_union(categories[:5])

    groups = []
    for cat in categories:
        cid = pick(cat, "CATEGORY_ID", contains="ID")
        if cid is None:
            continue
        c = evds_get(base, f"datagroups/mode=2&code={cid}&type=json", key, f"veri grubu {cid}")
        groups += as_list(c.data)
    out["group_count"] = len(groups)
    out["group_keys"] = key_union(groups[:5])

    def gname(g):
        return tr_lower(str(pick(g, "DATAGROUP_NAME", contains="NAME") or ""))

    def gcode(g):
        return pick(g, "DATAGROUP_CODE", contains="CODE")

    wanted_groups: dict[str, list] = {}
    for target, spec in EVDS_TARGETS.items():
        hits = [g for g in groups if any(kw in gname(g) for kw in spec["group_kw"])]
        wanted_groups[target] = hits[:6]

    series_by_group: dict[str, list] = {}
    for hits in wanted_groups.values():
        for g in hits:
            code = gcode(g)
            if code and code not in series_by_group:
                c = evds_get(base, f"serieList/type=json&code={code}", key, f"seri listesi {code}")
                series_by_group[code] = as_list(c.data)
    all_series = [s for lst in series_by_group.values() for s in lst]
    out["serie_keys"] = key_union(all_series[:5])

    end = today_istanbul()
    start = end - timedelta(days=730)
    targets = {}
    for target, spec in EVDS_TARGETS.items():
        groups_here = [gcode(g) for g in wanted_groups[target]]
        found = []
        for code in groups_here:
            for s in series_by_group.get(code, []):
                name = tr_lower(str(pick(s, "SERIE_NAME", contains="NAME") or ""))
                if any(kw in name for kw in spec["serie_kw"]):
                    found.append({
                        "group": code,
                        "code": pick(s, "SERIE_CODE", contains="CODE"),
                        "name": pick(s, "SERIE_NAME", contains="NAME"),
                        "frequency": pick(s, "FREQUENCY_STR", contains="FREQ"),
                        "start": pick(s, "START_DATE"),
                        "end": pick(s, "END_DATE"),
                    })
        found = found[:12]
        to_fetch = list(dict.fromkeys(spec["candidates"] + [f["code"] for f in found[:3] if f["code"]]))
        fetched = []
        for code in to_fetch:
            c = evds_get(base, f"series={code}&startDate={start:%d-%m-%Y}&endDate={end:%d-%m-%Y}&type=json",
                         key, f"seri {code}")
            items = as_list(c.data)
            fetched.append({
                "code": code, "ok": c.ok, "status": c.status, "error": c.error,
                "item_count": len(items),
                "item_keys": key_union(items[:3]),
                "last_items": items[-2:],
            })
        targets[target] = {
            "groups": [{"code": gcode(g), "name": pick(g, "DATAGROUP_NAME", contains="NAME")}
                       for g in wanted_groups[target]],
            "series_hits": found,
            "fetched": fetched,
        }
    out["targets"] = targets
    return out


# --- FRED ------------------------------------------------------------------

def probe_fred() -> dict:
    key = os.environ.get("FRED_API_KEY")
    if not key:
        return {"skipped": "FRED_API_KEY tanımlı değil"}
    out = {"series": []}
    for sid in FRED_SERIES:
        base_params = {"series_id": sid, "api_key": key, "file_type": "json"}
        meta = call(f"{sid} bilgi", "GET", FRED_BASE + "series", params=base_params)
        obs = call(f"{sid} gözlem", "GET", FRED_BASE + "series/observations",
                   params={**base_params, "sort_order": "desc", "limit": 3})
        m = (meta.data or {}).get("seriess", [{}])[0] if isinstance(meta.data, dict) else {}
        o = (obs.data or {}).get("observations", []) if isinstance(obs.data, dict) else []
        out["series"].append({
            "id": sid, "ok": meta.ok and obs.ok,
            "error": meta.error or obs.error,
            "title": m.get("title"), "frequency": m.get("frequency"),
            "units": m.get("units"), "seasonal_adjustment": m.get("seasonal_adjustment"),
            "observation_end": m.get("observation_end"), "last_updated": m.get("last_updated"),
            "meta_keys": list(m), "obs_keys": key_union(o),
            "last": [(x.get("date"), x.get("value")) for x in o],
        })
    return out


def probe_runner() -> dict:
    c = call("çalışan makine konumu", "GET", "https://ipinfo.io/json")
    d = c.data if isinstance(c.data, dict) else {}
    return {"country": d.get("country"), "region": d.get("region"),
            "org": d.get("org"), "error": c.error}


# --- Rapor -----------------------------------------------------------------

def report_calls(calls: list[dict]) -> list[str]:
    rows = [[c["name"], c["status"], "✅" if c["ok"] else "❌", c["elapsed_s"],
             c["error"] or "", ", ".join(f"{k}={v}" for k, v in c["headers"].items()
                                          if k.startswith("ratelimit"))]
            for c in calls]
    return md_table(["İstek", "HTTP", "Durum", "Süre (s)", "Hata", "Kota başlıkları"], rows)


def render(res: dict) -> str:
    L: list[str] = []
    L += [
        "# Veri alanları (F0 canlı deneme)",
        "",
        f"Üretildi: {res['generated_at']} (Europe/Istanbul) · `tools/probe.py`",
        "",
        "Bu dosya otomatik üretilir; elle düzenleme. Ham örnekler `docs/probe/` altında.",
        "",
    ]
    rn = res.get("runner", {})
    L += [f"Çalışan makine: ülke **{rn.get('country')}**, bölge {rn.get('region')}, ağ {rn.get('org')}"
          + (f" (hata: {rn['error']})" if rn.get("error") else ""), ""]

    # TEFAS
    t = res.get("tefas", {})
    L += ["## 1. TEFAS", ""]
    if "exception" in t:
        L += ["```", t["exception"], "```", ""]
    if t.get("calls"):
        L += report_calls(t["calls"]) + [""]
    if t.get("top_level"):
        L += ["Yanıtların `resultList` dışındaki üst alanları:", "", "```json",
              json.dumps(t["top_level"], ensure_ascii=False, indent=1, default=str)[:2000], "```", ""]
    info = t.get("info")
    if info and not info["row_count"]:
        L += ["Fon bilgisi gelmedi.", ""]
    if info and info["row_count"]:
        L += ["### 1.1 Fon genel bilgi (`fonGnlBlgSiraliGetir`)", "",
              f"- Satır: {info['row_count']} · fon: {info['fund_count']} · "
              f"son gün fon: {info['latest_fund_count']} · son gün KATILIM adlı fon: {info['latest_katilim_count']}",
              f"- Tarihler (ham biçim): {', '.join(info['dates'])}",
              f"- Örnek KATILIM fonları: {'; '.join(info['katilim_names_sample'])}",
              "", f"Örnek değerler `{info['sample_code']}` fonundan:", ""]
        L += md_table(["Ham alan", "pytefas adı", "Örnek"],
                      [[f["raw"], f["pytefas"], f["example"]] for f in info["fields"]]) + [""]
    dist = t.get("dist")
    if dist and not dist["row_count"]:
        L += ["Dağılım bilgisi gelmedi.", ""]
    if dist and dist["row_count"]:
        L += ["### 1.2 Portföy dağılımı (`dagilimSiraliGetirT`)", "",
              f"- Satır: {dist['row_count']} · son gün fon: {dist['latest_fund_count']} · "
              f"KATILIM: {dist['latest_katilim_count']}",
              f"- KATILIM fonlarında satır toplamı: en az {dist['katilim_row_sum_min']}, en çok {dist['katilim_row_sum_max']}",
              f"- pytefas eşlemesinde olmayan ham alanlar: {', '.join(dist['unknown_keys']) or 'yok'}",
              f"- pytefas eşlemesinde olup yanıtta gelmeyen alanlar: {', '.join(dist['missing_keys']) or 'yok'}",
              ""]
        L += md_table(["Ham alan", "pytefas adı", "KATILIM fonu >0", "KATILIM en çok %", "Tüm fonlar >0"],
                      [[f["raw"], f["pytefas"], f["katilim_nonzero"], f["katilim_max"], f["all_nonzero"]]
                       for f in dist["fields"]]) + [""]
        L += ["#### Helal filtresi ön izlemesi", "",
              "Adı KATILIM içerip faizli araç **adayı** alanlarda payı 0'dan büyük olan fonlar "
              f"(aday alanlar: {', '.join(INTEREST_CANDIDATES)}). Kesin liste kullanıcı onayıyla belirlenecek.", ""]
        if dist["helal_flags"]:
            L += md_table(["Fon", "Ad", "Alanlar"],
                          [[h["code"], h["name"], ", ".join(f"{k}={v:g}" for k, v in h["hits"].items())]
                           for h in dist["helal_flags"][:40]]) + [""]
        else:
            L += ["Yok.", ""]
    if t.get("ranges"):
        L += ["### 1.3 Tarih aralığı ve geçmiş derinliği", "",
              '- Tek istekte en çok 1 ay (TEFAS: "Tarih aralığı 1 ayı aşamaz"); tek fon için de aynı.', ""]
        for x in t["ranges"]:
            span = f"{x['dates'][0]} → {x['dates'][-1]}" if x["dates"] else "—"
            L += [f"- **{x['title']}:** {x['rows']} satır, {x['funds']} fon, {len(x['dates'])} tarih ({span})"
                  + (f" · hata: {x['error']}" if x["error"] else "")]
    L += [""]

    # EVDS
    e = res.get("evds", {})
    L += ["## 2. TCMB EVDS", ""]
    if "skipped" in e:
        L += [f"Atlandı: {e['skipped']}.", ""]
    if "exception" in e:
        L += ["```", e["exception"], "```", ""]
    if e.get("base_attempts"):
        L += md_table(["Adres", "HTTP", "Durum", "Hata"],
                      [[a["base"], a["status"], "✅" if a["ok"] else "❌", a["error"] or ""]
                       for a in e["base_attempts"]]) + [""]
    if e.get("base"):
        L += [f"- Çalışan adres: `{e['base']}` · veri grubu sayısı: {e.get('group_count')}",
              f"- Kategori alanları: {e.get('category_keys')}",
              f"- Veri grubu alanları: {e.get('group_keys')}",
              f"- Seri listesi alanları: {e.get('serie_keys')}", ""]
        for target, d in e.get("targets", {}).items():
            L += [f"### {target}", ""]
            if d["groups"]:
                L += ["Eşleşen veri grupları: " + "; ".join(f"`{g['code']}` {g['name']}" for g in d["groups"]), ""]
            if d["series_hits"]:
                L += md_table(["Seri kodu", "Ad", "Sıklık", "Başlangıç", "Bitiş", "Grup"],
                              [[s["code"], s["name"], s["frequency"], s["start"], s["end"], s["group"]]
                               for s in d["series_hits"]]) + [""]
            if d["fetched"]:
                L += md_table(["Çekilen seri", "Durum", "Kayıt", "Alanlar", "Son kayıtlar"],
                              [[f["code"], "✅" if f["ok"] else f"❌ {f['error'] or f['status']}",
                                f["item_count"], ", ".join(f["item_keys"]),
                                json.dumps(f["last_items"], ensure_ascii=False)[:300]]
                               for f in d["fetched"]]) + [""]

    # FRED
    f = res.get("fred", {})
    L += ["## 3. FRED", ""]
    if "skipped" in f:
        L += [f"Atlandı: {f['skipped']}.", ""]
    if "exception" in f:
        L += ["```", f["exception"], "```", ""]
    if f.get("series"):
        L += md_table(["Seri", "Durum", "Başlık", "Sıklık", "Birim", "Mevsimsellik", "Son gözlem", "Son değerler"],
                      [[s["id"], "✅" if s["ok"] else f"❌ {s['error']}", s["title"], s["frequency"],
                        s["units"], s["seasonal_adjustment"], s["observation_end"],
                        "; ".join(f"{d}={v}" for d, v in s["last"])]
                       for s in f["series"]]) + [""]
        if f["series"][0].get("obs_keys"):
            L += [f"Gözlem alanları: {f['series'][0]['obs_keys']}", ""]
    return redact("\n".join(L))


def guarded(fn) -> dict:
    try:
        return fn()
    except Exception:  # noqa: BLE001 - rapora yazılır, betik durmaz
        return {"exception": redact(traceback.format_exc())}


def main() -> None:
    res = {"generated_at": datetime.now(TZ).strftime("%Y-%m-%d %H:%M")}
    res["runner"] = guarded(probe_runner)
    res["tefas"] = guarded(probe_tefas)
    res["evds"] = guarded(probe_evds)
    res["fred"] = guarded(probe_fred)
    write_json("summary.json", res)
    DOCS.mkdir(parents=True, exist_ok=True)
    (DOCS / "data_fields.md").write_text(render(res) + "\n", encoding="utf-8")
    print(f"Yazıldı: {DOCS / 'data_fields.md'}")


if __name__ == "__main__":
    main()
