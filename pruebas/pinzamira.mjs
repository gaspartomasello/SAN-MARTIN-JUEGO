// La pinza con los números reales, mirada desde adentro de la columna.
import { chromium } from 'playwright';
const nav = await chromium.launch({ executablePath: process.env.CHROMIUM,
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
const pag = await nav.newPage({ viewport: { width: 1100, height: 660 } });
const errs = []; pag.on('pageerror', e => errs.push(e.message));
await pag.goto('http://localhost:8099/index.html', { waitUntil: 'load' });
await pag.waitForTimeout(1200); await pag.click('#empezar'); await pag.waitForTimeout(2200);

const cifras = await pag.evaluate(() => {
  const j = window.juego;
  const r = j.formarPinza(60, 250);
  // mirar PARA ATRÁS: la columna está detrás tuyo, que es de lo que se trata
  j.jugador.yaw = Math.PI + 0.16; j.jugador.pitch = -0.04;
  j.jugador.pos.y = 2.5;
  j.armas.tercerola.visible = false;
  return r;
});
await pag.waitForTimeout(2500);
await pag.screenshot({ path: 'tropa/p-1-formada.png' });
const antes = await pag.evaluate(() => ({ draws: window.juego.info.calls, hombres: window.juego.soldados.length }));
// cuánto cuesta darse vuelta y mirar a la propia columna, según dónde se corte
for (const u of [30, 26, 22, 18]) {
  await pag.evaluate(x => window.juego.lod(x), u);
  await pag.waitForTimeout(900);
  const d = await pag.evaluate(() => window.juego.info.calls);
  console.log(`  corte a ${u} m → ${d} llamadas`);
}
await pag.evaluate(() => window.juego.lod(30));
await pag.waitForTimeout(700);

// el clarín, y a los pocos segundos la columna en movimiento
await pag.evaluate(() => { window.juego.tocarClarin(); });
await pag.waitForTimeout(1200);
await pag.evaluate(() => { const c = window.juego.jugador.monta; if (c) c.andar = 3; });
// avanzar el mundo a mano: con render por software el reloj no alcanza
await pag.evaluate(() => {
  const j = window.juego;
  for (let i = 0; i < 60 * 7; i++) {
    j.pinza.actualizar(1 / 60, j.jugador, j.soldados.filter(s => s.esRealista));
    for (const s of j.soldados) s.actualizar(1 / 60, j.jugador, j.soldados);
    for (const c of j.caballos) { if (c.actualizado) { c.actualizado = false; continue; } c.actualizar(1 / 60, { girar: 0 }); }
    j.separarAhora();
  }
  j.jugador.pos.set(j.jugador.monta.pos.x, 2.4, j.jugador.monta.pos.z);
  j.jugador.yaw = Math.PI - 0.5; j.jugador.pitch = -0.03; j.armas.tercerola.visible = false;
});
await pag.waitForTimeout(2500);
await pag.screenshot({ path: 'tropa/p-2-carga.png' });
const dur = await pag.evaluate(() => ({ draws: window.juego.info.calls, tuya: window.juego.pinza.oeste.montados, otra: window.juego.pinza.este.montados }));
console.log('formada  ', JSON.stringify({ ...cifras, ...antes }));
console.log('en marcha', JSON.stringify(dur));
console.log(errs.length ? 'ERRORES: ' + errs.join(' / ') : 'sin errores');
await nav.close();
