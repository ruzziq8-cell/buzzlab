# 🤖 Panduan Lengkap Menjalankan BuzzLab Bot di Termux

Ini adalah panduan step-by-step untuk menjalankan bot WhatsApp BuzzLab di HP Android menggunakan Termux.

## 📋 Persiapan Awal
1. **Download Termux** (Disarankan versi F-Droid, bukan Play Store).
2. **Punya API Key Gemini** (Untuk fitur AI). Ambil gratis di: [Google AI Studio](https://aistudio.google.com/app/apikey).
3. **Koneksi Internet** yang stabil.

---

## 🚀 Langkah 1: Instalasi Otomatis
Saya sudah menyiapkan script otomatis. Anda hanya perlu menjalankan satu perintah.

1. Buka Termux.
2. Masuk ke folder bot (folder "buzzlab"):
   ```bash
   cd ~/buzzlab
   ```
3. Jalankan script setup:
   ```bash
   bash setup_termux.sh
   ```
4. Ikuti instruksi di layar:
   - Script akan otomatis mengupdate sistem.
   - Script akan meminta **API Key Gemini** Anda. Paste key-nya lalu tekan Enter.
   - Tunggu proses instalasi selesai (bisa 5-10 menit tergantung internet).

---

## 🟢 Langkah 2: Menjalankan Bot
Setelah instalasi selesai, saatnya menyalakan bot.

1. Jalankan perintah start:
   ```bash
   pm2 start index.js --name buzzlab
   ```
2. Tunggu sebentar, lalu cek apakah QR Code sudah muncul. Biasanya muncul di log:
   ```bash
   pm2 logs buzzlab
   ```
   *(Tekan `Ctrl+C` untuk keluar dari tampilan log. Bot tetap jalan di background)*
3. Scan QR Code menggunakan WhatsApp di HP Anda (Linked Devices).

---

## ⚡ Langkah 3: Membuat Bot Jalan 24 Jam (Autostart)
Agar bot tidak mati saat layar HP mati atau setelah HP direstart.

1. Jalankan script autostart:
   ```bash
   bash setup_autostart.sh
   ```
2. Jika diminta akses notifikasi/baterai, izinkan.
3. Periksa notifikasi bar HP Anda. Pastikan ada tulisan **"Termux - Wake lock held"**.

### ⚠️ Penting: Jika HP Direstart
Karena Termux:Boot kadang bermasalah di beberapa HP, jika HP Anda mati/restart, lakukan ini untuk menghidupkan bot lagi:

1. Buka Termux.
2. Ketik:
   ```bash
   pm2 resurrect
   ```
3. Selesai! Bot kembali online.

---

## 🛠️ Perintah Berguna Lainnya
- **Matikan Bot:** `pm2 stop buzzlab`
- **Restart Bot:** `pm2 restart buzzlab`
- **Lihat Status:** `pm2 status`
- **Lihat Error/Log:** `pm2 logs buzzlab`
