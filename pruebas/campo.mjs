import { chromium } from 'playwright';
const nav = await chromium.launch({ executablePath: process.env.CHROMIUM,
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
const pag = await nav.newPage({ viewport: { width: 1280, height: 620 } });
pag.on('pageerror', e => console.log('[EXCEPCION]', e.message));
await pag.goto('http://localhost:8099/index.html', { waitUntil: 'load' });
await pag.waitForTimeout(1200); await pag.click('#modo-campo'); await pag.waitForTimeout(2200);
const ev = (f, ...a) => pag.evaluate(f, ...a);

const tomas = [
  { n: 'c-1-convento', pos: [0, 1.75, -22], yaw: Math.PI, pitch: 0.10 },
  { n: 'c-2-campo',    pos: [0, 1.75, -6],  yaw: 0,        pitch: -0.02 },
  { n: 'c-3-barranca', pos: [4, 1.75, -70], yaw: 0,        pitch: -0.06 },
  { n: 'c-4-rio',      pos: [4, 4.20, -80], yaw: 0,        pitch: -0.13 }
];
const info = [];
for (const t of tomas) {
  await ev(d => {
    const j = window.juego;
    j.soldados.forEach(s => s.quitar()); j.soldados.length = 0;
    j.jugador.desmontar && j.jugador.monta && j.jugador.desmontar();
    j.jugador.pos.set(d.pos[0], d.pos[1], d.pos[2]);
    j.jugador.yaw = d.yaw; j.jugador.pitch = d.pitch;
  }, t);
  await pag.waitForTimeout(1600);
  await pag.screenshot({ path: 'tropa/' + t.n + '.png' });
  info.push([t.n, await ev(() => window.juego.info.calls)]);
}
console.log(info.map(([n, c]) => `${n}: ${c} llamadas`).join('\n'));
await nav.close();
