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
  // el portón: jambas de piedra y dintel
  for (const s of [-1, 1]) horno.caja(s * 3.6, 2.6, Z, 0.9, 5.2, 1.2, PIEDRA);
  horno.caja(0, 5.1, Z, 8.2, 0.8, 1.2, PIEDRA);
  horno.caja(0, 2.1, Z, 6.3, 4.2, 0.35, MADERA);

  // la iglesia, corrida a la izquierda, de espaldas al campo
  const IX = -13, IZ = Z + 11;
  horno.caja(IX, 4.4, IZ, 13, 8.8, 20, CAL);
  // techo a dos aguas: dos prismas inclinados que apoyan en el muro y se
  // juntan en la cumbrera. El techo NO llega hasta el frente: se corta contra
  // la espadaña, que es la que se ve desde el campo.
  for (const s of [-1, 1]) {
    horno.prisma(IX + s * 3.3, 10.0, IZ + 0.8, 7.4, 0.7, 18.6, s > 0 ? TEJA : TEJA_OSC, 0, s * 0.44);
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

  // colisiones: sólo las caras que importan, no las sesenta cajas
  const caja = (x0, z0, x1, z1, alto) => colisiones.push(
    new THREE.Box3(new THREE.Vector3(Math.min(x0, x1), 0, Math.min(z0, z1)),
      new THREE.Vector3(Math.max(x0, x1), alto, Math.max(z0, z1))));
  caja(-26, Z - 0.5, -7, Z + 0.5, 4.8);
  caja(7, Z - 0.5, 26, Z + 0.5, 4.8);
  caja(-19.5, Z + 1, -6.5, Z + 21, 8.8);
  caja(3, Z + 0.5, 25, Z + 15.5, 6.2);
  caja(-31.4, Z, -30.6, Z + 50, 3.4);
  caja(30.6, Z, 31.4, Z + 50, 3.4);
}

// -------------------------------------------- la barranca y el Paraná

// El suelo no sigue plano hasta el infinito: a ochenta y cinco metros se cae
// nueve metros de golpe hasta el río. Ahí desembarcaron los doscientos
// cincuenta españoles y ahí volvieron a refugiarse los dispersos.
function barrancaYRio (escena, colisiones) {
  const Z0 = Z_BARRANCA, Z1 = Z_RIO, HONDO = -9;
  const ANCHO = 260;

  const geo = new THREE.BufferGeometry();
  const v = [], n = [], c = [];
  const alto = new THREE.Color(BARRANCA), bajo = new THREE.Color(BARRANCA_BAJA);
  const cortes = 14;
  for (let i = 0; i < cortes; i++) {
    const t0 = i / cortes, t1 = (i + 1) / cortes;
    // un perfil en S: arranca suave, se desbarranca y vuelve a aplanar
    const p = t => 1 - Math.pow(Math.cos(t * Math.PI / 2), 1.6);
    const za = Z0 + (Z1 - Z0) * t0, zb = Z0 + (Z1 - Z0) * t1;
    const ya = HONDO * p(t0), yb = HONDO * p(t1);
    const x0 = -ANCHO / 2, x1 = ANCHO / 2;
    const quad = [[x0, ya, za], [x1, ya, za], [x1, yb, zb], [x0, ya, za], [x1, yb, zb], [x0, yb, zb]];
    const nx = 0, ny = Math.abs(zb - za), nz = -(yb - ya);
    const len = Math.hypot(ny, nz) || 1;
    for (const [px, py, pz] of quad) {
      v.push(px, py, pz);
      n.push(nx, ny / len, nz / len);
      const col = alto.clone().lerp(bajo, (t0 + t1) / 2);
      c.push(col.r, col.g, col.b);
    }
  }
  geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(n, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
  geo.computeBoundingSphere();
  const cuesta = new THREE.Mesh(geo, MAT());
  cuesta.receiveShadow = true;
  escena.add(cuesta);

  // el Paraná: una lámina quieta y ancha, más clara contra la niebla
  const rio = new THREE.Mesh(
    new THREE.PlaneGeometry(ANCHO * 1.6, 220),
    new THREE.MeshStandardMaterial({ color: 0x8d9a9c, roughness: 0.28, metalness: 0.18 })
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
  escena.add(h.cocinar(MAT()));

  // no se puede caminar al vacío: el borde de la barranca frena
  colisiones.push(new THREE.Box3(
    new THREE.Vector3(-ANCHO / 2, 0, Z0 - 1.2), new THREE.Vector3(ANCHO / 2, 2.4, Z0 - 0.2)));
}

export function construirSanLorenzo (escena, colisiones) {
  const horno = new Horno();
  convento(horno, colisiones);
  escena.add(horno.cocinar(MAT()));
  barrancaYRio(escena, colisiones);
}
