import * as THREE from 'three';
import { construirMundo, entornoIluminacion } from './mundo.js';
import { Humo } from './humo.js';
import { Fuego } from './fuego.js';
import { Sonido } from './audio.js';
import { Jugador } from './jugador.js';
import { ArmaFuego } from './armas.js';
import { Sable } from './sable.js';
import { Soldado } from './soldados.js';
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

const mundo = construirMundo(escena);
const humo = new Humo(escena);
const fuego = new Fuego(escena, camara);
const sonido = new Sonido();
const hud = new Hud();
const jugador = new Jugador(camara, mundo.colisiones);
const pasadaArma = new PasadaArma(render, escenaArma, camaraArma);

const entorno = entornoIluminacion(render);
escena.environment = entorno;
escena.environmentIntensity = 0.3;
escenaArma.environment = entorno;
escenaArma.environmentIntensity = 0.95;

const luzBoca = new THREE.PointLight(0xffc46a, 0, 16, 2);
escena.add(luzBoca);

const rayo = new THREE.Raycaster();
rayo.far = 220;
const soldados = [];

// daño que hace una bala de plomo y una bayoneta al jugador
const DANO_BALA = 52;
const DANO_BAYONETA = 34;

// --------------------------- armas ---------------------------
const sable = new Sable(camaraArma, sonido);
const armas = {
  tercerola: new ArmaFuego('tercerola', camaraArma, camara, sonido, humo),
  pistolon: new ArmaFuego('pistolon', camaraArma, camara, sonido, humo),
  fusil: null
};
let armaLarga = 'tercerola';
let enMano = 'larga';
let cartuchos = 24;
let apuntando = false;
let combate = false;
let tProxima = 0;
let tAliado = 0;

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
// se arranca la partida con las armas cargadas
armas.tercerola.cargarDeUnaVez();
armas.pistolon.cargarDeUnaVez();

jugador.alAviso = (t, tipo) => hud.mostrarAviso(t, tipo);
jugador.alMorir = () => hud.mostrarAviso('Fuera de combate', 'malo');

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
  for (const s of soldados) if (s.vivo && s.esRealista) candidatos.push(s.malla);
  for (const b of mundo.blancos) candidatos.push(b);
  const golpes = rayo.intersectObjects(candidatos, true);

  const g = golpes[0];
  fuego.disparo(origen, d, g ? g.distance : 140);
  if (!g) return;

  let raiz = g.object;
  while (raiz.parent && raiz.parent !== escena) raiz = raiz.parent;

  const soldado = soldados.find(s => s.malla === raiz);
  if (soldado) {
    sonido.impactoCarne();
    humo.soltar(g.point, d, { cantidad: 3, vida: 2.5, empuje: 1.4, radio: 0.1, opacidad: 0.35, claro: 0 });
    if (soldado.recibir(2, d)) hud.mostrarAviso('Realista abatido', 'bien');
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
  for (const s of soldados) {
    if (!s.vivo || !s.esRealista) continue;
    const hacia = new THREE.Vector3().subVectors(s.cabeza(), camara.position);
    const dist = hacia.length();
    if (dist > alcance) continue;
    hacia.normalize();
    if (hacia.dot(frente) < 0.5) continue;
    sonido.impactoCarne();
    if (s.recibir(dano, frente)) hud.mostrarAviso(nombre, 'bien');
    return;
  }
}
sable.alGolpear = () => resolverGolpe(2.4, 2, 'A sablazos');

// --------------------------- tomar el fusil ---------------------------
function caidoConFusil () {
  for (const s of soldados) {
    if (s.vivo || !s.tieneFusil) continue;
    if (s.pos.distanceTo(jugador.pos) < 2.6) return s;
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
    armas.fusil.cargarDeUnaVez();          // el realista no llegó a tirar
    cambiarLarga('fusil');
    hud.mostrarAviso('Fusil con bayoneta tomado', 'bien');
    return;
  }
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

// --------------------------- soldados ---------------------------
function soltarSoldado (bando) {
  let pos;
  if (bando === 'realista') {
    pos = new THREE.Vector3((Math.random() - 0.5) * 26, 0, -58 - Math.random() * 22);
  } else {
    // los granaderos forman a los costados del jugador
    pos = new THREE.Vector3(jugador.pos.x + (Math.random() - 0.5) * 16, 0, 2 + Math.random() * 6);
  }
  const s = new Soldado(escena, humo, sonido, pos, bando);

  s.alDisparar = (quien, origen, dir, objetivo) => {
    const oc = humo.oclusion(origen, objetivo.pos);
    const dist = origen.distanceTo(objetivo.pos);
    if (objetivo.jugador) {
      // agachado sos menos blanco; tirado, casi nada
      const punteria = Math.max(0.02, (0.6 - dist / 110 - oc * 0.45) * jugador.cfgPostura.blanco);
      if (Math.random() < punteria) {
        jugador.recibir(DANO_BALA, dir);
        sonido.golpeRecibido();
        hud.mostrarAviso('¡Te dieron!', 'malo');
      } else {
        jugador.sacudir(0.12);
      }
    } else if (objetivo.soldado) {
      const punteria = Math.max(0.03, 0.5 - dist / 120 - oc * 0.45);
      if (Math.random() < punteria) objetivo.soldado.recibir(2, dir);
    }
  };

  s.alGolpear = (quien, objetivo) => {
    if (objetivo.jugador) {
      const frente = new THREE.Vector3().subVectors(jugador.pos, quien.pos).normalize();
      jugador.recibir(DANO_BAYONETA, frente);
      sonido.golpeRecibido();
      hud.mostrarAviso(quien.esRealista ? '¡Bayonetazo!' : '¡Golpe!', 'malo');
    } else if (objetivo.soldado) {
      objetivo.soldado.recibir(1);
    }
  };

  soldados.push(s);
  return s;
}

function limpiarCampo () {
  for (const s of soldados) s.quitar();
  soldados.length = 0;
}

const vivosDe = bando => soldados.filter(s => s.vivo && s.bando === bando).length;

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
      a.alternarCarga();
      break;
    }
    case 'Space': {
      ev.preventDefault();
      if (jugador.saltar()) { const a = armaActual(); if (a) a.soltarCarga(); }
      break;
    }
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
      combate = !combate;
      hud.mostrarAviso(combate ? '¡Ahí vienen!' : 'Alto el fuego', combate ? 'malo' : 'bien');
      if (!combate) limpiarCampo();
      tProxima = 0;
      tAliado = 0;
      break;
    case 'F3': hud.verDepurar = !hud.verDepurar; break;
    case 'Enter':
      if (!jugador.vivo) {
        jugador.revivir();
        limpiarCampo();
        armas.tercerola.cargarDeUnaVez();
        armas.pistolon.cargarDeUnaVez();
        if (armas.fusil) armas.fusil.cargarDeUnaVez();
        cartuchos = 24;
        hud.mostrarAviso('En pie', 'bien');
      }
      break;
  }
});
addEventListener('keyup', ev => { teclas.delete(ev.code); });

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
  for (const s of soldados) {
    if (s.vivo && s.esRealista) masCerca = Math.min(masCerca, s.pos.distanceTo(jugador.pos));
  }
  const presion = Math.min(1,
    Math.max(0, (14 - masCerca) / 14) * 0.7 +
    Math.max(0, (45 - jugador.aliento) / 45) * 0.2 +
    (1 - jugador.vida / 100) * 0.35);

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
  mundo.niebla.actualizar(dt);

  for (let i = soldados.length - 1; i >= 0; i--) {
    const s = soldados[i];
    s.actualizar(dt, jugador, soldados);
    if (!s.vivo && s.caida >= 1) {
      s.tMuerto = (s.tMuerto || 0) + dt;
      if (s.tMuerto > 45) { s.quitar(); soldados.splice(i, 1); }
    }
  }

  if (combate && jugador.vivo) {
    tProxima -= dt;
    if (tProxima <= 0 && vivosDe('realista') < 5) {
      soltarSoldado('realista');
      tProxima = 6 + Math.random() * 5;
    }
    tAliado -= dt;
    if (tAliado <= 0 && vivosDe('granadero') < 3) {
      soltarSoldado('granadero');
      tAliado = 9 + Math.random() * 6;
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
    vida: jugador.vida,
    regenerando: jugador.tSinDano > 4.5 && jugador.vida < 100,
    vendas: jugador.vendas,
    vendando: Math.max(0, jugador.vendando),
    enemigos: vivosDe('realista'),
    aliados: vivosDe('granadero'),
    humoLocal: humo.densidadEn(jugador.pos),
    presion,
    nubes: humo.vivas,
    fps,
    draws: info.calls,
    tris: info.triangles
  });
}
cuadro();

window.juego = { jugador, armas, sable, humo, fuego, soldados, escena, soltarSoldado,
  get arma () { return armaActual(); } };
