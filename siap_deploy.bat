@echo off
echo ==========================================
echo  BANTUAN DEPLOY BUZZLAB
echo ==========================================

REM Cek apakah git terinstall
git --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Git belum terinstall!
    echo Silakan install Git terlebih dahulu dari https://git-scm.com/downloads
    echo Setelah install, tutup dan buka kembali terminal ini.
    pause
    exit /b
)

echo Menginisialisasi Git...
git init
git add .
git commit -m "Siap deploy ke Railway: BuzzLab Bot + Web"

echo.
echo ==========================================
echo  LANGKAH SELANJUTNYA (PENTING!)
echo ==========================================
echo 1. Buka https://github.com/new dan buat repository baru (Public/Private bebas).
echo 2. Salin URL repository tersebut (contoh: https://github.com/username/buzzlab.git).
echo 3. Jalankan perintah berikut di terminal ini (ganti URL-nya):
echo.
echo    git remote add origin <URL_REPO_GITHUB_ANDA>
echo    git branch -M main
echo    git push -u origin main
echo.
echo ==========================================
echo  SETELAH UPLOAD KE GITHUB SELESAI:
echo ==========================================
echo 1. Buka https://railway.app dan Login/Register (bisa pakai akun GitHub).
echo 2. Klik "New Project" -> "Deploy from GitHub repo".
echo 3. Pilih repository "buzzlab" yang baru saja Anda upload.
echo 4. Railway akan otomatis mendeteksi Dockerfile dan mulai deploy.
echo 5. Tunggu proses selesai, lalu cek Logs di Railway untuk scan QR Code bot.
echo.
pause
