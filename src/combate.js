// ===========================================================================
// EL COMBATE · quién le pega a quién, y qué pasa
// ===========================================================================
//
// Todas las resoluciones de impacto del juego, en un solo lugar: tu disparo,
// tu sablazo, el disparo de ellos, el bayonetazo de ellos, la metralla y la
// tirada de quedarse en la silla.
//
// Los NÚMEROS no están acá: están en balance.js. Acá está la mecánica —a quién
// se le pregunta, en qué orden, qué se ve y qué se oye— y allá cuánto cuesta.
// La separación importa porque son dos trabajos distintos: éste se toca cuando
// una regla está mal, aquél se toca cuando la pelea dura poco.
//
// El orden de las preguntas en un impacto es siempre el mismo, y no es
// caprichoso:
//
//   1. ¿acertó?           → balance.tirar(), y si no, el fallo se ve y se oye
//   2. ¿se lo comió el caballo?  → CABALLO_COME, antes que nada del hombre
//   3. ¿cuánto duele?     → la tabla de daño
//   4. ¿se cae de la silla? → la tirada de VOLTEO menos el oficio

import * as THREE from 'three';
import {
  VOLTEO, OFICIO, AGARRE_AFLOJA, tirar,
  DANO_BALA, DANO_BAYONETA, DANO_METRALLA, CAIDA, BAYONETA_PARADA,
  BALA_JUGADOR, DANO_SABLE, DANO_REMATE,
  BALA_TROPA, BAYONETA_TROPA, LANZA_TROPA, METRALLA_TROPA,
  CABALLO_COME, BALA_AL_CABALLO, METRALLA_CABALLO,
  BLANCO_HOMBRE, BLANCO_MONTADO, ZUMBIDO,
  BLOQUEO_GASTO, PECHADA_GASTO, PECHADA_ALCANCE, SABLE_ALCANCE, ALCANCE_MONTADO
} from './balance.js';

export function armarCombate (ctx) {
  const { escena, camara, jugador, soldados, canones, mundo,
    humo, fuego, sonido, hud, sable, luzBoca, montado, conSable } = ctx;

  const rayo = new THREE.Raycaster();
  rayo.far = 220;

  // -------------------------------------------------------------------------
  // el fallo, que tiene que verse
  // -------------------------------------------------------------------------
  //
  // Un disparo que erra sin dejar rastro es indistinguible de uno que no
  // existió, y entonces el jugador sólo percibe los que le pegan: de ahí sale
  // la sensación de que nunca fallan. Si la bala pasó cerca, zumba; si se fue a
  // la tierra, levanta polvo donde cayó.
  function falloVisible (origen, blanco, tiro, contraVos) {
    const eje = new THREE.Vector3().subVectors(blanco, origen);
    const d = eje.length() || 1;
    eje.divideScalar(d);
    const lado = new THREE.Vector3(-eje.z, 0, eje.x);
    const paso = new THREE.Vector3().copy(blanco)
      .addScaledVector(lado, tiro.dx).add(new THREE.Vector3(0, tiro.dy, 0));
    if (contraVos) {
      if (tiro.fuera < ZUMBIDO) { sonido.zumbido(); jugador.sacudir(0.10); }
      else if (tiro.fuera < 4) sonido.zumbido(0.4);
    }
    if (paso.y < 0.5) {
      paso.y = 0.06;
      humo.soltar(paso, new THREE.Vector3(0, 1, 0),
        { cantidad: 2, vida: 1.5, empuje: 0.9, radio: 0.22, opacidad: 0.30, claro: 0.6, tierra: 1 });
    }
  }

  // -------------------------------------------------------------------------
  // la silla
  // -------------------------------------------------------------------------
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

  // A SAN MARTÍN CUESTA BAJARLO. La probabilidad sale de la tabla —el arma
  // manda— y se le resta el oficio del jinete, multiplicado por lo agarrado
  // que estés. Cada golpe aguantado te afloja: no hay un tiro que te baje, hay
  // una acumulación, y la respuesta correcta a que te tambaleen es salir de
  // ahí, no seguir cargando.
  function intentarVoltear (base, aviso) {
    if (!montado()) return false;
    const riesgo = base * (1 - OFICIO * jugador.agarre);
    if (Math.random() < riesgo) return voltear(aviso);
    jugador.agarre = Math.max(0, jugador.agarre - AGARRE_AFLOJA);
    jugador.sacudir(0.45 + (1 - jugador.agarre) * 0.35);
    sonido.golpeRecibido();
    hud.mostrarAviso(jugador.agarre < 0.45 ? '¡Te vas de la silla!' : 'Te tambaleaste', 'malo');
    return false;
  }

  // -------------------------------------------------------------------------
  // tu arma de fuego
  // -------------------------------------------------------------------------
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
      if (soldado.recibir(BALA_JUGADOR, d, VOLTEO.bala)) hud.mostrarAviso('Realista abatido', 'bien');
    } else if (raiz.userData.blanco) {
      sonido.impactoMadera();
      hud.mostrarAviso(`Blanco a ${Math.round(g.distance)} m`, 'bien');
      humo.soltar(g.point, d, { cantidad: 2, vida: 2, empuje: 1, radio: 0.09, opacidad: 0.3 });
    }
  }

  // -------------------------------------------------------------------------
  // tu arma blanca
  // -------------------------------------------------------------------------
  // El realista más cercano dentro del cono de adelante.
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

  // culatazo y bayonetazo del arma larga
  function resolverGolpe (alcance, dano, nombre) {
    const g = enemigoAlFrente(alcance);
    if (!g) return;
    sonido.impactoCarne();
    const o = g.soldado;
    if (o.montado && Math.random() < CABALLO_COME) { o.monta.recibir(BALA_AL_CABALLO); return; }
    if (o.recibir(dano, g.frente, VOLTEO.bayoneta)) hud.mostrarAviso(nombre, 'bien');
  }

  // El sablazo choca contra el acero si el realista está en guardia. Ahí está
  // la lección del duelo: no se entra de frente, se espera el aviso.
  function sablazo () {
    const remate = sable.remate;
    const g = enemigoAlFrente(montado() ? ALCANCE_MONTADO : SABLE_ALCANCE);
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
    // el sable desde arriba también puede bajarlo de la silla, y a la
    // velocidad del galope más: el mismo principio del lanzazo con menos asta
    const vuelca = montado() ? Math.min(VOLTEO.lanza, VOLTEO.bayoneta * filo) : VOLTEO.bayoneta;
    if (g.soldado.recibir(dano, g.frente, vuelca)) {
      hud.mostrarAviso(remate ? '¡Rematado!' : (filo > 2 ? '¡Lo llevó puesto!' : 'A sablazos'), 'bien');
    }
  }

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

  // -------------------------------------------------------------------------
  // el fuego de ellos
  // -------------------------------------------------------------------------
  function disparoEnemigo (quien, origen, dir, objetivo) {
    const oc = humo.oclusion(origen, objetivo.pos);
    const dist = origen.distanceTo(objetivo.pos);

    const montadoBlanco = objetivo.jugador ? montado() : !!(objetivo.soldado && objetivo.soldado.montado);
    // un hombre a caballo es un blanco mucho más grande; agachado, mucho menor
    const ancho = BLANCO_HOMBRE
      * (objetivo.jugador ? jugador.cfgPostura.blanco : 1)
      * (montadoBlanco ? BLANCO_MONTADO : 1);
    const tiro = quien.apuntarA(dist, oc, ancho);

    if (!tiro.acierto) {
      falloVisible(origen, objetivo.pos, tiro, objetivo.jugador);
      return;
    }

    if (objetivo.jugador) {
      if (jugador.atrapado > 0) return;
      if (montado() && Math.random() < CABALLO_COME) {
        jugador.monta.recibir(BALA_AL_CABALLO);
        jugador.sacudir(0.3);
        sonido.impactoCarne();
        hud.mostrarAviso('¡Le dieron al caballo!', 'malo');
        return;
      }
      jugador.recibir(DANO_BALA, dir);
      if (montado()) intentarVoltear(VOLTEO.bala, '¡Te bajaron de un balazo!');
      else {
        sonido.golpeRecibido();
        hud.mostrarAviso('¡Te dieron!', 'malo');
      }
      return;
    }

    if (objetivo.soldado) {
      const o = objetivo.soldado;
      if (o.montado && Math.random() < CABALLO_COME) { o.monta.recibir(BALA_AL_CABALLO); return; }
      o.recibir(BALA_TROPA, dir, VOLTEO.bala);
    }
  }

  function golpeEnemigo (quien, objetivo) {
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
        jugador.recibir(Math.round(DANO_BAYONETA * BAYONETA_PARADA), frente);
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
      return;
    }

    if (objetivo.soldado) {
      const o = objetivo.soldado;
      // El lanzazo mata de una: el asta llega antes que la bayoneta y ese metro
      // de diferencia es toda la batalla.
      if (quien.lancero) { o.recibir(LANZA_TROPA, null, VOLTEO.lanza); return; }
      // La misma regla que la bala, y por el mismo motivo: lo que la infantería
      // tiene adelante es el caballo. Sin esto, la bayoneta le pegaba siempre
      // al hombre —lo único que no puede alcanzar desde abajo— y una carga de
      // caballería se deshacía en el primer contacto.
      if (o.montado && Math.random() < CABALLO_COME) o.monta.recibir(BALA_AL_CABALLO);
      else o.recibir(BAYONETA_TROPA, null, VOLTEO.bayoneta);
    }
  }

  // -------------------------------------------------------------------------
  // la metralla
  // -------------------------------------------------------------------------
  // El abanico cobra a todo el que esté adentro del cono, de los dos bandos
  // —la metralla no distingue— y castiga más al que va montado, porque un
  // caballo es un blanco enorme.
  function resolverMetralla (canon) {
    jugador.sacudir(0.5);
    const f = jugador.vivo ? canon.fuerzaSobre(jugador.pos) : 0;
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
      else if (Math.random() < g) s.recibir(METRALLA_TROPA, null, VOLTEO.metralla);
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

  return { resolverDisparo, resolverGolpe, enemigoAlFrente, sablazo, pechada,
    voltear, intentarVoltear, falloVisible,
    disparoEnemigo, golpeEnemigo, resolverMetralla, metrallaEncima };
}
