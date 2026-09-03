import { chromium } from 'playwright';
const nav = await chromium.launch({ executablePath: process.env.CHROMIUM,
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
const pag = await nav.newPage({ viewport: { width: 1280, height: 720 } });
pag.on('pageerror', e => console.log('[EXCEPCION]', e.message));
await pag.goto('http://localhost:8099/index.html', { waitUntil: 'load' });
await pag.waitForTimeout(1200); await pag.click('#modo-campo'); await pag.waitForTimeout(1500);

// cinco lanceros cruzando el campo al galope, vistos de costado
const r = await pag.evaluate(() => {
  const j = window.juego;
  j.soldados.forEach(s => s.quitar()); j.soldados.length = 0;
  for (const c of [...j.caballos]) { c.quitar(); j.caballos.splice(j.caballos.indexOf(c), 1); }
  j.jugador.pos.set(-4, 2.2, -33); j.jugador.yaw = Math.PI * 0.5; j.jugador.pitch = -0.02;
  for (let i = 0; i < 5; i++) {
    const s = j.soltarSoldado('granadero', { montado: true });
    s.monta.pos.set(-40 - i * 6, 0, -40 - (i % 3) * 6);
    s.monta.rumbo = -Math.PI / 2; s.monta.andar = 3; s.monta.vel = 10.2;
    s.actualizar = dt => { s.fig.poner('enristre'); s.fig.actualizar(dt, false);
      s.monta.actualizar(dt, {}); s.monta.actualizado = true; s._sentar(); };
  }
  // correr la simulación a mano: bajo swiftshader el bucle real va a 2 fps
  for (let i = 0; i < 60 * 3; i++) {
    for (const s of j.soldados) s.actualizar(1 / 60, j.jugador, j.soldados);
    j.humo.actualizar(1 / 60);
  }
  const n = j.humo.nubes.filter(x => x.viva && x.tierra > 0);
  const c = j.soldados[0] && j.soldados[0].monta;
  return { nubes: j.humo.vivas, tierra: n.length,
    caballoEn: c ? [+c.pos.x.toFixed(1), +c.pos.z.toFixed(1)] : null,
    polvoEn: n.length ? [+n[0].pos.x.toFixed(1), +n[0].pos.y.toFixed(1), +n[0].pos.z.toFixed(1)] : null };
});
await pag.waitForTimeout(900);
await pag.screenshot({ path: 'tropa/d-1-polvareda.png' });
console.log(JSON.stringify(r));
// ===========================================================================
// CHISPAS, Y LA SANGRE QUE SÓLO SALE SI LA PIDEN
// ===========================================================================
//
// Dos efectos que se agregaron juntos porque son el mismo sistema: un puñado
// de puntitos que salen de un sitio, caen y se apagan. Van en UN `Points` cada
// uno —una llamada de dibujo para las noventa y seis—, con el buffer reservado
// de una vez y las partículas recicladas: nada se crea mientras se juega.
//
// LA SANGRE VIENE APAGADA. Es la opción de la portada y la decisión de fondo:
// el juego que se abre por primera vez es apto para cualquiera. Lo que se
// prueba acá es que la puerta funcione en los DOS sentidos, porque una opción
// que no se puede apagar no es una opción, y una que no se puede encender
// tampoco.
const efectos = await pag.evaluate(() => {
  const j = window.juego, out = [];
  const ok = (n, c, x) => out.push([c ? 'OK ' : 'MAL', n, x === undefined ? '' : x]);
  const V = j.jugador.pos.constructor;
  const vivas = e => e.granos.filter(g => g.t >= 0).length;

  j.fuego.chispas(new V(0, 1.2, -2), new V(0, 1, 0));
  ok('el acero contra el acero suelta chispas', vivas(j.fuego.acero) > 8,
    `${vivas(j.fuego.acero)} chispas`);
  ok('y van todas en un solo Points', j.fuego.acero.malla.type === 'Points');

  // el blanco se pone donde la CÁMARA mira y a la distancia que ella mide: el
  // jugador puede estar montado y entonces la cámara no está donde él
  j.campo.limpiarCampo(); j.jugador.revivir(); j.jugador.pos.set(0, 1.68, 0);
  const mira = j.camara.getWorldDirection(new V());
  const donde = j.camara.position.clone().addScaledVector(mira, 1.6); donde.y = 0;
  const o = j.campo.soltarSoldado('realista', { pos: donde });
  const golpear = () => { const a = o.vida; j.combate.resolverGolpe(3.5, 1, 'prueba'); return a - o.vida; };

  const guardada = j.opciones.sangre;
  j.opciones.sangre = false;
  const pego = golpear();
  ok('el golpe de prueba conecta, que si no esto no prueba nada', pego > 0, `${pego} de vida`);
  ok('con la opción APAGADA no sale una gota', vivas(j.fuego.sangre) === 0,
    String(vivas(j.fuego.sangre)));

  j.opciones.sangre = true;
  o.vida = 99; o.vivo = true;
  golpear();
  ok('y encendida sí salpica', vivas(j.fuego.sangre) > 4, `${vivas(j.fuego.sangre)} gotas`);
  j.opciones.sangre = guardada;

  for (let i = 0; i < 90; i++) j.fuego.actualizar(0.016);
  ok('todo se apaga solo, no queda nada colgado',
    vivas(j.fuego.acero) === 0 && vivas(j.fuego.sangre) === 0);
  ok('y el Points se esconde cuando no queda ninguna',
    !j.fuego.acero.malla.visible && !j.fuego.sangre.malla.visible);
  return out;
});
console.log('');
for (const [e, n, x] of efectos) console.log(e.padEnd(4), n.padEnd(54), x);
const malE = efectos.filter(x => x[0] === 'MAL').length;
console.log(`\n${efectos.filter(x => x[0] === 'OK ').length} bien, ${malE} mal`);
await nav.close();
process.exit(malE ? 1 : 0);
