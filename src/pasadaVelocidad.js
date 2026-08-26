import * as THREE from 'three';

// EL DESENFOQUE DE VELOCIDAD.
//
// A galope el mundo se estira hacia afuera desde el punto al que vas: el
// centro queda nítido y los bordes se van en rayas. Es el efecto que hace que
// diez metros por segundo se SIENTAN como diez metros por segundo, sin tocar
// la cámara ni el horizonte.
//
// El centro NO es el centro de la pantalla: es la dirección en la que se mueve
// el caballo, proyectada a pantalla. Arriba de un caballo el mouse mira libre,
// así que si vas al galope mirando de costado las rayas convergen fuera del
// cuadro, que es exactamente lo que ve un jinete.
//
// Cuesta una pasada de pantalla completa y sólo se paga cuando hay velocidad:
// por debajo del umbral el mundo se dibuja derecho a la pantalla, como antes.

const VS = `
  varying vec2 vUv;
  void main () { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

// OJO CON LA LUZ —acá estuvo el bug del «al galope se oscurece».
//
// three.js trata un render target DISTINTO que el lienzo, y a propósito:
// contra el lienzo aplica el mapeo de tonos y el paso a sRGB, y sube el color
// de la niebla ya en sRGB; contra un target no aplica nada y sube la niebla en
// lineal, esperando que la cuenta la termine el que compone. Resultado: el
// mundo salía **26 % más oscuro** en cuanto empezabas a galopar —medido, en
// `pruebas/luzgalope.mjs`— porque recién ahí se encendía la pasada.
//
// Terminar la cuenta a mano en este shader no alcanza: la niebla se mezclaría
// en lineal en vez de en el espacio de pantalla, y con esta niebla —de 20 a
// 175 m, o sea casi todo el campo— la imagen se lava entera.
//
// La solución es decirle a three.js la verdad: este target ES la pantalla. Con
// eso el mundo se dibuja adentro exactamente igual que afuera y este shader no
// tiene que corregir nada, sólo estirar.
const FS = `
  uniform sampler2D uTex;
  uniform float uFuerza;
  uniform vec2 uCentro;
  varying vec2 vUv;

  void main () {
    vec2 d = vUv - uCentro;
    // el centro queda limpio y el estirado crece hacia los bordes
    float mascara = smoothstep(0.16, 0.78, length(d));
    float f = uFuerza * mascara;

    vec3 c;
    if (f < 0.001) {
      c = texture2D(uTex, vUv).rgb;
    } else {
      c = vec3(0.0);
      for (int i = 0; i < 8; i++) {
        float t = float(i) / 7.0;
        c += texture2D(uTex, vUv - d * f * t).rgb;
      }
      c *= 0.125;
    }
    gl_FragColor = vec4(c, 1.0);
  }
`;

export class PasadaVelocidad {
  constructor (render, escena, camara) {
    this.render = render;
    this.escena = escena;
    this.camara = camara;
    this.fuerza = 0;

    const t = render.getSize(new THREE.Vector2());
    this.destino = new THREE.WebGLRenderTarget(t.x, t.y, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      depthBuffer: true
    });
    // ESTO ES LO QUE ARREGLA LA LUZ. three.js tiene una rama para «este target
    // es la superficie final» —la usa para XR— y con ella aplica el mapeo de
    // tonos, escribe en sRGB y sube la niebla en sRGB, igual que contra el
    // lienzo. Ocho bits alcanzan porque acá ya guardamos color de pantalla,
    // no color lineal.
    this.destino.isXRRenderTarget = true;
    this.destino.texture.colorSpace = THREE.SRGBColorSpace;

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uTex: { value: this.destino.texture },
        uFuerza: { value: 0 },
        uCentro: { value: new THREE.Vector2(0.5, 0.5) }
      },
      vertexShader: VS,
      fragmentShader: FS,
      depthTest: false,
      depthWrite: false
    });

    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    quad.frustumCulled = false;
    this.escenaQuad = new THREE.Scene();
    this.escenaQuad.add(quad);
    this.camaraQuad = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this._v = new THREE.Vector3();
    this._m = new THREE.Vector3();
    this.ultimaInfo = { calls: 0, tris: 0 };
  }

  redimensionar (w, h) { this.destino.setSize(w, h); }

  // objetivo: 0 a 1. rumbo: hacia dónde se mueve el cuerpo (o null: al frente)
  dibujar (objetivo, rumbo) {
    this.fuerza += (objetivo * 0.030 - this.fuerza) * 0.14;
    this.material.uniforms.uFuerza.value = this.fuerza;

    if (rumbo !== undefined && rumbo !== null) {
      // proyectar la dirección de marcha a pantalla
      this._v.set(-Math.sin(rumbo), 0, -Math.cos(rumbo));
      // Cuánto de esa dirección estás mirando. Si mirás para el costado el
      // centro del estirado se va del cuadro y TODO queda lejos del centro, o
      // sea todo borroso: eso quedaba exagerado. Así que el efecto se apaga a
      // medida que la vista se aparta de la marcha, y sólo pega de lleno
      // cuando mirás para donde vas.
      this.camara.getWorldDirection(this._m);
      const mira = Math.max(0, this._v.dot(this._m));
      this.material.uniforms.uFuerza.value = this.fuerza * mira * mira;

      this._v.add(this.camara.position).project(this.camara);
      const u = this.material.uniforms.uCentro.value;
      const x = isFinite(this._v.x) ? this._v.x * 0.5 + 0.5 : 0.5;
      const y = isFinite(this._v.y) ? this._v.y * 0.5 + 0.5 : 0.5;
      u.set(Math.max(-0.25, Math.min(1.25, x)), Math.max(-0.25, Math.min(1.25, y)));
    } else {
      this.material.uniforms.uCentro.value.set(0.5, 0.5);
    }

    // UNA SOLA RAMA, SIEMPRE.
    //
    // Antes esto tenía un atajo: sin velocidad, el mundo iba derecho a la
    // pantalla y se ahorraba la pasada. El atajo costaba caro: three.js sube
    // el color de la niebla en sRGB cuando dibuja contra el lienzo y en lineal
    // cuando dibuja contra un target —lo hace a propósito, porque la niebla se
    // mezcla después del mapeo de tonos—, así que las dos ramas NO daban el
    // mismo píxel. Al montar y embalar, la imagen cambiaba de luz. Eso era lo
    // que se veía como «al galope se oscurece».
    //
    // Un blit de pantalla completa por cuadro es barato; que la luz del juego
    // dependa de si vas al galope no lo es. Una rama sola y se terminó.
    this.render.setRenderTarget(this.destino);
    this.render.clear();
    this.render.render(this.escena, this.camara);
    this.ultimaInfo.calls = this.render.info.render.calls;
    this.ultimaInfo.tris = this.render.info.render.triangles;

    this.render.setRenderTarget(null);
    const autoPrevio = this.render.autoClear;
    this.render.autoClear = true;
    this.render.render(this.escenaQuad, this.camaraQuad);
    this.render.autoClear = autoPrevio;
  }
}
