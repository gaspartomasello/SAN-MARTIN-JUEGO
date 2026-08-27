import { chromium } from 'playwright';
const SP = process.env.SP || 'tropa';
const nav = await chromium.launch({ executablePath: process.env.CHROMIUM,
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
const pag = await nav.newPage({ viewport: { width: 1280, height: 720 } });
pag.on('pageerror', e => console.log('[EXCEPCION]', e.message));
pag.on('console', m => { if (m.type() === 'error') console.log('[CONSOLA]', m.text()); });
await pag.goto('http://localhost:8099/index.html', { waitUntil: 'load' });
await pag.waitForTimeout(1200); await pag.click('#modo-campo'); await pag.waitForTimeout(1500);
const ev = (f, ...a) => pag.evaluate(f, ...a);

// una línea de seis realistas viniendo de frente
await ev(() => {
  const j = window.juego;
  j.jugador.pos.set(0, 1.68, 6); j.jugador.yaw = 0; j.jugador.pitch = -0.03;
  j.soldados.forEach(s => s.quitar()); j.soldados.length = 0;
  for (let i = 0; i < 6; i++) {
    j.soltarSoldado(i < 4 ? 'realista' : 'granadero');
    const s = j.soldados[j.soldados.length - 1];
    s.pos.set(-4.5 + i * 1.8, 0, -6 - (i % 2) * 1.5);
  }
});
await pag.waitForTimeout(4000);
await pag.screenshot({ path: SP + '/linea.png' });

const stats = await ev(() => new Promise(r => {
  const inicio = performance.now(); let n = 0;
  const t = () => { n++; if (performance.now() - inicio < 3000) requestAnimationFrame(t);
    else r({ fps: Math.round(n / ((performance.now() - inicio) / 1000)),
             estado: window.juego.soldados.map(s => s.estado + (s.avisando ? '!' : '')).join(' ') }); };
  requestAnimationFrame(t);
}));
console.log('fps:', stats.fps, '| estados:', stats.estado);
await pag.waitForTimeout(6000);
await pag.screenshot({ path: SP + '/choque.png' });
await nav.close();
