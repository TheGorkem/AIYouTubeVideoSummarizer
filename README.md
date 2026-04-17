# AI YouTube Video Summarizer

Bu proje, en mantikli MVP kapsamiyla tasarlandi:

- YouTube URL verildiginde mevcut transcripti ceker
- Zoom / Google Meet kayitlari icin dosya yukleme kabul eder
- Transcript uzerinden AI destekli kisa ozet, uzun ozet, bullet point summary ve ana fikir uretir
- Kullanicilar icin giris, gecmis ekranı, TXT/PDF export ve kopyalama aksiyonlari sunar

## Neden bu kapsam secildi?

YouTube videolari genelde acik transcript veya sabit bir video kaynagi sunar. Zoom ve Google Meet tarafinda ise dogrudan linkten transcript alma akisi cogu zaman oturum, yetki ve kapali erisim nedeniyle kirilgandir. Bu nedenle MVP icin daha saglam cozum:

- YouTube URL destegi
- Ses / video dosyasi yukleme destegi

Bu yaklasimla Meet veya Zoom kayitlari da `mp4`, `mp3`, `wav` gibi dosyalarla desteklenmis olur.

## Tech Stack

### Backend

- Python
- FastAPI
- OpenRouter
- `youtube-transcript-api`

### Frontend

- Next.js
- Tailwind CSS

## Node notu

Frontend icin en sorunsuz surum `Node 22 LTS` olur. Bu repoda `frontend/package.json` scriptleri, `Node 25` ile gorulebilen `localStorage.getItem is not a function` problemini azaltmak icin `--no-experimental-webstorage` bayragi ile tanimlandi.

Istersen `frontend/.nvmrc` sayesinde su komutla Node 22'ye gecebilirsin:

```bash
cd frontend
nvm use
```

## Proje yapisi

```text
backend/
  app/
    routers/
    services/
frontend/
  app/
  components/
  lib/
```

## Backend kurulumu

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload
```

`.env` icine kendi OpenRouter anahtarini eklemelisin:

```env
OPENROUTER_API_KEY=your_openrouter_api_key
OPENROUTER_SUMMARY_MODEL=google/gemini-2.5-flash
OPENROUTER_TRANSCRIPTION_MODEL=google/gemini-2.5-flash
OPENROUTER_SITE_URL=http://localhost:3000
OPENROUTER_APP_NAME=AI Video Summarizer
MAX_UPLOAD_SIZE_MB=12
COMPRESSED_UPLOAD_TARGET_MB=8
ALLOWED_ORIGINS=http://localhost:3000
DATABASE_PATH=data/app.db
JWT_SECRET=change-me-in-production
JWT_EXPIRE_MINUTES=1440
```

Backend varsayilan olarak `http://localhost:8000` uzerinde calisir.

## Frontend kurulumu

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

Frontend varsayilan olarak `http://localhost:3000` uzerinde calisir.

## API

### `POST /api/v1/process`

`multipart/form-data` bekler.

Alanlar:

- `youtube_url`: YouTube linki
- `file`: ses veya video dosyasi
- `summary_type`: `all`, `short`, `long`, `bullet_points`, `main_idea`

Notlar:

- Ayni anda sadece bir kaynak gonderilmelidir.
- YouTube videosunda transcript yoksa backend kullaniciya dosya yukleme fallback'i onerir.

### `POST /api/v1/auth/register`

Kullanici kaydi olusturur ve token doner.

### `POST /api/v1/auth/login`

Giris yapar ve token doner.

### `GET /api/v1/auth/me`

Authorization header ile aktif kullaniciyi doner.

### `GET /api/v1/history`

Giris yapan kullanicinin gecmis kayitlarini listeler.

### `GET /api/v1/history/{id}`

Tekil gecmis kaydini getirir.

### `DELETE /api/v1/history/{id}`

Gecmis kaydini siler.

## Mevcut Ozellikler

- Transcript sonucu ekranda kopyalanabilir
- Ozet kartlari tek tek kopyalanabilir
- Sonuc TXT ve PDF olarak indirilebilir
- YouTube transcript gelirse zaman damgali transcript gosterilebilir
- Giris yapan kullanicilarin islem gecmisi SQLite uzerinde saklanir
- `/history` ekraninda gecmis kayitlari listelenir ve silinebilir
- Buyuk ses/video dosyalari `ffmpeg` ile otomatik olarak sese donusturulup kucultulmeye calisilir

## Sonraki mantikli adimlar

- Anonim gecmisi sonradan hesaba baglama
- History icinde arama ve filtreleme
- Transcript parcasi bazli zaman navigasyonu
- Dosya kucultme / otomatik audio extraction
- PDF export icin daha iyi tipografi ve Turkce karakter fontu

## Dokuman notu

OpenRouter entegrasyonu resmi OpenRouter dokumanindaki `chat/completions` akisina gore secildi. Ozetleme text chat completion ile, dosya transkripsiyonu ise `input_audio` destekli model uzerinden yapiliyor.

- [OpenRouter Quickstart](https://openrouter.ai/docs/quickstart)
- [OpenRouter Audio Input Guide](https://openrouter.ai/docs/guides/overview/multimodal/audio)
