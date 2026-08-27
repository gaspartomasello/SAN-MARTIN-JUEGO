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
// SE DIBUJA CON LAS MEDIDAS DE VERDAD. Ni una coordenada de este archivo es
// decorativa: el convento sale de sanlorenzo.js, las rutas y las plazas de
// pinza.js, las piezas y el frente del desembarco de despliegue.js. Si mañana
// la ruta del oeste cambia, el plano cambia con ella. Un plano dibujado a mano
// aparte del nivel es un plano que en dos semanas miente.

import { RUTA_OESTE, RUTA_ESTE, PLAZA_OESTE, PLAZA_ESTE } from './pinza.js';
import { CONVENTO, IGLESIA, Z_BARRANCA, Z_RIO } from './sanlorenzo.js';
import { PIEZAS, FILAS_REALISTAS, PASO_FILA, FONDO_FILA, Z_DESEMBARCO } from './despliegue.js';
import { REFUGIO_REALISTA } from './balance.js';

// El recuadro del plano, en metros del mundo. Y el norte del dibujo es +Z, que
// es de espaldas al río: se mira el campo como lo mirás vos al arrancar, con
// el convento arriba y el Paraná abajo. (El plano histórico está girado un
// cuarto de vuelta, con el río a la derecha; es el mismo dibujo.)
const X0 = -94, X1 = 94, Z0 = 74, Z1 = -104;
const ANCHO = X1 - X0;
const ALTO = Z0 - Z1;

const X = x => (x - X0).toFixed(1);
const Y = z => (Z0 - z).toFixed(1);

// Una curva suave que pasa por todos los puntos (Catmull-Rom pasada a Bézier).
// Las cargas del plano histórico son arcos, no una línea quebrada, y una
// polilínea con codos se lee como un recorrido de subte.
function curva (pts) {
  if (pts.length < 2) return '';
  let d = `M ${X(pts[0].x)} ${Y(pts[0].z)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, z: p1.z + (p2.z - p0.z) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, z: p2.z - (p3.z - p1.z) / 6 };
    d += ` C ${X(c1.x)} ${Y(c1.z)}, ${X(c2.x)} ${Y(c2.z)}, ${X(p2.x)} ${Y(p2.z)}`;
  }
  return d;
}

function caja (r, clase, extra = '') {
  return `<rect class="${clase}" x="${X(r.x0)}" y="${Y(r.z1)}" ` +
    `width="${(r.x1 - r.x0).toFixed(1)}" height="${(r.z1 - r.z0).toFixed(1)}" ${extra}/>`;
}

// La barranca: el labio quebrado del plano de los libros, dibujado con dientes
// para que se lea que ahí el terreno se cae nueve metros.
function labio () {
  let d = `M ${X(X0)} ${Y(Z_BARRANCA)}`;
  for (let x = X0; x < X1; x += 6) {
    d += ` L ${X(x + 3)} ${Y(Z_BARRANCA - 2.6)} L ${X(x + 6)} ${Y(Z_BARRANCA)}`;
  }
  return d;
}

export function dibujarPlano (frente = 250) {
  // el ancho que va a tener la línea realista con esta cantidad de hombres
  const porFila = Math.ceil(frente / FILAS_REALISTAS);
  const medio = porFila * PASO_FILA / 2;
  const linea = {
    x0: -medio, x1: medio,
    z0: Z_DESEMBARCO - (FILAS_REALISTAS - 1) * FONDO_FILA - 1.2,
    z1: Z_DESEMBARCO + 1.2
  };

  const cargaOeste = curva([{ x: PLAZA_OESTE.x, z: PLAZA_OESTE.z }, ...RUTA_OESTE]);
  const cargaEste = curva([{ x: PLAZA_ESTE.x, z: PLAZA_ESTE.z }, ...RUTA_ESTE]);

  // la retirada: derecho para atrás, a la barranca. Es literalmente lo que
  // hace el código —Soldado.refugio()—, no una flecha inventada.
  const retiradas = [-48, -20, 12, 40].map(x =>
    `<path class="huida" d="M ${X(x)} ${Y(linea.z0 - 2)} L ${X(x)} ${Y(REFUGIO_REALISTA - 3)}" ` +
    `marker-end="url(#pta-r)"/>`).join('');

  const piezas = PIEZAS.map(([x, z]) =>
    `<g class="pieza" transform="translate(${X(x)} ${Y(z)})">` +
    `<circle r="3.1"/><path d="M -4.6 0 L 4.6 0 M 0 -4.6 L 0 4.6"/></g>`).join('');

  return `
<svg viewBox="0 0 ${ANCHO} ${ALTO}" role="img" aria-label="Plano del combate de San Lorenzo">
  <defs>
    <marker id="pta-a" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5"
            orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#3a5c9a"/></marker>
    <marker id="pta-r" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5"
            orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#b3383c"/></marker>
  </defs>

  <!-- el Paraná y la barranca -->
  <rect class="agua" x="0" y="${Y(Z_RIO)}" width="${ANCHO}" height="${(Z_RIO - Z1 + 10).toFixed(1)}"/>
  <path class="labio" d="${labio()}"/>
  <text class="rotulo" x="${X(0)}" y="${Y(Z_RIO - 5)}">RÍO PARANÁ</text>
  <text class="nota" x="${X(-92)}" y="${Y(Z_BARRANCA - 7)}">la barranca: cae nueve metros</text>

  <!-- 1 · el convento -->
  ${caja(CONVENTO, 'muro')}
  ${caja(IGLESIA, 'iglesia')}
  <text class="num" x="${X(10)}" y="${Y(38)}">1</text>

  <!-- 2 · los dos escuadrones, escondidos detrás -->
  <g class="oculto">
    <rect x="${X(PLAZA_OESTE.x - 7)}" y="${Y(PLAZA_OESTE.z + 4)}" width="14" height="11"
          transform="rotate(-24 ${X(PLAZA_OESTE.x)} ${Y(PLAZA_OESTE.z)})"/>
    <rect x="${X(PLAZA_ESTE.x - 7)}" y="${Y(PLAZA_ESTE.z + 4)}" width="14" height="11"
          transform="rotate(24 ${X(PLAZA_ESTE.x)} ${Y(PLAZA_ESTE.z)})"/>
  </g>
  <text class="num" x="${X(-66)}" y="${Y(48)}">2</text>
  <text class="num" x="${X(60)}" y="${Y(48)}">2</text>

  <!-- 3 · la columna realista, subida de la barranca, y sus dos piezas -->
  ${caja(linea, 'realista')}
  ${piezas}
  <text class="num rojo" x="${X(medio + 6)}" y="${Y(Z_DESEMBARCO)}">3</text>

  <!-- la retirada: cuando se quiebran, vuelven por donde subieron -->
  ${retiradas}
  <text class="nota rojo" x="${X(-92)}" y="${Y(-96)}">se quiebran y bajan a los botes</text>

  <!-- 4 y 5 · las dos cargas -->
  <path class="carga" d="${cargaOeste}" marker-end="url(#pta-a)"/>
  <path class="carga" d="${cargaEste}" marker-end="url(#pta-a)"/>
  <text class="num azul" x="${X(-64)}" y="${Y(-4)}">4</text>
  <text class="num azul" x="${X(58)}" y="${Y(-4)}">5</text>
</svg>`;
}

// ---------------------------------------------------------------------------
// la pantalla
// ---------------------------------------------------------------------------
export function armarPlano (ctx) {
  const { hud } = ctx;
  const pantalla = document.getElementById('plano');
  const lienzo = document.getElementById('plano-mapa');
  const boton = document.getElementById('plano-entrar');
  const tuya = document.getElementById('plano-tuya');
  let alEntrar = null;

  boton.addEventListener('click', () => {
    pantalla.classList.add('oculto');
    const f = alEntrar;
    alEntrar = null;
    if (f) f();
  });

  // quien: 'oeste' si vas de San Martín, 'este' si vas de Bermúdez
  function mostrar (quien, realistas, cuando) {
    lienzo.innerHTML = dibujarPlano(realistas);
    // se marca CUÁL de las dos cargas es la tuya: con las dos iguales el
    // jugador tiene que adivinar de qué lado va a aparecer
    const cargas = lienzo.querySelectorAll('.carga');
    if (cargas.length === 2) cargas[quien === 'este' ? 1 : 0].classList.add('mia');
    tuya.textContent = quien === 'este'
      ? 'Vas con la 5 · la columna del este, la del capitán Bermúdez'
      : 'Vas con la 4 · la columna del oeste, la de San Martín';
    alEntrar = cuando;
    pantalla.classList.remove('oculto');
    boton.focus();
  }

  return { mostrar, dibujar: dibujarPlano, get abierto () { return !pantalla.classList.contains('oculto'); } };
}
