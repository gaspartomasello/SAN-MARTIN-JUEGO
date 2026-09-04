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
import { ActoCabral, ActoVictoria } from './acto.js';
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
import { Z_BARRANCA } from './sanlorenzo.js';
import { VOLTEO, OFICIO, METRALLA_CABALLO, CAIDA } from './balance.js';

// ---------------------------------------------------------------------------
// el escenario
// ---------------------------------------------------------------------------
const lienzo = document.createElement('canvas');
lienzo.id = 'lienzo';          // para que el HUD le pueda nublar la vista al morir
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
// Dónde se embarcan los que se quiebran. Lo sabe la batalla, lo usa el
// sistema: main los presenta y no opina de ninguno de los dos.
Soldado.botes = mundo.botes;
const humo = new Humo(escena);
const fuego = new Fuego(escena, camara);
const lejania = new Lejania(escena, 320);
const sonido = new Sonido();
// ---------------------------------------------------------------------------
// LO QUE ELIGE EL QUE JUEGA
// ---------------------------------------------------------------------------
//
// Vive acá porque main.js es el que coordina y el que se lo pasa a quien lo
// necesite —el panel de la portada lo escribe, combate.js lo lee—, y así no
// hace falta un archivo nuevo para tres renglones.
//
// LA SANGRE VIENE APAGADA, y ésa es la decisión: el juego que se abre por
// primera vez es apto para cualquiera. San Lorenzo se cuenta bien sin ella
// —lo que hace terrible a esta batalla es que doscientos hombres se van
// corriendo por una barranca, no el color de lo que salpica—, así que la
// sangre es algo que se pide, no algo de lo que hay que escaparse.
const opciones = {
  sangre: false,
  guardar () {
    try { localStorage.setItem('clarin.opciones', JSON.stringify({ sangre: this.sangre })); } catch { /* sin permiso, no pasa nada */ }
  },
  cargar () {
    try {
      const g = JSON.parse(localStorage.getItem('clarin.opciones') || '{}');
      if (typeof g.sangre === 'boolean') this.sangre = g.sangre;
    } catch { /* dato roto: se queda el de fábrica */ }
  }
};
opciones.cargar();

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
  opciones,
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
// el caballo lanzado no aparta: arrolla. gentio.js encuentra el choque, combate.js
// le pone el precio.
gentio.alArrollar = combate.arrollar;

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

// QUÉ ARMA SE LE VE EN LA MANO, para que los otros la vean cambiar. Es el
// vocabulario de figura.js —cuatro modelos— y no el del arsenal, que tiene la
// Remington de práctica y distingue fusil de tercerola: desde diez metros son
// la misma arma larga y no vale un modelo aparte.
function armaDelJugador () {
  if (montado()) return 'lanza';
  const a = arsenal.actual();
  if (!a) return 'sable';
  // `tipo` es la CLAVE del arma ('pistolon'); `nombre` es el rótulo del HUD
  // ('Pistolón de arzón') y comparar contra eso no da nunca.
  return a.tipo === 'pistolon' ? 'pistolon' : 'tercerola';
}

red = armarRed({
  escena, humo, fuego, sonido, hud, jugador,
  soldados, caballos, canones, pinza, campo, luzBoca, montado,
  poseDelJugador, armaDelJugador, intentarVoltear: combate.intentarVoltear
});

// LA MORAL. Va después de la red porque el «se quiebra la línea» hay que
// contárselo también al que lleva la otra columna, y después del campo porque
// necesita saber cuándo se rearma para volver a cero.
const moral = armarMoral({
  soldados, caballos, canones, hud, sonido, jugador, montado, red
});
// Se rearma el campo: `victoria` se declara más abajo y para cuando esto corra
// ya existe.
// Se rearma el campo: la moral vuelve a cero, la victoria vuelve a estar por
// ganarse, y no quedan manchas de la batalla anterior —son lo único de los
// efectos que se queda, así que son lo único que hay que barrer—.
campo.alFormar = () => { moral.reiniciar(); victoria.reiniciar(); fuego.limpiarManchas(); };

jugador.alAviso = (t, tipo) => hud.mostrarAviso(t, tipo);
// AL MORIR EN UNA PARTIDA DE A DOS SE PASA A MIRAR, no a esperar. En solitario
// no: ahí morirte es el final de tu partida y volvés con Enter cuando quieras,
// sin nadie a quien hacer esperar. En red los otros siguen peleando y quedarte
// veinte minutos mirando el pasto desde donde caíste no es un modo de juego.
// LAS ÚLTIMAS PALABRAS. Son de él, no inventadas, y se sortea una: morir tres
// veces y leer tres veces lo mismo convierte una frase en un cartel.
const ULTIMAS = [
  'Serás lo que debas ser, o no serás nada.',
  'Seamos libres, que lo demás no importa nada.',
  'De lo que son capaces mis granaderos, sólo yo lo sé; quien los iguale habrá, quien los exceda, no.',
  'Se puede quitar la vida a un hombre, pero no el honor.',
  'La Patria no hace un soldado para que la deshonre.',
  'La soberbia y el desprecio, hijo mío, no son cosa de valientes.',
  'A la desgracia se la vence con la firmeza.',
  'Cuando la Patria está en peligro, todo es lícito menos dejarla perecer.'
];
// Y NUNCA DOS VECES SEGUIDAS. Sorteo a secas quiere decir que una de cada
// ocho muertes repite la anterior, y una frase repetida deja de ser una frase:
// se lee como un cartel. Se sortea entre las que no son la última.
// Cuánto dura el fundido en red. Es más corto que en solitario a propósito:
// allá no hay a quién hacer esperar y acá sí.
const RED_FUNDIDO = 4.5;

let ultimaFrase = -1;
function frasePostrera () {
  let i = Math.floor(Math.random() * (ULTIMAS.length - 1));
  if (i >= ultimaFrase) i++;                  // salta la de la vez pasada
  ultimaFrase = i % ULTIMAS.length;
  return ULTIMAS[ultimaFrase];
}

jugador.alMorir = () => {
  hud.mostrarAviso('Fuera de combate', 'malo');

  // EN RED SE PASA A MIRAR, porque los otros siguen peleando y no se los puede
  // hacer esperar. En solitario no hay a quién esperar y lo que corresponde es
  // lo otro: que se te caiga la cabeza al pasto y se te cierren los ojos.
  if (red.activo) {
    // TAMBIÉN SE MUERE EN RED, y hasta ahora no: se pasaba a volar de un
    // fotograma al otro, sin fundido y sin frase, como si te hubieran cambiado
    // de cámara. Morirse es lo más importante que te pasa en la batalla y no
    // puede ser un corte.
    //
    // Lo que cambia respecto de solo es lo que viene DESPUÉS: allá los ojos se
    // quedan cerrados, acá se vuelven a abrir sobre el campo porque los otros
    // siguen peleando. El fundido corto —cuatro segundos y medio contra siete—
    // por lo mismo: hay gente esperándote.
    //
    // Sin los botones del caído: en red la salida no es «volver a formar», es
    // mirar, y el aviso de abajo la explica.
    // Y SIN SOLTAR EL PUNTERO. En solitario se suelta —hay botones que apretar—
    // pero acá soltarlo pausa el mundo, y un invitado pausado deja de mandar su
    // cuerpo: del otro lado su compañero queda vivo y clavado en la plaza de
    // salida para siempre. Además, en un rato va a estar volando con WASD y
    // para eso el puntero tiene que seguir tomado.
    hud.cerrarLosOjos(RED_FUNDIDO, false);
    sonido.morir(RED_FUNDIDO);
    setTimeout(() => hud.decir(frasePostrera(), 5), RED_FUNDIDO * 0.55 * 1000);
    setTimeout(() => {
      hud.abrirLosOjos();
      if (jugador.espiar()) {
        hud.decir('Mirá cómo termina: WASD para volar, Shift para ir rápido, ' +
          'Espacio y Control para subir y bajar. Enter para volver a la pelea.', 9);
      }
    }, RED_FUNDIDO * 1000);
    return;
  }

  // La cabeza cae de costado y queda mirando al cielo. Es la misma máquina de
  // estar tirado bajo el caballo —atrapar y pitchAtrapado—, que ya sabe poner
  // la cámara a sesenta centímetros del pasto y girarla despacio.
  if (jugador.atrapado <= 0) {
    jugador.atrapar(jugador.pos.x, jugador.pos.z, jugador.yaw + 1.15);
    jugador.pitchAtrapado = 0.50;
  }
  jugador.sacudir(0.8);
  // LOS DOS SENTIDOS SE APAGAN JUNTOS Y CON EL MISMO NÚMERO. Si el sonido se
  // corta antes que la vista se lee como que se colgó el juego; si sigue
  // después de que la pantalla está negra, se lee como que falta una pantalla.
  hud.cerrarLosOjos(7);
  sonido.morir(7);
  // y se suelta el mouse: con el puntero capturado no hay botón que apretar
  mando.caiste();
  setTimeout(() => hud.decir(frasePostrera(), 9), 2200);
};

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

// EL CIERRE. Hasta acá la batalla se ganaba y no pasaba nada: la última
// bandera roja desaparecía del campo y quedabas parado en un potrero. Ahora la
// victoria se marca, el escuadrón vuelve al portón del convento —de donde
// salieron a las cinco y media— y se cierra cuando llegás.
const victoria = new ActoVictoria({ escena, hud, sonido, jugador, soldados, pinza });
// EN RED LO CANTA EL QUE LO VE, y lo escuchan todos. El invitado no simula la
// batalla y por eso no detecta el final: se lo dice el anfitrión. Pero la
// llegada al portón sí la puede cantar cualquiera, y alcanza con uno.
victoria.alEmpezar = () => red.contarVictoria('empieza');
victoria.alLlegar = () => red.contarVictoria('llego');
red.alVictoria = (fase) => {
  victoria.arrancar(false);                 // no hace nada si ya estaba
  if (fase === 'llego') victoria.llegar(false);
};

const plano = armarPlano({ hud });
const mando = armarMando({ lienzo, jugador, sable, arsenal, campo, combate, pinza, hud, sonido, red, plano, acto, opciones });

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
  red.seguirPares(dt);

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
      const t = mando.teclas;
      mandoCaballo.girar = (t.has('KeyD') ? 1 : 0) - (t.has('KeyA') ? 1 : 0);
      // SE ANDA SOSTENIENDO, NO APRETANDO. Antes cada W subía un andar: para
      // salir al galope había que golpearla tres veces y para frenar, tres la
      // S. Nadie juega así. Ahora W anda, Shift galopa —el mismo Shift que
      // corre a pie— y soltar afloja. El caballo igual tarda en acelerar y en
      // frenar, así que sostener no es teletransportarse.
      const rapido = t.has('ShiftLeft') || t.has('ShiftRight');
      mandoCaballo.andar = t.has('KeyS') ? 0
        : t.has('KeyW') ? (rapido ? 3 : 2)
        : 0;
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
  // el reloj del 3 de febrero: al minuto del clarín, la metralla
  if (!red.esInvitado) acto.contar(dt, pinza.tocado, jugador.monta);
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
  mundo.cielo.actualizar(dt);

  // Quién tiene a quién encima. Se cuenta una vez por cuadro, con los objetivos
  // del cuadro anterior, y de ahí sale que no te caigan los doscientos
  // cincuenta al mismo tiempo. Ver SATURACION en balance.js.
  if (!red.esInvitado) Soldado.censar(soldados);
  combate.correrReloj(dt);

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

  // EL CIERRE. El invitado no cuenta enemigos —no simula la batalla— pero sí
  // camina hasta el portón, así que `actualizar` corre en las dos máquinas y
  // `contar` sólo donde se lleva la batalla.
  if (!red.esInvitado) victoria.contar(dt);
  victoria.actualizar(dt);
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

  // EL SONIDO QUE NO ES UN EVENTO: el pulso y los cascos de tu caballo. Todo
  // lo demás lo dispara algo que pasó; estos dos hay que llevarlos por tiempo.
  // Va con `dt` y no con el reloj pelado, así que la cámara lenta del acto
  // también le baja el ritmo al corazón, que es lo que corresponde: es el
  // mismo mundo. Y de paso le dice al sonido dónde están tus oídos, que es lo
  // que hace que un fusil a ochenta metros no suene igual que uno al lado.
  sonido.actualizar(dt, {
    oyente: jugador.pos,
    // hacia dónde mirás: sin esto no hay izquierda ni derecha y la batalla
    // entera suena en el medio de tu cabeza
    mirada: jugador.yaw,
    // qué tan cerca estás del labio de la barranca, de 0 a 1. Dónde está la
    // barranca es cosa del nivel, así que la cuenta se hace acá y audio.js
    // recibe un número y no un mapa.
    rio: Math.max(0, Math.min(1, 1 - Math.abs(jugador.pos.z - Z_BARRANCA) / 34)),
    // y cuánta batalla queda alrededor: el fragor de fondo lo sigue, así que
    // cuando el campo se vacía el silencio se oye como un silencio
    fragor: Math.min(1, campo.vivosDe('realista') / 90),
    // El pulso de Cabral no mide su vida: mide lo que está haciendo.
    vida: acto.pulsoAlto ? 22 : jugador.vida,
    vivo: jugador.vivo && !jugador.espectador,
    montado: montado(),
    vel: montado() ? jugador.monta.vel : 0
  });

  luzBoca.intensity = Math.max(0, luzBoca.intensity - dt * 260);

  // y al final del cuadro sale por el cable lo que haya para salir
  red.latir(dt);

  return { presion, arma, quiereApuntar };
}

// LAS TAPAS: mientras haya una, abajo no se dibuja nada.
//
// La portada y el plano cubren la pantalla entera y son opacos, y abajo estaba
// corriendo la batalla completa —trescientos setenta hombres simulados y los
// dos pases de dibujo— para que no se viera un solo píxel. Eso no es sólo
// desperdicio: el menú y el juego pelean por el mismo hilo, así que la
// animación de los botones se trababa. Medido en pruebas/portada.mjs: con el
// bucle corriendo, la transición del renglón no avanzaba ni un píxel en 450 ms.
//
// La sala NO entra en la lista: ahí la red está negociando y el latido sale de
// simular(). La portada y el plano no hablan con nadie.
const TAPAS = ['portada', 'plano'];
function tapado () {
  for (const id of TAPAS) {
    const e = document.getElementById(id);
    if (e && !e.classList.contains('oculto')) return true;
  }
  return false;
}

function cuadro () {
  requestAnimationFrame(cuadro);
  // el reloj se vacía igual, si no el primer cuadro adentro llega con el
  // tiempo entero que estuviste mirando el menú
  if (tapado()) { reloj.getDelta(); return; }
  const crudo = Math.min(0.05, reloj.getDelta());
  // en pausa se sigue dibujando, pero el mundo no corre
  // LA CÁMARA LENTA DEL ACTO. El mundo entero corre más despacio —no sólo la
  // animación— porque lo que hay que poder ver es al español llegando, y a
  // velocidad normal eso dura medio segundo.
  const dt = mando.enPausa ? 0 : crudo * acto.lento;
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
  escenaArma.visible = jugador.atrapado <= 0 && !jugador.espectador;
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
    // La barra sale también cuando SOS Cabral empujando el caballo, que es el
    // único momento en que se forcejea sin estar atrapado.
    // La barra, sólo al lado del caballo: es lo único que se puede llenar. Los
    // metros van sin barra —ver `rotulo`—, que una barra vacía al lado de un
    // número dice que ese número se está llenando, y no es eso.
    empujando: acto.puedeEmpujar,
    forcejeo: acto.forcejeo,
    rotulo: acto.rotulo,
    vida: jugador.vida,
    regenerando: jugador.tSinDano > 4.5 && jugador.vida < 100,
    vendas: jugador.vendas,
    vendando: Math.max(0, jugador.vendando),
    enemigos: campo.vivosDe('realista'),
    aliados: campo.vivosDe('granadero'),
    quiebre: moral.parte(),
    columna: pinza.viva
      ? { tuya: pinza.oeste.montados, otra: pinza.este.montados, esperando: pinza.sonando,
          suelta: pinza.tocado && pinza.oeste.estado === 'suelta' }
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
  combate, arsenal, campo, gentio, mando, red, moral, plano, sonido,
  balance: { VOLTEO, OFICIO, METRALLA_CABALLO },
  // el mundo
  jugador, sable, humo, fuego, soldados, caballos, escena, camara, render,
  lejania, pasadaVel, pinza, canones, acto, victoria, opciones, hud, simular,
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
