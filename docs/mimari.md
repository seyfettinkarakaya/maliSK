# Mimari

Kullanıcı kararı, 7 Ekim 2026: sunucusuz, Drive ve Google Sheet yok, ilk aşama YüzmeSK'ya benzer
sadelikte. Dağılım yüzde olarak telefonda girilir; gerçek birikim tutarı tutulmaz.

## Bileşenler

1. **Model çekirdeği (`src/model/`).** Saf JavaScript modülleri. Aynı kod GitHub Actions'ta
   (Node 22) ve telefonda çalışır. Böylece TEFAS'ın GitHub makinelerine kapalı çıkması
   durumunda hesap telefona taşınabilir.
2. **Günlük iş (GitHub Actions).** Hafta içi 07:30, 08:00 ve 08:30 UTC (10:30, 11:00, 11:30
   İstanbul). O günün başarılı çalışması varsa sonraki tetiklemeler hiçbir şey yapmadan çıkar.
   - TEFAS: emeklilik fonlarının (`EMK`) fiyat, pay, kişi sayısı, büyüklük ve içerik dağılımı.
   - EVDS ve FRED: anahtar tanımlıysa.
   - Piyasa tarafı hesaplar: helal filtresi, kategori, sınıf serileri, trend, makro, fon puanları,
     çapa önerisi, gruplama önerisi, sınıf oynaklıkları.
   - Çıktı: `data/latest.json` (telefonun okuduğu özet) ve `data/history/` (tarihli, yalnız eklenen).
3. **Telefon uygulaması (PWA, GitHub Pages).** Vanilla HTML/CSS/JS, derleme adımı yok.
   - Kullanıcının dağılımı, çapası, görüşleri ve parametre sürümleri `localStorage`'da;
     JSON yedek alınır ve geri yüklenir.
   - Kişisel hesaplar telefonda: kayan ağırlıklar, maruziyet, bant, sayaçlar, eylem önerisi.
   - "Claude'a danış": günün özetini ve dağılımı hazır bir metin olarak kopyalar.
4. **Bildirim.** İlk aşamada ana sayfanın üstünde kart. iPhone bildirimi sonraki aşamada.
5. **Gizli bilgiler.** GitHub Secrets: `EVDS_KEY`, `FRED_API_KEY`, `ALPHAVANTAGE_KEY`, `MALISK_PUSH`; ileride `ANTHROPIC_API_KEY`.

Depoda kişisel veri yok; bu yüzden depo herkese açık ve GitHub Pages ücretsiz çalışır.

## Bilinen riskler

- **TEFAS erişimi.** Actions makineleri yurt dışında. İlk iş `tools/probe.py` ile ölçülür.
  Kapalıysa B planı: telefondan çağrılan küçük bir Cloudflare Worker aracısı; telefon Türkiye'de
  olduğu için istek büyük olasılıkla İstanbul'daki Cloudflare noktasından gider. Hesap telefona taşınır.
- **Actions zamanlaması garanti değil.** Kartta veri tarihi ve çalışma saati her zaman görünür.
- **Telefondaki veri.** Ana ekrana eklenen uygulamada düzenli kullanımda veriler korunur;
  yine de JSON yedek önerilir.

## Bildirim (Web Push)

- Telefonda Ayarlar → Bildirimler açılınca uygulama bir P-256 anahtar çifti üretir, Web Push aboneliği
  açar ve "bildirim anahtarı"nı (abonelik + özel anahtar) gösterir. Kullanıcı bunu GitHub'da
  Settings → Secrets and variables → Actions → `MALISK_PUSH` olarak bir kez ekler. Anahtar depoya,
  koda ya da loglara yazılmaz.
- Günlük iş yeni veri hesapladığında `src/pipeline/push.mjs` sitenin güncellenmesini bekler ve telefona
  şifreli (aes128gcm, VAPID) kısa bir sinyal gönderir. Sinyalde kişisel veri yoktur.
- `sw.js` sinyal gelince güncel `latest.json`'u indirir, kişisel durumu IndexedDB kopyasından okur ve
  bildirimi `src/app/engine.mjs` ile telefonda hesaplar. Dağılım telefondan çıkmaz.
- Kapatınca abonelik iptal edilir; sonraki gönderim 404/410 alır ve atlanır.

## Piyasa verisi katmanı (19 Ekim 2026)

BES'ten bağımsızdır; ileride BES dışı portföy de aynı veriyi kullanır.

- **Katalog** (`src/data/market/catalog.mjs`): her seri için kimlik, sınıf, rol (ana piyasa, helal,
  makro), sıklık ve öncelik sırasıyla kaynaklar.
- **Kaynaklar** (`src/data/market/providers.mjs`): EVDS 3 (anahtar başlıkta, yönlendirme izlenmez,
  1000 satırlık pencereler), FRED, Alpha Vantage (altın, gümüş, kur yedeği), TCMB günlük kur dosyası
  (anahtarsız yedek), Borsa İstanbul ve İş Yatırım endeks uçları (gayriresmî), MSCI endeks ucu
  (gayriresmî). Yahoo GitHub makinelerine 429 döndürdüğü için kullanılmaz; S&P DJI 403.
- **Yedek sırası ve ölçek denetimi:** ilk kaynak hata verir ya da boş dönerse sıradaki denenir.
  Yedeğin değeri kayıtlı seriyle örtüşen günlerde %2'den fazla farklıysa (ölçek farkı) reddedilir.
- **Depo:** `data/market/<seri>.csv` (`date,value,source`). GitHub CSV'yi tablo olarak gösterir;
  her satırın kaynağı yazılıdır, geçmişi git tutar. `data/market/status.json`: ilk ve son tarih,
  satır sayısı, kullanılan kaynak, hatalar, bayatlık.
- **Çalışma:** günlük iş akışında TEFAS'tan önce (hata TEFAS'ı durdurmaz); ilk yükleme ve onarım için
  elle çalışan "Piyasa verisi" iş akışı (`backfill`, `only`).
- **Drive/Sheets kullanılmaz** (7 Ekim kararı sürer): veri herkese açık depoda CSV olarak durur;
  telefon ve GitHub Pages doğrudan okur, ek anahtar ve kota gerekmez.
