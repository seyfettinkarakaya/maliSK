# Veri alanları (F0 canlı deneme)

Üretildi: 2026-10-07 22:22 (Europe/Istanbul) · `tools/probe.py`

Bu dosya otomatik üretilir; elle düzenleme. Ham örnekler `docs/probe/` altında.

Çalışan makine: ülke **US**, bölge California, ağ AS8075 Microsoft Corporation

## 1. TEFAS

| İstek | HTTP | Durum | Süre (s) | Hata | Kota başlıkları |
|---|---|---|---|---|---|
| info EMK son 10 gün | 200 | ✅ | 2.92 |  |  |
| dağılım EMK son 10 gün | None | ❌ | 60.45 | ConnectTimeout: HTTPSConnectionPool(host='www.tefas.gov.tr', port=443): Max retries exceeded with url: /api/funds/dagilimSiraliGetirT (Caused by ConnectTimeoutError(<HTTPSConnection(host='www.tefas.gov.tr', port=443) at 0x7f7a76bcff50>, 'Connection to www.tefas.gov.tr timed out. (connect timeout=60)')) |  |
| info VGA 365 gün (tek fon, uzun aralık) | 200 | ✅ | 1.24 |  |  |
| info EMK 45 gün (30 gün sınırı) | 200 | ✅ | 0.86 |  |  |

Yanıtların `resultList` dışındaki üst alanları:

```json
{
 "info EMK son 10 gün": {
  "errorCode": null,
  "errorMessage": null,
  "toplamSayi": 3200,
  "toplamSayfa": 1
 },
 "info VGA 365 gün (tek fon, uzun aralık)": {
  "errorCode": null,
  "errorMessage": "Geçersiz veri: Tarih aralığı 1 ayı aşamaz",
  "toplamSayi": null,
  "toplamSayfa": null
 },
 "info EMK 45 gün (30 gün sınırı)": {
  "errorCode": null,
  "errorMessage": "Geçersiz veri: Tarih aralığı 1 ayı aşamaz",
  "toplamSayi": null,
  "toplamSayfa": null
 }
}
```

### 1.1 Fon genel bilgi (`fonGnlBlgSiraliGetir`)

- Satır: 3200 · fon: 400 · son gün fon: 400 · son gün KATILIM adlı fon: 123
- Tarihler (ham biçim): 2026-09-28, 2026-09-29, 2026-09-30, 2026-10-01, 2026-10-02, 2026-10-05, 2026-10-06, 2026-10-07
- Örnek KATILIM fonları: AGESA EMEKLİLİK VE HAYAT A.Ş. BAŞLANGIÇ KATILIM EMEKLİLİK YATIRIM FONU; AGESA HAYAT VE EMEKLİLİK A.Ş. ALTIN KATILIM EMEKLİLİK YATIRIM FONU; AGESA HAYAT VE EMEKLİLİK A.Ş. KATILIM HİSSE SENEDİ EMEKLİLİK YATIRIM FONU; AGESA HAYAT VE EMEKLİLİK A.Ş. KATILIM KATKI EMEKLİLİK YATIRIM FONU; AGESA HAYAT VE EMEKLİLİK A.Ş. KATILIM STANDART EMEKLİLİK YATIRIM FONU; AGESA HAYAT VE EMEKLİLİK A.Ş. OKS AGRESİF KATILIM DEĞİŞKEN EMEKLİLİK YATIRIM FONU; AGESA HAYAT VE EMEKLİLİK A.Ş. OKS DİNAMİK KATILIM DEĞİŞKEN EMEKLİLİK YATIRIM FONU; AGESA HAYAT VE EMEKLİLİK A.Ş. OKS KATILIM STANDART EMEKLİLİK YATIRIM FONU

Örnek değerler `VGA` fonundan:

| Ham alan | pytefas adı | Örnek |
|---|---|---|
| fonKodu | fund_code | VGA |
| fonUnvan | fund_name | TÜRKİYE HAYAT VE EMEKLİLİK A.Ş. ALTIN KATILIM EMEKLİLİK YATIRIM FONU |
| tarih | date | 2026-10-07 |
| fiyat | price | 0.74301 |
| tedPaySayisi | shares_outstanding | 325841199189.944 |
| kisiSayisi | investor_count | 2004428 |
| portfoyBuyukluk | portfolio_size | 242103427180.25 |
| borsaBultenFiyat | exchange_bulletin_price | None |
| rn | —(pytefas'ta yok) | 373 |

Dağılım bilgisi gelmedi.

- **Tek fon, 365 gün:** 0 satır, 0 farklı tarih,  → 
- **Tüm EMK, 45 gün:** 0 satır, 0 farklı tarih,  → 

## 2. TCMB EVDS

Atlandı: EVDS_API_KEY tanımlı değil.

## 3. FRED

Atlandı: FRED_API_KEY tanımlı değil.

