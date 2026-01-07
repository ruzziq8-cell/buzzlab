#!/bin/bash

echo "🛑 Mematikan semua proses PM2..."
pm2 delete all
pm2 flush
pm2 kill

echo "⬇️ Mengambil update terbaru..."
git pull

echo "🚀 Menyalakan ulang BuzzLab..."
pm2 start index.js --name buzzlab --time

echo "💾 Menyimpan konfigurasi PM2..."
pm2 save

echo "✅ Selesai! Cek logs dengan: pm2 logs buzzlab"
