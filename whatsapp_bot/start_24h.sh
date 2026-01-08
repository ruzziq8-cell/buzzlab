#!/bin/bash

GREEN='\033[0;32m'
NC='\033[0m'

echo -e "${GREEN}=== MENJALANKAN BOT 24 JAM (BACKGROUND) ===${NC}"

# 1. Install PM2 jika belum ada
if ! command -v pm2 &> /dev/null; then
    echo "[+] Menginstall PM2 (Process Manager)..."
    npm install -g pm2
else
    echo "[+] PM2 sudah terinstall."
fi

# 2. Pastikan berada di folder yang benar
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

# 3. Hapus proses lama jika ada (biar fresh & update code terbaru)
pm2 delete buzzlab 2>/dev/null

# 4. Jalankan Bot
echo "[+] Menyalakan Bot..."
# --time: Tampilkan jam di log
# --max-memory-restart 500M: Restart otomatis jika RAM > 500MB (Hemat memori HP)
pm2 start index.js --name buzzlab --max-memory-restart 500M --time

# 5. Simpan status agar aman
pm2 save

echo ""
echo -e "${GREEN}✅ SUKSES! BOT SUDAH JALAN 24 JAM.${NC}"
echo "---------------------------------------"
echo "Perintah berguna:"
echo "👉 pm2 logs       : Lihat QR Code / Aktivitas"
echo "👉 pm2 status     : Cek status bot"
echo "👉 pm2 restart buzzlab : Restart bot"
echo ""
echo "Sekarang Anda bisa menutup aplikasi Termux."
