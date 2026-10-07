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
5. **Gizli bilgiler.** GitHub Secrets: `EVDS_API_KEY`, `FRED_API_KEY`; ileride `ANTHROPIC_API_KEY`.

Depoda kişisel veri yok; bu yüzden depo herkese açık ve GitHub Pages ücretsiz çalışır.

## Bilinen riskler

- **TEFAS erişimi.** Actions makineleri yurt dışında. İlk iş `tools/probe.py` ile ölçülür.
  Kapalıysa B planı: telefondan çağrılan küçük bir Cloudflare Worker aracısı; telefon Türkiye'de
  olduğu için istek büyük olasılıkla İstanbul'daki Cloudflare noktasından gider. Hesap telefona taşınır.
- **Actions zamanlaması garanti değil.** Kartta veri tarihi ve çalışma saati her zaman görünür.
- **Telefondaki veri.** Ana ekrana eklenen uygulamada düzenli kullanımda veriler korunur;
  yine de JSON yedek önerilir.
