# maliSK modeli — sürüm 2.1

**Tarih:** 7 Ekim 2026 · **Sahibi:** Seyfettin · Kaynak: BES Fon Danışmanı spesifikasyonu 2.0
ve 7 Ekim 2026 tarihli model görüşmesindeki kararlar (en altta değişiklik günlüğü).

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

1. Riskli sınıfların son 3 yıllık **haftalık** getirilerinden yıllık kovaryans `Σ`.
   Ledoit-Wolf küçültmesi parametredir, ilk sürümde kapalı.
2. **İki katmanlı eşit risk:** önce grup içinde, sonra gruplar arasında her biri eşit risk katkısı:
   `RK_i = w_i · (Σ w)_i / √(wᵀ Σ w)`. Varsayılan gruplar: Koruma (Altın, Gümüş, Döviz sabit),
   Büyüme (Yurtiçi hisse, Yabancı hisse). Gruplar parametredir.
3. **Gruplama önerisi:** korelasyondan uzaklık `√((1 − ρ) / 2)` ile ortalama bağlantılı kümeleme.
   Ekranda düz, kullanıcının gruplaması ve önerilen gruplamaya göre çapa yan yana gösterilir.
4. **Hedef oynaklık:** `k = min(1, σ_hedef / σ_riskli)`; riskli ağırlıklar × k; TL sabit = 1 − k.
   Varsayılan %12. Ekranda geçmiş veride bu ayarın en büyük düşüşü, en kötü 12 aylık reel getirisi
   ve TL sabit payı gösterilir.
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
- **Eğim (sürekli):** `eğim = 5 · max(−1, min(1, S / 0,5))` puan. Görüş etiketi: S ≥ 0,40 Olumlu,
  S ≤ −0,25 Olumsuz, arası Nötr.
- **Hedef:** `çapa + eğim`; negatif hedef 0'a çekilir, toplam 100'e ölçeklenir.
- **İzlenen sınıf (kullanıcı onayı bekliyor):** çapada değeri olmayan sınıfın hedefi ve bandı yoktur; öneri mevcut
  payını korur. Yönetilen sınıfların hedefleri `100 − izlenen sınıfların mevcut payı`na ölçeklenir. Uygulamanın çapa
  önerisi yalnız yeterli verisi olan sınıfları içerdiği için gerekli; aksi hâlde verisi olmayan sınıfın hedefi 0 olurdu.
- **Görüş öneri üretmez (karar: A).** Görüş yalnız hedefi kaydırır; öneriyi bant aşımı tetikler.

## 6. Katman 2 — fon puanı

Akran grubu kategoridir. En az 12 aylık geçmiş gerekir; daha kısa fon "Yeni fon" olur,
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
- Aday: her kategoriden en yüksek puanlı fon + mevcut fonlar.
- Tam sayı yüzdeye en büyük kalan yöntemiyle yuvarlanır.
- Hedefinden 3 puandan fazla uzak kalan sınıf için "Uygun araç yok".

## 8. Katman 4 — karar

- **Göreli bant:** genişlik = hedefin %25'i, en az 3, en çok 10 puan; alt sınır 0'ın altına inmez.
- **Sayaç:** bant dışındaki sınıfın sayacı her iş günü +1; içeri dönünce 0.
- **Öneri:** bir sayaç 20 iş gününe ulaşınca. Bant içindeki sınıfların fonları sabit kalır;
  mevcut fon, aynı kategorideki adayla ancak puan farkı ≥ 20 ise değiştirilir.
- **Durumlar:** aktif → kullanıcı "uygulandı" (yeni dağılımı girer, sayaçlar sıfırlanır) veya
  "reddedildi" (sayaçlar sıfırlanır, aynı öneri 20 iş günü tekrarlanmaz).
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
- Çapada olmayan sınıf izlenir (onay bekliyor).
- Helal filtresi TEFAS fon türüyle birlikte; kategori önce TEFAS türünden; ücret ve azami gider TEFAS'tan.
