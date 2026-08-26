// Las posturas horneadas, en fila. Sirve para ver que cada fase sea DISTINTA
// y que ninguna haya salido rota del horno.
import { chromium } from 'playwright';
const nav = await chromium.launch({ executablePath: process.env.CHROMIUM,
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
const pag = await nav.newPage({ viewport: { width: 1200, height: 620 } });
const errs = []; pag.on('pageerror', e => errs.push(e.message));
await pag.goto('http://localhost:8099/index.html', { waitUntil: 'load' });
await pag.waitForTimeout(1200); await pag.click('#empezar'); await pag.waitForTimeout(2200);

const huella = await pag.evaluate(async () => {
  const j = window.juego;
  for (const s of j.soldados.slice()) s.quitar(); j.soldados.length = 0;
  for (const c of j.caballos.slice()) c.quitar(); j.caballos.length = 0;
  j.jugador.pos.set(0, 1.9, 0); j.jugador.yaw = 0; j.jugador.pitch = 0.03;
  j.armas.tercerola.visible = false;

  // huella de cada geometría: si dos fases dan lo mismo, el horno no posó
  const h = {};
  for (const [clave, lista] of j.lejania.lotes) {
    h[clave] = lista.map(l => {
      const a = l.malla.geometry.attributes.position;
      let s = 0;
      for (let i = 0; i < a.count; i++) s += a.getX(i) * 1.7 + a.getY(i) * 3.1 + a.getZ(i) * 5.3;
      return +s.toFixed(2);
    });
  }
  // y las plantamos en fila para mirarlas
  const lej = j.lejania;
  const orig = lej.terminar.bind(lej);
  lej.comenzar();
  let x = -4.6;
  for (const clave of ['granadero', 'realista']) for (let f = 0; f < 6; f++) { lej.poner(clave, f, x, 0, -6.2, Math.PI + 0.5); x += 1.55; }
  x = -5.5;
  for (const clave of ['lancero', 'caballo']) for (let f = 0; f < 4; f++) { lej.poner(clave, f, x, 0, -15, Math.PI + 0.5); x += 3.6; }
  orig();
  lej.comenzar = () => {};      // congelar: que el bucle no las borre
  lej.terminar = () => {};
  return h;
});
await pag.waitForTimeout(1200);
await pag.screenshot({ path: 'tropa/horneado.png' });
for (const k of Object.keys(huella)) {
  const u = new Set(huella[k]);
  console.log(k.padEnd(11), huella[k].join(' '), u.size === huella[k].length ? '· todas distintas' : '· ¡FASES REPETIDAS!');
}
console.log(errs.length ? 'ERRORES: ' + errs.join(' / ') : 'sin errores');
await nav.close();
