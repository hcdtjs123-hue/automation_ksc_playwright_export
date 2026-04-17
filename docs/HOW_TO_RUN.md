# HOW TO RUN

Dokumen ini khusus untuk menjalankan proyek di local: setup awal, env yang perlu diubah, dan command yang dipakai saat development atau manual export.

Dokumen lain:

- `../README.md`: overview repo
- `HOW_TO_DEPLOY_BOT_TELEGRAM_RAILWAY.md`: deploy bot Telegram ke Railway
- `HOW_TO_INTEGRATE_BOT_TELEGRAM.md`: kontrak integrasi bot ke flow custom

## 1. Gambaran singkat proyek

Repo ini punya 3 mode utama:

- `pnpm start`: flow utama export `daily -> mtd -> ytd -> multi period`, lalu generate final summary.
- `pnpm run custom:start`: flow custom dengan urutan export yang bisa diatur dari `.env.custom` atau file JSON.

Kalau kebutuhan Anda hanya menjalankan export lokal biasa, mulai dari `pnpm start`.

## 2. Prasyarat local

Yang dibutuhkan:

- Node.js
- `pnpm`
- Browser Chromium/Chrome untuk Playwright
- Akses login ke Accurate

Kalau `pnpm` belum ada, biasanya paling aman:

```bash
corepack enable
pnpm install
```

Install browser Playwright:

```bash
pnpm run install:browsers
```

## 3. Setup awal

Copy file env:

```bash
cp .env.example .env
```

Lalu isi `.env`.

## 4. Yang wajib diganti di `.env`

Minimal ganti nilai berikut:

```env
ACCURATE_EMAIL=your-email@example.com
ACCURATE_PASSWORD=your-password
```

Biasanya juga perlu disesuaikan:

```env
ACCURATE_COMPANY_NAME=KSC
ACCURATE_REPORT_FILE_TITLE=AYO v3
ACCURATE_ACADEMY_TENNIS_REVENUE=0
ACCURATE_MONTHLY_TARGET=100000000
ACCURATE_EXPORT_FILE_PREFIX=ksc_
```

Tanggal export wajib diisi sesuai periode yang ingin diambil:

```env
DAILY_ACCURATE_START_DATE=DD/MM/YYYY
DAILY_ACCURATE_END_DATE=DD/MM/YYYY
MTD_ACCURATE_START_DATE=DD/MM/YYYY
MTD_ACCURATE_END_DATE=DD/MM/YYYY
YTD_ACCURATE_START_DATE=DD/MM/YYYY
YTD_ACCURATE_END_DATE=DD/MM/YYYY
```

Periode multi period juga wajib diisi kalau Anda menjalankan flow utama:

```env
MULTI_PERIOD_ACCURATE_FROM_MONTH=February
MULTI_PERIOD_ACCURATE_FROM_YEAR=2026
MULTI_PERIOD_ACCURATE_TO_MONTH=April
MULTI_PERIOD_ACCURATE_TO_YEAR=2026
```

## 5. Setting browser yang perlu dicek

Bagian ini paling sering perlu diubah:

```env
PLAYWRIGHT_BROWSER=chromium
PLAYWRIGHT_BROWSER_CHANNEL=chrome
PLAYWRIGHT_BROWSER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable
PLAYWRIGHT_CHROME_PROFILE_DIRECTORY=Default
PLAYWRIGHT_HEADLESS=false
PLAYWRIGHT_SLOW_MO=300
PLAYWRIGHT_USER_DATA_DIR=./output/playwright/ksc_user-data
```

Atur sesuai kondisi mesin Anda:

- Kalau path Chrome di komputer Anda beda, ganti `PLAYWRIGHT_BROWSER_EXECUTABLE_PATH`.
- Kalau tidak mau pakai Chrome sistem dan ingin pakai browser bawaan Playwright, kosongkan `PLAYWRIGHT_BROWSER_CHANNEL` dan `PLAYWRIGHT_BROWSER_EXECUTABLE_PATH`.
- Kalau ingin reuse profile Chrome asli, arahkan `PLAYWRIGHT_USER_DATA_DIR` ke folder user data Chrome Anda, lalu set `PLAYWRIGHT_CHROME_PROFILE_DIRECTORY` ke profile yang benar.
- Kalau memakai profile Chrome asli, semua proses Chrome harus ditutup dulu. Script memang akan fail kalau profile masih dipakai proses Chrome lain.
- Untuk debugging lokal, biarkan `PLAYWRIGHT_HEADLESS=false`. Untuk run tanpa UI, ubah ke `true`.

Contoh kalau ingin pakai Chromium bawaan Playwright:

```env
PLAYWRIGHT_BROWSER=chromium
PLAYWRIGHT_BROWSER_CHANNEL=
PLAYWRIGHT_BROWSER_EXECUTABLE_PATH=
PLAYWRIGHT_HEADLESS=false
PLAYWRIGHT_SLOW_MO=300
```

## 6. Setting output yang boleh diubah

Opsional, tapi sering berguna:

```env
ACCURATE_OUTPUT_DIR=./output/playwright/ksc_downloads
```

Default hasil export ada di folder `output/playwright/`.

## 7. Kalau label UI Accurate berbeda

Script ini mengandalkan beberapa label UI. Kalau akun Accurate Anda memakai label yang berbeda, override variabel ini:

```env
ACCURATE_URL=https://account.accurate.id/?lang=US
ACCURATE_SIDEBAR_LABEL=Reports
ACCURATE_REPORT_LIST_LABEL=Report List
ACCURATE_FINANCIAL_LABEL=Financial
ACCURATE_PROFIT_LOSS_LABEL=Profit/Loss (Standard)
ACCURATE_PROFIT_LOSS_MULTI_PERIOD_LABEL=Profit/Loss (Multi Period)
```

Ubah hanya kalau automation gagal karena teks menu/report di akun Anda tidak sama.

## 8. Jalankan flow utama

Sebelum run, cek environment:

```bash
pnpm run doctor
```

Kalau checker sudah aman, jalankan:

```bash
pnpm start
```

Flow utama akan:

1. Login ke Accurate
2. Buka report `Profit/Loss (Standard)`
3. Export `daily`
4. Export `mtd`
5. Export `ytd`
6. Buka `Profit/Loss (Multi Period)`
7. Export multi period
8. Generate final summary

## 9. Jalankan flow custom

Flow custom membaca:

1. `.env`
2. `.env.custom`
3. parameter CLI JSON

Artinya `.env.custom` akan override `.env`.

File `.env.custom` di repo ini sudah berisi contoh. Edit nilai-nilai berikut sesuai kebutuhan Anda:

```env
CUSTOM_EXPORT_PLAN=d(DAILY_1);d(DAILY_2);m(MONTHLY_1);y(YEARLY_1)

CUSTOM_DAILY_1_DATE=01/04/2026
CUSTOM_DAILY_2_DATE=02/04/2026

CUSTOM_MONTHLY_1_START_DATE=01/04/2026
CUSTOM_MONTHLY_1_END_DATE=30/04/2026

CUSTOM_YEARLY_1_START_DATE=01/01/2026
CUSTOM_YEARLY_1_END_DATE=30/04/2026
```

Jalankan:

```bash
pnpm run custom:start
```

Atau pakai parameter JSON:

```bash
pnpm run custom:start -- --params-file=./src_custom/runtime-params.example.json
```

Selain file di dalam `src_custom/`, repo ini juga sudah menyediakan contoh file parameter di root project. Anda bisa menjalankan langsung file-file ini:

```bash
pnpm run custom:start -- --params-file=./params-daily-only.json
pnpm run custom:start -- --params-file=./params-monthly-yearly.json
pnpm run custom:start -- --params-file=./params-multi-period-only.json
pnpm run custom:start -- --params-file=./params-full.json
```

Arti masing-masing:

- `params-daily-only.json`: hanya satu export `daily`
- `params-monthly-yearly.json`: export `monthly` dan `yearly`
- `params-multi-period-only.json`: hanya export `multi period`
- `params-full.json`: gabungan daily, monthly, yearly, dan multi period

Jadi custom flow tidak harus memakai file JSON dari dalam `src_custom/`. File parameter boleh berada di mana saja, selama path yang Anda kirim ke `--params-file` benar.

Catatan penting:

- Final summary hanya dibuat kalau ada minimal satu `daily`, satu `monthly`, satu `yearly`, dan multi period aktif.
- Kalau hanya sebagian flow yang dijalankan, export tetap jalan tetapi final summary dilewati.

## 10. Khusus Windows

Kalau Accurate memunculkan native Save dialog saat export Excel, fallback yang dipakai adalah AutoHotkey. Karena itu di Windows bisa perlu menyesuaikan:

```env
AHK_EXE_PATH=C:\Program Files\AutoHotkey\v2\AutoHotkey64.exe
AHK_SCRIPT_PATH=.\scripts\windows\ksc-save-export.ahk
```

Kalau AutoHotkey belum terpasang, install AutoHotkey v2 dulu.

## 11. Khusus Linux/macOS

Kalau export Accurate berhasil ditangkap sebagai download biasa oleh Playwright, tidak ada masalah.

Tapi kalau Accurate membuka native Save dialog, fallback AutoHotkey tidak akan jalan di non-Windows. Dalam kondisi itu pilih salah satu:

- jalankan flow di Windows dengan AutoHotkey
- sesuaikan flow export agar browser menghasilkan event download biasa

## 12. Checklist cepat sebelum run

Pastikan hal ini sudah benar:

- `.env` sudah dibuat dari `.env.example`
- `ACCURATE_EMAIL` dan `ACCURATE_PASSWORD` sudah diisi
- semua tanggal `DAILY_`, `MTD_`, `YTD_` sudah diisi
- `MULTI_PERIOD_ACCURATE_*` sudah diisi kalau mau flow utama lengkap
- path browser sudah sesuai mesin Anda
- `pnpm install` sudah dijalankan
- `pnpm run install:browsers` sudah dijalankan
- `pnpm run doctor` tidak menunjukkan error penting

## 13. File yang paling sering Anda ubah

- `.env`: config utama local
- `.env.custom`: plan export custom
- `src_custom/runtime-params.example.json` atau file JSON lain: kalau mau kirim parameter custom via CLI

## 14. Command yang paling sering dipakai

```bash
pnpm install
pnpm run install:browsers
pnpm run doctor
pnpm start
pnpm run custom:start
pnpm test
```
