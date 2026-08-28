// Abre el juego armado en el navegador que tenga puesto el sistema.
//
// Existe para que `npm run jugar` sea UN comando en las tres plataformas: sin
// esto habría que acordarse de `start` en Windows, `open` en macOS y
// `xdg-open` en Linux, que es exactamente la clase de fricción que hace que uno
// termine no probando el juego.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const archivo = resolve(process.argv[2] || 'clarin-san-lorenzo.html');
if (!existsSync(archivo)) {
  console.error(`No está ${archivo}. Se arma con: npm run empaquetar`);
  process.exit(1);
}

const orden = process.platform === 'win32' ? ['cmd', ['/c', 'start', '', archivo]]
  : process.platform === 'darwin' ? ['open', [archivo]]
  : ['xdg-open', [archivo]];

const p = spawn(orden[0], orden[1], { detached: true, stdio: 'ignore' });
p.on('error', () => console.log(`Abrilo a mano: ${archivo}`));
p.unref();
console.log(`Abriendo ${archivo}`);
