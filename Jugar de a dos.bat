@echo off
chcp 65001 >nul
title El clarin de San Lorenzo - sala de dos
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   Falta Node.js, que es lo unico que hace falta instalar.
  echo   Bajalo de https://nodejs.org  -  la opcion LTS, siguiente siguiente.
  echo   Despues volve a hacer doble clic en este archivo.
  echo.
  pause
  exit /b 1
)

node herramientas\servidor.mjs
echo.
echo   La sala se cerro.
pause
