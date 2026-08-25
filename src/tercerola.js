import * as THREE from 'three';
import { PALETA } from './mundo.js';

// La tercerola de chispa: modelo, máquina de carga de siete pasos y balística.
// La carga es interrumpible y persistente: si soltás a mitad, el arma se queda
// en el paso donde estaba y ahí la retomás.

export const PASOS = {
  cartucho:   { nombre: 'Sacar el cartucho',      dur: 1.55, golpe: false },
  morder:     { nombre: 'Morder el cartucho',     dur: 1.15, golpe: true },
  cebar:      { nombre: 'Cebar la cazoleta',      dur: 2.10, golpe: false },
  polvora:    { nombre: 'Verter la pólvora',      dur: 1.95, golpe: false },
  bala:       { nombre: 'Introducir la bala',     dur: 1.75, golpe: false },
  baqueta:    { nombre: 'Atacar con la baqueta',  dur: 2.55, golpe: true },
  amartillar: { nombre: 'Amartillar',             dur: 0.95, golpe: true }
};

export const SECUENCIA = ['cartucho', 'morder', 'cebar', 'polvora', 'bala', 'baqueta', 'amartillar'];

const PENAL = 1.2;              // lo que cuesta errar el tiempo
const RETARDO = 0.09;           // percusión: la cazoleta primero, la bala después
const P_FOGONAZO = 0.04;        // ceba y no sale el tiro
const P_CHISPA = 0.03;          // el pedernal no prende

const ESCALA = 0.6;
const EJE_CANON = 0.022 * ESCALA;   // para que apuntar sea mirar por el cañón

const POSE = {
  reposo:   { p: new THREE.Vector3(0.19, -0.16, -0.50), r: new THREE.Euler(0.05, 0.17, 0.03) },
  apuntado: { p: new THREE.Vector3(0.00, -EJE_CANON, -0.34), r: new THREE.Euler(0.00, 0.00, 0.00) },
  carga:    { p: new THREE.Vector3(0.15, -0.23, -0.46), r: new THREE.Euler(0.86, -0.30, 0.34) },
  guardada: { p: new THREE.Vector3(0.30, -0.50, -0.48), r: new THREE.Euler(0.4, 0.5, 0.6) }
};

function mat (color, rug, met) {
  return new THREE.MeshStandardMaterial({ color, roughness: rug === undefined ? 0.8 : rug, metalness: met || 0 });
}

export class Tercerola {
  // El arma vive en una escena aparte con su propia cámara de 55° para que no
  // la deforme el gran angular del mundo. camaraMundo sirve para saber dónde
  // está la boca del cañón de verdad.
  constructor (camaraArma, camaraMundo, sonido, humo) {
    this.camara = camaraArma;
    this.camaraMundo = camaraMundo;
    this.sonido = sonido;
    this.humo = humo;

    // estado físico del arma, no un número de balas
    this.polvora = false;
    this.bala = false;
    this.cebado = false;
    this.amartillada = false;

    this.secuencia = SECUENCIA.slice();
    this.paso = 0;            // dónde quedó la carga
    this.tPaso = 0;
    this.penal = 0;
    this.marcado = null;      // 'bien' | 'mal' en el paso actual
    this.cargando = false;
    this.guardada = false;

    this.cartuchos = 24;
    this.tiros = 0;           // emplome del ánima
    this.apuntando = false;
    this.esperaTiro = -1;
    this.presion = 0;         // 0..1, achica las ventanas de tiempo

    this.retroceso = 0;
    this.temblor = 0;

    this.alDisparar = null;   // (origen, dir, dispersion) => void
    this.alAviso = null;      // (texto, tipo) => void

    this._construir();
  }

  // ---------- modelo ----------
  _construir () {
    const g = new THREE.Group();
    this.grupo = g;

    const madera = mat(PALETA.madera, 0.85);
    const maderaOsc = mat(PALETA.maderaOsc, 0.85);
    const hierro = mat(0x4a4f55, 0.45, 0.85);
    const laton = mat(PALETA.bronce, 0.35, 0.9);
    const cuero = mat(0x5a4632, 0.9);

    const canon = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.021, 0.95, 10), hierro);
    canon.rotation.x = Math.PI / 2;
    canon.position.set(0, 0.022, -0.42);
    g.add(canon);
    this.boca = new THREE.Object3D();
    this.boca.position.set(0, 0.022, -0.90);
    g.add(this.boca);

    const caja = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.058, 0.72), madera);
    caja.position.set(0, -0.007, -0.28);
    g.add(caja);

    const culata = new THREE.Mesh(new THREE.BoxGeometry(0.062, 0.115, 0.30), madera);
    culata.position.set(0, -0.038, 0.13);
    culata.rotation.x = -0.13;
    g.add(culata);

    const cantonera = new THREE.Mesh(new THREE.BoxGeometry(0.066, 0.13, 0.03), laton);
    cantonera.position.set(0, -0.048, 0.28);
    cantonera.rotation.x = -0.13;
    g.add(cantonera);

    const guarda = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.006, 6, 10, Math.PI), laton);
    guarda.rotation.set(Math.PI / 2, 0, 0);
    guarda.position.set(0, -0.055, -0.01);
    g.add(guarda);

    // llave de chispa: placa, cazoleta, rastrillo y martillo
    const placa = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.05, 0.12), hierro);
    placa.position.set(0.032, 0.006, -0.05);
    g.add(placa);

    const cazoleta = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.012, 0.03), laton);
    cazoleta.position.set(0.028, 0.024, -0.08);
    g.add(cazoleta);

    this.rastrillo = new THREE.Group();
    const hoja = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.042, 0.026), hierro);
    hoja.position.set(0, 0.021, 0);
    this.rastrillo.add(hoja);
    this.rastrillo.position.set(0.034, 0.026, -0.093);
    g.add(this.rastrillo);

    this.martillo = new THREE.Group();
    const brazo = new THREE.Mesh(new THREE.BoxGeometry(0.011, 0.046, 0.016), hierro);
    brazo.position.set(0, 0.023, 0);
    const pedernal = new THREE.Mesh(new THREE.BoxGeometry(0.013, 0.016, 0.022), mat(0x2c2b2a, 0.7));
    pedernal.position.set(0, 0.046, -0.008);
    this.martillo.add(brazo, pedernal);
    this.martillo.position.set(0.032, 0.022, -0.03);
    g.add(this.martillo);

    // baqueta, alojada bajo el cañón
    this.baqueta = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.78, 6), mat(0x8a7550, 0.9));
    this.baqueta.rotation.x = Math.PI / 2;
    this.baqueta.position.set(0, -0.014, -0.36);
    g.add(this.baqueta);

    // manos
    const guante = mat(0xb9ac93, 0.95);
    this.manoDer = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.075, 0.1), guante);
    this.manoDer.position.set(0.012, -0.05, 0.02);
    g.add(this.manoDer);

    this.manoIzq = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.07, 0.095), guante);
    this.manoIzq.position.set(-0.02, -0.045, -0.30);
    g.add(this.manoIzq);
    this.manoIzqBase = this.manoIzq.position.clone();

    // puño de la manga: azul granadero con vivo rojo
    const manga = new THREE.Mesh(new THREE.BoxGeometry(0.062, 0.08, 0.1), mat(PALETA.azul, 0.9));
    manga.position.set(0.012, -0.055, 0.1);
    g.add(manga);
    const vivo = new THREE.Mesh(new THREE.BoxGeometry(0.066, 0.084, 0.018), mat(PALETA.carmesi, 0.9));
    vivo.position.set(0.012, -0.055, 0.055);
    g.add(vivo);

    this.cartucho = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.04, 6), mat(0xd8cdb4, 0.95));
    this.cartucho.rotation.z = Math.PI / 2;
    this.cartucho.visible = false;
    g.add(this.cartucho);

    // el fogonazo de la boca
    this.fogonazo = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xffd48a, transparent: true, opacity: 0 })
    );
    this.fogonazo.position.copy(this.boca.position);
    this.fogonazo.scale.set(1, 1, 1.9);
    g.add(this.fogonazo);
    this.luzFogonazo = new THREE.PointLight(0xffc46a, 0, 9, 2);
    this.luzFogonazo.position.copy(this.boca.position);
    g.add(this.luzFogonazo);

    g.scale.setScalar(ESCALA);
    g.position.copy(POSE.reposo.p);
    g.rotation.copy(POSE.reposo.r);
    g.traverse(o => { o.frustumCulled = false; });
    // el arma se dibuja después del mundo, para que no la corte nada
    g.renderOrder = 2;
    this.camara.add(g);
    this._cuero = cuero; this._maderaOsc = maderaOsc;
  }

  // ---------- lectura del estado ----------
  get cargada () { return this.polvora && this.bala; }
  get lista () { return this.cargada && this.cebado && this.amartillada; }
  get pasoActual () { return this.secuencia[this.paso]; }

  // ¿quedó una carga a mitad de camino? sólo si la secuencia sigue abierta
  get aMedias () { return this.paso > 0 && this.paso < this.secuencia.length; }

  get etiquetaEstado () {
    if (this.lista) return 'lista';
    if (this.cargada && this.cebado) return 'sin amartillar';
    if (this.cargada) return 'sin cebar';
    if (this.aMedias) return 'a medio cargar';
    return 'descargada';
  }

  _duracion (id) {
    // el emplome del ánima ensucia todo: cada seis tiros, medio segundo más
    const suciedad = 1 + Math.floor(this.tiros / 6) * 0.075;
    return PASOS[id].dur * suciedad;
  }

  _ventana (id) {
    const d = this._duracion(id) + this.penal;
    const ancho = d * 0.26 * (1 - this.presion * 0.45);
    const inicio = d * 0.54;
    return [inicio, inicio + ancho];
  }

  // ---------- carga ----------
  iniciarCarga () {
    if (this.guardada) return;
    if (this.paso >= this.secuencia.length) {
      if (this.lista) { this._aviso('El arma ya está lista', 'bien'); return; }
      this._nuevaSecuencia();
    }
    if (this.cartuchos <= 0 && this.secuencia.includes('cartucho') && this.paso === 0) {
      this._aviso('No quedan cartuchos', 'malo');
      return;
    }
    this.cargando = true;
  }

  soltarCarga () { this.cargando = false; }

  _nuevaSecuencia () {
    // qué hace falta según en qué estado quedó el arma
    if (this.cargada && this.cebado && !this.amartillada) this.secuencia = ['amartillar'];
    else if (this.cargada && !this.cebado) this.secuencia = ['cebar', 'amartillar'];
    else this.secuencia = SECUENCIA.slice();
    this.paso = 0; this.tPaso = 0; this.penal = 0; this.marcado = null;
  }

  golpe () {           // barra espaciadora
    if (!this.cargando || this.paso >= this.secuencia.length) return;
    const id = this.pasoActual;
    if (!PASOS[id].golpe || this.marcado) return;
    const [a, b] = this._ventana(id);
    if (this.tPaso >= a && this.tPaso <= b) {
      this.marcado = 'bien';
      this.sonido.acierto();
      this._completarPaso();
    } else {
      this.marcado = 'mal';
      this.penal += PENAL;
      this.temblor = 1;
      this.sonido.torpeza();
      this._aviso('Torpeza', 'malo');
    }
  }

  _completarPaso () {
    const id = this.pasoActual;
    switch (id) {
      case 'cartucho': this.cartucho.visible = true; this.sonido.papel(); break;
      case 'morder': this.sonido.papel(); break;
      case 'cebar': this.cebado = true; this.sonido.polvora(); this.sonido.rastrillo(); break;
      case 'polvora': this.polvora = true; this.sonido.polvora(); break;
      case 'bala': this.bala = true; this.cartucho.visible = false; this.cartuchos--; break;
      case 'baqueta': this.sonido.baqueta(); break;
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

  // ---------- disparo ----------
  gatillo () {
    if (this.guardada || this.esperaTiro >= 0) return;
    if (!this.amartillada) {
      this.sonido.chispaFallida();
      this._aviso(this.cargada ? 'Sin amartillar' : 'Descargada', 'malo');
      return;
    }
    this.amartillada = false;

    if (!this.cargada) {              // sólo tenía la ceba: fuego y humo, sin bala
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
    this.luzFogonazo.intensity = 6 * f;
    const p = this.bocaMundo(new THREE.Vector3());
    const dir = new THREE.Vector3();
    this.camaraMundo.getWorldDirection(dir);
    this.humo.soltar(p.addScaledVector(dir, 0.35), dir, { cantidad: 4, vida: 4, empuje: 1.2, radio: 0.1, opacidad: 0.22 });
  }

  _tirar () {
    this.polvora = false;
    this.bala = false;
    this.cebado = false;
    this.tiros++;
    // tras el tiro hay que rehacer los siete pasos desde el principio
    this.secuencia = SECUENCIA.slice();
    this.paso = 0; this.tPaso = 0; this.penal = 0; this.marcado = null;
    this.sonido.disparo();

    this.fogonazo.material.opacity = 0.95;
    this.luzFogonazo.intensity = 22;
    this.retroceso = 1;

    const origen = this.bocaMundo(new THREE.Vector3());
    const dir = new THREE.Vector3();
    this.camaraMundo.getWorldDirection(dir);

    // ánima lisa: cono ancho de cadera, angosto apuntando
    const grados = this.apuntando ? 0.8 : 3.0;
    const disp = THREE.MathUtils.degToRad(grados) * (1 + this.presion * 0.6);

    // la nube sale hacia adelante: molesta la vista, no te tapa la cara
    this.humo.soltar(origen.clone().addScaledVector(dir, 0.45), dir,
      { cantidad: 15, vida: 10, empuje: 2.0, radio: 0.3, opacidad: 0.42, claro: 0.45 });

    if (this.alDisparar) this.alDisparar(origen, dir, disp);
  }

  limpiar () {
    if (this.tiros === 0) { this._aviso('El ánima está limpia', 'bien'); return; }
    this.tiros = 0;
    this.sonido.baqueta();
    this._aviso('Ánima limpia', 'bien');
  }

  _aviso (t, tipo) { if (this.alAviso) this.alAviso(t, tipo); }

  // ---------- ciclo ----------
  actualizar (dt, ctx) {
    this.apuntando = ctx.apuntando && !this.cargando && !this.guardada;
    this.presion = ctx.presion;

    if (this.esperaTiro >= 0) {
      this.esperaTiro -= dt;
      if (this.esperaTiro < 0) { this.esperaTiro = -1; this._tirar(); }
    }

    if (this.cargando && this.paso < this.secuencia.length) {
      const id = this.pasoActual;
      this.tPaso += dt;
      const d = this._duracion(id) + this.penal;
      if (PASOS[id].golpe && !this.marcado) {
        const [, b] = this._ventana(id);
        if (this.tPaso > b) {          // se pasó el momento
          this.marcado = 'mal';
          this.penal += PENAL;
          this.temblor = 0.8;
          this.sonido.torpeza();
          this._aviso('Se pasó el tiempo', 'malo');
        }
      }
      if (this.tPaso >= d) this._completarPaso();
    }

    this._animar(dt);
  }

  _animar (dt) {
    const k = 1 - Math.exp(-13 * dt);
    let pose = POSE.reposo;
    if (this.guardada) pose = POSE.guardada;
    else if (this.cargando) pose = POSE.carga;
    else if (this.apuntando) pose = POSE.apuntado;

    this.grupo.position.lerp(pose.p, k);
    this.grupo.rotation.x += (pose.r.x - this.grupo.rotation.x) * k;
    this.grupo.rotation.y += (pose.r.y - this.grupo.rotation.y) * k;
    this.grupo.rotation.z += (pose.r.z - this.grupo.rotation.z) * k;

    // retroceso y temblor de manos
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

    // piezas móviles: el estado del arma se lee en el modelo, no en un cartel
    const objMartillo = this.amartillada ? -0.95 : 0.28;
    this.martillo.rotation.x += (objMartillo - this.martillo.rotation.x) * (1 - Math.exp(-16 * dt));
    const objRastrillo = this.cebado ? 0 : -1.15;
    this.rastrillo.rotation.x += (objRastrillo - this.rastrillo.rotation.x) * (1 - Math.exp(-14 * dt));

    // manos y baqueta según el paso
    const destino = this.manoIzqBase.clone();
    let baquetaZ = -0.36, baquetaY = -0.014, baquetaRot = Math.PI / 2;
    if (this.cargando && this.paso < this.secuencia.length) {
      const id = this.pasoActual;
      const d = this._duracion(id) + this.penal;
      const u = Math.min(1, this.tPaso / d);
      switch (id) {
        case 'cartucho': destino.set(0.06, -0.16, 0.12); break;
        case 'morder': destino.set(-0.01, 0.03, 0.06); break;
        case 'cebar': destino.set(0.03, 0.02, -0.09); break;
        case 'polvora': destino.set(-0.02, 0.05, -0.86); break;
        case 'bala': destino.set(-0.02, 0.04, -0.88); break;
        case 'baqueta': {
          const s = Math.abs(Math.sin(u * Math.PI * 2));
          destino.set(-0.02, 0.06 + s * 0.05, -0.92 - s * 0.12);
          baquetaZ = -0.86 + s * 0.34;
          baquetaY = 0.03;
          baquetaRot = Math.PI / 2;
          break;
        }
        case 'amartillar': destino.set(0.05, 0.02, -0.02); break;
      }
      this.cartucho.position.set(destino.x + 0.01, destino.y + 0.03, destino.z);
      this.cartucho.visible = ['morder', 'cebar', 'polvora', 'bala'].includes(id);
    } else {
      this.cartucho.visible = false;
    }
    this.manoIzq.position.lerp(destino, 1 - Math.exp(-11 * dt));
    this.baqueta.position.z += (baquetaZ - this.baqueta.position.z) * (1 - Math.exp(-18 * dt));
    this.baqueta.position.y += (baquetaY - this.baqueta.position.y) * (1 - Math.exp(-18 * dt));
    this.baqueta.rotation.x = baquetaRot;

    // apagar el fogonazo
    if (this.fogonazo.material.opacity > 0) {
      this.fogonazo.material.opacity = Math.max(0, this.fogonazo.material.opacity - dt * 9);
      this.luzFogonazo.intensity = Math.max(0, this.luzFogonazo.intensity - dt * 190);
    }
  }

  // posición real de la boca del cañón, en coordenadas del mundo
  bocaMundo (destino) {
    this.grupo.updateWorldMatrix(true, false);
    this.boca.updateWorldMatrix(true, false);
    this.boca.getWorldPosition(destino);           // queda en espacio de vista
    return destino.applyMatrix4(this.camaraMundo.matrixWorld);
  }

  // datos para el HUD
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
      ventana: [a / d, b / d],
      marcado: this.marcado
    };
  }
}
