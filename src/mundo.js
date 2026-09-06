import * as THREE from 'three';
import { construirSanLorenzo, Horno, MAT, BOTES, LIMITES as LIM_SANLORENZO } from './sanlorenzo.js';
import { construirAndes, LIMITES as LIM_ANDES } from './andes.js';
import { ponerCampo } from './jugador.js';

// Cuartel del Retiro, amanecer. Sol rasante, pasto seco de verano, cal blanca.
// Nada de fotorrealismo: paleta corta y formas simples, como un óleo de batalla.

export const PALETA = {
  cielo: 0x9fb2c4,
  cieloBajo: 0xd8c39b,
  pasto: 0xa89a63,
  pastoOsc: 0x7d7245,
  tierra: 0x8d7c5c,
  cal: 0xe8e2d2,
  madera: 0x6b543a,
  maderaOsc: 0x4a3a28,
  azul: 0x23385e,
  carmesi: 0x8f2126,
  bronce: 0xc69b54,
  hueso: 0xe6e2d6
};

function tierraTextura () {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = '#a89a63';
  x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 5200; i++) {
    const v = Math.random();
    x.fillStyle = v < 0.4 ? 'rgba(125,114,69,.5)' : (v < 0.8 ? 'rgba(184,172,118,.4)' : 'rgba(141,124,92,.45)');
    const w = 1 + Math.random() * 3;
    x.fillRect(Math.random() * 256, Math.random() * 256, w, w * (0.4 + Math.random()));
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(40, 40);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// EL SUELO CON MANCHAS. Tres ruidos de distinta escala sumados —uno de treinta
// metros que hace las manchas grandes, uno de once que las rompe y uno de
// cuatro que le saca el aire de tablero de ajedrez— y con eso se mueven el tono
// y el verde. Sin el tercero se ve la grilla del seno; con los tres, no.
const TIERRA_SECA = new THREE.Color(0xffe9c0);    // lo pisado y quemado
const TIERRA_VERDE = new THREE.Color(0xbfd096);   // lo que todavía aguanta

function tierraConManchas (an, al, nx, ny) {
  const g = new THREE.PlaneGeometry(an, al, nx, ny);
  const pos = g.attributes.position;
  const col = [];
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    // el plano todavía está de pie: su Y es la Z del mundo
    const x = pos.getX(i), z = pos.getY(i);
    const n1 = Math.sin(x * 0.021) * Math.cos(z * 0.017 + 1.3);
    const n2 = Math.sin(x * 0.058 + 2.1) * Math.cos(z * 0.049 - 0.7);
    const n3 = Math.sin((x + z) * 0.15 + 0.4);
    // Y EL VERDE ES MINORÍA. Es el 3 de febrero: pleno verano en Santa Fe, con
    // el campo quemado. Repartido mitad y mitad quedaba una pradera irlandesa;
    // elevado a 1,7 el verde se retira a las bajas y el resto queda seco, que
    // es lo que había.
    const t = Math.pow(0.5 + 0.5 * (n1 * 0.62 + n2 * 0.28 + n3 * 0.10), 1.7);
    // LOS DOS EXTREMOS RONDAN EL BLANCO, y eso no es un detalle: el color por
    // vértice MULTIPLICA la textura, así que cualquier cosa lejos del blanco le
    // cambia el tono medio a todo el campo. El primer intento usó valores de
    // 0,76 a 0,92 de luz y dejó los cuatrocientos metros pálidos y fríos.
    // Acá los dos extremos promedian uno: uno tira a tierra caliente y el otro
    // a verde apagado, y el tono general queda donde estaba.
    c.copy(TIERRA_SECA).lerp(TIERRA_VERDE, t);
    col.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}

function pastoTextura () {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d');
  x.clearRect(0, 0, 64, 64);
  for (let i = 0; i < 9; i++) {
    const bx = 6 + Math.random() * 52;
    const alto = 26 + Math.random() * 34;
    const inclina = (Math.random() - 0.5) * 18;
    const g = x.createLinearGradient(bx, 64, bx + inclina, 64 - alto);
    g.addColorStop(0, 'rgba(104,96,58,.95)');
    g.addColorStop(1, 'rgba(186,174,116,.5)');
    x.strokeStyle = g;
    x.lineWidth = 1.4 + Math.random() * 1.6;
    x.beginPath();
    x.moveTo(bx, 64);
    x.quadraticCurveTo(bx + inclina * 0.4, 64 - alto * 0.6, bx + inclina, 64 - alto);
    x.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function cieloDomo () {
  // Amanecer del 3 de febrero: naranja rasante abajo, azul limpio arriba.
  // 48x32 y no 24x16: el disco del sol se calcula por fragmento a partir de un
  // varying, y con triángulos de cuarenta grados la interpolación lo estiraba
  // en una veta vertical. Es una malla suelta sin culling, no cuesta nada.
  const geo = new THREE.SphereGeometry(300, 48, 32);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uAlto: { value: new THREE.Color(0x6d92bd) },
      uMedio: { value: new THREE.Color(0xa8bccf) },
      uBajo: { value: new THREE.Color(0xe8c793) },
      // el mismo rumbo que la luz direccional de abajo: si el sol se dibuja
      // en un lado y las sombras caen del otro, el amanecer se deshace
      uSol: { value: new THREE.Vector3(48, 15, -26).normalize() },
      uTiempo: { value: 0 }
    },
    vertexShader: `
      varying float vAltura;
      varying vec3 vDir;
      void main () {
        vDir = normalize(position);
        vAltura = vDir.y;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform vec3 uAlto; uniform vec3 uMedio; uniform vec3 uBajo;
      uniform vec3 uSol; uniform float uTiempo;
      varying float vAltura;
      varying vec3 vDir;

      float hash (vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float ruido (vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
                   mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
      }
      float fbm (vec2 p) {
        float v = 0.0, a = 0.5;
        for (int k = 0; k < 4; k++) { v += a * ruido(p); p *= 2.03; a *= 0.5; }
        return v;
      }

      void main () {
        // RENORMALIZAR. vDir sale unitario del vértice pero llega interpolado,
        // y un vector interpolado entre dos unitarios NO es unitario: se acorta
        // en el medio del triángulo. Con el disco elevado a 260 ese error de
        // largo se ve como una veta.
        vec3 d = normalize(vDir);
        float h = clamp(d.y, -0.2, 1.0);
        vec3 c = h < 0.16
          ? mix(uBajo, uMedio, smoothstep(-0.2, 0.16, h))
          : mix(uMedio, uAlto, smoothstep(0.16, 0.62, h));

        float haciaSol = max(dot(d, uSol), 0.0);

        // EL RESPLANDOR va antes que las nubes y el DISCO después: una nube
        // que pasa por delante del sol tapa el disco pero no el halo, que es
        // lo que hace el aire.
        c += vec3(1.0, 0.84, 0.58) * pow(haciaSol, 7.0) * 0.20;

        // LAS NUBES. Viven en un plano por encima de la cabeza y se las mira
        // en perspectiva: dividir por la altura las estira hacia el horizonte
        // igual que se estiran de verdad. Se desvanecen ahí abajo, donde la
        // proyección se vuelve infinita y la niebla del río ya tapa todo.
        vec2 uv = d.xz / max(d.y, 0.05) * 0.75 + vec2(uTiempo * 0.006, 0.0);
        float n = fbm(uv);
        float nube = smoothstep(0.34, 0.62, n) * smoothstep(0.02, 0.26, d.y);
        // a esta hora las nubes están encendidas del lado del sol y plomizas del otro
        vec3 colNube = mix(vec3(0.66, 0.66, 0.69), vec3(1.0, 0.88, 0.70), pow(haciaSol, 1.6));
        c = mix(c, colNube, nube * 0.88);

        c += vec3(1.0, 0.92, 0.72) * pow(haciaSol, 260.0) * (1.0 - nube) * 0.85;
        // Este cielo se pinta a mano y a propósito NO pasa por el mapeo de
        // tonos: los tres colores están elegidos a ojo contra la pantalla, ya
        // en el espacio de la pantalla. Meterlos por ACES los levantaría y el
        // amanecer se volvería mediodía. Lo que sí importa es que salga IGUAL
        // vaya el mundo derecho al lienzo o pase por el desenfoque de
        // velocidad, y de eso se ocupa la bandera del target (pasadaVelocidad.js).
        gl_FragColor = vec4(c, 1.0);
      }`
  });
  const m = new THREE.Mesh(geo, mat);
  m.frustumCulled = false;
  return {
    malla: m,
    actualizar: dt => { mat.uniforms.uTiempo.value += dt; },
    // La hora del día del capítulo. Los tres colores y el rumbo del sol son
    // uniformes, así que cambiar de amanecer a madrugada no rearma nada.
    pintar ([alto, medio, bajo], [sx, sy, sz]) {
      mat.uniforms.uAlto.value.setHex(alto);
      mat.uniforms.uMedio.value.setHex(medio);
      mat.uniforms.uBajo.value.setHex(bajo);
      mat.uniforms.uSol.value.set(sx, sy, sz).normalize();
    }
  };
}

function siluetaBlanco () {
  // Silueta de madera con forma de hombre: es a lo que se le tiraba de verdad.
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: PALETA.madera, roughness: 0.94 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.95, 0.09), mat);
  torso.position.y = 1.15;
  const cabeza = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.15, 0.3, 8), mat);
  cabeza.position.y = 1.78;
  const patas = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.72, 0.08), mat);
  patas.position.y = 0.36;
  const poste = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.1, 0.1),
    new THREE.MeshStandardMaterial({ color: PALETA.maderaOsc, roughness: 0.95 }));
  poste.position.set(0, 1.05, -0.09);
  [torso, cabeza, patas, poste].forEach(m => { m.castShadow = true; m.receiveShadow = true; g.add(m); });
  g.userData.blanco = true;
  return g;
}

// Sin mapa de entorno, un material metálico no tiene nada que reflejar y sale
// negro. Este es el cielo del amanecer reducido a una tira: alcanza para que el
// acero parezca acero y el latón, latón.
export function entornoIluminacion (render) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 128);
  g.addColorStop(0.00, '#5f86b8');
  g.addColorStop(0.42, '#a9c0d6');
  g.addColorStop(0.52, '#f0d3a2');
  g.addColorStop(0.62, '#b6a473');
  g.addColorStop(1.00, '#6d6244');
  x.fillStyle = g;
  x.fillRect(0, 0, 256, 128);
  // el sol bajo, hacia el este
  const sol = x.createRadialGradient(200, 60, 0, 200, 60, 46);
  sol.addColorStop(0, 'rgba(255,240,205,1)');
  sol.addColorStop(1, 'rgba(255,240,205,0)');
  x.fillStyle = sol;
  x.fillRect(150, 14, 100, 92);

  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  const pmrem = new THREE.PMREMGenerator(render);
  const entorno = pmrem.fromEquirectangular(tex).texture;
  pmrem.dispose();
  tex.dispose();
  return entorno;
}

// Niebla de río: tres capas horizontales que derivan despacio. Es lo que
// convierte el amanecer en una madrugada.
function capasDeNiebla (escena) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = c.getContext('2d');
  x.clearRect(0, 0, 256, 256);
  for (let i = 0; i < 60; i++) {
    const cx = Math.random() * 256, cy = Math.random() * 256;
    const r = 24 + Math.random() * 64;
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, 'rgba(255,255,255,' + (0.1 + Math.random() * 0.16).toFixed(3) + ')');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.fillRect(cx - r, cy - r, r * 2, r * 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);

  const capas = [];
  const alturas = [[0.35, 0.9, 0.16], [0.75, 0.7, 0.12], [1.25, 0.5, 0.085],
    [1.95, 0.34, 0.06], [3.0, 0.2, 0.04]];
  for (const [y, op, vel] of alturas) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(230, 230),
      new THREE.MeshBasicMaterial({
        map: tex.clone(), transparent: true, opacity: op * 0.22,
        depthWrite: false, color: 0xe4e6de, fog: true
      })
    );
    m.material.map.wrapS = m.material.map.wrapT = THREE.RepeatWrapping;
    m.material.map.repeat.set(3, 3);
    m.material.map.needsUpdate = true;
    m.rotation.x = -Math.PI / 2;
    m.position.set(0, y, -40);
    m.renderOrder = 1;
    escena.add(m);
    capas.push({ malla: m, vel, op: op * 0.22 });
  }
  return {
    capas,
    actualizar (dt) {
      for (const c2 of capas) {
        const mapa = c2.malla.material.map;
        mapa.offset.x += c2.vel * dt * 0.06;
        mapa.offset.y -= c2.vel * dt * 0.035;
      }
    }
  };
}

export function construirMundo (escena) {
  const cielo = cieloDomo();
  escena.add(cielo.malla);
  // niebla de las cinco de la mañana sobre el Paraná
  escena.fog = new THREE.Fog(0xd2d0c2, 20, 175);

  // --- luz de amanecer: sol bajo desde el este ---
  const sol = new THREE.DirectionalLight(0xffd9a0, 2.5);
  sol.position.set(48, 15, -26);
  sol.castShadow = true;
  sol.shadow.mapSize.set(2048, 2048);
  sol.shadow.camera.left = -60;
  sol.shadow.camera.right = 60;
  sol.shadow.camera.top = 60;
  sol.shadow.camera.bottom = -60;
  sol.shadow.camera.near = 1;
  sol.shadow.camera.far = 160;
  sol.shadow.bias = -0.0009;
  escena.add(sol);
  const rebote = new THREE.HemisphereLight(0xbcd2e8, 0x8a7a52, 0.55);
  escena.add(rebote);

  // --- suelo ---
  // El suelo llega hasta el borde de la barranca y no más: de ahí para allá
  // manda la cuesta y abajo está el río. Un plano infinito taparía las dos.
  //
  // Y NO ES UN PLANO LISO DE DOS TRIÁNGULOS. Lo era, con la textura de moteado
  // repetida cuarenta veces: eso da grano fino y CERO estructura grande, así
  // que cuatrocientos metros de campo eran un solo tono parejo de punta a
  // punta. Un campo de verdad tiene manchones de diez o veinte metros —lo
  // pisado, lo que todavía tiene verde, la tierra pelada de un camino— y eso
  // no lo puede dar una textura de veinticinco centímetros por lado.
  //
  // Se resuelve con COLOR POR VÉRTICE sobre una malla subdividida, que el
  // material multiplica contra la textura: el grano fino sigue siendo el mapa
  // y las manchas anchas las pone la geometría. Son 6.144 triángulos —contra
  // los 300.000 que ya dibuja una batalla— y NI UNA llamada de dibujo más.
  const suelo = new THREE.Mesh(
    tierraConManchas(400, 290, 64, 48),
    new THREE.MeshStandardMaterial({ map: tierraTextura(), roughness: 1, vertexColors: true })
  );
  suelo.position.z = 61;
  suelo.rotation.x = -Math.PI / 2;
  suelo.receiveShadow = true;
  escena.add(suelo);

  const colisiones = [];
  const blancos = [];

  // --- el lugar: convento, barranca y Paraná ---
  //
  // El eje de la batalla ya estaba bien puesto: los realistas vienen desde -Z
  // porque desembarcaron en la barranca, y vos salís desde +Z porque los
  // granaderos esperaron escondidos detrás del convento de San Carlos.
  const cal = new THREE.MeshStandardMaterial({ color: PALETA.cal, roughness: 0.92 });
  const lugar = construirSanLorenzo(escena, colisiones);

  // --- cobertura: sacos, carretas, barriles, tapiales ---
  //
  // Doscientas mallas sueltas costaban doscientas llamadas de dibujo cuando
  // el jugador miraba campo abajo. Es toda escenografía QUIETA —nada de esto
  // se mueve nunca— así que va fundida en una sola malla: una llamada para
  // todo el parque. Las cajas de colisión se calculan a mano, que es la
  // contrapartida de fundir: ya no se pueden sacar de los objetos.
  const parque = new Horno();
  const SACO = 0x8f855f;
  const MADERA_C = 0x6b543a, MADERA_O = 0x4a3a28, CAL_C = 0xe8e2d2;
  const meterCaja = (x0, z0, x1, z1, alto) => colisiones.push(new THREE.Box3(
    new THREE.Vector3(Math.min(x0, x1), 0, Math.min(z0, z1)),
    new THREE.Vector3(Math.max(x0, x1), alto, Math.max(z0, z1))));

  for (const [px, pz, largo] of [[-8, -6, 5], [7.5, -10, 4], [0, -18, 6], [-13, -22, 4],
    [12, -20, 5], [-4, -30, 5], [9, -34, 4], [-15, -38, 5], [3, -46, 6], [-9, -52, 4], [14, -50, 4]]) {
    for (let k = 0; k < largo; k++) {
      for (let f = 0; f < 2; f++) {
        parque.caja(px + (k - (largo - 1) / 2) * 1.02, 0.21 + f * 0.42,
          pz + f * 0.1 + (Math.random() - 0.5) * 0.06, 1.05, 0.42, 0.62,
          f ? SACO : 0x847a56, (Math.random() - 0.5) * 0.12);
      }
    }
    const semi = (largo - 1) * 0.51 + 0.55;
    meterCaja(px - semi, pz - 0.45, px + semi, pz + 0.55, 0.84);
  }

  // carretas de la intendencia: cobertura alta, de las que tapan de verdad
  const ruedaGeo = new THREE.TorusGeometry(0.66, 0.1, 6, 14);
  for (const [px, pz, giro] of [[-11, -14, 0.4], [10, -27, -0.7], [-6, -42, 1.1], [16, -40, 0.2]]) {
    const co = Math.cos(giro), si = Math.sin(giro);
    const local = (lx, lz) => [px + lx * co + lz * si, pz - lx * si + lz * co];
    let [cx, cz] = local(0, 0);
    parque.caja(cx, 1.05, cz, 1.7, 0.62, 2.5, MADERA_C, giro);
    parque.caja(cx, 0.74, cz, 1.8, 0.12, 2.6, MADERA_O, giro);
    for (const sx of [-1, 1]) {
      const [rx, rz] = local(sx * 0.95, 0.35);
      parque.pieza(ruedaGeo, [rx, 0.66, rz], [0, Math.PI / 2 + giro, 0], null, MADERA_O);
      for (let r = 0; r < 6; r++) {
        parque.caja(rx, 0.66, rz, 0.05, 1.24, 0.05, MADERA_O, 0);
        const ult = parque.piezas[parque.piezas.length - 1];
        ult.m.compose(new THREE.Vector3(rx, 0.66, rz),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 2 + giro, (r / 6) * Math.PI)),
          new THREE.Vector3(1, 1, 1));
      }
    }
    const [ex, ez] = local(0, 0.35);
    parque.caja(ex, 0.66, ez, 2.0, 0.11, 0.11, MADERA_O, giro);
    for (const sx of [-0.55, 0.55]) {
      const [vx, vz] = local(sx, -2.0);
      parque.caja(vx, 0.8, vz, 0.09, 0.09, 1.9, MADERA_C, giro);
    }
    meterCaja(px - 1.6, pz - 1.6, px + 1.6, pz + 1.6, 1.4);
  }

  // barriles de pólvora
  const barrilGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.86, 10);
  const aroGeo = new THREE.TorusGeometry(0.35, 0.025, 5, 10);
  for (const [px, pz] of [[5, -8], [5.9, -8.6], [-16, -30], [-15.2, -30.7], [2, -56], [11, -12]]) {
    parque.pieza(barrilGeo, [px, 0.43, pz], null, null, MADERA_C);
    for (const y of [0.62, 0.24]) parque.pieza(aroGeo, [px, y, pz], [Math.PI / 2, 0, 0], null, MADERA_O);
    meterCaja(px - 0.34, pz - 0.34, px + 0.34, pz + 0.34, 0.86);
  }

  // tapiales de adobe sueltos, a media altura
  for (const [px, pz, ancho, giro] of [[-19, -12, 4.5, 0.2], [17, -16, 3.5, -0.3],
    [-2, -36, 5, 0.6], [13, -58, 4, -0.15]]) {
    parque.caja(px, 0.62, pz, ancho, 1.25, 0.55, CAL_C, giro);
    const ex2 = Math.abs(ancho / 2 * Math.cos(giro)) + Math.abs(0.275 * Math.sin(giro));
    const ez2 = Math.abs(ancho / 2 * Math.sin(giro)) + Math.abs(0.275 * Math.cos(giro));
    meterCaja(px - ex2, pz - ez2, px + ex2, pz + ez2, 1.25);
  }

  const parqueMalla = parque.cocinar(MAT());
  escena.add(parqueMalla);

  // --- blancos a distancias reales de fusil de chispa ---
  // Van en su propio grupo: el polígono de tiro es del cuartel del Retiro y
  // arriba de la cordillera no pinta nada.
  const poligono = new THREE.Group();
  escena.add(poligono);
  for (const [x, z] of [[-6, -20], [-2, -20], [2, -20], [6, -20],
    [-4, -40], [4, -40], [0, -60], [-9, -60], [9, -80]]) {
    const b = siluetaBlanco();
    b.position.set(x, 0, z);
    b.rotation.y = Math.PI;
    poligono.add(b);
    blancos.push(b);
  }

  // carteles de distancia
  const marcas = [[-20, 'XX'], [-40, 'XL'], [-60, 'LX'], [-80, 'LXXX']];
  for (const [z] of marcas) {
    for (const s of [-1, 1]) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.5, 0.12),
        new THREE.MeshStandardMaterial({ color: PALETA.maderaOsc, roughness: 0.95 }));
      p.position.set(s * 17, 0.75, z);
      p.castShadow = true;
      poligono.add(p);
      const t = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.4, 0.06),
        new THREE.MeshStandardMaterial({ color: PALETA.cal, roughness: 0.9 }));
      t.position.set(s * 17, 1.6, z);
      poligono.add(t);
    }
  }

  // --- pasto: matas instanciadas, baratas y con viento ---
  // Eran 2600 sobre 120 m de ancho. El campo ahora mide 240 —se ensanchó para
  // que la pinza pueda rodear sin entrar de frente— y con la misma cuenta los
  // flancos quedaban pelados justo donde ahora se juega la maniobra.
  const PASTO = 8600;
  const mata = new THREE.PlaneGeometry(0.42, 0.4);
  mata.translate(0, 0.2, 0);
  const matas = new THREE.InstancedMesh(
    mata,
    new THREE.MeshStandardMaterial({
      map: pastoTextura(), color: 0xcfc292, roughness: 1,
      side: THREE.DoubleSide, transparent: true, alphaTest: 0.35, depthWrite: true
    }),
    PASTO
  );
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Vector3();
  const p = new THREE.Vector3();
  const col = new THREE.Color();
  for (let i = 0; i < PASTO; i++) {
    // el pasto termina en el borde de la barranca: no crece sobre el Paraná
    p.set((Math.random() - 0.5) * 248, 0, -Math.random() * 92 + 8);
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * Math.PI);
    const s = 0.55 + Math.random() * 1.15;
    e.set(s, s * (0.65 + Math.random() * 0.95), s);
    m4.compose(p, q, e);
    matas.setMatrixAt(i, m4);
    // MANCHONES, no una alfombra pareja. Un campo de verdad tiene pasto
    // quemado al lado de pasto que todavía aguanta, y el ruido suave hace
    // parches anchos en vez de confeti: se ve el terreno, no la instancia.
    //
    // UN SOLO SENO POR EJE DABA UNA GRILLA. El producto seno·coseno se repite
    // cada ciento cuarenta metros en cada eje y en un campo de doscientos
    // cuarenta eso se ve: las manchas quedaban ordenadas en filas. Con un
    // segundo ruido de otra escala y otro origen, no.
    //
    // Y el rango era angosto: todo el pasto caía entre dos pajas casi iguales.
    // Ahora va de la paja quemada al verde que todavía queda en las bajas, que
    // es lo que hace que el campo se lea como terreno y no como alfombra.
    const n1 = Math.sin(p.x * 0.045) * Math.cos(p.z * 0.038);
    const n2 = Math.sin(p.x * 0.019 + 1.7) * Math.cos(p.z * 0.023 - 0.9);
    const t = Math.pow(0.5 + 0.5 * (n1 * 0.55 + n2 * 0.45), 1.7);
    col.setHSL(0.145 - t * 0.035, 0.17 + t * 0.22, 0.38 + t * 0.26);
    matas.setColorAt(i, col);
  }
  matas.instanceMatrix.needsUpdate = true;
  matas.instanceColor.needsUpdate = true;
  matas.receiveShadow = true;
  escena.add(matas);

  // --- arboleda: los troncos frenan, y sirven de cobertura ---
  const cortezaMat = new THREE.MeshStandardMaterial({ color: 0x54432e, roughness: 1 });
  const follajeMat = new THREE.MeshStandardMaterial({ color: 0x4e5c39, roughness: 1, flatShading: true });
  // Los siete de siempre, más los de los flancos nuevos.
  //
  // DÓNDE NO VAN: las columnas de la pinza siguen puntos, no buscan camino, y
  // un tronco en el medio de la ruta las traba. Bajan por x=∓74, así que la
  // franja de 68 a 80 queda limpia a propósito. Los de más afuera (±86 y más)
  // sirven de cobertura al que rodea sin estorbarle el paso a nadie.
  const arboles = [
    [-30, -70, 1.6, 6.0, 6.5], [-18, -26, 0.5, 4.2, 2.6], [15, -44, 0.55, 4.6, 2.9],
    [-8, -60, 0.6, 5.0, 3.2], [22, -66, 0.5, 4.4, 2.7], [-24, -48, 0.45, 3.8, 2.4],
    [7, -72, 0.55, 4.8, 3.0],
    // entre el convento y el arranque del rodeo
    [-40, -14, 0.55, 4.6, 3.0], [42, -20, 0.6, 5.2, 3.4], [-44, -52, 0.5, 4.0, 2.6],
    [45, -58, 0.55, 4.4, 2.9], [38, 12, 0.5, 4.2, 2.7], [-37, 16, 0.45, 3.6, 2.3],
    // el monte de los flancos, por fuera de la ruta de las columnas
    [-88, -30, 1.4, 6.4, 6.0], [-84, -62, 0.7, 5.4, 3.6], [-91, 4, 0.6, 4.8, 3.1],
    [87, -34, 1.3, 6.2, 5.8], [83, -66, 0.65, 5.0, 3.4], [90, 8, 0.6, 4.6, 3.0],
    [-86, -78, 0.55, 4.2, 2.8], [85, -80, 0.5, 4.0, 2.6]
  ];
  // Tres lóbulos por copa en vez de una bola: una esfera sola se lee como
  // esfera, tres apenas corridas se leen como follaje. Sigue siendo una sola
  // llamada de dibujo porque son instancias de la misma geometría.
  // Separados sobre todo en ALTURA. Con los tres a la misma altura y corridos
  // de costado se funden en un disco y el árbol parece un plato volador: hay
  // que apilarlos, no desparramarlos. Y la copa va casi esférica —estaba
  // achatada a 0,8— porque el achatamiento es justo lo que hacía el plato.
  const LOBULOS = [[0, 0.00, 0, 1.00], [-0.26, 0.46, 0.16, 0.74], [0.22, 0.80, -0.14, 0.50]];
  // Instanciada: siete árboles con dos llamadas de dibujo en vez de catorce.
  // El tronco base mide 1 de radio y 1 de alto, y cada instancia lo escala.
  const troncos = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.6, 1, 1, 7), cortezaMat, arboles.length);
  const copas = new THREE.InstancedMesh(
    new THREE.SphereGeometry(1, 10, 8), follajeMat, arboles.length * LOBULOS.length);
  troncos.castShadow = copas.castShadow = true;
  troncos.receiveShadow = true;
  const _m = new THREE.Matrix4();
  const _q = new THREE.Quaternion();
  // NI DOS ÁRBOLES IGUALES, Y SIN UNA LLAMADA DE DIBUJO MÁS.
  //
  // Eran veintiuno con el MISMO verde y los tres lóbulos SIEMPRE en la misma
  // posición: veintiún ejemplares del mismo árbol, cambiados de tamaño. Se ve
  // sobre todo en el monte de los flancos, donde caen tres o cuatro juntos.
  //
  // Las dos cosas salen gratis porque ya son mallas instanciadas: el color va
  // por instancia —`setColorAt`, que el material multiplica— y la silueta sale
  // de correr los lóbulos con un ruido sacado del índice del árbol. Nada de
  // Math.random: así el bosque es el mismo en las dos máquinas de una partida
  // de a dos y entre una corrida y la siguiente de las pruebas.
  const _c = new THREE.Color();
  const azar = (n) => { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); };
  arboles.forEach(([x, z, radio, alto, copaR], i) => {
    _m.compose(new THREE.Vector3(x, alto / 2, z), _q, new THREE.Vector3(radio, alto, radio));
    troncos.setMatrixAt(i, _m);
    // la corteza, de gris claro a pardo oscuro
    _c.setHSL(0.09, 0.10 + azar(i + 7) * 0.16, 0.78 + azar(i + 13) * 0.34);
    troncos.setColorAt(i, _c);
    LOBULOS.forEach(([lx, ly, lz, r], k) => {
      const j = i * 3 + k;
      const dx = (azar(j + 1) - 0.5) * 0.52, dy = (azar(j + 31) - 0.5) * 0.30;
      const dz = (azar(j + 61) - 0.5) * 0.52, dr = 0.86 + azar(j + 91) * 0.30;
      _m.compose(
        new THREE.Vector3(x + (lx + dx) * copaR, alto + copaR * (0.34 + (ly + dy) * 0.78),
          z + (lz + dz) * copaR),
        _q, new THREE.Vector3(copaR * 1.02 * r * dr, copaR * 0.94 * r * dr, copaR * 1.0 * r * dr));
      copas.setMatrixAt(i * LOBULOS.length + k, _m);
      // EL VERDE ES DEL ÁRBOL, NO DEL LÓBULO: si cada lóbulo tirara su propio
      // color, una copa quedaría con tres tonos y se leería como tres arbustos
      // apilados. Varía de árbol a árbol, y apenas dentro de la copa para dar
      // volumen —el de arriba un poco más claro, que es donde pega el sol—.
      const verde = azar(i + 3);
      _c.setHSL(0.20 + verde * 0.06, 0.26 + verde * 0.22, 0.74 + verde * 0.30 + k * 0.05);
      copas.setColorAt(i * LOBULOS.length + k, _c);
    });
    colisiones.push(new THREE.Box3(
      new THREE.Vector3(x - radio, 0, z - radio), new THREE.Vector3(x + radio, alto, z + radio)));
  });
  troncos.instanceColor.needsUpdate = true;
  copas.instanceColor.needsUpdate = true;
  escena.add(troncos);
  escena.add(copas);

  const niebla = capasDeNiebla(escena);

  // -------------------------------------------------------------------------
  // EL CAMBIO DE CAPÍTULO
  // -------------------------------------------------------------------------
  //
  // Un capítulo NO se carga: se prende. Todo lo que hay se arma una sola vez
  // al arrancar y entrar a la cordillera es apagar San Lorenzo y cambiar la
  // luz. Suena a truco y es la decisión: rearmar el mundo obligaba a diferir
  // la construcción entera hasta que el que juega elige, y eso es reescribir
  // main.js —el jugador, los soldados y el gentío tienen agarrado lo que
  // devuelve esta función desde el primer renglón—.
  //
  // Y no cuesta nada: un grupo invisible no gasta una llamada de dibujo. El
  // día que la cordillera tenga su propio terreno se arma igual que éste, en
  // su grupo, y este mismo interruptor lo prende.
  //
  // LAS COLISIONES SE VACÍAN Y SE RELLENAN EN EL MISMO ARRAY. Cambiarlo por
  // otro no serviría: el jugador y los trescientos setenta hombres se quedaron
  // con el de antes, y estarían chocando contra un convento que ya no se ve.
  const colSanLorenzo = colisiones.slice();

  // EL PASO DE LOS ANDES, armado y apagado. Se arma acá y no cuando se lo
  // elige por lo mismo que todo lo demás: diferirlo obliga a diferir el mundo
  // entero. Apagado no gasta una llamada de dibujo, y lo único que paga San
  // Lorenzo es el armado del arranque.
  const colAndes = [];
  const paso = construirAndes(escena, colAndes);
  paso.visible = false;

  // Las dos horas del día que hay. San Lorenzo es el amanecer del 3 de febrero
  // —naranja rasante— y el Cruce es de madrugada, que es cuando se marchaba
  // para que la nieve estuviera dura y las mulas no se hundieran.
  const HORAS = {
    sanlorenzo: {
      cielo: [0x6d92bd, 0xa8bccf, 0xe8c793], sol: [48, 15, -26],
      luz: 0xffd9a0, fuerza: 2.5, rebote: [0xbcd2e8, 0x8a7a52, 0.55],
      niebla: 0xd2d0c2, cerca: 20, lejos: 175, exposicion: 1.05
    },
    andes: {
      cielo: [0x101c34, 0x1d2c48, 0x3b4560], sol: [-34, 26, 42],
      // LA LUNA Y, SOBRE TODO, EL REBOTE DE LA NIEVE. La luna es fría y floja;
      // lo que dibuja el piso de un nevado de noche es la propia nieve
      // devolviendo luz, así que el color de TIERRA del hemisférico es casi
      // blanco y no pardo. Con el pardo de San Lorenzo el piso salía azul
      // oscuro y con las olas del viento encima parecía un río: un desfiladero
      // con un río abajo, que no es el Cruce de los Andes.
      luz: 0xcfdcf2, fuerza: 0.95, rebote: [0x6b83ab, 0xbcc8da, 0.60],
      // La niebla se va más lejos que en el Paraná: adentro del desfiladero lo
      // que hay que ver es la pared enfrente y los picos del fondo, y con la
      // niebla corta el paso se cerraba a veinte metros y parecía un pasillo.
      niebla: 0x1b2434, cerca: 18, lejos: 210, exposicion: 1.15
    }
  };

  let capitulo = null;
  function entrarCapitulo (cual) {
    const h = HORAS[cual] || HORAS.sanlorenzo;
    if (capitulo === cual) return capitulo;
    capitulo = HORAS[cual] ? cual : 'sanlorenzo';
    const enAndes = capitulo === 'andes';

    // el lugar de cada capítulo, y lo que lo acompaña
    lugar.visible = !enAndes;
    paso.visible = enAndes;
    // EL PISO TAMBIÉN CAMBIA. El del capítulo 1 es tierra con manchones de
    // pasto quemado y su textura tira a verde: ningún color multiplicado le
    // saca el verde a un mapa verde, así que arriba se apaga entero y manda el
    // piso de nieve del paso, que trae el suyo.
    suelo.visible = !enAndes;
    parqueMalla.visible = !enAndes;
    poligono.visible = !enAndes;
    // arriba de los tres mil metros no hay pasto ni arboleda
    matas.visible = !enAndes;
    troncos.visible = copas.visible = !enAndes;
    // La niebla no se apaga: en la cordillera de noche también hay bruma,
    // pero es más oscura y más rala que la del Paraná al amanecer.
    for (const c of niebla.capas) {
      c.malla.material.color.setHex(enAndes ? 0x6d7d96 : 0xe4e6de);
      c.malla.material.opacity = c.op * (enAndes ? 0.55 : 1);
    }

    // la hora
    cielo.pintar(h.cielo, h.sol);
    sol.color.setHex(h.luz);
    sol.intensity = h.fuerza;
    sol.position.set(h.sol[0], h.sol[1], h.sol[2]);
    rebote.color.setHex(h.rebote[0]);
    rebote.groundColor.setHex(h.rebote[1]);
    rebote.intensity = h.rebote[2];
    escena.fog.color.setHex(h.niebla);
    escena.fog.near = h.cerca;
    escena.fog.far = h.lejos;
    colisiones.length = 0;
    for (const c of (enAndes ? colAndes : colSanLorenzo)) colisiones.push(c);
    // y hasta dónde se puede caminar, que también es del capítulo
    ponerCampo(enAndes ? LIM_ANDES : LIM_SANLORENZO);
    return capitulo;
  }

  return {
    colisiones,
    blancos,
    sol,
    niebla,
    cielo,
    botes: BOTES,
    entrarCapitulo,
    get capitulo () { return capitulo; },
    // hasta dónde llega el mundo del capítulo puesto, para el que lo quiera mirar
    get limite () { return (capitulo === 'andes' ? LIM_ANDES : LIM_SANLORENZO).z0; },
    exposicionDe: cual => (HORAS[cual] || HORAS.sanlorenzo).exposicion
  };
}
