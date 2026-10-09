# Claude Code için çalışma kuralları — maliSK

Model: `docs/model.md` (sürüm 2.6). Mimari: `docs/mimari.md`.

- `docs/model.md`'deki formüller modelin kendisidir; değiştirmeden önce kullanıcıya sor.
- Hiçbir ağırlık, eşik, süre veya oran koda gömülmez; hepsi `src/model/params.mjs`'den okunur.
- Her hesap sonucu, hangi parametre sürümüyle ve hangi veri tarihiyle üretildiğini kaydeder.
- Arayüz dili Türkçe. Veri alanları, parametreler ve sınıf kimlikleri İngilizce `snake_case`.
- Model kodu (`src/model/`) saf JavaScript modülleridir: hem GitHub Actions'ta (Node) hem telefonda çalışır; DOM veya ağ erişimi içermez.
- Bir aşama, ilgili kabul testleri (`npm test`) geçmeden tamamlanmış sayılmaz.
- Arayüzdeki her hesaplanmış sayı, dokununca formülünü ve girdilerini gösterir.
- Kullanıcının dağılımı yalnız telefonda durur; depoya kişisel veri yazılmaz.
- Anahtarlar yalnızca GitHub Secrets'ta; koda, depoya veya loglara yazılmaz.
- Kullanıcı tercihi: tablo, görsel gibi çok token harcayan bir çıktı üretmeden önce onay al.
