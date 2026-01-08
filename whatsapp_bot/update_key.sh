#!/bin/bash
# Script Setup/Update .env Otomatis (Interactive)
# Jalankan dengan: bash update_key.sh

echo "=== SETUP ENV VARS ==="
echo "Masukkan API Keys Anda. Tekan Enter untuk skip (kosong)."

read -p "Gemini Key 1: " KEY1
read -p "Gemini Key 2: " KEY2
read -p "Cohere API Key: " COHERE
read -p "Hugging Face Token: " HF

# Buat file .env
cat > .env <<EOL
# AI Keys Configuration
# Gemini Pool (Load Balancing)
GEMINI_KEY_1=$KEY1
GEMINI_KEY_2=$KEY2

# Backup Providers
COHERE_API_KEY=$COHERE
HF_TOKEN=$HF
EOL

echo ""
echo "✅ File .env berhasil dibuat/diupdate!"
echo "Isi .env:"
cat .env
echo ""
echo "JANGAN LUPA: Restart bot dengan 'pm2 restart buzzlab' agar efeknya jalan."
