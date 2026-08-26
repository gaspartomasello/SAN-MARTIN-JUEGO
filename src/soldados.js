import * as THREE from 'three';
import { Figura } from './figura.js';

// Soldados de los dos bandos. Misma anatomía, distinta casaca:
//   granadero — casaca azul, vivos encarnados, morrión con penacho
//   realista  — casaca blanca, correaje de ante, sombrero redondo
// Buscan al enemigo vivo más cercano del otro bando, avisan antes de la
// descarga y su percepción consulta la MISMA grilla de humo que ve el jugador:
// si la nube tapa, pierden de vista y caminan a donde vieron por última vez.

const VEL = 1.85;
const ALCANCE_TIRO = 62;
const ALCANCE_ACERO = 1.9;
const RECARGA = 12.5;

// Ritmo de la estocada. El AVISO es sagrado: es la ventana en la que el
// jugador ve venir el golpe. Sin esto, parar es lotería.
const ACERO_GUARDIA = 0.75;
const ACERO_AVISO = 0.55;
const ACERO_SALIDA = 0.20;
const ACERO_VUELTA = 0.45;

export class Soldado {
  constructor (escena, humo, sonido, pos, bando) {
    this.escena = escena;
    this.humo = humo;
    this.sonido = sonido;
    this.bando = bando || 'realista';

    this.fig = new Figura(this.bando, Math.random());
    // la malla exterior lleva el rumbo; la figura de adentro, el desplome
    this.malla = new THREE.Group();
    this.malla.add(this.fig.raiz);
    this.malla.position.copy(pos);
    escena.add(this.malla);

    this.vivo = true;
    this.vida = 2;
    this.estado = 'avanzar';
    this.t = 0;
    this.recarga = Math.random() * 4;
    this.ultimoVisto = new THREE.Vector3().copy(pos);
    this.objetivo = null;
    this.caida = 0;
    this.tieneFusil = this.bando === 'realista';
    this.alDisparar = null;
    this.alGolpear = null;

    this.tAcero = 0;
    this.avisando = false;   // true durante el AVISO: la ventana de parada
    this._pego = false;
    this._grito = false;
    this._v = new THREE.Vector3();
  }

  get pos () { return this.malla.position; }
  get esRealista () { return this.bando === 'realista'; }

  cabeza () { return this._v.set(this.pos.x, this.pos.y + 1.6, this.pos.z); }

  recibir (dano, dir) {
    if (!this.vivo) return false;
    this.vida -= dano;
    if (this.vida <= 0) {
      this.vivo = false;
      this.estado = 'caido';
      this.caida = 0;
      this.avisando = false;
      this.sonido.grito();
      return true;
    }
    return false;
  }

  entregarFusil () {
    if (!this.tieneFusil) return false;
    this.tieneFusil = false;
    this.fig.ocultarArma(true);
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
      this.fig.desplomar(e);
      this.malla.position.y = -e * 0.10;
      return;
    }

    const dist = this._elegirObjetivo(jugador, soldados);
    if (!this.objetivo) { this.estado = 'avanzar'; this.fig.actualizar(dt, false); return; }

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
    let andando = false;

    switch (this.estado) {
      case 'avanzar': {
        if (dist < ALCANCE_ACERO) { this._entrarAcero(); break; }
        if (this.teVe && dist < ALCANCE_TIRO && this.recarga <= 0) {
          this.estado = 'apuntar'; this.t = 0;
          this.fig.poner('apuntar');
          this.sonido.grito();
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
      case 'apuntar': {
        this.fig.poner('apuntar');
        if (this.t > 1.5) {
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
        if (this.t > 2.5) { this.estado = 'avanzar'; this.fig.poner('marcha'); }
        break;
      }
      case 'acero': {
        if (dist > ALCANCE_ACERO + 0.7) {
          this.estado = 'avanzar';
          this.avisando = false;
          this.fig.poner('marcha');
          break;
        }
        this._acero(dt);
        break;
      }
    }

    this.fig.actualizar(dt, andando);
  }

  _entrarAcero () {
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

  _descargar () {
    const origen = new THREE.Vector3(this.pos.x, this.pos.y + 1.38, this.pos.z);
    const dir = new THREE.Vector3().subVectors(this.objetivo.pos, origen).normalize();
    this.sonido.disparo();
    this.humo.soltar(origen.clone().addScaledVector(dir, 0.9), dir,
      { cantidad: 12, vida: 10, empuje: 2.0, radio: 0.28, opacidad: 0.4, claro: 0.45 });
    if (this.alDisparar) this.alDisparar(this, origen, dir, this.objetivo);
  }

  quitar () { this.escena.remove(this.malla); }
}
