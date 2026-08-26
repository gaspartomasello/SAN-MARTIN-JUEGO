import * as THREE from 'three';
import { Soldado } from './soldados.js';
import { PIEL_CABRAL } from './figura.js';

// EL ACTO CABRAL.
//
// 3 de febrero de 1813. La metralla voltea el caballo de San Martín, que cae
// con la pierna aprisionada debajo. Un soldado español se le viene encima con
// la bayoneta. Y entonces llega el sargento JUAN BAUTISTA CABRAL —correntino,
// afrodescendiente, hijo de esclavos— que lo cubre, mata al que iba a matarlo,
// levanta el caballo para sacarle la pierna, y recibe él las heridas de las
// que muere.
//
// -------------------------------------------------------------------------
// La decisión de diseño más importante del juego está acá, y es esta:
//
//   EL JUGADOR NO PUEDE HACER NADA.
//
// Todo el resto del juego es agencia: elegís el andar, medís la distancia,
// parás la estocada. Acá no. La pierna está debajo de media tonelada de animal
// muerto y no hay tecla que sirva; se puede forcejear y el forcejeo no
// alcanza. Es tentador darle al jugador un botón que lo salve, y sería una
// mentira: lo salvó otro. Un hombre al que la historia escolar recuerda por
// una frase y casi nunca por su cara, su color ni su nombre completo.
//
// La única forma de que eso se sienta es que el jugador esté genuinamente
// indefenso durante veinte segundos y tenga que mirar. Por eso el forcejeo
// tiene una barra que sube y se vuelve a caer: no es un desafío, es una
// respuesta honesta a «¿puedo hacer algo?». No.
// -------------------------------------------------------------------------

const FRASE = 'Muero contento, hemos batido al enemigo.';

// tiempos del acto, en segundos desde que cae el caballo
// Los tiempos NO son arbitrarios: salen de cuánto tarda cada uno en llegar
// caminando o corriendo con las velocidades que ya tiene el juego. El español
// sale a 5,6 m y marcha a 1,85 m/s; Cabral sale a 11,5 m por detrás y corre a
// 4,3. Si el guion se adelantara a las piernas, se vería el truco.
const T_AMENAZA = 2.2;      // el español lo ve en el suelo y se le viene
const T_CABRAL = 3.8;       // aparece corriendo por detrás
const T_SALVA = 7.4;        // mata al que iba a ensartarlo
const T_LEVANTA = 8.8;      // se hinca y empuja el caballo
const T_LIBRE = 11.0;       // la pierna sale
const T_HERIDO = 12.0;      // el segundo español lo alcanza
const T_FRASE = 13.8;
const T_FIN = 19.0;

export class ActoCabral {
  constructor (ctx) {
    this.ctx = ctx;             // { escena, humo, sonido, jugador, soldados, hud, canones, parapetos }
    this.corriendo = false;
    this.t = 0;
    this.cabral = null;
    this.verdugo = null;
    this.segundo = null;
    this.caballo = null;
    this.hecho = false;
    this.forcejeo = 0;
    this._paso = 0;
  }

  get activo () { return this.corriendo; }

  // ¿Se dan las condiciones? Una sola vez por partida, y sólo si te voltearon
  // el caballo estando montado —que es como pasó—.
  puedeArrancar (caballo) {
    return !this.hecho && !this.corriendo && !!caballo && this.ctx.jugador.vivo;
  }

  arrancar (caballo) {
    const { jugador, hud, sonido } = this.ctx;
    this.corriendo = true;
    this.hecho = true;
    this.t = 0;
    this.forcejeo = 0;
    this.caballo = caballo;
    this._paso = 0;
    caballo.montado = false;

    // el caballo cae de costado y encima de la pierna
    const rumbo = caballo.rumbo;
    jugador.atrapar(
      caballo.pos.x - Math.sin(rumbo) * 0.5,
      caballo.pos.z - Math.cos(rumbo) * 0.5,
      rumbo + 0.55);
    jugador.sacudir(1.0);
    sonido.golpeRecibido();
    hud.mostrarAviso('¡El caballo!', 'malo');
    return true;
  }

  // El forcejeo. Sube mientras apretás y se vuelve a caer sola. NUNCA llega.
  forcejear (dt, apretando) {
    if (apretando) this.forcejeo = Math.min(0.82, this.forcejeo + dt * 0.55);
    else this.forcejeo = Math.max(0, this.forcejeo - dt * 0.9);
    return this.forcejeo;
  }

  _traer (bando, x, z, op) {
    const { escena, humo, sonido, soldados, parapetos } = this.ctx;
    const s = new Soldado(escena, humo, sonido, new THREE.Vector3(x, 0, z), bando,
      Object.assign({ cubiertas: parapetos }, op || {}));
    soldados.push(s);
    return s;
  }

  actualizar (dt, teclas) {
    if (!this.corriendo) return;
    const { jugador, hud, sonido } = this.ctx;
    this.t += dt;
    this.forcejear(dt, teclas.has('Space'));

    const jx = jugador.pos.x, jz = jugador.pos.z;

    // ---- 1. el español lo ve en el suelo ----
    if (this.t >= T_AMENAZA && this._paso < 1) {
      this._paso = 1;
      // Camina solo hasta vos: sos lo más cercano que tiene enfrente y estás
      // en el suelo. No hace falta guionarlo. Lo único que se le saca es la
      // capacidad de rematarte, porque la historia dice que no llegó.
      this.verdugo = this._traer('realista', jx + 1.9, jz - 5.6);
      this.verdugo.alGolpear = null;
      jugador.mirarA(this.verdugo.pos.x, this.verdugo.pos.z, 1.35);
      hud.mostrarAviso('¡Se te viene encima!', 'malo');
    }

    // ---- 2. Cabral llega corriendo ----
    if (this.t >= T_CABRAL && this._paso < 2) {
      this._paso = 2;
      // Tampoco a él hace falta guionarlo: un granadero con el fusil descargado
      // y un español a doce metros CORRE a la bayoneta. Es la misma regla de
      // siempre. Lo único que se le toca es que no puede morir todavía.
      this.cabral = this._traer('granadero', jx - 2.4, jz + 11.5, { tez: PIEL_CABRAL });
      this.cabral.esCabral = true;
      this.cabral.recarga = 40;           // descargado: se va a la carrera
      this.cabral.vida = 99;
      jugador.mirarA(this.cabral.pos.x, this.cabral.pos.z);
      sonido.grito();
      hud.decir('Sargento Cabral');
    }

    // ---- 3. mata al que iba a ensartarlo ----
    if (this.t >= T_SALVA && this._paso < 3) {
      this._paso = 3;
      if (this.verdugo && this.verdugo.vivo) {
        this.verdugo.recibir(9);
        sonido.impactoCarne();
      }
      if (this.cabral) this.cabral.fig.poner('estocada');
      jugador.sacudir(0.35);
    }

    // ---- 4. se hinca y empuja el caballo ----
    if (this.t >= T_LEVANTA && this._paso < 4) {
      this._paso = 4;
      if (this.cabral) { this.cabral.rodilla = true; this.cabral.fig.rodilla = true; }
      hud.decir('Cabral levanta el caballo');
    }
    // Los españoles LOMEAN, no se te suben encima. Tirado en el pasto la
    // cámara está a 62 cm: un hombre parado a metro y medio le tapa la pantalla
    // entera y no se ve nada de lo que pasa. Se los mantiene a dos metros y
    // medio, que es donde se los ve enteros y amenazan de verdad.
    // NADIE se te sube encima. Tirado en el pasto la cámara está a 62 cm: un
    // hombre parado a un metro tapa la pantalla entera con el calzón y no se ve
    // nada de lo que pasa. Se los mantiene a dos metros y medio, que es donde
    // se los ve enteros y donde amenazan de verdad. Cabral se acerca más, pero
    // sólo cuando se hinca a levantar el caballo.
    const cerca = this._paso >= 4 ? 1.7 : 2.5;
    for (const r of [this.verdugo, this.segundo, this.cabral]) {
      if (!r || !r.vivo) continue;
      const min = r === this.cabral ? cerca : 2.5;
      const dx = r.pos.x - jx, dz = r.pos.z - jz;
      const d = Math.hypot(dx, dz);
      if (d < min && d > 0.01) {
        r.pos.x = jx + (dx / d) * min;
        r.pos.z = jz + (dz / d) * min;
      }
    }

    // desde que aparece, la cabeza no lo suelta
    if (this.cabral && this.cabral.vivo && this._paso >= 2) {
      jugador.mirarA(this.cabral.pos.x, this.cabral.pos.z,
        this._paso >= 4 && this._paso < 6 ? 0.95 : 1.35);
    }

    if (this._paso >= 4 && this._paso < 5 && this.caballo) {
      // el cuerpo del animal se va levantando de a poco
      const u = Math.min(1, (this.t - T_LEVANTA) / (T_LIBRE - T_LEVANTA));
      this.caballo.actualizado = true;      // que el bucle no le pise la pose
      this.caballo.raiz.rotation.z = 1.5 * this.caballo.lado * (1 - u * 0.42);
      this.caballo.raiz.position.y = u * 0.30;
      jugador.sacudir(0.06);
    }

    // ---- 5. la pierna sale ----
    if (this.t >= T_LIBRE && this._paso < 5) {
      this._paso = 5;
      // el animal queda corrido para siempre: no se vuelve a desplomar encima
      if (this.caballo) {
        this.caballo.poseFija = true;
        this.caballo.raiz.rotation.z = 1.5 * this.caballo.lado * 0.58;
        this.caballo.raiz.position.y = 0.30;
      }
      jugador.liberar();
      jugador.recibir(0, new THREE.Vector3(0, 0, 1));
      if (this.cabral) { this.cabral.rodilla = false; this.cabral.fig.rodilla = false; }
      hud.mostrarAviso('Libre', 'bien');
    }

    // ---- 6. el segundo español lo alcanza ----
    if (this.t >= T_HERIDO && this._paso < 6) {
      this._paso = 6;
      this.segundo = this._traer('realista', jx - 2.9, jz + 4.6);
      this.segundo.alGolpear = null;
      if (this.cabral) {
        this.cabral.vida = 1;
        this.cabral.recibir(1);           // cae ahí mismo
        sonido.impactoCarne();
      }
      hud.mostrarAviso('¡Cabral!', 'malo');
    }

    // ---- 7. la frase ----
    if (this.t >= T_FRASE && this._paso < 7) {
      this._paso = 7;
      hud.decir(FRASE, 5.2);
    }

    if (this.t >= T_FIN) {
      this.corriendo = false;
      hud.decir('Juan Bautista Cabral · sargento de Granaderos · hijo de esclavos', 6);
    }
  }
}
