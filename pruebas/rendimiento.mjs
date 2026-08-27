import { chromium } from 'playwright';
const nav = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined,
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
const pag = await nav.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
pag.on('pageerror', e => errs.push(e.message));
pag.on('console', m => { if (m.type() === 'error' && !m.text().includes('Failed to load resource')) errs.push(m.text()); });
await pag.goto((process.env.URL || 'http://localhost:8099') + '/index.html', { waitUntil: 'load' });
await pag.waitForTimeout(1200);
await pag.click('#modo-campo');
await pag.waitForTimeout(1500);
await pag.evaluate(() => {
  const j = window.juego;
  for (let i = 0; i < 6; i++) j.soltarSoldado('realista');
  const t = j.armas.tercerola;
  for (let k = 0; k < 3; k++) {
    t.polvora = t.bala = t.cebado = t.amartillada = true;
    t.gatillo();
    for (let i = 0; i < 20; i++) t.actualizar(1 / 60, { apuntando: false, presion: 0 });
  }
});
await pag.waitForTimeout(2500);
await pag.keyboard.press('F3');
await pag.waitForTimeout(800);
const dep = await pag.evaluate(() => document.querySelector('#depurar').innerText);
const d = await pag.evaluate(() => ({
  nubes: window.juego.humo.vivas,
  soldados: window.juego.soldados.length,
  mallas: window.juego.soldados.reduce((n, s) => n + s.fig.mallas.length, 0),
  draws: window.juego.render.info.render.calls,
  tris: window.juego.render.info.render.triangles,
  geos: window.juego.render.info.memory.geometries
}));
console.log('depuración:\n' + dep);
console.log('mundo:', JSON.stringify(d));
console.log(errs.length ? 'ERRORES: ' + errs.join(' / ') : 'sin errores de consola');
await nav.close();
