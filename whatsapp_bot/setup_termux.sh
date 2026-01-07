#!/bin/bash

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# API Key Anda (TERBARU)
MY_API_KEY="AIzaSyBfc1tICoazeRnQmd900KZj3qHNjyBcXw8"

echo -e "${GREEN}=== SETUP BUZZLAB BOT (AUTO UPDATE KEY) ===${NC}"

# 1. Update Repository
echo -e "${YELLOW}[1/3] Memastikan kode terbaru...${NC}"
git pull

# 2. Setup API Key Otomatis
echo -e "${YELLOW}[2/3] Menyimpan API Key Baru...${NC}"

# Hapus key lama di .env jika ada
if grep -q "GEMINI_API_KEY" .env 2>/dev/null; then
    sed -i '/GEMINI_API_KEY/d' .env
fi
# Masukkan key baru
echo "GEMINI_API_KEY=$MY_API_KEY" >> .env

# Hapus key lama di .bashrc jika ada
sed -i '/GEMINI_API_KEY/d' ~/.bashrc
# Masukkan key baru
echo "export GEMINI_API_KEY=\"$MY_API_KEY\"" >> ~/.bashrc

# Load key sekarang juga
export GEMINI_API_KEY="$MY_API_KEY"

echo -e "${GREEN}✅ API Key BERHASIL diupdate!${NC}"
echo "Key: ${MY_API_KEY:0:10}..."

# 3. Dependencies (Optional, buat jaga-jaga)
echo -e "${YELLOW}[3/3] Cek Dependencies...${NC}"
npm install

echo -e "${GREEN}=== SELESAI! ===${NC}"
echo "Silakan restart bot sekarang:"
echo "pm2 restart buzzlab"
