import * as THREE from 'three';

// Figura de soldado con esqueleto.
//
// Dos cosas importantes acá:
//
// 1. FRENTE = -Z. El soldado gira con atan2(x,z)+PI, así que su cara mira
//    hacia -Z. Todo lo que va adelante (visera, chapa, nariz, caño) tiene z
//    negativo; la mochila va en +Z.
//
// 2. Las piezas se FUNDEN. Un granadero decente lleva unas cuarenta piezas
//    y cuarenta mallas por soldado nos comen el presupuesto de draw calls.
//    Cada pieza se cocina dentro del hueso que la mueve, con el color metido
//    en los vértices: quedan ~12 mallas por soldado en vez de cuarenta, con
//    dos materiales compartidos por todo el ejército.

export const TELA = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.93 });
export const METAL = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.36, metalness: 0.85 });

// ---------------------------------------------------------------- el horno

export class Taller {
  constructor () { this.lotes = new Map(); }

  // geo se clona siempre: la misma geometría puede ir a diez lugares
  add (hueso, geo, color, { p, r, s, metal = false } = {}) {
    const t = new THREE.Object3D();
    if (p) t.position.set(p[0], p[1], p[2]);
    if (r) t.rotation.set(r[0], r[1], r[2]);
    if (s !== undefined) Array.isArray(s) ? t.scale.set(s[0], s[1], s[2]) : t.scale.setScalar(s);
    t.updateMatrix();

    const clave = hueso.uuid + (metal ? '·m' : '·t');
    let lote = this.lotes.get(clave);
    if (!lote) { lote = { hueso, metal, piezas: [] }; this.lotes.set(clave, lote); }
    lote.piezas.push({ geo, color: new THREE.Color(color), m: t.matrix.clone() });
    return this;
  }

  cocinar () {
    const mallas = [];
    for (const { hueso, metal, piezas } of this.lotes.values()) {
      const pos = [], nor = [], col = [];
      for (const pz of piezas) {
        const g = pz.geo.index ? pz.geo.toNonIndexed() : pz.geo.clone();
        g.applyMatrix4(pz.m);
        const ap = g.attributes.position, an = g.attributes.normal;
        for (let i = 0; i < ap.count; i++) {
          pos.push(ap.getX(i), ap.getY(i), ap.getZ(i));
          nor.push(an.getX(i), an.getY(i), an.getZ(i));
          col.push(pz.color.r, pz.color.g, pz.color.b);
        }
        g.dispose();
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      geo.computeBoundingSphere();
      const malla = new THREE.Mesh(geo, metal ? METAL : TELA);
      malla.castShadow = true;
      hueso.add(malla);
      mallas.push(malla);
    }
    this.lotes.clear();
    return mallas;
  }
}

// ------------------------------------------------------------- geometrías

export const cil = (rt, rb, h, seg = 8) => new THREE.CylinderGeometry(rt, rb, h, seg);
export const caja = (x, y, z) => new THREE.BoxGeometry(x, y, z);
export const bola = (r, seg = 8) => new THREE.SphereGeometry(r, seg, Math.max(4, seg - 2));

// UNA MEDIA LUNA: el ala del bicornio, y nada más que eso.
//
// Se probó apilarla en tablillas —una caja por tramo, tan alta como diga la
// curva— y no sale. Derechas, las tapas quedan a distinta altura y de tres
// cuartos se ve un peine; inclinada cada una para seguir la pendiente, se le
// tuerce también el pie y las puntas se abren como antenas. El ala no es una
// pila de cajas: es UNA figura con dos arcos que se juntan en los extremos, y
// de ese encuentro sale el filo del cuerno. three.js la extruye exacta.
//
//   `alto`  la luz del ala en el medio, sobre la cabeza
//   `punta` cuánto suben los dos cuernos por encima del pie
//   `filo`  si viene, no es el ala entera sino una tira fina pegada al canto
//           de arriba: el galón dorado, que así corre por todo el borde
//
// Sale con las PUNTAS EN EL ORIGEN y el pie hacia abajo, para que al inclinarla
// gire sobre los cuernos: las dos mitades se abren por abajo, donde tiene que
// entrar la cabeza, y arriba siguen tocándose.
export const medialuna = (largo, alto, punta, grueso, filo = 0, tramos = 16) => {
  const arriba = t => alto + (punta - alto) * t * t;
  const abajo = t => (filo ? Math.max(arriba(t) - filo, punta * t * t) : punta * t * t);
  const f = new THREE.Shape();
  f.moveTo(-largo, arriba(-1));
  for (let i = 0; i <= tramos; i++) { const t = -1 + (2 * i) / tramos; f.lineTo(t * largo, arriba(t)); }
  for (let i = tramos; i >= 0; i--) { const t = -1 + (2 * i) / tramos; f.lineTo(t * largo, abajo(t)); }
  const g = new THREE.ExtrudeGeometry(f, { depth: grueso, bevelEnabled: false, curveSegments: 1 });
  g.translate(0, -punta, -grueso / 2);      // las puntas al origen
  g.rotateY(Math.PI / 2);                   // el espesor pasa a ser el ancho del sombrero
  return g;
};

// Una correa que abraza el cuerpo: aro achatado como el torso, listo para
// inclinarlo y cruzarlo en el pecho.
function correa (radio = 0.2, grosor = 0.023) {
  const g = new THREE.TorusGeometry(radio, grosor, 4, 16);
  g.rotateX(Math.PI / 2);
  g.scale(1, 1, 0.68);
  return g;
}

// ------------------------------------------------------------------ pinta

const PINTA = {
  granadero: {
    // el peto va azul como la casaca: si va blanco, las correas blancas
    // desaparecen y el granadero pierde la cruz del pecho
    casaca: 0x24365e, vivo: 0x8f2126, forro: 0x24365e,
    correa: 0xeee7d5,
    calzon: 0xe0dac6, pierna: 0x191a1e, bota: 0x141417,
    morrion: true, penacho: 0x8f2126, mochila: false
  },
  realista: {
    casaca: 0xdedac9, vivo: 0x8f2126, forro: 0xd0c8ae,
    // sobre casaca blanca las correas blancas no se ven: cuero de ante
    correa: 0x6a5539,
    calzon: 0x6e6a60, pierna: 0x6e6a60, bota: 0x1b1b1e,
    morrion: false, penacho: 0x8f2126, mochila: true
  }
};

// Tez. El Regimiento de Granaderos a Caballo se nutrió de libertos y morenos;
// el sargento Juan Bautista Cabral, hijo de esclavos, era uno de ellos. Una
// tropa toda blanca sería una mentira, así que la paleta va de trigueño a
// chocolate y la reparte el azar.
export const PIELES = [
  0xb08059, 0xa2724d, 0xc09068, 0x96663f, 0xb98d68,
  0x7d5433, 0x66422a, 0x53341f, 0x452a18
];
// la de Cabral no se sortea: siena oscuro, y va escrita
export const PIEL_CABRAL = 0x4e3020;
const PELOS = [0x2a1f18, 0x3d2c1e, 0x1c1512, 0x4a3624];

const NEGRO = 0x17181b;
const LATON = 0xc69b54;
const HIERRO = 0x555a61;
const MADERA = 0x50402b;
const CUERO = 0x3a2d20;
const LIENZO = 0x9a9076;
const MANTA = 0x7c7566;

// ---------------------------------------------------------------- esqueleto

// Medidas en metros, con los pies en y=0.
const CADERA = 0.92;
const MUSLO = 0.45;
const PANTORRILLA = 0.40;
const HOMBRO = 0.44;   // relativo a la cadera
const BRAZO = 0.30;
const ANTEBRAZO = 0.28;

function esqueleto () {
  const raiz = new THREE.Group();
  const h = {};

  h.cadera = new THREE.Group(); h.cadera.position.y = CADERA; raiz.add(h.cadera);
  h.torso = new THREE.Group(); h.cadera.add(h.torso);
  h.cabeza = new THREE.Group(); h.cabeza.position.y = HOMBRO + 0.10; h.torso.add(h.cabeza);

  for (const [lado, s] of [['I', -1], ['D', 1]]) {
    const hombro = new THREE.Group();
    hombro.position.set(s * 0.205, HOMBRO, 0);
    h.torso.add(hombro);
    const codo = new THREE.Group();
    codo.position.y = -BRAZO;
    hombro.add(codo);
    const mano = new THREE.Group();
    mano.position.y = -ANTEBRAZO;
    codo.add(mano);
    if (lado === 'D') { h.arma = new THREE.Group(); mano.add(h.arma); }
    h['hombro' + lado] = hombro; h['codo' + lado] = codo; h['mano' + lado] = mano;

    const muslo = new THREE.Group();
    muslo.position.set(s * 0.105, -0.02, 0);
    h.cadera.add(muslo);
    const rodilla = new THREE.Group();
    rodilla.position.y = -MUSLO;
    muslo.add(rodilla);
    h['muslo' + lado] = muslo; h['rodilla' + lado] = rodilla;
  }
  return { raiz, h };
}

// -------------------------------------------------------------------- ropa

function vestir (taller, h, c, piel, pelo, sombrero) {
  // ---- cadera: faldón, cinturón, cartuchera, morral
  taller.add(h.cadera, cil(0.172, 0.198, 0.26, 10), c.casaca, { p: [0, -0.11, 0], s: [1, 1, 0.74] });
  taller.add(h.cadera, correa(0.182, 0.026), NEGRO, { p: [0, 0.02, 0] });
  taller.add(h.cadera, caja(0.05, 0.05, 0.012), LATON, { p: [0, 0.02, -0.132], metal: true });
  // cartuchera atrás a la derecha
  taller.add(h.cadera, caja(0.17, 0.12, 0.085), CUERO, { p: [0.10, -0.06, 0.13], r: [0, -0.3, 0] });
  // morral de lienzo colgando del costado izquierdo, como en la referencia
  taller.add(h.cadera, caja(0.155, 0.13, 0.075), LIENZO, { p: [-0.125, -0.11, -0.095], r: [0.1, 0.35, 0] });
  taller.add(h.cadera, caja(0.155, 0.04, 0.08), CUERO, { p: [-0.125, -0.05, -0.097], r: [0.1, 0.35, 0] });

  // ---- torso
  taller.add(h.torso, cil(0.185, 0.156, 0.50, 10), c.casaca, { p: [0, 0.25, 0], s: [1, 1, 0.70] });
  // solapas: el paño del frente y los vivos que lo bordean
  taller.add(h.torso, caja(0.20, 0.42, 0.03), c.forro, { p: [0, 0.26, -0.122] });
  for (const s of [-1, 1]) {
    taller.add(h.torso, caja(0.036, 0.42, 0.038), c.vivo, { p: [s * 0.098, 0.26, -0.122] });
  }
  for (let i = 0; i < 5; i++) {
    const y = 0.09 + i * 0.085;
    for (const s of [-1, 1]) taller.add(h.torso, bola(0.011, 6), LATON, { p: [s * 0.048, y, -0.136], metal: true });
  }
  // cuello alto
  taller.add(h.torso, cil(0.102, 0.112, 0.11, 10), c.vivo, { p: [0, HOMBRO + 0.06, 0], s: [1, 1, 0.86] });

  // Correas cruzadas. Van como tablas que atraviesan el cuerpo y asoman un
  // centímetro por delante y por detrás: así la cruz se lee desde los cuatro
  // costados, que es lo que un aro achatado no consigue.
  for (const s of [-1, 1]) {
    taller.add(h.torso, caja(0.064, 0.52, 0.272), c.correa, { p: [0, 0.27, 0], r: [0, 0, s * 0.60] });
  }
  taller.add(h.torso, caja(0.08, 0.075, 0.02), LATON, { p: [0, 0.29, -0.145], metal: true });
  // faja a la cintura
  taller.add(h.torso, correa(0.166, 0.028), c.forro, { p: [0, 0.045, 0] });

  if (c.mochila) {
    taller.add(h.torso, caja(0.28, 0.28, 0.14), CUERO, { p: [0, 0.30, 0.185] });
    taller.add(h.torso, caja(0.15, 0.11, 0.06), CUERO, { p: [0, 0.24, 0.26] });
    taller.add(h.torso, cil(0.052, 0.052, 0.36, 7), MANTA, { p: [0, 0.46, 0.17], r: [0, 0, Math.PI / 2] });
  }

  // ---- cabeza
  taller.add(h.cabeza, cil(0.06, 0.068, 0.13, 8), piel, { p: [0, 0.02, 0] });
  taller.add(h.cabeza, bola(0.105, 10), piel, { p: [0, 0.155, 0], s: [0.98, 1.14, 1.05] });
  // pelo: casquete corrido hacia atrás, que la cara quede libre
  taller.add(h.cabeza, bola(0.101, 10), pelo, { p: [0, 0.162, 0.022], s: [1.03, 1.08, 1.02] });
  taller.add(h.cabeza, caja(0.028, 0.035, 0.035), piel, { p: [0, 0.148, -0.103] });          // nariz
  taller.add(h.cabeza, caja(0.082, 0.02, 0.028), pelo, { p: [0, 0.116, -0.099] });           // bigote
  for (const s of [-1, 1]) {
    taller.add(h.cabeza, bola(0.013, 6), 0x27211c, { p: [s * 0.037, 0.175, -0.092] });
    taller.add(h.cabeza, caja(0.02, 0.07, 0.055), pelo, { p: [s * 0.094, 0.15, -0.012] });   // patillas
  }

  if (sombrero === 'bicornio') {
    // EL BICORNIO DE SAN MARTÍN, y está acá por una razón de juego y no de
    // vestuario: en el acto Cabral el jugador deja de ser San Martín y tiene
    // que ENCONTRARLO tirado entre ciento veinte granaderos vestidos igual.
    // Sin una silueta distinta, buscarlo es buscar a cualquiera.
    //
    // VA DE ADELANTE HACIA ATRÁS, no de lado a lado. La primera versión lo puso
    // en batalla —ancho y chato— y queda otro sombrero: el del retrato es
    // angosto de frente y sube en dos puntas, adelante y atrás. De costado es
    // una media luna parada; de frente, un bonete. Esa es la silueta.
    taller.add(h.cabeza, cil(0.113, 0.124, 0.10, 12), NEGRO, { p: [0, 0.278, 0] });
    // EL ALA ES UNA CURVA, NO TRES CAJAS.
    //
    // La versión anterior armaba cada ala con un bloque en el medio y una
    // punta a cada lado, y de costado —que es justo desde donde se mira un
    // bicornio— se le veían los tres escalones: canto de arriba recto, dos
    // quiebres, y el galón en dos barritas sueltas que no llegaban a los
    // extremos. Parecía un tricornio golpeado.
    //
    // Ahora el borde de arriba sale de una PARÁBOLA: hundido sobre la cabeza y
    // levantándose hacia las dos puntas. Se arma en tablillas finas, cada una
    // tan alta como diga la curva en su sitio; con nueve, el escalón entre una
    // y otra es de milímetros y de lejos el canto se lee liso. El galón va
    // encima de cada tablilla, así que corre por todo el borde y no en dos
    // pedazos, que es lo que se ve en el retrato.
    //
    // Y las dos alas se abren hacia arriba —se tocan abajo, en la copa, y se
    // separan arriba—, que es lo que le da el hueco del medio y lo que hace
    // que de frente sea angosto y de perfil, ancho.
    const ALA = 0.152;          // media luz de punta a punta
    const LUZ = 0.152;          // la luz del ala en el medio
    const PUNTA = 0.246;        // cuánto suben los cuernos sobre el pie
    const PIE = 0.255;          // dónde apoya el ala sobre la copa
    const ABRE = 0.30;          // cuánto se abren las dos mitades POR ABAJO
    // Las dos mitades del ala doblada. Giran sobre los cuernos —la media luna
    // sale con las puntas en el origen— así que arriba se tocan y abajo se
    // separan justo lo que hace falta para que entre la cabeza. De frente es
    // una punta sola y angosta; de costado, la media luna entera.
    for (const s2 of [-1, 1]) {
      taller.add(h.cabeza, medialuna(ALA, LUZ, PUNTA, 0.030), NEGRO,
        { p: [s2 * 0.009, PIE + PUNTA, 0], r: [0, 0, s2 * ABRE] });
      // el galón dorado: una tira fina pegada al canto, de punta a punta
      taller.add(h.cabeza, medialuna(ALA, LUZ, PUNTA, 0.034, 0.011), LATON,
        { p: [s2 * 0.009, PIE + PUNTA, 0], r: [0, 0, s2 * ABRE], metal: true });
    }
    // Va CONTRA el ala delantera y no flotando al costado: la presilla sube
    // desde la escarapela hasta el galón, que es de donde cuelga.
    taller.add(h.cabeza, cil(0.042, 0.042, 0.012, 10), 0xe8e2d2,
      { p: [0.048, 0.345, -0.088], r: [0, 0, Math.PI / 2] });
    taller.add(h.cabeza, cil(0.025, 0.025, 0.016, 10), 0x74a9d8,
      { p: [0.050, 0.345, -0.088], r: [0, 0, Math.PI / 2] });
    taller.add(h.cabeza, caja(0.013, 0.105, 0.015), LATON,
      { p: [0.046, 0.405, -0.092], r: [0, 0, -0.10], metal: true });
  } else if (c.morrion) {
    // morrión: alto pero no descomunal. Es la silueta que se lee a cien metros.
    //
    // EL DE OFICIAL es el mismo con el penacho claro. Existe por el modo de a
    // dos: los otros jugadores tienen que distinguirse de los ciento veinte
    // bots vestidos igual, y San Martín ya se distingue por el bicornio. Es un
    // color, no un sombrero nuevo.
    const penacho = sombrero === 'oficial' ? 0xdfe6ee : c.penacho;
    taller.add(h.cabeza, cil(0.126, 0.117, 0.30, 12), NEGRO, { p: [0, 0.415, 0] });
    taller.add(h.cabeza, cil(0.122, 0.122, 0.026, 12), NEGRO, { p: [0, 0.272, 0] });
    taller.add(h.cabeza, caja(0.21, 0.015, 0.10), NEGRO, { p: [0, 0.265, -0.10], r: [0.26, 0, 0] });
    taller.add(h.cabeza, caja(0.088, 0.10, 0.018), LATON, { p: [0, 0.40, -0.118], metal: true });
    // cordones
    for (const y of [0.33, 0.49]) {
      taller.add(h.cabeza, correa(0.124, 0.008), c.correa, { p: [0, y, 0], r: [0, 0, 0.09], s: [1, 1, 1.42] });
    }
    // carrilleras de escamas
    for (const s of [-1, 1]) {
      taller.add(h.cabeza, caja(0.016, 0.115, 0.045), LATON, { p: [s * 0.101, 0.20, -0.018], r: [0, 0, s * 0.13], metal: true });
      taller.add(h.cabeza, bola(0.022, 6), LATON, { p: [s * 0.122, 0.29, -0.01], metal: true });
    }
    // pompón y penacho encarnado
    taller.add(h.cabeza, bola(0.052, 8), penacho, { p: [0, 0.573, -0.03], s: [1, 0.9, 1] });
    taller.add(h.cabeza, cil(0.012, 0.038, 0.185, 7), penacho, { p: [0, 0.685, -0.035] });
  } else {
    // sombrero redondo de ala ancha: copa baja, no galera
    taller.add(h.cabeza, cil(0.232, 0.232, 0.02, 16), NEGRO, { p: [0, 0.268, -0.005], s: [1, 1, 1.04] });
    taller.add(h.cabeza, cil(0.126, 0.142, 0.14, 14), NEGRO, { p: [0, 0.345, 0] });
    taller.add(h.cabeza, cil(0.132, 0.132, 0.028, 14), 0x0b0b0d, { p: [0, 0.288, 0] });
    // escarapela roja al costado izquierdo
    taller.add(h.cabeza, cil(0.042, 0.042, 0.012, 10), c.vivo, { p: [-0.138, 0.335, -0.045], r: [0, 0, Math.PI / 2] });
    taller.add(h.cabeza, cil(0.018, 0.018, 0.016, 8), 0xe8e2d2, { p: [-0.142, 0.335, -0.045], r: [0, 0, Math.PI / 2] });
  }

  // ---- brazos
  for (const [lado, s] of [['I', -1], ['D', 1]]) {
    const hombro = h['hombro' + lado], codo = h['codo' + lado];
    taller.add(hombro, cil(0.062, 0.051, BRAZO, 8), c.casaca, { p: [0, -BRAZO / 2, 0] });
    taller.add(hombro, bola(0.064, 8), c.casaca, { p: [0, -0.005, 0] });
    if (c.morrion) {
      // charretera con fleco: el granadero la lleva, el de línea no
      taller.add(hombro, caja(0.085, 0.026, 0.11), c.vivo, { p: [s * 0.028, 0.036, 0], r: [0, 0, s * 0.22] });
      taller.add(hombro, cil(0.038, 0.042, 0.075, 7), c.vivo, { p: [s * 0.058, -0.018, 0] });
    } else {
      taller.add(hombro, caja(0.078, 0.024, 0.10), c.vivo, { p: [s * 0.024, 0.032, 0], r: [0, 0, s * 0.22] });
    }
    taller.add(codo, cil(0.051, 0.044, ANTEBRAZO, 8), c.casaca, { p: [0, -ANTEBRAZO / 2, 0] });
    taller.add(codo, cil(0.055, 0.055, 0.07, 8), c.vivo, { p: [0, -ANTEBRAZO + 0.032, 0] });
    // la mano se cuece dentro del antebrazo: la muñeca no gira sola en
    // ninguna pose, y así son dos llamadas de dibujo menos por soldado
    taller.add(codo, bola(0.046, 7), piel, { p: [0, -ANTEBRAZO - 0.028, 0], s: [0.85, 1.05, 1] });
  }

  // ---- piernas
  for (const lado of ['I', 'D']) {
    const muslo = h['muslo' + lado], rodilla = h['rodilla' + lado];
    taller.add(muslo, cil(0.088, 0.072, MUSLO, 8), c.calzon, { p: [0, -MUSLO / 2, 0] });
    taller.add(rodilla, cil(0.073, 0.056, PANTORRILLA, 8), c.pierna, { p: [0, -PANTORRILLA / 2, 0] });
    if (c.morrion) {
      // vuelta de la bota
      taller.add(rodilla, cil(0.079, 0.079, 0.055, 8), c.bota, { p: [0, -0.028, 0] });
    }
    taller.add(rodilla, caja(0.10, 0.08, 0.24), c.bota, { p: [0, -PANTORRILLA - 0.005, -0.032] });
  }
}

// ------------------------------------------------------------------- armas

function fusilRealista (taller, mano) {
  taller.add(mano, cil(0.017, 0.017, 1.14, 7), HIERRO, { p: [0, 0, -0.40], r: [Math.PI / 2, 0, 0], metal: true });
  taller.add(mano, caja(0.048, 0.062, 1.02), MADERA, { p: [0, -0.022, -0.16] });
  taller.add(mano, caja(0.058, 0.11, 0.24), MADERA, { p: [0, -0.045, 0.28], r: [-0.16, 0, 0] });
  taller.add(mano, caja(0.05, 0.075, 0.07), HIERRO, { p: [0.02, 0.012, 0.06], metal: true });
  for (const z of [-0.30, -0.62]) {
    taller.add(mano, caja(0.055, 0.028, 0.03), LATON, { p: [0, -0.032, z], metal: true });
  }
  // bayoneta: 42 cm de acero, la razón de la tecla F
  taller.add(mano, cil(0.005, 0.011, 0.42, 5), HIERRO, { p: [0.028, 0.028, -1.15], r: [Math.PI / 2, 0, 0], metal: true });
  taller.add(mano, cil(0.024, 0.024, 0.07, 7), HIERRO, { p: [0.02, 0.018, -0.93], r: [Math.PI / 2, 0, 0], metal: true });
}

function tercerolaGranadero (taller, mano) {
  taller.add(mano, cil(0.016, 0.016, 0.78, 7), HIERRO, { p: [0, 0, -0.26], r: [Math.PI / 2, 0, 0], metal: true });
  taller.add(mano, caja(0.046, 0.058, 0.70), MADERA, { p: [0, -0.02, -0.06] });
  taller.add(mano, caja(0.055, 0.10, 0.22), MADERA, { p: [0, -0.042, 0.26], r: [-0.16, 0, 0] });
  taller.add(mano, caja(0.048, 0.072, 0.065), HIERRO, { p: [0.02, 0.012, 0.08], metal: true });
}

// La lanza del granadero montado. Va tomada cerca del regatón con la derecha
// y el asta sale hacia adelante: por eso mide 2,70 m y por eso llega antes que
// cualquier bayoneta. La banderola no es adorno —marca el largo del asta a
// simple vista, que es la información que el jugador necesita para medir la
// distancia de la pasada.
function lanzaGranadero (taller, mano) {
  const LARGO = 2.70;
  const PUNTA = -2.15;                 // el asta va sobre -Z, como el caño
  taller.add(mano, cil(0.017, 0.021, LARGO, 6), 0x6b4c2c, { p: [0, 0, PUNTA + LARGO / 2], r: [Math.PI / 2, 0, 0] });
  taller.add(mano, cil(0.024, 0.024, 0.05, 7), LATON, { p: [0, 0, 0.53], r: [Math.PI / 2, 0, 0], metal: true });  // regatón
  // moharra: hoja de acero de 24 cm con cubo
  taller.add(mano, cil(0.002, 0.026, 0.24, 4), HIERRO, { p: [0, 0, PUNTA - 0.12], r: [Math.PI / 2, 0, 0], metal: true });
  taller.add(mano, cil(0.026, 0.022, 0.10, 7), HIERRO, { p: [0, 0, PUNTA + 0.05], r: [Math.PI / 2, 0, 0], metal: true });
  // banderola celeste y blanca, plegada sobre el asta
  taller.add(mano, caja(0.004, 0.115, 0.30), 0x8fb8dd, { p: [0.017, 0.06, PUNTA + 0.30] });
  taller.add(mano, caja(0.004, 0.115, 0.30), 0xf2efe4, { p: [0.017, -0.055, PUNTA + 0.30] });
  // manopla de cuero donde apoya la mano
  taller.add(mano, cil(0.028, 0.028, 0.14, 7), CUERO, { p: [0, 0, 0.16], r: [Math.PI / 2, 0, 0] });
}

// EL CORVO EN LA MANO. El sable al cinto ya existe —es la vaina— pero el arma
// desenvainada no estaba: en tercera persona sólo había fusil, tercerola y
// lanza, así que un jugador con el corvo en alto se veía con una tercerola.
//
// La curva se hace con cinco tramos que van girando: es un sable corvo y su
// curva es la mitad de su carácter. Cada tramo arranca donde termina el
// anterior, así que la hoja no tiene escalones.
function sableEnMano (taller, mano) {
  taller.add(mano, cil(0.021, 0.021, 0.115, 7), CUERO, { p: [0, 0, 0.03], r: [Math.PI / 2, 0, 0] });   // puño
  taller.add(mano, caja(0.012, 0.10, 0.05), LATON, { p: [0, -0.008, -0.045], metal: true });           // guarda
  taller.add(mano, cil(0.026, 0.026, 0.02, 7), LATON, { p: [0, 0, 0.095], r: [Math.PI / 2, 0, 0], metal: true }); // pomo
  const TRAMOS = 5, LARGO = 0.155;
  let z = -0.075, y = 0, ang = 0;
  for (let i = 0; i < TRAMOS; i++) {
    ang += 0.115;                                   // la panza del corvo
    const zc = z - Math.cos(ang) * LARGO / 2;
    const yc = y + Math.sin(ang) * LARGO / 2;
    const ancho = 0.030 - i * 0.003;
    taller.add(mano, caja(0.008, ancho, LARGO), HIERRO,
      { p: [0, yc, zc], r: [Math.PI / 2 - (Math.PI / 2 - ang), 0, 0], metal: true });
    z -= Math.cos(ang) * LARGO;
    y += Math.sin(ang) * LARGO;
  }
}

// EL PISTOLÓN de arzón: caño corto, llave de chispa y culata de nogal que baja.
function pistolonEnMano (taller, mano) {
  taller.add(mano, cil(0.014, 0.015, 0.30, 7), HIERRO, { p: [0, 0.008, -0.13], r: [Math.PI / 2, 0, 0], metal: true });
  taller.add(mano, caja(0.034, 0.040, 0.26), MADERA, { p: [0, -0.014, -0.10] });
  taller.add(mano, caja(0.040, 0.058, 0.055), HIERRO, { p: [0.016, 0.010, 0.015], metal: true });   // llave
  taller.add(mano, cil(0.019, 0.019, 0.014, 6), HIERRO, { p: [0.030, 0.028, 0.005], r: [0, 0, Math.PI / 2], metal: true });
  // la culata cae hacia atrás y abajo, que es lo que lo hace un pistolón y no un caño
  taller.add(mano, caja(0.036, 0.10, 0.075), MADERA, { p: [0, -0.056, 0.075], r: [-0.42, 0, 0] });
  taller.add(mano, cil(0.024, 0.024, 0.026, 7), LATON, { p: [0, -0.10, 0.105], r: [Math.PI / 2 - 0.42, 0, 0], metal: true });
}

function sableAlCinto (taller, cadera) {
  const g = new THREE.Group();
  taller.add(cadera, cil(0.024, 0.03, 0.68, 7), 0x2c2f34, { p: [-0.19, -0.30, 0.10], r: [0.30, 0, -0.16], metal: true });
  taller.add(cadera, cil(0.03, 0.03, 0.06, 7), LATON, { p: [-0.175, 0.01, 0.05], r: [0.30, 0, -0.16], metal: true });
  taller.add(cadera, caja(0.02, 0.10, 0.055), CUERO, { p: [-0.17, -0.03, 0.02] });
  return g;
}

// -------------------------------------------------------------------- pose
//
// Las poses NO se escriben en ángulos de hombro y codo: así es imposible
// dejar las dos manos sobre el arma. Se escribe dónde va la mano derecha,
// hacia dónde mira el caño y a qué altura lo agarra la izquierda; el brazo
// lo resuelve una cinemática inversa de dos huesos.
//
// Las medidas van en el espacio de la CADERA (origen en la cintura, y hacia
// arriba, frente en -Z). Así el torso puede perfilarse sin arrastrar el arma:
// el soldado se pone de costado y el fusil sigue apuntando adelante.

const HOMBRO_L = { D: new THREE.Vector3(0.215, HOMBRO, 0), I: new THREE.Vector3(-0.215, HOMBRO, 0) };
const ALCANCE = (BRAZO + ANTEBRAZO) * 0.985;
const suj = (v, a, b) => Math.max(a, Math.min(b, v));

const POSES = {
  // armas terciadas: cruzada sobre el pecho, las dos manos puestas. Es la
  // silueta de una tropa que viene a buscarte, y se lee de frente.
  marcha: {
    manoD: [0.17, 0.13, -0.17], dir: [-0.40, 0.87, -0.28], agarre: 0.42,
    poloD: [1, -0.5, -0.4], poloI: [-1, -0.4, 0.2],
    torso: [0, 0, 0], cabeza: [0, 0, 0]
  },
  // A LA CARRERA: el fusil se lleva corto y bajo, no terciado sobre el pecho.
  // Un hombre que corre con la bayoneta al frente se ve distinto de uno que
  // marcha, y esa diferencia es la que avisa que se te viene encima.
  correr: {
    manoD: [0.21, 0.05, -0.24], dir: [-0.16, 0.30, -0.94], agarre: 0.44,
    poloD: [1, -0.6, -0.2], poloI: [-0.9, -0.6, 0.2],
    torso: [0.16, -0.30, 0], cabeza: [-0.10, 0.24, 0]
  },
  // encarado: culata en el hombro, cuerpo perfilado, cara sobre la caja
  apuntar: {
    manoD: [0.15, 0.43, -0.29], dir: [0, 0.02, -1], agarre: 0.46, roll: -0.10,
    poloD: [0.9, 0.75, 0.25], poloI: [-0.7, -0.9, 0.1],
    torso: [0, -0.62, 0], cabeza: [0.13, 0.34, 0]
  },
  // caño arriba, la izquierda trabajando la baqueta en la boca
  recargar: {
    manoD: [0.13, 0.09, -0.23], dir: [0.08, 0.99, -0.10], agarre: 0.62,
    poloD: [0.9, -0.6, -0.2], poloI: [-0.8, 0.2, -0.4],
    torso: [0.12, 0.30, 0], cabeza: [0.28, 0.18, 0]
  },
  // en guardia: bayoneta al frente a la altura del pecho, cuerpo de costado
  guardia: {
    manoD: [0.22, 0.26, -0.08], dir: [-0.28, 0.10, -0.95], agarre: 0.44,
    poloD: [1, -0.3, 0.3], poloI: [-0.7, -0.7, 0],
    torso: [0.04, -0.55, 0], cabeza: [0, 0.42, 0]
  },
  // EL AVISO: acero echado atrás y arriba, cuerpo enroscado. Medio segundo
  // largo en el que el jugador ve exactamente lo que se le viene.
  cargar: {
    manoD: [0.30, 0.36, 0.20], dir: [-0.30, 0.80, -0.52], agarre: 0.40,
    poloD: [1, 0.2, 0.5], poloI: [-0.6, -0.3, 0.3],
    torso: [-0.10, -0.70, 0], cabeza: [-0.05, 0.50, 0]
  },
  // parado en seco: el fusil se le va afuera y queda abierto de par en par.
  // Es la recompensa de la parada perfecta y tiene que verse desde lejos.
  aturdido: {
    manoD: [0.38, 0.14, 0.10], dir: [0.72, 0.62, -0.32], agarre: 0.30,
    poloD: [1.2, -0.4, 0.4], poloI: [-1, -0.7, -0.3],
    torso: [-0.22, 0.34, 0.18], cabeza: [-0.24, -0.20, 0]
  },
  // ---- a caballo ----
  //
  // La lanza no se lleva con las dos manos: la derecha la sujeta contra el
  // costado y la izquierda va a las riendas. Por eso estas poses traen manoI
  // explícita —el brazo izquierdo se despega del arma— en vez de dejar que la
  // izquierda busque el asta.
  //
  // En ristre: asta calzada bajo la axila, punta apenas por debajo del pecho
  // del enemigo. Es la silueta que hay que ver venir de lejos.
  enristre: {
    manoD: [0.26, 0.20, 0.06], dir: [-0.06, -0.05, -1], agarre: 0.30,
    manoI: [-0.26, 0.10, -0.30],
    poloD: [1, -0.4, 0.5], poloI: [-1, -0.5, 0.2],
    torso: [0.06, -0.30, 0], cabeza: [-0.04, 0.26, 0]
  },
  // EL AVISO del lancero: el brazo se echa atrás y la punta sube. Dura lo
  // mismo que el de la bayoneta, porque la regla del aviso no se negocia.
  lanzaAviso: {
    manoD: [0.34, 0.30, 0.26], dir: [-0.16, 0.16, -0.97], agarre: 0.28,
    manoI: [-0.28, 0.06, -0.26],
    poloD: [1, 0.1, 0.5], poloI: [-1, -0.5, 0.2],
    torso: [-0.06, -0.52, 0], cabeza: [-0.02, 0.44, 0]
  },
  // el lanzazo: el asta sale disparada al frente y el cuerpo la sigue
  lanzazo: {
    manoD: [0.16, 0.24, -0.30], dir: [0.03, -0.10, -0.99], agarre: 0.26,
    manoI: [-0.24, 0.02, -0.34],
    poloD: [0.9, -0.2, 0.3], poloI: [-1, -0.6, 0.1],
    torso: [0.10, 0.06, 0], cabeza: [0.06, 0, 0]
  },
  // al trote, sin nadie cerca: el asta va vertical apoyada en el estribo
  lanzaAlto: {
    manoD: [0.27, 0.10, 0.02], dir: [-0.12, 0.98, -0.14], agarre: 0.30,
    manoI: [-0.26, 0.12, -0.30],
    poloD: [1, -0.5, 0.3], poloI: [-1, -0.5, 0.2],
    torso: [0, -0.06, 0], cabeza: [0, 0.06, 0]
  },
  // el acero sale disparado: brazo casi estirado del todo
  estocada: {
    manoD: [0.05, 0.25, -0.47], dir: [0.02, -0.05, -1], agarre: 0.40,
    poloD: [0.8, -0.1, 0.2], poloI: [-0.6, -0.6, 0],
    torso: [0.10, 0.12, 0], cabeza: [0.08, 0, 0]
  }
};

const V = () => new THREE.Vector3();

export class Figura {
  // op.tez      — color de piel fijo (Cabral, por ejemplo); si no, lo sortea
  // op.arma     — 'lanza' para el granadero montado; si no, el arma del bando
  // op.sombrero — 'bicornio' para San Martín en el acto Cabral
  constructor (bando, semilla = Math.random(), op = {}) {
    const c = PINTA[bando] || PINTA.realista;
    const piel = op.tez || PIELES[Math.floor(semilla * PIELES.length) % PIELES.length];
    const pelo = PELOS[Math.floor(semilla * 977) % PELOS.length];

    const { raiz, h } = esqueleto();
    this.raiz = raiz;
    this.h = h;
    this.bando = bando;
    this.montura = false;        // true: piernas a horcajadas, sin paso
    // LEJOS: el cuerpo no se arma. La IA sigue entera, pero a cuarenta
    // metros nadie ve un codo, así que no se resuelve la cinemática: lo
    // dibuja la Lejanía con una postura horneada. Sólo se sigue contando
    // el paso, que es lo único que se lee desde ahí.
    this.lejos = false;
    this.rodilla = false;        // true: rodilla derecha en tierra, postura de tiro

    const taller = new Taller();
    vestir(taller, h, c, piel, pelo, op.sombrero);
    // EL ARMERO COMPLETO, sólo para quien cambia de arma.
    //
    // El Taller junta por hueso, así que todo lo que se cuelgue de la mano
    // termina en una sola malla y no se puede prender y apagar por pieza. Por
    // eso cada arma va en su PROPIO grupo colgado de la mano: cada una queda
    // con su malla y cambiar de arma es prender una y apagar las otras. Cero
    // geometría en el bucle de dibujo.
    //
    // Va sólo con `op.armas`, que hoy usan nada más que los cuerpos de los
    // otros jugadores —nueve como mucho—. Dárselo a los ciento veinte bots
    // sería multiplicar por cuatro la geometría del arma para nada: un bot no
    // cambia de arma en toda la batalla.
    if (op.armas) {
      this.armero = {};
      for (const [nombre, armar] of [['tercerola', tercerolaGranadero], ['lanza', lanzaGranadero],
        ['sable', sableEnMano], ['pistolon', pistolonEnMano]]) {
        const g = new THREE.Group();
        h.arma.add(g);
        armar(taller, g);
        this.armero[nombre] = g;
      }
      sableAlCinto(taller, h.cadera);
    } else if (op.arma === 'lanza') { lanzaGranadero(taller, h.arma); sableAlCinto(taller, h.cadera); }
    else if (c.morrion) { tercerolaGranadero(taller, h.arma); sableAlCinto(taller, h.cadera); }
    else fusilRealista(taller, h.arma);
    this.mallas = taller.cocinar();
    this.arma = h.arma;
    // el armero arranca con el arma que corresponde y todo lo demás apagado
    if (this.armero) { this.enMano = null; this.ponerArma(op.arma === 'lanza' ? 'lanza' : 'tercerola'); }

    // nadie es idéntico al de al lado: estatura y ancho varían un poco
    const alto = 0.955 + (semilla * 7919 % 1) * 0.09;
    raiz.scale.set(alto * 0.99, alto, alto * 0.99);

    this.paso = semilla * 6.283;
    this.pose = 'marcha';

    // estado interpolado
    this.cur = {
      manoD: V(), dir: V(), poloD: V(), poloI: V(),
      torso: V(), cabeza: V(), agarre: 0.4, roll: 0,
      // manoI sólo manda cuando la pose la trae (lanza, riendas). libreI es la
      // mezcla: 0 = la izquierda va al asta, 1 = va a donde diga la pose.
      manoI: V(-0.26, 0.10, -0.30), libreI: 0
    };
    const p = POSES.marcha;
    this.cur.manoD.fromArray(p.manoD);
    this.cur.dir.fromArray(p.dir).normalize();
    this.cur.poloD.fromArray(p.poloD);
    this.cur.poloI.fromArray(p.poloI);
    this.cur.agarre = p.agarre;

    // temporales, para no ensuciar el recolector cada cuadro
    this._t = { a: V(), b: V(), e: V(), u: V(), v: V(), n: V(), y: V(), z: V(), x: V(), s: V() };
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._qT = new THREE.Quaternion();
    this._qD = new THREE.Quaternion();
    this._qHD = new THREE.Quaternion();
    this._blancoI = V();

    this._armar();
  }

  // CAMBIAR DE ARMA. Prender una y apagar las otras, nada más: las cuatro ya
  // están armadas y colgadas de la mano desde el constructor. Sólo la tienen
  // las figuras hechas con `op.armas` —los cuerpos de los otros jugadores—;
  // en las demás no hace nada, que es lo que corresponde: un bot no cambia.
  ponerArma (nombre) {
    if (!this.armero || nombre === this.enMano) return;
    const cual = this.armero[nombre] ? nombre : 'tercerola';
    for (const k in this.armero) this.armero[k].visible = k === cual;
    this.enMano = cual;
  }

  poner (nombre) { if (POSES[nombre]) this.pose = nombre; }

  // altura del ojo sobre los pies: baja al hincar la rodilla
  get alturaOjo () { return (this.rodilla ? 1.22 : 1.60) * this.raiz.scale.y; }

  ocultarArma (v) { this.arma.visible = !v; }

  // ---- cinemática inversa de dos huesos, resuelta en espacio de cadera.
  // Devuelve la rotación del hombro en ese espacio para poder colgarle el arma.
  _brazo (lado, blanco, polo, qTorso, salida) {
    const t = this._t;
    const hombro = this.h['hombro' + lado], codo = this.h['codo' + lado];
    const S = t.s.copy(HOMBRO_L[lado]).applyQuaternion(qTorso);

    const dv = t.a.copy(blanco).sub(S);
    let d = dv.length();
    if (d < 1e-4) { dv.set(0, -1, 0); d = 1e-4; }
    const dir = dv.divideScalar(d);
    d = suj(d, Math.abs(BRAZO - ANTEBRAZO) + 0.03, ALCANCE);

    const A = Math.acos(suj((BRAZO * BRAZO + d * d - ANTEBRAZO * ANTEBRAZO) / (2 * BRAZO * d), -1, 1));
    const perp = t.b.copy(polo).addScaledVector(dir, -polo.dot(dir));
    if (perp.lengthSq() < 1e-6) perp.set(0, 0, 1).addScaledVector(dir, -dir.z);
    perp.normalize();

    const u = t.u.copy(dir).multiplyScalar(Math.cos(A)).addScaledVector(perp, Math.sin(A));
    const E = t.e.copy(S).addScaledVector(u, BRAZO);
    const v = t.v.copy(blanco).sub(E);
    if (v.lengthSq() < 1e-8) v.copy(u); else v.normalize();

    const n = t.n.crossVectors(u, v);
    if (n.lengthSq() < 1e-8) n.set(1, 0, 0).addScaledVector(u, -u.x).normalize(); else n.normalize();

    const yA = t.y.copy(u).negate();
    const zA = t.z.crossVectors(n, yA);
    this._m.makeBasis(n, yA, zA);
    const Q = this._q.setFromRotationMatrix(this._m);      // hombro en espacio cadera
    if (salida) salida.copy(Q);
    hombro.quaternion.copy(qTorso).invert().multiply(Q);
    codo.rotation.set(Math.acos(suj(u.dot(v), -1, 1)), 0, 0);
  }

  // punto del arma que la izquierda alcanza sin descoyuntarse
  _agarreI (manoD, dir, agarre, qTorso) {
    const t = this._t;
    const S = t.s.copy(HOMBRO_L.I).applyQuaternion(qTorso);
    const w = t.a.copy(manoD).sub(S);
    // |manoD + k·dir − S| = ALCANCE
    const b = w.dot(dir);
    const disc = b * b - (w.lengthSq() - ALCANCE * ALCANCE);
    let k = agarre;
    if (disc > 0) k = Math.min(agarre, Math.max(0.10, -b + Math.sqrt(disc)));
    else k = 0.16;
    return t.b.copy(manoD).addScaledVector(dir, k);
  }

  _armar () {
    const c = this.cur;
    const h = this.h;
    h.torso.rotation.set(c.torso.x, c.torso.y, c.torso.z);
    h.cabeza.rotation.set(c.cabeza.x, c.cabeza.y, c.cabeza.z);
    const qTorso = this._qT.setFromEuler(h.torso.rotation);

    this._brazo('D', c.manoD, c.poloD, qTorso, this._qHD);
    this._blancoI.copy(this._agarreI(c.manoD, c.dir, c.agarre, qTorso));
    if (c.libreI > 0.001) this._blancoI.lerp(c.manoI, c.libreI);
    this._brazo('I', this._blancoI, c.poloI, qTorso);

    // orientar el arma: el caño mira a dir, con el alza arriba
    const t = this._t;
    const zA = t.z.copy(c.dir).negate();
    const up = t.x.set(0, 1, 0);
    if (Math.abs(up.dot(zA)) > 0.985) up.set(0, 0, c.dir.y > 0 ? 1 : -1);
    if (c.roll) up.applyAxisAngle(c.dir, c.roll);
    up.addScaledVector(zA, -up.dot(zA)).normalize();
    const xA = t.n.crossVectors(up, zA);
    this._m.makeBasis(xA, up, zA);
    const qArma = this._q.setFromRotationMatrix(this._m);
    // el arma cuelga de la mano: hay que descontar hombro y codo
    const qMano = this._qD.copy(this._qHD).multiply(h.codoD.quaternion);
    this.arma.quaternion.copy(qMano.invert()).multiply(qArma);
  }

  actualizar (dt, andando, ritmo) {
    if (this.lejos) { if (andando) this.paso += dt * 6.6 * (ritmo || 1); return; }
    const p = POSES[this.pose] || POSES.marcha;
    const c = this.cur;
    const k = 1 - Math.exp(-10 * dt);

    c.manoD.lerp(this._t.a.fromArray(p.manoD), k);
    c.dir.lerp(this._t.b.fromArray(p.dir).normalize(), k).normalize();
    c.poloD.lerp(this._t.a.fromArray(p.poloD), k);
    c.poloI.lerp(this._t.b.fromArray(p.poloI), k);
    c.torso.lerp(this._t.a.fromArray(p.torso), k);
    c.cabeza.lerp(this._t.b.fromArray(p.cabeza || [0, 0, 0]), k);
    c.agarre += (p.agarre - c.agarre) * k;
    c.roll += ((p.roll || 0) - c.roll) * k;
    if (p.manoI) { c.manoI.lerp(this._t.a.fromArray(p.manoI), k); c.libreI += (1 - c.libreI) * k; }
    else c.libreI += (0 - c.libreI) * k;

    // paso: la cadera manda, la rodilla sólo dobla hacia atrás
    const kp = 1 - Math.exp(-9 * dt);
    if (this.rodilla) {
      // RODILLA EN TIERRA. La derecha apoya en el suelo, la izquierda queda
      // levantada adelante con el pie plano y la cadera baja de 0,92 a 0,52 m.
      // Es la postura de tiro reglamentaria y acá cumple dos funciones: afina
      // la puntería y —sobre todo— AVISA. Un soldado que hinca la rodilla te
      // está diciendo que va a disparar, y te lo dice desde lejos.
      const h = this.h;
      h.musloD.rotation.x += (-0.35 - h.musloD.rotation.x) * kp;
      h.rodillaD.rotation.x += (-1.07 - h.rodillaD.rotation.x) * kp;
      h.musloI.rotation.x += (1.21 - h.musloI.rotation.x) * kp;
      h.rodillaI.rotation.x += (-1.21 - h.rodillaI.rotation.x) * kp;
      h.musloD.rotation.z += (0.10 - h.musloD.rotation.z) * kp;
      h.musloI.rotation.z += (-0.14 - h.musloI.rotation.z) * kp;
      h.cadera.position.y += (0.52 - h.cadera.position.y) * kp;
      h.cadera.rotation.z += (0 - h.cadera.rotation.z) * kp;
      this._armar();
      return;
    }
    if (this.montura) {
      // a horcajadas: muslos abiertos y adelantados, rodilla doblada, pies en
      // los estribos. No hay paso que valga arriba de un caballo.
      const h = this.h;
      h.musloI.rotation.x += (-0.62 - h.musloI.rotation.x) * kp;
      h.musloD.rotation.x += (-0.62 - h.musloD.rotation.x) * kp;
      h.musloI.rotation.z += (-0.34 - h.musloI.rotation.z) * kp;
      h.musloD.rotation.z += (0.34 - h.musloD.rotation.z) * kp;
      h.rodillaI.rotation.x += (-0.86 - h.rodillaI.rotation.x) * kp;
      h.rodillaD.rotation.x += (-0.86 - h.rodillaD.rotation.x) * kp;
      h.cadera.position.y += (CADERA - h.cadera.position.y) * kp;
      h.cadera.rotation.z += (0 - h.cadera.rotation.z) * kp;
      this._armar();
      return;
    }
    if (andando) {
      // el ritmo lo pone quien llama: 1 es marcha, 2,3 es carrera
      const r = ritmo || 1;
      this.paso += dt * 6.6 * r;
      const amp = Math.min(1.5, r);
      const s = Math.sin(this.paso);
      this.h.musloI.rotation.x = s * 0.52 * amp;
      this.h.musloD.rotation.x = -s * 0.52 * amp;
      this.h.rodillaI.rotation.x = -Math.max(0, -Math.sin(this.paso - 0.7)) * 0.95 * amp;
      this.h.rodillaD.rotation.x = -Math.max(0, Math.sin(this.paso - 0.7)) * 0.95 * amp;
      this.h.cadera.position.y = CADERA + Math.abs(s) * 0.028 * amp;
      this.h.cadera.rotation.z = s * 0.035;
      this.h.musloI.rotation.z += (0 - this.h.musloI.rotation.z) * kp;
      this.h.musloD.rotation.z += (0 - this.h.musloD.rotation.z) * kp;
    } else {
      for (const n of ['musloI', 'musloD', 'rodillaI', 'rodillaD']) {
        this.h[n].rotation.x += (0 - this.h[n].rotation.x) * kp;
      }
      // y las piernas se cierran: el que se bajó del caballo camina normal
      this.h.musloI.rotation.z += (0 - this.h.musloI.rotation.z) * kp;
      this.h.musloD.rotation.z += (0 - this.h.musloD.rotation.z) * kp;
      this.h.cadera.position.y += (CADERA - this.h.cadera.position.y) * kp;
      this.h.cadera.rotation.z += (0 - this.h.cadera.rotation.z) * kp;
    }

    this._armar();
  }

  // se desploma de costado, no de cara: queda mejor sobre el pasto
  desplomar (e) {
    this.raiz.rotation.z = e * 1.35;
    this.raiz.rotation.x = e * 0.35;
    this.h.torso.rotation.x = e * 0.4;
    this.h.musloI.rotation.x = e * 0.5;
    this.h.musloD.rotation.x = e * 0.25;
    this.h.rodillaI.rotation.x = -e * 0.8;
  }
}
