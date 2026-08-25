import * as THREE from 'three';
import { PALETA } from './mundo.js';

// Infante de marina realista. Avanza, se para, apunta con aviso audible y
// descarga. Su percepción consulta la MISMA grilla de humo que ve el jugador:
// si la nube tapa, te pierde de vista y camina hacia donde te vio por última vez.

const VEL = 1.85;
const ALCANCE_TIRO = 62;
const ALCANCE_ACERO = 1.9;
const RECARGA = 12.5;

function construirFigura () {
  const g = new THREE.Group();
  const azul = new THREE.MeshStandardMaterial({ color: 0x2c3f63, roughness: 0.92 });
  const blanco = new THREE.MeshStandardMaterial({ color: 0xd6d0c0, roughness: 0.95 });
  const piel = new THREE.MeshStandardMaterial({ color: 0xb98d68, roughness: 0.95 });
  const negro = new THREE.MeshStandardMaterial({ color: 0x1b1c20, roughness: 0.9 });
  const hierro = new THREE.MeshStandardMaterial({ color: 0x4a4f55, roughness: 0.5, metalness: 0.8 });
  const madera = new THREE.MeshStandardMaterial({ color: PALETA.maderaOsc, roughness: 0.9 });

  const piernaIzq = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.82, 0.19), blanco);
  piernaIzq.position.set(-0.11, 0.41, 0);
  const piernaDer = piernaIzq.clone();
  piernaDer.position.x = 0.11;

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.6, 0.26), azul);
  torso.position.y = 1.12;
  const correa = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.09, 0.28), blanco);
  correa.position.y = 1.16;
  correa.rotation.z = 0.5;

  const brazoIzq = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.5, 0.14), azul);
  brazoIzq.position.set(-0.3, 1.13, 0.02);
  const brazoDer = brazoIzq.clone();
  brazoDer.position.x = 0.3;

  const cuello = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.09, 0.15), piel);
  cuello.position.y = 1.46;
  const cabeza = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.25, 0.22), piel);
  cabeza.position.y = 1.62;
  const sombrero = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.24, 8), negro);
  sombrero.position.y = 1.85;
  const ala = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.03, 10), negro);
  ala.position.y = 1.74;

  const fusil = new THREE.Group();
  const canon = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 1.15, 6), hierro);
  canon.rotation.x = Math.PI / 2;
  canon.position.set(0, 0.03, -0.4);
  const caja = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.07, 1.0), madera);
  caja.position.set(0, 0, -0.15);
  const bayoneta = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.004, 0.42, 5), hierro);
  bayoneta.rotation.x = Math.PI / 2;
  bayoneta.position.set(0.03, 0.05, -1.15);
  fusil.add(canon, caja, bayoneta);
  fusil.position.set(0.26, 1.16, 0);
  fusil.rotation.set(-0.25, 0, 0);

  const partes = [piernaIzq, piernaDer, torso, correa, brazoIzq, brazoDer, cuello, cabeza, sombrero, ala];
  partes.forEach(m => { m.castShadow = true; g.add(m); });
  fusil.traverse(o => { if (o.isMesh) o.castShadow = true; });
  g.add(fusil);

  g.userData.fusil = fusil;
  g.userData.piernas = [piernaIzq, piernaDer];
  g.userData.brazos = [brazoIzq, brazoDer];
  return g;
}

export class Realista {
  constructor (escena, humo, sonido, pos) {
    this.escena = escena;
    this.humo = humo;
    this.sonido = sonido;
    this.malla = construirFigura();
    this.malla.position.copy(pos);
    escena.add(this.malla);

    this.vivo = true;
    this.vida = 2;                 // una bala lo tumba; el sable necesita dos
    this.estado = 'avanzar';       // avanzar · apuntar · recargar · acero · caido
    this.t = 0;
    this.recarga = Math.random() * 4;
    this.ultimoVisto = new THREE.Vector3().copy(pos);
    this.teVe = false;
    this.paso = Math.random() * 6;
    this.caida = 0;
    this.alDisparar = null;
    this._v = new THREE.Vector3();
  }

  get pos () { return this.malla.position; }

  cabeza () { return this._v.set(this.pos.x, this.pos.y + 1.5, this.pos.z); }

  recibir (dano, dir) {
    if (!this.vivo) return false;
    this.vida -= dano;
    if (this.vida <= 0) {
      this.vivo = false;
      this.estado = 'caido';
      this.caida = 0;
      this.dirCaida = dir ? Math.atan2(dir.x, dir.z) : 0;
      this.sonido.grito();
      return true;
    }
    return false;
  }

  actualizar (dt, jugador) {
    if (!this.vivo) {
      this.caida = Math.min(1, this.caida + dt * 2.6);
      const e = 1 - Math.pow(1 - this.caida, 3);
      this.malla.rotation.x = e * (Math.PI / 2) * 0.92;
      this.malla.position.y = -e * 0.15;
      return;
    }

    const objetivo = new THREE.Vector3(jugador.pos.x, 0, jugador.pos.z);
    const mio = new THREE.Vector3(this.pos.x, 0, this.pos.z);
    const dist = mio.distanceTo(objetivo);

    // percepción: el humo tapa de verdad
    const oc = this.humo.oclusion(this.pos, jugador.pos);
    this.teVe = oc < 0.55 && dist < 95;
    if (this.teVe) this.ultimoVisto.copy(objetivo);

    const destino = this.teVe ? objetivo : this.ultimoVisto;
    const haciaDestino = new THREE.Vector3().subVectors(destino, mio);
    const distDestino = haciaDestino.length();
    if (distDestino > 0.001) haciaDestino.normalize();

    this.malla.rotation.y = Math.atan2(haciaDestino.x, haciaDestino.z) + Math.PI;

    this.recarga = Math.max(0, this.recarga - dt);
    this.t += dt;

    switch (this.estado) {
      case 'avanzar': {
        if (dist < ALCANCE_ACERO) { this.estado = 'acero'; this.t = 0; break; }
        if (this.teVe && dist < ALCANCE_TIRO && this.recarga <= 0) {
          this.estado = 'apuntar'; this.t = 0;
          this.sonido.grito();
          break;
        }
        if (distDestino > 0.6) {
          this.pos.x += haciaDestino.x * VEL * dt;
          this.pos.z += haciaDestino.z * VEL * dt;
          this.paso += dt * 7;
          const s = Math.sin(this.paso) * 0.42;
          this.malla.userData.piernas[0].rotation.x = s;
          this.malla.userData.piernas[1].rotation.x = -s;
          this.malla.position.y = Math.abs(Math.sin(this.paso)) * 0.035;
        }
        break;
      }
      case 'apuntar': {
        this.malla.userData.fusil.rotation.x = -0.05;
        if (this.t > 1.5) {                     // aviso audible antes de la descarga
          this._descargar(jugador);
          this.estado = 'recargar';
          this.recarga = RECARGA;
          this.t = 0;
        }
        break;
      }
      case 'recargar': {
        this.malla.userData.fusil.rotation.x = -1.0;
        if (dist < ALCANCE_ACERO) { this.estado = 'acero'; this.t = 0; break; }
        if (this.t > 2.5) { this.estado = 'avanzar'; this.malla.userData.fusil.rotation.x = -0.25; }
        break;
      }
      case 'acero': {
        this.malla.userData.fusil.rotation.x = -0.05;
        if (dist > ALCANCE_ACERO + 0.7) { this.estado = 'avanzar'; break; }
        if (this.t > 1.1) {
          this.t = 0;
          if (this.alAcuchillar) this.alAcuchillar();
        }
        break;
      }
    }
  }

  _descargar (jugador) {
    const origen = new THREE.Vector3(this.pos.x, this.pos.y + 1.35, this.pos.z);
    const dir = new THREE.Vector3().subVectors(jugador.pos, origen).normalize();
    this.sonido.disparo();
    this.humo.soltar(origen.clone().addScaledVector(dir, 0.9), dir,
      { cantidad: 12, vida: 10, empuje: 2.0, radio: 0.28, opacidad: 0.4, claro: 0.45 });
    if (this.alDisparar) this.alDisparar(this, origen, dir);
  }

  quitar () { this.escena.remove(this.malla); }
}
