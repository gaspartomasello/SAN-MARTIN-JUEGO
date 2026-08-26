import { chromium } from 'playwright';
const SP = 'tropa';
const nav = await chromium.launch({ executablePath: process.env.CHROMIUM,
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
const pag = await nav.newPage({ viewport: { width: 1100, height: 680 } });
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
  const v = j.jugador.pos.clone();
  j.camara.getWorldDirection(v);
  s.pos.copy(j.jugador.pos).addScaledVector(v, 2.0); s.pos.y = 0;
  s.estado = 'acero'; s.tAcero = 0;
  window.s = s;
});
await pag.waitForTimeout(1200);
await pag.screenshot({ path: SP + '/d-1-sable-reposo.png' });

await ev(() => window.juego.sable.alzarGuardia());
await pag.waitForTimeout(900);
await pag.screenshot({ path: SP + '/d-2-guardia.png' });

// el aviso del realista con vos cubriendo
await ev(() => { window.s.tAcero = 0.80; window.s.fig.poner('cargar'); });
await pag.waitForTimeout(900);
await pag.screenshot({ path: SP + '/d-3-aviso.png' });

// parada perfecta congelada
await ev(() => {
  const j = window.juego;
  j.jugador.aliento = 100;
  j.sable.bajarGuardia(); j.sable.alzarGuardia();
  window.s.alGolpear(window.s, { jugador: true });
});
await pag.waitForTimeout(120);
await pag.screenshot({ path: SP + '/d-4-parada.png' });
await pag.waitForTimeout(700);
await pag.screenshot({ path: SP + '/d-5-remate-abierto.png' });
await nav.close();
