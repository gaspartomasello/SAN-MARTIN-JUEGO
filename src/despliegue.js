// ===========================================================================
// EL DESPLIEGUE · quién sale al campo, dónde y cuándo
// ===========================================================================
//
// Todo lo que puebla el campo: soltar un soldado con sus ganchos ya atados,
// poner las dos piezas de artillería con sus sirvientes, armar la pinza del 3
// de febrero, traer un caballo, y las oleadas del modo suelto.
//
// Es el módulo que sabe DÓNDE va cada cosa. No sabe pelear —eso es combate.js—
// ni cuántos aguanta la máquina —eso es balance.js—: sabe que los realistas
// desembarcan en tres filas al pie de la barranca, que las dos columnas se
// esconden detrás del convento y que los granaderos de a pie forman al lado
// tuyo.

import * as THREE from 'three';
import { Soldado } from './soldados.js';
import { Caballo } from './caballo.js';
import { Canon } from './canon.js';
import { PLAZA_OESTE, PLAZA_ESTE } from './pinza.js';
import { ALIADOS_MAX, ENEMIGOS_MAX, MONTADOS, OLEADA_REALISTA, OLEADA_GRANADERO } from './balance.js';

// DÓNDE ESTÁN LAS DOS PIEZAS. Sale de acá y no de un número suelto adentro de
// ponerCanones porque el plano de la batalla las tiene que dibujar donde de
// verdad están.
export const PIEZAS = [[-13, -68, Math.PI], [11, -73, Math.PI]];

// El desembarco: tres filas, y el ancho sale de cuántos son. Se exporta la
// cuenta para que el plano dibuje la línea con el frente que va a tener.
export const FILAS_REALISTAS = 3;
export const PASO_FILA = 1.56;
export const FONDO_FILA = 2.4;
export const Z_DESEMBARCO = -66;

export function armarDespliegue (ctx) {
  const { escena, mundo, humo, sonido, hud, jugador, soldados, caballos, pinza, canones,
    disparoEnemigo, golpeEnemigo, resolverMetralla } = ctx;

  const campo = {
    canones,
    alFormar: null,       // se avisa cuando el campo se rearma: la moral vuelve a cero
    caballo: null,        // el del jugador; sobrevive a que se baje
    oleadas: false,       // el modo suelto: van llegando de a poco
    _tRealista: 0,
    _tGranadero: 0
  };

  // LOS PARAPETOS. Las cajas de colisión que llegan a la cintura pero no tapan
  // la vista: una tapia de tres metros no es cubierta, es una pared; un barril
  // de medio metro tampoco. Se calculan UNA vez, no cada cuadro.
  const parapetos = mundo.colisiones
    .filter(c => c.max.y > 0.55 && c.max.y < 1.55)
    .map(c => ({
      x: (c.min.x + c.max.x) / 2,
      z: (c.min.z + c.max.z) / 2,
      r: Math.max(c.max.x - c.min.x, c.max.z - c.min.z) / 2
    }))
    .filter(p => p.r < 6);
  campo.parapetos = parapetos;

  // ------------------------------ caballos ------------------------------
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
  campo.nuevoCaballo = nuevoCaballo;

  campo.ponerCaballo = function () {
    if (campo.caballo) {
      campo.caballo.quitar();
      const i = caballos.indexOf(campo.caballo);
      if (i >= 0) caballos.splice(i, 1);
    }
    campo.caballo = nuevoCaballo(new THREE.Vector3(2.6, 0, 2.0), Math.PI);
  };

  // El caballo suelto más cercano. Si a un lancero le voltearon el jinete, su
  // caballo queda ahí y se puede tomar: en el campo sobran caballos sin dueño.
  function caballoCerca (metros) {
    let mejor = null, mejorD = metros;
    for (const c of caballos) {
      // el caballo de la otra máquina no se monta: es un dibujo, no un animal
      if (!c.vivo || c.montado || c.titere) continue;
      const d = c.pos.distanceTo(jugador.pos);
      if (d < mejorD) { mejor = c; mejorD = d; }
    }
    return mejor;
  }

  campo.montarODesmontar = function () {
    if (jugador.monta && jugador.monta.vivo) {
      jugador.desmontar();
      hud.mostrarAviso('Pie a tierra', 'bien');
      return;
    }
    const c = caballoCerca(3.6);
    if (!c) { hud.mostrarAviso('No hay caballo cerca', 'malo'); return; }
    campo.caballo = c;
    jugador.montar(c);
    hud.mostrarAviso('A caballo · W sube el andar, S lo baja · Espacio salta', 'bien');
  };

  // ------------------------------ soldados ------------------------------
  function soltarSoldado (bando, op = {}) {
    let pos;
    if (op.pos) {
      pos = op.pos.clone();
    } else if (bando === 'realista') {
      pos = new THREE.Vector3((Math.random() - 0.5) * 26, 0, -58 - Math.random() * 22);
    } else if (op.montado) {
      // Los lanceros no forman al lado tuyo: salen de los flancos, como
      // salieron los granaderos de atrás del convento. Necesitan cancha para
      // embalar.
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
    if (op.sombrero) sop.sombrero = op.sombrero;
    const s = new Soldado(escena, humo, sonido, pos, bando, sop);
    // los dos ganchos por los que un soldado le pide a combate.js que resuelva
    s.alDisparar = disparoEnemigo;
    s.alGolpear = golpeEnemigo;
    soldados.push(s);
    return s;
  }
  campo.soltarSoldado = soltarSoldado;

  const vivosDe = bando => soldados.filter(s => s.vivo && s.bando === bando).length;
  campo.vivosDe = vivosDe;

  // ------------------------------ artillería ------------------------------
  //
  // Las dos piezas de campaña que los españoles bajaron a la playa. Están del
  // lado de la barranca, mirando campo arriba, y son la cosa más peligrosa que
  // hay: un tarro de perdigones abre un abanico de cuarenta grados y ochenta
  // metros. Pero AVISAN —dos segundos largos de mecha encendida— y se pueden
  // callar matando a los artilleros que las sirven.
  campo.ponerCanones = function () {
    for (const c of canones) c.quitar();
    canones.length = 0;
    for (const [x, z, r] of PIEZAS) {
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
  };

  // ------------------------------ limpiar ------------------------------
  campo.limpiarCampo = function () {
    if (campo.alFormar) campo.alFormar();
    for (const s of soldados) s.quitar();
    soldados.length = 0;
    for (let i = caballos.length - 1; i >= 0; i--) {
      if (caballos[i] === campo.caballo) continue;
      caballos[i].quitar();
      caballos.splice(i, 1);
    }
  };

  function soltarTodo () {
    for (const s of soldados) s.quitar();
    soldados.length = 0;
    for (const c of caballos) if (jugador.monta !== c) c.quitar();
    caballos.length = 0;
    if (jugador.monta) caballos.push(jugador.monta);
  }

  // ------------------------------ LA PINZA ------------------------------
  //
  // La maniobra del 3 de febrero, jugable. Los números por defecto son los de
  // verdad: dos columnas de 60 y 250 realistas subiendo de la barranca. Están
  // medidos (pruebas/lejania.mjs): 370 hombres, 99 llamadas de dibujo. Si en
  // tu máquina va pesado, se le pasan otros: formarPinza(30, 120).
  campo.formarPinza = function (porColumna = 60, realistas = 250) {
    soltarTodo();
    pinza.desarmar();

    // EL DESEMBARCO, EN LÍNEA. Estaban en seis filas de cuarenta y dos, o sea
    // un bloque, y un bloque no puede tirar: sólo la fila de adelante tiene
    // línea de tiro, así que doscientos cincuenta hombres disparaban como
    // cuarenta. La infantería de la época se desplegaba en dos o tres filas
    // justamente por eso. En tres, ochenta y cuatro fusiles miran al campo.
    const PORFILA = Math.ceil(realistas / FILAS_REALISTAS);
    for (let k = 0; k < realistas; k++) {
      const fila = Math.floor(k / PORFILA);
      const s = soltarSoldado('realista', {
        pos: new THREE.Vector3(
          -(PORFILA * PASO_FILA / 2) + (k % PORFILA) * PASO_FILA, 0,
          Z_DESEMBARCO - fila * FONDO_FILA)
      });
      // MIRAN AL CONVENTO. Subieron de la barranca a saquearlo: el río les
      // queda atrás. Nacían mirando a −z, o sea al agua, y con la moral puesta
      // eso los dejaba flanqueados por su propio objetivo desde el cuadro uno.
      s.malla.rotation.y = Math.PI;
      s.frente = Math.PI;
    }
    campo.ponerCanones();

    // las dos columnas, escondidas detrás del convento
    for (const [col, plaza] of [[pinza.oeste, PLAZA_OESTE], [pinza.este, PLAZA_ESTE]]) {
      for (let k = 0; k < porColumna; k++) {
        const lat = ((k % 4) - 1.5) * 2.6;
        const atras = Math.floor(k / 4) * 3.4;
        const s = soltarSoldado('granadero', { montado: true,
          pos: new THREE.Vector3(plaza.x + lat, 0, plaza.z + atras) });
        if (!s.monta) continue;
        col.hombres.push(s);
      }
    }
    // la columna del este la manda su propio jefe; la del oeste la mandás vos
    pinza.este.jefe = pinza.este.hombres[0] || null;
    pinza.oeste.jefe = null;
    pinza.viva = true;

    // y vos vas a la cabeza de la del oeste, montado, en el punto del que
    // cuelga la formación: los sesenta se plantan detrás tuyo
    if (!(jugador.monta && jugador.monta.vivo)) {
      campo.caballo = nuevoCaballo(new THREE.Vector3(PLAZA_OESTE.x, 0, PLAZA_OESTE.z), PLAZA_OESTE.rumbo);
      jugador.montar(campo.caballo);
    }
    jugador.monta.pos.set(PLAZA_OESTE.x, 0, PLAZA_OESTE.z);
    jugador.monta.rumbo = PLAZA_OESTE.rumbo;
    jugador.monta.andar = 0;
    jugador.monta.vel = 0;
    jugador.pos.set(PLAZA_OESTE.x, jugador.pos.y, PLAZA_OESTE.z);
    // ARRANCÁS MIRÁNDOLOS. El caballo apunta al campo pero la cabeza va vuelta
    // sobre el hombro, como la vuelve cualquiera antes de dar una orden. Es la
    // primera imagen del juego y tiene que ser ésa: sesenta hombres esperando
    // que vos hagas algo. Mirando al frente, los sesenta quedaban a tu espalda
    // y no te enterabas de que estaban ahí —que es justo lo que pasó—.
    jugador.yaw = PLAZA_OESTE.rumbo + Math.PI;
    jugador.pitch = -0.04;
    for (const c of pinza.columnas) c.plantar();
    campo.oleadas = false;           // acá no llegan refuerzos sueltos: es LA batalla

    if (campo.alFormar) campo.alFormar();
    hud.mostrarAviso('Tu columna está formada · [T] toca el clarín', 'bien');
    hud.decir('Sesenta granaderos esperándote. Todavía no saben que estás acá.', 7);
    return { oeste: pinza.oeste.hombres.length, este: pinza.este.hombres.length, realistas };
  };

  // ------------------------------ las oleadas ------------------------------
  //
  // El modo suelto del campo de tiro: los realistas van llegando de a poco y
  // los granaderos también, hasta los topes de balance.js. En la batalla esto
  // está apagado —ahí están todos desde el principio—.
  campo.actualizarOleadas = function (dt) {
    if (!campo.oleadas || !jugador.vivo) return;
    campo._tRealista -= dt;
    if (campo._tRealista <= 0 && vivosDe('realista') < ENEMIGOS_MAX) {
      soltarSoldado('realista');
      campo._tRealista = OLEADA_REALISTA[0] + Math.random() * OLEADA_REALISTA[1];
    }
    campo._tGranadero -= dt;
    if (campo._tGranadero <= 0 && vivosDe('granadero') < ALIADOS_MAX) {
      // dos de cada tres granaderos van montados con lanza: era un regimiento
      // de caballería, no de infantería
      soltarSoldado('granadero', { montado: Math.random() < MONTADOS });
      campo._tGranadero = OLEADA_GRANADERO[0] + Math.random() * OLEADA_GRANADERO[1];
    }
  };

  campo.alternarOleadas = function () {
    campo.oleadas = !campo.oleadas;
    hud.mostrarAviso(campo.oleadas ? '¡Ahí vienen!' : 'Alto el fuego', campo.oleadas ? 'malo' : 'bien');
    if (!campo.oleadas) campo.limpiarCampo();
    campo._tRealista = 0;
    campo._tGranadero = 0;
  };

  return campo;
}
