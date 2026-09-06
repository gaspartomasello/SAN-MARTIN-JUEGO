import * as THREE from 'three';

// EL LUGAR.
//
// Hasta acá el campo era un polígono de tiro: una pared de cal, unos blancos y
// pasto. Esto lo convierte en San Lorenzo, y el eje de la batalla ya estaba
// bien puesto sin querer: los realistas vienen desde -Z porque desembarcaron
// en la barranca del Paraná, y vos salís desde +Z porque los granaderos
// esperaron escondidos DETRÁS DEL CONVENTO. El campo abierto del medio es el
// que cruzaron las dos columnas de sesenta hombres.
//
//   +Z   convento de San Carlos, su iglesia y su huerta   ← de acá salís vos
//    0   el campo abierto: acá se decide en quince minutos
//   -85  la barranca: el suelo se cae nueve metros
//  -100  el río Paraná y la escuadra española fondeada
//
// TODO se funde en dos o tres mallas. Un convento de sesenta cajas que costara
// sesenta llamadas de dibujo no entra en el presupuesto; fundido, cuesta una.

const CAL = 0xe8e2d2;
const CAL_SOMBRA = 0xd6cfba;
const TEJA = 0x9c5a3c;
const TEJA_OSC = 0x7d4530;
const MADERA = 0x5b452c;
const PIEDRA = 0xbfb49c;
const BARRANCA = 0x9c8a63;
const BARRANCA_BAJA = 0x7a6b4d;

// --- horno: junta cajas en una sola malla con color por vértice ---
export class Horno {
  constructor () { this.piezas = []; }
  caja (x, y, z, ancho, alto, largo, color, rotY) {
    const g = new THREE.BoxGeometry(ancho, alto, largo);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    if (rotY) q.setFromEuler(new THREE.Euler(0, rotY, 0));
    m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(1, 1, 1));
    this.piezas.push({ g, m, color: new THREE.Color(color) });
    return this;
  }
  prisma (x, y, z, ancho, alto, largo, color, rotY, rotZ) {
    const g = new THREE.BoxGeometry(ancho, alto, largo);
    const e = new THREE.Euler(0, rotY || 0, rotZ || 0);
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(e), new THREE.Vector3(1, 1, 1));
    this.piezas.push({ g, m, color: new THREE.Color(color) });
    return this;
  }
  // cualquier geometría, con posición, rotación y escala
  pieza (geo, pos, rot, esc, color) {
    const e = new THREE.Euler(rot ? rot[0] : 0, rot ? rot[1] : 0, rot ? rot[2] : 0);
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(pos[0], pos[1], pos[2]),
      new THREE.Quaternion().setFromEuler(e),
      new THREE.Vector3(esc ? esc[0] : 1, esc ? esc[1] : 1, esc ? esc[2] : 1));
    this.piezas.push({ g: geo, m, color: new THREE.Color(color) });
    return this;
  }

  cocinar (material) {
    const pos = [], nor = [], col = [];
    for (const p of this.piezas) {
      const g = p.g.index ? p.g.toNonIndexed() : p.g;
      g.applyMatrix4(p.m);
      const ap = g.attributes.position, an = g.attributes.normal;
      for (let i = 0; i < ap.count; i++) {
        pos.push(ap.getX(i), ap.getY(i), ap.getZ(i));
        nor.push(an.getX(i), an.getY(i), an.getZ(i));
        col.push(p.color.r, p.color.g, p.color.b);
      }
      g.dispose();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.computeBoundingSphere();
    const malla = new THREE.Mesh(geo, material);
    malla.castShadow = true;
    malla.receiveShadow = true;
    return malla;
  }
}

export const MAT = () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 });

// ------------------------------------------------------- el convento

// El convento de San Carlos, con su iglesia, su espadaña y la tapia de la
// huerta. No es escenografía de fondo: es el ACCIDENTE TÁCTICO de la batalla.
// Detrás de esta mole se escondieron ciento veinte jinetes sin que la
// infantería española los viera, y por los dos costados salieron.
// LA PLANTA DEL NIVEL, para el que la necesite dibujar. El plano de la batalla
// se genera con estos números: si el convento se mueve, el plano se mueve solo.
export const CONVENTO = { x0: -31, x1: 31, z0: 16, z1: 68 };
// EL PORTÓN, al medio de la tapia que mira al campo. Lo usa el acto de la
// victoria para saber dónde plantar la flecha y dónde formar el escuadrón, y
// está acá por el mismo motivo que todo lo demás de este bloque: si el
// convento se mueve, se mueve con él y nadie tiene que acordarse.
export const PORTON = { x: 0, z: 16 };
export const IGLESIA = { x0: -19.5, x1: -6.5, z0: 17, z1: 37 };
export const Z_BARRANCA = -84;   // el labio por donde se cae el terreno
export const Z_RIO = -99;

function convento (horno, colisiones) {
  const Z = 16;                 // la cara que mira al campo
  const LARGO = 52;

  // tapia del frente, con el portón al medio
  for (const [x, ancho] of [[-16.5, 19], [16.5, 19]]) {
    horno.caja(x, 2.4, Z, ancho, 4.8, 0.9, CAL);
    horno.caja(x, 4.95, Z, ancho + 0.5, 0.3, 1.5, TEJA);
  }
  // EL PORTÓN, ABIERTO.
  //
  // Estaba cerrado por una tabla lisa de seis metros por cuatro… y se caminaba
  // a través de ella: la colisión del frente deja libre de x=-7 a x=7 y la hoja
  // tapaba de -3,15 a 3,15. O sea que el jugador atravesaba una puerta maciza
  // como si fuera humo. Se arregla abriéndola y no cerrándole el paso: los
  // granaderos formaron EN el portón a las cinco y media.
  //
  // ABIERTAS A SESENTA Y SEIS GRADOS Y NO DE PAR EN PAR. Contra el muro se ven
  // de canto —veinte centímetros de tabla— y parecen dos postes; a sesenta y
  // seis se les ve la cara, que es donde están las tablas y los clavos, y el
  // vano sigue libre de sobra.
  //
  // Y NO SE LES PONE COLISIÓN. Meter cajas ahí sería angostar justo el corredor
  // por el que se llega al portón, que es donde se canta la victoria: el riesgo
  // no vale veinte centímetros de tabla.
  for (const s of [-1, 1]) horno.caja(s * 3.6, 2.6, Z, 0.9, 5.2, 1.2, PIEDRA);
  horno.caja(0, 5.1, Z, 8.2, 0.8, 1.2, PIEDRA);                       // dintel
  horno.caja(0, 5.65, Z, 8.8, 0.34, 1.45, PIEDRA);                    // y su cornisa

  const HERRAJE = 0x2e2a24, CLAVO = 0x3b352c;
  const ABRE = 1.15, W = 2.9, GRUESO = 0.20;
  for (const s of [-1, 1]) {
    // la hoja gira sobre el gozne, pegado a la jamba
    const gx = s * 3.15, phi = s * ABRE;
    const cx = gx - s * Math.cos(ABRE) * W / 2, cz = Z + Math.sin(ABRE) * W / 2;
    // un punto de la hoja: u a lo largo de la tabla, w hacia su espesor
    const en = (u, w) => [cx + u * Math.cos(phi) + w * Math.sin(phi),
      cz - u * Math.sin(phi) + w * Math.cos(phi)];
    for (let i = 0; i < 7; i++) {                      // las tablas
      const [px, pz] = en(0, 0);
      horno.caja(px, 0.30 + i * 0.58, pz, W, 0.54, GRUESO + (i % 3) * 0.03,
        i % 2 ? MADERA : 0x54401f, phi);
    }
    for (const y of [0.75, 2.1, 3.45]) {               // las fajas de herraje
      const [hx, hz] = en(0, -GRUESO * 0.62);
      horno.caja(hx, y, hz, W * 0.97, 0.20, 0.05, HERRAJE, phi);
      for (let k = 0; k < 5; k++) {                    // y los clavos
        const [nx, nz] = en(-W / 2 + 0.35 + k * 0.55, -GRUESO * 0.72);
        horno.caja(nx, y, nz, 0.11, 0.11, 0.06, CLAVO, phi);
      }
    }
    for (const y of [0.75, 3.45]) horno.caja(gx, y, Z, 0.34, 0.16, 0.30, HERRAJE);
  }

  // LA PORTERÍA: el cuerpo que se levanta sobre el portón con la hornacina.
  //
  // La primera versión puso el nicho suelto a seis metros y medio de altura, y
  // como la tapia mide 4,8 quedaba flotando contra el cielo como una chimenea.
  // Un nicho va EN una pared: así que primero la pared. Es lo que llevaba
  // cualquier portería de convento y es lo único que rompe los cincuenta metros
  // de cal del frente.
  horno.caja(0, 6.9, Z, 8.8, 3.2, 1.0, CAL);
  horno.caja(0, 8.62, Z, 9.4, 0.34, 1.5, TEJA);                       // el remate
  horno.caja(0, 6.9, Z - 0.30, 1.7, 2.0, 0.5, CAL_SOMBRA);            // el marco
  horno.caja(0, 6.9, Z - 0.46, 1.15, 1.5, 0.3, 0x3a3227);             // el vano
  horno.caja(0, 6.85, Z - 0.52, 0.14, 1.0, 0.14, PIEDRA);             // la cruz
  horno.caja(0, 7.10, Z - 0.52, 0.56, 0.14, 0.14, PIEDRA);

  // la iglesia, corrida a la izquierda, de espaldas al campo
  const IX = -13, IZ = Z + 11;
  horno.caja(IX, 4.4, IZ, 13, 8.8, 20, CAL);
  // techo a dos aguas: dos prismas inclinados que apoyan en el muro y se
  // juntan en la cumbrera. El techo NO llega hasta el frente: se corta contra
  // la espadaña, que es la que se ve desde el campo.
  // OJO CON EL SIGNO, que estuvo al revés y hacía una V en vez de un techo.
  // rotZ positivo levanta la punta del lado +X: para un agua hay que bajarla,
  // así que la faldón de la derecha va con rotZ NEGATIVO y el de la izquierda
  // con positivo. Con los signos cambiados el agua cae hacia la cumbrera —o
  // sea que la lluvia iría al medio del techo— y se ve como una batea.
  for (const s of [-1, 1]) {
    horno.prisma(IX + s * 3.3, 10.0, IZ + 0.8, 7.4, 0.7, 18.6, s > 0 ? TEJA : TEJA_OSC, 0, -s * 0.44);
  }
  horno.caja(IX, 11.5, IZ + 0.8, 1.3, 0.7, 18.8, TEJA_OSC);          // cumbrera

  // ESPADAÑA: el campanario que se ve desde todo el campo y te dice dónde
  // estás parado. Es el punto de referencia del jugador.
  horno.caja(IX, 10.4, IZ - 9.5, 6.4, 4.0, 1.5, CAL);            // frontis
  horno.caja(IX, 13.4, IZ - 9.6, 5.4, 6.6, 1.6, CAL);
  horno.caja(IX, 16.9, IZ - 9.6, 6.0, 0.6, 2.1, TEJA);
  for (const s of [-1, 1]) horno.caja(IX + s * 2.0, 13.8, IZ - 9.6, 1.0, 5.2, 1.7, CAL_SOMBRA);
  horno.caja(IX, 17.9, IZ - 9.6, 0.34, 1.8, 0.34, MADERA);        // cruz
  horno.caja(IX, 18.3, IZ - 9.6, 1.1, 0.32, 0.32, MADERA);
  horno.caja(IX, 13.6, IZ - 9.6, 1.5, 1.5, 1.9, 0x3a3227);        // el vano de la campana
  horno.caja(IX, 13.8, IZ - 9.6, 0.9, 1.0, 1.0, 0x8a6a34);        // la campana

  // celdas y galería del claustro, a la derecha
  horno.caja(14, 3.1, Z + 8, 22, 6.2, 15, CAL);
  horno.caja(14, 6.6, Z + 8, 23, 0.5, 16, TEJA);
  for (let i = 0; i < 7; i++) horno.caja(3.6 + i * 3.1, 1.6, Z + 0.4, 0.7, 3.2, 0.7, CAL_SOMBRA);

  // tapia de la huerta: se va para el fondo y cierra el flanco izquierdo
  horno.caja(-31, 1.7, Z + 24, 0.8, 3.4, LARGO, CAL);
  horno.caja(31, 1.7, Z + 24, 0.8, 3.4, LARGO, CAL);

  // ---- lo que hace que esto sea un edificio y no una maqueta ----
  //
  // Todo lo de arriba es cal blanca plana, y desde el campo se lee como cartón:
  // no hay una sola línea horizontal que dé escala ni nada que rompa los
  // cincuenta metros de tapia. Dos cosas lo arreglan, las dos de época y las
  // dos horneadas en la misma malla, o sea que no cuestan un dibujo más.
  //
  // EL ZÓCALO. Piedra en la base de todo lo que es cal. Es lo que se hacía
  // —la humedad se come el adobe desde abajo— y de paso apoya el edificio en
  // el suelo en vez de dejarlo flotando sobre el pasto.
  const zocalo = (x, z, ancho, largo) => horno.caja(x, 0.42, z, ancho + 0.18, 0.84, largo + 0.18, PIEDRA);
  for (const [x, ancho] of [[-16.5, 19], [16.5, 19]]) zocalo(x, Z, ancho, 0.9);
  zocalo(IX, IZ, 13, 20);
  zocalo(14, Z + 8, 22, 15);
  zocalo(-31, Z + 24, 0.8, LARGO);
  zocalo(31, Z + 24, 0.8, LARGO);

  // LOS CONTRAFUERTES de la tapia de la huerta. Cincuenta y dos metros de pared
  // lisa no se sostienen solos ni en la realidad ni en la pantalla: cada tres
  // metros y medio hay un machón, y son los que le dan ritmo y sombra al muro
  // por el que entra la pinza.
  for (const lado of [-1, 1]) {
    for (let i = 0; i < 13; i++) {
      const z = Z + 2 + i * 4.0;
      // POR AFUERA. Puestos del lado de adentro no los ve nadie: el jugador
      // llega desde el campo y la pinza rodea la tapia por fuera, así que la
      // cara que se mira es ésa.
      horno.caja(lado * 31.85, 1.5, z, 1.2, 3.0, 1.5, CAL_SOMBRA);
      horno.caja(lado * 31.9, 0.42, z, 1.3, 0.84, 1.7, PIEDRA);
    }
  }

  // LOS MACHONES DEL FRENTE. La tapia de la huerta ya los tiene y la del frente
  // no: diecinueve metros de cal lisa a cada lado del portón, que es justo la
  // pared que el jugador mira toda la batalla. Van por afuera, como los otros.
  for (const lado of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const x = lado * (7.6 + i * 4.6);
      horno.caja(x, 2.3, Z - 0.62, 1.1, 4.6, 0.5, CAL_SOMBRA);
      horno.caja(x, 0.42, Z - 0.66, 1.25, 0.84, 0.62, PIEDRA);
      horno.caja(x, 4.75, Z - 0.68, 1.35, 0.28, 0.72, TEJA);
    }
  }

  // EL PINO DEL PATIO DE ATRÁS.
  //
  // Va en el eje del portón —x = 0— y a veintiocho metros de él, en el hueco
  // que queda entre la iglesia y las celdas. O sea que con las hojas abiertas
  // se lo ve DESDE EL CAMPO, enmarcado por el vano: es lo que le da fondo al
  // portón y lo que hace que el convento se lea como un lugar con adentro y no
  // como un telón.
  //
  // No estorba a nadie: la victoria se canta a siete metros del portón, así que
  // el jugador nunca pasa de z = 23 y el pino está en 44.
  const PINO_X = 0, PINO_Z = 44;
  const TRONCO = 0x4a3623, AGUJA = 0x2f4a2c, AGUJA_CLARA = 0x3d5c35;
  horno.pieza(new THREE.CylinderGeometry(0.30, 0.46, 4.2, 8),
    [PINO_X, 2.1, PINO_Z], null, null, TRONCO);
  // cuatro faldones de aguja, de más ancho abajo a más angosto arriba
  const faldas = [[3.6, 3.4, 3.0], [5.4, 2.9, 2.7], [7.0, 2.2, 2.4], [8.4, 1.4, 2.0]];
  faldas.forEach(([y, r, h], i) => {
    horno.pieza(new THREE.ConeGeometry(r, h, 9),
      [PINO_X, y + h / 2, PINO_Z], [0, i * 0.4, 0], null, i % 2 ? AGUJA : AGUJA_CLARA);
  });
  colisiones.push(new THREE.Box3(
    new THREE.Vector3(PINO_X - 0.5, 0, PINO_Z - 0.5),
    new THREE.Vector3(PINO_X + 0.5, 4.2, PINO_Z + 0.5)));

  // colisiones: sólo las caras que importan, no las sesenta cajas
  const caja = (x0, z0, x1, z1, alto) => colisiones.push(
    new THREE.Box3(new THREE.Vector3(Math.min(x0, x1), 0, Math.min(z0, z1)),
      new THREE.Vector3(Math.max(x0, x1), alto, Math.max(z0, z1))));
  caja(-26, Z - 0.5, -7, Z + 0.5, 4.8);
  caja(7, Z - 0.5, 26, Z + 0.5, 4.8);
  caja(-19.5, Z + 1, -6.5, Z + 21, 8.8);
  caja(3, Z + 0.5, 25, Z + 15.5, 6.2);
  // La tapia incluye sus contrafuertes: sobresalen un metro para afuera y si la
  // colisión terminara en la pared, el que va pegado al muro los atravesaría.
  caja(-32.6, Z, -30.6, Z + 50, 3.4);
  caja(30.6, Z, 32.6, Z + 50, 3.4);
}

// Dónde está varada cada chalupa. Lo lee soldados.js por Soldado.botes para
// saber hacia cuál corre el que se quiebra: por eso son coordenadas y no
// solamente geometría.
export const BOTES = [-72, -36, 0, 36, 72];

function botes (h, HONDO) {
  const CASCO = 0x4a412f, BORDA = 0x6f5f42, REMO = 0x8a7a58;
  BOTES.forEach((x, i) => {
    const z = -101 - (i % 2) * 3.4;      // dos hileras: unas más metidas en el agua
    const r = -0.14 + (i % 3) * 0.12;    // ninguna vararía perfectamente derecha
    const y = HONDO + 0.45;
    h.caja(x, y, z, 7.4, 1.05, 2.3, CASCO, r);
    h.caja(x, y + 0.6, z, 7.0, 0.18, 2.5, BORDA, r);
    for (const d of [-2.1, 0, 2.1]) {    // las bancadas
      h.caja(x + Math.cos(r) * d, y + 0.58, z - Math.sin(r) * d, 0.46, 0.12, 2.0, BORDA, r);
    }
    for (const lado of [-1, 1]) {        // los remos, apoyados cruzados
      h.caja(x + lado * 0.7, y + 0.74, z + lado * 1.4, 5.4, 0.11, 0.11, REMO, r + lado * 0.3);
    }
  });
}

// -------------------------------------------- la barranca y el Paraná

// El suelo no sigue plano hasta el infinito: a ochenta y cinco metros se cae
// nueve metros de golpe hasta el río. Ahí desembarcaron los doscientos
// cincuenta españoles y ahí volvieron a refugiarse los dispersos.
function barrancaYRio (escena, colisiones) {
  const Z0 = Z_BARRANCA, Z1 = Z_RIO, HONDO = -9;
  const ANCHO = 260;

  // LA CUESTA, SUBDIVIDIDA EN LOS DOS EJES.
  //
  // EL PERFIL ERA UNA S Y POR ESO NO SE VEÍA NINGUNA BARRANCA. El viejo
  // `1 - cos(t·π/2)^1.6` arranca con PENDIENTE CERO: en el labio el terreno
  // seguía horizontal y recién se curvaba más adelante, así que no había
  // ninguna línea donde se viera que el campo se cae. Las barrancas del Paraná
  // no son una loma, son un tajo: `t^0.55` deja el corte casi a pico arriba y
  // lo afloja hasta la playa, que es el talud de abajo.
  //
  // Se puede cambiar sin miedo porque NADIE CAMINA ACÁ: el que se quiebra
  // corre hasta z = -82 y el labio está en -84, así que se lo levanta del campo
  // dos metros antes de llegar.
  //
  // Y ERA UNA TIRA DE QUADS DE 260 METROS DE ANCHO: una pared de un solo tono
  // con el labio perfectamente recto de punta a punta, que es lo que menos se
  // parece a una barranca de río. Con columnas se le mete erosión —cada
  // vértice de adentro se corre un poco y el color varía a lo ancho— y queda
  // tierra comida en vez de una torta cortada con cuchillo.
  //
  // EL LABIO NO SE MUEVE, a propósito: el suelo del campo termina en un plano
  // recto justo en Z0, y cualquier ondulación en la fila de arriba abriría un
  // hueco entre los dos. La erosión empieza en la segunda fila para abajo.
  //
  // Y LAS NORMALES SALEN DE LA GEOMETRÍA, no escritas a mano. Las de antes
  // tenían el signo de Z al revés —para una cuesta que baja al río la normal
  // de arriba es (0, -Δz, Δy) con Δy NEGATIVO, y el código ponía -(yb - ya),
  // o sea positivo—: la cuesta se iluminaba como si mirara al campo en vez de
  // al agua. Con el perfil casi horizontal la componente era 0,06 y nadie lo
  // veía; con el tajo se vería entera. Sacándolas del producto vectorial de
  // cada triángulo, ese error no se puede volver a cometer.
  const CORTES = 22, COLS = 24;
  const perfil = t => Math.pow(t, 0.55);
  // el ruido de la erosión, sin Math.random: el mismo terreno en las dos
  // máquinas de una partida de a dos y entre corridas de las pruebas
  const ruido = (a, b) => {
    const s = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
    return (s - Math.floor(s)) - 0.5;
  };
  const alto = new THREE.Color(BARRANCA), bajo = new THREE.Color(BARRANCA_BAJA);
  const punto = (i, k) => {
    const tt = i / CORTES;
    const x = -ANCHO / 2 + (ANCHO * k) / COLS;
    const z = Z0 + (Z1 - Z0) * tt;
    const erosion = i === 0 ? 0
      : (ruido(i * 1.7, k * 2.3) * 0.55 + ruido(i * 0.4, k * 0.9) * 1.15) * Math.min(1, i / 3);
    return [x, HONDO * perfil(tt) + erosion, z, tt];
  };

  const geo = new THREE.BufferGeometry();
  const v = [], n = [], c = [];
  const A = new THREE.Vector3(), B = new THREE.Vector3(), N = new THREE.Vector3();
  const cara = (p, q, r) => {
    A.set(q[0] - p[0], q[1] - p[1], q[2] - p[2]);
    B.set(r[0] - p[0], r[1] - p[1], r[2] - p[2]);
    N.crossVectors(A, B).normalize();
    if (N.y < 0) N.negate();                 // la de arriba, siempre
    for (const w of [p, q, r]) {
      v.push(w[0], w[1], w[2]);
      n.push(N.x, N.y, N.z);
      const mancha = 0.5 + ruido(w[0] * 0.06, w[2] * 0.05) * 0.9;
      const col = alto.clone().lerp(bajo, Math.min(1, w[3] * 0.7 + mancha * 0.34));
      c.push(col.r, col.g, col.b);
    }
  };
  for (let i = 0; i < CORTES; i++) {
    for (let k = 0; k < COLS; k++) {
      const p00 = punto(i, k), p10 = punto(i, k + 1);
      const p01 = punto(i + 1, k), p11 = punto(i + 1, k + 1);
      cara(p00, p10, p11);
      cara(p00, p11, p01);
    }
  }
  geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(n, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
  geo.computeBoundingSphere();
  const cuesta = new THREE.Mesh(geo, MAT());
  cuesta.receiveShadow = true;
  escena.add(cuesta);

  // EL PARANÁ. Era 0x8d9a9c: un gris casi del mismo valor que la niebla del
  // horizonte, así que el agua y el cielo se fundían en una sola banda pálida y
  // los once buques parecían pegados sobre el aire. No estaban flotando —el
  // casco apoya en -8,80 y el agua está en -8,85, cinco centímetros— pero se
  // veían así porque no había contra qué recortarlos.
  //
  // Ahora el agua es más oscura y más fría que la niebla. Con eso la línea de
  // la costa aparece sola, los cascos tienen sobre qué apoyarse, y de paso el
  // río se lee como río: el Paraná bajo el sol de la mañana no es una chapa
  // blanca.
  const rio = new THREE.Mesh(
    new THREE.PlaneGeometry(ANCHO * 1.6, 220),
    new THREE.MeshStandardMaterial({ color: 0x5c707c, roughness: 0.22, metalness: 0.22 })
  );
  rio.rotation.x = -Math.PI / 2;
  rio.position.set(0, HONDO + 0.15, Z1 - 108);
  escena.add(rio);

  // La escuadra: once buques fondeados, de los que bajaron los doscientos
  // cincuenta. Van fundidos en una sola malla y a contraluz son siluetas.
  const h = new Horno();
  const CASCO = 0x33302a, PALO = 0x4a4136, VELA = 0xcfc9ba;
  const naves = [[-56, -128, 0.35], [-22, -140, -0.2], [14, -132, 0.1],
    [46, -146, 0.3], [74, -126, -0.15], [-88, -150, 0.2]];
  for (const [x, z, r] of naves) {
    const y = HONDO + 0.6;
    h.caja(x, y + 0.9, z, 16, 2.6, 4.4, CASCO, r);
    h.caja(x, y + 2.4, z, 9, 1.2, 3.6, CASCO, r);
    for (const [dx, altoP] of [[-4.4, 13], [0.6, 15], [5, 11]]) {
      const px = x + Math.cos(r) * dx, pz = z - Math.sin(r) * dx;
      h.caja(px, y + altoP / 2 + 2, pz, 0.5, altoP, 0.5, PALO);
      h.caja(px, y + altoP * 0.72, pz, 6.4, 4.6, 0.24, VELA, r);
      h.caja(px, y + altoP * 0.36, pz, 8.2, 4.2, 0.24, VELA, r);
    }
  }
  botes(h, HONDO);          // antes de cocinar: lo que se agrega después no existe
  escena.add(h.cocinar(MAT()));

  // LOS BOTES, que es donde termina de verdad la desbandada.
  //
  // La escuadra está fondeada lejos y a un buque no se llega a pie: se llega
  // en chalupa. Faltaba justamente ese eslabón —se veían los once buques en
  // el horizonte y no había con qué alcanzarlos—, así que el que bajaba la
  // barranca simplemente se desvanecía en el borde.
  //
  // Ahora hay cinco varadas en la playa, y los que se quiebran corren HACIA
  // una de ellas en vez de rajar derecho para el frente. Desde arriba se ve
  // la diferencia: la desbandada deja de ser doscientos hombres yéndose en
  // paralelo y pasa a ser cinco chorros que convergen.
  // no se puede caminar al vacío: el borde de la barranca frena
  colisiones.push(new THREE.Box3(
    new THREE.Vector3(-ANCHO / 2, 0, Z0 - 1.2), new THREE.Vector3(ANCHO / 2, 2.4, Z0 - 0.2)));
}

// TODO EL LUGAR EN UN GRUPO, Y EL GRUPO SE DEVUELVE. No es prolijidad: es lo
// que le deja al armazón de capítulos apagar San Lorenzo entero —el convento,
// la barranca, el Paraná y la escuadra— con una línea, el día que el que juega
// elige la cordillera. Un grupo invisible no gasta una sola llamada de dibujo,
// igual que un lote vacío de la lejanía.
export function construirSanLorenzo (escena, colisiones) {
  const lugar = new THREE.Group();
  lugar.name = 'sanlorenzo';
  const horno = new Horno();
  convento(horno, colisiones);
  lugar.add(horno.cocinar(MAT()));
  barrancaYRio(lugar, colisiones);
  escena.add(lugar);
  return lugar;
}
