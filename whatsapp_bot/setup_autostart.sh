#!/bin/bash

GREEN='\033[0;32m'
NC='\033[0m'

echo -e "${GREEN}=== SETUP AUTOSTART 24 JAM (Termux:Boot) ===${NC}"

# Cek apakah user sudah install Termux:Boot
if [ ! -d "$HOME/.termux/boot" ]; then
    echo "[+] Membuat folder boot..."
    mkdir -p "$HOME/.termux/boot"
fi

echo "[+] Membuat script boot..."

# Buat script start_bot.sh di folder boot
cat > "$HOME/.termux/boot/start_bot.sh" << 'EOF'
#!/data/data/com.termux/files/usr/bin/sh

termux-wake-lock
sshd

cd ~/buzzlab/whatsapp_bot

if command -v pm2 >/dev/null 2>&1; then
  pm2 resurrect || pm2 start index.js --name buzzlab --max-memory-restart 500M --time
  pm2 save
fi
EOF

chmod +x "$HOME/.termux/boot/start_bot.sh"

echo -e "${GREEN}✅ SCRIPT AUTOSTART BERHASIL DIBUAT!${NC}"
echo ""
echo "---------------------------------------"
echo "⚠️  SYARAT AGAR BERJALAN OTOMATIS SAAT HP RESTART:"
echo "1. Pastikan Anda sudah menginstall aplikasi **Termux:Boot** dari F-Droid atau Play Store."
echo "2. Buka aplikasi Termux:Boot sekali saja."
echo "3. Matikan optimasi baterai untuk Termux & Termux:Boot di pengaturan HP."
echo "4. Berikan izin 'Autostart' (Mulai Otomatis) jika ada di pengaturan HP (biasanya di Xiaomi/Oppo/Vivo)."
echo ""
echo "Cara kerja:"
echo "- Saat HP nyala kembali, script ini akan otomatis berjalan di background."
echo "- Anda TIDAK PERLU membuka aplikasi Termux lagi."
echo "---------------------------------------"
