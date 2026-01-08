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
2. Masuk ke folder bot:
   ```bash
   cd ~/buzzlab/whatsapp_bot
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

## 🟢 Langkah 2: Menjalankan Bot (Mode 24 Jam)
Setelah instalasi selesai, jalankan script ini agar bot jalan terus di background:

1. Masuk folder bot (jika belum):
   ```bash
   cd ~/buzzlab/whatsapp_bot
   ```
2. Jalankan script start:
   ```bash
   bash start_24h.sh
   ```
3. Cek log untuk scan QR Code:
   ```bash
   pm2 logs buzzlab
   ```
   *(Tekan `Ctrl+C` untuk keluar dari log)*

Bot sekarang sudah jalan 24 jam! Anda bisa menutup Termux.

---

## ⚡ Langkah 3: Autostart (Otomatis Nyala)
Agar bot otomatis hidup kembali saat Anda membuka Termux (misalnya setelah HP restart).

1. Jalankan script autostart:
   ```bash
   bash setup_autostart.sh
   ```

**Cara Kerja:**
- Saat HP baru nyala, **buka aplikasi Termux sebentar**.
- Bot akan otomatis "bangun" dan jalan lagi.
- Setelah itu Termux boleh ditutup.

---

## 🛡️ Langkah 4: Mencegah Bot Dimatikan Android (PENTING)
Agar bot tidak "dibunuh" oleh sistem HP saat layar mati, lakukan ini:

1. **Aktifkan Wakelock (Wajib):**
   - Tarik notifikasi bar HP Anda.
   - Cari notifikasi **Termux**.
   - Klik tombol **"Acquire Wakelock"**.
   - Pastikan tulisan berubah jadi *"Wake lock held"*.

2. **Matikan Penghemat Baterai untuk Termux:**
   - Buka **Pengaturan HP** -> **Aplikasi** -> **Termux**.
   - Pilih menu **Baterai**.
   - Pilih **"Tidak Dibatasi"** (Unrestricted) atau **"Jangan Optimalkan"**.

---

## 🛠️ Perintah Berguna Lainnya
- **Matikan Bot:** `pm2 stop buzzlab`
- **Restart Bot:** `pm2 restart buzzlab`
- **Lihat Status:** `pm2 status`
- **Lihat Error/Log:** `pm2 logs buzzlab`
