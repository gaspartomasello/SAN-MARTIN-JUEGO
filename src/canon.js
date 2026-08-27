import * as THREE from 'three';
import { Horno, MAT } from './sanlorenzo.js';

// LOS DOS CAÑONES LIGEROS.
//
// Los españoles desembarcaron dos piezas de campaña y alcanzaron a hacer un
// solo disparo antes del choque: metralla —un tarro lleno de perdigones— que
// volteó el caballo de San Martín. De ese disparo sale todo lo que viene
// después, así que el cañón no puede ser un adorno: tiene que ser la cosa más
// peligrosa del campo y tiene que AVISAR, porque un cañón avisa.
//
// El aviso son tres tiempos que se leen de lejos, sin HUD:
//   1. se orienta        — la boca gira y te busca
//   2. ceba              — la mecha humea sobre el oído: DOS SEGUNDOS LARGOS
//   3. fuego             — el cono de metralla
// Con dos segundos alcanza para salirse del cono. No para frenar el caballo.

const BRONCE = 0x9a7434;
const BRONCE_OSC = 0x6d5124;
const CUREÑA = 0x4a5c3a;      // verde artillería
const HIERRO = 0x3c3a36;
const RAYO = 0x5f4a2e;

const ALCANCE = 78;            // más allá la metralla se abre y no hace nada
const CONO = 0.36;             // radianes de media apertura: unos 41° de abanico
const AVISO = 2.1;             // lo que dura la mecha encendida antes del tiro
const APUNTAR = 1.4;
const RECARGA = 16;
const GIRO = 0.55;             // rad/s: una pieza de campaña se mueve a brazo

function piezaDeCampana (horno) {
  // el tubo, apoyado en los muñones
  horno.pieza(new THREE.CylinderGeometry(0.115, 0.145, 1.85, 10),
    [0, 0.86, -0.35], [Math.PI / 2 - 0.06, 0, 0], null, BRONCE);
  horno.pieza(new THREE.CylinderGeometry(0.175, 0.175, 0.20, 10),
    [0, 0.90, 0.50], [Math.PI / 2 - 0.06, 0, 0], null, BRONCE_OSC);   // culata
  horno.pieza(new THREE.SphereGeometry(0.10, 8, 6), [0, 0.92, 0.63], null, null, BRONCE_OSC);
  horno.pieza(new THREE.CylinderGeometry(0.155, 0.155, 0.14, 10),
    [0, 0.80, -1.22], [Math.PI / 2 - 0.06, 0, 0], null, BRONCE);      // brocal
  for (const s of [-1, 1]) {
    horno.pieza(new THREE.CylinderGeometry(0.055, 0.055, 0.16, 8),
      [s * 0.20, 0.86, -0.10], [0, 0, Math.PI / 2], null, BRONCE_OSC);  // muñones
  }

  // cureña: dos gualderas y la contera que se clava en el pasto
  for (const s of [-1, 1]) {
    horno.caja(s * 0.24, 0.62, 0.30, 0.10, 0.34, 2.5, CUREÑA);
    horno.prisma(s * 0.24, 0.36, 1.25, 0.10, 0.30, 1.5, CUREÑA, 0, 0);
  }
  horno.caja(0, 0.30, 1.42, 0.62, 0.22, 0.9, CUREÑA);
  horno.caja(0, 0.24, 1.90, 0.40, 0.16, 0.5, HIERRO);
  horno.caja(0, 0.55, 0.95, 0.50, 0.12, 0.7, CUREÑA);

  // ruedas altas, de radios
  const llanta = new THREE.TorusGeometry(0.62, 0.075, 6, 16);
  const rayoGeo = new THREE.BoxGeometry(0.06, 1.16, 0.06);
  for (const s of [-1, 1]) {
    horno.pieza(llanta, [s * 0.52, 0.62, 0.05], [0, Math.PI / 2, 0], null, RAYO);
    horno.pieza(new THREE.CylinderGeometry(0.11, 0.11, 0.18, 8),
      [s * 0.52, 0.62, 0.05], [0, 0, Math.PI / 2], null, HIERRO);
    for (let r = 0; r < 7; r++) {
      horno.pieza(rayoGeo, [s * 0.52, 0.62, 0.05], [0, Math.PI / 2, (r / 7) * Math.PI], null, RAYO);
    }
  }
  // el eje
  horno.pieza(new THREE.CylinderGeometry(0.07, 0.07, 1.1, 8),
    [0, 0.62, 0.05], [0, 0, Math.PI / 2], null, HIERRO);
}

export class Canon {
  constructor (escena, humo, sonido, pos, rumbo) {
    const horno = new Horno();
    piezaDeCampana(horno);
    this.malla = horno.cocinar(MAT());
    this.malla.position.copy(pos);
    this.malla.rotation.y = rumbo || 0;
    escena.add(this.malla);

    this.escena = escena;
    this.humo = humo;
    this.sonido = sonido;
    this.pos = this.malla.position;
    this.rumbo = rumbo || 0;

    this.vida = 5;
    this.vivo = true;
    this.estado = 'buscando';
    this.t = 0;
    this.recarga = 4 + Math.random() * 6;
    this.objetivo = null;
    this.alDisparar = null;
    this.sirvientes = [];          // los artilleros: si caen todos, la pieza calla
    // en red: la pieza de la otra máquina no piensa ni se hiere de este lado
    this.titere = false;
    this.alCastigo = null;
    this._v = new THREE.Vector3();
    this._humoPos = new THREE.Vector3();
    this._humoDir = new THREE.Vector3();
  }

  // ¿está en el aviso? Es lo que el HUD y el jugador tienen que poder mirar.
  get cebando () { return this.vivo && this.estado === 'cebando'; }
  get servido () { return this.sirvientes.some(s => s.vivo); }

  // La boca del cañón, de donde sale la metralla.
  boca () {
    return this._v.set(
      this.pos.x - Math.sin(this.rumbo) * 1.45, this.pos.y + 0.84,
      this.pos.z - Math.cos(this.rumbo) * 1.45);
  }

  recibir (dano) {
    if (!this.vivo) return false;
    if (this.titere) return this.alCastigo ? !!this.alCastigo({ dano }) : false;
    this.vida -= dano;
    if (this.vida <= 0) {
      this.vivo = false;
      this.estado = 'desmontado';
      this.malla.rotation.z = (Math.random() < 0.5 ? 1 : -1) * 0.42;
      this.malla.position.y -= 0.18;
      return true;
    }
    return false;
  }

  // ¿está este punto adentro del cono de metralla? Devuelve 0 a 1 según lo
  // centrado que esté y lo cerca: eso es lo que cobra la metralla.
  fuerzaSobre (punto) {
    const dx = punto.x - this.pos.x, dz = punto.z - this.pos.z;
    const d = Math.hypot(dx, dz);
    if (d > ALCANCE || d < 1.5) return 0;
    const ang = Math.atan2(dx / d, dz / d);
    const mio = this.rumbo + Math.PI;
    let dif = ang - mio;
    dif = Math.abs(Math.atan2(Math.sin(dif), Math.cos(dif)));
    if (dif > CONO) return 0;
    // el centro del abanico cobra todo; el borde, la mitad. Y se abre con la
    // distancia: a setenta metros la metralla ya es una lluvia sin fuerza.
    const centrado = 1 - (dif / CONO) * 0.5;
    const cerca = 1 - Math.pow(d / ALCANCE, 1.4);
    return centrado * cerca;
  }

  actualizar (dt, candidatos) {
    // en red la pieza de la otra máquina no busca blanco ni ceba: hace lo que
    // dice el parte. Ver soldados.js, «EL TÍTERE».
    if (this.titere) return;
    if (!this.vivo) return;
    this.t += dt;
    this.recarga = Math.max(0, this.recarga - dt);

    // sin artilleros vivos la pieza no vuelve a hablar
    if (this.sirvientes.length && !this.servido) { this.estado = 'callado'; return; }

    if (this.estado === 'cebando') {
      // la mecha humea sobre el oído: el aviso es visible desde el otro lado
      if (this.t > AVISO * 0.35 && !this._mecha) {
        this._mecha = true;
        this.humo.soltar(this._humoPos.copy(this.boca()).setY(this.pos.y + 1.0),
          this._humoDir.set(0, 1, 0),
          { cantidad: 2, vida: 2.2, empuje: 0.5, radio: 0.10, opacidad: 0.30, claro: 0.1 });
      }
      if (this.t >= AVISO) this._fuego();
      return;
    }

    if (this.estado === 'fuego') {
      if (this.t > 0.5) this.estado = 'buscando';
      return;
    }

    // buscar y orientarse
    let mejor = null, mejorD = Infinity;
    for (const c of candidatos) {
      const d = Math.hypot(c.pos.x - this.pos.x, c.pos.z - this.pos.z);
      if (d > ALCANCE || d < 6) continue;
      // la metralla se guarda para el que viene a caballo: es el peligro
      const peso = d * (c.montado ? 0.55 : 1);
      if (peso < mejorD) { mejorD = peso; mejor = c; }
    }
    this.objetivo = mejor;
    if (!mejor) { this.estado = 'buscando'; return; }

    const deseado = Math.atan2(mejor.pos.x - this.pos.x, mejor.pos.z - this.pos.z) + Math.PI;
    let dif = deseado - this.rumbo;
    dif = Math.atan2(Math.sin(dif), Math.cos(dif));
    const paso = GIRO * dt;
    this.rumbo += Math.max(-paso, Math.min(paso, dif));
    this.malla.rotation.y = this.rumbo;

    if (this.estado === 'buscando') {
      if (Math.abs(dif) < 0.10 && this.recarga <= 0) { this.estado = 'apuntando'; this.t = 0; }
      return;
    }
    if (this.estado === 'apuntando') {
      if (Math.abs(dif) > 0.30) { this.estado = 'buscando'; return; }
      if (this.t > APUNTAR) {
        this.estado = 'cebando';
        this.t = 0;
        this._mecha = false;
        this.sonido.rastrillo();
      }
    }
  }

  _fuego () {
    this.estado = 'fuego';
    this.t = 0;
    // la recarga arranca cuando sale el tiro, no cuando se despeja el humo
    this.recarga = RECARGA;
    const b = this.boca().clone();
    const dir = this._humoDir.set(-Math.sin(this.rumbo), 0.06, -Math.cos(this.rumbo)).normalize();
    this.sonido.canon();
    // el fogonazo: una nube gorda que además tapa el campo por un rato
    this.humo.soltar(b, dir, {
      cantidad: 26, vida: 13, empuje: 7.5, radio: 0.42, opacidad: 0.52, claro: 0.55
    });
    // el retroceso: la pieza salta para atrás y vuelve a su sitio
    this.pos.x += Math.sin(this.rumbo) * 0.55;
    this.pos.z += Math.cos(this.rumbo) * 0.55;
    if (this.alDisparar) this.alDisparar(this);
  }

  quitar () { this.escena.remove(this.malla); }
}
