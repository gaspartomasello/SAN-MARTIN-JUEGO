import { chromium } from 'playwright';
const nav = await chromium.launch({ executablePath: process.env.CHROMIUM,
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
const pag = await nav.newPage({ viewport: { width: 900, height: 600 } });
pag.on('pageerror', e => console.log('[EXC]', e.message));
await pag.goto('http://localhost:8099/index.html', { waitUntil: 'load' });
await pag.waitForTimeout(1200); await pag.click('#modo-campo'); await pag.waitForTimeout(1500);
const ev = (f, ...a) => pag.evaluate(f, ...a);
const medir = () => ev(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => {
  const i = window.juego.info;
  r({ draws: i.calls, tris: i.triangles });
}))));
await ev(() => { window.juego.soldados.forEach(s => s.quitar()); window.juego.soldados.length = 0;
  window.juego.jugador.pos.set(0, 1.68, 8); window.juego.jugador.yaw = 0; });
await pag.waitForTimeout(600);
console.log('sin tropa   ', JSON.stringify(await medir()));
for (const n of [1, 6, 12]) {
  await ev(k => {
    const j = window.juego;
    j.soldados.forEach(s => s.quitar()); j.soldados.length = 0;
    for (let i = 0; i < k; i++) { j.soltarSoldado('realista'); const s = j.soldados[i];
      s.pos.set(-5 + (i % 6) * 2, 0, -4 - Math.floor(i / 6) * 2.5); s.actualizar = () => {}; }
  }, n);
  await pag.waitForTimeout(700);
  console.log(String(n).padStart(2) + ' soldados', JSON.stringify(await medir()));
}
await nav.close();
