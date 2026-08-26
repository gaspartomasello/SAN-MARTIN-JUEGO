import { chromium } from 'playwright';
const nav = await chromium.launch({ executablePath: process.env.CHROMIUM,
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
const pag = await nav.newPage({ viewport: { width: 1280, height: 720 } });
pag.on('pageerror', e => console.log('[EXCEPCION]', e.message));
await pag.goto('http://localhost:8099/index.html', { waitUntil: 'load' });
await pag.waitForTimeout(1200); await pag.click('#empezar'); await pag.waitForTimeout(1500);
const ev = (f, ...a) => pag.evaluate(f, ...a);

const tomas = [
  { n: 'p-1-lancero',  tez: null,      pose: 'enristre',  cam: [2.4, 1.9, -2.2], mira: [0, 1.5, -4.6] },
  { n: 'p-2-cabral',   tez: 0x4e3020,  pose: 'lanzaAlto', cam: [1.3, 1.85, -3.0], mira: [0, 1.6, -4.6] },
  { n: 'p-3-lanzazo',  tez: 0x66422a,  pose: 'lanzazo',   cam: [2.8, 1.7, -2.6], mira: [0, 1.4, -4.6] }
];
for (const t of tomas) {
  await ev(d => {
    const j = window.juego;
    j.soldados.forEach(s => s.quitar()); j.soldados.length = 0;
    for (const c of [...j.caballos]) { if (c !== j.caballo) { c.quitar(); j.caballos.splice(j.caballos.indexOf(c), 1); } }
    if (j.caballo) j.caballo.pos.set(80, 0, 80);
    const s = j.soltarSoldado('granadero', { montado: true, tez: d.tez });
    s.monta.pos.set(0, 0, -4.6); s.monta.rumbo = Math.PI * 0.62;
    s.monta.vel = 0; s.monta.andar = 0;
    s.actualizar = dt => { s.fig.poner(d.pose); s.fig.actualizar(dt, false); s.monta.actualizar(dt, {}); s._sentar(); };
    j.jugador.pos.set(d.cam[0], d.cam[1], d.cam[2]);
    const dx = d.mira[0] - d.cam[0], dy = d.mira[1] - d.cam[1], dz = d.mira[2] - d.cam[2];
    j.jugador.yaw = Math.atan2(-dx, -dz);
    j.jugador.pitch = Math.atan2(dy, Math.hypot(dx, dz));
  }, t);
  await pag.waitForTimeout(2200);
  await pag.screenshot({ path: 'tropa/' + t.n + '.png' });
  console.log('listo', t.n);
}
await nav.close();
