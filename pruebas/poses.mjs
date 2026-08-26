import { chromium } from 'playwright';
const SP = process.env.SP || 'tropa';
const nav = await chromium.launch({ executablePath: process.env.CHROMIUM,
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
const pag = await nav.newPage({ viewport: { width: 640, height: 800 } });
pag.on('pageerror', e => console.log('[EXC]', e.message));
await pag.goto('http://localhost:8099/index.html', { waitUntil: 'load' });
await pag.waitForTimeout(1200); await pag.click('#empezar'); await pag.waitForTimeout(1200);
const ev = (f, ...a) => pag.evaluate(f, ...a);
await ev(bando => {
  const j = window.juego;
  j.jugador.pos.set(0, 1.20, 0); j.jugador.yaw = 0; j.jugador.pitch = 0;
  j.soldados.forEach(s => s.quitar()); j.soldados.length = 0;
  document.getElementById('estado').style.display = 'none';
  document.getElementById('cartuchera').style.display = 'none';
  j.armas.tercerola.grupo.visible = false;
  j.soltarSoldado(bando);
  const s = j.soldados[0];
  s.pos.set(0, 0, -2.6); s.malla.rotation.y = Math.PI;
  s.actualizar = dt => s.fig.actualizar(dt, false);
  window.pose = p => s.fig.poner(p);
  window.girar = a => { s.malla.rotation.y = a; };
}, process.env.BANDO || 'realista');
await pag.waitForTimeout(800);
for (const p of ['apuntar', 'recargar', 'guardia', 'cargar', 'estocada']) {
  await ev(q => window.pose(q), p);
  await pag.waitForTimeout(900);
  await pag.screenshot({ path: `${SP}/p-${p}-frente.png` });
  await ev(() => window.girar(Math.PI * 0.62));
  await pag.waitForTimeout(300);
  await pag.screenshot({ path: `${SP}/p-${p}-lado.png` });
  await ev(() => window.girar(Math.PI));
  await pag.waitForTimeout(200);
}
await nav.close();
