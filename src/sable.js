import * as THREE from 'three';
import { PALETA } from './mundo.js';

// Sable curvo de caballería. Acá va sólo lo mínimo para probar que se puede
// abandonar la carga a mitad y resolver a acero: el duelo completo (guardia,
// parada perfecta, riposte) es la Fase 2.

export class Sable {
  constructor (camaraArma, sonido) {
    this.camara = camaraArma;
    this.sonido = sonido;
    this.guardado = true;
    this.t = -1;              // tiempo dentro del tajo
    this.duracion = 0.52;
    this.golpeo = false;
    this.alGolpear = null;

    const g = new THREE.Group();
    const acero = new THREE.MeshStandardMaterial({ color: 0xc9ced4, roughness: 0.28, metalness: 0.95 });
    const hoja = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.012, 0.78), acero);
    hoja.position.set(0, 0.02, -0.44);
    hoja.rotation.x = -0.16;
    g.add(hoja);
    const punta = new THREE.Mesh(new THREE.ConeGeometry(0.016, 0.12, 6), acero);
    punta.rotation.x = -Math.PI / 2 - 0.16;
    punta.position.set(0, 0.09, -0.86);
    g.add(punta);
    const guarda = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.007, 6, 12, Math.PI * 1.3),
      new THREE.MeshStandardMaterial({ color: PALETA.bronce, roughness: 0.35, metalness: 0.9 }));
    guarda.rotation.set(0, Math.PI / 2, 0.4);
    guarda.position.set(0, -0.01, -0.05);
    g.add(guarda);
    const puno = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.019, 0.12, 8),
      new THREE.MeshStandardMaterial({ color: 0x3b2f22, roughness: 0.9 }));
    puno.rotation.x = Math.PI / 2;
    puno.position.set(0, -0.02, 0.04);
    g.add(puno);
    const mano = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.075, 0.1),
      new THREE.MeshStandardMaterial({ color: 0xb9ac93, roughness: 0.95 }));
    mano.position.set(0, -0.02, 0.05);
    g.add(mano);
    const manga = new THREE.Mesh(new THREE.BoxGeometry(0.062, 0.08, 0.1),
      new THREE.MeshStandardMaterial({ color: PALETA.azul, roughness: 0.9 }));
    manga.position.set(0, -0.03, 0.14);
    g.add(manga);

    g.scale.setScalar(0.7);
    g.position.set(0.24, -0.22, -0.44);
    g.rotation.set(0.2, -0.3, 0.28);
    g.traverse(o => { o.frustumCulled = false; });
    g.visible = false;
    camaraArma.add(g);
    this.grupo = g;
    this.reposo = { p: g.position.clone(), r: g.rotation.clone() };
  }

  sacar () { this.guardado = false; this.grupo.visible = true; }
  guardar () { this.guardado = true; this.grupo.visible = false; this.t = -1; }

  tajo () {
    if (this.guardado || this.t >= 0) return;
    this.t = 0;
    this.golpeo = false;
    this.sonido.sable();
  }

  actualizar (dt) {
    if (this.guardado) return;
    const k = 1 - Math.exp(-14 * dt);
    if (this.t >= 0) {
      this.t += dt;
      const u = this.t / this.duracion;
      if (u >= 1) { this.t = -1; } else {
        // arco de derecha arriba a izquierda abajo
        const e = Math.sin(Math.min(1, u * 1.15) * Math.PI);
        this.grupo.position.set(0.24 - e * 0.5, -0.22 + e * 0.2, -0.44 - e * 0.16);
        this.grupo.rotation.set(0.2 - e * 0.5, -0.3 + e * 1.5, 0.28 + e * 1.9);
        if (!this.golpeo && u > 0.32 && u < 0.6) {
          this.golpeo = true;
          if (this.alGolpear) this.alGolpear();
        }
        return;
      }
    }
    this.grupo.position.lerp(this.reposo.p, k);
    this.grupo.rotation.x += (this.reposo.r.x - this.grupo.rotation.x) * k;
    this.grupo.rotation.y += (this.reposo.r.y - this.grupo.rotation.y) * k;
    this.grupo.rotation.z += (this.reposo.r.z - this.grupo.rotation.z) * k;
  }
}
