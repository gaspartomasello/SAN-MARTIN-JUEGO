// ===========================================================================
// EL MANDO · el teclado, el mouse y los dos modos
// ===========================================================================
//
// La única parte del juego que habla con el navegador: teclas, botones,
// captura del puntero, la pantalla de pausa y los dos botones de la portada.
//
// No decide nada. Traduce «apretó F» a «puntazo» o «pechada» y le pide al
// módulo que corresponda que lo haga. Si algo de acá pareciera lógica de
// juego, está en el archivo equivocado.

export function armarMando (ctx) {
  const { lienzo, jugador, sable, arsenal, campo, combate, pinza, hud, sonido } = ctx;

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
      case 'KeyW': if (montado()) jugador.monta.subirAndar(); break;
      case 'KeyS': if (montado()) jugador.monta.bajarAndar(); break;
      case 'KeyG': arsenal.tomarOIntercambiar(); break;
      case 'Digit1': arsenal.cambiar('larga'); break;
      case 'Digit2': arsenal.cambiar('sable'); break;
      case 'Digit3': arsenal.cambiar('pistolon'); break;
      // EL CLARÍN. Una sola tecla, una sola vez, y salen los ciento veinte.
      case 'KeyT': {
        if (pinza.sonando) pinza.tocar();
        else if (pinza.viva) hud.mostrarAviso('El clarín ya sonó', 'malo');
        else hud.mostrarAviso('No hay columna formada', 'malo');
        break;
      }
      case 'KeyB': hud.verCartuchera(); break;
      case 'KeyV': if (jugador.vendar()) hud.mostrarAviso('Vendando', 'bien'); break;
      case 'KeyO': campo.alternarOleadas(); break;
      case 'F3': hud.verDepurar = !hud.verDepurar; break;
      case 'Enter':
        if (!jugador.vivo) {
          jugador.revivir();
          campo.limpiarCampo();
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
    if (ev.button === 0) {
      const a = arsenal.actual();
      // mientras cargás, el click marca el tiempo en vez de disparar
      if (a && a.cargando) {
        if (a.golpe() === 'bien') hud.vecesQueAcerto++;
        return;
      }
      if (a) a.gatillo();
      else sable.tajo();
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
  function arrancar (modo) {
    document.getElementById('portada').classList.add('oculto');
    sonido.iniciar();
    empezado = true;
    tSoltado = 0;
    if (modo === 'batalla') campo.formarPinza();
    lienzo.requestPointerLock();
  }
  document.getElementById('modo-batalla').addEventListener('click', () => arrancar('batalla'));
  document.getElementById('modo-campo').addEventListener('click', () => arrancar('campo'));

  return {
    teclas,
    arrancar,
    // el mundo no corre con la pausa puesta, pero se sigue dibujando
    get enPausa () { return empezado && !bloqueado; }
  };
}
