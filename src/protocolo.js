// ===========================================================================
// EL PROTOCOLO · qué se manda por el cable, byte por byte
// ===========================================================================
//
// Este archivo no sabe jugar. Sabe traducir el campo de batalla a un chorro de
// bytes y volver a armarlo del otro lado. Es la hoja del árbol: no importa
// nada del proyecto, igual que balance.js.
//
// SON DOS FORMATOS, Y ESO ES A PROPÓSITO.
//
//   · EL MUNDO va en BINARIO. Trescientos setenta hombres y ochenta caballos,
//     veinte veces por segundo. En JSON eso son cuarenta mil caracteres por
//     paquete, ochocientos kilobytes por segundo y un recolector de basura
//     trabajando todo el tiempo. En binario son cinco kilobytes por paquete y
//     cien por segundo: ciento sesenta veces menos, y sin basura.
//
//   · TODO LO DEMÁS va en JSON. Nacimientos, muertes, disparos, avisos,
//     lo que hace el compañero. Son pocos y espaciados, y en JSON se leen con
//     los ojos cuando algo anda mal. Optimizar eso sería cambiar claridad por
//     nada.
//
// La regla para saber cuál es cuál está en el navegador: un mensaje de texto
// es JSON, uno binario es el mundo. No hace falta ningún byte de aviso.
//
// LA PRECISIÓN. Las posiciones van en centímetros dentro de un entero de dos
// bytes: alcanza para ±327 m y el campo de San Lorenzo mide poco más de cien
// de punta a punta. Los ángulos, en 1/65536 de vuelta —cinco milésimas de
// grado—. Nadie va a ver la diferencia y entran en la mitad de lugar.

// El orden de esta lista ES el protocolo: se manda el índice, no el nombre.
// Si se agrega una pose nueva a figura.js, va AL FINAL de esta lista. Cambiar
// el orden rompe la compatibilidad entre las dos máquinas.
export const POSES_RED = [
  'marcha', 'correr', 'apuntar', 'recargar', 'guardia', 'cargar',
  'aturdido', 'enristre', 'lanzaAviso', 'lanzazo', 'lanzaAlto', 'estocada'
];
const INDICE_POSE = new Map(POSES_RED.map((n, i) => [n, i]));
export const poseANumero = n => INDICE_POSE.get(n) ?? 0;
export const numeroAPose = i => POSES_RED[i] || 'marcha';

// tamaño de cada bloque, en bytes
const CABEZA = 10;
const SOLDADO = 14;
const CABALLO = 14;
const CANON = 6;

// banderas del soldado
export const B_VIVO = 1;
export const B_MONTADO = 2;
export const B_RODILLA = 4;
export const B_ANDANDO = 8;
export const B_LANCERO = 16;
export const B_CUBIERTO = 32;
export const B_LEJOS = 64;
// el último bit que quedaba libre del byte, y le tocó al que se está yendo:
// del otro lado de la red hay que poder ver quebrarse la línea
export const B_QUEBRADO = 128;
// banderas de la pieza
export const C_VIVO = 1;
export const C_CEBANDO = 2;

const VUELTA = 65536 / (Math.PI * 2);
const cm = m => Math.max(-32768, Math.min(32767, Math.round(m * 100)));
const aMetros = c => c / 100;
const ang = r => Math.round(((r % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) * VUELTA) & 0xffff;
const aRad = u => u / VUELTA;

// ---------------------------------------------------------------------------
// EL MUNDO, DE IDA
// ---------------------------------------------------------------------------
//
// Recibe listas ya preparadas por red.js —no toca objetos del juego— y
// devuelve un ArrayBuffer listo para mandar.
export function empaquetarMundo (sello, hombres, bestias, piezas) {
  const n = CABEZA + hombres.length * SOLDADO + bestias.length * CABALLO + piezas.length * CANON;
  const buf = new ArrayBuffer(n);
  const v = new DataView(buf);
  let i = 0;
  v.setUint8(i, 1); i += 1;                       // versión del formato
  v.setUint8(i, 0); i += 1;                       // relleno, para que todo quede par
  v.setUint32(i, sello >>> 0, true); i += 4;
  v.setUint16(i, hombres.length, true); i += 2;
  v.setUint16(i, bestias.length, true); i += 2;
  // las piezas se cuentan solas: lo que sobra al final son ellas

  for (const h of hombres) {
    v.setUint16(i, h.id, true); i += 2;
    v.setInt16(i, cm(h.x), true); i += 2;
    v.setInt16(i, cm(h.y), true); i += 2;
    v.setInt16(i, cm(h.z), true); i += 2;
    v.setUint16(i, ang(h.rumbo), true); i += 2;
    v.setUint8(i, h.pose); i += 1;
    v.setUint8(i, h.banderas); i += 1;
    v.setUint8(i, Math.max(0, Math.min(255, h.vida))); i += 1;
    v.setUint8(i, Math.round(Math.max(0, Math.min(1, h.caida)) * 255)); i += 1;
  }
  for (const b of bestias) {
    v.setUint16(i, b.id, true); i += 2;
    v.setInt16(i, cm(b.x), true); i += 2;
    v.setInt16(i, cm(b.alto), true); i += 2;
    v.setInt16(i, cm(b.z), true); i += 2;
    v.setUint16(i, ang(b.rumbo), true); i += 2;
    v.setUint8(i, b.banderas); i += 1;
    v.setUint8(i, Math.max(0, Math.min(255, Math.round(b.vel * 10)))); i += 1;
    v.setUint8(i, Math.round((((b.paso % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2) * 255)); i += 1;
    v.setUint8(i, Math.round(Math.max(0, Math.min(1, b.caida)) * 255)); i += 1;
  }
  for (const p of piezas) {
    v.setUint16(i, p.id, true); i += 2;
    v.setUint16(i, ang(p.rumbo), true); i += 2;
    v.setUint8(i, p.banderas); i += 1;
    v.setUint8(i, Math.max(0, Math.min(255, p.vida))); i += 1;
  }
  return buf;
}

// ---------------------------------------------------------------------------
// EL MUNDO, DE VUELTA
// ---------------------------------------------------------------------------
export function desempaquetarMundo (buf) {
  const v = new DataView(buf);
  if (v.getUint8(0) !== 1) return null;           // otro formato: se ignora
  let i = 2;
  const sello = v.getUint32(i, true); i += 4;
  const nH = v.getUint16(i, true); i += 2;
  const nB = v.getUint16(i, true); i += 2;
  const hombres = new Array(nH);
  const bestias = new Array(nB);
  for (let k = 0; k < nH; k++) {
    hombres[k] = {
      id: v.getUint16(i, true),
      x: aMetros(v.getInt16(i + 2, true)),
      y: aMetros(v.getInt16(i + 4, true)),
      z: aMetros(v.getInt16(i + 6, true)),
      rumbo: aRad(v.getUint16(i + 8, true)),
      pose: v.getUint8(i + 10),
      banderas: v.getUint8(i + 11),
      vida: v.getUint8(i + 12),
      caida: v.getUint8(i + 13) / 255
    };
    i += SOLDADO;
  }
  for (let k = 0; k < nB; k++) {
    bestias[k] = {
      id: v.getUint16(i, true),
      x: aMetros(v.getInt16(i + 2, true)),
      alto: aMetros(v.getInt16(i + 4, true)),
      z: aMetros(v.getInt16(i + 6, true)),
      rumbo: aRad(v.getUint16(i + 8, true)),
      banderas: v.getUint8(i + 10),
      vel: v.getUint8(i + 11) / 10,
      paso: v.getUint8(i + 12) / 255 * Math.PI * 2,
      caida: v.getUint8(i + 13) / 255
    };
    i += CABALLO;
  }
  const piezas = [];
  while (i + CANON <= buf.byteLength) {
    piezas.push({
      id: v.getUint16(i, true),
      rumbo: aRad(v.getUint16(i + 2, true)),
      banderas: v.getUint8(i + 4),
      vida: v.getUint8(i + 5)
    });
    i += CANON;
  }
  return { sello, hombres, bestias, piezas };
}

// El tamaño que va a tener un parte, sin armarlo. Para las mediciones.
export function pesoDelParte (nH, nB, nC) {
  return CABEZA + nH * SOLDADO + nB * CABALLO + nC * CANON;
}
