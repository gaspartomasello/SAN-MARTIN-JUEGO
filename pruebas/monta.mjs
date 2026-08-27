import { chromium } from 'playwright';
const SP = 'tropa';
const nav = await chromium.launch({ executablePath: process.env.CHROMIUM,
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
const pag = await nav.newPage({ viewport: { width: 1100, height: 680 } });
const errs = [];
pag.on('pageerror', e => errs.push(e.message));
await pag.goto('http://localhost:8099/index.html', { waitUntil: 'load' });
await pag.waitForTimeout(1200); await pag.click('#modo-campo'); await pag.waitForTimeout(1400);
const ev = (f, ...a) => pag.evaluate(f, ...a);

// retrato del caballo, de costado
await ev(() => {
  const j = window.juego;
  j.soldados.forEach(s => s.quitar()); j.soldados.length = 0;
  j.armas.tercerola.grupo.visible = false;
  j.caballo.pos.set(0, 0, -4.5); j.caballo.rumbo = Math.PI * 0.5;
  j.jugador.pos.set(0, 1.5, 0); j.jugador.yaw = 0; j.jugador.pitch = 0;
});
await pag.waitForTimeout(900);
await pag.screenshot({ path: SP + '/c-1-perfil.png' });
await ev(() => { window.juego.caballo.rumbo = Math.PI; });
await pag.waitForTimeout(600);
await pag.screenshot({ path: SP + '/c-2-frente.png' });

// montarse y mirar desde la silla
await ev(() => {
  const j = window.juego;
  j.caballo.pos.set(0, 0, 0); j.caballo.rumbo = 0;
  j.jugador.pos.set(0, 1.6, 1.5);
  j.montarODesmontar();
  dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit2' }));   // sable en mano
});
await pag.waitForTimeout(900);
await pag.screenshot({ path: SP + '/c-3-silla.png' });

// al galope
await ev(() => { const c = window.juego.caballo; c.andar = 3; });
await pag.waitForTimeout(2600);
await pag.screenshot({ path: SP + '/c-4-galope.png' });

const d = await ev(() => {
  const c = window.juego.caballo, j = window.juego.jugador;
  return { andar: c.nombreAndar, vel: +c.vel.toFixed(2), filo: +c.filoPorVelocidad.toFixed(2),
    ojo: +j.pos.y.toFixed(2), montado: !!j.monta };
});
console.log(JSON.stringify(d));
console.log(errs.length ? 'ERRORES: ' + errs.join(' / ') : 'sin errores');
await nav.close();
