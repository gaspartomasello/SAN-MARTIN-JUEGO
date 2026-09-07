// Arma un único .html autocontenido: three.js y todos los módulos adentro.
// Sirve para probar el juego con doble clic, sin servidor ni instalación.
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';

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

// LAS DOS IMÁGENES VIAJAN ADENTRO.
// La foto de la portada y la lámina del plano. Si quedaran afuera, el .html
// dejaría de ser un solo archivo: a doble clic mostraría dos cuadros rotos, y
// en GitHub Pages directamente no estarían, porque el workflow sube
// _sitio/index.html y nada más. Si alguna no está en la carpeta no pasa nada
// grave: se le borra la referencia en vez de dejarla colgando —el archivo
// único se abre desde file:// y pediría un hermano que no existe—. Sin la
// portada se ve el amanecer de degradados que tiene abajo; sin la lámina, el
// plano queda oscuro y con la orden del día encima, que se sigue leyendo.
for (const [archivo, tipo] of [['portada.jpg', 'jpeg'], ['plano.webp', 'webp']]) {
  if (existsSync(archivo)) {
    const foto = readFileSync(archivo).toString('base64');
    html = html.replace(`url(${archivo})`, `url(data:image/${tipo};base64,${foto})`);
    console.log(`${archivo} · ${(foto.length / 1024 / 1.37).toFixed(0)} KB adentro`);
  } else {
    html = html.replace(`url(${archivo})`, 'none');
  }
}

mkdirSync(dirname(salida), { recursive: true });
writeFileSync(salida, html);
const kb = (Buffer.byteLength(html) / 1024).toFixed(0);
console.log(`${salida} · ${kb} KB · se abre con doble clic`);
