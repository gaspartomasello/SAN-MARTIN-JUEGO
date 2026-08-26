import * as THREE from 'three';
import { Figura } from './figura.js';
import { Caballo } from './caballo.js';

// LEJANÍA — los hombres que están lejos.
//
// El problema, medido: un granadero articulado cuesta quince mallas y un
// caballo nueve. Noventa lanceros son 2.267 llamadas de dibujo y el
// presupuesto del juego son 120. Con eso, la pinza de San Martín —dos
// columnas de sesenta— no entra. No es una cuestión de afinar: falta un
// orden de magnitud.
//
// Y la respuesta es vieja y es obvia en cuanto se la mira de frente: UN
// HOMBRE A CUARENTA METROS NO NECESITA QUINCE MALLAS ARTICULADAS. Ocupa
// veinte píxeles de alto. No se le ve la cara, no se le ven los botones, y
// del codo sólo se ve que el brazo está o no está. Lo único que se lee a esa
// distancia es la silueta, el color de la casaca, hacia dónde mira y si se
// mueve.
//
// Así que a partir de cierta distancia el soldado deja de ser un esqueleto y
// pasa a ser UNA INSTANCIA: una geometría horneada de antemano, compartida
// por todos los que están en esa misma postura, dibujada de una sola vez para
// los ciento veinte. Ciento veinte granaderos lejanos cuestan lo mismo que
// uno: una llamada por postura.
//
// Lo que se paga a cambio:
//   · la pose se congela en un puñado de fotogramas horneados. El paso se
//     anima alternando dos de ellos, que es exactamente como caminaban los
//     soldados de los juegos de hace treinta años, y a esa distancia
//     funciona igual de bien.
//   · se pierde la tez sorteada y el metal brillante. A cuarenta metros la
//     cara es un píxel; la casaca, que es lo que distingue un bando del
//     otro, se conserva entera.
//   · se tiran los triángulos más chicos que un píxel (ojos, botones,
//     hebillas, bigote). Van igual en la malla de cerca.
//
// Y lo que se gana además del dibujo: el que está lejos tampoco resuelve
// cinemática inversa. La IA sigue corriendo entera —camina, apunta, dispara,
// muere—, pero el cuerpo no se arma. Eso es la mitad del costo de simulación
// de un soldado.

// Un solo material para todo lo lejano: sin brillo metálico, que a esta
// distancia sólo produce parpadeo.
export const LEJOS = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, metalness: 0.10 });

// Triángulo más chico que esto, a la basura. 30 cm² es un cuadrado de 5,5 cm:
// a cuarenta metros, con este campo de visión, menos de un píxel.
const MIGAJA = 0.0012;

// ------------------------------------------------------------- el horneado

// Funde un árbol de mallas articuladas en una sola geometría, con las
// matrices de los huesos ya aplicadas y el color en los vértices.
function hornear (raices) {
  const pos = [], nor = [], col = [];
  const m = new THREE.Matrix4(), nm = new THREE.Matrix3();
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const ab = new THREE.Vector3(), ac = new THREE.Vector3(), cr = new THREE.Vector3();
  const n0 = new THREE.Vector3();
  let crudos = 0;

  for (const raiz of raices) {
    raiz.updateMatrixWorld(true);
    raiz.traverse(o => {
      if (!o.isMesh || !o.visible) return;
      m.copy(o.matrixWorld);
      nm.getNormalMatrix(m);
      const g = o.geometry;
      const ap = g.attributes.position, an = g.attributes.normal, ax = g.attributes.color;
      for (let i = 0; i + 2 < ap.count; i += 3) {
        crudos++;
        a.fromBufferAttribute(ap, i).applyMatrix4(m);
        b.fromBufferAttribute(ap, i + 1).applyMatrix4(m);
        c.fromBufferAttribute(ap, i + 2).applyMatrix4(m);
        const area = cr.crossVectors(ab.subVectors(b, a), ac.subVectors(c, a)).length() * 0.5;
        if (area < MIGAJA) continue;
        for (const [v, k] of [[a, i], [b, i + 1], [c, i + 2]]) {
          pos.push(v.x, v.y, v.z);
          n0.fromBufferAttribute(an, k).applyMatrix3(nm).normalize();
          nor.push(n0.x, n0.y, n0.z);
          if (ax) col.push(ax.getX(k), ax.getY(k), ax.getZ(k));
          else col.push(1, 1, 1);
        }
      }
    });
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeBoundingSphere();
  geo.userData.crudos = crudos;
  return geo;
}

// Lleva una figura a una pose y la deja quieta ahí. El lerp de actualizar()
// tarda en converger, así que se lo hace correr en seco hasta que llega y
// recién entonces se le clava el fotograma del paso que queremos hornear.
function posar (fig, pose, { andando = false, ritmo = 1, paso = 0, montura = false } = {}) {
  fig.montura = montura;
  fig.poner(pose);
  for (let i = 0; i < 120; i++) fig.actualizar(1 / 60, andando, ritmo);
  fig.paso = paso;
  fig.actualizar(1e-5, andando, ritmo);
  fig.raiz.scale.set(1, 1, 1);        // la estatura la pone la instancia
  return fig;
}

function posarCaballo (c, { vel = 0, paso = 0 } = {}) {
  c.vel = vel;
  c.paso = paso;
  c._andarPatas(1e-5);
  c.raiz.position.set(0, 0, 0);
  c.raiz.rotation.set(0, 0, 0);
  return c;
}

// ------------------------------------------------------------------ el lote

class Lote {
  constructor (escena, geo, capacidad) {
    this.malla = new THREE.InstancedMesh(geo, LEJOS, capacidad);
    // el radio de la geometría no dice nada de dónde están las instancias:
    // que las recorte el propio GPU, no el frustum de three
    this.malla.frustumCulled = false;
    this.malla.castShadow = false;    // una sombra de tres píxeles no vale una pasada de sombras
    this.malla.receiveShadow = true;
    this.malla.count = 0;
    this.malla.visible = false;
    this.capacidad = capacidad;
    this.n = 0;
    escena.add(this.malla);
  }
}

export class Lejania {
  constructor (escena, capacidad = 220) {
    this.escena = escena;
    this.capacidad = capacidad;
    this.lotes = new Map();
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler();
    this._p = new THREE.Vector3();
    this._s = new THREE.Vector3();
    this.desbordes = 0;          // instancias que no entraron: se mide, no se adivina
    this._hornearTodo();
  }

  // Cada clave es un tipo de figura; cada índice dentro de la clave, una
  // postura horneada. El que dibuja elige clave e índice.
  _hornearTodo () {
    const tacho = new THREE.Group();
    const geos = new Map();

    for (const bando of ['granadero', 'realista']) {
      const f = () => new Figura(bando, 0.5);
      const caido = f();
      posar(caido, 'marcha');
      caido.desplomar(1);          // el hundimiento de 10 cm lo pone la instancia
      // la rodilla en tierra SE HORNEA. Es el aviso de que va a disparar y se
      // tiene que leer desde donde alcanza el fusil, no desde donde se le ve
      // la cara: sesenta metros, no veinte.
      const hincado = new Figura(bando, 0.5);
      hincado.rodilla = true;
      posar(hincado, 'apuntar');
      geos.set(bando, [
        hornear([posar(f(), 'marcha').raiz]),
        hornear([posar(f(), 'marcha', { andando: true, paso: 1.35 }).raiz]),
        hornear([posar(f(), 'marcha', { andando: true, paso: 1.35 + Math.PI }).raiz]),
        hornear([caido.raiz]),
        hornear([hincado.raiz]),
        // y el que apunta PARADO. Sin esto, el que te está encarando desde
        // cincuenta metros se ve descansando, y encarar es información.
        hornear([posar(f(), 'apuntar').raiz])
      ]);
    }

    // el lancero va horneado CON el caballo: arriba de la silla el jinete no
    // se mueve por su cuenta, así que hombre y bestia son una sola instancia
    const jinete = (pose, paso, vel) => {
      const c = posarCaballo(new Caballo(tacho, [], new THREE.Vector3()), { vel, paso });
      const fig = posar(new Figura('granadero', 0.5, { arma: 'lanza' }), pose, { montura: true });
      const silla = new THREE.Group();
      silla.position.y = c.altura - 0.92;
      silla.add(fig.raiz);
      return hornear([c.raiz, silla]);
    };
    geos.set('lancero', [
      jinete('lanzaAlto', 0.9, 10.2),
      jinete('lanzaAlto', 0.9 + Math.PI, 10.2),
      jinete('enristre', 0.9, 10.2)
    ]);

    const solo = (vel, paso) => hornear([posarCaballo(new Caballo(tacho, [], new THREE.Vector3()), { vel, paso }).raiz]);
    const muerto = posarCaballo(new Caballo(tacho, [], new THREE.Vector3()), { vel: 0, paso: 0 });
    muerto.raiz.rotation.z = 1.5;
    muerto.raiz.rotation.x = 0.18;
    muerto.raiz.position.y = -0.42;
    geos.set('caballo', [solo(0, 0), solo(10.2, 0.9), solo(10.2, 0.9 + Math.PI), hornear([muerto.raiz])]);

    for (const [clave, lista] of geos) {
      this.lotes.set(clave, lista.map(g => new Lote(this.escena, g, this.capacidad)));
    }
  }

  // ---- el ciclo de cada cuadro: comenzar, poner los que estén lejos, cerrar

  comenzar () {
    for (const lista of this.lotes.values()) for (const l of lista) l.n = 0;
    this.desbordes = 0;
  }

  poner (clave, fase, x, y, z, rumbo, escala = 1) {
    const lista = this.lotes.get(clave);
    if (!lista) return false;
    const lote = lista[Math.min(lista.length - 1, Math.max(0, fase | 0))];
    if (lote.n >= lote.capacidad) { this.desbordes++; return false; }
    this._p.set(x, y, z);
    this._q.setFromEuler(this._e.set(0, rumbo, 0));
    this._s.setScalar(escala);
    lote.malla.setMatrixAt(lote.n++, this._m.compose(this._p, this._q, this._s));
    return true;
  }

  terminar () {
    for (const lista of this.lotes.values()) {
      for (const l of lista) {
        l.malla.count = l.n;
        l.malla.visible = l.n > 0;
        if (l.n > 0) l.malla.instanceMatrix.needsUpdate = true;
      }
    }
  }

  // cuentas para las pruebas de escala
  get dibujando () {
    let n = 0;
    for (const lista of this.lotes.values()) for (const l of lista) if (l.n > 0) n++;
    return n;
  }

  get instancias () {
    let n = 0;
    for (const lista of this.lotes.values()) for (const l of lista) n += l.n;
    return n;
  }
}
