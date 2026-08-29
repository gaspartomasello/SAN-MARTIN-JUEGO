// ===========================================================================
// EL GENTÍO · quién se dibuja entero, quién ocupa lugar
// ===========================================================================
//
// Dos problemas distintos que comparten una sola respuesta —la rejilla— y por
// eso viven juntos:
//
//   1. CUÁNTOS SE ARMAN HUESO POR HUESO. Todo lo que esté más allá de cierta
//      distancia deja de ser un esqueleto articulado y pasa a ser una instancia
//      horneada (ver lejania.js). Es lo que hace posible la pinza: 370 hombres
//      en 99 llamadas de dibujo.
//   2. QUIÉN EMPUJA A QUIÉN. Los bots ocupan lugar y no se atraviesan.
//
// El bucle llama a `repartir()` ANTES de mover a nadie —el que está lejos no
// arma el cuerpo—, y a `apretujar()` y `pintar()` DESPUÉS, cuando las
// posiciones del cuadro ya están puestas.

import { Rejilla, separar, RADIO_HOMBRE, RADIO_CABALLO } from './estorbos.js';
import { Soldado } from './soldados.js';

// Cuántos hombres se arman hueso por hueso, como mucho. La distancia sola no
// alcanza como presupuesto: el peor caso del juego es darte vuelta y mirar tu
// propia columna, sesenta jinetes apilados en cincuenta metros, y ahí un corte
// por distancia deja pasar a todos —medido: 1.765 llamadas—. Un techo duro
// convierte el presupuesto en una garantía en vez de una esperanza. Y los más
// cercanos son, justamente, los únicos a los que les vas a ver un codo.
const CERCA_MAX = 26;

export function armarGentio ({ jugador, soldados, caballos, lejania }) {
  // Lo pone main.js y lo resuelve combate.js: acá no se sabe cuánto duele que
  // te lleve puesto un caballo, y no tiene por qué saberse. Es el mismo enganche
  // que Soldado.acoso y Soldado.botes.
  let alArrollar = null;
  let cerca = 30;                    // metros: de acá para allá, instancia horneada
  const candidatos = [];
  const rejilla = new Rejilla(2);

  function repartir () {
    const ojo = jugador.pos;
    candidatos.length = 0;
    for (const s of soldados) {
      const d = Math.hypot(s.pos.x - ojo.x, s.pos.z - ojo.z);
      if (d > cerca) { s.ponerLejos(true); continue; }
      candidatos.push(s);
      s._dLod = d;
    }
    if (candidatos.length > CERCA_MAX) {
      candidatos.sort((a, b) => a._dLod - b._dLod);
      for (let i = 0; i < candidatos.length; i++) candidatos[i].ponerLejos(i >= CERCA_MAX);
    } else {
      for (const s of candidatos) s.ponerLejos(false);
    }

    for (const c of caballos) {
      if (c.jinete) continue;                     // lo manda su jinete
      if (jugador.monta === c) { c.lejos = false; continue; }
      c.lejos = Math.hypot(c.pos.x - ojo.x, c.pos.z - ojo.z) > cerca;
    }
  }

  // LOS BOTS OCUPAN LUGAR.
  //
  // La separación se hace en una pasada aparte, DESPUÉS de que todos se
  // movieron. Si se hiciera adentro de cada uno, el primero de la lista
  // empujaría a los demás y el último no empujaría a nadie: el orden del array
  // se volvería una ventaja. Así, todos ceden la mitad.
  //
  // Y el caballo empuja, pero no se deja empujar. Un escuadrón de caballería
  // que se frena porque le pusieron infantes adelante no es caballería. El
  // hombre se aparta —o lo ensartan—, el caballo pasa.
  function apretujar () {
    separar(soldados, rejilla, RADIO_HOMBRE);
    // la misma rejilla sirve para preguntar quién está en la línea de tiro
    Soldado.vecinos = rejilla;
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
        // y si venía lanzado, además lo arrolla
        if (alArrollar) alArrollar(c, s);
      });
    }
  }

  function pintar () {
    lejania.comenzar();
    for (const s of soldados) s.pintarLejos(lejania);
    for (const c of caballos) {
      if (!c.lejos || c.jinete) continue;
      const fase = !c.vivo ? 3 : (c.vel > 3 ? (Math.sin(c.paso) > 0 ? 1 : 2) : 0);
      lejania.poner('caballo', fase, c.pos.x, c.alto, c.pos.z, c.rumbo);
    }
    lejania.terminar();
  }

  return { repartir, apretujar, pintar, rejilla, verCerca: m => { cerca = m; },
    set alArrollar (f) { alArrollar = f; } };
}
