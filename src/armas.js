import * as THREE from 'three';
import { PALETA } from './mundo.js';
// el daño no se inventa acá: sale de la tabla
import { CULATAZO, BAYONETAZO } from './balance.js';

// Armas de fuego de chispa: tercerola de granadero, fusil de infantería con
// bayoneta (el que se le saca al realista) y pistolón de arzón.
// Las tres comparten la misma máquina de carga de siete pasos, que es
// interrumpible y persistente: cada arma se acuerda de dónde quedó.

// LOS CUATRO TIEMPOS.
//
// Eran siete y ahora son cuatro, y no es que se hayan tirado tres a la basura:
// se juntaron los que son un solo movimiento de la mano. Sacar el cartucho,
// morderlo y verter la pólvora es UN gesto —se saca, se muerde y se vuelca, sin
// soltar nada en el medio— y meter la bala y atacarla con la baqueta también.
//
// Lo que se conservó es lo que hay que conservar: los TRES tiempos que se
// marcan a mano —morder, baqueta y amartillar— y el cebado de la cazoleta, que
// es el paso propio del arma de chispa y el que se cobra cuando hay fogonazo
// sin tiro. Con siete pasos y tres marcas, la mitad de la carga era mirar. Con
// cuatro y tres, casi cada paso pide algo.
//
// Y son más cortos: de 7,70 s de reglamento a 3,45. Un granadero de 1813
// tardaba veinte segundos y hacía tres disparos por minuto; esto ya era una
// concesión al que juega, y ahora es una concesión un poco más grande.
export const PASOS = {
  morder:     { nombre: 'Morder y verter',        dur: 0.80, golpe: true },
  cebar:      { nombre: 'Cebar la cazoleta',      dur: 0.90, golpe: false },
  baqueta:    { nombre: 'Bala y baqueta',         dur: 1.20, golpe: true },
  amartillar: { nombre: 'Amartillar',             dur: 0.55, golpe: true }
};

export const SECUENCIA = ['morder', 'cebar', 'baqueta', 'amartillar'];

// Lo que tarda el arma en empezar a recargarse sola después del tiro: lo que
// dura el retroceso, para que el disparo se lea antes de que la mano vuelva.
const AUTO_CARGA = 0.5;

const PENAL = 0.9;
const RETARDO = 0.09;
const P_FOGONAZO = 0.04;
const P_CHISPA = 0.03;

export const ARMAS = {
  tercerola: {
    nombre: 'Tercerola', escala: 0.6, cargaMult: 1.0,
    conoCadera: 3.0, conoApuntado: 0.8,
    golpe: { nombre: 'Culatazo', alcance: 2.0, dano: CULATAZO, dur: 0.42 },
    largo: true
  },
  fusil: {
    nombre: 'Fusil con bayoneta', escala: 0.58, cargaMult: 1.18,
    conoCadera: 2.4, conoApuntado: 0.6,
    golpe: { nombre: 'Bayonetazo', alcance: 3.0, dano: BAYONETAZO, dur: 0.5 },
    largo: true
  },
  pistolon: {
    nombre: 'Pistolón de arzón', escala: 0.68, cargaMult: 0.48,
    conoCadera: 5.0, conoApuntado: 2.2,
    golpe: { nombre: 'Culatazo', alcance: 1.5, dano: CULATAZO, dur: 0.38 },
    largo: false
  }
};

// Cacha de nogal con embutido de plata: el dibujo de volutas del original.
function texturaCacha () {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = '#4a3526';
  x.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 260; i++) {           // veta de la madera
    x.strokeStyle = Math.random() < 0.5 ? 'rgba(58,41,30,.6)' : 'rgba(96,71,50,.35)';
    x.lineWidth = 0.6 + Math.random();
    x.beginPath();
    const y = Math.random() * 128;
    x.moveTo(0, y);
    x.bezierCurveTo(42, y + (Math.random() - 0.5) * 12, 86, y + (Math.random() - 0.5) * 12, 128, y);
    x.stroke();
  }
  x.strokeStyle = 'rgba(226,224,214,.85)';   // las volutas de plata
  x.lineCap = 'round';
  for (let i = 0; i < 16; i++) {
    const cx = Math.random() * 128, cy = Math.random() * 128;
    const r = 6 + Math.random() * 16;
    x.lineWidth = 1.1 + Math.random() * 0.9;
    x.beginPath();
    x.arc(cx, cy, r, Math.random() * 6, Math.random() * 3 + 2.2);
    x.stroke();
    x.beginPath();
    x.arc(cx + r * 0.8, cy + r * 0.5, r * 0.45, 0, Math.PI * 1.6);
    x.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function mat (color, rug, met) {
  return new THREE.MeshStandardMaterial({ color, roughness: rug === undefined ? 0.8 : rug, metalness: met || 0 });
}

// ---------------------------------------------------------------------------
// modelos
// ---------------------------------------------------------------------------

function llaveDeChispa (g, x, y, z, laton, hierro, cuelloDeCisne) {
  const placa = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.05, 0.12), hierro);
  placa.position.set(x, y - 0.016, z + 0.03);
  g.add(placa);

  const cazoleta = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.012, 0.03), laton);
  cazoleta.position.set(x - 0.004, y + 0.002, z);
  g.add(cazoleta);

  const rastrillo = new THREE.Group();
  const hoja = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.042, 0.026), hierro);
  hoja.position.set(0, 0.021, 0);
  rastrillo.add(hoja);
  rastrillo.position.set(x + 0.002, y + 0.004, z - 0.013);
  g.add(rastrillo);

  const martillo = new THREE.Group();
  if (cuelloDeCisne) {
    // el cuello de cisne: sube, se arquea hacia adelante y sostiene el pedernal
    const pie = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.03, 0.018), hierro);
    pie.position.set(0, 0.015, 0);
    const cuello = new THREE.Mesh(new THREE.BoxGeometry(0.011, 0.034, 0.014), hierro);
    cuello.position.set(0, 0.04, -0.011);
    cuello.rotation.x = 0.62;
    const mordaza = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.014, 0.026), hierro);
    mordaza.position.set(0, 0.056, -0.028);
    mordaza.rotation.x = 0.3;
    const tornillo = new THREE.Mesh(new THREE.SphereGeometry(0.008, 6, 5), hierro);
    tornillo.position.set(0, 0.066, -0.028);
    const pedernal = new THREE.Mesh(new THREE.BoxGeometry(0.013, 0.008, 0.02), mat(0x2c2b2a, 0.7));
    pedernal.position.set(0, 0.05, -0.04);
    martillo.add(pie, cuello, mordaza, tornillo, pedernal);
  } else {
    const brazo = new THREE.Mesh(new THREE.BoxGeometry(0.011, 0.046, 0.016), hierro);
    brazo.position.set(0, 0.023, 0);
    const pedernal = new THREE.Mesh(new THREE.BoxGeometry(0.013, 0.016, 0.022), mat(0x2c2b2a, 0.7));
    pedernal.position.set(0, 0.046, -0.008);
    martillo.add(brazo, pedernal);
  }
  martillo.position.set(x, y, z + 0.05);
  g.add(martillo);

  return { martillo, rastrillo };
}

// El brazo del granadero: casaca azul, bocamanga encarnada y galón blanco.
// Cuelga hacia abajo desde la muñeca; la inclinación se da con `rot`, que es
// mucho más predecible que calcularla entre dos puntos.
export function brazoGranadero (pos, rot, largo, grosor) {
  const g = new THREE.Group();

  const bocamanga = new THREE.Mesh(
    new THREE.BoxGeometry(grosor * 1.14, grosor * 0.5, grosor * 1.14), mat(PALETA.carmesi, 0.9));
  bocamanga.position.y = -grosor * 0.25;
  g.add(bocamanga);

  const manga = new THREE.Mesh(
    new THREE.BoxGeometry(grosor, largo, grosor * 0.94), mat(PALETA.azul, 0.9));
  manga.position.y = -largo * 0.5 - grosor * 0.45;
  g.add(manga);

  // vivo de la costura, apenas una línea
  const vivo = new THREE.Mesh(
    new THREE.BoxGeometry(grosor * 0.16, largo * 0.92, grosor * 0.16), mat(0xd8d2c0, 0.9));
  vivo.position.set(grosor * 0.45, -largo * 0.5 - grosor * 0.45, grosor * 0.45);
  g.add(vivo);

  g.position.copy(pos);
  g.rotation.copy(rot);
  return g;
}

// Brazo suelto: la manga arranca en la muñeca y se va hacia +Z con largo 1,
// así se estira con `scale.z` y se orienta con `lookAt` hacia el hombro.
// Ojo con el +Z: `lookAt` en un objeto común apunta el eje Z POSITIVO al
// objetivo, al revés que en una cámara.
export function brazoLibre (grosor) {
  const g = new THREE.Group();
  const bocamanga = new THREE.Mesh(
    new THREE.BoxGeometry(grosor * 1.14, grosor * 1.14, 0.05), mat(PALETA.carmesi, 0.9));
  bocamanga.position.z = 0.025;
  g.add(bocamanga);
  const manga = new THREE.Mesh(new THREE.BoxGeometry(grosor, grosor * 0.94, 1), mat(PALETA.azul, 0.9));
  manga.position.z = 0.5;
  g.add(manga);
  return g;
}

function manoYManga (g, xMano, yMano, zMano) {
  const guante = mat(0xb9ac93, 0.95);
  const manoDer = new THREE.Mesh(new THREE.BoxGeometry(0.058, 0.078, 0.105), guante);
  manoDer.position.set(xMano, yMano, zMano);
  g.add(manoDer);
  // el antebrazo cuelga de la muñeca hacia el hombro
  g.add(brazoGranadero(
    new THREE.Vector3(xMano, yMano - 0.03, zMano + 0.04),
    new THREE.Euler(-0.85, 0, -0.18), 0.46, 0.082));
  return manoDer;
}

function brazoIzquierdo (g, mano) {
  g.add(brazoGranadero(
    new THREE.Vector3(mano.position.x, mano.position.y - 0.03, mano.position.z + 0.04),
    new THREE.Euler(-0.95, 0, 0.3), 0.42, 0.076));
}

function fogonazoYLuz (g, boca) {
  const fogonazo = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xffd48a, transparent: true, opacity: 0 })
  );
  fogonazo.position.copy(boca);
  fogonazo.scale.set(1, 1, 1.9);
  g.add(fogonazo);
  const luz = new THREE.PointLight(0xffc46a, 0, 9, 2);
  luz.position.copy(boca);
  g.add(luz);
  return { fogonazo, luz };
}

function construirTercerola () {
  const g = new THREE.Group();
  const madera = mat(PALETA.madera, 0.85);
  const hierro = mat(0x4a4f55, 0.45, 0.85);
  const laton = mat(PALETA.bronce, 0.35, 0.9);
  const ejeY = 0.022;

  const canon = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.021, 0.95, 10), hierro);
  canon.rotation.x = Math.PI / 2;
  canon.position.set(0, ejeY, -0.42);
  g.add(canon);

  const caja = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.056, 0.72), madera);
  caja.position.set(0, -0.026, -0.28);
  g.add(caja);
  const culata = new THREE.Mesh(new THREE.BoxGeometry(0.062, 0.115, 0.30), madera);
  culata.position.set(0, -0.038, 0.13);
  culata.rotation.x = -0.13;
  g.add(culata);
  const cantonera = new THREE.Mesh(new THREE.BoxGeometry(0.066, 0.13, 0.03), laton);
  cantonera.position.set(0, -0.048, 0.28);
  cantonera.rotation.x = -0.13;
  g.add(cantonera);
  const guarda = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.006, 6, 10, Math.PI), laton);
  guarda.rotation.set(Math.PI / 2, 0, 0);
  guarda.position.set(0, -0.055, -0.01);
  g.add(guarda);

  // punto de mira de latón: lo único que había para apuntar en un ánima lisa
  const mira = new THREE.Mesh(new THREE.ConeGeometry(0.008, 0.022, 4), laton);
  mira.position.set(0, ejeY + 0.026, -0.86);
  g.add(mira);

  const { martillo, rastrillo } = llaveDeChispa(g, 0.032, 0.022, -0.083, laton, hierro);

  const baqueta = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.78, 6), mat(0x8a7550, 0.9));
  baqueta.rotation.x = Math.PI / 2;
  baqueta.position.set(0, -0.014, -0.36);
  g.add(baqueta);

  manoYManga(g, 0.012, -0.05, 0.02);
  const manoIzq = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.07, 0.095), mat(0xb9ac93, 0.95));
  manoIzq.position.set(-0.02, -0.045, -0.30);
  g.add(manoIzq);
  brazoIzquierdo(g, manoIzq);

  const boca = new THREE.Vector3(0, ejeY, -0.90);
  const { fogonazo, luz } = fogonazoYLuz(g, boca);
  return { g, ejeY, boca, martillo, rastrillo, baqueta, manoIzq, fogonazo, luz,
    miraY: ejeY + 0.026 + 0.011, traseraZ: 0.295,
    baquetaGuardada: { y: -0.014, z: -0.36 }, bocaZ: -0.90 };
}

function construirFusil () {
  const g = new THREE.Group();
  const madera = mat(0x7a6242, 0.85);
  const hierro = mat(0x4a4f55, 0.45, 0.85);
  const laton = mat(PALETA.bronce, 0.35, 0.9);
  const ejeY = 0.024;

  const canon = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.022, 1.32, 10), hierro);
  canon.rotation.x = Math.PI / 2;
  canon.position.set(0, ejeY, -0.62);
  g.add(canon);

  const caja = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.06, 1.12), madera);
  caja.position.set(0, -0.028, -0.48);
  g.add(caja);
  const culata = new THREE.Mesh(new THREE.BoxGeometry(0.064, 0.12, 0.32), madera);
  culata.position.set(0, -0.04, 0.11);
  culata.rotation.x = -0.12;
  g.add(culata);
  const cantonera = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.135, 0.03), hierro);
  cantonera.position.set(0, -0.05, 0.27);
  cantonera.rotation.x = -0.12;
  g.add(cantonera);
  for (const z of [-0.4, -0.75, -1.05]) {
    const abrazadera = new THREE.Mesh(new THREE.BoxGeometry(0.062, 0.07, 0.03), laton);
    abrazadera.position.set(0, 0.004, z);
    g.add(abrazadera);
  }
  const guarda = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.006, 6, 10, Math.PI), hierro);
  guarda.rotation.set(Math.PI / 2, 0, 0);
  guarda.position.set(0, -0.058, -0.06);
  g.add(guarda);

  const mira = new THREE.Mesh(new THREE.ConeGeometry(0.008, 0.024, 4), laton);
  mira.position.set(0, ejeY + 0.028, -1.2);
  g.add(mira);

  // la bayoneta: hoja triangular calada al costado del cañón
  const bayoneta = new THREE.Group();
  const cubo = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.07, 8), hierro);
  cubo.rotation.x = Math.PI / 2;
  cubo.position.set(0, ejeY, -1.24);
  const codo = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.03, 0.05), hierro);
  codo.position.set(0.03, ejeY + 0.012, -1.26);
  const hoja = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.003, 0.42, 3), hierro);
  hoja.rotation.x = Math.PI / 2;
  hoja.position.set(0.036, ejeY + 0.026, -1.5);
  bayoneta.add(cubo, codo, hoja);
  g.add(bayoneta);

  const baqueta = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 1.06, 6), hierro);
  baqueta.rotation.x = Math.PI / 2;
  baqueta.position.set(0, -0.02, -0.52);
  g.add(baqueta);

  manoYManga(g, 0.012, -0.052, -0.02);
  const manoIzq = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.07, 0.095), mat(0xb9ac93, 0.95));
  manoIzq.position.set(-0.02, -0.048, -0.46);
  g.add(manoIzq);
  brazoIzquierdo(g, manoIzq);

  const { martillo, rastrillo } = llaveDeChispa(g, 0.033, 0.024, -0.12, laton, hierro);

  const boca = new THREE.Vector3(0, ejeY, -1.28);
  const { fogonazo, luz } = fogonazoYLuz(g, boca);
  return { g, ejeY, boca, martillo, rastrillo, baqueta, manoIzq, fogonazo, luz,
    miraY: ejeY + 0.028 + 0.012, traseraZ: 0.285,
    baquetaGuardada: { y: -0.02, z: -0.52 }, bocaZ: -1.28 };
}

function construirPistolon () {
  const g = new THREE.Group();
  const nogal = new THREE.MeshStandardMaterial({ map: texturaCacha(), roughness: 0.72 });
  const acero = mat(0x9aa0a6, 0.3, 0.92);
  const hierro = mat(0x585d63, 0.4, 0.88);
  const plata = mat(0xd6d3c6, 0.35, 0.75);
  const ejeY = 0.032;

  // cañón largo y esbelto, con anillo en la boca y molduras torneadas
  const canon = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.021, 0.44, 12), acero);
  canon.rotation.x = Math.PI / 2;
  canon.position.set(0, ejeY, -0.24);
  g.add(canon);
  const anilloBoca = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.024, 0.028, 12), acero);
  anilloBoca.rotation.x = Math.PI / 2;
  anilloBoca.position.set(0, ejeY, -0.452);
  g.add(anilloBoca);
  for (const z of [-0.36, -0.14]) {
    const moldura = new THREE.Mesh(new THREE.CylinderGeometry(0.0225, 0.0225, 0.012, 12), acero);
    moldura.rotation.x = Math.PI / 2;
    moldura.position.set(0, ejeY, z);
    g.add(moldura);
  }

  // recámara y caja
  const recamara = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.05, 0.19), acero);
  recamara.position.set(0, ejeY - 0.004, -0.03);
  g.add(recamara);
  const caja = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.05, 0.2), nogal);
  caja.position.set(0, 0.0, -0.02);
  g.add(caja);

  // guardamonte de bocado ancho, como el de la foto
  const guarda = new THREE.Mesh(new THREE.TorusGeometry(0.034, 0.0045, 6, 14, Math.PI * 1.25), hierro);
  guarda.rotation.set(Math.PI / 2, 0, 0.35);
  guarda.position.set(0, -0.048, 0.012);
  g.add(guarda);
  const gatillo = new THREE.Mesh(new THREE.BoxGeometry(0.007, 0.022, 0.008), hierro);
  gatillo.position.set(0, -0.03, 0.012);
  gatillo.rotation.x = 0.3;
  g.add(gatillo);

  // cacha muy curva, con casquillo claro en la culata
  const cacha = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.15, 0.075), nogal);
  cacha.position.set(0, -0.085, 0.085);
  cacha.rotation.x = 0.5;
  g.add(cacha);
  const codo = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.06, 0.07), nogal);
  codo.position.set(0, -0.028, 0.055);
  codo.rotation.x = 0.22;
  g.add(codo);
  const casquillo = new THREE.Mesh(new THREE.SphereGeometry(0.036, 10, 8), plata);
  casquillo.position.set(0, -0.152, 0.128);
  casquillo.scale.set(0.72, 0.62, 0.85);
  g.add(casquillo);

  const { martillo, rastrillo } = llaveDeChispa(g, 0.028, 0.036, -0.05, plata, hierro, true);
  const placa = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.046, 0.14), acero);
  placa.position.set(0.026, 0.012, 0.0);
  g.add(placa);

  const baqueta = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.34, 6), plata);
  baqueta.rotation.x = Math.PI / 2;
  baqueta.position.set(0, -0.004, -0.24);
  g.add(baqueta);

  manoYManga(g, 0.006, -0.075, 0.075);
  const manoIzq = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.065, 0.085), mat(0xb9ac93, 0.95));
  manoIzq.position.set(-0.035, -0.05, -0.02);
  g.add(manoIzq);

  const boca = new THREE.Vector3(0, ejeY, -0.47);
  const { fogonazo, luz } = fogonazoYLuz(g, boca);
  return { g, ejeY, boca, martillo, rastrillo, baqueta, manoIzq, fogonazo, luz,
    miraY: ejeY + 0.026 + 0.007, traseraZ: 0.165,
    baquetaGuardada: { y: -0.004, z: -0.24 }, bocaZ: -0.47 };
}

const CONSTRUCTORES = { tercerola: construirTercerola, fusil: construirFusil, pistolon: construirPistolon };

// Poses. La de apuntado es la que importa: el ojo va POR ENCIMA y por detrás
// del cañón, no en su eje. Se alinea el punto de mira con el centro exacto de
// la pantalla y se mete el arma hasta que la culata queda detrás de la cámara,
// donde la recorta el plano cercano. Así se ve el cañón alejándose hacia la
// mira —lo único que había para apuntar en un ánima lisa de 1813— y la culata
// no tapa nada.
function posesPara (tipo, p, escala) {
  const alturaMira = p.miraY * escala;
  const fondo = p.traseraZ * escala;

  if (tipo === 'pistolon') {
    // la pistola se sostiene con el brazo estirado: se ve entera
    return {
      reposo:   { p: new THREE.Vector3(0.15, -0.15, -0.32), r: new THREE.Euler(0.05, 0.24, 0.05) },
      apuntado: { p: new THREE.Vector3(0.00, -alturaMira, -0.30), r: new THREE.Euler(0, 0, 0) },
      carga:    { p: new THREE.Vector3(0.13, -0.26, -0.40), r: new THREE.Euler(0.75, -0.34, 0.30) },
      golpe:    { p: new THREE.Vector3(0.10, -0.14, -0.30), r: new THREE.Euler(-0.1, 0.1, 0.1) }
    };
  }
  const largo = tipo === 'fusil';
  return {
    reposo:   { p: new THREE.Vector3(0.19, -0.15, largo ? -0.40 : -0.46), r: new THREE.Euler(0.05, 0.17, 0.03) },
    apuntado: { p: new THREE.Vector3(0.00, -alturaMira, -fondo - 0.02), r: new THREE.Euler(0, 0, 0) },
    carga:    { p: new THREE.Vector3(0.15, -0.23, -0.44), r: new THREE.Euler(0.86, -0.30, 0.34) },
    golpe:    { p: new THREE.Vector3(0.06, -0.13, -0.30), r: new THREE.Euler(-0.06, 0.06, 0.06) }
  };
}

// ---------------------------------------------------------------------------

export class ArmaFuego {
  constructor (tipo, camaraArma, camaraMundo, sonido, humo) {
    this.tipo = tipo;
    this.cfg = ARMAS[tipo];
    this.camara = camaraArma;
    this.camaraMundo = camaraMundo;
    this.sonido = sonido;
    this.humo = humo;

    this.polvora = false;
    this.bala = false;
    this.cebado = false;
    this.amartillada = false;

    this.secuencia = SECUENCIA.slice();
    this.paso = 0;
    this.autoCarga = 0;        // > 0: está por ponerse a cargar sola
    this.alPedirCarga = null;  // el arsenal dice si queda cartucho
    this.tPaso = 0;
    this.penal = 0;
    this.marcado = null;
    this.cargando = false;
    this.guardada = true;

    this.tiros = 0;        // sólo para llevar la cuenta
    this.apuntando = false;
    this.esperaTiro = -1;
    this.presion = 0;
    this.penalPostura = 1;      // agachado carga más lento, tirado no se puede

    this.tGolpe = -1;
    this.golpeAplicado = false;

    this.retroceso = 0;
    this.temblor = 0;

    this.alDisparar = null;
    this.alGolpear = null;
    this.alAviso = null;

    const p = CONSTRUCTORES[tipo]();
    Object.assign(this, p);
    this.grupo = p.g;
    this.poses = posesPara(tipo, p, this.cfg.escala);
    this.manoIzqBase = p.manoIzq.position.clone();

    this.cartucho = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.04, 6), mat(0xd8cdb4, 0.95));
    this.cartucho.rotation.z = Math.PI / 2;
    this.cartucho.visible = false;
    this.grupo.add(this.cartucho);

    this.grupo.scale.setScalar(this.cfg.escala);
    this.grupo.position.copy(this.poses.reposo.p);
    this.grupo.rotation.copy(this.poses.reposo.r);
    this.grupo.visible = false;
    this.grupo.traverse(o => { o.frustumCulled = false; });
    camaraArma.add(this.grupo);
  }

  // ---------- estado ----------
  get cargada () { return this.polvora && this.bala; }
  get lista () { return this.cargada && this.cebado && this.amartillada; }
  get pasoActual () { return this.secuencia[this.paso]; }
  get aMedias () { return this.paso > 0 && this.paso < this.secuencia.length; }
  get nombre () { return this.cfg.nombre; }

  get etiquetaEstado () {
    if (this.lista) return 'lista';
    if (this.cargada && this.cebado) return 'sin amartillar';
    if (this.cargada) return 'sin cebar';
    if (this.aMedias) return 'a medio cargar';
    return 'descargada';
  }

  sacar () { this.guardada = false; this.grupo.visible = true; }
  guardar () { this.guardada = true; this.grupo.visible = false; this.cargando = false; this.tGolpe = -1; }

  _duracion (id) {
    return PASOS[id].dur * this.cfg.cargaMult * this.penalPostura;
  }

  _ventana (id) {
    const d = this._duracion(id) + this.penal;
    const ancho = d * 0.26 * (1 - this.presion * 0.45);
    const inicio = d * 0.54;
    return [inicio, inicio + ancho];
  }

  // ---------- carga ----------
  iniciarCarga () {
    if (this.guardada || this.tGolpe >= 0) return;
    if (this.penalPostura <= 0) { this._aviso('No se puede cargar cuerpo a tierra', 'malo'); return; }
    if (this.paso >= this.secuencia.length) {
      if (this.lista) { this._aviso('El arma ya está lista', 'bien'); return; }
      this._nuevaSecuencia();
    }
    this.cargando = true;
  }

  soltarCarga () { this.cargando = false; }

  // `R` no se mantiene apretada: una vez arranca, otra vez pausa. La carga
  // sigue sola mientras caminás y se interrumpe si cambiás de arma, saltás o
  // das un puntazo — pero nunca se borra: el paso queda donde estaba.
  alternarCarga () {
    if (this.cargando) { this.cargando = false; this._aviso('Carga en pausa', 'bien'); return false; }
    this.iniciarCarga();
    return this.cargando;
  }

  // deja el arma descargada del todo, como si el dueño acabara de tirar
  dejarDescargada () {
    this.polvora = false;
    this.bala = false;
    this.cebado = false;
    this.amartillada = false;
    this.cargando = false;
    this.secuencia = SECUENCIA.slice();
    this.paso = 0; this.tPaso = 0; this.penal = 0; this.marcado = null;
  }

  // el arma arranca la partida lista para tirar
  cargarDeUnaVez () {
    this.polvora = true;
    this.bala = true;
    this.cebado = true;
    this.amartillada = true;
    this.cargando = false;
    this.secuencia = SECUENCIA.slice();
    this.paso = 0; this.tPaso = 0; this.penal = 0; this.marcado = null;
  }

  _nuevaSecuencia () {
    if (this.cargada && this.cebado && !this.amartillada) this.secuencia = ['amartillar'];
    else if (this.cargada && !this.cebado) this.secuencia = ['cebar', 'amartillar'];
    else this.secuencia = SECUENCIA.slice();
    this.paso = 0; this.tPaso = 0; this.penal = 0; this.marcado = null;
  }

  // el golpe de tiempo: click izquierdo mientras se carga
  golpe () {
    if (!this.cargando || this.paso >= this.secuencia.length) return false;
    const id = this.pasoActual;
    if (!PASOS[id].golpe || this.marcado) return false;
    // devuelve 'bien' o 'mal' según haya entrado en la ventana
    const [a, b] = this._ventana(id);
    if (this.tPaso >= a && this.tPaso <= b) {
      this.marcado = 'bien';
      this.sonido.acierto();
      this._completarPaso();
      return 'bien';
    } else {
      this.marcado = 'mal';
      this.penal += PENAL;
      this.temblor = 1;
      this.sonido.torpeza();
      this._aviso('Torpeza', 'malo');
      return 'mal';
    }
  }

  _completarPaso () {
    const id = this.pasoActual;
    switch (id) {
      // morder trae adentro sacar el cartucho y verter la pólvora, y baqueta
      // trae meter la bala: por eso acá pasan dos cosas por paso
      case 'morder':
        this.cartucho.visible = true;
        this.polvora = true;
        this.sonido.papel();
        this.sonido.polvora();
        break;
      case 'cebar': this.cebado = true; this.sonido.polvora(); this.sonido.rastrillo(); break;
      case 'baqueta':
        this.bala = true;
        this.cartucho.visible = false;
        if (this.alGastarCartucho) this.alGastarCartucho();
        this.sonido.baqueta();
        break;
      case 'amartillar': this.amartillada = true; this.sonido.martillo(); break;
    }
    this.paso++;
    this.tPaso = 0;
    this.penal = 0;
    this.marcado = null;
    if (this.paso >= this.secuencia.length) {
      this.cargando = false;
      if (this.lista) this._aviso('Lista', 'bien');
    }
  }

  // ---------- golpe de arma blanca (F) ----------
  puntazo () {
    if (this.guardada || this.tGolpe >= 0) return;
    this.tGolpe = 0;
    this.golpeAplicado = false;
    this.cargando = false;           // interrumpe la carga, pero no la borra
    this.sonido.sable();
  }

  // ---------- disparo ----------
  gatillo () {
    if (this.guardada || this.esperaTiro >= 0 || this.tGolpe >= 0) return;
    if (!this.amartillada) {
      this.sonido.chispaFallida();
      this._aviso(this.cargada ? 'Sin amartillar' : 'Descargada', 'malo');
      return;
    }
    this.amartillada = false;

    if (!this.cargada) {
      this.cebado = false;
      this.sonido.fogonazo();
      this._chispazo(0.35);
      this._aviso('Sin carga', 'malo');
      return;
    }
    const d = Math.random();
    if (d < P_CHISPA) {
      this.sonido.chispaFallida();
      this._aviso('Falló la chispa', 'malo');
      return;
    }
    if (d < P_CHISPA + P_FOGONAZO) {
      this.cebado = false;
      this.sonido.fogonazo();
      this._chispazo(0.4);
      this._aviso('Fogonazo sin tiro', 'malo');
      return;
    }
    this.esperaTiro = RETARDO;
    this.sonido.fogonazo();
    this._chispazo(0.25);
  }

  _chispazo (f) {
    this.fogonazo.material.opacity = 0.5 * f;
    this.luz.intensity = 6 * f;
    const p = this.bocaMundo(new THREE.Vector3());
    const dir = new THREE.Vector3();
    this.camaraMundo.getWorldDirection(dir);
    this.humo.soltar(p.addScaledVector(dir, 0.35), dir,
      { cantidad: 4, vida: 4, empuje: 1.2, radio: 0.1, opacidad: 0.22 });
  }

  _tirar () {
    // Y ARRANCA A RECARGARSE SOLA. Un granadero no espera que le den la orden
    // de volver a cargar: tira y ya está metiendo la mano en la cartuchera. La
    // tecla R sigue estando —para pausarla, para retomarla, o para empezar
    // antes de que termine el retroceso—, pero dejó de ser obligatoria.
    this.autoCarga = AUTO_CARGA;
    this.polvora = false;
    this.bala = false;
    this.cebado = false;
    this.tiros++;
    this.secuencia = SECUENCIA.slice();
    this.paso = 0; this.tPaso = 0; this.penal = 0; this.marcado = null;
    this.sonido.disparo();

    this.fogonazo.material.opacity = 0.95;
    this.luz.intensity = 22;
    this.retroceso = 1;

    const origen = this.bocaMundo(new THREE.Vector3());
    const dir = new THREE.Vector3();
    this.camaraMundo.getWorldDirection(dir);

    const grados = this.apuntando ? this.cfg.conoApuntado : this.cfg.conoCadera;
    const disp = THREE.MathUtils.degToRad(grados) * (1 + this.presion * 0.6) * this.dispersionPostura;

    this.humo.soltar(origen.clone().addScaledVector(dir, 0.45), dir,
      { cantidad: 15, vida: 10, empuje: 2.0, radio: 0.3, opacidad: 0.42, claro: 0.45 });

    if (this.alDisparar) this.alDisparar(origen, dir, disp);
  }

  _aviso (t, tipo) { if (this.alAviso) this.alAviso(t, tipo); }

  // Dónde cae la boca del cañón en el mundo. Con la corrección de campo: el
  // arma se dibuja con una cámara de 55° y el mundo con una de 80, así que un
  // mismo punto se proyecta en lugares distintos. Sin esto, el fogonazo y el
  // humo salen despegados de la boca.
  bocaMundo (destino) {
    this.grupo.updateWorldMatrix(true, false);
    destino.copy(this.boca).applyMatrix4(this.grupo.matrixWorld);
    const tanArma = Math.tan(THREE.MathUtils.degToRad(this.camara.fov) / 2);
    const tanMundo = Math.tan(THREE.MathUtils.degToRad(this.camaraMundo.fov) / 2);
    const f = tanMundo / tanArma;
    destino.x *= f;
    destino.y *= f;
    return destino.applyMatrix4(this.camaraMundo.matrixWorld);
  }

  // ---------- ciclo ----------
  actualizar (dt, ctx) {
    this.apuntando = ctx.apuntando && !this.cargando && !this.guardada && this.tGolpe < 0;
    this.presion = ctx.presion;
    this.penalPostura = ctx.penalCarga;
    this.dispersionPostura = ctx.dispersion;

    if (this.esperaTiro >= 0) {
      this.esperaTiro -= dt;
      if (this.esperaTiro < 0) { this.esperaTiro = -1; this._tirar(); }
    }

    // la recarga sola, pasado el retroceso. No se avisa nada si no se puede
    // —cuerpo a tierra, o en pleno puntazo—: se vuelve a intentar al cuadro
    // siguiente y listo. Un aviso por cuadro sería una alarma.
    if (this.autoCarga > 0) {
      this.autoCarga -= dt;
      if (this.autoCarga <= 0) {
        this.autoCarga = 0;
        if (!this.cargando && !this.guardada && this.tGolpe < 0 && this.penalPostura > 0 &&
            this.paso < this.secuencia.length && (!this.alPedirCarga || this.alPedirCarga())) {
          this.cargando = true;
        }
      }
    }

    if (this.tGolpe >= 0) {
      this.tGolpe += dt;
      const u = this.tGolpe / this.cfg.golpe.dur;
      if (!this.golpeAplicado && u > 0.34 && u < 0.62) {
        this.golpeAplicado = true;
        if (this.alGolpear) this.alGolpear(this.cfg.golpe);
      }
      if (u >= 1) this.tGolpe = -1;
    }

    if (this.cargando && this.paso < this.secuencia.length) {
      const id = this.pasoActual;
      this.tPaso += dt;
      const d = this._duracion(id) + this.penal;
      if (PASOS[id].golpe && !this.marcado) {
        const [, b] = this._ventana(id);
        if (this.tPaso > b) {
          this.marcado = 'mal';
          this.penal += PENAL;
          this.temblor = 0.8;
          this.sonido.torpeza();
          this._aviso('Se pasó el tiempo', 'malo');
        }
      }
      if (this.tPaso >= d) this._completarPaso();
    }

    if (!this.guardada) this._animar(dt);
  }

  _animar (dt) {
    const k = 1 - Math.exp(-13 * dt);
    let pose = this.poses.reposo;
    if (this.tGolpe >= 0) pose = this.poses.golpe;
    else if (this.cargando) pose = this.poses.carga;
    else if (this.apuntando) pose = this.poses.apuntado;

    this.grupo.position.lerp(pose.p, k);
    this.grupo.rotation.x += (pose.r.x - this.grupo.rotation.x) * k;
    this.grupo.rotation.y += (pose.r.y - this.grupo.rotation.y) * k;
    this.grupo.rotation.z += (pose.r.z - this.grupo.rotation.z) * k;

    // estocada: el arma sale para adelante y vuelve
    if (this.tGolpe >= 0) {
      const u = this.tGolpe / this.cfg.golpe.dur;
      const e = Math.sin(Math.min(1, u) * Math.PI);
      this.grupo.position.z -= e * 0.34;
      this.grupo.rotation.x += e * 0.12;
    }

    if (this.retroceso > 0) {
      this.retroceso = Math.max(0, this.retroceso - dt * 4.5);
      const r = this.retroceso * this.retroceso;
      this.grupo.position.z += r * 0.16;
      this.grupo.rotation.x -= r * 0.34;
    }
    if (this.temblor > 0) {
      this.temblor = Math.max(0, this.temblor - dt * 1.6);
      const a = this.temblor * 0.02;
      this.grupo.position.x += (Math.random() - 0.5) * a;
      this.grupo.position.y += (Math.random() - 0.5) * a;
    }
    const nervio = this.presion * 0.004 * (this.cargando ? 1 : 0.4);
    if (nervio > 0) {
      this.grupo.position.x += (Math.random() - 0.5) * nervio;
      this.grupo.position.y += (Math.random() - 0.5) * nervio;
    }

    const objMartillo = this.amartillada ? -0.95 : 0.28;
    this.martillo.rotation.x += (objMartillo - this.martillo.rotation.x) * (1 - Math.exp(-16 * dt));
    const objRastrillo = this.cebado ? 0 : -1.15;
    this.rastrillo.rotation.x += (objRastrillo - this.rastrillo.rotation.x) * (1 - Math.exp(-14 * dt));

    const destino = this.manoIzqBase.clone();
    let bq = { ...this.baquetaGuardada };
    if (this.cargando && this.paso < this.secuencia.length) {
      const id = this.pasoActual;
      const d = this._duracion(id) + this.penal;
      const u = Math.min(1, this.tPaso / d);
      const zBoca = this.bocaZ;
      switch (id) {
        case 'morder': destino.set(-0.01, 0.03, 0.06); break;
        case 'cebar': destino.set(0.03, 0.02, -0.09); break;
        case 'baqueta': {
          const s = Math.abs(Math.sin(u * Math.PI * 2));
          destino.set(-0.02, 0.06 + s * 0.05, zBoca - 0.02 - s * 0.12);
          bq = { y: 0.03, z: zBoca + 0.04 + s * 0.34 };
          break;
        }
        case 'amartillar': destino.set(0.05, 0.02, -0.02); break;
      }
      this.cartucho.position.set(destino.x + 0.01, destino.y + 0.03, destino.z);
      this.cartucho.visible = ['morder', 'cebar', 'baqueta'].includes(id);
    } else {
      this.cartucho.visible = false;
    }
    this.manoIzq.position.lerp(destino, 1 - Math.exp(-11 * dt));
    this.baqueta.position.z += (bq.z - this.baqueta.position.z) * (1 - Math.exp(-18 * dt));
    this.baqueta.position.y += (bq.y - this.baqueta.position.y) * (1 - Math.exp(-18 * dt));

    if (this.fogonazo.material.opacity > 0) {
      this.fogonazo.material.opacity = Math.max(0, this.fogonazo.material.opacity - dt * 9);
      this.luz.intensity = Math.max(0, this.luz.intensity - dt * 190);
    }
  }

  infoPaso () {
    if (!this.cargando || this.paso >= this.secuencia.length) return null;
    const id = this.pasoActual;
    const d = this._duracion(id) + this.penal;
    const [a, b] = this._ventana(id);
    return {
      nombre: PASOS[id].nombre,
      indice: this.paso + 1,
      total: this.secuencia.length,
      progreso: Math.min(1, this.tPaso / d),
      golpe: PASOS[id].golpe,
      enVentana: this.tPaso >= a && this.tPaso <= b && !this.marcado,
      ventana: [a / d, b / d],
      marcado: this.marcado
    };
  }
}
