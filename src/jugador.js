import * as THREE from 'three';

// Controlador en primera persona: movimiento, posturas, aliento, vida y los
// efectos de cámara. La sacudida es por "trauma": se acumula y decae, y el
// temblor va al cuadrado, así un cañonazo se siente distinto a un tiro.

const RADIO = 0.36;
const ESCALON = 0.42;      // lo que se sube sin saltar

// Cuerpo a tierra no se puede recargar un arma de avancarga: no hay forma de
// meter la baqueta por la boca del cañón acostado. Por eso penalCarga = 0.
export const POSTURAS = {
  pie:      { nombre: 'de pie',          altura: 1.68, vel: 1.00, dispersion: 1.00, penalCarga: 1.00, blanco: 1.00 },
  agachado: { nombre: 'agachado',        altura: 1.12, vel: 0.55, dispersion: 0.70, penalCarga: 1.30, blanco: 0.62 },
  tierra:   { nombre: 'cuerpo a tierra', altura: 0.48, vel: 0.26, dispersion: 0.48, penalCarga: 0.00, blanco: 0.28 }
};

// Salto con la gravedad del Source: sv_gravity 800 son 15,24 m/s², y con un
// impulso de 5,2 m/s da unos 89 cm de altura. Lo mismo que salta un jugador
// de Counter-Strike.
const GRAVEDAD = 15.24;
const IMPULSO = 5.2;

const REGEN_ESPERA = 4.5;   // segundos sin recibir plomo antes de recuperarse
const REGEN_TASA = 21;      // puntos por segundo
const VENDA_CURA = 48;
const VENDA_TIEMPO = 1.4;

export class Jugador {
  constructor (camara, colisiones) {
    this.camara = camara;
    this.colisiones = colisiones;
    this.pos = new THREE.Vector3(0, POSTURAS.pie.altura, 4);
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;

    this.monta = null;          // caballo si vas montado
    this.postura = 'pie';
    this.altura = POSTURAS.pie.altura;
    this.pies = 0;           // altura del suelo bajo los pies
    this.velY = 0;
    this.enElAire = false;

    this.aliento = 100;
    this.tSinCorrer = 0;

    this.vidaMax = 100;
    this.vida = 100;
    this.tSinDano = 99;
    this.vendas = 3;
    this.vendando = 0;
    this.golpeDesde = 0;        // ángulo del último impacto, para el tirón de cámara

    this.trauma = 0;
    this.retroPitch = 0;
    this.fovBase = 80;
    this.fovApuntado = 62;
    this.fov = 80;
    this.bob = 0;
    this.balanceo = 0;
    this.alAviso = null;
    this.alMorir = null;
  }

  get vivo () { return this.vida > 0; }
  get maltrecho () { return this.vida < 32; }
  get cfgPostura () { return POSTURAS[this.postura]; }

  mirar (dx, dy, sens) {
    this.yaw -= dx * sens;
    this.pitch -= dy * sens;
    const lim = Math.PI / 2 - 0.02;
    this.pitch = Math.max(-lim, Math.min(lim, this.pitch));
  }

  sacudir (t) { this.trauma = Math.min(1, this.trauma + t); }

  recibir (dano, desde) {
    if (!this.vivo) return;
    this.vida = Math.max(0, this.vida - dano);
    this.tSinDano = 0;
    this.vendando = 0;
    this.sacudir(Math.min(0.9, 0.25 + dano / 90));
    if (desde) this.golpeDesde = Math.atan2(desde.x, desde.z);
    if (this.vida <= 0 && this.alMorir) this.alMorir();
  }

  vendar () {
    if (this.vendas <= 0 || this.vida >= this.vidaMax || !this.vivo || this.vendando > 0) return false;
    this.vendando = VENDA_TIEMPO;
    return true;
  }

  revivir () {
    this.vida = this.vidaMax;
    this.aliento = 100;
    this.vendas = 3;
    this.vendando = 0;
    this.tSinDano = 99;
    this.monta = null;          // se vuelve a formar a pie
    this.postura = 'pie';
    this.pies = 0; this.velY = 0; this.enElAire = false;
    this.vel.set(0, 0, 0);
    this.pos.set(0, POSTURAS.pie.altura, 4);
  }

  alternarPostura (cual) {
    if (!this.vivo || this.enElAire) return;
    this.postura = this.postura === cual ? 'pie' : cual;
    if (this.alAviso) this.alAviso(POSTURAS[this.postura].nombre, 'bien');
  }

  montar (caballo) {
    if (!caballo || !caballo.vivo) return false;
    this.monta = caballo;
    caballo.montado = true;
    this.postura = 'pie';
    this.velY = 0;
    this.enElAire = false;
    return true;
  }

  // Bajarse a un costado. Si el caballo cayó, el golpe lo pone el que llama.
  desmontar () {
    if (!this.monta) return false;
    const c = this.monta;
    c.montado = false;
    this.monta = null;
    this.pos.x = c.pos.x - Math.cos(c.rumbo) * 1.1;
    this.pos.z = c.pos.z + Math.sin(c.rumbo) * 1.1;
    this.pies = 0;
    this.velY = 0;
    this.vel.set(0, 0, 0);
    return true;
  }

  saltar () {
    if (!this.vivo || this.enElAire || this.postura !== 'pie') return false;
    if (this.aliento < 14) return false;
    this.aliento -= 11;
    this.velY = IMPULSO;
    this.enElAire = true;
    return true;
  }

  actualizar (dt, teclas, apuntando, cargando) {
    if (!this.vivo) {
      this.trauma = Math.max(0, this.trauma - dt * 0.5);
      this._aplicarCamara(dt, 0);
      return;
    }

    // --- vida: se recupera sola si te dejan en paz, como en Call of Duty ---
    this.tSinDano += dt;
    if (this.vendando > 0) {
      this.vendando -= dt;
      if (this.vendando <= 0) {
        this.vida = Math.min(this.vidaMax, this.vida + VENDA_CURA);
        this.vendas--;
        this.tSinDano = REGEN_ESPERA;      // y arranca a regenerar enseguida
      }
    } else if (this.tSinDano > REGEN_ESPERA && this.vida < this.vidaMax) {
      this.vida = Math.min(this.vidaMax, this.vida + REGEN_TASA * dt);
    }

    // --- montado: el caballo lleva el cuerpo, vos sólo mirás y peleás ---
    if (this.monta && this.monta.vivo) {
      const c = this.monta;
      this.pos.x = c.pos.x;
      this.pos.z = c.pos.z;
      this.pies = c.alto;
      this.altura = c.altura + 0.88;
      this.pos.y = c.alto + this.altura;
      // el aterrizaje se siente: el salto no es gratis
      if (this._enVuelo && !c.enElAire) this.sacudir(Math.min(0.55, 0.20 + c.vel * 0.03));
      this._enVuelo = c.enElAire;
      this.vel.set(-Math.sin(c.rumbo) * c.vel, 0, -Math.cos(c.rumbo) * c.vel);
      this.tSinCorrer += dt;
      if (this.tSinCorrer > 0.7) this.aliento = Math.min(100, this.aliento + 14 * dt);
      // el trote sacude bastante más que caminar: por eso no se puede cargar
      this.bob += dt * (2.2 + c.vel * 1.5);
      this.balanceo += (0 - this.balanceo) * Math.min(1, 6 * dt);
      this.fov = apuntando ? this.fovApuntado : this.fovBase + Math.min(9, c.vel * 0.9);
      this._aplicarCamara(dt, Math.min(3.2, c.vel * 0.55));
      return;
    }

    const adelante = (teclas.has('KeyW') ? 1 : 0) - (teclas.has('KeyS') ? 1 : 0);
    const lado = (teclas.has('KeyD') ? 1 : 0) - (teclas.has('KeyA') ? 1 : 0);
    const quiereCorrer = teclas.has('ShiftLeft') || teclas.has('ShiftRight');
    const moviendo = adelante !== 0 || lado !== 0;
    const p = this.cfgPostura;
    const puedeCorrer = quiereCorrer && this.aliento > 6 && !apuntando &&
      this.vendando <= 0 && this.postura === 'pie';

    // se puede correr cargando: es más difícil acertar los tiempos, pero se corre
    let vmax = 3.4;
    if (cargando) vmax = 2.9;
    if (apuntando) vmax = 1.7;
    if (puedeCorrer) vmax = cargando ? 5.2 : 6.1;
    vmax *= p.vel;
    if (this.maltrecho) vmax *= 0.85;
    if (this.vendando > 0) vmax = 0.7;

    const dir = new THREE.Vector3(lado, 0, -adelante);
    if (dir.lengthSq() > 0) dir.normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);

    const acel = this.enElAire ? 5 : (moviendo ? 34 : 26);
    this.vel.x += (dir.x * vmax - this.vel.x) * Math.min(1, acel * dt);
    this.vel.z += (dir.z * vmax - this.vel.z) * Math.min(1, acel * dt);

    if (puedeCorrer && moviendo) {
      this.aliento = Math.max(0, this.aliento - 19 * dt);
      this.tSinCorrer = 0;
    } else {
      this.tSinCorrer += dt;
      if (this.tSinCorrer > 0.7) {
        this.aliento = Math.min(100, this.aliento + (this.maltrecho ? 9 : 14) * dt);
      }
    }

    this._mover(this.vel.x * dt, this.vel.z * dt);
    this._caer(dt);

    this.altura += (p.altura - this.altura) * Math.min(1, 7 * dt);
    this.pos.y = this.pies + this.altura;

    const rapidez = Math.hypot(this.vel.x, this.vel.z);
    this.bob += dt * rapidez * 1.9;
    const objBal = (puedeCorrer && moviendo) ? lado * -0.035 : 0;
    this.balanceo += (objBal - this.balanceo) * Math.min(1, 6 * dt);

    this.fov = apuntando ? this.fovApuntado : this.fovBase;
    this._aplicarCamara(dt, rapidez);
  }

  _mover (dx, dz) {
    this.pos.x += dx;
    this.pos.z += dz;
    this.pos.x = Math.max(-60, Math.min(60, this.pos.x));
    this.pos.z = Math.max(-105, Math.min(20, this.pos.z));

    // Se resuelve empujando al jugador fuera de la caja, no deshaciendo el
    // movimiento: deshacerlo es lo que hacía vibrar la pantalla al quedar
    // trabado entre dos obstáculos.
    const cabeza = this.pies + this.altura;
    for (const caja of this.colisiones) {
      if (caja.max.y <= this.pies + ESCALON) continue;   // se sube sin saltar
      if (caja.min.y >= cabeza) continue;                // pasa por abajo
      this._empujar(caja);
    }
  }

  _empujar (caja) {
    const cx = Math.max(caja.min.x, Math.min(this.pos.x, caja.max.x));
    const cz = Math.max(caja.min.z, Math.min(this.pos.z, caja.max.z));
    const dx = this.pos.x - cx;
    const dz = this.pos.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= RADIO * RADIO) return;

    if (d2 > 1e-8) {
      const d = Math.sqrt(d2);
      const empuje = RADIO - d;
      this.pos.x += (dx / d) * empuje;
      this.pos.z += (dz / d) * empuje;
      // se frena sólo la parte de la velocidad que entra en la pared
      const nx = dx / d, nz = dz / d;
      const entrante = this.vel.x * nx + this.vel.z * nz;
      if (entrante < 0) { this.vel.x -= entrante * nx; this.vel.z -= entrante * nz; }
      return;
    }

    // el centro quedó dentro de la caja: se sale por el lado más cerca
    const salidas = [
      { d: this.pos.x - caja.min.x + RADIO, x: -1, z: 0 },
      { d: caja.max.x - this.pos.x + RADIO, x: 1, z: 0 },
      { d: this.pos.z - caja.min.z + RADIO, x: 0, z: -1 },
      { d: caja.max.z - this.pos.z + RADIO, x: 0, z: 1 }
    ];
    salidas.sort((a, b) => a.d - b.d);
    const s = salidas[0];
    this.pos.x += s.x * s.d;
    this.pos.z += s.z * s.d;
    this.vel.set(0, this.vel.y, 0);
  }

  // gravedad y apoyo: se puede quedar parado arriba de un cajón o un parapeto
  _caer (dt) {
    const piesAntes = this.pies;
    this.velY -= GRAVEDAD * dt;
    let piesNuevos = this.pies + this.velY * dt;

    let soporte = 0;
    for (const caja of this.colisiones) {
      if (this.pos.x < caja.min.x - RADIO || this.pos.x > caja.max.x + RADIO) continue;
      if (this.pos.z < caja.min.z - RADIO || this.pos.z > caja.max.z + RADIO) continue;
      const techo = caja.max.y;
      const aterriza = piesAntes >= techo - 0.03 && piesNuevos <= techo;
      const escalon = techo <= piesAntes + ESCALON && techo >= piesNuevos;
      if ((aterriza || escalon) && techo > soporte) soporte = techo;
    }

    if (this.velY <= 0 && piesNuevos <= soporte) {
      piesNuevos = soporte;
      this.velY = 0;
      this.enElAire = false;
    } else if (piesNuevos <= 0) {
      piesNuevos = 0;
      this.velY = 0;
      this.enElAire = false;
    } else {
      this.enElAire = true;
    }
    this.pies = piesNuevos;
  }

  _aplicarCamara (dt, rapidez) {
    this.trauma = Math.max(0, this.trauma - dt * 1.15);
    const s = this.trauma * this.trauma;
    const t = performance.now() * 0.001;

    const sx = (Math.sin(t * 47.3) + Math.sin(t * 71.7) * 0.5) * s * 0.055;
    const sy = (Math.sin(t * 53.1) + Math.sin(t * 83.3) * 0.5) * s * 0.055;
    const sz = Math.sin(t * 39.7) * s * 0.045;

    const bobY = Math.sin(this.bob * 2) * 0.032 * Math.min(1, rapidez / 4);
    const bobX = Math.cos(this.bob) * 0.022 * Math.min(1, rapidez / 4);

    // la respiración se acelera con poco aliento y con poca vida
    const falta = Math.max(1 - this.aliento / 100, 1 - this.vida / this.vidaMax);
    const resp = Math.sin(t * (2.2 + falta * 3.6)) * (0.004 + falta * 0.018);

    this.retroPitch *= Math.exp(-9 * dt);

    this.camara.position.set(this.pos.x + bobX * 0.4, this.pos.y + bobY + resp, this.pos.z);
    this.camara.rotation.set(0, 0, 0);
    this.camara.rotateY(this.yaw + sy);
    this.camara.rotateX(this.pitch + sx + this.retroPitch);
    this.camara.rotateZ(this.balanceo + sz + bobX * 0.5);

    this.camara.fov += (this.fov - this.camara.fov) * Math.min(1, 9 * dt);
    this.camara.updateProjectionMatrix();
  }
}
