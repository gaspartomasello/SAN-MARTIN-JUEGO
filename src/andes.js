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
// el hielo del arroyo: más oscuro y más frío que la nieve, que si no se funde
// con el piso y no se ve la línea
const HIELO = 0x9fb4c8;
const MADERA = 0x453629;      // las vigas del techo y la leña

// LA PLANTA DEL PASO, metro a metro de Z: dónde está el EJE del valle y cuánta
// media anchura de piso hay a cada lado. El que necesite plantar algo —la
// partida, el corral, la guardia, un peñón— pregunta acá y no inventa un
// número: si el paso dobla o se angosta, dobla y se angosta para todos.
//
// EL EJE ES LO QUE ARREGLÓ ESTE NIVEL. La primera versión sólo tenía el ancho:
// el valle se abría y se cerraba pero el eje estaba clavado en x = 0, o sea que
// era un PASILLO RECTO de trescientos metros. Desde la boca se veía el fondo,
// el corral y la salida de un saque; no había una sola esquina en todo el
// capítulo, así que no había nada que descubrir ni motivo para moverse de
// costado, y el sigilo tenía una sola solución: agacharse y caminar derecho.
// Con tres codos, la mitad del nivel deja de verse desde la entrada y el corral
// aparece recién cuando doblás.
const PLANTA = [
  //  z   eje  medio
  [  90,   0, 42],   // la boca del valle
  [  55,   6, 34],
  [  15,  24, 24],   // PRIMER CODO, a la derecha
  [ -25,  30, 13],
  [ -50,  16,  9],   // y vuelve, cerrándose
  [ -70,  -6,  8],   // LA GARGANTA, en el medio del segundo codo
  [ -95, -22, 15],
  [-120, -26, 26],   // la hoyada del corral
  [-150, -10, 14],
  [-180,  14,  8],   // el último codo, ya sobre la salida
  [-210,  20,  5]
];
export const Z_BOCA = 90;
export const Z_FONDO = -210;
export const ANCHO = 260;
// Hasta dónde llega el mundo acá: unos metros por dentro de las puntas del
// terreno, que del borde de la malla para afuera no hay nada dibujado.
export const LIMITES = { x: 126, z0: -206, z1: 86 };

const suave = t => t * t * (3 - 2 * t);

// Los dos de la planta salen del mismo recorrido, así que van juntos: `cual`
// es 1 para el eje y 2 para la media anchura.
function planta (z, cual) {
  if (z >= PLANTA[0][0]) return PLANTA[0][cual];
  for (let i = 0; i < PLANTA.length - 1; i++) {
    const a = PLANTA[i], b = PLANTA[i + 1];
    if (z <= a[0] && z >= b[0]) {
      return a[cual] + (b[cual] - a[cual]) * suave((a[0] - z) / (a[0] - b[0]));
    }
  }
  return PLANTA[PLANTA.length - 1][cual];
}

export const eje = z => planta(z, 1);
export function medio (z) { return planta(z, 2); }

// EL CORRAL Y LA ENTRADA CUELGAN DEL EJE, no de un número escrito a mano. Con
// el eje clavado en cero daba igual; ahora, si el valle dobla un poco más, el
// corral se mueve con él en vez de quedar metido adentro de la pared.
export const CORRAL = { x: eje(-120) - 4, z: -120 };
export const ENTRADA = { x: eje(46), z: 46 };

// LA CASUCHA DEL REY, contra la pared de la izquierda y a treinta y ocho metros
// de la boca: un refugio se pega al cerro, que es de donde viene el reparo.
// Adentro espera la patrulla de vanguardia, y es lo que convierte el paso en una
// misión y no en una caminata. Va LEJOS de la guardia a propósito: el centinela
// más adelantado está en z = −66 y ve cuarenta y seis metros, así que a un
// granadero parado en la casucha no lo alcanza ni parado en el techo.
export const CASUCHA = { x: eje(8) - 16, z: 8 };
export const FOGON = { x: CASUCHA.x + 5.4, z: CASUCHA.z + 3.6 };

// EL PUESTO REALISTA vive en el corral, que ya estaba. La pieza enfila el paso
// —mira para donde venís vos— y la fogata de señales está a un costado, sobre
// la loma, que es donde se pone una fogata que tiene que verse desde abajo.
export const PIEZA = { x: eje(-113) + 3.2, z: -113, rumbo: mirandoElPaso(-113) };
// LA FOGATA DE SEÑALES VA AL FONDO DEL PUESTO Y NO AL LADO DEL CORRAL, y esto
// no es decoración: es el nivel entero. Pegada al corral, el primero que se da
// vuelta la prende en un segundo y no hay nada que puedas hacer; a dieciséis
// metros, entre que uno se decide y llega hay unos cinco segundos, que es
// exactamente lo que tarda un tiro bien puesto.
export const FOGATA = { x: eje(-136) - 9, z: -136 };

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
  const o = ruido(x * 0.42, z * 0.36) * 0.10 +
            ruido(x * 1.3, z * 0.9) * 0.035 +
            Math.sin(x * 0.17 + z * 0.07) * 0.03;
  // y se planchan sobre el arroyo: el hielo apoya ahí y con las olas debajo le
  // asomaba la nieve por entre medio
  const d = Math.abs(x - eje(z));
  return o * Math.min(1, Math.max(0, (d - 1.8) / 2.6));
}

function altura (x, z) {
  const d = Math.abs(x - eje(z)) - medio(z);
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
    const m = medio(z), e = eje(z);
    const t = (k / COLS) * 2 - 1;
    const lado = t < 0 ? -1 : 1, a = Math.abs(t);
    const PISO = 0.38;
    // y todo cuelga del EJE, que ahora se mueve: la rejilla dobla con el valle
    const x = e + (a <= PISO
      ? t / PISO * m
      : lado * (m + Math.pow((a - PISO) / (1 - PISO), 1.7) * (ANCHO / 2 - m)));
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
      const pisada = Math.min(1, Math.abs(w[0] - eje(w[2])) / Math.max(4, medio(w[2])));
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

// LO QUE FRENA. Una tira de cajas pegada al pie de cada pared, una cada CUATRO
// metros de Z.
//
// Eran ocho, y con el eje clavado en cero alcanzaban: en ocho metros el ancho
// se movía menos de un metro. Ahora el valle DOBLA, y en el codo el borde del
// piso se corre cinco o seis metros en ese mismo tramo: con cajas de ocho, o
// la pared te frenaba en el aire o te dejaba meterte adentro de la piedra.
// Con dos y medio son 240 cajas —contra 54 en San Lorenzo— y el costo de chocar
// sigue siendo nada: probar una caja son seis restas y en la cordillera hay
// veinte hombres, no trescientos setenta. Y el largo del tramo ES la precisión
// de la pared: con cuatro metros, en el codo la caja se plantaba metro y medio
// por fuera del borde del piso y quedaba nieve pisable arriba de la roca.
//
// Y EL BORDE SE TOMA CONSERVADOR dentro de cada tramo: del lado izquierdo, el
// punto más a la izquierda que alcanza el piso en esos cuatro metros; del
// derecho, el más a la derecha. Así la caja nunca se come piso pisable, que es
// el error que se ve —una pared invisible arriba de la nieve— contra el que no
// se ve, que es poder arrimarse un palmo de más a la roca.
function murallas (colisiones) {
  const PASO = 2.5;
  for (let z = Z_BOCA; z > Z_FONDO; z -= PASO) {
    const izq = Math.min(eje(z) - medio(z), eje(z - PASO) - medio(z - PASO));
    const der = Math.max(eje(z) + medio(z), eje(z - PASO) + medio(z - PASO));
    for (const [x0, x1] of [[-ANCHO / 2, izq], [der, ANCHO / 2]]) {
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
// UNA PARED DE PIRCA. La usan el corral y la casucha: es la misma mano y la
// misma cantera, y lo único que cambia es cuántas hiladas lleva —tres para
// encerrar animales, cinco para aguantar un techo—.
let semillaPirca = 0;
function pirca (horno, colisiones, x0, z0, x1, z1, hiladas = 3) {
  const largo = Math.hypot(x1 - x0, z1 - z0);
  if (largo < 0.05) return;
  const ux = (x1 - x0) / largo, uz = (z1 - z0) / largo;
  // cada hilada corrida media piedra: una pirca de piedras alineadas parece un
  // muro de ladrillo, y no hay ladrillo en la cordillera
  for (let h = 0; h < hiladas; h++) {
    const y = 0.22 + h * 0.44;
    const paso = 0.62;
    for (let t = h * paso * 0.5; t < largo; t += paso) {
      semillaPirca++;
      const r = ruido(semillaPirca * 1.7, h * 3.1);
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
  if (!colisiones) return;
  const ex = Math.abs(x1 - x0) < 0.1 ? 0.34 : 0;
  const ez = Math.abs(z1 - z0) < 0.1 ? 0.34 : 0;
  colisiones.push(new THREE.Box3(
    new THREE.Vector3(Math.min(x0, x1) - ex, 0, Math.min(z0, z1) - ez),
    new THREE.Vector3(Math.max(x0, x1) + ex, 0.22 + hiladas * 0.44, Math.max(z0, z1) + ez)));
}

function pircas (horno, colisiones) {
  const { x: CX, z: CZ } = CORRAL;
  const AN = 15, LA = 11;
  const PORTILLO = 3.2;   // en la cara que mira a la boca del valle
  pirca(horno, colisiones, CX - AN / 2, CZ - LA / 2, CX + AN / 2, CZ - LA / 2);   // el fondo
  pirca(horno, colisiones, CX - AN / 2, CZ - LA / 2, CX - AN / 2, CZ + LA / 2);   // los costados
  pirca(horno, colisiones, CX + AN / 2, CZ - LA / 2, CX + AN / 2, CZ + LA / 2);
  pirca(horno, colisiones, CX - AN / 2, CZ + LA / 2, CX - PORTILLO / 2, CZ + LA / 2);
  pirca(horno, colisiones, CX + PORTILLO / 2, CZ + LA / 2, CX + AN / 2, CZ + LA / 2);
}

// ------------------------------------------------------ la casucha del Rey
//
// Un refugio de piedra de los que la corona mandó levantar en los pasos para
// que el que cruzaba no se muriera de frío. Es lo primero que te encontrás
// entrando al paso y no está de adorno: adentro te espera la patrulla de
// vanguardia, y su teniente es el que te dice para qué estás acá.
//
// EL TECHO NO VA A LAS COLISIONES. Las cajas frenan por su caja entera, así que
// un techo a dos metros y medio es una pared invisible que te tapa el vano.
// Adentro se entra: por eso el frente está partido.
function casucha (horno, colisiones) {
  const { x: CX, z: CZ } = CASUCHA;
  const AN = 5.6, LA = 4.6, HIL = 5, VANO = 1.6;
  const x0 = CX - AN / 2, x1 = CX + AN / 2, z0 = CZ - LA / 2, z1 = CZ + LA / 2;
  pirca(horno, colisiones, x0, z0, x1, z0, HIL);
  pirca(horno, colisiones, x0, z0, x0, z1, HIL);
  pirca(horno, colisiones, x1, z0, x1, z1, HIL);
  pirca(horno, colisiones, x0, z1, CX - VANO / 2, z1, HIL);
  pirca(horno, colisiones, CX + VANO / 2, z1, x1, z1, HIL);

  const ALTO = 0.22 + HIL * 0.44;
  for (let i = 0; i < 5; i++) {                       // las vigas
    horno.caja(CX, ALTO + 0.10, z0 + 0.55 + i * ((LA - 1.1) / 4),
      AN + 0.55, 0.17, 0.22, MADERA, 0.05);
  }
  horno.caja(CX, ALTO + 0.30, CZ, AN + 0.75, 0.24, LA + 0.75, NIEVE_SUCIA, 0);
  lena(horno, FOGON.x, FOGON.z, 1);                   // el fogón de la patrulla
}

// UN MONTÓN DE LEÑA: cuatro palos cruzados. Es el fogón de la casucha y es
// también la fogata de señales del puesto, que es la misma leña sin prender.
function lena (horno, x, z, escala = 1) {
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI;
    horno.pieza(new THREE.CylinderGeometry(0.075 * escala, 0.09 * escala, 1.25 * escala, 5),
      [x + Math.cos(a) * 0.1 * escala, 0.16 * escala, z + Math.sin(a) * 0.1 * escala],
      [Math.PI / 2 - 0.35, a, 0], null, MADERA);
  }
}

// ------------------------------------------------------------- el fuego
//
// UN FUEGO SIN UNA LUZ DE VERDAD. Una luz puntual se paga en cada píxel de cada
// material que alcanza, y acá el escenario es una sola malla de doscientos
// metros: la luz costaría el paso entero para iluminar dos metros de nieve.
//
// La primera versión le ponía abajo un disco naranja SUMADO, para que se leyera
// que eso da luz. Sobre la nieve no da luz: da un óvalo blanco. Sumar sobre un
// piso que ya está casi en blanco no aclara, satura, y lo que quedaba era una
// mancha gris de siete metros con los hombres parados encima. Queda la llama
// sola —dos conos, uno adentro del otro— que es lo único que de verdad se ve de
// un fuego a cien metros en una noche de luna.
const LLAMA_GEO = new THREE.ConeGeometry(0.36, 1.0, 6);
function llama (x, z, escala = 1) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  const fuera = new THREE.Mesh(LLAMA_GEO, new THREE.MeshBasicMaterial({ color: 0xff8a1e, fog: false }));
  fuera.position.y = 0.54 * escala;
  const nucleo = new THREE.Mesh(LLAMA_GEO, new THREE.MeshBasicMaterial({ color: 0xffe9a0, fog: false }));
  nucleo.position.y = 0.40 * escala;
  g.add(fuera); g.add(nucleo);
  g.userData = { fuera, nucleo, escala };
  return g;
}

// Los dos fuegos del paso, que la misión prende y apaga. Viven acá y no en un
// paquete que se pasa de mano en mano porque la misión también vive acá: son la
// misma cosa —el capítulo 2— y hacerlos viajar por tres archivos para volver al
// mismo sitio no compra nada.
const fuegos = { casucha: null, fogata: null };

// ------------------------------------------------------------ los peñones
//
// Piedra desprendida de la pared, en el piso. Es cobertura —lo único que hay
// en todo el paso— y es lo que le saca al desfiladero la cara de pasillo.
// UNA PIEDRA, con su gorro de nieve. Un dodecaedro y no cajas: la primera
// versión eran dos prismas cruzados con una tapa encima y de lejos parecían
// cajones de munición. Una piedra no tiene aristas verticales.
const ROCA_GEO = new THREE.DodecahedronGeometry(1, 0);
function penon (horno, colisiones, x, z, tam, semilla) {
  const r = ruido(semilla * 2.3, 7.1), r2 = ruido(semilla * 5.1, 2.7);
  const an = (1.5 + r * 0.9) * tam, al = (1.2 + r2 * 0.7) * tam, la = (1.4 + r2 * 0.8) * tam;
  horno.pieza(ROCA_GEO, [x, al * 0.78, z], [r2 * 0.5, r * 3, r * 0.4], [an, al, la], ROCA_CLARA);
  // la nieve que se le junta arriba: la misma piedra, aplastada y corrida
  horno.pieza(ROCA_GEO, [x + r * 0.16 * tam, al * 1.16, z - r2 * 0.14 * tam],
    [r2 * 0.5, r * 3, r * 0.4], [an * 0.82, al * 0.30, la * 0.82], NIEVE);
  if (colisiones) {
    colisiones.push(new THREE.Box3(
      new THREE.Vector3(x - an * 0.8, 0, z - la * 0.8),
      new THREE.Vector3(x + an * 0.8, al * 1.5, z + la * 0.8)));
  }
}

// LOS PEÑONES, EN GRUPOS Y COLGADOS DEL EJE.
//
// Eran doce piedras sueltas repartidas parejo por trescientos metros, y con
// eso el piso seguía siendo una alfombra: una piedra sola en el medio de la
// nada no es cobertura, es un adorno del que se sale de un paso. La piedra que
// baja de una pared cae AMONTONADA, y un montón sí es cobertura: te podés
// quedar atrás, elegir de qué lado salir, y esperar a que el centinela mire
// para el otro lado.
//
// Y van por DESVÍO del eje, no por x absoluta. Con el valle derecho daba
// igual; ahora, escritas a mano, la mitad terminaba adentro de la roca y la
// otra mitad en el medio del camino.
function penones (horno, colisiones) {
  //  desvío del eje, z, cuántas piedras, tamaño
  const grupos = [
    [  7,  62, 3, 1.0], [-10,  34, 2, 1.2], [ 12,  10, 4, 0.9],
    [-14, -14, 3, 1.1], [  8, -34, 2, 1.3],
    // ÉSTE ES A PROPÓSITO Y NO DECORACIÓN: cae justo delante del centinela de
    // la garganta, que es el primero que te encontrás. Sin él, el primer
    // hombre al que hay que esquivar en todo el capítulo no tenía UNA piedra
    // en su línea de vista: la única jugada posible era tirarse al piso y
    // esperar. Con esto, lo primero que te enseña el paso es a usar la roca.
    [  2, -58, 3, 1.1],
    [ -7, -76, 4, 1.0],
    [ 11, -100, 3, 1.2], [-16, -134, 3, 1.0], [ 10, -162, 2, 1.1],
    [ -9, -186, 3, 0.9]
  ];
  let n = 0;
  for (const [desvio, z, cuantas, tam] of grupos) {
    const cx = eje(z) + desvio;
    for (let k = 0; k < cuantas; k++) {
      n++;
      const a = ruido(n * 1.7, 3.3), b = ruido(n * 4.1, 9.7);
      penon(horno, colisiones, cx + a * 5.2, z + b * 5.2,
        tam * (0.7 + Math.abs(a) * 0.9), n);
    }
  }
}

// ------------------------------------------------------------ el derrumbe
//
// LA PARED SE VINO ABAJO Y TAPÓ MEDIO PASO. Es el único obstáculo del nivel
// que obliga a DECIDIR: el camino sigue, pero por el lado que el derrumbe
// dejó libre, y ese lado es el que mira el centinela de la garganta. Sin algo
// así, el paso se cruza caminando derecho de punta a punta.
//
// Baja de la pared izquierda y come el 60% del piso; queda un portillo contra
// la pared derecha por el que se pasa de a uno.
export const Z_DERRUMBE = -40;
function derrumbe (horno, colisiones) {
  const z = Z_DERRUMBE, e = eje(z), m = medio(z);
  const desde = e - m;                     // el pie de la pared izquierda
  const hasta = e + m * 0.22;              // hasta dónde llega la lengua
  let n = 500;
  for (let i = 0; i < 26; i++) {
    n++;
    const t = i / 25;
    const a = ruido(n * 2.9, 1.3), b = ruido(n * 6.7, 5.1);
    // más grande y más alto contra la pared, y se va deshaciendo hacia el medio
    const tam = (2.4 - t * 1.5) * (0.8 + Math.abs(b) * 0.5);
    penon(horno, null, desde + (hasta - desde) * t + a * 3.4, z + b * 7.0, tam, n);
  }
  // la colisión es UNA caja y no veintiséis: lo que importa es que no se pase
  // por arriba del montón, y veintiséis cajas chicas dejan huecos por los que
  // el que camina se cuela y queda trabado adentro de la piedra.
  colisiones.push(new THREE.Box3(
    new THREE.Vector3(desde - 4, 0, z - 4.6),
    new THREE.Vector3(hasta, 3.2, z + 4.6)));
}

// ------------------------------------------------------- las pircas caídas
//
// Restos de corrales viejos: por acá pasa gente desde antes que nosotros. Son
// cobertura baja —te tapan agachado, no parado— y eso las hace distintas del
// peñón, que tapa siempre. Dos tramos, uno a cada lado del camino.
function pircasCaidas (horno, colisiones) {
  const tramos = [[10, 22, 9, 0.35], [-12, -92, 11, -0.28]];
  let n = 900;
  for (const [desvio, z, largo, giro] of tramos) {
    const cx = eje(z) + desvio;
    const co = Math.cos(giro), si = Math.sin(giro);
    for (let t = -largo / 2; t < largo / 2; t += 0.58) {
      n++;
      const a = ruido(n * 1.9, 2.7);
      // se va cayendo hacia las puntas: en el medio quedan dos hiladas, en las
      // puntas una sola y desparramada
      const entero = 1 - Math.abs(t) / (largo / 2);
      const hiladas = entero > 0.45 ? 2 : 1;
      for (let h = 0; h < hiladas; h++) {
        horno.caja(cx + t * co + a * 0.5 * si, 0.2 + h * 0.36, z + t * si - a * 0.5 * co,
          0.5 + a * 0.2, 0.34 + a * 0.08, 0.44 + a * 0.16,
          a > 0 ? PIEDRA_PIRCA : PIEDRA_PIRCA_OSC, a * 0.7);
      }
    }
    const ex = Math.abs(largo / 2 * co) + 0.5, ez = Math.abs(largo / 2 * si) + 0.5;
    colisiones.push(new THREE.Box3(
      new THREE.Vector3(cx - ex, 0, z - ez),
      new THREE.Vector3(cx + ex, 0.75, z + ez)));
  }
}

// ------------------------------------------------------------ el arroyo
//
// EL AGUA HELADA DEL FONDO DEL VALLE. No es adorno: es la línea que te dice
// dónde está el eje cuando el paso dobla y no ves el final. Un desfiladero sin
// nada en el piso no tiene dirección; con el arroyo, siempre sabés para dónde
// sigue.
//
// VA A NIVEL DEL PISO, no en una cañada hundida: acá se camina sobre y = 0 y
// una cañada de verdad dejaría a la tropa flotando arriba del agua. Lo que sí
// se hace es APLANAR los sastrugi por donde pasa —el hielo no tiene olas de
// viento— así que el hielo apoya sobre un piso liso y no le asoma la nieve por
// abajo.
const ARROYO_ANCHO = 3.4;
function arroyo (escena) {
  const v = [], uv = [];
  const PASOS = 90;
  for (let i = 0; i < PASOS; i++) {
    const z0 = 70 + (Z_FONDO + 8 - 70) * (i / PASOS);
    const z1 = 70 + (Z_FONDO + 8 - 70) * ((i + 1) / PASOS);
    const a0 = eje(z0), a1 = eje(z1);
    const w = ARROYO_ANCHO / 2;
    const p = [[a0 - w, z0], [a0 + w, z0], [a1 + w, z1], [a1 - w, z1]];
    for (const idx of [0, 1, 2, 0, 2, 3]) {
      v.push(p[idx][0], 0.055, p[idx][1]);
      uv.push(p[idx][0] / 7, p[idx][1] / 7);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    color: HIELO, roughness: 0.24, metalness: 0.12
  }));
  m.receiveShadow = true;
  return m;
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
      // sobre el EJE del valle, que ahora dobla: sin esto la fila arrancaba
      // recta mientras el paso se iba para un costado
      x: eje(z) + Math.sin(z * 0.09) * ancho + r * 0.9,
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
// HACIA DÓNDE DA LA CARA. En este modelo el frente de un hombre es −Z, así que
// para mirar por el eje del valle hay que sumarle lo que el valle se tuerce: un
// centinela plantado en un codo mirando a −Z a secas es un poste mirando la
// pared.
function mirandoElPaso (z) { return Math.PI + Math.atan2(eje(z + 14) - eje(z - 14), 28); }

// Y para mirar a un punto: el frente es −Z, así que el rumbo que apunta de
// (x,z) a (px,pz) es el ángulo del vector al revés.
const mirandoA = (x, z, px, pz) => Math.atan2(x - px, z - pz);

// LA PATRULLA DE LA CASUCHA. Siete hombres tuyos: el teniente en el vano —es el
// que habla— dos adentro y cuatro alrededor del fogón. Salen QUIETOS, con la
// misma bandera de `centinela` que usa la guardia realista, porque un hombre
// sin objetivo se queda donde está y eso ya estaba en soldados.js. Se sueltan
// solos si suena la alarma: entonces ya no hay nada que esperar.
export function patrullaDeLaCasucha () {
  const { x: CX, z: CZ } = CASUCHA;
  const enElFogon = (dx, dz) => ({
    x: FOGON.x + dx, z: FOGON.z + dz, rumbo: mirandoA(FOGON.x + dx, FOGON.z + dz, FOGON.x, FOGON.z)
  });
  return [
    // el teniente, en el vano y mirando a la boca del valle: te ve venir
    { x: CX, z: CZ + 2.9, rumbo: mirandoElPaso(CZ) + Math.PI, teniente: true },
    { x: CX - 1.4, z: CZ - 0.9, rumbo: mirandoElPaso(CZ) + Math.PI + 0.4 },
    { x: CX + 1.3, z: CZ - 1.1, rumbo: mirandoElPaso(CZ) + Math.PI - 0.5 },
    enElFogon(-2.0, 0.5), enElFogon(1.9, 1.1), enElFogon(0.4, 2.2), enElFogon(-1.2, -1.9)
  ];
}

// EL PUESTO REALISTA. Catorce, y no seis: seis hombres en cuatro hectáreas de
// piedra no son un puesto, son cuatro postes que se esquivan de a uno. Están
// escalonados —dos avanzadas sueltas antes de llegar, el grueso en el corral,
// dos en la fogata y dos en la pieza— así que el paso se abre de a tramos y
// cada tramo tiene su solución.
//
// Los dos ARTILLEROS salen marcados: despliegue.js se los pasa a la pieza como
// sirvientes, y por eso matarlos la calla.
export function guardiaDelPuesto () {
  const { x: CX, z: CZ } = CORRAL;
  return [
    { x: eje(-66) + 4.5, z: -66, rumbo: mirandoElPaso(-66) },      // la avanzada de la garganta
    { x: eje(-88) - 3.0, z: -88, rumbo: mirandoElPaso(-88) },      // la segunda, en la hoyada
    { x: eje(-101) + 6.0, z: -101, rumbo: mirandoElPaso(-101) + 0.5 },
    { x: CX - 5.5, z: CZ + 7.5, rumbo: mirandoElPaso(CZ + 7.5) },
    { x: CX + 4.0, z: CZ + 7.0, rumbo: mirandoElPaso(CZ + 7) + 0.35 },
    { x: CX - 9.5, z: CZ - 1.0, rumbo: mirandoElPaso(CZ) - 0.9 },
    { x: CX + 6.5, z: CZ - 2.0, rumbo: mirandoElPaso(CZ) + 0.9 },
    { x: CX - 2.2, z: CZ - 3.2, rumbo: mirandoElPaso(CZ) + 2.6 },  // adentro del corral
    { x: CX + 1.8, z: CZ - 4.0, rumbo: mirandoElPaso(CZ) + 2.2 },
    { x: eje(-127) - 7.0, z: -127, rumbo: mirandoElPaso(-127) - 0.4 },
    { x: eje(-129) + 4.5, z: -129, rumbo: mirandoElPaso(-129) + 0.5 },
    { x: eje(-140) - 2.0, z: -140, rumbo: mirandoElPaso(-140) + Math.PI },  // la retaguardia
    { x: PIEZA.x - 1.8, z: PIEZA.z + 1.6, rumbo: mirandoElPaso(PIEZA.z), artillero: true },
    { x: PIEZA.x + 1.8, z: PIEZA.z + 1.6, rumbo: mirandoElPaso(PIEZA.z), artillero: true }
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
      // OJO CON LA FORMA: `placa` quiere un objeto con titulo/sub/cuerpo. Acá
      // había una lista de tres frases, así que desde que existe el sigilo la
      // placa salía en blanco —los tres renglones quedaban vacíos— y nadie se
      // enteró porque nadie la miró.
      hud.placa({
        titulo: 'Encima del puesto',
        sub: 'y ninguno te vio venir',
        cuerpo: 'Catorce hombres a nueve metros y la fogata de señales apagada. ' +
          'De acá en adelante es a la bayoneta.'
      }, 5);
    }
  }
}

// ===========================================================================
// LA MISIÓN DEL PASO
// ===========================================================================
//
// El sigilo dice si te ven. Esto dice PARA QUÉ estás acá, y es lo que faltaba:
// el paso tenía guardia y no tenía misión, así que entrar era caminar
// doscientos metros y salir por el otro lado sin que pasara nada.
//
// Son tres tiempos:
//
//   1 · MARCHA    de la boca a la casucha del Rey. Ahí espera la patrulla de
//                 vanguardia y el teniente te dice lo que hay adelante.
//   2 · PUESTO    limpiar el puesto realista. Si te ven, uno sale corriendo a
//                 prender la fogata de señales, y si la prende, la pieza deja
//                 de estar dormida y empieza a barrer el paso. Bajarlo antes
//                 de que llegue es la diferencia entre una pelea y una
//                 masacre.
//   3 · HECHO     no queda nadie en pie en el puesto.
//
// NO HAY PANTALLA DE DERROTA, y es a propósito. Que prendan la fogata no te
// mata: te despierta un cañón encima, que es peor y se entiende sin leer nada.
// Y callarlo se puede, porque los artilleros son dos y una pieza sin
// sirvientes no vuelve a hablar: eso ya estaba en canon.js desde San Lorenzo.
const CERCA_CASUCHA = 12;      // a esta distancia el teniente te habla
const PRENDE = 2.2;            // y a ésta, el que corre llega a la leña
const RELEVO = 3.5;            // lo que tarda otro en agarrar la antorcha
const DECIDIRSE = 2.5;         // y lo que tarda el primero en darse cuenta

export class Mision {
  constructor () { this.reiniciar(); }

  reiniciar () {
    this.fase = 'marcha';
    this.patrulla = [];
    this.guardia = [];
    this.canon = null;
    this.encendida = false;
    this.corredor = null;
    this.sueltos = false;
    this.tRelevo = DECIDIRSE;
    this.tFuego = 0;
    this.orden = '';
    if (fuegos.fogata) fuegos.fogata.visible = false;
    if (fuegos.casucha) fuegos.casucha.visible = true;
  }

  // Los pone el despliegue, ya soltados al campo.
  poner ({ patrulla, guardia, canon }) {
    this.patrulla = patrulla || [];
    this.guardia = guardia || [];
    this.canon = canon || null;
    // LA PIEZA ARRANCA DORMIDA. Sin esto no hay sigilo posible: el cañón busca
    // blanco a setenta y ocho metros y te encuentra desde la garganta, así que
    // el paso se decidiría solo antes de que puedas hacer nada.
    if (this.canon) this.canon.dormido = true;
    this.orden = '';
  }

  get puestoLimpio () {
    return this.guardia.length > 0 && !this.guardia.some(s => s.vivo && !s.quebrado);
  }

  actualizar (dt, ctx) {
    const { jugador, sigilo, hud, sonido } = ctx;
    this._avivar(dt);
    if (this.fase === 'hecho') return;

    // la patrulla espera quieta, pero no es sorda: dada la alarma ya no hay
    // nada que esperar y salen
    if (sigilo && sigilo.alarma && !this.sueltos) {
      this.sueltos = true;
      for (const s of this.patrulla) s.centinela = false;
    }

    if (this.fase === 'marcha') {
      const d = Math.hypot(jugador.pos.x - CASUCHA.x, jugador.pos.z - CASUCHA.z);
      if (d < CERCA_CASUCHA) this._llegar(hud);
      return;
    }

    if (sigilo && sigilo.alarma && !this.encendida) this._correr(dt, hud, sonido);
    if (this.puestoLimpio) this._ganar(hud);
  }

  // el fuego se mueve: quieto se lee como una calcomanía naranja
  _avivar (dt) {
    this.tFuego += dt;
    for (const f of [fuegos.casucha, fuegos.fogata]) {
      if (!f || !f.visible) continue;
      const u = f.userData;
      const p = 0.88 + 0.12 * Math.sin(this.tFuego * 9.3 + f.position.x)
        + 0.06 * Math.sin(this.tFuego * 21.1);
      u.fuera.scale.set(u.escala * p, u.escala * (2 - p), u.escala * p);
      u.nucleo.scale.setScalar(u.escala * 0.55 * p);
    }
  }

  _llegar (hud) {
    this.fase = 'puesto';
    if (!hud) return;
    hud.mostrarAviso('Patrulla de vanguardia · la casucha del Rey', 'bien');
    hud.decir('Mi General: los realistas tienen un puesto adelante, sobre el paso, ' +
      'con una pieza enfilada. Si nos ven, prenden la fogata y nos barren la columna.', 9,
      'Teniente de vanguardia');
    this._orden(hud, 'Limpiá el puesto. Que no prendan la fogata.');
  }

  _correr (dt, hud, sonido) {
    const c = this.corredor;
    if (c && c.vivo && !c.quebrado) {
      if (Math.hypot(c.pos.x - FOGATA.x, c.pos.z - FOGATA.z) < PRENDE) this._encender(hud, sonido);
      return;
    }
    // se lo bajaron, o se quebró: otro va a agarrar la antorcha, pero tarda
    if (c) { this.corredor = null; this.tRelevo = RELEVO; return; }
    this.tRelevo -= dt;
    if (this.tRelevo > 0) return;

    let elegido = null, mejor = Infinity;
    for (const s of this.guardia) {
      if (!s.vivo || s.quebrado) continue;
      const d = Math.hypot(s.pos.x - FOGATA.x, s.pos.z - FOGATA.z);
      if (d < mejor) { mejor = d; elegido = s; }
    }
    if (!elegido) return;                     // no queda quien la prenda
    this.corredor = elegido;
    elegido.centinela = false;
    // LA PLAZA es el mismo mecanismo con el que marcha la columna a pie: no hay
    // un estado nuevo ni una IA nueva, hay un hombre con un sitio a dónde ir.
    elegido.plaza = { x: FOGATA.x, z: FOGATA.z };
    if (hud) hud.mostrarAviso('¡Uno corre a la fogata de señales!', 'malo');
  }

  _encender (hud, sonido) {
    this.encendida = true;
    if (this.corredor) { this.corredor.plaza = null; this.corredor = null; }
    if (fuegos.fogata) fuegos.fogata.visible = true;
    if (this.canon) this.canon.dormido = false;
    if (hud) {
      hud.mostrarAviso('¡Prendieron la fogata! La pieza enfila el paso', 'malo');
      this._orden(hud, 'Callá la pieza: son dos artilleros.');
    }
    if (sonido && sonido.rastrillo) sonido.rastrillo();
  }

  _ganar (hud) {
    this.fase = 'hecho';
    if (!hud) return;
    this._orden(hud, '');
    hud.placa({
      titulo: 'El paso queda abierto',
      sub: this.encendida ? 'Alcanzaron a dar la voz' : 'Y nunca dieron la voz',
      cuerpo: this.encendida
        ? 'La fogata ardió y la pieza llegó a hablar. La columna cruza igual, ' +
          'pero abajo ya saben que el Ejército de los Andes está en la cordillera.'
        : 'Ni un tiro de alarma, ni una fogata prendida. Abajo siguen creyendo ' +
          'que la montaña alcanza para defenderlos.'
    }, 6);
  }

  _orden (hud, texto) {
    this.orden = texto;
    if (hud && hud.orden) hud.orden(texto);
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
  const piso = terreno(); piso.name = 'paso-terreno';
  lugar.add(piso);
  const hielo = arroyo(); hielo.name = 'paso-arroyo';
  lugar.add(hielo);
  const horno = new Horno();
  pircas(horno, colisiones);
  casucha(horno, colisiones);
  lena(horno, FOGATA.x, FOGATA.z, 1.5);      // la de señales: más grande, para que se vea de abajo
  penones(horno, colisiones);
  derrumbe(horno, colisiones);
  pircasCaidas(horno, colisiones);
  cordillera(horno);
  const piedras = horno.cocinar(MAT());
  // con nombre para que las pruebas puedan preguntarle dónde quedó cada cosa
  piedras.name = 'paso-piedras';
  lugar.add(piedras);
  murallas(colisiones);

  // EL FUEGO DE LA CASUCHA arde desde el principio —hay gente ahí— y la FOGATA
  // DE SEÑALES nace apagada: prenderla es lo que el puesto va a intentar hacer
  // cuando te vea, y evitarlo es la misión.
  fuegos.casucha = llama(FOGON.x, FOGON.z, 1.15);
  fuegos.casucha.name = 'paso-fogon';
  fuegos.fogata = llama(FOGATA.x, FOGATA.z, 3.0);
  fuegos.fogata.name = 'paso-fogata';
  fuegos.fogata.visible = false;
  lugar.add(fuegos.casucha);
  lugar.add(fuegos.fogata);

  escena.add(lugar);
  return lugar;
}
