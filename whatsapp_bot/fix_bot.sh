#!/bin/bash

GREEN='\033[0;32m'
NC='\033[0m'

echo -e "${GREEN}=== MEMPERBAIKI ERROR 'SingletonLock' ===${NC}"

# Pastikan di folder yang benar
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

# 1. Matikan bot di PM2
echo "[+] Mematikan bot sementara..."
pm2 stop buzzlab

# 2. Hapus file Lock yang membuat error
# Error: Failed to create .../SingletonLock: File exists
echo "[+] Membersihkan file yang nyangkut..."
rm -rf .wwebjs_auth/session-buzzlab_bot_v2/SingletonLock
rm -rf .wwebjs_auth/session-buzzlab_bot_v2/SingletonCookie
rm -rf .wwebjs_auth/session-buzzlab_bot_v2/SingletonSocket

# 3. Matikan paksa proses Chrome/Chromium yang mungkin masih jalan sembunyi-sembunyi
echo "[+] Mematikan sisa proses Chrome..."
pkill -f chrome 2>/dev/null
pkill -f chromium 2>/dev/null

# 4. Nyalakan ulang
echo "[+] Menyalakan bot kembali..."
pm2 restart buzzlab

echo ""
echo -e "${GREEN}✅ PERBAIKAN SELESAI!${NC}"
echo "Silakan cek log lagi: pm2 logs buzzlab"
