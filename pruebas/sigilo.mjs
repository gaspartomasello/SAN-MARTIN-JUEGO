// EL SIGILO Y LA MARCHA DEL PASO — las dos mecánicas del capítulo 2, y van
// juntas en un archivo porque son la misma decisión: la guardia mira a tu
// gente igual que a vos, así que cómo llevás la fila ES el sigilo.
//
// Lo que hace que el capítulo 2 no sea San Lorenzo con
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
//
// Y LA POSICIÓN SE MIDE DESDE EL CENTINELA, no en coordenadas escritas a mano.
// Esta prueba se rompió entera el día que el valle dejó de ser recto: los
// puntos estaban clavados —el jugador en x = 4,5— y con el eje corrido veinte
// metros el hombre quedaba adentro de la pared, fuera del cono, y todo daba
// «no te ven». Ahora se le pide al juego dónde está el centinela y para dónde
// mira, y el jugador se planta a tantos metros DELANTE de él.
const plantar = async (metros, desvio, postura, moviendo, tope = 40) => {
  if (moviendo) await pag.keyboard.down('KeyW');
  const r = await ev(({ metros, desvio, postura, tope }) => {
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
    // delante del centinela, sobre la línea a la que da la cara
    const fx = -Math.sin(uno.frente), fz = -Math.cos(uno.frente);
    const x = uno.pos.x + fx * metros - fz * desvio;
    const z = uno.pos.z + fz * metros + fx * desvio;
    p.yaw = uno.frente + Math.PI;         // mirándolo, que es lo peor que podés hacer
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
      sospecha: +j.sigilo.sospecha.toFixed(2),
      donde: [+x.toFixed(1), +z.toFixed(1)] };
  }, { metros, desvio, postura, tope });
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
// AL DESCUBIERTO, nueve metros al costado de la línea: justo delante del
// centinela hay una piedra —puesta a propósito, para que el primero al que hay
// que esquivar se pueda esquivar— y midiendo ahí la escalera de posturas se
// estaría midiendo la sombra de la piedra en vez de la postura.
const dePie = await plantar(22, 9, 'pie', true);
dilo('de pie y a la vista te ven en segundos', dePie.alarma && dePie.segundos < 8,
  `${dePie.segundos} s`);

// LA ESCALERA DE LAS POSTURAS. No se prueba «tirado no te ven nunca» —tirado
// en el medio del camino, a veintidós metros y con luna sobre la nieve, te ven:
// tarda, y eso es lo correcto— sino que cada escalón compre tiempo, que es la
// decisión que el que juega toma. De pie y moviéndose es el piso; agachado y
// quieto tiene que costar el doble; cuerpo a tierra, mucho más.
const agachado = await plantar(22, 9, 'agachado', false, 60);
const tierra = await plantar(22, 9, 'tierra', false, 60);
dilo('agachado y quieto compra tiempo', agachado.segundos > dePie.segundos * 2,
  `${agachado.segundos} s contra ${dePie.segundos} s de pie`);
dilo('y cuerpo a tierra, mucho más', tierra.segundos > agachado.segundos * 1.5,
  `${tierra.segundos} s contra ${agachado.segundos} s agachado`);

// LA PIEDRA TAPA. Se compara al MISMO hombre, de pie, moviéndose y a la misma
// distancia: uno adentro de la sombra de una piedra y otro afuera.
//
// Y LA PIEDRA SE BUSCA, no se escribe. Antes estaba anotada a mano —«el peñón
// de (−4 · −52)»— y el día que el valle dobló ese peñón se mudó y la prueba
// pasó a medir dos veces el descubierto. Ahora se le pregunta al mundo cuál de
// las cajas bajas está delante del centinela, y el hombre se planta justo
// detrás. Si no hubiera ninguna, la prueba lo dice en vez de aprobar sola.
const sombra = await ev(() => {
  const j = window.juego;
  const uno = j.campo.guardia[0], q = window.__puesto;
  uno.pos.set(q[0], 0, q[1]); uno.malla.position.set(q[0], 0, q[1]);
  uno.frente = q[2];
  const fx = -Math.sin(q[2]), fz = -Math.cos(q[2]);
  let mejor = null;
  for (const c of j.mundo.colisiones) {
    if (c.max.y > 4) continue;
    const cx = (c.min.x + c.max.x) / 2 - q[0], cz = (c.min.z + c.max.z) / 2 - q[1];
    const alo = cx * fx + cz * fz;                  // cuánto adelante
    const aLado = Math.abs(cx * -fz + cz * fx);     // cuánto de costado
    if (alo < 7 || alo > 22 || aLado > 2.6) continue;
    if (!mejor || alo < mejor.alo) mejor = { alo, aLado: cx * -fz + cz * fx };
  }
  return mejor;
});
dilo('hay una piedra delante del centinela para probar la sombra', !!sombra,
  sombra ? `a ${sombra.alo.toFixed(1)} m` : 'no se encontró ninguna caja baja en la línea');
const atras = sombra ? await plantar(sombra.alo * 1.55, sombra.aLado, 'pie', true, 18) : null;
const alLado = sombra ? await plantar(sombra.alo * 1.55, sombra.aLado + 9, 'pie', true, 18) : null;
dilo('atrás de un peñón no te ven, aunque estés parado y a la vista',
  !!atras && !atras.alarma && !!alLado && alLado.alarma,
  atras ? `${atras.alarma ? atras.segundos + ' s' : 'no te vieron en 18 s'} contra ${alLado.segundos} s al descubierto, a la misma distancia` : '');

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
  p.pos.set(j.paso.eje(80), 1.68, 80);         // vos, lejísimos y fuera de vista
  const mios = j.soldados.filter(g => !g.esRealista);
  for (const g of mios) { g.objetivo = null; g.pos.set(j.paso.eje(40), 0, 40); g.malla.position.set(j.paso.eje(40), 0, 40); }
  // el granadero, veintidós metros delante del centinela, como el jugador de arriba
  const fx = -Math.sin(q[2]), fz = -Math.cos(q[2]);
  // veintidós metros adelante y NUEVE DE COSTADO: en la línea derecha del
  // centinela hay una piedra —la que tiene el paso para que haya con qué
  // taparse— y el hombre quedaba escondido atrás. Se estaría midiendo la
  // piedra, no al hombre.
  const gx = q[0] + fx * 22 - fz * 9, gz = q[1] + fz * 22 + fx * 9;
  const uno2 = mios[0];
  uno2.pos.set(gx, 0, gz); uno2.malla.position.set(gx, 0, gz);
  let t = 0;
  while (!j.sigilo.alarma && t < 25) {
    j.simular(1 / 30);
    p.pos.set(j.paso.eje(80), 1.68, 80);
    uno2.pos.set(gx, 0, gz); uno2.malla.position.set(gx, 0, gz);
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
  // al corral se le pregunta dónde está: se mudó cuando el valle dobló
  const c = j.paso.corral;
  p.pos.set(c.x, p.cfgPostura.altura, c.z + 6);
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

// ---------------------------------------------------------------------------
// LA MARCHA DE LA PARTIDA
// ---------------------------------------------------------------------------
// La Q se aprieta DE VERDAD, desde el teclado, porque el defecto que esto
// arregla era justamente que la tecla no hacía nada a pie: el camino entero
// —mando.js → main.llamarPartida → Marcha → la plaza de cada hombre— es lo que
// hay que probar, no la clase suelta.
const partida = async (segundos, teclas = ['KeyW']) => {
  for (const t of teclas) await pag.keyboard.down(t);
  const r = await ev(seg => {
    const j = window.juego, p = j.jugador;
    for (let i = 0; i < seg * 30; i++) j.simular(1 / 30);
    const ps = j.campo.partida.filter(s => s.vivo);
    const xs = ps.map(s => s.pos.x), zs = ps.map(s => s.pos.z);
    return {
      siguiendo: j.marcha.siguiendo,
      vos: [+p.pos.x.toFixed(1), +p.pos.z.toFixed(1)],
      ancho: +(Math.max(...xs) - Math.min(...xs)).toFixed(1),
      largo: +(Math.max(...zs) - Math.min(...zs)).toFixed(1),
      masCerca: +Math.min(...ps.map(s => Math.hypot(s.pos.x - p.pos.x, s.pos.z - p.pos.z))).toFixed(1),
      deRodillas: ps.filter(s => s.rodilla).length,
      corriendo: ps.filter(s => s.fig.pose === 'correr').length,
      conPlaza: ps.filter(s => !!s.plaza).length,
      cuantos: ps.length
    };
  }, segundos);
  for (const t of teclas) await pag.keyboard.up(t);
  return r;
};

// vuelta al arranque limpio del capítulo
await ev(() => {
  const j = window.juego;
  j.campo.formarCordillera();
  j.jugador.postura = 'pie';
});
await pag.waitForTimeout(300);

const quietos = await ev(() => ({
  siguiendo: window.juego.marcha.siguiendo,
  conPlaza: window.juego.campo.partida.filter(s => !!s.plaza).length
}));
dilo('la partida arranca sin orden y sin plaza',
  !quietos.siguiendo && quietos.conPlaza === 0, JSON.stringify(quietos));

await pag.keyboard.press('KeyQ');
const marchando = await partida(14);
dilo('la Q los pone en marcha, a pie y desde el teclado',
  marchando.siguiendo && marchando.conPlaza === marchando.cuantos,
  `${marchando.conPlaza}/${marchando.cuantos} con plaza escrita`);
dilo('van en FILA y no en bandada', marchando.ancho < 3.5 && marchando.largo > 18,
  `${marchando.ancho} m de ancho por ${marchando.largo} m de largo`);
dilo('y el primero te pisa los talones', marchando.masCerca < 9,
  `${marchando.masCerca} m atrás tuyo`);

// LA SEGUNDA Q: alto. Y quedarse quieto es quedarse quieto, no volver a la IA
// de siempre y salir a buscar realistas por su cuenta.
await pag.keyboard.press('KeyQ');
const parados = await ev(() => ({ siguiendo: window.juego.marcha.siguiendo,
  donde: window.juego.campo.partida.filter(s => s.vivo).map(s => [+s.pos.x.toFixed(1), +s.pos.z.toFixed(1)]) }));
const lejos = await partida(10);
const movido = await ev(donde => {
  const ps = window.juego.campo.partida.filter(s => s.vivo);
  return +Math.max(...ps.map((s, i) => Math.hypot(s.pos.x - donde[i][0], s.pos.z - donde[i][1]))).toFixed(1);
}, parados.donde);
dilo('la segunda Q los para', !parados.siguiendo && !lejos.siguiendo);
dilo('y parados se quedan aunque vos te vayas', movido < 2.5,
  `el que más se movió, ${movido} m, con vos a ${lejos.masCerca} m`);

// AL REANUDAR, CIERRAN EL HUECO. Se los deja alcanzar con el jugador quieto:
// venían de quedarse plantados mientras vos te ibas cuarenta metros.
await pag.keyboard.press('KeyQ');                 // otra vez en marcha
const alcanzando = await partida(16, []);
dilo('al reanudar, cierran el hueco que dejaron', alcanzando.masCerca < 9,
  `de ${lejos.masCerca} m a ${alcanzando.masCerca} m`);

// LA POSTURA: si el jefe se agacha, se agacha la fila.
//
// Y ANTES, EL CAPÍTULO SE REARMA. Sin esto la prueba caminaba noventa metros
// valle abajo encadenando bloques, se metía dentro de la guardia, te mataban,
// y al morir la postura del jugador vuelve a 'pie': la prueba anotaba «no se
// agachan» cuando lo que pasaba era que el que daba la orden estaba muerto.
await ev(() => { window.juego.campo.formarCordillera(); window.juego.jugador.postura = 'pie'; });
await pag.waitForTimeout(300);
await pag.keyboard.press('KeyQ');
await partida(8);

await pag.keyboard.press('KeyC');                 // y vos, agachado
const agachados = await partida(6);
dilo('si te agachás, se agacha la fila',
  agachados.deRodillas === agachados.cuantos,
  `${agachados.deRodillas}/${agachados.cuantos} con la rodilla en tierra`);
dilo('y agachados te siguen igual, sin descolgarse',
  agachados.masCerca < 12, `el primero a ${agachados.masCerca} m`);
dilo('y agachados NO corren, que sería hacerse el sigiloso a los gritos',
  agachados.corriendo === 0, `${agachados.corriendo} en carrera`);
await pag.keyboard.press('KeyC');                 // de pie otra vez
const dePieOtraVez = await partida(4);
dilo('y al pararte vos, se paran ellos', dePieOtraVez.deRodillas === 0,
  `${dePieOtraVez.deRodillas} quedaron de rodillas`);

// Y LO QUE CIERRA EL CÍRCULO: agachar la fila la esconde de verdad. El mismo
// granadero, en el mismo lugar, delante del mismo centinela.
const esconderse = await ev(() => {
  const j = window.juego, p = j.jugador;
  const uno = j.campo.guardia[0], q = window.__puesto;
  const mio = j.campo.partida.find(s => s.vivo);
  const fx = -Math.sin(q[2]), fz = -Math.cos(q[2]);
  // veintidós metros adelante y NUEVE DE COSTADO: en la línea derecha del
  // centinela hay una piedra —la que tiene el paso para que haya con qué
  // taparse— y el hombre quedaba escondido atrás. Se estaría midiendo la
  // piedra, no al hombre.
  const gx = q[0] + fx * 22 - fz * 9, gz = q[1] + fz * 22 + fx * 9;
  const mide = (rodilla) => {
    uno.pos.set(q[0], 0, q[1]); uno.malla.position.set(q[0], 0, q[1]);
    uno.objetivo = null; uno.frente = q[2]; uno.malla.rotation.y = q[2];
    j.sigilo.reiniciar(); j.sigilo.poner([uno]);
    p.pos.set(j.paso.eje(80), 1.68, 80);         // vos, lejísimos
    for (const g of j.campo.partida) { g.plaza = null; g.pos.set(j.paso.eje(60), 0, 60); g.malla.position.set(j.paso.eje(60), 0, 60); }
    mio.pos.set(gx, 0, gz); mio.malla.position.set(gx, 0, gz);
    mio.rodilla = rodilla; mio.fig.rodilla = rodilla;
    let t = 0;
    while (!j.sigilo.alarma && t < 30) {
      j.sigilo.actualizar(1 / 30, { jugador: p, quieto: true, postura: p.cfgPostura,
        soldados: [mio], colisiones: j.mundo.colisiones });
      mio.pos.set(gx, 0, gz); mio.malla.position.set(gx, 0, gz);
      mio.rodilla = rodilla;
      t += 1 / 30;
    }
    return +t.toFixed(1);
  };
  return { parado: mide(false), agachado: mide(true) };
});
dilo('un granadero agachado tarda más en delatarte',
  esconderse.agachado > esconderse.parado * 1.5,
  `${esconderse.agachado} s agachado contra ${esconderse.parado} s parado`);

for (const [e, n, x] of T) console.log(e.padEnd(4), n.padEnd(52), x);
const mal = T.filter(t => t[0] === 'MAL').length;
console.log(`\n${T.length - mal} bien, ${mal} mal`);
console.log(errs.length ? 'ERRORES: ' + errs.join(' / ') : 'sin errores de consola');
await nav.close();
process.exit(mal ? 1 : 0);
