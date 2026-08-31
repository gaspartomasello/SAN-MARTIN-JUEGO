// ===========================================================================
// LA RED · la pinza repartida entre varias máquinas
// ===========================================================================
//
// San Martín no cargó solo. Partió los ciento veinte granaderos en dos
// escuadrones: llevó uno él y el otro lo llevó el capitán Justo Bermúdez. Las
// dos columnas salieron a la vez por los dos costados del convento y se
// cerraron sobre el desembarco al mismo tiempo. Eso es la pinza, y es lo único
// que hizo ganar la batalla.
//
// Hasta ahora eso lo jugaban dos personas. Ahora los que entren después de las
// dos cabezas no mandan nada: son granaderos, eligen con cuál de las dos
// columnas cargan y ocupan el lugar de uno de los sesenta.
//
//   ANFITRIÓN — José de San Martín. Columna del OESTE. Toca el clarín.
//   SEGUNDO   — capitán Justo Bermúdez. Columna del ESTE.
//   DEL TERCERO EN ADELANTE — granaderos. Eligen columna. No mandan.
//
// UN GRANADERO OCUPA UN PUESTO, NO SE SUMA A LA CUENTA. Cuando entra, el
// anfitrión saca de esa columna al bot de más atrás y le deja el hueco. Si no,
// cada jugador nuevo agrandaría el escuadrón y a los seis jugadores estaríamos
// peleando San Lorenzo con ciento veintiséis granaderos, que no es San Lorenzo.
// Los bots son los puestos vacíos: se los llena, no se los acompaña.
//
// ---------------------------------------------------------------------------
// LA DECISIÓN DE FONDO: LA BATALLA LA PIENSA UNA SOLA MÁQUINA
// ---------------------------------------------------------------------------
//
// El anfitrión simula todo: los doscientos cincuenta realistas, los ciento
// veinte granaderos, los caballos, las dos piezas, quién le pega a quién. Los
// demás no simulan nada de eso: reciben un parte veinte veces por segundo con
// dónde está cada uno y en qué postura, y lo dibujan.
//
// La alternativa —que todas las máquinas corran la misma batalla y sólo se
// pasen las teclas— es más barata en cable y suena más elegante, pero exige
// que todas lleguen SIEMPRE al mismo resultado, cuadro por cuadro, durante
// quince minutos. Con cuatrocientos hombres tirando dados y trescientas
// llamadas a Math.random() por cuadro, la primera diferencia de una millonésima
// entre dos procesadores termina, un minuto después, en dos batallas distintas:
// en una máquina ganaste y en la otra estás muerto. No hay forma de arreglarlo
// después; sólo de no meterse.
//
// Con un solo simulador eso no puede pasar. Y como corolario, la forma de la
// red es una ESTRELLA y no una malla: cada invitado habla con el anfitrión y
// con nadie más. Lo que un invitado le hace a otro —un sablazo, un tiro— va al
// anfitrión y el anfitrión lo encamina. Un salto más de retardo a cambio de que
// haya un solo lugar donde la verdad se decide.
//
// EL TECHO SON DIEZ, Y EL QUE LO PONE ES LA SUBIDA DEL ANFITRIÓN. El parte del
// mundo entero pesa 113 KB/s medidos (pruebas/red.mjs) y sale UNA COPIA POR
// INVITADO: con nueve son casi un megabyte por segundo de subida. En una red
// local eso no es nada —un wifi de casa da veinte veces más— y por eso el aula
// entra cómoda. Por internet, en cambio, la subida de una conexión hogareña
// suele andar por el megabyte: ahí lo razonable son tres o cuatro. El número no
// se puede subir sin achicar el parte, y el parte no se achica sin sacar
// hombres del campo.
//
// LO QUE SÍ ES DE CADA UNO: SU PROPIO CUERPO. Cada jugador se mueve, apunta,
// carga y sablea en su máquina, sin esperar respuesta de nadie. Si un invitado
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
//
// Y DOS CAMPOS DE ENCAMINADO, que son los que hacen posible la estrella:
//
//   `de`    lo pone quien recibe de un invitado: de qué jugador vino. Por el
//           código lo sabe el anfitrión —tiene un enchufe por cabeza—; por el
//           servidor de sala lo estampa el servidor, que es el único que puede.
//   `para`  a qué jugador va. Sin él, difusión a todos. El que recibe algo que
//           no es para él lo tira, así que la difusión sirve igual de sobre.

import * as THREE from 'three';
import { Soldado } from './soldados.js';
import { Caballo } from './caballo.js';
import { Canon } from './canon.js';
import { PLAZA_ESTE, PLAZA_OESTE } from './pinza.js';
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
export const MAX_JUGADORES = 10;

// La formación de la columna, para saber dónde cae el puesto que se ocupa.
// Son los mismos números con los que despliegue.js planta a los sesenta.
const FRENTE_COL = 4, ANCHO_COL = 2.6, FONDO_COL = 3.4;

// diferencia de ángulos por el lado corto
function corto (a) { return Math.atan2(Math.sin(a), Math.cos(a)); }

// QUIÉN ES CADA UNO. Los dos primeros son los que están en los partes de la
// batalla; del tercero en adelante son la tropa, que en 1813 no dejó nombre.
export function nombreDeJugador (j) {
  if (j === 0) return 'José de San Martín';
  if (j === 1) return 'Capitán Justo Bermúdez';
  return 'Granadero ' + (j - 1) + 'º';
}

export function armarRed (ctx) {
  const { escena, humo, fuego, sonido, hud, jugador,
    soldados, caballos, canones, pinza, campo, luzBoca, montado,
    poseDelJugador, intentarVoltear } = ctx;

  // ------------------------------------------------------------------ estado
  let peer = null;                   // el enganche con el directorio de salas
  let rol = null;                    // 'anfitrion' | 'invitado' | null
  let fase = 'suelto';               // suelto · llamando · esperando · listo · caido
  let motivo = '';                   // por qué se cayó, para poder decirlo
  let alCambiar = null;              // la portada se entera por acá
  let yo = 0;                        // mi número de jugador; el anfitrión es el 0
  let quiero = 'oeste';              // con qué columna pedí cargar, antes de entrar

  // EL CABLE TIENE DOS FORMAS, y de ahí sale todo el encaminado.
  //
  //   · Por el CÓDIGO, el anfitrión tiene un enchufe por invitado: sabe quién
  //     le habla porque cada uno llega por su propio caño.
  //   · Por el SERVIDOR DE SALA, todos tienen un solo enchufe —al servidor— y
  //     es él el que reparte. Ahí el anfitrión no puede distinguir por el caño
  //     y hacen falta los campos `de` y `para`.
  //
  // Un invitado siempre tiene uno solo, venga por donde venga.
  let cable = null;                  // el enchufe único: al servidor, o al anfitrión
  const enchufes = new Map();        // ANFITRIÓN POR CÓDIGO: j → cable

  const cola = [];                   // mensajes JSON de difusión esperando salida
  let tParte = 0, tCuerpo = 0, sello = 0;
  let ultimoSello = -1;
  let bytesMandados = 0, bytesRecibidos = 0, tMedir = 0, cableKBs = 0;

  // el censo de la red: qué cosa del campo es qué número
  let proximoId = 1;
  const porId = new Map();
  const vistos = new Set();

  // EL CENSO DE LA GENTE. Quién está en la sala, con qué columna y en qué
  // puesto. Lo lleva el anfitrión y lo difunde entero cada vez que cambia: es
  // corto —diez renglones— y mandarlo entero evita toda una clase de bichos en
  // la que dos máquinas se creen distintas cosas sobre quién es quién.
  const gente = new Map();           // j → { j, nombre, columna, puesto }
  // Y el cuerpo de los OTROS, uno por cada uno, de este lado del cable.
  const pares = new Map();           // j → { j, soldado, caballo, cabeza }

  const red = {};
  const _v = new THREE.Vector3();
  const _d = new THREE.Vector3();

  // ------------------------------------------------------------------- cable
  function salidas () {
    if (enchufes.size) return [...enchufes.values()];
    return cable ? [cable] : [];
  }

  // A TODOS. El que recibe algo que no le toca lo descarta, así que difundir
  // es siempre correcto: la única diferencia con encaminar es el cable gastado.
  function mandar (obj) {
    const txt = JSON.stringify(obj);
    for (const c of salidas()) {
      if (c.readyState !== 1) continue;
      bytesMandados += txt.length;
      c.send(txt);
    }
  }

  // A UNO SOLO. Por el código hay un enchufe suyo; por el servidor de sala se
  // difunde con `para` puesto y el servidor —o el que recibe— lo descarta.
  function mandarA (j, obj) {
    obj.para = j;
    if (enchufes.size) {
      const c = enchufes.get(j);
      if (!c || c.readyState !== 1) return;
      const txt = JSON.stringify(obj);
      bytesMandados += txt.length;
      c.send(txt);
      return;
    }
    mandar(obj);
  }

  function mandarMundo (buf) {
    for (const c of salidas()) {
      if (c.readyState !== 1) continue;
      bytesMandados += buf.byteLength;
      c.send(buf);
    }
  }

  function hayGente () { return gente.size > 1; }

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
    if (jugando()) return;
    if (!silencioso) desarmar();
    else if (cable) return;
    let url = direccion;
    if (!url) {
      if (!location.host) {
        avisarFase('caido', 'Este archivo se abrió suelto, sin servidor. ' +
          'Para jugar entre varios hay que levantar la sala con «node herramientas/servidor.mjs» ' +
          'y entrar por la dirección que imprime.');
        return;
      }
      url = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host;
    }
    if (!silencioso) avisarFase('llamando');
    const fallo = (m) => {
      if (silencioso) { desarmar(); avisarFase('suelto'); return; }
      fallar(m);
    };
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
      if (fase !== 'caido') { vaciarSala('Se cortó el cable con la sala.'); avisarFase('caido', 'Se cortó el cable con la sala.'); }
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
  // Acá uno hace «Crear sala», le sale un código de cuatro letras y los demás
  // lo escriben. Los navegadores se enganchan DIRECTO con el del anfitrión por
  // WebRTC: el parte de la batalla no pasa por ningún servidor ajeno. Lo único
  // que se usa de afuera es el DIRECTORIO, para decir «la sala ABCD soy yo»:
  // unos kilobytes al principio y nada más.
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

  // Con cuál de las dos columnas quiere cargar el que entra. Lo elige antes de
  // escribir el código; el anfitrión tiene la última palabra —al segundo lo
  // hace Bermúdez le guste o no, porque esa columna necesita cabeza—.
  red.elegirColumna = function (c) { quiero = c === 'este' ? 'este' : 'oeste'; };
  Object.defineProperty(red, 'pedida', { get: () => quiero });

  // El adaptador. De acá para arriba nadie sabe que esto no es un WebSocket:
  // mismo molde —readyState, send, close— y los mismos mensajes que mandaba el
  // servidor, sintetizados de este lado.
  function cableDePar (conn, de) {
    const c = {
      readyState: 0,
      send (d) { try { conn.send(d); } catch { /* se cortó */ } },
      close () { try { conn.close(); } catch { /* ya estaba */ } },
      onclose: null
    };
    conn.on('data', d => {
      // POR EL CÓDIGO NO HACE FALTA CREERLE AL QUE MANDA: cada invitado llega
      // por su propio caño, así que de quién viene lo sabe el caño y no el
      // mensaje. `de` va como argumento y pisa lo que diga el JSON.
      if (typeof d === 'string') { bytesRecibidos += d.length; recibirTexto(d, de); return; }
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
  // envuelve la conexión en el mismo molde que un WebSocket, y eso existe desde
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
  function jugando () {
    if (cable && cable.readyState === 1) return true;
    for (const c of enchufes.values()) if (c.readyState === 1) return true;
    return false;
  }

  function desarmar () {
    for (const c of enchufes.values()) { c.onclose = null; c.close(); }
    enchufes.clear();
    if (cable) { const c = cable; cable = null; c.onclose = null; c.close(); }
    if (peer) { const p = peer; peer = null; try { p.destroy(); } catch { /* ya estaba */ } }
    red.codigo = null;
    rol = null;
    yo = 0;
    vaciarSala();
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
    peer.on('open', () => {
      rol = 'anfitrion';
      yo = 0;
      anotarGente(0, 'oeste');
      avisarFase('esperando');
    });
    peer.on('connection', conn => {
      const j = numeroLibre();
      if (!j) {
        // LA SALA LLENA SE DICE Y SE CIERRA, no se ignora: del otro lado
        // alguien está mirando una pantalla que no cambia.
        try { conn.on('open', () => { conn.send(JSON.stringify({ t: 'lleno' })); setTimeout(() => conn.close(), 80); }); } catch { /* ya se fue */ }
        return;
      }
      const c = cableDePar(conn, j);
      enchufes.set(j, c);
      conn.on('open', () => {
        c.readyState = 1;
        // LO PRIMERO ES DECIRLE QUIÉN ES. Por el servidor de sala el número se
        // lo da él en la carta de entrada; acá no hay servidor que hable, así
        // que lo dice el anfitrión y va antes que nada: hasta que no lo sepa,
        // el que entró no puede saber cuál de los renglones del padrón es él.
        mandarA(j, { t: 'sos', j });
        // El invitado dice con qué columna quiere cargar apenas se abre; si no
        // llega a decirlo, la columna se la da el anfitrión igual y listo.
        entraJugador(j);
      });
      c.onclose = () => {
        enchufes.delete(j);
        seVaJugador(j);
      };
    });
  };

  // ---- entrar a una sala: sos Bermúdez, o un granadero ----
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
        rol = 'invitado';
        mandar({ t: 'quiero', columna: quiero });
        avisarFase('esperando');
      });
      // SE CORTÓ ANTES DE EMPEZAR O DESPUÉS: no es lo mismo y no se dice igual.
      // Sin abrir —`rol` todavía en null— fue un intento que no prosperó y hay
      // que dejar todo limpio para el próximo código. Abierto, se cayó la
      // máquina que llevaba la batalla y eso sí es el final de la partida.
      cable.onclose = () => {
        if (rol !== 'invitado') { fallar('No se pudo entrar a esa sala. Fijate el código y probá de nuevo.'); return; }
        cable = null;
        vaciarSala();
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

  // ------------------------------------------------------------- la gente
  //
  // Quién está en la sala. Lo lleva el anfitrión —es el único que ve todos los
  // cables— y lo difunde entero cada vez que cambia.

  function numeroLibre () {
    for (let j = 1; j < MAX_JUGADORES; j++) if (!gente.has(j)) return j;
    return 0;
  }

  // A QUÉ COLUMNA VA CADA UNO, y por qué al segundo no se le pregunta.
  //
  // La columna del este necesita cabeza: si nadie la lleva, la lleva un
  // sargento de la máquina y el jugador no la manda. El segundo que entra es
  // quien la toma, y por eso es Bermúdez le haya pedido lo que le haya pedido.
  // Del tercero en adelante la elección es de verdad: son tropa, y la tropa
  // carga con quien quiera.
  function columnaPara (j, pedida) {
    if (j === 0) return 'oeste';
    if (j === 1) return 'este';
    return pedida === 'este' ? 'este' : 'oeste';
  }

  function anotarGente (j, columna, puesto) {
    gente.set(j, { j, columna, puesto: puesto || 0, nombre: nombreDeJugador(j) });
  }

  function difundirGente () {
    mandar({ t: 'gente', lista: [...gente.values()].map(g => ({ j: g.j, columna: g.columna, puesto: g.puesto })) });
  }

  // El anfitrión: entra alguien. Todavía sin puesto: falta que diga con qué
  // columna quiere cargar, y esa carta viene enseguida (`quiero`). Sacarle el
  // lugar a un bot antes de saberlo sería sacarle el lugar a dos.
  function entraJugador (j) {
    anotarGente(j, columnaPara(j, 'oeste'), 0);
    sincronizarPares();
    difundirGente();
    avisarFase('listo');
    hud.mostrarAviso('Entró ' + nombreDeJugador(j), 'bien');
  }

  // El anfitrión: se va alguien. El puesto queda vacío —no vuelve el bot—:
  // rearmar un granadero a mitad de batalla es hacer aparecer un hombre de la
  // nada en medio del campo, y eso se ve.
  function seVaJugador (j) {
    const g = gente.get(j);
    gente.delete(j);
    soltarPar(j);
    sincronizarPares();
    difundirGente();
    if (!hayGente()) avisarFase('esperando', 'Se quedaron sin compañía.');
    hud.mostrarAviso('Se fue ' + (g ? g.nombre : 'un jugador'), 'malo');
  }

  // El invitado: llegó el padrón.
  function recibirGente (lista) {
    gente.clear();
    for (const g of lista) anotarGente(g.j, g.columna, g.puesto);
    sincronizarPares();
    if (fase !== 'listo' && gente.size) avisarFase(hayGente() ? 'listo' : 'esperando');
    if (alCambiar) alCambiar(red.parte());
  }

  function vaciarSala (por) {
    for (const j of [...pares.keys()]) soltarPar(j);
    gente.clear();
    porId.clear();
    ultimoSello = -1;
    if (por && alCambiar) alCambiar(red.parte());
  }

  // EL PUESTO DE UN BOT. Se saca el de más atrás —el que menos se nota que
  // falta— y se devuelve el número de fila que ocupaba, que es donde va a
  // nacer el jugador que lo reemplaza.
  function liberarPuesto (nombreCol) {
    const c = pinza[nombreCol];
    if (!c || !c.hombres.length) return 0;
    for (let i = c.hombres.length - 1; i >= 0; i--) {
      const h = c.hombres[i];
      if (h === c.jefe || !h.vivo) continue;
      c.hombres.splice(i, 1);
      const k = soldados.indexOf(h);
      if (k >= 0) soldados.splice(k, 1);
      // El caballo es una entidad aparte: se lo suelta ANTES de levantar al
      // hombre, o `Soldado.quitar` le borra la malla a un animal que sigue en
      // el campo. Es el mismo cuidado que en `quitar`.
      const m = h.monta;
      h.monta = null;
      if (m) {
        m.jinete = null;
        m.montado = false;
        const q = caballos.indexOf(m);
        if (q >= 0) caballos.splice(q, 1);
        m.quitar();
      }
      h.plaza = null;
      h.quitar();
      return i;
    }
    return c.hombres.length;
  }

  // Dónde cae ese puesto en la plaza de salida: la misma cuenta con la que
  // despliegue.js planta a los sesenta detrás del convento.
  function sitioDePuesto (nombreCol, puesto) {
    const plaza = nombreCol === 'este' ? PLAZA_ESTE : PLAZA_OESTE;
    const lat = ((puesto % FRENTE_COL) - (FRENTE_COL - 1) / 2) * ANCHO_COL;
    const atras = Math.floor(puesto / FRENTE_COL) * FONDO_COL;
    return { x: plaza.x + lat, z: plaza.z + atras, rumbo: plaza.rumbo };
  }

  // --------------------------------------------------------------- los pares
  //
  // El cuerpo de cada uno de los OTROS jugadores. Son títeres como cualquier
  // otro, salvo en una cosa: del lado del ANFITRIÓN además están metidos en
  // `soldados`, para que la tropa realista los vea, los elija de blanco y les
  // tire. Si no, los invitados serían fantasmas a los que nadie ataca, que es
  // la peor manera de acompañar a alguien a una batalla.
  function armarPar (j) {
    if (pares.has(j) || j === yo) return pares.get(j) || null;
    const g = gente.get(j);
    if (!g) return null;
    const p0 = sitioDePuesto(g.columna, g.puesto);
    const caballo = new Caballo(escena, [], new THREE.Vector3(p0.x, 0, p0.z));
    caballo.rumbo = p0.rumbo;
    caballo.titere = true;
    caballo.humo = humo;
    caballo._sinRed = true;
    const soldado = new Soldado(escena, humo, sonido, new THREE.Vector3(p0.x, 0, p0.z),
      'granadero', { colisiones: [], lancero: true });
    soldado.titere = true;
    soldado._sinRed = true;
    soldado._par = j;
    soldado.monta = caballo;
    caballo.montado = true;
    caballo.jinete = soldado;
    soldado.fig.montura = true;
    soldado.fig.poner('lanzaAlto');
    soldado._sentar();
    // VA EN `soldados`, DE TODOS LADOS, y no es un detalle: del lado del
    // anfitrión es lo que hace que los realistas lo VEAN —lo eligen de blanco
    // y le tiran como a cualquier granadero, en vez de ignorar a un fantasma—,
    // y de todos lados es lo que le da lejanía, animación y su renglón en la
    // cuenta de vivos, sin una sola línea de código aparte.
    soldados.push(soldado);

    const par = { j, soldado, caballo,
      cabeza: { x: p0.x, z: p0.z, rumbo: p0.rumbo, andar: 0, vivo: true } };
    pares.set(j, par);

    // LO QUE LE PASE, SE LO CUENTO. Todo el daño que este juego le hace a este
    // hombre —una bala, un bayonetazo, la metralla, el sable del de al lado—
    // pasa por acá y sale por el cable, porque su vida la lleva su máquina.
    //
    // `mandarA` es lo que hace que ande entre invitados: del lado del anfitrión
    // sale por el enchufe de ese jugador, y del lado de un invitado sale al
    // anfitrión con `para` puesto y él lo encamina. La misma línea de código
    // sirve para los dos casos porque la estrella tiene un solo centro.
    const doler = (cual) => carga => {
      mandarA(j, { t: 'golpe', dano: carga.dano || 0, volteo: carga.volteo || 0,
        aturdir: carga.aturdir || 0, de: cual });
      return false;         // acá nunca muere: eso lo decide el que lo juega
    };
    soldado.alCastigo = doler('hombre');
    caballo.alCastigo = doler('caballo');
    return par;
  }

  function soltarPar (j) {
    const par = pares.get(j);
    if (!par) return;
    pares.delete(j);
    const i = soldados.indexOf(par.soldado);
    if (i >= 0) soldados.splice(i, 1);
    par.soldado.monta = null;
    par.caballo.jinete = null;
    par.caballo.quitar();
    par.soldado.quitar();
  }

  // El padrón manda: se arman los que faltan, se sueltan los que ya no están.
  function sincronizarPares () {
    for (const j of [...pares.keys()]) if (!gente.has(j) || j === yo) soltarPar(j);
    for (const g of gente.values()) if (g.j !== yo) armarPar(g.j);
    acomodarColumnas();
  }

  // Quién lleva cada columna: el jugador que esté en el puesto cero de ella.
  function jefeDeColumna (nombreCol) {
    for (const g of gente.values()) if (g.puesto === 0 && g.columna === nombreCol) return g;
    return null;
  }

  // DE QUÉ CUELGA CADA COLUMNA. Tres casos y sólo tres:
  //
  //   · la lleva el jugador de esta máquina  → sin jefe y sin remota: la Pinza
  //     ya sabe colgarse de `jugador`;
  //   · la lleva otro jugador                → la cabeza es su caballo, que
  //     llega por el cable treinta veces por segundo;
  //   · no la lleva nadie                    → un sargento, como en solitario.
  //
  // Corre en todas las máquinas, pero sólo hace algo donde hay columnas de
  // verdad: en las de los invitados `pinza.hombres` está vacía porque los
  // granaderos les llegan como títeres sueltos, no como formación.
  function acomodarColumnas () {
    if (!pinza.viva) return;
    for (const nombreCol of ['oeste', 'este']) {
      const c = pinza[nombreCol];
      const g = jefeDeColumna(nombreCol);
      if (g && g.j === yo) { c.jefe = null; c.remota = null; continue; }
      if (g) {
        c.jefe = null;
        c.remota = () => {
          const par = pares.get(g.j);
          return par && par.cabeza.vivo ? par.cabeza : null;
        };
        continue;
      }
      c.remota = null;
      if (!c.jefe) c.jefe = c.hombres.find(h => h.vivo && h.montado && !h.quebrado) || null;
    }
  }

  // ---------------------------------------------------------- mi propio cuerpo
  function mandarCuerpo () {
    const c = montado() ? jugador.monta : null;
    // EL CADÁVER SE QUEDA DONDE CAYÓ. Mientras mirás la batalla volando, lo que
    // se manda por el cable es el sitio donde te mataron y no dónde está la
    // cámara: si no, los otros verían tu cuerpo muerto paseándose por el cielo.
    const p = jugador.espectador && jugador.murioEn ? jugador.murioEn : jugador.pos;
    mandar({
      t: 'yo', j: yo,
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
    const j = m.j;
    if (j === undefined || j === yo) return;
    const par = pares.get(j) || armarPar(j);
    if (!par) return;
    const { soldado, caballo, cabeza } = par;
    par.destino = par.destino || { x: m.x, y: 0, z: m.z, rumbo: m.yaw };
    const d = par.destino;
    d.x = m.x; d.z = m.z; d.rumbo = m.yaw + Math.PI;   // el cuerpo mira al revés que la cámara
    soldado.vivo = m.vivo;
    soldado.vida = m.vida;
    soldado.fig.poner(m.pose || 'lanzaAlto');
    if (!m.vivo) soldado.caida = Math.min(1, soldado.caida + 0.06);
    else soldado.caida = 0;

    if (m.m && m.cvivo) {
      if (!soldado.monta) {
        soldado.monta = caballo;
        caballo.vivo = true;
        caballo.caida = 0;
        caballo.montado = true;
        soldado.fig.montura = true;
      }
      par.destinoCaballo = par.destinoCaballo || { x: m.cx, z: m.cz, rumbo: m.cr };
      const e = par.destinoCaballo;
      e.x = m.cx; e.z = m.cz; e.rumbo = m.cr;
      caballo.vel = m.cv;
      caballo.andar = m.ca;
      caballo.alto = m.ch;
      cabeza.x = m.cx; cabeza.z = m.cz;
      cabeza.rumbo = m.cr; cabeza.andar = m.ca;
      cabeza.vivo = m.vivo;
    } else {
      if (soldado.monta) { soldado.monta = null; soldado.fig.montura = false; caballo.montado = false; }
      if (!m.cvivo) caballo.vivo = false;
      // A PIE YA NO ARRASTRA A LA COLUMNA. Sesenta jinetes no siguen al paso a
      // un hombre desmontado; la Pinza sabe qué hacer cuando la cabeza
      // desaparece —la hereda un sargento— y es lo mismo que pasa en solo.
      cabeza.vivo = false;
    }
  }

  // ---------------------------------------------------------------- ANFITRIÓN
  //
  // Bautizar: cada cosa del campo recibe un número, y el número viaja en vez
  // del objeto. El orden importa —primero los caballos— porque un lancero nace
  // con el suyo puesto y hay que poder nombrárselo.
  //
  // LA CARTA SE GUARDA, y eso es lo que permite que alguien entre tarde. El
  // que llega con la batalla ya empezada no vio ninguno de los «nace» que se
  // difundieron antes, así que se le repiten todos de una: `presentar`. Sin
  // eso, el que entra a los dos minutos ve un campo vacío para siempre.
  function bautizar (o, clase, extra) {
    o._red = proximoId++;
    if (proximoId > 65000) proximoId = 1;          // el número entra en dos bytes
    porId.set(o._red, o);
    o._carta = { t: 'nace', id: o._red, clase, ...extra };
    cola.push(o._carta);
  }

  function presentar (j) {
    for (const o of porId.values()) if (o._carta) mandarA(j, { ...o._carta });
  }

  // Sacar algo de la red sin que se haya muerto: deja de tener número y del
  // otro lado se levanta del campo.
  function despedir (o) {
    if (!o._red) return;
    porId.delete(o._red);
    o._carta = null;
    cola.push({ t: 'quitar', ids: [o._red] });
    o._red = 0;
  }

  function censar () {
    for (const c of caballos) {
      // MI PROPIO CABALLO NO SE REPLICA, y esto es fácil de pasar por alto.
      // El cuerpo del jinete ya viaja aparte —treinta veces por segundo, en
      // las cartas de `yo`— y del otro lado tiene su propia montura. Si además
      // se replicara el animal, los otros verían DOS caballos superpuestos
      // en el mismo lugar: el de la carta y el del parte, casi pero no
      // exactamente encima, temblando uno sobre el otro.
      //
      // Y se despide en vez de sólo saltearse, porque puede haber sido un
      // caballo cualquiera del campo hasta el momento en que me subí. Cuando
      // me baje vuelve a tener número solo, en el censo siguiente, y los otros
      // lo ven aparecer suelto donde lo dejé.
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
    for (const [id, o] of porId) if (!vistos.has(id)) { (idos = idos || []).push(id); o._carta = null; }
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
    mandarMundo(empaquetarMundo(sello, bufH, bufB, bufC));
  }

  // ------------------------------------------------------------------ INVITADO
  function nacer (m) {
    // Un número repetido sería un hombre de más, invisible para todo «quitar»
    // posterior: pasa si a alguien le llega su padrón de entrada y además la
    // difusión del mismo nacimiento, que es exactamente la carrera que hay
    // cuando entra uno con la batalla empezada.
    if (porId.has(m.id)) return;
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
      // los cuerpos de los otros jugadores van por su propio camino: no vienen
      // en el parte del mundo sino en sus cartas de `yo`
      if (s._par || !s.titere || !s._destino || s.montado) continue;
      const d = s._destino;
      s.pos.x += (d.x - s.pos.x) * k;
      s.pos.z += (d.z - s.pos.z) * k;
      if (s.vivo) s.pos.y += (d.y - s.pos.y) * k;
      s.malla.rotation.y += corto(d.rumbo - s.malla.rotation.y) * k;
    }
  };

  // Los cuerpos de los otros jugadores están en `soldados`, así que el bucle
  // principal ya los anima —son títeres—. Lo que falta es acercarlos a donde
  // dijo su última carta y mover sus caballos, que a propósito no están en
  // `caballos`: si estuvieran, el bucle les correría física de caballo suelto
  // y pelearían contra el cable.
  red.seguirPares = function (dt) {
    if (!pares.size || dt <= 0) return;
    const k = 1 - Math.exp(-SEGUIR * dt);
    for (const par of pares.values()) {
      const { soldado, caballo } = par;
      if (par.destino && !soldado.montado) {
        const d = par.destino;
        soldado.pos.x += (d.x - soldado.pos.x) * k;
        soldado.pos.z += (d.z - soldado.pos.z) * k;
        soldado.malla.rotation.y += corto(d.rumbo - soldado.malla.rotation.y) * k;
      }
      if (par.destinoCaballo) {
        const d = par.destinoCaballo;
        caballo.pos.x += (d.x - caballo.pos.x) * k;
        caballo.pos.z += (d.z - caballo.pos.z) * k;
        caballo.rumbo += corto(d.rumbo - caballo.rumbo) * k;
      }
      caballo.actualizarTitere(dt);
    }
  };
  // el nombre viejo, de cuando el compañero era uno solo
  red.seguirCompanero = red.seguirPares;

  // ------------------------------------------------------------ los mensajes
  //
  // `deCable` es de quién vino, cuando el caño lo sabe: por el código el
  // anfitrión tiene un enchufe por invitado. Por el servidor de sala lo estampa
  // el servidor en el campo `de`, que es lo único que él sabe y nadie más.
  function recibirTexto (txt, deCable) {
    let m;
    try { m = JSON.parse(txt); } catch { return; }
    const de = deCable !== undefined ? deCable : m.de;

    // EL ENCAMINADO, EN DOS RENGLONES. Un invitado le habla a otro —un sablazo
    // entre jugadores— y el anfitrión, que es el centro de la estrella, lo pasa
    // sin abrirlo. Y lo que llega marcado para otro, se tira.
    if (m.para !== undefined && m.para !== yo) {
      if (rol === 'anfitrion') mandarA(m.para, m);
      return;
    }

    switch (m.t) {
      // ---- del servidor de sala ----
      case 'sala':
        rol = m.rol;
        yo = m.j || 0;
        if (rol === 'anfitrion') { anotarGente(0, 'oeste'); difundirGente(); avisarFase(hayGente() ? 'listo' : 'esperando'); }
        else { mandar({ t: 'quiero', columna: quiero }); avisarFase('esperando'); }
        break;
      case 'par':
        // sólo el anfitrión lleva el padrón: los demás lo reciben hecho
        if (rol !== 'anfitrion' || m.j === undefined) break;
        if (m.entra) entraJugador(m.j); else seVaJugador(m.j);
        break;
      case 'lleno':
        fallar('La sala está llena: ya son ' + MAX_JUGADORES + '.');
        break;

      // ---- el padrón de la sala ----
      case 'sos':
        yo = m.j;
        break;
      case 'gente':
        if (rol !== 'anfitrion') recibirGente(m.lista);
        break;
      case 'quiero':
        if (rol === 'anfitrion' && de !== undefined) elegirlo(de, m.columna);
        break;

      // ---- del anfitrión a los invitados ----
      case 'batalla':
        armarInvitado(m);
        break;
      case 'nace': nacer(m); break;
      case 'quitar': quitar(m.ids); break;
      case 'canon': {
        const c = porId.get(m.id);
        sonido.canon(c ? c.pos : null);
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

      // ---- de los invitados al anfitrión ----
      case 'daño': {
        const o = porId.get(m.id);
        if (!o) break;
        if (m.aturdir && o.aturdir) o.aturdir(m.aturdir);
        if (m.dano) o.recibir(m.dano, null, m.volteo || 0);
        break;
      }
      // «¡A MÍ!» DE LA OTRA MÁQUINA. El que lleva una columna puede reunirla
      // aunque la columna viva acá: la orden viaja y la ejecuta el que simula.
      // Sin esto la Q era de San Martín y de nadie más, porque del lado del
      // invitado `pinza.viva` es false —los sesenta le llegan como títeres
      // sueltos, no como formación— y la orden se perdía sin decir nada.
      case 'reunir': {
        if (rol !== 'anfitrion' || de === undefined) break;
        const g = gente.get(de);
        if (!g || g.puesto !== 0) break;
        if (pinza.reunir(g.columna)) mandarA(de, { t: 'aviso', texto: '¡A mí, granaderos!', tipo: 'bien' });
        else mandarA(de, { t: 'aviso', tipo: 'malo',
          texto: pinza.viva && pinza.tocado ? 'Ya vienen' : 'No hay columna que llamar' });
        break;
      }

      // ---- en los dos sentidos ----
      case 'yo':
        recibirCuerpo(de !== undefined ? { ...m, j: de } : m);
        // el anfitrión es el centro: el cuerpo de uno lo tienen que ver todos
        if (rol === 'anfitrion' && de !== undefined && hayGente()) mandar({ ...m, j: de, de: undefined });
        break;
      case 'tiro':
        verTiro(m);
        if (rol === 'anfitrion' && de !== undefined) mandar({ ...m, j: de, de: undefined });
        break;
    }
  }

  // Con qué columna quiere cargar el que entró. A las dos cabezas no se les
  // pregunta —la columna del este necesita jefe— y a la tropa sí.
  function elegirlo (j, columna) {
    const g = gente.get(j);
    if (!g) return;
    const nueva = columnaPara(j, columna === 'este' ? 'este' : 'oeste');
    if (nueva === g.columna && (!pinza.viva || g.colocado)) { if (pinza.viva) colocarYMandar(j); return; }
    g.columna = nueva;
    colocarYMandar(j);
  }

  function colocarYMandar (j) {
    const g = gente.get(j);
    if (!g) return;
    if (pinza.viva) {
      if (g.j >= 2) g.puesto = liberarPuesto(g.columna);
      g.colocado = true;
    }
    sincronizarPares();
    difundirGente();
    if (pinza.viva) { mandarBatalla(j); presentar(j); }
  }

  // EL FOGONAZO DEL OTRO LADO. Un disparo que el jugador no ve ni oye no
  // existe para él, y una batalla en la que sólo suenan los tiros propios se
  // siente vacía. Lo que viaja es el origen y la dirección; el humo, la luz y
  // el estampido los hace cada máquina con su propio sistema.
  function verTiro (m) {
    if (m.j === yo) return;                       // el eco del propio, que ya se dibujó acá
    _v.set(m.o[0], m.o[1], m.o[2]);
    if (_v.distanceTo(jugador.pos) > CERCA_TIRO) return;
    _d.set(m.d[0], m.d[1], m.d[2]);
    sonido.disparo(_v);
    humo.soltar(_v.clone().addScaledVector(_d, 0.9), _d,
      { cantidad: m.tropa ? 12 : 16, vida: 10, empuje: 2.0, radio: 0.28, opacidad: 0.4, claro: 0.45 });
    if (!m.tropa) {
      luzBoca.position.copy(_v);
      luzBoca.intensity = 30;
      fuego.disparo(_v, _d, 90);
    }
  }

  // LO QUE TE PASÓ A VOS, CONTADO POR EL QUE TE LO HIZO. Un invitado no
  // resuelve su propio daño: la otra máquina decidió que esa bala le dio, y acá
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
  // El anfitrión arma el campo entero —es el que lo va a simular— y le avisa a
  // cada invitado con qué números y en qué puesto entra, para que del otro lado
  // el HUD cuente lo mismo y el cuerpo nazca donde tiene que nacer.
  let formacion = { porColumna: 60, realistas: 250 };

  function mandarBatalla (j) {
    const g = gente.get(j);
    if (!g) return;
    mandarA(j, { t: 'batalla',
      porColumna: formacion.porColumna, realistas: formacion.realistas,
      j, columna: g.columna, puesto: g.puesto, manda: g.puesto === 0,
      plaza: sitioDePuesto(g.columna, g.puesto) });
  }

  red.formarBatalla = function (porColumna = 60, realistas = 250) {
    // formarPinza barre el campo entero, y los cuerpos de los otros jugadores
    // están en `soldados`: si no se los saca antes quedan títeres apuntando a
    // una malla borrada.
    for (const j of [...pares.keys()]) soltarPar(j);
    const r = campo.formarPinza(porColumna, realistas);
    formacion = { porColumna, realistas };

    // Y ACÁ SE VACÍAN LOS PUESTOS. Cada jugador que no sea el de esta máquina
    // ocupa el de un bot: las dos cabezas el de adelante —que ya no tiene
    // jefe— y la tropa el de más atrás de su columna. En orden de llegada,
    // para que dos granaderos de la misma columna no se peleen por la misma
    // fila.
    for (const g of [...gente.values()].sort((a, b) => a.j - b.j)) {
      if (g.j === yo) continue;
      g.puesto = g.j <= 1 ? 0 : liberarPuesto(g.columna);
      g.colocado = true;
    }
    // arma los títeres de todos y cuelga cada columna de quien la lleva
    sincronizarPares();
    difundirGente();
    for (const c of pinza.columnas) c.plantar();
    for (const g of gente.values()) if (g.j !== yo) mandarBatalla(g.j);

    const conBermudez = gente.has(1);
    const tropa = [...gente.values()].filter(g => g.j >= 2).length;
    if (conBermudez) {
      hud.decir('Bermúdez está del otro lado del convento con sus sesenta. ' +
        'El clarín lo tocás vos: cuando toque, salen las dos columnas a la vez.' +
        (tropa ? ' Y con ustedes cargan ' + tropa + ' granaderos de carne y hueso.' : ''), 9);
    } else if (tropa) {
      hud.decir('Con vos cargan ' + tropa + ' granaderos de carne y hueso. ' +
        'La columna del este la lleva un sargento. El clarín lo tocás vos.', 9);
    }
    return r;
  };

  // Y EL INVITADO NO ARMA NADA: los ciento veinte granaderos y los doscientos
  // cincuenta realistas le van a llegar de a uno por el cable. Lo único suyo es
  // su caballo y el puesto que le tocó en la columna que eligió.
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
    for (const j of [...pares.keys()]) soltarPar(j);
    for (const s of soldados) s.quitar();
    soldados.length = 0;
    if (jugador.monta) jugador.desmontar();
    for (const c of caballos) c.quitar();
    caballos.length = 0;
    for (const c of canones) c.quitar();
    canones.length = 0;
    porId.clear();
    ultimoSello = -1;

    if (m.j !== undefined) yo = m.j;
    const plaza = m.plaza || PLAZA_ESTE;
    const mio = campo.nuevoCaballo(new THREE.Vector3(plaza.x, 0, plaza.z), plaza.rumbo);
    mio._sinRed = true;
    campo.caballo = mio;
    jugador.montar(mio);
    jugador.pos.set(plaza.x, jugador.pos.y, plaza.z);
    // mirando sobre el hombro a los que todavía no llegaron
    jugador.yaw = plaza.rumbo + Math.PI;
    jugador.pitch = -0.04;
    campo.oleadas = false;
    sincronizarPares();
    avisarFase('esperando');

    if (m.manda) {
      hud.mostrarAviso('Sos el capitán Justo Bermúdez · columna del este', 'bien');
      hud.decir('San Martín está del otro lado del convento. Él toca el clarín; ' +
        'cuando suene, salís vos con tus sesenta por este costado.', 9);
    } else {
      const donde = m.columna === 'este' ? 'del este, la del capitán Bermúdez' : 'del oeste, la de San Martín';
      hud.mostrarAviso('Sos granadero · columna ' + (m.columna === 'este' ? 'del este' : 'del oeste'), 'bien');
      hud.decir('Estás en la fila de la columna ' + donde + '. No mandás vos: ' +
        'cuando suene el clarín, salís con ellos y no te separes.', 9);
    }
  }

  // ------------------------------------------------------------------- salidas
  //
  // Los enganches que main.js le pone al juego. En solo son los de siempre; en
  // red pasan además por el cable.

  // mi disparo, para que los otros vean el fogonazo
  red.avisarTiro = function (origen, dir) {
    if (!red.activo) return;
    mandar({ t: 'tiro', j: yo,
      o: [+origen.x.toFixed(2), +origen.y.toFixed(2), +origen.z.toFixed(2)],
      d: [+dir.x.toFixed(3), +dir.y.toFixed(3), +dir.z.toFixed(3)] });
  };

  // el disparo de un soldado: sólo lo manda el que lleva la batalla
  red.avisarTiroTropa = function (origen, dir) {
    if (rol !== 'anfitrion' || !hayGente()) return;
    mandar({ t: 'tiro', tropa: 1, j: yo,
      o: [+origen.x.toFixed(2), +origen.y.toFixed(2), +origen.z.toFixed(2)],
      d: [+dir.x.toFixed(3), +dir.y.toFixed(3), +dir.z.toFixed(3)] });
  };

  red.avisarCanon = function (canon) {
    if (rol !== 'anfitrion' || !hayGente()) return;
    mandar({ t: 'canon', id: canon._red || 0 });
  };

  // los avisos que valen para todos: el clarín, la carga, la formación rota
  red.contar = function (texto, tipo, frase) {
    if (rol !== 'anfitrion' || !hayGente()) return;
    if (texto) mandar({ t: 'aviso', texto, tipo });
    if (frase) mandar({ t: 'frase', texto: frase, seg: 6 });
  };
  red.contarClarin = function () {
    if (rol === 'anfitrion' && hayGente()) mandar({ t: 'clarin' });
  };

  // «¡A MÍ!» — LA Q. La manda quien lleva una columna, esté donde esté su
  // máquina. Devuelve 'tropa' si el que la apretó es un granadero: no manda
  // nada y hay que decírselo, que es distinto de que no haya a quién llamar.
  red.reunir = function () {
    const mio = gente.get(yo);
    if (mio && mio.puesto !== 0) return 'tropa';
    const col = mio ? mio.columna : 'oeste';
    // Del lado de un invitado la orden viaja y la contesta el que simula: no
    // se dice «¡a mí!» acá para desdecirse cincuenta milésimas después.
    if (rol === 'invitado') { mandar({ t: 'reunir' }); return 'mandado'; }
    return pinza.reunir(col);
  };

  // ---------------------------------------------------------------- el latido
  //
  // Una vez por cuadro: mandar mi cuerpo treinta veces por segundo y, si llevo
  // la batalla, el parte del mundo veinte. Los dos ritmos son fijos y no
  // dependen de los cuadros que dé la máquina.
  red.latir = function (dt) {
    if (!rol || !salidas().length) return;
    tCuerpo += dt;
    if (tCuerpo >= CUERPO) { tCuerpo = 0; if (hayGente()) mandarCuerpo(); }
    if (rol === 'anfitrion' && hayGente()) {
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

  // ------------------------------------------------------------------- afuera
  red.parte = () => {
    const mio = gente.get(yo);
    return {
      fase, rol, motivo, kbs: cableKBs,
      companero: hayGente(),
      j: yo,
      // ¿ya sé quién soy? Entre que se abre el cable y que llega el padrón hay
      // un momento en que no, y ahí no se puede anunciar ningún nombre.
      ubicado: gente.has(yo),
      nombre: nombreDeJugador(yo),
      columna: mio ? mio.columna : (yo === 1 ? 'este' : (rol === 'invitado' ? quiero : 'oeste')),
      manda: !mio || mio.puesto === 0,
      cuantos: gente.size,
      tope: MAX_JUGADORES,
      jugadores: [...gente.values()].sort((a, b) => a.j - b.j)
        .map(g => ({ j: g.j, nombre: g.nombre, columna: g.columna, manda: g.puesto === 0, vos: g.j === yo }))
    };
  };

  Object.defineProperty(red, 'activo', { get: () => rol !== null && fase !== 'caido' });
  Object.defineProperty(red, 'esAnfitrion', { get: () => rol === 'anfitrion' });
  Object.defineProperty(red, 'esInvitado', { get: () => rol === 'invitado' });
  Object.defineProperty(red, 'listo', { get: () => fase === 'listo' });
  Object.defineProperty(red, 'yo', { get: () => yo });
  Object.defineProperty(red, 'columna', { get: () => { const g = gente.get(yo); return g ? g.columna : (rol === 'invitado' ? quiero : 'oeste'); } });
  Object.defineProperty(red, 'mandaColumna', { get: () => { const g = gente.get(yo); return !g || g.puesto === 0; } });
  Object.defineProperty(red, 'cuantos', { get: () => gente.size });
  Object.defineProperty(red, 'pares', { get: () => [...pares.values()] });
  // los nombres viejos, de cuando el compañero era uno solo
  Object.defineProperty(red, 'companero', { get: () => { const p = pares.values().next().value; return p ? p.soldado : null; } });
  Object.defineProperty(red, 'hayCompanero', { get: () => pares.size > 0 });
  red.cabezaCompanero = () => { const p = pares.get(1); return p && p.cabeza.vivo ? p.cabeza : null; };

  red.pesoDelParte = pesoDelParte;
  return red;
}
