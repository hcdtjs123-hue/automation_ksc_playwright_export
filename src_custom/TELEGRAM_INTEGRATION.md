# Telegram Integration Guide

Dokumen ini menjelaskan cara menyambungkan flow `src_custom/` dengan bot Telegram.

Untuk implementasi webhook bot yang siap deploy ke Railway, lihat juga:
- `RAILWAY_TELEGRAM_BOT.md`

## Konsep Dasar

Pisahkan input jadi 2 jenis:

### 1. Konfigurasi statis

Disimpan di `.env` atau `.env.custom`.

Contoh:
- `ACCURATE_EMAIL`
- `ACCURATE_PASSWORD`
- `ACCURATE_COMPANY_NAME`
- `PLAYWRIGHT_BROWSER`
- `ACCURATE_MONTHLY_TARGET`

Data ini jarang berubah dan tidak perlu dikirim lewat Telegram setiap kali run.

### 2. Konfigurasi dinamis per request

Datang dari Telegram dan dikirim sebagai parameter runtime.

Contoh:
- daily tanggal berapa saja
- monthly range berapa
- yearly range berapa
- multi period aktif atau tidak

Data ini dikirim ke script custom dalam bentuk JSON.

## Payload Runtime

Shape payload yang didukung:

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

Field tambahan:
- `requestId` opsional, untuk menandai satu request Telegram
- `chatId` opsional, untuk dibawa ke manifest hasil run
- `outputDir` opsional, untuk memisahkan hasil per request
- `result.mode` opsional:
  - `files`: kirim file satu-satu ke chat
  - `zip`: gabungkan dulu jadi satu file zip

### Aturan `exportPlan`

- `exportPlan` berupa array
- `type` mendukung:
  - `daily` atau `d`
  - `monthly` atau `m`
  - `yearly` atau `y`
- `daily` membutuhkan `date`
- `monthly` dan `yearly` membutuhkan `startDate` dan `endDate`
- `key` opsional

Contoh dengan `key`:

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

### Aturan `multiPeriod`

`multiPeriod` opsional.

Kalau ada, isi:

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

Kalau tidak ada:
- multi period tidak dijalankan

Kalau payload hanya berisi `multiPeriod`:
- script akan menjalankan multi period saja

## Mode Run

### 1. Via file JSON

Paling mudah untuk testing manual:

```bash
pnpm run custom:start -- --params-file=./params-full.json
```

### 2. Via JSON inline

Cocok kalau bot langsung membangun payload string:

```bash
pnpm run custom:start -- --params='{"exportPlan":[{"type":"daily","date":"01/04/2026"}]}'
```

## Rekomendasi Untuk Bot Telegram

Untuk produksi, lebih aman bot:
1. menerima command Telegram
2. parse command menjadi object JavaScript
3. simpan object itu ke file JSON sementara
4. jalankan `pnpm run custom:start -- --params-file=<temp-file>`
5. baca `RUN_RESULT_JSON=...` dari stdout
6. kirim file yang tercantum di hasil run ke chat yang sama
7. hapus file sementara setelah selesai

Alasannya:
- lebih aman daripada escape JSON panjang di shell
- lebih mudah logging/debugging
- payload request bisa disimpan sementara untuk audit

## Aturan Output

Script custom tetap mendownload file ke disk dulu, lalu bot Telegram yang mengirim file itu ke chat.

Aturannya:
- kalau `outputDir` tidak dikirim, hasil masuk ke `ACCURATE_OUTPUT_DIR`
- kalau `outputDir` dikirim, path itu akan dipakai khusus untuk request tersebut
- kalau `result.mode=files`, bot sebaiknya kirim semua file di daftar `files`
- kalau `result.mode=zip`, bot sebaiknya prioritaskan `bundle.path`

Contoh payload per request:

```json
{
  "requestId": "telegram-20260410-001",
  "chatId": "123456789",
  "outputDir": "./output/playwright/telegram/telegram-20260410-001",
  "result": {
    "mode": "zip"
  },
  "exportPlan": [
    { "type": "daily", "date": "01/04/2026" }
  ]
}
```

## Contoh Mapping Telegram Ke Payload

### Contoh 1

User kirim:

```text
/export daily 01/04/2026 02/04/2026 monthly 01/04/2026 30/04/2026
```

Bot ubah menjadi:

```json
{
  "exportPlan": [
    { "type": "daily", "date": "01/04/2026" },
    { "type": "daily", "date": "02/04/2026" },
    { "type": "monthly", "startDate": "01/04/2026", "endDate": "30/04/2026" }
  ]
}
```

### Contoh 2

User kirim:

```text
/export multiperiod May 2026 June 2026
```

Bot ubah menjadi:

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

### Contoh 3

User kirim:

```text
/export daily 01/04/2026 daily 02/04/2026 yearly 01/01/2026 30/04/2026 multiperiod May 2026 June 2026
```

Bot ubah menjadi:

```json
{
  "exportPlan": [
    { "type": "daily", "date": "01/04/2026" },
    { "type": "daily", "date": "02/04/2026" },
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

## Prioritas Nilai

Urutan override saat runtime:
1. `.env`
2. `.env.custom`
3. parameter CLI JSON

Jadi payload Telegram selalu menang terhadap env file.

## Manifest Hasil Run

Setelah export selesai, script akan:
- membuat file manifest JSON di output directory
- mencetak satu baris stdout dengan format `RUN_RESULT_JSON=...`

Bot Telegram sebaiknya membaca baris itu, parse JSON-nya, lalu kirim file berdasarkan hasilnya.

Contoh shape hasil run:

```json
{
  "status": "success",
  "generatedAt": "2026-04-10T08:00:00.000Z",
  "outputDir": "/abs/path/output/playwright/telegram/run-001",
  "request": {
    "requestId": "telegram-001",
    "chatId": "123456789",
    "source": "/abs/path/tmp/request.json"
  },
  "resultMode": "zip",
  "files": [
    {
      "kind": "daily",
      "path": "/abs/path/output/playwright/telegram/run-001/ksc_custom_daily_1_2026-04-01.xlsx",
      "fileName": "ksc_custom_daily_1_2026-04-01.xlsx",
      "exists": true
    }
  ],
  "bundle": {
    "path": "/abs/path/output/playwright/telegram/run-001/custom-run-bundle-telegram-001.zip",
    "fileName": "custom-run-bundle-telegram-001.zip"
  },
  "manifestPath": "/abs/path/output/playwright/telegram/run-001/custom-run-manifest-telegram-001.json"
}
```

Rekomendasi pengiriman:
- kalau ada `bundle.path`, kirim zip itu ke chat
- kalau tidak ada bundle, kirim semua item `files[].path`
- `request.chatId` bisa dipakai bot untuk memastikan file dikirim ke chat yang benar

## Final Summary

Final summary hanya dibuat kalau:
- ada minimal satu `daily`
- ada minimal satu `monthly`
- ada minimal satu `yearly`
- ada `multiPeriod`

Kalau tidak lengkap:
- export tetap jalan
- final summary dilewati

## File Contoh

Di root project sudah ada:
- `params-daily-only.json`
- `params-monthly-yearly.json`
- `params-full.json`
- `params-multi-period-only.json`

Di `src_custom/` juga ada contoh payload runtime:
- `src_custom/runtime-params.example.json`
