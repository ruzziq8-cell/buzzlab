#!/bin/bash
echo "=== SETUP BUZZLAB BOT UNTUK TERMUX ==="
echo "1. Mengupdate repository..."
git pull

echo "2. Menginstall Chromium (Browser)..."
pkg update -y
# Install repo tambahan yang mungkin dibutuhkan
pkg install tur-repo -y
pkg install x11-repo -y
# Update lagi setelah nambah repo
pkg update -y
# Install chromium
pkg install chromium -y

echo "3. Menginstall dependencies (tanpa download chrome bawaan)..."
export PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
npm install

echo "4. Menginstall PM2 (agar bot bisa jalan di background)..."
npm install -g pm2

echo "=== SELESAI! ==="
echo "Agar bot tetap jalan saat Termux ditutup:"
echo "1. Ketik: pm2 start index.js --name buzzlab"
echo "2. Ketik: pm2 save"
echo "3. Ketik: termux-wake-lock (agar tidak dimatikan HP)"
