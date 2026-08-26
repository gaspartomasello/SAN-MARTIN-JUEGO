import * as THREE from 'three';

// El humo no es un efecto: es una mecánica.
// Dos cosas a la vez: nubes instanciadas que se dibujan, y una grilla 2D de
// densidad que consultan tanto el jugador como la IA. Una sola verdad.

const MAX = 700;
const CELDA = 2;            // metros por celda
const LADO = 64;            // 128 x 128 m de campo cubierto

function textura () {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0.0, 'rgba(255,255,255,1)');
  g.addColorStop(0.45, 'rgba(255,255,255,0.55)');
  g.addColorStop(1.0, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 128, 128);
  // grano, para que no se vea como un aerógrafo
  const img = x.getImageData(0, 0, 128, 128);
  for (let i = 0; i < img.data.length; i += 4) {
    const r = 0.82 + Math.random() * 0.36;
    img.data[i + 3] *= r;
  }
  x.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const VS = `
  attribute float aAlfa;
  attribute float aTinte;
  attribute float aGiro;
  attribute float aTierra;
  varying float vAlfa;
  varying float vTinte;
  varying float vTierra;
  varying vec2 vUv;
  void main () {
    vAlfa = aAlfa;
    vTinte = aTinte;
    vTierra = aTierra;
    float c = cos(aGiro), s = sin(aGiro);
    vec2 p = mat2(c, -s, s, c) * position.xy;
    vUv = uv;
    vec4 mv = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    float escala = length(instanceMatrix[0].xyz);
    mv.xy += p * escala;
    gl_Position = projectionMatrix * mv;
  }
`;

const FS = `
  uniform sampler2D uTex;
  uniform vec3 uClaro;
  uniform vec3 uOscuro;
  uniform vec3 uTierra;
  varying float vAlfa;
  varying float vTinte;
  varying float vTierra;
  varying vec2 vUv;
  void main () {
    float a = texture2D(uTex, vUv).a * vAlfa;
    if (a < 0.004) discard;
    // La pólvora es gris y la tierra es ocre. Son dos cosas distintas y en un
    // campo seco se distinguen a simple vista: por eso la polvareda no se
    // pinta con la misma paleta que el humo de las descargas.
    vec3 col = mix(mix(uOscuro, uClaro, vTinte), uTierra, vTierra);
    gl_FragColor = vec4(col, a);
  }
`;

export class Humo {
  constructor (escena) {
    const geo = new THREE.PlaneGeometry(1, 1);
    const inst = new THREE.InstancedBufferGeometry();
    inst.index = geo.index;
    inst.attributes.position = geo.attributes.position;
    inst.attributes.uv = geo.attributes.uv;

    this.alfa = new THREE.InstancedBufferAttribute(new Float32Array(MAX), 1);
    this.tinte = new THREE.InstancedBufferAttribute(new Float32Array(MAX), 1);
    this.giro = new THREE.InstancedBufferAttribute(new Float32Array(MAX), 1);
    this.tierra = new THREE.InstancedBufferAttribute(new Float32Array(MAX), 1);
    inst.setAttribute('aAlfa', this.alfa);
    inst.setAttribute('aTinte', this.tinte);
    inst.setAttribute('aGiro', this.giro);
    inst.setAttribute('aTierra', this.tierra);

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTex: { value: textura() },
        uClaro: { value: new THREE.Color(0xd9d5cb) },
        uOscuro: { value: new THREE.Color(0x4c4f52) },
        uTierra: { value: new THREE.Color(0xc0a878) }
      },
      vertexShader: VS,
      fragmentShader: FS,
      transparent: true,
      depthWrite: false
    });

    this.malla = new THREE.InstancedMesh(inst, mat, MAX);
    this.malla.frustumCulled = false;
    this.malla.count = MAX;
    this.malla.renderOrder = 4;
    escena.add(this.malla);

    this.nubes = new Array(MAX);
    for (let i = 0; i < MAX; i++) {
      this.nubes[i] = { viva: false, pos: new THREE.Vector3(), vel: new THREE.Vector3(), t: 0, vida: 1, r0: 1, r1: 3, op: 0.5, tinte: 0.5, tierra: 0, giro: 0, dgiro: 0 };
    }
    this.cursor = 0;
    this.viento = new THREE.Vector3(0.38, 0.05, 0.2);
    this.densidad = new Float32Array(LADO * LADO);
    this._m = new THREE.Matrix4();
    this._v = new THREE.Vector3();
    this._q = new THREE.Quaternion();
    this._e = new THREE.Vector3(1, 1, 1);
    this.vivas = 0;
  }

  _libre () {
    for (let k = 0; k < MAX; k++) {
      const i = (this.cursor + k) % MAX;
      if (!this.nubes[i].viva) { this.cursor = (i + 1) % MAX; return this.nubes[i]; }
    }
    this.cursor = (this.cursor + 1) % MAX;
    return this.nubes[this.cursor];       // reciclar la más vieja disponible
  }

  soltar (pos, dir, opciones) {
    const o = opciones || {};
    const cant = o.cantidad || 14;
    for (let i = 0; i < cant; i++) {
      const n = this._libre();
      n.viva = true;
      n.t = 0;
      n.vida = (o.vida || 12) * (0.72 + Math.random() * 0.56);
      n.pos.copy(pos);
      n.pos.x += (Math.random() - 0.5) * 0.24;
      n.pos.y += (Math.random() - 0.5) * 0.24;
      n.pos.z += (Math.random() - 0.5) * 0.24;
      const emp = (o.empuje || 3.2) * (0.35 + Math.random());
      n.vel.copy(dir).multiplyScalar(emp * (i < cant * 0.4 ? 1.4 : 0.5));
      n.vel.x += (Math.random() - 0.5) * 1.5;
      n.vel.y += Math.random() * 0.9 + 0.15;
      n.vel.z += (Math.random() - 0.5) * 1.5;
      n.r0 = (o.radio || 0.28) * (0.6 + Math.random() * 0.9);
      n.r1 = n.r0 * (3.4 + Math.random() * 2.6);
      n.op = (o.opacidad || 0.5) * (0.6 + Math.random() * 0.7);
      n.tinte = Math.random() * 0.45 + (o.claro === undefined ? 0.4 : o.claro);
      n.tierra = o.tierra || 0;
      n.giro = Math.random() * Math.PI * 2;
      n.dgiro = (Math.random() - 0.5) * 0.5;
    }
  }

  actualizar (dt) {
    this.densidad.fill(0);
    let vivas = 0;
    for (let i = 0; i < MAX; i++) {
      const n = this.nubes[i];
      if (!n.viva) { this.alfa.array[i] = 0; this._m.makeScale(0, 0, 0); this.malla.setMatrixAt(i, this._m); continue; }
      n.t += dt;
      const u = n.t / n.vida;
      if (u >= 1) { n.viva = false; this.alfa.array[i] = 0; this._m.makeScale(0, 0, 0); this.malla.setMatrixAt(i, this._m); continue; }
      vivas++;

      // el empuje inicial se frena rápido y manda el viento
      const freno = Math.exp(-2.4 * dt);
      n.vel.multiplyScalar(freno);
      n.vel.x += (this.viento.x - n.vel.x) * dt * 0.55;
      n.vel.z += (this.viento.z - n.vel.z) * dt * 0.55;
      n.vel.y += (0.22 - n.vel.y) * dt * 0.4;      // la pólvora sube apenas
      n.pos.addScaledVector(n.vel, dt);
      if (n.pos.y < 0.25) { n.pos.y = 0.25; n.vel.y = Math.abs(n.vel.y) * 0.2; }
      n.giro += n.dgiro * dt;

      const r = n.r0 + (n.r1 - n.r0) * Math.pow(u, 0.55);
      // entra rápido, se va lento
      const a = n.op * Math.min(1, u / 0.06) * Math.pow(1 - u, 1.7);

      this._e.set(r, r, r);
      this._m.compose(n.pos, this._q, this._e);
      this.malla.setMatrixAt(i, this._m);
      this.alfa.array[i] = a;
      this.tinte.array[i] = n.tinte;
      this.tierra.array[i] = n.tierra;
      this.giro.array[i] = n.giro;

      // La tierra tapa MENOS que la pólvora. No es un ajuste de comodidad: el
      // humo de una descarga es dos veces más espeso que el polvo que levanta
      // un casco, y si pesaran igual una carga de caballería se cegaría a sí
      // misma y no llegaría nunca. Se dibuja entera; lo que baja es cuánto
      // cuenta para ver.
      this._sembrar(n.pos, r, a * (1 - n.tierra * 0.62));
    }
    this.vivas = vivas;
    this.malla.instanceMatrix.needsUpdate = true;
    this.alfa.needsUpdate = true;
    this.tinte.needsUpdate = true;
    this.tierra.needsUpdate = true;
    this.giro.needsUpdate = true;
  }

  _sembrar (pos, r, a) {
    if (a <= 0.01) return;
    const cx = Math.floor((pos.x + LADO * CELDA / 2) / CELDA);
    const cz = Math.floor((pos.z + LADO * CELDA / 2) / CELDA);
    const rad = Math.max(0, Math.round(r / CELDA));
    for (let dz = -rad; dz <= rad; dz++) {
      for (let dx = -rad; dx <= rad; dx++) {
        const x = cx + dx, z = cz + dz;
        if (x < 0 || z < 0 || x >= LADO || z >= LADO) continue;
        const d = Math.sqrt(dx * dx + dz * dz) / (rad + 1);
        this.densidad[z * LADO + x] += a * (1 - d) * 0.22;
      }
    }
  }

  densidadEn (v) {
    const x = Math.floor((v.x + LADO * CELDA / 2) / CELDA);
    const z = Math.floor((v.z + LADO * CELDA / 2) / CELDA);
    if (x < 0 || z < 0 || x >= LADO || z >= LADO) return 0;
    return Math.min(1, this.densidad[z * LADO + x]);
  }

  // Cuánto tapa el humo la línea entre dos puntos: 0 = se ve limpio, 1 = ciego.
  // Lo usan el jugador y la IA por igual.
  oclusion (a, b) {
    const dx = b.x - a.x, dz = b.z - a.z;
    const dist = Math.hypot(dx, dz);
    const pasos = Math.min(48, Math.max(2, Math.ceil(dist / CELDA)));
    let suma = 0;
    for (let i = 1; i <= pasos; i++) {
      const t = i / pasos;
      this._v.set(a.x + dx * t, 0, a.z + dz * t);
      suma += this.densidadEn(this._v);
    }
    return Math.min(1, (suma / pasos) * 1.5);
  }
}
