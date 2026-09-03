import * as THREE from 'three';

// Fogonazo de boca y estela del proyectil.
// Una bala de plomo no es trazadora: no se ve. Lo que sí se ve —y es enorme en
// un arma de chispa— es el chorro de pólvora ardiendo, y la perturbación que
// deja la bala al pasar. La estela se dibuja a la velocidad real: 450 m/s.

const VELOCIDAD_BALA = 450;
const LARGO_ESTELA = 14;

function texturaEstrella () {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 40);
  g.addColorStop(0.0, 'rgba(255,255,240,1)');
  g.addColorStop(0.25, 'rgba(255,224,150,0.85)');
  g.addColorStop(1.0, 'rgba(255,170,60,0)');
  x.fillStyle = g;
  x.beginPath(); x.arc(64, 64, 40, 0, Math.PI * 2); x.fill();
  // las puntas del fogonazo
  x.strokeStyle = 'rgba(255,236,190,0.8)';
  x.lineCap = 'round';
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + 0.3;
    const largo = 34 + Math.random() * 26;
    x.lineWidth = 3 + Math.random() * 5;
    x.beginPath();
    x.moveTo(64, 64);
    x.lineTo(64 + Math.cos(a) * largo, 64 + Math.sin(a) * largo);
    x.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---------------------------------------------------------------------------
// LAS PARTÍCULAS SUELTAS · chispas y salpicaduras
// ---------------------------------------------------------------------------
//
// Son dos efectos que parecen distintos y son el mismo: un puñado de puntitos
// que salen despedidos de un sitio, caen y se apagan. La chispa del acero es
// naranja, rápida y liviana; la salpicadura es oscura, lenta y pesada. Cambian
// tres números, no el sistema.
//
// Y VAN TODOS EN UN SOLO `Points`, que es lo que hace que esto no cueste nada:
// una llamada de dibujo para las noventa y seis partículas, hayan salido de un
// sablazo o de seis. Nada se crea mientras se juega —el buffer se reserva una
// vez y las partículas muertas se reciclan—, que es la regla de este proyecto
// para todo lo que pasa por el bucle de dibujo.
const MAX_CHISPAS = 96;

export class Fuego {
  constructor (escena, camara) {
    this.escena = escena;
    this.camara = camara;

    const geoEstrella = new THREE.PlaneGeometry(1, 1);
    this.matEstrella = new THREE.MeshBasicMaterial({
      map: texturaEstrella(), transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false
    });

    // chorro angosto: de costado es una lengua de fuego, de atrás casi no se ve
    const geoLlama = new THREE.ConeGeometry(0.06, 0.7, 8, 1, true);
    geoLlama.rotateX(-Math.PI / 2);
    geoLlama.translate(0, 0, -0.35);
    this.matLlama = new THREE.MeshBasicMaterial({
      color: 0xffd489, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
    });

    const geoEstela = new THREE.CylinderGeometry(0.011, 0.003, 1, 5, 1, true);
    geoEstela.rotateX(-Math.PI / 2);
    geoEstela.translate(0, 0, -0.5);
    this.matEstela = new THREE.MeshBasicMaterial({
      color: 0xdfe6ee, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false
    });

    this.llamas = [];
    this.estelas = [];
    for (let i = 0; i < 6; i++) {
      const l = new THREE.Mesh(geoLlama, this.matLlama.clone());
      l.visible = false; l.frustumCulled = false; l.renderOrder = 3;
      escena.add(l);
      const est = new THREE.Mesh(geoEstrella, this.matEstrella.clone());
      est.visible = false; est.frustumCulled = false; est.renderOrder = 4;
      escena.add(est);
      this.llamas.push({ malla: l, estrella: est, t: -1 });

      const e = new THREE.Mesh(geoEstela, this.matEstela.clone());
      e.visible = false; e.frustumCulled = false; e.renderOrder = 3;
      escena.add(e);
      this.estelas.push({ malla: e, t: -1, origen: new THREE.Vector3(), dir: new THREE.Vector3(), alcance: 100 });
    }
    this._q = new THREE.Quaternion();
    this._z = new THREE.Vector3(0, 0, -1);

    // LOS DOS ENJAMBRES. Mismo código, mismo costo, y separados por una sola
    // razón: cómo se mezclan con lo que hay detrás.
    //
    // La chispa es luz —acero al rojo saltando— y va en ADITIVA: se suma a lo
    // que tapa y por eso brilla. La sangre es lo contrario, es algo que TAPA, y
    // en aditiva una gota oscura sobre pasto claro directamente no se ve: lo
    // aditivo sólo puede aclarar. Son dos llamadas de dibujo en total, y la
    // segunda sólo existe si el que juega pidió sangre.
    this.acero = this._enjambre(escena, THREE.AdditiveBlending, 0.055);
    this.sangre = this._enjambre(escena, THREE.NormalBlending, 0.075);
    // LAS PAVESAS: los granos de pólvora que salen ardiendo por la boca. Es lo
    // que hace que un arma de chispa se vea sucia y no como un láser. Van en
    // aditiva como la chispa —son brasas— pero caen despacio y duran más.
    this.pavesa = this._enjambre(escena, THREE.AdditiveBlending, 0.038);
  }

  // Un enjambre: el buffer reservado de una vez, las partículas recicladas, y
  // UN `Points` para todas. Nada se crea mientras se juega.
  _enjambre (escena, mezcla, tam) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX_CHISPAS * 3), 3));
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(MAX_CHISPAS * 3), 3));
    const granos = [];
    for (let i = 0; i < MAX_CHISPAS; i++) {
      granos.push({ t: -1, vida: 1, peso: 9, r: 1, g: 1, b: 1,
        pos: new THREE.Vector3(), vel: new THREE.Vector3() });
    }
    const malla = new THREE.Points(geo, new THREE.PointsMaterial({
      size: tam, vertexColors: true, transparent: true, opacity: 1,
      blending: mezcla, depthWrite: false, sizeAttenuation: true
    }));
    malla.frustumCulled = false;
    malla.renderOrder = 4;
    malla.visible = false;
    escena.add(malla);
    return { granos, malla, geo };
  }

  // El puñado que sale de un sitio. `op` es lo que separa una chispa de acero
  // de una salpicadura: color, cuánto pesa, cuánto dura y con cuánta fuerza
  // sale. Todo lo demás es igual.
  _soltarGranos (enjambre, pos, dir, cant, op) {
    let puestas = 0;
    for (const c of enjambre.granos) {
      if (puestas >= cant) break;
      if (c.t >= 0) continue;
      puestas++;
      c.t = 0;
      c.vida = op.vida * (0.6 + Math.random() * 0.8);
      c.peso = op.peso;
      c.pos.copy(pos);
      c.vel.copy(dir).multiplyScalar(op.fuerza * (0.5 + Math.random()));
      c.vel.x += (Math.random() - 0.5) * op.abanico;
      c.vel.y += (Math.random() - 0.5) * op.abanico + op.arriba;
      c.vel.z += (Math.random() - 0.5) * op.abanico;
      const v = 0.75 + Math.random() * 0.5;
      c.r = op.r * v; c.g = op.g * v; c.b = op.b * v;
    }
  }

  // Correr un enjambre y volcarlo al buffer. Sólo se escriben las vivas y se
  // le dice al `Points` cuántas dibujar: las muertas no cuestan un vértice.
  _correrGranos (enjambre, dt) {
    const pos = enjambre.geo.attributes.position.array;
    const col = enjambre.geo.attributes.color.array;
    let n = 0;
    for (const c of enjambre.granos) {
      if (c.t < 0) continue;
      c.t += dt;
      if (c.t >= c.vida) { c.t = -1; continue; }
      c.vel.y -= c.peso * dt;
      c.pos.addScaledVector(c.vel, dt);
      if (c.pos.y < 0.02) { c.t = -1; continue; }     // llegó al suelo
      const f = 1 - c.t / c.vida;                      // se apaga apagándose
      pos[n * 3] = c.pos.x; pos[n * 3 + 1] = c.pos.y; pos[n * 3 + 2] = c.pos.z;
      col[n * 3] = c.r * f; col[n * 3 + 1] = c.g * f; col[n * 3 + 2] = c.b * f;
      n++;
    }
    enjambre.malla.visible = n > 0;
    if (n > 0) {
      enjambre.geo.setDrawRange(0, n);
      enjambre.geo.attributes.position.needsUpdate = true;
      enjambre.geo.attributes.color.needsUpdate = true;
    }
    return n;
  }

  // EL ACERO CONTRA EL ACERO. Es el único momento del duelo en que se ve que
  // pasó algo: sin esto, una parada perfecta y una tarde se ven igual.
  chispas (pos, dir) {
    this._soltarGranos(this.acero, pos, dir, 16,
      { vida: 0.42, peso: 11, fuerza: 3.4, abanico: 3.6, arriba: 1.4, r: 1, g: 0.72, b: 0.26 });
  }

  // LA PÓLVORA QUE SALE ARDIENDO. Pocas y chicas a propósito: son un detalle de
  // suciedad, no un efecto. Con quince por tiro y seiscientos cincuenta tiros
  // por batalla el enjambre viviría lleno y nunca se vería una sola apagarse;
  // con cinco se ven las de tu propio fusil, que es donde se miran.
  pavesas (pos, dir) {
    this._soltarGranos(this.pavesa, pos, dir, 5,
      { vida: 0.85, peso: 3.4, fuerza: 2.6, abanico: 1.1, arriba: 0.5, r: 1, g: 0.5, b: 0.14 });
  }

  // LA SALPICADURA. Quien la llama se fija primero si el que juega la pidió:
  // el juego viene sin sangre.
  salpicadura (pos, dir) {
    this._soltarGranos(this.sangre, pos, dir, 10,
      { vida: 0.55, peso: 16, fuerza: 1.9, abanico: 1.5, arriba: 0.9, r: 0.34, g: 0.03, b: 0.025 });
  }

  disparo (origen, dir, alcance) {
    const l = this.llamas.find(x => x.t < 0) || this.llamas[0];
    l.t = 0;
    l.malla.visible = true;
    l.malla.position.copy(origen);
    l.malla.quaternion.setFromUnitVectors(this._z, dir);
    l.malla.material.opacity = 1;
    const escala = 0.85 + Math.random() * 0.4;
    l.malla.scale.set(escala, escala, escala * (1 + Math.random() * 0.5));
    l.malla.rotateZ(Math.random() * Math.PI);

    l.estrella.visible = true;
    l.estrella.position.copy(origen).addScaledVector(dir, 0.06);
    l.estrella.material.opacity = 1;
    l.estrella.scale.setScalar(0.26 + Math.random() * 0.12);
    l.estrella.material.rotation = Math.random() * Math.PI;

    this.pavesas(l.estrella.position, dir);

    const e = this.estelas.find(x => x.t < 0) || this.estelas[0];
    e.t = 0;
    e.origen.copy(origen);
    e.dir.copy(dir);
    e.alcance = Math.min(alcance || 140, 140);
    e.malla.visible = true;
    e.malla.quaternion.setFromUnitVectors(this._z, dir);
  }

  actualizar (dt) {
    this._correrGranos(this.acero, dt);
    this._correrGranos(this.sangre, dt);
    this._correrGranos(this.pavesa, dt);
    for (const l of this.llamas) {
      if (l.t < 0) continue;
      l.t += dt;
      // el fogonazo dura lo que dura: cuatro centésimas
      const u = l.t / 0.05;
      if (u >= 1) { l.t = -1; l.malla.visible = false; l.estrella.visible = false; continue; }
      l.malla.material.opacity = (1 - u) * 0.95;
      l.malla.scale.z = (1 + u * 0.6) * 1.2;
      // la estrella siempre de frente a la cámara: el fogonazo se ve desde donde sea
      l.estrella.quaternion.copy(this.camara.quaternion);
      l.estrella.material.opacity = Math.pow(1 - u, 1.6);
      l.estrella.scale.setScalar(0.3 + u * 0.34);
    }

    for (const e of this.estelas) {
      if (e.t < 0) continue;
      e.t += dt;
      const cabeza = e.t * VELOCIDAD_BALA;
      const vida = e.alcance / VELOCIDAD_BALA + 0.09;
      if (e.t > vida) { e.t = -1; e.malla.visible = false; continue; }

      const frente = Math.min(cabeza, e.alcance);
      const cola = Math.max(0, frente - LARGO_ESTELA);
      const largo = frente - cola;
      if (largo <= 0.01) { e.malla.visible = false; continue; }
      e.malla.visible = true;
      e.malla.position.copy(e.origen).addScaledVector(e.dir, frente);
      e.malla.scale.set(1, 1, largo);
      // se ve un instante y se apaga
      const desvanece = cabeza >= e.alcance ? Math.max(0, 1 - (e.t - e.alcance / VELOCIDAD_BALA) / 0.09) : 1;
      e.malla.material.opacity = 0.34 * desvanece;
    }
  }
}
