# TEFAS fon türü ve ücret alanları

Üretildi: 2026-10-08T06:24:55.999Z · `tools/tefas_types.mjs`

## fonYonetimBazliBilgiGetir

HTTP 200 · 400 satır

Alanlar: `fonKodu`, `fonUnvan`, `fonTurAciklama`, `tefasDurum`, `fonTurKod`, `kurucuKod`, `altbaslik1`, `uygulananYu1Y`, `altbaslik2`, `fonIcTuzukYu1G`, `yillikGetiri`, `altbaslik3`, `fonTopGiderKesoran`

| fonTurAciklama | fon | adında KATILIM | fonTurKod | KATILIM örnek | KATILIM olmayan örnek |
|---|---|---|---|---|---|
| Değişken Fon | 119 | 30 | 151 | VVZ, VVU, AJG | AE3, ENF, VVA |
| Hisse Senedi Fonu | 34 | 0 | 116 |  | AEH, AEB, GFH |
| Borçlanma Araçları Fonu | 24 | 0 | 150 |  | AE2, AEK, AZK |
| Fon Sepeti Fonu | 23 | 1 | 125 | KFE | MZN, MZL, MZP |
| Para Piyasası Fonu | 13 | 1 | 154 | VEY | AE1, AZL, AH2 |
| Karma Fon | 13 | 2 | 113 | KLV, KRM | AVD, AZD, AUG |
| Standart Fon | 13 | 0 | 40 |  | AVN, AZS, ATK |
| Başlangıç Katılım Fonu | 12 | 12 | 158 | AVJ, ACV, AO2 |  |
| Katılım Katkı Fonu | 12 | 12 | 156 | FYL, FYY, AER |  |
| Devlet Katkısı Fonu | 12 | 0 | 38 |  | AEI, AMF, AET |
| OKS Katılım Standart Fon | 12 | 12 | 162 | AYJ, KOS, AFP |  |
| Kamu Yabancı Para (Döviz) Cinsinden Borçlanma Araç | 11 | 0 | 30 |  | AMG, AMR, AH3 |
| Başlangıç Fonu | 10 | 0 | 157 |  | AHJ, ALZ, AO1 |
| Katılım Standart Fon | 10 | 10 | 41 | FYN, FYU, AGE |  |
| OKS Standart Fon | 10 | 0 | 161 |  | AAJ, KOA, AFH |
| Altın Katılım Fonu | 9 | 9 | 167 | GEV, NZA, AEA |  |
| Katılım Değişken Fon | 9 | 9 | 168 | AIP, AIE, KED |  |
| Katılım Hisse Senedi Fonu | 8 | 8 | 164 | EHK, ALU, KHL |  |
| Kira Sertifikasi Katılım Fonu | 8 | 8 | 166 | AUA, KRU, BHK |  |
| Altın Fonu | 7 | 0 | 26 |  | EAE, AMZ, BGL |
| Dış Borçlanma Araçları Fonu | 6 | 0 | 165 |  | AVG, AVB, GHG |
| Katılım Fonu | 6 | 6 | 152 | KGC, KJM, KSU |  |
| Kıymetli Madenler | 4 | 1 | 27 | VGD | KML, EMY, KMP |
| Endeks Fon | 4 | 0 | 112 |  | SBA, AEU, ALI |
| Merkezi Alacağın Devri Fonu | 4 | 2 | 171 | MDK, TMN | MDD, MDE |
| Özel Sektör Borçlanma Araçları Fonu | 3 | 0 | 19 |  | AVO, AHC, FEA |
| Yaşam Döngüsü/Hedef Fon | 3 | 0 | 155 |  | TML, TYJ, TJY |
| Kamu Borçlanma Araçları Fonu | 1 | 0 | 18 |  | ZHG |

- Adında KATILIM olup türü katılım olmayan: VVZ (Değişken Fon), VVU (Değişken Fon), MDK (Merkezi Alacağın Devri Fonu), AJG (Değişken Fon), AJH (Değişken Fon), HEE (Değişken Fon), AJZ (Değişken Fon), AJY (Değişken Fon), AGB (Değişken Fon), AGG (Değişken Fon), AGM (Değişken Fon), BEO (Değişken Fon), BEF (Değişken Fon), BPS (Değişken Fon), BPO (Değişken Fon), GHU (Değişken Fon), GHV (Değişken Fon), GHY (Değişken Fon), GHZ (Değişken Fon), FIM (Değişken Fon), FIU (Değişken Fon), FIV (Değişken Fon), KES (Değişken Fon), KEG (Değişken Fon), KEK (Değişken Fon), KLV (Karma Fon), KFE (Fon Sepeti Fonu), KEZ (Değişken Fon), KET (Değişken Fon), MHV (Değişken Fon), MHU (Değişken Fon), CHD (Değişken Fon), CHI (Değişken Fon), KRM (Karma Fon), VGD (Kıymetli Madenler), TMN (Merkezi Alacağın Devri Fonu), VEY (Para Piyasası Fonu)
- Türü katılım olup adında KATILIM olmayan: yok

## fonGetiriBazliBilgiGetir

HTTP 200 · 402 satır

Alanlar: `fonKodu`, `fonUnvan`, `fonTurAciklama`, `tefasDurum`, `getiri1a`, `getiri3a`, `getiri6a`, `getiri1y`, `getiriyb`, `getiri3y`, `getiri5y`, `getiriOrani`, `riskDegeri`

| fonTurAciklama | fon | adında KATILIM | fonTurKod | KATILIM örnek | KATILIM olmayan örnek |
|---|---|---|---|---|---|
| Değişken Fon | 119 | 30 |  | VVZ, VVU, AJG | AE3, ENF, VVA |
| Hisse Senedi Fonu | 35 | 0 |  |  | AEH, AEB, GFH |
| Borçlanma Araçları Fonu | 24 | 0 |  |  | AE2, AEK, AZK |
| Fon Sepeti Fonu | 23 | 1 |  | KFE | MZN, MZP, MZL |
| Para Piyasası Fonu | 13 | 1 |  | VEY | AE1, AZL, AH2 |
| Karma Fon | 13 | 2 |  | KLV, KRM | AVD, AZD, AUG |
| Standart Fon | 13 | 0 |  |  | AVN, AZS, ATK |
| Başlangıç Katılım Fonu | 12 | 12 |  | AVJ, ACV, AO2 |  |
| Katılım Katkı Fonu | 12 | 12 |  | FYL, FYY, AER |  |
| Devlet Katkısı Fonu | 12 | 0 |  |  | AEI, AMF, AET |
| OKS Katılım Standart Fon | 12 | 12 |  | AYJ, KOS, AFP |  |
| Kamu Yabancı Para (Döviz) Cinsinden Borçlanma Araç | 11 | 0 |  |  | AMG, AMR, AH3 |
| Başlangıç Fonu | 10 | 0 |  |  | AHJ, ALZ, AO1 |
| Katılım Standart Fon | 10 | 10 |  | FYN, FYU, AGE |  |
| OKS Standart Fon | 10 | 0 |  |  | AAJ, KOA, AFH |
| Altın Katılım Fonu | 9 | 9 |  | GEV, NZA, AEA |  |
| Katılım Değişken Fon | 9 | 9 |  | AIP, AIE, KED |  |
| Katılım Hisse Senedi Fonu | 8 | 8 |  | EHK, ALU, KHL |  |
| Kira Sertifikasi Katılım Fonu | 8 | 8 |  | AUA, KRU, BHK |  |
| Altın Fonu | 7 | 0 |  |  | EAE, AMZ, BGL |
| Dış Borçlanma Araçları Fonu | 6 | 0 |  |  | AVG, AVB, GHG |
| Katılım Fonu | 6 | 6 |  | KGC, KJM, KSU |  |
| Endeks Fon | 5 | 0 |  |  | SBA, AEU, ALI |
| Kıymetli Madenler | 4 | 1 |  | VGD | KML, EMY, KMP |
| Merkezi Alacağın Devri Fonu | 4 | 2 |  | MDK, TMN | MDD, MDE |
| Özel Sektör Borçlanma Araçları Fonu | 3 | 0 |  |  | AVO, AHC, FEA |
| Yaşam Döngüsü/Hedef Fon | 3 | 0 |  |  | TML, TJY, TYJ |
| Kamu Borçlanma Araçları Fonu | 1 | 0 |  |  | ZHG |

- Adında KATILIM olup türü katılım olmayan: VVZ (Değişken Fon), VVU (Değişken Fon), MDK (Merkezi Alacağın Devri Fonu), AJG (Değişken Fon), AJH (Değişken Fon), HEE (Değişken Fon), AJZ (Değişken Fon), AJY (Değişken Fon), AGB (Değişken Fon), AGG (Değişken Fon), AGM (Değişken Fon), BEO (Değişken Fon), BEF (Değişken Fon), BPS (Değişken Fon), BPO (Değişken Fon), GHU (Değişken Fon), GHV (Değişken Fon), GHY (Değişken Fon), GHZ (Değişken Fon), FIM (Değişken Fon), FIU (Değişken Fon), FIV (Değişken Fon), KES (Değişken Fon), KEG (Değişken Fon), KEK (Değişken Fon), KLV (Karma Fon), KFE (Fon Sepeti Fonu), KEZ (Değişken Fon), KET (Değişken Fon), MHV (Değişken Fon), MHU (Değişken Fon), CHD (Değişken Fon), CHI (Değişken Fon), KRM (Karma Fon), VGD (Kıymetli Madenler), TMN (Merkezi Alacağın Devri Fonu), VEY (Para Piyasası Fonu)
- Türü katılım olup adında KATILIM olmayan: yok

