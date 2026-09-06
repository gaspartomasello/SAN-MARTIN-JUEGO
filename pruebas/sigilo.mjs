// EL SIGILO DEL PASO. Lo que hace que el capítulo 2 no sea San Lorenzo con
// nieve: una guardia realista quieta en el corral y un camino para llegar sin
// que te vean. Se prueba el sistema entero por donde lo toca el que juega —el
// bucle de verdad, `simular`, y las teclas de postura que ya existían— y no la
// clase suelta: la mitad de los defectos de este proyecto vivieron justo en la
// diferencia entre el sistema y el arnés que lo probaba.
import { chromium } from 'playwright';
const nav = await chromium.launch({ executablePath: process.env.CHROMIUM,
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
const pag = await nav.newPage({ viewport: { width: 1180, height: 700 } });
const errs = []; pag.on('pageerror', e => errs.push(e.message));
pag.on('console', m => { if (m.type() === 'error' && !/404|ERR_CONNECTION/.test(m.text())) errs.push(m.text()); });
await pag.goto('http://localhost:8099/index.html', { waitUntil: 'load' });
await pag.waitForFunction(() => !!window.juego, null, { timeout: 90000 });
await pag.waitForTimeout(900);
const ev = (f, ...a) => pag.evaluate(f, ...a);

const T = [];
const dilo = (n, ok, x) => T.push([ok ? 'OK ' : 'MAL', n, x === undefined ? '' : x]);

// ---- en San Lorenzo no hay sigilo que valga ----
await pag.click('#modo-batalla');
await pag.waitForSelector('#plano:not(.oculto)', { timeout: 10000 });
await pag.click('#plano-entrar');
await pag.waitForTimeout(2600);
const sanLorenzo = await ev(() => ({
  centinelas: window.juego.sigilo.centinelas.length,
  quietos: window.juego.soldados.filter(s => s.centinela).length
}));
dilo('en San Lorenzo no hay guardia ni sigilo',
  sanLorenzo.centinelas === 0 && sanLorenzo.quietos === 0, JSON.stringify(sanLorenzo));

// ---- y en el paso sí ----
await pag.reload({ waitUntil: 'load' });
await pag.waitForFunction(() => !!window.juego, null, { timeout: 60000 });
await pag.waitForTimeout(1000);
await pag.click('#modo-andes');
await pag.waitForTimeout(2600);

// PLANTAR: deja al jugador donde uno quiere, con la postura que uno quiere, y
// devuelve cuántos segundos de mundo tardan en dar la alarma.
//
// Corre el BUCLE DE VERDAD —`simular`— y no la clase suelta, así que de paso
// prueba el cableado: que main le pase la postura, que le pase si estás quieto
// y que el capítulo lo gatee. El tiempo lo pone la prueba porque con SwiftShader
// el juego da dos cuadros por segundo y cuarenta y cinco segundos de reloj
// serían cuatro de mundo.
//
// Y CON UN SOLO CENTINELA. La primera versión los dejaba a los seis y medía
// cualquier cosa: el hombre escondido atrás de un peñón lo veía el centinela
// DE MÁS ATRÁS, a cuarenta y tres metros, y la prueba anotaba que la piedra no
// tapaba. Para comparar postura contra postura hay que dejar una sola variable
// suelta, y la de la garganta es la que se encuentra primero.
const plantar = async (x, z, postura, moviendo, tope = 40) => {
  if (moviendo) await pag.keyboard.down('KeyW');
  const r = await ev(({ x, z, postura, tope }) => {
    const j = window.juego, p = j.jugador;
    const uno = j.campo.guardia[0];
    // Y AL CENTINELA SE LO VUELVE A SU PUESTO. Sin esto la prueba se mentía
    // sola: la medición anterior terminaba en alarma, el hombre dejaba de ser
    // centinela, elegía blanco y CAMINABA, así que la siguiente lo encontraba
    // veinte metros más adelante y la piedra ya no tapaba nada. Un banco de
    // pruebas que no vuelve el mundo a cero mide la corrida anterior.
    const puesto = window.__puesto;
    uno.pos.set(puesto[0], 0, puesto[1]);
    uno.malla.position.set(puesto[0], 0, puesto[1]);
    uno.objetivo = null;
    uno.frente = puesto[2];
    uno.malla.rotation.y = puesto[2];
    // Y LA PARTIDA SE MANDA AL FONDO DEL VALLE. Ésta fue la otra manera en que
    // la prueba se mentía: el centinela también mira a TU gente, así que en
    // cuanto una medición terminaba en alarma los catorce granaderos se ponían
    // en marcha, y la medición siguiente los tenía a treinta metros del puesto.
    // Cada corrida salía más rápida que la anterior y parecía que ni agacharse
    // ni la piedra servían para nada. Para comparar una postura con otra tiene
    // que haber UNA sola cosa cambiando.
    for (const g of j.soldados) {
      if (g.esRealista) continue;
      g.objetivo = null;
      g.pos.set(g.pos.x, 0, 40);
      g.malla.position.set(g.pos.x, 0, 40);
    }
    j.sigilo.reiniciar();
    j.sigilo.poner([uno]);
    p.postura = postura;
    p.yaw = Math.PI;                     // mirándolos, que es lo peor que podés hacer
    p.pos.set(x, p.cfgPostura.altura, z);
    let t = 0;
    const dt = 1 / 30;
    while (!j.sigilo.alarma && t < tope) {
      j.simular(dt);
      // se lo vuelve a plantar: lo que se mide es la postura a distancia fija,
      // no una caminata
      p.pos.set(x, p.cfgPostura.altura, z);
      t += dt;
    }
    return { segundos: +t.toFixed(1), alarma: j.sigilo.alarma,
      sospecha: +j.sigilo.sospecha.toFixed(2) };
  }, { x, z, postura, tope });
  if (moviendo) await pag.keyboard.up('KeyW');
  return r;
};

await ev(() => {
  const s = window.juego.campo.guardia[0];
  window.__puesto = [s.pos.x, s.pos.z, s.frente];
});

const arranque = await ev(() => {
  const j = window.juego;
  return {
    guardia: j.sigilo.centinelas.length,
    quietos: j.soldados.filter(s => s.centinela).length,
    sinBlanco: j.soldados.filter(s => s.centinela && !s.objetivo).length,
    partida: j.soldados.filter(s => !s.esRealista).length
  };
});
dilo('la guardia sale montada y quieta',
  arranque.guardia === 6 && arranque.quietos === 6, JSON.stringify(arranque));
dilo('y ninguno elige blanco hasta que lo despierten',
  arranque.sinBlanco === arranque.guardia, `${arranque.sinBlanco}/${arranque.guardia}`);

// EL CENTINELA DE LA GARGANTA está en (4,5 · −66) mirando valle abajo. Todo lo
// que sigue se mide contra él.
const dePie = await plantar(4.5, -44, 'pie', true);
dilo('de pie y a la vista te ven en segundos', dePie.alarma && dePie.segundos < 8,
  `${dePie.segundos} s`);

// LA ESCALERA DE LAS POSTURAS. No se prueba «tirado no te ven nunca» —tirado
// en el medio del camino, a veintidós metros y con luna sobre la nieve, te ven:
// tarda, y eso es lo correcto— sino que cada escalón compre tiempo, que es la
// decisión que el que juega toma. De pie y moviéndose es el piso; agachado y
// quieto tiene que costar el doble; cuerpo a tierra, mucho más.
const agachado = await plantar(4.5, -44, 'agachado', false, 60);
const tierra = await plantar(4.5, -44, 'tierra', false, 60);
dilo('agachado y quieto compra tiempo', agachado.segundos > dePie.segundos * 2,
  `${agachado.segundos} s contra ${dePie.segundos} s de pie`);
dilo('y cuerpo a tierra, mucho más', tierra.segundos > agachado.segundos * 1.5,
  `${tierra.segundos} s contra ${agachado.segundos} s agachado`);

// LA PIEDRA TAPA. El peñón de (−4 · −52) queda entre el centinela y un hombre
// parado en la línea que los une: la prueba compara el MISMO hombre, a la misma
// distancia, adentro y afuera de la sombra de la piedra.
// LA PIEDRA TAPA. El peñón de (−4 · −52) queda entre el centinela de la
// garganta y un hombre parado en la línea que los une. Se compara al MISMO
// hombre, de pie, moviéndose y a la misma distancia: uno adentro de la sombra
// de la piedra y otro afuera. Es lo que hace que agacharse atrás de algo sea
// una decisión y no una pose.
const atras = await plantar(-7.9, -45.6, 'pie', true, 18);
const alLado = await plantar(16.9, -45.6, 'pie', true, 18);
dilo('atrás de un peñón no te ven, aunque estés parado y a la vista',
  !atras.alarma && alLado.alarma,
  `${atras.alarma ? atras.segundos + ' s' : 'no te vieron en 18 s'} contra ${alLado.segundos} s al descubierto, a la misma distancia`);

// TU PROPIA GENTE TE DELATA, que es lo que convierte esto en una misión y no
// en un juego de esconderse: podés estar vos perfecto y perderla igual porque
// un granadero se asomó. Se mide con el jugador fuera de alcance y un solo
// hombre tuyo plantado delante del centinela.
const teDelatan = await ev(() => {
  const j = window.juego, p = j.jugador;
  const uno = j.campo.guardia[0], q = window.__puesto;
  uno.pos.set(q[0], 0, q[1]); uno.malla.position.set(q[0], 0, q[1]);
  uno.objetivo = null; uno.frente = q[2]; uno.malla.rotation.y = q[2];
  j.sigilo.reiniciar(); j.sigilo.poner([uno]);
  p.postura = 'pie';
  p.pos.set(0, 1.68, 80);                      // vos, lejísimos y fuera de vista
  const mios = j.soldados.filter(g => !g.esRealista);
  for (const g of mios) { g.objetivo = null; g.pos.set(g.pos.x, 0, 40); g.malla.position.set(g.pos.x, 0, 40); }
  const uno2 = mios[0];
  uno2.pos.set(4.5, 0, -44); uno2.malla.position.set(4.5, 0, -44);
  let t = 0;
  while (!j.sigilo.alarma && t < 25) {
    j.simular(1 / 30);
    p.pos.set(0, 1.68, 80);
    uno2.pos.set(4.5, 0, -44); uno2.malla.position.set(4.5, 0, -44);
    t += 1 / 30;
  }
  return { segundos: +t.toFixed(1), alarma: j.sigilo.alarma };
});
dilo('un granadero tuyo asomado te delata igual',
  teDelatan.alarma, `${teDelatan.segundos} s con vos a ochenta metros`);

// LA ALARMA
const alarma = await ev(() => {
  const j = window.juego;
  j.sigilo.reiniciar(); j.sigilo.poner(j.campo.guardia);
  j.sigilo.dar(j.hud, null);
  for (let i = 0; i < 120; i++) j.simular(1 / 60);
  return {
    quietos: j.soldados.filter(s => s.centinela).length,
    conBlanco: j.campo.guardia.filter(s => !!s.objetivo).length,
    total: j.campo.guardia.length
  };
});
dilo('la alarma despierta a los seis', alarma.quietos === 0 && alarma.conBlanco === alarma.total,
  `${alarma.conBlanco}/${alarma.total} eligieron blanco`);

// EL CORRAL, LLEGANDO SIN QUE TE VEAN
const tomado = await ev(() => {
  const j = window.juego, p = j.jugador;
  j.sigilo.reiniciar(); j.sigilo.poner(j.campo.guardia);
  for (const s of j.campo.guardia) s.vivo = false;   // la guardia, ya despachada
  p.postura = 'pie';
  p.pos.set(-9, p.cfgPostura.altura, -114);
  for (let i = 0; i < 30; i++) j.simular(1 / 60);
  return { tomado: j.sigilo.tomado, alarma: j.sigilo.alarma };
});
dilo('llegar al corral sin que te vean lo da por tomado',
  tomado.tomado && !tomado.alarma, JSON.stringify(tomado));

// y una foto del ojo de la guardia a media carga
await ev(() => {
  const j = window.juego, p = j.jugador;
  const q = window.__puesto;
  for (const s of j.campo.guardia) s.vivo = true;
  const uno = j.campo.guardia[0];
  uno.pos.set(q[0], 0, q[1]); uno.malla.position.set(q[0], 0, q[1]);
  uno.objetivo = null; uno.frente = q[2]; uno.malla.rotation.y = q[2];
  j.sigilo.reiniciar(); j.sigilo.poner([uno]);
  j.hud.mostrarAviso('', 'bien');
  p.postura = 'pie';
  p.pos.set(4.5, p.cfgPostura.altura, -50);
  p.yaw = Math.PI; p.pitch = 0.02;
  for (let i = 0; i < 45 && j.sigilo.sospecha < 0.6; i++) {
    j.simular(1 / 30);
    p.pos.set(4.5, p.cfgPostura.altura, -50);
  }
  j.hud.sigilo(j.sigilo.sospecha, false);
});
await pag.waitForTimeout(900);
await pag.screenshot({ path: 'tropa/s-1-ojo.png' });

for (const [e, n, x] of T) console.log(e.padEnd(4), n.padEnd(52), x);
const mal = T.filter(t => t[0] === 'MAL').length;
console.log(`\n${T.length - mal} bien, ${mal} mal`);
console.log(errs.length ? 'ERRORES: ' + errs.join(' / ') : 'sin errores de consola');
await nav.close();
process.exit(mal ? 1 : 0);
