@echo off
echo ==========================================
echo  DEPLOY TO SURGE (DUAL DOMAIN)
echo ==========================================
echo.
echo Pastikan Anda sudah login ke Surge.
echo Jika belum, Anda akan diminta memasukkan email dan password.
echo.
echo [1/2] Deploying to buzzlab-admin.surge.sh...
call npx surge . --domain buzzlab-admin.surge.sh
echo.
echo [2/2] Deploying to buzzlab.surge.sh...
call npx surge . --domain buzzlab.surge.sh
echo.
echo ==========================================
echo  DEPLOY SELESAI
echo ==========================================
pause
