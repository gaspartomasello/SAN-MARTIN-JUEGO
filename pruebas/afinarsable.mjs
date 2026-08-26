import { chromium } from 'playwright';
const nav = await chromium.launch({ executablePath: process.env.CHROMIUM,
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
const pag = await nav.newPage({ viewport: { width: 900, height: 620 } });
pag.on('pageerror', e => console.log('[EXC]', e.message));
await pag.goto('http://localhost:8099/index.html', { waitUntil: 'load' });
await pag.waitForTimeout(1200); await pag.click('#empezar'); await pag.waitForTimeout(1400);
const ev = (f, ...a) => pag.evaluate(f, ...a);
await ev(() => {
  const j = window.juego;
  dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit2' }));
  j.soldados.forEach(s => s.quitar()); j.soldados.length = 0;
  j.soltarSoldado('realista');
  const s = j.soldados[0];
  const v = j.jugador.pos.clone(); j.camara.getWorldDirection(v);
  s.pos.copy(j.jugador.pos).addScaledVector(v, 2.2); s.pos.y = 0;
  s.estado = 'acero'; s.tAcero = 0.1; s.actualizar = dt => s.fig.actualizar(dt, false);
  j.sable.actualizar = () => {};      // si no, el bucle lo devuelve a reposo
  window.probar = v2 => {
    const g = j.sable;
    g.guardia = false; g.t = -1; g.tParada = -1;
    g.grupo.position.set(...v2.p); g.grupo.rotation.set(...v2.r);
    g._acomodarBrazo();
  };
});
for (const [nom, v] of Object.entries(JSON.parse(process.env.VAR))) {
  await ev(x => window.probar(x), v);
  await pag.waitForTimeout(300);
  await pag.screenshot({ path: `tropa/g-${nom}.png` });
}
await nav.close();
