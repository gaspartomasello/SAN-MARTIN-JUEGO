// ===========================================================================
// EL ARSENAL · lo que llevás encima y qué tenés en la mano
// ===========================================================================
//
// Tercerola, pistolón, sable corvo y el fusil con bayoneta que le sacás a un
// realista caído. Este módulo es dueño de todo lo que se puede empuñar y del
// estado que va con eso: cuál está en la mano, cuántos cartuchos quedan, si
// estás apuntando.
//
// Lo que NO hace: resolver un impacto. Cuando el arma dispara o golpea, avisa,
// y quien decide qué pasó es combate.js. Un arma sabe cargarse, apuntarse y
// gatillar; no sabe cuánto duele una bala.

import { ArmaFuego } from './armas.js';
import { banderaEnMano, banderaPlantada, flamear } from './figura.js';
import { GUARDIA_GASTO } from './balance.js';

// A qué distancia se levanta la bandera. Un poco más que el fusil caído (2,6):
// el asta es larga y agacharse a un palo de dos metros no pide estar encima.
const ALCANCE_BANDERA = 3.2;

const CARTUCHERA = 24;

export function armarArsenal (ctx) {
  const { escena, camara, camaraArma, sonido, humo, hud, sable, jugador, soldados,
    resolverDisparo, resolverGolpe } = ctx;

  const armas = {
    tercerola: new ArmaFuego('tercerola', camaraArma, camara, sonido, humo),
    pistolon: new ArmaFuego('pistolon', camaraArma, camara, sonido, humo),
    remington: new ArmaFuego('remington', camaraArma, camara, sonido, humo),
    fusil: null
  };
  let armaLarga = 'tercerola';
  let enMano = 'larga';

  const yo = {
    armas,
    cartuchos: CARTUCHERA,
    apuntando: false,

    // El arma de fuego que tenés en la mano, o null si es el sable.
    actual () {
      if (enMano === 'sable') return null;
      if (enMano === 'pistolon') return armas.pistolon;
      if (enMano === 'remington') return armas.remington;
      return armas[armaLarga];
    },
    // Verdadero cuando el sable está en la mano: ahí el click derecho deja de
    // apuntar y pasa a cubrir.
    conSable () { return !yo.actual() && !sable.guardado; }
  };

  // La Remington no gasta de la cartuchera y no se queda sin nada: es el arma
  // de probar, no de jugar. Se conecta aparte justamente para que la regla del
  // cartucho quede escrita en un solo lugar y no haya que acordarse.
  function conectarSinMunicion (arma) {
    arma.alAviso = (t, tipo) => hud.mostrarAviso(t, tipo);
    arma.alGastarCartucho = () => {};
    arma.alPedirCarga = () => true;
    arma.alDisparar = resolverDisparo;
    arma.alGolpear = cfg => resolverGolpe(cfg.alcance, cfg.dano, cfg.nombre);
  }

  function conectar (arma) {
    arma.alAviso = (t, tipo) => hud.mostrarAviso(t, tipo);
    arma.alGastarCartucho = () => { yo.cartuchos = Math.max(0, yo.cartuchos - 1); };
    // la recarga sola no arranca con la cartuchera vacía: ahí hay que apretar
    // R y comerse el aviso, que es la manera de enterarse de que no queda nada
    arma.alPedirCarga = () => yo.cartuchos > 0;
    arma.alDisparar = resolverDisparo;
    arma.alGolpear = cfg => resolverGolpe(cfg.alcance, cfg.dano, cfg.nombre);
  }
  conectar(armas.tercerola);
  conectar(armas.pistolon);
  conectarSinMunicion(armas.remington);
  armas.remington.cargarDeUnaVez();
  armas.tercerola.sacar();
  // se arranca la partida con las armas cargadas
  armas.tercerola.cargarDeUnaVez();
  armas.pistolon.cargarDeUnaVez();

  function guardarTodo () {
    const a = yo.actual();
    if (a) a.soltarCarga();          // la carga a medias se conserva, no se borra
    armas.tercerola.guardar();
    armas.pistolon.guardar();
    armas.remington.guardar();
    if (armas.fusil) armas.fusil.guardar();
    sable.guardar();
  }

  function cambiarLarga (cual) {
    guardarTodo();
    armaLarga = cual;
    enMano = 'larga';
    armas[armaLarga].sacar();
  }

  yo.cambiar = function (cual) {
    if (enMano === cual) return;
    guardarTodo();
    enMano = cual;
    if (cual === 'sable') {
      sable.sacar();
      hud.mostrarAviso('Sable corvo', 'bien');
    } else {
      const a = yo.actual();
      a.sacar();
      hud.mostrarAviso(a.aMedias ? `${a.nombre} · carga a medias` : a.nombre, 'bien');
    }
  };

  // El realista caído más cercano que todavía tiene el fusil encima.
  yo.caidoConFusil = function () {
    for (const s of soldados) {
      if (s.vivo || !s.tieneFusil) continue;
      if (s.pos.distanceTo(jugador.pos) < 2.6) return s;
    }
    return null;
  };

  // -------------------------------------------------------------------------
  // ROBAR LA BANDERA
  // -------------------------------------------------------------------------
  //
  // Es una provocación y no un arma: no hace daño, no se apunta y no ocupa la
  // mano que pelea. El corvo se sigue llevando en la derecha —el asta va en la
  // izquierda—, que es cómo se llevaba una bandera en una carga y por qué esto
  // no te cuesta nada en combate. Lo que cuesta es ir a buscarla: hay que
  // meterse hasta donde cayó el abanderado, que estaba en el medio de su gente.
  //
  // Se la roba a un MUERTO. A un hombre de pie no se le saca el estandarte de
  // las manos, y pedir que primero lo mates es lo que hace que los dos tercios
  // —matar al abanderado y llevarse el paño— sean un solo viaje y no dos.
  // HAY UN SOLO ESTANDARTE Y DOS LUGARES DONDE PUEDE ESTAR: en tu mano o
  // clavado en el pasto. Nunca en los dos, y nunca en ninguno mientras el
  // abanderado lo lleve encima.
  const bandera = banderaEnMano();
  camaraArma.add(bandera.raiz);
  const plantada = banderaPlantada();
  if (escena) escena.add(plantada.raiz);
  yo.tenesBandera = false;
  yo.banderaEnPiso = false;

  // CLAVARLA EN UN SITIO. La usa main.js cuando cae el abanderado —el cuerpo
  // entrega el asta y el estandarte queda parado donde cayó— y la usa el propio
  // jugador al soltarla.
  yo.plantarBandera = function (p) {
    plantada.raiz.position.set(p.x, 0, p.z);
    plantada.raiz.rotation.y = Math.random() * Math.PI * 2;
    plantada.raiz.visible = true;
    yo.banderaEnPiso = true;
  };

  yo.banderaCerca = function () {
    if (yo.banderaEnPiso) {
      const d = Math.hypot(plantada.raiz.position.x - jugador.pos.x,
        plantada.raiz.position.z - jugador.pos.z);
      if (d < ALCANCE_BANDERA) return 'piso';
    }
    // por si cayó y todavía nadie la sacó del cuerpo
    for (const s of soldados) {
      if (s.papel !== 'abanderado' || s.vivo || s.sinBandera) continue;
      if (s.pos.distanceTo(jugador.pos) < ALCANCE_BANDERA) return s;
    }
    return null;
  };

  yo.robarBandera = function () {
    if (yo.tenesBandera) { hud.mostrarAviso('Ya la llevás', 'malo'); return false; }
    const donde = yo.banderaCerca();
    if (!donde) { hud.mostrarAviso('No hay ninguna bandera acá', 'malo'); return false; }
    if (donde === 'piso') { plantada.raiz.visible = false; yo.banderaEnPiso = false; }
    else donde.entregarBandera();
    yo.tenesBandera = true;
    bandera.raiz.visible = true;
    hud.mostrarAviso('¡Les tomaste la bandera!', 'bien');
    if (yo.alRobarBandera) yo.alRobarBandera();
    return true;
  };

  // Y SOLTARLA. Queda clavada donde estabas, a la vista y al alcance de
  // cualquiera: en una partida de a dos el otro la puede levantar. Lo que ya
  // ganaste no se devuelve —la línea realista los vio perder el paño y eso no
  // se deshace—, así que el desaliento no vuelve para atrás.
  yo.soltarBandera = function () {
    if (!yo.tenesBandera) return false;
    yo.tenesBandera = false;
    bandera.raiz.visible = false;
    yo.plantarBandera(jugador.pos);
    hud.mostrarAviso('Soltaste la bandera', 'bien');
    return true;
  };

  // el paño ondula aunque estés quieto, la lleves vos o esté clavada: una
  // bandera quieta es una chapa pintada
  yo.flamearBandera = function (dt) {
    if (yo.tenesBandera) flamear(bandera, dt);
    if (yo.banderaEnPiso) flamear(plantada, dt);
  };

  yo.tomarOIntercambiar = function () {
    const caido = yo.caidoConFusil();
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
  };

  yo.cargar = function () {
    const a = yo.actual();
    if (!a) return;
    if (yo.cartuchos <= 0 && !a.aMedias && !a.cargada) {
      hud.mostrarAviso('No quedan cartuchos', 'malo');
      return;
    }
    a.alternarCarga();
  };

  // se vuelve a salir al campo con todo cargado y la cartuchera llena
  yo.reponer = function () {
    armas.tercerola.cargarDeUnaVez();
    armas.pistolon.cargarDeUnaVez();
    armas.remington.cargarDeUnaVez();
    if (armas.fusil) armas.fusil.cargarDeUnaVez();
    yo.cartuchos = CARTUCHERA;
  };

  // ¿de verdad está apuntando por el cañón? No alcanza con tener el botón
  // apretado: cargando no se apunta, y con el arma en el golpe tampoco.
  yo.quiereApuntar = function () {
    const a = yo.actual();
    return yo.apuntando && !!a && !a.cargando && a.tGolpe < 0;
  };

  yo.actualizar = function (dt, cfg) {
    // ¿se carga sola? Montado o con el corvo en la mano: en los dos casos
    // tenés las manos ocupadas. A pie y con el arma en la mano, no.
    cfg.sola = !!(jugador.monta && jugador.monta.vivo) || yo.conSable();
    armas.tercerola.actualizar(dt, cfg);
    armas.pistolon.actualizar(dt, cfg);
    armas.remington.actualizar(dt, cfg);
    if (armas.fusil) armas.fusil.actualizar(dt, cfg);
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
  };

  return yo;
}
