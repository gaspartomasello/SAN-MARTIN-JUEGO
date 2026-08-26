import { chromium } from 'playwright';
const nav = await chromium.launch({ executablePath: process.env.CHROMIUM,
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
const pag = await nav.newPage({ viewport: { width: 1280, height: 620 } });
pag.on('pageerror', e => console.log('[EXCEPCION]', e.message));
await pag.goto('http://localhost:8099/index.html', { waitUntil: 'load' });
await pag.waitForTimeout(1200); await pag.click('#empezar'); await pag.waitForTimeout(1800);

await pag.evaluate(() => {
  const j = window.juego;
  j.soldados.forEach(s => s.quitar()); j.soldados.length = 0;
  j.canones.forEach(c => { c.vivo = false; });
  const c = j.caballos.find(x => x.vivo) || j.caballo;
  c.pos.set(0, 0, -30); c.rumbo = 0; c.vida = 6; c.vivo = true; c.caida = 0; c.colisiones = [];
  j.jugador.vida = 100; j.jugador.montar(c);
  c.recibir(9);
  window._teclas = new Set();
  window._paso = seg => {
    const j2 = window.juego;
    for (let i = 0; i < seg * 60; i++) {
      if (j2.jugador.monta && !j2.jugador.monta.vivo && j2.acto.puedeArrancar(j2.jugador.monta)) j2.acto.arrancar(j2.jugador.monta);
      j2.acto.actualizar(1 / 60, window._teclas);
      for (const s of j2.soldados) s.actualizar(1 / 60, j2.jugador, j2.soldados);
      for (const cb of j2.caballos) { if (cb.actualizado) { cb.actualizado = false; continue; } cb.actualizar(1 / 60, { girar: 0 }); }
      j2.jugador.actualizar(1 / 60, window._teclas, false, false);
    }
  };
  window._teclas.add('Space');
  window._paso(0.2);
});
const foto = async (seg, nombre) => {
  await pag.evaluate(s => window._paso(s), seg);
  await pag.waitForTimeout(900);
  await pag.screenshot({ path: 'tropa/k-' + nombre + '.png' });
};
await foto(2.6, '1-atrapado');
await foto(5.2, '2-cabral');
await foto(2.0, '3-levanta');
await foto(4.4, '4-cae');
await foto(2.4, '5-frase');
console.log('listo');
await nav.close();
