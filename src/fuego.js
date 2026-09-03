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

// UN PUNTO REDONDO, Y NO UN CUADRADO.
//
// `PointsMaterial` sin textura dibuja cada partícula como un cuadrito plano:
// es lo que hace WebGL por defecto con los sprites de punto, y en pantalla se
// ve exactamente como suena —una chispa cuadrada, una gota de sangre cuadrada—.
// No se nota escribiéndolo, se nota jugando.
//
// La textura es un degradado radial de blanco a transparente, y va en BLANCO a
// propósito: el color de cada partícula viene por vértice y se multiplica con
// esto, así que una sola textura sirve para la chispa naranja, la pavesa y la
// sangre. Se genera una vez, al armar.
//
// El borde no se corta de golpe —la mitad de afuera se desvanece— porque un
// círculo duro de treinta píxeles tiene el borde dentado y vuelve a leerse
// como una figura y no como una brasa.
function texturaGrano () {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  // El núcleo NO va a opacidad plena. En aditiva, un centro opaco satura y la
  // chispa sale blanca: se pierde el naranja del acero al rojo, que es lo único
  // que la hace parecer una chispa y no un puntito de luz.
  g.addColorStop(0.00, 'rgba(255,255,255,0.82)');
  g.addColorStop(0.40, 'rgba(255,255,255,0.66)');
  g.addColorStop(1.00, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// LA MANCHA. Un borrón irregular con el borde comido: tres círculos que se
// pisan más unas gotas sueltas alrededor. Un círculo limpio se lee como un
// disco de plástico pegado encima; lo que hace que parezca sangre es que el
// contorno no cierre.
function texturaMancha () {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d');
  x.fillStyle = '#fff';
  const gota = (cx, cy, r) => { x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fill(); };
  gota(32, 32, 15); gota(24, 27, 11); gota(40, 36, 10);
  for (let i = 0; i < 9; i++) {
    const a = Math.random() * Math.PI * 2, d = 16 + Math.random() * 12;
    gota(32 + Math.cos(a) * d, 32 + Math.sin(a) * d, 1.5 + Math.random() * 3.5);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Cuántas manchas hay a la vez en todo el campo. Es un TECHO y no un cálculo:
// con doscientos cincuenta hombres recibiendo golpes, cualquier cosa que se
// acumule sin tope termina siendo el juego entero. Cuando se llena, la más
// vieja cede el lugar.
const MAX_MANCHAS = 44;

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
    this.acero = this._enjambre(escena, THREE.AdditiveBlending, 0.072);
    this.sangre = this._enjambre(escena, THREE.NormalBlending, 0.090);
    // LAS PAVESAS: los granos de pólvora que salen ardiendo por la boca. Es lo
    // que hace que un arma de chispa se vea sucia y no como un láser. Van en
    // aditiva como la chispa —son brasas— pero caen despacio y duran más.
    this.pavesa = this._enjambre(escena, THREE.AdditiveBlending, 0.052);
    this._armarManchas(escena);
  }

  // -------------------------------------------------------------------------
  // LAS MANCHAS · lo que queda después
  // -------------------------------------------------------------------------
  //
  // Sistema nuevo, y se avisa: hasta acá los efectos se apagaban solos y no
  // dejaban nada. Una mancha es lo contrario —se queda— y eso trae dos
  // problemas que las partículas no tienen: se acumula, y tiene que seguir al
  // cuerpo donde está pegada.
  //
  // Las dos cosas se resuelven con un `InstancedMesh` de cuarenta y cuatro y un
  // techo duro. UNA llamada de dibujo para todas las manchas del campo, hayan
  // salido de un balazo o de treinta, y cuando se llena la más vieja cede el
  // lugar. Sin techo, doscientos cincuenta hombres recibiendo golpes terminan
  // siendo el juego entero.
  //
  // Hay DOS clases y viven en el mismo pozo:
  //
  //   en el cuerpo  pegada al hombre, lo sigue mientras camina y cae con él.
  //                 Mira a la cámara, que a este tamaño es lo que se lee.
  //   en el piso    tirada de plano donde cayó, y ahí se queda.
  //
  // Nada de esto sale si el que juega no pidió sangre: quien llama pregunta
  // primero, igual que con la salpicadura.
  _armarManchas (escena) {
    const geo = new THREE.PlaneGeometry(1, 1);
    const mat = new THREE.MeshBasicMaterial({
      map: texturaMancha(), transparent: true, depthWrite: false,
      color: 0x5e0b0b, side: THREE.DoubleSide,
      polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4
    });
    this.manchas = new THREE.InstancedMesh(geo, mat, MAX_MANCHAS);
    this.manchas.frustumCulled = false;
    this.manchas.renderOrder = 2;
    this.manchas.count = 0;
    this.manchas.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    escena.add(this.manchas);
    this._mancha = [];
    for (let i = 0; i < MAX_MANCHAS; i++) {
      this._mancha.push({ usada: false, orden: 0, quien: null,
        local: new THREE.Vector3(), pos: new THREE.Vector3(), tam: 0.3, giro: 0 });
    }
    this._ordenMancha = 0;
    this._m4 = new THREE.Matrix4();
    this._esc = new THREE.Vector3();
    this._qm = new THREE.Quaternion();
    this._ojo = new THREE.Vector3();
  }

  // El hueco: uno libre, o el más viejo de todos.
  _huecoMancha () {
    let libre = null, viejo = this._mancha[0];
    for (const m of this._mancha) {
      if (!m.usada) { libre = m; break; }
      if (m.orden < viejo.orden) viejo = m;
    }
    const m = libre || viejo;
    m.usada = true;
    m.orden = ++this._ordenMancha;
    return m;
  }

  // PEGADA AL CUERPO. Se guarda el punto RELATIVO al hombre, no el absoluto:
  // el tipo sigue caminando y la mancha tiene que ir con él.
  mancharCuerpo (quien, punto, tam) {
    if (!quien) return;
    const m = this._huecoMancha();
    m.quien = quien;
    m.local.copy(punto).sub(quien.pos);
    m.tam = tam || (0.16 + Math.random() * 0.12);
    m.giro = Math.random() * Math.PI * 2;
  }

  // EN EL PISO, de plano y quieta. Es la que dice dónde pasó algo cuando ya no
  // queda nadie ahí.
  mancharPiso (punto, tam) {
    const m = this._huecoMancha();
    m.quien = null;
    m.pos.set(punto.x, 0.015, punto.z);
    m.tam = tam || (0.4 + Math.random() * 0.5);
    m.giro = Math.random() * Math.PI * 2;
  }

  // Cada cuadro: las del cuerpo siguen a su hombre y miran a la cámara; las
  // del piso ya están donde tienen que estar. Son cuarenta y cuatro matrices,
  // que al lado de trescientos setenta hombres no es nada.
  _correrManchas () {
    let n = 0;
    for (const m of this._mancha) {
      if (!m.usada) continue;
      if (m.quien) {
        if (!m.quien.malla || !m.quien.malla.parent) { m.usada = false; continue; }
        m.pos.copy(m.quien.pos).add(m.local);
        // Y SE DESPEGA DEL CUERPO HACIA EL QUE MIRA.
        //
        // Puesta en el punto del impacto, la mancha queda ADENTRO del torso y
        // la tapa el propio hombre: se pintaban y no se veía ninguna. Un cuerpo
        // acá mide unos veinte centímetros de fondo, así que se la corre hacia
        // la cámara la mitad de eso. Como además mira a la cámara, sale bien
        // desde cualquier lado y nunca se la ve flotando de canto.
        this.camara.getWorldPosition(this._ojo);
        this._ojo.sub(m.pos).normalize();
        m.pos.addScaledVector(this._ojo, 0.17);
        this._qm.copy(this.camara.quaternion);
      } else {
        this._qm.setFromAxisAngle(this._ejeX || (this._ejeX = new THREE.Vector3(1, 0, 0)), -Math.PI / 2);
      }
      this._esc.set(m.tam, m.tam, m.tam);
      this._m4.compose(m.pos, this._qm, this._esc);
      this.manchas.setMatrixAt(n, this._m4);
      n++;
    }
    this.manchas.count = n;
    if (n > 0) this.manchas.instanceMatrix.needsUpdate = true;
  }

  // Cuando se rearma el campo, no quedan manchas de la batalla anterior.
  limpiarManchas () {
    for (const m of this._mancha) { m.usada = false; m.quien = null; }
    this.manchas.count = 0;
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
      map: this._grano || (this._grano = texturaGrano()),
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
    // EL CHORRO, que es lo que dice para dónde salió el tiro. Van APRETADAS
    // contra la dirección del cañón —poco abanico y mucha fuerza— así que en
    // el cuadro del fogonazo se lee una lengua de brasas saliendo por la boca
    // y no una nubecita alrededor. Es la traza: dura tres cuartos de segundo
    // pero en ese rato dice hacia dónde apuntaste.
    this._soltarGranos(this.pavesa, pos, dir, 7,
      { vida: 0.30, peso: 2.2, fuerza: 15, abanico: 0.55, arriba: 0.1, r: 1, g: 0.66, b: 0.22 });
    // y las que se quedan dando vueltas en el humo, que caen despacio
    this._soltarGranos(this.pavesa, pos, dir, 4,
      { vida: 0.9, peso: 3.4, fuerza: 2.2, abanico: 1.2, arriba: 0.5, r: 1, g: 0.42, b: 0.12 });
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
    this._correrManchas();
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
