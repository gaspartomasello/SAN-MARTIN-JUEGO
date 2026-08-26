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
  // EL VIENTO DEL GALOPE.
  //
  // Un lazo de ruido que no se apaga nunca: lo que cambia con la velocidad es
  // el volumen y el filtro. Al paso es un susurro grave; a galope se abre
  // arriba y te tapa media batalla, que es justamente lo que hace el aire a
  // 37 km/h contra la cara.
  viento (nivel) {
    if (!this.ctx) return;
    const v = Math.max(0, Math.min(1, nivel || 0));
    if (!this._viento) {
      const largo = 2;
      const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * largo, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      let x = 0;
      for (let i = 0; i < d.length; i++) { x = x * 0.90 + (Math.random() * 2 - 1) * 0.10; d[i] = x * 3.2; }
      const src = this.ctx.createBufferSource();
      src.buffer = buf; src.loop = true;
      const filtro = this.ctx.createBiquadFilter();
      filtro.type = 'bandpass'; filtro.frequency.value = 300; filtro.Q.value = 0.7;
      const g = this.ctx.createGain();
      g.gain.value = 0;
      src.connect(filtro).connect(g).connect(this.master);
      src.start();
      this._viento = { g, filtro };
    }
    const t = this.t;
    this._viento.g.gain.setTargetAtTime(v * v * 0.34, t, 0.18);
    this._viento.filtro.frequency.setTargetAtTime(240 + v * 1500, t, 0.25);
  }

  golpeRecibido () { if (this.ctx) { this._tono(90, 45, 0.35, 0.6, 'sine'); this.aturdir(1.6); } }
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
