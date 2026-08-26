import { chromium } from 'playwright';
const nav = await chromium.launch({ executablePath: process.env.CHROMIUM,
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
const pag = await nav.newPage({ viewport: { width: 1280, height: 620 } });
pag.on('pageerror', e => console.log('[EXCEPCION]', e.message));
await pag.goto('http://localhost:8099/index.html', { waitUntil: 'load' });
await pag.waitForTimeout(1200); await pag.click('#empezar'); await pag.waitForTimeout(1500);
await pag.evaluate(() => {
  const j = window.juego;
  j.soldados.forEach(s => s.quitar()); j.soldados.length = 0;
  for (const c of [...j.caballos]) { c.quitar(); j.caballos.splice(j.caballos.indexOf(c), 1); }
  j.jugador.pos.set(0, 1.62, 0); j.jugador.yaw = 0; j.jugador.pitch = 0.0;
  // seis granaderos de frente: uno por cada tono de la paleta, y Cabral al medio
  const tez = [0xb08059, 0xa2724d, 0x4e3020, 0x66422a, 0x96663f, 0x53341f];
  for (let i = 0; i < 6; i++) {
    const s = j.soltarSoldado('granadero', { tez: tez[i] });
    s.malla.position.set(-3.4 + i * 1.36, 0, -4.4);
    s.actualizar = dt => { s.malla.rotation.y = Math.PI; s.fig.poner('marcha'); s.fig.actualizar(dt, false); };
  }
});
await pag.waitForTimeout(3000);
await pag.screenshot({ path: 'tropa/t-1-tez.png', clip: { x: 240, y: 80, width: 800, height: 420 } });
console.log('listo');
await nav.close();
