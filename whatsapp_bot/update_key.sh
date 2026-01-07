#!/bin/bash
# Script Khusus Update API Key
# Jalankan dengan: bash update_key.sh

NEW_KEY="AIzaSyBfc1tICoazeRnQmd900KZj3qHNjyBcXw8"

echo "=== UPDATING API KEY ==="
echo "Key Baru: $NEW_KEY"

# 1. Update .env
if [ -f .env ]; then
    # Hapus baris lama
    grep -v "GEMINI_API_KEY" .env > .env.tmp
    mv .env.tmp .env
fi
echo "GEMINI_API_KEY=$NEW_KEY" >> .env
echo "✅ Updated .env"

# 2. Update .bashrc
grep -v "GEMINI_API_KEY" ~/.bashrc > ~/.bashrc.tmp
mv ~/.bashrc.tmp ~/.bashrc
echo "export GEMINI_API_KEY=\"$NEW_KEY\"" >> ~/.bashrc
echo "✅ Updated ~/.bashrc"

# 3. Load langsung ke memory session ini
export GEMINI_API_KEY="$NEW_KEY"

echo "=== SELESAI ==="
echo "Sekarang jalankan: pm2 restart buzzlab"
