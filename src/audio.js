// Sonido procedural: nada de archivos, todo sintetizado con Web Audio.
// La pólvora negra suena a golpe grave + siseo; el metal, a transitorio corto.
//
// ---------------------------------------------------------------------------
// EL GRAFO, Y POR QUÉ SON CUATRO NODOS Y NO UNO
// ---------------------------------------------------------------------------
//
//   lo del campo  →  mezcla  →  sordina  →  filtro  ┐
//                                                    ├→  apagón  →  parlantes
//   lo de adentro →  interno ──────────────────────┘
//
// Cada efecto mueve UN parámetro y ninguno comparte el suyo con otro. No es
// prolijidad: dos automatizaciones sobre el mismo AudioParam se pisan, y el
// resultado no es una mezcla de las dos sino la última que se programó. Con un
// solo nodo de ganancia, morirse mientras te zumban los oídos apagaba el
// desvanecimiento —o al revés— según cuál llegara segunda.
//
//   sordina  el mundo se agacha cuando te revienta algo al lado
//   filtro   y pierde los agudos: es lo que hace que suene «a través de algo»
//   apagón   el desvanecimiento de la muerte, y nada más que eso
//
// Y LO DE ADENTRO NO PASA POR AHÍ. El corazón y el pitido del oído no son
// sonidos del campo: son tuyos. Van por `interno`, que esquiva la sordina y el
// filtro, así que un cañonazo al lado te tapa el mundo y NO te tapa el pulso.
// Ese contraste es el efecto: no es que se oiga menos, es que de golpe lo
// único que se oye sos vos.

// El aire se come los agudos y el sonido tarda en llegar. Las dos cosas juntas
// son lo que distingue un tiro a diez metros de uno a ochenta, y sin ellas
// doscientos cincuenta fusiles suenan todos adentro de tu oreja.
const VEL_SONIDO = 343;          // metros por segundo
const ALCANCE = 145;             // más lejos que esto no se programa nada

// Los compases de cada andar, en fracción de zancada. Un caballo no hace
// «tap tap tap»: al paso son cuatro golpes parejos; al trote dos, porque las
// patas van en diagonal de a pares; al galope tres o cuatro apretados y
// después un silencio, que es el momento en que el animal está entero en el
// aire. Ese silencio ES el galope: sin él suena a trote apurado.
const COMPASES = {
  paso: [0, 0.25, 0.50, 0.75],
  trote: [0, 0.50],
  galope: [0, 0.13, 0.29, 0.42]
};
const VIDA_CORAZON = 55;         // de acá para abajo se empieza a oír el pulso

export class Sonido {
  constructor () {
    this.ctx = null;
    this.master = null;   // la mezcla del campo: todo lo de afuera entra acá
    this.sordina = null;  // cuánto se agacha el mundo
    this.filtro = null;   // el "aturdimiento" tras el disparo
    this.interno = null;  // el corazón y el pitido: no los toca nada
    this.apagon = null;   // el desvanecimiento de la muerte
    this.ruido = null;
    // dónde están tus oídos. Lo pone main.js una vez por cuadro.
    this.oyente = { x: 0, y: 1.7, z: 0 };
    this.faseCorazon = 0;
    this.faseCasco = 0;
    this.ultimoCasco = -1;
    this.muriendo = false;
  }

  iniciar () {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC();
    this.apagon = this.ctx.createGain();
    this.apagon.gain.value = 1;
    this.apagon.connect(this.ctx.destination);

    this.filtro = this.ctx.createBiquadFilter();
    this.filtro.type = 'lowpass';
    this.filtro.frequency.value = 20000;
    this.filtro.connect(this.apagon);

    this.sordina = this.ctx.createGain();
    this.sordina.gain.value = 1;
    this.sordina.connect(this.filtro);

    this.master = this.ctx.createGain();
    this.master.gain.value = 0.55;
    this.master.connect(this.sordina);

    this.interno = this.ctx.createGain();
    this.interno.gain.value = 1;
    this.interno.connect(this.apagon);

    // buffer de ruido blanco reutilizable
    const n = this.ctx.sampleRate * 2;
    this.ruido = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = this.ruido.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  }

  get t () { return this.ctx.currentTime; }

  // `op.cuando` retrasa el sonido —para la distancia y para los ecos— y
  // `op.ataque` es lo que tarda en llegar al máximo. El ataque no es un detalle
  // de mezcla: cuatro milésimas ya redondean el chasquido de un fusil y lo
  // convierten en un golpe. Un latigazo necesita una.
  _ruido (dur, gan, tipo, frec, q, op) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.ruido;
    s.loop = true;
    // que no arranque siempre en la misma muestra: si no, dos ruidos cortos
    // seguidos son el mismo ruido y se oye la repetición
    const desde = Math.random() * 1.5;
    const f = this.ctx.createBiquadFilter();
    f.type = tipo || 'bandpass';
    f.frequency.value = Math.max(20, Math.min(20000, frec || 1200));
    f.Q.value = q || 1;
    const g = this.ctx.createGain();
    const t = this.t + ((op && op.cuando) || 0);
    const ata = (op && op.ataque) || 0.004;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gan, t + ata);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    s.connect(f); f.connect(g); g.connect((op && op.a) || this.master);
    s.start(t, desde); s.stop(t + dur + 0.05);
    return g;
  }

  _tono (frec, frecFin, dur, gan, tipo, op) {
    const o = this.ctx.createOscillator();
    o.type = tipo || 'sine';
    const g = this.ctx.createGain();
    const t = this.t + ((op && op.cuando) || 0);
    o.frequency.setValueAtTime(frec, t);
    if (frecFin) o.frequency.exponentialRampToValueAtTime(frecFin, t + dur);
    g.gain.setValueAtTime(gan, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g); g.connect((op && op.a) || this.master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  // Dónde están tus oídos, una vez por cuadro.
  oir (p) { this.oyente.x = p.x; this.oyente.y = p.y; this.oyente.z = p.z; }

  // Qué le hace la distancia a un sonido. Devuelve null si está tan lejos que
  // no vale la pena programar nada: en una batalla de doscientos cincuenta
  // fusiles eso es la mitad de los tiros.
  _lejania (origen) {
    if (!origen) return { d: 0, gan: 1, aire: 1, retardo: 0 };
    const d = Math.hypot(origen.x - this.oyente.x,
      (origen.y === undefined ? this.oyente.y : origen.y) - this.oyente.y,
      origen.z - this.oyente.z);
    if (d > ALCANCE) return null;
    return {
      d,
      gan: 1 / (1 + Math.pow(d / 11, 1.55)),
      aire: Math.max(0.10, 1 - d / 130),
      retardo: d / VEL_SONIDO
    };
  }

  // --- eventos del juego ---

  // EL TIRO. Antes era un golpe grave y un siseo, los dos igual de fuertes
  // vinieran de donde vinieran, y con el filtro de aturdimiento puesto en cada
  // uno. Eso último era lo peor y no se notaba como un bug: con seiscientos
  // cincuenta tiros por batalla el filtro se reponía a los dos segundos y el
  // tiro siguiente lo volvía a cerrar, así que en pleno tiroteo el juego entero
  // sonaba tapado y no había manera de saber por qué.
  //
  // Un fusil de chispa son TRES cosas encadenadas, y la distancia se lleva las
  // primeras antes que las últimas:
  //
  //   1. el chasquido — dos milésimas, todo el espectro. Es lo que lo hace
  //      sonar a tiro. Es lo primero que se pierde, y por eso el mismo fusil a
  //      diez metros es un latigazo y a ochenta es un «pum» redondo.
  //   2. el cuerpo — la pólvora negra empujando; el golpe que se siente.
  //   3. la cola — el rebote contra el convento y la barranca. Al revés que
  //      las otras dos, cuanto más lejos MÁS dura y más tarde llega.
  //
  // Y el oído sólo se resiente si fue al lado tuyo, que es lo que pasa de
  // verdad: el de la fila de atrás no te deja sordo.
  disparo (origen) {
    if (!this.ctx) return;
    const l = this._lejania(origen);
    if (!l) return;
    const c = l.gan, aire = l.aire, w = l.retardo;
    // dos tiros nunca son idénticos: la carga, el pistón, hacia dónde apunta
    const azar = 0.88 + Math.random() * 0.24;

    this._ruido(0.055, 0.85 * c * aire * aire, 'highpass', 1500 * aire + 300, 0.7,
      { cuando: w, ataque: 0.0012 });
    this._ruido(0.26 * (2 - aire), 0.8 * c, 'lowpass', (1600 * aire + 260) * azar, 0.8,
      { cuando: w, ataque: 0.003 });
    this._tono(188 * azar, 44, 0.26, 0.66 * c, 'square', { cuando: w });
    this._tono(78 * azar, 30, 0.44, 0.5 * c, 'sine', { cuando: w });
    this._ruido(0.45 + (1 - aire) * 1.0, 0.15 * c, 'lowpass', 620 * aire + 150, 0.6,
      { cuando: w + 0.08 + (1 - aire) * 0.16, ataque: 0.035 });
  }

  fogonazo () {           // cebó y no salió el tiro: sólo la cazoleta
    if (!this.ctx) return;
    this._ruido(0.22, 0.4, 'highpass', 2600, 0.6);
    this._tono(900, 300, 0.1, 0.12, 'triangle');
  }

  chispaFallida () {
    if (!this.ctx) return;
    this._tono(2100, 900, 0.05, 0.22, 'square');
    this._ruido(0.05, 0.12, 'highpass', 5000, 1);
  }

  martillo () { if (this.ctx) this._tono(1500, 700, 0.06, 0.2, 'square'); }
  rastrillo () { if (this.ctx) this._tono(1100, 520, 0.05, 0.14, 'square'); }
  papel () { if (this.ctx) this._ruido(0.16, 0.18, 'highpass', 3400, 0.8); }
  polvora () { if (this.ctx) this._ruido(0.3, 0.1, 'bandpass', 5200, 1.4); }

  baqueta () {
    if (!this.ctx) return;
    this._tono(820, 420, 0.09, 0.2, 'square');
    this._ruido(0.1, 0.14, 'bandpass', 2200, 2);
  }

  acierto () {            // el timing entró en ventana
    if (this.ctx) this._tono(1250, 1850, 0.08, 0.14, 'triangle');
  }

  torpeza () {
    if (!this.ctx) return;
    this._tono(220, 120, 0.18, 0.2, 'sawtooth');
    this._ruido(0.2, 0.14, 'lowpass', 700, 1);
  }

  impactoMadera () { if (this.ctx) { this._tono(300, 120, 0.12, 0.3, 'square'); this._ruido(0.1, 0.2, 'lowpass', 1400, 1); } }
  impactoCarne () { if (this.ctx) { this._tono(120, 60, 0.2, 0.4, 'sine'); this._ruido(0.16, 0.3, 'lowpass', 900, 1); } }
  sable () { if (this.ctx) this._ruido(0.18, 0.3, 'bandpass', 3200, 2.2); }

  // acero contra acero: dos parciales disonantes y una cola corta
  choque () {
    if (!this.ctx) return;
    this._tono(2400, 1700, 0.28, 0.16, 'triangle');
    this._tono(3350, 2600, 0.22, 0.10, 'square');
    this._ruido(0.09, 0.18, 'highpass', 4200, 1.6);
  }

  // parada perfecta: el mismo choque pero limpio y con campana arriba
  parada () {
    if (!this.ctx) return;
    this._tono(3100, 2350, 0.45, 0.20, 'triangle');
    this._tono(4650, 4200, 0.55, 0.10, 'sine');
    this._ruido(0.07, 0.12, 'highpass', 6000, 1.2);
  }

  // pechada: golpe sordo de hombro, sin metal
  pechada () {
    if (!this.ctx) return;
    this._tono(150, 70, 0.16, 0.34, 'sine');
    this._ruido(0.14, 0.14, 'lowpass', 700, 1);
  }
  // El cañón. No es un disparo más fuerte: es otra cosa. Un golpe grave que
  // se siente en el pecho, con la cola larga del eco sobre el río.
  canon (origen) {
    if (!this.ctx) return;
    const l = this._lejania(origen);
    if (!l) return;
    const c = l.gan, w = l.retardo;
    const t = this.t;
    this._ruido(1.4, 0.9 * c, 'lowpass', 380, 0.7, { cuando: w, ataque: 0.002 });
    this._tono(70, 26, 1.1, 0.85 * c, 'sine', { cuando: w });
    this._tono(120, 40, 0.5, 0.5 * c, 'square', { cuando: w });
    // el eco contra la barranca, medio segundo después y a la mitad
    this._ruido(1.1, 0.28 * c, 'lowpass', 260, 0.7, { cuando: w + 0.48, ataque: 0.04 });
    // Una pieza de a cuatro a veinte metros te deja sordo; a ciento veinte, no.
    if (l.d < 45) this.ensordecer(1.35 * (1 - l.d / 45) + 0.2);
    return t;
  }

  // la metralla pasando cerca: perdigones cortando el aire
  metralla () { if (this.ctx) { this._ruido(0.45, 0.34, 'highpass', 2100, 1.6); this._tono(900, 260, 0.3, 0.14, 'sawtooth'); } }

  // TE DIERON. El golpe sordo del plomo contra el cuerpo, y el oído que se te
  // va. `fuerza` separa el balazo que aguantás —un pitido corto— del que te
  // saca de la silla, que es el que te deja sin mundo unos segundos.
  golpeRecibido (fuerza = 0.45) {
    if (!this.ctx) return;
    this._tono(90, 45, 0.35, 0.6, 'sine');
    this._ruido(0.18, 0.28, 'lowpass', 520, 1, { ataque: 0.002 });
    this.ensordecer(fuerza);
  }
  // EL CLARÍN. El que le da el nombre al juego.
  //
  // Un clarín de caballería no tiene pistones: sólo puede dar las notas de la
  // serie armónica de su tubo, y por eso todos los toques de la época están
  // hechos con las mismas cuatro o cinco notas. Acá va sol–do–mi–sol, que es
  // el esqueleto del toque de carga, con el sol de arriba sostenido al final.
  //
  // El timbre se arma con la fundamental más tres armónicos: un clarín es casi
  // una onda cuadrada con la boca metálica, así que el tercer y quinto armónico
  // pesan mucho. Un poco de vibrato al final y el aire de la caña abajo.
  clarin () {
    if (!this.ctx) return;
    const t0 = this.t;
    // sol, do, mi, sol — la última larga, que es la que arranca a los caballos
    const notas = [[392, 0.16], [523.25, 0.16], [659.25, 0.16], [784, 0.62]];
    let t = t0 + 0.02;
    for (const [f, dur] of notas) {
      for (const [mult, peso] of [[1, 0.20], [2, 0.13], [3, 0.09], [5, 0.035]]) {
        const o = this.ctx.createOscillator();
        o.type = mult === 1 ? 'square' : 'sawtooth';
        o.frequency.setValueAtTime(f * mult, t);
        // el clarinero no afina perfecto: la nota entra un pelo baja y sube
        o.frequency.setValueAtTime(f * mult * 0.988, t);
        o.frequency.linearRampToValueAtTime(f * mult, t + 0.05);
        if (dur > 0.4) {
          // vibrato en la nota larga
          const lfo = this.ctx.createOscillator();
          const prof = this.ctx.createGain();
          lfo.frequency.value = 5.4;
          prof.gain.value = f * mult * 0.008;
          lfo.connect(prof); prof.connect(o.frequency);
          lfo.start(t + 0.18); lfo.stop(t + dur);
        }
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(peso, t + 0.022);
        g.gain.setValueAtTime(peso, t + dur * 0.72);
        g.gain.exponentialRampToValueAtTime(0.0008, t + dur + 0.05);
        const f2 = this.ctx.createBiquadFilter();
        f2.type = 'lowpass'; f2.frequency.value = 3400; f2.Q.value = 0.8;
        o.connect(f2); f2.connect(g); g.connect(this.master);
        o.start(t); o.stop(t + dur + 0.08);
      }
      t += dur;
    }
  }

  // EL ZUMBIDO. Una bala de plomo de dieciocho milímetros pasando cerca de la
  // oreja hace un silbido corto que sube y baja: efecto Doppler puro, porque
  // viene más rápido de lo que uno la oye llegar. Es el sonido que te avisa que
  // te tiraron y no te dieron, y sin él los tiros que fallan no existen.
  zumbido (fuerza = 1) {
    if (!this.ctx) return;
    const t = this.t;
    const dur = 0.13;
    const o = this.ctx.createOscillator();
    o.type = 'sine';
    // sube al acercarse y se desploma al pasar: eso es el Doppler
    const f0 = 900 + Math.random() * 700;
    o.frequency.setValueAtTime(f0 * 0.7, t);
    o.frequency.exponentialRampToValueAtTime(f0, t + dur * 0.42);
    o.frequency.exponentialRampToValueAtTime(f0 * 0.34, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.10 * fuerza, t + dur * 0.35);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.04);
    // el aire desgarrado, que es lo que le da cuerpo
    this._ruido(dur * 0.9, 0.055 * fuerza, 'bandpass', f0 * 1.5, 5);
  }

  grito () { if (this.ctx) { this._tono(320, 140, 0.4, 0.22, 'sawtooth'); this._ruido(0.35, 0.2, 'bandpass', 800, 1.2); } }

  // =========================================================================
  // EL OÍDO SATURADO — y por qué acá NO hay ningún pitido
  // =========================================================================
  //
  // Hubo uno: un tono agudo adentro de la cabeza, de los de película de
  // guerra. En el papel estaba bien y en la mano era insoportable, y el motivo
  // no es el tono sino CADA CUÁNTO. Un fusil se dispara cada tres segundos
  // durante quince minutos, y cualquier cosa que suene en cada tiro deja de
  // ser un efecto y pasa a ser el juego. Fuera por ahora.
  //
  // Lo que queda es lo que no se nota como efecto y sí se siente: el mundo se
  // AGACHA de golpe y sube despacio, y mientras tanto pierde los AGUDOS, que
  // es lo que lo hace sonar «a través de algo» en vez de simplemente más bajo.
  //
  // Y ya no lo dispara ningún tiro, ni el tuyo. Sólo lo que te pasa a vos: un
  // balazo encajado, un volteo, una pieza cerca.
  ensordecer (fuerza = 1) {
    if (!this.ctx) return;
    const f = Math.max(0.12, Math.min(1.4, fuerza));
    const dur = 1.0 + f * 3.4;
    const t = this.t;

    // el mundo se agacha. Se baja de golpe a propósito: un oído saturado no
    // hace un fundido, se cierra. Lo que lleva tiempo es volver.
    const piso = Math.max(0.10, 0.78 - f * 0.62);
    this.sordina.gain.cancelScheduledValues(t);
    this.sordina.gain.setValueAtTime(piso, t);
    this.sordina.gain.setTargetAtTime(1, t + 0.06, dur * 0.32);

    // y pierde los agudos
    this.aturdir(0.5 + f * 1.7);
  }

  // =========================================================================
  // EL LATIDO Y LOS CASCOS — los dos sonidos que no son un evento
  // =========================================================================
  //
  // Todo lo demás de este archivo lo dispara algo que pasó. Estos dos son
  // continuos y hay que llevarlos por tiempo, así que main.js los mueve una
  // vez por cuadro. No se crea un nodo por cuadro: se crean por latido y por
  // casco, que a galope tendido son ocho por segundo.
  actualizar (dt, e) {
    if (!this.ctx || !e || !(dt > 0)) return;
    if (e.oyente) this.oir(e.oyente);
    this._corazon(dt, e);
    this._cascos(dt, e);
  }

  // EL CORAZÓN. No es ambiente: es información, y es la única que no ocupa un
  // rincón de la pantalla. Cuando la vida baja de la mitad se empieza a oír, y
  // cuanto peor estás más rápido late —de setenta y cuatro pulsaciones a
  // ciento sesenta y seis—. Sirve justo cuando no estás mirando la barra:
  // corriendo de espaldas, con humo, buscando dónde meterte.
  //
  // Muriéndote afloja hasta cuarenta y se apaga con todo lo demás. Un corazón
  // que sigue a ciento sesenta mientras se te cierran los ojos no dice que te
  // estás yendo: dice que la pantalla se trabó.
  _corazon (dt, e) {
    const vida = Math.max(0, Math.min(100, e.vida === undefined ? 100 : e.vida));
    if (vida >= VIDA_CORAZON && !this.muriendo) { this.faseCorazon = 0; return; }
    const apuro = Math.max(0, 1 - vida / VIDA_CORAZON);
    let ppm = 74 + apuro * 92;
    let fuerza = 0.09 + apuro * 0.46;
    if (this.muriendo) { ppm = 40; fuerza = 0.30; }
    this.faseCorazon += dt * (ppm / 60);
    if (this.faseCorazon < 1) return;
    this.faseCorazon -= 1;
    if (this.faseCorazon > 2) this.faseCorazon = 0;   // volvió de una pausa larga
    this._latido(fuerza);
  }

  // Un latido son DOS golpes y no uno: el «lub» de las válvulas grandes y el
  // «dub» más corto y un poco más agudo, a ciento sesenta milésimas. Con uno
  // solo suena a bombo.
  _latido (f) {
    const t = this.t;
    for (const [espera, frec, dur, peso] of [[0, 52, 0.20, 1], [0.16, 63, 0.13, 0.6]]) {
      const o = this.ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(frec, t + espera);
      o.frequency.exponentialRampToValueAtTime(frec * 0.55, t + espera + dur);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0, t + espera);
      g.gain.linearRampToValueAtTime(f * peso, t + espera + 0.014);
      g.gain.exponentialRampToValueAtTime(0.0006, t + espera + dur);
      o.connect(g); g.connect(this.interno);
      o.start(t + espera); o.stop(t + espera + dur + 0.03);
    }
  }

  // LOS CASCOS DE TU CABALLO. Sólo el tuyo: ciento veinte caballos sonando
  // cada uno lo suyo es ruido blanco caro, y de todos modos lo que hace falta
  // es sentir el andar que llevás VOS, que es la única decisión que estás
  // tomando mientras cargás.
  //
  // El compás lo pone el andar (ver COMPASES arriba) y va por la velocidad
  // REAL y no por el andar pedido, igual que el resto del juego: el que acaba
  // de bajar de galope todavía suena a galope hasta que el animal afloja.
  _cascos (dt, e) {
    const v = e.montado && e.vivo ? e.vel : 0;
    if (!(v > 0.7)) { this.faseCasco = 0; this.ultimoCasco = -1; return; }
    const compas = v > 6.4 ? COMPASES.galope : v > 3.1 ? COMPASES.trote : COMPASES.paso;
    const zancadas = 0.52 + v * 0.165;
    this.faseCasco += dt * zancadas;
    while (this.faseCasco >= 1) { this.faseCasco -= 1; this.ultimoCasco = -1; }
    const fuerza = Math.min(1, 0.34 + v / 11);
    for (let i = 0; i < compas.length; i++) {
      if (i <= this.ultimoCasco || this.faseCasco < compas[i]) continue;
      this.ultimoCasco = i;
      this._casco(fuerza, i === 0);
    }
  }

  // Un casco en tierra seca: el golpe grave, y encima el raspón de la arena.
  // El azar por golpe es lo que lo saca de metrónomo —ocho por segundo
  // idénticos se oyen como una máquina, no como un animal—.
  _casco (fuerza, primero) {
    const azar = 0.84 + Math.random() * 0.32;
    const p = primero ? 1.25 : 1;
    this._ruido(0.085, 0.21 * fuerza * p, 'lowpass', 240 * azar, 1.1, { ataque: 0.0015 });
    this._tono(96 * azar, 44, 0.09, 0.17 * fuerza * p, 'sine');
    this._ruido(0.05, 0.05 * fuerza, 'bandpass', 2600 * azar, 1.4, { ataque: 0.002 });
  }

  // =========================================================================
  // LA MUERTE, EN EL OÍDO
  // =========================================================================
  //
  // Va del brazo con `hud.cerrarLosOjos` y con el mismo número de segundos, y
  // eso es todo el efecto: si el sonido se corta antes que la vista, se lee
  // como que se colgó; si sigue después de que la pantalla está negra, se lee
  // como que hay otra pantalla en camino.
  //
  // Y no es bajar el volumen: primero se pierden los agudos —el mundo se va
  // yendo lejos—, después queda un retumbo, y recién al final el silencio. Se
  // apaga TODO, también el corazón, que para eso está en `apagón` como el
  // resto.
  morir (seg = 7) {
    if (!this.ctx) return;
    this.muriendo = true;
    const t = this.t;
    this.apagon.gain.cancelScheduledValues(t);
    this.apagon.gain.setValueAtTime(1, t);
    this.apagon.gain.setValueAtTime(1, t + seg * 0.16);
    this.apagon.gain.exponentialRampToValueAtTime(0.0008, t + seg * 0.95);
    this.filtro.frequency.cancelScheduledValues(t);
    this.filtro.frequency.setValueAtTime(9000, t);
    this.filtro.frequency.exponentialRampToValueAtTime(170, t + seg * 0.8);
    this.sordina.gain.cancelScheduledValues(t);
    this.sordina.gain.setValueAtTime(1, t);
  }

  // y se vuelve en pie
  revivir () {
    if (!this.ctx) return;
    this.muriendo = false;
    this.faseCorazon = 0;
    const t = this.t;
    this.apagon.gain.cancelScheduledValues(t);
    this.apagon.gain.setValueAtTime(0.0008, t);
    this.apagon.gain.exponentialRampToValueAtTime(1, t + 0.55);
    this.sordina.gain.cancelScheduledValues(t);
    this.sordina.gain.setValueAtTime(1, t);
    this.filtro.frequency.cancelScheduledValues(t);
    this.filtro.frequency.setValueAtTime(1800, t);
    this.filtro.frequency.exponentialRampToValueAtTime(20000, t + 0.5);
  }

  // sordera momentánea: filtro pasabajos que se abre de a poco
  aturdir (fuerza) {
    if (!this.ctx) return;
    const t = this.t;
    const f = Math.max(420, 900 - fuerza * 400);
    this.filtro.frequency.cancelScheduledValues(t);
    this.filtro.frequency.setValueAtTime(f, t);
    this.filtro.frequency.exponentialRampToValueAtTime(20000, t + 0.9 + fuerza * 1.6);
  }
}
