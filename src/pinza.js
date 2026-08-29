import * as THREE from 'three';

// LA PINZA — el 3 de febrero a las cinco y media de la mañana.
//
// Esto es lo que ganó la batalla, y es una idea, no una carga. Los realistas
// desembarcaron de noche en la barranca y subieron hacia el convento con
// doscientos cincuenta infantes y dos piezas, convencidos de que enfrente no
// había nadie. San Martín tenía ciento veinte granaderos escondidos DETRÁS del
// convento de San Carlos, partidos en dos columnas de sesenta. A una señal
// —un toque de clarín, que es el que le da el nombre a este juego— las dos
// columnas salieron cada una por un costado del convento y se cerraron sobre
// los dos flancos al mismo tiempo.
//
// La batalla duró quince minutos.
//
// Lo que hay que poder jugar de eso son tres cosas, y ninguna es apretar un
// botón de atacar:
//
//   1. LA ESPERA. Estás formado, en silencio, sin que te vean. Todavía no pasó
//      nada y ya ganaste, si nadie se mueve antes de tiempo.
//   2. EL TOQUE. Una sola señal y ciento veinte hombres arrancan juntos.
//   3. EL MANDO. Tu columna te sigue A VOS. No a un punto del mapa: a vos.
//      Sesenta hombres van a donde vayas, y si los llevás mal, se pierden.
//
// La columna que no manda el jugador sigue su ruta sola, rodeando el convento
// por el otro lado. Las dos se sueltan solas al llegar al choque: ahí termina
// la formación y empieza la caballería, que es la que ya sabíamos hacer.

// Formación de marcha: cuatro de frente. Un escuadrón en columna es angosto a
// propósito —así cabe por el costado del convento sin desbordarse a la vista—
// y se despliega recién en el choque.
const FRENTE = 4;
const ANCHO = 2.6;              // entre hombre y hombre
const FONDO = 3.4;              // entre fila y fila
const LLEGADA = 9;              // a esta distancia del punto de ruta, pasa al siguiente
const CHOQUE = 26;              // enemigo más cerca que esto: se suelta la formación
const CABEZA_ANDAR = 3;         // la columna sale al galope: hay 60 m de campo abierto

// Las dos rutas. Salen de atrás del convento —que ocupa de x −31 a 31 y de
// z 16 a 66—, bajan pegadas a la tapia de la huerta, doblan al campo y entran
// a los flancos del desembarco. No son un camino: son la maniobra dibujada.
// La tapia de la huerta corre por x = ±31 y un caballo ocupa casi un metro de
// radio: la formación va a ±40 para que ni el archero de adentro la roce. Un
// hombre pegado a la tapia al arrancar sale rebotando en vez de saliendo.
// LAS RUTAS ENVUELVEN, NO EMBISTEN.
//
// Antes el último punto era x = ∓15, que cae en el MEDIO de la línea realista
// —se despliegan de -65 a +65—. O sea que las dos columnas se juntaban contra
// el centro enemigo: eso no es una pinza, es una carga frontal repartida en
// dos. El flanco quedaba intacto y FLANCO, que es el término de moral que
// paga por atacar de costado, casi no se cobraba.
//
// Ahora bajan POR AFUERA de la punta (x = ∓74, más allá del último hombre) y
// recién ahí doblan hacia adentro, entrando por detrás del extremo. Es la
// maniobra que hizo la caballería en 1813 y ahora el terreno la permite.
export const RUTA_OESTE = [
  { x: -52, z: 6 },             // asoma por la esquina, ya bien abierto
  { x: -74, z: -40 },           // baja POR FUERA de la punta de la línea
  { x: -56, z: -72 }            // dobla y entra por detrás del extremo
];
export const RUTA_ESTE = [
  { x: 52, z: 6 },
  { x: 74, z: -40 },
  { x: 56, z: -72 }
];
export const PLAZA_OESTE = { x: -44, z: 54, rumbo: 0 };
export const PLAZA_ESTE = { x: 44, z: 54, rumbo: 0 };

export class Columna {
  // cabeza: null si la manda el jugador (entonces se le pasa en actualizar)
  constructor (nombre, ruta, formacion) {
    this.nombre = nombre;
    this.ruta = ruta;
    this.formacion = formacion;   // { x, z, rumbo } donde espera
    this.punto = 0;
    this.hombres = [];
    this.jefe = null;             // el Soldado que va adelante, si no la manda el jugador
    // EN RED: la columna del este la manda el otro jugador, que no es un
    // Soldado ni es `jugador` —está en la otra máquina—. Una función que
    // devuelve dónde va su caballo alcanza para que los sesenta lo sigan.
    this.remota = null;
    this.estado = 'formada';      // formada → saliendo → suelta
    this.alSoltar = null;
    this.alHeredar = null;
    this._p = new THREE.Vector3();
  }

  // El que se quebró ya no cuenta, aunque siga arriba del caballo y a la
  // vista: se está yendo. Si contara, el número del HUD diría que la columna
  // está entera justo mientras se te deshace.
  get vivos () { return this.hombres.filter(h => h.vivo && !h.quebrado).length; }
  get montados () { return this.hombres.filter(h => h.vivo && h.montado && !h.quebrado).length; }

  // De dónde cuelga la formación: el caballo del jugador, o el del jefe.
  _cabeza (jugador) {
    if (this.remota) return this.remota();
    if (this.jefe) {
      if (this.jefe.vivo && this.jefe.montado) {
        const c = this.jefe.monta;
        return { x: c.pos.x, z: c.pos.z, rumbo: c.rumbo, andar: c.andar };
      }
      // se quedó sin jefe: lo hereda el primero que siga arriba de un caballo
      this.jefe = this.hombres.find(h => h.vivo && h.montado && !h.quebrado) || null;
      if (!this.jefe) return null;
      const c = this.jefe.monta;
      return { x: c.pos.x, z: c.pos.z, rumbo: c.rumbo, andar: c.andar };
    }
    if (jugador && jugador.monta && jugador.vivo) {
      const c = jugador.monta;
      return { x: c.pos.x, z: c.pos.z, rumbo: c.rumbo, andar: c.andar };
    }
    // TE BAJARON, Y LA COLUMNA SIGUE.
    //
    // Sesenta hombres no se quedan parados detrás del convento porque su jefe
    // se cayó del caballo. Antes pasaba justo eso: la columna del jugador
    // colgaba de él y si él no montaba —muerto, desmontado, o simplemente
    // quieto mirando— los sesenta esperaban una orden que no llegaba nunca,
    // toda la batalla. Ahora la toma el primero que siga arriba de un caballo,
    // que es lo que hace un sargento.
    if (this.estado === 'saliendo') {
      this.jefe = this.hombres.find(h => h.vivo && h.montado && !h.quebrado) || null;
      if (this.jefe) {
        if (this.alHeredar) this.alHeredar(this);
        const c = this.jefe.monta;
        return { x: c.pos.x, z: c.pos.z, rumbo: c.rumbo, andar: c.andar };
      }
    }
    return null;
  }

  arrancar () { if (this.estado === 'formada') this.estado = 'saliendo'; }

  soltar () {
    if (this.estado === 'suelta') return false;
    this.estado = 'suelta';
    for (const h of this.hombres) { h.plaza = null; h.estado = 'cargar'; }
    if (this.alSoltar) this.alSoltar(this);
    return true;
  }

  actualizar (dt, jugador, enemigos) {
    if (this.estado === 'suelta') return;
    const cab = this._cabeza(jugador);
    if (!cab) { this.soltar(); return; }

    // El jefe de la columna que no manda el jugador va tirando de la ruta.
    if (this.jefe && this.estado === 'saliendo') {
      const p = this.ruta[this.punto];
      if (p) {
        const d = Math.hypot(p.x - cab.x, p.z - cab.z);
        if (d < LLEGADA && this.punto < this.ruta.length - 1) this.punto++;
        this.jefe.plaza = this._p.set(p.x, 0, p.z);

        // SE DOBLA AL TROTE. Al galope un caballo necesita dieciséis metros
        // para girar y al trote menos de tres —eso ya estaba en el juego, es
        // lo que obliga al lancero a volver grupas despacio—. Una columna que
        // toma las curvas a galope tendido se estira setenta metros y llega al
        // choque hecha una hilera de tipos sueltos. Así que en las vueltas
        // afloja al trote y recién en la recta suelta el galope, que es
        // exactamente lo que hace la caballería de verdad.
        let dif = (Math.atan2(p.x - cab.x, p.z - cab.z) + Math.PI) - cab.rumbo;
        dif = Math.atan2(Math.sin(dif), Math.cos(dif));
        this.jefe.andarColumna = Math.abs(dif) > 0.40 ? 2 : CABEZA_ANDAR;
      }
    } else if (this.jefe) {
      // todavía formada: el jefe se queda en su sitio
      this.jefe.plaza = this._p.set(this.formacion.x, 0, this.formacion.z);
      this.jefe.andarColumna = 0;
    }

    // ¿Ya hay a quién cargar? Entonces se acabó la formación.
    if (this.estado === 'saliendo' && enemigos) {
      for (const e of enemigos) {
        if (!e.vivo) continue;
        if (Math.hypot(e.pos.x - cab.x, e.pos.z - cab.z) < CHOQUE) { this.soltar(); return; }
      }
    }

    const andar = this.estado === 'formada' ? 0 : Math.max(cab.andar, 1);
    let n = 0;
    for (const h of this.hombres) {
      if (h === this.jefe) continue;
      if (!h.vivo || !h.montado || h.quebrado) { h.plaza = null; continue; }
      if (!h.plaza) h.plaza = new THREE.Vector3();
      this._sitio(cab, n++, h.plaza);
      h.andarColumna = andar;
    }
  }

  // Dónde va el enésimo hombre, colgado del eje de marcha de la cabeza.
  // adelante = (−sen r, −cos r), derecha = (cos r, −sen r)
  _sitio (cab, n, salida) {
    const fx = -Math.sin(cab.rumbo), fz = -Math.cos(cab.rumbo);
    const dx = Math.cos(cab.rumbo), dz = -Math.sin(cab.rumbo);
    const lat = ((n % FRENTE) - (FRENTE - 1) / 2) * ANCHO;
    const atras = (Math.floor(n / FRENTE) + 1) * FONDO;
    return salida.set(cab.x - fx * atras + dx * lat, 0, cab.z - fz * atras + dz * lat);
  }

  // PLANTARLOS. Los pone exactamente en su lugar, quietos y mirando al mismo
  // lado. Sin esto cada uno nace CERCA de su sitio pero no en él, y los
  // primeros segundos —los del silencio detrás del convento, justo los que
  // tienen que estar quietos— se van en sesenta hombres acomodándose a
  // trompicones. La quietud es parte de la escena.
  plantar () {
    const cab = { x: this.formacion.x, z: this.formacion.z, rumbo: this.formacion.rumbo, andar: 0 };
    let n = 0;
    for (const h of this.hombres) {
      if (!h.montado || h.quebrado) continue;
      const esJefe = h === this.jefe;
      if (esJefe) this._p.set(cab.x, 0, cab.z);
      else this._sitio(cab, n++, this._p);
      const c = h.monta;
      c.pos.set(this._p.x, 0, this._p.z);
      c.rumbo = cab.rumbo;
      c.vel = 0;
      c.andar = 0;
      h.plaza = h.plaza || new THREE.Vector3();
      h.plaza.copy(this._p);
      h.andarColumna = 0;
      h._sentar();
    }
  }
}

// La maniobra completa: las dos columnas y el toque que las larga.
export class Pinza {
  constructor () {
    this.oeste = new Columna('oeste', RUTA_OESTE, PLAZA_OESTE);
    this.este = new Columna('este', RUTA_ESTE, PLAZA_ESTE);
    this.tocado = false;
    this.alTocar = null;
    this.viva = false;
  }

  get columnas () { return [this.oeste, this.este]; }
  get enPie () { return this.oeste.montados + this.este.montados; }
  get sonando () { return this.viva && !this.tocado; }

  // EL CLARÍN. Una sola señal y ciento veinte hombres arrancan juntos. Es todo
  // lo que hace este método, y es exactamente lo que pasó.
  tocar () {
    if (!this.viva || this.tocado) return false;
    this.tocado = true;
    for (const c of this.columnas) c.arrancar();
    if (this.alTocar) this.alTocar();
    return true;
  }

  desarmar () {
    for (const c of this.columnas) {
      for (const h of c.hombres) h.plaza = null;
      c.hombres.length = 0;
      c.jefe = null;
      c.punto = 0;
      c.estado = 'formada';
    }
    this.tocado = false;
    this.viva = false;
  }

  actualizar (dt, jugador, enemigos) {
    if (!this.viva) return;
    for (const c of this.columnas) c.actualizar(dt, jugador, enemigos);
    if (this.oeste.estado === 'suelta' && this.este.estado === 'suelta') this.viva = false;
  }
}
