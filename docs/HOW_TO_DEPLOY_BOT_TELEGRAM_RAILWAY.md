# HOW TO DEPLOY BOT TELEGRAM RAILWAY

Dokumen ini menjelaskan cara deploy bot Telegram webhook untuk flow `src_custom/` ke Railway.

Fokus dokumen ini adalah deploy dan operasional service bot di Railway.

Dokumen lain:

- `../README.md`: overview repo
- `HOW_TO_RUN.md`: menjalankan project di local
- `HOW_TO_INTEGRATE_BOT_TELEGRAM.md`: payload runtime, hasil run, dan kontrak integrasi bot ke flow custom

## Ringkas Arsitektur

- Service HTTP ada di `src_bot/server.js`
- Endpoint webhook: `POST /telegram/webhook`
- Health check: `GET /healthz`
- Runner bot akan menjalankan `src_custom/ksc-export.js` sebagai child process
- Akses bot hanya untuk nomor HP yang ada di `TELEGRAM_ALLOWED_PHONES`

## Environment Variables

Wajib:

```env
TELEGRAM_BOT_TOKEN=123456:ABCDEF
TELEGRAM_WEBHOOK_SECRET=replace-with-random-secret
TELEGRAM_ALLOWED_PHONES=628123456789,628987654321
ACCURATE_EMAIL=your-email@example.com
ACCURATE_PASSWORD=your-password
ACCURATE_COMPANY_NAME=KSC
ACCURATE_REPORT_FILE_TITLE=AYO v3
ACCURATE_ACADEMY_TENNIS_REVENUE=0
ACCURATE_MONTHLY_TARGET=100000000
```

Direkomendasikan untuk Railway:

```env
TELEGRAM_RESULT_MODE=files
TELEGRAM_API_TIMEOUT_MS=30000
TELEGRAM_AUTH_STORE_PATH=/app/output/playwright/telegram/auth-users.json
ACCURATE_OUTPUT_DIR=/app/output/playwright/telegram/runs
PLAYWRIGHT_USER_DATA_DIR=/app/output/playwright/ksc_user-data
PLAYWRIGHT_HEADLESS=true
PLAYWRIGHT_BROWSER=chromium
PLAYWRIGHT_BROWSER_CHANNEL=
PLAYWRIGHT_BROWSER_EXECUTABLE_PATH=
PLAYWRIGHT_SLOW_MO=0
```

Opsional:

```env
TELEGRAM_WEBHOOK_URL=https://your-domain.example/telegram/webhook
```

Kalau `TELEGRAM_WEBHOOK_URL` kosong dan service punya `RAILWAY_PUBLIC_DOMAIN`, bot akan memakai:

```text
https://<RAILWAY_PUBLIC_DOMAIN>/telegram/webhook
```

## Railway Setup

1. Push repo ini ke GitHub.
2. Buat project baru di Railway dan hubungkan repo.
3. Pastikan service memakai `Dockerfile` di root repo.
4. Tambahkan Volume dan mount ke `/app/output`.
5. Isi semua environment variable yang wajib.
6. Tambahkan public domain untuk service Railway.
7. Deploy service.
8. Cek log startup dan pastikan ada log `Telegram webhook set to ...`.
9. Buka `https://<domain>/healthz` dan pastikan respons `ok: true`.

## Cara Verifikasi User

1. User kirim `/start` ke bot.
2. Bot akan menampilkan tombol `Share contact`.
3. User wajib mengirim kontak miliknya sendiri.
4. Bot akan cocokkan nomor itu dengan `TELEGRAM_ALLOWED_PHONES`.
5. Kalau cocok, `telegram_user_id` akan disimpan di `TELEGRAM_AUTH_STORE_PATH`.
6. Pada request berikutnya bot tetap cek whitelist env lagi, jadi akses bisa dicabut hanya dengan mengubah env.

## Command Bot

```text
/help
/status
/whoami
/export daily 01/04/2026
/export monthly 01/04/2026 30/04/2026
/export yearly 01/01/2026 30/04/2026
/export multiperiod May 2026 June 2026
/export daily 01/04/2026 monthly 01/04/2026 30/04/2026 multiperiod May 2026 June 2026
```

Untuk detail payload runtime yang dibentuk dari command di atas, lihat `HOW_TO_INTEGRATE_BOT_TELEGRAM.md`.

## Catatan

- Hanya satu export aktif pada satu waktu per service.
- Kalau Railway restart, auth user tetap aman selama volume yang sama masih terpasang.
- Bot akan mengirim semua file hasil export satu per satu ke Telegram. Bundle zip tetap dipakai sebagai fallback jika pengiriman file individual tidak ada yang berhasil.
- Timeout request ke Telegram bisa diatur lewat `TELEGRAM_API_TIMEOUT_MS` agar bot tidak tertahan terlalu lama saat jaringan ke Telegram bermasalah.
