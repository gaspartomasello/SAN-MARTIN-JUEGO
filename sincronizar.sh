#!/bin/sh
# Trae lo de las otras máquinas, rearma el juego y sube lo de ésta.
# El equivalente de SINCRONIZAR.bat para macOS y Linux.
cd "$(dirname "$0")" || exit 1
command -v node >/dev/null 2>&1 || { echo "Falta Node en esta máquina."; exit 1; }
node herramientas/sincronizar.mjs
