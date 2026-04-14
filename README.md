# AI YouTube Video Summarizer

Bu proje, en mantikli MVP kapsamiyla tasarlandi:

- YouTube URL verildiginde mevcut transcripti ceker
- Zoom / Google Meet kayitlari icin dosya yukleme kabul eder
- Transcript uzerinden AI destekli kisa ozet, uzun ozet, bullet point summary ve ana fikir uretir

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
ALLOWED_ORIGINS=http://localhost:3000
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

## Sonraki mantikli adimlar

- Transcript gecmisi kaydetme
- Export: TXT / PDF
- Zaman damgali transcript
- Ozeti kopyalama butonlari
- Kullanici girisi ve gecmis ekranlari

## Dokuman notu

OpenRouter entegrasyonu resmi OpenRouter dokumanindaki `chat/completions` akisina gore secildi. Ozetleme text chat completion ile, dosya transkripsiyonu ise `input_audio` destekli model uzerinden yapiliyor.

- [OpenRouter Quickstart](https://openrouter.ai/docs/quickstart)
- [OpenRouter Audio Input Guide](https://openrouter.ai/docs/guides/overview/multimodal/audio)
