import { chromium } from 'playwright';
const SP = process.env.SP || 'tropa';
const nav = await chromium.launch({ executablePath: process.env.CHROMIUM,
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
const pag = await nav.newPage({ viewport: { width: 640, height: 800 } });
pag.on('pageerror', e => console.log('[EXC]', e.message));
await pag.goto('http://localhost:8099/index.html', { waitUntil: 'load' });
await pag.waitForTimeout(1200); await pag.click('#modo-campo'); await pag.waitForTimeout(1200);
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
  s.actualizar = () => {};
  window.probar = v => {
    const c = s.fig.cur;
    c.manoD.fromArray(v.manoD); c.dir.fromArray(v.dir).normalize();
    c.poloD.fromArray(v.poloD); c.poloI.fromArray(v.poloI);
    c.torso.fromArray(v.torso); c.cabeza.fromArray(v.cabeza || [0, 0, 0]);
    c.agarre = v.agarre; c.roll = v.roll || 0;
    s.fig._armar();
  };
  window.girar = a => { s.malla.rotation.y = a; };
}, process.env.BANDO || 'realista');
for (const [nom, v] of Object.entries(JSON.parse(process.env.VAR))) {
  await ev(x => window.probar(x), v);
  await pag.waitForTimeout(350);
  await pag.screenshot({ path: `${SP}/v-${nom}-frente.png` });
  await ev(() => window.girar(Math.PI * 0.68));
  await pag.waitForTimeout(250);
  await pag.screenshot({ path: `${SP}/v-${nom}-34.png` });
  await ev(() => window.girar(Math.PI));
  await pag.waitForTimeout(150);
}
await nav.close();
