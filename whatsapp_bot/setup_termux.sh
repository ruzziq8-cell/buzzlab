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

echo "=== SELESAI! ==="
echo "Jalankan bot dengan perintah:"
echo "node index.js"
