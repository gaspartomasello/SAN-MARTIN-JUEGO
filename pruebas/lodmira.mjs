// ¿Se nota el salto? Misma formación, misma cámara, con y sin lejanía.
import { chromium } from 'playwright';
const nav = await chromium.launch({ executablePath: process.env.CHROMIUM,
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
const pag = await nav.newPage({ viewport: { width: 1100, height: 700 } });
const errs = []; pag.on('pageerror', e => errs.push(e.message));
await pag.goto('http://localhost:8099/index.html', { waitUntil: 'load' });
await pag.waitForTimeout(1200); await pag.click('#modo-campo'); await pag.waitForTimeout(2200);

await pag.evaluate(async () => {
  const j = window.juego;
  const T = await import('/vendor/three.module.js');
  for (const s of j.soldados.slice()) s.quitar();
  j.soldados.length = 0;
  for (let k = 0; k < 9; k++) {
    j.soltarSoldado('realista',  { pos: new T.Vector3(-6, 0, -10 - k * 7) });
    j.soltarSoldado('granadero', { pos: new T.Vector3( 6, 0, -10 - k * 7) });
  }
  for (let k = 0; k < 5; k++) j.soltarSoldado('granadero', { montado: true, pos: new T.Vector3(-22 + k * 11, 0, -34) });
  j.jugador.pos.set(0, 1.68, 6);
  j.jugador.yaw = 0; j.jugador.pitch = -0.05;
});

const paso = async (nombre, umbral) => {
  await pag.evaluate(u => window.juego.lod(u), umbral);
  await pag.waitForTimeout(1400);
  const d = await pag.evaluate(() => ({ draws: window.juego.info.calls, inst: window.juego.lejania.instancias, lotes: window.juego.lejania.dibujando }));
  await pag.screenshot({ path: `tropa/lod-${nombre}.png` });
  console.log(nombre.padEnd(12), 'draws', String(d.draws).padEnd(6), 'instancias', String(d.inst).padEnd(5), 'lotes', d.lotes);
};
await paso('articulado', 999);
await paso('lejania', 12);
console.log(errs.length ? 'ERRORES: ' + errs.join(' / ') : 'sin errores');
await nav.close();
