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

// LA REUNIÓN — la otra mitad de la carga.
//
// La pasada del lancero ya estaba hecha (soldados.js): entra al galope, tira
// el lanzazo, sigue de largo y vuelve grupas. Lo que faltaba es que eso lo
// hicieran JUNTOS. Sin esto la pinza era de una sola dirección: se soltaba a
// veintiséis metros del enemigo y no se volvía a formar nunca más, así que a
// partir del choque eran ciento veinte tipos a caballo, cada uno en su propia
// fase del ciclo. Mientras unos entraban, otros estaban en `volver`: al
// trote, doblando, de costado, solos y en medio de la masa.
//
// Eso se pagaba poco mientras los realistas temblaban en el lugar. Cuando
// dejaron de temblar y empezaron a converger de verdad, `volver` adentro de
// la infantería pasó a ser una sentencia y la caballería se apagaba entera.
//
// La caballería de verdad no se queda adentro. Carga, atraviesa, se REÚNE
// fuera de contacto, se vuelve a formar y carga otra vez. Dos ganancias, y la
// segunda importa más: sale del campo justo en la ventana en que es
// vulnerable, y la carga siguiente llega CONCENTRADA. CABALLO_ENCIMA se cobra
// por caballo cerca, así que treinta caballos encima al mismo tiempo hacen un
// pico de moral que treinta caballos goteando de a uno no hacen nunca.
//
// EL PUNTO DE REUNIÓN SE MUEVE CON EL ENEMIGO, y esto costó una medición
// entera. La primera versión lo dejaba fijo en z = −26, que es donde estaba el
// desembarco al empezar. Pero los realistas no se quedan en la barranca:
// suben hacia el convento, y en un minuto y medio la línea pasa de z = −68 a
// z = +9. O sea que el punto de reunión "fuera de contacto" quedaba, a los
// treinta segundos, EN EL MEDIO DE LA INFANTERÍA. Medido: 76 de 92 granaderos
// seguían a menos de ocho metros de un realista mientras se reunían, y casi
// ninguno llegaba a su sitio. Se reunían adentro del enemigo.
//
// Así que la reunión se calcula cada vez: por fuera del flanco de la columna y
// del lado del convento, que es el propio. La primera corrección fue para el
// otro lado —atrás de la retaguardia enemiga, el campo que el realista acaba
// de dejar— y salió peor todavía: la fuerza realista no avanza como una línea,
// se estira ciento cincuenta metros, así que "atrás de todos" cae en la
// barranca y los granaderos se reunían contra el río, pegados a la retaguardia
// enemiga, sin campo para tomar carrera. Se retira uno hacia lo suyo.
//
// Y SE CALCULA UNA SOLA VEZ POR REUNIÓN, no cada cuadro. Ese fue el segundo
// error medido: mirando la punta de la línea cuadro a cuadro, el punto saltaba
// ochenta metros cada vez que el realista más adelantado moría o lo pasaba
// otro. El escuadrón entero se pasó la batalla galopando de ida y de vuelta
// atrás de un punto que se movía —distancia media al sitio: 78 m, 17 m, 85 m,
// 20 m, uno tras otro—, cruzando la infantería con la lanza al hombro, que no
// hiere. Contacto casi al doble que antes y un tercio de las bajas. El punto
// se fija al empezar la reunión y no se mueve hasta la próxima.
//
// Y SE SALE DE COSTADO, POCO. La tercera medición fue la que ordenó esto. Un
// punto de reunión lejos —por fuera del flanco y treinta y cuatro metros del
// lado del convento— quedaba a setenta u ochenta metros de donde estaba
// peleando la columna, así que cada reunión era un viaje de ida y vuelta
// cruzando la infantería con la lanza al hombro. Los granaderos no se
// evaporaban más —110 de 120 en pie al minuto y medio, contra 0— pero mataban
// SIETE realistas en tres minutos. Sobrevivían porque no peleaban.
//
// La salida es corta y va derecho para afuera: se toma la dirección que va del
// centro enemigo al centro de la columna y se retrocede treinta metros por
// ahí. Es el camino más corto para despegarse y es el único que no vuelve a
// cruzar la masa. Tres segundos de galope, no diez.
const SALIDA = 30;              // lo que se retrocede, en línea recta para afuera
export const REUNION_OESTE = { x: -76, z: -26, rumbo: 0 };
export const REUNION_ESTE = { x: 76, z: -26, rumbo: 0 };

const MITAD = 0.5;              // fracción que decide: la mitad ya cargó, la mitad ya volvió
// LA CARGA TIENE UN MÍNIMO, y sin él la maniobra se da vuelta. La señal para
// volver grupas es que la mitad del escuadrón ya haya dado su pasada, y eso
// mide bien cuando la columna entra desde afuera. Pero apenas se vuelve a
// soltar, media columna ya está pegada al enemigo: la mitad "pasa" en dos
// segundos y el escuadrón se reúne enseguida. Medido: dos segundos cargando
// contra nueve reuniéndose, o sea el 20 % del tiempo peleando. Un piso de
// tiempo lo endereza.
const CARGA_MINIMA = 16;        // lo que dura la carga por poco que pase
const CARGA_LARGA = 26;         // y el tope, si no llega a pasar la mitad
const REUNION_LARGA = 9;        // tope de la espera, para que una columna diezmada no espere a muertos
const LLEGADA_REUNION = 6;      // a esta distancia de su sitio, se lo cuenta reunido
const PEGADO = 2;               // y a esta, para el caballo

export class Columna {
  // cabeza: null si la manda el jugador (entonces se le pasa en actualizar)
  constructor (nombre, ruta, formacion, reunion) {
    this.nombre = nombre;
    this.ruta = ruta;
    this.formacion = formacion;   // { x, z, rumbo } donde espera
    this.reunion = reunion;       // { x, z, rumbo } donde vuelve a formar entre carga y carga
    this.punto = 0;
    this.hombres = [];
    this.jefe = null;             // el Soldado que va adelante, si no la manda el jugador
    // EN RED: la columna del este la manda el otro jugador, que no es un
    // Soldado ni es `jugador` —está en la otra máquina—. Una función que
    // devuelve dónde va su caballo alcanza para que los sesenta lo sigan.
    this.remota = null;
    this.estado = 'formada';      // formada → saliendo → suelta
    // Ya suelta, la columna sigue viva y alterna: 'cargando' → 'reunion' → …
    this.fase = null;
    this.tFase = 0;
    this.sitio = null;           // dónde, fijado al empezar cada reunión
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

  // A MÍ. La columna deja de pelear y se vuelve a formar detrás del que la
  // manda, para dar la vuelta y entrar de nuevo.
  //
  // Es la mitad que le faltaba al mando. La pinza tenía una sola orden —el
  // clarín, que las larga— y después de eso el jugador miraba: sesenta hombres
  // decidiendo solos hasta que no quedara ninguno. Ahora la carga tiene ida y
  // vuelta, que es como se manda caballería.
  //
  // No hace falta código nuevo para la formación: volver a 'saliendo' con la
  // cabeza en el jugador es exactamente lo que ya hace la columna antes del
  // choque. Y tampoco hace falta código para soltarla de nuevo — la misma
  // comprobación de CHOQUE que la largó la primera vez la larga otra vez
  // cuando la llevás a menos de veintiséis metros del enemigo. Reunirse al
  // lado del enemigo no se puede, y eso es correcto: la orden es para salir.
  reunirse () {
    if (this.estado !== 'suelta') return false;
    this.estado = 'saliendo';
    this.fase = null;
    this.tFase = 0;
    this.sitio = null;
    return true;
  }

  soltar () {
    if (this.estado === 'suelta') return false;
    this.estado = 'suelta';
    this._cargar();
    if (this.alSoltar) this.alSoltar(this);
    return true;
  }

  // A CARGAR. Se les saca la plaza —sin plaza cada uno vuelve a su ciclo de
  // lancero— y se pone el contador de pasadas en cero, que es lo que la
  // columna va a mirar para saber cuándo ya cargó.
  _cargar () {
    this.fase = 'cargando';
    this.tFase = 0;
    for (const h of this.hombres) {
      h.plaza = null;
      h.pasadas = 0;
      if (h.vivo && h.montado && !h.quebrado) h.estado = 'cargar';
    }
  }

  // A REUNIRSE. La plaza manda sobre el objetivo (soldados.js), así que el que
  // vuelve grupas no se para a ensartar a nadie en el camino: sale.
  _reunir (enemigos, monta) {
    this.fase = 'reunion';
    this.tFase = 0;
    this.sitio = this._puntoReunion(enemigos, monta);
  }

  // Dónde se reúne: treinta metros para afuera, en la dirección que va del
  // centro enemigo al centro de la columna.
  _puntoReunion (enemigos, monta) {
    let ne = 0, ex = 0, ez = 0;
    if (enemigos) for (const e of enemigos) {
      if (!e.vivo || e.quebrado) continue;
      ne++; ex += e.pos.x; ez += e.pos.z;
    }
    if (!ne || !monta.length) return this.reunion;
    ex /= ne; ez /= ne;

    let gx = 0, gz = 0;
    for (const h of monta) { gx += h.pos.x; gz += h.pos.z; }
    gx /= monta.length; gz /= monta.length;

    // Encimados: no hay dirección de salida, se usa el flanco propio.
    let dx = gx - ex, dz = gz - ez;
    const d = Math.hypot(dx, dz);
    if (d < 1) { dx = Math.sign(this.reunion.x) || 1; dz = 0; }
    else { dx /= d; dz /= d; }

    const x = Math.max(-110, Math.min(110, gx + dx * SALIDA));
    const z = Math.max(-92, Math.min(70, gz + dz * SALIDA));
    return { x, z, rumbo: Math.atan2(ex - x, ez - z) + Math.PI };
  }

  // La columna después del choque. Alterna carga y reunión hasta que no queda
  // nadie arriba de un caballo.
  _pelear (dt, enemigos) {
    this.tFase += dt;
    const monta = this.hombres.filter(h => h.vivo && h.montado && !h.quebrado);
    if (monta.length === 0) return;

    if (this.fase === 'cargando') {
      const pasaron = monta.filter(h => h.pasadas > 0).length;
      const gastada = pasaron >= monta.length * MITAD && this.tFase > CARGA_MINIMA;
      if (gastada || this.tFase > CARGA_LARGA) this._reunir(enemigos, monta);
      return;
    }

    // Fuera de contacto y en formación: el punto de reunión hace de cabeza.
    const p = this.sitio || this.reunion;
    const cab = { x: p.x, z: p.z, rumbo: p.rumbo, andar: 2 };
    let n = 0, llegados = 0;
    for (const h of this.hombres) {
      if (!h.vivo || !h.montado || h.quebrado) { h.plaza = null; continue; }
      if (!h.plaza) h.plaza = new THREE.Vector3();
      this._sitio(cab, n++, h.plaza);
      const d = Math.hypot(h.plaza.x - h.monta.pos.x, h.plaza.z - h.monta.pos.z);
      // lejos galopa —de eso se ocupa el rezagado de _marchar—, cerca trota y
      // encima del sitio se para
      h.andarColumna = d > PEGADO ? 2 : 0;
      if (d < LLEGADA_REUNION) llegados++;
    }
    if (llegados >= n * MITAD || this.tFase > REUNION_LARGA) this._cargar();
  }

  actualizar (dt, jugador, enemigos) {
    if (this.estado === 'suelta') { this._pelear(dt, enemigos); return; }
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
    this.oeste = new Columna('oeste', RUTA_OESTE, PLAZA_OESTE, REUNION_OESTE);
    this.este = new Columna('este', RUTA_ESTE, PLAZA_ESTE, REUNION_ESTE);
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

  // LA COLUMNA DE CADA UNO. San Martín sale por el oeste y Bermúdez por el
  // este; en solitario hay un solo jugador y es San Martín. La orden de
  // reunirse es de quien manda la columna, así que cada máquina llama a la
  // suya.
  //
  // Se pide por NOMBRE y no por «¿sos el invitado?», que es lo que decía antes.
  // Con dos jugadores las dos preguntas daban lo mismo; con más, no: un
  // granadero es invitado y no manda ninguna columna, y puede estar cargando
  // con la del oeste. Quién manda qué lo sabe el padrón de la sala, no el rol.
  tuya (quien) { return (quien === 'este' || quien === true) ? this.este : this.oeste; }

  // «¡A mí!» Devuelve false si no hay a quién llamar, para que el aviso del HUD
  // pueda decir por qué.
  reunir (quien) { return this.viva && this.tocado && this.tuya(quien).reunirse(); }

  desarmar () {
    for (const c of this.columnas) {
      for (const h of c.hombres) h.plaza = null;
      c.hombres.length = 0;
      c.jefe = null;
      c.punto = 0;
      c.estado = 'formada';
      c.fase = null;
      c.tFase = 0;
      c.sitio = null;
    }
    this.tocado = false;
    this.viva = false;
  }

  actualizar (dt, jugador, enemigos) {
    if (!this.viva) return;
    for (const c of this.columnas) c.actualizar(dt, jugador, enemigos);
    // Antes la pinza se daba por terminada en el choque. Ahora el escuadrón
    // sigue existiendo después: se reúne y vuelve a cargar. Se apaga cuando no
    // queda un hombre montado, que es cuando de verdad se acabó la caballería.
    if (this.oeste.montados === 0 && this.este.montados === 0) this.viva = false;
  }
}
