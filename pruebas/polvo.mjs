import { chromium } from 'playwright';
const nav = await chromium.launch({ executablePath: process.env.CHROMIUM,
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
const pag = await nav.newPage({ viewport: { width: 1280, height: 720 } });
pag.on('pageerror', e => console.log('[EXCEPCION]', e.message));
await pag.goto('http://localhost:8099/index.html', { waitUntil: 'load' });
await pag.waitForTimeout(1200); await pag.click('#modo-campo'); await pag.waitForTimeout(1500);

// cinco lanceros cruzando el campo al galope, vistos de costado
const r = await pag.evaluate(() => {
  const j = window.juego;
  j.soldados.forEach(s => s.quitar()); j.soldados.length = 0;
  for (const c of [...j.caballos]) { c.quitar(); j.caballos.splice(j.caballos.indexOf(c), 1); }
  j.jugador.pos.set(-4, 2.2, -33); j.jugador.yaw = Math.PI * 0.5; j.jugador.pitch = -0.02;
  for (let i = 0; i < 5; i++) {
    const s = j.soltarSoldado('granadero', { montado: true });
    s.monta.pos.set(-40 - i * 6, 0, -40 - (i % 3) * 6);
    s.monta.rumbo = -Math.PI / 2; s.monta.andar = 3; s.monta.vel = 10.2;
    s.actualizar = dt => { s.fig.poner('enristre'); s.fig.actualizar(dt, false);
      s.monta.actualizar(dt, {}); s.monta.actualizado = true; s._sentar(); };
  }
  // correr la simulación a mano: bajo swiftshader el bucle real va a 2 fps
  for (let i = 0; i < 60 * 3; i++) {
    for (const s of j.soldados) s.actualizar(1 / 60, j.jugador, j.soldados);
    j.humo.actualizar(1 / 60);
  }
  const n = j.humo.nubes.filter(x => x.viva && x.tierra > 0);
  const c = j.soldados[0] && j.soldados[0].monta;
  return { nubes: j.humo.vivas, tierra: n.length,
    caballoEn: c ? [+c.pos.x.toFixed(1), +c.pos.z.toFixed(1)] : null,
    polvoEn: n.length ? [+n[0].pos.x.toFixed(1), +n[0].pos.y.toFixed(1), +n[0].pos.z.toFixed(1)] : null };
});
await pag.waitForTimeout(900);
await pag.screenshot({ path: 'tropa/d-1-polvareda.png' });
console.log(JSON.stringify(r));
await nav.close();
