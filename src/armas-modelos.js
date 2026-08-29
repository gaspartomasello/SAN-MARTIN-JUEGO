// ===========================================================================
// LOS FIERROS · cómo se ven las armas
// ===========================================================================
//
// Geometría, materiales y poses. Acá se arma la tercerola, el fusil con
// bayoneta y el pistolón de arzón —cada nogal, cada llave de chispa, cada
// brazo— y se define desde dónde las mira la cámara.
//
// Lo que NO sabe este archivo: cuánto duele un culatazo, cuántos tiempos tiene
// la carga ni si el arma está cebada. Eso es armas.js.
//
// La separación es real, no cosmética: acá no se importa balance.js y en
// armas.js dejó de importarse la paleta del mundo. Eran cuatrocientas líneas de
// modelado en el medio de la máquina de carga, y para tocar un timing había que
// pasar por arriba de un nogal.
import * as THREE from 'three';
import { PALETA } from './mundo.js';

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

export function mat (color, rug, met) {
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

// La Remington usa el modelo de la tercerola: carabina sin bayoneta, que es la
// silueta más cercana a un bloque basculante. No vale la pena modelar un arma
// que está de prestado.
export const CONSTRUCTORES = {
  tercerola: construirTercerola, fusil: construirFusil,
  pistolon: construirPistolon, remington: construirTercerola
};

// Poses. La de apuntado es la que importa: el ojo va POR ENCIMA y por detrás
// del cañón, no en su eje. Se alinea el punto de mira con el centro exacto de
// la pantalla y se mete el arma hasta que la culata queda detrás de la cámara,
// donde la recorta el plano cercano. Así se ve el cañón alejándose hacia la
// mira —lo único que había para apuntar en un ánima lisa de 1813— y la culata
// no tapa nada.
export function posesPara (tipo, p, escala) {
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
