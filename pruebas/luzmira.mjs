import { chromium } from 'playwright';
const nav = await chromium.launch({ executablePath: process.env.CHROMIUM,
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
const pag = await nav.newPage({ viewport: { width: 1000, height: 620 } });
const errs = []; pag.on('pageerror', e => errs.push(e.message));
await pag.goto('http://localhost:8099/index.html', { waitUntil: 'load' });
await pag.waitForTimeout(1200); await pag.click('#modo-campo'); await pag.waitForTimeout(2400);
await pag.evaluate(async () => {
  const j = window.juego;
  const T = await import('/vendor/three.module.js');
  for (const s of j.soldados.slice()) s.quitar(); j.soldados.length = 0;
  for (let k = 0; k < 7; k++) {
    j.soltarSoldado('realista', { pos: new T.Vector3(-9 + k * 3, 0, -22 - (k % 3) * 6) });
    j.soltarSoldado('granadero', { pos: new T.Vector3(-6 + k * 3, 0, -9 - (k % 2) * 4) });
  }
  j.jugador.pos.set(0, 1.68, 6); j.jugador.yaw = 0; j.jugador.pitch = -0.02;
});
await pag.waitForTimeout(2000);
await pag.screenshot({ path: 'tropa/luz.png' });
console.log(errs.length ? 'ERRORES: ' + errs.join(' / ') : 'sin errores');
await nav.close();
