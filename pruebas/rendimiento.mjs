import { chromium } from 'playwright';
const nav = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined,
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
const pag = await nav.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
pag.on('pageerror', e => errs.push(e.message));
pag.on('console', m => { if (m.type() === 'error' && !m.text().includes('Failed to load resource')) errs.push(m.text()); });
await pag.goto((process.env.URL || 'http://localhost:8099') + '/index.html', { waitUntil: 'load' });
await pag.waitForTimeout(1200);
await pag.click('#empezar');
await pag.waitForTimeout(1500);
await pag.evaluate(() => {
  for (let i = 0; i < 6; i++) window.juego.soltarRealista();
  const t = window.juego.tercerola;
  for (let k = 0; k < 3; k++) {
    t.polvora = t.bala = t.cebado = t.amartillada = true;
    t.gatillo();
    for (let i = 0; i < 20; i++) t.actualizar(1 / 60, { apuntando: false, presion: 0 });
  }
});
await pag.waitForTimeout(2500);
const d = await pag.evaluate(() => {
  const r = window.juego;
  const info = window.juego.escena.__info || null;
  return { nubes: r.humo.vivas, enemigos: r.enemigos.length };
});
const info = await pag.evaluate(() => {
  const c = document.querySelector('#depurar');
  return document.querySelector('#estado').textContent;
});
// leer render.info a través de la consola de depuración del juego
await pag.keyboard.press('F3');
await pag.waitForTimeout(700);
const dep = await pag.evaluate(() => document.querySelector('#depurar').innerText);
console.log('estado:', info.replace(/\n/g, ' | '));
console.log('depuración:\n' + dep);
console.log('mundo:', JSON.stringify(d));
console.log(errs.length ? 'ERRORES: ' + errs.join(' / ') : 'sin errores de consola');
await nav.close();
