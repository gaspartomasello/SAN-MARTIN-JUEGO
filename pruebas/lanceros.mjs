import { chromium } from 'playwright';
const nav = await chromium.launch({ executablePath: process.env.CHROMIUM,
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
const pag = await nav.newPage({ viewport: { width: 1280, height: 720 } });
pag.on('pageerror', e => console.log('[EXCEPCION]', e.message));
await pag.goto('http://localhost:8099/index.html', { waitUntil: 'load' });
await pag.waitForTimeout(1200); await pag.click('#empezar'); await pag.waitForTimeout(1500);
const ev = (f, ...a) => pag.evaluate(f, ...a);

// 1. cuatro lanceros de perfil, quietos, para ver la lanza y las tez
await ev(() => {
  const j = window.juego;
  j.soldados.forEach(s => s.quitar()); j.soldados.length = 0;
  for (const c of [...j.caballos]) { if (c !== j.caballo) { c.quitar(); j.caballos.splice(j.caballos.indexOf(c), 1); } }
  j.jugador.desmontar?.();
  j.jugador.pos.set(0, 1.75, 9); j.jugador.yaw = 0; j.jugador.pitch = -0.05;
  const tez = [null, 0x4e3020, null, 0x66422a];
  for (let i = 0; i < 4; i++) {
    const s = j.soltarSoldado('granadero', { montado: true, tez: tez[i] });
    s.monta.pos.set(-5.4 + i * 3.6, 0, -3.5);
    s.monta.rumbo = Math.PI * 0.5;
    s.monta.vel = 0; s.monta.andar = 0;
    s.estado = 'volver'; s.tPasada = 99;      // asta al hombro, quietos
    s.congelado = true;
  }
});
// congelar la IA: se sientan y se dejan mirar
await ev(() => {
  const j = window.juego;
  for (const s of j.soldados) {
    if (!s.congelado) continue;
    const orig = s.actualizar.bind(s);
    s.actualizar = dt => { s.fig.poner('enristre'); s.fig.actualizar(dt, false); s._sentar(); };
  }
});
await pag.waitForTimeout(2500);
await pag.screenshot({ path: 'tropa/l-1-lanceros.png' });

// 2. la carga vista de frente
await ev(() => {
  const j = window.juego;
  j.soldados.forEach(s => s.quitar()); j.soldados.length = 0;
  for (const c of [...j.caballos]) { if (c !== j.caballo) { c.quitar(); j.caballos.splice(j.caballos.indexOf(c), 1); } }
  j.jugador.pos.set(0, 1.75, 0); j.jugador.yaw = Math.PI; j.jugador.pitch = -0.02;
  for (let i = 0; i < 5; i++) {
    const s = j.soltarSoldado('granadero', { montado: true });
    s.monta.pos.set(-7 + i * 3.5, 0, -40 - (i % 2) * 4);
    s.monta.rumbo = 0; s.monta.andar = 3; s.monta.vel = 10.2;
  }
  const e = j.soltarSoldado('realista');
  e.malla.position.set(0, 0, -8);
});
await pag.waitForTimeout(2200);
await pag.screenshot({ path: 'tropa/l-2-carga.png' });

// 3. el salto, desde la silla
const salto = await ev(() => new Promise(res => {
  const j = window.juego;
  const c = j.caballo || j.caballos[0];
  j.soldados.forEach(s => s.quitar()); j.soldados.length = 0;
  c.pos.set(0, 0, 6); c.rumbo = Math.PI; c.vida = 6; c.vivo = true; c.alto = 0; c.enElAire = false;
  j.jugador.montar(c);
  c.andar = 3; c.vel = 10.2;
  let apice = 0, n = 0;
  const t = () => {
    n++;
    if (c.puedeSaltar && c.obstaculoAdelante(6)) c.saltar();
    apice = Math.max(apice, c.alto);
    if (c.alto > 0.45 || n > 900) return res({ apice: +apice.toFixed(2), alto: +c.alto.toFixed(2), cuadros: n });
    requestAnimationFrame(t);
  };
  requestAnimationFrame(t);
}));
await pag.screenshot({ path: 'tropa/l-3-salto.png' });
console.log('salto:', JSON.stringify(salto));
await nav.close();
