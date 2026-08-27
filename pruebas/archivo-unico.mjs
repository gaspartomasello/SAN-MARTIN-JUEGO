import { chromium } from 'playwright';
const SP = process.env.SP || process.cwd();
const nav = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined,
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
const pag = await nav.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
pag.on('pageerror', e => errs.push('EXCEPCION: ' + e.message));
pag.on('console', m => { if (m.type() === 'error') errs.push('CONSOLA: ' + m.text()); });
await pag.goto('file://' + SP + '/clarin-san-lorenzo.html', { waitUntil: 'load' });
await pag.waitForTimeout(2000);
await pag.click('#modo-campo');
await pag.waitForTimeout(2500);
const ok = await pag.evaluate(() => {
  if (!window.juego) return { arranco: false };
  const t = window.juego.arma;
  // se intenta varias veces: una de cada catorce, el arma no da fuego a propósito
  for (let intento = 0; intento < 4 && t.tiros === 0; intento++) {
    t.polvora = t.bala = t.cebado = t.amartillada = true;
    t.gatillo();
    for (let i = 0; i < 30; i++) t.actualizar(1/60, { apuntando: false, presion: 0, penalCarga: 1, dispersion: 1 });
  }
  return { arranco: true, tiros: t.tiros, nubes: window.juego.humo.nubes.filter(n => n.viva).length };
});
await pag.waitForTimeout(1200);
await pag.screenshot({ path: SP + '/verif-archivo-unico.png' });
console.log('desde file:// →', JSON.stringify(ok));
console.log(errs.length ? errs.join('\n') : 'sin errores');
await nav.close();
