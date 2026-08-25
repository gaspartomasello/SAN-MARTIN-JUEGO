import * as THREE from 'three';
import { construirMundo } from './mundo.js';
import { Humo } from './humo.js';
import { Sonido } from './audio.js';
import { Jugador } from './jugador.js';
import { Tercerola } from './tercerola.js';
import { Sable } from './sable.js';
import { Realista } from './enemigo.js';
import { Hud } from './hud.js';

// ---------------------------------------------------------------------------
// Fase 1 · El campo de tiro
// La pregunta que este prototipo tiene que contestar: ¿recargar es divertido?
// ---------------------------------------------------------------------------

const lienzo = document.createElement('canvas');
document.body.insertBefore(lienzo, document.body.firstChild);

const render = new THREE.WebGLRenderer({ canvas: lienzo, antialias: true, powerPreference: 'high-performance' });
render.setPixelRatio(Math.min(devicePixelRatio, 1.75));
render.setSize(innerWidth, innerHeight);
render.shadowMap.enabled = true;
render.shadowMap.type = THREE.PCFSoftShadowMap;
render.toneMapping = THREE.ACESFilmicToneMapping;
render.toneMappingExposure = 1.05;

const escena = new THREE.Scene();
const camara = new THREE.PerspectiveCamera(80, innerWidth / innerHeight, 0.05, 600);
camara.rotation.order = 'YXZ';
escena.add(camara);

// El arma se dibuja en una pasada aparte, con una cámara de 55°: con el gran
// angular del mundo las manos se estiran como en un espejo de feria.
const escenaArma = new THREE.Scene();
const camaraArma = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.01, 5);
escenaArma.add(camaraArma);
escenaArma.add(new THREE.HemisphereLight(0xcfe0f0, 0x6b5f42, 1.5));
const luzArma = new THREE.DirectionalLight(0xffe0b4, 2.1);
luzArma.position.set(0.6, 1.2, 0.4);
escenaArma.add(luzArma);

const mundo = construirMundo(escena);
const humo = new Humo(escena);
const sonido = new Sonido();
const hud = new Hud();
const jugador = new Jugador(camara, mundo.colisiones);
const tercerola = new Tercerola(camaraArma, camara, sonido, humo);
const sable = new Sable(camaraArma, sonido);

// el fogonazo tiene que alumbrar el mundo, no sólo el arma
const luzBoca = new THREE.PointLight(0xffc46a, 0, 14, 2);
escena.add(luzBoca);

const rayo = new THREE.Raycaster();
rayo.far = 220;
const enemigos = [];
let armaActual = 'tercerola';
let apuntando = false;
let oleadas = false;
let tProxima = 0;
let tomados = 0;                 // blancos acertados

tercerola.alAviso = (t, tipo) => hud.mostrarAviso(t, tipo);

// --------------------------- balística ---------------------------
tercerola.alDisparar = (origen, dir, dispersion) => {
  jugador.sacudir(0.42);
  luzBoca.position.copy(origen);
  luzBoca.intensity = 26;
  jugador.retroPitch += 0.075;
  jugador.fov = jugador.fovBase + 5;
  setTimeout(() => { jugador.fov = jugador.fovBase; }, 90);
  hud.destello(0.5);

  const d = dir.clone();
  // cono de dispersión: ánima lisa, sin estrías
  const a = Math.random() * Math.PI * 2;
  const r = Math.sqrt(Math.random()) * dispersion;
  const eje1 = new THREE.Vector3(0, 1, 0).cross(d).normalize();
  const eje2 = new THREE.Vector3().crossVectors(d, eje1).normalize();
  d.addScaledVector(eje1, Math.tan(r) * Math.cos(a));
  d.addScaledVector(eje2, Math.tan(r) * Math.sin(a));
  d.normalize();

  rayo.set(origen, d);
  const candidatos = [];
  for (const e of enemigos) if (e.vivo) candidatos.push(e.malla);
  for (const b of mundo.blancos) candidatos.push(b);
  const golpes = rayo.intersectObjects(candidatos, true);
  if (golpes.length === 0) return;

  const g = golpes[0];
  let raiz = g.object;
  while (raiz.parent && raiz.parent !== escena) raiz = raiz.parent;

  const enemigo = enemigos.find(e => e.malla === raiz);
  if (enemigo) {
    sonido.impactoCarne();
    humo.soltar(g.point, d, { cantidad: 3, vida: 2.5, empuje: 1.4, radio: 0.1, opacidad: 0.35, claro: 0.0 });
    if (enemigo.recibir(2, d)) hud.mostrarAviso('Realista abatido', 'bien');
  } else if (raiz.userData.blanco) {
    sonido.impactoMadera();
    tomados++;
    hud.mostrarAviso(`Blanco a ${Math.round(g.distance)} m`, 'bien');
    humo.soltar(g.point, d, { cantidad: 2, vida: 2, empuje: 1, radio: 0.09, opacidad: 0.3 });
  }
};

// --------------------------- sable ---------------------------
sable.alGolpear = () => {
  const frente = new THREE.Vector3();
  camara.getWorldDirection(frente);
  for (const e of enemigos) {
    if (!e.vivo) continue;
    const hacia = new THREE.Vector3().subVectors(e.cabeza(), camara.position);
    const dist = hacia.length();
    if (dist > 2.4) continue;
    hacia.normalize();
    if (hacia.dot(frente) < 0.55) continue;
    sonido.impactoCarne();
    if (e.recibir(1, frente)) hud.mostrarAviso('A sablazos', 'bien');
    return;
  }
};

// --------------------------- enemigos ---------------------------
function soltarRealista () {
  const x = (Math.random() - 0.5) * 26;
  const z = -58 - Math.random() * 22;
  const e = new Realista(escena, humo, sonido, new THREE.Vector3(x, 0, z));
  e.alDisparar = (quien, origen, dir) => {
    // ¿le pegó al jugador? cono ancho, distancia y humo cuentan
    const haciaJugador = new THREE.Vector3().subVectors(jugador.pos, origen).normalize();
    const dist = origen.distanceTo(jugador.pos);
    const oc = humo.oclusion(origen, jugador.pos);
    const punteria = Math.max(0.02, 0.62 - dist / 110 - oc * 0.45);
    if (haciaJugador.dot(dir) > 0.999 && Math.random() < punteria) {
      jugador.herir();
      sonido.golpeRecibido();
      hud.mostrarAviso('¡Te dieron!', 'malo');
    } else {
      jugador.sacudir(0.12);
    }
  };
  e.alAcuchillar = () => {
    jugador.herir();
    sonido.golpeRecibido();
    hud.mostrarAviso('¡Bayonetazo!', 'malo');
  };
  enemigos.push(e);
}

function limpiarCampo () {
  for (const e of enemigos) e.quitar();
  enemigos.length = 0;
}

// --------------------------- entrada ---------------------------
const teclas = new Set();
let sensibilidad = 0.0021;

addEventListener('keydown', ev => {
  if (ev.code === 'Escape') return;
  teclas.add(ev.code);
  if (ev.repeat) return;
  switch (ev.code) {
    case 'KeyR': if (armaActual === 'tercerola') tercerola.iniciarCarga(); break;
    case 'Space': ev.preventDefault(); tercerola.golpe(); break;
    case 'Digit1': cambiarArma('tercerola'); break;
    case 'Digit2': cambiarArma('sable'); break;
    case 'KeyC': hud.verCartuchera(); break;
    case 'KeyV': if (jugador.vendar()) hud.mostrarAviso('Vendando', 'bien'); break;
    case 'KeyL': tercerola.limpiar(); break;
    case 'KeyG':
      oleadas = !oleadas;
      hud.mostrarAviso(oleadas ? '¡Ahí vienen!' : 'Alto el fuego', oleadas ? 'malo' : 'bien');
      if (!oleadas) limpiarCampo();
      tProxima = 0;
      break;
    case 'F3': hud.verDepurar = !hud.verDepurar; break;
    case 'Enter':
      if (!jugador.vivo) {
        jugador.heridas = 0; jugador.vendas = 3; jugador.aliento = 100;
        jugador.pos.set(0, 1.68, 4);
        limpiarCampo();
        hud.mostrarAviso('En pie', 'bien');
      }
      break;
  }
});
addEventListener('keyup', ev => {
  teclas.delete(ev.code);
  if (ev.code === 'KeyR') tercerola.soltarCarga();
});

function cambiarArma (cual) {
  if (armaActual === cual) return;
  armaActual = cual;
  if (cual === 'sable') {
    tercerola.soltarCarga();       // la carga queda donde estaba: se retoma después
    tercerola.guardada = true;
    sable.sacar();
    hud.mostrarAviso(tercerola.aMedias ? 'Carga a medias' : 'Sable', 'bien');
  } else {
    sable.guardar();
    tercerola.guardada = false;
  }
}

addEventListener('mousedown', ev => {
  if (!bloqueado) return;
  if (ev.button === 0) {
    if (armaActual === 'tercerola') tercerola.gatillo();
    else sable.tajo();
  }
  if (ev.button === 2) apuntando = true;
});
addEventListener('mouseup', ev => { if (ev.button === 2) apuntando = false; });
addEventListener('contextmenu', ev => ev.preventDefault());
addEventListener('mousemove', ev => {
  if (!bloqueado) return;
  jugador.mirar(ev.movementX || 0, ev.movementY || 0, sensibilidad);
});

let bloqueado = false;
document.addEventListener('pointerlockchange', () => {
  bloqueado = document.pointerLockElement === lienzo;
  if (!bloqueado) teclas.clear();
});

document.getElementById('empezar').addEventListener('click', () => {
  document.getElementById('portada').classList.add('oculto');
  sonido.iniciar();
  lienzo.requestPointerLock();
});
lienzo.addEventListener('click', () => { if (!bloqueado) lienzo.requestPointerLock(); });

addEventListener('resize', () => {
  camara.aspect = innerWidth / innerHeight;
  camara.updateProjectionMatrix();
  camaraArma.aspect = innerWidth / innerHeight;
  camaraArma.updateProjectionMatrix();
  render.setSize(innerWidth, innerHeight);
});

// --------------------------- bucle ---------------------------
const reloj = new THREE.Clock();
let fps = 60;

function cuadro () {
  requestAnimationFrame(cuadro);
  const dt = Math.min(0.05, reloj.getDelta());
  fps = fps * 0.92 + (1 / Math.max(dt, 0.0001)) * 0.08;

  // presión: enemigo cerca + poco aliento + herido. Achica las ventanas de tiempo.
  let masCerca = 999;
  for (const e of enemigos) if (e.vivo) masCerca = Math.min(masCerca, e.pos.distanceTo(jugador.pos));
  const presion = Math.min(1,
    Math.max(0, (14 - masCerca) / 14) * 0.7 +
    Math.max(0, (45 - jugador.aliento) / 45) * 0.2 +
    jugador.heridas * 0.15);

  jugador.actualizar(dt, teclas, apuntando, tercerola.cargando);
  tercerola.actualizar(dt, { apuntando, presion });
  sable.actualizar(dt);
  humo.actualizar(dt);

  for (let i = enemigos.length - 1; i >= 0; i--) {
    const e = enemigos[i];
    e.actualizar(dt, jugador);
    if (!e.vivo && e.caida >= 1) {
      e.tMuerto = (e.tMuerto || 0) + dt;
      if (e.tMuerto > 22) { e.quitar(); enemigos.splice(i, 1); }
    }
  }

  if (oleadas && jugador.vivo) {
    tProxima -= dt;
    const enPie = enemigos.filter(e => e.vivo).length;
    if (tProxima <= 0 && enPie < 4) {
      soltarRealista();
      tProxima = 7 + Math.random() * 5;
    }
  }

  luzBoca.intensity = Math.max(0, luzBoca.intensity - dt * 220);

  // el mundo primero, el arma después con su propia cámara
  render.render(escena, camara);
  const mundoInfo = { calls: render.info.render.calls, tris: render.info.render.triangles };
  render.autoClear = false;
  render.clearDepth();
  render.render(escenaArma, camaraArma);
  render.autoClear = true;
  const info = {
    calls: mundoInfo.calls + render.info.render.calls,
    triangles: mundoInfo.tris + render.info.render.triangles
  };

  hud.actualizar(dt, {
    paso: tercerola.infoPaso(),
    aliento: jugador.aliento,
    cartuchos: tercerola.cartuchos,
    estadoArma: armaActual === 'sable' ? 'sable en mano' : tercerola.etiquetaEstado,
    emplome: tercerola.tiros,
    heridas: jugador.heridas,
    vendas: jugador.vendas,
    vendando: Math.max(0, jugador.vendando),
    enemigos: enemigos.filter(e => e.vivo).length,
    humoLocal: humo.densidadEn(jugador.pos),
    presion,
    nubes: humo.vivas,
    fps,
    draws: info.calls,
    tris: info.triangles
  });
}
cuadro();

// para poder mirarlo desde la consola mientras se ajusta el ritmo
window.juego = { jugador, tercerola, humo, enemigos, escena, soltarRealista };
