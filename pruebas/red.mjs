// LOS DOS COSTADOS. Dos navegadores de verdad, el servidor de verdad y el
// cable de verdad. Lo que hay que probar no es que se conecten: es que los dos
// estén viendo LA MISMA batalla.
//
// Cuatro cosas, y si falla cualquiera el modo no sirve:
//
//   1. que el invitado vea el campo entero sin simularlo —los hombres, los
//      caballos y las piezas que armó el otro—;
//   2. que lo vea en el mismo lugar, no cerca;
//   3. que un tiro del invitado MATE del lado del anfitrión, que es lo único
//      que hace que peleen la misma batalla y no dos parecidas;
//   4. que la columna del este siga al invitado, que es la pinza.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const PUERTO = 8123;
const servidor = spawn(process.execPath, ['herramientas/servidor.mjs', String(PUERTO)],
  { stdio: ['ignore', 'pipe', 'pipe'] });
const dicho = [];
servidor.stdout.on('data', d => dicho.push(String(d)));
servidor.stderr.on('data', d => dicho.push('ERR ' + d));
await new Promise(r => setTimeout(r, 900));

// El servidor se apaga pase lo que pase, y esto va ACÁ y no más abajo: si la
// prueba se cae en el primer paso, un servidor huérfano deja el puerto tomado
// y la corrida siguiente falla sin ningún motivo aparente.
const cerrar = () => { try { servidor.kill(); } catch { /* ya no estaba */ } };
process.on('exit', cerrar);
process.on('uncaughtException', e => { console.error(e); cerrar(); process.exit(1); });

const nav = await chromium.launch({ executablePath: process.env.CHROMIUM,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox',
    '--autoplay-policy=no-user-gesture-required'] });

// ---------------------------------------------------------------------------
// 0 · LA SALA, ANTES QUE NADA Y SIN CARGAR EL JUEGO
// ---------------------------------------------------------------------------
//
// Esto va primero y con una página en blanco a propósito: una sala rota tiene
// que fallar en diez segundos y no después de armar dos batallas enteras. Y lo
// que se prueba —quién es quién, qué pasa con el tercero, y sobre todo si el
// que queda se entera de que el otro se fue— no necesita un solo granadero.
//
// El agujero que encontró esta prueba: el aviso de «se fue» colgaba de una
// bandera que la trama de cierre ya había bajado, así que sólo avisaba cuando
// alguien se iba MAL —un cable, un wifi cortado—. Cerrar la pestaña, que es lo
// que hace todo el mundo, dejaba el lugar tomado por un muerto y la sala
// inservible hasta reiniciar el servidor.
{
  const navSala = await chromium.launch({ executablePath: process.env.CHROMIUM, args: ['--no-sandbox'] });
  const pag = await navSala.newPage();
  await pag.goto('about:blank');
  const r = await pag.evaluate(async (puerto) => {
    const out = [];
    const ok = (n, cond, extra) => out.push([cond ? 'OK ' : 'MAL', n, extra === undefined ? '' : extra]);
    const abiertas = [];
    const abrirWs = () => new Promise(res => {
      const ws = new WebSocket('ws://localhost:' + puerto);
      const yo = { ws, mensajes: [] };
      ws.onmessage = e => { try { yo.mensajes.push(JSON.parse(e.data)); } catch { /* binario */ } };
      ws.onopen = () => res(yo);
      abiertas.push(yo);
    });
    const esperar = (yo, t, ms = 4000) => new Promise(res => {
      const desde = Date.now();
      const i = setInterval(() => {
        const m = yo.mensajes.filter(x => x.t === t).pop();
        if (m || Date.now() - desde > ms) { clearInterval(i); res(m || null); }
      }, 25);
    });

    const uno = await abrirWs();
    const m1 = await esperar(uno, 'sala');
    ok('el primero es el anfitrión', m1 && m1.rol === 'anfitrion', m1 && m1.rol);
    ok('y la sala todavía no está completa', m1 && !m1.completa);

    const dos = await abrirWs();
    const m2 = await esperar(dos, 'sala');
    ok('el segundo es el invitado', m2 && m2.rol === 'invitado', m2 && m2.rol);
    ok('y ahí sí está completa', m2 && !!m2.completa);
    ok('al primero le avisan que entró el otro', (await esperar(uno, 'par')) !== null);

    const tres = await abrirWs();
    ok('el tercero rebota, y con motivo', (await esperar(tres, 'lleno')) !== null);

    uno.ws.send(JSON.stringify({ t: 'aviso', texto: 'probando', tipo: 'bien' }));
    const paso = await esperar(dos, 'aviso');
    ok('lo que manda uno le llega al otro', paso && paso.texto === 'probando');

    dos.ws.close();
    const salio = await esperar(uno, 'par', 6000);
    ok('al que queda le avisan que el otro se fue', salio && salio.entra === false,
      JSON.stringify(salio));

    // y el lugar queda libre de verdad: si no, la sala muere con el primero
    // que cierre la pestaña y hay que reiniciar el servidor
    const cuatro = await abrirWs();
    const m4 = await esperar(cuatro, 'sala');
    ok('y su lugar queda libre para otro', m4 && m4.rol === 'invitado',
      m4 ? m4.rol : 'no entró');

    for (const a of abiertas) { try { a.ws.close(); } catch { /* ya estaba */ } }
    return out;
  }, PUERTO);
  await navSala.close();
  for (const [e, n, x] of r) console.log(e.padEnd(4), n.padEnd(44), x);
  const malSala = r.filter(x => x[0] === 'MAL').length;
  console.log(`  la sala: ${r.length - malSala} bien, ${malSala} mal\n`);
  if (malSala) { cerrar(); process.exit(1); }
  await new Promise(r2 => setTimeout(r2, 400));
}

const errs = [];
async function abrir (quien) {
  const p = await nav.newPage({ viewport: { width: 700, height: 460 } });
  p.on('pageerror', e => errs.push(`${quien}: ${e.message}`));
  await p.goto(`http://localhost:${PUERTO}/index.html`, { waitUntil: 'load', timeout: 120000 });
  await p.waitForFunction('window.juego && window.juego.red', null, { timeout: 25000 });
  return p;
}

// ---------------------------------------------------------------------------
// 0 bis · UN CÓDIGO MAL ESCRITO NO PUEDE TRABAR LA PUERTA
// ---------------------------------------------------------------------------
//
// Cuatro letras dictadas en voz alta se copian mal, y eso está previsto: sale
// el cartel de «no hay ninguna sala con ese código». Lo que no estaba previsto
// es lo que pasaba DESPUÉS.
//
// `entrarASala` arma el cable ANTES de que la conexión se abra —`cableDePar`
// envuelve la conexión en el molde de un WebSocket, y ese objeto existe desde
// el primer momento aunque del otro lado no conteste nadie—. Así que el
// intento fallido dejaba dos cosas puestas: el peer vivo y un cable en cero. Y
// el guardián de la entrada, «si ya hay peer o cable no hagas nada», los leía
// como una partida en curso: el segundo intento, con el código BUENO, salía
// por ahí sin llamar a nadie. Quedaba el cartel del error viejo en pantalla y
// ninguna forma de seguir salvo recargar la página.
//
// Se prueba con un directorio de mentira y sin red: lo que importa acá es el
// estado en el que queda el juego, no el directorio.
{
  const pag = await abrir('reintento');
  const r = await pag.evaluate(async () => {
    const out = [];
    const ok = (n, cond, extra) => out.push([cond ? 'OK ' : 'MAL', n, extra === undefined ? '' : extra]);
    const red = window.juego.red;
    let armados = 0;
    let romper = null;
    // Un directorio de mentira: abre, deja pedir una sala, y falla igual que
    // el de verdad cuando el código no existe.
    window.Peer = function () {
      armados++;
      const oyentes = {};
      this.on = (ev, f) => { (oyentes[ev] = oyentes[ev] || []).push(f); };
      this.destroy = () => {};
      this.connect = () => ({ on: () => {}, send: () => {}, close: () => {} });
      setTimeout(() => { for (const f of (oyentes.open || [])) f(); }, 10);
      romper = t => { for (const f of (oyentes.error || [])) f({ type: t }); };
    };
    const esperarFase = (f, ms = 3000) => new Promise(res => {
      const desde = Date.now();
      const i = setInterval(() => {
        if (red.parte().fase === f || Date.now() - desde > ms) { clearInterval(i); res(red.parte().fase); }
      }, 20);
    });

    red.cortar();
    red.entrarASala('ABCD');
    await esperarFase('llamando', 1000);
    // el respiro es lo que reproduce el bicho: sin él la conexión —y el cable
    // a medio armar que la envuelve— todavía no existe
    await new Promise(r2 => setTimeout(r2, 80));
    romper('peer-unavailable');
    ok('el código que no existe avisa y no conecta', red.parte().fase === 'caido', red.parte().fase);
    ok('y lo dice en castellano', /ninguna sala con ese código/.test(red.parte().motivo), red.parte().motivo);

    const antes = armados;
    red.entrarASala('WXYZ');
    const f2 = await esperarFase('llamando', 2000);
    ok('el segundo intento SÍ vuelve a llamar', f2 === 'llamando', f2);
    ok('y llama de nuevo al directorio', armados === antes + 1, `${armados - antes} llamadas`);
    ok('con el código nuevo puesto', red.codigo === 'WXYZ', String(red.codigo));

    red.cortar();
    ok('y volver atrás lo deja suelto', red.parte().fase === 'suelto', red.parte().fase);
    return out;
  });
  await pag.close();
  for (const [e, n, x] of r) console.log(e.padEnd(4), n.padEnd(44), x);
  const malCod = r.filter(x => x[0] === 'MAL').length;
  console.log(`  el reintento: ${r.length - malCod} bien, ${malCod} mal\n`);
  if (malCod) { cerrar(); process.exit(1); }
}

// El anfitrión entra PRIMERO: el que llega primero a la sala es el que lleva
// la batalla, y eso es parte de lo que se prueba.
const anf = await abrir('anfitrión');
await anf.click('#modo-red');
await anf.waitForTimeout(500);
const inv = await abrir('invitado');
await inv.click('#modo-red');
// se espera a que los DOS se den por completos: en una máquina cargada el
// apretón de manos puede tardar más que cualquier número que uno invente
for (const p of [anf, inv]) {
  await p.waitForFunction("window.juego.red.parte().fase === 'listo'", null, { timeout: 15000 })
    .catch(() => {});
}
await anf.waitForTimeout(200);

const out = [];
const ok = (n, cond, extra) => out.push([cond ? 'OK ' : 'MAL', n, extra === undefined ? '' : extra]);

const papel = async p => p.evaluate(() => window.juego.red.parte());
const pa = await papel(anf), pi = await papel(inv);
ok('el primero en llegar es el anfitrión', pa.rol === 'anfitrion', pa.rol);
ok('el segundo es el invitado', pi.rol === 'invitado', pi.rol);
ok('los dos ven la sala completa', pa.fase === 'listo' && pi.fase === 'listo', `${pa.fase} / ${pi.fase}`);
ok('y saben a quién están jugando', pa.nombre.includes('San Martín') && pi.nombre.includes('Bermúdez'),
  `${pa.nombre} / ${pi.nombre}`);
ok('el botón de salir al campo se habilitó solo',
  !(await anf.$eval('#sala-entrar', b => b.disabled)) && !(await inv.$eval('#sala-entrar', b => b.disabled)));

// ---- al campo, por el botón, como una persona ----
// los dos pasan por el plano, que además les dice cuál de las dos columnas
// les tocó: es lo único que distingue a San Martín de Bermúdez antes de entrar
for (const [p, quien] of [[anf, 'oeste'], [inv, 'este']]) {
  await p.click('#sala-entrar');
  await p.waitForSelector('#plano:not(.oculto)', { timeout: 10000 });
  const dice = await p.$eval('#plano-tuya', e => e.textContent);
  ok(`el plano le dice al ${quien === 'este' ? 'invitado' : 'anfitrión'} qué columna lleva`,
    dice.includes(quien), dice);
  await p.click('#plano-entrar');
  await p.waitForTimeout(400);
}

// Y se vuelve a formar chico: doscientos cincuenta hombres por dos navegadores
// con render por software no es una prueba, es una siesta. De paso se prueba
// el barrido: los trescientos setenta primeros tienen que DESAPARECER del lado
// del invitado, no quedar de fantasmas.
await anf.evaluate(() => window.juego.red.formarBatalla(8, 24));

// EL BUCLE, A MANO Y EN LOS DOS. Con render por software el navegador da dos
// cuadros por segundo: si esperáramos al reloj, esto tardaría media hora. Se
// corre el mundo de verdad —juego.simular— a paso fijo, alternando, y entre
// tanda y tanda se le deja al navegador el respiro que necesita para entregar
// lo que llegó por el cable.
async function latir (segundos, dt = 1 / 30) {
  const cuadros = Math.round(segundos / dt);
  for (let i = 0; i < cuadros; i += 6) {
    const n = Math.min(6, cuadros - i);
    await Promise.all([
      anf.evaluate(([n, dt]) => { for (let k = 0; k < n; k++) window.juego.simular(dt); }, [n, dt]),
      inv.evaluate(([n, dt]) => { for (let k = 0; k < n; k++) window.juego.simular(dt); }, [n, dt])
    ]);
    await anf.waitForTimeout(12);
  }
}

await latir(2.5);

const censo = p => p.evaluate(() => {
  const j = window.juego;
  return {
    soldados: j.soldados.length,
    granaderos: j.soldados.filter(s => s.bando === 'granadero').length,
    realistas: j.soldados.filter(s => s.esRealista).length,
    caballos: j.caballos.length,
    canones: j.canones.length,
    titeres: j.soldados.filter(s => s.titere).length,
    kbs: j.red.parte().kbs
  };
});

const ca = await censo(anf), ci = await censo(inv);
out.push(['—', 'anfitrión', JSON.stringify(ca)]);
out.push(['—', 'invitado ', JSON.stringify(ci)]);

// 8 + 8 granaderos + el compañero + 24 realistas + 4 artilleros
ok('el invitado ve a toda la tropa del anfitrión', ci.soldados === ca.soldados,
  `${ci.soldados} contra ${ca.soldados}`);
ok('y a todos los caballos', ci.caballos >= ca.caballos - 1, `${ci.caballos} contra ${ca.caballos}`);
ok('y las dos piezas', ci.canones === 2, String(ci.canones));
ok('el anfitrión no simula ningún títere salvo el compañero', ca.titeres === 1, String(ca.titeres));
ok('el invitado no simula NADA: todos son títeres', ci.titeres === ci.soldados, `${ci.titeres}/${ci.soldados}`);
ok('el barrido borró los 370 del primer armado', ci.realistas === ca.realistas,
  `${ci.realistas} contra ${ca.realistas}`);

// ---- 2. en el MISMO lugar, no cerca ----
const sitios = p => p.evaluate(() => {
  const m = {};
  for (const s of window.juego.soldados) if (s._red) m[s._red] = [+s.pos.x.toFixed(2), +s.pos.z.toFixed(2)];
  return m;
});
const sa = await sitios(anf), si = await sitios(inv);
let peor = 0, pares = 0;
for (const id of Object.keys(sa)) {
  if (!si[id]) continue;
  pares++;
  peor = Math.max(peor, Math.hypot(sa[id][0] - si[id][0], sa[id][1] - si[id][1]));
}
ok('todos los hombres emparejados por número', pares === Object.keys(sa).length, `${pares} pares`);
ok('y ninguno a más de medio metro del suyo', peor < 0.5, `el peor a ${peor.toFixed(2)} m`);

// ---- 3. el tiro del invitado mata del lado del anfitrión ----
//
// Es la prueba central del modo. Si esto falla, cada uno está peleando su
// propia batalla contra copias del mismo ejército.
const antes = await anf.evaluate(() => window.juego.soldados.filter(s => s.esRealista && s.vivo).length);
const pegado = await inv.evaluate(() => {
  const j = window.juego;
  const o = j.soldados.find(s => s.esRealista && s.vivo);
  if (!o) return null;
  const id = o._red;
  // el mismo golpe que da el sable: combate.js no sabe que hay una red
  const murio = o.recibir(99, null, 0);
  return { id, murio, vidaLocal: o.vida };
});
await latir(0.5);
const despues = await anf.evaluate(id => {
  const j = window.juego;
  const o = j.soldados.find(s => s._red === id);
  return { vivos: j.soldados.filter(s => s.esRealista && s.vivo).length, sigueVivo: o ? o.vivo : null };
}, pegado.id);
ok('el golpe del invitado viajó y mató del otro lado',
  despues.sigueVivo === false && despues.vivos === antes - 1,
  `${antes} → ${despues.vivos} vivos`);
const eco = await inv.evaluate(id => {
  const o = window.juego.soldados.find(s => s._red === id);
  return o ? o.vivo : 'ya no está';
}, pegado.id);
ok('y el parte de vuelta lo dio por muerto también acá', eco === false || eco === 'ya no está', String(eco));

// ---- 4. la columna del este sigue al invitado ----
const lejosAntes = await anf.evaluate(() => {
  const p = window.juego.pinza;
  return { conRemota: !!p.este.remota, sinJefe: p.este.jefe === null, hombres: p.este.hombres.length };
});
ok('la columna del este quedó sin jefe propio', lejosAntes.sinJefe && lejosAntes.conRemota);

// EL CLARÍN LO TOCA SAN MARTÍN Y SALEN LAS DOS COLUMNAS. La del este está en
// la máquina del anfitrión pero la manda el invitado: la señal tiene que
// largarla igual.
await anf.evaluate(() => window.juego.tocarClarin());
await latir(0.5);
const largada = await anf.evaluate(() => window.juego.pinza.este.estado);
ok('con el clarín, la columna del invitado también arranca', largada !== 'formada', largada);

// el invitado se lleva su caballo y los sesenta tienen que ir detrás
const dondeEstan = () => anf.evaluate(() => {
  const p = window.juego.pinza;
  const cab = p.este.remota ? p.este.remota() : null;
  if (!cab) return null;
  const ds = p.este.hombres.filter(h => h.vivo && h.montado)
    .map(h => Math.hypot(h.monta.pos.x - cab.x, h.monta.pos.z - cab.z));
  return { cab: [Math.round(cab.x), Math.round(cab.z)], n: ds.length,
    lejos: ds.length ? Math.max(...ds) : -1 };
});
// se lo mueve DENTRO del campo propio, detrás del convento: acá se mide si la
// columna lo sigue, no si sobrevive a que lo metan solo entre los realistas
await inv.evaluate(() => {
  const j = window.juego;
  if (j.jugador.monta) { j.jugador.monta.pos.set(6, 0, 40); j.jugador.monta.rumbo = Math.PI; }
});
await latir(0.4);
const antesDeSeguir = await dondeEstan();
await latir(4);
const siguen = await dondeEstan();
out.push(['—', 'la cabeza del este, vista por el anfitrión', JSON.stringify(siguen)]);
ok('el anfitrión sabe dónde está el invitado', !!siguen && Math.abs(siguen.cab[0] - 6) < 5,
  siguen ? `x=${siguen.cab[0]}` : 'perdió la cabeza de la columna');
// no se mide la distancia final —cuatro segundos no alcanzan para cruzar el
// campo— sino que los sesenta VAYAN PARA ALLÁ, que es lo que hay que probar
ok('y sus sesenta van detrás de él',
  !!siguen && !!antesDeSeguir && siguen.n > 0 && siguen.lejos < antesDeSeguir.lejos - 3,
  siguen && antesDeSeguir
    ? `${antesDeSeguir.lejos.toFixed(0)} m → ${siguen.lejos.toFixed(0)} m con ${siguen.n} montados`
    : 'se quedó sin cabeza');

// ---- el cable ----
const kbs = Math.max(ca.kbs, ci.kbs);
ok('el cable no se desborda', kbs < 400, `${kbs} KB/s con ${ca.soldados} hombres`);

// ---- y el compañero se ve ----
const verse = await Promise.all([anf, inv].map(p => p.evaluate(() => {
  const c = window.juego.red.companero;
  return c ? { hay: true, montado: c.montado, x: Math.round(c.pos.x), z: Math.round(c.pos.z) } : { hay: false };
})));
out.push(['—', 'el compañero, de los dos lados', JSON.stringify(verse)]);
ok('cada uno tiene el cuerpo del otro en el campo', verse[0].hay && verse[1].hay);
ok('y lo ve montado', verse[0].montado && verse[1].montado);

// UN SOLO CABALLO DEBAJO DEL COMPAÑERO. El cuerpo del otro viaja aparte, con
// su propia montura; si además se replicara el animal de verdad quedarían dos
// caballos superpuestos temblando uno sobre el otro. No lo agarra ninguna
// cuenta global: hay que ir a mirar el lugar exacto.
const encimados = await Promise.all([anf, inv].map(p => p.evaluate(() => {
  const j = window.juego, c = j.red.companero;
  if (!c) return -1;
  return j.caballos.filter(h => Math.hypot(h.pos.x - c.pos.x, h.pos.z - c.pos.z) < 1.6).length;
})));
ok('nadie ve dos caballos encimados debajo del compañero',
  encimados[0] === 0 && encimados[1] === 0, `anfitrión ${encimados[0]} · invitado ${encimados[1]}`);

// ---- 5. LA BATALLA ENTERA POR EL CABLE ----
//
// Lo de arriba se midió con cuarenta y cinco hombres para que la prueba no
// tarde una hora. Pero San Lorenzo son trescientos setenta, y el número que
// importa es cuánto cable comen ésos: si no entra en una red de casa, el modo
// no existe. Se arma la batalla de verdad y se mide.
await anf.evaluate(() => window.juego.red.formarBatalla(60, 250));
await latir(2.5);
const grande = await Promise.all([anf, inv].map(censo));
out.push(['—', 'la batalla entera, anfitrión', JSON.stringify(grande[0])]);
out.push(['—', 'la batalla entera, invitado ', JSON.stringify(grande[1])]);
ok('el invitado recibe los 370 sin perder a nadie', grande[1].soldados === grande[0].soldados,
  `${grande[1].soldados} contra ${grande[0].soldados}`);
ok('y sigue sin simular a ninguno', grande[1].titeres === grande[1].soldados);
// veinte partes por segundo de 370 hombres y 130 caballos: seis kilobytes cada
// uno. Ciento treinta por segundo es un megabit: cualquier wifi de casa mueve
// cincuenta veces eso.
ok('la batalla entera entra cómoda en una red de casa',
  Math.max(grande[0].kbs, grande[1].kbs) < 300,
  `${Math.max(grande[0].kbs, grande[1].kbs)} KB/s`);

// ---------------------------------------------------------------------------
// 5 · EL QUE CAE MIRA, NO ESPERA
// ---------------------------------------------------------------------------
//
// Va último a propósito: mata al invitado, así que no puede correr antes de las
// comprobaciones de arriba. En una partida de a dos el que muere no puede
// quedarse veinte minutos mirando el pasto ni obligar a los otros a esperarlo:
// vuela por encima del campo hasta que la batalla termina. Y vuela SIN QUE LO
// VEAN: lo que queda abajo es su cadáver, donde cayó, y ahí se queda —si se
// mandara la posición de la cámara, el otro vería un muerto paseándose por el
// cielo—.
const esp = await inv.evaluate(async () => {
  const j = window.juego, r = {};
  j.jugador.revivir();
  j.jugador.pos.set(9, 1.68, -12);
  j.jugador.recibir(999, null);
  r.espectador = j.jugador.espectador;
  r.murioEn = j.jugador.murioEn;
  r.arriba = j.jugador.pos.y;
  const t = new Set(['KeyW']);
  j.jugador.yaw = 0; j.jugador.pitch = 0;
  const z0 = j.jugador.pos.z;
  for (let i = 0; i < 60; i++) j.jugador.actualizar(1 / 60, t, false, false);
  r.volo = Math.abs(j.jugador.pos.z - z0);
  r.cuerpoQuieto = { x: j.jugador.murioEn.x, z: j.jugador.murioEn.z };
  r.camaraLejos = Math.hypot(j.jugador.pos.x - 9, j.jugador.pos.z + 12);
  return r;
});
ok('el invitado que cae pasa a mirar', esp.espectador);
ok('y despega del piso', esp.arriba >= 6, `y=${esp.arriba.toFixed(1)}`);
ok('vuela, y rápido', esp.volo > 20, `${esp.volo.toFixed(0)} m en un segundo`);
ok('pero su cuerpo se queda donde cayó', esp.camaraLejos > 20 &&
  Math.abs(esp.cuerpoQuieto.x - 9) < 0.01 && Math.abs(esp.cuerpoQuieto.z + 12) < 0.01,
  `cámara a ${esp.camaraLejos.toFixed(0)} m del cuerpo`);

// Y EL ANFITRIÓN LO VE MUERTO Y QUIETO, NO VOLANDO. Se espera a que el títere
// LLEGUE, no una cantidad de milisegundos: el parte sale veinte veces por
// segundo y el cuerpo se interpola hasta el sitio nuevo, así que un sleep fijo
// mide la suerte del momento y no lo que se quiere probar.
await anf.waitForFunction(() => {
  const c = window.juego.red.companero;
  return c && !c.vivo && Math.hypot(c.pos.x - 9, c.pos.z + 12) < 3;
}, null, { timeout: 15000 }).catch(() => {});
const visto = await anf.evaluate(() => {
  const c = window.juego.red.companero;
  return c ? { vivo: c.vivo, x: +c.pos.x.toFixed(1), z: +c.pos.z.toFixed(1) } : null;
});
ok('y del otro lado se lo ve caído y quieto en el sitio',
  visto && !visto.vivo && Math.abs(visto.x - 9) < 3 && Math.abs(visto.z + 12) < 3,
  JSON.stringify(visto));

for (const [e, n, x] of out) console.log(e.padEnd(4), n.padEnd(52), x);
const mal = out.filter(x => x[0] === 'MAL').length;
console.log(`\n${out.filter(x => x[0] === 'OK ').length} bien, ${mal} mal`);
console.log(errs.length ? 'ERRORES: ' + errs.join(' / ') : 'sin errores de consola');
await nav.close();
servidor.kill();
if (dicho.some(d => d.startsWith('ERR'))) console.log('el servidor dijo:\n' + dicho.join(''));
process.exit(mal ? 1 : 0);
