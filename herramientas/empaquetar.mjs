// Arma un único .html autocontenido: three.js y todos los módulos adentro.
// Sirve para probar el juego con doble clic, sin servidor ni instalación.
import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';

const salida = process.argv[2] || 'clarin-san-lorenzo.html';

const r = await build({
  entryPoints: ['src/main.js'],
  bundle: true,
  format: 'esm',
  target: 'es2020',
  write: false,
  legalComments: 'none'
});
const paquete = r.outputFiles[0].text;

let html = readFileSync('index.html', 'utf8');
html = html
  .replace(/<script type="importmap">[\s\S]*?<\/script>\s*/, '')
  .replace('<script type="module" src="./src/main.js"></script>',
    '<script type="module">\n' + paquete + '\n</script>');

writeFileSync(salida, html);
const kb = (Buffer.byteLength(html) / 1024).toFixed(0);
console.log(`${salida} · ${kb} KB · se abre con doble clic`);
