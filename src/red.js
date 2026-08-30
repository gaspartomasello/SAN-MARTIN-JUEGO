// ===========================================================================
// LA RED · los dos costados de la pinza, cada uno en su máquina
// ===========================================================================
//
// San Martín no cargó solo. Partió los ciento veinte granaderos en dos
// escuadrones: llevó uno él y el otro lo llevó el capitán Justo Bermúdez. Las
// dos columnas salieron a la vez por los dos costados del convento y se
// cerraron sobre el desembarco al mismo tiempo. Eso es la pinza, y es lo único
// que hizo ganar la batalla.
//
// Hasta ahora el jugador llevaba una columna y la otra la llevaba la máquina.
// Acá la lleva otra persona.
//
//   ANFITRIÓN — José de San Martín. Columna del OESTE. Toca el clarín.
//   INVITADO  — capitán Justo Bermúdez. Columna del ESTE.
//
// ---------------------------------------------------------------------------
// LA DECISIÓN DE FONDO: LA BATALLA LA PIENSA UNA SOLA MÁQUINA
// ---------------------------------------------------------------------------
//
// El anfitrión simula todo: los doscientos cincuenta realistas, los ciento
// veinte granaderos, los caballos, las dos piezas, quién le pega a quién. El
// invitado no simula nada de eso: recibe un parte veinte veces por segundo con
// dónde está cada uno y en qué postura, y lo dibuja.
//
// La alternativa —que las dos máquinas corran la misma batalla y sólo se pasen
// las teclas— es más barata en cable y suena más elegante, pero exige que las
// dos lleguen SIEMPRE al mismo resultado, cuadro por cuadro, durante quince
// minutos. Con cuatrocientos hombres tirando dados y trescientas llamadas a
// Math.random() por cuadro, la primera diferencia de una millonésima entre dos
// procesadores termina, un minuto después, en dos batallas distintas: en una
// máquina ganaste y en la otra estás muerto. No hay forma de arreglarlo
// después; sólo de no meterse.
//
// Con un solo simulador eso no puede pasar. Cuesta cable —seis kilobytes por
// parte, ciento veinte por segundo— y en una red local eso no es nada.
//
// LO QUE SÍ ES DE CADA UNO: SU PROPIO CUERPO. Cada jugador se mueve, apunta,
// carga y sablea en su máquina, sin esperar respuesta de nadie. Si el invitado
// tuviera que pedirle permiso al anfitrión para dar un paso, el juego se
// sentiría pegajoso aunque el retardo fuera de dos milésimas. Lo que manda por
// el cable es dónde quedó, no dónde quiere ir.
//
// Y LO QUE HACE UN JUGADOR SOBRE LA TROPA DEL OTRO va por el cable como
// pedido: «a éste le pegué tanto». Lo resuelve el anfitrión y vuelve en el
// parte siguiente. Ver «EL TÍTERE» en soldados.js: el hombre de la otra
// máquina se ve, se oye y se puede sablear igual, pero no se hiere solo.
//
// ---------------------------------------------------------------------------
// LOS DOS FORMATOS
// ---------------------------------------------------------------------------
// El parte del mundo va en binario (ver protocolo.js). Todo lo demás —quién
// nace, quién se fue, quién disparó, un aviso— va en JSON, que es poco y se
// lee con los ojos cuando algo anda mal.

import * as THREE from 'three';
import { Soldado } from './soldados.js';
import { Caballo } from './caballo.js';
import { Canon } from './canon.js';
import { PLAZA_ESTE } from './pinza.js';
// PeerJS entra como import de efecto: es un IIFE que deja window.Peer puesto.
// Va por acá y no por un <script> en el html porque el empaquetador arma un
// archivo único a partir del grafo de módulos, y un script suelto quedaría
// como una referencia rota al abrirlo con doble clic.
import '../vendor/peerjs.min.js';
import {
  empaquetarMundo, desempaquetarMundo, poseANumero, numeroAPose, pesoDelParte,
  B_VIVO, B_MONTADO, B_RODILLA, B_ANDANDO, B_LANCERO, B_CUBIERTO, B_QUEBRADO,
  C_VIVO, C_CEBANDO
} from './protocolo.js';

const PARTE = 1 / 20;      // veinte partes del mundo por segundo
const CUERPO = 1 / 30;     // treinta veces por segundo digo dónde está mi cuerpo
const SEGUIR = 15;         // qué tan rápido el títere alcanza el sitio del parte
const CERCA_TIRO = 90;     // más lejos que esto, el fogonazo del otro ni se dibuja

// diferencia de ángulos por el lado corto
function corto (a) { return Math.atan2(Math.sin(a), Math.cos(a)); }

export function armarRed (ctx) {
  const { escena, humo, fuego, sonido, hud, jugador,
    soldados, caballos, canones, pinza, campo, luzBoca, montado,
    poseDelJugador, intentarVoltear } = ctx;

  // ------------------------------------------------------------------ estado
  let cable = null;
  let peer = null;                   // el enganche con el directorio de salas
  let rol = null;                    // 'anfitrion' | 'invitado' | null
  let fase = 'suelto';               // suelto · llamando · esperando · listo · caido
  let hayCompanero = false;
  let motivo = '';                   // por qué se cayó, para poder decirlo
  let alCambiar = null;              // la portada se entera por acá

  const cola = [];                   // mensajes JSON esperando salida
  let tParte = 0, tCuerpo = 0, sello = 0;
  let ultimoSello = -1;
  let bytesMandados = 0, bytesRecibidos = 0, tMedir = 0, cableKBs = 0;

  // el censo de la red: qué cosa del campo es qué número
  let proximoId = 1;
  const porId = new Map();
  const vistos = new Set();

  // el cuerpo del compañero, del lado de acá
  let companero = null;              // Soldado títere
  let cabalgadura = null;            // su Caballo
  const cabezaRemota = { x: PLAZA_ESTE.x, z: PLAZA_ESTE.z, rumbo: PLAZA_ESTE.rumbo, andar: 0, vivo: true };

  const red = {};
  const _v = new THREE.Vector3();
  const _d = new THREE.Vector3();

  // ------------------------------------------------------------------- cable
  function mandar (obj) {
    if (!cable || cable.readyState !== 1) return;
    const txt = JSON.stringify(obj);
    bytesMandados += txt.length;
    cable.send(txt);
  }

  function avisarFase (f, por) {
    fase = f;
    motivo = por || '';
    if (alCambiar) alCambiar(red.parte());
  }

  // Se conecta al mismo servidor del que salió la página. Si el archivo se
  // abrió a mano —file://, sin servidor— no hay a dónde conectarse y hay que
  // decirlo así, porque es el error más fácil de cometer.
  // `silencioso` es para el tanteo de arranque: si la página la sirve una sala
  // local hay que engancharse sola, pero si no la sirve ninguna —un servidor
  // estático cualquiera— el fallo NO es un error del jugador. Dejarlo en
  // «caído» pinta un cartel rojo de «no contesta nadie» arriba de la pantalla
  // donde está el camino que sí funciona, y parece que el juego está roto.
  red.conectar = function (direccion, silencioso) {
    if (cable) return;
    let url = direccion;
    if (!url) {
      if (!location.host) {
        avisarFase('caido', 'Este archivo se abrió suelto, sin servidor. ' +
          'Para jugar de a dos hay que levantar la sala con «node herramientas/servidor.mjs» ' +
          'y entrar por la dirección que imprime.');
        return;
      }
      url = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host;
    }
    if (!silencioso) avisarFase('llamando');
    const fallo = (m) => avisarFase(silencioso ? 'suelto' : 'caido', silencioso ? '' : m);
    try { cable = new WebSocket(url); } catch (e) { fallo('No se pudo abrir el cable: ' + e.message); return; }
    cable.binaryType = 'arraybuffer';
    cable.onopen = () => { /* el servidor contesta con el rol */ };
    cable.onmessage = ev => {
      if (typeof ev.data === 'string') { bytesRecibidos += ev.data.length; recibirTexto(ev.data); }
      else { bytesRecibidos += ev.data.byteLength; recibirMundo(ev.data); }
    };
    cable.onerror = () => { if (fase === 'llamando' || silencioso) fallo('No contesta nadie en ' + url); };
    cable.onclose = () => {
      const habia = !!rol;
      cable = null;
      if (silencioso && !habia) { avisarFase('suelto'); return; }
      if (fase !== 'caido') avisarFase('caido', 'Se cortó el cable con la sala.');
    };
  };

  // =========================================================================
  // LA SALA POR CÓDIGO · dos clicks, sin instalar nada
  // =========================================================================
  //
  // El otro camino —levantar `herramientas/servidor.mjs` en una máquina— sigue
  // entero y es el que anda sin internet. Pero pide Node instalado y un doble
  // clic en un archivo que hay que tener bajado, y esto lo van a abrir chicos
  // en una escuela desde el link: si hay un paso más, no hay partida.
  //
  // Acá uno hace «Crear sala», le sale un código de cuatro letras y el otro lo
  // escribe. Los dos navegadores se enganchan DIRECTO entre sí por WebRTC: el
  // parte de la batalla —ciento trece kilobytes por segundo— no pasa por
  // ningún servidor ajeno. Lo único que se usa de afuera es el DIRECTORIO,
  // para decir «la sala ABCD soy yo»: unos kilobytes al principio y nada más.
  //
  // LO QUE NO SE PUEDE, y por eso hay código y no una lista de salas: una
  // página web no puede ver las otras máquinas de la red. No hay broadcast ni
  // escaneo, los navegadores lo prohíben a propósito. El código es lo más
  // cerca que se llega, y en la práctica es un renglón que se dicta en voz
  // alta.

  // Sin I, O, 0 ni 1: se dicta en voz alta y se escribe a mano.
  const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const PREFIJO = 'clarin-san-lorenzo-';
  const LARGO = 4;

  function codigoNuevo () {
    let c = '';
    for (let i = 0; i < LARGO; i++) c += ALFABETO[Math.floor(Math.random() * ALFABETO.length)];
    return c;
  }

  // Que entrar mal escrito no sea un fracaso: mayúsculas, sin espacios, y las
  // confusiones de dictar letras mandadas a la que sí existe en el alfabeto.
  red.limpiarCodigo = function (t) {
    return String(t || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
      .replace(/[0O]/g, 'Q').replace(/[1I]/g, 'J').slice(0, LARGO);
  };

  // El adaptador. De acá para arriba nadie sabe que esto no es un WebSocket:
  // mismo molde —readyState, send, close— y los mismos mensajes que mandaba el
  // servidor, sintetizados de este lado.
  function cableDePar (conn) {
    const c = {
      readyState: 0,
      send (d) { try { conn.send(d); } catch { /* se cortó */ } },
      close () { try { conn.close(); } catch { /* ya estaba */ } },
      onclose: null
    };
    conn.on('data', d => {
      if (typeof d === 'string') { bytesRecibidos += d.length; recibirTexto(d); return; }
      const buf = d instanceof ArrayBuffer ? d : (d && d.buffer) || null;
      if (!buf) return;
      bytesRecibidos += buf.byteLength;
      recibirMundo(buf);
    });
    const cortar = () => { if (c.readyState === 3) return; c.readyState = 3; if (c.onclose) c.onclose(); };
    conn.on('close', cortar);
    conn.on('error', cortar);
    return c;
  }

  // Los errores vienen en inglés y en jerga. Traducidos, y sobre todo: qué hacer.
  function errorClaro (e) {
    const t = (e && e.type) || '';
    if (t === 'peer-unavailable') return 'No hay ninguna sala con ese código. Fijate que esté bien escrito y que el otro la haya creado recién.';
    if (t === 'unavailable-id') return 'Ese código ya está tomado. Volvé y creá la sala de nuevo.';
    if (t === 'network' || t === 'server-error' || t === 'socket-error') {
      return 'No se pudo llegar al directorio de salas. Puede ser la red: probá con los datos del celular, o jugá por red local con «Jugar de a dos».';
    }
    if (t === 'browser-incompatible') return 'Este navegador no sirve para jugar de a dos. Probá con Chrome o Edge.';
    return 'Se cortó la conexión' + (t ? ' (' + t + ')' : '') + '.';
  }

  // UN INTENTO FALLIDO NO ES UNA PARTIDA, y confundirlos dejaba la pantalla
  // muerta al primer código mal escrito.
  //
  // `entrarASala` arma el cable ANTES de que la conexión se abra —`cableDePar`
  // envuelve la `conn` en el mismo molde que un WebSocket, y eso existe desde
  // el primer momento aunque del otro lado no haya nadie—. Así que un código
  // errado dejaba dos cosas puestas: el `peer` vivo y un cable en cero. El
  // guardián de la entrada —«si ya hay peer o cable, no hagas nada»— los leía
  // como una partida en curso y el intento siguiente, con el código BUENO,
  // salía por ahí sin llamar a nadie. La pantalla no mentía: de verdad no
  // estaba intentando nada. Quedaba sólo recargar la página.
  //
  // Lo que frena un intento nuevo es una partida de verdad y nada más. Todo lo
  // demás —restos de una llamada que no prosperó— se tira y se vuelve a probar
  // las veces que haga falta, que es lo que va a hacer cualquiera que se
  // equivoque al copiar cuatro letras dictadas en voz alta.
  function jugando () { return !!cable && cable.readyState === 1; }

  function desarmar () {
    if (cable) { const c = cable; cable = null; c.onclose = null; c.close(); }
    if (peer) { const p = peer; peer = null; try { p.destroy(); } catch { /* ya estaba */ } }
    red.codigo = null;
    rol = null;
    hayCompanero = false;
  }

  // Avisar el error SIN dejar la puerta trabada. Si ya se estaba jugando el
  // error es del cable y no se toca nada; si no, se limpia para el próximo.
  function fallar (m) {
    if (!jugando()) desarmar();
    avisarFase('caido', m);
  }

  function armarPeer (id) {
    if (!window.Peer) { avisarFase('caido', 'No cargó la parte de red del juego. Recargá la página.'); return null; }
    const p = new window.Peer(id, { debug: 0 });
    p.on('error', e => fallar(errorClaro(e)));
    return p;
  }

  // ---- crear la sala: sos San Martín y esperás ----
  red.crearSala = function () {
    if (jugando()) return;
    desarmar();
    red.codigo = codigoNuevo();
    avisarFase('llamando');
    peer = armarPeer(PREFIJO + red.codigo);
    if (!peer) return;
    peer.on('open', () => { rol = 'anfitrion'; hayCompanero = false; avisarFase('esperando'); });
    peer.on('connection', conn => {
      if (cable) { conn.close(); return; }      // por ahora, de a dos
      cable = cableDePar(conn);
      conn.on('open', () => {
        cable.readyState = 1;
        hayCompanero = true;
        armarCompanero();
        proximoId = 1; porId.clear(); ultimoSello = -1;
        avisarFase('listo');
        hud.mostrarAviso('Entró el otro escuadrón', 'bien');
      });
      cable.onclose = () => {
        cable = null; hayCompanero = false;
        soltarCompanero();
        cabezaRemota.vivo = false;
        avisarFase('esperando', 'Se fue el otro jugador.');
        hud.mostrarAviso('Se fue Bermúdez', 'malo');
      };
    });
  };

  // ---- entrar a una sala: sos Bermúdez ----
  red.entrarASala = function (codigo) {
    if (jugando()) return;
    desarmar();
    const c = red.limpiarCodigo(codigo);
    if (c.length !== LARGO) { avisarFase('caido', 'El código es de cuatro letras.'); return; }
    red.codigo = c;
    avisarFase('llamando');
    peer = armarPeer();
    if (!peer) return;
    peer.on('open', () => {
      const conn = peer.connect(PREFIJO + c, { reliable: true });
      cable = cableDePar(conn);
      conn.on('open', () => {
        cable.readyState = 1;
        rol = 'invitado'; hayCompanero = true;
        armarCompanero();
        avisarFase('listo');
      });
      // SE CORTÓ ANTES DE EMPEZAR O DESPUÉS: no es lo mismo y no se dice igual.
      // Sin abrir —`rol` todavía en null— fue un intento que no prosperó y hay
      // que dejar todo limpio para el próximo código. Abierto, se cayó la
      // máquina que llevaba la batalla y eso sí es el final de la partida.
      cable.onclose = () => {
        if (rol !== 'invitado') { fallar('No se pudo entrar a esa sala. Fijate el código y probá de nuevo.'); return; }
        cable = null; hayCompanero = false;
        avisarFase('caido', 'Se cortó con San Martín.');
        hud.decir('Se cayó la máquina que llevaba la batalla. Ya no viene ningún parte.', 8);
      };
    });
  };

  red.cortar = function () {
    desarmar();
    avisarFase('suelto');
  };

  red.alCambiar = f => { alCambiar = f; };
  red.parte = () => ({ fase, rol, motivo, companero: hayCompanero, kbs: cableKBs,
    nombre: rol === 'invitado' ? 'Capitán Justo Bermúdez' : 'José de San Martín',
    columna: rol === 'invitado' ? 'este' : 'oeste' });

  Object.defineProperty(red, 'activo', { get: () => rol !== null && fase !== 'caido' });
  Object.defineProperty(red, 'esAnfitrion', { get: () => rol === 'anfitrion' });
  Object.defineProperty(red, 'esInvitado', { get: () => rol === 'invitado' });
  Object.defineProperty(red, 'listo', { get: () => fase === 'listo' });

  // ------------------------------------------------------------- el compañero
  //
  // El cuerpo del otro jugador. Es un títere como cualquier otro, salvo en una
  // cosa: del lado del ANFITRIÓN además está metido en `soldados`, para que la
  // tropa realista lo vea, lo elija de blanco y le tire. Si no, el invitado
  // sería un fantasma al que nadie ataca, que es la peor manera de acompañar a
  // alguien a una batalla.
  function armarCompanero () {
    if (companero) return;
    const plaza = rol === 'anfitrion' ? PLAZA_ESTE : { x: -40, z: 54, rumbo: 0 };
    cabalgadura = new Caballo(escena, [], new THREE.Vector3(plaza.x, 0, plaza.z));
    cabalgadura.rumbo = plaza.rumbo;
    cabalgadura.titere = true;
    cabalgadura.humo = humo;
    cabalgadura._sinRed = true;
    companero = new Soldado(escena, humo, sonido, new THREE.Vector3(plaza.x, 0, plaza.z),
      'granadero', { colisiones: [], lancero: true });
    companero.titere = true;
    companero._sinRed = true;
    companero.monta = cabalgadura;
    cabalgadura.montado = true;
    cabalgadura.jinete = companero;
    companero.fig.montura = true;
    companero.fig.poner('lanzaAlto');
    companero._sentar();
    // VA EN `soldados`, DE LOS DOS LADOS, y no es un detalle: del lado del
    // anfitrión es lo que hace que los realistas lo VEAN —lo eligen de blanco
    // y le tiran como a cualquier granadero, en vez de ignorar a un fantasma—,
    // y de los dos lados es lo que le da lejanía, animación y su renglón en la
    // cuenta de vivos, sin una sola línea de código aparte.
    soldados.push(companero);

    // LO QUE LE PASE, SE LO CUENTO. Todo el daño que el juego le hace a este
    // hombre —una bala, un bayonetazo, la metralla— pasa por acá y sale por el
    // cable, porque su vida la lleva la otra máquina.
    const doler = (cual, extra) => carga => {
      mandar({ t: 'golpe', dano: carga.dano || 0, volteo: carga.volteo || 0,
        aturdir: carga.aturdir || 0, de: cual, ...extra });
      return false;         // acá nunca muere: eso lo decide el que lo juega
    };
    companero.alCastigo = doler('hombre');
    cabalgadura.alCastigo = doler('caballo');
  }

  function soltarCompanero () {
    if (!companero) return;
    const i = soldados.indexOf(companero);
    if (i >= 0) soldados.splice(i, 1);
    companero.quitar();
    companero = null;
    cabalgadura = null;
  }

  // De acá cuelga la columna del este cuando la lleva una persona: la Pinza no
  // sabe ni le importa que esté a treinta metros o a treinta kilómetros.
  red.cabezaCompanero = () => (cabezaRemota.vivo ? cabezaRemota : null);

  // ---------------------------------------------------------- mi propio cuerpo
  function mandarCuerpo () {
    const c = montado() ? jugador.monta : null;
    // EL CADÁVER SE QUEDA DONDE CAYÓ. Mientras mirás la batalla volando, lo que
    // se manda por el cable es el sitio donde te mataron y no dónde está la
    // cámara: si no, el otro vería tu cuerpo muerto paseándose por el cielo.
    const p = jugador.espectador && jugador.murioEn ? jugador.murioEn : jugador.pos;
    mandar({
      t: 'yo',
      x: +p.x.toFixed(2), z: +p.z.toFixed(2),
      yaw: +jugador.yaw.toFixed(3),
      vivo: jugador.vivo, vida: Math.round(jugador.vida),
      pose: poseDelJugador(),
      m: !!c,
      cx: c ? +c.pos.x.toFixed(2) : 0,
      cz: c ? +c.pos.z.toFixed(2) : 0,
      cr: c ? +c.rumbo.toFixed(3) : 0,
      cv: c ? +c.vel.toFixed(2) : 0,
      ca: c ? c.andar : 0,
      ch: c ? +c.alto.toFixed(2) : 0,
      cvivo: c ? c.vivo : false
    });
  }

  function recibirCuerpo (m) {
    if (!companero) armarCompanero();
    companero._destino = companero._destino || { x: m.x, y: 0, z: m.z, rumbo: m.yaw };
    const d = companero._destino;
    d.x = m.x; d.z = m.z; d.rumbo = m.yaw + Math.PI;   // el cuerpo mira al revés que la cámara
    companero.vivo = m.vivo;
    companero.vida = m.vida;
    companero.fig.poner(m.pose || 'lanzaAlto');
    if (!m.vivo) companero.caida = Math.min(1, companero.caida + 0.06);
    else companero.caida = 0;

    if (m.m && m.cvivo) {
      if (!companero.monta) {
        companero.monta = cabalgadura;
        cabalgadura.vivo = true;
        cabalgadura.caida = 0;
        cabalgadura.montado = true;
        companero.fig.montura = true;
      }
      cabalgadura._destino = cabalgadura._destino || { x: m.cx, z: m.cz, rumbo: m.cr };
      const e = cabalgadura._destino;
      e.x = m.cx; e.z = m.cz; e.rumbo = m.cr;
      cabalgadura.vel = m.cv;
      cabalgadura.andar = m.ca;
      cabalgadura.alto = m.ch;
      cabezaRemota.x = m.cx; cabezaRemota.z = m.cz;
      cabezaRemota.rumbo = m.cr; cabezaRemota.andar = m.ca;
      cabezaRemota.vivo = m.vivo;
    } else {
      if (companero.monta) { companero.monta = null; companero.fig.montura = false; cabalgadura.montado = false; }
      if (!m.cvivo) cabalgadura.vivo = false;
      // A PIE YA NO ARRASTRA A LA COLUMNA. Sesenta jinetes no siguen al paso a
      // un hombre desmontado; la Pinza sabe qué hacer cuando la cabeza
      // desaparece —la hereda un sargento— y es lo mismo que pasa en solo.
      cabezaRemota.vivo = false;
    }
  }

  // ---------------------------------------------------------------- ANFITRIÓN
  //
  // Bautizar: cada cosa del campo recibe un número, y el número viaja en vez
  // del objeto. El orden importa —primero los caballos— porque un lancero nace
  // con el suyo puesto y hay que poder nombrárselo.
  function bautizar (o, clase, extra) {
    o._red = proximoId++;
    if (proximoId > 65000) proximoId = 1;          // el número entra en dos bytes
    porId.set(o._red, o);
    cola.push({ t: 'nace', id: o._red, clase, ...extra });
  }

  // Sacar algo de la red sin que se haya muerto: deja de tener número y del
  // otro lado se levanta del campo.
  function despedir (o) {
    if (!o._red) return;
    porId.delete(o._red);
    cola.push({ t: 'quitar', ids: [o._red] });
    o._red = 0;
  }

  function censar () {
    for (const c of caballos) {
      // MI PROPIO CABALLO NO SE REPLICA, y esto es fácil de pasar por alto.
      // El cuerpo del jinete ya viaja aparte —treinta veces por segundo, en
      // las cartas de `yo`— y del otro lado tiene su propia montura. Si además
      // se replicara el animal, el compañero vería DOS caballos superpuestos
      // en el mismo lugar: el de la carta y el del parte, casi pero no
      // exactamente encima, temblando uno sobre el otro.
      //
      // Y se despide en vez de sólo saltearse, porque puede haber sido un
      // caballo cualquiera del campo hasta el momento en que me subí. Cuando
      // me baje vuelve a tener número solo, en el censo siguiente, y el otro
      // lo ve aparecer suelto donde lo dejé.
      if (c === jugador.monta) { despedir(c); c._sinRed = false; continue; }
      if (c._red || c._sinRed) continue;
      bautizar(c, 'caballo', { x: +c.pos.x.toFixed(2), z: +c.pos.z.toFixed(2), r: +c.rumbo.toFixed(3) });
    }
    for (const s of soldados) {
      if (s._red || s._sinRed) continue;
      bautizar(s, 'soldado', {
        b: s.bando, sem: +s.semilla.toFixed(6), lan: s.lancero,
        tez: s.tez || 0, cab: s.monta ? s.monta._red : 0,
        x: +s.pos.x.toFixed(2), z: +s.pos.z.toFixed(2)
      });
    }
    for (const p of canones) {
      if (p._red) continue;
      bautizar(p, 'canon', { x: +p.pos.x.toFixed(2), z: +p.pos.z.toFixed(2), r: +p.rumbo.toFixed(3) });
    }
    // el barrido: lo que ya no está en el campo, se avisa una vez
    vistos.clear();
    for (const c of caballos) if (c._red) vistos.add(c._red);
    for (const s of soldados) if (s._red) vistos.add(s._red);
    for (const p of canones) if (p._red) vistos.add(p._red);
    let idos = null;
    for (const id of porId.keys()) if (!vistos.has(id)) (idos = idos || []).push(id);
    if (idos) {
      for (const id of idos) porId.delete(id);
      cola.push({ t: 'quitar', ids: idos });
    }
  }

  const bufH = [], bufB = [], bufC = [];
  function mandarParte () {
    bufH.length = 0; bufB.length = 0; bufC.length = 0;
    for (const s of soldados) {
      if (!s._red) continue;
      bufH.push({
        id: s._red, x: s.pos.x, y: s.pos.y, z: s.pos.z, rumbo: s.malla.rotation.y,
        pose: poseANumero(s.fig.pose),
        banderas: (s.vivo ? B_VIVO : 0) | (s.montado ? B_MONTADO : 0) |
          (s.rodilla ? B_RODILLA : 0) | (s.andando ? B_ANDANDO : 0) |
          (s.lancero ? B_LANCERO : 0) | (s.cubierto ? B_CUBIERTO : 0) |
          (s.quebrado ? B_QUEBRADO : 0),
        vida: Math.max(0, s.vida), caida: s.caida
      });
    }
    for (const c of caballos) {
      if (!c._red) continue;
      bufB.push({
        id: c._red, x: c.pos.x, alto: c.alto, z: c.pos.z, rumbo: c.rumbo,
        banderas: (c.vivo ? B_VIVO : 0) | (c.montado ? B_MONTADO : 0),
        vel: c.vel, paso: c.paso, caida: c.caida
      });
    }
    for (const p of canones) {
      if (!p._red) continue;
      bufC.push({ id: p._red, rumbo: p.rumbo,
        banderas: (p.vivo ? C_VIVO : 0) | (p.cebando ? C_CEBANDO : 0), vida: Math.max(0, p.vida) });
    }
    sello = (sello + 1) & 0xffffffff;
    const buf = empaquetarMundo(sello, bufH, bufB, bufC);
    bytesMandados += buf.byteLength;
    cable.send(buf);
  }

  // ------------------------------------------------------------------ INVITADO
  function nacer (m) {
    let o = null;
    if (m.clase === 'caballo') {
      o = new Caballo(escena, [], new THREE.Vector3(m.x, 0, m.z));
      o.rumbo = m.r;
      o.humo = humo;
      o.titere = true;
      caballos.push(o);
    } else if (m.clase === 'soldado') {
      o = new Soldado(escena, humo, sonido, new THREE.Vector3(m.x, 0, m.z), m.b,
        { colisiones: [], semilla: m.sem, lancero: m.lan, tez: m.tez || undefined });
      o.titere = true;
      const c = m.cab ? porId.get(m.cab) : null;
      if (c) { o.monta = c; c.montado = true; c.jinete = o; o.fig.montura = true; o._sentar(); }
      soldados.push(o);
    } else if (m.clase === 'canon') {
      o = new Canon(escena, humo, sonido, new THREE.Vector3(m.x, 0, m.z), m.r);
      o.titere = true;
      canones.push(o);
    }
    if (!o) return;
    o._red = m.id;
    o._destino = { x: m.x, y: 0, z: m.z, rumbo: m.r || 0 };
    porId.set(m.id, o);
    // Todo golpe que este jugador le dé a este títere sale por el cable. La
    // respuesta —¿lo mató?— se adivina con la vida del último parte: alcanza
    // para el aviso del HUD y el parte siguiente pone la verdad.
    o.alCastigo = carga => {
      mandar({ t: 'daño', id: m.id, dano: carga.dano || 0,
        volteo: carga.volteo || 0, aturdir: carga.aturdir || 0 });
      return (carga.dano || 0) >= o.vida;
    };
  }

  function quitar (ids) {
    for (const id of ids) {
      const o = porId.get(id);
      if (!o) continue;
      porId.delete(id);
      // el caballo es una entidad aparte con su propio número: soltarlo antes
      // de levantar al hombre, o `Soldado.quitar` le borra la malla a un
      // animal que sigue vivo y en el campo
      if (o.monta) { o.monta.jinete = null; o.monta = null; }
      o.quitar();
      for (const lista of [soldados, caballos, canones]) {
        const i = lista.indexOf(o);
        if (i >= 0) { lista.splice(i, 1); break; }
      }
    }
  }

  function recibirMundo (buf) {
    const m = desempaquetarMundo(buf);
    if (!m) return;
    // Un parte viejo que llegó tarde no puede pisar a uno nuevo: sería mover a
    // todo el mundo un paso para atrás.
    if (ultimoSello >= 0 && m.sello <= ultimoSello && ultimoSello - m.sello < 1000) return;
    ultimoSello = m.sello;
    if (fase === 'esperando') avisarFase('listo');

    for (const h of m.hombres) {
      const s = porId.get(h.id);
      if (!s) continue;
      const d = s._destino;
      d.x = h.x; d.y = h.y; d.z = h.z; d.rumbo = h.rumbo;
      s.fig.poner(numeroAPose(h.pose));
      s.rodilla = !!(h.banderas & B_RODILLA);
      s.fig.rodilla = s.rodilla;
      s.andando = !!(h.banderas & B_ANDANDO);
      s.ritmo = s.andando ? 2.1 : 1;
      s.quebrado = !!(h.banderas & B_QUEBRADO);
      s.vida = h.vida;
      if (h.caida > s.caida) s.caida = h.caida;
      const vivo = !!(h.banderas & B_VIVO);
      if (!vivo && s.vivo) { s.vivo = false; s.estado = 'caido'; }
      const enSilla = !!(h.banderas & B_MONTADO);
      if (!enSilla && s.monta) {
        s.monta.montado = false;
        s.monta.jinete = null;
        s.monta = null;
        s.fig.montura = false;
      }
    }
    for (const b of m.bestias) {
      const c = porId.get(b.id);
      if (!c) continue;
      const d = c._destino;
      d.x = b.x; d.z = b.z; d.rumbo = b.rumbo;
      c.alto = b.alto;
      c.vel = b.vel;
      c.paso = b.paso;
      if (b.caida > c.caida) c.caida = b.caida;
      if (!(b.banderas & B_VIVO) && c.vivo) c.vivo = false;
    }
    for (const p of m.piezas) {
      const c = porId.get(p.id);
      if (!c) continue;
      c.rumbo = p.rumbo;
      c.malla.rotation.y = p.rumbo;
      c.vida = p.vida;
      c.vivo = !!(p.banderas & C_VIVO);
      c.estado = (p.banderas & C_CEBANDO) ? 'cebando' : 'buscando';
    }
  }

  // El seguimiento. Entre parte y parte —cincuenta milésimas— cada títere
  // camina hacia donde le dijeron en vez de aparecer ahí de un salto. No es
  // una interpolación con historial: es una persecución exponencial, tres
  // líneas, y a la velocidad a la que se mueve un hombre no se distingue.
  red.aplicar = function (dt) {
    if (rol !== 'invitado' || dt <= 0) return;
    const k = 1 - Math.exp(-SEGUIR * dt);
    for (const c of caballos) {
      if (!c.titere || !c._destino) continue;
      const d = c._destino;
      c.pos.x += (d.x - c.pos.x) * k;
      c.pos.z += (d.z - c.pos.z) * k;
      c.rumbo += corto(d.rumbo - c.rumbo) * k;
    }
    for (const s of soldados) {
      if (!s.titere || !s._destino || s.montado) continue;   // el montado va con su caballo
      const d = s._destino;
      s.pos.x += (d.x - s.pos.x) * k;
      s.pos.z += (d.z - s.pos.z) * k;
      if (s.vivo) s.pos.y += (d.y - s.pos.y) * k;
      s.malla.rotation.y += corto(d.rumbo - s.malla.rotation.y) * k;
    }
  };

  // El compañero está en `soldados`, así que el bucle principal ya lo anima
  // —es un títere—. Lo que falta es acercarlo a donde dijo su última carta y
  // mover su caballo, que a propósito no está en `caballos`: si estuviera, el
  // bucle le correría física de caballo suelto y pelearía contra el cable.
  red.seguirCompanero = function (dt) {
    if (!companero || dt <= 0) return;
    const k = 1 - Math.exp(-SEGUIR * dt);
    if (companero._destino && !companero.montado) {
      const d = companero._destino;
      companero.pos.x += (d.x - companero.pos.x) * k;
      companero.pos.z += (d.z - companero.pos.z) * k;
      companero.malla.rotation.y += corto(d.rumbo - companero.malla.rotation.y) * k;
    }
    if (cabalgadura) {
      if (cabalgadura._destino) {
        const d = cabalgadura._destino;
        cabalgadura.pos.x += (d.x - cabalgadura.pos.x) * k;
        cabalgadura.pos.z += (d.z - cabalgadura.pos.z) * k;
        cabalgadura.rumbo += corto(d.rumbo - cabalgadura.rumbo) * k;
      }
      cabalgadura.actualizarTitere(dt);
    }
  };

  // ------------------------------------------------------------ los mensajes
  function recibirTexto (txt) {
    let m;
    try { m = JSON.parse(txt); } catch { return; }
    switch (m.t) {
      case 'sala':
        rol = m.rol;
        hayCompanero = !!m.completa;
        avisarFase(hayCompanero ? 'listo' : 'esperando');
        break;
      case 'lleno':
        avisarFase('caido', 'La sala ya tiene dos. San Lorenzo se peleó entre dos columnas, no tres.');
        break;
      case 'par':
        hayCompanero = m.entra;
        if (m.entra) {
          armarCompanero();
          if (rol === 'anfitrion') { proximoId = 1; porId.clear(); ultimoSello = -1; }
          avisarFase('listo');
          hud.mostrarAviso('Entró el otro escuadrón', 'bien');
        } else {
          soltarCompanero();
          cabezaRemota.vivo = false;
          avisarFase('esperando', 'Se fue el otro jugador.');
          hud.mostrarAviso(rol === 'invitado' ? 'Se cortó con San Martín' : 'Se fue Bermúdez', 'malo');
          if (rol === 'invitado') hud.decir('Se cayó la máquina que llevaba la batalla. Ya no viene ningún parte.', 8);
        }
        break;

      // ---- del anfitrión al invitado ----
      case 'batalla':
        armarInvitado(m);
        break;
      case 'nace': nacer(m); break;
      case 'quitar': quitar(m.ids); break;
      case 'canon': {
        const c = porId.get(m.id);
        sonido.canon();
        if (c) {
          _v.set(c.pos.x - Math.sin(c.rumbo) * 1.6, 0.85, c.pos.z - Math.cos(c.rumbo) * 1.6);
          _d.set(-Math.sin(c.rumbo), 0.12, -Math.cos(c.rumbo));
          humo.soltar(_v, _d, { cantidad: 22, vida: 12, empuje: 5.5, radio: 0.55, opacidad: 0.5, claro: 0.5 });
        }
        break;
      }
      case 'golpe': recibirGolpe(m); break;
      case 'aviso': hud.mostrarAviso(m.texto, m.tipo); break;
      case 'frase': hud.decir(m.texto, m.seg || 4); break;
      case 'clarin': sonido.clarin(); break;

      // ---- del invitado al anfitrión ----
      case 'daño': {
        const o = porId.get(m.id);
        if (!o) break;
        if (m.aturdir && o.aturdir) o.aturdir(m.aturdir);
        if (m.dano) o.recibir(m.dano, null, m.volteo || 0);
        break;
      }

      // ---- en los dos sentidos ----
      case 'yo': recibirCuerpo(m); break;
      case 'tiro': verTiro(m); break;
    }
  }

  // EL FOGONAZO DEL OTRO LADO. Un disparo que el jugador no ve ni oye no
  // existe para él, y una batalla en la que sólo suenan los tiros propios se
  // siente vacía. Lo que viaja es el origen y la dirección; el humo, la luz y
  // el estampido los hace cada máquina con su propio sistema.
  function verTiro (m) {
    _v.set(m.o[0], m.o[1], m.o[2]);
    if (_v.distanceTo(jugador.pos) > CERCA_TIRO) return;
    _d.set(m.d[0], m.d[1], m.d[2]);
    sonido.disparo();
    humo.soltar(_v.clone().addScaledVector(_d, 0.9), _d,
      { cantidad: m.tropa ? 12 : 16, vida: 10, empuje: 2.0, radio: 0.28, opacidad: 0.4, claro: 0.45 });
    if (!m.tropa) {
      luzBoca.position.copy(_v);
      luzBoca.intensity = 30;
      fuego.disparo(_v, _d, 90);
    }
  }

  // LO QUE TE PASÓ A VOS, CONTADO POR EL QUE LLEVA LA BATALLA. El invitado no
  // resuelve su propio daño: el anfitrión decidió que esa bala le dio, y acá
  // se cobra. Es el único lugar del juego en el que la vida del jugador la
  // mueve otra máquina.
  function recibirGolpe (m) {
    if (m.de === 'caballo') {
      if (montado()) {
        jugador.monta.recibir(m.dano);
        jugador.sacudir(0.3);
        sonido.impactoCarne();
        hud.mostrarAviso('¡Le dieron al caballo!', 'malo');
      }
      return;
    }
    if (m.aturdir) { jugador.sacudir(0.3); return; }
    _d.set(m.dx || 0, 0, m.dz || 1);
    jugador.recibir(m.dano, _d);
    if (montado() && m.volteo) intentarVoltear(m.volteo, '¡Te sacaron de la silla!');
    else { sonido.golpeRecibido(); hud.mostrarAviso('¡Te dieron!', 'malo'); }
  }

  // ---------------------------------------------------------- armar la batalla
  //
  // El anfitrión arma el campo entero —es el que lo va a simular— y le avisa al
  // invitado con qué números, para que del otro lado el HUD cuente lo mismo.
  red.formarBatalla = function (porColumna, realistas) {
    // formarPinza barre el campo entero, y el compañero está en `soldados`:
    // si no se lo saca antes queda un títere apuntando a una malla borrada.
    soltarCompanero();
    const r = campo.formarPinza(porColumna, realistas);
    // LA COLUMNA DEL ESTE YA NO TIENE JEFE PROPIO: la lleva una persona.
    pinza.este.jefe = null;
    pinza.este.remota = red.cabezaCompanero;
    armarCompanero();
    cabezaRemota.x = PLAZA_ESTE.x;
    cabezaRemota.z = PLAZA_ESTE.z;
    cabezaRemota.rumbo = PLAZA_ESTE.rumbo;
    cabezaRemota.andar = 0;
    cabezaRemota.vivo = true;
    pinza.este.plantar();
    mandar({ t: 'batalla', porColumna, realistas });
    hud.decir('Bermúdez está del otro lado del convento con sus sesenta. ' +
      'El clarín lo tocás vos: cuando toque, salen las dos columnas a la vez.', 9);
    return r;
  };

  // Y el invitado NO arma nada: los ciento veinte granaderos y los doscientos
  // cincuenta realistas le van a llegar de a uno por el cable. Lo único suyo
  // es su caballo y su lugar en la plaza del este.
  function armarInvitado (m) {
    // SE BARREN LAS TRES LISTAS, no dos.
    //
    // Acá faltaban los cañones y el bicho era feo y silencioso: al limpiar
    // `porId` sin sacar las piezas del campo quedaban dos cañones huérfanos
    // —sin número, así que ningún «quitar» podía volver a encontrarlos— y el
    // armado siguiente les sumaba dos más encima. Cada vez que se rearmaba la
    // batalla el invitado juntaba dos piezas fantasma más, plantadas en la
    // playa, apuntando a nadie. Lo agarró pruebas/red.mjs contando: ocho
    // cañones donde el anfitrión tenía dos.
    soltarCompanero();
    for (const s of soldados) s.quitar();
    soldados.length = 0;
    if (jugador.monta) jugador.desmontar();
    for (const c of caballos) c.quitar();
    caballos.length = 0;
    for (const c of canones) c.quitar();
    canones.length = 0;
    porId.clear();
    ultimoSello = -1;

    const mio = campo.nuevoCaballo(new THREE.Vector3(PLAZA_ESTE.x, 0, PLAZA_ESTE.z), PLAZA_ESTE.rumbo);
    mio._sinRed = true;
    campo.caballo = mio;
    jugador.montar(mio);
    jugador.pos.set(PLAZA_ESTE.x, jugador.pos.y, PLAZA_ESTE.z);
    // mirando sobre el hombro a los sesenta que todavía no llegaron
    jugador.yaw = PLAZA_ESTE.rumbo + Math.PI;
    jugador.pitch = -0.04;
    campo.oleadas = false;
    armarCompanero();
    if (companero) {
      companero.pos.set(-40, 0, 54);
      if (cabalgadura) cabalgadura.pos.set(-40, 0, 54);
    }
    avisarFase('esperando');
    hud.mostrarAviso('Sos el capitán Justo Bermúdez · columna del este', 'bien');
    hud.decir('San Martín está del otro lado del convento. Él toca el clarín; ' +
      'cuando suene, salís vos con tus sesenta por este costado.', 9);
  }

  // ------------------------------------------------------------------- salidas
  //
  // Los tres enganches que main.js le pone al juego. En solo son los de
  // siempre; en red pasan además por el cable.

  // mi disparo, para que el otro vea el fogonazo
  red.avisarTiro = function (origen, dir) {
    if (!red.activo) return;
    mandar({ t: 'tiro', o: [+origen.x.toFixed(2), +origen.y.toFixed(2), +origen.z.toFixed(2)],
      d: [+dir.x.toFixed(3), +dir.y.toFixed(3), +dir.z.toFixed(3)] });
  };

  // el disparo de un soldado: sólo lo manda el que lleva la batalla
  red.avisarTiroTropa = function (origen, dir) {
    if (rol !== 'anfitrion' || !hayCompanero) return;
    mandar({ t: 'tiro', tropa: 1,
      o: [+origen.x.toFixed(2), +origen.y.toFixed(2), +origen.z.toFixed(2)],
      d: [+dir.x.toFixed(3), +dir.y.toFixed(3), +dir.z.toFixed(3)] });
  };

  red.avisarCanon = function (canon) {
    if (rol !== 'anfitrion' || !hayCompanero) return;
    mandar({ t: 'canon', id: canon._red || 0 });
  };

  // los avisos que valen para los dos: el clarín, la carga, la formación rota
  red.contar = function (texto, tipo, frase) {
    if (rol !== 'anfitrion' || !hayCompanero) return;
    if (texto) mandar({ t: 'aviso', texto, tipo });
    if (frase) mandar({ t: 'frase', texto: frase, seg: 6 });
  };
  red.contarClarin = function () {
    if (rol === 'anfitrion' && hayCompanero) mandar({ t: 'clarin' });
  };

  // ---------------------------------------------------------------- el latido
  //
  // Una vez por cuadro: mandar mi cuerpo treinta veces por segundo y, si llevo
  // la batalla, el parte del mundo veinte. Los dos ritmos son fijos y no
  // dependen de los cuadros que dé la máquina.
  red.latir = function (dt) {
    if (!cable || cable.readyState !== 1 || !rol) return;
    tCuerpo += dt;
    if (tCuerpo >= CUERPO) { tCuerpo = 0; if (hayCompanero) mandarCuerpo(); }
    if (rol === 'anfitrion' && hayCompanero) {
      tParte += dt;
      if (tParte >= PARTE) {
        tParte = 0;
        censar();
        while (cola.length) mandar(cola.shift());
        mandarParte();
      }
    }
    tMedir += dt;
    if (tMedir >= 1) {
      cableKBs = Math.round((bytesMandados + bytesRecibidos) / 1024 / tMedir);
      bytesMandados = 0; bytesRecibidos = 0; tMedir = 0;
    }
  };

  red.pesoDelParte = pesoDelParte;
  Object.defineProperty(red, 'companero', { get: () => companero });
  Object.defineProperty(red, 'hayCompanero', { get: () => hayCompanero });
  return red;
}
