import * as THREE from 'three';
// el daño no se inventa acá: sale de la tabla
import { CULATAZO, BAYONETAZO } from './balance.js';

// Armas de fuego de chispa: tercerola de granadero, fusil de infantería con
// bayoneta (el que se le saca al realista) y pistolón de arzón.
// Las tres comparten la misma máquina de carga de siete pasos, que es
// interrumpible y persistente: cada arma se acuerda de dónde quedó.

// LOS CUATRO TIEMPOS.
//
// Eran siete y ahora son cuatro, y no es que se hayan tirado tres a la basura:
// se juntaron los que son un solo movimiento de la mano. Sacar el cartucho,
// morderlo y verter la pólvora es UN gesto —se saca, se muerde y se vuelca, sin
// soltar nada en el medio— y meter la bala y atacarla con la baqueta también.
//
// Lo que se conservó es lo que hay que conservar: los TRES tiempos que se
// marcan a mano —morder, baqueta y amartillar— y el cebado de la cazoleta, que
// es el paso propio del arma de chispa y el que se cobra cuando hay fogonazo
// sin tiro. Con siete pasos y tres marcas, la mitad de la carga era mirar. Con
// cuatro y tres, casi cada paso pide algo.
//
// Y son más cortos: de 7,70 s de reglamento a 3,45. Un granadero de 1813
// tardaba veinte segundos y hacía tres disparos por minuto; esto ya era una
// concesión al que juega, y ahora es una concesión un poco más grande.
export const PASOS = {
  // Los cuatro tiempos suman TRES SEGUNDOS justos con cargaMult en 1, que es la
  // tercerola. La proporción entre ellos es la de antes —la baqueta sigue
  // siendo el tiempo largo y el amartillar el corto—; lo que se acortó es el
  // ciclo entero. Y las ventanas del ritmo salen de estas duraciones, así que
  // se achican solas y no hay nada más que tocar.
  morder:     { nombre: 'Morder y verter',        dur: 0.70, golpe: true },
  cebar:      { nombre: 'Cebar la cazoleta',      dur: 0.78, golpe: false },
  baqueta:    { nombre: 'Bala y baqueta',         dur: 1.04, golpe: true },
  amartillar: { nombre: 'Amartillar',             dur: 0.48, golpe: true }
};

export const SECUENCIA = ['morder', 'cebar', 'baqueta', 'amartillar'];

// Lo que tarda el arma en empezar a recargarse sola después del tiro: lo que
// dura el retroceso, para que el disparo se lea antes de que la mano vuelva.
const AUTO_CARGA = 0.5;

const PENAL = 0.9;
const RETARDO = 0.09;
const P_FOGONAZO = 0.04;
const P_CHISPA = 0.03;

export const ARMAS = {
  tercerola: {
    nombre: 'Tercerola', escala: 0.6, cargaMult: 1.0,
    conoCadera: 3.0, conoApuntado: 0.8,
    golpe: { nombre: 'Culatazo', alcance: 2.0, dano: CULATAZO, dur: 0.42 },
    largo: true
  },
  fusil: {
    nombre: 'Fusil con bayoneta', escala: 0.58, cargaMult: 1.18,
    conoCadera: 2.4, conoApuntado: 0.6,
    golpe: { nombre: 'Bayonetazo', alcance: 3.0, dano: BAYONETAZO, dur: 0.5 },
    largo: true
  },
  pistolon: {
    nombre: 'Pistolón de arzón', escala: 0.68, cargaMult: 0.67,
    conoCadera: 5.0, conoApuntado: 2.2,
    golpe: { nombre: 'Culatazo', alcance: 1.5, dano: CULATAZO, dur: 0.38 },
    largo: false
  },

  // FUERA DE ÉPOCA, Y A PROPÓSITO.
  //
  // Una Remington de bloque basculante es de 1860 y pico: San Martín llevaba
  // medio siglo muerto. No entra en la batalla ni va a entrar. Está para
  // probar el campo sin pelearse con la baqueta —recorrer, ver de dónde sale
  // el fuego, medir distancias— y por eso el HUD la nombra con el año: para
  // que nadie la confunda con el juego.
  //
  // Cartucho metálico, así que la carga no son cuatro tiempos sino uno: el
  // mismo mecanismo con cargaMult casi en cero da el ciclo entero en poco más
  // de medio segundo.
  remington: {
    nombre: 'Remington · 1860, fuera de época', escala: 0.58, cargaMult: 0.16,
    conoCadera: 1.6, conoApuntado: 0.28,
    golpe: { nombre: 'Culatazo', alcance: 2.0, dano: CULATAZO, dur: 0.4 },
    largo: true
  }
};

// Cacha de nogal con embutido de plata: el dibujo de volutas del original.

// los fierros se arman en su propio archivo
import { CONSTRUCTORES, posesPara, mat, brazosSueltos } from './armas-modelos.js';

export class ArmaFuego {
  constructor (tipo, camaraArma, camaraMundo, sonido, humo) {
    this.tipo = tipo;
    this.cfg = ARMAS[tipo];
    this.camara = camaraArma;
    this.camaraMundo = camaraMundo;
    this.sonido = sonido;
    this.humo = humo;

    this.polvora = false;
    this.bala = false;
    this.cebado = false;
    this.amartillada = false;

    this.secuencia = SECUENCIA.slice();
    this.paso = 0;
    this.autoCarga = 0;        // > 0: está por ponerse a cargar sola
    this.alPedirCarga = null;  // el arsenal dice si queda cartucho
    this.tPaso = 0;
    this.penal = 0;
    this.marcado = null;
    this.cargando = false;
    this.guardada = true;

    this.tiros = 0;        // sólo para llevar la cuenta
    this.apuntando = false;
    this.esperaTiro = -1;
    this.presion = 0;
    this.penalPostura = 1;      // agachado carga más lento, tirado no se puede
    // LA CARGA SOLA. A caballo y con el sable en la mano el arma se carga
    // sin vos: no hay manera de llevar las riendas, el corvo y la baqueta a la
    // vez, y pedirte la R justo ahí era pedirte que soltaras lo que estabas
    // haciendo. A pie y con el arma en la mano sigue siendo tuya, con su ritmo
    // y su castigo, que es donde el minijuego vale.
    //
    // No sale gratis: penalCargaMontado la hace 3,4 veces más lenta al galope,
    // así que cargar arriba del caballo es aflojar el andar. Diez segundos
    // tendido a galope contra tres al paso.
    this.sola = false;

    this.tGolpe = -1;
    this.golpeAplicado = false;

    this.retroceso = 0;
    this.temblor = 0;

    this.alDisparar = null;
    this.alGolpear = null;
    this.alAviso = null;

    const p = CONSTRUCTORES[tipo]();
    Object.assign(this, p);
    this.grupo = p.g;
    this.poses = posesPara(tipo, p, this.cfg.escala);
    this.manoIzqBase = p.manoIzq.position.clone();

    this.cartucho = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.04, 6), mat(0xd8cdb4, 0.95));
    this.cartucho.rotation.z = Math.PI / 2;
    this.cartucho.visible = false;
    this.grupo.add(this.cartucho);

    this.grupo.scale.setScalar(this.cfg.escala);
    this.grupo.position.copy(this.poses.reposo.p);
    this.grupo.rotation.copy(this.poses.reposo.r);
    this.grupo.visible = false;
    this.grupo.traverse(o => { o.frustumCulled = false; });
    camaraArma.add(this.grupo);

    // LOS BRAZOS VAN APARTE, no colgados del arma. El motivo está escrito en
    // armas-modelos.js: un brazo une la muñeca —que viaja con el arma— con el
    // hombro, que se queda donde está, y un antebrazo de largo fijo colgado
    // del arma no puede hacer las dos cosas. Se estiran cada cuadro.
    this.brazos = brazosSueltos(p.manoDer, p.manoIzq);
    for (const b of this.brazos) {
      b.visible = false;
      b.traverse(o => { o.frustumCulled = false; });
      camaraArma.add(b);
    }
    this._mano = new THREE.Vector3();
  }

  // Cada brazo, del puño al hombro. Hace falta refrescar la matriz del arma:
  // si no, el brazo va un cuadro atrás de la mano y en pleno culatazo se ve
  // despegado, que es la mitad del problema que esto vino a arreglar.
  _acomodarBrazos () {
    if (!this.brazos.length) return;
    this.grupo.updateWorldMatrix(true, false);
    for (const b of this.brazos) {
      // la muñeca de la mano izquierda se mueve durante la carga: se lee del
      // objeto y no de la copia que se guardó al nacer
      const m = b.userData.muneca;
      this._mano.copy(m).applyMatrix4(this.grupo.matrixWorld);
      b.position.copy(this._mano);
      b.lookAt(b.userData.hombro);
      b.scale.z = Math.max(0.2, this._mano.distanceTo(b.userData.hombro));
    }
  }

  // ---------- estado ----------
  get cargada () { return this.polvora && this.bala; }
  get lista () { return this.cargada && this.cebado && this.amartillada; }
  get pasoActual () { return this.secuencia[this.paso]; }
  get aMedias () { return this.paso > 0 && this.paso < this.secuencia.length; }
  get nombre () { return this.cfg.nombre; }

  get etiquetaEstado () {
    if (this.lista) return 'lista';
    if (this.cargada && this.cebado) return 'sin amartillar';
    if (this.cargada) return 'sin cebar';
    if (this.aMedias) return 'a medio cargar';
    return 'descargada';
  }

  sacar () {
    this.guardada = false; this.grupo.visible = true;
    for (const b of this.brazos) b.visible = true;
  }
  guardar () {
    this.guardada = true; this.grupo.visible = false; this.cargando = false; this.tGolpe = -1;
    for (const b of this.brazos) b.visible = false;
  }

  _duracion (id) {
    // CON LA CARGA SOLA EL ANDAR NO LA FRENA. penalCargaMontado multiplica por
    // 3,4 al galope, y eso convertía los tres segundos en diez: el número que
    // se pidió dejaba de ser el número que pasa. El penal sigue entero para la
    // carga a mano, que es donde significa algo —ahí estás vos con la baqueta
    // arriba de un caballo al trote— pero la que se hace sola no la frena:
    // pediste tres segundos y son tres, montado o no.
    //
    // El mínimo es contra 1 y no contra el penal a secas: agachado se carga
    // MÁS rápido y eso se conserva, y tirado sigue sin poder —de eso se ocupa
    // la puerta de arriba, que mira penalPostura en crudo—.
    const postura = this.sola ? Math.min(1, this.penalPostura) : this.penalPostura;
    return PASOS[id].dur * this.cfg.cargaMult * postura;
  }

  _ventana (id) {
    const d = this._duracion(id) + this.penal;
    const ancho = d * 0.26 * (1 - this.presion * 0.45);
    const inicio = d * 0.54;
    return [inicio, inicio + ancho];
  }

  // ---------- carga ----------
  iniciarCarga () {
    if (this.guardada || this.tGolpe >= 0) return;
    // EL ARMA LLENA NO SE VUELVE A CARGAR. Esta pregunta estaba metida adentro
    // del `if` de abajo, y como la partida arranca con la tercerola cargada y
    // el paso en cero, la condición no se cumplía nunca: tocabas R con las dos
    // armas listas y te ponías a morder un cartucho arriba de una carga entera,
    // que además gastaba el cartucho.
    if (this.lista) { this._aviso('El arma ya está lista', 'bien'); return; }
    if (this.penalPostura <= 0) { this._aviso('No se puede cargar cuerpo a tierra', 'malo'); return; }
    // Con nada empezado —o con la secuencia terminada— se arma la secuencia que
    // corresponde al estado REAL del arma: al que le falta amartillar se le
    // pide amartillar y nada más, no los cuatro tiempos de nuevo.
    if (this.paso === 0 || this.paso >= this.secuencia.length) this._nuevaSecuencia();
    this.cargando = true;
  }

  soltarCarga () { this.cargando = false; }

  // `R` no se mantiene apretada: una vez arranca, otra vez pausa. La carga
  // sigue sola mientras caminás y se interrumpe si cambiás de arma, saltás o
  // das un puntazo — pero nunca se borra: el paso queda donde estaba.
  alternarCarga () {
    if (this.cargando) { this.cargando = false; this._aviso('Carga en pausa', 'bien'); return false; }
    this.iniciarCarga();
    return this.cargando;
  }

  // deja el arma descargada del todo, como si el dueño acabara de tirar
  dejarDescargada () {
    this.polvora = false;
    this.bala = false;
    this.cebado = false;
    this.amartillada = false;
    this.cargando = false;
    this.secuencia = SECUENCIA.slice();
    this.paso = 0; this.tPaso = 0; this.penal = 0; this.marcado = null;
  }

  // el arma arranca la partida lista para tirar
  cargarDeUnaVez () {
    this.polvora = true;
    this.bala = true;
    this.cebado = true;
    this.amartillada = true;
    this.cargando = false;
    this.secuencia = SECUENCIA.slice();
    this.paso = 0; this.tPaso = 0; this.penal = 0; this.marcado = null;
  }

  _nuevaSecuencia () {
    if (this.cargada && this.cebado && !this.amartillada) this.secuencia = ['amartillar'];
    else if (this.cargada && !this.cebado) this.secuencia = ['cebar', 'amartillar'];
    else this.secuencia = SECUENCIA.slice();
    this.paso = 0; this.tPaso = 0; this.penal = 0; this.marcado = null;
  }

  // el golpe de tiempo: click izquierdo mientras se carga
  golpe () {
    if (!this.cargando || this.paso >= this.secuencia.length) return false;
    const id = this.pasoActual;
    if (!PASOS[id].golpe || this.marcado) return false;
    // devuelve 'bien' o 'mal' según haya entrado en la ventana
    const [a, b] = this._ventana(id);
    if (this.tPaso >= a && this.tPaso <= b) {
      this.marcado = 'bien';
      this.sonido.acierto();
      this._completarPaso();
      return 'bien';
    } else {
      this.marcado = 'mal';
      this.penal += PENAL;
      this.temblor = 1;
      this.sonido.torpeza();
      this._aviso('Torpeza', 'malo');
      return 'mal';
    }
  }

  _completarPaso () {
    const id = this.pasoActual;
    switch (id) {
      // morder trae adentro sacar el cartucho y verter la pólvora, y baqueta
      // trae meter la bala: por eso acá pasan dos cosas por paso
      case 'morder':
        this.cartucho.visible = true;
        this.polvora = true;
        this.sonido.papel();
        this.sonido.polvora();
        break;
      case 'cebar': this.cebado = true; this.sonido.polvora(); this.sonido.rastrillo(); break;
      case 'baqueta':
        this.bala = true;
        this.cartucho.visible = false;
        if (this.alGastarCartucho) this.alGastarCartucho();
        this.sonido.baqueta();
        break;
      case 'amartillar': this.amartillada = true; this.sonido.martillo(); break;
    }
    this.paso++;
    this.tPaso = 0;
    this.penal = 0;
    this.marcado = null;
    if (this.paso >= this.secuencia.length) {
      this.cargando = false;
      if (this.lista) this._aviso('Lista', 'bien');
    }
  }

  // ---------- golpe de arma blanca (F) ----------
  puntazo () {
    if (this.guardada || this.tGolpe >= 0) return;
    this.tGolpe = 0;
    this.golpeAplicado = false;
    this.cargando = false;           // interrumpe la carga, pero no la borra
    this.sonido.sable();
  }

  // ---------- disparo ----------
  gatillo () {
    if (this.guardada || this.esperaTiro >= 0 || this.tGolpe >= 0) return;
    if (!this.amartillada) {
      this.sonido.chispaFallida();
      this._aviso(this.cargada ? 'Sin amartillar' : 'Descargada', 'malo');
      return;
    }
    this.amartillada = false;

    if (!this.cargada) {
      this.cebado = false;
      this.sonido.fogonazo();
      this._chispazo(0.35);
      this._aviso('Sin carga', 'malo');
      return;
    }
    const d = Math.random();
    if (d < P_CHISPA) {
      this.sonido.chispaFallida();
      this._aviso('Falló la chispa', 'malo');
      return;
    }
    if (d < P_CHISPA + P_FOGONAZO) {
      this.cebado = false;
      this.sonido.fogonazo();
      this._chispazo(0.4);
      this._aviso('Fogonazo sin tiro', 'malo');
      return;
    }
    this.esperaTiro = RETARDO;
    this.sonido.fogonazo();
    this._chispazo(0.25);
  }

  _chispazo (f) {
    this.fogonazo.material.opacity = 0.5 * f;
    this.luz.intensity = 6 * f;
    const p = this.bocaMundo(new THREE.Vector3());
    const dir = new THREE.Vector3();
    this.camaraMundo.getWorldDirection(dir);
    this.humo.soltar(p.addScaledVector(dir, 0.35), dir,
      { cantidad: 4, vida: 4, empuje: 1.2, radio: 0.1, opacidad: 0.22 });
  }

  _tirar () {
    // Y ARRANCA A RECARGARSE SOLA. Un granadero no espera que le den la orden
    // de volver a cargar: tira y ya está metiendo la mano en la cartuchera. La
    // tecla R sigue estando —para pausarla, para retomarla, o para empezar
    // antes de que termine el retroceso—, pero dejó de ser obligatoria.
    this.autoCarga = AUTO_CARGA;
    this.polvora = false;
    this.bala = false;
    this.cebado = false;
    this.tiros++;
    this.secuencia = SECUENCIA.slice();
    this.paso = 0; this.tPaso = 0; this.penal = 0; this.marcado = null;
    this.sonido.disparo();

    this.fogonazo.material.opacity = 0.95;
    this.luz.intensity = 22;
    this.retroceso = 1;

    const origen = this.bocaMundo(new THREE.Vector3());
    const dir = new THREE.Vector3();
    this.camaraMundo.getWorldDirection(dir);

    const grados = this.apuntando ? this.cfg.conoApuntado : this.cfg.conoCadera;
    const disp = THREE.MathUtils.degToRad(grados) * (1 + this.presion * 0.6) * this.dispersionPostura;

    this.humo.soltar(origen.clone().addScaledVector(dir, 0.45), dir,
      { cantidad: 15, vida: 10, empuje: 2.0, radio: 0.3, opacidad: 0.42, claro: 0.45 });

    if (this.alDisparar) this.alDisparar(origen, dir, disp);
  }

  _aviso (t, tipo) { if (this.alAviso) this.alAviso(t, tipo); }

  // Dónde cae la boca del cañón en el mundo. Con la corrección de campo: el
  // arma se dibuja con una cámara de 55° y el mundo con una de 80, así que un
  // mismo punto se proyecta en lugares distintos. Sin esto, el fogonazo y el
  // humo salen despegados de la boca.
  bocaMundo (destino) {
    this.grupo.updateWorldMatrix(true, false);
    destino.copy(this.boca).applyMatrix4(this.grupo.matrixWorld);
    const tanArma = Math.tan(THREE.MathUtils.degToRad(this.camara.fov) / 2);
    const tanMundo = Math.tan(THREE.MathUtils.degToRad(this.camaraMundo.fov) / 2);
    const f = tanMundo / tanArma;
    destino.x *= f;
    destino.y *= f;
    return destino.applyMatrix4(this.camaraMundo.matrixWorld);
  }

  // ---------- ciclo ----------
  actualizar (dt, ctx) {
    this.apuntando = ctx.apuntando && !this.cargando && !this.guardada && this.tGolpe < 0;
    this.presion = ctx.presion;
    this.penalPostura = ctx.penalCarga;
    this.sola = !!ctx.sola;
    this.dispersionPostura = ctx.dispersion;

    if (this.esperaTiro >= 0) {
      this.esperaTiro -= dt;
      if (this.esperaTiro < 0) { this.esperaTiro = -1; this._tirar(); }
    }

    // la recarga sola, pasado el retroceso. No se avisa nada si no se puede
    // —cuerpo a tierra, o en pleno puntazo—: se vuelve a intentar al cuadro
    // siguiente y listo. Un aviso por cuadro sería una alarma.
    // Arranca sola esté guardada o en la mano: montado con la tercerola en la
    // mano tampoco tenés cómo. Espera a que pase el retroceso —autoCarga— para
    // que el tiro se lea antes de que la mano vuelva, igual que la carga sola
    // de siempre.
    if (this.sola && !this.cargando && this.autoCarga <= 0 && this.tGolpe < 0 &&
        this.penalPostura > 0 && this.paso < this.secuencia.length &&
        (!this.alPedirCarga || this.alPedirCarga())) {
      this.cargando = true;
    }

    if (this.autoCarga > 0) {
      this.autoCarga -= dt;
      if (this.autoCarga <= 0) {
        this.autoCarga = 0;
        if (!this.cargando && !this.guardada && this.tGolpe < 0 && this.penalPostura > 0 &&
            this.paso < this.secuencia.length && (!this.alPedirCarga || this.alPedirCarga())) {
          this.cargando = true;
        }
      }
    }

    if (this.tGolpe >= 0) {
      this.tGolpe += dt;
      const u = this.tGolpe / this.cfg.golpe.dur;
      if (!this.golpeAplicado && u > 0.34 && u < 0.62) {
        this.golpeAplicado = true;
        if (this.alGolpear) this.alGolpear(this.cfg.golpe);
      }
      if (u >= 1) this.tGolpe = -1;
    }

    if (this.cargando && this.paso < this.secuencia.length) {
      const id = this.pasoActual;
      this.tPaso += dt;
      const d = this._duracion(id) + this.penal;
      // y sin castigo por no marcar el ritmo: no estás mirando el arma
      if (PASOS[id].golpe && !this.marcado && !this.sola) {
        const [, b] = this._ventana(id);
        if (this.tPaso > b) {
          this.marcado = 'mal';
          this.penal += PENAL;
          this.temblor = 0.8;
          this.sonido.torpeza();
          this._aviso('Se pasó el tiempo', 'malo');
        }
      }
      if (this.tPaso >= d) this._completarPaso();
    }

    if (!this.guardada) this._animar(dt);
  }

  _animar (dt) {
    const k = 1 - Math.exp(-13 * dt);
    let pose = this.poses.reposo;
    if (this.tGolpe >= 0) pose = this.poses.golpe;
    else if (this.cargando) pose = this.poses.carga;
    else if (this.apuntando) pose = this.poses.apuntado;

    this.grupo.position.lerp(pose.p, k);
    this.grupo.rotation.x += (pose.r.x - this.grupo.rotation.x) * k;
    this.grupo.rotation.y += (pose.r.y - this.grupo.rotation.y) * k;
    this.grupo.rotation.z += (pose.r.z - this.grupo.rotation.z) * k;

    // estocada: el arma sale para adelante y vuelve
    if (this.tGolpe >= 0) {
      const u = this.tGolpe / this.cfg.golpe.dur;
      const e = Math.sin(Math.min(1, u) * Math.PI);
      this.grupo.position.z -= e * 0.34;
      this.grupo.rotation.x += e * 0.12;
    }

    if (this.retroceso > 0) {
      this.retroceso = Math.max(0, this.retroceso - dt * 4.5);
      const r = this.retroceso * this.retroceso;
      this.grupo.position.z += r * 0.16;
      this.grupo.rotation.x -= r * 0.34;
    }
    if (this.temblor > 0) {
      this.temblor = Math.max(0, this.temblor - dt * 1.6);
      const a = this.temblor * 0.02;
      this.grupo.position.x += (Math.random() - 0.5) * a;
      this.grupo.position.y += (Math.random() - 0.5) * a;
    }
    const nervio = this.presion * 0.004 * (this.cargando ? 1 : 0.4);
    if (nervio > 0) {
      this.grupo.position.x += (Math.random() - 0.5) * nervio;
      this.grupo.position.y += (Math.random() - 0.5) * nervio;
    }

    this._acomodarBrazos();

    const objMartillo = this.amartillada ? -0.95 : 0.28;
    this.martillo.rotation.x += (objMartillo - this.martillo.rotation.x) * (1 - Math.exp(-16 * dt));
    const objRastrillo = this.cebado ? 0 : -1.15;
    this.rastrillo.rotation.x += (objRastrillo - this.rastrillo.rotation.x) * (1 - Math.exp(-14 * dt));

    const destino = this.manoIzqBase.clone();
    let bq = { ...this.baquetaGuardada };
    if (this.cargando && this.paso < this.secuencia.length) {
      const id = this.pasoActual;
      const d = this._duracion(id) + this.penal;
      const u = Math.min(1, this.tPaso / d);
      const zBoca = this.bocaZ;
      switch (id) {
        case 'morder': destino.set(-0.01, 0.03, 0.06); break;
        case 'cebar': destino.set(0.03, 0.02, -0.09); break;
        case 'baqueta': {
          const s = Math.abs(Math.sin(u * Math.PI * 2));
          destino.set(-0.02, 0.06 + s * 0.05, zBoca - 0.02 - s * 0.12);
          bq = { y: 0.03, z: zBoca + 0.04 + s * 0.34 };
          break;
        }
        case 'amartillar': destino.set(0.05, 0.02, -0.02); break;
      }
      this.cartucho.position.set(destino.x + 0.01, destino.y + 0.03, destino.z);
      this.cartucho.visible = ['morder', 'cebar', 'baqueta'].includes(id);
    } else {
      this.cartucho.visible = false;
    }
    this.manoIzq.position.lerp(destino, 1 - Math.exp(-11 * dt));
    this.baqueta.position.z += (bq.z - this.baqueta.position.z) * (1 - Math.exp(-18 * dt));
    this.baqueta.position.y += (bq.y - this.baqueta.position.y) * (1 - Math.exp(-18 * dt));

    if (this.fogonazo.material.opacity > 0) {
      this.fogonazo.material.opacity = Math.max(0, this.fogonazo.material.opacity - dt * 9);
      this.luz.intensity = Math.max(0, this.luz.intensity - dt * 190);
    }
  }

  infoPaso () {
    if (!this.cargando || this.paso >= this.secuencia.length) return null;
    const id = this.pasoActual;
    const d = this._duracion(id) + this.penal;
    const [a, b] = this._ventana(id);
    return {
      nombre: PASOS[id].nombre,
      indice: this.paso + 1,
      total: this.secuencia.length,
      progreso: Math.min(1, this.tPaso / d),
      golpe: PASOS[id].golpe,
      enVentana: this.tPaso >= a && this.tPaso <= b && !this.marcado,
      ventana: [a / d, b / d],
      marcado: this.marcado
    };
  }
}
