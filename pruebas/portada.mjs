// LO QUE VE EL QUE ABRE EL ARCHIVO. Sin consola, sin comandos: la portada, el
// botón de la batalla, y lo primero que aparece en pantalla al elegirlo.
import { chromium } from 'playwright';
const nav = await chromium.launch({ executablePath: process.env.CHROMIUM,
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
const pag = await nav.newPage({ viewport: { width: 1100, height: 720 } });
const errs = []; pag.on('pageerror', e => errs.push(e.message));
await pag.goto('http://localhost:8099/index.html', { waitUntil: 'load' });
await pag.waitForTimeout(1400);
await pag.screenshot({ path: 'tropa/q-0-portada.png' });

// el botón de la batalla, como lo aprieta cualquiera
await pag.click('#modo-batalla');
// entre elegir la batalla y salir al campo está el plano de la maniobra
await pag.waitForSelector('#plano:not(.oculto)', { timeout: 10000 });
await pag.click('#plano-entrar');
await pag.waitForTimeout(2600);
await pag.screenshot({ path: 'tropa/q-1-formada.png' });
const antes = await pag.evaluate(() => ({
  columna: window.juego.pinza.oeste.montados,
  otra: window.juego.pinza.este.montados,
  realistas: window.juego.soldados.filter(s => s.esRealista && s.vivo).length,
  esperando: window.juego.pinza.sonando,
  draws: window.juego.info.calls
}));

// y el clarín, como lo toca cualquiera
await pag.keyboard.press('KeyT');
await pag.waitForTimeout(900);
await pag.evaluate(() => { for (let i = 0; i < 60 * 5; i++) window.juego.simular(1 / 60); });
await pag.waitForTimeout(1800);
await pag.screenshot({ path: 'tropa/q-2-salida.png' });
const dur = await pag.evaluate(() => ({ estado: window.juego.pinza.oeste.estado, tocado: window.juego.pinza.tocado }));

console.log('al elegir la batalla:', JSON.stringify(antes));
console.log('tras la T:          ', JSON.stringify(dur));
console.log(errs.length ? 'ERRORES: ' + errs.join(' / ') : 'sin errores');
await nav.close();
