// ===========================================================================
// EL CLARÍN DE SAN LORENZO · el armado y el bucle
// ===========================================================================
//
// Este archivo hace tres cosas y ninguna más: monta el escenario, ATA los
// sistemas entre sí, y corre el bucle. Toda la lógica vive en su módulo.
//
//   balance.js    los números de la pelea: vida, daño, puntería, volteo
//   combate.js    quién le pega a quién y qué pasa
//   arsenal.js    lo que llevás encima y qué tenés en la mano
//   despliegue.js quién sale al campo, dónde y cuándo
//   gentio.js     quién se dibuja entero y quién ocupa lugar
//   mando.js      el teclado, el mouse y los tres modos
//   moral.js      cuándo un bando deja de pelear y se va
//   plano.js      el mapa de la maniobra, dibujado con las medidas del nivel
//   red.js        el otro costado de la pinza, en la otra máquina
//   protocolo.js  qué se manda por el cable, byte por byte
//
// Los sistemas no se conocen entre sí: cada uno recibe acá lo que necesita.
// Por eso el orden del armado importa y está comentado donde importa.

import * as THREE from 'three';
import { construirMundo, entornoIluminacion } from './mundo.js';
import { Humo } from './humo.js';
import { Fuego } from './fuego.js';
import { Sonido } from './audio.js';
import { Jugador } from './jugador.js';
import { Sable } from './sable.js';
import { Soldado } from './soldados.js';
import { penalCargaMontado } from './caballo.js';
import { ActoCabral } from './acto.js';
import { PasadaArma } from './pasadaArma.js';
import { PasadaVelocidad } from './pasadaVelocidad.js';
import { Lejania } from './lejania.js';
import { Pinza } from './pinza.js';
import { Hud } from './hud.js';
import { armarCombate } from './combate.js';
import { armarArsenal } from './arsenal.js';
import { armarDespliegue } from './despliegue.js';
import { armarGentio } from './gentio.js';
import { armarMando } from './mando.js';
import { armarMoral } from './moral.js';
import { armarPlano } from './plano.js';
import { armarRed } from './red.js';
import { VOLTEO, OFICIO, METRALLA_CABALLO, CAIDA } from './balance.js';

// ---------------------------------------------------------------------------
// el escenario
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
const lejania = new Lejania(escena, 320);
const sonido = new Sonido();
const hud = new Hud();
const jugador = new Jugador(camara, mundo.colisiones);
const sable = new Sable(camaraArma, sonido);
const pasadaArma = new PasadaArma(render, escenaArma, camaraArma);
const pasadaVel = new PasadaVelocidad(render, escena, camara);

const entorno = entornoIluminacion(render);
escena.environment = entorno;
escena.environmentIntensity = 0.3;
escenaArma.environment = entorno;
escenaArma.environmentIntensity = 0.95;

const luzBoca = new THREE.PointLight(0xffc46a, 0, 16, 2);
escena.add(luzBoca);

// las dos poblaciones del campo, compartidas por todos los sistemas
const soldados = [];
const caballos = [];
const montado = () => !!jugador.monta && jugador.monta.vivo;

// ---------------------------------------------------------------------------
// el armado
// ---------------------------------------------------------------------------
const pinza = new Pinza();

// COMBATE PRIMERO, porque los otros dos dependen de él: el despliegue le ata
// sus ganchos a cada soldado que suelta y el arsenal necesita a quién avisarle
// cuando el arma dispara. A cambio, combate.js recibe dos cosas que todavía no
// existen: el array de piezas —que lo llena el despliegue— y `conSable`, que
// se resuelve recién en tiempo de ejecución porque el arsenal se arma después.
let arsenal = null;
const canones = [];
const combate = armarCombate({
  escena, camara, jugador, soldados, canones, mundo,
  humo, fuego, sonido, hud, sable, luzBoca,
  montado, conSable: () => arsenal.conSable()
});

// Un solo enganche extra en red: cada vez que tu arma escupe, el otro jugador
// tiene que ver el fogonazo. El daño no pasa por ahí —lo resuelve combate.js
// como siempre, contra los títeres, que ya saben cómo pedir permiso—.
let red = null;
arsenal = armarArsenal({
  camara, camaraArma, sonido, humo, hud, sable, jugador, soldados,
  resolverDisparo: (o, d, disp) => {
    if (red) red.avisarTiro(o, d);
    combate.resolverDisparo(o, d, disp);
  },
  resolverGolpe: combate.resolverGolpe
});
sable.alGolpear = combate.sablazo;

// el array de piezas es el MISMO que ve combate.js: el despliegue las pone y
// combate.js les cobra los balazos
const campo = armarDespliegue({
  escena, mundo, humo, sonido, hud, jugador, soldados, caballos, pinza, canones,
  // el disparo de la tropa y el cañonazo también se le cuentan al otro: son
  // los dos ruidos que arman la batalla y sin ellos el campo se siente mudo
  disparoEnemigo: (q, o, d, ob) => {
    if (red) red.avisarTiroTropa(o, d);
    combate.disparoEnemigo(q, o, d, ob);
  },
  golpeEnemigo: combate.golpeEnemigo,
  resolverMetralla: c => {
    if (red) red.avisarCanon(c);
    combate.resolverMetralla(c);
  }
});

const gentio = armarGentio({ jugador, soldados, caballos, lejania });

// LA RED. Va último porque necesita el campo ya armado, y hasta que alguien
// no elija «Los dos costados» en la portada no hace absolutamente nada: en
// solo, `red.esInvitado` es false y el juego corre igual que siempre.
//
// La pose es lo único que el otro no puede deducir de una posición: si vas
// apuntando, cargando, con el sable en alto o embalado con la lanza. Va por
// el cable en una palabra y del otro lado la figura se arma sola.
function poseDelJugador () {
  if (!jugador.vivo) return 'aturdido';
  if (montado()) return jugador.monta.vel > 4.2 ? 'enristre' : 'lanzaAlto';
  const a = arsenal.actual();
  if (!a) return 'guardia';
  if (a.cargando) return 'recargar';
  if (arsenal.apuntando) return 'apuntar';
  return 'marcha';
}

red = armarRed({
  escena, humo, fuego, sonido, hud, jugador,
  soldados, caballos, canones, pinza, campo, luzBoca, montado,
  poseDelJugador, intentarVoltear: combate.intentarVoltear
});

// LA MORAL. Va después de la red porque el «se quiebra la línea» hay que
// contárselo también al que lleva la otra columna, y después del campo porque
// necesita saber cuándo se rearma para volver a cero.
const moral = armarMoral({
  soldados, caballos, canones, hud, sonido, jugador, montado, red
});
campo.alFormar = () => moral.reiniciar();

jugador.alAviso = (t, tipo) => hud.mostrarAviso(t, tipo);
jugador.alMorir = () => hud.mostrarAviso('Fuera de combate', 'malo');

// EL ACTO CABRAL. Arranca la primera vez que te matan el caballo estando
// montado. No es un guion aparte: es la consecuencia de la mecánica.
const acto = new ActoCabral({
  escena, humo, sonido, jugador, soldados, hud,
  get parapetos () { return campo.parapetos; }
});

// cuando el enemigo entra en distancia, la formación se rompe sola. El jugador
// tiene que enterarse: hasta ese momento la columna era una máquina y a partir
// de ahí son sesenta hombres peleando por su cuenta.
pinza.oeste.alHeredar = () => {
  hud.mostrarAviso('Un sargento tomó la cabeza de tu columna', 'malo');
};
pinza.oeste.alSoltar = () => {
  hud.mostrarAviso('¡Se rompió la formación!', 'malo');
  hud.decir('Ya no hay columna. Ahora son sesenta hombres y vos.', 4);
};
// LA COLUMNA DEL ESTE, CUANDO LA LLEVA UNA PERSONA.
//
// El aviso se dispara donde VIVE la columna, que es la máquina del anfitrión,
// y hay que mandárselo al que la está llevando, que está en la otra. En solo
// no cambia nada: sin compañero, `red.contar` no manda nada a ningún lado.
pinza.este.alSoltar = () => {
  red.contar('¡Se rompió la formación!', 'malo',
    'Ya no hay columna. Ahora son sesenta hombres y vos.');
};
pinza.este.alHeredar = () => {
  red.contar('Un sargento tomó la cabeza de tu columna', 'malo');
};
pinza.alTocar = () => {
  sonido.clarin();
  hud.mostrarAviso('¡A LA CARGA!', 'bien');
  hud.decir('El clarín. Ciento veinte hombres salen a la vez por los dos costados.', 5);
  // EL CLARÍN SUENA EN LAS DOS MÁQUINAS. Es la única señal de la batalla y la
  // da uno solo: si el otro no la oyera, no habría pinza, habría dos cargas.
  red.contarClarin();
  red.contar('¡A LA CARGA!', 'bien',
    'El clarín de San Martín. Salís vos también, por el otro costado.');
};

const plano = armarPlano({ hud });
const mando = armarMando({ lienzo, jugador, sable, arsenal, campo, combate, pinza, hud, sonido, red, plano });

addEventListener('resize', () => {
  camara.aspect = innerWidth / innerHeight;
  camara.updateProjectionMatrix();
  camaraArma.aspect = innerWidth / innerHeight;
  camaraArma.updateProjectionMatrix();
  render.setSize(innerWidth, innerHeight);
  pasadaArma.redimensionar(innerWidth, innerHeight);
  pasadaVel.redimensionar(innerWidth, innerHeight);
});

// ---------------------------------------------------------------------------
// el bucle
// ---------------------------------------------------------------------------
const reloj = new THREE.Clock();
let fps = 60;
let ultimoInfo = { calls: 0, triangles: 0 };

// EL MUNDO, EN UNA FUNCIÓN.
//
// Esto estaba adentro de cuadro(), pegado al dibujo, y por eso las pruebas
// tenían que RECONSTRUIR el bucle a mano para poder correrlo a paso fijo. Con
// render por software el navegador da dos o tres cuadros por segundo, así que
// no había otra: pero una reconstrucción se desactualiza y termina probando un
// juego que no existe. Los bichos de jinetes congelados vivían justo ahí, en
// la diferencia entre el bucle de verdad y el que probábamos.
//
// Ahora el mundo es una función que se puede llamar sola, con el dt que uno
// quiera y sin dibujar nada. La caza de fantasmas corre EL bucle, no uno
// parecido. Ver pruebas/fantasmas.mjs.
function simular (dt) {
  let masCerca = 999;
  for (const s of soldados) {
    if (s.vivo && s.esRealista) masCerca = Math.min(masCerca, s.pos.distanceTo(jugador.pos));
  }
  const presion = Math.min(1,
    Math.max(0, (14 - masCerca) / 14) * 0.7 +
    Math.max(0, (45 - jugador.aliento) / 45) * 0.2 +
    (1 - jugador.vida / 100) * 0.35);

  const arma = arsenal.actual();
  const quiereApuntar = arsenal.quiereApuntar();

  // EL PARTE, ANTES QUE NADA. Los títeres tienen que estar en su sitio nuevo
  // antes de que nadie los mire: el jinete se sienta sobre el caballo de este
  // cuadro, no sobre el del anterior.
  red.aplicar(dt);
  red.seguirCompanero(dt);

  // se reparte ANTES de mover a nadie: el que está lejos no arma el cuerpo
  gentio.repartir();

  // Los caballos con jinete los mueve su jinete; los demás —el tuyo y los que
  // quedaron sueltos— los mueve el bucle. El cadáver dura 45 s, lo mismo que
  // el de un hombre, y recién ahí se lo lleva el campo.
  for (let i = caballos.length - 1; i >= 0; i--) {
    const c = caballos[i];
    if (c.actualizado) { c.actualizado = false; continue; }
    const mandoCaballo = { girar: 0 };
    if (jugador.monta === c) {
      mandoCaballo.girar = (mando.teclas.has('KeyD') ? 1 : 0) - (mando.teclas.has('KeyA') ? 1 : 0);
    }
    c.actualizar(dt, mandoCaballo);
    if (!c.titere && !c.vivo && c.tMuerto > 45) {
      c.quitar();
      caballos.splice(i, 1);
      if (campo.caballo === c) campo.caballo = null;
    }
  }
  // Si te matan el caballo te vas al suelo. Y la PRIMERA vez que pasa estando
  // montado no te levantás: la pierna queda debajo. Ahí arranca el acto.
  if (jugador.monta && !jugador.monta.vivo) {
    const c = jugador.monta;
    // EL ACTO CABRAL ES DE SAN MARTÍN. Cabral no se murió por cualquiera: se
    // murió por el que quedó con la pierna abajo del caballo, y ése fue San
    // Martín. Al invitado le matan el caballo y se cae, como a todo el mundo.
    if (!red.esInvitado && acto.puedeArrancar(c)) {
      acto.arrancar(c);
    } else {
      jugador.desmontar();
      jugador.recibir(CAIDA, new THREE.Vector3(0, 0, 1));
      jugador.sacudir(0.9);
      sonido.golpeRecibido();
      hud.mostrarAviso('¡Te mataron el caballo!', 'malo');
    }
  }
  acto.actualizar(dt, mando.teclas);

  jugador.actualizar(dt, mando.teclas, quiereApuntar, arma ? arma.cargando : false);

  const p = jugador.cfgPostura;
  // A caballo se carga siempre, y cuesta según el andar: la tabla está en
  // caballo.js, con el andar. Antes de trote para arriba era cero —o sea, no se
  // podía ni empezar— y eso dejaba al granadero montado con el arma vacía.
  const penalMonta = montado() ? penalCargaMontado(jugador.monta.vel) : 1;
  arsenal.actualizar(dt, {
    apuntando: arsenal.apuntando,
    presion,
    penalCarga: p.penalCarga * penalMonta,
    dispersion: p.dispersion * (montado() ? 1.9 : 1)
  });

  humo.actualizar(dt);
  fuego.actualizar(dt);
  mundo.niebla.actualizar(dt);

  // Quién tiene a quién encima. Se cuenta una vez por cuadro, con los objetivos
  // del cuadro anterior, y de ahí sale que no te caigan los doscientos
  // cincuenta al mismo tiempo. Ver SATURACION en balance.js.
  if (!red.esInvitado) Soldado.censar(soldados);

  for (let i = soldados.length - 1; i >= 0; i--) {
    const s = soldados[i];
    s.actualizar(dt, jugador, soldados);
    // al títere lo levanta del campo el que lleva la batalla, con un mensaje.
    // Si además lo barriera el reloj de acá, las dos máquinas tendrían listas
    // distintas y el parte siguiente le hablaría de un hombre que ya no está.
    if (!s.titere && !s.vivo && s.caida >= 1) {
      s.tMuerto = (s.tMuerto || 0) + dt;
      if (s.tMuerto > 45) { s.quitar(); soldados.splice(i, 1); }
    }
  }

  // LA MORAL, DESPUÉS DE MOVER A TODOS y antes de la pinza: mira posiciones
  // ya puestas, y puede sacar gente del campo —el que llegó a la barranca se
  // fue—, así que tiene que hacerlo antes de que la columna vuelva a contar
  // los suyos. La simula el que lleva la batalla y viaja en el parte.
  if (!red.esInvitado) moral.actualizar(dt);

  pinza.actualizar(dt, jugador, soldados.filter(s => s.esRealista));
  // y se aprieta y se pinta DESPUÉS, con las posiciones del cuadro ya puestas
  // apretujar es simulación —empuja hombre contra hombre— y por eso la hace
  // sólo el que lleva la batalla. Pintar es dibujo y lo hacen los dos.
  if (!red.esInvitado) gentio.apretujar();
  gentio.pintar();

  // las piezas: buscan blanco, se orientan, ceban y disparan
  if (canones.length && !red.esInvitado) {
    const candidatos = [];
    if (jugador.vivo) candidatos.push({ pos: jugador.pos, montado: montado() });
    for (const s of soldados) if (s.vivo && !s.esRealista) candidatos.push({ pos: s.pos, montado: s.montado });
    for (const c of canones) c.actualizar(dt, candidatos);
  }

  campo.actualizarOleadas(dt);

  luzBoca.intensity = Math.max(0, luzBoca.intensity - dt * 260);

  // y al final del cuadro sale por el cable lo que haya para salir
  red.latir(dt);

  return { presion, arma, quiereApuntar };
}

function cuadro () {
  requestAnimationFrame(cuadro);
  const crudo = Math.min(0.05, reloj.getDelta());
  // en pausa se sigue dibujando, pero el mundo no corre
  const dt = mando.enPausa ? 0 : crudo;
  fps = fps * 0.92 + (1 / Math.max(crudo, 0.0001)) * 0.08;

  const { presion, arma, quiereApuntar } = simular(dt);
  const p = jugador.cfgPostura;

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
  ultimoInfo = info;   // render.info se reinicia en cada render(); ésta es la suma real

  hud.actualizar(crudo, {
    paso: arma ? arma.infoPaso() : null,
    aliento: jugador.aliento,
    cartuchos: arsenal.cartuchos,
    nombreArma: arma ? arma.nombre : 'Sable corvo',
    estadoArma: arma ? arma.etiquetaEstado : 'en mano',
    postura: montado() ? jugador.monta.nombreAndar : p.nombre,
    rapidez: montado() ? jugador.monta.vel : 0,
    puedeTomarFusil: jugador.atrapado <= 0 && !arsenal.armas.fusil && !!arsenal.caidoConFusil(),
    remate: sable.tRemate,
    metralla: combate.metrallaEncima(),
    atrapado: jugador.atrapado,
    forcejeo: acto.forcejeo,
    vida: jugador.vida,
    regenerando: jugador.tSinDano > 4.5 && jugador.vida < 100,
    vendas: jugador.vendas,
    vendando: Math.max(0, jugador.vendando),
    enemigos: campo.vivosDe('realista'),
    aliados: campo.vivosDe('granadero'),
    quiebre: moral.parte(),
    columna: pinza.viva
      ? { tuya: pinza.oeste.montados, otra: pinza.este.montados, esperando: pinza.sonando }
      : null,
    humoLocal: humo.densidadEn(jugador.pos),
    presion,
    nubes: humo.vivas,
    fps,
    draws: info.calls,
    tris: info.triangles
  });
}

campo.ponerCaballo();
campo.ponerCanones();
cuadro();

// ---------------------------------------------------------------------------
// la puerta de la consola
// ---------------------------------------------------------------------------
// Todo lo que las pruebas y el que quiera hurgar necesitan tocar desde afuera.
window.juego = {
  // los sistemas, por si hace falta entrar por abajo
  combate, arsenal, campo, gentio, mando, red, moral, plano,
  balance: { VOLTEO, OFICIO, METRALLA_CABALLO },
  // el mundo
  jugador, sable, humo, fuego, soldados, caballos, escena, camara, render,
  lejania, pasadaVel, pinza, canones, acto, simular,
  get armas () { return arsenal.armas; },
  get caballo () { return campo.caballo; },
  get arma () { return arsenal.actual(); },
  get info () { return ultimoInfo; },
  // atajos que ya usaban las pruebas y la consola
  VOLTEO, OFICIO, METRALLA_CABALLO,
  soltarSoldado: campo.soltarSoldado,
  soltarRealista: () => campo.soltarSoldado('realista'),
  formarPinza: campo.formarPinza,
  ponerCanones: campo.ponerCanones,
  montarODesmontar: campo.montarODesmontar,
  voltear: combate.voltear,
  tocarClarin: () => pinza.tocar(),
  lod: m => gentio.verCerca(m),
  separarAhora: gentio.apretujar,
  repartirAhora: gentio.repartir,
  pintarAhora: gentio.pintar,
  // para probar escalas a mano desde la consola: juego.formar(20, 30)
  formar (lanceros = 10, realistas = 10) {
    for (let i = 0; i < lanceros; i++) campo.soltarSoldado('granadero', { montado: true });
    for (let i = 0; i < realistas; i++) campo.soltarSoldado('realista');
    return { hombres: soldados.length, caballos: caballos.length };
  }
};
