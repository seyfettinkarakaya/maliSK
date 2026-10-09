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

// Çapa ağacı (docs/model.md, Bölüm 4): 1. katman grup, 2. katman grup içi pay.
export const GROUP_LABELS = {
  precious_metals: 'Kıymetli maden',
  equity: 'Hisse',
  tl_fixed: 'TL sabit',
  fx: 'Döviz',
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

// Akran ailesi (docs/model.md, Bölüm 6): ailedeki bir kategoride min_peers'ten az puanlı fon varsa
// ailenin kategorileri tek akran grubunda puanlanır ve sıralanır.
export const PEER_LABELS = {
  metals_family: 'Altın ve gümüş',
  tl_family: 'Kira ve para piyasası',
};

export const DEFAULT_PARAMS = {
  version: 2,
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
    // Çapa ağacı: hedef, bant ve risk eşitliği bu gruplarla kurulur. Döviz ayrı grup (kullanıcı kararı, 8 Ekim 2026).
    tree: [
      { id: 'precious_metals', classes: ['gold', 'silver'] },
      { id: 'equity', classes: ['equity_tr', 'equity_foreign'] },
      { id: 'tl_fixed', classes: ['tl_fixed'] },
      { id: 'fx', classes: ['fx_fixed'] },
    ],
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
    min_peers: 5,
    peer_families: { metals_family: ['gold', 'silver', 'precious_metals'], tl_family: ['lease_tl', 'money_market'] },
    // Ümit vaat eden: geçmişi min_history_months ile full_confidence_months arasında, ham puanı akran grubunda
    // ilk promising_top_n'de ya da promising_min_raw ve üstünde. Yalnız bilgi; öneri üretmez.
    promising_top_n: 3,
    promising_min_raw: 70,
    small_fund_tl: 500e6,
    warming_pct: 20,
    drift_pts: 15,
  },
  allocation: {
    // Kullanıcının seçemediği fonlar öneriye aday olmaz (devlet katkısı ve merkezi alacak devri fonları).
    excluded_categories: ['state_contribution', 'receivables'],
    candidates_per_category: 1,
    fee_lambda: 0.002,
    no_instrument_pts: 3,
    max_funds: 20,
  },
  decision: {
    // Sarı ve kırmızı uyarı: grubun sapması hedefinin bu yüzdesini aşarsa (göreli; küçük gruplarda da çalışır).
    // Sarı: aralık dışı, confirm_days sürerse öneri. Kırmızı: beklemeden öneri.
    yellow_rel_pct: 10,
    red_rel_pct: 20,
    confirm_days: 20,
    // "Şimdi değil" denince aynı tür öneri bu kadar iş günü tekrar gelmez (riskli fon uyarıları hariç).
    snooze_days: 20,
    // Fon sinyali: kategorisinde ilk N'de olmayan fon zayıf; 1.'den bu kadar puan gerideyse değiştir önerilir.
    fund_top_n: 3,
    switch_score_gap: 10,
    alert_sigma_mult: 2.5,
    alert_window_days: 20,
    // Grup içi pay bandı: sınıfın grup içindeki payı hedef paydan bu kadar puan saparsa bant dışı.
    split_band_pts: 10,
    // Grup portföyün bu yüzdesinden küçükse grup içi pay denetlenmez (küçük payda gürültü).
    split_min_group_pct: 5,
  },
};

// Telefondan değiştirilebilen parametreler (Ayarlar → Model ayarları). Hepsi telefonda yeniden hesaplanır:
// hedef, bant, öneri, acil uyarı, çapa önerisi (kovaryans hattan gelir) ve fon puanı (bileşenler hattan gelir).
// Başlıklar soru biçiminde; etiket bir cümle, help ek açıklama. Örnekler arayüzde kullanıcının hedefleriyle hesaplanır.
export const PARAM_GROUPS = {
  rebalance: { title: 'Ne zaman dengeleme önerilsin?', note: 'Sapma, grubun hedefinin yüzdesi olarak ölçülür; küçük gruplarda da aynı ölçü işler.' },
  funds: { title: 'Fonlarım nasıl değerlendirilsin?', note: 'Sıra akran grubunda ve seçtiğin firmaların fonları arasındadır.' },
  proposal: { title: 'Öneri hesaplanırken', note: '' },
  view: { title: 'Piyasa görüşü hedefi ne kadar kaydırsın?', note: 'Görüş sinyali S, −1 (çok olumsuz) ile +1 (çok olumlu) arasındadır.' },
  alert: { title: 'Ani düşüşte uyarı', note: '' },
  anchor: { title: 'Çapa önerisi', note: 'Yalnız öneridir; çapayı sen belirlersin. Kendi çapanı girdiysen bu ayarların etkisi olmaz.' },
  score: { title: 'Fon puanı nasıl hesaplansın?', note: 'Beş ağırlık puandaki paylardır; oranları önemlidir.' },
};

export const PARAM_META = [
  { key: 'decision.yellow_rel_pct', group: 'rebalance', label: 'Bir grup hedefinden yüzde kaç saparsa sarı uyarı versin?', help: 'Sarıda öneri hemen gelmez; aşağıdaki süre boyunca sürerse gelir.', unit: '%', min: 5, max: 50, step: 1 },
  { key: 'decision.red_rel_pct', group: 'rebalance', label: 'Bir grup hedefinden yüzde kaç saparsa kırmızı uyarı versin?', help: 'Kırmızıda dengeleme önerisi beklemeden gelir.', unit: '%', min: 10, max: 100, step: 1 },
  { key: 'decision.confirm_days', group: 'rebalance', label: 'Sarı uyarı kaç iş günü sürerse dengeleme önerilsin?', help: '20 iş günü yaklaşık bir aydır. Kısa dalgalanmada öneri gelmesin diye.', unit: 'iş günü', min: 1, max: 60, step: 1 },
  { key: 'decision.snooze_days', group: 'rebalance', label: '“Şimdi değil” dediğimde öneri kaç iş günü tekrar gelmesin?', help: 'Riskli fon uyarıları bundan etkilenmez.', unit: 'iş günü', min: 1, max: 60, step: 1 },
  { key: 'decision.split_band_pts', group: 'rebalance', label: 'Grup içindeki oran (altın/gümüş gibi) kaç puan saparsa uyarsın?', help: 'Grubun toplamı yerindeyken içindeki dağılımın kaymasını yakalar.', unit: 'puan', min: 2, max: 30, step: 1 },
  { key: 'decision.split_min_group_pct', group: 'rebalance', label: 'Grup portföyün yüzde kaçından küçükse grup içi orana bakılmasın?', help: 'Küçük grupta oran çok oynar; gereksiz uyarı olmasın diye.', unit: '%', min: 0, max: 20, step: 1 },
  { key: 'decision.fund_top_n', group: 'funds', label: 'Fonum akran grubunda ilk kaçta değilse zayıf sayılsın?', help: 'Zayıf fon için hemen uyarı gelir; ilk sıralardaki fonlar gösterilir.', unit: 'sıra', min: 1, max: 10, step: 1 },
  { key: 'decision.switch_score_gap', group: 'funds', label: 'Grubun en iyisi benim fonumdan kaç puan yüksekse fon değiştirmeyi önersin?', help: 'Fark bundan küçükse yalnız zayıf uyarısı kalır; birkaç puan için fon değiştirtmez.', unit: 'puan', min: 0, max: 50, step: 1 },
  { key: 'fund_quality.promising_top_n', group: 'funds', label: 'Genç bir fon (12–36 ay) ham puanıyla ilk kaçtaysa “ümit vaat eden” listesine girsin?', help: 'Ham puan: kısa geçmiş düzeltmesi yapılmadan. Liste yalnız bilgi verir.', unit: 'sıra', min: 1, max: 10, step: 1 },
  { key: 'fund_quality.promising_min_raw', group: 'funds', label: 'Ya da genç fonun ham puanı en az kaç olursa listeye girsin?', help: 'İki koşuldan biri yeter.', unit: 'puan', min: 50, max: 100, step: 1 },
  { key: 'fund_quality.new_fund_cap_pct', group: 'proposal', label: '12 aydan genç bir fona öneride en çok yüzde kaç verilsin?', help: 'Geçmişi kısa fonun riski bilinmez.', unit: '%', min: 0, max: 20, step: 1 },
  { key: 'allocation.no_instrument_pts', group: 'proposal', label: 'Hiçbir helal fonla hedefe kaç puandan fazla yaklaşılamıyorsa “uygun araç yok” desin?', help: 'Örneğin yabancı hisse için helal fon azsa bu uyarı çıkar.', unit: 'puan', min: 1, max: 10, step: 0.5 },
  { key: 'tactical.max_tilt_pts', group: 'view', label: 'Görüş bir grubun hedefini en çok kaç puan kaydırsın?', help: 'Olumlu görüşte hedef artar, olumsuzda azalır.', unit: 'puan', min: 0, max: 15, step: 0.5 },
  { key: 'tactical.full_tilt_at', group: 'view', label: 'Sinyal S kaça ulaşınca kaydırma tam olsun?', help: 'Daha küçük S’de kaydırma orantılı olur. Değer büyüdükçe görüş hedefi daha yavaş kaydırır.', unit: 'S', min: 0.1, max: 1, step: 0.05 },
  { key: 'tactical.weights.trend', group: 'view', label: 'Sinyalde fiyat trendinin ağırlığı', help: 'Son 1, 3 ve 12 ayın yönü ve 210 günlük ortalama.', unit: '', min: 0, max: 1, step: 0.05 },
  { key: 'tactical.weights.macro', group: 'view', label: 'Sinyalde makro verinin (faiz, piyasa rejimi) ağırlığı', help: 'EVDS ve FRED anahtarları girilene kadar makro sinyal 0’dır.', unit: '', min: 0, max: 1, step: 0.05 },
  { key: 'tactical.weights.user', group: 'view', label: 'Sinyalde senin görüşünün ağırlığı', help: 'Üç ağırlığın toplamı 1 olmalı.', unit: '', min: 0, max: 1, step: 0.05 },
  { key: 'decision.alert_sigma_mult', group: 'alert', label: 'Son 20 iş günündeki düşüş, normal oynaklığın kaç katını geçerse acil uyarı versin?', help: 'Oynak varlıkta eşik kendiliğinden büyür, sakin varlıkta küçülür.', unit: '×', min: 1, max: 5, step: 0.25 },
  { key: 'anchor.target_vol_pct', group: 'anchor', label: 'Riskli kısmın yıllık oynaklığı en çok yüzde kaç olsun?', help: 'Fazlası TL sabite gider.', unit: '%', min: 4, max: 30, step: 1 },
  { key: 'anchor.class_cap_pct', group: 'anchor', label: 'Bir varlık sınıfı en çok yüzde kaç olsun?', help: '', unit: '%', min: 15, max: 100, step: 5 },
  { key: 'fund_quality.weights.consistency', group: 'score', label: 'İstikrar: her dönemde grubunun ortasında ya da üstünde kalması', help: '', unit: '', min: 0, max: 1, step: 0.05 },
  { key: 'fund_quality.weights.excess_index', group: 'score', label: 'Fazla getiri: içeriğinin (ya da kıyasının) getirisini geçmesi', help: 'Uzun vade ağırlıklı: 1 yıl %20, 3 yıl %30, 5 yıl %50.', unit: '', min: 0, max: 1, step: 0.05 },
  { key: 'fund_quality.weights.risk', group: 'score', label: 'Risk: düşüşlerde dayanıklılık ya da kıyasını yakından izleme', help: '', unit: '', min: 0, max: 1, step: 0.05 },
  { key: 'fund_quality.weights.cost', group: 'score', label: 'Ücret: yıllık fon işletim giderinin düşüklüğü', help: '', unit: '', min: 0, max: 1, step: 0.05 },
  { key: 'fund_quality.weights.hygiene', group: 'score', label: 'Düzen: ücret yasal tavanı aşmıyor ve fon 500 milyon TL’den büyük', help: '', unit: '', min: 0, max: 1, step: 0.05 },
];
