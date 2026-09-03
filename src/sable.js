import * as THREE from 'three';
import { PALETA } from './mundo.js';
import { brazoLibre } from './armas-modelos.js';

// Sable corvo de San Martín: hoja de curva profunda, guarda en cruz con
// perillas en las puntas y pomo en gancho. Sin guardamano de canasta — el
// original no lo tiene.

// La hoja se genera barriendo una sección en rombo a lo largo de un arco:
// el lomo va por el lado cóncavo y el filo por el convexo, como corresponde.
function geometriaHoja ({ largo = 0.82, curva = 0.95, anchoBase = 0.056,
  grosor = 0.017, pasos = 26 } = {}) {
  const R = largo / curva;
  const pos = [];
  const idx = [];

  for (let i = 0; i <= pasos; i++) {
    const t = i / pasos;
    const a = curva * t;
    // punto sobre el arco
    const p = new THREE.Vector3(0, R - R * Math.cos(a), -R * Math.sin(a));
    const n = new THREE.Vector3(0, Math.cos(a), Math.sin(a));   // hacia el lomo
    const b = new THREE.Vector3(1, 0, 0);                        // espesor

    // EL ANCHO NO SE AFINA PAREJO. Antes iba de 4,4 cm en la guarda a 1 cm en
    // la punta, y con eso la hoja se ve como un alambre: a mitad de camino ya
    // no queda nada que mirar. Un sable de caballería mantiene el ancho casi
    // hasta el final —hasta se ENSANCHA en la panza, que es donde corta— y
    // recién en los últimos centímetros cierra en punta. Esa panza es lo que
    // le da cuerpo a la silueta cuando cruza la pantalla.
    const perfil = t < 0.86
      ? 1 - 0.20 * t + 0.16 * t * t          // apenas afina, y engorda en la panza
      : (1 - (t - 0.86) / 0.14) * 0.96;      // la punta, corta
    const w = anchoBase * Math.max(0.04, perfil) * 0.5;
    // el lomo tampoco se afina tanto: es la parte que se ve de canto
    const g = grosor * (1 - 0.42 * t) * 0.5;

    const anillo = [
      p.clone().addScaledVector(n, w),        // lomo
      p.clone().addScaledVector(b, g),        // flanco
      p.clone().addScaledVector(n, -w),       // filo
      p.clone().addScaledVector(b, -g)        // flanco
    ];
    for (const v of anillo) pos.push(v.x, v.y, v.z);
  }

  for (let i = 0; i < pasos; i++) {
    const a0 = i * 4, a1 = (i + 1) * 4;
    for (let k = 0; k < 4; k++) {
      const k2 = (k + 1) % 4;
      idx.push(a0 + k, a1 + k, a1 + k2);
      idx.push(a0 + k, a1 + k2, a0 + k2);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

// El duelo en tres números. La ventana de parada es lo único que no se toca
// sin volver a probarlo: 180 ms es lo que separa "leí el golpe" de "aposté".
export const VENTANA_PARADA = 0.18;
export const VENTANA_REMATE = 0.95;

// DESDE LA SILLA EL CORVO VA MÁS RÁPIDO. No es un número de pelea —el daño no
// cambia, el que cambia es el reloj de la animación— y por eso vive acá y no en
// balance.js. El motivo es de mano: a pie el duelo se juega con la ventana de
// parada, con su ritmo de leer y responder; a caballo no hay duelo, hay
// pasada, y encadenar dos tajos antes de salirte del alcance tiene que poder
// hacerse. Con medio segundo por tajo, al galope te alcanzaba para uno.
const DESDE_LA_SILLA = 0.62;

// Guardia: la hoja cruzada arriba a la izquierda, de plano contra la cámara y
// lejos del ojo. Los ángulos NO son a ojo — salen de alinear la dirección de la
// hoja (0, 0.457, −0.889 en el espacio del sable) con (−0.45, 0.88, −0.15) y su
// cara plana con la cámara. Si se toca la geometría de la hoja, hay que rehacer
// la cuenta, no tantear.
const POSE_GUARDIA = { p: [0.42, -0.42, -1.00], r: [1.437, -0.007, 1.639] };

export class Sable {
  constructor (camaraArma, sonido) {
    this.camara = camaraArma;
    this.sonido = sonido;
    this.guardado = true;
    this.t = -1;
    this.duracion = 0.5;
    this.golpeo = false;
    this.alGolpear = null;

    const g = new THREE.Group();
    const acero = new THREE.MeshStandardMaterial({ color: 0xcdd2d8, roughness: 0.22, metalness: 0.96 });
    const laton = new THREE.MeshStandardMaterial({ color: PALETA.bronce, roughness: 0.34, metalness: 0.92 });
    const cuero = new THREE.MeshStandardMaterial({ color: 0x2e2620, roughness: 0.9 });
    const guante = new THREE.MeshStandardMaterial({ color: 0xb9ac93, roughness: 0.95 });

    // hoja: nace en la guarda y se curva hacia adelante
    const hoja = new THREE.Mesh(geometriaHoja(), acero);
    hoja.position.set(0, 0, -0.06);
    g.add(hoja);

    // guarda en cruz: barrote recto con perillas en las puntas
    const cruz = new THREE.Mesh(new THREE.BoxGeometry(0.155, 0.014, 0.018), laton);
    cruz.position.set(0, 0, -0.05);
    g.add(cruz);
    for (const s of [-1, 1]) {
      const perilla = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), laton);
      perilla.position.set(s * 0.079, 0, -0.05);
      g.add(perilla);
    }
    // gavilán corto sobre la hoja
    const langet = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.01, 0.05), laton);
    langet.position.set(0, 0.004, -0.078);
    g.add(langet);

    // empuñadura de cuero con virolas
    const puno = new THREE.Mesh(new THREE.CylinderGeometry(0.0155, 0.018, 0.105, 10), cuero);
    puno.rotation.x = Math.PI / 2;
    puno.position.set(0, 0.004, 0.005);
    g.add(puno);
    for (const z of [-0.04, 0.052]) {
      const virola = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.019, 0.011, 10), laton);
      virola.rotation.x = Math.PI / 2;
      virola.position.set(0, 0.004, z);
      g.add(virola);
    }

    // pomo en gancho, la firma del sable corvo
    const gancho = new THREE.Mesh(new THREE.TorusGeometry(0.021, 0.0085, 6, 10, Math.PI * 1.15), laton);
    gancho.rotation.set(0, Math.PI / 2, -0.5);
    gancho.position.set(0, 0.022, 0.062);
    g.add(gancho);

    const mano = new THREE.Mesh(new THREE.BoxGeometry(0.062, 0.082, 0.105), guante);
    mano.position.set(0, 0.002, 0.005);
    g.add(mano);

    g.scale.setScalar(0.78);
    g.position.set(0.22, -0.12, -0.58);
    g.rotation.set(0.02, -0.42, 0.26);
    g.traverse(o => { o.frustumCulled = false; });
    g.visible = false;
    camaraArma.add(g);
    this.grupo = g;
    this.reposo = { p: g.position.clone(), r: g.rotation.clone() };

    // El brazo no cuelga del sable: va aparte y siempre une la muñeca con el
    // hombro. Si fuera hijo del sable, al tirar el tajo el brazo giraría con
    // la hoja y quedaría cortado en el aire.
    this.brazo = brazoLibre(0.062);
    this.brazo.visible = false;
    camaraArma.add(this.brazo);
    this.hombro = new THREE.Vector3(0.2, -0.62, 0.26);
    this._mano = new THREE.Vector3();
    this.manoLocal = new THREE.Vector3(0, -0.02, 0.06);

    this.zurdo = false;      // los tajos alternan de lado, como el cuchillo del Counter

    // duelo
    this.guardia = false;
    this.tGuardia = 0;       // desde que se alzó: si es poco, la parada es perfecta
    this.tRemate = 0;        // ventana abierta para el remate
    this.tParada = -1;       // animación del choque
    this.perfecta = false;
    this.remate = false;
  }

  alzarGuardia () {
    if (this.guardado || this.guardia || this.t >= 0) return false;
    this.guardia = true;
    this.tGuardia = 0;
    return true;
  }

  bajarGuardia () { this.guardia = false; }

  // Llega un golpe. Devuelve 'perfecta', 'bloqueo' o false si estabas abierto.
  // La perfecta no cuesta aliento y abre la ventana del remate.
  recibir () {
    if (!this.guardia || this.guardado) return false;
    this.perfecta = this.tGuardia <= VENTANA_PARADA;
    this.tParada = 0;
    if (this.perfecta) this.tRemate = VENTANA_REMATE;
    return this.perfecta ? 'perfecta' : 'bloqueo';
  }

  _acomodarBrazo () {
    // hay que refrescar la matriz: si no, el brazo va un cuadro atrás del
    // sable y en pleno tajo se ve despegado de la mano
    this.grupo.updateWorldMatrix(true, false);
    this._mano.copy(this.manoLocal).applyMatrix4(this.grupo.matrixWorld);
    this.brazo.position.copy(this._mano);
    this.brazo.lookAt(this.hombro);
    this.brazo.scale.z = Math.max(0.25, this._mano.distanceTo(this.hombro));
  }

  sacar () { this.guardado = false; this.grupo.visible = true; this.brazo.visible = true; }
  guardar () {
    this.guardado = true; this.grupo.visible = false; this.brazo.visible = false;
    this.t = -1; this.guardia = false; this.tRemate = 0; this.tParada = -1;
  }

  // Devuelve true si salió el remate. El remate sólo existe si venís de una
  // parada perfecta: es más lento y más ancho, y se ve que es otra cosa.
  tajo (montado) {
    if (this.guardado || this.t >= 0) return false;
    this.remate = this.tRemate > 0;
    this.t = 0;
    this.golpeo = false;
    this.guardia = false;
    if (this.remate) {
      this.tRemate = 0;
      this.duracion = 0.60;
    } else {
      this.zurdo = !this.zurdo;      // un tajo va de ida y el siguiente de vuelta
      this.duracion = this.zurdo ? 0.46 : 0.52;
    }
    // DESDE LA SILLA SE PEGA HACIA ABAJO, y eso hay que recordarlo hasta que
    // termine el tajo: la animación lo lee cada cuadro.
    this.montado = !!montado;
    if (montado) this.duracion *= DESDE_LA_SILLA;
    this.sonido.sable();
    return this.remate;
  }

  actualizar (dt) {
    if (this.guardado) return;
    const k = 1 - Math.exp(-14 * dt);
    if (this.guardia) this.tGuardia += dt;
    if (this.tRemate > 0) this.tRemate = Math.max(0, this.tRemate - dt);
    if (this.tParada >= 0) this.tParada += dt;

    if (this.t >= 0) {
      this.t += dt;
      const u = this.t / this.duracion;
      if (u < 1) {
        // DOS RELOJES, Y AHÍ ESTÁ TODO EL ASUNTO.
        //
        //   `e` es el ENVIÓN: va y vuelve, y es lo que saca la hoja del cuerpo
        //       y la trae de nuevo. Un seno.
        //   `d` es la CAÍDA: sólo avanza, de 0 a 1, y NO vuelve.
        //
        // Con el envión solo —que es lo que había— el sable sale, cruza y
        // vuelve exactamente por donde vino: en la pantalla eso es una raya
        // horizontal, y es justo lo que no hace un sable. Un tajo EMPIEZA
        // arriba y TERMINA abajo, y esa asimetría no se puede sacar de una
        // función que es simétrica. La caída la pone `d`, y la vuelta al
        // reposo la hace el amortiguado de abajo cuando el tajo terminó.
        const e = Math.sin(Math.min(1, u * 1.15) * Math.PI);
        const d = Math.min(1, u * 1.25);
        // DESDE LA SILLA SE PEGA HACIA ABAJO. Estás dos metros por encima del
        // que tenés adelante: el revés que a pie sale hacia arriba, montado no
        // existe —no hay nada ahí arriba a lo que pegarle—. Los dos tajos
        // bajan, y bajan más.
        const silla = this.montado ? 1 : 0;
        // LA CAÍDA ES DE MUÑECA, NO DE HOMBRO, y el signo salió de la cuenta.
        //
        // El primer intento bajaba la MANO cuarenta centímetros: con el hombro
        // detrás de la cámara, una mano tan baja tira el brazo contra el ojo y
        // lo único que se ve es la manga por dentro. Un sablazo tampoco baja la
        // mano: la muñeca se queda donde está y lo que cae es LA HOJA.
        //
        // Y el segundo intento la hacía SUBIR. Este archivo ya avisaba arriba
        // que estos ángulos no se tantean —tres rotaciones compuestas no se
        // adivinan— así que se calculó: se toma la dirección de la hoja en su
        // propio espacio, (0, 0,457, −0,889), se le aplica el Euler y se mira
        // adónde apunta la punta. Con `+d` la punta terminaba mirando al cielo;
        // con `−d` termina mirando al piso, que era todo el asunto.
        //
        // Adónde apunta la punta al terminar, medido:
        //
        //                   a pie        montado
        //   tajo            0,38 abajo   0,76 abajo
        //   revés           0,90 arriba  0,86 abajo
        //   remate          0,47 abajo   0,82 abajo
        //
        // El revés es el único que a pie SUBE, y es a propósito: dos tajos
        // seguidos que caen igual son el mismo tajo dos veces. Montado no sube
        // ninguno, porque arriba del caballo no hay nadie a quien pegarle
        // arriba: los dos caen, y caen más.
        if (this.remate) {
          this.grupo.position.set(0.22 - e * 0.5,
            -0.12 + e * 0.32 - d * (0.16 + silla * 0.10),
            -0.58 - e * 0.16 - d * 0.10);
          this.grupo.rotation.set(0.02 - e * 1.15 - d * (1.00 + silla * 0.50),
            -0.42 + e * 1.05, 0.26 + e * 2.25);
        } else if (this.zurdo) {
          this.grupo.position.set(0.22 - e * 0.4,
            -0.14 - e * 0.14 + d * (0.14 - silla * 0.30),
            -0.58 - e * 0.1 - d * 0.06);
          this.grupo.rotation.set(0.02 + e * 0.6 + d * (0.70 - silla * 3.40),
            -0.42 - e * 1.1, 0.26 - e * 1.5);
        } else {
          this.grupo.position.set(0.22 - e * 0.46,
            -0.12 + e * 0.24 - d * (0.14 + silla * 0.12),
            -0.58 - e * 0.06 - d * 0.09);
          this.grupo.rotation.set(0.02 - e * 0.45 - d * (0.90 + silla * 0.85),
            -0.42 + e * 1.35, 0.26 + e * 1.85);
        }
        if (!this.golpeo && u > (this.remate ? 0.34 : 0.3) && u < 0.62) {
          this.golpeo = true;
          if (this.alGolpear) this.alGolpear();
        }
        this._acomodarBrazo();
        return;
      }
      this.t = -1;
      this.remate = false;
    }

    // choque de aceros: el sable salta hacia afuera, más si fue perfecta
    if (this.tParada >= 0 && this.tParada < 0.22) {
      const e = Math.sin((this.tParada / 0.22) * Math.PI) * (this.perfecta ? 1 : 0.55);
      const b = POSE_GUARDIA;
      this.grupo.position.set(b.p[0] - e * 0.15, b.p[1] + e * 0.09, b.p[2] + e * 0.05);
      this.grupo.rotation.set(b.r[0] + e * 0.30, b.r[1] - e * 0.50, b.r[2] + e * 0.65);
      this._acomodarBrazo();
      return;
    }
    if (this.tParada >= 0.22) this.tParada = -1;

    if (this.guardia) {
      // en guardia: la hoja cruzada delante de la cara, tapando el frente
      const g = this.grupo;
      g.position.lerp(this._vg || (this._vg = new THREE.Vector3(...POSE_GUARDIA.p)), 1 - Math.exp(-24 * dt));
      const kg = 1 - Math.exp(-24 * dt);
      g.rotation.x += (POSE_GUARDIA.r[0] - g.rotation.x) * kg;
      g.rotation.y += (POSE_GUARDIA.r[1] - g.rotation.y) * kg;
      g.rotation.z += (POSE_GUARDIA.r[2] - g.rotation.z) * kg;
      this._acomodarBrazo();
      return;
    }

    this.grupo.position.lerp(this.reposo.p, k);
    this.grupo.rotation.x += (this.reposo.r.x - this.grupo.rotation.x) * k;
    this.grupo.rotation.y += (this.reposo.r.y - this.grupo.rotation.y) * k;
    this.grupo.rotation.z += (this.reposo.r.z - this.grupo.rotation.z) * k;
    this._acomodarBrazo();
  }
}
