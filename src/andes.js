import * as THREE from 'three';
import { Horno, MAT } from './sanlorenzo.js';

// ===========================================================================
// EL PASO · Cruce de los Andes, enero de 1817
// ===========================================================================
//
// El lugar del capítulo 2. Mismo eje que San Lorenzo y a propósito: vos entrás
// por +Z y el paso sube hacia −Z, así que todo lo que ya sabe el juego —de
// dónde viene el enemigo, para dónde corre el que se quiebra, cómo se forma
// una columna— sigue valiendo sin tocar una línea.
//
//   +90   la boca del valle, por donde venís
//     0   el camino de mulas, ancho todavía
//   -62   LA GARGANTA: ocho metros de piso entre dos paredes
//  -118   la hoyada, con el corral de pircas
//  -190   la salida al paso, y atrás la cordillera
//
// EL PISO ES PLANO Y ESO NO ES UNA CONCESIÓN GRÁFICA: ES LA DECISIÓN.
//
// Un terreno con pendiente de verdad obliga a que el jugador, los trescientos
// hombres y los caballos sepan a qué altura está el suelo abajo de ellos, y
// hoy nadie lo sabe: se camina sobre y = 0 y lo que frena son cajas. Eso es un
// cambio de sistema, no un escenario, y arrastra la moral, la IA y el LOD.
// Un desfiladero de piso apisonado entre paredes verticales es exactamente lo
// que se cruza en la cordillera —la nieve pisada por mil mulas queda plana— y
// la subida la cuenta lo que se ve: las paredes que se cierran, los picos que
// crecen, el aire que se pone azul. Cuando haga falta caminar en pendiente, se
// hace de frente y con su prueba, no de contrabando adentro de un capítulo.

// La nieve pisada no es blanca: es azul de sombra, con la costra más clara
// donde le pega la luna y tierra por donde ya pasó la tropa.
// Y ES CASI BLANCA, no celeste: la nieve es lo más reflectante del paisaje y
// de noche es lo único que devuelve luz. Con el azul de la primera versión el
// piso quedaba del color del Paraná y las olas del viento lo terminaban de
// convertir en un río: un desfiladero con un río abajo, que no es el Cruce.
const NIEVE = 0xf2f6fc;
const NIEVE_SUCIA = 0xccd4e0;
const ROCA = 0x4b4a52;
const ROCA_CLARA = 0x74727c;
const PIEDRA_PIRCA = 0x6e6a63;
const PIEDRA_PIRCA_OSC = 0x514e49;

// LA PLANTA DEL PASO. Media anchura del piso pisable, metro a metro de Z. El
// que necesite plantar algo —la partida, el corral, mañana los centinelas—
// pregunta acá y no inventa un número: si el paso se angosta, se angosta para
// todos.
const PLANTA = [
  [90, 40], [60, 34], [10, 26], [-40, 14],
  [-62, 8], [-88, 16], [-118, 24], [-150, 15], [-190, 7], [-210, 5]
];
export const Z_BOCA = 90;
export const Z_FONDO = -210;
export const ANCHO = 260;
// Hasta dónde llega el mundo acá: unos metros por dentro de las puntas del
// terreno, que del borde de la malla para afuera no hay nada dibujado.
export const LIMITES = { x: 126, z0: -206, z1: 86 };
// dónde está el corral, y dónde entra la tropa
export const CORRAL = { x: -9, z: -118 };
export const ENTRADA = { x: 0, z: 46 };

const suave = t => t * t * (3 - 2 * t);

export function medio (z) {
  if (z >= PLANTA[0][0]) return PLANTA[0][1];
  for (let i = 0; i < PLANTA.length - 1; i++) {
    const [z0, a0] = PLANTA[i], [z1, a1] = PLANTA[i + 1];
    if (z <= z0 && z >= z1) return a0 + (a1 - a0) * suave((z0 - z) / (z0 - z1));
  }
  return PLANTA[PLANTA.length - 1][1];
}

// El ruido, sin Math.random: la misma montaña en las dos máquinas de una
// partida de a dos y entre una corrida de las pruebas y la siguiente.
const ruido = (a, b) => {
  const s = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return (s - Math.floor(s)) - 0.5;
};

// LA PARED. Arranca en el borde del piso y sube con exponente mayor que uno,
// que es lo que hace que se lea como pared y no como loma: a un metro del
// borde ya tenés medio metro y a veinte metros tenés veinticinco.
const TOPE = 78;
// LOS SASTRUGI: las olas que el viento talla en la nieve dura. Doce
// centímetros sobre siete metros, o sea cuatro grados de inclinación. Nadie
// tropieza con eso —el que camina sigue parado en y = 0— pero con las normales
// sacadas de la geometría alcanza para que el piso deje de ser un espejo: sin
// esto, un desfiladero de doscientos metros era una chapa azul de un solo tono
// y no se leía ni la distancia.
// Y MANDA EL RUIDO, no los senos. Con dos senos parejos el piso ondulaba como
// agua; el viento no hace olas regulares, hace costras y bancos.
function ondas (x, z) {
  return ruido(x * 0.42, z * 0.36) * 0.10 +
         ruido(x * 1.3, z * 0.9) * 0.035 +
         Math.sin(x * 0.17 + z * 0.07) * 0.03;
}

function altura (x, z) {
  const d = Math.abs(x) - medio(z);
  if (d <= 0) return ondas(x, z);           // el piso: plano, con el viento encima
  // El pie ARRANCA PARADO y después sigue la potencia: a un metro del borde ya
  // hay un metro y medio de piedra, que es lo que dice «acá no se pasa».
  const base = Math.min(TOPE, Math.pow(d, 1.22) * 0.62 + Math.min(d, 2.5) * 1.5);
  // la erosión entra de a poco: pegada al borde la pared tiene que arrancar
  // limpia o el piso queda con dientes
  const cerca = Math.min(1, d / 5);
  const grueso = ruido(x * 0.045, z * 0.038) * 9 + ruido(x * 0.14, z * 0.11) * 2.6;
  return Math.max(0, base + grueso * cerca * Math.min(1, base / 6));
}

// ------------------------------------------------------------ el terreno
//
// UNA SOLA MALLA para el piso y las dos paredes. No es prolijidad: cosidos por
// separado, el borde donde se juntan deja una costura que se ve desde adentro
// del valle, que es justo desde donde se mira todo el nivel. Y son 11 mil
// triángulos en UNA llamada de dibujo, contra los 300 mil que ya dibuja una
// batalla.
//
// LAS NORMALES SALEN DEL PRODUCTO VECTORIAL de cada triángulo, como en la
// barranca de San Lorenzo y por el mismo motivo: escritas a mano, una pared
// que cae para el otro lado se ilumina al revés y nadie se da cuenta hasta que
// la luz cambia de lado. Acá encima la luz es una luna floja y un error de
// signo deja media montaña negra.
function terreno () {
  const COLS = 74, FILAS = 74;
  const alto = new THREE.Color(ROCA_CLARA), bajo = new THREE.Color(ROCA);
  const nieve = new THREE.Color(NIEVE), sucia = new THREE.Color(NIEVE_SUCIA);
  // LA REJILLA SIGUE AL VALLE, no al mundo.
  //
  // Con columnas repartidas parejo a lo ancho de los 260 metros, el pie de la
  // pared caía en cualquier lado adentro de una celda de tres metros y medio, y
  // la subida quedaba estirada sobre esa celda: en la garganta el piso se veía
  // el triple de ancho de lo que se podía caminar, o sea que había una pared
  // invisible arriba de la nieve. Eso no es un problema de gusto, es el peor
  // defecto que puede tener un desfiladero.
  //
  // Se arregla poniendo un vértice EXACTAMENTE en el borde: el 38% central de
  // las columnas se reparte sobre el piso —que se angosta y se ensancha con
  // él— y el resto sube por la pared con paso creciente, tupido abajo y
  // suelto arriba, que es donde no se mira. La malla queda torcida entre fila
  // y fila y eso no molesta: son triángulos, no una grilla.
  const punto = (i, k) => {
    const z = Z_BOCA + (Z_FONDO - Z_BOCA) * (i / FILAS);
    const m = medio(z);
    const t = (k / COLS) * 2 - 1;
    const lado = t < 0 ? -1 : 1, a = Math.abs(t);
    const PISO = 0.38;
    const x = a <= PISO
      ? t / PISO * m
      : lado * (m + Math.pow((a - PISO) / (1 - PISO), 1.7) * (ANCHO / 2 - m));
    return [x, altura(x, z), z];
  };
  const v = [], n = [], c = [], uv = [];
  const A = new THREE.Vector3(), B = new THREE.Vector3(), N = new THREE.Vector3();
  const _c = new THREE.Color();
  const cara = (p, q, r) => {
    A.set(q[0] - p[0], q[1] - p[1], q[2] - p[2]);
    B.set(r[0] - p[0], r[1] - p[1], r[2] - p[2]);
    N.crossVectors(A, B).normalize();
    if (N.y < 0) N.negate();
    for (const w of [p, q, r]) {
      v.push(w[0], w[1], w[2]);
      n.push(N.x, N.y, N.z);
      // PROYECCIÓN POR CARA. Mapeando siempre por (x, z), en una pared vertical
      // los dos ejes de la textura se aplastan contra la nada y el grano sale
      // estirado en chorreadas verticales de treinta metros. Donde la cara mira
      // para arriba se proyecta desde arriba, y donde es pared, de costado.
      if (N.y > 0.5) uv.push(w[0] / 5.5, w[2] / 5.5);
      else uv.push((w[0] * N.z - w[2] * N.x) / 5.5, w[1] / 5.5);
      // LA NIEVE SE AGARRA DE LO PLANO, que es lo que hace en la montaña: el
      // piso y las repisas quedan blancos y la pared vertical queda pelada.
      // Sale de la normal y no de la altura, así que una cornisa a cuarenta
      // metros también amanece nevada.
      const manto = suave(Math.min(1, Math.max(0, (N.y - 0.55) / 0.35)));
      const mancha = 0.5 + ruido(w[0] * 0.07, w[2] * 0.06) * 0.9;
      _c.copy(bajo).lerp(alto, Math.min(1, mancha * 0.8 + w[1] / TOPE * 0.5));
      // y la del piso se ensucia por donde ya pasó la tropa
      const pisada = Math.min(1, Math.abs(w[0]) / Math.max(4, medio(w[2])));
      _c.lerp(nieve.clone().lerp(sucia, 1 - pisada * 0.85), manto);
      c.push(_c.r, _c.g, _c.b);
    }
  };
  for (let i = 0; i < FILAS; i++) {
    for (let k = 0; k < COLS; k++) {
      const p00 = punto(i, k), p10 = punto(i, k + 1);
      const p01 = punto(i + 1, k), p11 = punto(i + 1, k + 1);
      cara(p00, p10, p11);
      cara(p00, p11, p01);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(n, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.computeBoundingSphere();
  // Material propio y no el del escenario: el grano de la nieve no le sirve al
  // convento y la malla ya es aparte, así que no cuesta una llamada más.
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    map: nieveTextura(), vertexColors: true, roughness: 0.86
  }));
  m.receiveShadow = true;
  return m;
}

// EL GRANO. La nieve pisada de noche no es una superficie lisa: tiene costra,
// huellas y piedrita. Ciento veintiocho píxeles de ruido suave, repetidos cada
// cinco metros y medio, y el color por vértice le pone arriba las manchas
// grandes. Lo mismo que hace el suelo del campo en San Lorenzo.
function nieveTextura () {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = '#ffffff';
  x.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 2600; i++) {
    const g = 0.78 + Math.random() * 0.22;
    const r = 0.6 + Math.random() * 2.4;
    x.fillStyle = `rgba(${Math.round(214 * g)},${Math.round(224 * g)},${Math.round(240 * g)},0.5)`;
    x.beginPath();
    x.arc(Math.random() * 128, Math.random() * 128, r, 0, 6.2832);
    x.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// LO QUE FRENA. Una tira de cajas pegada al pie de cada pared, una cada ocho
// metros de Z. Ocho y no dos: el paso se angosta despacio y en ocho metros la
// media anchura se mueve menos de un metro, así que la caja miente menos que
// lo que ocupa un hombre. Son 52 cajas contra las 54 de San Lorenzo, o sea que
// el costo de chocar no se movió.
function murallas (colisiones) {
  const PASO = 8;
  for (let z = Z_BOCA; z > Z_FONDO; z -= PASO) {
    const a = Math.min(medio(z), medio(z - PASO));
    for (const s of [-1, 1]) {
      const x0 = s * a, x1 = s * (ANCHO / 2);
      colisiones.push(new THREE.Box3(
        new THREE.Vector3(Math.min(x0, x1), 0, z - PASO),
        new THREE.Vector3(Math.max(x0, x1), TOPE, z)));
    }
  }
  // y el fondo del valle, que si no se camina hasta el vacío
  colisiones.push(new THREE.Box3(
    new THREE.Vector3(-ANCHO / 2, 0, Z_FONDO - 4),
    new THREE.Vector3(ANCHO / 2, TOPE, Z_FONDO)));
}

// ------------------------------------------------------------ el corral
//
// EL CORRAL DE PIRCAS: piedra sobre piedra, sin mezcla, que es como se
// levantaban y como todavía están. Es lo único hecho por manos en cuarenta
// kilómetros de piedra, y por eso es el hito del nivel: se ve de lejos, se
// entiende sin que nadie lo explique y se pelea adentro.
//
// Va fundido en la malla del escenario: trescientas piedras a una llamada.
function pircas (horno, colisiones) {
  const { x: CX, z: CZ } = CORRAL;
  const AN = 15, LA = 11, ALTO = 1.35;
  // el portillo, en la cara que mira a la boca del valle
  const PORTILLO = 3.2;
  const tramos = [
    // [x0, z0, x1, z1]
    [CX - AN / 2, CZ - LA / 2, CX + AN / 2, CZ - LA / 2],          // el fondo
    [CX - AN / 2, CZ - LA / 2, CX - AN / 2, CZ + LA / 2],          // los costados
    [CX + AN / 2, CZ - LA / 2, CX + AN / 2, CZ + LA / 2],
    [CX - AN / 2, CZ + LA / 2, CX - PORTILLO / 2, CZ + LA / 2],    // el frente, partido
    [CX + PORTILLO / 2, CZ + LA / 2, CX + AN / 2, CZ + LA / 2]
  ];
  let semilla = 0;
  for (const [x0, z0, x1, z1] of tramos) {
    const largo = Math.hypot(x1 - x0, z1 - z0);
    const ux = (x1 - x0) / largo, uz = (z1 - z0) / largo;
    // tres hiladas, y cada hilada corrida media piedra: una pirca de piedras
    // alineadas parece un muro de ladrillo, y no hay ladrillo en la cordillera
    for (let h = 0; h < 3; h++) {
      const y = 0.22 + h * 0.44;
      const paso = 0.62;
      for (let t = h * paso * 0.5; t < largo; t += paso) {
        semilla++;
        const r = ruido(semilla * 1.7, h * 3.1);
        const ancho = 0.52 + r * 0.22;
        horno.caja(
          x0 + ux * t + uz * r * 0.14, y + r * 0.06, z0 + uz * t - ux * r * 0.14,
          Math.abs(ux) > 0.5 ? ancho : 0.44 + r * 0.14,
          0.40 + r * 0.10,
          Math.abs(uz) > 0.5 ? ancho : 0.44 + r * 0.14,
          r > 0 ? PIEDRA_PIRCA : PIEDRA_PIRCA_OSC,
          r * 0.5);
      }
    }
    const ex = Math.abs(x1 - x0) < 0.1 ? 0.34 : 0;
    const ez = Math.abs(z1 - z0) < 0.1 ? 0.34 : 0;
    colisiones.push(new THREE.Box3(
      new THREE.Vector3(Math.min(x0, x1) - ex, 0, Math.min(z0, z1) - ez),
      new THREE.Vector3(Math.max(x0, x1) + ex, ALTO, Math.max(z0, z1) + ez)));
  }
}

// ------------------------------------------------------------ los peñones
//
// Piedra desprendida de la pared, en el piso. Es cobertura —lo único que hay
// en todo el paso— y es lo que le saca al desfiladero la cara de pasillo.
function penones (horno, colisiones) {
  const donde = [
    [-11, 24], [13, 6], [-6, -18], [9, -34], [-4, -52],
    [5, -74], [-12, -92], [16, -110], [-19, -126], [7, -140],
    [-8, -158], [4, -176]
  ];
  // UN DODECAEDRO Y NO CAJAS. La primera versión eran dos prismas cruzados con
  // una tapa de nieve encima y de lejos parecían cajones de munición: una
  // piedra no tiene aristas verticales. Doce caras irregulares escaladas a lo
  // bruto dan un peñón de una sola pieza y con la mitad de triángulos.
  const roca = new THREE.DodecahedronGeometry(1, 0);
  donde.forEach(([x, z], i) => {
    const r = ruido(i * 2.3, 7.1), r2 = ruido(i * 5.1, 2.7);
    const an = 1.5 + r * 0.9, al = 1.2 + r2 * 0.7, la = 1.4 + r2 * 0.8;
    horno.pieza(roca, [x, al * 0.78, z], [r2 * 0.5, r * 3, r * 0.4], [an, al, la], ROCA_CLARA);
    // la nieve que se le junta arriba: la misma piedra, aplastada y corrida
    horno.pieza(roca, [x + r * 0.16, al * 1.16, z - r2 * 0.14],
      [r2 * 0.5, r * 3, r * 0.4], [an * 0.82, al * 0.30, la * 0.82], NIEVE);
    colisiones.push(new THREE.Box3(
      new THREE.Vector3(x - an * 0.8, 0, z - la * 0.8),
      new THREE.Vector3(x + an * 0.8, al * 1.5, z + la * 0.8)));
  });
}

// ------------------------------------------------------------ la cordillera
//
// LOS PICOS DEL FONDO. No se llega nunca a ellos y no tienen colisión: son el
// horizonte. Sin ellos, arriba de la pared hay cielo y el paso parece una
// zanja en una llanura; con ellos, se entiende que estás adentro de una
// montaña y que la salida del fondo da a otra montaña.
function cordillera (horno) {
  // TODOS ADELANTE Y NINGUNO AL COSTADO. Había dos a los lados, a ciento
  // cincuenta metros: la pared del desfiladero les tapaba el cuerpo y quedaba
  // la nieve de la cumbre flotando sola en el cielo, como un globo. Los del
  // fondo están lejos y a la vista entera, que es donde un pico sirve.
  const picos = [
    [-70, -250, 46, 118], [10, -276, 62, 146], [88, -244, 40, 104],
    [-140, -232, 52, 122], [150, -248, 44, 110], [-40, -300, 70, 158],
    [56, -320, 54, 132]
  ];
  const cono = new THREE.ConeGeometry(1, 1, 5);
  picos.forEach(([x, z, r, h], i) => {
    const g = ruido(i * 3.7, 1.9);
    horno.pieza(cono, [x, h / 2, z], [0, g * 3, 0], [r, h, r], ROCA);
    // la nieve de la cumbre, un cono chico apoyado en la punta
    horno.pieza(cono, [x, h - h * 0.16, z], [0, g * 3, 0], [r * 0.34, h * 0.32, r * 0.34], NIEVE);
  });
}

// ---------------------------------------------------------------------------
// DÓNDE VA LA GENTE
// ---------------------------------------------------------------------------
//
// El PLANO de la partida vive acá —es del paso, como las pircas— y quien la
// suelta al campo es despliegue.js, que es el que sabe soltar gente. Al revés
// —el plano en despliegue.js— es como estaba, y era un archivo del capítulo 1
// inventando coordenadas del capítulo 2.
//
// Van EN FILA Y SERPENTEANDO, no en formación: por una senda de mulas de ocho
// metros no marcha nadie de a cuatro, y una fila recta arriba de una montaña
// se lee como un desfile. El bandeo sale del ruido, así que es el mismo en las
// dos máquinas de una partida de a dos.
export function columnaDelPaso (n = 14) {
  const puestos = [];
  for (let k = 0; k < n; k++) {
    const z = ENTRADA.z - 6 - k * 3.1;
    const r = ruido(k * 1.9, 4.3);
    const ancho = Math.min(2.6, medio(z) * 0.28);
    puestos.push({
      x: ENTRADA.x + Math.sin(z * 0.09) * ancho + r * 0.9,
      z,
      rumbo: 0                       // todos mirando al paso, o sea a −Z
    });
  }
  return { puestos, jugador: { x: ENTRADA.x, z: ENTRADA.z, yaw: 0, pitch: -0.02 } };
}

// ===========================================================================
// EL SIGILO
// ===========================================================================
//
// Lo que hace que el capítulo 2 no sea San Lorenzo con nieve. En la cordillera
// no se carga: se pasa. Hay una guardia realista en el corral y el paso es
// llegar hasta ella sin que te vean; si te ven, hay pelea y la pelea la perdés,
// porque son ellos los que están atrincherados y vos venís de subir un cerro.
//
// DÓNDE VIVEN ESTOS NÚMEROS. Acá y no en `balance.js`: la regla dice que ahí
// van los números de PELEA y que las distancias de aviso no. Cuánto lejos ve un
// centinela de noche es exactamente una distancia de aviso, es propia de este
// paso —en una hoyada abierta sería otra— y no toca una sola cuenta de daño ni
// de moral. Si algún día el sigilo pasa a decidir vida y muerte de la tropa,
// ese día se muda con su prueba.
const VISTA = 46;            // hasta dónde alcanza un ojo con luna y nieve
const CONO = 1.02;           // medio ángulo: unos sesenta grados a cada lado
const BARRIDO = 0.62;        // cuánto barre la cabeza a cada lado
const BARRIDO_T = 8.5;       // y cada cuánto completa el vaivén
const VER = 0.9;             // sospecha por segundo, pegado y de pie
const OLVIDO = 0.34;         // y cuánto se le baja cuando te perdió
const QUIETO = 0.45;         // parado se te ve menos de la mitad
const ALARMA = 1;            // acá te vieron

// LA GUARDIA. Dos avanzadas sueltas en el camino y el grueso en el corral: se
// llega a una antes que a la otra, así que la primera es la que enseña cómo
// funciona y la segunda es la que hay que pensar.
export function guardiaDelCorral () {
  const { x: CX, z: CZ } = CORRAL;
  return [
    { x: 4.5, z: -66, rumbo: Math.PI },        // la avanzada de la garganta
    { x: -3.0, z: -88, rumbo: Math.PI },       // la segunda, en la hoyada
    { x: CX - 5.5, z: CZ + 7.5, rumbo: Math.PI },
    { x: CX + 4.0, z: CZ + 7.0, rumbo: Math.PI + 0.35 },
    { x: CX - 9.5, z: CZ - 1.0, rumbo: Math.PI - 0.9 },
    { x: CX + 6.5, z: CZ - 2.0, rumbo: Math.PI + 0.9 }
  ];
}

// ¿HAY PIEDRA EN EL MEDIO? Segmento contra caja, con el método de las lajas:
// se recorta el segmento contra las tres franjas de la caja y si queda algo,
// pasa por adentro. NO es un raycast —no hay Raycaster, no hay malla, no hay
// BVH— y no rompe el «un solo raycast en todo el proyecto»: son diecisiete
// cajas bajas, las de los peñones y las pircas, seis veces por segundo.
//
// Las cajas ALTAS se saltean: las paredes del desfiladero son cajas de setenta
// y ocho metros que arrancan afuera del piso, y probarlas es tiempo tirado
// porque dos hombres parados adentro del valle nunca tienen una en el medio.
//
// Y ESTO ES LO QUE HACE QUE AGACHARSE SIRVA. La prueba va de ojo a ojo, así
// que atrás de un peñón de metro y medio: parado te ven la cabeza, agachado no.
function tapado (ax, ay, az, bx, by, bz, colisiones) {
  const dx = bx - ax, dy = by - ay, dz = bz - az;
  for (const c of colisiones) {
    if (c.max.y > 4) continue;
    let t0 = 0, t1 = 1, corta = true;
    for (const [o, d, lo, hi] of [[ax, dx, c.min.x, c.max.x],
      [ay, dy, c.min.y, c.max.y], [az, dz, c.min.z, c.max.z]]) {
      if (Math.abs(d) < 1e-9) { if (o < lo || o > hi) { corta = false; break; } continue; }
      let a = (lo - o) / d, b = (hi - o) / d;
      if (a > b) { const w = a; a = b; b = w; }
      if (a > t0) t0 = a;
      if (b < t1) t1 = b;
      if (t0 > t1) { corta = false; break; }
    }
    if (corta) return true;
  }
  return false;
}

// EL OJO DE LA GUARDIA.
//
// Corre a SEIS VECES POR SEGUNDO y no por cuadro, por lo mismo que la moral:
// nadie parpadea a sesenta hertz y probar seis centinelas contra quince hombres
// sesenta veces por segundo es gastar un cuadro entero en algo que no cambia.
const PASO_OJO = 1 / 6;

export class Sigilo {
  constructor () { this.reiniciar(); }

  reiniciar () {
    this.centinelas = [];
    this.sospecha = 0;       // 0 a 1: cuánto saben que estás
    this.alarma = false;
    this.tomado = false;     // llegaste al corral sin que te vieran
    this.t = 0;
    this.tVista = 0;
    this.quienTeVe = null;
  }

  // Los pone el despliegue: acá se los recibe ya soltados al campo.
  poner (centinelas) {
    this.centinelas = centinelas;
    centinelas.forEach((s, i) => {
      s.centinela = true;
      s.rumboGuardia = s.frente;
      s.faseGuardia = (i / centinelas.length) * Math.PI * 2;
    });
  }

  // Cuánto se le ve a alguien desde un centinela. Devuelve 0 si no lo ve.
  _cuanto (s, pos, alto, blanco, quieto, colisiones) {
    const dx = pos.x - s.pos.x, dz = pos.z - s.pos.z;
    const d = Math.hypot(dx, dz);
    if (d > VISTA || d < 0.001) return 0;
    const fx = -Math.sin(s.frente), fz = -Math.cos(s.frente);
    if ((dx * fx + dz * fz) / d < Math.cos(CONO)) return 0;
    if (tapado(s.pos.x, 1.55, s.pos.z, pos.x, alto, pos.z, colisiones)) return 0;
    return (1 - d / VISTA) * blanco * (quieto ? QUIETO : 1);
  }

  actualizar (dt, ctx) {
    if (!this.centinelas.length) return;
    const { jugador, quieto, soldados, colisiones, postura, hud, sonido } = ctx;
    this.t += dt;

    // LA CABEZA VA Y VIENE. Un centinela clavado mirando a un punto fijo es un
    // poste: con el barrido, el que se acerca tiene que elegir CUÁNDO moverse,
    // que es de lo que se trata el sigilo.
    for (const s of this.centinelas) {
      if (!s.vivo || this.alarma) continue;
      const r = s.rumboGuardia + Math.sin(this.t * (Math.PI * 2 / BARRIDO_T) + s.faseGuardia) * BARRIDO;
      s.frente = r;
      s.malla.rotation.y = r;
    }

    this.tVista -= dt;
    if (this.tVista > 0) return;
    this.tVista = PASO_OJO;
    if (this.alarma) return;

    let visto = 0, quien = null;
    for (const s of this.centinelas) {
      if (!s.vivo || s.quebrado) continue;
      // vos
      const v = this._cuanto(s, jugador.pos, jugador.pos.y, postura.blanco,
        quieto, colisiones);
      if (v > visto) { visto = v; quien = s; }
      // Y TU GENTE, que es tan visible como vos.
      //
      // Y con las MISMAS REGLAS que vos: el granadero que va con la rodilla en
      // tierra —porque le diste la orden de agacharse— es un bulto más chico y
      // más bajo, igual que vos agachado. Sin esto, agachar la fila era una
      // pose: la partida seguía delatándote con el mismo valor de siempre y la
      // orden no compraba nada.
      for (const g of soldados) {
        if (!g.vivo || g.esRealista) continue;
        const bajo = !!g.rodilla;
        const w = this._cuanto(s, g.pos, bajo ? 1.22 : 1.6, bajo ? 0.62 : 1,
          !g.andando, colisiones);
        if (w > visto) { visto = w; quien = s; }
      }
    }

    this.quienTeVe = visto > 0 ? quien : null;
    this.sospecha = Math.max(0, Math.min(ALARMA,
      this.sospecha + (visto > 0 ? visto * VER : -OLVIDO) * PASO_OJO));

    if (this.sospecha >= ALARMA) this.dar(hud, sonido);
    else if (!this.tomado) this._mirarCorral(jugador, hud);
  }

  // LA ALARMA. Los seis dejan de ser centinelas y pasan a ser lo que son: seis
  // fusiles que ya saben dónde estás. No hay vuelta atrás, y ésa es la idea.
  dar (hud, sonido) {
    if (this.alarma) return;
    this.alarma = true;
    this.sospecha = ALARMA;
    for (const s of this.centinelas) s.centinela = false;
    if (hud) {
      hud.mostrarAviso('¡Los vieron! La guardia da la voz', 'malo');
      hud.cartel('', 0);
    }
    if (sonido && sonido.grito) sonido.grito();
  }

  _mirarCorral (jugador, hud) {
    const d = Math.hypot(jugador.pos.x - CORRAL.x, jugador.pos.z - CORRAL.z);
    if (d > 9) return;
    this.tomado = true;
    if (hud) {
      hud.cartel('', 0);
      hud.placa(['El corral de pircas', 'Tomado sin un tiro',
        'La partida cruza el paso'], 5);
    }
  }
}

// ===========================================================================
// LA MARCHA DE LA PARTIDA
// ===========================================================================
//
// Los catorce granaderos te siguen en fila india, y con la Q los parás y los
// volvés a poner en marcha. Sin esto el sigilo era un solitario: la gracia del
// Cruce no es pasar vos, es pasar CON ELLOS, y el centinela los mira a ellos
// igual que a vos.
//
// SIGUEN TU RASTRO, NO TU POSICIÓN. Cada uno apunta a un punto del camino que
// vos ya hiciste, a tantos metros para atrás como lugar ocupe en la fila. Es
// la diferencia entre una fila y una bandada: apuntando todos al jefe, en la
// garganta de ocho metros se amontonan contra la pared y en la primera curva
// cortan camino por arriba de la piedra. Siguiendo el rastro, pasan por donde
// pasaste, en el orden en que estaban, y la fila se estira y se junta sola.
//
// El rastro se guarda cada 60 cm y se corta a los 160 metros: catorce hombres
// a 2,60 son 36 metros de fila, así que sobra de largo y no crece sin fin.
const SEPARACION = 2.6;
const MIGA = 0.6;
const RASTRO_MAX = 270;
// Cuánto se le deja al primero antes de empezar a contar la fila. Con 2,60 te
// respiraba en la nuca: a esa distancia, y con el gran angular de la cámara,
// un hombre te tapa media pantalla cada vez que frenás.
const PRIMERO = 4.2;
// Y EL BANDEO. En fila perfecta, mirándolos de atrás, los catorce se tapan
// entre ellos y se leen como UN hombre: la columna desaparece justo desde
// donde se la mira siempre. Corriendo a cada uno medio metro para un lado y
// para el otro se ve la fila entera, y de paso queda como camina la gente por
// una senda de mulas, que no es en línea recta.
const BANDEO = 0.62;

export class Marcha {
  constructor () { this.reiniciar(); }

  reiniciar () {
    this.hombres = [];
    this.siguiendo = false;
    this.rastro = [];
    this.agachados = false;
  }

  poner (hombres) {
    this.hombres = hombres;
    this.rastro.length = 0;
    this.siguiendo = false;
    for (const s of hombres) {
      s.plaza = null;
      s.agachadoOrden = false;
      s.andarColumna = 0;
    }
  }

  get vivos () { return this.hombres.filter(s => s.vivo && !s.quebrado); }

  // LA Q. Una tecla, dos órdenes, y el que juega no tiene que acordarse de
  // cuál: si venían atrás se plantan, y si estaban plantados arrancan.
  alternar () {
    if (!this.hombres.length) return null;
    this.siguiendo = !this.siguiendo;
    if (!this.siguiendo) {
      // ALTO. Se les clava la plaza donde están parados: soltársela los
      // devolvería a la IA de siempre y se irían a buscar al enemigo, que es
      // exactamente lo contrario de lo que pide la orden.
      for (const s of this.vivos) {
        if (!s.plaza) s.plaza = new THREE.Vector3();
        s.plaza.set(s.pos.x, 0, s.pos.z);
      }
    }
    return this.siguiendo ? 'siguiendo' : 'alto';
  }

  // El punto del rastro que está a `atras` metros para atrás del jugador,
  // caminando la miga hacia el pasado. Devuelve también hacia dónde va el
  // camino ahí, que es lo que da el costado para el bandeo.
  _puntoAtras (atras, jugador) {
    const r = this.rastro;
    let px = jugador.pos.x, pz = jugador.pos.z, resta = atras;
    let ux = 0, uz = 1;
    for (let i = r.length - 1; i >= 0; i--) {
      const dx = r[i].x - px, dz = r[i].z - pz;
      const d = Math.hypot(dx, dz);
      if (d > 0.0001) { ux = -dx / d; uz = -dz / d; }
      if (d >= resta) {
        const t = d > 0.0001 ? resta / d : 0;
        return { x: px + dx * t, z: pz + dz * t, ux, uz };
      }
      resta -= d;
      px = r[i].x; pz = r[i].z;
    }
    // el rastro todavía es más corto que la fila: el último se planta en la punta
    return { x: px, z: pz, ux, uz };
  }

  actualizar (dt, ctx) {
    if (!this.hombres.length) return;
    const { jugador, agachado } = ctx;

    // la miga: se deja una cada 60 cm de camino hecho
    const r = this.rastro;
    const ultimo = r[r.length - 1];
    if (!ultimo || Math.hypot(jugador.pos.x - ultimo.x, jugador.pos.z - ultimo.z) > MIGA) {
      r.push({ x: jugador.pos.x, z: jugador.pos.z });
      if (r.length > RASTRO_MAX) r.shift();
    }

    // LA POSTURA VA SIEMPRE, sigan o estén plantados: agacharse es una orden
    // que vale igual parado en un sitio que en marcha, y es lo que hace que
    // valga la pena agacharse cuando ya los frenaste atrás de un peñón.
    this.agachados = !!agachado;
    const vivos = this.vivos;
    for (const s of vivos) s.agachadoOrden = this.agachados;

    if (!this.siguiendo) return;
    vivos.forEach((s, k) => {
      const p = this._puntoAtras(PRIMERO + k * SEPARACION, jugador);
      // el costado del camino, para correrlo media fila a un lado o al otro
      const lado = (k % 2 ? 1 : -1) * BANDEO;
      if (!s.plaza) s.plaza = new THREE.Vector3();
      s.plaza.set(p.x - p.uz * lado, 0, p.z + p.ux * lado);
    });
  }
}

// ---------------------------------------------------------------------------
// EL PASO ENTERO, en un grupo que se prende y se apaga
// ---------------------------------------------------------------------------
export function construirAndes (escena, colisiones) {
  const lugar = new THREE.Group();
  lugar.name = 'andes';
  lugar.add(terreno());
  const horno = new Horno();
  pircas(horno, colisiones);
  penones(horno, colisiones);
  cordillera(horno);
  lugar.add(horno.cocinar(MAT()));
  murallas(colisiones);
  escena.add(lugar);
  return lugar;
}
