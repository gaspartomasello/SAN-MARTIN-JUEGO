#!/bin/sh
# Doble clic en Mac. En Linux: darle permiso de ejecucion y abrirlo.
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  echo
  echo "  Falta Node.js, que es lo unico que hace falta instalar."
  echo "  Bajalo de https://nodejs.org  —  la opcion LTS."
  echo
  read -r _ 
  exit 1
fi
node herramientas/servidor.mjs
echo
echo "  La sala se cerro."
read -r _
