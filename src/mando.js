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
  const { lienzo, jugador, sable, arsenal, campo, combate, pinza, hud, sonido, red, plano, acto } = ctx;

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
        if (!pinza.viva || !pinza.tocado) { hud.mostrarAviso('No hay columna que llamar', 'malo'); break; }
        if (!montado()) { hud.mostrarAviso('A pie no te siguen: montá', 'malo'); break; }
        // cada uno llama a la suya: San Martín a la del oeste, Bermúdez a la del este
        if (pinza.reunir(!!(red && red.esInvitado))) {
          sonido.grito(); hud.mostrarAviso('¡A mí, granaderos!', 'bien');
        }
        else hud.mostrarAviso('Ya vienen', 'malo');
        break;
      }
      case 'KeyB': hud.verCartuchera(); break;
      case 'KeyV': if (jugador.vendar()) hud.mostrarAviso('Vendando', 'bien'); break;
      case 'KeyO': campo.alternarOleadas(); break;
      case 'F3': hud.verDepurar = !hud.verDepurar; break;
      case 'Enter':
        if (!jugador.vivo) {
          jugador.liberar();
          hud.abrirLosOjos();
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
        }
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
  function mostrarPausa (si) {
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
      if (empezado) mostrarPausa(true);
    } else {
      mostrarPausa(false);
    }
  });
  document.addEventListener('pointerlockerror', () => {
    bloqueado = false;
    if (empezado) mostrarPausa(true);
  });
  pantallaPausa.addEventListener('click', pedirMouse);

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
    invitado: document.getElementById('papel-invitado')
  };

  const CARTELES = {
    suelto: ['Sala cerrada', 'Nadie está llamando.'],
    llamando: ['Buscando la sala', 'Golpeando la puerta del servidor…'],
    esperando: ['Falta el otro escuadrón', 'Ya estás adentro. Que el otro abra la misma dirección.'],
    listo: ['Los dos escuadrones en la sala', 'Cuando quieras, al campo.'],
    caido: ['No hay sala', '']
  };

  function pintarSala (p) {
    const [t, d] = CARTELES[p.fase] || CARTELES.suelto;
    titulo.textContent = p.fase === 'listo' && p.rol
      ? (p.rol === 'anfitrion' ? 'Sos San Martín · columna del oeste' : 'Sos Bermúdez · columna del este')
      : t;
    detalle.textContent = p.motivo || d;
    luz.classList.toggle('va', p.fase === 'listo');
    luz.classList.toggle('espera', p.fase === 'llamando' || p.fase === 'esperando');
    luz.classList.toggle('mal', p.fase === 'caido');
    papeles.anfitrion.classList.toggle('vos', p.rol === 'anfitrion');
    papeles.invitado.classList.toggle('vos', p.rol === 'invitado');
    manual.classList.toggle('oculto', p.fase !== 'caido');
    entrar.disabled = p.fase !== 'listo';
    entrar.textContent = p.rol === 'anfitrion'
      ? 'Formar las columnas y salir al campo'
      : 'Salir al campo';
  }

  function abrirSala () {
    document.getElementById('portada').classList.add('oculto');
    pantallaSala.classList.remove('oculto');
    red.alCambiar(pintarSala);
    red.conectar();
    pintarSala(red.parte());
  }

  function cerrarSala () {
    red.cortar();
    pantallaSala.classList.add('oculto');
    document.getElementById('portada').classList.remove('oculto');
  }

  document.getElementById('modo-red').addEventListener('click', abrirSala);
  document.getElementById('sala-volver').addEventListener('click', cerrarSala);
  document.getElementById('sala-probar').addEventListener('click', () => {
    const dir = document.getElementById('sala-dir').value.trim();
    if (!dir) return;
    red.cortar();
    red.conectar(dir.startsWith('ws') ? dir : 'ws://' + dir.replace(/^https?:\/\//, ''));
  });
  entrar.addEventListener('click', () => {
    pantallaSala.classList.add('oculto');
    // el mismo plano, con la columna del otro marcada según a quién le tocó
    plano.mostrar(red.esInvitado ? 'este' : 'oeste', 250, () => {
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
    // el mundo no corre con la pausa puesta, pero se sigue dibujando
    get enPausa () { return empezado && !bloqueado; }
  };
}
