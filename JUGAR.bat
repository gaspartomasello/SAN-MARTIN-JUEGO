@echo off
chcp 65001 >nul
title El clarin de San Lorenzo
cd /d "%~dp0"

echo.
echo   EL CLARIN DE SAN LORENZO
echo   ==========================================
echo.

rem Si hay internet y git, se trae lo ultimo. Si no, se juega con lo que hay:
rem nunca se cuelga por no poder actualizar.
echo   Buscando novedades...
git pull --ff-only >nul 2>&1
if errorlevel 1 (
  echo   [ sin actualizar - sin internet o sin git. Se juega igual ]
) else (
  echo   [ al dia ]
)
echo.

if not exist "clarin-san-lorenzo.html" (
  echo   NO ESTA EL ARCHIVO DEL JUEGO.
  echo.
  echo   Se arma con:   npm run empaquetar
  echo.
  pause
  exit /b 1
)

echo   Abriendo el juego en el navegador...
echo.
echo   Adentro: elegis "El clarin", haces clic en la pantalla para que el
echo   navegador te entregue el mouse, y con Esc lo soltas.
echo.
start "" "clarin-san-lorenzo.html"

rem La ventana se cierra sola en dos segundos: el juego ya esta abierto aparte.
timeout /t 2 >nul
