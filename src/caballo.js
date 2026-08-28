import * as THREE from 'three';
import { Taller, cil, caja, bola } from './figura.js';
// la vida del animal es un número de combate: vive en la tabla
import { VIDA_CABALLO } from './balance.js';

// El caballo del acto 3. Se construye con el mismo horno que los soldados
// —piezas fundidas por hueso, color en los vértices— así que un caballo entero
// cuesta 9 llamadas de dibujo.
//
// Frente = −Z, igual que los soldados.
//
// Lo que hace al caballo distinto de un jugador a pie no es la velocidad: es
// que NO PUEDE FRENAR NI DOBLAR EN SECO. Al galope el radio de giro se abre y
// el acero cobra el triple. Toda la carga del acto 3 sale de esa tensión.

const PELAJE = 0x54392a;
const PELAJE_CLARO = 0x6b4a34;
const CRIN = 0x1d1712;
const CASCO = 0x2b2723;
const BLANCO = 0xd8d2c4;
const CUERO = 0x3a2c1e;
const MANTA = 0x24365e;      // mandil de granadero
const VIVO = 0x8f2126;
const LATON = 0xc69b54;
const HIERRO_ESTRIBO = 0x6d727a;

// medidas, en metros
const LOMO = 1.05;           // altura del centro del barril
const PATA_ALTA = 0.55;
const PATA_BAJA = 0.45;
const CUELLO = 0.72;

// andares: la W sube de uno y la S baja.
//
// `carga` es lo que se le multiplica al reloj de la recarga arriba del animal.
// Antes de trote para arriba era un PORTÓN —penalCarga = 0, o sea que la carga
// no arrancaba y la recarga sola después del tiro tampoco—, y eso le sacaba al
// granadero montado la mitad de su oficio: o parabas el caballo en medio del
// campo para cargar, o te quedabas con el arma vacía toda la batalla.
//
// Ahora se puede cargar siempre; lo que cambia es cuánto tarda. Al galope, con
// las riendas en la mano y el arma bailando, cuesta el triple y medio que a
// pie —unos doce segundos de tercerola contra tres y medio—, que es lo que
// tiene que costar: se puede, pero conviene bajar el andar para hacerlo.
export const ANDARES = [
  { nombre: 'parado', vel: 0,    giro: 2.6,  carga: 1.35 },
  { nombre: 'al paso', vel: 1.9, giro: 2.1,  carga: 1.8 },
  { nombre: 'al trote', vel: 4.6, giro: 1.35, carga: 2.6 },
  { nombre: 'a galope', vel: 10.2, giro: 0.62, carga: 3.4 }
];

// Lo que cuesta cargar a esta velocidad. Sale de la velocidad REAL y no del
// andar pedido, porque el caballo tarda en llegar al andar: el que acaba de
// bajar de galope ya tiene la mano más quieta aunque el andar diga otra cosa.
export function penalCargaMontado (vel) {
  for (let i = ANDARES.length - 1; i > 0; i--) {
    const alto = ANDARES[i], bajo = ANDARES[i - 1];
    if (vel < bajo.vel) continue;
    const t = Math.min(1, (vel - bajo.vel) / (alto.vel - bajo.vel));
    return bajo.carga + (alto.carga - bajo.carga) * t;
  }
  return ANDARES[0].carga;
}

const ACEL = 3.4;
const FRENO = 5.2;
const RADIO = 0.95;

// Salto. Un caballo no salta parado: necesita batida, y lo que gana en altura
// lo saca de la carrera que trae. Por eso el impulso sale de la velocidad y por
// eso GRAVEDAD es alta —el salto tiene que ser corto y decidido, no un vuelo.
const SALTO_MINIMO = 2.2;      // m/s: de trote para arriba
const SALTO_BASE = 3.9;
const SALTO_POR_VEL = 0.20;
const GRAVEDAD = 16;
const SALTO_ESPERA = 0.45;     // no se encadenan saltos
const PANZA = 0.55;            // lo que el caballo recoge las patas al saltar

function esqueleto () {
  const raiz = new THREE.Group();
  const h = {};
  h.cuerpo = new THREE.Group(); h.cuerpo.position.y = LOMO; raiz.add(h.cuerpo);
  h.cuello = new THREE.Group(); h.cuello.position.set(0, 0.24, -0.60); h.cuerpo.add(h.cuello);
  h.cabeza = new THREE.Group(); h.cabeza.position.y = -CUELLO; h.cuello.add(h.cabeza);
  h.cola = new THREE.Group(); h.cola.position.set(0, 0.20, 0.72); h.cuerpo.add(h.cola);
  for (const [n, x, z] of [['DI', -0.23, -0.46], ['DD', 0.23, -0.46], ['TI', -0.25, 0.54], ['TD', 0.25, 0.54]]) {
    const alto = new THREE.Group();
    alto.position.set(x, -0.02, z);
    h.cuerpo.add(alto);
    const bajo = new THREE.Group();
    bajo.position.y = -PATA_ALTA;
    alto.add(bajo);
    h['alto' + n] = alto; h['bajo' + n] = bajo;
  }
  return { raiz, h };
}

function vestir (taller, h) {
  const c = h.cuerpo;
  // barril: un cilindro tumbado, más ancho en las costillas que en la grupa
  taller.add(c, cil(0.34, 0.30, 1.42, 12), PELAJE, { p: [0, 0, 0.04], r: [Math.PI / 2, 0, 0], s: [1, 1, 0.86] });
  taller.add(c, bola(0.33, 10), PELAJE, { p: [0, 0.02, -0.62], s: [1, 1.02, 0.8] });    // pecho
  taller.add(c, bola(0.32, 10), PELAJE, { p: [0, 0.10, 0.66], s: [1, 1, 0.85] });       // grupa
  taller.add(c, cil(0.19, 0.26, 0.30, 10), PELAJE_CLARO, { p: [0, -0.24, -0.30], r: [Math.PI / 2, 0, 0], s: [1, 1, 0.7] });

  // montura: mandil de granadero, silla y estribos
  taller.add(c, caja(0.78, 0.03, 0.86), MANTA, { p: [0, 0.31, 0.10] });
  taller.add(c, caja(0.80, 0.035, 0.10), VIVO, { p: [0, 0.312, 0.51] });
  taller.add(c, caja(0.80, 0.035, 0.10), VIVO, { p: [0, 0.312, -0.31] });
  taller.add(c, cil(0.20, 0.26, 0.16, 10), CUERO, { p: [0, 0.38, 0.06], s: [1.05, 1, 1.5] });
  taller.add(c, caja(0.13, 0.10, 0.16), CUERO, { p: [0, 0.44, -0.16] });                 // borrén delantero
  taller.add(c, caja(0.15, 0.09, 0.14), CUERO, { p: [0, 0.42, 0.30] });                  // borrén trasero
  for (const s of [-1, 1]) {
    taller.add(c, caja(0.02, 0.30, 0.03), CUERO, { p: [s * 0.34, 0.20, 0.04] });
    taller.add(c, caja(0.09, 0.10, 0.03), HIERRO_ESTRIBO, { p: [s * 0.34, 0.03, 0.04], metal: true });
  }
  // cincha
  taller.add(c, caja(0.72, 0.06, 0.09), 0xbdb49c, { p: [0, -0.03, -0.02], s: [1, 5.5, 1] });

  // cuello y crin
  taller.add(h.cuello, cil(0.145, 0.215, CUELLO, 10), PELAJE, { p: [0, -CUELLO / 2, 0], s: [0.82, 1, 1] });
  taller.add(h.cuello, caja(0.055, CUELLO * 0.96, 0.15), CRIN, { p: [0, -CUELLO / 2, -0.10] });
  taller.add(h.cuello, caja(0.05, 0.14, 0.12), CRIN, { p: [0, -CUELLO - 0.04, -0.08] });   // tupé

  // Cabeza. Se dibuja a lo largo de −Y como si fuera un miembro: así el hueso
  // la apunta solo y no hay que componer tres rotaciones a ojo.
  const k = h.cabeza;
  taller.add(k, cil(0.10, 0.135, 0.34, 9), PELAJE, { p: [0, -0.17, 0], s: [0.82, 1, 1] });
  taller.add(k, bola(0.092, 8), PELAJE, { p: [0, -0.35, -0.01], s: [0.85, 0.9, 1] });      // hocico
  taller.add(k, caja(0.05, 0.30, 0.03), BLANCO, { p: [0, -0.22, -0.098] });                // lucero
  taller.add(k, bola(0.075, 8), PELAJE, { p: [0, -0.02, 0.02], s: [1, 0.9, 1.1] });        // testuz
  for (const s2 of [-1, 1]) {
    taller.add(k, bola(0.03, 6), 0x171310, { p: [s2 * 0.088, -0.10, -0.045] });            // ojo
    taller.add(k, cil(0.006, 0.03, 0.11, 6), PELAJE, { p: [s2 * 0.055, 0.09, 0.03], r: [-0.25, 0, s2 * 0.26] });
    taller.add(k, bola(0.022, 6), 0x120e0b, { p: [s2 * 0.035, -0.40, -0.045] });           // ollares
  }
  // cabezada
  taller.add(k, caja(0.19, 0.03, 0.03), CUERO, { p: [0, -0.29, -0.02], s: [1, 1, 3.4] });
  taller.add(k, caja(0.19, 0.03, 0.03), CUERO, { p: [0, -0.09, -0.02], s: [1, 1, 3.4] });
  taller.add(k, caja(0.03, 0.24, 0.03), CUERO, { p: [-0.085, -0.19, -0.02], s: [1, 1, 3.2] });
  taller.add(k, caja(0.03, 0.24, 0.03), CUERO, { p: [0.085, -0.19, -0.02], s: [1, 1, 3.2] });

  // Riendas: cuelgan del cuerpo, no de la cabeza. Van de las manos del jinete
  // al bocado, y como la cabeza casi no se mueve, el empalme no se nota.
  for (const s2 of [-1, 1]) {
    taller.add(c, cil(0.012, 0.012, 0.96, 5), CUERO, { p: [s2 * 0.145, 0.585, -0.63], r: [-1.20, 0, 0] });
  }

  // cola: larga y colgando, se levanta sola al galope
  taller.add(h.cola, cil(0.055, 0.12, 0.80, 8), CRIN, { p: [0, -0.38, 0.09], r: [-0.22, 0, 0] });
  taller.add(h.cola, bola(0.10, 7), CRIN, { p: [0, -0.06, 0.03], s: [0.8, 1, 0.9] });

  // patas: las de adelante más finas, las de atrás con garrón
  for (const n of ['DI', 'DD', 'TI', 'TD']) {
    const alto = h['alto' + n], bajo = h['bajo' + n];
    const trasera = n[0] === 'T';
    taller.add(alto, cil(trasera ? 0.15 : 0.115, 0.075, PATA_ALTA, 8), PELAJE,
      { p: [0, -PATA_ALTA / 2, 0], s: [1, 1, trasera ? 1.35 : 1] });
    taller.add(bajo, cil(0.062, 0.048, PATA_BAJA, 8), CRIN, { p: [0, -PATA_BAJA / 2, 0] });
    taller.add(bajo, cil(0.07, 0.075, 0.09, 8), CASCO, { p: [0, -PATA_BAJA - 0.03, 0] });
  }
}

export class Caballo {
  constructor (escena, colisiones, pos) {
    const { raiz, h } = esqueleto();
    const taller = new Taller();
    vestir(taller, h);
    this.mallas = taller.cocinar();
    this.raiz = raiz;
    this.h = h;
    this.escena = escena;
    this.colisiones = colisiones;

    this.pos = new THREE.Vector3().copy(pos || new THREE.Vector3());
    this.rumbo = 0;              // hacia dónde mira el caballo (no el jinete)
    this.vel = 0;
    this.andar = 0;
    this.paso = 0;
    this.vida = VIDA_CABALLO;
    this.vivo = true;
    this.montado = false;
    this.caida = 0;
    this.alto = 0;             // altura sobre el pasto: 0 salvo en el salto
    this.velY = 0;
    this.enElAire = false;
    this.tSalto = 0;
    this.tMuerto = 0;          // el cadáver dura lo mismo que el de un hombre
    this.lado = Math.random() < 0.5 ? 1 : -1;   // para qué costado se desploma
    this.alSaltar = null;
    this.alCaer = null;
    this.jinete = null;        // el Soldado que lo monta, si lo monta uno
    this.golpeo = false;       // chocó de frente en este cuadro
    this.giroReal = 0;         // rad/s de giro efectivo: la cámara se inclina con esto
    this.humo = null;          // si se lo enchufan, los cascos levantan tierra
    this.tPolvo = 0;
    // LEJOS: las patas no se animan y la malla articulada se apaga. Lo
    // dibuja la Lejanía —caballo y jinete horneados juntos en una sola
    // instancia—, porque arriba de la silla el hombre no se mueve solo.
    this.lejos = false;

    // en red, el caballo de la otra máquina: se dibuja pero no se mueve solo
    // ni se puede herir de este lado. Ver soldados.js, «EL TÍTERE».
    this.titere = false;
    this.alCastigo = null;

    // pose de reposo: sin esto el cuello cuelga hacia abajo hasta el primer cuadro
    h.cuello.rotation.x = 2.30;
    h.cabeza.rotation.x = -1.315;
    h.cola.rotation.x = 0.10;

    raiz.position.copy(this.pos);
    escena.add(raiz);
  }

  get altura () { return LOMO + 0.34; }        // altura del asiento
  get nombreAndar () { return ANDARES[this.andar].nombre; }
  get rapidez () { return this.vel; }

  // el sablazo desde el caballo cobra por la velocidad, no por el brazo
  get filoPorVelocidad () { return 1 + Math.min(2, this.vel / 5); }

  subirAndar () { if (this.vivo) this.andar = Math.min(ANDARES.length - 1, this.andar + 1); }
  bajarAndar () { this.andar = Math.max(0, this.andar - 1); }

  // ¿puede saltar ahora? Hace falta batida: parado o al paso, no.
  get puedeSaltar () { return this.vivo && !this.enElAire && this.tSalto <= 0 && this.vel >= SALTO_MINIMO; }

  // El salto. Cuanto más rápido venís, más alto y más lejos: es lo que
  // convierte una tapia en una decisión y no en un freno.
  saltar () {
    if (!this.puedeSaltar) return false;
    this.velY = SALTO_BASE + this.vel * SALTO_POR_VEL;
    this.enElAire = true;
    this.tSalto = SALTO_ESPERA;
    if (this.alSaltar) this.alSaltar(this);
    return true;
  }

  recibir (dano) {
    if (!this.vivo) return false;
    if (this.titere) return this.alCastigo ? !!this.alCastigo({ dano }) : false;
    this.vida -= dano;
    if (this.vida <= 0) {
      this.vivo = false;
      this.caida = 0;
      this.andar = 0;
      this.enElAire = false;
      this.velY = 0;
      // Y AVISA EN EL ACTO. El jinete se baja solo al cuadro siguiente, pero
      // «al cuadro siguiente» no alcanza: los cañones resuelven la metralla
      // DESPUÉS del bucle de soldados, así que ese jinete se dibujaría una vez
      // sentado en el aire sobre un caballo ya desplomado. Un cuadro a 60 son
      // dieciséis milésimas y no se ve; a veinte cuadros por segundo, se ve.
      //
      // Al jugador NO se le avisa —no tiene `jinete`— y es a propósito: cuando
      // a él le matan el caballo no se baja, queda con la pierna abajo. Ahí
      // empieza el acto Cabral.
      // OJO: no se pregunta `jinete.montado`. Ese getter lee `monta.vivo`, que
      // acabamos de poner en false dos líneas más arriba, así que YA da false y
      // la guarda se saltearía siempre a sí misma. Es exactamente la trampa que
      // causó el bicho original. `desmontar` ya sabe volverse solo si no hay
      // nada que desmontar.
      if (this.jinete) this.jinete.desmontar(true);
      return true;
    }
    return false;
  }

  // El caballo de la otra máquina: patas, polvareda y desplome, nada de
  // física. La posición se la escribe red.js con lo que llega del cable.
  actualizarTitere (dt) {
    if (!this.vivo) {
      this.caida = Math.min(1, this.caida + dt * 2.2);
      const e = 1 - Math.pow(1 - this.caida, 3);
      if (!this.poseFija) {
        this.raiz.rotation.z = e * 1.5 * this.lado;
        this.raiz.rotation.x = e * 0.18;
        this.raiz.position.y = this.alto - e * 0.42;
      }
      this._avanzar(dt);
      return;
    }
    this._avanzar(dt);
    if (this.lejos) this.paso += dt * (1.7 + this.vel * 0.62);
    else this._andarPatas(dt);
    this._polvareda(dt);
  }

  actualizar (dt, mando) {
    if (this.titere) return this.actualizarTitere(dt);
    if (!this.vivo) {
      // Se desploma para un costado —el que le tocó— y se queda ahí. El
      // cadáver dura lo mismo que el de un hombre: el campo se llena parejo.
      this.caida = Math.min(1, this.caida + dt * 2.2);
      const e = 1 - Math.pow(1 - this.caida, 3);
      this.vel = Math.max(0, this.vel - dt * 9);
      this.alto = Math.max(0, this.alto - dt * 6);
      // poseFija: alguien le puso la pose a mano —el que lo levantó de encima
      // de una pierna, por ejemplo— y el desplome no se la puede volver a pisar
      if (!this.poseFija) {
        this.raiz.rotation.z = e * 1.5 * this.lado;
        this.raiz.rotation.x = e * 0.18;
        this.raiz.position.y = this.alto - e * 0.42;
      }
      if (this.caida >= 1) this.tMuerto += dt;
      this._avanzar(dt);
      return;
    }

    this.tSalto = Math.max(0, this.tSalto - dt);
    // sin jinete el caballo dispara unos metros y después afloja solo
    if (!this.montado) {
      this.tSuelto = (this.tSuelto || 0) + dt;
      if (this.tSuelto > 2.2) { this.tSuelto = 0; this.andar = Math.max(0, this.andar - 1); }
    } else this.tSuelto = 0;
    const a = ANDARES[this.andar];
    // acelerar cuesta; frenar cuesta más todavía. No se dobla en seco.
    const objetivo = a.vel;
    const k = objetivo > this.vel ? ACEL : FRENO;
    this.vel += Math.max(-k * dt, Math.min(k * dt, objetivo - this.vel));

    // el radio de giro se abre con la velocidad: es la mecánica del acto 3
    const rumboAntes = this.rumbo;
    const t = Math.min(1, this.vel / ANDARES[3].vel);
    const giro = THREE.MathUtils.lerp(ANDARES[0].giro, ANDARES[3].giro, t);
    // en el aire el caballo casi no corrige: el salto se apunta ANTES de batir
    const mando_giro = this.enElAire ? 0.25 : 1;
    if (mando.girar) this.rumbo -= mando.girar * giro * mando_giro * dt;
    // la IA no pulsa teclas: pide un rumbo y el caballo lo busca a su ritmo
    if (mando.hacia !== undefined) {
      let d = mando.hacia - this.rumbo;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.rumbo += Math.max(-giro * mando_giro * dt, Math.min(giro * mando_giro * dt, d));
    }
    if (mando.saltar) this.saltar();

    // vuelo: sube, cae y aterriza perdiendo un poco de carrera
    if (this.enElAire) {
      this.velY -= GRAVEDAD * dt;
      this.alto += this.velY * dt;
      if (this.alto <= 0) {
        this.alto = 0;
        this.velY = 0;
        this.enElAire = false;
        this.vel *= 0.93;
        // el aterrizaje revienta un golpe de tierra bajo los cascos
        if (this.humo && this.vel > 2) {
          this._pol = this._pol || new THREE.Vector3();
          this._dirPol = this._dirPol || new THREE.Vector3();
          this._pol.set(this.pos.x, 0.10, this.pos.z);
          this._dirPol.set(0, 0.8, 0);
          this.humo.soltar(this._pol, this._dirPol, {
            cantidad: 6, vida: 4.5, empuje: 1.8, radio: 0.4,
            opacidad: 0.30, claro: 0.55, tierra: 1
          });
        }
        if (this.alCaer) this.alCaer(this);
      }
    }

    let dg = this.rumbo - rumboAntes;
    dg = Math.atan2(Math.sin(dg), Math.cos(dg));
    this.giroReal = dt > 0 ? dg / dt : 0;

    this.pos.x += -Math.sin(this.rumbo) * this.vel * dt;
    this.pos.z += -Math.cos(this.rumbo) * this.vel * dt;
    this._chocar();
    this._avanzar(dt);
    // a la distancia el paso lo pone la Lejanía alternando dos fotogramas;
    // acá sólo hay que seguir contándolo para que no se corte al volver
    if (this.lejos) this.paso += dt * (1.7 + this.vel * 0.62);
    else this._andarPatas(dt);
    this._polvareda(dt);
  }

  // LA POLVAREDA.
  //
  // No es decoración: sale por el MISMO sistema que el humo de pólvora, así
  // que entra en la grilla de densidad que consultan el jugador y la IA para
  // ver. Una carga de caballería se tapa a sí misma, y eso es exactamente lo
  // que pasaba en un campo seco de febrero. Levanta desde el trote —al paso un
  // caballo no hace polvo— y la cantidad sale de la velocidad.
  _polvareda (dt) {
    if (!this.humo || this.vel < 2.6 || this.alto > 0.2) return;
    this.tPolvo -= dt;
    if (this.tPolvo > 0) return;
    const fuerza = Math.min(1, (this.vel - 2.6) / 7.6);
    // El pozo de nubes es de 700 y lo comparte con la pólvora, que es una
    // mecánica —tapa la línea de tiro de la IA— y no puede quedarse sin lugar.
    // Una bocanada cada metro y medio, grande y de vida corta, alcanza para
    // que la estela se lea sin comerse el presupuesto.
    this.tPolvo = 0.20 - fuerza * 0.07;
    const atras = 0.55;
    const px = this.pos.x + Math.sin(this.rumbo) * atras;
    const pz = this.pos.z + Math.cos(this.rumbo) * atras;
    this._pol = this._pol || new THREE.Vector3();
    this._dirPol = this._dirPol || new THREE.Vector3();
    this._pol.set(px, 0.12, pz);
    // la tierra sale para atrás y hacia arriba, siguiendo la estela
    this._dirPol.set(Math.sin(this.rumbo) * 0.7, 0.55, Math.cos(this.rumbo) * 0.7);
    this.humo.soltar(this._pol, this._dirPol, {
      cantidad: 1,
      vida: 2.2 + fuerza * 1.6,
      empuje: 0.7 + fuerza * 1.5,
      radio: 0.32 + fuerza * 0.30,
      opacidad: 0.26 + fuerza * 0.30,
      claro: 0.55,
      tierra: 1
    });
  }

  _avanzar () {
    this.raiz.visible = !this.lejos;
    if (this.lejos) return;
    this.raiz.position.x = this.pos.x;
    this.raiz.position.z = this.pos.z;
    if (this.vivo) this.raiz.position.y = this.alto;
    this.raiz.rotation.y = this.rumbo;
  }

  // ¿Hay algo saltable a `metros` de la nariz? La IA lo consulta para batir a
  // tiempo; el jugador lo tiene a la vista y decide solo.
  obstaculoAdelante (metros = 5) {
    const fx = -Math.sin(this.rumbo), fz = -Math.cos(this.rumbo);
    for (let d = 1.2; d <= metros; d += 0.8) {
      const x = this.pos.x + fx * d, z = this.pos.z + fz * d;
      for (const c of this.colisiones) {
        if (c.max.y < 0.5 || c.max.y > 1.45) continue;    // muy bajo o intocable
        if (x > c.min.x - 0.6 && x < c.max.x + 0.6 && z > c.min.z - 0.6 && z < c.max.z + 0.6) return d;
      }
    }
    return 0;
  }

  // Contra un obstáculo el caballo NO se planta: roza y sigue. Sólo el choque
  // de frente le cuesta la carrera, y lo que salta lo pasa de largo.
  //
  // La diferencia la hace `frente`: 1 es de lleno contra la pared, 0 es
  // pasarle raspando. De refilón se desliza por la tangente sin perder casi
  // nada; de lleno pierde la mitad y baja un andar.
  _chocar () {
    const fx = -Math.sin(this.rumbo), fz = -Math.cos(this.rumbo);
    for (const c of this.colisiones) {
      // por encima del obstáculo: lo está saltando, pasa limpio
      if (this.alto + PANZA >= c.max.y) continue;
      const cx = Math.max(c.min.x, Math.min(this.pos.x, c.max.x));
      const cz = Math.max(c.min.z, Math.min(this.pos.z, c.max.z));
      const dx = this.pos.x - cx, dz = this.pos.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= RADIO * RADIO || c.max.y < 0.5) continue;
      let nx, nz;
      if (d2 < 1e-6) {
        // quedó adentro de la caja: se lo saca por la cara más próxima
        const ix = Math.min(this.pos.x - c.min.x, c.max.x - this.pos.x);
        const iz = Math.min(this.pos.z - c.min.z, c.max.z - this.pos.z);
        if (ix < iz) { nx = this.pos.x - c.min.x < c.max.x - this.pos.x ? -1 : 1; nz = 0; }
        else { nx = 0; nz = this.pos.z - c.min.z < c.max.z - this.pos.z ? -1 : 1; }
        this.pos.x = (nx < 0 ? c.min.x : nx > 0 ? c.max.x : this.pos.x) + nx * RADIO;
        this.pos.z = (nz < 0 ? c.min.z : nz > 0 ? c.max.z : this.pos.z) + nz * RADIO;
      } else {
        const d = Math.sqrt(d2);
        nx = dx / d; nz = dz / d;
        this.pos.x = cx + nx * RADIO;
        this.pos.z = cz + nz * RADIO;
      }

      // EL CABALLO NO SE CLAVA. NUNCA.
      //
      // Antes, si el golpe venía bastante de frente, se le partía la velocidad
      // al medio y se le bajaba el andar. Un caballo que se frena en seco
      // contra una tapia mata la dinámica del juego: venís al galope, rozás una
      // esquina y quedás parado en medio del campo con doscientos cincuenta
      // fusiles enfrente. Lo que hace un caballo de verdad contra una pared es
      // RASPARLA Y SEGUIR.
      //
      // Así que ahora hay un solo camino: siempre desliza. Venir de frente
      // sigue costando —cuesta velocidad y cuesta un giro brusco—, pero no
      // cuesta la carrera.
      const frente = Math.max(0, -(fx * nx + fz * nz));
      if (frente > 0.72) this.golpeo = true;     // se oye y se siente; no frena

      // el precio, con piso: una tapia nunca te puede dejar por debajo del paso
      const piso = Math.min(this.vel, ANDARES[1].vel * 0.85);
      this.vel = Math.max(this.vel * (1 - frente * 0.42), piso);

      // Y EL RUMBO SE ACOMODA A LA PARED, rodeándola por la punta que tiene más
      // cerca. Elegir el costado por hacia dónde mira el caballo no sirve:
      // cuando el golpe es de frente el producto da cero, el costado se sortea
      // de nuevo cada cuadro y el animal queda vibrando contra el mismo
      // ladrillo. La punta más cercana, en cambio, no cambia porque él se
      // corra: es una decisión y se sostiene.
      let tx, tz;
      if (Math.abs(nz) > Math.abs(nx)) {
        tx = (c.max.x - this.pos.x) < (this.pos.x - c.min.x) ? 1 : -1;
        tz = 0;
      } else {
        tx = 0;
        tz = (c.max.z - this.pos.z) < (this.pos.z - c.min.z) ? 1 : -1;
      }
      const rumboPared = Math.atan2(-tx, -tz);
      let dif = rumboPared - this.rumbo;
      dif = Math.atan2(Math.sin(dif), Math.cos(dif));
      this.rumbo += dif * (0.55 + frente * 0.40);
    }
    // Los bordes del mundo. El techo de z era 20 —el frente del convento— y eso
    // alcanzaba mientras todo pasaba en el campo. Pero la pinza se forma DETRÁS
    // del convento, que llega hasta z=66, así que el mundo tiene que llegar más
    // atrás que el convento o la maniobra no cabe donde ocurrió.
    this.pos.x = Math.max(-62, Math.min(62, this.pos.x));
    this.pos.z = Math.max(-105, Math.min(78, this.pos.z));
  }

  // Galope transversal: las cuatro patas con desfases distintos. La amplitud
  // y la cadencia salen de la velocidad, así el andar nunca desentona.
  _andarPatas (dt) {
    const v = this.vel;
    if (this.enElAire) {
      // en el aire recoge las manos y estira los cuartos traseros; el cuello
      // se tiende hacia adelante. Es la silueta clásica del salto.
      const k = 1 - Math.exp(-14 * dt);
      const subiendo = this.velY > 0;
      for (const n of ['DI', 'DD']) {
        this.h['alto' + n].rotation.x += ((subiendo ? -1.15 : -0.35) - this.h['alto' + n].rotation.x) * k;
        this.h['bajo' + n].rotation.x += (-1.5 - this.h['bajo' + n].rotation.x) * k;
      }
      for (const n of ['TI', 'TD']) {
        this.h['alto' + n].rotation.x += ((subiendo ? 0.55 : 0.95) - this.h['alto' + n].rotation.x) * k;
        this.h['bajo' + n].rotation.x += (-0.35 - this.h['bajo' + n].rotation.x) * k;
      }
      this.h.cuerpo.rotation.x += ((subiendo ? -0.22 : 0.16) - this.h.cuerpo.rotation.x) * k;
      this.h.cuello.rotation.x += ((2.30 - 0.30) - this.h.cuello.rotation.x) * k;
      this.h.cabeza.rotation.x += (-1.315 - this.h.cabeza.rotation.x) * k;
      this.h.cola.rotation.x += (-0.60 - this.h.cola.rotation.x) * k;
      this.h.cuerpo.position.y = LOMO;
      this.paso += dt * (1.7 + v * 0.62);
      return;
    }
    const cad = 1.7 + v * 0.62;
    this.paso += dt * cad;
    const amp = Math.min(0.75, 0.16 + v * 0.075);
    const fases = { DI: 0, DD: 0.16, TI: 0.52, TD: 0.68 };
    for (const n of ['DI', 'DD', 'TI', 'TD']) {
      const f = (this.paso + fases[n] * Math.PI * 2) % (Math.PI * 2);
      const s = Math.sin(f);
      this.h['alto' + n].rotation.x = s * amp;
      this.h['bajo' + n].rotation.x = -Math.max(0, Math.sin(f - 0.9)) * amp * 1.25;
    }
    // el cuerpo se hunde y se estira, y el cuello bombea al galope
    const brinco = Math.min(1, v / ANDARES[3].vel);
    this.h.cuerpo.position.y = LOMO + Math.sin(this.paso * 2) * 0.05 * brinco;
    this.h.cuerpo.rotation.x = Math.sin(this.paso * 2 + 0.7) * 0.07 * brinco;
    this.h.cuello.rotation.x = 2.30 + Math.sin(this.paso * 2 - 0.4) * 0.16 * brinco;
    this.h.cabeza.rotation.x = -1.315 - Math.sin(this.paso * 2 - 0.4) * 0.10 * brinco;
    this.h.cola.rotation.x = 0.10 - brinco * 0.50;
  }

  quitar () { this.escena.remove(this.raiz); }
}
