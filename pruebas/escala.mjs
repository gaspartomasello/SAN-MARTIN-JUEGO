// ¿Cuántos granaderos aguanta el campo? Se mide lo que cuesta cada uno en
// llamadas de dibujo, en triángulos y en milisegundos de simulación.
import { chromium } from 'playwright';
const nav = await chromium.launch({ executablePath: process.env.CHROMIUM,
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
const pag = await nav.newPage({ viewport: { width: 900, height: 620 } });
const errs = [];
pag.on('pageerror', e => errs.push(e.message));
await pag.goto('http://localhost:8099/index.html', { waitUntil: 'load' });
await pag.waitForTimeout(1200); await pag.click('#empezar'); await pag.waitForTimeout(2500);

const r = await pag.evaluate(async () => {
  const j = window.juego;
  const esperar = n => new Promise(res => { let i = 0; const f = () => (++i >= n ? res() : requestAnimationFrame(f)); requestAnimationFrame(f); });

  // simular a mano un puñado de cuadros y cronometrar SÓLO la simulación
  const simular = (cuadros = 40) => {
    const t0 = performance.now();
    for (let k = 0; k < cuadros; k++) {
      for (const s of j.soldados) s.actualizar(1 / 60, j.jugador, j.soldados);
      for (const c of j.caballos) { if (c.actualizado) { c.actualizado = false; continue; } c.actualizar(1 / 60, { girar: 0 }); }
    }
    return (performance.now() - t0) / cuadros;
  };

  const filas = [];
  const medir = async etiqueta => {
    await esperar(20);
    const i = j.info;
    filas.push({
      caso: etiqueta,
      hombres: j.soldados.length,
      caballos: j.caballos.length,
      draws: i.calls,
      kTris: Math.round(i.triangles / 1000),
      simMs: +simular().toFixed(2)
    });
  };

  await medir('campo vacío');

  const tandas = [10, 10, 20, 20, 30];
  let n = 0;
  for (const t of tandas) {
    for (let k = 0; k < t; k++) j.soltarSoldado('granadero', { montado: true });
    n += t;
    await medir(`${n} lanceros`);
  }
  // y ahora la infantería española encima
  for (let k = 0; k < 60; k++) j.soltarSoldado('realista');
  await medir(`${n} lanceros + 60 realistas`);
  return filas;
});
const cab = ['caso', 'hombres', 'caballos', 'draws', 'kTris', 'simMs'];
console.log(cab.map(c => c.padEnd(24 - 0)).join('').slice(0, 200));
for (const f of r) console.log(cab.map(c => String(f[c]).padEnd(24)).join(''));
console.log(errs.length ? '\nERRORES: ' + errs.join(' / ') : '\nsin errores de consola');
await nav.close();
