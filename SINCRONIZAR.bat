@echo off
chcp 65001 >nul
title Sincronizar - El clarin de San Lorenzo
cd /d "%~dp0"

rem Trae lo que hicieron las otras maquinas, rearma el juego y sube lo de esta.
rem Toda la logica esta en herramientas/sincronizar.mjs, que es donde se puede
rem leer y arreglar: aca solo se la llama.
where node >nul 2>&1
if errorlevel 1 (
  echo.
  echo   No esta Node instalado en esta maquina.
  echo   Sin Node se puede JUGAR (JUGAR.bat) pero no sincronizar.
  echo.
  pause
  exit /b 1
)

node herramientas/sincronizar.mjs

echo.
pause
