// Günlük piyasa tarafı hesap: helal evren, sınıf serileri, trend, çapa önerisi, fon puanları.
// Kişisel hesaplar (dağılım, bant, öneri) telefonda yapılır; burada kişisel veri yok.
import { CLASSES, CLASS_LABELS, CATEGORY_LABELS } from '../model/params.mjs';
import { categoryFromName, fundExposure, mainClass, halalCheck } from '../model/exposure.mjs';
import { periodIndex, longTermIndex, ytdMonths } from '../model/indices.mjs';
import { periodConsistency, scoreCategory, median, hygiene } from '../model/scoring.mjs';
import { trendScore } from '../model/tactical.mjs';
import { checkAlert } from '../model/bands.mjs';
import { covariance, anchorSuggestion, suggestGroups, correlation } from '../model/riskparity.mjs';
import { backtest } from '../model/backtest.mjs';
import {
  periodReturns, periodReturn, dailyReturns, medianSeries, onOrBefore, stdev, maxDrawdown, sortino,
  sampleEvery, monthlyReturns, shiftDays, shiftMonths,
} from './series.mjs';

export const MODEL_VERSION = '2.3';
const RISKY = ['gold', 'silver', 'equity_tr', 'equity_foreign', 'fx_fixed'];
const PERIODS = ['1m', '3m', '6m', 'ytd', '1y', '3y', '5y'];
const TAIL_DAYS = 130;
const round = (x, d = 4) => (x === null || x === undefined || Number.isNaN(x) ? null : Math.round(x * 10 ** d) / 10 ** d);
const roundObj = (o, d = 4) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, round(v, d)]));

function contentAt(snapshots, code, date) {
  let found = null;
  for (const s of snapshots) {
    if (!s.map[code]) continue;
    if (s.date <= date || !found) found = s;
    if (s.date > date) break;
  }
  return found;
}

export function computeLatest({ fundsMeta, typeMeta = { as_of: null, funds: {} }, prices, contents, params, generatedAt }) {
  const U = params.universe;
  const calendar = [...new Set(Object.values(prices).flatMap((l) => l.map((r) => r.date)))].sort();
  const dataDate = calendar[calendar.length - 1];
  const latestContent = contents.length ? contents[contents.length - 1] : { date: null, map: {} };

  // 1. Evren: kategori, içerik, helal filtresi, maruziyet.
  const funds = {};
  for (const [code, fullList] of Object.entries(prices)) {
    const start = U.history_start[code];
    const list = start ? fullList.filter((r) => r.date >= start) : fullList;
    if (!list.length) continue;
    const meta = fundsMeta[code] || {};
    const tm = typeMeta.funds?.[code] || {};
    const name = meta.name || code;
    // Kategori önce TEFAS fon türünden, eşleşmezse addaki anahtar kelimeden.
    let category = U.category_overrides[code] || (tm.type && U.type_categories[tm.type]) || categoryFromName(name, U.category_keywords);
    const snap = contentAt(contents, code, dataDate);
    const content = snap ? snap.map[code] : {};
    let fe = fundExposure({ category, content }, U);
    if (category === 'unclassified' && snap) {
      // Son çare: içerikteki ana sınıf (ör. teknoloji ve sürdürülebilirlik katılım fonları → hisse).
      category = U.main_class_categories[mainClass(fe.exposure)] || 'unclassified';
      fe = fundExposure({ category, content }, U);
    }
    const halal = snap ? halalCheck({ code, name, type: tm.type }, fe.interest, U) : { halal: false, reason: 'içerik verisi yok', basis: null };
    const dates = list.map((r) => r.date);
    const values = list.map((r) => r.price);
    funds[code] = {
      code, name, category, content_date: snap?.date ?? null, exposure: fe.exposure, unknown_fields: fe.unknown_fields,
      main_class: mainClass(fe.exposure), halal: halal.halal, halal_reason: halal.reason, halal_basis: halal.basis,
      tefas_type: tm.type ?? null, type_code: tm.type_code ?? null, founder: tm.founder ?? null,
      fee: tm.fee ?? null, fee_prospectus: tm.fee_prospectus ?? null, max_ter: tm.max_ter ?? null, risk: tm.risk ?? null,
      history_start: start || null,
      dates, values, rets: dailyReturns(dates, values), last: list[list.length - 1],
    };
  }
  const helal = Object.values(funds).filter((f) => f.halal);

  // 2. Kategori ve sınıf serileri (helal fonların günlük getiri medyanı).
  const byCategory = {};
  for (const f of helal) (byCategory[f.category] ||= []).push(f);
  const catSeries = Object.fromEntries(Object.entries(byCategory).map(([c, l]) => [c, medianSeries(calendar, l.map((f) => f.rets))]));
  const classSeries = {};
  const classMembers = {};
  for (const cls of CLASSES.filter((c) => c !== 'unclassified')) {
    const members = cls === 'equity_foreign'
      ? helal.filter((f) => f.main_class === 'equity_foreign')
      : helal.filter((f) => (U.class_categories[cls] || []).includes(f.category));
    classMembers[cls] = members.map((f) => f.code);
    classSeries[cls] = members.length >= params.anchor.min_funds_per_class ? medianSeries(calendar, members.map((f) => f.rets)) : null;
  }
  const seriesMap = (s) => (s ? new Map(s.dates.map((d, i) => [d, s.returns[i]])) : null);
  const classRet = Object.fromEntries(Object.entries(classSeries).map(([c, s]) => [c, seriesMap(s)]));
  const catRet = Object.fromEntries(Object.entries(catSeries).map(([c, s]) => [c, seriesMap(s)]));
  const mm = catSeries.money_market && byCategory.money_market.length >= 3 ? catSeries.money_market : classSeries.tl_fixed;

  // 3. Trend, oynaklık, acil uyarı.
  const t = params.tactical;
  const classes = {};
  for (const cls of CLASSES.filter((c) => c !== 'unclassified')) {
    const s = classSeries[cls];
    const entry = { label: CLASS_LABELS[cls], n_funds: classMembers[cls].length, series_ok: !!s };
    if (s) {
      const signals = {};
      if (cls !== 'tl_fixed' && mm) {
        for (const m of t.trend_periods_months) {
          const p = m === 12 ? '1y' : `${m}m`;
          const a = periodReturn(s.dates, s.index, dataDate, p);
          const b = periodReturn(mm.dates, mm.index, dataDate, p);
          signals[`r${m}m`] = a === null || b === null ? null : a >= b ? 1 : -1;
        }
      }
      if (s.index.length >= t.ma_days) {
        const tail = s.index.slice(-t.ma_days);
        signals.ma = s.index[s.index.length - 1] >= tail.reduce((x, y) => x + y, 0) / tail.length ? 1 : -1;
      }
      const vol = stdev(s.returns.slice(-252)) * Math.sqrt(252) * 100;
      entry.returns = roundObj(periodReturns(s.dates, s.index, dataDate, ['1m', '3m', '6m', 'ytd', '1y', '3y']), 2);
      entry.trend = { signals, T: round(trendScore(Object.values(signals)), 3) };
      entry.macro = null; // EVDS/FRED anahtarı eklenince
      entry.vol_annual_pct = round(vol, 2);
      const alert = checkAlert(s.index, vol, params.decision);
      entry.alert = alert && { change_pct: round(alert.change, 2), threshold_pct: round(alert.threshold, 2), sigma_multiple: round(alert.sigma_multiple, 2), triggered: alert.triggered };
      entry.index_tail = s.index.slice(-TAIL_DAYS).map((v) => round(v, 5));
    }
    classes[cls] = entry;
  }

  // 3b. Aylık sınıf endeksleri (geri test için, son 61 ay sonu; telefon da kullanır).
  const monthEnds = calendar.filter((d, i) => i === calendar.length - 1 || calendar[i + 1].slice(0, 7) !== d.slice(0, 7)).slice(-61);
  const classMonthly = {
    dates: monthEnds,
    series: Object.fromEntries(Object.entries(classSeries).filter(([, s]) => s).map(([c, s]) => [c, monthEnds.map((d) => {
      const i = onOrBefore(s.dates, d);
      return i >= 0 && s.dates[0] <= d ? round(s.index[i], 6) : null;
    })])),
  };

  // 4. Çapa önerisi: haftalık getiri, en çok 3 yıl.
  const anchor = (() => {
    const ids = RISKY.filter((c) => classSeries[c]);
    if (ids.length < 2) return { ok: false, reason: 'yeterli sınıf serisi yok', ids };
    const weeks = params.anchor.window_years * 52;
    const pos = calendar.slice();
    const pts = sampleEvery(pos, 5, weeks + 1);
    const levels = ids.map((c) => {
      const s = classSeries[c];
      return pts.map((d) => { const i = onOrBefore(s.dates, d); return i >= 0 && s.dates[0] <= d ? s.index[i] : null; });
    });
    let start = 0;
    while (start < pts.length && levels.some((l) => l[start] === null)) start++;
    const rows = [];
    for (let k = start + 1; k < pts.length; k++) rows.push(levels.map((l) => l[k] / l[k - 1] - 1));
    if (rows.length < 52) return { ok: false, reason: `ortak haftalık veri ${rows.length} hafta (en az 52)`, ids };
    const cov = covariance(rows, params.anchor.periods_per_year);
    const pack = (a) => ({ weights: roundObj(a.weights, 2), risky_vol_pct: round(a.risky_vol_pct, 2), k: round(a.k, 3), groups: a.groups, warnings: a.warnings });
    const suggested = suggestGroups(cov, ids, 2);
    const ug = anchorSuggestion(cov, ids, params.anchor);
    const bt = backtest(ug.weights, classMonthly);
    return {
      ok: true,
      as_of: dataDate,
      weeks: rows.length,
      ids,
      user_groups: { ...pack(ug), backtest: bt.ok ? roundObj(Object.fromEntries(Object.entries(bt).filter(([, v]) => typeof v === 'number')), 2) : null },
      flat: pack(anchorSuggestion(cov, ids, { ...params.anchor, groups: [] })),
      suggested: pack(anchorSuggestion(cov, ids, { ...params.anchor, groups: suggested })),
      correlation: correlation(cov).map((r) => r.map((v) => round(v, 3))),
      cov: cov.map((r) => r.map((v) => round(v, 8))),
      vol_annual_pct: ids.map((_, i) => round(Math.sqrt(cov[i][i]) * 100, 2)),
    };
  })();

  // 5. Fon metrikleri: içerikten beklenen getiriye göre fazla getiri.
  const ytd = ytdMonths(dataDate);
  const fq = params.fund_quality;
  const metrics = {};
  for (const f of helal) {
    const exDates = [];
    const exRets = [];
    const exIndex = [];
    let level = 1;
    let expoCache = null;
    let expoDate = null;
    for (let i = 1; i < f.dates.length; i++) {
      const d = f.dates[i];
      const snap = contentAt(contents, f.code, d);
      if (snap && snap.date !== expoDate) {
        expoDate = snap.date;
        expoCache = fundExposure({ category: f.category, content: snap.map[f.code] }, U).exposure;
      }
      const expo = expoCache || f.exposure;
      const own = catRet[f.category]?.get(d) ?? f.rets.get(d);
      let e = 0;
      let wsum = 0;
      for (const cls of CLASSES) {
        const w = expo[cls] / 100;
        if (!w) continue;
        let r = cls === 'unclassified' ? undefined : classRet[cls]?.get(d);
        if (r === undefined) r = own;
        e += w * r;
        wsum += w;
      }
      if (wsum > 0) e /= wsum;
      const x = (1 + f.rets.get(d)) / (1 + e) - 1;
      level *= 1 + x;
      exDates.push(d);
      exRets.push(x);
      exIndex.push(level);
    }
    const raw = periodReturns(f.dates, f.values, dataDate, PERIODS);
    const excess = periodReturns(exDates, exIndex, dataDate, PERIODS);
    const window = exRets.slice(-756);
    const weekly = sampleEvery(exIndex.slice(-757), 5, 157);
    const weeklyRets = weekly.slice(1).map((v, i) => v / weekly[i] - 1);
    const history_months = (Date.parse(dataDate) - Date.parse(f.dates[0])) / 86400000 / 30.4375;
    metrics[f.code] = {
      raw, excess, monthly_excess: monthlyReturns(exDates, exIndex, 12), history_months,
      tracking_error: weeklyRets.length >= 26 ? stdev(weeklyRets) * Math.sqrt(52) * 100 : null,
      mdd: exIndex.length >= 250 ? maxDrawdown(exIndex.slice(-756)) : null,
      sortino: sortino(window, 252),
      indices: {
        ind5_simple: periodIndex(raw, PERIODS.slice(0, 5), { method: 'simple', ytd_months: ytd }).value,
        ind7_simple: periodIndex(raw, PERIODS, { method: 'simple', ytd_months: ytd }).value,
        ind5_compound: periodIndex(raw, PERIODS.slice(0, 5), { method: 'compound', ytd_months: ytd }).value,
        ind7_compound: periodIndex(raw, PERIODS, { method: 'compound', ytd_months: ytd }).value,
        long_term: longTermIndex(raw, fq.long_term_weights),
        excess: longTermIndex(excess, fq.long_term_weights),
      },
    };
  }

  // 6. Kategori içi puan.
  const scores = {};
  for (const [cat, list] of Object.entries(byCategory)) {
    if (cat === 'unclassified') continue;
    const peers = list.map((f) => ({ code: f.code, returns: metrics[f.code].excess }));
    const monthsKeys = [...new Set(list.flatMap((f) => Object.keys(metrics[f.code].monthly_excess)))].sort().slice(-12);
    const monthMedian = Object.fromEntries(monthsKeys.map((m) => [m, median(list.map((f) => metrics[f.code].monthly_excess[m]))]));
    const rows = list.map((f) => {
      const m = metrics[f.code];
      const a = periodConsistency(f.code, peers, PERIODS, fq.min_peers_per_period).value;
      const own = monthsKeys.filter((k) => m.monthly_excess[k] !== undefined);
      const b = list.length >= fq.min_peers_per_period && own.length >= 6
        ? own.filter((k) => m.monthly_excess[k] >= monthMedian[k]).length / own.length
        : null;
      const consistency = a === null ? b : b === null ? a : (a + b) / 2;
      const size = f.last.size_tl;
      return {
        code: f.code, history_months: m.history_months, consistency,
        excess_index: m.indices.excess, tracking_error: m.tracking_error, mdd: m.mdd, sortino: m.sortino,
        fee: f.fee, hygiene: hygiene(f.fee, f.max_ter, size, fq.small_fund_tl),
      };
    });
    for (const r of scoreCategory(rows, { passive: U.passive_categories.includes(cat), params })) scores[r.code] = r;
    const ranked = Object.values(scores).filter((s) => list.some((f) => f.code === s.code) && s.score !== null).sort((x, y) => y.score - x.score);
    ranked.forEach((s, i) => { s.rank = i + 1; s.peers = ranked.length; });
  }

  // 7. Bayraklar.
  const flagsOf = (f) => {
    const flags = [];
    const m = metrics[f.code];
    if (!f.halal) flags.push('helal_uyarisi');
    if (f.history_start) flags.push('donusum');
    if (m && m.history_months < fq.min_history_months) flags.push('yeni_fon');
    const r = f.rets.get(f.dates[f.dates.length - 1]);
    if (r !== undefined && Math.abs(r) * 100 > params.general.suspicious_move_pct) flags.push('supheli_veri');
    const list = prices[f.code].filter((r) => !f.history_start || r.date >= f.history_start);
    const old = list[onOrBefore(f.dates, shiftDays(dataDate, -30))];
    if (old && old.investors > 0 && (f.last.investors / old.investors - 1) * 100 > fq.warming_pct) flags.push('isinma');
    const prev = contents.filter((s) => s.date <= shiftDays(dataDate, -30) && s.map[f.code]).pop();
    if (prev) {
      const pe = fundExposure({ category: f.category, content: prev.map[f.code] }, U).exposure;
      if (CLASSES.some((c) => Math.abs(pe[c] - f.exposure[c]) > fq.drift_pts)) flags.push('strateji_kaymasi');
    }
    return flags;
  };

  // 8. Telefon için son 130 iş gününün fiyatları (tüm KATILIM fonları).
  const tailDates = calendar.slice(-TAIL_DAYS);
  const tailPrices = {};
  for (const f of Object.values(funds)) {
    const map = new Map(f.dates.map((d, i) => [d, f.values[i]]));
    tailPrices[f.code] = tailDates.map((d) => map.get(d) ?? null);
  }

  return {
    model_version: MODEL_VERSION,
    param_version: params.version,
    generated_at: generatedAt,
    data_date: dataDate,
    content_date: latestContent.date,
    sources: {
      tefas: { funds: Object.keys(funds).length, halal: helal.length, first_date: calendar[0], last_date: dataDate, meta_as_of: typeMeta.as_of },
      evds: { status: 'anahtar yok' },
      fred: { status: 'anahtar yok' },
    },
    category_labels: CATEGORY_LABELS,
    classes,
    anchor,
    mm_returns: mm ? roundObj(periodReturns(mm.dates, mm.index, dataDate, ['1m', '3m', '6m', 'ytd', '1y']), 2) : null,
    funds: Object.values(funds)
      .sort((a, b) => a.code.localeCompare(b.code))
      .map((f) => {
        const m = metrics[f.code];
        const s = scores[f.code];
        return {
          code: f.code,
          name: f.name,
          category: f.category,
          halal: f.halal,
          halal_reason: f.halal_reason,
          halal_basis: f.halal_basis,
          tefas_type: f.tefas_type,
          type_code: f.type_code,
          founder: f.founder,
          fee: f.fee,
          fee_prospectus: f.fee_prospectus,
          max_ter: f.max_ter,
          risk: f.risk,
          main_class: f.main_class,
          exposure: roundObj(f.exposure, 2),
          content_date: f.content_date,
          unknown_fields: f.unknown_fields.length ? f.unknown_fields : undefined,
          price: f.last.price,
          price_date: f.last.date,
          size_tl: f.last.size_tl,
          investors: f.last.investors,
          first_date: f.dates[0],
          history_start: f.history_start || undefined,
          history_months: m ? round(m.history_months, 1) : null,
          returns: m ? roundObj(m.raw, 2) : undefined,
          excess: m ? roundObj(m.excess, 2) : undefined,
          indices: m ? roundObj(m.indices, 3) : undefined,
          tracking_error: m ? round(m.tracking_error, 2) : undefined,
          mdd: m ? round(m.mdd, 2) : undefined,
          sortino: m ? round(m.sortino, 2) : undefined,
          score: s ? round(s.score, 1) : null,
          raw_score: s ? round(s.raw_score, 1) : null,
          confidence: s ? round(s.confidence, 2) : null,
          components: s ? roundObj(s.components, 3) : undefined,
          rank: s?.rank ?? null,
          peers: s?.peers ?? null,
          flags: flagsOf(f),
        };
      }),
    prices_tail: { dates: tailDates, prices: tailPrices },
    class_monthly: classMonthly,
  };
}

export { shiftMonths };
