// Sonido procedural: nada de archivos, todo sintetizado con Web Audio.
// La pólvora negra suena a golpe grave + siseo; el metal, a transitorio corto.

export class Sonido {
  constructor () {
    this.ctx = null;
    this.master = null;
    this.filtro = null;   // el "aturdimiento" tras el disparo
    this.ruido = null;
  }

  iniciar () {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC();
    this.filtro = this.ctx.createBiquadFilter();
    this.filtro.type = 'lowpass';
    this.filtro.frequency.value = 20000;
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.55;
    this.master.connect(this.filtro);
    this.filtro.connect(this.ctx.destination);

    // buffer de ruido blanco reutilizable
    const n = this.ctx.sampleRate * 2;
    this.ruido = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = this.ruido.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  }

  get t () { return this.ctx.currentTime; }

  _ruido (dur, gan, tipo, frec, q) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.ruido;
    s.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = tipo || 'bandpass';
    f.frequency.value = frec || 1200;
    f.Q.value = q || 1;
    const g = this.ctx.createGain();
    const t = this.t;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gan, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    s.connect(f); f.connect(g); g.connect(this.master);
    s.start(t); s.stop(t + dur + 0.05);
    return g;
  }

  _tono (frec, frecFin, dur, gan, tipo) {
    const o = this.ctx.createOscillator();
    o.type = tipo || 'sine';
    const g = this.ctx.createGain();
    const t = this.t;
    o.frequency.setValueAtTime(frec, t);
    if (frecFin) o.frequency.exponentialRampToValueAtTime(frecFin, t + dur);
    g.gain.setValueAtTime(gan, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  // --- eventos del juego ---

  disparo () {
    if (!this.ctx) return;
    this._ruido(0.42, 0.95, 'lowpass', 2400, 0.7);
    this._tono(160, 42, 0.32, 0.75, 'square');
    this._tono(70, 30, 0.5, 0.5, 'sine');
    this.aturdir(0.75);
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
  canon () {
    if (!this.ctx) return;
    const t = this.t;
    this._ruido(1.4, 0.9, 'lowpass', 380, 0.7);
    this._tono(70, 26, 1.1, 0.85, 'sine');
    this._tono(120, 40, 0.5, 0.5, 'square');
    // el eco contra la barranca, medio segundo después y a la mitad
    setTimeout(() => { if (this.ctx) { this._ruido(1.1, 0.28, 'lowpass', 260, 0.7); } }, 480);
    this.aturdir(2.6);
    return t;
  }

  // la metralla pasando cerca: perdigones cortando el aire
  metralla () { if (this.ctx) { this._ruido(0.45, 0.34, 'highpass', 2100, 1.6); this._tono(900, 260, 0.3, 0.14, 'sawtooth'); } }

  golpeRecibido () { if (this.ctx) { this._tono(90, 45, 0.35, 0.6, 'sine'); this.aturdir(1.6); } }
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
