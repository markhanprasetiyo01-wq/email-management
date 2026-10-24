@echo off
title Game & Email Hub
echo ===================================================
echo     MEMULAI GAME & EMAIL HUB (LOCAL DEV SERVER)
echo ===================================================
echo.
cd /d "%~dp0"

echo Membuka browser ke http://localhost:5173/ ...
start http://localhost:5173/

echo Menjalankan Vite dev server...
call npm run dev

pause
