# HOW TO RUN BOT TELEGRAM

Dokumen ini khusus untuk service bot Telegram webhook yang menjalankan flow `src_custom/`.

Fokus dokumen ini:

- cara menjalankan service bot
- environment variable yang dipakai service
- alur request dari Telegram sampai file hasil export terkirim
- komponen kode yang terlibat

Dokumen lain:

- `../README.md`: overview repo
- `HOW_TO_CREATE_BOT_TELEGRAM.md`: cara membuat bot di BotFather
- `HOW_TO_RUN.md`: menjalankan project secara local
- `HOW_TO_DEPLOY_BOT_TELEGRAM_RAILWAY.md`: langkah deploy khusus Railway
- `HOW_TO_INTEGRATE_BOT_TELEGRAM.md`: kontrak payload runtime ke flow custom

## 1. Ringkas Arsitektur

Komponen utama:

- `src_bot/server.js`: HTTP server webhook Telegram
- `src_bot/config.js`: loader env dan runtime config bot
- `src_bot/auth-store.js`: penyimpanan user Telegram yang sudah lolos verifikasi
- `src_bot/command-parser.js`: parser command `/export`
- `src_bot/export-runner.js`: menjalankan `src_custom/ksc-export.js` sebagai child process
- `src_bot/telegram-api.js`: wrapper Telegram Bot API
- `src_custom/ksc-export.js`: flow export custom yang benar-benar menjalankan automation

Alur sederhananya:

1. Telegram mengirim update ke `POST /telegram/webhook`
2. Service memverifikasi header secret webhook
3. Service memproses command atau contact dari user
4. Kalau command adalah `/export`, service membentuk payload runtime
5. Payload ditulis ke file JSON sementara
6. Service menjalankan `node src_custom/ksc-export.js --params-file=<temp-file>`
7. Flow custom mencetak `RUN_RESULT_JSON=...`
8. Service membaca hasil itu lalu mengirim file ke chat Telegram

## 2. Endpoint Service

Endpoint yang disediakan:

- `GET /healthz`
- `POST /telegram/webhook`

`GET /healthz` mengembalikan:

- `ok`
- `uptimeSec`
- `currentRun`

`POST /telegram/webhook`:

- hanya menerima request dari Telegram yang membawa header `x-telegram-bot-api-secret-token`
- akan mengembalikan `401` kalau header secret tidak cocok
- setelah body diterima, service langsung membalas `200 { ok: true }` lalu memproses update secara async

## 3. Environment Variable

### Wajib untuk service bot

```env
TELEGRAM_BOT_TOKEN=123456:ABCDEF
TELEGRAM_WEBHOOK_SECRET=replace-with-random-secret
TELEGRAM_ALLOWED_PHONES=628123456789,628987654321
```

Arti:

- `TELEGRAM_BOT_TOKEN`: token bot dari BotFather
- `TELEGRAM_WEBHOOK_SECRET`: secret yang Anda buat sendiri untuk verifikasi webhook
- `TELEGRAM_ALLOWED_PHONES`: whitelist nomor HP user yang boleh memakai bot

Cara generate `TELEGRAM_WEBHOOK_SECRET`:

```bash
openssl rand -hex 32
```

atau:

```bash
uuidgen
```

### Wajib untuk flow custom

Bot ini hanya orchestration layer. Flow export tetap butuh env dasar Accurate dan Playwright:

```env
ACCURATE_EMAIL=your-email@example.com
ACCURATE_PASSWORD=your-password
ACCURATE_COMPANY_NAME=KSC
ACCURATE_REPORT_FILE_TITLE=AYO v3
ACCURATE_ACADEMY_TENNIS_REVENUE=0
ACCURATE_MONTHLY_TARGET=100000000
```

Tambahkan juga setting browser yang sesuai mesin atau container Anda.

### Env service yang sering dipakai

```env
HOST=0.0.0.0
PORT=3000
TELEGRAM_API_TIMEOUT_MS=30000
TELEGRAM_RESULT_MODE=files
TELEGRAM_WEBHOOK_URL=https://your-domain.example/telegram/webhook
TELEGRAM_AUTH_STORE_PATH=/app/output/playwright/telegram/auth-users.json
ACCURATE_OUTPUT_DIR=/app/output/playwright/telegram/runs
PLAYWRIGHT_USER_DATA_DIR=/app/output/playwright/ksc_user-data
```

Perilaku penting:

- kalau `TELEGRAM_RESULT_MODE` kosong, default-nya `zip`
- kalau `TELEGRAM_WEBHOOK_URL` kosong dan `RAILWAY_PUBLIC_DOMAIN` ada, URL webhook dibentuk otomatis menjadi `https://<RAILWAY_PUBLIC_DOMAIN>/telegram/webhook`
- kalau `ACCURATE_OUTPUT_DIR` kosong, default output bot ada di `output/playwright/telegram/runs`
- kalau `TELEGRAM_AUTH_STORE_PATH` kosong, file auth store dibuat di sibling directory output bot

Sebelum mengisi `TELEGRAM_BOT_TOKEN`, buat dulu bot sesuai `HOW_TO_CREATE_BOT_TELEGRAM.md`.

## 4. Cara Menjalankan Service

Install dependency:

```bash
pnpm install
pnpm run install:browsers
```

Jalankan service:

```bash
pnpm run bot:start
```

Script yang dijalankan:

```bash
node src_bot/server.js
```

Saat startup, service akan:

1. membaca `.env` lalu `.env.custom`
2. memastikan directory output bot dan auth store tersedia
3. mencetak ringkasan runtime config
4. memanggil `setWebhook()` ke Telegram kalau webhook URL tersedia
5. membuka HTTP server di `HOST:PORT`

## 5. Verifikasi User

Bot hanya menerima command dari user yang sudah diverifikasi.

Mekanisme verifikasi:

1. user kirim `/start`
2. bot meminta user menekan tombol `Share contact`
3. contact yang dikirim harus milik akun Telegram yang sama
4. nomor HP dinormalisasi lalu dicocokkan ke `TELEGRAM_ALLOWED_PHONES`
5. kalau cocok, record user disimpan ke auth store JSON

Lokasi default auth store:

```text
<dirname ACCURATE_OUTPUT_DIR>/auth-users.json
```

Catatan:

- walaupun user sudah pernah diverifikasi, setiap request berikutnya tetap divalidasi lagi terhadap whitelist env saat ini
- kalau nomor dihapus dari `TELEGRAM_ALLOWED_PHONES`, akses user otomatis dianggap tidak valid

## 6. Command yang Didukung

Command umum:

```text
/start
/help
/status
/whoami
```

Command export:

```text
/export daily DD/MM/YYYY
/export monthly DD/MM/YYYY DD/MM/YYYY
/export yearly DD/MM/YYYY DD/MM/YYYY
/export multiperiod Month YYYY Month YYYY
/export daily 01/04/2026 monthly 01/04/2026 30/04/2026 multiperiod May 2026 June 2026
/export daily 01/04/2026 monthly 01/04/2026 30/04/2026 yearly 01/01/2026 30/04/2026 multiperiod May 2026 June 2026
```

Parser command ada di `src_bot/command-parser.js`.

## 7. Flow Eksekusi `/export`

Saat service menerima command `/export`:

1. service memastikan tidak ada export lain yang sedang berjalan
2. command diparse menjadi `exportPlan` dan `multiPeriod`
3. service membuat `requestId` seperti `telegram-YYYYMMDDHHMMSS-<userId>`
4. service membuat output directory per request
5. service membangun payload runtime
6. payload ditulis ke file JSON sementara di `/tmp`
7. service menjalankan `src_custom/ksc-export.js` sebagai child process
8. service menunggu baris `RUN_RESULT_JSON=...`
9. service mengirim file hasil export ke Telegram

Contoh payload yang dibentuk service:

```json
{
  "chatId": "123456789",
  "exportPlan": [
    { "type": "daily", "date": "01/04/2026" },
    { "type": "monthly", "startDate": "01/04/2026", "endDate": "30/04/2026" }
  ],
  "multiPeriod": {
    "fromMonth": "May",
    "fromYear": "2026",
    "toMonth": "June",
    "toYear": "2026"
  },
  "outputDir": "/abs/path/output/playwright/telegram/runs/telegram-20260417123000-123456",
  "requestId": "telegram-20260417123000-123456",
  "result": {
    "mode": "files"
  }
}
```

Detail shape payload dan aturan runtime ada di `HOW_TO_INTEGRATE_BOT_TELEGRAM.md`.

## 8. Cara Hasil Export Dikirim

Setelah flow custom selesai, service membaca `runResult` dari stdout child process.

Strategi pengiriman:

1. service mencoba mengirim semua item di `runResult.files`
2. kalau tidak ada file yang berhasil dikirim, service mencoba mengirim `runResult.bundle.path`
3. kalau tetap tidak ada artefak, bot mengirim pesan bahwa export selesai tetapi file tidak ditemukan

Catatan penting:

- service mengirim file satu per satu lebih dulu
- bundle zip hanya fallback saat tidak ada file individual yang berhasil terkirim
- summary pesan akhir berisi `file count`, `telegram sent`, `telegram failed`, `manifest`, dan `bundle`

## 9. Konkurensi

Service ini hanya mengizinkan satu export aktif pada satu waktu.

Penanda state in-memory:

```text
currentRun
```

Akibatnya:

- kalau ada user lain mengirim `/export` saat job masih berjalan, request akan ditolak dengan pesan status export yang sedang aktif
- state ini tidak persisten; kalau process restart, `currentRun` hilang

## 10. Output dan File yang Dibuat

Dalam satu request export, service biasanya menghasilkan:

- folder output per request
- file-file hasil export Excel
- file summary kalau syarat lengkap
- file manifest `custom-run-manifest-<requestId>.json`
- bundle zip kalau mode hasil `zip` dan command `zip` tersedia

Auth store dipisah dari output hasil export.

## 11. Catatan Container dan Railway

Container default repo ini memakai:

```dockerfile
CMD ["pnpm", "run", "bot:start"]
```

Karena itu bot bisa dijadikan service utama di Railway atau platform lain yang mengekspos HTTP webhook.

Rekomendasi untuk container/headless:

```env
PLAYWRIGHT_HEADLESS=true
PLAYWRIGHT_BROWSER=chromium
PLAYWRIGHT_BROWSER_CHANNEL=
PLAYWRIGHT_BROWSER_EXECUTABLE_PATH=
PLAYWRIGHT_SLOW_MO=0
```

Kalau deploy ke Railway, detail platform step-by-step ada di `HOW_TO_DEPLOY_BOT_TELEGRAM_RAILWAY.md`.

## 12. Troubleshooting

`401` di webhook:

- cek `TELEGRAM_WEBHOOK_SECRET`
- cek apakah Telegram webhook sudah diregister dengan secret yang sama

Bot start gagal karena env hilang:

- cek `TELEGRAM_BOT_TOKEN`
- cek `TELEGRAM_WEBHOOK_SECRET`
- cek env dasar Accurate dan Playwright

User tidak bisa pakai bot:

- cek nomor HP ada di `TELEGRAM_ALLOWED_PHONES`
- cek user mengirim contact miliknya sendiri
- cek file auth store bisa ditulis

Export gagal jalan:

- cek log process bot
- cek env Accurate
- cek browser dan path output
- cek apakah flow `src_custom/ksc-export.js` bisa jalan sendiri

Tidak ada file terkirim:

- cek isi `manifestPath`
- cek file benar-benar ada di `runResult.files`
- cek fallback bundle zip
- cek batasan pengiriman file di Telegram atau error network ke Telegram API
