// LOS NÚMEROS REALES. 120 granaderos a caballo en dos columnas de 60 y 250
// infantes realistas con dos piezas. La pregunta no es si se ve lindo: es si
// el juego corre.
import { chromium } from 'playwright';
const nav = await chromium.launch({ executablePath: process.env.CHROMIUM,
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
const pag = await nav.newPage({ viewport: { width: 1000, height: 640 } });
const errs = []; pag.on('pageerror', e => errs.push(e.message));
await pag.goto('http://localhost:8099/index.html', { waitUntil: 'load' });
await pag.waitForTimeout(1200); await pag.click('#empezar'); await pag.waitForTimeout(2400);

const r = await pag.evaluate(async () => {
  const j = window.juego;
  const T = await import('/vendor/three.module.js');
  const esperar = n => new Promise(res => { let i = 0; const f = () => (++i >= n ? res() : requestAnimationFrame(f)); requestAnimationFrame(f); });
  const simular = (cuadros = 30) => {
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
    const i = j.info, l = j.lejania;
    filas.push({ caso: etiqueta, hombres: j.soldados.length, draws: i.calls,
      kTris: Math.round(i.triangles / 1000), lotes: l.dibujando, inst: l.instancias,
      desb: l.desbordes, simMs: +simular().toFixed(2) });
  };

  for (const s of j.soldados.slice()) s.quitar(); j.soldados.length = 0;
  for (const c of j.caballos.slice()) { if (j.jugador.monta !== c) c.quitar(); }
  j.caballos.length = 0;
  await medir('campo vacío');

  // los 250 realistas: desembarcados, en línea sobre la barranca
  for (let k = 0; k < 250; k++) {
    j.soltarSoldado('realista', { pos: new T.Vector3(-40 + (k % 50) * 1.6, 0, -62 - Math.floor(k / 50) * 3) });
  }
  await medir('+250 realistas');

  // las dos columnas de 60, saliendo por los flancos del convento
  for (const lado of [-1, 1]) {
    for (let k = 0; k < 60; k++) {
      j.soltarSoldado('granadero', { montado: true,
        pos: new T.Vector3(lado * (34 + (k % 6) * 2.4), 0, -4 - Math.floor(k / 6) * 3) });
    }
    await medir(lado < 0 ? '+60 columna izq' : '+60 columna der');
  }
  j.jugador.pos.set(-16, 2.0, -26);
  j.jugador.yaw = Math.PI / 2 - 0.42; j.jugador.pitch = -0.02;
  j.armas.tercerola.visible = false;
  await esperar(30);
  return filas;
});
await pag.waitForTimeout(1400);
await pag.screenshot({ path: 'tropa/o-1-batalla.png' });
const cab = ['caso', 'hombres', 'draws', 'kTris', 'lotes', 'inst', 'desb', 'simMs'];
console.log(cab.map(c => c.padEnd(16)).join(''));
for (const f of r) console.log(cab.map(c => String(f[c]).padEnd(16)).join(''));
console.log(errs.length ? '\nERRORES: ' + errs.join(' / ') : '\nsin errores de consola');
await nav.close();
