#!/bin/bash

GREEN='\033[0;32m'
NC='\033[0m'

echo -e "${GREEN}=== SETUP AUTOSTART (Saat Termux Dibuka) ===${NC}"

# 1. Cek file .bashrc (file konfigurasi terminal)
CONFIG_FILE="$HOME/.bashrc"

# 2. Cek apakah sudah ada perintah autostart
if grep -q "pm2 resurrect" "$CONFIG_FILE" 2>/dev/null; then
    echo "[i] Autostart sudah aktif di Termux Anda."
else
    echo "[+] Menambahkan perintah autostart..."
    # Tambahkan perintah untuk menghidupkan bot yang disimpan
    # >> /dev/null 2>&1 agar tidak muncul pesan error jika belum ada save
    echo "" >> "$CONFIG_FILE"
    echo "# Autostart Bot WhatsApp" >> "$CONFIG_FILE"
    echo "pm2 resurrect >> /dev/null 2>&1" >> "$CONFIG_FILE" 
    echo "[+] Berhasil!"
fi

echo ""
echo -e "${GREEN}✅ SELESAI!${NC}"
echo "---------------------------------------"
echo "Cara kerja:"
echo "1. Setelah HP Anda di-restart (mati lampu/habis baterai)."
echo "2. Cukup **BUKA APLIKASI TERMUX SEKALI**."
echo "3. Bot akan otomatis nyala sendiri."
echo "4. Anda boleh langsung tutup/minimize Termux lagi."
