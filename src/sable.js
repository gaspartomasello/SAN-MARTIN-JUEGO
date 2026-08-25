import * as THREE from 'three';
import { PALETA } from './mundo.js';
import { brazoLibre } from './armas.js';

// Sable corvo de San Martín: hoja de curva profunda, guarda en cruz con
// perillas en las puntas y pomo en gancho. Sin guardamano de canasta — el
// original no lo tiene.

// La hoja se genera barriendo una sección en rombo a lo largo de un arco:
// el lomo va por el lado cóncavo y el filo por el convexo, como corresponde.
function geometriaHoja ({ largo = 0.82, curva = 0.95, anchoBase = 0.044,
  anchoPunta = 0.010, grosor = 0.012, pasos = 26 } = {}) {
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

    const w = THREE.MathUtils.lerp(anchoBase, anchoPunta, Math.pow(t, 0.75)) * 0.5;
    const g = grosor * (1 - 0.62 * t) * 0.5;

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
  guardar () { this.guardado = true; this.grupo.visible = false; this.brazo.visible = false; this.t = -1; }

  tajo () {
    if (this.guardado || this.t >= 0) return;
    this.t = 0;
    this.golpeo = false;
    this.zurdo = !this.zurdo;        // un tajo va de ida y el siguiente de vuelta
    this.duracion = this.zurdo ? 0.46 : 0.52;
    this.sonido.sable();
  }

  actualizar (dt) {
    if (this.guardado) return;
    const k = 1 - Math.exp(-14 * dt);
    if (this.t >= 0) {
      this.t += dt;
      const u = this.t / this.duracion;
      if (u < 1) {
        const e = Math.sin(Math.min(1, u * 1.15) * Math.PI);
        if (this.zurdo) {
          // revés: entra de abajo a la izquierda y sale arriba a la derecha
          this.grupo.position.set(0.22 - e * 0.4, -0.14 - e * 0.04, -0.58 - e * 0.1);
          this.grupo.rotation.set(0.02 + e * 0.6, -0.42 - e * 1.1, 0.26 - e * 1.5);
        } else {
          // tajo: de arriba a la derecha hacia abajo a la izquierda
          this.grupo.position.set(0.22 - e * 0.46, -0.12 + e * 0.1, -0.58 - e * 0.06);
          this.grupo.rotation.set(0.02 - e * 0.45, -0.42 + e * 1.35, 0.26 + e * 1.85);
        }
        if (!this.golpeo && u > 0.3 && u < 0.58) {
          this.golpeo = true;
          if (this.alGolpear) this.alGolpear();
        }
        this._acomodarBrazo();
        return;
      }
      this.t = -1;
    }
    this.grupo.position.lerp(this.reposo.p, k);
    this.grupo.rotation.x += (this.reposo.r.x - this.grupo.rotation.x) * k;
    this.grupo.rotation.y += (this.reposo.r.y - this.grupo.rotation.y) * k;
    this.grupo.rotation.z += (this.reposo.r.z - this.grupo.rotation.z) * k;
    this._acomodarBrazo();
  }
}
