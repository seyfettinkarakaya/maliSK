// Varsayılan parametreler (docs/model.md, Bölüm 12). Hiçbir eşik koda gömülmez:
// model modülleri değerleri buradan alır, kullanıcı Ayarlar'dan yeni sürüm kaydeder.

export const CLASSES = ['gold', 'silver', 'tl_fixed', 'equity_tr', 'equity_foreign', 'fx_fixed', 'unclassified'];

export const CLASS_LABELS = {
  gold: 'Altın',
  silver: 'Gümüş',
  tl_fixed: 'TL sabit',
  equity_tr: 'Yurtiçi hisse',
  equity_foreign: 'Yabancı hisse',
  fx_fixed: 'Döviz sabit',
  unclassified: 'Belirsiz',
};

export const CATEGORY_LABELS = {
  gold: 'Altın',
  silver: 'Gümüş',
  precious_metals: 'Kıymetli maden',
  equity: 'Hisse',
  mixed: 'Karma',
  money_market: 'Para piyasası',
  lease_tl: 'Kira (TL)',
  fx: 'Döviz',
  standard: 'Standart',
  starter: 'Başlangıç',
  state_contribution: 'Katkı (devlet katkısı)',
  receivables: 'Merkezi alacak devri',
  unclassified: 'Sınıflandırılmamış',
};

export const DEFAULT_PARAMS = {
  version: 1,
  general: {
    run_time: '10:30',
    settlement_days: 1,
    suspicious_move_pct: 15,
  },
  universe: {
    whitelist: [],
    blacklist: [],
    // Sıra önemli: ilk eşleşen kazanır (GÜMÜŞ, KIYMETLİ MADEN'den önce bakılır).
    category_keywords: [
      ['GÜMÜŞ', 'silver'],
      ['KIYMETLİ MADEN', 'precious_metals'],
      ['ALTIN', 'gold'],
      ['HİSSE', 'equity'],
      ['KARMA', 'mixed'],
      ['DEĞİŞKEN', 'mixed'],
      ['ÇOKLU VARLIK', 'mixed'],
      ['PARA PİYASASI', 'money_market'],
      ['KİRA SERTİFİKA', 'lease_tl'],
      ['DÖVİZ', 'fx'],
    ],
    // İçerik alanı → kural. 'metal': gümüş fonunda Gümüş, diğerlerinde Altın;
    // 'basket': fonun ana sınıfı; 'other': para piyasasında TL sabit, diğerlerinde Belirsiz;
    // 'interest': faizli araç (helal filtresi fonu dışarıda bırakır).
    // Önce Ek A alan adları, sonra TEFAS kısa kodları (docs/data_fields.md).
    content_map: {
      precious_metal: 'metal',
      equity: 'equity_tr',
      equity_foreign: 'equity_foreign',
      lease_tl: 'tl_fixed',
      lease_fx: 'fx_fixed',
      participation_tl: 'tl_fixed',
      participation_fx: 'fx_fixed',
      fund_basket: 'basket',
      other: 'other',
      // TEFAS
      km: 'metal', kmbyf: 'metal', kmkks: 'metal', khau: 'metal',
      hs: 'equity_tr',
      yhs: 'equity_foreign', ybyf: 'equity_foreign',
      kkstl: 'tl_fixed', osks: 'tl_fixed', khtl: 'tl_fixed', kh: 'tl_fixed', kks: 'tl_fixed', btaa: 'tl_fixed', btas: 'tl_fixed',
      kksd: 'fx_fixed', kksyd: 'fx_fixed', oksyd: 'fx_fixed', khd: 'fx_fixed',
      yyf: 'basket', byf: 'basket', fkb: 'basket',
      gsykb: 'unclassified', gsyy: 'unclassified', gykb: 'unclassified', gyy: 'unclassified',
      gas: 'unclassified', t: 'unclassified', vint: 'unclassified', ymk: 'unclassified',
      d: 'other',
      dt: 'interest', hb: 'interest', fb: 'interest', ost: 'interest', bb: 'interest', vdm: 'interest',
      eut: 'interest', kibd: 'interest', osdb: 'interest', kba: 'interest', dot: 'interest', db: 'interest',
      tpp: 'interest', bpp: 'interest', r: 'interest', tr: 'interest', vm: 'interest', vmtl: 'interest',
      vmd: 'interest', vmau: 'interest', kmkba: 'interest', yba: 'interest', ybkb: 'interest', ybosb: 'interest',
    },
    // Sınıf serisini temsil eden kategoriler (Bölüm 3). Yabancı hisse: ana sınıfı yabancı hisse olan fonlar.
    class_categories: {
      gold: ['gold'],
      silver: ['silver'],
      tl_fixed: ['money_market', 'lease_tl'],
      equity_tr: ['equity'],
      fx_fixed: ['fx'],
    },
    // TEFAS fon türü (fonTurAciklama) → kategori; null ya da listede yoksa addaki anahtar kelimeye bakılır.
    type_categories: {
      'Altın Katılım Fonu': 'gold',
      'Katılım Hisse Senedi Fonu': 'equity',
      'Kira Sertifikasi Katılım Fonu': 'lease_tl',
      'Katılım Değişken Fon': 'mixed',
      'Değişken Fon': 'mixed',
      'Karma Fon': 'mixed',
      'Para Piyasası Fonu': 'money_market',
      'Kıymetli Madenler': 'precious_metals',
      'Katılım Standart Fon': 'standard',
      'OKS Katılım Standart Fon': 'standard',
      'Başlangıç Katılım Fonu': 'starter',
      'Katılım Katkı Fonu': 'state_contribution',
      'Merkezi Alacağın Devri Fonu': 'receivables',
      'Katılım Fonu': null,
      'Fon Sepeti Fonu': null,
    },
    category_overrides: {},
    // Ad ve TEFAS türüyle kategorisi bulunamayan fon, içeriğindeki ana sınıfa göre yerleştirilir.
    main_class_categories: {
      gold: 'gold', silver: 'silver', equity_tr: 'equity', equity_foreign: 'equity',
      tl_fixed: 'lease_tl', fx_fixed: 'fx', unclassified: 'mixed',
    },
    // Strateji değiştiren fonların geçmişi bu tarihten başlar (öncesi başka bir fona ait).
    // AUA: SPK 12.08.2026 izniyle Fon Sepeti EYF → Kira Sertifikaları Katılım EYF; yeni ölçüt 01.10.2026.
    history_start: { AUA: '2026-10-01' },
    basket_unclassified_categories: ['mixed'],
    other_tl_categories: ['money_market'],
    passive_categories: ['gold', 'silver', 'precious_metals', 'money_market', 'lease_tl', 'fx', 'starter'],
  },
  anchor: {
    target_vol_pct: 12,
    window_years: 3,
    periods_per_year: 52, // haftalık getiri
    class_cap_pct: 40,
    shrinkage: 'none', // Ö2: ilk fazda kapalı
    // Kullanıcının seçtiği gruplar; uygulama verilerden ayrıca öneri üretir.
    // Döviz sabit ayrı grup (kullanıcı kararı, 8 Ekim 2026): grupta olmayan sınıf tek başına grup olur.
    groups: [['gold', 'silver'], ['equity_tr', 'equity_foreign']],
    min_funds_per_class: 3,
    tl_fixed_factor_negative_real_rate: 0.5,
  },
  tactical: {
    weights: { trend: 0.5, macro: 0.25, user: 0.25 },
    positive_threshold: 0.4,
    negative_threshold: -0.25,
    tilt_mode: 'continuous', // Ö3
    max_tilt_pts: 5,
    full_tilt_at: 0.5,
    trend_periods_months: [1, 3, 12],
    ma_days: 210,
    view_triggers_recommendation: false, // M4: A
    // Rejim → sınıf görüşü. Anahtar: büyüme yönü + enflasyon yönü.
    regime_matrix: {
      up_down: { gold: 0, silver: 0, equity_tr: 1, equity_foreign: 1, tl_fixed: 0 },
      up_up: { gold: 1, silver: 1, equity_tr: 0, equity_foreign: 0, tl_fixed: -1 },
      down_up: { gold: 1, silver: 0, equity_tr: -1, equity_foreign: -1, tl_fixed: 0 },
      down_down: { gold: 0, silver: -1, equity_tr: 0, equity_foreign: 0, tl_fixed: 1 },
    },
    regime_source: { equity_tr: 'tr', tl_fixed: 'tr', gold: 'us', silver: 'us', equity_foreign: 'us' },
    // Reel politika faizi kuralı: pozitifken TL sabit +1, döviz sabit −1; negatifken tersi.
    real_rate_rule: { tl_fixed: 1, fx_fixed: -1 },
  },
  fund_quality: {
    weights: { consistency: 0.35, excess_index: 0.30, risk: 0.15, cost: 0.15, hygiene: 0.05 },
    scales: { cost_pts: 0.5, excess_monthly_pts: 0.5, tracking_error_pts: 2, mdd_pts: 10, sortino: 0.5 },
    index_periods: ['1m', '3m', '6m', 'ytd', '1y', '3y', '5y'],
    index_method: 'compound',
    long_term_weights: { '1y': 0.2, '3y': 0.3, '5y': 0.5 },
    scored_index: 'excess',
    min_history_months: 12,
    new_fund_cap_pct: 5,
    full_confidence_months: 36, // Ö1
    min_peers_per_period: 3,
    small_fund_tl: 500e6,
    warming_pct: 20,
    drift_pts: 15,
  },
  allocation: {
    candidates_per_category: 1,
    fee_lambda: 0.002,
    no_instrument_pts: 3,
    max_funds: 20,
  },
  decision: {
    band_rel_pct: 25,
    band_min_pts: 3,
    band_max_pts: 10,
    confirm_days: 20,
    switch_score_gap: 20,
    alert_sigma_mult: 2.5,
    alert_window_days: 20,
  },
};
