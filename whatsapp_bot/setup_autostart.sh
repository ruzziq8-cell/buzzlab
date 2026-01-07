#!/bin/bash

# Warna output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== SETUP AUTOSTART TERMUX UNTUK BUZZLAB BOT ===${NC}"
echo ""

# 1. Cek & Setup Wake Lock
echo -e "${YELLOW}[1/4] Mengaktifkan Wake Lock...${NC}"
echo "Agar Termux tidak dimatikan Android saat layar mati."
if command -v termux-wake-lock &> /dev/null; then
    termux-wake-lock
    echo -e "${GREEN}✅ Wake Lock aktif.${NC}"
else
    echo -e "${RED}⚠️ Perintah 'termux-wake-lock' tidak ditemukan.${NC}"
    echo "Pastikan Anda menggunakan aplikasi Termux resmi."
fi
echo ""

# 2. Setup Folder Boot
echo -e "${YELLOW}[2/4] Menyiapkan Folder Boot...${NC}"
BOOT_DIR="$HOME/.termux/boot"
if [ ! -d "$BOOT_DIR" ]; then
    mkdir -p "$BOOT_DIR"
    echo -e "${GREEN}✅ Folder $BOOT_DIR dibuat.${NC}"
else
    echo -e "${GREEN}✅ Folder $BOOT_DIR sudah ada.${NC}"
fi

# 3. Buat Script Boot
echo -e "${YELLOW}[3/4] Membuat Script Autostart...${NC}"
BOOT_SCRIPT="$BOOT_DIR/start_buzzlab.sh"

# Mendapatkan path absolut ke folder project saat ini
CURRENT_DIR=$(pwd)

cat > "$BOOT_SCRIPT" <<EOF
#!/data/data/com.termux/files/usr/bin/sh
termux-wake-lock
export PATH=\$PATH:/data/data/com.termux/files/usr/bin

# Pindah ke folder project
cd "$CURRENT_DIR"

# Tunggu sebentar agar network siap (opsional)
sleep 5

# Jalankan PM2 resurrect
pm2 resurrect
EOF

chmod +x "$BOOT_SCRIPT"
echo -e "${GREEN}✅ Script boot dibuat di: $BOOT_SCRIPT${NC}"
echo ""

# 4. Simpan Proses PM2 Saat Ini
echo -e "${YELLOW}[4/4] Menyimpan Proses PM2...${NC}"
# Pastikan pm2 ada di path
if command -v pm2 &> /dev/null; then
    pm2 save
    echo -e "${GREEN}✅ List proses PM2 berhasil disimpan (Dumped).${NC}"
else
    echo -e "${RED}❌ PM2 tidak ditemukan!${NC}"
    echo "Silakan install pm2 dulu: npm install -g pm2"
    exit 1
fi

echo ""
echo -e "${GREEN}=== KONFIGURASI SELESAI ===${NC}"
echo ""
echo -e "${YELLOW}⚠️  PENTING: LANGKAH TERAKHIR YANG HARUS ANDA LAKUKAN MANUAL ⚠️${NC}"
echo "Agar script di atas berjalan otomatis saat HP Restart, Anda WAJIB:"
echo "1. Install aplikasi **Termux:Boot** dari F-Droid atau Play Store."
echo "2. Buka aplikasi **Termux:Boot** sekali saja."
echo "3. Matikan **Battery Optimization** untuk Termux (Settings -> Apps -> Termux -> Battery -> Unrestricted)."
echo ""
echo "Setelah itu, coba restart HP Anda. Bot harusnya jalan otomatis."
