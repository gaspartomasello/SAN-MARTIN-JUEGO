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
  DANO_BAYONETA, DANO_METRALLA, CAIDA, BAYONETA_PARADA,
  BALA_JUGADOR, BALA_MIEMBRO, ZONA_CABEZA, ZONA_PECHO, DANO_SABLE, DANO_REMATE,
  BAYONETA_TROPA, LANZA_TROPA, METRALLA_TROPA, danoBalaEnemiga, balaContraTropa,
  CABALLO_COME, BALA_AL_CABALLO, metrallaAlCaballo,
  BLANCO_HOMBRE, BLANCO_MONTADO, ZUMBIDO,
  BLOQUEO_GASTO, PECHADA_GASTO, PECHADA_ALCANCE, SABLE_ALCANCE, ALCANCE_MONTADO,
  ATROPELLO, ATROPELLO_VEL, ATROPELLO_ESPERA, ATROPELLO_EMPUJE, ATROPELLO_TIRADO
} from './balance.js';

export function armarCombate (ctx) {
  const { opciones, escena, camara, jugador, soldados, canones, mundo,
    humo, fuego, sonido, hud, sable, luzBoca, montado, conSable } = ctx;

  const rayo = new THREE.Raycaster();
  rayo.far = 220;

  // -------------------------------------------------------------------------
  // lo que se ve cuando algo pega
  // -------------------------------------------------------------------------
  //
  // LAS CHISPAS DEL ACERO. Sin ellas, parar un bayonetazo se oía pero no se
  // veía: el duelo entero pasaba sin una sola señal de que los dos aceros se
  // habían tocado. Salen entre vos y el que te entró, a la altura del pecho,
  // que es donde se cruzan las hojas.
  const _p = new THREE.Vector3();
  function chispear (quien) {
    if (!quien) return;
    _p.copy(quien.pos).add(jugador.pos).multiplyScalar(0.5);
    _p.y = jugador.pos.y - 0.25;
    fuego.chispas(_p, new THREE.Vector3().subVectors(jugador.pos, quien.pos).setY(0.6).normalize());
  }

  // LA SALPICADURA, que sale sólo si la pidieron. El juego viene sin ella y esa
  // es la decisión, no un olvido: la pregunta se hace UNA vez acá y no en cada
  // sitio donde algo recibe un golpe, para que no quede un rincón del código
  // sangrando por su cuenta cuando la opción está apagada.
  function salpicar (punto, dir) {
    if (!opciones || !opciones.sangre) return;
    fuego.salpicadura(punto, dir);
  }

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
    // CAERSE DE UN CABALLO NO ES QUE TE PEGUEN. Vas a dos metros del piso y a
    // diez metros por segundo: el golpe te deja unos segundos sin mundo. Es el
    // aviso más fuerte que da el juego y tiene que doler.
    sonido.golpeRecibido(1.25);
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
    // te tambaleaste pero seguís arriba: el oído se resiente y se recompone
    sonido.golpeRecibido(0.55 + (1 - jugador.agarre) * 0.3);
    hud.mostrarAviso(jugador.agarre < 0.45 ? '¡Te vas de la silla!' : 'Te tambaleaste', 'malo');
    return false;
  }

  // -------------------------------------------------------------------------
  // tu arma de fuego
  // -------------------------------------------------------------------------
  // A DÓNDE LE PEGASTE. La altura del impacto sobre los pies del hombre, medida
  // contra la altura de su ojo: así la misma cuenta vale para uno parado, uno
  // hincado y uno arriba del caballo, que son tres alturas distintas del mismo
  // cuerpo. Los cortes salen de la tabla, como todo lo demás.
  function zona (s, y) {
    const ojo = s.fig.alturaOjo || 1.6;
    const alto = (y - s.pos.y) / ojo;
    if (alto >= ZONA_CABEZA) return 'cabeza';
    if (alto >= ZONA_PECHO) return 'pecho';
    return 'miembro';
  }

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
      salpicar(g.point, d);
      const z = zona(soldado, g.point.y);
      const dano = z === 'miembro' ? BALA_MIEMBRO : BALA_JUGADOR;
      if (soldado.recibir(dano, d, VOLTEO.bala)) {
        hud.mostrarAviso(z === 'cabeza' ? '¡A la cabeza!' : 'Realista abatido', 'bien');
      } else if (z === 'miembro') {
        hud.mostrarAviso('Le diste, pero sigue en pie', 'bien');
      }
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
    salpicar(_p.copy(o.pos).setY(o.pos.y + 1.15), g.frente);
    if (o.montado && Math.random() < CABALLO_COME) { o.monta.recibir(BALA_AL_CABALLO); return; }
    if (o.recibir(dano, g.frente, VOLTEO.bayoneta)) hud.mostrarAviso(nombre, 'bien');
  }

  // El sablazo choca contra el acero si el realista está en guardia. Ahí está
  // la lección del duelo: no se entra de frente, se espera el aviso.
  function sablazo () {
    const remate = sable.remate;
    const g = enemigoAlFrente(montado() ? ALCANCE_MONTADO : SABLE_ALCANCE);
    if (!g) return;
    // LA GUARDIA NO PARA UN CABALLO LANZADO. Un hombre a pie puede leer un
    // sablazo y cruzar el fusil; lo que no puede es hacerlo contra algo que le
    // viene encima a diez metros por segundo. Es exactamente lo que ya hacía la
    // pechada —bajarle la guardia— pero sin gastar aliento: acá lo paga el
    // caballo. Y le da sentido al galope: montado y frenado sos un blanco
    // grande con la guardia enfrente; montado y lanzado no hay guardia.
    const lanzado = montado() && jugador.monta.vel >= ATROPELLO_VEL;
    if (g.soldado.cubierto && !remate && !lanzado) {
      sonido.choque();
      jugador.sacudir(0.16);
      chispear(g.soldado);
      hud.mostrarAviso('Paró el sablazo', 'malo');
      return;
    }
    sonido.impactoCarne();
    salpicar(_p.copy(g.soldado.pos).setY(g.soldado.pos.y + 1.3), g.frente);
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
      jugador.recibir(danoBalaEnemiga(dist), dir);
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
      o.recibir(balaContraTropa(dist), dir, VOLTEO.bala);
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
        chispear(quien);
        jugador.sacudir(0.22);
        quien.aturdir();
        hud.mostrarAviso('¡PARADA! Rematalo', 'bien');
        return;
      }
      if (parada === 'bloqueo') {
        sonido.choque();
        chispear(quien);
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
        jugador.monta.recibir(metrallaAlCaballo(f));
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
      if (s.montado) s.monta.recibir(metrallaAlCaballo(g));
      else if (Math.random() < g) s.recibir(METRALLA_TROPA, null, VOLTEO.metralla);
    }
  }

  // -------------------------------------------------------------------------
  // el atropello
  // -------------------------------------------------------------------------
  //
  // Lo llama gentio.js, que YA recorre cada caballo y cada hombre que tiene
  // encima para apartarlos —la rejilla y el bucle estaban hechos, esto no
  // agrega ni una pasada—. Acá se decide lo único que gentio no puede decidir:
  // si eso cuesta sangre.
  //
  let reloj = 0;
  function correrReloj (dt) { reloj += dt; }

  function arrollar (caballo, o) {
    if (caballo.vel < ATROPELLO_VEL) return;
    if (!o.vivo || o.montado) return;
    // Y ES TUYO. El caballo del granadero aparta al infante como apartó siempre
    // —de eso se ocupa gentio.js— y nada más. El porqué está medido y contado
    // en balance.js: sobre esta superficie de contacto no hay versión chica.
    if (caballo !== jugador.monta) return;
    if (!o.esRealista) return;
    // al mismo hombre no se lo lleva puesto sesenta veces por segundo
    if (reloj - (o.tAtropello || -99) < ATROPELLO_ESPERA) return;
    o.tAtropello = reloj;

    sonido.impactoCarne();
    o.aturdir(ATROPELLO_TIRADO);
    const fx = -Math.sin(caballo.rumbo), fz = -Math.cos(caballo.rumbo);
    o.pos.x += fx * ATROPELLO_EMPUJE;
    o.pos.z += fz * ATROPELLO_EMPUJE;
    if (o.recibir(ATROPELLO, null, VOLTEO.bayoneta)) hud.mostrarAviso('¡Lo llevaste puesto!', 'bien');
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
    voltear, intentarVoltear, falloVisible, arrollar, correrReloj,
    disparoEnemigo, golpeEnemigo, resolverMetralla, metrallaEncima };
}
