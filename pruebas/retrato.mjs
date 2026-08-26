import { chromium } from 'playwright';
const SP = process.env.SP || 'tropa';
const BANDO = process.env.BANDO || 'granadero';
const nav = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined,
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
const pag = await nav.newPage({ viewport: { width: 760, height: 900 } });
pag.on('pageerror', e => console.log('[EXCEPCION]', e.message));
await pag.goto((process.env.URL || 'http://localhost:8099') + '/index.html', { waitUntil: 'load' });
await pag.waitForTimeout(1200);
await pag.click('#empezar');
await pag.waitForTimeout(1200);
const ev = (f, ...a) => pag.evaluate(f, ...a);

await ev(bando => {
  const j = window.juego;
  j.jugador.pos.set(0, 1.15, 0); j.jugador.yaw = 0; j.jugador.pitch = 0;
  j.soldados.forEach(s => s.quitar()); j.soldados.length = 0;
  document.getElementById('estado').style.display = 'none';
  document.getElementById('cartuchera').style.display = 'none';
  j.armas.tercerola.grupo.visible = false;
  if (j.armas.pistolon) j.armas.pistolon.grupo.visible = false;
  j.soltarSoldado(bando);
  const s = j.soldados[0];
  s.pos.set(0, 0, -2.5);
  s.malla.rotation.y = Math.PI;
  s.actualizar = dt => s.fig.actualizar(dt, window.andando === true);
  window.m = s;
  window.pose = p => s.fig.poner(p);
  window.girar = a => { s.malla.rotation.y = a; };
}, BANDO);
await pag.waitForTimeout(1500);
for (const [nom, ang] of [['frente', Math.PI], ['perfil', Math.PI * 0.5], ['espalda', 0], ['3-4', Math.PI * 0.78]]) {
  await ev(a => window.girar(a), ang);
  await pag.waitForTimeout(800);
  await pag.screenshot({ path: `${SP}/r-${BANDO}-${nom}.png` });
}
await nav.close();
