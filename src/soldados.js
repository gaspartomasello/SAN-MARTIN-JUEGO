import * as THREE from 'three';
import { Figura } from './figura.js';
import { Caballo } from './caballo.js';

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
const ATURDIDO = 1.35;      // lo que dura abierto tras una parada perfecta

// ---- caballería ----
//
// El lancero no pelea parado: CARGA. Entra al galope, tira el lanzazo de
// pasada, sigue de largo hasta despegarse y recién ahí vuelve grupas. Esa es
// la mecánica entera —y es la que hizo que San Lorenzo durara quince minutos.
const LANZA_ALCANCE = 3.6;      // 2,70 m de asta más el brazo desde la silla
const LANZA_ENRISTRE = 15;      // a esta distancia baja el asta: el aviso largo
const LANZA_AVISO = 5.4;        // y a esta se echa atrás: el aviso corto
const PASADA = 1.5;             // segundos de seguir de largo antes de volver
const DESMONTE = 3;             // daño de un golpe que te tira de la silla
const CAIDA_JINETE = 14;        // lo que cuesta el golpe contra el suelo

export class Soldado {
  // op.tez      — color de piel fijo (Cabral)
  // op.caballo  — lo monta desde el arranque; si trae caballo, va con lanza
  constructor (escena, humo, sonido, pos, bando, op = {}) {
    this.escena = escena;
    this.humo = humo;
    this.sonido = sonido;
    this.bando = bando || 'realista';
    this.lancero = !!op.caballo && this.bando === 'granadero';

    this.fig = new Figura(this.bando, Math.random(),
      { tez: op.tez, arma: this.lancero ? 'lanza' : null });
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
    this.aturdido = 0;       // > 0: parado en seco, abierto y sin guardia
    this._pego = false;
    this._grito = false;
    this._v = new THREE.Vector3();

    this.monta = null;
    this.tPasada = 0;
    this.tirado = 0;          // > 0: en el suelo tras la caída, sin defensa
    this.alDesmontar = null;
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
  _sentar () {
    const c = this.monta;
    const asiento = c.altura - 0.92 * this.fig.raiz.scale.y;
    this.malla.position.set(c.pos.x, c.alto + asiento, c.pos.z);
    this.malla.rotation.y = c.rumbo;
  }

  get pos () { return this.malla.position; }
  get esRealista () { return this.bando === 'realista'; }

  cabeza () { return this._v.set(this.pos.x, this.pos.y + 1.6, this.pos.z); }

  recibir (dano, dir) {
    if (!this.vivo) return false;
    // A caballo el golpe fuerte NO mata: voltea. El jinete rueda, se levanta
    // y sigue a pie con lo que le quede. Así quedó San Martín debajo de su
    // caballo en la barranca, y así terminan peleando a pie los lanceros a los
    // que la infantería alcanza. Un lancero derribado vale mucho más vivo que
    // borrado del campo.
    if (this.montado && dano >= DESMONTE) { this.desmontar(true); return false; }
    this.vida -= dano;
    if (this.vida <= 0) {
      this.vivo = false;
      this.estado = 'caido';
      this.caida = 0;
      this.avisando = false;
      this.sonido.grito();
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

  // parado en seco: se le corta el golpe y queda abierto
  aturdir (seg) {
    if (!this.vivo) return;
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

    if (this.montado) {
      this.t += dt;
      if (this.aturdido > 0) this.aturdido -= dt;
      this._cargarALanza(dt, dist, destino);
      this.fig.actualizar(dt, false);
      return;
    }

    this.malla.rotation.y = Math.atan2(hacia.x, hacia.z) + Math.PI;

    this.recarga = Math.max(0, this.recarga - dt);
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

    const rumboA = Math.atan2(destino.x - c.pos.x, destino.z - c.pos.z) + Math.PI;
    const mando = {};

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
        if (!this._pego && this.aturdido <= 0) {
          this._pego = true;
          if (this.alGolpear) this.alGolpear(this, this.objetivo);
        }
        this.estado = 'pasada';
        this.tPasada = PASADA;
      }
    }

    // batir a tiempo: la tapia se salta, no se choca
    if (c.puedeSaltar && c.obstaculoAdelante(c.vel * 0.55 + 2.5)) mando.saltar = true;
    c.actualizar(dt, mando);
    c.actualizado = true;     // que el bucle principal no lo pise
    this._sentar();
    if (!c.vivo) this.desmontar(true);
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

  quitar () {
    this.escena.remove(this.malla);
    if (this.monta) { this.monta.quitar(); this.monta = null; }
  }
}
