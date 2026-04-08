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
```

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

## Notes

- Download hasil export sekarang default disimpan di `output/playwright/ksc_downloads`.
- `DAILY_ACCURATE_START_DATE`, `DAILY_ACCURATE_END_DATE`, `MTD_ACCURATE_START_DATE`, `MTD_ACCURATE_END_DATE`, `YTD_ACCURATE_START_DATE`, dan `YTD_ACCURATE_END_DATE` wajib memakai format `DD/MM/YYYY`.
- Flow sekarang berjalan 3 tahap berurutan dalam satu run: export awal, klik `Modify Input` untuk MTD, export lagi, klik `Modify Input` untuk YTD, export lagi, lalu program ditutup.
- Nama file download tahap pertama:
  `ksc_daily_YYYY-MM-DD.xlsx`
- Jika range tanggal berbeda, nama file tahap pertama menjadi:
  `ksc_daily_YYYY-MM-DD_to_YYYY-MM-DD.xlsx`
- Tahap kedua dan ketiga memakai prefix:
  `ksc_mtd_...` dan `ksc_ytd_...`
- Jika file dengan nama yang sama sudah ada, script otomatis menambah suffix `_2`, `_3`, dan seterusnya.
- Browser sekarang memakai persistent profile di `output/playwright/ksc_user-data`, jadi login/session bisa dipakai ulang antar-run.
- Browser utama project sekarang diset ke Chromium Playwright dengan `channel: "chrome"`. Jika perlu, Anda masih bisa override lewat `PLAYWRIGHT_BROWSER_EXECUTABLE_PATH`.
- Jika ingin benar-benar memakai login Chrome laptop Anda, arahkan `PLAYWRIGHT_USER_DATA_DIR` ke user data Chrome asli dan set `PLAYWRIGHT_CHROME_PROFILE_DIRECTORY`. Chrome biasa sebaiknya ditutup dulu sebelum script dijalankan agar profile tidak terkunci.
- Project sekarang juga akan melakukan check awal dan menghentikan proses lebih cepat jika profile Chrome harian masih sedang dipakai proses Chrome lain.
- Script ini default menjalankan browser dengan `headless: false`.
- Mode browser dan `slowMo` sekarang bisa diatur dari `.env` lewat `PLAYWRIGHT_HEADLESS` dan `PLAYWRIGHT_SLOW_MO`.
- Nama company default adalah `KSC`, tapi sekarang bisa diubah lewat `ACCURATE_COMPANY_NAME`.
- Beberapa label UI juga bisa dioverride dari `.env` kalau teks menu di akun Anda berbeda. Flow saat ini: `Reports -> Report List -> Financial -> Profit/Loss (Standard)`.
- Jika export memunculkan native `Save As` dialog, script akan mencoba menjalankan `scripts/windows/ksc-save-export.ahk`, tetapi fallback ini hanya untuk Windows.
- Default path AutoHotkey memakai path Windows. Override lewat `AHK_EXE_PATH` jika perlu.
- Di Linux/macOS, jika tidak ada event download dari Playwright dan yang muncul adalah native `Save As` dialog, file tidak bisa disimpan lewat fallback AutoHotkey ini.
