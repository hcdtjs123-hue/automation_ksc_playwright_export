# KSC Playwright Export

Repo ini berisi automation Playwright untuk export report Accurate, pembuatan final summary Excel, dan opsi integrasi bot Telegram.

## Fokus Dokumen

Supaya dokumentasi tidak tumpang tindih, setiap file punya fokus masing-masing:

- `README.md`: overview repo, struktur folder, dan peta dokumentasi
- `docs/README.md`: index dokumentasi operasional dan teknis
- `docs/HOW_TO_RUN.md`: cara menjalankan project di local dan env apa saja yang perlu diubah
- `docs/HOW_TO_CREATE_BOT_TELEGRAM.md`: cara membuat bot Telegram lewat BotFather
- `docs/HOW_TO_RUN_BOT_TELEGRAM.md`: dokumentasi teknis service bot Telegram webhook
- `docs/HOW_TO_DEPLOY_BOT_TELEGRAM_RAILWAY.md`: deploy bot Telegram webhook ke Railway
- `docs/HOW_TO_INTEGRATE_BOT_TELEGRAM.md`: kontrak integrasi antara bot Telegram dan flow `custom`

Kalau tujuan Anda adalah menjalankan project di laptop sendiri, mulai dari `docs/HOW_TO_RUN.md`.

## Mode Utama

Repo ini punya 3 jalur utama:

- `pnpm start`: flow utama export `daily -> mtd -> ytd -> multi period`, lalu generate final summary
- `pnpm run custom:start`: flow custom dengan urutan export dari `.env.custom` atau file JSON
- `pnpm run bot:start`: service bot Telegram webhook untuk menjalankan flow custom

## Struktur Ringkas

- `src/`: flow utama export dan builder final summary
- `src_custom/`: flow export custom berbasis plan/env/JSON runtime params
- `src_bot/`: service bot Telegram, auth user, parser command, dan runner custom export
- `scripts/doctor.js`: checker environment sebelum run
- `scripts/windows/ksc-save-export.ahk`: fallback native save dialog di Windows
- `contoh/`: sample file Excel hasil export/final report untuk referensi manual
- `legacy/`: salinan file awal sebelum repo dirapikan

## Folder `contoh/`

Folder `contoh/` berisi sample file Excel hasil export atau final report.

Folder ini dipakai sebagai:

- referensi bentuk output akhir
- bahan pengecekan visual/manual saat ada perubahan format report atau summary
- pembanding cepat terhadap hasil run baru

Catatan:

- file di folder ini tidak dibaca oleh script saat runtime
- folder ini hanya untuk referensi manual
- isi folder bisa berubah mengikuti kebutuhan testing atau perubahan format output

## Alur Baca Kode

Kalau ingin memahami repo dari kode, urutan baca yang paling masuk akal:

1. `src/ksc-export.js`
2. `src/date.js`
3. `src/ksc-actions/`
4. `src/final-report/`
5. `src_custom/ksc-export.js`
6. `src_custom/runtime-params.js`
7. `src_bot/server.js`
8. `src_bot/export-runner.js`

## Command Ringkas

Command yang paling sering dipakai:

```bash
pnpm install
pnpm run install:browsers
pnpm run doctor
pnpm start
pnpm run custom:start
pnpm run bot:start
pnpm test
```
