// ===========================================================================
// EL PLANO · la maniobra antes de meterse adentro de ella
// ===========================================================================
//
// Desde adentro de un cuerpo, a la altura de los ojos y con humo, la pinza no
// se ve. Se ve pasto, se ven casacas y se oye un clarín. El jugador puede
// jugar la batalla entera sin entender nunca qué estaba haciendo, que es
// justamente lo contrario de lo que este juego quiere.
//
// Así que antes de arrancar se muestra el plano, como el de los libros: el
// convento, los dos escuadrones escondidos atrás, la columna realista subida
// de la barranca con sus dos piezas, las dos cargas cerrándose sobre los
// flancos, y por dónde se van a ir cuando se quiebren.
//
// EL MAPA ES UNA LÁMINA DIBUJADA —`plano.webp`— y antes era un SVG que salía
// de las medidas del nivel: el convento de sanlorenzo.js, las rutas de
// pinza.js, las piezas de despliegue.js. Se cambió a propósito y hay que saber
// lo que se pagó: si mañana se mueve la ruta del oeste, el dibujo NO se entera.
// A cambio, la pantalla dejó de ser un diagrama y pasó a ser lo que un jefe
// tiene sobre la mesa. El plano viejo está en el historial —hasta 73cb4b7— por
// si algún día conviene volver.
//
// LO QUE SIGUE VIVO ES LO QUE CAMBIA: la orden del día, que depende de con qué
// columna te toca cargar, y la marca sobre esa columna. Eso se escribe encima
// de la lámina, y por eso este archivo tiene coordenadas: son las ÚNICAS, no
// son metros y no son del mundo —son el lugar que ocupa cada cosa en el
// dibujo, en tanto por ciento del cuadro—. Viven en el CSS, con la lámina.
//
// LA LÁMINA VINO CON LA 4 Y LA 5 CAMBIADAS y se le corrigió la referencia: en
// el juego la 4 es la columna del OESTE, la de San Martín, y la 5 la del ESTE,
// la del capitán Bermúdez. Lo dicen pinza.js, red.js y el README, y cambiar
// seis archivos para acomodarse a un dibujo hubiera sido al revés.

// La orden, según con quién cargás. En un jugador siempre sos San Martín; en
// red, el que entra segundo es Bermúdez y del tercero en adelante se elige.
const ORDENES = {
  oeste: {
    quien: 'Vas con la 4 · la columna del oeste',
    orden: 'La de San Martín. Salís de atrás del convento antes de que ' +
      'formen línea y los quebrás contra la barranca.'
  },
  este: {
    quien: 'Vas con la 5 · la columna del este',
    orden: 'La del capitán Bermúdez. El clarín lo toca San Martín: cuando ' +
      'suene salís vos y se cierra la pinza.'
  }
};

export function armarPlano () {
  const pantalla = document.getElementById('plano');
  const boton = document.getElementById('plano-entrar');
  const tuya = document.getElementById('plano-tuya');
  const orden = document.getElementById('plano-orden');
  const marca = document.getElementById('plano-marca');
  let alEntrar = null;

  // El botón está PINTADO en la lámina y éste va justo encima. Es el que toma
  // el mouse: el navegador sólo lo entrega sobre un gesto del usuario, así que
  // tiene que ser un click y no un temporizador.
  boton.addEventListener('click', () => {
    pantalla.classList.add('oculto');
    const f = alEntrar;
    alEntrar = null;
    if (f) f();
  });

  // quien: 'oeste' si vas de San Martín, 'este' si vas de Bermúdez
  function mostrar (quien, cuando) {
    const d = ORDENES[quien === 'este' ? 'este' : 'oeste'];
    tuya.textContent = d.quien;
    orden.textContent = d.orden;
    // con las dos cargas dibujadas igual, el que juega tiene que adivinar de
    // qué lado va a aparecer: la marca le señala la suya
    marca.classList.toggle('este', quien === 'este');
    alEntrar = cuando;
    pantalla.classList.remove('oculto');
    boton.focus();
  }

  return { mostrar, get abierto () { return !pantalla.classList.contains('oculto'); } };
}
