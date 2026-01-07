@echo off
echo ==========================================
echo  DEPLOY TO SURGE (WEBSITE & ADMIN PANEL)
echo ==========================================
echo.
echo Pastikan Anda sudah login ke Surge.
echo Jika belum, Anda akan diminta memasukkan email dan password.
echo.
echo Domain saran: buzzlab-admin.surge.sh (atau biarkan random)
echo.
call npx surge .
echo.
echo ==========================================
echo  DEPLOY SELESAI
echo ==========================================
pause
