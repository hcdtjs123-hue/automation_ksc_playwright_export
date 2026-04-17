# HOW TO INTEGRATE BOT TELEGRAM

Dokumen ini khusus menjelaskan kontrak integrasi antara bot Telegram dan flow `src_custom/`.

Dokumen lain yang terkait:

- `../README.md`: overview repo
- `HOW_TO_RUN.md`: cara menjalankan project di local
- `HOW_TO_DEPLOY_BOT_TELEGRAM_RAILWAY.md`: setup webhook bot untuk Railway

## Tujuan Integrasi

Pisahkan konfigurasi menjadi 2 kelompok:

- konfigurasi statis di `.env` atau `.env.custom`
- konfigurasi dinamis per request dari Telegram

Contoh konfigurasi statis:

- `ACCURATE_EMAIL`
- `ACCURATE_PASSWORD`
- `ACCURATE_COMPANY_NAME`
- `PLAYWRIGHT_BROWSER`
- `ACCURATE_MONTHLY_TARGET`

Contoh konfigurasi dinamis:

- daftar export `daily`
- range `monthly`
- range `yearly`
- periode `multiPeriod`
- `outputDir` per request
- mode hasil `files` atau `zip`

## Payload Runtime

Bot mengirim request ke flow custom dalam bentuk JSON. Shape yang didukung:

```json
{
  "requestId": "telegram-001",
  "chatId": "123456789",
  "outputDir": "./output/playwright/telegram/run-001",
  "result": {
    "mode": "zip"
  },
  "exportPlan": [
    { "type": "daily", "date": "01/04/2026" },
    { "type": "daily", "date": "02/04/2026" },
    { "type": "monthly", "startDate": "01/04/2026", "endDate": "30/04/2026" },
    { "type": "yearly", "startDate": "01/01/2026", "endDate": "30/04/2026" }
  ],
  "multiPeriod": {
    "fromMonth": "May",
    "fromYear": "2026",
    "toMonth": "June",
    "toYear": "2026"
  }
}
```

Field opsional yang didukung:

- `requestId`: penanda request
- `chatId`: dibawa ke manifest hasil run
- `outputDir`: direktori output khusus request ini
- `userDataDir`: override profile browser untuk request tertentu
- `result.mode`: `files` atau `zip`

## Aturan Payload

Aturan `exportPlan`:

- `exportPlan` harus array
- `type` mendukung `daily`, `monthly`, `yearly`, atau alias `d`, `m`, `y`
- `daily` membutuhkan `date`
- `monthly` dan `yearly` membutuhkan `startDate` dan `endDate`
- `key` opsional

Contoh:

```json
{
  "exportPlan": [
    { "type": "daily", "key": "HARI_1", "date": "01/04/2026" },
    { "type": "monthly", "key": "APR_2026", "startDate": "01/04/2026", "endDate": "30/04/2026" }
  ]
}
```

Kalau `key` tidak diisi, sistem akan membuat key otomatis seperti:

- `DAILY_1`
- `MONTHLY_1`
- `YEARLY_1`

Aturan `multiPeriod`:

- `multiPeriod` opsional
- kalau ada, semua field wajib diisi lengkap: `fromMonth`, `fromYear`, `toMonth`, `toYear`
- kalau payload hanya berisi `multiPeriod`, script akan menjalankan multi period saja

Contoh:

```json
{
  "multiPeriod": {
    "fromMonth": "May",
    "fromYear": "2026",
    "toMonth": "June",
    "toYear": "2026"
  }
}
```

## Urutan Override

Saat runtime, nilai dibaca dengan prioritas:

1. `.env`
2. `.env.custom`
3. parameter CLI JSON

Artinya payload dari Telegram akan override nilai di file env.

## Cara Menjalankan dari Bot

Pendekatan yang disarankan, dan memang dipakai bot saat ini:

1. Bot menerima command Telegram.
2. Bot parse command menjadi object JavaScript.
3. Bot simpan object itu ke file JSON sementara.
4. Bot jalankan `src_custom/ksc-export.js` dengan `--params-file=<temp-file>`.
5. Bot baca baris `RUN_RESULT_JSON=...` dari stdout.
6. Bot kirim file hasil run ke chat.
7. File JSON sementara dibersihkan setelah proses selesai.

Alasan pendekatan ini:

- lebih aman daripada meng-escape JSON panjang di shell
- lebih mudah debug
- lebih dekat ke implementasi bot di `src_bot/export-runner.js`

## Mode Run Manual

Untuk test tanpa bot, Anda bisa pakai file JSON:

```bash
pnpm run custom:start -- --params-file=./params-full.json
```

Atau JSON inline:

```bash
pnpm run custom:start -- --params='{"exportPlan":[{"type":"daily","date":"01/04/2026"}]}'
```

Contoh file yang sudah ada di repo:

- `params-daily-only.json`
- `params-monthly-yearly.json`
- `params-multi-period-only.json`
- `params-full.json`
- `src_custom/runtime-params.example.json`

## Mapping Command Telegram

Command yang saat ini dipahami parser bot:

```text
/export daily DD/MM/YYYY
/export monthly DD/MM/YYYY DD/MM/YYYY
/export yearly DD/MM/YYYY DD/MM/YYYY
/export multiperiod Month YYYY Month YYYY
```

Contoh:

```text
/export daily 01/04/2026 monthly 01/04/2026 30/04/2026 multiperiod May 2026 June 2026
```

Payload yang dibentuk:

```json
{
  "exportPlan": [
    { "type": "daily", "date": "01/04/2026" },
    { "type": "monthly", "startDate": "01/04/2026", "endDate": "30/04/2026" }
  ],
  "multiPeriod": {
    "fromMonth": "May",
    "fromYear": "2026",
    "toMonth": "June",
    "toYear": "2026"
  }
}
```

Catatan:

- keyword Telegram command memakai bentuk penuh: `daily`, `monthly`, `yearly`, `multiperiod`
- alias `d`, `m`, `y` didukung di payload runtime, bukan di command Telegram

## Hasil Run

Setelah export selesai, flow custom akan:

- membuat manifest JSON di output directory
- mencetak satu baris stdout dengan format `RUN_RESULT_JSON=...`

Bot sebaiknya membaca `RUN_RESULT_JSON`, parse JSON-nya, lalu kirim file berdasarkan hasil itu.

Contoh shape hasil run:

```json
{
  "status": "success",
  "generatedAt": "2026-04-10T08:00:00.000Z",
  "outputDir": "/abs/path/output/playwright/telegram/run-001",
  "request": {
    "requestId": "telegram-001",
    "chatId": "123456789",
    "source": "/abs/path/tmp/runtime-params.json"
  },
  "resultMode": "zip",
  "files": [
    {
      "kind": "daily",
      "path": "/abs/path/output/playwright/telegram/run-001/ksc_custom_daily_1_2026-04-01.xlsx",
      "fileName": "ksc_custom_daily_1_2026-04-01.xlsx",
      "exists": true,
      "startDate": "01/04/2026",
      "endDate": "01/04/2026",
      "fileLabel": "ksc_custom_daily_1_2026-04-01"
    }
  ],
  "bundle": {
    "path": "/abs/path/output/playwright/telegram/run-001/custom-run-bundle-telegram-001.zip",
    "fileName": "custom-run-bundle-telegram-001.zip"
  },
  "manifestPath": "/abs/path/output/playwright/telegram/run-001/custom-run-manifest-telegram-001.json"
}
```

Strategi pengiriman yang disarankan:

- kalau `bundle.path` ada, kirim zip itu
- kalau `bundle.path` tidak ada, kirim semua item di `files`
- `request.chatId` bisa dipakai untuk validasi tujuan pengiriman

Catatan `result.mode`:

- `files`: hasil dikirim per file
- `zip`: sistem akan mencoba membuat bundle zip lebih dulu
- kalau command `zip` tidak tersedia di server, hasil akan fallback ke mode file biasa

## Final Summary

Final summary hanya dibuat kalau semua syarat ini terpenuhi:

- ada minimal satu `daily`
- ada minimal satu `monthly`
- ada minimal satu `yearly`
- ada `multiPeriod` yang berhasil diexport

Kalau syarat tidak lengkap:

- export tetap jalan
- final summary dilewati

## Ringkas Implementasi

Kalau Anda membuat bot lain di luar `src_bot/`, kontrak minimumnya adalah:

1. bangun payload JSON
2. jalankan `src_custom/ksc-export.js`
3. baca `RUN_RESULT_JSON`
4. kirim artefak dari `bundle.path` atau `files[].path`

Selama empat langkah itu diikuti, integrasi bot tidak perlu tahu detail internal flow Playwright.
