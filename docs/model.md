# maliSK modeli — sürüm 2.6

**Tarih:** 9 Ekim 2026 · **Sahibi:** Seyfettin · Kaynak: BES Fon Danışmanı spesifikasyonu 2.0
ve 7–8 Ekim 2026 tarihli model görüşmelerindeki kararlar (en altta değişiklik günlüğü).

Formüller modelin kendisidir; değiştirmeden önce kullanıcıya sorulur. Tüm sayısal değerler
parametredir (`src/model/params.mjs`); burada yazanlar varsayılandır.

## 1. Amaç ve kapsam

Her iş günü: dağılımım ne durumda, piyasa ve fonlar ne söylüyor, dağılımımı değiştirmeli miyim?
Öneri yalnız kalıcı sapmada, acil uyarı büyük düşüşte. Son karar kullanıcınındır.

- **Kapsam:** TEFAS'ta işlem gören katılım emeklilik fonları (`EMK`).
- **Helal:** yalnız katılım fonları; faizli araç içeren fon evrene girmez.
- **BES:** bir dağılımda en çok 20 fon. Yıllık 12 değişiklik sınırını ilk sürümde kullanıcı izler.
- **Girdi:** kullanıcı mevcut birikiminin dağılımını yüzde olarak ve tarihiyle girer; ayda bir
  şirket ekranından güncellemesi önerilir. TL tutar, maliyet ve XIRR ilk sürümde yok.

## 2. Veri

- **TEFAS** (`fonGnlBlgSiraliGetir`, `dagilimSiraliGetirT`): fiyat, pay, kişi sayısı, büyüklük,
  içerik dağılımı. Getiriler fiyattan hesaplanır. İçerik geçmişi aylık anlık görüntülerle tutulur.
- **TEFAS** (`fonYonetimBazliBilgiGetir`, `fonGetiriBazliBilgiGetir`): fon türü (`fonTurAciklama`,
  `fonTurKod`), kurucu, uygulanan ve iç tüzükteki yıllık fon işletim gideri, azami toplam gider kesintisi,
  SPK risk değeri (1–7). Ayrıntı: `docs/tefas_types.md`.
- **EVDS:** TÜFE, politika faizi, USD/TRY, gram altın TL, sanayi üretimi veya imalat PMI.
- **FRED:** ABD TÜFE, politika faizi, 10 yıllık faiz, sanayi üretimi, S&P 500.
- Veri gelmeyen gün son geçerli değer kullanılır; günlük fiyat değişimi %15'i aşarsa "Şüpheli veri".

## 3. Evren ve sınıflandırma

- **Helal filtresi:**
  1. Katılım fonu: TEFAS fon türünde "Katılım" geçer (Altın Katılım, Katılım Hisse Senedi, Kira Sertifikası
     Katılım, Katılım Değişken, Katılım Fonu, Katılım Standart, OKS Katılım Standart, Başlangıç Katılım,
     Katılım Katkı) **ya da** fonun adında KATILIM vardır. TEFAS'ta adında KATILIM olup genel türde duran
     fonlar var (Değişken, Karma, Para Piyasası, Kıymetli Madenler, Fon Sepeti, Merkezi Alacağın Devri);
     türü katılım olup adında KATILIM olmayan fon yok.
  2. İçerikte faizli araç payı 0. Faizli alanlar: devlet tahvili, hazine bonosu, finansman bonosu, özel sektör
     tahvili, banka bonosu, varlığa dayalı menkul kıymet, eurobond, kamu ve özel sektör dış borçlanma araçları,
     döviz cinsinden kamu iç borçlanma, repo ve ters repo, TL/döviz/altın mevduat, Takasbank ve BİST para
     piyasası, altın tahvili, yabancı borçlanma araçları.
  3. Elle beyaz ve kara liste. Her fonun ekranında kararın dayanağı gösterilir.
- **Kategori:** önce TEFAS fon türünden (`type_categories` parametresi), eşleşmezse fon adındaki anahtar
  kelimeyle (GÜMÜŞ, KIYMETLİ MADEN, ALTIN, HİSSE, KARMA, DEĞİŞKEN, ÇOKLU VARLIK, PARA PİYASASI,
  KİRA SERTİFİKA, DÖVİZ); o da yoksa içerikteki ana sınıfa göre. TEFAS türünden gelen ek kategoriler:
  Standart, Başlangıç, Katkı (devlet katkısı), Merkezi alacak devri.
- **Strateji değiştiren fon:** geçmişi dönüşüm tarihinden başlar (`history_start`), "Strateji değişti" bayrağı alır.
  AUA: SPK 12.08.2026 izniyle Fon Sepeti EYF → Kira Sertifikaları Katılım EYF; yeni ölçüt 01.10.2026.
- **Varlık sınıfları:** Altın, Gümüş, TL sabit, Yurtiçi hisse, Yabancı hisse, Döviz sabit, Belirsiz.
  Kıymetli maden gümüş fonunda Gümüş, diğerlerinde Altın; fon sepeti fonun ana sınıfına (karma
  fonda Belirsiz); "diğer" para piyasası fonunda TL sabit, diğerlerinde Belirsiz.
- **Maruziyet:** `E_s = Σ_f w_f · i_(f,s)`. Fonun ana sınıfı en büyük paylı sınıftır.
- **Sınıf getiri serisi:** temsil eden kategorideki fonların günlük getirilerinin medyanı.
  Sınıfta 3'ten az fon varsa piyasa serisi kullanılır (Yabancı hisse: S&P 500 × USD/TRY).

## 4. Katman 1a — çapa (üç ayda bir öneri, karar kullanıcının)

Uygulama çapayı önerir; kullanıcı kendi çapasını Ayarlar'da girer. Bantlar ve hedefler
**kullanıcının çapasıyla** hesaplanır.

**Çapa ağacı (iki katman).** 1. katman gruplar: Kıymetli maden (Altın, Gümüş), Hisse (Yurtiçi,
Yabancı), TL sabit, Döviz (Döviz sabit). 2. katman grup içi pay: Altın/Gümüş, Yurtiçi/Yabancı.
Kullanıcı grup yüzdelerini (toplam 100) ve grup içi payları (grup başına toplam 100) girer.
Sınıf çapası = grup çapası × grup içi pay. Ağaç parametredir (`anchor.tree`). Eski düz çapa
(sınıf yüzdeleri) ağaca çevrilir: grup = sınıfların toplamı, pay = oranları; çok sınıflı grupta
değeri olmayan sınıf izlenir.

1. Riskli sınıfların son 3 yıllık **haftalık** getirilerinden yıllık kovaryans `Σ`.
   Ledoit-Wolf küçültmesi parametredir, ilk sürümde kapalı.
2. **İki katmanlı eşit risk:** önce grup içinde, sonra gruplar arasında her biri eşit risk katkısı:
   `RK_i = w_i · (Σ w)_i / √(wᵀ Σ w)`. Gruplar çapa ağacından gelir: Kıymetli maden (Altın, Gümüş),
   Hisse (Yurtiçi hisse, Yabancı hisse), Döviz sabit ayrı grup. Grupta olmayan sınıf tek başına grup olur.
3. **Gruplama önerisi:** korelasyondan uzaklık `√((1 − ρ) / 2)` ile ortalama bağlantılı kümeleme.
   Ekranda düz, kullanıcının gruplaması ve önerilen gruplamaya göre çapa yan yana gösterilir.
4. **Hedef oynaklık:** `k = min(1, σ_hedef / σ_riskli)`; riskli ağırlıklar × k; TL sabit = 1 − k.
   Varsayılan %12. Ekranda geçmiş veride bu ayarın en büyük düşüşü, en kötü 12 aylık getirisi
   ve TL sabit payı gösterilir (geri test: son 60 ayın ay sonu sınıf endeksleri, her ay çapaya dönülür,
   verisi olmayan sınıfın ağırlığı diğerlerine dağılır; TÜFE verisi gelene kadar nominal).
5. **Negatif reel faiz:** reel politika faizi (politika faizi − yıllık TÜFE) negatifse uyarı çıkar ve
   önerideki TL sabit payı 0,5 ile çarpılır; boşalan pay riskli sınıflara orantılı dağıtılır.
   TL sabitin son 12 aylık reel getirisi her zaman gösterilir.
6. **Sınıf tavanı %40:** fazlalık tavan altındaki riskli sınıflara orantılı; yer yoksa TL sabite.

## 5. Katman 1b — taktik görüş (her gün)

`S = 0,50 · T + 0,25 · M + 0,25 · K`

- **T (trend):** dört sinyalin ortalaması, her biri ±1: 1, 3 ve 12 aylık getiri aynı dönemin para
  piyasası medyanını geçiyor mu (TL sabit için eşik TÜFE); sınıf endeksi 210 iş günlük ortalamanın
  üstünde mi.
- **M (makro):** büyüme ve enflasyon yönüne göre rejim matrisi (Türkiye: Yurtiçi hisse, TL sabit;
  ABD: Altın, Gümüş, Yabancı hisse). **Reel faiz kuralı önce gelir:** reel politika faizi pozitifse
  TL sabit +1, Döviz sabit −1; negatifse TL sabit −1, Döviz sabit +1.
- **K:** kullanıcının sınıf başına −1, 0, +1 seçimi.
- **Grup görüşü:** `S_g = Σ_c pay_c · S_c / 100` (pay: çapadaki grup içi pay).
- **Eğim (sürekli, yalnız grupta):** `eğim_g = 5 · max(−1, min(1, S_g / 0,5))` puan. Görüş etiketi:
  S ≥ 0,40 Olumlu, S ≤ −0,25 Olumsuz, arası Nötr. Grup içi pay görüşle değişmez.
- **Hedef:** grup hedefi `çapa_g + eğim_g`; negatif hedef 0'a çekilir, toplam 100'e ölçeklenir.
  Sınıf hedefi = grup hedefi × grup içi pay.
- **İzlenen sınıf:** çapada değeri olmayan sınıfın hedefi ve bandı yoktur; öneri mevcut
  payını korur. Yönetilen grupların hedefleri `100 − izlenen sınıfların mevcut payı`na ölçeklenir. Uygulamanın çapa
  önerisi yalnız yeterli verisi olan sınıfları içerdiği için gerekli; aksi hâlde verisi olmayan sınıfın hedefi 0 olurdu.
- **Görüş öneri üretmez (karar: A).** Görüş yalnız hedefi kaydırır; öneriyi bant aşımı tetikler.

## 6. Katman 2 — fon puanı

**Akran grubu** kategoridir. Bir akran ailesindeki kategorilerden birinde 5'ten az (`min_peers`) puanlanabilir
fon varsa ailenin bütün kategorileri tek akran grubunda puanlanır ve sıralanır (medyanlar, süreklilik,
sıra). Aileler: Altın ve gümüş (altın, gümüş, kıymetli maden), Kira ve para piyasası (kira sertifikası,
para piyasası). Ailedeki kategorilerin hepsi pasifse risk bileşeni izleme hatasıdır. En az 12 aylık geçmiş gerekir; daha kısa fon "Yeni fon" olur,
puanlanmaz, en çok %5 ağırlık alır.

`Q = 100 · Σ_j w_j c_j / Σ_j w_j` (yalnız hesaplanabilen bileşenler)

| Bileşen | Ağırlık | Ölçek |
|---|---|---|
| Süreklilik | 0,35 | Ham (0–1) |
| Fazla getiri indisi | 0,30 | Medyan, ölçek 0,5 puan/ay |
| Risk | 0,15 | Medyan; pasife yakın kategoride izleme hatası (ölçek 2 puan), aktifte MDD (10 puan) ve Sortino (0,5) ortalaması |
| Maliyet | 0,15 | TEFAS uygulanan yıllık fon işletim gideri; medyan, ölçek 0,5 puan, düşük iyi |
| Hijyen | 0,05 | Ham |

- **Fazla getiri:** fon getirisi, içeriğinden beklenen getiriyle kıyaslanır:
  `beklenen = Σ_s i_(f,s) · R_s`, her dönem o dönemin içeriğiyle. `R_s` dış seri varsa ondan
  (Altın: gram altın TL; Döviz sabit: USD/TRY), yoksa kategori medyanından.
  `fazla = (1 + r_fon) / (1 + r_beklenen) − 1`.
- **İndisler:** aylık eşdeğer `(1 + r)^(1/m) − 1` (bileşik) veya `r / m` (basit).
  - Ind5 (1a, 3a, 6a, yılbaşı, 1y) ve Ind7 (artı 3y, 5y): bölen geçerli dönem sayısı; ekranda bilgi.
  - Uzun vade indisi: 1y %20, 3y %30, 5y %50; eksik dönemin ağırlığı diğerlerine dağılır.
  - Fazla getiri indisi: uzun vade indisinin fazla getiri üzerinden hesabı; varsayılan puana giren.
- **Süreklilik:** `(a + b) / 2`. (a) Dönem: fonun değeri olan ve kategoride en az 3 değer bulunan
  her dönemde fazla getirisi kategori medyanına eşit veya büyükse isabet. (b) Son 12 ayda aylık.
- **Medyan ölçeği:** `c = 0,5 + işaret · (x − medyan) / (2 · ölçek)`, 0–1 arasına kırpılır.
  Medyandaki fon 0,5 alır; 50 puan kategori ortasıdır.
- **Kısa geçmiş güveni:** `Q = 50 + min(1, ay / 36) · (Q_ham − 50)`.
- **Hijyen:** `max(0, 1 − 0,5·[ücret > azami toplam gider kesintisi] − 0,5·[büyüklük < 500 milyon TL])`;
  ücret ya da azami gider bilinmiyorsa o koşul cezalandırılmaz.
- **Bayraklar (puana girmez):** Yeni fon, Isınma (30 günde kişi +%20), Strateji kayması (30 günde
  bir sınıfta 15 puan), Şüpheli veri, Helal uyarısı.

## 7. Katman 3 — fon dağılımı

`min_w Σ_s (Σ_f w_f · i_(f,s) − h_s)² + λ · Σ_f w_f · u_f`, `λ = 0,002`

- Kısıtlar: `w_f ≥ 0`, `Σ w_f = 1`, yeni fon ≤ %5, en çok 20 fon.
- Aday: her kategoriden en yüksek puanlı fon + mevcut fonlar. Devlet katkısı ve merkezi alacak devri
  fonları kullanıcı seçemediği için aday olmaz (`allocation.excluded_categories`).
- Tam sayı yüzdeye en büyük kalan yöntemiyle yuvarlanır.
- Hedefinden 3 puandan fazla uzak kalan sınıf için "Uygun araç yok".

## 8. Katman 4 — karar

- **Grup bandı (göreli):** grup maruziyeti (yönetilen sınıflarının toplamı) için genişlik = grup
  hedefinin %25'i, en az 3, en çok 10 puan; alt sınır 0'ın altına inmez.
- **Grup içi pay bandı:** sınıfın grup içindeki payı `maruziyet_c / maruziyet_g × 100`; bant = hedef
  pay ± 10 puan (0–100 arası). Grup portföyün %5'inden küçükse pay denetlenmez.
- **Sayaç (geçmişten sayma):** her grup ve her grup içi pay için ayrı; bant dışında her iş günü +1, içeri
  dönünce 0. Sayaç, bugünkü fonların son 130 iş gününde de tutulduğu varsayılarak hesaplanır
  (`w_t ∝ w_bugün · P_t / P_bugün`); dağılım bugün girilse de sapmanın süresi bilinir.

### 8.1 Dağılım sinyali

- **Anında öneri:** grubun sapması `|x − h| ≥ k · genişlik` (k = 2) ya da `≥ P` puan (P = 0 kapalı);
  grup içi payda `|x − h| ≥ k · 10`. Teyit beklenmez.
- **Teyitli öneri:** sayaç teyit süresine (20 iş günü) ulaşınca. Arada ekranda "takipte · n iş günü kaldı"
  yazar; öneri önizlemesi her zaman açılabilir.

### 8.2 Fon sinyali (aralıktan ve şirketten bağımsız; tüm BES evreni)

- **Sıra:** fon, kendi akran grubundaki (Bölüm 6) helal ve puanlı fonlar arasında puana göre sıralanır.
- **Zayıf:** akran grubunda ilk N'de (N = 3) olmayan fon için hemen uyarı; ilk N fon gösterilir.
- **Değiştir:** zayıf fonun puanı akran grubunun en iyisinden ≥ 10 puan düşükse "X yerine o fon" önerilir;
  pay olduğu gibi geçer. Akran grubu bir aileyse en iyi, aynı ana sınıftaki fonlar arasından seçilir
  (gümüş fonu gümüş fonuna, altın ağırlıklı fon altın ağırlıklı fona); fon türünün en iyisiyse yalnız
  zayıf uyarısı kalır. Lider adayı: helal, puanlı, riskli bayrağı (helal uyarısı, dönüşüm, strateji kayması,
  şüpheli veri) olmayan, kullanıcının seçebileceği fon.
- **Riskli fon:** tutulan fon helal dışına çıkarsa "çık, yerine aynı türün en iyisi" (beklemesiz, "şimdi
  değil"den etkilenmez); dönüşüm, strateji kayması ya da şüpheli veride uyarı.
- **Yeni fon:** puanı olmayan fon sıralanmaz, önerilmez; tutuluyorsa bilgi verilir.
- **Fon firmaları (kullanıcı ayarı, yalnız telefonda):** kullanıcı fon seçeceği firmaları belirler
  (varsayılan hepsi). Puan tüm BES'e göre kalır; sıra, zayıf, değiştir ve öneri adayları yalnız seçilen
  firmaların fonları arasındadır. Seçilmeyen firmanın tutulan fonu için, puan farkına bakılmadan,
  seçilen firmalardaki aynı türün en iyisine geçiş önerilir (normal öneri, "şimdi değil"le ertelenir).
  Fon listeleri ve ümit vaat edenler hepsini gösterir, seçilmeyenler işaretli.
- **Ümit vaat eden (yalnız bilgi):** geçmişi 12–36 ay arasında, riskli bayrağı olmayan, kullanıcının
  seçebileceği fonlardan ham puanı (kısa geçmiş düzeltmesinden önce) akran grubunda ilk 3'te
  (`promising_top_n`) ya da 70 ve üstünde (`promising_min_raw`) olanlar ayrı listede gösterilir.
  12 aydan kısa geçmişli yeni fonlar aynı yerde "izlemede" durur. Bu liste öneri üretmez.

### 8.3 Öneri

- Önce fon değişiklikleri, sonra dağılım sinyali varsa yeniden dağıtım. Aralık içindeki grupların fonları
  sabit; adaylar mevcut fonlar ve aralık dışındaki sınıflarda, içinde fon tutulmayan her kategorinin 1.'si
  (tutulan fonun yerine geçmek yalnız fon sinyaliyle, eşik farkı aşılınca olur). Amaç fonksiyonu
  Bölüm 7'deki gibi (ücret terimi TEFAS ücretiyle).
- **Durumlar:** "uygulandı" (tüm sözleşmeler yeni dağılımla kaydedilir, sayaçlar sıfırlanır) veya
  "şimdi değil" (aynı tür öneri 20 iş günü gelmez; riskli fon önerileri hariç).
- **Hedefe uzaklık:** `Σ_g max(0, maruziyet_g − hedef_g)`, yönetilen gruplar üzerinden. Dengelemek için
  toplam birikimin yaklaşık bu kadar puanının başka fonlara taşınması gerekir.
- **Sözleşmeler:** kullanıcının birden çok BES sözleşmesi olabilir; her biri numarasıyla ayrı girilir
  (fon kodu, yüzde). Sözleşmelerin toplam birikimdeki payları bir gün itibarıyla yüzde olarak girilir; sonra
  her sözleşme kendi fon fiyatlarıyla kayar ve paylar `pay_c(t) ∝ pay_c(t₀) · V_c(t) / V_c(t₀)` ile güncellenir.
  Toplam fon ağırlığı `Σ_c pay_c(t) · w_(c,f)(t)`. Bant, sayaç ve öneri **toplam** üzerinden hesaplanır;
  öneri tek bir fon dağılımıdır ve tüm sözleşmelere aynı oranlarla uygulanır (karar b, 8 Ekim 2026).
  Fon evreni tüm BES fonlarıdır; öneri şirketten bağımsızdır.
- **Acil uyarı:** sınıfın 20 iş günlük düşüşü `2,5 · σ_yıllık · √(20 / 252)` eşiğini aşarsa.
  İnceleme çağrısıdır, dağılım önerisi değildir.

## 9. Claude desteği

- Faz 1: "Claude'a danış" düğmesi; günün özeti, dağılım, öneri ve parametreleri hazır metin olarak
  kopyalar.
- Faz 2 (isteğe bağlı): günlük iş Claude API ile piyasa yorumu üretir; kişisel veri gönderilmez.

## 10. Kabul testleri (`npm test`)

Ek A'daki 8 fonla, yılbaşı = 9 ay:

1. Basit indis: KJM Ind7 8,61; AGA Ind7 11,86; KJM Ind5 7,96.
2. Bileşik indis: KJM 6,50; AGA 5 yıl aylık eşdeğer bileşik %4,43, basit %20,85.
3. Altın grubu ortak dönem indisi VGA 7,56 · AGA 7,53 · KJM 6,50 · VGD 6,77; dönem sürekliliği
   VGA 6/7 · AGA 6/7 · KJM 1/6 · VGD 1/7; hijyen VGD 0,5. Uzun vade indisi VGA 4,70.
   (2.0'daki 94/87/21/18 puanları yeni puanlama nedeniyle geçersiz.)
4. Mevcut maruziyet: Altın 46,0 · Gümüş 18,9 · TL sabit 3,6 · Yurtiçi hisse 17,3 · Yabancı hisse
   4,8 · Döviz sabit 4,0 · Belirsiz 5,4; ücret 1,39.
5. Önerilen dağılım (VGA 37, KGC 5, VEY 28, AGH 10, KRM 20): Altın 35,5 · Gümüş 4,7 · TL sabit 31,5 ·
   Yurtiçi hisse 16,3 · Yabancı hisse 4,8 · Döviz sabit 4,2 · Belirsiz 3,1; ücret 1,30.
6. Bant (hedef Altın 35, Gümüş 5, TL sabit 30, Yurtiçi hisse 20, Yabancı hisse 10): göreli bantta
   Altın ve Gümüş üstte, TL sabit ve Yabancı hisse altta, Yurtiçi hisse içinde. Sabit ±10 bantta
   Yabancı hisse içinde kalır.

## 11. Değişiklik günlüğü (2.0 → 2.1)

- Fon puanı ham getiri yerine içerikten beklenene göre fazla getiriyle (M1).
- Ind5/Ind7 kalır; uzun vade ve fazla getiri indisleri eklendi (M2).
- Min-max yerine medyan ölçeği (M3).
- Taktik görüş yalnız hedefi kaydırır (M4: A); eğim sürekli (Ö3).
- Göreli bant (M5); oynaklığa göre acil uyarı (M6); risk haftalık getiriyle (M7).
- Kısa geçmiş güveni (Ö1); hedef oynaklığın somut karşılığı (Ö4); dış kıyas serileri (Ö5).
- İki katmanlı çapa, gruplar parametre ve veriden gruplama önerisi (S); çapayı kullanıcı belirler.
- Negatif reel faizde TL sabit uyarısı; döviz sabite aynalı reel faiz kuralı; içerik geçmişiyle
  fazla getiri.
- Hak sayacı, Google Sheet, TL tutar ve XIRR ilk sürümden çıkarıldı. Ledoit-Wolf kapalı (Ö2).
- Çapada olmayan sınıf izlenir (kullanıcı onayladı, 8 Ekim 2026).

### 2.5 → 2.6 (9 Ekim 2026, kullanıcı onayı)

- Fon firmaları ayarı: sıra ve öneri seçilen firmaların fonlarından; seçilmeyen firmanın fonu için
  geçiş önerisi.

### 2.4 → 2.5 (9 Ekim 2026, kullanıcı onayı)

- Akran ailesi: az fonlu kategoriler (gümüş, kıymetli maden, para piyasası) ailesiyle birlikte
  puanlanır ve sıralanır; değiştir önerisi aynı ana sınıftaki en iyi fona gider.
- Ümit vaat eden fonlar listesi (yalnız bilgi) ve izlemedeki yeni fonlar.
- Öneride kategori 1.'si, yalnız içinde fon tutulmayan kategoride aday olur; tutulan fonun yerine
  geçmek yalnız fon sinyaliyle olur.

### 2.3 → 2.4 (9 Ekim 2026, kullanıcı onayı)

- Geçmişten sayma; anında öneri (aralığın k katı ya da P puan); "şimdi değil" bekleme süresi ayrı parametre.
- Fon sinyali: kategorisinde ilk N'de olmayan fon için uyarı; 1.'den ≥ eşik geride ise değiştir önerisi;
  riskli fon uyarısı. Aralıktan ve şirketten bağımsız, tüm BES evreni.
- Fon değiştirme eşiği varsayılanı 20 → 10 puan; öneride ücret terimi etkin.

### 2.2 → 2.3 (8 Ekim 2026, kullanıcı onayı)

- Birden çok sözleşme; toplam üzerinden tek öneri, tüm sözleşmelere aynı oranlar.
- Hedefe uzaklık göstergesi.
- Onaylanan kurallar: grup %5'ten küçükse grup içi pay denetlenmez; önerisi olmayan sınıfın grup içi payı
  çapa taslağında şu anki dağılımdaki orandan alınır; devlet katkısı ve merkezi alacak devri fonları öneriye
  aday olmaz.
- Telefonda uygulanan parametreler uygulamadan değiştirilebilir; her kayıt yeni parametre sürümüdür.

### 2.1 → 2.2 (8 Ekim 2026, kullanıcı onayı)

- Çapa iki katmanlı ağaç: gruplar ve grup içi pay; döviz ayrı grup.
- Görüş yalnız grup hedefini kaydırır; grup içi pay çapadaki gibi kalır.
- Grup içi pay bandı ±10 puan; grup %5'ten küçükse denetlenmez. Öneri grup ya da pay sayacıyla.
- Helal filtresi TEFAS fon türüyle birlikte; kategori önce TEFAS türünden; ücret ve azami gider TEFAS'tan.
