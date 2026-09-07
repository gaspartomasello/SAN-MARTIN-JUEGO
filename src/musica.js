// ===========================================================================
// LA MÚSICA · la banda del regimiento
// ===========================================================================
//
// Acá no hay archivos de audio. El juego entero es sintetizado —audio.js hace
// la pólvora, los cascos y el viento con osciladores— y la música tampoco es la
// excepción, por la misma razón de siempre: esto se empaqueta en UN html que se
// abre con doble clic, y un minuto de mp3 decente pesa más que todo el resto
// junto. Un minuto de marcha en notas son doce kilobytes de texto.
//
// UNA OBRA ES UNA LISTA DE NOTAS: `[cuándo, cuánto dura, qué nota]`, con la
// nota en número MIDI —69 es el la de 440—. La `Banda` las va convirtiendo en
// osciladores a medida que se acercan.
//
// SE PROGRAMA DE A POCO Y NO TODO JUNTO. La versión de la que salió esto
// programaba el minuto entero de una: mil setecientos eventos, y entre ellos
// cuatrocientas treinta tandas de ruido blanco recién sorteado. Son varios
// megabytes de Float32 y un millón de `Math.random()` en un solo cuadro, justo
// cuando arranca el momento más delicado del capítulo. Acá se mira una ventana
// de segundo y medio: nunca hay más de veinte o treinta voces en vuelo, cortar
// es dejar de programar, y el ruido sale del buffer que audio.js ya tenía
// hecho.
//
// Y NO VA POR EL RELOJ DEL JUEGO, va por el del audio. El acto de Cabral corre
// a cámara lenta —`acto.lento` es 0,42— y una marcha al 42% no es una marcha,
// es un lamento. Por eso `atender()` no recibe `dt`: no le hace falta saber
// nada del juego.

// ---------------------------------------------------------------------------
// LA MARCHA DE SAN LORENZO
// ---------------------------------------------------------------------------
//
// Cayetano Alberto Silva, 1901, sobre la carga del 3 de febrero de 1813. Es
// OCHENTA Y OCHO AÑOS POSTERIOR a la batalla y eso se sabe: no es la música que
// sonó ese día —ese día lo único que sonó fue un clarín—, es la música con la
// que el país se acuerda de ese día, y suena cuando el juego deja de ser una
// batalla y pasa a ser un recuerdo, que es exactamente lo que es el momento de
// Cabral.
//
// El fragmento es el que va del minuto uno al dos, pasado a notas afuera de
// este proyecto. Los tres renglones son los tres que hacen falta: la melodía la
// llevan trompeta y clarinete juntos, el bajo la tuba, y los compases dicen qué
// acorde va abajo y con cuánta fuerza —el último número—, que es lo que hace
// que la marcha respire en vez de venir toda igual de fuerte.
export const MARCHA_SAN_LORENZO = {
  nombre: 'Marcha de San Lorenzo',
  dura: 60,
  melodia: [
  [0.0, 0.3661, 69], [0.3661, 0.4354, 69], [0.8015, 0.1451, 69], [0.9466, 0.2902, 67],
  [1.2368, 0.2902, 66], [1.5271, 0.1451, 66], [1.6722, 0.1451, 66], [1.8173, 0.2902, 66],
  [2.1076, 0.1451, 66], [2.2527, 0.1451, 66], [2.3978, 0.2902, 62], [2.6881, 0.1451, 62],
  [2.8332, 0.1451, 64], [2.9783, 0.2902, 66], [3.2686, 0.1451, 66], [3.4137, 0.1451, 66],
  [3.5588, 0.2902, 67], [3.8491, 0.1451, 67], [3.9942, 0.1451, 67], [4.1393, 0.2902, 66],
  [4.4296, 0.1451, 66], [4.5747, 0.1451, 66], [4.7198, 0.2902, 66], [5.0101, 0.2902, 66],
  [5.3003, 0.1451, 66], [5.4454, 0.4354, 64], [5.8808, 0.7256, 62], [6.6064, 0.4354, 62],
  [7.4772, 1.0159, 62], [8.4931, 0.1451, 62], [8.6382, 1.0159, 71], [9.6541, 0.1451, 71],
  [9.7992, 0.2902, 67], [10.0894, 0.2902, 73], [10.3797, 0.2902, 71], [10.6699, 0.2902, 73],
  [10.9602, 0.1451, 71], [11.1053, 0.1451, 71], [11.2504, 0.1451, 71], [11.3956, 0.1451, 71],
  [11.5407, 0.2902, 71], [11.8309, 0.1451, 71], [11.9761, 0.1451, 71], [12.1212, 0.2902, 69],
  [12.4114, 0.1451, 69], [12.5566, 0.1451, 69], [12.7017, 0.2902, 69], [12.9919, 0.1451, 69],
  [13.1371, 0.1451, 67], [13.2822, 0.2902, 67], [13.5724, 0.1451, 67], [13.7176, 0.1451, 67],
  [13.8627, 0.1451, 67], [14.0078, 0.5805, 67], [14.5883, 0.2902, 66], [14.8785, 0.2902, 67],
  [15.1688, 0.2902, 69], [15.459, 0.2902, 67], [15.7493, 0.5805, 67], [16.3298, 0.7256, 67],
  [17.0554, 0.1451, 62], [17.2005, 0.5805, 66], [17.781, 0.5805, 64], [18.3615, 0.7256, 71],
  [19.9579, 0.1451, 62], [20.103, 0.2902, 62], [20.3933, 0.1451, 62], [20.5384, 0.1451, 62],
  [20.6835, 0.2902, 74], [20.9738, 0.1451, 74], [21.1189, 0.1451, 74], [21.264, 0.2902, 62],
  [21.6994, 0.1451, 71], [21.8445, 0.1451, 71], [21.9897, 0.1451, 71], [22.1348, 0.1451, 71],
  [22.2799, 0.1451, 69], [22.425, 0.1451, 69], [22.5702, 0.1451, 69], [22.7153, 0.1451, 69],
  [22.8604, 0.1451, 69], [23.0055, 0.2902, 69], [23.2958, 0.2902, 69], [23.586, 0.1451, 69],
  [23.7312, 0.1451, 67], [23.8763, 0.1451, 67], [24.1665, 0.1451, 62], [24.3117, 0.2902, 64],
  [24.6019, 0.2902, 62], [25.1824, 0.2902, 62], [26.3434, 0.5805, 71], [26.9239, 0.2902, 69],
  [27.2141, 0.5805, 69], [27.7946, 0.5805, 69], [28.3751, 0.2902, 67], [28.6654, 0.2902, 66],
  [28.9556, 0.2902, 64], [29.2459, 0.2902, 66], [29.5361, 0.1451, 66], [29.6813, 0.1451, 66],
  [29.8264, 0.1451, 66], [29.9715, 0.1451, 66], [30.1166, 0.1451, 66], [30.2618, 0.1451, 66],
  [30.4069, 0.2902, 66], [30.6971, 0.1451, 66], [30.8423, 0.1451, 66], [30.9874, 0.2902, 67],
  [31.2776, 0.1451, 67], [31.4228, 0.1451, 67], [31.5679, 0.2902, 66], [31.8581, 0.1451, 66],
  [32.0033, 0.1451, 66], [32.1484, 0.2902, 66], [32.4386, 0.1451, 66], [32.5838, 0.2902, 66],
  [32.874, 0.4354, 64], [33.3094, 1.0159, 62], [34.3253, 0.8707, 62], [35.196, 0.8707, 62],
  [36.0668, 0.8707, 71], [36.9375, 0.2902, 71], [37.2278, 0.2902, 67], [37.518, 0.2902, 73],
  [37.8083, 0.2902, 71], [38.0985, 0.1451, 73], [38.2436, 0.1451, 73], [38.3888, 0.2902, 71],
  [38.679, 0.1451, 71], [38.8241, 0.1451, 71], [38.9693, 0.1451, 71], [39.1144, 0.1451, 71],
  [39.2595, 0.1451, 71], [39.4046, 0.1451, 71], [39.5498, 0.2902, 69], [39.84, 0.1451, 69],
  [39.9851, 0.1451, 69], [40.1302, 0.1451, 69], [40.2754, 0.1451, 69], [40.4205, 0.1451, 69],
  [40.5656, 0.1451, 69], [40.7107, 0.2902, 67], [41.001, 0.1451, 67], [41.1461, 0.1451, 67],
  [41.2912, 0.1451, 67], [41.4364, 0.1451, 67], [41.5815, 1.0159, 67], [42.5974, 0.4354, 69],
  [43.0327, 0.7256, 67], [43.7584, 0.4354, 67], [44.1937, 0.1451, 62], [44.3389, 0.2902, 62],
  [44.6291, 0.7256, 66], [45.3547, 0.4354, 62], [45.7901, 0.5805, 71], [46.3706, 0.2902, 71],
  [46.6609, 0.2902, 69], [46.9511, 0.2902, 71], [47.2414, 0.2902, 64], [47.5316, 0.1451, 66],
  [47.6767, 0.1451, 66], [47.8219, 0.1451, 66], [48.5475, 0.1451, 62], [48.6926, 0.1451, 62],
  [48.8377, 0.1451, 64], [48.9829, 0.1451, 64], [49.128, 0.1451, 71], [49.2731, 0.2902, 71],
  [49.5634, 0.1451, 71], [49.7085, 0.1451, 69], [49.8536, 0.2902, 69], [50.1439, 0.1451, 69],
  [50.289, 0.1451, 69], [50.4341, 0.2902, 69], [50.7244, 0.1451, 69], [50.8695, 0.2902, 69],
  [51.1597, 0.2902, 67], [51.45, 0.2902, 66], [51.7402, 0.2902, 64], [52.0305, 0.4354, 62],
  [52.4659, 0.1451, 66], [52.611, 1.0159, 69], [53.6268, 0.2902, 69], [53.9171, 0.1451, 67],
  [54.0622, 0.1451, 66], [54.2073, 0.1451, 64], [54.3525, 0.4354, 62], [54.7878, 0.1451, 66],
  [54.933, 0.8707, 69], [55.8037, 0.2902, 69], [56.094, 0.1451, 69], [56.2391, 0.1451, 67],
  [56.3842, 0.1451, 66], [56.5293, 0.1451, 64], [56.6745, 0.5805, 62], [57.255, 0.2902, 62],
  [57.5452, 0.1451, 62], [57.6903, 0.1451, 62], [57.8355, 0.4354, 62], [58.8513, 0.1451, 67],
  [58.9965, 0.1451, 67], [59.1416, 0.1451, 66], [59.2867, 0.1451, 66], [59.4318, 0.1451, 64],
  [59.577, 0.423, 62]
  ],
  bajos: [
  [0.0, 0.5112, 45], [0.5112, 0.2902, 38], [0.8015, 0.2902, 50], [1.0917, 0.5805, 47],
  [1.6722, 0.8707, 54], [2.5429, 0.2902, 43], [2.8332, 0.5805, 38], [3.4137, 0.2902, 54],
  [3.7039, 0.2902, 55], [3.9942, 0.2902, 47], [4.2844, 0.8707, 42], [5.1552, 0.2902, 42],
  [5.4454, 0.2902, 52], [5.7357, 0.2902, 43], [6.0259, 0.2902, 42], [6.3162, 0.2902, 50],
  [6.6064, 0.5805, 62], [7.1869, 0.2902, 59], [7.4772, 0.2902, 49], [7.7674, 0.2902, 50],
  [8.0577, 0.8707, 43], [8.9284, 0.2902, 43], [9.2187, 0.2902, 45], [9.5089, 0.2902, 47],
  [9.7992, 0.8707, 43], [10.6699, 0.8707, 43], [11.5407, 0.2902, 43], [11.8309, 0.2902, 40],
  [12.1212, 0.2902, 38], [12.4114, 0.2902, 47], [12.7017, 0.2902, 45], [12.9919, 0.2902, 57],
  [13.2822, 0.5805, 47], [13.8627, 0.5805, 43], [14.4432, 0.2902, 45], [14.7334, 0.2902, 52],
  [15.3139, 0.5805, 47], [15.8944, 0.2902, 55], [16.4749, 0.5805, 47], [17.0554, 0.8707, 42],
  [17.9262, 0.2902, 45], [18.2164, 0.5805, 47], [18.7969, 0.8707, 45], [19.6677, 0.2902, 54],
  [19.9579, 0.5805, 47], [20.5384, 0.5805, 38], [21.1189, 0.2902, 55], [21.4092, 0.2902, 54],
  [21.6994, 0.2902, 52], [21.9897, 0.2902, 43], [22.2799, 0.2902, 50], [22.5702, 0.2902, 42],
  [22.8604, 0.2902, 49], [23.1507, 0.2902, 50], [23.4409, 0.8707, 45], [24.3117, 0.2902, 57],
  [24.6019, 0.2902, 50], [24.8922, 0.2902, 55], [25.1824, 0.5805, 45], [25.7629, 0.2902, 50],
  [26.0532, 0.2902, 55], [26.3434, 0.2902, 45], [26.6337, 0.2902, 43], [26.9239, 0.2902, 50],
  [27.2141, 0.2902, 57], [27.5044, 0.5805, 45], [28.0849, 0.2902, 50], [28.3751, 0.2902, 55],
  [28.6654, 0.2902, 47], [28.9556, 0.2902, 45], [29.2459, 0.2902, 38], [29.5361, 0.2902, 54],
  [29.8264, 0.5805, 42], [30.4069, 0.2902, 38], [30.6971, 0.2902, 54], [30.9874, 0.5805, 43],
  [31.5679, 0.2902, 47], [31.8581, 0.8707, 42], [32.7289, 0.2902, 45], [33.0191, 0.5805, 43],
  [33.5996, 0.2902, 42], [33.8899, 0.5805, 50], [34.4704, 0.2902, 42], [34.7606, 0.2902, 49],
  [35.0509, 0.2902, 50], [35.3411, 0.8707, 43], [36.2119, 0.2902, 43], [36.5021, 0.2902, 54],
  [36.7924, 0.2902, 45], [37.0826, 0.5805, 43], [37.6631, 0.5805, 47], [38.2436, 0.8707, 43],
  [39.1144, 0.2902, 43], [39.4046, 0.5805, 38], [39.9851, 0.5805, 45], [40.5656, 0.5805, 47],
  [41.1461, 0.5805, 43], [42.5974, 0.2902, 50], [42.8876, 0.2902, 47], [43.1779, 0.2902, 55],
  [43.4681, 0.5805, 38], [44.3389, 0.2902, 43], [44.6291, 0.5805, 42], [45.2096, 0.8707, 43],
  [46.0804, 0.2902, 43], [46.3706, 0.8707, 45], [47.2414, 0.2902, 45], [47.5316, 0.2902, 47],
  [48.1121, 0.2902, 38], [48.4024, 0.8707, 55], [49.2731, 0.2902, 52], [49.5634, 0.2902, 43],
  [49.8536, 0.8707, 50], [50.7244, 0.2902, 50], [51.0146, 0.8707, 45], [51.8854, 0.2902, 45],
  [52.1756, 0.2902, 50], [52.4659, 0.8707, 57], [53.3366, 0.2902, 57], [53.6268, 0.2902, 59],
  [53.9171, 0.2902, 55], [54.2073, 0.2902, 52], [54.4976, 0.2902, 62], [54.7878, 0.8707, 57],
  [55.6586, 0.2902, 57], [55.9488, 0.2902, 59], [56.2391, 0.2902, 55], [56.5293, 0.2902, 52],
  [57.1098, 0.5805, 43], [57.6903, 0.5805, 38], [58.8513, 0.2902, 55], [59.1416, 0.2902, 54],
  [59.4318, 0.5682, 50]
  ],
  // [cuándo, cuánto, qué acorde, con cuánta fuerza]
  compases: [
  [0.0, 0.5112, "A", 0.961], [0.5112, 1.161, "F#m", 0.959],
  [1.6722, 1.161, "D", 1.06], [2.8332, 1.161, "D", 0.85],
  [3.9942, 1.161, "F#m", 1.06], [5.1552, 1.161, "F#m", 0.984],
  [6.3162, 1.161, "Bm", 1.024], [7.4772, 1.161, "D", 0.907],
  [8.6382, 1.161, "G", 0.864], [9.7992, 1.161, "C#dim", 0.962],
  [10.9602, 1.161, "D", 0.860], [12.1212, 1.161, "F#m", 0.907],
  [13.2822, 1.161, "G", 1.06], [14.4432, 1.161, "Em", 1.016],
  [15.6042, 1.161, "G", 1.037], [16.7652, 1.161, "Bm", 0.960],
  [17.9262, 1.161, "Em", 0.851], [19.0872, 1.161, "E7", 0.938],
  [20.2482, 1.161, "D", 1.06], [21.4092, 1.161, "D", 0.910],
  [22.5702, 1.161, "A", 0.911], [23.7312, 1.161, "A", 0.934],
  [24.8922, 1.161, "D", 0.76], [26.0532, 1.161, "F#m", 0.801],
  [27.2141, 1.161, "A", 1.06], [28.3751, 1.161, "F#m", 1.045],
  [29.5361, 1.161, "D", 1.041], [30.6971, 1.161, "F#m", 1.006],
  [31.8581, 1.161, "F#m", 1.038], [33.0191, 1.161, "Bm", 0.885],
  [34.1801, 1.161, "Bm", 0.857], [35.3411, 1.161, "D", 0.930],
  [36.5021, 1.161, "Em", 0.920], [37.6631, 1.161, "Bm", 0.799],
  [38.8241, 1.161, "D", 0.984], [39.9851, 1.161, "A7", 0.941],
  [41.1461, 1.161, "C#dim", 1.06], [42.3071, 1.161, "Em", 1.06],
  [43.4681, 1.161, "Bm", 0.958], [44.6291, 1.161, "D", 0.930],
  [45.7901, 1.161, "E7", 0.998], [46.9511, 1.161, "D", 0.987],
  [48.1121, 1.161, "D", 0.940], [49.2731, 1.161, "E7", 1.023],
  [50.4341, 1.161, "A", 1.042], [51.5951, 1.161, "D", 0.890],
  [52.7561, 1.161, "A", 0.806], [53.9171, 1.161, "D", 0.875],
  [55.0781, 1.161, "A", 0.825], [56.2391, 1.161, "D", 0.819],
  [57.4001, 1.161, "D", 0.862], [58.5611, 1.161, "C#dim", 0.76],
  [59.7221, 0.2779, "Bm", 0.868]
  ],
  // el acorde de cada compás: la nota más grave y los intervalos que van arriba
  acordes: {
    D: [38, [0, 4, 7]],
    Em: [40, [0, 3, 7]],
    'F#m': [42, [0, 3, 7]],
    G: [43, [0, 4, 7]],
    A: [45, [0, 4, 7]],
    Bm: [47, [0, 3, 7]],
    'C#dim': [49, [0, 3, 6]],
    A7: [45, [0, 4, 7, 10]],
    E7: [40, [0, 4, 7, 10]]
  }
};

// Cada instrumento es una suma de armónicos: no es un modelo físico, es lo poco
// que hace falta para que una trompeta no suene a flauta. El fundamental lleva
// la onda que dice `onda` y los armónicos van todos en seno. `suma` es lo que
// suman los pesos, para que la nota no salga más fuerte por tener más
// armónicos. `cola` y `colaF` son el apagado del final, en segundos y en
// fracción de la nota: gana el más corto de los dos.
const INSTRUMENTOS = {
  trompeta:  { onda: 'sawtooth', suma: 1.955, ataque: 0.012, cola: 0.10, colaF: 0.30,
               armonicos: [[1, 1], [2, 0.50], [3, 0.26], [4, 0.13], [5, 0.065]] },
  clarinete: { onda: 'sine', suma: 1.5, ataque: 0.025, cola: 0.10, colaF: 0.30,
               armonicos: [[1, 1], [3, 0.38], [5, 0.12]] },
  trombon:   { onda: 'sine', suma: 1.7, ataque: 0.018, cola: 0.11, colaF: 0.32,
               armonicos: [[1, 1], [2, 0.42], [3, 0.20], [4, 0.08]] },
  corno:     { onda: 'sine', suma: 1.38, ataque: 0.035, cola: 0.13, colaF: 0.35,
               armonicos: [[1, 1], [2, 0.28], [3, 0.10]] },
  tuba:      { onda: 'triangle', suma: 1.29, ataque: 0.012, cola: 0.10, colaF: 0.35,
               armonicos: [[1, 1], [2, 0.22], [3, 0.07]] }
};

const hz = m => 440 * Math.pow(2, (m - 69) / 12);

// Cuánto se programa por delante del reloj. Segundo y medio aguanta un par de
// cuadros perdidos sin que se oiga un hueco, y es poco como para que cortar la
// música sea instantáneo.
const VENTANA = 1.5;

// EL GUION: la obra pasada a una sola lista de eventos ordenada por tiempo.
// Se arma una vez por obra y queda guardada en ella, así que volver a tocarla
// —o repetirla, que es lo que pasa si el acto dura más de un minuto— no cuesta
// nada.
function guion (obra) {
  if (obra.guion) return obra.guion;
  const ev = [];

  // la fuerza del compás en el que cae cada nota: el último compás que empezó
  const fuerza = t => {
    let cual = obra.compases[0];
    for (const c of obra.compases) { if (c[0] <= t) cual = c; else break; }
    return cual ? cual[3] : 0.9;
  };

  for (const [t, d, n] of obra.melodia) {
    const f = fuerza(t);
    ev.push({ t, voz: 'trompeta', d: d * 0.92, n, a: 0.090 * f, pan: -0.18 });
    ev.push({ t: t + 0.006, voz: 'clarinete', d: d * 0.90, n, a: 0.022 * f, pan: 0.24 });
  }
  // la tuba no sube: lo que está escrito arriba del si bemol lo toca una octava
  // abajo, que es lo que haría el que la sopla
  for (const [t, d, n] of obra.bajos) {
    ev.push({ t, voz: 'tuba', d: d * 0.88, n: n >= 55 ? n - 12 : n, a: 0.058 * fuerza(t), pan: 0 });
  }

  obra.compases.forEach(([t, d, acorde, f], i) => {
    if (d < 0.08) return;
    const [raiz, notas] = obra.acordes[acorde];
    const pulso = d / 2;
    // el acompañamiento va A CONTRATIEMPO —en el 46% de cada pulso— y son dos
    // por compás. Es el «pum-CHIN, pum-CHIN» de una banda de plaza: sin eso la
    // armonía queda sonando abajo como un colchón y no como una banda.
    for (let z = 0; z < 2; z++) {
      const golpe = t + z * pulso + pulso * 0.46;
      for (let j = 0; j < Math.min(3, notas.length); j++) {
        ev.push({ t: golpe, voz: 'trombon', d: pulso * 0.42, n: raiz + 24 + notas[j],
                  a: 0.020 * f, pan: -0.14 + j * 0.12 });
        ev.push({ t: golpe + 0.006, voz: 'corno', d: pulso * 0.44, n: raiz + 36 + notas[j],
                  a: 0.011 * f, pan: 0.08 + j * 0.07 });
      }
    }
    ev.push({ t, voz: 'bombo', a: 0.095 * f });
    ev.push({ t: t + pulso, voz: 'bombo', a: 0.078 * f });
    // la caja: ocho golpes por compás, con los del tercero y el séptimo
    // marcados. Es lo que le da el paso.
    for (let q = 0; q < 8; q++) {
      ev.push({ t: t + d * q / 8, voz: 'caja', d: 0.06, agudo: 1500,
                a: 0.011 * f * (q === 2 || q === 6 ? 1.45 : 0.78) });
    }
    if (i % 8 === 0) ev.push({ t, voz: 'platillo', d: 0.55, agudo: 4000, a: 0.014 * f });
  });

  ev.sort((a, b) => a.t - b.t);
  obra.guion = ev;
  return ev;
}

export class Banda {
  // `salida` es a dónde va la música y `ruido` el buffer de ruido blanco que
  // audio.js ya tiene armado: la caja y el platillo son ruido filtrado, y
  // sortear uno nuevo por golpe son cuatrocientas tandas de Math.random() por
  // minuto para algo que dura sesenta milisegundos.
  constructor (ctx, salida, ruido) {
    this.ctx = ctx;
    this.ruido = ruido;
    this.bus = ctx.createGain();
    this.bus.gain.value = 0.0001;
    this.bus.connect(salida);
    this.obra = null;
    this.eventos = [];
    this.i = 0;
    this.t0 = 0;
  }

  get sonando () { return !!this.obra; }

  tocar (obra, volumen = 0.5, entrada = 0.9) {
    if (!obra) return;
    this.obra = obra;
    this.eventos = guion(obra);
    this.i = 0;
    const t = this.ctx.currentTime;
    this.t0 = t + 0.12;              // un respiro para que el primer golpe no llegue tarde
    this.bus.gain.cancelScheduledValues(t);
    this.bus.gain.setValueAtTime(0.0001, t);
    this.bus.gain.linearRampToValueAtTime(volumen, t + entrada);
    this.atender();
  }

  // Cortar es dejar de programar y bajar la ganancia: lo que ya está en vuelo
  // —segundo y medio como mucho— se apaga con ella.
  parar (seg = 1.2) {
    if (!this.obra) return;
    this.obra = null;
    this.eventos = [];
    const t = this.ctx.currentTime;
    const g = this.bus.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(Math.max(0.0001, g.value), t);
    g.exponentialRampToValueAtTime(0.0001, t + Math.max(0.05, seg));
  }

  // El pulso: lo llama audio.js una vez por cuadro. No hace falta que sea
  // puntual —para eso está la ventana—, hace falta que lo llamen.
  atender () {
    if (!this.obra) return;
    const hasta = this.ctx.currentTime - this.t0 + VENTANA;
    const ev = this.eventos;
    while (this.i < ev.length && ev[this.i].t <= hasta) {
      const e = ev[this.i++];
      this._voz(e, Math.max(this.ctx.currentTime, this.t0 + e.t));
    }
    // y se repite: el acto no tiene reloj, lo lleva el que juega, y puede
    // tardar más de un minuto en sacar a San Martín de abajo del caballo
    if (this.i >= ev.length && hasta >= this.obra.dura) { this.t0 += this.obra.dura; this.i = 0; }
  }

  _voz (e, t) {
    if (e.voz === 'bombo') return this._bombo(t, e.a);
    if (e.voz === 'caja' || e.voz === 'platillo') return this._parche(t, e.d, e.a, e.agudo);
    return this._soplo(t, e);
  }

  // la envolvente de un soplo: entra, se sostiene y se apaga
  _sobre (t, d, a, ataque, cola) {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(a, t + Math.min(ataque, d * 0.25));
    g.gain.setValueAtTime(a, t + Math.max(0.025, d - cola));
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    return g;
  }

  _soplo (t, e) {
    const ins = INSTRUMENTOS[e.voz];
    const g = this._sobre(t, e.d, e.a, ins.ataque, Math.min(ins.cola, e.d * ins.colaF));
    const p = this.ctx.createStereoPanner();
    p.pan.value = e.pan || 0;
    g.connect(p).connect(this.bus);
    for (const [h, k] of ins.armonicos) {
      const o = this.ctx.createOscillator();
      const q = this.ctx.createGain();
      o.type = h === 1 ? ins.onda : 'sine';
      o.frequency.value = hz(e.n) * h;
      q.gain.value = k / ins.suma;
      o.connect(q).connect(g);
      o.start(t);
      o.stop(t + e.d + 0.03);
    }
  }

  _bombo (t, a) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(82, t);
    o.frequency.exponentialRampToValueAtTime(44, t + 0.17);
    g.gain.setValueAtTime(a, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.19);
    o.connect(g).connect(this.bus);
    o.start(t);
    o.stop(t + 0.20);
  }

  // la caja y el platillo: ruido con un pasaaltos y una caída seca. El golpe
  // arranca en un punto cualquiera del buffer, que si no los cuatrocientos
  // golpes del minuto son el mismo golpe repetido y se oye el bucle.
  _parche (t, d, a, agudo) {
    if (!this.ruido) return;
    const s = this.ctx.createBufferSource();
    const f = this.ctx.createBiquadFilter();
    const g = this.ctx.createGain();
    s.buffer = this.ruido;
    f.type = 'highpass';
    f.frequency.value = agudo;
    g.gain.setValueAtTime(a, t);
    g.gain.exponentialRampToValueAtTime(a * 0.0025, t + d);
    s.connect(f).connect(g).connect(this.bus);
    s.start(t, Math.random() * Math.max(0.01, this.ruido.duration - d - 0.05));
    s.stop(t + d);
  }
}
