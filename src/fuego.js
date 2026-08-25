import * as THREE from 'three';

// Fogonazo de boca y estela del proyectil.
// Una bala de plomo no es trazadora: no se ve. Lo que sí se ve —y es enorme en
// un arma de chispa— es el chorro de pólvora ardiendo, y la perturbación que
// deja la bala al pasar. La estela se dibuja a la velocidad real: 450 m/s.

const VELOCIDAD_BALA = 450;
const LARGO_ESTELA = 14;

function texturaEstrella () {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 40);
  g.addColorStop(0.0, 'rgba(255,255,240,1)');
  g.addColorStop(0.25, 'rgba(255,224,150,0.85)');
  g.addColorStop(1.0, 'rgba(255,170,60,0)');
  x.fillStyle = g;
  x.beginPath(); x.arc(64, 64, 40, 0, Math.PI * 2); x.fill();
  // las puntas del fogonazo
  x.strokeStyle = 'rgba(255,236,190,0.8)';
  x.lineCap = 'round';
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + 0.3;
    const largo = 34 + Math.random() * 26;
    x.lineWidth = 3 + Math.random() * 5;
    x.beginPath();
    x.moveTo(64, 64);
    x.lineTo(64 + Math.cos(a) * largo, 64 + Math.sin(a) * largo);
    x.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Fuego {
  constructor (escena, camara) {
    this.escena = escena;
    this.camara = camara;

    const geoEstrella = new THREE.PlaneGeometry(1, 1);
    this.matEstrella = new THREE.MeshBasicMaterial({
      map: texturaEstrella(), transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false
    });

    // chorro angosto: de costado es una lengua de fuego, de atrás casi no se ve
    const geoLlama = new THREE.ConeGeometry(0.06, 0.7, 8, 1, true);
    geoLlama.rotateX(-Math.PI / 2);
    geoLlama.translate(0, 0, -0.35);
    this.matLlama = new THREE.MeshBasicMaterial({
      color: 0xffd489, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
    });

    const geoEstela = new THREE.CylinderGeometry(0.011, 0.003, 1, 5, 1, true);
    geoEstela.rotateX(-Math.PI / 2);
    geoEstela.translate(0, 0, -0.5);
    this.matEstela = new THREE.MeshBasicMaterial({
      color: 0xdfe6ee, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false
    });

    this.llamas = [];
    this.estelas = [];
    for (let i = 0; i < 6; i++) {
      const l = new THREE.Mesh(geoLlama, this.matLlama.clone());
      l.visible = false; l.frustumCulled = false; l.renderOrder = 3;
      escena.add(l);
      const est = new THREE.Mesh(geoEstrella, this.matEstrella.clone());
      est.visible = false; est.frustumCulled = false; est.renderOrder = 4;
      escena.add(est);
      this.llamas.push({ malla: l, estrella: est, t: -1 });

      const e = new THREE.Mesh(geoEstela, this.matEstela.clone());
      e.visible = false; e.frustumCulled = false; e.renderOrder = 3;
      escena.add(e);
      this.estelas.push({ malla: e, t: -1, origen: new THREE.Vector3(), dir: new THREE.Vector3(), alcance: 100 });
    }
    this._q = new THREE.Quaternion();
    this._z = new THREE.Vector3(0, 0, -1);
  }

  disparo (origen, dir, alcance) {
    const l = this.llamas.find(x => x.t < 0) || this.llamas[0];
    l.t = 0;
    l.malla.visible = true;
    l.malla.position.copy(origen);
    l.malla.quaternion.setFromUnitVectors(this._z, dir);
    l.malla.material.opacity = 1;
    const escala = 0.85 + Math.random() * 0.4;
    l.malla.scale.set(escala, escala, escala * (1 + Math.random() * 0.5));
    l.malla.rotateZ(Math.random() * Math.PI);

    l.estrella.visible = true;
    l.estrella.position.copy(origen).addScaledVector(dir, 0.06);
    l.estrella.material.opacity = 1;
    l.estrella.scale.setScalar(0.26 + Math.random() * 0.12);
    l.estrella.material.rotation = Math.random() * Math.PI;

    const e = this.estelas.find(x => x.t < 0) || this.estelas[0];
    e.t = 0;
    e.origen.copy(origen);
    e.dir.copy(dir);
    e.alcance = Math.min(alcance || 140, 140);
    e.malla.visible = true;
    e.malla.quaternion.setFromUnitVectors(this._z, dir);
  }

  actualizar (dt) {
    for (const l of this.llamas) {
      if (l.t < 0) continue;
      l.t += dt;
      // el fogonazo dura lo que dura: cuatro centésimas
      const u = l.t / 0.05;
      if (u >= 1) { l.t = -1; l.malla.visible = false; l.estrella.visible = false; continue; }
      l.malla.material.opacity = (1 - u) * 0.95;
      l.malla.scale.z = (1 + u * 0.6) * 1.2;
      // la estrella siempre de frente a la cámara: el fogonazo se ve desde donde sea
      l.estrella.quaternion.copy(this.camara.quaternion);
      l.estrella.material.opacity = Math.pow(1 - u, 1.6);
      l.estrella.scale.setScalar(0.3 + u * 0.34);
    }

    for (const e of this.estelas) {
      if (e.t < 0) continue;
      e.t += dt;
      const cabeza = e.t * VELOCIDAD_BALA;
      const vida = e.alcance / VELOCIDAD_BALA + 0.09;
      if (e.t > vida) { e.t = -1; e.malla.visible = false; continue; }

      const frente = Math.min(cabeza, e.alcance);
      const cola = Math.max(0, frente - LARGO_ESTELA);
      const largo = frente - cola;
      if (largo <= 0.01) { e.malla.visible = false; continue; }
      e.malla.visible = true;
      e.malla.position.copy(e.origen).addScaledVector(e.dir, frente);
      e.malla.scale.set(1, 1, largo);
      // se ve un instante y se apaga
      const desvanece = cabeza >= e.alcance ? Math.max(0, 1 - (e.t - e.alcance / VELOCIDAD_BALA) / 0.09) : 1;
      e.malla.material.opacity = 0.34 * desvanece;
    }
  }
}
