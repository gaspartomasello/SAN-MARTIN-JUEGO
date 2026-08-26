import * as THREE from 'three';
import { construirMundo, entornoIluminacion } from './mundo.js';
import { Humo } from './humo.js';
import { Fuego } from './fuego.js';
import { Sonido } from './audio.js';
import { Jugador } from './jugador.js';
import { ArmaFuego } from './armas.js';
import { Sable } from './sable.js';
import { Soldado, VOLTEO, OFICIO } from './soldados.js';
import { Caballo } from './caballo.js';
import { Canon } from './canon.js';
import { ActoCabral } from './acto.js';
import { PasadaArma } from './pasadaArma.js';
import { PasadaVelocidad } from './pasadaVelocidad.js';
import { Lejania } from './lejania.js';
import { Rejilla, separar, RADIO_HOMBRE, RADIO_CABALLO } from './estorbos.js';
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
// LA LEJANÍA. Todo lo que esté más allá de LOD_CERCA deja de ser un esqueleto
// articulado y pasa a ser una instancia horneada: ciento veinte granaderos a
// ochenta metros cuestan lo mismo que uno. Es lo que hace posible la pinza.
let LOD_CERCA = 30;
const lejania = new Lejania(escena, 320);

// Se reparte ANTES de mover a nadie —el que está lejos no arma el cuerpo— y se
// pinta DESPUÉS, cuando las posiciones del cuadro ya están puestas.
function repartirLejania () {
  const ojo = jugador.pos;
  for (const s of soldados) {
    s.ponerLejos(Math.hypot(s.pos.x - ojo.x, s.pos.z - ojo.z) > LOD_CERCA);
  }
  for (const c of caballos) {
    if (c.jinete) continue;                       // lo manda su jinete
    if (jugador.monta === c) { c.lejos = false; continue; }
    c.lejos = Math.hypot(c.pos.x - ojo.x, c.pos.z - ojo.z) > LOD_CERCA;
  }
}

// LOS BOTS OCUPAN LUGAR.
//
// La separación se hace en una pasada aparte, DESPUÉS de que todos se movieron.
// Si se hiciera adentro de cada uno, el primero de la lista empujaría a los
// demás y el último no empujaría a nadie: el orden del array se volvería una
// ventaja. Así, todos ceden la mitad.
//
// Y el caballo empuja, pero no se deja empujar. Un escuadrón de caballería que
// se frena porque le pusieron infantes adelante no es caballería. El hombre se
// aparta —o lo ensartan—, el caballo pasa.
const rejilla = new Rejilla(2);
const _emp = { x: 0, z: 0 };

function apretujar () {
  separar(soldados, rejilla, RADIO_HOMBRE);
  for (const c of caballos) {
    if (!c.vivo) continue;
    const r = RADIO_CABALLO + RADIO_HOMBRE;
    rejilla.cerca(c.pos.x, c.pos.z, s => {
      if (!s.vivo || s.montado) return;
      const dx = s.pos.x - c.pos.x, dz = s.pos.z - c.pos.z;
      const q = dx * dx + dz * dz;
      if (q >= r * r) return;
      const l = Math.sqrt(q) || 0.001;
      const e = r - l;
      s.pos.x += (dx / l) * e;
      s.pos.z += (dz / l) * e;
    });
  }
}

function pintarLejania () {
  lejania.comenzar();
  for (const s of soldados) s.pintarLejos(lejania);
  for (const c of caballos) {
    if (!c.lejos || c.jinete) continue;
    const fase = !c.vivo ? 3 : (c.vel > 3 ? (Math.sin(c.paso) > 0 ? 1 : 2) : 0);
    lejania.poner('caballo', fase, c.pos.x, c.alto, c.pos.z, c.rumbo);
  }
  lejania.terminar();
}
const sonido = new Sonido();
const hud = new Hud();
const jugador = new Jugador(camara, mundo.colisiones);
const pasadaArma = new PasadaArma(render, escenaArma, camaraArma);
const pasadaVel = new PasadaVelocidad(render, escena, camara);

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
  // Los cascos levantan tierra por el MISMO sistema que el humo de pólvora,
  // así que la polvareda de una carga tapa la vista de verdad —la tuya y la
  // de la IA— y no es sólo un adorno.
  c.humo = humo;
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

// A SAN MARTÍN CUESTA BAJARLO.
//
// Cada golpe que puede voltearte tira los dados una vez. La probabilidad sale
// de la tabla VOLTEO —el arma manda— y se le resta el oficio del jinete. Un
// balazo lo baja una de cada trece veces; un lancero, una de cada cinco.
//
// Y hay una segunda cuenta, que es la que hace que esto no sea una lotería
// suelta: EL AGARRE. Cada golpe que aguantás te afloja de la silla, y el
// siguiente te encuentra peor agarrado. Si te dejan en paz unos segundos, te
// recomponés. O sea que no hay un tiro que te baje: hay una acumulación, y la
// respuesta correcta a que te tambaleen es salir de ahí, no seguir cargando.
function intentarVoltear (base, aviso) {
  if (!montado()) return false;
  const riesgo = base * (1 - OFICIO * jugador.agarre);
  if (Math.random() < riesgo) return voltear(aviso);
  // aguantó. Se nota: la cámara se sacude fuerte y el agarre se afloja.
  jugador.agarre = Math.max(0, jugador.agarre - 0.26);
  jugador.sacudir(0.45 + (1 - jugador.agarre) * 0.35);
  sonido.golpeRecibido();
  if (jugador.agarre < 0.45) hud.mostrarAviso('¡Te vas de la silla!', 'malo');
  else hud.mostrarAviso('Te tambaleaste', 'malo');
  return false;
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
// medir (pruebas/escala.mjs y pruebas/lejania.mjs).
//
// Antes de la lejanía, cada hombre costaba ~11 llamadas de dibujo y cada
// caballo ~9, así que el techo lo ponía el dibujo y estaba bajísimo:
//   20 lanceros            →   572 llamadas
//   40 lanceros            →   899
//   90 lanceros + 60 a pie → 2.267   ← acá no lo corre nadie
// Con la lejanía el dibujo dejó de ser el techo. Medido, con los números
// REALES de la batalla —120 granaderos a caballo en dos columnas de 60 y 250
// infantes realistas—:
//   370 hombres            →    99 llamadas, 486 mil triángulos, 1,7 ms de simulación
// O sea: San Lorenzo entero entra en el presupuesto. Lo que ahora manda no es
// el dibujo sino la simulación, que crece con el cuadrado de la gente porque
// cada uno busca su blanco entre todos.
//
// Igual los topes suben DE A POCO y no de un salto a 120: el número que
// aguanta la máquina y el número que hace buena la pelea no son el mismo.
const ALIADOS_MAX = 20;
const ENEMIGOS_MAX = 34;
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
  for (const c of canones) if (c.vivo) candidatos.push(c.malla);
  // un caballo es un blanco enorme: si se cruza, se lo come él
  const golpes = rayo.intersectObjects(candidatos, true);

  const g = golpes[0];
  fuego.disparo(origen, d, g ? g.distance : 140);
  if (!g) return;

  let raiz = g.object;
  while (raiz.parent && raiz.parent !== escena) raiz = raiz.parent;

  const canon = canones.find(c => c.malla === raiz);
  if (canon) {
    sonido.impactoMadera();
    humo.soltar(g.point, d, { cantidad: 2, vida: 2, empuje: 1, radio: 0.1, opacidad: 0.3 });
    if (canon.recibir(1)) hud.mostrarAviso('¡Pieza desmontada!', 'bien');
    return;
  }
  const soldado = soldados.find(s => s.malla === raiz);
  if (soldado) {
    sonido.impactoCarne();
    humo.soltar(g.point, d, { cantidad: 3, vida: 2.5, empuje: 1.4, radio: 0.1, opacidad: 0.35, claro: 0 });
    if (soldado.recibir(2, d, VOLTEO.bala)) hud.mostrarAviso('Realista abatido', 'bien');
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
  if (g.soldado.recibir(dano, g.frente, VOLTEO.bayoneta)) hud.mostrarAviso(nombre, 'bien');
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
  // el sable desde arriba también puede bajarlo de la silla, y a la velocidad
  // del galope más: es el mismo principio del lanzazo con menos asta
  const vuelca = montado() ? Math.min(VOLTEO.lanza, VOLTEO.bayoneta * filo) : VOLTEO.bayoneta;
  if (g.soldado.recibir(dano, g.frente, vuelca)) {
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
//
// Los parapetos: las cajas de colisión que llegan a la cintura pero no tapan
// la vista. Una tapia de tres metros no es cubierta, es una pared; un barril
// de medio metro tampoco. Se calculan UNA vez, no cada cuadro.
const parapetos = mundo.colisiones
  .filter(c => c.max.y > 0.55 && c.max.y < 1.55)
  .map(c => ({
    x: (c.min.x + c.max.x) / 2,
    z: (c.min.z + c.max.z) / 2,
    r: Math.max(c.max.x - c.min.x, c.max.z - c.min.z) / 2
  }))
  .filter(p => p.r < 6);

function soltarSoldado (bando, op = {}) {
  let pos;
  if (op.pos) {
    pos = op.pos.clone();
  } else if (bando === 'realista') {
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
  const sop = { cubiertas: parapetos, colisiones: mundo.colisiones };
  // El caballo sólo se le da a un granadero. Los españoles desembarcaron 250
  // infantes y dos cañones: ni una montura en toda la fuerza.
  if (op.montado && bando === 'granadero') {
    sop.caballo = nuevoCaballo(pos.clone(), Math.atan2(-pos.x, -pos.z) + Math.PI);
  }
  if (op.tez) sop.tez = op.tez;
  const s = new Soldado(escena, humo, sonido, pos, bando, sop);

  s.alDisparar = (quien, origen, dir, objetivo) => {
    const oc = humo.oclusion(origen, objetivo.pos);
    const dist = origen.distanceTo(objetivo.pos);
    if (objetivo.jugador) {
      if (jugador.atrapado > 0) return;
      // agachado sos menos blanco; tirado, casi nada
      // hincado apunta mejor: es lo que compra el aviso que te dio al hincarse
      const pulso = quien.rodilla ? 1.35 : 1;
      const punteria = Math.max(0.02, (0.6 - dist / 110 - oc * 0.45) * jugador.cfgPostura.blanco * pulso);
      if (Math.random() < punteria) {
        // montado sos un blanco más grande, pero buena parte se la come el caballo
        if (montado() && Math.random() < 0.45) {
          // La bala que se come el caballo lo lastima, pero hacen falta seis:
          // el que lo voltea de una es el tarro de metralla, y así tiene que
          // ser, porque de ahí sale el acto.
          jugador.monta.recibir(1);
          jugador.sacudir(0.3);
          sonido.impactoCarne();
          hud.mostrarAviso('¡Le dieron al caballo!', 'malo');
        } else if (montado()) {
          // la bala te hiere igual; que además te baje de la silla es otra
          // cuenta, y una que rara vez sale
          jugador.recibir(DANO_BALA, dir);
          intentarVoltear(VOLTEO.bala, '¡Te bajaron de un balazo!');
        } else {
          jugador.recibir(DANO_BALA, dir);
          sonido.golpeRecibido();
          hud.mostrarAviso('¡Te dieron!', 'malo');
        }
      } else {
        jugador.sacudir(0.12);
      }
    } else if (objetivo.soldado) {
      const punteria = Math.max(0.03, (0.5 - dist / 120 - oc * 0.45) * (quien.rodilla ? 1.35 : 1));
      if (Math.random() < punteria) objetivo.soldado.recibir(2, dir, VOLTEO.bala);
    }
  };

  s.alGolpear = (quien, objetivo) => {
    if (objetivo.jugador) {
      // Durante el acto no te pueden rematar. No es piedad: es que la historia
      // dice que no te remataron, y el jugador no puede defenderse.
      if (jugador.atrapado > 0) { jugador.sacudir(0.3); return; }
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
      // desde abajo la bayoneta te busca la pierna y el estribo: es lo que
      // mejor te tira, pero tampoco alcanza sola
      if (montado()) intentarVoltear(quien.lancero ? VOLTEO.lanza : VOLTEO.bayoneta, '¡Te sacaron de la silla!');
      else {
        sonido.golpeRecibido();
        hud.mostrarAviso(quien.esRealista ? '¡Bayonetazo!' : '¡Golpe!', 'malo');
      }
    } else if (objetivo.soldado) {
      const o = objetivo.soldado;
      // El lanzazo del granadero mata de una: el asta llega antes que la
      // bayoneta y ese metro de diferencia es toda la batalla.
      // Contra un jinete, en cambio, la bayoneta no busca matar: busca
      // voltearlo. Es el único recurso que le queda a la infantería.
      if (quien.lancero) o.recibir(3, null, VOLTEO.lanza);
      // La bayoneta contra un jinete ya no lo baja siempre. Y si no lo baja,
      // lo hiere: antes el golpe se perdía entero cuando el desmonte no
      // salía, y un infante contra un lancero se quedaba sin recurso.
      else o.recibir(1, null, VOLTEO.bayoneta);
    }
  };

  soldados.push(s);
  return s;
}

// --------------------------- artillería ---------------------------
//
// Las dos piezas de campaña que los españoles bajaron a la playa. Están del
// lado de la barranca, mirando campo arriba, y son la cosa más peligrosa que
// hay: un tarro de perdigones abre un abanico de cuarenta grados y ochenta
// metros. Pero AVISAN —dos segundos largos de mecha encendida— y se pueden
// callar matando a los artilleros que las sirven.
const canones = [];
const DANO_METRALLA = 74;
const METRALLA_CABALLO = 9;     // al caballo lo voltea de una: son seis de vida

function ponerCanones () {
  for (const c of canones) c.quitar();
  canones.length = 0;
  for (const [x, z, r] of [[-13, -68, Math.PI], [11, -73, Math.PI]]) {
    const c = new Canon(escena, humo, sonido, new THREE.Vector3(x, 0, z), r);
    c.alDisparar = quien => resolverMetralla(quien);
    canones.push(c);
    // dos artilleros por pieza: mientras vivan, la pieza habla
    for (let i = 0; i < 2; i++) {
      const s = soltarSoldado('realista');
      s.malla.position.set(x + (i ? 1.6 : -1.6), 0, z + 1.5);
      s.puesto = { x: s.pos.x, z: s.pos.z };
      c.sirvientes.push(s);
    }
  }
}

// El abanico de metralla. Cobra a todo el que esté adentro del cono, de los
// dos bandos —la metralla no distingue— y castiga más al que va montado,
// porque un caballo es un blanco enorme.
function resolverMetralla (canon) {
  jugador.sacudir(0.5);
  let f = jugador.vivo ? canon.fuerzaSobre(jugador.pos) : 0;
  if (f > 0) {
    sonido.metralla();
    jugador.sacudir(0.5 + f * 0.9);
    if (montado()) {
      // ESTE es el disparo del 3 de febrero: el que volteó el caballo.
      jugador.monta.recibir(Math.round(METRALLA_CABALLO * f));
      hud.mostrarAviso('¡METRALLA!', 'malo');
    } else {
      jugador.recibir(Math.round(DANO_METRALLA * f), new THREE.Vector3(0, 0, -1));
      hud.mostrarAviso('¡Metralla!', 'malo');
    }
  }
  for (const s of soldados) {
    if (!s.vivo) continue;
    const g = canon.fuerzaSobre(s.pos);
    if (g < 0.28) continue;
    if (s.montado) s.monta.recibir(Math.round(METRALLA_CABALLO * g));
    else if (Math.random() < g) s.recibir(3, null, VOLTEO.metralla);
  }
}

// ¿alguna pieza me está cebando encima? Devuelve la peor.
function metrallaEncima () {
  let peor = 0;
  for (const c of canones) {
    if (!c.cebando) continue;
    peor = Math.max(peor, c.fuerzaSobre(jugador.pos));
  }
  return peor;
}

// --------------------------- el acto Cabral ---------------------------
const acto = new ActoCabral({
  escena, humo, sonido, jugador, soldados, hud,
  get parapetos () { return parapetos; }
});

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
  // Bajo el caballo no hay tecla que sirva. El espacio se registra igual —el
  // acto lee el forcejeo de aquí— pero no dispara ninguna acción.
  if (jugador.atrapado > 0) { if (ev.code === 'Space') ev.preventDefault(); return; }
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
  pasadaVel.redimensionar(innerWidth, innerHeight);
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

  repartirLejania();

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
  // Si te matan el caballo te vas al suelo. Y la PRIMERA vez que pasa estando
  // montado no te levantás: la pierna queda debajo. Ahí arranca el acto. No es
  // un guion aparte —es la consecuencia de la mecánica que ya existía—.
  if (jugador.monta && !jugador.monta.vivo) {
    const c = jugador.monta;
    if (acto.puedeArrancar(c)) {
      acto.arrancar(c);
    } else {
      jugador.desmontar();
      jugador.recibir(CAIDA, new THREE.Vector3(0, 0, 1));
      jugador.sacudir(0.9);
      sonido.golpeRecibido();
      hud.mostrarAviso('¡Te mataron el caballo!', 'malo');
    }
  }
  acto.actualizar(dt, teclas);

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

  apretujar();
  pintarLejania();

  // las piezas: buscan blanco, se orientan, ceban y disparan
  if (canones.length) {
    const candidatos = [];
    if (jugador.vivo) candidatos.push({ pos: jugador.pos, montado: montado() });
    for (const s of soldados) if (s.vivo && !s.esRealista) candidatos.push({ pos: s.pos, montado: s.montado });
    for (const c of canones) c.actualizar(dt, candidatos);
  }

  if (combate && jugador.vivo) {
    tProxima -= dt;
    if (tProxima <= 0 && vivosDe('realista') < ENEMIGOS_MAX) {
      soltarSoldado('realista');
      // el campo se llena más rápido que antes porque ahora tiene que llenarse
      // más: con el paso viejo, treinta y cuatro realistas tardaban cinco minutos
      tProxima = 3 + Math.random() * 3;
    }
    tAliado -= dt;
    if (tAliado <= 0 && vivosDe('granadero') < ALIADOS_MAX) {
      // dos de cada tres granaderos van montados con lanza: era un regimiento
      // de caballería, no de infantería
      soltarSoldado('granadero', { montado: Math.random() < MONTADOS });
      tAliado = 4 + Math.random() * 4;
    }
  }

  luzBoca.intensity = Math.max(0, luzBoca.intensity - dt * 260);

  // El mundo pasa por el desenfoque de velocidad; apuntando se apaga, que es
  // cuando menos falta hace y más molesta.
  const embalado = montado() && !quiereApuntar
    ? Math.max(0, (jugador.monta.vel - 4.2) / 6) : 0;
  pasadaVel.dibujar(Math.min(1, embalado), montado() ? jugador.monta.rumbo : null);
  const mundoInfo = { calls: pasadaVel.ultimaInfo.calls, tris: pasadaVel.ultimaInfo.tris };
  // debajo del caballo no se sostiene nada: la capa del arma se apaga
  escenaArma.visible = jugador.atrapado <= 0;
  pasadaArma.dibujar(quiereApuntar ? 1 : 0);
  const info = {
    calls: mundoInfo.calls + pasadaArma.ultimaInfo.calls + 2,   // los dos blits de pantalla completa
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
    rapidez: montado() ? jugador.monta.vel : 0,
    puedeTomarFusil: jugador.atrapado <= 0 && !armas.fusil && !!caidoConFusil(),
    remate: sable.tRemate,
    metralla: metrallaEncima(),
    atrapado: jugador.atrapado,
    forcejeo: acto.forcejeo,
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
ponerCanones();
cuadro();

window.juego = { jugador, armas, sable, humo, fuego, soldados, escena, camara, render, soltarSoldado, lejania, pasadaVel,
  lod: m => { LOD_CERCA = m; }, separarAhora: apretujar, VOLTEO, OFICIO, METRALLA_CABALLO,
  get caballo () { return caballo; }, caballos, canones, acto,
  montarODesmontar, voltear, ponerCanones,
  // para probar escalas a mano desde la consola: juego.formar(20, 30)
  formar (lanceros = 10, realistas = 10) {
    for (let i = 0; i < lanceros; i++) soltarSoldado('granadero', { montado: true });
    for (let i = 0; i < realistas; i++) soltarSoldado('realista');
    return { hombres: soldados.length, caballos: caballos.length };
  },
  get info () { return ultimoInfo; },
  get arma () { return armaActual(); } };
