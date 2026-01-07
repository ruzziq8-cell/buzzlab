#!/bin/bash

# Warna
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}=== SETUP BUZZLAB BOT UNTUK TERMUX (FULL AUTO) ===${NC}"
echo ""

# 1. Update Repo
echo -e "${YELLOW}[1/5] Mengupdate repository project...${NC}"
git pull

# 2. Setup API Key AI
echo -e "${YELLOW}[2/5] Konfigurasi AI (Google Gemini)...${NC}"
if [ -f .env ] && grep -q "GEMINI_API_KEY" .env; then
    echo -e "${GREEN}✅ API Key sudah terdeteksi di .env${NC}"
else
    echo "Masukkan Google Gemini API Key Anda (dari aistudio.google.com):"
    read -p "API Key > " API_KEY
    
    if [ ! -z "$API_KEY" ]; then
        # Simpan ke .env untuk pemakaian lokal
        echo "GEMINI_API_KEY=$API_KEY" >> .env
        
        # Simpan ke bashrc agar permanen di session terminal
        if ! grep -q "GEMINI_API_KEY" ~/.bashrc; then
            echo "export GEMINI_API_KEY=\"$API_KEY\"" >> ~/.bashrc
        fi
        
        echo -e "${GREEN}✅ API Key tersimpan.${NC}"
    else
        echo -e "${YELLOW}⚠️ API Key dikosongkan. Fitur AI tidak akan jalan.${NC}"
    fi
fi

# 3. Install Chromium
echo -e "${YELLOW}[3/5] Menginstall Chromium & System Deps...${NC}"
pkg update -y
pkg install tur-repo -y
pkg install x11-repo -y
pkg update -y
pkg install chromium -y

# 4. Install Node Modules
echo -e "${YELLOW}[4/5] Menginstall dependencies Bot...${NC}"
export PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
npm install

# 5. Setup PM2
echo -e "${YELLOW}[5/5] Setup Process Manager (PM2)...${NC}"
npm install -g pm2
pm2 stop buzzlab 2>/dev/null || true
pm2 delete buzzlab 2>/dev/null || true

echo ""
echo -e "${GREEN}=== INSTALASI SELESAI! ===${NC}"
echo "Cara Menjalankan Bot:"
echo "1. Ketik perintah ini untuk start:"
echo -e "   ${GREEN}pm2 start index.js --name buzzlab${NC}"
echo ""
echo "2. Scan QR Code yang muncul di layar."
echo "3. Cek log jika QR tidak muncul: pm2 logs buzzlab"
echo ""
echo "Tips: Agar jalan 24 jam nonstop, jalankan juga: bash setup_autostart.sh"
