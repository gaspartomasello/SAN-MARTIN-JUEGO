// Descanso y encare, uno al lado del otro: el gesto de apuntar tiene que
// leerse igual de lejos que de cerca.
import { chromium } from 'playwright';
const nav = await chromium.launch({ executablePath: process.env.CHROMIUM,
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
const pag = await nav.newPage({ viewport: { width: 1000, height: 560 } });
const errs = []; pag.on('pageerror', e => errs.push(e.message));
await pag.goto('http://localhost:8099/index.html', { waitUntil: 'load' });
await pag.waitForTimeout(1200); await pag.click('#empezar'); await pag.waitForTimeout(2200);
await pag.evaluate(() => {
  const j = window.juego;
  for (const s of j.soldados.slice()) s.quitar(); j.soldados.length = 0;
  for (const c of j.caballos.slice()) c.quitar(); j.caballos.length = 0;
  j.jugador.pos.set(0, 1.7, 0); j.jugador.yaw = 0; j.jugador.pitch = 0.0;
  j.armas.tercerola.visible = false;
  const lej = j.lejania;
  lej.comenzar();
  const fases = [0, 5, 4, 1];
  fases.forEach((f, i) => lej.poner('realista', f, -2.4 + i * 1.6, 0, -5.5, Math.PI + 0.7));
  lej.terminar();
  lej.comenzar = () => {}; lej.terminar = () => {};
});
await pag.waitForTimeout(1200);
await pag.screenshot({ path: 'tropa/lod-fases.png' });
console.log('firme · apuntar · rodilla · paso', errs.length ? 'ERRORES: ' + errs.join(' / ') : '· sin errores');
await nav.close();
