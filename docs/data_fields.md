# Veri alanları (F0 canlı deneme)

Üretildi: 2026-10-07 22:26 (Europe/Istanbul) · `tools/probe.py`

Bu dosya otomatik üretilir; elle düzenleme. Ham örnekler `docs/probe/` altında.

Çalışan makine: ülke **US**, bölge Virginia, ağ AS8075 Microsoft Corporation

## 1. TEFAS

| İstek | HTTP | Durum | Süre (s) | Hata | Kota başlıkları |
|---|---|---|---|---|---|
| info EMK son 10 gün | 200 | ✅ | 2.26 |  |  |
| dağılım EMK son 10 gün (deneme 2) | 200 | ✅ | 2.96 |  |  |
| dağılım EMK, 3 yıl önce (5 gün) (deneme 2) | 200 | ✅ | 2.51 |  |  |
| info EMK, 5 yıl önce (5 gün) (deneme 2) | 200 | ❌ | 0.56 | Geçersiz veri: Baslangıc Tarihi 5 yıldan eski olamaz |  |
| info EMK 31 gün (sınır) (deneme 2) | 200 | ✅ | 31.99 |  |  |

Yanıtların `resultList` dışındaki üst alanları:

```json
{
 "info EMK son 10 gün": {
  "errorCode": null,
  "errorMessage": null,
  "toplamSayi": 3200,
  "toplamSayfa": 1
 },
 "dağılım EMK son 10 gün (deneme 2)": {
  "errorCode": null,
  "errorMessage": null,
  "toplamSayi": 3200,
  "toplamSayfa": 1
 },
 "dağılım EMK, 3 yıl önce (5 gün) (deneme 2)": {
  "errorCode": null,
  "errorMessage": null,
  "toplamSayi": 1080,
  "toplamSayfa": 1
 },
 "info EMK, 5 yıl önce (5 gün) (deneme 2)": {
  "errorCode": null,
  "errorMessage": "Geçersiz veri: Baslangıc Tarihi 5 yıldan eski olamaz",
  "toplamSayi": null,
  "toplamSayfa": null
 },
 "info EMK 31 gün (sınır) (deneme 2)": {
  "errorCode": null,
  "errorMessage": null,
  "toplamSayi": 9200,
  "toplamSayfa": 1
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

### 1.2 Portföy dağılımı (`dagilimSiraliGetirT`)

- Satır: 3200 · son gün fon: 400 · KATILIM: 123
- KATILIM fonlarında satır toplamı: en az 1791401303576.0, en çok 1791401303584.0
- pytefas eşlemesinde olmayan ham alanlar: bilFiyat
- pytefas eşlemesinde olup yanıtta gelmeyen alanlar: yok

| Ham alan | pytefas adı | KATILIM fonu >0 | KATILIM en çok % | Tüm fonlar >0 |
|---|---|---|---|---|
| bb | bank_bill_pct | 0 | 0.0 | 0 |
| byf | etf_pct | 54 | 24.41 | 134 |
| d | other_pct | 15 | 24.99 | 32 |
| db | fx_payable_bond_pct | 0 | 0.0 | 0 |
| bpp | bist_money_market_pct | 0 | 0.0 | 0 |
| btaa | bist_committed_buy_pct | 0 | 0.0 | 0 |
| btas | bist_committed_sell_pct | 70 | 61.41 | 74 |
| dt | government_bond_pct | 0 | 0.0 | 165 |
| dot | fx_payable_bill_pct | 0 | 0.0 | 0 |
| eut | eurobond_pct | 0 | 0.0 | 0 |
| fb | financing_bill_pct | 0 | 0.0 | 63 |
| fkb | fund_participation_certificate_pct | 0 | 0.0 | 0 |
| gas | real_estate_certificate_pct | 0 | 0.0 | 0 |
| gsykb | venture_capital_fund_pct | 58 | 15.26 | 187 |
| gsyy | venture_capital_investment_pct | 0 | 0.0 | 0 |
| gykb | real_estate_fund_pct | 23 | 6.94 | 93 |
| gyy | real_estate_investment_pct | 0 | 0.0 | 0 |
| hb | treasury_bill_pct | 0 | 0.0 | 21 |
| hs | stock_pct | 85 | 90.99 | 286 |
| kba | fx_government_internal_debt_pct | 0 | 0.0 | 27 |
| kh | participation_account_pct | 0 | 0.0 | 0 |
| khau | participation_account_gold_pct | 2 | 0.64 | 2 |
| khd | participation_account_fx_pct | 7 | 7.95 | 9 |
| khtl | participation_account_tl_pct | 65 | 100.0 | 83 |
| kks | government_lease_certificate_pct | 0 | 0.0 | 0 |
| kksd | government_lease_certificate_fx_pct | 5 | 90.18 | 8 |
| kkstl | government_lease_certificate_tl_pct | 84 | 93.74 | 122 |
| kksyd | government_foreign_lease_certificate_pct | 0 | 0.0 | 1 |
| km | precious_metals_pct | 20 | 89.05 | 41 |
| kmbyf | precious_metals_etf_pct | 17 | 27.48 | 27 |
| kmkba | precious_metals_government_debt_pct | 0 | 0.0 | 6 |
| kmkks | precious_metals_lease_certificate_pct | 10 | 75.23 | 22 |
| kibd | government_external_debt_pct | 1 | 4.18 | 8 |
| osks | private_sector_lease_certificate_pct | 63 | 93.42 | 81 |
| ost | private_sector_bond_pct | 0 | 0.0 | 111 |
| r | repo_pct | 0 | 0.0 | 0 |
| t | derivative_pct | 0 | 0.0 | 0 |
| tpp | takasbank_money_market_pct | 0 | 0.0 | 100 |
| tr | reverse_repo_pct | 0 | 0.0 | 188 |
| vdm | asset_backed_securities_pct | 0 | 0.0 | 30 |
| vm | term_deposit_pct | 0 | 0.0 | 0 |
| vmau | deposit_gold_pct | 0 | 0.0 | 0 |
| vmd | deposit_fx_pct | 0 | 0.0 | 17 |
| vmtl | deposit_tl_pct | 0 | 0.0 | 133 |
| vint | futures_cash_collateral_pct | 0 | 0.0 | 187 |
| yba | foreign_debt_security_pct | 0 | 0.0 | 0 |
| ybkb | foreign_government_debt_pct | 0 | 0.0 | 5 |
| ybosb | foreign_private_sector_debt_pct | 0 | 0.0 | 3 |
| ybyf | foreign_etf_pct | 3 | 3.48 | 38 |
| yhs | foreign_stock_pct | 5 | 51.89 | 45 |
| ymk | foreign_security_pct | 0 | 0.0 | 0 |
| yyf | investment_fund_pct | 65 | 83.43 | 235 |
| oksyd | private_sector_foreign_lease_certificate_pct | 3 | 4.2 | 3 |
| osdb | private_sector_external_debt_pct | 0 | 0.0 | 20 |
| bilFiyat | —(pytefas'ta yok) | 123 | 1791401303484.0 | 400 |

#### Helal filtresi ön izlemesi

Adı KATILIM içerip faizli araç **adayı** alanlarda payı 0'dan büyük olan fonlar (aday alanlar: dt, hb, fb, ost, bb, vdm, eut, kibd, osdb, kba, dot, db, tpp, bpp, r, tr, vm, vmtl, vmd, vmau, kmkba, yba, ybkb, ybosb). Kesin liste kullanıcı onayıyla belirlenecek.

| Fon | Ad | Alanlar |
|---|---|---|
| HEA | AXA HAYAT VE EMEKLİLİK A.Ş. ALTIN KATILIM EMEKLİLİK YATIRIM FONU | kibd=4.18 |

### 1.3 Tarih aralığı ve geçmiş derinliği

- Tek istekte en çok 1 ay (TEFAS: "Tarih aralığı 1 ayı aşamaz"); tek fon için de aynı.

- **Dağılım, 3 yıl önce:** 1080 satır, 360 fon, 3 tarih (2023-10-04 → 2023-10-06)
- **Fiyat, 5 yıl önce:** 0 satır, 0 fon, 0 tarih (—) · hata: Geçersiz veri: Baslangıc Tarihi 5 yıldan eski olamaz
- **Fiyat, 31 gün:** 9200 satır, 400 fon, 23 tarih (2026-09-07 → 2026-10-07)

## 2. TCMB EVDS

Atlandı: EVDS_API_KEY tanımlı değil.

## 3. FRED

Atlandı: FRED_API_KEY tanımlı değil.

