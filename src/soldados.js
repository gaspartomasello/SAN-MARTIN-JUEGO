import * as THREE from 'three';
import { PALETA } from './mundo.js';

// Soldados de los dos bandos. Misma cabeza, distinta casaca:
//   granadero — casaca azul, vivos encarnados, morrión con penacho
//   realista  — casaca blanca, vivos encarnados, sombrero negro
// Buscan al enemigo vivo más cercano del otro bando, avisan antes de la
// descarga y su percepción consulta la MISMA grilla de humo que ve el jugador:
// si la nube tapa, pierden de vista y caminan a donde vieron por última vez.

const VEL = 1.85;
const ALCANCE_TIRO = 62;
const ALCANCE_ACERO = 1.9;
const RECARGA = 12.5;

function construirFigura (bando) {
  const g = new THREE.Group();
  const granadero = bando === 'granadero';

  const casaca = new THREE.MeshStandardMaterial({
    color: granadero ? 0x27406b : 0xdcd7c6, roughness: 0.92 });
  const vivo = new THREE.MeshStandardMaterial({ color: 0x8f2126, roughness: 0.92 });
  const calzon = new THREE.MeshStandardMaterial({ color: granadero ? 0xe8e4d6 : 0xe4e0d2, roughness: 0.95 });
  const correa = new THREE.MeshStandardMaterial({ color: granadero ? 0xefe9da : 0xcbbb96, roughness: 0.9 });
  const piel = new THREE.MeshStandardMaterial({ color: granadero ? 0xa87a55 : 0xb98d68, roughness: 0.95 });
  const negro = new THREE.MeshStandardMaterial({ color: 0x1b1c20, roughness: 0.9 });
  const laton = new THREE.MeshStandardMaterial({ color: PALETA.bronce, roughness: 0.4, metalness: 0.85 });
  const hierro = new THREE.MeshStandardMaterial({ color: 0x4a4f55, roughness: 0.5, metalness: 0.8 });
  const madera = new THREE.MeshStandardMaterial({ color: PALETA.maderaOsc, roughness: 0.9 });

  const piernaIzq = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.6, 0.19), calzon);
  piernaIzq.position.set(-0.11, 0.52, 0);
  const piernaDer = piernaIzq.clone();
  piernaDer.position.x = 0.11;
  const botaIzq = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.24, 0.21), negro);
  botaIzq.position.set(-0.11, 0.12, 0);
  const botaDer = botaIzq.clone();
  botaDer.position.x = 0.11;

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.6, 0.26), casaca);
  torso.position.y = 1.12;
  const faldon = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.16, 0.25), casaca);
  faldon.position.y = 0.8;
  const cuello = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.09, 0.27), vivo);
  cuello.position.y = 1.4;
  const solapa = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 0.27), vivo);
  solapa.position.set(0, 1.1, 0.005);

  const correaA = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.075, 0.28), correa);
  correaA.position.y = 1.16; correaA.rotation.z = 0.5;
  const correaB = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.075, 0.28), correa);
  correaB.position.y = 1.16; correaB.rotation.z = -0.5;

  const brazoIzq = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.5, 0.14), casaca);
  brazoIzq.position.set(-0.3, 1.13, 0.02);
  const brazoDer = brazoIzq.clone();
  brazoDer.position.x = 0.3;
  const bocamangaIzq = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.09, 0.15), vivo);
  bocamangaIzq.position.set(-0.3, 0.92, 0.02);
  const bocamangaDer = bocamangaIzq.clone();
  bocamangaDer.position.x = 0.3;

  const pescuezo = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.09, 0.15), piel);
  pescuezo.position.y = 1.46;
  const cabeza = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.25, 0.22), piel);
  cabeza.position.y = 1.62;

  const partes = [piernaIzq, piernaDer, botaIzq, botaDer, torso, faldon, cuello, solapa,
    correaA, correaB, brazoIzq, brazoDer, bocamangaIzq, bocamangaDer, pescuezo, cabeza];

  if (granadero) {
    // morrión de granadero: alto, con chapa de latón, carrilleras y penacho
    const morrion = new THREE.Mesh(new THREE.CylinderGeometry(0.155, 0.16, 0.36, 10), negro);
    morrion.position.y = 1.94;
    const visera = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.025, 10), negro);
    visera.position.set(0, 1.77, 0.02);
    const chapa = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.2, 0.02), laton);
    chapa.position.set(0, 1.95, -0.155);
    const penacho = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.24, 6), vivo);
    penacho.position.set(0, 2.22, -0.06);
    partes.push(morrion, visera, chapa, penacho);
  } else {
    const sombrero = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.24, 8), negro);
    sombrero.position.y = 1.85;
    const ala = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.03, 10), negro);
    ala.position.y = 1.74;
    partes.push(sombrero, ala);
  }

  const arma = new THREE.Group();
  if (granadero) {
    // tercerola corta y sable al cinto
    const canon = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.8, 6), hierro);
    canon.rotation.x = Math.PI / 2;
    canon.position.set(0, 0.03, -0.28);
    const caja = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.07, 0.72), madera);
    caja.position.set(0, 0, -0.06);
    arma.add(canon, caja);
    const sable = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.5, 0.06), hierro);
    sable.position.set(-0.24, 0.72, 0.1);
    sable.rotation.x = 0.3;
    g.add(sable);
    sable.castShadow = true;
  } else {
    const canon = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 1.15, 6), hierro);
    canon.rotation.x = Math.PI / 2;
    canon.position.set(0, 0.03, -0.4);
    const caja = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.07, 1.0), madera);
    caja.position.set(0, 0, -0.15);
    const bayoneta = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.004, 0.42, 5), hierro);
    bayoneta.rotation.x = Math.PI / 2;
    bayoneta.position.set(0.03, 0.05, -1.15);
    arma.add(canon, caja, bayoneta);
  }
  arma.position.set(0.26, 1.16, 0);
  arma.rotation.set(-0.25, 0, 0);

  partes.forEach(m => { m.castShadow = true; g.add(m); });
  arma.traverse(o => { if (o.isMesh) o.castShadow = true; });
  g.add(arma);

  g.userData.fusil = arma;
  g.userData.piernas = [piernaIzq, piernaDer, botaIzq, botaDer];
  return g;
}

export class Soldado {
  constructor (escena, humo, sonido, pos, bando) {
    this.escena = escena;
    this.humo = humo;
    this.sonido = sonido;
    this.bando = bando || 'realista';
    this.malla = construirFigura(this.bando);
    this.malla.position.copy(pos);
    escena.add(this.malla);

    this.vivo = true;
    this.vida = 2;
    this.estado = 'avanzar';
    this.t = 0;
    this.recarga = Math.random() * 4;
    this.ultimoVisto = new THREE.Vector3().copy(pos);
    this.objetivo = null;
    this.paso = Math.random() * 6;
    this.caida = 0;
    this.tieneFusil = this.bando === 'realista';
    this.alDisparar = null;
    this.alGolpear = null;
    this._v = new THREE.Vector3();
  }

  get pos () { return this.malla.position; }
  get esRealista () { return this.bando === 'realista'; }

  cabeza () { return this._v.set(this.pos.x, this.pos.y + 1.5, this.pos.z); }

  recibir (dano, dir) {
    if (!this.vivo) return false;
    this.vida -= dano;
    if (this.vida <= 0) {
      this.vivo = false;
      this.estado = 'caido';
      this.caida = 0;
      this.sonido.grito();
      return true;
    }
    return false;
  }

  entregarFusil () {
    if (!this.tieneFusil) return false;
    this.tieneFusil = false;
    this.malla.userData.fusil.visible = false;
    return true;
  }

  // el enemigo vivo más cercano del otro bando; para los realistas, el jugador
  // también cuenta
  _elegirObjetivo (jugador, soldados) {
    let mejor = null;
    let mejorD = Infinity;
    if (this.esRealista && jugador.vivo) {
      mejorD = this.pos.distanceTo(jugador.pos);
      mejor = { pos: jugador.pos, jugador: true };
    }
    for (const s of soldados) {
      if (s === this || !s.vivo || s.bando === this.bando) continue;
      const d = this.pos.distanceTo(s.pos);
      if (d < mejorD) { mejorD = d; mejor = { pos: s.pos, soldado: s }; }
    }
    this.objetivo = mejor;
    return mejorD;
  }

  actualizar (dt, jugador, soldados) {
    if (!this.vivo) {
      this.caida = Math.min(1, this.caida + dt * 2.6);
      const e = 1 - Math.pow(1 - this.caida, 3);
      this.malla.rotation.x = e * (Math.PI / 2) * 0.92;
      this.malla.position.y = -e * 0.15;
      return;
    }

    const dist = this._elegirObjetivo(jugador, soldados);
    if (!this.objetivo) { this.estado = 'avanzar'; return; }

    const objetivo = new THREE.Vector3(this.objetivo.pos.x, 0, this.objetivo.pos.z);
    const mio = new THREE.Vector3(this.pos.x, 0, this.pos.z);

    const oc = this.humo.oclusion(this.pos, this.objetivo.pos);
    this.teVe = oc < 0.55 && dist < 95;
    if (this.teVe) this.ultimoVisto.copy(objetivo);

    const destino = this.teVe ? objetivo : this.ultimoVisto;
    const hacia = new THREE.Vector3().subVectors(destino, mio);
    const distDestino = hacia.length();
    if (distDestino > 0.001) hacia.normalize();

    this.malla.rotation.y = Math.atan2(hacia.x, hacia.z) + Math.PI;

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
          this.pos.x += hacia.x * VEL * dt;
          this.pos.z += hacia.z * VEL * dt;
          this.paso += dt * 7;
          const s = Math.sin(this.paso) * 0.42;
          this.malla.userData.piernas[0].rotation.x = s;
          this.malla.userData.piernas[1].rotation.x = -s;
          this.malla.userData.piernas[2].rotation.x = s;
          this.malla.userData.piernas[3].rotation.x = -s;
          this.malla.position.y = Math.abs(Math.sin(this.paso)) * 0.035;
        }
        break;
      }
      case 'apuntar': {
        this.malla.userData.fusil.rotation.x = -0.05;
        if (this.t > 1.5) {
          this._descargar();
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
          if (this.alGolpear) this.alGolpear(this, this.objetivo);
        }
        break;
      }
    }
  }

  _descargar () {
    const origen = new THREE.Vector3(this.pos.x, this.pos.y + 1.35, this.pos.z);
    const dir = new THREE.Vector3().subVectors(this.objetivo.pos, origen).normalize();
    this.sonido.disparo();
    this.humo.soltar(origen.clone().addScaledVector(dir, 0.9), dir,
      { cantidad: 12, vida: 10, empuje: 2.0, radio: 0.28, opacidad: 0.4, claro: 0.45 });
    if (this.alDisparar) this.alDisparar(this, origen, dir, this.objetivo);
  }

  quitar () { this.escena.remove(this.malla); }
}
