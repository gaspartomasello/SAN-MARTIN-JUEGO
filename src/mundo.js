import * as THREE from 'three';

// Cuartel del Retiro, amanecer. Sol rasante, pasto seco de verano, cal blanca.
// Nada de fotorrealismo: paleta corta y formas simples, como un óleo de batalla.

export const PALETA = {
  cielo: 0x9fb2c4,
  cieloBajo: 0xd8c39b,
  pasto: 0xa89a63,
  pastoOsc: 0x7d7245,
  tierra: 0x8d7c5c,
  cal: 0xe8e2d2,
  madera: 0x6b543a,
  maderaOsc: 0x4a3a28,
  azul: 0x23385e,
  carmesi: 0x8f2126,
  bronce: 0xc69b54,
  hueso: 0xe6e2d6
};

function tierraTextura () {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = '#a89a63';
  x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 5200; i++) {
    const v = Math.random();
    x.fillStyle = v < 0.4 ? 'rgba(125,114,69,.5)' : (v < 0.8 ? 'rgba(184,172,118,.4)' : 'rgba(141,124,92,.45)');
    const w = 1 + Math.random() * 3;
    x.fillRect(Math.random() * 256, Math.random() * 256, w, w * (0.4 + Math.random()));
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(40, 40);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function pastoTextura () {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d');
  x.clearRect(0, 0, 64, 64);
  for (let i = 0; i < 9; i++) {
    const bx = 6 + Math.random() * 52;
    const alto = 26 + Math.random() * 34;
    const inclina = (Math.random() - 0.5) * 18;
    const g = x.createLinearGradient(bx, 64, bx + inclina, 64 - alto);
    g.addColorStop(0, 'rgba(104,96,58,.95)');
    g.addColorStop(1, 'rgba(186,174,116,.5)');
    x.strokeStyle = g;
    x.lineWidth = 1.4 + Math.random() * 1.6;
    x.beginPath();
    x.moveTo(bx, 64);
    x.quadraticCurveTo(bx + inclina * 0.4, 64 - alto * 0.6, bx + inclina, 64 - alto);
    x.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function cieloDomo () {
  // Amanecer del 3 de febrero: naranja rasante abajo, azul limpio arriba.
  const geo = new THREE.SphereGeometry(300, 24, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uAlto: { value: new THREE.Color(0x6d92bd) },
      uMedio: { value: new THREE.Color(0xa8bccf) },
      uBajo: { value: new THREE.Color(0xe8c793) }
    },
    vertexShader: `
      varying float vAltura;
      void main () {
        vAltura = normalize(position).y;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform vec3 uAlto; uniform vec3 uMedio; uniform vec3 uBajo;
      varying float vAltura;
      void main () {
        float h = clamp(vAltura, -0.2, 1.0);
        vec3 c = h < 0.16
          ? mix(uBajo, uMedio, smoothstep(-0.2, 0.16, h))
          : mix(uMedio, uAlto, smoothstep(0.16, 0.62, h));
        gl_FragColor = vec4(c, 1.0);
      }`
  });
  const m = new THREE.Mesh(geo, mat);
  m.frustumCulled = false;
  return m;
}

function siluetaBlanco () {
  // Silueta de madera con forma de hombre: es a lo que se le tiraba de verdad.
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: PALETA.madera, roughness: 0.94 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.95, 0.09), mat);
  torso.position.y = 1.15;
  const cabeza = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.15, 0.3, 8), mat);
  cabeza.position.y = 1.78;
  const patas = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.72, 0.08), mat);
  patas.position.y = 0.36;
  const poste = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.1, 0.1),
    new THREE.MeshStandardMaterial({ color: PALETA.maderaOsc, roughness: 0.95 }));
  poste.position.set(0, 1.05, -0.09);
  [torso, cabeza, patas, poste].forEach(m => { m.castShadow = true; m.receiveShadow = true; g.add(m); });
  g.userData.blanco = true;
  return g;
}

// Sin mapa de entorno, un material metálico no tiene nada que reflejar y sale
// negro. Este es el cielo del amanecer reducido a una tira: alcanza para que el
// acero parezca acero y el latón, latón.
export function entornoIluminacion (render) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 128);
  g.addColorStop(0.00, '#5f86b8');
  g.addColorStop(0.42, '#a9c0d6');
  g.addColorStop(0.52, '#f0d3a2');
  g.addColorStop(0.62, '#b6a473');
  g.addColorStop(1.00, '#6d6244');
  x.fillStyle = g;
  x.fillRect(0, 0, 256, 128);
  // el sol bajo, hacia el este
  const sol = x.createRadialGradient(200, 60, 0, 200, 60, 46);
  sol.addColorStop(0, 'rgba(255,240,205,1)');
  sol.addColorStop(1, 'rgba(255,240,205,0)');
  x.fillStyle = sol;
  x.fillRect(150, 14, 100, 92);

  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  const pmrem = new THREE.PMREMGenerator(render);
  const entorno = pmrem.fromEquirectangular(tex).texture;
  pmrem.dispose();
  tex.dispose();
  return entorno;
}

export function construirMundo (escena) {
  escena.add(cieloDomo());
  escena.fog = new THREE.Fog(0xd6c6a8, 70, 230);

  // --- luz de amanecer: sol bajo desde el este ---
  const sol = new THREE.DirectionalLight(0xffd9a0, 2.5);
  sol.position.set(48, 15, -26);
  sol.castShadow = true;
  sol.shadow.mapSize.set(2048, 2048);
  sol.shadow.camera.left = -60;
  sol.shadow.camera.right = 60;
  sol.shadow.camera.top = 60;
  sol.shadow.camera.bottom = -60;
  sol.shadow.camera.near = 1;
  sol.shadow.camera.far = 160;
  sol.shadow.bias = -0.0009;
  escena.add(sol);
  escena.add(new THREE.HemisphereLight(0xbcd2e8, 0x8a7a52, 0.55));

  // --- suelo ---
  const suelo = new THREE.Mesh(
    new THREE.PlaneGeometry(400, 400, 1, 1),
    new THREE.MeshStandardMaterial({ map: tierraTextura(), roughness: 1 })
  );
  suelo.rotation.x = -Math.PI / 2;
  suelo.receiveShadow = true;
  escena.add(suelo);

  const colisiones = [];
  const blancos = [];

  // --- pared de cal del cuartel, detrás de la línea de tiro ---
  const cal = new THREE.MeshStandardMaterial({ color: PALETA.cal, roughness: 0.92 });
  const pared = new THREE.Mesh(new THREE.BoxGeometry(46, 4.2, 0.7), cal);
  pared.position.set(0, 2.1, 9);
  pared.castShadow = true; pared.receiveShadow = true;
  escena.add(pared);
  colisiones.push(new THREE.Box3().setFromObject(pared));

  const teja = new THREE.Mesh(new THREE.BoxGeometry(47, 0.34, 1.3),
    new THREE.MeshStandardMaterial({ color: 0x9c5a3c, roughness: 0.9 }));
  teja.position.set(0, 4.35, 9);
  teja.castShadow = true;
  escena.add(teja);

  // muros laterales, para que el campo tenga forma
  for (const s of [-1, 1]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.7, 3.4, 34), cal);
    m.position.set(s * 23, 1.7, -8);
    m.castShadow = true; m.receiveShadow = true;
    escena.add(m);
    colisiones.push(new THREE.Box3().setFromObject(m));
  }

  // --- parapeto de tierra y sacos: cobertura para probar el ritmo ---
  const sacoMat = new THREE.MeshStandardMaterial({ color: 0x8f855f, roughness: 1 });
  for (const [px, pz, largo] of [[-8, -6, 5], [7.5, -10, 4], [0, -18, 6], [-13, -22, 4]]) {
    const grupo = new THREE.Group();
    for (let i = 0; i < largo; i++) {
      for (let f = 0; f < 2; f++) {
        const s = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.42, 0.62), sacoMat);
        s.position.set(i * 1.02 - largo * 0.5, 0.21 + f * 0.42, f * 0.1 + (Math.random() - 0.5) * 0.06);
        s.rotation.y = (Math.random() - 0.5) * 0.12;
        s.castShadow = true; s.receiveShadow = true;
        grupo.add(s);
      }
    }
    grupo.position.set(px, 0, pz);
    escena.add(grupo);
    colisiones.push(new THREE.Box3().setFromObject(grupo));
  }

  // --- blancos a distancias reales de fusil de chispa ---
  for (const [x, z] of [[-6, -20], [-2, -20], [2, -20], [6, -20],
    [-4, -40], [4, -40], [0, -60], [-9, -60], [9, -80]]) {
    const b = siluetaBlanco();
    b.position.set(x, 0, z);
    b.rotation.y = Math.PI;
    escena.add(b);
    blancos.push(b);
  }

  // carteles de distancia
  const marcas = [[-20, 'XX'], [-40, 'XL'], [-60, 'LX'], [-80, 'LXXX']];
  for (const [z] of marcas) {
    for (const s of [-1, 1]) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.5, 0.12),
        new THREE.MeshStandardMaterial({ color: PALETA.maderaOsc, roughness: 0.95 }));
      p.position.set(s * 17, 0.75, z);
      p.castShadow = true;
      escena.add(p);
      const t = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.4, 0.06),
        new THREE.MeshStandardMaterial({ color: PALETA.cal, roughness: 0.9 }));
      t.position.set(s * 17, 1.6, z);
      escena.add(t);
    }
  }

  // --- pasto: matas instanciadas, baratas y con viento ---
  const mata = new THREE.PlaneGeometry(0.42, 0.4);
  mata.translate(0, 0.2, 0);
  const matas = new THREE.InstancedMesh(
    mata,
    new THREE.MeshStandardMaterial({
      map: pastoTextura(), color: 0xcfc292, roughness: 1,
      side: THREE.DoubleSide, transparent: true, alphaTest: 0.35, depthWrite: true
    }),
    2600
  );
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Vector3();
  const p = new THREE.Vector3();
  for (let i = 0; i < 2600; i++) {
    p.set((Math.random() - 0.5) * 120, 0, -Math.random() * 110 + 8);
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * Math.PI);
    const s = 0.6 + Math.random() * 0.9;
    e.set(s, s * (0.7 + Math.random() * 0.8), s);
    m4.compose(p, q, e);
    matas.setMatrixAt(i, m4);
  }
  matas.instanceMatrix.needsUpdate = true;
  matas.receiveShadow = true;
  escena.add(matas);

  // --- un ombú lejano, para que el horizonte no sea una línea ---
  const tronco = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.6, 6, 7),
    new THREE.MeshStandardMaterial({ color: 0x54432e, roughness: 1 }));
  tronco.position.set(-30, 3, -70);
  tronco.castShadow = true;
  escena.add(tronco);
  const copa = new THREE.Mesh(new THREE.SphereGeometry(6.5, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0x4e5c39, roughness: 1, flatShading: true }));
  copa.position.set(-30, 8.6, -70);
  copa.castShadow = true;
  copa.scale.set(1.3, 0.8, 1.2);
  escena.add(copa);

  return { colisiones, blancos, sol };
}
