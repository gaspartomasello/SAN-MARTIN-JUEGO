import * as THREE from 'three';

// Controlador en primera persona: movimiento, posturas, aliento, heridas y los
// efectos de cámara. La sacudida es por "trauma": se acumula y decae, y el
// temblor va al cuadrado, así un cañonazo se siente distinto a un tiro.

const RADIO = 0.36;

// Cuerpo a tierra no se puede recargar un arma de avancarga: no hay forma de
// meter la baqueta por la boca del cañón acostado. Por eso penalCarga = 0.
export const POSTURAS = {
  pie:      { nombre: 'de pie',        altura: 1.68, vel: 1.00, dispersion: 1.00, penalCarga: 1.00, blanco: 1.00 },
  agachado: { nombre: 'agachado',      altura: 1.12, vel: 0.55, dispersion: 0.70, penalCarga: 1.30, blanco: 0.62 },
  tierra:   { nombre: 'cuerpo a tierra', altura: 0.48, vel: 0.26, dispersion: 0.48, penalCarga: 0.00, blanco: 0.28 }
};

const GRAVEDAD = 19;
const IMPULSO = 4.3;

export class Jugador {
  constructor (camara, colisiones) {
    this.camara = camara;
    this.colisiones = colisiones;
    this.pos = new THREE.Vector3(0, POSTURAS.pie.altura, 4);
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;

    this.postura = 'pie';
    this.altura = POSTURAS.pie.altura;
    this.saltoY = 0;
    this.saltoVel = 0;
    this.enElAire = false;

    this.aliento = 100;
    this.tSinCorrer = 0;
    this.heridas = 0;
    this.vendas = 3;
    this.vendando = 0;

    this.trauma = 0;
    this.retroPitch = 0;
    this.fovBase = 80;
    this.fovApuntado = 62;
    this.fov = 80;
    this.bob = 0;
    this.balanceo = 0;
    this.alAviso = null;
  }

  get vivo () { return this.heridas < 3; }
  get grave () { return this.heridas >= 2; }
  get cfgPostura () { return POSTURAS[this.postura]; }

  mirar (dx, dy, sens) {
    this.yaw -= dx * sens;
    this.pitch -= dy * sens;
    const lim = Math.PI / 2 - 0.02;
    this.pitch = Math.max(-lim, Math.min(lim, this.pitch));
  }

  sacudir (t) { this.trauma = Math.min(1, this.trauma + t); }

  herir () {
    if (!this.vivo) return;
    this.heridas++;
    this.sacudir(0.85);
  }

  vendar () {
    if (this.vendas <= 0 || this.heridas === 0 || !this.vivo || this.vendando > 0) return false;
    this.vendando = 3;
    return true;
  }

  // Ctrl agacha, Z cuerpo a tierra. Volver a apretar la misma tecla te levanta.
  alternarPostura (cual) {
    if (!this.vivo || this.enElAire) return;
    this.postura = this.postura === cual ? 'pie' : cual;
    if (this.alAviso) this.alAviso(POSTURAS[this.postura].nombre, 'bien');
  }

  saltar () {
    if (!this.vivo || this.enElAire || this.postura !== 'pie' || this.grave) return false;
    if (this.aliento < 14) return false;
    this.aliento -= 12;
    this.saltoVel = IMPULSO;
    this.enElAire = true;
    return true;
  }

  actualizar (dt, teclas, apuntando, cargando) {
    if (!this.vivo) {
      this.trauma = Math.max(0, this.trauma - dt * 0.5);
      this._aplicarCamara(dt, 0);
      return;
    }

    if (this.vendando > 0) {
      this.vendando -= dt;
      if (this.vendando <= 0) { this.heridas = Math.max(0, this.heridas - 1); this.vendas--; }
    }

    const adelante = (teclas.has('KeyW') ? 1 : 0) - (teclas.has('KeyS') ? 1 : 0);
    const lado = (teclas.has('KeyD') ? 1 : 0) - (teclas.has('KeyA') ? 1 : 0);
    const quiereCorrer = teclas.has('ShiftLeft') || teclas.has('ShiftRight');
    const moviendo = adelante !== 0 || lado !== 0;
    const p = this.cfgPostura;
    const puedeCorrer = quiereCorrer && this.aliento > 6 && !this.grave && !apuntando &&
      this.vendando <= 0 && this.postura === 'pie';

    let vmax = 3.4;
    if (puedeCorrer) vmax = 6.1;
    if (apuntando) vmax = 1.7;
    if (cargando) vmax = 2.5;
    vmax *= p.vel;
    if (this.heridas === 1) vmax *= 0.86;
    if (this.grave) vmax = Math.min(vmax, 1.5);
    if (this.vendando > 0) vmax = 0.6;

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
        const rec = this.grave ? 7 : (this.heridas === 1 ? 10 : 14);
        this.aliento = Math.min(100, this.aliento + rec * dt);
      }
    }

    this._mover(this.vel.x * dt, this.vel.z * dt);

    // salto: bajo, pesado y sin control en el aire
    if (this.enElAire) {
      this.saltoVel -= GRAVEDAD * dt;
      this.saltoY += this.saltoVel * dt;
      if (this.saltoY <= 0) { this.saltoY = 0; this.saltoVel = 0; this.enElAire = false; }
    }

    // la postura cambia con tiempo, no de golpe
    this.altura += (p.altura - this.altura) * Math.min(1, 7 * dt);
    this.pos.y = this.altura + this.saltoY;

    const rapidez = Math.hypot(this.vel.x, this.vel.z);
    this.bob += dt * rapidez * 1.9;
    const objBal = (puedeCorrer && moviendo) ? lado * -0.035 : 0;
    this.balanceo += (objBal - this.balanceo) * Math.min(1, 6 * dt);

    this.fov = apuntando ? this.fovApuntado : this.fovBase;
    this._aplicarCamara(dt, rapidez);
  }

  _mover (dx, dz) {
    this.pos.x += dx;
    this._resolver('x', dx);
    this.pos.z += dz;
    this._resolver('z', dz);
    this.pos.x = Math.max(-60, Math.min(60, this.pos.x));
    this.pos.z = Math.max(-105, Math.min(20, this.pos.z));
  }

  _resolver (eje, delta) {
    for (const caja of this.colisiones) {
      const cx = Math.max(caja.min.x, Math.min(this.pos.x, caja.max.x));
      const cz = Math.max(caja.min.z, Math.min(this.pos.z, caja.max.z));
      const dx = this.pos.x - cx, dz = this.pos.z - cz;
      // saltando por encima de un parapeto bajo no hay colisión
      const piesY = this.saltoY;
      if (dx * dx + dz * dz < RADIO * RADIO && caja.max.y > piesY + 0.15) {
        if (eje === 'x') this.pos.x -= delta;
        else this.pos.z -= delta;
        this.vel[eje] = 0;
      }
    }
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

    const falta = 1 - this.aliento / 100;
    const resp = Math.sin(t * (2.2 + falta * 3.4)) * (0.004 + falta * 0.016);

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
