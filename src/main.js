import * as THREE from 'three';
import { construirMundo, entornoIluminacion } from './mundo.js';
import { Humo } from './humo.js';
import { Fuego } from './fuego.js';
import { Sonido } from './audio.js';
import { Jugador } from './jugador.js';
import { ArmaFuego } from './armas.js';
import { Sable } from './sable.js';
import { Soldado } from './soldados.js';
import { Caballo } from './caballo.js';
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
let ultimoInfo = { calls: 0, triangles: 0 };
let caballo = null;
// Todos los caballos del campo: el del jugador, los de los lanceros y los que
// quedaron sueltos. El bucle actualiza los que nadie actualizó ya.
const caballos = [];
const montado = () => !!jugador.monta && jugador.monta.vivo;

function nuevoCaballo (pos, rumbo) {
  const c = new Caballo(escena, mundo.colisiones, pos);
  c.rumbo = rumbo || 0;
  caballos.push(c);
  return c;
}

function ponerCaballo () {
  if (caballo) { caballo.quitar(); const i = caballos.indexOf(caballo); if (i >= 0) caballos.splice(i, 1); }
  caballo = nuevoCaballo(new THREE.Vector3(2.6, 0, 2.0), Math.PI);
}

// El caballo suelto más cercano. Si a un lancero le voltearon el jinete, su
// caballo queda ahí y se puede tomar: en el campo sobran caballos sin dueño.
function caballoCerca (metros) {
  let mejor = null, mejorD = metros;
  for (const c of caballos) {
    if (!c.vivo || c.montado) continue;
    const d = c.pos.distanceTo(jugador.pos);
    if (d < mejorD) { mejor = c; mejorD = d; }
  }
  return mejor;
}

function montarODesmontar () {
  if (montado()) {
    jugador.desmontar();
    hud.mostrarAviso('Pie a tierra', 'bien');
    return;
  }
  const c = caballoCerca(3.6);
  if (!c) { hud.mostrarAviso('No hay caballo cerca', 'malo'); return; }
  caballo = c;
  jugador.montar(c);
  hud.mostrarAviso('A caballo · W sube el andar, S lo baja · Espacio salta', 'bien');
}

// Te sacan de la silla. Vale la misma regla para vos que para la tropa: un
// golpe fuerte te voltea aunque no te mate, y el suelo cobra aparte.
function voltear (aviso) {
  if (!montado()) return false;
  const c = jugador.monta;
  jugador.desmontar();
  jugador.recibir(CAIDA, new THREE.Vector3(0, 0, 1));
  jugador.sacudir(0.9);
  sonido.golpeRecibido();
  c.andar = 3;                 // el caballo se dispara sin jinete
  hud.mostrarAviso(aviso || '¡Te voltearon!', 'malo');
  return true;
}

// daño que hace una bala de plomo y una bayoneta al jugador
const DANO_BALA = 52;
const DANO_BAYONETA = 34;
const DANO_SABLE = 2;
const DANO_REMATE = 4;          // el remate mata de una: es lo que paga la parada
const GUARDIA_GASTO = 11;       // aliento por segundo aguantando el sable en alto
const BLOQUEO_GASTO = 26;       // lo que cuesta parar tarde
const PECHADA_GASTO = 18;
const PECHADA_ALCANCE = 2.2;
const ALCANCE_MONTADO = 3.3;    // desde arriba llegás más lejos
const CAIDA = 16;               // lo que cuesta pegar contra el suelo
// Cuánta gente aguanta el campo a la vez. NO es un número inventado: sale de
// medir (pruebas/escala.mjs). Cada hombre cuesta ~11 llamadas de dibujo y cada
// caballo ~9, y el escenario ya se lleva 313 con el campo vacío. Con estos
// topes el peor caso ronda las 600 llamadas.
//   20 lanceros            →   572
//   40 lanceros            →   899
//   90 lanceros + 60 a pie → 2.786   ← acá no lo corre nadie
// Los 120 granaderos de verdad entran recién con niveles de detalle: un hombre
// lejano no necesita quince mallas articuladas, necesita una sola. Eso es Fase 4.
const ALIADOS_MAX = 6;
const ENEMIGOS_MAX = 10;
const MONTADOS = 0.66;          // qué proporción de granaderos sale a caballo

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
  // un caballo es un blanco enorme: si se cruza, se lo come él
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
// Busca al realista más cercano dentro del cono de adelante.
function enemigoAlFrente (alcance, cono = 0.5) {
  const frente = new THREE.Vector3();
  camara.getWorldDirection(frente);
  let mejor = null, mejorD = Infinity;
  for (const s of soldados) {
    if (!s.vivo || !s.esRealista) continue;
    const hacia = new THREE.Vector3().subVectors(s.cabeza(), camara.position);
    const dist = hacia.length();
    if (dist > alcance || dist >= mejorD) continue;
    hacia.normalize();
    if (hacia.dot(frente) < cono) continue;
    mejor = s; mejorD = dist;
  }
  return mejor ? { soldado: mejor, frente } : null;
}

function resolverGolpe (alcance, dano, nombre) {
  const g = enemigoAlFrente(alcance);
  if (!g) return;
  sonido.impactoCarne();
  if (g.soldado.recibir(dano, g.frente)) hud.mostrarAviso(nombre, 'bien');
}

// El sablazo choca contra el acero si el realista está en guardia. Ahí está
// la lección del duelo: no se entra de frente, se espera el aviso.
sable.alGolpear = () => {
  const remate = sable.remate;
  const g = enemigoAlFrente(montado() ? ALCANCE_MONTADO : 2.4);
  if (!g) return;
  if (g.soldado.cubierto && !remate) {
    sonido.choque();
    jugador.sacudir(0.16);
    hud.mostrarAviso('Paró el sablazo', 'malo');
    return;
  }
  sonido.impactoCarne();
  // Desde el caballo el sable no corta con el brazo: corta con la velocidad.
  const filo = montado() ? jugador.monta.filoPorVelocidad : 1;
  const dano = Math.round((remate ? DANO_REMATE : DANO_SABLE) * filo);
  if (g.soldado.recibir(dano, g.frente)) {
    hud.mostrarAviso(remate ? '¡Rematado!' : (filo > 2 ? '¡Lo llevó puesto!' : 'A sablazos'), 'bien');
  }
};

// --------------------------- el duelo ---------------------------
// Verdadero cuando el sable está en la mano: ahí el click derecho deja de
// apuntar y pasa a cubrir.
function conSable () { return !armaActual() && !sable.guardado; }

function pechada () {
  if (!conSable() || jugador.aliento < PECHADA_GASTO + 4) {
    if (conSable()) hud.mostrarAviso('Sin aliento', 'malo');
    return;
  }
  jugador.aliento -= PECHADA_GASTO;
  sonido.pechada();
  jugador.sacudir(0.2);
  const g = enemigoAlFrente(PECHADA_ALCANCE, 0.35);
  if (!g) return;
  // la pechada no hiere: rompe la guardia y lo deja abierto
  g.soldado.aturdir(0.9);
  const empuje = new THREE.Vector3(g.frente.x, 0, g.frente.z).normalize();
  g.soldado.pos.addScaledVector(empuje, 0.7);
  hud.mostrarAviso('¡Pechada! Quedó abierto', 'bien');
}

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
    armas.fusil.cargarDeUnaVez();      // el realista no llegó a tirar
    cambiarLarga('fusil');
    hud.mostrarAviso('Fusil con bayoneta · cargado', 'bien');
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
function soltarSoldado (bando, op = {}) {
  let pos;
  if (bando === 'realista') {
    pos = new THREE.Vector3((Math.random() - 0.5) * 26, 0, -58 - Math.random() * 22);
  } else if (op.montado) {
    // Los lanceros no forman al lado tuyo: salen de los flancos, como salieron
    // los granaderos de atrás del convento. Necesitan cancha para embalar.
    const lado = Math.random() < 0.5 ? -1 : 1;
    pos = new THREE.Vector3(lado * (24 + Math.random() * 10), 0, -6 - Math.random() * 26);
  } else {
    // los granaderos de a pie forman a los costados del jugador
    pos = new THREE.Vector3(jugador.pos.x + (Math.random() - 0.5) * 16, 0, 2 + Math.random() * 6);
  }
  const sop = {};
  if (op.montado) {
    sop.caballo = nuevoCaballo(pos.clone(), Math.atan2(-pos.x, -pos.z) + Math.PI);
  }
  if (op.tez) sop.tez = op.tez;
  const s = new Soldado(escena, humo, sonido, pos, bando, sop);

  s.alDisparar = (quien, origen, dir, objetivo) => {
    const oc = humo.oclusion(origen, objetivo.pos);
    const dist = origen.distanceTo(objetivo.pos);
    if (objetivo.jugador) {
      // agachado sos menos blanco; tirado, casi nada
      const punteria = Math.max(0.02, (0.6 - dist / 110 - oc * 0.45) * jugador.cfgPostura.blanco);
      if (Math.random() < punteria) {
        // montado sos un blanco más grande, pero buena parte se la come el caballo
        if (montado() && Math.random() < 0.45) {
          jugador.monta.recibir(2);
          jugador.sacudir(0.3);
          sonido.impactoCarne();
          hud.mostrarAviso('¡Le dieron al caballo!', 'malo');
        } else if (montado()) {
          // una bala de plomo arriba de un caballo no te hiere: te tira
          jugador.recibir(DANO_BALA, dir);
          sonido.golpeRecibido();
          voltear('¡Te bajaron de un balazo!');
        } else {
          jugador.recibir(DANO_BALA, dir);
          sonido.golpeRecibido();
          hud.mostrarAviso('¡Te dieron!', 'malo');
        }
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
      // ¿venías cubriendo? Y sobre todo: ¿desde hace cuánto?
      const parada = conSable() ? sable.recibir() : false;
      if (parada === 'perfecta') {
        sonido.parada();
        jugador.sacudir(0.22);
        quien.aturdir();
        hud.mostrarAviso('¡PARADA! Rematalo', 'bien');
        return;
      }
      if (parada === 'bloqueo') {
        sonido.choque();
        jugador.sacudir(0.34);
        jugador.aliento = Math.max(0, jugador.aliento - BLOQUEO_GASTO);
        // el acero no entra, pero el envión sí
        jugador.recibir(Math.round(DANO_BAYONETA * 0.18), frente);
        if (jugador.aliento <= 0) { sable.bajarGuardia(); hud.mostrarAviso('Te desarmó la guardia', 'malo'); }
        else hud.mostrarAviso('Paraste tarde', 'malo');
        return;
      }
      jugador.recibir(DANO_BAYONETA, frente);
      sonido.golpeRecibido();
      // desde abajo la bayoneta te busca la pierna y la silla: te voltea
      if (montado()) voltear('¡Te sacaron de la silla!');
      else hud.mostrarAviso(quien.esRealista ? '¡Bayonetazo!' : '¡Golpe!', 'malo');
    } else if (objetivo.soldado) {
      const o = objetivo.soldado;
      // El lanzazo del granadero mata de una: el asta llega antes que la
      // bayoneta y ese metro de diferencia es toda la batalla.
      // Contra un jinete, en cambio, la bayoneta no busca matar: busca
      // voltearlo. Es el único recurso que le queda a la infantería.
      if (quien.lancero) o.recibir(3);
      else o.recibir(o.montado ? 3 : 1);
    }
  };

  soldados.push(s);
  return s;
}

function limpiarCampo () {
  for (const s of soldados) s.quitar();
  soldados.length = 0;
  for (let i = caballos.length - 1; i >= 0; i--) {
    if (caballos[i] === caballo) continue;
    caballos[i].quitar();
    caballos.splice(i, 1);
  }
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
      // A caballo el espacio no salta a vos: bate al caballo. Y no batís
      // parado —hace falta trote— porque un caballo tampoco salta parado.
      if (montado()) {
        const c = jugador.monta;
        if (c.saltar()) { jugador.sacudir(0.25); }
        else hud.mostrarAviso(c.vel < 2.2 ? 'Falta carrera para saltar' : 'Todavía no', 'malo');
        break;
      }
      ev.preventDefault();
      if (jugador.saltar()) { const a = armaActual(); if (a) a.soltarCarga(); }
      break;
    }
    // Agacharse va en C y no en Ctrl: el navegador se queda con Ctrl+W y
    // cierra la pestaña, y eso no hay forma de bloquearlo desde la página.
    case 'KeyC': jugador.alternarPostura('agachado'); break;
    case 'KeyZ': jugador.alternarPostura('tierra'); break;
    case 'KeyF': {
      const a = armaActual();
      if (a) a.puntazo(); else pechada();
      break;
    }
    case 'KeyH': montarODesmontar(); break;
    case 'KeyW': if (montado()) jugador.monta.subirAndar(); break;
    case 'KeyS': if (montado()) jugador.monta.bajarAndar(); break;
    case 'KeyG': tomarOIntercambiar(); break;
    case 'Digit1': cambiarArma('larga'); break;
    case 'Digit2': cambiarArma('sable'); break;
    case 'Digit3': cambiarArma('pistolon'); break;
    case 'KeyB': hud.verCartuchera(); break;
    case 'KeyV': if (jugador.vendar()) hud.mostrarAviso('Vendando', 'bien'); break;
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
        ponerCaballo();
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
  if (ev.button === 2) {
    if (conSable()) sable.alzarGuardia();
    else apuntando = true;
  }
});
addEventListener('mouseup', ev => { if (ev.button === 2) { apuntando = false; sable.bajarGuardia(); } });
addEventListener('contextmenu', ev => ev.preventDefault());
addEventListener('mousemove', ev => {
  if (!bloqueado) return;
  jugador.mirar(ev.movementX || 0, ev.movementY || 0, sensibilidad);
});

let bloqueado = false;
let empezado = false;
let tSoltado = 0;
const pantallaPausa = document.getElementById('pausa');

function mostrarPausa (si) {
  pantallaPausa.classList.toggle('oculto', !si);
  document.body.style.cursor = si ? 'default' : 'none';
}

// El navegador rechaza volver a tomar el mouse si se pide demasiado seguido
// después de soltarlo, así que se espera un momento.
function pedirMouse () {
  if (!empezado) return;
  if (performance.now() - tSoltado < 1300) return;
  lienzo.requestPointerLock();
}

document.addEventListener('pointerlockchange', () => {
  bloqueado = document.pointerLockElement === lienzo;
  if (!bloqueado) {
    teclas.clear();
    apuntando = false;
    sable.bajarGuardia();
    tSoltado = performance.now();
    if (empezado) mostrarPausa(true);
  } else {
    mostrarPausa(false);
  }
});
document.addEventListener('pointerlockerror', () => {
  bloqueado = false;
  if (empezado) mostrarPausa(true);
});
pantallaPausa.addEventListener('click', pedirMouse);

// Soltar el mouse pase lo que pase. Sin esto el puntero queda capturado y
// desaparece en las otras pestañas del navegador.
function soltarMouse () {
  teclas.clear();
  apuntando = false;
  sable.bajarGuardia();
  document.body.style.cursor = 'default';
  if (document.pointerLockElement) document.exitPointerLock();
}
addEventListener('blur', soltarMouse);
addEventListener('pagehide', soltarMouse);
addEventListener('beforeunload', soltarMouse);
document.addEventListener('visibilitychange', () => { if (document.hidden) soltarMouse(); });

document.getElementById('empezar').addEventListener('click', () => {
  document.getElementById('portada').classList.add('oculto');
  sonido.iniciar();
  empezado = true;
  tSoltado = 0;
  lienzo.requestPointerLock();
});

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
  const crudo = Math.min(0.05, reloj.getDelta());
  // en pausa se sigue dibujando, pero el mundo no corre
  const dt = (empezado && !bloqueado) ? 0 : crudo;
  fps = fps * 0.92 + (1 / Math.max(crudo, 0.0001)) * 0.08;

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

  // Los caballos con jinete los mueve su jinete; los demás —el tuyo y los que
  // quedaron sueltos— los mueve el bucle. El cadáver dura 45 s, lo mismo que
  // el de un hombre, y recién ahí se lo lleva el campo.
  for (let i = caballos.length - 1; i >= 0; i--) {
    const c = caballos[i];
    if (c.actualizado) { c.actualizado = false; continue; }
    const mando = { girar: 0 };
    if (jugador.monta === c) {
      mando.girar = (teclas.has('KeyD') ? 1 : 0) - (teclas.has('KeyA') ? 1 : 0);
    }
    c.actualizar(dt, mando);
    if (!c.vivo && c.tMuerto > 45) {
      c.quitar();
      caballos.splice(i, 1);
      if (caballo === c) caballo = null;
    }
  }
  // si te matan el caballo, te vas al suelo con el golpe puesto
  if (jugador.monta && !jugador.monta.vivo) {
    jugador.desmontar();
    jugador.recibir(CAIDA, new THREE.Vector3(0, 0, 1));
    jugador.sacudir(0.9);
    sonido.golpeRecibido();
    hud.mostrarAviso('¡Te mataron el caballo!', 'malo');
  }

  jugador.actualizar(dt, teclas, quiereApuntar, arma ? arma.cargando : false);

  const p = jugador.cfgPostura;
  // A caballo no se carga: al trote la baqueta no entra. Al paso, con dificultad.
  const penalMonta = montado() ? (jugador.monta.vel > 3 ? 0 : 2.4) : 1;
  const ctx = { apuntando, presion, penalCarga: p.penalCarga * penalMonta, dispersion: p.dispersion * (montado() ? 1.9 : 1) };
  armas.tercerola.actualizar(dt, ctx);
  armas.pistolon.actualizar(dt, ctx);
  if (armas.fusil) armas.fusil.actualizar(dt, ctx);
  // Aguantar el sable en alto cansa. Sin aliento la guardia se cae sola, que
  // es lo que impide jugar todo el duelo con el botón derecho apretado.
  if (sable.guardia) {
    jugador.aliento = Math.max(0, jugador.aliento - GUARDIA_GASTO * dt);
    if (jugador.aliento <= 0) {
      sable.bajarGuardia();
      hud.mostrarAviso('Se te cayó la guardia', 'malo');
    }
  }
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
    if (tProxima <= 0 && vivosDe('realista') < ENEMIGOS_MAX) {
      soltarSoldado('realista');
      tProxima = 6 + Math.random() * 5;
    }
    tAliado -= dt;
    if (tAliado <= 0 && vivosDe('granadero') < ALIADOS_MAX) {
      // dos de cada tres granaderos van montados con lanza: era un regimiento
      // de caballería, no de infantería
      soltarSoldado('granadero', { montado: Math.random() < MONTADOS });
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
  ultimoInfo = info;   // render.info se reinicia en cada render(); esta es la suma real

  hud.actualizar(crudo, {
    paso: arma ? arma.infoPaso() : null,
    aliento: jugador.aliento,
    cartuchos,
    nombreArma: arma ? arma.nombre : 'Sable corvo',
    estadoArma: arma ? arma.etiquetaEstado : 'en mano',
    postura: montado() ? jugador.monta.nombreAndar : p.nombre,
    puedeTomarFusil: !armas.fusil && !!caidoConFusil(),
    remate: sable.tRemate,
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
ponerCaballo();
cuadro();

window.juego = { jugador, armas, sable, humo, fuego, soldados, escena, camara, render, soltarSoldado,
  get caballo () { return caballo; }, caballos, montarODesmontar, voltear,
  // para probar escalas a mano desde la consola: juego.formar(20, 30)
  formar (lanceros = 10, realistas = 10) {
    for (let i = 0; i < lanceros; i++) soltarSoldado('granadero', { montado: true });
    for (let i = 0; i < realistas; i++) soltarSoldado('realista');
    return { hombres: soldados.length, caballos: caballos.length };
  },
  get info () { return ultimoInfo; },
  get arma () { return armaActual(); } };
