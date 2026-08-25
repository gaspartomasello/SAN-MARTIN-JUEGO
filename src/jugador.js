import * as THREE from 'three';

// Controlador en primera persona: movimiento, aliento, heridas y los efectos
// de cámara. La sacudida es por "trauma": se acumula y decae, y el temblor va
// al cuadrado, así un cañonazo se siente distinto a un tiro de fusil.

const ALTURA = 1.68;
const RADIO = 0.36;

export class Jugador {
  constructor (camara, colisiones) {
    this.camara = camara;
    this.colisiones = colisiones;
    this.pos = new THREE.Vector3(0, ALTURA, 4);
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;

    this.aliento = 100;
    this.tSinCorrer = 0;
    this.heridas = 0;          // 0 sano · 1 herido · 2 grave · 3 muerto
    this.vendas = 3;
    this.vendando = 0;

    this.trauma = 0;
    this.retroPitch = 0;
    this.fovBase = 80;
    this.fov = 80;
    this.bob = 0;
    this.balanceo = 0;
    this._caja = new THREE.Box3();
    this._p = new THREE.Vector3();
  }

  get vivo () { return this.heridas < 3; }
  get grave () { return this.heridas >= 2; }

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

    // --- entrada de movimiento ---
    const adelante = (teclas.has('KeyW') ? 1 : 0) - (teclas.has('KeyS') ? 1 : 0);
    const lado = (teclas.has('KeyD') ? 1 : 0) - (teclas.has('KeyA') ? 1 : 0);
    const quiereCorrer = teclas.has('ShiftLeft') || teclas.has('ShiftRight');
    const moviendo = adelante !== 0 || lado !== 0;
    const puedeCorrer = quiereCorrer && this.aliento > 6 && !this.grave && !apuntando && this.vendando <= 0;

    let vmax = 3.4;
    if (puedeCorrer) vmax = 6.1;
    if (apuntando) vmax = 1.7;
    if (cargando) vmax = 2.5;
    if (this.heridas === 1) vmax *= 0.86;
    if (this.grave) vmax = 1.5;
    if (this.vendando > 0) vmax = 0.6;

    const dir = new THREE.Vector3(lado, 0, -adelante);
    if (dir.lengthSq() > 0) dir.normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);

    const acel = moviendo ? 34 : 26;
    this.vel.x += (dir.x * vmax - this.vel.x) * Math.min(1, acel * dt);
    this.vel.z += (dir.z * vmax - this.vel.z) * Math.min(1, acel * dt);

    // --- aliento ---
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

    // --- desplazamiento con colisión ---
    this._mover(this.vel.x * dt, this.vel.z * dt);

    // --- cabeceo ---
    const rapidez = Math.hypot(this.vel.x, this.vel.z);
    this.bob += dt * rapidez * 1.9;
    const objBal = (puedeCorrer && moviendo) ? lado * -0.035 : 0;
    this.balanceo += (objBal - this.balanceo) * Math.min(1, 6 * dt);

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
      if (dx * dx + dz * dz < RADIO * RADIO && caja.min.y < ALTURA) {
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

    // la respiración se ve cuando falta el aliento
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
