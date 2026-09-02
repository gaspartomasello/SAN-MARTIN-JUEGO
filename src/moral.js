// ===========================================================================
// LA MORAL · lo único que le puede dar un final a esta batalla
// ===========================================================================
//
// San Lorenzo duró quince minutos y NO terminó por bajas: terminó porque la
// línea realista se quebró y bajó corriendo la barranca a los botes, dejando
// las dos piezas, la bandera y sus muertos. De doscientos cincuenta hombres
// murieron unos cuarenta. Nadie los exterminó.
//
// El juego, hasta acá, no tenía otra forma de terminar que matarlos a todos de
// a uno. Eso no es una dificultad mal calibrada: es una batalla distinta.
//
// ---------------------------------------------------------------------------
// ESTE ARCHIVO MIRA LA TROPA; soldados.js mira al hombre
// ---------------------------------------------------------------------------
//
// El reparto es el mismo que entre pinza.js y soldados.js. El hombre sabe
// cuánto ánimo le queda y qué hace cuando se le acaba —correr a la barranca—.
// Lo que NO puede saber solo es qué está pasando a su alrededor: cuántos
// cayeron cerca, si le están entrando por el flanco, si se le viene la
// caballería encima, si quedó solo, si sus vecinos ya se están yendo. Eso es
// mirar la tropa, y se mira desde acá.
//
// Y los números no están ni acá ni allá: están en balance.js, sección 8.
//
// ---------------------------------------------------------------------------
// POR QUÉ SE MIRA ESCALONADO Y NO TODOS LOS CUADROS
// ---------------------------------------------------------------------------
//
// Cada hombre necesita una vuelta por todos los demás: son trescientos setenta
// contra trescientos setenta, ciento cuarenta mil cuentas. Sesenta veces por
// segundo eso es ocho millones y medio de cuentas por segundo, y no hay ninguna
// razón para pagarlo: el ánimo de un hombre no cambia de manera apreciable en
// dieciséis milésimas.
//
// Así que cada uno mira cada 0,4 s, y los turnos están repartidos al nacer. Por
// cuadro se miran quince hombres, no trescientos setenta: cinco mil seiscientas
// cuentas, que al lado de las doscientas mil por segundo que ya cuesta la
// separación no se notan. Medido en pruebas/moral.mjs.
//
// De paso, escalonar sirve para algo más que el costo: si todos miraran en el
// mismo cuadro, todos cruzarían el umbral en el mismo cuadro.

import {
  VIDA_TROPA,
  CAIDO_CERCA, CAIDO_RADIO,
  FLANCO, FLANCO_RADIO, FLANCO_CONO, FLANCO_LLENO,
  CABALLO_ENCIMA, CABALLO_RADIO, CABALLO_LLENO, CABALLO_FLANCO,
  SOLEDAD, JUNTOS_RADIO, JUNTOS_MINIMO,
  HERIDO, PIEZA_CALLADA, PIEZA_RADIO, FRENTE_GIRO,
  APLOMO, DESGASTE, CONTAGIO, CONTAGIO_RADIO,
  LINEA_ROTA, LINEA_MINIMA, DESBANDE
} from './balance.js';

const PASO = 0.4;                 // cada cuánto mira cada hombre a su alrededor
const COS_FLANCO = Math.cos(FLANCO_CONO);
const R2_LEJOS = FLANCO_RADIO * FLANCO_RADIO;   // el radio más grande de todos
const GRITO = 0.35;               // no más de un grito de pánico cada tanto

export function armarMoral (ctx) {
  const { soldados, caballos, canones, hud, sonido, jugador, montado, red } = ctx;

  const roto = { realista: false, granadero: false };
  let idos = 0;                   // cuántos bajaron la barranca y se fueron
  let tGrito = 0;

  // Un golpe de ánimo de los que se cobran DE GOLPE —el compañero que cae, la
  // pieza que calla, la línea que se rompe—. Pasa por acá y no se resta a mano
  // en tres lugares porque también tiene que morder el techo: si no, un hombre
  // se comería cincuenta de susto y los recuperaría enteros dos minutos después
  // como si no hubiera pasado nada.
  function golpear (o, n) {
    o.animo -= n;
    o.techo = Math.max(0, o.techo - n * DESGASTE);
  }

  // -------------------------------------------------------------------------
  // 1. EL QUE CAYÓ AL LADO
  // -------------------------------------------------------------------------
  //
  // Es el término más pesado y se cobra DE GOLPE, una sola vez, no mientras el
  // cadáver esté ahí. Contar cadáveres haría que un campo lleno de muertos
  // siguiera desmoralizando cuarenta segundos después de la pelea, que es al
  // revés de cómo funciona el susto: lo que asusta es el hombre cayendo, no el
  // hombre caído.
  function llorar (muerto) {
    const { x, z } = muerto.pos;
    for (const o of soldados) {
      if (o === muerto || !o.vivo || o.quebrado || o.titere) continue;
      if (o.bando !== muerto.bando) continue;
      const d = Math.hypot(o.pos.x - x, o.pos.z - z);
      if (d > CAIDO_RADIO) continue;
      golpear(o, CAIDO_CERCA * o.temple * (1 - d / CAIDO_RADIO));
    }
  }

  // -------------------------------------------------------------------------
  // 2. LO QUE VE UN HOMBRE ALREDEDOR
  // -------------------------------------------------------------------------
  function mirar (s, dt) {
    let amigos = 0, flanco = 0, jinetes = 0, deCostado = 0, rotos = 0;

    // EL FRENTE DE LA TROPA, que persigue al rumbo del hombre pero muchísimo
    // más despacio. Contra esto se mide el flanco, y no contra hacia dónde
    // tiene la cara en este cuadro: si no, alcanzaría con girar para dejar de
    // estar flanqueado, y flanquear no costaría nada.
    if (s.frente === null) s.frente = s.malla.rotation.y;
    else {
      let g = s.malla.rotation.y - s.frente;
      g = Math.atan2(Math.sin(g), Math.cos(g));
      const paso = FRENTE_GIRO * dt;
      s.frente += Math.max(-paso, Math.min(paso, g));
    }
    // adelante = (−sen r, −cos r), que es la convención del modelo
    const fx = -Math.sin(s.frente), fz = -Math.cos(s.frente);

    for (const o of soldados) {
      if (o === s || !o.vivo) continue;
      const dx = o.pos.x - s.pos.x, dz = o.pos.z - s.pos.z;
      const d2 = dx * dx + dz * dz;
      if (d2 > R2_LEJOS) continue;
      const d = Math.sqrt(d2) || 0.001;
      if (o.bando === s.bando) {
        if (o.quebrado) { if (d < CONTAGIO_RADIO) rotos++; }
        else if (d < JUNTOS_RADIO) amigos++;
        continue;
      }
      // ¿lo tengo adelante, o al costado y a la espalda?
      const aLaCara = (dx * fx + dz * fz) / d >= COS_FLANCO;
      if (o.montado && d < CABALLO_RADIO) { jinetes++; if (!aLaCara) deCostado++; }
      if (!aLaCara) flanco++;
    }

    // Y VOS CONTÁS. Sos el enemigo más importante del campo: si el jugador no
    // entrara en esta cuenta, cargarles por el flanco vos mismo no les haría
    // nada y toda la maniobra se la comerían los bots.
    if (s.esRealista && jugador.vivo) {
      const dx = jugador.pos.x - s.pos.x, dz = jugador.pos.z - s.pos.z;
      const d = Math.hypot(dx, dz) || 0.001;
      if (d < FLANCO_RADIO) {
        const aLaCara = (dx * fx + dz * fz) / d >= COS_FLANCO;
        if (montado() && d < CABALLO_RADIO) { jinetes++; if (!aLaCara) deCostado++; }
        if (!aLaCara) flanco++;
      }
    }

    // POR QUÉ SE ESTÁ QUEBRANDO. Se anota desglosado, y no es un lujo de
    // depuración: un sistema en el que un hombre deja de pelear sin que se
    // pueda decir por qué es un sistema que no se puede ajustar. Cuesta cinco
    // escrituras cada 0,4 s por hombre.
    const q = s.porQue || (s.porQue = { flanco: 0, jinetes: 0, solo: 0, herido: 0, rotos: 0 });
    // A PIE Y A CABALLO NO SE LE TIENE MIEDO A LO MISMO.
    //
    // El flanco y la soledad son de la LÍNEA DE INFANTERÍA y se cobran sólo a
    // pie (el porqué, en balance.js). Una carga se mete adentro del enemigo:
    // quedar rodeado es el objetivo, y el lancero necesita cancha. Cobrárselos
    // era castigar a la tropa por hacer bien su trabajo — medido: 1,62 de
    // flanco por segundo al granadero contra 0,57 al realista.
    //
    // Y al que le voltean el caballo se le cobran los dos de golpe, que es
    // exactamente lo que tiene que sentir: dejó de ser caballería.
    const aPie = !s.montado;
    q.flanco = aPie && flanco ? FLANCO * Math.min(1, flanco / FLANCO_LLENO) : 0;
    q.solo = aPie && amigos < JUNTOS_MINIMO ? SOLEDAD * (1 - amigos / JUNTOS_MINIMO) : 0;
    // el jinete que te entra por el costado asusta el doble largo que el que
    // te viene de frente: es la misma idea que el flanco, no otra
    q.jinetes = jinetes
      ? CABALLO_ENCIMA * Math.min(1, jinetes / CABALLO_LLENO) *
        (1 + (deCostado / jinetes) * (CABALLO_FLANCO - 1))
      : 0;
    q.herido = s.vida <= VIDA_TROPA / 2 ? HERIDO : 0;
    q.rotos = rotos ? CONTAGIO * Math.min(1, rotos / 2) : 0;
    const baja = q.flanco + q.jinetes + q.solo + q.herido + q.rotos;

    // EL DESGASTE, que es lo que hace que esto avance. Una parte de lo que le
    // entró se la lleva el techo, y el techo no vuelve a subir: el aplomo
    // recompone al hombre hasta donde quedó, no hasta donde estaba.
    //
    // Sin esto la cuenta era una resta pura y el resultado, una moneda al aire:
    // al que le tocaba un temple bueno y una pausa se le recomponía el ánimo
    // entero y no se quebraba nunca, y la misma batalla terminaba en desbandada
    // o en exterminio según cómo cayeran los dados. Con el techo el castigo se
    // acumula, la línea se va gastando y el quiebre llega igual: más tarde si
    // aguantan bien, pero llega.
    s.techo = Math.max(0, s.techo - baja * s.temple * DESGASTE * dt);

    // El neto, y no una rama: si el recupero fuera un «else» habría un
    // escalón en cero —el que tiene un enemigo lejísimos no se recompone
    // nunca— y toda la tensión de la pelea está justo en esta resta.
    s.animo = Math.max(0, Math.min(s.techo, s.animo + (APLOMO - baja * s.temple) * dt));
    if (s.animo <= 0) quebrar(s);
  }

  function quebrar (s) {
    if (!s.quebrar()) return;
    if (tGrito <= 0) { sonido.grito(); tGrito = GRITO; }
  }

  // -------------------------------------------------------------------------
  // 3. LA PIEZA QUE CALLA
  // -------------------------------------------------------------------------
  //
  // Las dos piezas de campaña eran la espina dorsal de esa fuerza. Callar una
  // —matándole los artilleros o desmontándola— no es sólo dejar de comer
  // metralla: es un golpe para todos los que la tenían atrás.
  function mirarPiezas () {
    for (const c of canones) {
      if (c._callada || !c.sirvientes.length) continue;
      if (c.vivo && c.servido) continue;
      c._callada = true;
      for (const o of soldados) {
        if (!o.vivo || o.quebrado || o.titere || !o.esRealista) continue;
        const d = Math.hypot(o.pos.x - c.pos.x, o.pos.z - c.pos.z);
        if (d > PIEZA_RADIO) continue;
        golpear(o, PIEZA_CALLADA * o.temple * (1 - d / PIEZA_RADIO));
      }
    }
  }

  // -------------------------------------------------------------------------
  // 4. LA LÍNEA ROTA
  // -------------------------------------------------------------------------
  //
  // El instante en que la retirada se vuelve fuga. Cuando ya se quebró una
  // parte del bando, lo que queda VE que se está yendo todo el mundo, y eso es
  // un golpe aparte del contagio de al lado: es de bando, no de vecino. Sin él
  // la desbandada se arrastra de a uno; con él tiene un momento, y ese momento
  // es el final de la batalla.
  function romper (bando, vivos) {
    roto[bando] = true;
    for (const o of soldados) {
      if (!o.vivo || o.quebrado || o.titere || o.bando !== bando) continue;
      golpear(o, DESBANDE * o.temple);
    }
    if (bando === 'realista') {
      hud.mostrarAviso('¡SE QUIEBRA LA LÍNEA!', 'bien');
      hud.decir('Están bajando la barranca. Dejaron las piezas donde estaban.', 7);
      red.contar('¡SE QUIEBRA LA LÍNEA!', 'bien',
        'Están bajando la barranca. Dejaron las piezas donde estaban.');
    } else {
      hud.mostrarAviso('¡SE TE QUIEBRA LA COLUMNA!', 'malo');
      hud.decir(`Los granaderos se están yendo. Quedan ${vivos} y no todos te están mirando.`, 7);
      red.contar('¡SE TE QUIEBRA LA COLUMNA!', 'malo',
        'Los granaderos se están yendo.');
    }
  }

  // -------------------------------------------------------------------------
  // el barrido
  // -------------------------------------------------------------------------
  const cuenta = {
    realista: { vivos: 0, rotos: 0 },
    granadero: { vivos: 0, rotos: 0 }
  };

  function actualizar (dt) {
    if (dt <= 0) return;
    tGrito -= dt;
    cuenta.realista.vivos = 0; cuenta.realista.rotos = 0;
    cuenta.granadero.vivos = 0; cuenta.granadero.rotos = 0;

    // UNA sola vuelta para las tres cosas que se miran todos los cuadros: los
    // muertos nuevos, el turno de cada uno y la cuenta de cada bando.
    for (const s of soldados) {
      if (s.titere) continue;
      if (!s.vivo) {
        if (!s._llorado) { s._llorado = true; llorar(s); }
        continue;
      }
      const c = cuenta[s.bando];
      if (c) { c.vivos++; if (s.quebrado) c.rotos++; }
      if (s.quebrado) continue;
      s.tAnimo -= dt;
      if (s.tAnimo <= 0) { const paso = PASO - s.tAnimo; s.tAnimo = PASO; mirar(s, paso); }
    }

    mirarPiezas();

    for (const bando of ['realista', 'granadero']) {
      const c = cuenta[bando];
      if (roto[bando] || c.vivos < LINEA_MINIMA) continue;
      if (c.rotos / c.vivos >= LINEA_ROTA) romper(bando, c.vivos - c.rotos);
    }

    levantarLosQueSeFueron();
  }

  // El que llegó a su refugio se fue de la batalla. Se lo saca del campo —y a
  // su caballo con él, que si no queda un animal invisible dando vueltas—
  // porque un hombre parado contra el borde de la barranca durante quince
  // minutos no es una retirada: es un adorno atascado.
  function levantarLosQueSeFueron () {
    for (let i = soldados.length - 1; i >= 0; i--) {
      const s = soldados[i];
      if (!s.quebrado || !s.vivo || s.titere || !s.enRefugio) continue;
      const c = s.monta;
      s.quitar();
      soldados.splice(i, 1);
      if (c) {
        const k = caballos.indexOf(c);
        if (k >= 0) caballos.splice(k, 1);
      }
      idos++;
    }
  }

  // Cuando se rearma el campo, la moral empieza de cero otra vez.
  function reiniciar () {
    roto.realista = false;
    roto.granadero = false;
    idos = 0;
    for (const c of canones) c._callada = false;
  }

  return {
    actualizar,
    reiniciar,
    get idos () { return idos; },
    get lineaRota () { return { realista: roto.realista, granadero: roto.granadero }; },
    parte: () => ({
      realistas: { ...cuenta.realista },
      granaderos: { ...cuenta.granadero },
      idos,
      roto: { ...roto }
    })
  };
}
