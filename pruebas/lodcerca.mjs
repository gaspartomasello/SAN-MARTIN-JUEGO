// Comparación cruda: el MISMO hombre a 9 m, articulado y horneado. No es la
// distancia a la que se lo va a ver, es la lupa para saber qué se perdió.
import { chromium } from 'playwright';
const nav = await chromium.launch({ executablePath: process.env.CHROMIUM,
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
const pag = await nav.newPage({ viewport: { width: 1000, height: 640 } });
const errs = []; pag.on('pageerror', e => errs.push(e.message));
await pag.goto('http://localhost:8099/index.html', { waitUntil: 'load' });
await pag.waitForTimeout(1200); await pag.click('#empezar'); await pag.waitForTimeout(2200);

await pag.evaluate(async () => {
  const j = window.juego;
  const T = await import('/vendor/three.module.js');
  for (const s of j.soldados.slice()) s.quitar();
  j.soldados.length = 0;
  for (const c of j.caballos.slice()) c.quitar();
  j.caballos.length = 0;
  const a = j.soltarSoldado('granadero', { pos: new T.Vector3(-0.85, 0, -3.6) });
  const b = j.soltarSoldado('realista',  { pos: new T.Vector3( 0.85, 0, -3.6) });
  for (const s of [a, b]) { s.alDisparar = null; s.alGolpear = null; s.objetivo = null; }
  j.jugador.pos.set(0, 1.68, 0);
  j.jugador.yaw = 0; j.jugador.pitch = 0.02;
  j.armas.tercerola.visible = false;
});

for (const [nombre, u] of [['articulado', 999], ['horneado', 1]]) {
  await pag.evaluate(x => window.juego.lod(x), u);
  await pag.waitForTimeout(1300);
  await pag.screenshot({ path: `tropa/cerca-${nombre}.png` });
}
const t = await pag.evaluate(() => {
  const l = window.juego.lejania, r = {};
  for (const [k, lista] of l.lotes) r[k] = lista.map(x => ({ tris: x.malla.geometry.attributes.position.count / 3, crudos: x.malla.geometry.userData.crudos }));
  return r;
});
for (const k of Object.keys(t)) console.log(k.padEnd(11), t[k].map(v => `${v.tris}/${v.crudos}`).join('  '));
console.log(errs.length ? 'ERRORES: ' + errs.join(' / ') : 'sin errores');
await nav.close();
