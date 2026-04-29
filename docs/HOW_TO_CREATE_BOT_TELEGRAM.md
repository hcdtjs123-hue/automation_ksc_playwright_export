# HOW TO CREATE BOT TELEGRAM

Dokumen ini khusus untuk membuat bot Telegram yang akan dipakai oleh service webhook di project ini.

Dokumen lain:

- `../README.md`: overview repo
- `HOW_TO_RUN_BOT_TELEGRAM.md`: cara menjalankan service bot Telegram webhook
- `HOW_TO_DEPLOY_BOT_TELEGRAM_RAILWAY.md`: deploy bot Telegram ke Railway

## 1. Buat Bot Lewat BotFather

Bot dibuat lewat akun resmi `@BotFather` di Telegram.

Langkah dasarnya:

1. buka Telegram lalu cari `@BotFather`
2. kirim command `/start`
3. kirim command `/newbot`
4. masukkan nama bot yang ingin ditampilkan ke user
5. masukkan username bot yang harus diakhiri dengan kata `bot`, misalnya `ksc_export_bot`
6. BotFather akan mengembalikan `TELEGRAM_BOT_TOKEN`

Contoh hasil yang Anda perlukan:

```env
TELEGRAM_BOT_TOKEN=123456:ABCDEF
```

Token ini dipakai oleh service bot di environment variable `TELEGRAM_BOT_TOKEN`.

## 2. Pengaturan Bot yang Umum Dipakai

Setelah bot dibuat, biasanya Anda juga ingin mengatur:

- foto profil bot
- deskripsi bot
- about text bot
- command list bot

Command BotFather yang sering dipakai:

```text
/setuserpic
/setdescription
/setabouttext
/setcommands
```

Contoh command list:

```text
start - mulai verifikasi bot
help - lihat bantuan command
status - cek apakah ada export yang sedang berjalan
whoami - lihat identitas user yang terverifikasi
export - jalankan export report
```

## 3. Token dan Keamanan

Catatan penting:

- jangan commit `TELEGRAM_BOT_TOKEN` ke repo
- simpan token di env atau secret manager
- kalau token bocor, rotate lewat BotFather dengan membuat token baru
- username bot dipakai user untuk mencari bot di Telegram, tetapi service tetap mengandalkan token dan webhook

## 4. Langkah Berikutnya

Setelah bot berhasil dibuat:

1. isi `TELEGRAM_BOT_TOKEN` di environment variable
2. buat `TELEGRAM_WEBHOOK_SECRET`
3. siapkan `TELEGRAM_ALLOWED_PHONES`
4. jalankan service sesuai `HOW_TO_RUN_BOT_TELEGRAM.md`
5. kalau mau deploy ke Railway, lanjut ke `HOW_TO_DEPLOY_BOT_TELEGRAM_RAILWAY.md`
