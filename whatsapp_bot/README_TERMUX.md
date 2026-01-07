# Panduan Menjalankan Bot 24 Jam di Termux

Karena **Termux:Boot** sudah tidak tersedia di Play Store (deprecated), berikut adalah solusinya.

## 1. Agar Bot Jalan 24 Jam Nonstop (Anti Tidur)
Fitur ini **TIDAK MEMERLUKAN** Termux:Boot. Cukup gunakan `Wake Lock`.
Script `setup_autostart.sh` yang saya buat sudah otomatis mengaktifkannya.

**Cara Cek:**
Lihat notifikasi bar HP Anda. Jika ada notifikasi **"Termux - Wake lock held"**, berarti Termux tidak akan dimatikan oleh Android meskipun layar mati. Bot aman 24 jam.

Jika belum muncul, ketik perintah ini di Termux:
```bash
termux-wake-lock
```

## 2. Agar Bot Jalan Otomatis Saat HP Restart (Autostart)
Ini yang membutuhkan **Termux:Boot**.

### Opsi A: Download dari F-Droid (Disarankan)
1. Buka browser, cari **"Termux:Boot F-Droid"**.
2. Download APK dan Install.
3. **PENTING**: Jika gagal install (muncul error "App not installed"), itu karena Termux utama Anda berasal dari Play Store. Android tidak mengizinkan pencampuran versi Play Store dan F-Droid.
   * **Solusi**: Abaikan saja fitur Autostart ini. Cukup jalankan manual setiap kali HP restart (lihat Opsi B). Jangan uninstall Termux lama jika tidak ingin setting ulang dari nol.

### Opsi B: Manual Start (Tanpa Termux:Boot)
Jika Anda tidak bisa menginstall Termux:Boot, tidak masalah!
Setiap kali HP Anda habis direstart/mati, cukup lakukan:
1. Buka Termux.
2. Ketik:
   ```bash
   pm2 resurrect
   ```
3. Bot akan kembali berjalan dengan status terakhir.

---

## Tips Tambahan
Agar Termux tidak dibunuh oleh sistem Android (Samsung/Xiaomi/Oppo sering mematikan aplikasi background):
1. Buka **Settings** HP -> **Apps** -> **Termux**.
2. Masuk ke **Battery**.
3. Pilih **Unrestricted** (atau "No Restrictions" / "Tidak Dibatasi").
