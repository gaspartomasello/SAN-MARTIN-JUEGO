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

const ev = (f, ...a) => pag.evaluate(f, ...a);
await ev(() => { const j = window.juego.jugador; j.pos.set(1.5, 1.68, -2); j.yaw = 0.04; j.pitch = -0.02; });
await pag.waitForTimeout(1000);
await pag.screenshot({ path: SP + '/n-1-cadera.png' });

// apuntado: cañón alineado, culata fuera del camino, arma desenfocada
await pag.mouse.down({ button: 'right' });
await pag.waitForTimeout(2200);
await pag.screenshot({ path: SP + '/n-2-apuntado.png' });
await pag.mouse.up({ button: 'right' });
await pag.waitForTimeout(900);

// fogonazo y estela, congelados apenas sale el tiro
await ev(() => {
  const f = window.juego.fuego;
  const original = f.actualizar.bind(f);
  const a = window.juego.arma;
  a.polvora = a.bala = a.cebado = a.amartillada = true;
  a.esperaTiro = -1;
  f.actualizar = () => {};      // congelar el efecto para poder fotografiarlo
  a._tirar();
  original(0.012);
});
await pag.waitForTimeout(400);
await pag.screenshot({ path: SP + '/n-3-fogonazo.png' });
await ev(() => { const f = window.juego.fuego; delete f.actualizar; f.llamas.forEach(l => { l.t = -1; l.malla.visible = false; l.estrella.visible = false; }); });
await pag.waitForTimeout(300);

// sable corvo
await pag.keyboard.press('2');
await pag.waitForTimeout(1200);
await pag.screenshot({ path: SP + '/n-4-sable.png' });

// pistolón
await pag.keyboard.press('3');
await pag.waitForTimeout(1200);
await pag.screenshot({ path: SP + '/n-5-pistolon.png' });

// realistas de blanco + fusil tomado
await pag.keyboard.press('1');
await ev(() => {
  const j = window.juego;
  for (let i = 0; i < 4; i++) j.soltarRealista();
  j.enemigos.forEach((e, i) => e.pos.set(-6 + i * 4, 0, -14 - i * 3));
});
await pag.waitForTimeout(3000);
await pag.screenshot({ path: SP + '/n-6-realistas.png' });

await ev(() => {
  const j = window.juego;
  const e = j.enemigos[0];
  e.pos.set(j.jugador.pos.x + 1.2, 0, j.jugador.pos.z - 1.2);
  e.recibir(5, { x: 0, y: 0, z: -1 });
});
await pag.waitForTimeout(1500);
await pag.screenshot({ path: SP + '/n-7-tomar.png' });
await pag.keyboard.press('g');
await pag.waitForTimeout(1400);
await pag.screenshot({ path: SP + '/n-8-fusil.png' });

// carga en curso, con la ventana abierta
await ev(() => {
  const a = window.juego.arma;
  a.polvora = a.bala = a.cebado = a.amartillada = false;
  a.secuencia = ['cartucho','morder','cebar','polvora','bala','baqueta','amartillar'];
  a.paso = 1; a.tPaso = 1.15 * 1.18 * 0.6; a.penal = 0; a.marcado = null; a.cargando = true;
});
await pag.waitForTimeout(120);
await pag.screenshot({ path: SP + '/n-9-ahora.png' });
console.log('capturas listas');
await nav.close();
