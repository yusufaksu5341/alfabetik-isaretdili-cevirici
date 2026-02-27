/* ═══════════════════════════════════════════
   TİD Çevirici - JavaScript Logığı
   Türk İşaret Dili - Harf Tanıma Uygulaması
   ═══════════════════════════════════════════ */

'use strict';

// ───────────────────────────────────────
// KONFİGÜRASYON
// ───────────────────────────────────────

/** Roboflow API anahtarı */
const RF_API_KEY = 'p6t4i9gco8ZGaA3Y1i26';

/** Roboflow modeli bilgisi */
const RF_MODEL = 'harfler-ve-kelimeler/1';

/** Roboflow API URL endpoint */
const RF_URL = `https://serverless.roboflow.com/${RF_MODEL}?api_key=${RF_API_KEY}`;

/** Harfin onaylanması için tutulması gereken süre (milisaniye) */
const HOLD_MS = 1500;

/** Roboflow API'ye istek atma aralığı - daha hızlı tahmin için 100ms */
const INFER_MS = 100;

/** Minimum güven skoru eşiği */
const CONF_THRESH = 0.45;

/**
 * Algılama bölgesi - piksel koordinat oranları (sol piksel = sağ görsel, mirror nedeniyle)
 * xR/yR: sol-üst köşe, wR/hR: genişlik/yükseklik (oransal)
 */
const ZONE = { xR: 0.04, yR: 0.10, wR: 0.42, hR: 0.80 };

// ───────────────────────────────────────
// TİD ALFABESI - Türkçe harfler
// ───────────────────────────────────────

const TID_LETTERS = [
  'A', 'B', 'C', 'Ç', 'D', 'E', 'F', 'G', 'Ğ', 'H',
  'I', 'İ', 'J', 'K', 'L', 'M', 'N', 'O', 'Ö', 'P',
  'R', 'S', 'Ş', 'T', 'U', 'Ü', 'V', 'Y', 'Z'
];

// ───────────────────────────────────────
// DURUM YÖNETİMİ
// ───────────────────────────────────────

/** Oluşturulan kelimeyi tutar */
let word = '';

/** Oluşturulan kelimeler listesi */
let words = [];

/** Son algılanan harf */
let lastGest = null;

/** Harfin tutulma başlama zamanı */
let holdT = null;

/** Harfin kilitli olup olmadığı (onaylandı mı) */
let locked = false;

/** Uygulamanın duraklatılıp duraklatılmadığı */
let paused = false;

/** Son API isteğinin zamanı */
let lastInferTime = 0;

/** API isteğinin beklemede olup olmadığı */
let inferPending = false;

/** FPS sayacı */
let fpsCounter = 0;

/** Son FPS güncelleme zamanı */
let fpsLast = Date.now();

/** Güncel FPS değeri */
let currentFps = 0;

/** Son gösterilen harf (updateUI optimizasyonu için) */
let lastDisplayedLetter = null;

/** Son gösterilen güven değeri */
let lastDisplayedConf = null;

/** Reusable resize canvas (her frame'de yenisini yaratma) */
let resizeCanvas = null;

/** Reusable resize context */
let resizeCtx = null;

/** Model input boyutu - Roboflow modeli 416 ile eğitildi */
const MODEL_SIZE = 416;

/** Sık kullanılan DOM elements cache'i */
const elemCache = {};

// ───────────────────────────────────────
// ALFABE GRİDİ OLUŞTURMA
// ───────────────────────────────────────

/**
 * Harf parmak alfabesi grid'ini DOM'da oluşturur
 */
function buildAlpha() {
  const grid = document.getElementById('agrid');
  
  // Harfler listesinin uzunluğu
  document.getElementById('scnt').textContent = TID_LETTERS.length + ' harf';
  
  // Her harf için bir tile oluştur
  TID_LETTERS.forEach(letter => {
    const tile = document.createElement('div');
    tile.className = 'at on';
    tile.id = 'tile-' + letter;
    tile.innerHTML = `<span class="atl">${letter}</span><span class="adot"></span>`;
    grid.appendChild(tile);
  });
}

// ───────────────────────────────────────
// KAMERA YÖNETİMİ
// ───────────────────────────────────────

/**
 * Web kamerasını başlatır ve <video> elementine bağlar
 * @returns {Promise<void>}
 */
async function startCam() {
  const video = document.getElementById('video');
  
  // Reusable resize canvas'ı önceden hazırla
  if (!resizeCanvas) {
    resizeCanvas = document.createElement('canvas');
    resizeCanvas.width = resizeCanvas.height = MODEL_SIZE;
    resizeCtx = resizeCanvas.getContext('2d');
  }
  
  // Sık kullanılan DOM elements'ı cache et
  if (!elemCache['video']) {
    elemCache['video'] = document.getElementById('video');
    elemCache['canvas'] = document.getElementById('canvas');
    elemCache['bboxCanvas'] = document.getElementById('bboxCanvas');
    elemCache['camLetter'] = document.getElementById('camLetter');
    elemCache['lbig'] = document.getElementById('lbig');
    elemCache['cb2'] = document.getElementById('cb2');
    elemCache['cpct'] = document.getElementById('cpct');
    elemCache['ccf'] = document.getElementById('ccf');
    elemCache['ccv'] = document.getElementById('ccv');
    elemCache['lname'] = document.getElementById('lname');
    elemCache['holdArc'] = document.getElementById('holdArc');
    elemCache['holdRing'] = document.getElementById('holdRing');
    elemCache['hcd'] = document.getElementById('hcd');
    elemCache['fpsBadge'] = document.getElementById('fpsBadge');
    elemCache['pill'] = document.getElementById('pill');
    elemCache['clt'] = document.getElementById('clt');
    // Canvas context'lerini bir kere cache et
    elemCache['ctx'] = elemCache['canvas'].getContext('2d');
    elemCache['bboxCtx'] = elemCache['bboxCanvas'].getContext('2d', { willReadFrequently: false });
  }
  
  // Kullanıcının kamerasına erişim talep et
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
    audio: false
  });
  
  video.srcObject = stream;
  
  // Video tamamen yüklenmesini bekle
  return new Promise(resolve => {
    video.onloadedmetadata = () => {
      video.play();
      resolve();
    };
  });
}

// ───────────────────────────────────────
// İNİSYALİZASYON
// ───────────────────────────────────────

/**
 * Uygulamayı başlatır
 */
async function init() {
  buildAlpha();
  
  try {
    // Kamerayı başlat
    await startCam();
    
    // Yükleme göstergesi kaldır
    const camLoad = document.getElementById('camLoad');
    if (camLoad) camLoad.style.display = 'none';
    
    // Durum bilgisini güncelle
    setStatus('ready', 'Hazır — el gösterin');
    toast('Kamera hazır!', 'success');
    
    // Ana loop başlat
    loop();
  } catch (error) {
    // Hata durumunda mesaj göster
    setStatus('error', 'Kamera hatası');
    document.getElementById('clt').textContent = 'Kamera erişimi reddedildi: ' + error.message;
  }
}

// ───────────────────────────────────────
// ANA LOOP - Video İçerişi İşleme
// ───────────────────────────────────────

/**
 * Ana işleme loop - her frame'de çalışır
 * FPS hesaplaması ve API throttling yapar
 */
function loop() {
  if (!paused) {
    const now = Date.now();
    
    // FPS sayacı güncelle
    fpsCounter++;
    if (now - fpsLast >= 1000) {
      currentFps = fpsCounter;
      fpsCounter = 0;
      fpsLast = now;
      if (elemCache['fpsBadge']) {
        elemCache['fpsBadge'].textContent = currentFps + ' FPS';
      }
    }
    
    // Roboflow API isteği (throttled)
    if (now - lastInferTime >= INFER_MS && !inferPending) {
      lastInferTime = now;
      inferFrame();
    }
  }
  
  requestAnimationFrame(loop);
}

/**
 * Video frame'ini Roboflow API'ye göndererek harf tanıması yap
 */
async function inferFrame() {
  inferPending = true;

  const video = elemCache['video'];
  const canvas = elemCache['canvas'];
  const ctx = elemCache['ctx'];

  const vw = video.videoWidth || 640;
  const vh = video.videoHeight || 480;

  // Canvas boyutlarını sadece değişince güncelle
  if (canvas.width !== vw || canvas.height !== vh) {
    canvas.width = vw;
    canvas.height = vh;
    const bboxCanvas = elemCache['bboxCanvas'];
    bboxCanvas.width = vw;
    bboxCanvas.height = vh;
  }

  ctx.drawImage(video, 0, 0);

  // Algılama bölgesini hesapla (piksel koordinatları)
  const zone = {
    x: Math.round(ZONE.xR * vw),
    y: Math.round(ZONE.yR * vh),
    w: Math.round(ZONE.wR * vw),
    h: Math.round(ZONE.hR * vh)
  };

  // Tam frame'i MODEL_SIZE'a ölçekle (crop etme — model accuracy için full frame gönder)
  resizeCtx.drawImage(canvas, 0, 0, vw, vh, 0, 0, MODEL_SIZE, MODEL_SIZE);

  // Base64 JPEG'e çevir - kalite 0.82 (yeterli detay, model doğruluğu için)
  const base64 = resizeCanvas.toDataURL('image/jpeg', 0.82).split(',')[1];

  try {
    // Roboflow API'ye POST isteği gönder
    const response = await fetch(RF_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: base64
    });

    const data = await response.json();

    // Tahminleri işle
    handlePredictions(data, vw, vh, zone);
  } catch (error) {
    setStatus('error', 'API hatası');
  }
  
  inferPending = false;
}

// ───────────────────────────────────────
// ROBOFLOW CEVABI İŞLEME
// ───────────────────────────────────────

/**
 * Roboflow API tarafından döndürülen tahmimi işler
 * @param {Object} data - API tarafından gelen veri
 * @param {number} vw - Video genişliği
 * @param {number} vh - Video yüksekliği
 */
function handlePredictions(data, vw, vh, zone) {
  const ctx = elemCache['bboxCtx'];

  // Canvas temizle (boyutu sıfırlamadan - çok daha hızlı)
  ctx.clearRect(0, 0, vw, vh);

  // Algılama bölgesi çerçevesini her zaman çiz
  drawZoneBorder(ctx, zone);

  const predictions = data.predictions || [];

  if (!predictions.length) {
    resetHold();
    updateUI('—', 0);
    return;
  }

  // Güven eşiğini geç + merkezi zone içinde olan tahminler
  const best = predictions
    .filter(p => p.confidence >= CONF_THRESH)
    .filter(p => {
      // Bbox merkezini tam frame koordinatlarına çevir
      const cx = p.x <= 1 ? p.x * vw : (p.x / MODEL_SIZE) * vw;
      const cy = p.y <= 1 ? p.y * vh : (p.y / MODEL_SIZE) * vh;
      return cx >= zone.x && cx <= zone.x + zone.w &&
             cy >= zone.y && cy <= zone.y + zone.h;
    })
    .sort((a, b) => b.confidence - a.confidence)[0];

  if (!best) {
    resetHold();
    updateUI('—', 0);
    return;
  }

  const letter = (best.class || '').toUpperCase();
  const confidence = best.confidence;

  // Sınırlayıcı kutuyu çiz (tam frame koordinatları)
  drawBBox(ctx, best, vw, vh, letter, confidence);

  // UI'ı güncelle (şartlı - aynı değerse yapma)
  updateUI(letter, confidence);

  // Tutma zamanlayıcısı mantığı
  if (letter !== lastGest) {
    // Yeni harf algılandı
    lastGest = letter;
    holdT = Date.now();
    locked = false;
    setRing(0);
    highlightTile(letter);
    return;
  }
  
  if (!locked) {
    // Harfin tutulduğu süreyi hesapla
    const progress = Math.min((Date.now() - holdT) / HOLD_MS, 1);
    setRing(progress);
    
    // Harfin tutma süresi doldu mu?
    if (progress >= 1) {
      confirmLetter(letter);
    }
  }
}

// ───────────────────────────────────────
// SINIRLAYICI KUTU ÇİZİMİ
// ───────────────────────────────────────

/**
 * Algılama bölgesinin çerçevesini çizer
 * @param {CanvasRenderingContext2D} ctx
 * @param {{x,y,w,h}} zone - Piksel koordinatları
 */
function drawZoneBorder(ctx, zone) {
  ctx.save();
  ctx.strokeStyle = 'rgba(56,189,248,0.70)';
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 5]);
  ctx.strokeRect(zone.x, zone.y, zone.w, zone.h);
  ctx.setLineDash([]);
  ctx.font = 'bold 10px JetBrains Mono, monospace';
  ctx.fillStyle = 'rgba(56,189,248,0.60)';
  ctx.fillText('ALGILAMA', zone.x + 7, zone.y + 14);
  ctx.restore();
}

/**
 * Tespit edilen harfin etrafında sınırlayıcı kutu çizer
 * Koordinatları MODEL_SIZE'dan tam kare boyutuna çevirir
 * @param {CanvasRenderingContext2D} ctx - Canvas bağlamı
 * @param {Object} pred - Tahmin nesnesi
 * @param {number} vw - Video genişliği
 * @param {number} vh - Video yüksekliği
 * @param {string} letter - Harfin adı
 * @param {number} conf - Güven skoru
 */
function drawBBox(ctx, pred, vw, vh, letter, conf) {
  let cx, cy, bw, bh;

  if (pred.x <= 1 && pred.y <= 1) {
    // Normalize edilmiş koordinatlar (0-1 arası)
    cx = pred.x * vw;
    cy = pred.y * vh;
    bw = pred.width * vw;
    bh = pred.height * vh;
  } else {
    // Piksel koordinatları (MODEL_SIZE uzayı) → tam frame
    cx = (pred.x / MODEL_SIZE) * vw;
    cy = (pred.y / MODEL_SIZE) * vh;
    bw = (pred.width / MODEL_SIZE) * vw;
    bh = (pred.height / MODEL_SIZE) * vh;
  }

  const x0 = cx - bw / 2;
  const y0 = cy - bh / 2;
  const alpha = 0.5 + conf * 0.5;

  ctx.save();
  ctx.strokeStyle = `rgba(56,189,248,${alpha})`;
  ctx.lineWidth = 2;
  ctx.strokeRect(x0, y0, bw, bh);

  // Etiket rozetesi
  const label = `${letter}  ${Math.round(conf * 100)}%`;
  ctx.font = 'bold 13px JetBrains Mono, monospace';
  const textWidth = ctx.measureText(label).width;
  const padX = 8;

  ctx.fillStyle = 'rgba(8,15,31,.88)';
  ctx.fillRect(x0, y0 - 28, textWidth + padX * 2, 22);

  ctx.fillStyle = 'rgba(56,189,248,.95)';
  ctx.fillText(label, x0 + padX, y0 - 11);
  ctx.restore();
}

// ───────────────────────────────────────
// HARF ONAYI
// ───────────────────────────────────────

/**
 * Harfin tutma süresi dolduğunda çalışır - harfi kelimeye ekler
 * @param {string} letter - Onaylanan harf
 */
function confirmLetter(letter) {
  locked = true;
  word += letter;
  setRing(0);
  
  // Onay animasyonu
  const element = document.getElementById('camLetter');
  element.classList.remove('ok');
  // Reflow trigger
  void element.offsetWidth;
  element.classList.add('ok');
  
  // UI güncelle
  renderWord();
  toast(`"${letter}" onaylandı`, 'info');
}

/**
 * Tutma durumunu sıfırla
 */
function resetHold() {
  lastGest = null;
  holdT = null;
  locked = false;
  setRing(0);
}

// ───────────────────────────────────────
// UI GÜNCELLEMELERİ
// ───────────────────────────────────────

/**
 * UI öğelerini algılanan harf ve güven skoru ile günceller (şartlı)
 * @param {string} letter - Algılanan harf
 * @param {number} conf - Güven skoru (0-1)
 */
function updateUI(letter, conf) {
  // Aynı değerler geliyorsa güncelleme yapma
  if (letter === lastDisplayedLetter && conf === lastDisplayedConf) {
    return;
  }
  
  lastDisplayedLetter = letter;
  lastDisplayedConf = conf;
  
  const percent = Math.round(Math.min(Math.max(conf, 0), 1) * 100);
  
  elemCache['camLetter'].textContent = letter;
  elemCache['lbig'].textContent = letter;
  elemCache['cb2'].style.width = percent + '%';
  elemCache['cpct'].textContent = letter !== '—' ? percent + '%' : '—';
  elemCache['ccf'].style.width = percent + '%';
  elemCache['ccv'].textContent = letter !== '—' ? percent + '%' : '—';
  elemCache['lname'].textContent = letter === '—'
    ? 'El bekleniyor…'
    : `TİD "${letter}" — %${percent} güven`;
}

/**
 * Tutma halkasını ilerleme yüzdesine göre günceller
 * @param {number} prog - İlerleme (0-1)
 */
function setRing(prog) {
  const circumference = 110;
  const offset = circumference - circumference * prog;
  elemCache['holdArc'].setAttribute('stroke-dashoffset', offset);
  elemCache['holdRing'].style.display = prog > 0 ? 'block' : 'none';
  
  // Kalan zaman göster
  elemCache['hcd'].innerHTML = prog > 0
    ? `Onaylanıyor… <span>${((1 - prog) * HOLD_MS / 1000).toFixed(1)}s</span>`
    : `Harfi <span>1.5 sn</span> sabit tutun`;
}

/** Sonuncu vurgulanan harf tile'ı */
let lastHighlight = null;

/**
 * Geçmişte vurgulanan harfi kaldırıp yeni harfi vurgular
 * @param {string|null} letter - Vurgulanan harf
 */
function highlightTile(letter) {
  if (lastHighlight) {
    const prevTile = document.getElementById('tile-' + lastHighlight);
    if (prevTile) prevTile.classList.remove('active');
  }
  
  if (letter) {
    const tile = document.getElementById('tile-' + letter);
    if (tile) tile.classList.add('active');
    lastHighlight = letter;
  } else {
    lastHighlight = null;
  }
}

// ───────────────────────────────────────
// KELIME VE HARF YÖNETİMİ
// ───────────────────────────────────────

/**
 * Oluşturulan kelimeyi DOM'da render eder
 */
function renderWord() {
  const area = document.getElementById('wa');
  area.innerHTML = '';
  
  if (!word) {
    // Boş durumda placeholder
    const span = document.createElement('span');
    span.className = 'wph';
    span.textContent = 'Harfler burada görünür…';
    area.appendChild(span);
  } else {
    // Her harfi ayrı span'de göster
    for (const char of word) {
      const span = document.createElement('span');
      span.className = 'wc';
      span.textContent = char;
      area.appendChild(span);
    }
  }
  
  // İmleç ekle
  const cursor = document.createElement('span');
  cursor.className = 'wcur';
  area.appendChild(cursor);
  
  // Harf sayısını güncelle
  document.getElementById('chcnt').textContent = word.length + ' harf';
}

/**
 * Kelimeler listesini DOM'da render eder
 */
function renderWords() {
  const list = document.getElementById('wlist');
  list.innerHTML = '';
  
  document.getElementById('wcnt').textContent = words.length;
  
  if (!words.length) {
    // Boş durumda placeholder
    const emptySpan = document.createElement('span');
    emptySpan.className = 'wem';
    emptySpan.textContent = 'Kelimeler burada görünür…';
    list.appendChild(emptySpan);
    return;
  }
  
  // Her kelime için bir chip oluştur
  words.forEach((word, index) => {
    const chip = document.createElement('div');
    chip.className = 'wchip';
    chip.textContent = word;
    chip.title = 'Tıkla: sil';
    
    // Tıklanınca sil
    chip.onclick = () => {
      words.splice(index, 1);
      renderWords();
    };
    
    list.appendChild(chip);
  });
}

/**
 * Son karakteri kelimeden sil
 */
function delChar() {
  word = word.slice(0, -1);
  renderWord();
}

/**
 * Oluşturulan kelimeyi kelimeler listesine ekle
 */
function addWord() {
  const trimmed = word.trim();
  
  if (!trimmed) {
    toast('Önce harf oluşturun', 'warn');
    return;
  }
  
  words.push(trimmed.toUpperCase());
  word = '';
  renderWord();
  renderWords();
  toast(`"${trimmed.toUpperCase()}" eklendi`, 'success');
}

/**
 * Tüm kelime ve harfleri temizle
 */
function clearAll() {
  word = '';
  words = [];
  renderWord();
  renderWords();
  toast('Temizlendi', 'info');
}

/**
 * Sesli okuma (Sesli Oku)
 */
function speakSent() {
  const allWords = [...words, ...(word.trim() ? [word.toUpperCase()] : [])];
  
  if (!allWords.length) {
    toast('Kelime yok!', 'warn');
    return;
  }
  
  const text = allWords.join(' ');
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'tr-TR';
  utterance.rate = 0.9;
  
  speechSynthesis.cancel();
  speechSynthesis.speak(utterance);
  toast('Sesli okunuyor…', 'info');
}

/**
 * Kamerayı duraklat / devam ettir
 */
function togglePause() {
  paused = !paused;
  document.getElementById('pauseBtn').textContent = paused ? 'Başlat' : 'Durdur';
  toast(paused ? 'Duraklatıldı' : 'Yeniden başlatıldı', 'info');
  
  // Duraklatılıysa canvas temizle
  if (paused) {
    document.getElementById('bboxCanvas').getContext('2d').clearRect(0, 0, 9999, 9999);
  }
}

/**
 * Durum pilisinin rengini ve metnini günceller (şartlı güncelleme)
 * @param {string} status - 'ready', 'loading', 'error'
 * @param {string} text - Gösterilecek metin
 */
let lastStatusType = null;
let lastStatusText = null;

function setStatus(status, text) {
  // Aynı durum geliyorsa güncelleme yapma
  if (status === lastStatusType && text === lastStatusText) {
    return;
  }
  
  lastStatusType = status;
  lastStatusText = text;
  
  const pill = elemCache['pill'] || document.getElementById('pill');
  if (pill) {
    pill.className = 'pill ' + status;
  }
  
  const pillTxt = document.getElementById('pillTxt');
  if (pillTxt) {
    pillTxt.textContent = text;
  }
}

/**
 * Bildirim (toast) mesajı göster
 * @param {string} message - Gösterilecek mesaj
 * @param {string} type - 'success', 'info', 'warn' (opsiyonel)
 */
function toast(message, type = '') {
  const container = document.getElementById('toasts');
  const element = document.createElement('div');
  
  element.className = 'toast ' + type;
  element.textContent = message;
  container.appendChild(element);
  
  // Göster animasyonu
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      element.classList.add('show');
    });
  });
  
  // Otomatik kaldır
  setTimeout(() => {
    element.classList.remove('show');
    setTimeout(() => {
      element.remove();
    }, 280);
  }, 2700);
}

// ───────────────────────────────────────
// KLAVYE KONTROLLERI
// ───────────────────────────────────────

document.addEventListener('keydown', event => {
  // Boşluk = Kelime ekle
  if (event.code === 'Space') {
    event.preventDefault();
    addWord();
  }
  
  // Backspace = Son karakteri sil
  if (event.code === 'Backspace') {
    event.preventDefault();
    delChar();
  }
  
  // Enter = Sesli oku
  if (event.code === 'Enter') {
    event.preventDefault();
    speakSent();
  }
  
  // P = Duraklat/Devam
  if (event.code === 'KeyP') {
    event.preventDefault();
    togglePause();
  }
});

// ───────────────────────────────────────
// UYGULAMA BAŞLATMA
// ───────────────────────────────────────

window.addEventListener('load', () => {
  renderWord();
  renderWords();
  init();
});

