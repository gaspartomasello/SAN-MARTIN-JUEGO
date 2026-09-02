import * as THREE from 'three';
import { Figura } from './figura.js';
import { Caballo } from './caballo.js';
import { sacarDeCaja, RADIO_HOMBRE } from './estorbos.js';
// LOS NÚMEROS DE LA PELEA NO VIVEN ACÁ. Vida, daño, puntería, volteo, aliento
// y saturación están todos en balance.js, que es el único archivo que hay que
// abrir para reequilibrar la batalla. Acá vive el COMPORTAMIENTO: qué decide
// un hombre, cuándo se da vuelta, cuánto tarda en bajar la lanza.
import {
  VIDA_TROPA, VOLTEO, OFICIO_TROPA, tirar,
  ALIENTO_TROPA, GASTO_CARRERA, RECUPERO, CARRERA_MINIMA, SATURACION, TERQUEDAD,
  ANIMO_TROPA, TEMPLE, REFUGIO_REALISTA, REFUGIO_GRANADERO, PERSEGUIR
} from './balance.js';

// Soldados de los dos bandos. Misma anatomía, distinta casaca:
//   granadero — casaca azul, vivos encarnados, morrión con penacho
//   realista  — casaca blanca, correaje de ante, sombrero redondo
// Buscan al enemigo vivo más cercano del otro bando, avisan antes de la
// descarga y su percepción consulta la MISMA grilla de humo que ve el jugador:
// si la nube tapa, pierden de vista y caminan a donde vieron por última vez.

// ---- LA BALA VA A ALGÚN LADO ----
//
// Antes esto era `Math.random() < punteria` y daño completo: no había bala,
// había un dado. Y el dado estaba cargado —a cinco metros de un realista
// hincado la cuenta daba 75 % por disparo—, así que se sentía como puntería
// perfecta con castigo aleatorio, que es la peor de las dos cosas.
//
// Ahora el tiro tiene DIRECCIÓN. Cada disparo sortea una desviación angular
// dentro del cono del arma, y después se mira si a esa distancia la desviación
// cae adentro de la silueta del blanco. La caída con la distancia sale sola de
// ahí: no hay que inventarla, es geometría.
//
// Un ánima lisa de 1813, disparada por un hombre apurado, con humo y con el
// oído reventado, agrupa alrededor de dos grados y medio. A veinte metros eso
// es un metro de desvío contra un blanco de treinta y cinco centímetros de
// radio: la mayoría de los tiros pasan al lado. Que es lo que pasaba.
//
// Y el fallo SE VE. Si la bala pasó cerca, zumba; si dio en el piso, levanta
// tierra. Un tiro que falla sin dejar rastro es indistinguible de un tiro que
// no existió.
const VEL = 1.85;
const VEL_CARRERA = 4.3;        // a la carrera, con el fusil corto y bajo
const ALCANCE_TIRO = 62;
const ALCANCE_ACERO = 1.9;
const RECARGA = 12.5;

// ---- carrera, parapeto y rodilla ----
//
// Un soldado con el fusil descargado y el enemigo a menos de 16 m no se queda
// a recargar: se le va encima a la bayoneta. Y uno con el fusil cargado no
// dispara parado en medio del campo si tiene una tapia a mano.
// ---- EL ALIENTO DE LA TROPA ----
//
// Los realistas corrían SIEMPRE, y venían todos juntos, en fila, al mismo
// blanco. La causa era mecánica y no de IA: recargar lleva doce segundos y
// medio, así que casi siempre están descargados, y un hombre descargado con el
// enemigo a menos de dieciséis metros carga a la bayoneta. Descargados +
// cerca = corriendo, todo el tiempo, todos.
//
// El arreglo no es un temporizador: es que se cansen. El aliento ya existía
// para el jugador —es lo que impide jugar el duelo entero con la guardia en
// alto— y acá hace exactamente lo mismo. Cuatro segundos de carrera, cinco de
// resuello. Los intervalos salen solos y nadie los coreografió.

// ---- NO TODOS AL MISMO BLANCO ----
//
// Un blanco que ya tiene gente encima deja de ser atractivo. Sin esto, los
// doscientos cincuenta eligen siempre al más cercano —vos— y te llega una fila
// india de hombres sprintando de a uno, que es lo más robótico que puede pasar
// en un campo de batalla.
//
// Se paga en metros: cada atacante que ya tiene un blanco lo aleja siete
// metros a los ojos de los demás. El cuarto que te venía a buscar prefiere al
// granadero de al lado antes que ser el quinto encima tuyo.

// ---- NO SE DISPARA PARA CUALQUIER LADO ----
//
// Doscientos cincuenta realistas descargando todos a la vez, en cualquier
// dirección y a través de sus propios compañeros, no son una línea de
// infantería: son doscientos cincuenta francotiradores sueltos a los que da la
// casualidad de que están juntos. Medido: barrían a los ciento veinte
// granaderos en cincuenta y cuatro segundos.
//
// Faltaban dos reglas, y las dos son obvias apenas se las dice en voz alta:
//
//   1. NO SE DISPARA A TRAVÉS DE LOS PROPIOS. Por eso las formaciones de la
//      época tenían dos o tres filas y no veinte: sólo la de adelante tiene
//      tiro. Con esto un bloque de doscientos cincuenta hombres pasa a tener el
//      volumen de fuego de su FRENTE, no de su total.
//
//   2. NO SE DISPARA A LO QUE UNO TIENE AL COSTADO. Hay que girar primero, y
//      girar lleva tiempo. Un fusil de chispa no se apunta hacia atrás.
//
// La segunda es, además, la razón de ser de la pinza: pegarle a un flanco
// funciona porque el flanco no puede contestar. Sin ella San Martín podía haber
// cargado de frente y daba lo mismo, y entonces la maniobra que ganó la batalla
// sería una decoración.
const GIRO_TROPA = 2.4;          // rad/s: lo que tarda un hombre en darse vuelta
const CONO_TIRO = 0.62;          // ±35°: fuera de esto, primero gira
const PASILLO = 0.75;            // si hay un compañero más cerca que esto de la
const PASILLO_LARGO = 9;         // línea de tiro y dentro de estos metros, no tira

const CARGA_BAYONETA = 16;
const CARGA_TOQUE = 2.5;        // a esta distancia el que viene corriendo ya ensartó
// A UN HOMBRE A CABALLO NO SE LO CORRE. Un infante a la carrera va a 4,3 m/s y
// un caballo al trote a 4,6: la diferencia es tan poca que doscientos
// cincuenta realistas podían salir a perseguir jinetes por el campo abierto y
// alcanzarlos. Medido: de las 120 bajas de granadero, 104 son el bayonetazo, y
// la mayoría es el golpe de llegada de esa persecución. Ninguna infantería del
// mundo hace eso —se la espera a pie firme, que para eso el fusil tiene un
// palmo de acero en la punta—. Así que contra un montado la bayoneta sale
// recién cuando lo tiene encima Y cuando el caballo está frenado: si el animal
// va más rápido que un hombre corriendo, no hay carrera que lo alcance. No
// hace falta un número nuevo para eso —es VEL_CARRERA contra la velocidad del
// caballo—, y de paso le da al que juega la regla que corresponde: montado, lo
// que te salva es no parar.
//
// Se probó además dejar cargar contra el jinete que VIENE derecho al hombre
// —perseguir no, recibir sí—, que suena mejor todavía. No sirve: en un
// revoltijo todos encaran a todos, y con el cono del asta (41°) o con uno de
// 78° daba lo mismo, los granaderos volvían a perder los 120. La regla que
// filtra es la velocidad.
const CARGA_JINETE = 5;
const CUBIERTA_BUSCAR = 24;     // radio en el que mira si hay parapeto
const CUBIERTA_MINIMA = 6;      // no se parapeta encima del enemigo
const CUBIERTA_LLEGADA = 1.1;
const RODILLA_SUELTA = 0.42;    // probabilidad de hincarla a campo abierto
const ESPERA_HUECO = 2.2;       // segundos esperando un hueco antes de hincarse
const PASO_BLANCO = 0.34;       // cada cuánto vuelve a mirar a quién encarar
const CONVERGER = 22;           // a esta distancia del borde empieza a buscar su bote

// Ritmo de la estocada. El AVISO es sagrado: es la ventana en la que el
// jugador ve venir el golpe. Sin esto, parar es lotería.
// El ciclo era de 1,95 s por estocada y con tres hombres encima te vaciaban la
// vida en seis segundos. Un bayonetazo no es un jab: es un hombre de setenta
// kilos empujando un fusil de cuatro y medio, y después tiene que recuperarlo.
// El ciclo pasa a 2,62 s, y el AVISO se alarga: es la ventana con la que el
// jugador se defiende y era lo primero que había que agrandar.
const ACERO_GUARDIA = 1.05;
const ACERO_AVISO = 0.62;
const ACERO_SALIDA = 0.20;
const ACERO_VUELTA = 0.75;
const ATURDIDO = 1.35;      // lo que dura abierto tras una parada perfecta

// ---- caballería ----
//
// El lancero no pelea parado: CARGA. Entra al galope, tira el lanzazo de
// pasada, sigue de largo hasta despegarse y recién ahí vuelve grupas. Esa es
// la mecánica entera —y es la que hizo que San Lorenzo durara quince minutos.
// ---- QUEDARSE EN LA SILLA ----
//
// Antes, cualquier golpe de 3 o más te bajaba del caballo. Y como todos los
// golpes que valía la pena dar eran de 3 o más, en la práctica eso quería
// decir: TODO te desmonta, siempre, al cien por ciento. Un balazo, un
// bayonetazo, lo que fuera.
//
// Está mal por dos motivos. Uno de juego: perder la montura es lo más caro que
// te puede pasar en este juego y no puede ser un trámite; si es automático,
// pelear a caballo se vuelve una cuenta regresiva y no una decisión. Y uno
// histórico: San Martín cruzó el campo montado, aguantó la descarga y lo bajó
// UNA cosa. No fue la mosquetería. Fue la metralla.
//
// Así que agarrarse a la silla pasa a ser una tirada, y cada arma tiene la
// suya. Lo que se lee en esta tabla es una jerarquía: la bala te tira poco
// —te pega, no te empuja—, la bayoneta desde abajo te busca la pierna y el
// estribo, el asta del lancero te levanta de la silla porque para eso se
// inventó, y la metralla no pregunta.

const LANZA_ALCANCE = 3.6;      // 2,70 m de asta más el brazo desde la silla
const LANZA_ENRISTRE = 15;      // a esta distancia baja el asta: el aviso largo
const LANZA_AVISO = 5.4;        // y a esta se echa atrás: el aviso corto
// La pasada dura lo que tarda en despegarse de verdad. Con segundo y medio se
// daba vuelta encima del muerto y volvía a ensartar: un lancero mataba diez
// hombres en medio minuto. Una pasada de caballería te lleva bien lejos y
// recién ahí volvés grupas.
const PASADA = 3.2;
// Y la lanza apunta ADELANTE. Antes ensartaba a cualquiera que estuviera a
// menos de 3,6 m, aunque le pasara por el costado o por atrás: un radio, no un
// asta. Ahora el blanco tiene que estar en el cono del asta.
const LANZA_CONO = 0.72;
const CAIDA_JINETE = 14;        // lo que cuesta el golpe contra el suelo

// AL QUE LE MATAN EL CABALLO, SE VA.
//
// Un jinete desmontado en medio de la infantería enemiga no se queda a pelear:
// se raja. Sin esto, cada granadero que perdía el caballo caminaba de vuelta
// hacia las bayonetas hasta que lo mataban, y los ciento veinte terminaban en
// cero en todas las corridas. No es una concesión de balance: es lo que hace
// cualquiera. Y de paso es la primera pieza de la moral, que es la fase que
// viene: acá un hombre ya tiene un motivo para dejar de pelear.
const HUIDA = 9;                // segundos de sacarse de encima el problema
const HUIDA_SEGURO = 26;        // a esta distancia del enemigo, se recompone

export class Soldado {
  // op.tez      — color de piel fijo (Cabral)
  // op.sombrero — 'bicornio' para el San Martín del acto
  // op.caballo  — lo monta desde el arranque; si trae caballo, va con lanza
  constructor (escena, humo, sonido, pos, bando, op = {}) {
    this.escena = escena;
    this.humo = humo;
    this.sonido = sonido;
    this.bando = bando || 'realista';
    // en red el títere del lancero nace sin caballo —el animal es otra entidad
    // que llega por su cuenta— y sin embargo tiene que salir con la lanza
    this.lancero = op.lancero !== undefined
      ? !!op.lancero
      : (!!op.caballo && this.bando === 'granadero');

    // La semilla decide cara, estatura y cómo le cae el uniforme. En red
    // viaja por el cable: si cada máquina sorteara la suya, los dos jugadores
    // verían la misma batalla peleada por dos ejércitos distintos.
    this.semilla = op.semilla !== undefined ? op.semilla : Math.random();
    this.tez = op.tez || null;
    this.fig = new Figura(this.bando, this.semilla,
      { tez: op.tez, sombrero: op.sombrero, arma: this.lancero ? 'lanza' : null });
    // la malla exterior lleva el rumbo; la figura de adentro, el desplome
    this.malla = new THREE.Group();
    this.malla.add(this.fig.raiz);
    this.malla.position.copy(pos);
    escena.add(this.malla);

    this.vivo = true;
    // El doble de vida que antes: la pelea tenía que durar más. Un hombre
    // aguanta dos balazos de fusil, o dos bayonetazos, o un lanzazo.
    this.vida = VIDA_TROPA;
    this.estado = 'avanzar';
    this.t = 0;
    this.recarga = Math.random() * 4;
    this.ultimoVisto = new THREE.Vector3().copy(pos);
    this.objetivo = null;
    this.caida = 0;
    // TENDIDO: vivo pero en el suelo, y con la pose puesta desde afuera. Lo
    // usa el acto para San Martín bajo el caballo. No alcanzaba con `tirado` ni
    // con `aturdido`: lo único que acuesta a un soldado es estar muerto, así
    // que el general esperaba PARADO abajo de un animal volcado.
    this.tendido = false;
    this.tieneFusil = this.bando === 'realista';
    this.alDisparar = null;
    this.alGolpear = null;

    this.tAcero = 0;
    this.avisando = false;   // true durante el AVISO: la ventana de parada
    this.aturdido = 0;       // > 0: parado en seco, abierto y sin guardia
    this._pego = false;
    this._grito = false;
    this._v = new THREE.Vector3();
    this._d = new THREE.Vector3();

    // Estorbos. Antes el soldado era un fantasma: cruzaba las tapias y se
    // metía adentro del compañero. Ahora ocupa lugar como todo el mundo.
    this.colisiones = op.colisiones || null;
    this.orden = Soldado.proximoOrden++;     // para resolver cada par una sola vez
    this._n = { x: 0, z: 0 };

    this.cubiertas = op.cubiertas || null;   // parapetos del campo, ya filtrados
    this.cubierta = null;                   // a dónde va corriendo
    this.motivo = null;                     // 'cubierta' o 'carga'
    this.rodilla = false;                   // rodilla en tierra: va a disparar
    this.tTapado = 0;                       // hace cuánto que no consigue línea
    this.tCubierta = 0;                     // para no re-buscar parapeto cada cuadro
    this.ritmo = 1;                         // 1 marcha, 2,3 carrera
    this.aliento = ALIENTO_TROPA;           // correr cansa, también a ellos
    // Cada uno decide cargar a SU distancia y con SU demora. Sin esto los
    // doscientos cincuenta arrancan en el mismo cuadro y llegan en fila.
    this.arrojo = 0.55 + Math.random() * 0.9;
    this.tDecidir = 0;
    this.tResuello = 0;                     // recién salido del acero: no vuelve a arrancar
    this.tBlanco = Math.random() * PASO_BLANCO;   // turno repartido al nacer
    this.encarado = true;
    this.huyendo = 0;               // > 0: acaba de perder el caballo y se está yendo

    // ---- EL ÁNIMO ----
    //
    // Cuánto le queda a este hombre de ganas de seguir peleando. Lo que se lo
    // baja no está acá —eso lo mira moral.js, que es el que ve la tropa
    // entera— ni cuánto pesa cada cosa —eso es balance.js—. Acá vive lo único
    // que es del hombre: cuánto aguanta y qué hace cuando se le acaba.
    this.animo = ANIMO_TROPA;
    // EL TECHO. Hasta dónde puede volver el ánimo cuando lo dejan tranquilo. No
    // vuelve a cien: el hombre que estuvo dos minutos abajo de la caballería no
    // es el mismo que formó a la mañana, y el aplomo no lo devuelve. Baja y no
    // sube nunca. Es lo que hace que el desbande sea progresivo y no una
    // moneda al aire — medido: sin techo, la misma batalla se quebraba a los
    // cien segundos o no se quebraba jamás, según cómo cayeran los dados.
    this.techo = ANIMO_TROPA;
    this.temple = TEMPLE[0] + Math.random() * TEMPLE[1];
    this.quebrado = false;          // dejó de pelear: va a la barranca
    this.tAnimo = Math.random() * 0.4;   // escalonado, para no mirarlos a todos juntos
    // Hacia dónde mira LA TROPA, que no es hacia dónde mira este hombre. Un
    // hombre se da vuelta en un segundo; una línea, no. Persigue muy despacio
    // al rumbo real y contra él se mide el flanco. Nace en null porque el
    // rumbo se le escribe después de construirlo —al formar, o al plantar la
    // columna— y arrancarlo en cero pondría a doscientos cincuenta realistas
    // creyendo que su frente es el río que tienen a la espalda.
    this.frente = null;
    this._llorado = false;          // su muerte ya se le cobró a los de al lado
    this._tLinea = 0;               // caché de la línea de tiro
    this._linea = true;
    this.puesto = null;                     // los artilleros no abandonan la pieza
    this.correa = 4.5;                      // metros que se puede alejar del puesto

    // LEJANÍA: a partir de cierta distancia deja de armarse hueso por hueso
    // y lo dibuja una instancia horneada. La IA no cambia en nada.
    this._lejos = false;
    this.andando = false;

    // Su lugar en la columna, si va formado. Mientras esté puesto, este hombre
    // no elige blanco ni carga: marcha. Lo escribe la Pinza cada cuadro.
    this.plaza = null;
    this.andarColumna = 0;

    this.monta = null;
    this.tPasada = 0;
    // Pasadas dadas desde la última reunión. No es una estadística: es la
    // señal que mira la columna para saber cuándo el escuadrón ya cargó y
    // toca volver grupas todos juntos. Ver pinza.js.
    this.pasadas = 0;
    this.tirado = 0;          // > 0: en el suelo tras la caída, sin defensa
    this.alDesmontar = null;

    // ---- EL TÍTERE ----
    //
    // En red, la batalla la piensa UNA sola máquina. En la otra este mismo
    // hombre existe, se ve y se oye igual, pero no decide nada: lo mueve el
    // parte que llega por el cable veinte veces por segundo.
    //
    // Y no puede recibir daño de su lado, porque entonces cada máquina llevaría
    // su propia cuenta de muertos y a los dos minutos serían dos batallas.
    // `alCastigo` es la puerta: lo que iba a ser un golpe se convierte en un
    // pedido —«a éste le pegué»— que resuelve el que manda. Nada más del juego
    // se entera: combate.js le pega igual que siempre.
    this.titere = false;
    this.alCastigo = null;
    if (op.caballo) this.montar(op.caballo);
  }

  // ---------------------------------------------------------- caballería

  get montado () { return !!this.monta && this.monta.vivo; }

  // OJO: los realistas NO montan, nunca, bajo ninguna opción.
  //
  // No es un balance: es el hecho del que cuelga toda la batalla. La fuerza de
  // desembarco española eran 250 infantes con dos cañones y ni un caballo, y
  // por eso 120 granaderos les cayeron encima antes de que pudieran formar el
  // cuadro. Si el realista pudiera montar, San Lorenzo dejaría de ser San
  // Lorenzo. Queda cerrado acá para que no se cuele por una opción mal pasada.
  montar (caballo) {
    if (this.esRealista) return false;
    if (!caballo || !caballo.vivo) return false;
    this.monta = caballo;
    caballo.montado = true;
    caballo.jinete = this;
    caballo.rumbo = this.malla.rotation.y;
    caballo.pos.set(this.pos.x, 0, this.pos.z);
    this.fig.montura = true;
    this.estado = 'cargar';
    this._sentar();
    return true;
  }

  // Bajarse: por voluntad, porque le mataron el caballo o porque lo voltearon.
  // En los dos últimos casos toca el suelo con el golpe puesto.
  desmontar (golpe) {
    if (!this.monta) return false;
    // si lo bajaron a la fuerza, sale de ahí; si se bajó solo, no
    if (golpe) this.huyendo = HUIDA;
    const c = this.monta;
    c.montado = false;
    c.jinete = null;
    this.monta = null;
    this.fig.montura = false;
    // cae al costado del caballo, no encima
    this.malla.position.set(c.pos.x - Math.cos(c.rumbo) * 1.1, 0, c.pos.z + Math.sin(c.rumbo) * 1.1);
    this.estado = 'avanzar';
    if (golpe) {
      // El porrazo cuesta, pero NO mata: el que cae de la silla se levanta.
      // Si el suelo pudiera matarlo, voltear sería lo mismo que abatir y se
      // perdería lo mejor —el lancero derribado que sigue peleando a pie.
      this.tirado = 1.6;
      this.aturdido = Math.max(this.aturdido, 1.6);
      this.fig.poner('aturdido');
      this.vida = Math.max(1, this.vida - (golpe === true ? 1 : golpe));
    }
    if (this.alDesmontar) this.alDesmontar(this);
    return true;
  }

  // el jinete va sentado en la silla y gira con el caballo
  // ---------------------------------------------------------- lejanía
  //
  // Quién lo dibuja: de cerca, quince mallas articuladas; de lejos, una
  // instancia compartida con todos los que están en la misma postura. Lo
  // decide la distancia y nada más. La IA corre igual de un lado y del otro:
  // el que está a ochenta metros apunta, avisa, dispara y muere exactamente
  // como el que tenés encima.
  ponerLejos (v) {
    this._lejos = v;
    this.fig.lejos = v;
    this.malla.visible = !v;
    if (this.monta) this.monta.lejos = v;
  }

  get lejos () { return this._lejos; }

  // Deja su matriz en el lote que le toca. El paso se anima alternando los dos
  // fotogramas horneados —así caminaban los soldados hace treinta años y a
  // esta distancia se lee igual de bien.
  pintarLejos (lej) {
    if (!this._lejos) return;
    if (this.montado) {
      const c = this.monta;
      const p = this.fig.pose;
      const enristre = p === 'enristre' || p === 'lanzaAviso' || p === 'lanzazo';
      // el caballo va horneado con el jinete: una instancia, no dos
      lej.poner('lancero', enristre ? 2 : (Math.sin(c.paso) > 0 ? 0 : 1),
        c.pos.x, c.alto, c.pos.z, c.rumbo);
      return;
    }
    const p = this.fig.pose;
    const fase = !this.vivo ? 3
      : this.rodilla ? 4
      : (p === 'apuntar' || p === 'recargar') ? 5
      : this.andando ? (Math.sin(this.fig.paso) > 0 ? 1 : 2)
      : 0;
    const m = this.malla;
    lej.poner(this.bando === 'granadero' ? 'granadero' : 'realista', fase,
      m.position.x, m.position.y, m.position.z, m.rotation.y, this.fig.raiz.scale.y);
  }

  _sentar () {
    const c = this.monta;
    const asiento = c.altura - 0.92 * this.fig.raiz.scale.y;
    this.malla.position.set(c.pos.x, c.alto + asiento, c.pos.z);
    this.malla.rotation.y = c.rumbo;
  }

  get pos () { return this.malla.position; }
  get esRealista () { return this.bando === 'realista'; }

  cabeza () { return this._v.set(this.pos.x, this.pos.y + this.fig.alturaOjo, this.pos.z); }

  // volteo: probabilidad de que este golpe lo saque de la silla (0 si el arma
  // no puede). Si la tirada sale, no hay daño: rueda, se levanta y sigue a pie
  // con lo que le quede. Un lancero derribado vale mucho más vivo que borrado
  // del campo. Si la tirada NO sale, el golpe entra como cualquier otro: la
  // bayoneta que no te voltea, te hiere.
  recibir (dano, dir, volteo = 0) {
    if (!this.vivo) return false;
    // el títere no se hiere solo: pide que lo hieran del otro lado
    if (this.titere) return this.alCastigo ? !!this.alCastigo({ dano, volteo, dir }) : false;
    // EL OFICIO DEL JINETE, que es lo que hace que una carga siga siendo una
    // carga. Sin el descuento la tirada era la del arma pelada y a los dos
    // minutos no quedaba un solo granadero montado: la caballería se apagaba
    // sola antes de quebrar nada.
    if (this.montado && volteo > 0 && Math.random() < volteo * (1 - OFICIO_TROPA)) {
      this.desmontar(true);
      return false;
    }
    this.vida -= dano;
    if (this.vida <= 0) {
      this.vivo = false;
      this.estado = 'caido';
      this.caida = 0;
      this.avisando = false;
      this.sonido.grito();
      if (this.rodilla) { this.rodilla = false; this.fig.rodilla = false; }
      // el muerto se cae de la silla y el caballo se dispara sin jinete
      if (this.monta) this.desmontar();
      return true;
    }
    return false;
  }

  // ¿está cubierto? En guardia el acero para el sablazo; en el aviso, en la
  // estocada o aturdido, no. Ahí es donde hay que pegarle.
  get cubierto () {
    if (this.montado) return this.aturdido <= 0 && !this.avisando && this.estado !== 'pasada';
    return this.vivo && this.aturdido <= 0 && this.estado === 'acero' &&
      !this.avisando && this.tAcero < ACERO_GUARDIA;
  }

  // SE QUEBRÓ. Deja de pelear y se va, y no vuelve.
  //
  // Que no vuelva es una decisión, no una simplificación por vagancia: en San
  // Lorenzo los que se quebraron no se reagruparon, bajaron la barranca y se
  // subieron a los botes. Un sistema de reagrupe además haría que el ánimo
  // fuera de ida y vuelta, y toda la tensión de la pelea está justo antes del
  // quiebre —en si el recupero le gana a lo que entra—, no después.
  quebrar () {
    if (this.quebrado || !this.vivo) return false;
    this.quebrado = true;
    this.animo = 0;
    this.plaza = null;           // se acabó la formación
    this.cubierta = null;
    this.motivo = null;
    this.objetivo = null;
    this.rodilla = false;
    this.fig.rodilla = false;
    return true;
  }

  // A DÓNDE CORRE. No «lejos»: el realista baja por donde subió —la barranca
  // está en z −85 y la escuadra fondeada detrás— y el granadero vuelve atrás
  // del convento, por el costado y no por encima del edificio.
  refugio () {
    if (!this.esRealista) {
      return { x: (this.pos.x >= 0 ? 1 : -1) * 42, z: REFUGIO_GRANADERO };
    }
    // Al bote más cercano, pero CONVERGIENDO DE A POCO.
    //
    // Un hombre que se raja no corre hacia el vacío: corre hacia algo. Pero
    // apuntarle al bote desde el primer paso lo hace cruzar en diagonal por
    // delante de la línea enemiga, y eso no es huir: es ofrecerse. Medido, con
    // la diagonal entera bajaban 7 de 250 en vez de 23.
    //
    // Así que primero se sale del fuego, derecho para atrás, y la convergencia
    // entra sobre el final —cuando ya está cerca del borde y el peligro quedó
    // atrás—. Desde arriba se ven cinco chorros que se van juntando, que es lo
    // que se veía ese día.
    let x = this.pos.x, mejor = Infinity;
    for (const bx of Soldado.botes) {
      const d = Math.abs(bx - this.pos.x);
      if (d < mejor) { mejor = d; x = bx; }
    }
    const falta = Math.max(0, this.pos.z - REFUGIO_REALISTA);
    const juntarse = 1 - Math.min(1, falta / CONVERGER);
    return { x: this.pos.x + (x - this.pos.x) * juntarse, z: REFUGIO_REALISTA };
  }

  get enRefugio () {
    const r = this.refugio();
    return this.esRealista ? this.pos.z <= r.z : this.pos.z >= r.z;
  }

  _irse (dt) {
    const r = this.refugio();
    if (this.montado) {
      this._marchar(dt, this._v.set(r.x, 0, r.z), 3);
      this.fig.actualizar(dt, false);
      return;
    }
    this._dePie();
    let dx = r.x - this.pos.x, dz = r.z - this.pos.z;
    const d = Math.hypot(dx, dz) || 1;
    dx /= d; dz /= d;
    this._girarHacia(Math.atan2(dx, dz) + Math.PI, dt, true);
    // corre hasta quedarse sin aire y después sigue al trote: no se para
    const hay = this.aliento > 6;
    this.aliento = Math.max(0, this.aliento - GASTO_CARRERA * 0.55 * dt);
    const v = hay ? VEL_CARRERA : VEL;
    this.ritmo = hay ? 2.3 : 1;
    this.fig.poner(hay ? 'correr' : 'marcha');
    this.pos.x += dx * v * dt;
    this.pos.z += dz * v * dt;
    this._chocar();
    this.malla.position.y = 0;
    this.andando = true;
    this.fig.actualizar(dt, true, this.ritmo);
  }

  // parado en seco: se le corta el golpe y queda abierto
  aturdir (seg) {
    if (!this.vivo) return;
    if (this.titere) { if (this.alCastigo) this.alCastigo({ aturdir: seg || ATURDIDO }); return; }
    this.aturdido = Math.max(this.aturdido, seg || ATURDIDO);
    this.avisando = false;
    this._pego = true;          // el golpe que venía ya no sale
    this.fig.poner('aturdido');
    this.sonido.grito();
  }

  entregarFusil () {
    if (!this.tieneFusil) return false;
    this.tieneFusil = false;
    this.fig.ocultarArma(true);
    return true;
  }

  // El enemigo vivo más cercano del otro bando; para los realistas, el jugador
  // también cuenta.
  //
  // La distancia se mide SOBRE EL PISO, no en tres dimensiones. Parece un
  // detalle y no lo es: jugador.pos.y está a la altura del ojo (1,68 m) y el
  // soldado tiene los pies en 0, así que la distancia 3D nunca bajaba de 1,68.
  // Con ALCANCE_ACERO en 1,9 eso dejaba el alcance real de la bayoneta en 89
  // centímetros —el enemigo tenía que meterse casi adentro tuyo para poder
  // usarla— y es buena parte de por qué el cuerpo a cuerpo casi no aparecía.
  // Un hombre parado a dos metros está a dos metros, no a dos y medio.
  _distancia (p) {
    const dx = p.x - this.pos.x, dz = p.z - this.pos.z;
    return Math.sqrt(dx * dx + dz * dz);
  }

  // CADA CUÁNTO SE VUELVE A ELEGIR. No sesenta veces por segundo.
  //
  // Es el mismo remedio que ya usa la moral: turnos repartidos al nacer. Un
  // hombre mira a quién encarar tres veces por segundo, no en cada cuadro, y
  // como los turnos están corridos entre sí el ejército deja de moverse en
  // bloque. Sin esto, cualquier empate en el puntaje se convierte en un
  // péndulo a 60 Hz: doscientos hombres girando juntos para un lado y para el
  // otro sin avanzar.
  //
  // La DISTANCIA sí se recalcula siempre —la usa la máquina de estados en cada
  // cuadro—; lo que se espacia es la decisión, que es lo que temblaba.
  _elegirObjetivo (jugador, soldados, dt) {
    const ac = Soldado.acoso;
    let mejor = null, mejorPuntaje = Infinity, mejorD = Infinity;

    // el que ya está peleando con alguien no lo suelta por uno que pasó cerca:
    // cambiar de blanco a mitad de una estocada es lo que los hacía parecer
    // autómatas girando en el lugar
    const pegado = this.estado === 'acero' && this.objetivo && this.objetivo.soldado &&
      this.objetivo.soldado.vivo && this._distancia(this.objetivo.pos) < ALCANCE_ACERO + 1.4;
    if (pegado) return this._distancia(this.objetivo.pos);

    // ¿le toca mirar? Si no, sigue con el que tenía, siempre que siga en pie.
    this.tBlanco -= dt;
    const sirve = this.objetivo && (this.objetivo.jugador
      ? jugador.vivo
      : this.objetivo.soldado && this.objetivo.soldado.vivo);
    if (sirve && this.tBlanco > 0) return this._distancia(this.objetivo.pos);
    this.tBlanco = PASO_BLANCO * (0.8 + Math.random() * 0.4);

    // PRIMERO EL QUE TODAVÍA PELEA. El que se quebró ya no te dispara y se
    // está yendo solo: perseguirlo antes que atender al que sí te está
    // apuntando es lo que convertía la desbandada en una carnicería. Se paga
    // en metros, con la misma moneda que la saturación.
    // el que ya tenía, para no soltarlo por una migaja
    const previo = this.objetivo && (this.objetivo.jugador ? 'jugador' : this.objetivo.soldado);
    let pPrevio = Infinity, dPrevio = 0, oPrevio = null;

    const mirar = (o, d, quien) => {
      const puntaje = d + (ac.get(quien) || 0) * SATURACION +
        (quien !== 'jugador' && quien.quebrado ? PERSEGUIR : 0);
      if (quien === previo) { pPrevio = puntaje; dPrevio = d; oPrevio = o; }
      if (puntaje < mejorPuntaje) { mejorPuntaje = puntaje; mejorD = d; mejor = o; }
    };
    if (this.esRealista && jugador.vivo) {
      mirar({ pos: jugador.pos, jugador: true }, this._distancia(jugador.pos), 'jugador');
    }
    for (const s of soldados) {
      if (s === this || !s.vivo || s.bando === this.bando) continue;
      mirar({ pos: s.pos, soldado: s }, this._distancia(s.pos), s);
    }
    // TERQUEDAD: al que ya venía encarando sólo se lo cambia por uno claramente
    // mejor. Sin esto SATURACION se realimenta sola y todos oscilan a la vez.
    if (oPrevio && mejorPuntaje > pPrevio - TERQUEDAD) {
      this.objetivo = oPrevio;
      return dPrevio;
    }
    this.objetivo = mejor;
    return mejorD;
  }

  // EL TÍTERE SE DIBUJA, NO PIENSA.
  //
  // Todo lo que hace `actualizar` —elegir blanco, girar, decidir si carga,
  // apuntar, disparar— acá no pasa: eso ya lo pensó la otra máquina y el
  // resultado llega hecho. Lo único que queda es lo visual, y eso SÍ corre
  // local, a los cuadros que dé la máquina: si esperáramos el parte para mover
  // un brazo, el campo iría a veinte cuadros por segundo a los tirones.
  //
  // O sea: la posición y la pose vienen del cable veinte veces por segundo, y
  // la animación entre parte y parte la hace cada máquina por su cuenta.
  actualizarTitere (dt) {
    if (!this.vivo) {
      this.caida = Math.min(1, this.caida + dt * 2.6);
      const e = 1 - Math.pow(1 - this.caida, 3);
      this.fig.desplomar(e);
      this.malla.position.y = -e * 0.10;
      return;
    }
    if (this.montado) { this._sentar(); this.fig.actualizar(dt, false); return; }
    this.malla.position.y = 0;
    this.fig.actualizar(dt, this.andando, this.ritmo);
  }

  actualizar (dt, jugador, soldados) {
    if (this.titere) return this.actualizarTitere(dt);
    // Tendido: no es un cadáver —está vivo y se va a levantar— pero tampoco un
    // hombre de pie que se anima solo. Mientras dure, la pose la lleva el que
    // lo puso ahí. Va antes que todo, como `poseFija` en el caballo.
    if (this.tendido) {
      this.fig.desplomar(1);
      this.malla.position.y = -0.10;
      return;
    }
    if (!this.vivo) {
      this.caida = Math.min(1, this.caida + dt * 2.6);
      const e = 1 - Math.pow(1 - this.caida, 3);
      this.fig.desplomar(e);
      this.malla.position.y = -e * 0.10;
      return;
    }

    // ------------------------------------------------------------------
    // EL CABALLO MUERTO. Esto va PRIMERO, y fuera de toda rama.
    //
    // Acá estuvo el bicho que dejaba jinetes congelados en el aire. `montado`
    // no es una bandera: es un getter que lee `monta && monta.vivo`. Cuando le
    // matan el caballo, ese getter pasa a false EN EL MISMO INSTANTE, así que
    // la rama `if (this.montado)` se apaga sola... y el único código que bajaba
    // al hombre del caballo muerto vivía adentro de esa rama.
    //
    // O sea: la limpieza estaba guardada detrás de la condición que su propio
    // disparador invalida. Nunca corría. El hombre quedaba con `monta` puesto,
    // con las piernas a horcajadas y a 46 cm del suelo —la altura de la silla—
    // para siempre, montado sobre un caballo que ya se había desplomado.
    //
    // Y pasaba cada vez que un caballo moría, que es una de las cosas más
    // comunes del juego: la metralla los voltea de una.
    if (this.monta && !this.monta.vivo) this.desmontar(true);

    // EL QUEBRADO YA NO PELEA. Va antes de elegir blanco porque justamente
    // dejó de tener uno: lo único que le queda adelante es la barranca.
    if (this.quebrado) { this._irse(dt); return; }

    const dist = this._elegirObjetivo(jugador, soldados, dt);

    // EL JINETE SE ACTUALIZA SIEMPRE, haya blanco o no.
    //
    // Esto estaba mal y se veía feo: la salida temprana por «no hay a quién
    // atacar» se comía la rama montada, así que el hombre dejaba de sentarse
    // en la silla mientras el bucle principal seguía moviéndole el caballo. El
    // caballo se iba solo y el jinete quedaba flotando en el aire hasta que
    // apareciera un enemigo y volviera a engancharse de un salto. Pasaba cada
    // vez que el campo quedaba limpio —entre tanda y tanda de realistas, o
    // justo después de que un lanzazo matara al último—, que es exactamente
    // cuando más se nota. El asiento no puede depender de que haya enemigos.
    if (this.montado) {
      this.t += dt;
      if (this.aturdido > 0) this.aturdido -= dt;
      let destino = null;
      if (this.objetivo) {
        const obj = this._d.set(this.objetivo.pos.x, 0, this.objetivo.pos.z);
        this.teVe = this.humo.oclusion(this.pos, this.objetivo.pos) < 0.55 && dist < 95;
        if (this.teVe) this.ultimoVisto.copy(obj);
        destino = this.teVe ? obj : this.ultimoVisto;
      }
      // FORMADO manda sobre todo lo demás. Un escuadrón que rompe la formación
      // porque cada uno vio un enemigo distinto no es un escuadrón: son sesenta
      // tipos a caballo. La columna se rompe cuando la rompe el que la manda.
      if (this.plaza) this._marchar(dt, this.plaza, this.andarColumna);
      else this._cargarALanza(dt, this.objetivo ? dist : Infinity, destino);
      this.fig.actualizar(dt, false);
      return;
    }

    if (!this.objetivo) { this.estado = 'avanzar'; this.fig.actualizar(dt, false); return; }

    const objetivo = new THREE.Vector3(this.objetivo.pos.x, 0, this.objetivo.pos.z);
    const mio = new THREE.Vector3(this.pos.x, 0, this.pos.z);

    const oc = this.humo.oclusion(this.pos, this.objetivo.pos);
    this.teVe = oc < 0.55 && dist < 95;
    if (this.teVe) this.ultimoVisto.copy(objetivo);

    // El que perdió de vista al enemigo camina a donde lo vio por última vez.
    // Pero si llega y no hay nadie, no se queda ahí parado el resto de la
    // batalla: sigue avanzando sobre el objetivo. Sin esto, doscientos hombres
    // terminaban plantados en un pastizal vacío mirando al horizonte.
    const destino = this.teVe ? objetivo : this.ultimoVisto;
    const hacia = new THREE.Vector3().subVectors(destino, mio);
    let distDestino = hacia.length();
    if (!this.teVe && distDestino < 1.5) {
      this.ultimoVisto.copy(objetivo);
      hacia.subVectors(objetivo, mio);
      distDestino = hacia.length();
    }
    if (distDestino > 0.001) hacia.normalize();

    this._girarHacia(Math.atan2(hacia.x, hacia.z) + Math.PI, dt, this.estado === 'correr');

    this.recarga = Math.max(0, this.recarga - dt);
    this.tCubierta = Math.max(0, this.tCubierta - dt);
    this.tDecidir = Math.max(0, this.tDecidir - dt);
    this.tResuello = Math.max(0, this.tResuello - dt);
    this._tLinea -= dt;
    // El que se está yendo se va: le da la espalda al enemigo y corre. Se
    // recompone cuando pone distancia o cuando se le acaba el susto —lo que
    // pase primero—, y si lo alcanzan igual pelea, porque no queda otra.
    if (this.huyendo > 0) {
      this.huyendo -= dt;
      if (dist > HUIDA_SEGURO) this.huyendo = 0;
      else if (dist > ALCANCE_ACERO + 0.5) {
        this.estado = 'huir';
        this._dePie();
        const hay = this.aliento > 8;
        this.aliento = Math.max(0, this.aliento - GASTO_CARRERA * dt);
        const v = hay ? VEL_CARRERA : VEL;
        this.ritmo = hay ? 2.3 : 1;
        this.fig.poner(hay ? 'correr' : 'marcha');
        this._girarHacia(Math.atan2(-hacia.x, -hacia.z) + Math.PI, dt, true);
        this.pos.x -= hacia.x * v * dt;
        this.pos.z -= hacia.z * v * dt;
        this._chocar();
        this.malla.position.y = 0;
        this.andando = true;
        this.fig.actualizar(dt, true, this.ritmo);
        return;
      }
    }
    // SE LE ACABÓ EL SUSTO Y VUELVE A PELEAR.
    //
    // Acá quedaban clavados los granaderos a pie. Al que le voltean el caballo
    // sale corriendo —`desmontar(true)` le pone `huyendo`— y mientras dura eso
    // el estado es 'huir'. Cuando se le pasa, el bloque de arriba deja de
    // correr... y nadie le saca el estado. Y 'huir' NO es un caso del switch de
    // abajo, que además no tiene `default`: el hombre se quedaba parado con el
    // enemigo elegido, el aliento lleno y nada que hacer, para siempre.
    //
    // Medido antes de esto: a los tres minutos, 16 de 23 granaderos a pie
    // congelados en 'huir'. Son justo los lanceros derribados, que es la gente
    // que más falta hace peleando.
    if (this.huyendo <= 0 && this.estado === 'huir') this.estado = 'avanzar';

    // correr cansa y caminar repone. De acá salen los intervalos: cuatro
    // segundos de carrera, cinco de resuello, y otra vez.
    if (this.estado === 'correr') {
      this.aliento = Math.max(0, this.aliento - GASTO_CARRERA * dt);
      if (this.aliento <= 0) { this.estado = 'avanzar'; this.motivo = null; this.cubierta = null; }
    } else {
      this.aliento = Math.min(ALIENTO_TROPA, this.aliento + RECUPERO * dt);
    }
    this.ritmo = 1;
    this.t += dt;
    if (this.tirado > 0) {
      // recién caído del caballo: tirado en el pasto, sin guardia
      this.tirado -= dt;
      this.fig.poner('aturdido');
      this.fig.actualizar(dt, false);
      return;
    }
    let andando = false;

    if (this.aturdido > 0) {
      this.aturdido -= dt;
      this.fig.poner('aturdido');
      this.fig.actualizar(dt, false);
      if (this.aturdido <= 0 && this.estado === 'acero') this._entrarAcero();
      return;
    }

    switch (this.estado) {
      case 'avanzar': {
        this._parar();
        if (dist < ALCANCE_ACERO) { this._entrarAcero(); break; }

        // Fusil descargado y el enemigo encima: no se queda a recargar bajo
        // fuego. Baja el arma y se le va a la carrera con la bayoneta puesta.
        //
        // Pero no automáticamente y no todos juntos. Hacen falta tres cosas:
        // que le quede aliento —correr cansa—, que el enemigo esté dentro de SU
        // distancia de arrojo, que no es la del de al lado, y que le pase el
        // tiempo de decidirse. Un hombre no arranca a correr en el mismo cuadro
        // en que ve al enemigo; duda medio segundo, y cada uno duda distinto.
        // ¿LLEGO A CARGAR ANTES DE QUE ME CAIGA ENCIMA?
        //
        // Antes la puerta era `recarga > 0`: cualquier hombre a medio cargar
        // bajaba el fusil y salía a la bayoneta. Con doce segundos y medio de
        // recarga eso es toda la batalla, así que la infantería realista casi
        // no tiraba: cargaba. Y la carga es lo que mata a la caballería —el
        // 52 % de las bajas de granadero y el 97 % de los desmontes—, o sea
        // que un número pensado para la cadencia de tiro estaba decidiendo el
        // final de la batalla por la puerta de atrás.
        //
        // Ahora la pregunta es de tiempo, que es la que se hace un hombre: lo
        // que me falta para tener tiro contra lo que tarda en llegarme. Si
        // llego a cargar, cargo y le tiro. Si no llego, bayoneta. El que acaba
        // de disparar sale al acero igual que antes; el que está por terminar
        // se queda y descarga.
        const tardaEnLlegar = dist / VEL_CARRERA;
        const monta = this.objetivo.soldado ? this.objetivo.soldado.monta : jugador.monta;
        const jinete = !!(monta && monta.vivo);
        const alcanceCarga = jinete ? CARGA_JINETE : CARGA_BAYONETA * this.arrojo;
        const alcanzable = !jinete || monta.vel < VEL_CARRERA;
        if (this.teVe && this.tResuello <= 0 && alcanzable &&
            this.recarga > tardaEnLlegar && dist < alcanceCarga) {
          if (this.aliento < CARRERA_MINIMA) {
            // sin aire: camina hacia él con la bayoneta puesta, resollando
            this.fig.poner('marcha');
            if (distDestino > 0.6) {
              this.pos.x += hacia.x * VEL * dt;
              this.pos.z += hacia.z * VEL * dt;
              andando = true;
            }
            break;
          }
          if (this.tDecidir <= 0) {
            this.tDecidir = 0.3 + Math.random() * 0.9;
            break;                      // este cuadro todavía no arranca
          }
          this.estado = 'correr'; this.motivo = 'carga'; this.cubierta = null;
          this.sonido.grito();
          break;
        }

        if (this.teVe && dist < ALCANCE_TIRO && this.recarga <= 0) {
          // ¿hay una tapia, un carro, un barril? Nadie descarga parado en
          // medio del campo si tiene dónde apoyarse.
          const cub = this.tResuello > 0 ? null : this._buscarCubierta(objetivo, dist);
          if (cub) {
            this.cubierta = cub; this.estado = 'correr'; this.motivo = 'cubierta';
            break;
          }
          this._encarar(Math.random() < RODILLA_SUELTA);
          break;
        }

        this.fig.poner('marcha');
        if (distDestino > 0.6) {
          this.pos.x += hacia.x * VEL * dt;
          this.pos.z += hacia.z * VEL * dt;
          andando = true;
        }
        break;
      }

      // A la carrera. Dos motivos y dos finales distintos: el que va al
      // parapeto llega y se hinca; el que va a la bayoneta llega y ensarta.
      case 'correr': {
        this._dePie();
        // EL BAYONETAZO DE LA CARGA.
        //
        // El que viene corriendo con la bayoneta puesta no frena, se planta y
        // recién entonces tira la estocada: el golpe lo pone el impulso. Con
        // llegar alcanza. Después sí se cruza el acero y empieza el duelo
        // normal, con su aviso y su ventana de parada —pero el primer golpe de
        // una carga no se avisa, porque una carga no se avisa.
        if (this.motivo === 'carga' && dist < CARGA_TOQUE) {
          if (this.alGolpear) this.alGolpear(this, this.objetivo);
          this.fig.poner('estocada');
          this._entrarAcero();
          this._pego = true;          // no repite el golpe al entrar en guardia
          break;
        }
        if (dist < ALCANCE_ACERO) { this._entrarAcero(); break; }
        this.fig.poner('correr');
        let bx, bz;
        if (this.motivo === 'cubierta' && this.cubierta) { bx = this.cubierta.x; bz = this.cubierta.z; }
        else { bx = destino.x; bz = destino.z; }
        const dx = bx - this.pos.x, dz = bz - this.pos.z;
        const d = Math.hypot(dx, dz);
        this._girarHacia(Math.atan2(dx / (d || 1), dz / (d || 1)) + Math.PI, dt, true);
        if (d > (this.motivo === 'cubierta' ? CUBIERTA_LLEGADA : 0.6)) {
          this.pos.x += (dx / (d || 1)) * VEL_CARRERA * dt;
          this.pos.z += (dz / (d || 1)) * VEL_CARRERA * dt;
          andando = true;
          this.ritmo = 2.3;
        } else if (this.motivo === 'cubierta') {
          // llegó al parapeto: rodilla en tierra y a apuntar por encima
          this._girarHacia(Math.atan2(hacia.x, hacia.z) + Math.PI, dt, false);
          this._encarar(true);
        } else {
          this.estado = 'avanzar';
        }
        // si mientras corre se le acabó el motivo, vuelve a la marcha
        if (this.motivo === 'cubierta' && this.recarga > 0) { this.estado = 'avanzar'; this.cubierta = null; }
        break;
      }
      case 'apuntar': {
        // encima tuyo no se queda encarando: baja el fusil y cruza el acero
        if (dist < ALCANCE_ACERO) { this._entrarAcero(); break; }
        this.fig.poner('apuntar');
        // ENCARADO Y CON LA LÍNEA LIBRE, o no hay tiro.
        //
        // Si el blanco le quedó al costado, primero gira —y girar lleva
        // tiempo—. Si tiene un compañero en el medio, aguanta: nadie le tira
        // por la espalda al de adelante. Mientras espera sigue encarando, así
        // que se ve un hombre con el fusil al hombro esperando el hueco, que es
        // exactamente lo que hacía la segunda fila.
        if (!this.encarado || !this._lineaLibre()) {
          this.t = Math.min(this.t, 0.4);
          // TAPADO HACE RATO: BAJA EL ARMA Y SIGUE.
          //
          // Ésta es la regla que faltaba. Un hombre sin línea de tiro no se
          // queda apuntándole a la nuca del de adelante hasta que se acabe la
          // batalla: baja el fusil y avanza. Y al avanzar se corre, y al
          // correrse le abre el tiro a otro y se lo consigue a sí mismo unos
          // metros más allá.
          //
          // Eso es lo que releva las filas. No hace falta que nadie las mande:
          // el que puede tirar tira, el que no puede camina, y la línea se
          // renueva sola. Sin esto, ciento sesenta y tres de doscientos
          // cincuenta pasaban la batalla entera de estatua.
          this.tTapado += dt;
          if (this.tTapado > ESPERA_HUECO) {
            this.tTapado = 0;
            this._dePie();
            this.estado = 'avanzar';
            this.fig.poner('marcha');
          }
          break;
        }
        this.tTapado = 0;
        // de rodillas apunta más despacio y con más cuidado
        if (this.t > (this.rodilla ? 1.9 : 1.5)) {
          // Y UNA ÚLTIMA MIRADA ANTES DE APRETAR, ésta sin caché.
          //
          // Cuatro veces por segundo alcanza para sondear mientras encara,
          // pero NO para el instante del tiro: en un cuarto de segundo un
          // jinete al galope recorre más de un metro y el pasillo mide setenta
          // y cinco centímetros, así que la respuesta guardada puede ser de un
          // mundo que ya no existe. Acá se mira de nuevo, y no cuesta nada
          // porque un hombre aprieta el gatillo una vez cada doce segundos.
          if (!this._mirarLinea()) {
            this._tLinea = 0;
            this._linea = false;
            this.t = Math.min(this.t, 0.4);
            break;
          }
          this._descargar();
          this.estado = 'recargar';
          this.recarga = RECARGA;
          this.t = 0;
        }
        break;
      }
      case 'recargar': {
        this.fig.poner('recargar');
        if (dist < ALCANCE_ACERO) { this._entrarAcero(); break; }
        // se recarga donde se disparó: si se hincó, sigue hincado
        if (this.t > 2.5) { this._parar(); this.estado = 'avanzar'; this.fig.poner('marcha'); }
        break;
      }
      case 'acero': {
        if (dist > ALCANCE_ACERO + 0.7) {
          this.estado = 'avanzar';
          this.avisando = false;
          this.fig.poner('marcha');
          // EL QUE SE SUELTA DEL ACERO RESUELLA ANTES DE VOLVER A SALIR.
          //
          // Sin esto la decisión se re-tomaba cada cuadro y salía este bucle,
          // medido cuadro a cuadro sobre los que peor se veían:
          //
          //   avanzar → correr:carga → acero → avanzar → correr:carga → acero…
          //
          // Cruza el umbral, carga, lo alcanza, el otro se le corre medio
          // metro, vuelve a avanzar, vuelve a cargar. Ocho segundos, diecinueve
          // metros recorridos y CERO de avance: desde afuera es un hombre
          // temblando en el lugar.
          //
          // Un segundo y medio de resuello alcanza, y además es lo que hace
          // alguien que acaba de cruzar el acero: no vuelve a arrancar al
          // sprint en el mismo paso. Mientras tanto marcha, que es avanzar.
          this.tResuello = 1.5 + Math.random() * 1.1;
          break;
        }
        this._acero(dt);
        break;
      }
    }

    // El que tiene puesto no lo abandona. Un artillero que sale corriendo a
    // dar bayonetazos deja la pieza muda, y la pieza vale más que él.
    if (this.puesto) {
      const dx = this.pos.x - this.puesto.x, dz = this.pos.z - this.puesto.z;
      const d = Math.hypot(dx, dz);
      if (d > this.correa) {
        this.pos.x = this.puesto.x + (dx / d) * this.correa;
        this.pos.z = this.puesto.z + (dz / d) * this.correa;
      }
    }

    this._chocar();
    // Un hombre a pie está en el piso. Siempre. No hay salto, no hay barranca
    // que lo levante: si su y no es cero es que algo se rompió, y más vale que
    // camine mal a que quede flotando. La red debajo del arreglo de arriba.
    this.malla.position.y = 0;
    this.andando = andando;
    this.fig.actualizar(dt, andando, this.ritmo);
  }

  // Contra el decorado. Igual que el jugador y que el caballo: se lo saca de
  // la caja por la cara más cercana y sigue caminando pegado a la pared. Sólo
  // cuentan las cajas que le llegan por arriba de la rodilla —un cordón de 30
  // cm no es un obstáculo para un hombre, es un escalón.
  _chocar () {
    if (!this.colisiones) return;
    for (const caja of this.colisiones) {
      if (caja.max.y < 0.35) continue;
      const e = sacarDeCaja(this.pos, RADIO_HOMBRE, caja, this._n);
      if (e <= 0) continue;

      // Y DESLIZA. Sin esto un hombre que camina de frente contra una tapia se
      // queda apretado contra ella para siempre: la IA le vuelve a apuntar al
      // mismo destino cuadro tras cuadro y no tiene con qué rodearla. Lo que
      // se le empujó para atrás se le devuelve de costado.
      //
      // Y el costado se elige POR LA TAPIA, no por hacia dónde mira. El primer
      // intento usaba el rumbo del hombre y temblaba: al correrse un centímetro
      // el rumbo giraba, el costado se daba vuelta y volvía al punto de
      // partida. Se pasó cinco segundos vibrando contra el mismo ladrillo.
      //
      // Ahora rodea por la punta que tiene más cerca, que además es lo que
      // haría cualquiera. Es una decisión estable —la punta más cercana no
      // cambia porque él se corra— y de yapa reparte a la tropa: los de la
      // izquierda salen por izquierda y los de la derecha por derecha.
      let tx, tz;
      if (Math.abs(this._n.z) > Math.abs(this._n.x)) {
        tx = (caja.max.x - this.pos.x) < (this.pos.x - caja.min.x) ? 1 : -1;
        tz = 0;
      } else {
        tx = 0;
        tz = (caja.max.z - this.pos.z) < (this.pos.z - caja.min.z) ? 1 : -1;
      }
      this.pos.x += tx * e * 0.9;
      this.pos.z += tz * e * 0.9;
    }
  }

  // ---------------------------------------------------------- ir formado
  //
  // No es cargar: es MARCHAR A UN PUNTO. La diferencia está en el andar, que no
  // sale de la distancia al enemigo sino de la distancia a su propio lugar en
  // la columna. El piso lo pone el que va adelante —si el jefe galopa, todos
  // galopan, aunque estén en su sitio— y el que se quedó atrás aprieta un
  // escalón hasta alcanzar. Con eso la columna se estira y se junta como se
  // estira y se junta una de verdad, sin que nadie tenga que coreografiarla.
  _marchar (dt, destino, andarBase) {
    const c = this.monta;
    const dx = destino.x - c.pos.x, dz = destino.z - c.pos.z;
    const d = Math.hypot(dx, dz);
    const mando = {};
    if (d > 0.8) mando.hacia = Math.atan2(dx, dz) + Math.PI;

    const rezagado = d > 15 ? 1 : 0;
    c.andar = Math.min(3, Math.max(0, andarBase) + rezagado);
    if (d < 1.1 && andarBase <= 0) c.andar = 0;

    this.estado = 'formado';
    this.avisando = false;
    this.fig.poner('lanzaAlto');
    if (c.puedeSaltar && c.obstaculoAdelante(c.vel * 0.55 + 2.5)) mando.saltar = true;
    c.actualizar(dt, mando);
    c.actualizado = true;
    this._sentar();
    if (!c.vivo) this.desmontar(true);
  }

  // ------------------------------------------------------- la carga a lanza
  //
  // Tres tiempos, y el jugador los lee por la DISTANCIA, no por un reloj:
  //   lejos      → asta vertical, viene al galope
  //   15 m       → baja el asta en ristre: ya te eligió
  //   5,4 m      → la echa atrás: EL AVISO, la ventana para pararla
  //   3,6 m      → el lanzazo, y sigue de largo
  // Después se abre, vuelve grupas al TROTE —porque al galope no dobla— y
  // encara de nuevo. Es una pasada de caballería, no un forcejeo.
  _cargarALanza (dt, dist, destino) {
    const c = this.monta;
    this.tPasada = Math.max(0, this.tPasada - dt);
    const mando = {};

    if (!destino) {
      // Nadie a quien cargar: baja el asta al hombro y afloja hasta el paso.
      // Lo importante no es la pose, es que este camino TAMBIÉN termina
      // moviendo el caballo y sentando al jinete encima.
      this.estado = 'esperar';
      c.andar = Math.max(0, Math.min(c.andar, 1));
      this.avisando = false;
      this.fig.poner('lanzaAlto');
      if (c.puedeSaltar && c.obstaculoAdelante(c.vel * 0.55 + 2.5)) mando.saltar = true;
      c.actualizar(dt, mando);
      c.actualizado = true;
      this._sentar();
      if (!c.vivo) this.desmontar(true);
      return;
    }

    const rumboA = Math.atan2(destino.x - c.pos.x, destino.z - c.pos.z) + Math.PI;

    if (this.estado === 'esperar') { this.estado = 'cargar'; this._pego = false; this._grito = false; }

    if (this.estado === 'pasada') {
      c.andar = 3;                       // seguir de largo, despegarse
      this.fig.poner('lanzaAlto');
      if (this.tPasada <= 0) { this.estado = 'volver'; }
    } else if (this.estado === 'volver') {
      c.andar = 2;                       // al trote dobla en 2,7 m; al galope, en 16
      mando.hacia = rumboA;
      this.fig.poner('lanzaAlto');
      let dif = rumboA - c.rumbo;
      dif = Math.atan2(Math.sin(dif), Math.cos(dif));
      if (Math.abs(dif) < 0.30) { this.estado = 'cargar'; this._pego = false; this._grito = false; }
    } else {
      this.estado = 'cargar';
      mando.hacia = rumboA;
      c.andar = dist > 8 ? 3 : 2;
      this.avisando = false;
      if (dist > LANZA_ENRISTRE) this.fig.poner('lanzaAlto');
      else if (dist > LANZA_AVISO) this.fig.poner('enristre');
      else if (dist > LANZA_ALCANCE) {
        this.fig.poner('lanzaAviso');
        this.avisando = true;
        if (!this._grito) { this._grito = true; this.sonido.grito(); }
      } else {
        this.fig.poner('lanzazo');
        // ¿le pasa por delante o por el costado? El asta sale por la nariz del
        // caballo; lo que quede fuera de ese cono, no lo toca.
        let ang = rumboA - c.rumbo;
        ang = Math.atan2(Math.sin(ang), Math.cos(ang));
        if (!this._pego && this.aturdido <= 0 && Math.abs(ang) < LANZA_CONO) {
          this._pego = true;
          if (this.alGolpear) this.alGolpear(this, this.objetivo);
        }
        this.estado = 'pasada';
        this.tPasada = PASADA;
        this.pasadas++;
      }
    }

    // batir a tiempo: la tapia se salta, no se choca
    if (c.puedeSaltar && c.obstaculoAdelante(c.vel * 0.55 + 2.5)) mando.saltar = true;
    c.actualizar(dt, mando);
    c.actualizado = true;     // que el bucle principal no lo pise
    this._sentar();
    if (!c.vivo) this.desmontar(true);
  }

  // ponerse de pie, sin más
  _dePie () {
    if (this.rodilla) { this.rodilla = false; this.fig.rodilla = false; }
  }

  // ponerse de pie Y soltar el parapeto. OJO: no llamar a esto desde 'correr',
  // que ahí el destino todavía hace falta —borrarlo dejaba al soldado
  // corriendo al enemigo en vez de a la tapia.
  _parar () {
    this._dePie();
    this.cubierta = null;
    this.motivo = null;
  }

  // encarar el fusil, de pie o con la rodilla en tierra
  _encarar (deRodillas) {
    this.estado = 'apuntar';
    this.t = 0;
    this.rodilla = !!deRodillas;
    this.fig.rodilla = this.rodilla;
    this.fig.poner('apuntar');
    this.sonido.grito();
  }

  // El parapeto más conveniente: cerca mío, no encima del enemigo, y que no me
  // haga retroceder. Se busca cada segundo y medio, no cada cuadro.
  _buscarCubierta (objetivo, dist) {
    if (!this.cubiertas || !this.cubiertas.length) return null;
    if (this.tCubierta > 0) return null;
    this.tCubierta = 1.5;
    let mejor = null, mejorPunto = null, mejorPuntaje = Infinity;
    for (const c of this.cubiertas) {
      const dMio = Math.hypot(c.x - this.pos.x, c.z - this.pos.z);
      if (dMio > CUBIERTA_BUSCAR || dMio < 1.2) continue;
      const dEnemigo = Math.hypot(c.x - objetivo.x, c.z - objetivo.z);
      if (dEnemigo < CUBIERTA_MINIMA) continue;
      // el puesto va del lado del parapeto que da la espalda al enemigo
      const nx = (c.x - objetivo.x) / (dEnemigo || 1);
      const nz = (c.z - objetivo.z) / (dEnemigo || 1);
      const px = c.x + nx * (c.r + 0.45);
      const pz = c.z + nz * (c.r + 0.45);
      // caminar hacia atrás para taparse no sirve: se penaliza alejarse
      const acerca = Math.hypot(px - objetivo.x, pz - objetivo.z) - dist;
      const puntaje = Math.hypot(px - this.pos.x, pz - this.pos.z) + Math.max(0, acerca) * 1.4;
      if (puntaje < mejorPuntaje) { mejorPuntaje = puntaje; mejor = c; mejorPunto = { x: px, z: pz }; }
    }
    return mejor ? mejorPunto : null;
  }

  // EL RUMBO NO ES INSTANTÁNEO. Antes el hombre se daba vuelta en un cuadro,
  // apuntara a donde apuntara, y eso era media la sensación de robot. Ahora gira
  // a velocidad de hombre, y hasta que no está encarado no tiene tiro.
  _girarHacia (rumboA, dt, rapido) {
    let giro = rumboA - this.malla.rotation.y;
    giro = Math.atan2(Math.sin(giro), Math.cos(giro));
    const paso = GIRO_TROPA * (rapido ? 1.5 : 1) * dt;
    this.malla.rotation.y += Math.max(-paso, Math.min(paso, giro));
    this.encarado = Math.abs(giro) < CONO_TIRO;
    return this.encarado;
  }

  // ¿HAY ALGUIEN ADELANTE? Se miran unos puntos sobre la línea de tiro dentro de
  // los primeros nueve metros, que es donde estaría la propia fila. Si hay un
  // compañero ahí, no dispara. Es lo que convierte un bloque en una línea.
  _lineaLibre () {
    // Con caché. Se consulta mientras encara, o sea unas cien veces por
    // disparo, y la fila de adelante no se corre cien veces por segundo:
    // mirarlo cuatro veces por segundo da lo mismo y cuesta veinticinco veces
    // menos. Medido, sin esto la simulación de 370 hombres pasaba de 1,5 ms a
    // 11,6 —de un cuadro de dieciséis—.
    if (this._tLinea > 0) return this._linea;
    this._tLinea = 0.25;
    this._linea = this._mirarLinea();
    return this._linea;
  }

  _mirarLinea () {
    const r = Soldado.vecinos;
    if (!r || !this.objetivo) return true;
    const dx = this.objetivo.pos.x - this.pos.x, dz = this.objetivo.pos.z - this.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 2.5) return true;
    const ux = dx / d, uz = dz / d;
    const hasta = Math.min(PASILLO_LARGO, d - 1.4);
    for (let m = 2; m <= hasta; m += 3.2) {
      const px = this.pos.x + ux * m, pz = this.pos.z + uz * m;
      let libre = true;
      r.cerca(px, pz, o => {
        if (!libre || o === this || !o.vivo || o.bando !== this.bando) return;
        // EL QUE SE HINCA NO TAPA. Para eso se hinca la primera fila: para
        // que la segunda tire por encima. Sin esta línea el bloque entero se
        // vetaba a sí mismo —medido: veinte mil vetos contra doscientos
        // noventa tiros en una batalla— y doscientas cincuenta bocas de fuego
        // se pasaban la tarde haciendo cola con el arma al hombro.
        if (o.rodilla && !this.rodilla) return;
        if (Math.hypot(o.pos.x - px, o.pos.z - pz) < PASILLO) libre = false;
      });
      if (!libre) return false;
    }
    return true;
  }

  _entrarAcero () {
    this._parar();
    this.estado = 'acero';
    this.t = 0;
    this.tAcero = 0;
    this.avisando = false;
    this._pego = false;
    this._grito = false;
    this.fig.poner('guardia');
  }

  // Guardia → aviso → estocada → vuelta a la guardia. El aviso es visible
  // (echa el cuerpo atrás y retrae el fusil) y audible: el jugador tiene
  // medio segundo largo para decidir.
  _acero (dt) {
    this.tAcero += dt;
    const t = this.tAcero;

    if (t < ACERO_GUARDIA) {
      this.fig.poner('guardia');
      this.avisando = false;
      return;
    }
    if (t < ACERO_GUARDIA + ACERO_AVISO) {
      this.fig.poner('cargar');
      if (!this.avisando) {
        this.avisando = true;
        if (!this._grito) { this._grito = true; this.sonido.grito(); }
      }
      return;
    }
    if (t < ACERO_GUARDIA + ACERO_AVISO + ACERO_SALIDA) {
      this.fig.poner('estocada');
      this.avisando = false;
      if (!this._pego) {
        this._pego = true;
        if (this.alGolpear) this.alGolpear(this, this.objetivo);
      }
      return;
    }
    this.fig.poner('guardia');
    if (t > ACERO_GUARDIA + ACERO_AVISO + ACERO_SALIDA + ACERO_VUELTA) {
      this.tAcero = 0;
      this._pego = false;
      this._grito = false;
    }
  }

  // TIRAR. Devuelve dónde pasó la bala respecto del blanco, en metros, y si
  // acertó. Una sola regla para el tiro contra el jugador y contra la tropa:
  // antes eran dos cuentas distintas y ninguna tenía bala.
  apuntarA (dist, oclusion, anchoBlanco) {
    return tirar(dist, oclusion, anchoBlanco, this.rodilla);
  }

  _descargar () {
    const origen = new THREE.Vector3(this.pos.x, this.pos.y + (this.rodilla ? 1.02 : 1.38), this.pos.z);
    const dir = new THREE.Vector3().subVectors(this.objetivo.pos, origen).normalize();
    // DE DÓNDE SALIÓ, para que el sonido sepa qué está lejos. Sin esto los
    // doscientos cincuenta fusiles suenan todos adentro de tu oreja.
    this.sonido.disparo(origen);
    this.humo.soltar(origen.clone().addScaledVector(dir, 0.9), dir,
      { cantidad: 12, vida: 10, empuje: 2.0, radio: 0.28, opacidad: 0.4, claro: 0.45 });
    if (this.alDisparar) this.alDisparar(this, origen, dir, this.objetivo);
  }

  quitar () {
    this.escena.remove(this.malla);
    if (this.monta) { this.monta.quitar(); this.monta = null; }
  }
}

// EL CENSO. Quién tiene a quién encima, contado una vez por cuadro con los
// objetivos del cuadro anterior. Usar los del anterior lo hace estable: si se
// contara sobre la marcha, los primeros de la lista no verían saturación
// ninguna y los últimos la verían entera, o sea que el orden del array sería
// una ventaja táctica.
// La rejilla del cuadro anterior, para preguntar quién está en la línea de tiro
// sin recorrer a todo el ejército. La llena main junto con la separación.
Soldado.vecinos = null;

Soldado.acoso = new Map();
// Los puntos de embarque, que los pone la batalla. Vacío = se rajan derecho.
Soldado.botes = [];
// Y NO SE BORRA: SE ARRASTRA.
//
// Borrar y recontar de cero cada cuadro hacía un péndulo perfecto. Si todos
// apuntan a X, acoso[X] vale doscientos y acoso[Y] vale cero; al cuadro
// siguiente conviene Y, todos saltan, y se invierte. La amplitud del salto es
// N × SATURACION —cientos de metros de puntaje—, así que ninguna terquedad
// razonable lo aguanta.
//
// Medido antes de esto: 300 cambios de blanco en 300 cuadros por hombre y 43
// cambios de sentido de giro por segundo, en los 252 realistas a la vez. Desde
// afuera es un ejército temblando en el lugar.
//
// Con inercia la cuenta tarda una décima en moverse, que es lo que hace que la
// saturación siga sirviendo —el que tiene diez encima sigue valiendo menos—
// sin poder saltar de doscientos a cero entre dos cuadros.
const INERCIA = 0.92;

Soldado.censar = function (soldados) {
  const ahora = new Map();
  for (const s of soldados) {
    if (!s.vivo || !s.objetivo) continue;
    const k = s.objetivo.soldado || 'jugador';
    ahora.set(k, (ahora.get(k) || 0) + 1);
  }
  const m = Soldado.acoso;
  for (const k of m.keys()) if (!ahora.has(k)) ahora.set(k, 0);
  for (const [k, v] of ahora) {
    const q = (m.get(k) || 0) * INERCIA + v * (1 - INERCIA);
    if (q < 0.02) m.delete(k); else m.set(k, q);
  }
};

// Un número por hombre, y nunca se repite. Sirve para que la separación
// resuelva cada par UNA vez y para que el desempate sea siempre igual: dos
// hombres exactamente encima se abren siempre para el mismo lado en vez de
// temblar.
Soldado.proximoOrden = 0;
