import { chromium } from 'playwright';
const SP = process.env.SP || 'capturas';
const nav = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined,
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
const pag = await nav.newPage({ viewport: { width: 1280, height: 720 } });
pag.on('pageerror', e => console.log('[EXCEPCION]', e.message));
await pag.goto((process.env.URL || 'http://localhost:8099') + '/index.html', { waitUntil: 'load' });
await pag.waitForTimeout(1500);
await pag.click('#empezar');
await pag.waitForTimeout(1500);

const poner = (js) => pag.evaluate(js);
await poner(() => { const j = window.juego.jugador; j.pos.set(1.5, 1.68, -2); j.yaw = 0.05; j.pitch = -0.03; });
await pag.waitForTimeout(1200);
await pag.screenshot({ path: SP + '/cap-1-campo.png' });

// en plena carga: paso de la baqueta, con la ventana de tiempo abierta
await poner(() => {
  const t = window.juego.tercerola;
  t.secuencia = ['cartucho','morder','cebar','polvora','bala','baqueta','amartillar'];
  t.paso = 5; t.tPaso = 1.2; t.penal = 0; t.marcado = null; t.cargando = true;
  t.polvora = true; t.bala = true; t.cebado = true;
});
await pag.waitForTimeout(700);
await pag.screenshot({ path: SP + '/cap-2-baqueta.png' });

// disparo y humo
await poner(() => {
  const t = window.juego.tercerola;
  t.cargando = false; t.paso = 7;
  t.polvora = t.bala = t.cebado = t.amartillada = true;
  t.gatillo();
});
await pag.waitForTimeout(1400);
await pag.screenshot({ path: SP + '/cap-3-disparo.png' });

// realistas avanzando entre la humareda
await poner(() => {
  for (let i = 0; i < 4; i++) window.juego.soltarRealista();
  const H = window.juego.humo, T = window.juego.escena;
  window.juego.enemigos.forEach((e, i) => { e.pos.set(-7 + i * 4.5, 0, -19 - i * 2); });
});
await pag.waitForTimeout(5000);
await poner(() => {
  const t = window.juego.tercerola;
  t.polvora = t.bala = t.cebado = t.amartillada = true;
  t.gatillo();
});
await pag.waitForTimeout(1600);
await pag.screenshot({ path: SP + '/cap-4-realistas.png' });
console.log('capturas listas');
await nav.close();
