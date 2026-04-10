# Custom Export Flow

Folder `src_custom/` dipakai untuk flow export yang urutannya tidak hardcoded seperti `daily -> mtd -> ytd`.

Di sini urutan export ditentukan oleh env `CUSTOM_EXPORT_PLAN`.

Kalau flow ini akan disambungkan ke bot Telegram, lihat juga:
- `src_custom/TELEGRAM_INTEGRATION.md`

## File Env Yang Dibaca

Flow custom membaca env dengan urutan ini:
1. `.env`
2. `.env.custom`
3. parameter CLI JSON

Kalau `.env.custom` ada, nilainya akan override `.env`.

Jadi untuk custom flow, yang disarankan:
- biarkan `.env` untuk config umum seperti login, browser, company
- simpan plan custom dan tanggal custom di `.env.custom`

`src_custom/CUSTOM_EXPORT_PLAN.example.env` hanya file contoh, bukan file yang otomatis dibaca runtime.

## Input Via Parameter

Selain lewat `.env.custom`, flow custom juga bisa menerima parameter runtime.

Contoh:

```bash
pnpm run custom:start -- --params='{
  "exportPlan": [
    { "type": "daily", "date": "01/04/2026" },
    { "type": "daily", "date": "02/04/2026" },
    { "type": "daily", "date": "04/04/2026" },
    { "type": "monthly", "startDate": "01/04/2026", "endDate": "30/04/2026" },
    { "type": "yearly", "startDate": "01/01/2026", "endDate": "30/04/2026" }
  ],
  "multiPeriod": {
    "fromMonth": "May",
    "fromYear": "2026",
    "toMonth": "June",
    "toYear": "2026"
  }
}'
```

Atau lewat file JSON:

```bash
pnpm run custom:start -- --params-file=./src_custom/runtime-params.example.json
```

Aturan parameter:
- `exportPlan` berupa array
- `type` mendukung `daily`, `monthly`, `yearly` atau alias `d`, `m`, `y`
- untuk `daily`, isi `date`
- untuk `monthly` dan `yearly`, isi `startDate` dan `endDate`
- `key` opsional
- kalau `key` tidak diisi, sistem akan otomatis membuat `DAILY_1`, `MONTHLY_1`, `YEARLY_1`
- `multiPeriod` opsional
- payload juga boleh hanya berisi `multiPeriod` saja
- `outputDir` opsional
- `result.mode` opsional: `files` atau `zip`

Prioritas override:
- parameter CLI menang terhadap `.env.custom`
- `.env.custom` menang terhadap `.env`

Contoh payload dengan output per request:

```json
{
  "requestId": "telegram-001",
  "chatId": "123456789",
  "outputDir": "./output/playwright/telegram/run-001",
  "result": {
    "mode": "zip"
  },
  "exportPlan": [
    { "type": "daily", "date": "01/04/2026" }
  ]
}
```

## Format Plan

`CUSTOM_EXPORT_PLAN` menerima daftar job yang dipisahkan dengan `;`.

Tipe yang didukung:
- `daily(...)` atau `d(...)`
- `monthly(...)` atau `m(...)`
- `yearly(...)` atau `y(...)`

Contoh:

```env
CUSTOM_EXPORT_PLAN=d(DAILY_1);d(DAILY_2);d(DAILY_3);m(MONTHLY_1);y(YEARLY_1)
```

Artinya flow akan jalan sesuai urutan itu:
1. `daily(DAILY_1)`
2. `daily(DAILY_2)`
3. `daily(DAILY_3)`
4. `monthly(MONTHLY_1)`
5. `yearly(YEARLY_1)`

## Env Per Tipe

### Daily

`daily(KEY)` atau `d(KEY)` memakai satu tanggal:

```env
CUSTOM_DAILY_1_DATE=01/04/2026
CUSTOM_DAILY_2_DATE=02/04/2026
CUSTOM_DAILY_3_DATE=04/04/2026
```

Kalau plan berisi `d(DAILY_2)`, maka env yang dicari adalah:

```env
CUSTOM_DAILY_2_DATE=02/04/2026
```

### Monthly

`monthly(KEY)` atau `m(KEY)` memakai range:

```env
CUSTOM_MONTHLY_1_START_DATE=01/04/2026
CUSTOM_MONTHLY_1_END_DATE=30/04/2026
```

Kalau plan berisi `m(MONTHLY_1)`, maka env yang dicari adalah:

```env
CUSTOM_MONTHLY_1_START_DATE=01/04/2026
CUSTOM_MONTHLY_1_END_DATE=30/04/2026
```

### Yearly

`yearly(KEY)` atau `y(KEY)` juga memakai range:

```env
CUSTOM_YEARLY_1_START_DATE=01/01/2026
CUSTOM_YEARLY_1_END_DATE=30/04/2026
```

## Contoh Lengkap

```env
CUSTOM_EXPORT_PLAN=d(DAILY_1);d(DAILY_2);d(DAILY_3);m(MONTHLY_1);y(YEARLY_1)

CUSTOM_DAILY_1_DATE=01/04/2026
CUSTOM_DAILY_2_DATE=02/04/2026
CUSTOM_DAILY_3_DATE=04/04/2026

CUSTOM_MONTHLY_1_START_DATE=01/04/2026
CUSTOM_MONTHLY_1_END_DATE=30/04/2026

CUSTOM_YEARLY_1_START_DATE=01/01/2026
CUSTOM_YEARLY_1_END_DATE=30/04/2026
```

File label yang dihasilkan akan otomatis mengikuti tipe job:
- `ksc_custom_daily_1_2026-04-01.xlsx`
- `ksc_custom_monthly_1_2026-04-01_to_2026-04-30.xlsx`
- `ksc_custom_yearly_1_2026-01-01_to_2026-04-30.xlsx`

Prefix custom default:

```env
ACCURATE_CUSTOM_EXPORT_FILE_PREFIX=ksc_custom_
```

Kalau env di atas kosong, fallback-nya adalah:

```env
ACCURATE_EXPORT_FILE_PREFIX + custom_
```

Contoh:
- `ACCURATE_EXPORT_FILE_PREFIX=ksc_` -> prefix custom jadi `ksc_custom_`
- `ACCURATE_CUSTOM_EXPORT_FILE_PREFIX=mycustom_` -> semua file custom mulai dengan `mycustom_`

## Multi Period

`multi period` saat ini tidak masuk ke `CUSTOM_EXPORT_PLAN`.

Perilakunya:
- kalau env multi period kosong semua, flow multi period dilewati
- kalau env multi period diisi lengkap, flow multi period dijalankan setelah semua job di `CUSTOM_EXPORT_PLAN` selesai
- kalau payload parameter hanya berisi `multiPeriod`, maka script akan menjalankan multi period saja

Env yang dipakai:

```env
MULTI_PERIOD_ACCURATE_FROM_MONTH=February
MULTI_PERIOD_ACCURATE_FROM_YEAR=2026
MULTI_PERIOD_ACCURATE_TO_MONTH=April
MULTI_PERIOD_ACCURATE_TO_YEAR=2026
```

Kalau hanya sebagian diisi, script akan fail karena konfigurasi dianggap setengah jadi.

## Final Summary

Final summary workbook hanya dibuat kalau semua syarat ini terpenuhi:
- ada minimal satu job `daily`
- ada minimal satu job `monthly`
- ada minimal satu job `yearly`
- multi period aktif dan berhasil diexport

Kalau salah satu tidak ada, export tetap jalan, tetapi final summary akan dilewati dengan log yang jelas.

Contoh multi period only:

```bash
pnpm run custom:start -- --params-file=./params-multi-period-only.json
```

## Hasil Run

Setelah run selesai, script custom akan membuat manifest JSON di output directory.

Isi manifest mencakup:
- daftar file hasil export
- file multi period kalau ada
- final summary kalau ada
- bundle zip kalau mode `zip`
- metadata request seperti `chatId` dan `requestId`

Script juga akan mencetak satu baris log:

```text
RUN_RESULT_JSON=...
```

Baris ini bisa diparse oleh bot Telegram untuk mengambil daftar file yang harus dikirim ke chat.

## Catatan

- Format tanggal tetap `DD/MM/YYYY`
- Nama key di dalam plan bebas, selama cocok dengan env yang Anda isi
- Contoh valid:
  - `d(DAILY_1)`
  - `d(HARI_2)`
  - `m(APRIL_1)`
  - `y(TAHUN_2026)`
