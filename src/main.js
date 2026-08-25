import * as THREE from 'three';
import { construirMundo, entornoIluminacion } from './mundo.js';
import { Humo } from './humo.js';
import { Fuego } from './fuego.js';
import { Sonido } from './audio.js';
import { Jugador } from './jugador.js';
import { ArmaFuego } from './armas.js';
import { Sable } from './sable.js';
import { Realista } from './enemigo.js';
import { PasadaArma } from './pasadaArma.js';
import { Hud } from './hud.js';

// ---------------------------------------------------------------------------
// Fase 1 · El campo de tiro
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

// El arma se dibuja aparte, con cámara de 55°: con el gran angular del mundo
// las manos se estiran como en un espejo de feria.
const escenaArma = new THREE.Scene();
const camaraArma = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.01, 5);
escenaArma.add(camaraArma);
escenaArma.add(new THREE.HemisphereLight(0xcfe0f0, 0x6b5f42, 1.2));
const luzArma = new THREE.DirectionalLight(0xffe8c8, 2.4);
luzArma.position.set(0.8, 1.1, 0.9);
escenaArma.add(luzArma);
const relleno = new THREE.DirectionalLight(0x9fb6d0, 0.9);
relleno.position.set(-0.9, 0.2, 0.6);
escenaArma.add(relleno);

const entorno = entornoIluminacion(render);
escena.environment = entorno;
escena.environmentIntensity = 0.3;      // en el mundo, apenas para los metales
escenaArma.environment = entorno;
escenaArma.environmentIntensity = 0.95; // en el arma, que el acero se vea acero

const mundo = construirMundo(escena);
const humo = new Humo(escena);
const fuego = new Fuego(escena, camara);
const sonido = new Sonido();
const hud = new Hud();
const jugador = new Jugador(camara, mundo.colisiones);
const pasadaArma = new PasadaArma(render, escenaArma, camaraArma);

const luzBoca = new THREE.PointLight(0xffc46a, 0, 16, 2);
escena.add(luzBoca);

const rayo = new THREE.Raycaster();
rayo.far = 220;
const enemigos = [];

// --------------------------- armas ---------------------------
const sable = new Sable(camaraArma, sonido);
const armas = {
  tercerola: new ArmaFuego('tercerola', camaraArma, camara, sonido, humo),
  pistolon: new ArmaFuego('pistolon', camaraArma, camara, sonido, humo),
  fusil: null
};
let armaLarga = 'tercerola';      // cuál de las dos largas llevo en la mano
let enMano = 'larga';             // 'larga' | 'sable' | 'pistolon'
let cartuchos = 24;
let apuntando = false;
let oleadas = false;
let tProxima = 0;

function armaActual () {
  if (enMano === 'sable') return null;
  return enMano === 'pistolon' ? armas.pistolon : armas[armaLarga];
}

function conectar (arma) {
  arma.alAviso = (t, tipo) => hud.mostrarAviso(t, tipo);
  arma.alGastarCartucho = () => { cartuchos = Math.max(0, cartuchos - 1); };
  arma.alDisparar = resolverDisparo;
  arma.alGolpear = (cfg) => resolverGolpe(cfg.alcance, cfg.dano, cfg.nombre);
}
conectar(armas.tercerola);
conectar(armas.pistolon);
armas.tercerola.sacar();

jugador.alAviso = (t, tipo) => hud.mostrarAviso(t, tipo);

// --------------------------- balística ---------------------------
function resolverDisparo (origen, dir, dispersion) {
  jugador.sacudir(0.42);
  jugador.retroPitch += 0.075;
  luzBoca.position.copy(origen);
  luzBoca.intensity = 30;
  hud.destello(0.45);

  const d = dir.clone();
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

  const g = golpes[0];
  fuego.disparo(origen, d, g ? g.distance : 140);
  if (!g) return;

  let raiz = g.object;
  while (raiz.parent && raiz.parent !== escena) raiz = raiz.parent;

  const enemigo = enemigos.find(e => e.malla === raiz);
  if (enemigo) {
    sonido.impactoCarne();
    humo.soltar(g.point, d, { cantidad: 3, vida: 2.5, empuje: 1.4, radio: 0.1, opacidad: 0.35, claro: 0 });
    if (enemigo.recibir(2, d)) hud.mostrarAviso('Realista abatido', 'bien');
  } else if (raiz.userData.blanco) {
    sonido.impactoMadera();
    hud.mostrarAviso(`Blanco a ${Math.round(g.distance)} m`, 'bien');
    humo.soltar(g.point, d, { cantidad: 2, vida: 2, empuje: 1, radio: 0.09, opacidad: 0.3 });
  }
}

// --------------------------- arma blanca ---------------------------
function resolverGolpe (alcance, dano, nombre) {
  const frente = new THREE.Vector3();
  camara.getWorldDirection(frente);
  for (const e of enemigos) {
    if (!e.vivo) continue;
    const hacia = new THREE.Vector3().subVectors(e.cabeza(), camara.position);
    const dist = hacia.length();
    if (dist > alcance) continue;
    hacia.normalize();
    if (hacia.dot(frente) < 0.5) continue;
    sonido.impactoCarne();
    if (e.recibir(dano, frente)) hud.mostrarAviso(nombre, 'bien');
    return;
  }
}
sable.alGolpear = () => resolverGolpe(2.4, 2, 'A sablazos');

// --------------------------- tomar el fusil ---------------------------
function caidoConFusil () {
  for (const e of enemigos) {
    if (e.vivo || !e.tieneFusil) continue;
    if (e.pos.distanceTo(jugador.pos) < 2.6) return e;
  }
  return null;
}

function tomarOIntercambiar () {
  const caido = caidoConFusil();
  if (!armas.fusil) {
    if (!caido) { hud.mostrarAviso('No hay ningún fusil cerca', 'malo'); return; }
    caido.entregarFusil();
    armas.fusil = new ArmaFuego('fusil', camaraArma, camara, sonido, humo);
    conectar(armas.fusil);
    cambiarLarga('fusil');
    hud.mostrarAviso('Fusil con bayoneta tomado', 'bien');
    return;
  }
  // ya lo tengo: G intercambia entre las dos armas largas
  cambiarLarga(armaLarga === 'fusil' ? 'tercerola' : 'fusil');
  hud.mostrarAviso(armas[armaLarga].nombre, 'bien');
}

function guardarTodo () {
  const a = armaActual();
  if (a) a.soltarCarga();          // la carga a medias se conserva, no se borra
  armas.tercerola.guardar();
  armas.pistolon.guardar();
  if (armas.fusil) armas.fusil.guardar();
  sable.guardar();
}

function cambiarLarga (cual) {
  guardarTodo();
  armaLarga = cual;
  enMano = 'larga';
  armas[armaLarga].sacar();
}

function cambiarArma (cual) {
  if (enMano === cual) return;
  guardarTodo();
  enMano = cual;
  if (cual === 'sable') {
    sable.sacar();
    hud.mostrarAviso('Sable corvo', 'bien');
  } else {
    const a = armaActual();
    a.sacar();
    hud.mostrarAviso(a.aMedias ? `${a.nombre} · carga a medias` : a.nombre, 'bien');
  }
}

// --------------------------- enemigos ---------------------------
function soltarRealista () {
  const x = (Math.random() - 0.5) * 26;
  const z = -58 - Math.random() * 22;
  const e = new Realista(escena, humo, sonido, new THREE.Vector3(x, 0, z));
  e.alDisparar = (quien, origen, dir) => {
    const haciaJugador = new THREE.Vector3().subVectors(jugador.pos, origen).normalize();
    const dist = origen.distanceTo(jugador.pos);
    const oc = humo.oclusion(origen, jugador.pos);
    // agachado sos menos blanco; tirado, casi nada
    const punteria = Math.max(0.015, (0.62 - dist / 110 - oc * 0.45) * jugador.cfgPostura.blanco);
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
const sensibilidad = 0.0021;

addEventListener('keydown', ev => {
  if (ev.code === 'Escape') return;
  teclas.add(ev.code);
  if (ev.repeat) return;
  switch (ev.code) {
    case 'KeyR': {
      const a = armaActual();
      if (!a) break;
      if (cartuchos <= 0 && !a.aMedias && !a.cargada) { hud.mostrarAviso('No quedan cartuchos', 'malo'); break; }
      a.iniciarCarga();
      break;
    }
    case 'Space':
      ev.preventDefault();
      jugador.saltar();
      break;
    case 'ControlLeft': ev.preventDefault(); jugador.alternarPostura('agachado'); break;
    case 'KeyZ': jugador.alternarPostura('tierra'); break;
    case 'KeyF': {
      const a = armaActual();
      if (a) a.puntazo(); else sable.tajo();
      break;
    }
    case 'KeyG': tomarOIntercambiar(); break;
    case 'Digit1': cambiarArma('larga'); break;
    case 'Digit2': cambiarArma('sable'); break;
    case 'Digit3': cambiarArma('pistolon'); break;
    case 'KeyC': hud.verCartuchera(); break;
    case 'KeyV': if (jugador.vendar()) hud.mostrarAviso('Vendando', 'bien'); break;
    case 'KeyL': { const a = armaActual(); if (a) a.limpiar(); break; }
    case 'KeyO':
      oleadas = !oleadas;
      hud.mostrarAviso(oleadas ? '¡Ahí vienen!' : 'Alto el fuego', oleadas ? 'malo' : 'bien');
      if (!oleadas) limpiarCampo();
      tProxima = 0;
      break;
    case 'F3': hud.verDepurar = !hud.verDepurar; break;
    case 'Enter':
      if (!jugador.vivo) {
        jugador.heridas = 0; jugador.vendas = 3; jugador.aliento = 100;
        jugador.postura = 'pie';
        jugador.pos.set(0, 1.68, 4);
        limpiarCampo();
        hud.mostrarAviso('En pie', 'bien');
      }
      break;
  }
});
addEventListener('keyup', ev => {
  teclas.delete(ev.code);
  if (ev.code === 'KeyR') { const a = armaActual(); if (a) a.soltarCarga(); }
});

addEventListener('mousedown', ev => {
  if (!bloqueado) return;
  if (ev.button === 0) {
    const a = armaActual();
    // mientras cargás, el click marca el tiempo en vez de disparar
    if (a && a.cargando) {
      if (a.golpe() === 'bien') hud.vecesQueAcerto++;
      return;
    }
    if (a) a.gatillo();
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
  pasadaArma.redimensionar(innerWidth, innerHeight);
});

// --------------------------- bucle ---------------------------
const reloj = new THREE.Clock();
let fps = 60;

function cuadro () {
  requestAnimationFrame(cuadro);
  const dt = Math.min(0.05, reloj.getDelta());
  fps = fps * 0.92 + (1 / Math.max(dt, 0.0001)) * 0.08;

  let masCerca = 999;
  for (const e of enemigos) if (e.vivo) masCerca = Math.min(masCerca, e.pos.distanceTo(jugador.pos));
  const presion = Math.min(1,
    Math.max(0, (14 - masCerca) / 14) * 0.7 +
    Math.max(0, (45 - jugador.aliento) / 45) * 0.2 +
    jugador.heridas * 0.15);

  const arma = armaActual();
  const quiereApuntar = apuntando && !!arma && !arma.cargando && arma.tGolpe < 0;
  jugador.actualizar(dt, teclas, quiereApuntar, arma ? arma.cargando : false);

  const p = jugador.cfgPostura;
  const ctx = { apuntando, presion, penalCarga: p.penalCarga, dispersion: p.dispersion };
  armas.tercerola.actualizar(dt, ctx);
  armas.pistolon.actualizar(dt, ctx);
  if (armas.fusil) armas.fusil.actualizar(dt, ctx);
  sable.actualizar(dt);
  humo.actualizar(dt);
  fuego.actualizar(dt);

  for (let i = enemigos.length - 1; i >= 0; i--) {
    const e = enemigos[i];
    e.actualizar(dt, jugador);
    if (!e.vivo && e.caida >= 1) {
      e.tMuerto = (e.tMuerto || 0) + dt;
      if (e.tMuerto > 40) { e.quitar(); enemigos.splice(i, 1); }
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

  luzBoca.intensity = Math.max(0, luzBoca.intensity - dt * 260);

  render.render(escena, camara);
  const mundoInfo = { calls: render.info.render.calls, tris: render.info.render.triangles };
  pasadaArma.dibujar(quiereApuntar ? 1 : 0);
  const info = {
    calls: mundoInfo.calls + pasadaArma.ultimaInfo.calls + 1,
    triangles: mundoInfo.tris + pasadaArma.ultimaInfo.tris
  };

  hud.actualizar(dt, {
    paso: arma ? arma.infoPaso() : null,
    aliento: jugador.aliento,
    cartuchos,
    nombreArma: arma ? arma.nombre : 'Sable corvo',
    estadoArma: arma ? arma.etiquetaEstado : 'en mano',
    postura: p.nombre,
    puedeTomarFusil: !armas.fusil && !!caidoConFusil(),
    emplome: arma ? arma.tiros : 0,
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

window.juego = { jugador, armas, sable, humo, fuego, enemigos, escena, soltarRealista,
  get arma () { return armaActual(); } };
