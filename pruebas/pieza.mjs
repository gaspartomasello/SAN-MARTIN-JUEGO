import { chromium } from 'playwright';
const nav = await chromium.launch({ executablePath: process.env.CHROMIUM,
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
const pag = await nav.newPage({ viewport: { width: 1280, height: 620 } });
pag.on('pageerror', e => console.log('[EXCEPCION]', e.message));
await pag.goto('http://localhost:8099/index.html', { waitUntil: 'load' });
await pag.waitForTimeout(1200); await pag.click('#modo-campo'); await pag.waitForTimeout(1800);
await pag.evaluate(() => {
  const j = window.juego;
  const c = j.canones[0];
  c.pos.set(0, 0, -6); c.rumbo = Math.PI * 0.72; c.malla.rotation.y = c.rumbo;
  c.sirvientes.forEach((s, i) => {
    s.malla.position.set(-1.4 + i * 2.8, 0, -7.4);
    s.actualizar = dt => { s.malla.rotation.y = Math.PI * 0.2; s.fig.poner('marcha'); s.fig.actualizar(dt, false); };
  });
  j.canones[1].quitar();
  j.jugador.pos.set(2.6, 1.5, 0); j.jugador.yaw = -0.32; j.jugador.pitch = -0.13;
});
await pag.waitForTimeout(2600);
await pag.screenshot({ path: 'tropa/n-1-canon.png', clip: { x: 100, y: 40, width: 1000, height: 470 } });
console.log('listo');
await nav.close();
