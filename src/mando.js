// ===========================================================================
// EL MANDO · el teclado, el mouse y los tres modos
// ===========================================================================
//
// La única parte del juego que habla con el navegador: teclas, botones,
// captura del puntero, la pantalla de pausa y los tres botones de la portada.
//
// No decide nada. Traduce «apretó F» a «puntazo» o «pechada» y le pide al
// módulo que corresponda que lo haga. Si algo de acá pareciera lógica de
// juego, está en el archivo equivocado.

export function armarMando (ctx) {
  const { lienzo, jugador, sable, arsenal, campo, combate, pinza, hud, sonido, red, plano, acto, opciones } = ctx;

  const teclas = new Set();
  const sensibilidad = 0.0021;
  let bloqueado = false;
  let empezado = false;
  let tSoltado = 0;

  const montado = () => !!jugador.monta && jugador.monta.vivo;
  const pantallaPausa = document.getElementById('pausa');

  // ------------------------------ teclado ------------------------------
  addEventListener('keydown', ev => {
    if (ev.code === 'Escape') return;
    teclas.add(ev.code);
    if (ev.repeat) return;
    // Bajo el caballo no hay tecla que sirva. El espacio se registra igual —el
    // acto lee el forcejeo de aquí— pero no dispara ninguna acción.
    if (jugador.atrapado > 0) { if (ev.code === 'Space') ev.preventDefault(); return; }
    switch (ev.code) {
      case 'KeyR': arsenal.cargar(); break;
      case 'Space': {
        // EMPUJANDO NO SE SALTA, Y SÓLO EMPUJANDO. El espacio es fuerza contra
        // medio caballo cuando estás al lado, y si además saltara, el sargento
        // daría brincos arriba de un hombre tirado en el pasto mientras lo
        // levanta. Pero eso vale cuando tiene el animal al lado y nada más:
        // Cabral corre once metros hasta llegar y en esos once metros salta
        // como cualquiera. La primera versión de esto apagaba el salto en todo
        // el acto y le sacaba al sargento algo que sabía hacer.
        if (acto && acto.puedeEmpujar) { ev.preventDefault(); break; }
        // A caballo el espacio no salta a vos: bate al caballo. Y no batís
        // parado —hace falta trote— porque un caballo tampoco salta parado.
        if (montado()) {
          const c = jugador.monta;
          if (c.saltar()) jugador.sacudir(0.25);
          else hud.mostrarAviso(c.vel < 2.2 ? 'Falta carrera para saltar' : 'Todavía no', 'malo');
          break;
        }
        ev.preventDefault();
        if (jugador.saltar()) { const a = arsenal.actual(); if (a) a.soltarCarga(); }
        break;
      }
      // Agacharse va en C y no en Ctrl: el navegador se queda con Ctrl+W y
      // cierra la pestaña, y eso no hay forma de bloquearlo desde la página.
      case 'KeyC': jugador.alternarPostura('agachado'); break;
      case 'KeyZ': jugador.alternarPostura('tierra'); break;
      case 'KeyF': {
        const a = arsenal.actual();
        if (a) a.puntazo(); else combate.pechada();
        break;
      }
      case 'KeyH': campo.montarODesmontar(); break;
      case 'KeyG': arsenal.tomarOIntercambiar(); break;
      case 'Digit1': arsenal.cambiar('larga'); break;
      case 'Digit2': arsenal.cambiar('sable'); break;
      case 'Digit3': arsenal.cambiar('pistolon'); break;
      case 'Digit4': arsenal.cambiar('remington'); break;
      // EL CLARÍN. Una sola tecla, una sola vez, y salen los ciento veinte.
      //
      // En red lo toca UNO SOLO, y es San Martín. No es una limitación técnica:
      // es la maniobra. Dos clarines son dos cargas; uno solo es una pinza. Y
      // esa espera —estar formado del otro lado del convento sin poder hacer
      // nada hasta que el otro dé la señal— es exactamente lo que se sintió el
      // 3 de febrero a las cinco y media de la mañana.
      case 'KeyT': {
        if (red && red.esInvitado) {
          hud.mostrarAviso('El clarín lo toca San Martín', 'malo');
          break;
        }
        if (pinza.sonando) pinza.tocar();
        else if (pinza.viva) hud.mostrarAviso('El clarín ya sonó', 'malo');
        else hud.mostrarAviso('No hay columna formada', 'malo');
        break;
      }
      // ¡A MÍ! La columna corta la pelea y se vuelve a formar atrás tuyo. Se
      // suelta sola cuando la volvés a llevar al choque.
      case 'KeyQ': {
        if (!montado()) { hud.mostrarAviso('A pie no te siguen: montá', 'malo'); break; }
        // CADA UNO LLAMA A LA SUYA, Y NO SIEMPRE LA TIENE ACÁ. Del lado de un
        // invitado `pinza.viva` es false —los sesenta le llegan como títeres
        // sueltos, no como formación—, así que la comprobación de acá lo
        // frenaba antes de intentar nada y la Q era de San Martín y de nadie
        // más. Ahora la orden se la pide a la red, que sabe si esta máquina
        // manda la columna o si hay que mandar el pedido por el cable.
        const llamada = red ? red.reunir() : pinza.reunir('oeste');
        if (llamada === 'tropa') { hud.mostrarAviso('Vos no mandás la columna: seguí a tu jefe', 'malo'); break; }
        // mandada por el cable: el aviso lo va a traer el que lleva la batalla
        if (llamada === 'mandado') { sonido.grito(); break; }
        if (llamada) { sonido.grito(); hud.mostrarAviso('¡A mí, granaderos!', 'bien'); break; }
        if (!pinza.viva || !pinza.tocado) hud.mostrarAviso('No hay columna que llamar', 'malo');
        else hud.mostrarAviso('Ya vienen', 'malo');
        break;
      }
      case 'KeyB': hud.verCartuchera(); break;
      case 'KeyV': if (jugador.vendar()) hud.mostrarAviso('Vendando', 'bien'); break;
      case 'KeyO': campo.alternarOleadas(); break;
      case 'F3': hud.verDepurar = !hud.verDepurar; break;
      case 'Enter':
        ponerseEnPie();
        break;
    }
  });
  addEventListener('keyup', ev => { teclas.delete(ev.code); });

  // ------------------------------ mouse ------------------------------
  addEventListener('mousedown', ev => {
    if (!bloqueado) return;
    // El espectador mira: no dispara, no sablea y no marca la carga. Si no,
    // se pelearía la batalla desde cuarenta metros de altura.
    if (jugador.espectador) return;
    if (ev.button === 0) {
      const a = arsenal.actual();
      // mientras cargás, el click marca el tiempo en vez de disparar
      if (a && a.cargando) {
        if (a.golpe() === 'bien') hud.vecesQueAcerto++;
        return;
      }
      if (a) a.gatillo();
      else sable.tajo(montado());
    }
    if (ev.button === 2) {
      if (arsenal.conSable()) sable.alzarGuardia();
      else arsenal.apuntando = true;
    }
  });
  addEventListener('mouseup', ev => {
    if (ev.button === 2) { arsenal.apuntando = false; sable.bajarGuardia(); }
  });
  addEventListener('contextmenu', ev => ev.preventDefault());
  addEventListener('mousemove', ev => {
    if (!bloqueado) return;
    jugador.mirar(ev.movementX || 0, ev.movementY || 0, sensibilidad);
  });

  // ------------------------------ el puntero ------------------------------
  // ESTÁS CAÍDO: el mouse es tuyo pero esto no es una pausa. La pantalla de
  // «alto el fuego» dice que la batalla espera y nadie te tira, y arriba de un
  // muerto eso es mentira: lo que hay es el cartel de caído con sus botones.
  let estaCaido = false;

  function mostrarPausa (si) {
    if (si && estaCaido) return;
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
      arsenal.apuntando = false;
      sable.bajarGuardia();
      tSoltado = performance.now();
      if (empezado && !estaCaido) mostrarPausa(true);
    } else {
      mostrarPausa(false);
    }
  });
  document.addEventListener('pointerlockerror', () => {
    bloqueado = false;
    if (empezado && !estaCaido) mostrarPausa(true);
  });
  pantallaPausa.addEventListener('click', pedirMouse);

  // ------------------------------ el que cayó ------------------------------
  //
  // Caerse suelta el mouse, y eso no es un detalle de interfaz: el juego se
  // toma el pointer lock entero, así que con el puntero capturado no hay
  // ningún botón que se pueda apretar. Mientras estás muerto el mouse es tuyo.
  function caiste () {
    estaCaido = true;
    mostrarPausa(false);
    if (document.pointerLockElement) document.exitPointerLock();
    // Y EL CURSOR VUELVE. `mostrarPausa(false)` hace dos cosas —esconde la
    // pantalla de pausa y esconde el puntero— y acá sólo hacía falta la
    // primera: soltar el mouse sin cursor deja los botones del caído ahí,
    // visibles, y sin manera de apretarlos. Se veía como que el juego se colgó.
    document.body.style.cursor = 'default';
  }

  // PONERSE EN PIE es levantarse donde caíste. La batalla siguió sin vos.
  function ponerseEnPie () {
    if (jugador.vivo) return false;
    estaCaido = false;
    jugador.liberar();
    hud.abrirLosOjos();
    sonido.revivir();
    jugador.revivir();
    // EN RED EL CAMPO NO ES TUYO. Barrerlo acá haría dos destrozos: al
    // invitado le borraría los títeres que el anfitrión sigue moviendo
    // —y le seguirían llegando partes de hombres que ya no existen—, y
    // al anfitrión le limpiaría de un plumazo la batalla que el otro
    // está peleando. En una pelea compartida no se borra a todos porque
    // uno se cayó: se vuelve a formar y se sigue.
    if (!red.activo) campo.limpiarCampo();
    arsenal.reponer();
    campo.ponerCaballo();
    hud.mostrarAviso('En pie', 'bien');
    return true;
  }

  // VOLVER A EMPEZAR es otra cosa: si entraste por la batalla, se rearma la
  // pinza entera y estás de nuevo detrás del convento con los sesenta
  // esperando el clarín. En red no se rearma nada —la batalla es de todos y la
  // está simulando el anfitrión; barrerla porque uno se cayó sería sacársela a
  // los demás—, así que ahí volver a empezar es volver a la pelea.
  function volverAEmpezar () {
    const rearmar = !red.activo && acto && acto.enBatalla;
    if (!ponerseEnPie()) return;
    if (rearmar) {
      campo.formarPinza();
      arsenal.reponer();
      hud.mostrarAviso('De vuelta detrás del convento · [T] toca el clarín', 'bien');
    }
    pedirMouse();
  }

  // Al menú se vuelve recargando, y es a propósito. Media docena de sistemas
  // —la batalla, el acto, el arsenal, la sala— tendrían que saber deshacerse
  // solos y ninguno tiene por qué: no hay nada que guardar, y una partida a
  // medio desarmar es de donde salen los bichos que no se pueden reproducir.
  // Y si estabas en una sala, irte al menú es irte de la sala.
  function alMenu () { location.reload(); }

  document.getElementById('caido-otra').addEventListener('click', volverAEmpezar);
  document.getElementById('caido-menu').addEventListener('click', alMenu);
  document.getElementById('pausa-menu').addEventListener('click', ev => { ev.stopPropagation(); alMenu(); });

  // Soltar el mouse pase lo que pase. Sin esto el puntero queda capturado y
  // desaparece en las otras pestañas del navegador.
  function soltarMouse () {
    teclas.clear();
    arsenal.apuntando = false;
    sable.bajarGuardia();
    document.body.style.cursor = 'default';
    if (document.pointerLockElement) document.exitPointerLock();
  }
  addEventListener('blur', soltarMouse);
  addEventListener('pagehide', soltarMouse);
  addEventListener('beforeunload', soltarMouse);
  document.addEventListener('visibilitychange', () => { if (document.hidden) soltarMouse(); });

  // ------------------------------ los dos modos ------------------------------
  //
  // Esto faltaba y era grave: la pinza existía hacía días y no se veía, porque
  // para armarla había que escribir `juego.formarPinza()` en la consola del
  // navegador. Una función que hay que invocar desde la consola no es una
  // función del juego: es una nota para el que la programó. Desde acá el que
  // abre el archivo elige entre practicar y pelear la batalla.
  // AL CAMPO. Lo último que pasa antes de que el jugador tenga el mouse.
  function alCampo (modo) {
    document.getElementById('portada').classList.add('oculto');
    sonido.iniciar();
    empezado = true;
    tSoltado = 0;
    // El acto Cabral es del 3 de febrero, no del campo de práctica: sólo se le
    // pone el reloj cuando se entra por la batalla.
    if (acto) acto.enBatalla = modo === 'batalla';
    if (modo === 'batalla') campo.formarPinza();
    lienzo.requestPointerLock();
  }

  // Y ANTES DE LA BATALLA, EL PLANO. En la práctica no: ahí no hay maniobra
  // que entender, hay un campo de tiro. El botón del plano es el que toma el
  // mouse —el navegador sólo lo entrega sobre un gesto del usuario, así que
  // tiene que ser un click y no un temporizador—.
  function arrancar (modo) {
    if (modo !== 'batalla') { alCampo(modo); return; }
    document.getElementById('portada').classList.add('oculto');
    plano.mostrar('oeste', 250, () => alCampo('batalla'));
  }
  // ---- el panel de opciones de la portada ----
  //
  // Va acá porque acá viven los botones de la portada. La casilla ESCRIBE en el
  // objeto que main.js le pasó y lo guarda; quien la lee es combate.js, que se
  // fija una sola vez antes de salpicar. Y se pinta con lo que había guardado,
  // que si no la casilla dice una cosa y el juego hace otra.
  const casillaSangre = document.getElementById('op-sangre');
  if (casillaSangre && opciones) {
    casillaSangre.checked = !!opciones.sangre;
    casillaSangre.addEventListener('change', () => {
      opciones.sangre = casillaSangre.checked;
      opciones.guardar();
    });
  }

  document.getElementById('modo-batalla').addEventListener('click', () => arrancar('batalla'));
  document.getElementById('modo-campo').addEventListener('click', () => arrancar('campo'));

  // ------------------------------ la sala de dos ------------------------------
  //
  // Igual que los otros dos modos: acá no hay lógica de red, hay botones. Todo
  // lo que sabe este bloque es pedirle a red.js que llame y pintar en pantalla
  // lo que red.js contesta.
  const pantallaSala = document.getElementById('sala');
  const luz = document.getElementById('sala-luz');
  const titulo = document.getElementById('sala-titulo');
  const detalle = document.getElementById('sala-detalle');
  const entrar = document.getElementById('sala-entrar');
  const manual = document.getElementById('sala-manual');
  const papeles = {
    anfitrion: document.getElementById('papel-anfitrion'),
    invitado: document.getElementById('papel-invitado'),
    tropa: document.getElementById('papel-tropa')
  };
  const cajaGente = document.getElementById('sala-gente');
  const listaGente = cajaGente.querySelector('ul');

  const CARTELES = {
    suelto: ['Sala cerrada', 'Nadie está llamando.'],
    llamando: ['Buscando la sala', 'Golpeando la puerta del servidor…'],
    esperando: ['Todavía no llegó nadie', 'Ya estás adentro. Que los demás abran la misma página.'],
    listo: ['La sala está armada', 'Cuando quieras, al campo.'],
    caido: ['No hay sala', '']
  };

  function pintarSala (p) {
    const [t, d] = CARTELES[p.fase] || CARTELES.suelto;
    const adentro = p.fase === 'listo' || p.fase === 'esperando';
    // El nombre recién cuando el padrón llegó: entre que se abre el cable y
    // que llega hay un momento en que uno todavía no sabe qué número le tocó,
    // y anunciar «sos San Martín» ahí es mentirle al que acaba de entrar.
    titulo.textContent = adentro && p.ubicado
      ? 'Sos ' + p.nombre + ' · columna del ' + p.columna
      : t;
    detalle.textContent = p.motivo || (p.fase === 'listo' && p.cuantos > 2
      ? 'Son ' + p.cuantos + ' en la sala. Cuando quieras, al campo.' : d);
    luz.classList.toggle('va', p.fase === 'listo');
    luz.classList.toggle('espera', p.fase === 'llamando' || p.fase === 'esperando');
    luz.classList.toggle('mal', p.fase === 'caido');
    papeles.anfitrion.classList.toggle('vos', p.rol === 'anfitrion');
    papeles.invitado.classList.toggle('vos', p.rol === 'invitado' && p.j === 1);
    papeles.tropa.classList.toggle('vos', p.rol === 'invitado' && p.j >= 2);

    // EL PADRÓN EN VIVO. Con dos alcanzaban dos tarjetas fijas; con diez hay
    // que ver quién está, porque de eso depende si conviene esperar a uno más.
    const quienes = p.jugadores || [];
    cajaGente.classList.toggle('hay', quienes.length > 0);
    listaGente.textContent = '';
    for (const g of quienes) {
      const li = document.createElement('li');
      const b = document.createElement('b');
      b.textContent = g.nombre + (g.vos ? ' (vos)' : '');
      const em = document.createElement('em');
      em.textContent = (g.manda ? 'lleva la del ' : 'granadero · ') + g.columna;
      li.append(b, em);
      if (g.vos) li.classList.add('vos');
      listaGente.append(li);
    }
    manual.classList.toggle('oculto', p.fase !== 'caido' || !puedeHaberSalaLocal);
    // LOS BOTONES NO SE ESCONDEN MIENTRAS LLAMA. Escondiéndolos, un directorio
    // que no contesta dejaba la pantalla pelada: sin código, sin botones y con
    // un «golpeando la puerta» que no se movía más. Si siguen ahí, volver a
    // tocar «Crear sala» es reintentar, que es lo que uno hace igual.
    if (elegir) elegir.classList.toggle('oculto', adentro);
    // El código grande sale apenas se toca el botón: lo elige esta máquina, no
    // el directorio, así que no hay por qué ocultarlo mientras se abre la
    // sala. Sí cambia el rótulo, porque hasta que no esté abierta dictarlo no
    // sirve de nada.
    if (claveCaja) {
      const anfitrion = p.rol === 'anfitrion';
      const mostrar = !!red.codigo && (anfitrion || p.creando);
      claveCaja.classList.toggle('oculto', !mostrar);
      claveCaja.classList.toggle('abriendo', mostrar && !anfitrion);
      if (mostrar) {
        clave.textContent = red.codigo;
        claveRotulo.textContent = anfitrion ? 'Dictales este código a los demás' : 'Abriendo la sala…';
        clavePie.textContent = anfitrion
          ? 'Cuatro letras. Se pueden escribir en minúscula.'
          : 'Apenas esté abierta ya se puede dictar.';
      }
    }
    entrar.disabled = p.fase !== 'listo';
    entrar.textContent = p.rol === 'anfitrion'
      ? 'Formar las columnas y salir al campo'
      : 'Salir al campo';
  }

  // CON QUÉ COLUMNA CARGA EL QUE ENTRA. Se elige antes de escribir el código,
  // que es el único momento en que se puede: después ya hay un puesto ocupado.
  // Al segundo se lo hace Bermúdez igual —esa columna necesita jefe— y eso lo
  // dice el cartel de abajo en vez de aparecer como una sorpresa al entrar.
  function pintarColumna () {
    const este = red.pedida === 'este';
    document.getElementById('col-oeste').classList.toggle('va', !este);
    document.getElementById('col-este').classList.toggle('va', este);
  }

  // ¿PUEDE haber una sala local? Es el camino del «Jugar de a dos»: ahí el
  // servidor ya está levantado y no hay código que dictar, así que se prueba
  // solo. Pages va por https, así que un http con host es una máquina de la red.
  //
  // Pero PODER no es SER: cualquier servidor estático sirve la página por http
  // y no es una sala. Por eso se prueba y no se decide —si no contesta, quedan
  // los botones del código, que es el camino normal—. La primera versión daba
  // por hecho que era una sala y escondía los botones, y cualquiera que abriera
  // la página desde otro servidor se quedaba mirando «no contesta nadie».
  const puedeHaberSalaLocal = location.protocol === 'http:' && !!location.host;

  function abrirSala () {
    document.getElementById('portada').classList.add('oculto');
    pantallaSala.classList.remove('oculto');
    red.alCambiar(pintarSala);
    if (puedeHaberSalaLocal) red.conectar(null, true);   // tanteo callado
    pintarSala(red.parte());
  }

  function cerrarSala () {
    red.cortar();
    pantallaSala.classList.add('oculto');
    document.getElementById('portada').classList.remove('oculto');
  }

  document.getElementById('modo-red').addEventListener('click', abrirSala);
  document.getElementById('sala-volver').addEventListener('click', cerrarSala);
  const elegir = document.getElementById('sala-elegir');
  const claveCaja = document.getElementById('sala-codigo-grande');
  const clave = document.getElementById('sala-clave');
  const claveRotulo = claveCaja && claveCaja.querySelector('label');
  const clavePie = claveCaja && claveCaja.querySelector('span');
  const campoCodigo = document.getElementById('sala-codigo');

  for (const [id, col] of [['col-oeste', 'oeste'], ['col-este', 'este']]) {
    document.getElementById(id).addEventListener('click', () => { red.elegirColumna(col); pintarColumna(); });
  }
  pintarColumna();

  document.getElementById('sala-crear').addEventListener('click', () => red.crearSala());
  const unirse = () => red.entrarASala(campoCodigo.value);
  document.getElementById('sala-unirse').addEventListener('click', unirse);
  campoCodigo.addEventListener('keydown', ev => { if (ev.key === 'Enter') unirse(); });
  // se escribe como sale y se ve prolijo: mayúsculas y sin las letras que se
  // confunden al dictar
  campoCodigo.addEventListener('input', () => {
    campoCodigo.value = red.limpiarCodigo(campoCodigo.value);
  });

  document.getElementById('sala-probar').addEventListener('click', () => {
    const dir = document.getElementById('sala-dir').value.trim();
    if (!dir) return;
    red.cortar();
    red.conectar(dir.startsWith('ws') ? dir : 'ws://' + dir.replace(/^https?:\/\//, ''));
  });
  entrar.addEventListener('click', () => {
    pantallaSala.classList.add('oculto');
    // el mismo plano, con la columna del otro marcada según a quién le tocó
    plano.mostrar(red.columna, 250, () => {
      sonido.iniciar();
      empezado = true;
      tSoltado = 0;
      // el anfitrión arma la batalla —es el que la va a simular—; el invitado
      // entra a un campo vacío y los trescientos setenta le llegan por el cable
      if (red.esAnfitrion) red.formarBatalla();
      lienzo.requestPointerLock();
    });
  });

  return {
    teclas,
    arrancar,
    abrirSala,
    caiste,
    // el mundo no corre con la pausa puesta, pero se sigue dibujando
    get enPausa () { return empezado && !bloqueado; }
  };
}
