# KSC Playwright Export

Project ini membungkus skrip Playwright Anda menjadi struktur Node.js yang lebih rapi dan bisa dijalankan langsung.

## Struktur

- `src/ksc-export.js`: entry script Playwright.
- `src/config.js`: konfigurasi runtime dan validasi env.
- `src/playwright-helpers.js`: helper generik untuk interaksi Playwright.
- `src/ksc-actions.js`: aksi spesifik flow Accurate.
- `src/date.js`: helper tanggal untuk filter report.
- `scripts/doctor.js`: cek cepat environment sebelum run.
- `scripts/windows/ksc-save-export.ahk`: helper AutoHotkey untuk native save dialog.
- `legacy/`: salinan file awal sebelum dirapikan.
- `.env.example`: contoh environment variable.

## Setup

1. Install dependency:

```bash
pnpm install
```

2. Buat file `.env` dari template:

```bash
cp .env.example .env
```

3. Isi `ACCURATE_EMAIL` dan `ACCURATE_PASSWORD` di `.env`.

4. Atur browser dan tanggal report di `.env`:

```bash
ACCURATE_REPORT_FILE_TITLE=AYO v3
ACCURATE_MONTHLY_TARGET=100000000
ACCURATE_EXPORT_FILE_PREFIX=ksc_
MULTI_PERIOD_ACCURATE_FROM_MONTH=February
MULTI_PERIOD_ACCURATE_FROM_YEAR=2026
MULTI_PERIOD_ACCURATE_TO_MONTH=April
MULTI_PERIOD_ACCURATE_TO_YEAR=2026
PLAYWRIGHT_BROWSER=chromium
PLAYWRIGHT_BROWSER_CHANNEL=chrome
PLAYWRIGHT_BROWSER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable
PLAYWRIGHT_CHROME_PROFILE_DIRECTORY=Default
PLAYWRIGHT_USER_DATA_DIR=./output/playwright/ksc_user-data
DAILY_ACCURATE_START_DATE=01/04/2026
DAILY_ACCURATE_END_DATE=07/04/2026
MTD_ACCURATE_START_DATE=01/04/2026
MTD_ACCURATE_END_DATE=07/04/2026
YTD_ACCURATE_START_DATE=01/01/2026
YTD_ACCURATE_END_DATE=07/04/2026
# ACCURATE_OUTPUT_DIR=./output/playwright/ksc_downloads
```

`ACCURATE_MONTHLY_TARGET` dipakai untuk mengisi row `Target/Bln` di final summary, dan row `%Pencapaian` dihitung dari `Total Pendapatan / Target/Bln`.
`ACCURATE_EXPORT_FILE_PREFIX` dipakai sebagai prefix nama file export seperti `ksc_daily_...`, `ksc_mtd_...`, dan `ksc_ytd_...`.
`MULTI_PERIOD_ACCURATE_*` dipakai untuk flow tambahan setelah 3 export utama: tutup report sekarang, buka `Profit/Loss (Multi Period)`, isi `From Period` dan `to Period`, lalu export lagi memakai flow export Excel yang sama.

5. Install browser Chromium untuk Playwright:

```bash
pnpm run install:browsers
```

6. Jalankan:

```bash
pnpm start
```

7. Untuk cek environment tanpa membuka flow login:

```bash
pnpm run doctor
```

## Urutan Baca

1. `src/ksc-export.js`
   File utama untuk melihat alur penuh: buka browser, login, buka report, export `daily`, buka `Modify Input`, export `mtd`, buka `Modify Input`, export `ytd`, lalu close browser.

2. `src/date.js`
   Tempat semua range tanggal dibentuk dari env `DAILY_ACCURATE_*`, `MTD_ACCURATE_*`, dan `YTD_ACCURATE_*`, termasuk label nama file download.

3. `src/ksc-actions.js`
   Kumpulan aksi browser spesifik Accurate seperti login, pilih company, buka report, isi tanggal, klik `Show`, klik `Modify Input`, dan export Excel.

4. `src/playwright-helpers.js`
   Helper generik Playwright seperti klik aman, pencarian page aktif, dan tunggu overlay hilang.

5. `src/config.js`
   Default konfigurasi runtime, path output/profile, browser, dan label UI yang bisa dioverride dari `.env`.

6. `.env`
   Sumber input runtime yang benar-benar dipakai saat script dijalankan.

7. `scripts/doctor.js`
   Checker cepat untuk memastikan semua env penting dan path runtime sudah siap sebelum run.
