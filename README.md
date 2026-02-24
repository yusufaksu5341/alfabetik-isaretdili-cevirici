# TİD Çevirici - Türk İşaret Dili Harf Tanıma Uygulaması

> **Yapay Zeka Destekli Türk İşaret Dili Parmak Alfabesi Tanıma Sistemi**

Roboflow AI kullanarak gerçek zamanlı web kamerası ile Türk İşaret Dili (TİD) parmak alfabesi harflerini tanıyan ve sesli olarak okuyan bir web uygulaması.

## Özellikler

- **Gerçek Zamanlı Harf Tanıma** - Web kamerası ile canlı olarak TİD harfleri algılama
- **AI Destekli** - Roboflow Custom Model kullanarak %95+ doğruluk
- **Sesli Okuma** - Oluşturulan kelimeler Türkçe sesli olarak okunabilir
- **Kelime Oluşturma** - Harfleri biriktirebilir ve kelime listesi oluşturabilir
- **Interaktif Arayüz** - Modern ve kullanıcı dostu tasarım
- **Offline Desteği** - Tarayıcıda çalışır, ek kurulum gerekmez
- **Responsive Tasarım** - Masaüstü, tablet ve mobil uyumlu

## Sistem Gereksinmeleri

- Modern web tarayıcısı (Chrome, Firefox, Safari, Edge)
- Web kamerası erişimi
- İnternet bağlantısı (Roboflow API için)

## Kurulum

### 1. Dosyaları İndirme

```bash
git clone https://github.com/yusufaksu5341/alfabetik-isaretdili-cevirici.git
cd alfabetik-isaretdili-cevirici
```

### 2. Yerel Sunucu Başlatma

Python kullanarak:

```bash
# Python 3.x
python -m http.server 8000

# veya Python 2.x
python -m SimpleHTTPServer 8000
```

Node.js kullanarak:

```bash
npx http-server -p 8000
```

PHP kullanarak:

```bash
php -S localhost:8000
```

### 3. Tarayıcıda Açma

```
http://localhost:8000
```

## Kullanım

### Temel Adımlar

1. **Kamerayı Etkinleştirme**
   - Uygulama açıldığında kamera erişim izni verin
   - Başarıyla başladığında "Hazır" durumu gösterilir

2. **Harf Tanıması**
   - Elinizi kameraya gösterin
   - İstediğiniz TİD harfini yapın
   - Halka dolana kadar (1.5 saniye) harfi sabit tutun
   - Harfin otomatik olarak onaylandığını göreceksiniz

3. **Kelime Oluşturma**
   - Harfleri birikmeye başlar
   - "Kelime Ekle" butonuna tıklayın veya BOŞLUK tuşuna basın
   - Kelime listeye eklenir

4. **Sesli Okuma**
   - "Sesli Oku" butonuna tıklayın
   - Tüm kelimeler Türkçe sesle okunur
   - Enter tuşu da aynı işlevi görür

### Klavye Kısayolları

| Tuş | İşlev |
|-----|-------|
| **BOŞLUK** | Kelime Ekle |
| **Backspace** | Son karakteri sil |
| **Enter** | Sesli Oku |
| **P** | Kamerayı Duraklat/Devam Et |

## Proje Yapısı

```
alfabetik-isaretdili-cevirici/
├── index.html          # Ana HTML dosyası
├── styles.css          # CSS stil tanımlamaları
├── script.js           # JavaScript mantık ve işlev
├── README.md           # Proje dokümantasyonu
└── docs/              # Ek dokümantasyon
```

## Teknoloji Yığını

- **Frontend:** HTML5, CSS3, Vanilla JavaScript
- **AI/ML:** Roboflow Custom Vision Model
- **API:** Roboflow Serverless API
- **Media:** Web API (getUserMedia, Canvas, Speech Synthesis)

## API Entegrasyonu

### Roboflow API

Uygulama, Roboflow'un özel olarak eğitilmiş `harfler-ve-kelimeler/1` modelini kullanır.

**Özellikler:**
- Türkçe TİD 29 harfinin tanınması
- Gerçek zamanlı yüksek hızlı tahmin
- Güvenlik skoru geri dönüşü

```javascript
// API isteği yapısı
const response = await fetch(`https://serverless.roboflow.com/${model}?api_key=${apiKey}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: base64EncodedImage
});
```

## Performans Başarı Oranları

| Metrik | Değer |
|--------|-------|
| Model Doğruluğu | %95+ |
| İşlem Hızı | 200ms throttle |
| FPS Hedefi | 30-60 |
| Güven Eşiği | %45+ |

## Dosya Açıklaması

### `index.html`
- Uygulamanın ana HTML yapısı
- Kamera, alfabe grid, kontrol butonları gibi UI öğeleri
- Bağlantılar: styles.css ve script.js

### `styles.css`
- Tüm stil tanımlamaları
- Renkler, animasyonlar, responsive tasarım
- CSS değişkenleri (CSS Custom Properties) kullanımı
- Responsive breaking point: 820px

### `script.js`
- Ana JavaScript mantığı
- Kamera yönetimi ve stream işleme
- Roboflow API entegrasyonu
- Harf tanıma ve tutma zamanlayıcısı
- UI güncellemeleri
- Ses sentezi (Text-to-Speech)

## Konfigürasyon

`script.js` içinde önemli değişkenler:

```javascript
const RF_API_KEY = 'p6t4i9gco8ZGaA3Y1i26';      // Roboflow API anahtarı
const RF_MODEL = 'harfler-ve-kelimeler/1';    // Model adı
const HOLD_MS = 1500;                         // Onay için tutulacak süre (ms)
const INFER_MS = 200;                         // API istek aralığı (ms)
const CONF_THRESH = 0.45;                     // Minimum güven eşiği
```

## Sorun Giderme

### Kamera Açılmıyor
- **Çözüm:** Tarayıcı izinlerini kontrol edin (Site Ayarları → Kamera)
- HTTPS veya localhost kullanıldığından emin olun
- Farklı tarayıcı deneyin

### Harfler Tanınmıyor
- **Çözüm:** Aydınlatmayı iyileştirin
- Elinizi 30-60 cm uzaktan tutun
- Harfi net bir şekilde yapın
- Güven eşiği kontrol edilir

### API Hatası
- **Çözüm:** İnternet bağlantısını kontrol edin
- API anahtarının geçerli olduğundan emin olun
- Roboflow modelinin açık olduğundan emin olun

## Güvenlik Notları

- API anahtarı client-side'da olduğu için test ortamında kullanın
- Production için backend proxy kullanın
- Kamera verisi lokal olarak işlenir, sunucuya kaydedilmez

## Performans İpuçları

1. **Aydınlatma:** İyi aydınlatmaya sahip ortamda çalışın
2. **Mesafe:** Elinizi 30-60 cm uzakta tutun
3. **Harfin Netliği:** Harfleri net ve sabit yapın
4. **İnternet Hızı:** Kararlı bağlantı kullanın

## Gelecek Geliştirmeler

- [ ] Cümle oluşturma önerileri
- [ ] Harfi tanınan kelimed çeviri
- [ ] Yerel depolama (localStorage) desteği
- [ ] Gelişmiş istatistikler ve tarihe
- [ ] Birden fazla dil desteği
- [ ] Hareket tanıma (gesture recognition)

## Katkıda Bulunma

Katkılarınız hoş geldiniz! Lütfen:

1. Fork yapın
2. Feature branch oluşturun (`git checkout -b feature/AmazingFeature`)
3. Değişiklikleri commit yapın (`git commit -m 'Add some AmazingFeature'`)
4. Branch'e push yapın (`git push origin feature/AmazingFeature`)
5. Pull Request açın

## Lisans

Bu proje MIT Lisansı altında lisanslanmıştır - detaylar için [LICENSE](LICENSE) dosyasına bakın.

## İletişim

Yusuf Aksu
- GitHub: [@yusufaksu5341](https://github.com/yusufaksu5341)
- E-posta: [İletişim bilgisi]

## Teşekkürler

- [Roboflow](https://roboflow.com) - AI Model Training ve Deployment
- TİD Kullanıcı Topluluğu
- Tüm katkıda bulunanlar

## Referanslar

- [Türk İşaret Dili Alfabesi](https://www.dilimiz.org)
- [Roboflow Documentation](https://docs.roboflow.com)
- [Web APIs - MDN](https://developer.mozilla.org/en-US/docs/Web/API)
- [Canvas API](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API)

---

**Not:** Bu uygulama eğitim amacıyla tasarlanmış ve belirtilen Roboflow modelini gerektirir.
