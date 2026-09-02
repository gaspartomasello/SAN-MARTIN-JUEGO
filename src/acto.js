import * as THREE from 'three';
import { Soldado } from './soldados.js';
import { PIEL_CABRAL } from './figura.js';
import { PORTON } from './sanlorenzo.js';

// EL ACTO CABRAL.
//
// 3 de febrero de 1813. La metralla voltea el caballo de San Martín, que cae
// con la pierna aprisionada debajo. Un soldado español se le viene encima con
// la bayoneta. Y entonces llega el sargento JUAN BAUTISTA CABRAL —correntino,
// afrodescendiente, hijo de esclavos— que lo cubre, mata al que iba a matarlo,
// levanta el caballo para sacarle la pierna, y recibe él las heridas de las
// que muere.
//
// -------------------------------------------------------------------------
// ACÁ SE CAMBIA DE CUERPO, y eso invierte la decisión que tenía este archivo.
//
// La versión anterior dejaba al jugador tirado bajo el caballo mirando, con un
// forcejeo capado que NUNCA llegaba, y el argumento era bueno: «lo salvó otro,
// y la única forma de que eso se sienta es estar indefenso y tener que mirar».
//
// Lo que se hace ahora es lo contrario y por el mismo motivo. En vez de mirar
// a Cabral, SOS Cabral: aparecés once metros atrás, tenés que encontrar a un
// hombre tirado entre ciento veinte vestidos igual —por eso el bicornio—,
// llegar, y sacarlo de abajo del animal a fuerza de espacio. Y cuando lo
// lograste, ahí sí se te acaba la agencia: viene el segundo español y no hay
// tecla. La cámara se cae, mira al cielo y dice la frase.
//
// O sea que la indefensión no se saca, se corre de lugar: no está en el
// rescate —que ahora te toca a vos y cuesta— sino en lo que le pasa a Cabral
// después, que es lo que de verdad no se puede evitar. Se sale del acto
// habiendo hecho algo y habiendo perdido igual.
//
// EN RED NO PASA NADA DE ESTO. main.js lo arranca sólo si no sos invitado: al
// segundo jugador le matan el caballo y se cae, como a todo el mundo.
// -------------------------------------------------------------------------

const FRASE = 'Muero contento, hemos batido al enemigo.';

// LA CAÍDA, que sigue siendo de San Martín y en primera persona. Son dos
// segundos y medio tirado sin poder hacer nada: sin eso el cambio de cuerpo no
// se entiende, porque no llegaste a registrar que te pasó algo.
const T_CAIDA = 2.5;
const T_FUNDIDO = 1.0;      // lo que tarda el negro en cerrarse
// A partir de acá el reloj lo llevan tus piernas y no el guion. Lo único con
// tiempo propio es el español, que sale a 5,6 m y marcha a 1,85 m/s: tenés
// unos ocho segundos para llegar antes que él, y si no llegás no pasa nada
// irreparable —no puede rematarlo— pero lo vas a ver parado encima.
const T_AMENAZA = 1.2;      // desde que sos Cabral, el español encara

// EL CAÑONAZO LLEGA IGUAL, Y LLEGA AL MINUTO DEL CLARÍN.
//
// Antes el acto dependía de que te mataran el caballo, o sea de cómo te
// estuviera yendo: si jugabas bien no pasaba nunca y te perdías lo único que
// de verdad ocurrió ese día. Pero en San Lorenzo la metralla volteó el caballo
// de San Martín y eso no fue una consecuencia de la pelea, fue lo que pasó.
// Así que pasa: al minuto del toque, haya doscientos hombres en pie o veinte.
//
// Sólo en la batalla. En el campo de práctica no —ahí no hay 3 de febrero que
// respetar— y en red tampoco, que ya estaba resuelto en main.js.
const T_FORZADO = 60;

// EL LEVANTE. Media tonelada no se levanta de un toque: son unos catorce
// espacios seguidos, y si parás se te vuelve a caer más rápido de lo que sube.
// La proporción entre SUBE y CAE es lo que hace que se sienta pesado sin ser
// injusto; si CAE fuera mayor que SUBE, no habría manera.
//
// SE PROBÓ SUBIRLO —0,062 y 0,19— y quedó peor. Con esos números el levante
// pasa de «machacar rápido» a «machacar mucho rato», que no es lo mismo: lo
// que tiene que costar es la INTENSIDAD y no la duración, porque son unos
// segundos en los que hay un español encima. Volvió a los de antes.
const LEVANTE_SUBE = 0.085;   // por cada golpe de espacio
const LEVANTE_CAE = 0.16;     // por segundo sin apretar
const LEVANTE_CERCA = 2.6;    // hay que estar al lado para empujar

// LA CINEMÁTICA, en cámara lenta y ya sin teclas. Los tiempos son de reloj
// lento, así que en pantalla duran el doble.
const LENTO = 0.42;
const C_HERIDO = 0.6;       // el segundo español le entra con la bayoneta
const C_CAE = 1.4;          // la cámara se va al suelo
const C_FRASE = 2.6;
// Se cierran los ojos, no se corta a negro, y por eso empieza antes: el
// párpado tarda 6,6 s de reloj lento y tiene que terminar justo en C_FIN.
const C_NEGRO = 4.6;
const C_OJOS = 6.6;         // lo que dura el cierre, en el mismo reloj lento
const C_FIN = 7.4;          // y volvés a ser San Martín

// LA FLECHA CELESTE que dice «acá». La usan los dos actos: el de Cabral para
// marcar dónde quedó San Martín entre ciento veinte hombres vestidos igual, y
// el de la victoria para marcar el portón del convento.
function baliza (escena, x, z) {

  // CELESTE, y las dos marcas del mismo color. Es el de la escarapela, así
  // que no queda como un cartel de videojuego pegado encima de 1813, y
  // contra el pasto seco y el crema del caballo es lo que más salta.
  const mat = new THREE.MeshBasicMaterial({ color: 0x74c7ec, transparent: true,
    opacity: 0.7, depthTest: false, depthWrite: false });
  const g = new THREE.Group();
  // ARRANCA POR ENCIMA DEL CUERPO. Desde el suelo la vara le pasa por el
  // medio al hombre y al animal —no consulta la profundidad— y de cerca eso
  // es una raya atravesando justo lo que uno vino a mirar.
  const haz = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3.4, 6), mat);
  haz.position.y = 3.1;
  const punta = new THREE.Mesh(new THREE.ConeGeometry(0.30, 0.55, 4), mat);
  punta.position.y = 1.25;
  punta.rotation.x = Math.PI;          // la punta mirando al hombre
  g.add(haz, punta);
  g.position.set(x, 0, z);
  g.renderOrder = 999;
  escena.add(g);
  g.userData.mat = mat;
  g.userData.punta = punta;
  return g;
}

export class ActoCabral {
  constructor (ctx) {
    this.ctx = ctx;             // { escena, humo, sonido, jugador, soldados, hud, canones, parapetos }
    this.corriendo = false;
    this.t = 0;
    this.cabral = null;
    this.verdugo = null;
    this.segundo = null;
    this.caballo = null;
    this.sanmartin = null;
    this.sitio = null;
    this.hecho = false;
    this.forcejeo = 0;        // lo que se lee en el HUD: la caída o el levante
    this.levante = 0;         // cuánto subió el caballo, de 0 a 1
    this.lento = 1;           // el multiplicador de tiempo que lee main.js
    this.fase = null;
    this.enBatalla = false;   // lo pone mando.js al entrar por el botón de la batalla
    this.tClarin = 0;
    this.vidaSanMartin = 100;
    this._paso = 0;
    this._space = false;
    this._tc = 0;             // reloj de la cinemática, aparte
    this.baliza = null;       // la vara de luz sobre San Martín
    this.contorno = null;     // el borde del caballo que hay que levantar
    this._brillo = null;      // los dos materiales, para latirlos juntos
  }

  get activo () { return this.corriendo; }

  // EL CORAZÓN DE CABRAL. Mientras sos él el pulso va alto aunque la vida esté
  // entera: no estás herido, estás corriendo a sacar a un hombre de abajo de
  // medio caballo con un español encima. Es el único momento del juego en que
  // el corazón no mide la vida sino lo que está pasando.
  get pulsoAlto () { return this.fase === 'cabral'; }

  // Lo que dice la barra. Antes de llegar, dónde está; al lado, qué apretar.
  // Es lo único que hace falta para no tener que revisar el campo hombre por
  // hombre: la vara de luz dice cuál es y esto dice cuánto falta.
  get rotulo () {
    if (this.fase !== 'cabral') return null;
    if (this.puedeEmpujar) return 'ESPACIO, MUCHAS VECES';
    const sm = this.sanmartin;
    if (!sm) return null;
    const { jugador } = this.ctx;
    const d = Math.hypot(sm.pos.x - jugador.pos.x, sm.pos.z - jugador.pos.z);
    return 'SAN MARTÍN · ' + Math.max(1, Math.round(d)) + ' M';
  }
  // ¿lo tenés al lado como para empujar el animal?
  get puedeEmpujar () {
    if (this.fase !== 'cabral' || !this.sanmartin) return false;
    const { jugador } = this.ctx;
    return Math.hypot(this.sanmartin.pos.x - jugador.pos.x,
      this.sanmartin.pos.z - jugador.pos.z) < LEVANTE_CERCA;
  }

  // ¿Se dan las condiciones? Una sola vez por partida, y sólo si te voltearon
  // el caballo estando montado —que es como pasó—.
  puedeArrancar (caballo) {
    return !this.hecho && !this.corriendo && !!caballo && this.ctx.jugador.vivo;
  }

  // El reloj de la batalla. Si al minuto vas A PIE no pasa todavía: sin caballo
  // encima no hay pierna aprisionada y el acto no tendría de qué hablar. Queda
  // esperando y salta apenas volvés a montar.
  contar (dt, tocado, caballo) {
    if (!this.enBatalla || this.hecho || this.corriendo || !tocado) return;
    this.tClarin += dt;
    if (this.tClarin < T_FORZADO) return;
    if (!caballo || !caballo.vivo) return;
    caballo.recibir(caballo.vida);      // la metralla
    this.arrancar(caballo);
  }

  arrancar (caballo) {
    const { jugador, hud, sonido } = this.ctx;
    this.corriendo = true;
    this.hecho = true;
    this.t = 0;
    this.forcejeo = 0;
    this.caballo = caballo;
    this.fase = 'caida';
    this._apagarMarcas();       // por si quedó algo de un acto anterior
    this.levante = 0;
    this.lento = 1;
    this._paso = 0;
    this._tc = 0;
    this._space = false;
    this.vidaSanMartin = Math.max(30, jugador.vida);
    caballo.montado = false;

    // el caballo cae de costado y encima de la pierna
    const rumbo = caballo.rumbo;
    jugador.atrapar(
      caballo.pos.x - Math.sin(rumbo) * 0.5,
      caballo.pos.z - Math.cos(rumbo) * 0.5,
      rumbo + 0.55);
    jugador.sacudir(1.0);
    sonido.golpeRecibido();
    hud.mostrarAviso('¡El caballo!', 'malo');
    return true;
  }

  // El forcejeo de San Martín, los dos primeros segundos. Sube mientras
  // apretás y se vuelve a caer sola, y NUNCA llega: no te vas a sacar de
  // encima medio caballo tirando de la pierna. Es la parte que no se toca.
  forcejear (dt, apretando) {
    if (apretando) this.forcejeo = Math.min(0.82, this.forcejeo + dt * 0.55);
    else this.forcejeo = Math.max(0, this.forcejeo - dt * 0.9);
    return this.forcejeo;
  }

  // EL LEVANTE, que es lo otro. Acá sí llega, porque acá hay dos hombres y uno
  // está de pie. Sube DE GOLPE con cada espacio y baja sola: no alcanza con
  // tener la tecla apretada, hay que machacarla.
  _empujar (dt, apretando) {
    const golpe = apretando && !this._space;
    this._space = apretando;
    if (!this.puedeEmpujar) {
      this.levante = Math.max(0, this.levante - LEVANTE_CAE * dt);
      return;
    }
    if (golpe) this.levante = Math.min(1, this.levante + LEVANTE_SUBE);
    else this.levante = Math.max(0, this.levante - LEVANTE_CAE * dt);
  }

  // EL CAMBIO DE CUERPO. Se hace con la pantalla en negro porque pasar de
  // estar tirado a estar de pie once metros atrás no se puede cortar en seco.
  _serCabral () {
    const { jugador, hud, sonido } = this.ctx;
    const jx = jugador.pos.x, jz = jugador.pos.z;

    // San Martín queda en el suelo, ahora como un soldado más del campo —pero
    // con el bicornio, que es lo único que lo hace encontrable.
    // Y ACÁ QUEDA CLAVADO. Una vez que lo sacás de abajo del caballo se para,
    // y si lo dejaras suelto sería un granadero más: sale caminando al enemigo
    // en plena cinemática y cuando volvés a ser él estás a ocho metros del
    // caballo, mirando cualquier cosa. El sitio donde caíste es el sitio donde
    // volvés.
    //
    // TIRADO, Y CONTRA EL BARRIL DEL ANIMAL. Estaba de pie, y era lo que más
    // rompía la escena: el cuerpo nacía donde vos habías caído y ni `tirado`
    // ni `aturdido` acuestan a nadie —lo único que tumba a un soldado es estar
    // muerto—, así que el general esperaba PARADO abajo de un caballo volcado.
    // Ahora se lo pone del lado para el que se desplomó el animal, acostado a
    // lo largo, y `tendido` le fija la pose hasta que lo saques.
    const c = this.caballo;
    const rum = c ? c.rumbo : 0;
    const lado = c ? c.lado : 1;
    const ax = c ? c.pos.x : jx, az = c ? c.pos.z : jz;
    this.sitio = { x: ax + Math.cos(rum) * 0.55 * lado, z: az - Math.sin(rum) * 0.55 * lado };
    this.sanmartin = this._traer('granadero', this.sitio.x, this.sitio.z, { sombrero: 'bicornio' });
    this.sanmartin.esSanMartin = true;
    this.sanmartin.vida = 99;
    this.sanmartin.tirado = 999;        // no se levanta hasta que lo saques
    this.sanmartin.aturdido = 999;
    this.sanmartin.tendido = true;      // y no se PARA hasta que lo saques
    this.sanmartin.malla.rotation.y = rum;
    this.sanmartin.alGolpear = null;

    // LO QUE HAY QUE MIRAR, MARCADO. Ciento veinte hombres vestidos igual en
    // un campo con humo: sin esto el acto es un juego de buscar a Wally con
    // ocho segundos de reloj. La vara dice CUÁL de todos, el borde del caballo
    // dice QUÉ hay que levantar, y la barra dice cuánto falta para llegar.
    this.baliza = this._baliza(this.sitio.x, this.sitio.z);
    if (c) this.contorno = this._contornear(c);

    // y vos pasás a ser el sargento, once metros y medio por detrás
    jugador.liberar();
    jugador.pos.set(jx - 2.4, jugador.pos.y, jz + 11.5);
    jugador.vida = 100;
    jugador.mirarA(jx, jz, 0.4);
    this.fase = 'cabral';
    this.t = 0;
    sonido.grito();
    hud.fundir(0, 1.1);
    hud.decir('Sos el sargento Juan Bautista Cabral. Llegá hasta él.', 5.4);
  }

  // Y LA VUELTA. Se muere Cabral, no vos: el juego sigue con San Martín.
  _serSanMartin () {
    const { jugador, hud, soldados, sonido } = this.ctx;
    this._apagarMarcas();
    const s = this.sanmartin;
    if (s) {
      const p = this.sitio || s.pos;
      jugador.pos.set(p.x, jugador.pos.y, p.z);
      s.quitar();
      const i = soldados.indexOf(s);
      if (i >= 0) soldados.splice(i, 1);
      this.sanmartin = null;
    }
    jugador.liberar();
    jugador.vida = this.vidaSanMartin;
    jugador.pitch = 0;
    this.lento = 1;
    this.corriendo = false;
    this.fase = null;
    // los ojos que se cerraron eran los de Cabral; los que se abren son los
    // tuyos, y el sonido vuelve con ellos
    hud.abrirLosOjos();
    sonido.revivir();
    hud.decir('Juan Bautista Cabral · sargento de Granaderos · hijo de esclavos', 6);
  }

  // LA VARA DE LUZ. No consulta la profundidad —`depthTest: false`— así que se
  // ve por encima del humo, de los cuerpos y de los otros ciento diecinueve
  // granaderos. Es lo único del juego que se dibuja atravesando el mundo, y se
  // justifica porque acá el problema no es ver: es ENCONTRAR.
  _baliza (x, z) { return baliza(this.ctx.escena, x, z); }

  // EL BORDE DEL CABALLO. Una copia de las mismas mallas un poco más grande y
  // dibujada por dentro (`BackSide`): el original la tapa entera salvo en la
  // silueta, y lo que queda es un contorno. Sí consulta la profundidad, porque
  // un contorno que atraviesa las cosas deja de ser un contorno.
  //
  // Va COLGADA DE `raiz`, que es el hueso que el acto inclina para levantar el
  // animal: así el borde sube con el caballo sin una línea de código más.
  _contornear (caballo) {
    if (!caballo.mallas || !caballo.mallas.length) return null;
    // El mismo celeste, y GRUESO: con un cinco por ciento de margen y color
    // ámbar el borde no se veía sobre un caballo crema, que es justo el que
    // hay que levantar. Un contorno que no se distingue del animal no marca
    // nada.
    const mat = new THREE.MeshBasicMaterial({ color: 0x74c7ec, side: THREE.BackSide,
      transparent: true, opacity: 0.95, depthWrite: false });
    const capa = new THREE.Group();
    caballo.raiz.updateWorldMatrix(true, true);
    const inv = new THREE.Matrix4().copy(caballo.raiz.matrixWorld).invert();
    for (const m of caballo.mallas) {
      m.updateWorldMatrix(true, false);
      const copia = new THREE.Mesh(m.geometry, mat);
      copia.matrix.multiplyMatrices(inv, m.matrixWorld);
      copia.matrix.decompose(copia.position, copia.quaternion, copia.scale);
      copia.scale.multiplyScalar(1.11);
      capa.add(copia);
    }
    caballo.raiz.add(capa);
    capa.userData.mat = mat;
    return capa;
  }

  // Se apagan cuando ya no hacen falta: levantado el caballo no hay nada que
  // buscar ni nada que empujar, y dejarlos encendidos en la cinemática le
  // pondría un cartel de videojuego a la única parte que no lo es.
  _apagarMarcas () {
    for (const o of [this.baliza, this.contorno]) {
      if (!o) continue;
      if (o.parent) o.parent.remove(o);
      const mat = o.userData && o.userData.mat;
      if (mat) mat.dispose();
    }
    this.baliza = null;
    this.contorno = null;
  }

  _traer (bando, x, z, op) {
    const { escena, humo, sonido, soldados, parapetos } = this.ctx;
    const s = new Soldado(escena, humo, sonido, new THREE.Vector3(x, 0, z), bando,
      Object.assign({ cubiertas: parapetos }, op || {}));
    soldados.push(s);
    return s;
  }

  actualizar (dt, teclas) {
    if (!this.corriendo) return;
    const { jugador, hud, sonido } = this.ctx;
    this.t += dt;
    const espacio = teclas.has('Space');

    // ---- LA CAÍDA. Seguís siendo San Martín y no podés hacer nada. ----
    if (this.fase === 'caida') {
      this.forcejear(dt, espacio);
      if (this.t >= T_CAIDA - T_FUNDIDO && this._paso < 1) {
        this._paso = 1;
        hud.fundir(1, T_FUNDIDO);
      }
      if (this.t >= T_CAIDA) { this.forcejeo = 0; this.fase = 'negro'; this.t = 0; }
      return;
    }
    if (this.fase === 'negro') {
      if (this.t >= 0.35) this._serCabral();
      return;
    }

    // ---- SOS CABRAL. Acá el reloj lo llevan tus piernas. ----
    if (this.fase === 'cabral') {
      // A Cabral no lo matan antes de tiempo: la historia dice que llegó.
      jugador.vida = Math.max(jugador.vida, 60);
      this._empujar(dt, espacio);
      this.forcejeo = this.levante;     // el HUD dibuja la misma barra

      const sm = this.sanmartin;
      const jx = sm ? sm.pos.x : jugador.pos.x, jz = sm ? sm.pos.z : jugador.pos.z;

      // el español que lo vio en el suelo. No puede rematarlo —la historia dice
      // que no llegó— pero se le planta encima si no llegás vos primero.
      if (this.t >= T_AMENAZA && this._paso < 2) {
        this._paso = 2;
        this.verdugo = this._traer('realista', jx + 1.9, jz - 5.6);
        this.verdugo.alGolpear = null;
        hud.mostrarAviso('¡Se le viene encima!', 'malo');
      }

      // el aviso de la tecla aparece cuando estás al lado, no antes
      if (this.puedeEmpujar && this._paso < 3) {
        this._paso = 3;
        hud.decir('ESPACIO, muchas veces', 3.4);
      }

      // el latido de las marcas: no llaman la atención quietas
      const pulso = 0.5 + 0.5 * Math.sin(this.t * 4.2);
      if (this.baliza) {
        this.baliza.userData.mat.opacity = 0.48 + 0.32 * pulso;
        this.baliza.userData.punta.position.y = 1.25 + pulso * 0.28;
      }
      if (this.contorno) this.contorno.userData.mat.opacity = 0.55 + 0.35 * pulso;

      if (this.caballo) {
        this.caballo.actualizado = true;      // que el bucle no le pise la pose
        this.caballo.raiz.rotation.z = 1.5 * this.caballo.lado * (1 - this.levante * 0.42);
        this.caballo.raiz.position.y = this.levante * 0.30;
      }
      if (this.levante > 0.05 && this.puedeEmpujar) jugador.sacudir(0.05);

      // ---- LEVANTADO: sale la pierna y arranca la cinemática ----
      if (this.levante >= 1) {
        if (this.caballo) {
          this.caballo.poseFija = true;
          this.caballo.raiz.rotation.z = 1.5 * this.caballo.lado * 0.58;
          this.caballo.raiz.position.y = 0.30;
        }
        this._apagarMarcas();
        // ya está afuera: se lo suelta de la pose fija y se para
        if (sm) { sm.tendido = false; sm.tirado = 1.2; sm.aturdido = 1.2; sm.fig.poner('marcha'); }
        if (this.verdugo && this.verdugo.vivo) { this.verdugo.recibir(99); sonido.impactoCarne(); }
        hud.mostrarAviso('¡Libre!', 'bien');
        this.fase = 'cine';
        this._tc = 0;
        this._paso = 0;
        this.lento = LENTO;
      }
      return;
    }

    // ---- LA CINEMÁTICA. En lento, y ya no hay tecla que sirva. ----
    this._tc += dt;
    const sm = this.sanmartin;

    if (this._tc >= C_HERIDO && this._paso < 1) {
      this._paso = 1;
      this.segundo = this._traer('realista', jugador.pos.x - 1.6, jugador.pos.z + 2.2);
      this.segundo.alGolpear = null;
      this.segundo.fig.poner('estocada');
      jugador.sacudir(1.2);
      sonido.impactoCarne();
      sonido.ensordecer(1.1);
      hud.mostrarAviso('¡La bayoneta!', 'malo');
    }

    // la cámara se cae al pasto y queda mirando al cielo
    if (this._tc >= C_CAE && this._paso < 2) {
      this._paso = 2;
      jugador.atrapar(jugador.pos.x, jugador.pos.z, jugador.yaw || 0);
      jugador.pitchAtrapado = 0.52;
      jugador.pitch = 0.1;
    }

    if (this._tc >= C_FRASE && this._paso < 3) {
      this._paso = 3;
      hud.decir(FRASE, 5.2);
    }

    // A CABRAL SE LO MATA COMO A CUALQUIERA, Y SE VE IGUAL. Antes era un corte
    // a negro y se leía como el final de una escena; ahora es la misma muerte
    // que la tuya —la vista que se nubla y se cierra, el sonido que se va con
    // ella—, porque es exactamente lo mismo que pasa: se está muriendo un
    // hombre. Sin los botones, eso sí: el que se muere es él y la partida
    // sigue, así que no hay nada que elegir.
    if (this._tc >= C_NEGRO && this._paso < 4) {
      this._paso = 4;
      hud.cerrarLosOjos(C_OJOS, false);
      sonido.morir(C_OJOS);
    }

    // se para, pero no se mueve del sitio: el acto todavía no terminó
    if (sm && this.sitio) { sm.pos.x = this.sitio.x; sm.pos.z = this.sitio.z; sm.pos.y = 0; }

    if (this._tc >= C_FIN) this._serSanMartin();
  }
}

// ===========================================================================
// EL ACTO DE LA VICTORIA · lo que pasa cuando la barranca queda vacía
// ===========================================================================
//
// San Lorenzo no se ganó matando a los doscientos cincuenta: se ganó cuando la
// línea se quebró y bajaron a los botes. Hasta acá el juego sabía producir ese
// momento pero no sabía DECIRLO: la última bandera roja desaparecía del campo y
// no pasaba nada más. Quedabas parado en un potrero.
//
// Son tres cosas y ninguna es una pantalla: un aviso, una flecha sobre el
// portón del convento —de donde saliste— y el escuadrón formando ahí. La
// batalla termina donde empezó, y termina caminando hasta ahí, no mirando un
// cartel. El cartel viene después, cuando llegás.
//
// EN RED alcanza con que llegue UNO. Los dos ganaron la misma batalla y hacer
// que el segundo camine para leer lo mismo es hacerlo esperar por nada.
const VICTORIA_CERCA = 7;      // a esta distancia del portón, llegaste
const VICTORIA_ESPERA = 2.2;   // lo que se tarda en creerlo, antes del aviso

// La frase es SUYA y es sobre sus granaderos, que es de lo que trata esta
// batalla. No hay ninguna cita de San Martín sobre San Lorenzo que se pueda
// poner acá sin inventarla, y una frase inventada con su nombre abajo es lo
// único que este juego no puede hacer.
const VICTORIA_FRASE = 'De lo que son capaces mis granaderos, sólo yo lo sé; ' +
  'quien los iguale habrá, quien los exceda, no.';

export class ActoVictoria {
  constructor (ctx) {
    this.ctx = ctx;
    this.fase = null;          // null · 'llamando' · 'llegado'
    this.t = 0;
    this.marca = null;
    this.hubo = false;         // ¿llegó a haber realistas? si no, no hay nada que ganar
    this.alEmpezar = null;     // para contárselo a la otra máquina
    this.alLlegar = null;
  }

  get activo () { return this.fase !== null; }

  // ¿SE ACABÓ? Se pregunta por los que siguen PELEANDO, no por los vivos: el
  // que se quebró y todavía está corriendo a la barranca ya no es un enemigo,
  // y esperar a que salga del campo son veinte segundos mirando espaldas.
  contar (dt) {
    if (this.fase || !this.ctx.pinza.tocado) return;
    let enPie = 0;
    for (const s of this.ctx.soldados) {
      if (s.esRealista && s.vivo && !s.quebrado) enPie++;
    }
    if (enPie > 0) { this.hubo = true; this.t = 0; return; }
    if (!this.hubo) return;
    // un respiro antes del aviso: si se dispara en el mismo cuadro en que cae
    // el último, se pisa con el ruido de ese golpe
    this.t += dt;
    if (this.t >= VICTORIA_ESPERA) this.arrancar(true);
  }

  // `mio` es false cuando la victoria la cantó la otra máquina: entonces no se
  // vuelve a contar por el cable, que sería un eco.
  arrancar (mio) {
    if (this.fase) return;
    this.fase = 'llamando';
    this.t = 0;
    const { hud, sonido, escena } = this.ctx;
    hud.mostrarAviso('¡SE QUIEBRA EL ENEMIGO!', 'bien');
    hud.decir(VICTORIA_FRASE + ' — José de San Martín', 9);
    if (sonido.clarin) sonido.clarin();
    this.marca = baliza(escena, PORTON.x, PORTON.z - 2.5);
    setTimeout(() => {
      if (this.fase === 'llamando') hud.decir('Al portón del convento. Ahí formaron a las cinco y media.', 7);
    }, 5000);
    this._formar();
    if (mio && this.alEmpezar) this.alEmpezar();
  }

  // EL ESCUADRÓN VUELVE AL PORTÓN. Se les escribe la plaza, que es el mismo
  // mecanismo con el que la Pinza los lleva formados: mientras la tengan
  // puesta marchan y no se paran a pelear con nadie. Y se apaga la Pinza
  // primero, que si no se la vuelve a escribir ella en el cuadro siguiente.
  _formar () {
    const { soldados, pinza } = this.ctx;
    pinza.viva = false;
    let i = 0;
    for (const s of soldados) {
      if (s.esRealista || !s.vivo || s.quebrado || s.titere || !s.montado) continue;
      const fila = Math.floor(i / 12), col = (i % 12) - 5.5;
      s.plaza = new THREE.Vector3(PORTON.x + col * 2.6, 0, PORTON.z - 7 - fila * 3.2);
      s.andarColumna = 2;
      i++;
    }
  }

  actualizar (dt) {
    if (this.fase !== 'llamando') return;
    this.t += dt;
    // la flecha late, como la del acto de Cabral
    if (this.marca) {
      const m = this.marca.userData.mat;
      if (m) m.opacity = 0.45 + 0.28 * (0.5 + 0.5 * Math.sin(this.t * 3.1));
    }
    // cada tanto se les refresca la plaza: los que se desmontan o se suman
    // después no tienen por qué quedarse afuera de la formación
    if ((this.t % 2) < dt) this._formar();
    const j = this.ctx.jugador;
    if (!j.vivo) return;
    const d = Math.hypot(j.pos.x - PORTON.x, j.pos.z - PORTON.z);
    if (d <= VICTORIA_CERCA) this.llegar(true);
  }

  llegar (mio) {
    if (this.fase !== 'llamando') return;
    this.fase = 'llegado';
    const { hud, sonido } = this.ctx;
    if (this.marca) { this.ctx.escena.remove(this.marca); this.marca = null; }
    hud.mostrarAviso('¡VICTORIA!', 'bien');
    hud.decir('San Lorenzo. Dejaron las dos piezas, la bandera y sus muertos en la barranca.', 12);
    if (sonido.clarin) sonido.clarin();
    if (mio && this.alLlegar) this.alLlegar();
  }

  // Cuando se rearma el campo, la victoria vuelve a estar por ganarse.
  reiniciar () {
    if (this.marca) { this.ctx.escena.remove(this.marca); this.marca = null; }
    this.fase = null;
    this.t = 0;
    this.hubo = false;
  }
}
