# maliSK

Helal (katılım) bireysel emeklilik fonları için kişisel karar destek uygulaması.
Her iş günü üç soruya cevap verir: dağılımım ne durumda, piyasa ve fonlar ne söylüyor,
dağılımımı değiştirmeli miyim. Son karar kullanıcınındır.

**Durum:** model çekirdeği ve kabul testleri hazır; veri alımı ve telefon arayüzü yapılıyor.

## Nasıl çalışır

- **Her sabah (GitHub Actions):** TEFAS'tan katılım emeklilik fonlarının fiyat ve içerikleri,
  anahtar tanımlıysa EVDS ve FRED'den makro seriler çekilir. Fon puanları, sınıf görüşleri ve
  çapa önerisi hesaplanıp `data/` altına JSON olarak yazılır.
- **Telefonda (PWA, GitHub Pages):** uygulama bu JSON'u okur. Dağılımın (yüzde olarak) yalnız
  telefonda durur; maruziyet, bant ve öneri hesabı telefonda yapılır.
- **Claude'a danış:** günün özetini, dağılımını ve öneriyi hazır bir metin olarak kopyalar.

## Klasörler

| Yol | Görev |
|---|---|
| `src/model/` | Model çekirdeği: indisler, maruziyet, puan, taktik, bant, risk eşitliği, optimizasyon |
| `tests/` | Kabul ve birim testleri (`npm test`) |
| `tools/probe.py` | Canlı veri denemesi: TEFAS, EVDS, FRED alan adları |
| `docs/model.md` | Model, sürüm 2.1 |
| `docs/mimari.md` | Mimari ve bilinen riskler |

## Anahtarlar (isteğe bağlı)

Depo ayarlarında **Settings → Secrets and variables → Actions** altına:

- `EVDS_API_KEY`: TÜFE, politika faizi, USD/TRY, gram altın, sanayi üretimi
- `FRED_API_KEY`: ABD makro serileri ve S&P 500

Anahtar yoksa bu veriler "veri yok" olarak görünür, uygulamanın geri kalanı çalışır.
