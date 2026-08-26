import * as THREE from 'three';
import { Figura } from './figura.js';
import { Caballo } from './caballo.js';
import { sacarDeCaja, RADIO_HOMBRE } from './estorbos.js';

// Soldados de los dos bandos. Misma anatomía, distinta casaca:
//   granadero — casaca azul, vivos encarnados, morrión con penacho
//   realista  — casaca blanca, correaje de ante, sombrero redondo
// Buscan al enemigo vivo más cercano del otro bando, avisan antes de la
// descarga y su percepción consulta la MISMA grilla de humo que ve el jugador:
// si la nube tapa, pierden de vista y caminan a donde vieron por última vez.

const VEL = 1.85;
const VEL_CARRERA = 4.3;        // a la carrera, con el fusil corto y bajo
const ALCANCE_TIRO = 62;
const ALCANCE_ACERO = 1.9;
const RECARGA = 12.5;

// ---- carrera, parapeto y rodilla ----
//
// Un soldado con el fusil descargado y el enemigo a menos de 16 m no se queda
// a recargar: se le va encima a la bayoneta. Y uno con el fusil cargado no
// dispara parado en medio del campo si tiene una tapia a mano.
const CARGA_BAYONETA = 16;
const CARGA_TOQUE = 2.5;        // a esta distancia el que viene corriendo ya ensartó
const CUBIERTA_BUSCAR = 24;     // radio en el que mira si hay parapeto
const CUBIERTA_MINIMA = 6;      // no se parapeta encima del enemigo
const CUBIERTA_LLEGADA = 1.1;
const RODILLA_SUELTA = 0.42;    // probabilidad de hincarla a campo abierto

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
// ---- QUEDARSE EN LA SILLA ----
//
// Antes, cualquier golpe de 3 o más te bajaba del caballo. Y como todos los
// golpes que valía la pena dar eran de 3 o más, en la práctica eso quería
// decir: TODO te desmonta, siempre, al cien por ciento. Un balazo, un
// bayonetazo, lo que fuera.
//
// Está mal por dos motivos. Uno de juego: perder la montura es lo más caro que
// te puede pasar en este juego y no puede ser un trámite; si es automático,
// pelear a caballo se vuelve una cuenta regresiva y no una decisión. Y uno
// histórico: San Martín cruzó el campo montado, aguantó la descarga y lo bajó
// UNA cosa. No fue la mosquetería. Fue la metralla.
//
// Así que agarrarse a la silla pasa a ser una tirada, y cada arma tiene la
// suya. Lo que se lee en esta tabla es una jerarquía: la bala te tira poco
// —te pega, no te empuja—, la bayoneta desde abajo te busca la pierna y el
// estribo, el asta del lancero te levanta de la silla porque para eso se
// inventó, y la metralla no pregunta.
export const VOLTEO = {
  bala: 0.20,
  bayoneta: 0.34,
  lanza: 0.58,
  metralla: 1
};

// Lo que resta un jinete de oficio. San Martín no era un recluta arriba de un
// caballo: era comandante de caballería. Con esto, un balazo lo baja una vez
// cada trece; a un lancero de la tropa, una de cada cinco.
export const OFICIO = 0.62;

const LANZA_ALCANCE = 3.6;      // 2,70 m de asta más el brazo desde la silla
const LANZA_ENRISTRE = 15;      // a esta distancia baja el asta: el aviso largo
const LANZA_AVISO = 5.4;        // y a esta se echa atrás: el aviso corto
const PASADA = 1.5;             // segundos de seguir de largo antes de volver
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
    this._d = new THREE.Vector3();

    // Estorbos. Antes el soldado era un fantasma: cruzaba las tapias y se
    // metía adentro del compañero. Ahora ocupa lugar como todo el mundo.
    this.colisiones = op.colisiones || null;
    this.orden = Soldado.proximoOrden++;     // para resolver cada par una sola vez
    this._n = { x: 0, z: 0 };

    this.cubiertas = op.cubiertas || null;   // parapetos del campo, ya filtrados
    this.cubierta = null;                   // a dónde va corriendo
    this.motivo = null;                     // 'cubierta' o 'carga'
    this.rodilla = false;                   // rodilla en tierra: va a disparar
    this.tCubierta = 0;                     // para no re-buscar parapeto cada cuadro
    this.ritmo = 1;                         // 1 marcha, 2,3 carrera
    this.puesto = null;                     // los artilleros no abandonan la pieza
    this.correa = 4.5;                      // metros que se puede alejar del puesto

    // LEJANÍA: a partir de cierta distancia deja de armarse hueso por hueso
    // y lo dibuja una instancia horneada. La IA no cambia en nada.
    this._lejos = false;
    this.andando = false;

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
  // ---------------------------------------------------------- lejanía
  //
  // Quién lo dibuja: de cerca, quince mallas articuladas; de lejos, una
  // instancia compartida con todos los que están en la misma postura. Lo
  // decide la distancia y nada más. La IA corre igual de un lado y del otro:
  // el que está a ochenta metros apunta, avisa, dispara y muere exactamente
  // como el que tenés encima.
  ponerLejos (v) {
    this._lejos = v;
    this.fig.lejos = v;
    this.malla.visible = !v;
    if (this.monta) this.monta.lejos = v;
  }

  get lejos () { return this._lejos; }

  // Deja su matriz en el lote que le toca. El paso se anima alternando los dos
  // fotogramas horneados —así caminaban los soldados hace treinta años y a
  // esta distancia se lee igual de bien.
  pintarLejos (lej) {
    if (!this._lejos) return;
    if (this.montado) {
      const c = this.monta;
      const p = this.fig.pose;
      const enristre = p === 'enristre' || p === 'lanzaAviso' || p === 'lanzazo';
      // el caballo va horneado con el jinete: una instancia, no dos
      lej.poner('lancero', enristre ? 2 : (Math.sin(c.paso) > 0 ? 0 : 1),
        c.pos.x, c.alto, c.pos.z, c.rumbo);
      return;
    }
    const p = this.fig.pose;
    const fase = !this.vivo ? 3
      : this.rodilla ? 4
      : (p === 'apuntar' || p === 'recargar') ? 5
      : this.andando ? (Math.sin(this.fig.paso) > 0 ? 1 : 2)
      : 0;
    const m = this.malla;
    lej.poner(this.bando === 'granadero' ? 'granadero' : 'realista', fase,
      m.position.x, m.position.y, m.position.z, m.rotation.y, this.fig.raiz.scale.y);
  }

  _sentar () {
    const c = this.monta;
    const asiento = c.altura - 0.92 * this.fig.raiz.scale.y;
    this.malla.position.set(c.pos.x, c.alto + asiento, c.pos.z);
    this.malla.rotation.y = c.rumbo;
  }

  get pos () { return this.malla.position; }
  get esRealista () { return this.bando === 'realista'; }

  cabeza () { return this._v.set(this.pos.x, this.pos.y + this.fig.alturaOjo, this.pos.z); }

  // volteo: probabilidad de que este golpe lo saque de la silla (0 si el arma
  // no puede). Si la tirada sale, no hay daño: rueda, se levanta y sigue a pie
  // con lo que le quede. Un lancero derribado vale mucho más vivo que borrado
  // del campo. Si la tirada NO sale, el golpe entra como cualquier otro: la
  // bayoneta que no te voltea, te hiere.
  recibir (dano, dir, volteo = 0) {
    if (!this.vivo) return false;
    if (this.montado && volteo > 0 && Math.random() < volteo) { this.desmontar(true); return false; }
    this.vida -= dano;
    if (this.vida <= 0) {
      this.vivo = false;
      this.estado = 'caido';
      this.caida = 0;
      this.avisando = false;
      this.sonido.grito();
      if (this.rodilla) { this.rodilla = false; this.fig.rodilla = false; }
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

  // El enemigo vivo más cercano del otro bando; para los realistas, el jugador
  // también cuenta.
  //
  // La distancia se mide SOBRE EL PISO, no en tres dimensiones. Parece un
  // detalle y no lo es: jugador.pos.y está a la altura del ojo (1,68 m) y el
  // soldado tiene los pies en 0, así que la distancia 3D nunca bajaba de 1,68.
  // Con ALCANCE_ACERO en 1,9 eso dejaba el alcance real de la bayoneta en 89
  // centímetros —el enemigo tenía que meterse casi adentro tuyo para poder
  // usarla— y es buena parte de por qué el cuerpo a cuerpo casi no aparecía.
  // Un hombre parado a dos metros está a dos metros, no a dos y medio.
  _distancia (p) {
    const dx = p.x - this.pos.x, dz = p.z - this.pos.z;
    return Math.sqrt(dx * dx + dz * dz);
  }

  _elegirObjetivo (jugador, soldados) {
    let mejor = null;
    let mejorD = Infinity;
    if (this.esRealista && jugador.vivo) {
      mejorD = this._distancia(jugador.pos);
      mejor = { pos: jugador.pos, jugador: true };
    }
    for (const s of soldados) {
      if (s === this || !s.vivo || s.bando === this.bando) continue;
      const d = this._distancia(s.pos);
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

    // EL JINETE SE ACTUALIZA SIEMPRE, haya blanco o no.
    //
    // Esto estaba mal y se veía feo: la salida temprana por «no hay a quién
    // atacar» se comía la rama montada, así que el hombre dejaba de sentarse
    // en la silla mientras el bucle principal seguía moviéndole el caballo. El
    // caballo se iba solo y el jinete quedaba flotando en el aire hasta que
    // apareciera un enemigo y volviera a engancharse de un salto. Pasaba cada
    // vez que el campo quedaba limpio —entre tanda y tanda de realistas, o
    // justo después de que un lanzazo matara al último—, que es exactamente
    // cuando más se nota. El asiento no puede depender de que haya enemigos.
    if (this.montado) {
      this.t += dt;
      if (this.aturdido > 0) this.aturdido -= dt;
      let destino = null;
      if (this.objetivo) {
        const obj = this._d.set(this.objetivo.pos.x, 0, this.objetivo.pos.z);
        this.teVe = this.humo.oclusion(this.pos, this.objetivo.pos) < 0.55 && dist < 95;
        if (this.teVe) this.ultimoVisto.copy(obj);
        destino = this.teVe ? obj : this.ultimoVisto;
      }
      this._cargarALanza(dt, this.objetivo ? dist : Infinity, destino);
      this.fig.actualizar(dt, false);
      return;
    }

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
    this.tCubierta = Math.max(0, this.tCubierta - dt);
    this.ritmo = 1;
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
        this._parar();
        if (dist < ALCANCE_ACERO) { this._entrarAcero(); break; }

        // Fusil descargado y el enemigo encima: no se queda a recargar bajo
        // fuego. Baja el arma y se le va a la carrera con la bayoneta puesta.
        if (this.teVe && this.recarga > 0 && dist < CARGA_BAYONETA) {
          this.estado = 'correr'; this.motivo = 'carga'; this.cubierta = null;
          this.sonido.grito();
          break;
        }

        if (this.teVe && dist < ALCANCE_TIRO && this.recarga <= 0) {
          // ¿hay una tapia, un carro, un barril? Nadie descarga parado en
          // medio del campo si tiene dónde apoyarse.
          const cub = this._buscarCubierta(objetivo, dist);
          if (cub) {
            this.cubierta = cub; this.estado = 'correr'; this.motivo = 'cubierta';
            break;
          }
          this._encarar(Math.random() < RODILLA_SUELTA);
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

      // A la carrera. Dos motivos y dos finales distintos: el que va al
      // parapeto llega y se hinca; el que va a la bayoneta llega y ensarta.
      case 'correr': {
        this._dePie();
        // EL BAYONETAZO DE LA CARGA.
        //
        // El que viene corriendo con la bayoneta puesta no frena, se planta y
        // recién entonces tira la estocada: el golpe lo pone el impulso. Con
        // llegar alcanza. Después sí se cruza el acero y empieza el duelo
        // normal, con su aviso y su ventana de parada —pero el primer golpe de
        // una carga no se avisa, porque una carga no se avisa.
        if (this.motivo === 'carga' && dist < CARGA_TOQUE) {
          if (this.alGolpear) this.alGolpear(this, this.objetivo);
          this.fig.poner('estocada');
          this._entrarAcero();
          this._pego = true;          // no repite el golpe al entrar en guardia
          break;
        }
        if (dist < ALCANCE_ACERO) { this._entrarAcero(); break; }
        this.fig.poner('correr');
        let bx, bz;
        if (this.motivo === 'cubierta' && this.cubierta) { bx = this.cubierta.x; bz = this.cubierta.z; }
        else { bx = destino.x; bz = destino.z; }
        const dx = bx - this.pos.x, dz = bz - this.pos.z;
        const d = Math.hypot(dx, dz);
        this.malla.rotation.y = Math.atan2(dx / (d || 1), dz / (d || 1)) + Math.PI;
        if (d > (this.motivo === 'cubierta' ? CUBIERTA_LLEGADA : 0.6)) {
          this.pos.x += (dx / (d || 1)) * VEL_CARRERA * dt;
          this.pos.z += (dz / (d || 1)) * VEL_CARRERA * dt;
          andando = true;
          this.ritmo = 2.3;
        } else if (this.motivo === 'cubierta') {
          // llegó al parapeto: rodilla en tierra y a apuntar por encima
          this.malla.rotation.y = Math.atan2(hacia.x, hacia.z) + Math.PI;
          this._encarar(true);
        } else {
          this.estado = 'avanzar';
        }
        // si mientras corre se le acabó el motivo, vuelve a la marcha
        if (this.motivo === 'cubierta' && this.recarga > 0) { this.estado = 'avanzar'; this.cubierta = null; }
        break;
      }
      case 'apuntar': {
        // encima tuyo no se queda encarando: baja el fusil y cruza el acero
        if (dist < ALCANCE_ACERO) { this._entrarAcero(); break; }
        this.fig.poner('apuntar');
        // de rodillas apunta más despacio y con más cuidado
        if (this.t > (this.rodilla ? 1.9 : 1.5)) {
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
        // se recarga donde se disparó: si se hincó, sigue hincado
        if (this.t > 2.5) { this._parar(); this.estado = 'avanzar'; this.fig.poner('marcha'); }
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

    // El que tiene puesto no lo abandona. Un artillero que sale corriendo a
    // dar bayonetazos deja la pieza muda, y la pieza vale más que él.
    if (this.puesto) {
      const dx = this.pos.x - this.puesto.x, dz = this.pos.z - this.puesto.z;
      const d = Math.hypot(dx, dz);
      if (d > this.correa) {
        this.pos.x = this.puesto.x + (dx / d) * this.correa;
        this.pos.z = this.puesto.z + (dz / d) * this.correa;
      }
    }

    this._chocar();
    this.andando = andando;
    this.fig.actualizar(dt, andando, this.ritmo);
  }

  // Contra el decorado. Igual que el jugador y que el caballo: se lo saca de
  // la caja por la cara más cercana y sigue caminando pegado a la pared. Sólo
  // cuentan las cajas que le llegan por arriba de la rodilla —un cordón de 30
  // cm no es un obstáculo para un hombre, es un escalón.
  _chocar () {
    if (!this.colisiones) return;
    for (const caja of this.colisiones) {
      if (caja.max.y < 0.35) continue;
      const e = sacarDeCaja(this.pos, RADIO_HOMBRE, caja, this._n);
      if (e <= 0) continue;

      // Y DESLIZA. Sin esto un hombre que camina de frente contra una tapia se
      // queda apretado contra ella para siempre: la IA le vuelve a apuntar al
      // mismo destino cuadro tras cuadro y no tiene con qué rodearla. Lo que
      // se le empujó para atrás se le devuelve de costado.
      //
      // Y el costado se elige POR LA TAPIA, no por hacia dónde mira. El primer
      // intento usaba el rumbo del hombre y temblaba: al correrse un centímetro
      // el rumbo giraba, el costado se daba vuelta y volvía al punto de
      // partida. Se pasó cinco segundos vibrando contra el mismo ladrillo.
      //
      // Ahora rodea por la punta que tiene más cerca, que además es lo que
      // haría cualquiera. Es una decisión estable —la punta más cercana no
      // cambia porque él se corra— y de yapa reparte a la tropa: los de la
      // izquierda salen por izquierda y los de la derecha por derecha.
      let tx, tz;
      if (Math.abs(this._n.z) > Math.abs(this._n.x)) {
        tx = (caja.max.x - this.pos.x) < (this.pos.x - caja.min.x) ? 1 : -1;
        tz = 0;
      } else {
        tx = 0;
        tz = (caja.max.z - this.pos.z) < (this.pos.z - caja.min.z) ? 1 : -1;
      }
      this.pos.x += tx * e * 0.9;
      this.pos.z += tz * e * 0.9;
    }
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
    const mando = {};

    if (!destino) {
      // Nadie a quien cargar: baja el asta al hombro y afloja hasta el paso.
      // Lo importante no es la pose, es que este camino TAMBIÉN termina
      // moviendo el caballo y sentando al jinete encima.
      this.estado = 'esperar';
      c.andar = Math.max(0, Math.min(c.andar, 1));
      this.avisando = false;
      this.fig.poner('lanzaAlto');
      if (c.puedeSaltar && c.obstaculoAdelante(c.vel * 0.55 + 2.5)) mando.saltar = true;
      c.actualizar(dt, mando);
      c.actualizado = true;
      this._sentar();
      if (!c.vivo) this.desmontar(true);
      return;
    }

    const rumboA = Math.atan2(destino.x - c.pos.x, destino.z - c.pos.z) + Math.PI;

    if (this.estado === 'esperar') { this.estado = 'cargar'; this._pego = false; this._grito = false; }

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

  // ponerse de pie, sin más
  _dePie () {
    if (this.rodilla) { this.rodilla = false; this.fig.rodilla = false; }
  }

  // ponerse de pie Y soltar el parapeto. OJO: no llamar a esto desde 'correr',
  // que ahí el destino todavía hace falta —borrarlo dejaba al soldado
  // corriendo al enemigo en vez de a la tapia.
  _parar () {
    this._dePie();
    this.cubierta = null;
    this.motivo = null;
  }

  // encarar el fusil, de pie o con la rodilla en tierra
  _encarar (deRodillas) {
    this.estado = 'apuntar';
    this.t = 0;
    this.rodilla = !!deRodillas;
    this.fig.rodilla = this.rodilla;
    this.fig.poner('apuntar');
    this.sonido.grito();
  }

  // El parapeto más conveniente: cerca mío, no encima del enemigo, y que no me
  // haga retroceder. Se busca cada segundo y medio, no cada cuadro.
  _buscarCubierta (objetivo, dist) {
    if (!this.cubiertas || !this.cubiertas.length) return null;
    if (this.tCubierta > 0) return null;
    this.tCubierta = 1.5;
    let mejor = null, mejorPunto = null, mejorPuntaje = Infinity;
    for (const c of this.cubiertas) {
      const dMio = Math.hypot(c.x - this.pos.x, c.z - this.pos.z);
      if (dMio > CUBIERTA_BUSCAR || dMio < 1.2) continue;
      const dEnemigo = Math.hypot(c.x - objetivo.x, c.z - objetivo.z);
      if (dEnemigo < CUBIERTA_MINIMA) continue;
      // el puesto va del lado del parapeto que da la espalda al enemigo
      const nx = (c.x - objetivo.x) / (dEnemigo || 1);
      const nz = (c.z - objetivo.z) / (dEnemigo || 1);
      const px = c.x + nx * (c.r + 0.45);
      const pz = c.z + nz * (c.r + 0.45);
      // caminar hacia atrás para taparse no sirve: se penaliza alejarse
      const acerca = Math.hypot(px - objetivo.x, pz - objetivo.z) - dist;
      const puntaje = Math.hypot(px - this.pos.x, pz - this.pos.z) + Math.max(0, acerca) * 1.4;
      if (puntaje < mejorPuntaje) { mejorPuntaje = puntaje; mejor = c; mejorPunto = { x: px, z: pz }; }
    }
    return mejor ? mejorPunto : null;
  }

  _entrarAcero () {
    this._parar();
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
    const origen = new THREE.Vector3(this.pos.x, this.pos.y + (this.rodilla ? 1.02 : 1.38), this.pos.z);
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

// Un número por hombre, y nunca se repite. Sirve para que la separación
// resuelva cada par UNA vez y para que el desempate sea siempre igual: dos
// hombres exactamente encima se abren siempre para el mismo lado en vez de
// temblar.
Soldado.proximoOrden = 0;
