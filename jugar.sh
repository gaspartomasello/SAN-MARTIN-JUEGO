#!/bin/sh
# El clarín de San Lorenzo · abrir el juego con un solo golpe.
# El equivalente de JUGAR.bat para macOS y Linux.
cd "$(dirname "$0")" || exit 1

echo
echo "  EL CLARÍN DE SAN LORENZO"
echo "  =========================================="
echo

printf '  Buscando novedades... '
if git pull --ff-only >/dev/null 2>&1; then echo "al día"; else echo "sin actualizar, se juega igual"; fi

if [ ! -f clarin-san-lorenzo.html ]; then
  echo
  echo "  NO ESTÁ EL ARCHIVO DEL JUEGO. Se arma con:  npm run empaquetar"
  echo
  exit 1
fi

echo "  Abriendo el juego en el navegador..."
if command -v open >/dev/null 2>&1; then open clarin-san-lorenzo.html
elif command -v xdg-open >/dev/null 2>&1; then xdg-open clarin-san-lorenzo.html
else echo "  Abrilo a mano: clarin-san-lorenzo.html"; fi
