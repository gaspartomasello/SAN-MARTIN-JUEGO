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

// LA FOTO DE LA PORTADA VIAJA ADENTRO.
// Es la única imagen del juego, y si quedara afuera el .html dejaría de ser un
// solo archivo: a doble clic mostraría un cuadro roto, y en GitHub Pages
// directamente no estaría, porque el workflow sube _sitio/index.html y nada
// más. Si el archivo no está en la carpeta no pasa nada malo: debajo de la
// foto la portada tiene un amanecer hecho con degradados, y eso es lo que se ve.
if (existsSync('portada.jpg')) {
  const foto = readFileSync('portada.jpg').toString('base64');
  html = html.replace('url(portada.jpg)', `url(data:image/jpeg;base64,${foto})`);
  console.log(`portada.jpg · ${(foto.length / 1024 / 1.37).toFixed(0)} KB adentro`);
} else {
  // Y si no está, se borra la referencia en vez de dejarla colgando: el archivo
  // único se abre desde file:// y pediría un archivo hermano que no existe.
  // Se vería igual —abajo está el amanecer— pero con un error en la consola.
  html = html.replace('url(portada.jpg)', 'none');
}

mkdirSync(dirname(salida), { recursive: true });
writeFileSync(salida, html);
const kb = (Buffer.byteLength(html) / 1024).toFixed(0);
console.log(`${salida} · ${kb} KB · se abre con doble clic`);
