import * as THREE from 'three';

// El arma se dibuja en su propia pasada y se compone encima del mundo.
// Al apuntar, esa capa se desenfoca salvo en el centro: el fierro queda
// borroso y el punto de mira y el objetivo, nítidos. Es mucho más barato que
// desenfocar la escena entera y da el mismo efecto.

const VS = `
  varying vec2 vUv;
  void main () { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const FS = `
  uniform sampler2D uTex;
  uniform float uRadio;
  uniform vec2 uPixel;
  varying vec2 vUv;

  void main () {
    if (uRadio < 0.0015) {
      gl_FragColor = texture2D(uTex, vUv);
      return;
    }
    // cuanto más lejos del centro de la pantalla, más desenfoque
    vec2 d = vUv - vec2(0.5);
    d.x *= uPixel.y / uPixel.x;
    float mascara = smoothstep(0.02, 0.34, length(d));
    float r = uRadio * mascara;

    vec4 suma = vec4(0.0);
    float peso = 0.0;
    for (int i = 0; i < 12; i++) {
      float a = float(i) * 0.5235988;
      float anillo = (i < 6) ? 0.55 : 1.0;
      vec2 o = vec2(cos(a), sin(a)) * r * anillo;
      vec4 m = texture2D(uTex, vUv + o * uPixel);
      suma.rgb += m.rgb * m.a;
      suma.a += m.a;
      peso += 1.0;
    }
    vec4 centro = texture2D(uTex, vUv);
    suma.rgb += centro.rgb * centro.a * 2.0;
    suma.a += centro.a * 2.0;
    peso += 2.0;

    float alfa = suma.a / peso;
    vec3 color = suma.a > 0.0001 ? suma.rgb / suma.a : centro.rgb;
    gl_FragColor = vec4(color, alfa);
  }
`;

export class PasadaArma {
  constructor (render, escena, camara) {
    this.render = render;
    this.escena = escena;
    this.camara = camara;
    this.radio = 0;

    const t = render.getSize(new THREE.Vector2());
    this.destino = new THREE.WebGLRenderTarget(t.x, t.y, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      depthBuffer: true
    });
    // el arma también se dibujaba a un target sin mapeo de tonos ni sRGB, o
    // sea que venía saliendo apagada desde siempre y nadie tenía con qué
    // compararla. Misma bandera, mismo arreglo. Ver pasadaVelocidad.js.
    this.destino.isXRRenderTarget = true;
    this.destino.texture.colorSpace = THREE.SRGBColorSpace;

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uTex: { value: this.destino.texture },
        uRadio: { value: 0 },
        uPixel: { value: new THREE.Vector2(1 / t.x, 1 / t.y) }
      },
      vertexShader: VS,
      fragmentShader: FS,
      transparent: true,
      depthTest: false,
      depthWrite: false
    });

    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    quad.frustumCulled = false;
    this.escenaQuad = new THREE.Scene();
    this.escenaQuad.add(quad);
    this.camaraQuad = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.ultimaInfo = { calls: 0, tris: 0 };
  }

  redimensionar (w, h) {
    this.destino.setSize(w, h);
    this.material.uniforms.uPixel.value.set(1 / w, 1 / h);
  }

  // apuntado: 0 a 1. El desenfoque entra con el zoom, no de golpe.
  dibujar (apuntado) {
    this.radio += (apuntado * 7.5 - this.radio) * 0.18;
    this.material.uniforms.uRadio.value = this.radio;

    const colorPrevio = this.render.getClearColor(new THREE.Color());
    const alfaPrevio = this.render.getClearAlpha();
    const autoPrevio = this.render.autoClear;

    this.render.setRenderTarget(this.destino);
    this.render.setClearColor(0x000000, 0);
    this.render.autoClear = true;
    this.render.clear();
    this.render.render(this.escena, this.camara);
    this.ultimaInfo.calls = this.render.info.render.calls;
    this.ultimaInfo.tris = this.render.info.render.triangles;

    this.render.setRenderTarget(null);
    this.render.setClearColor(colorPrevio, alfaPrevio);
    this.render.autoClear = false;
    this.render.render(this.escenaQuad, this.camaraQuad);
    this.render.autoClear = autoPrevio;
  }
}
