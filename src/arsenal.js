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
import { GUARDIA_GASTO } from './balance.js';

const CARTUCHERA = 24;

export function armarArsenal (ctx) {
  const { camara, camaraArma, sonido, humo, hud, sable, jugador, soldados,
    resolverDisparo, resolverGolpe } = ctx;

  const armas = {
    tercerola: new ArmaFuego('tercerola', camaraArma, camara, sonido, humo),
    pistolon: new ArmaFuego('pistolon', camaraArma, camara, sonido, humo),
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
      return enMano === 'pistolon' ? armas.pistolon : armas[armaLarga];
    },
    // Verdadero cuando el sable está en la mano: ahí el click derecho deja de
    // apuntar y pasa a cubrir.
    conSable () { return !yo.actual() && !sable.guardado; }
  };

  function conectar (arma) {
    arma.alAviso = (t, tipo) => hud.mostrarAviso(t, tipo);
    arma.alGastarCartucho = () => { yo.cartuchos = Math.max(0, yo.cartuchos - 1); };
    arma.alDisparar = resolverDisparo;
    arma.alGolpear = cfg => resolverGolpe(cfg.alcance, cfg.dano, cfg.nombre);
  }
  conectar(armas.tercerola);
  conectar(armas.pistolon);
  armas.tercerola.sacar();
  // se arranca la partida con las armas cargadas
  armas.tercerola.cargarDeUnaVez();
  armas.pistolon.cargarDeUnaVez();

  function guardarTodo () {
    const a = yo.actual();
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
    armas.tercerola.actualizar(dt, cfg);
    armas.pistolon.actualizar(dt, cfg);
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
