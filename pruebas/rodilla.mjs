import { chromium } from 'playwright';
const nav = await chromium.launch({ executablePath: process.env.CHROMIUM,
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
const pag = await nav.newPage({ viewport: { width: 1280, height: 620 } });
pag.on('pageerror', e => console.log('[EXCEPCION]', e.message));
await pag.goto('http://localhost:8099/index.html', { waitUntil: 'load' });
await pag.waitForTimeout(1200); await pag.click('#empezar'); await pag.waitForTimeout(1500);
const ev = (f, ...a) => pag.evaluate(f, ...a);

// una línea: dos de pie apuntando, dos de rodilla, uno corriendo
await ev(() => {
  const j = window.juego;
  j.soldados.forEach(s => s.quitar()); j.soldados.length = 0;
  j.jugador.pos.set(0, 1.55, 0); j.jugador.yaw = 0; j.jugador.pitch = -0.02;
  const plan = [
    ['realista', 'apuntar', false], ['realista', 'apuntar', true],
    ['granadero', 'apuntar', true], ['granadero', 'correr', false],
    ['realista', 'correr', false]
  ];
  plan.forEach(([bando, pose, rod], i) => {
    const s = j.soltarSoldado(bando);
    s.malla.position.set(-4.2 + i * 2.1, 0, -6.2);
    s.rodilla = rod; s.fig.rodilla = rod;
    s.actualizar = dt => {
      s.malla.rotation.y = Math.PI;
      s.fig.poner(pose);
      s.fig.actualizar(dt, pose === 'correr', 2.3);
    };
  });
});
await pag.waitForTimeout(3200);
await pag.screenshot({ path: 'tropa/r-1-rodilla.png', clip: { x: 40, y: 30, width: 1140, height: 470 } });

// primer plano de perfil: ¿la rodilla toca el piso?
await ev(() => {
  const j = window.juego;
  j.soldados.forEach(s => s.quitar()); j.soldados.length = 0;
  const s = j.soltarSoldado('granadero');
  s.malla.position.set(0, 0, -3.2);
  s.rodilla = true; s.fig.rodilla = true;
  s.actualizar = dt => { s.malla.rotation.y = Math.PI * 0.5; s.fig.poner('apuntar'); s.fig.actualizar(dt, false); };
  j.jugador.pos.set(0, 1.0, 0); j.jugador.yaw = 0; j.jugador.pitch = -0.16;
});
await pag.waitForTimeout(2600);
await pag.screenshot({ path: 'tropa/r-3-perfil.png', clip: { x: 380, y: 60, width: 560, height: 480 } });

// desenfoque de velocidad, desde la silla al galope
const v = await ev(() => {
  const j = window.juego;
  j.soldados.forEach(s => s.quitar()); j.soldados.length = 0;
  const c = j.caballos[0] || null;
  if (!c) return 'sin caballo';
  c.pos.set(0, 0, -30); c.rumbo = 0; c.colisiones = []; c.vida = 6; c.vivo = true;
  j.jugador.montar(c);
  c.andar = 3; c.vel = 10.2;
  j.jugador.yaw = c.rumbo; j.jugador.pitch = -0.03;
  for (let i = 0; i < 120; i++) { c.actualizar(1 / 60, { girar: 0 }); j.jugador.actualizar(1 / 60, new Set(), false, false); }
  return { vel: +c.vel.toFixed(1), z: +c.pos.z.toFixed(1) };
});
await pag.waitForTimeout(1400);
await pag.screenshot({ path: 'tropa/r-2-velocidad.png' });
console.log('monta:', JSON.stringify(v));
await nav.close();
