// ===========================================================================
// EL BALANCE · la tabla de la pelea
// ===========================================================================
//
// Acá están TODOS los números que deciden quién gana: cuánto aguanta cada uno,
// cuánto cuesta cada golpe, con qué puntería se tira y qué probabilidad hay de
// terminar en el suelo. Ningún otro archivo inventa un número de combate: si
// una bala hace veintiséis, lo dice acá y nada más que acá.
//
// Está separado a propósito. Un número de balance se toca veinte veces antes
// de quedar bien, y buscarlo desparramado entre mil doscientas líneas de
// lógica es la forma más segura de no tocarlo nunca. Para reequilibrar la
// batalla se abre este archivo y no hace falta abrir ningún otro.
//
// Lo que NO va acá: tiempos de animación, velocidades de marcha, distancias de
// aviso. Eso es el comportamiento de cada sistema y vive con su sistema.

// ---------------------------------------------------------------------------
// 1 · LA VIDA · cuánto aguanta cada uno
// ---------------------------------------------------------------------------
//
// La tropa se cuenta en golpes y el jugador en cien puntos, porque son dos
// cosas distintas: al soldado le importa cuántos bayonetazos aguanta y a vos
// te importa la barra.
export const VIDA_TROPA = 4;          // cuatro balazos de tropa, dos del jugador
export const VIDA_CABALLO = 6;        // tres impactos de bala, uno de metralla

// ---------------------------------------------------------------------------
// 2 · EL DAÑO · lo que cuesta cada golpe
// ---------------------------------------------------------------------------
//
// Estaba todo al doble de lo que aguanta una pelea: un balazo se llevaba medio
// jugador y dos te mataban, con un 40-75 % de acierto por disparo. Morías en
// segundos y la batalla se terminaba antes de empezar. Ahora hacen falta
// cuatro balazos o seis bayonetazos, y acertar cuesta mucho más. No es que te
// peguen menos: es que te pegan menos veces y cada golpe no te parte al medio.

// -- contra el jugador, sobre cien --
export const DANO_BALA = 26;
export const DANO_BAYONETA = 14;
export const DANO_METRALLA = 58;      // ya no te mata de un tarro si estás sano
export const CAIDA = 12;              // lo que cuesta pegar contra el suelo
export const BAYONETA_PARADA = 0.18;  // el acero no entra, pero el envión sí

// -- del jugador, en golpes de tropa --
//
// Tu bala mata de una. Duplicar la vida de la tropa tenía que hacer que la
// pelea ENTRE ELLOS durara el doble, no que vos necesitaras dos tiros para lo
// mismo: acá el que apunta sos vos, y ya pagaste los quince segundos de carga.
export const BALA_JUGADOR = 4;
export const DANO_SABLE = 3;          // contra 4 de vida: dos sablazos
export const DANO_REMATE = 6;         // mata de una: es lo que paga la parada
export const CULATAZO = 2;            // el arma larga dada vuelta, de apuro
export const BAYONETAZO = 3;          // el puntazo del fusil: llega más y duele más

// -- entre la tropa --
export const BALA_TROPA = 2;          // dos balazos de tropa a tropa
export const BAYONETA_TROPA = 2;
export const LANZA_TROPA = 4;         // el asta mata de una: llega antes
export const METRALLA_TROPA = 3;

// -- al caballo --
//
// Un caballo es un blanco enorme y va adelante, así que la mayoría de lo que
// le tiran a un jinete se lo come él. Por eso un montado aguanta el doble que
// un hombre a pie: tres impactos al animal y recién ahí está el hombre.
// «Si te baja a la mitad, perdés el caballo» — literalmente.
export const CABALLO_COME = 0.6;      // seis de cada diez impactos van al animal
export const BALA_AL_CABALLO = 2;     // contra 6 de vida: tres impactos
export const METRALLA_CABALLO = 9;    // lo voltea de una

// ---------------------------------------------------------------------------
// 3 · LA PUNTERÍA · con qué probabilidad se acierta
// ---------------------------------------------------------------------------
//
// Un ánima lisa de 1813, disparada por un hombre apurado, con humo y con el
// oído reventado, agrupa alrededor de dos grados y medio. A veinte metros eso
// es un metro de desvío contra un blanco de treinta y cinco centímetros de
// radio: la mayoría de los tiros pasan al lado. Que es lo que pasaba.
//
// El error tiene dos partes que se comportan distinto y se suman: el CONO, que
// crece con la distancia, y el TEMBLOR, que no —el pulso del que aprieta—.
// Medido contra un hombre de frente:
//
//     5 m  64 %  ·  10 m  51 %  ·  20 m  26 %  ·  40 m  9 %  ·  60 m  5 %
//
// De rodilla se tira casi al doble de bien, porque el arma se apoya. Dentro
// del humo se cae al 6 %, y es el mismo campo de densidad que te tapa a vos.
export const CONO_FUSIL = 0.043;      // radianes: el cono del que salen los tiros
export const CONO_HINCADO = 0.62;     // con la rodilla en tierra el arma se apoya
export const CONO_HUMO = 1.6;         // por unidad de oclusión, el cono se abre
export const TEMBLOR = 0.52;          // metros de error que NO dependen de la distancia
export const BLANCO_HOMBRE = 0.34;    // medio ancho de un hombre de frente, en metros
export const BLANCO_MONTADO = 1.75;   // un hombre a caballo es mucho más grande
export const ZUMBIDO = 1.6;           // a menos de esto, la bala se oye pasar

// Desviación con colas: dos uniformes sumadas se parecen a una campana, así que
// la mayoría de los tiros van cerca y de vez en cuando sale uno muy abierto
// —o uno afortunado a sesenta metros—.
function desvio (cono) {
  return (Math.random() + Math.random() - 1) * cono;
}

// LA TIRADA DEL DISPARO, para todo el mundo.
//
// Una sola función para el tiro contra el jugador y contra la tropa. El arma
// tira dentro de un cono y la bala va a donde va; si el desvío a esa distancia
// entra en la silueta, pegó. Devuelve también DÓNDE pasó, porque un tiro que
// falla sin dejar rastro es indistinguible de uno que no existió.
export function tirar (dist, oclusion = 0, ancho = BLANCO_HOMBRE, hincado = false) {
  let cono = CONO_FUSIL * (1 + oclusion * CONO_HUMO);
  let temblor = TEMBLOR;
  if (hincado) { cono *= CONO_HINCADO; temblor *= CONO_HINCADO; }
  const dx = desvio(cono) * dist + desvio(temblor);
  const dy = desvio(cono) * dist + desvio(temblor);
  const fuera = Math.hypot(dx, dy);
  return { acierto: fuera < ancho, fuera, dx, dy };
}

// ---------------------------------------------------------------------------
// 4 · EL VOLTEO · con qué probabilidad terminás en el suelo
// ---------------------------------------------------------------------------
//
// UNA cosa bajó a San Martín del caballo el 3 de febrero, y no fue la
// mosquetería: fue la metralla. Así que agarrarse a la silla es una tirada, y
// cada arma tiene la suya. Lo que se lee acá es una jerarquía: la bala te tira
// poco —te pega, no te empuja—, la bayoneta desde abajo te busca la pierna y
// el estribo, el asta del lancero te levanta porque para eso se inventó, y la
// metralla no pregunta.
export const VOLTEO = {
  bala: 0.20,
  bayoneta: 0.34,
  lanza: 0.58,
  metralla: 1
};

// Lo que resta un jinete de oficio. San Martín no era un recluta arriba de un
// caballo: era comandante de caballería. Con esto un balazo lo baja una vez
// cada trece; a un lancero de la tropa, una de cada cinco.
export const OFICIO = 0.62;

// Y hay una segunda cuenta, que es la que hace que esto no sea una lotería
// suelta: EL AGARRE. Cada golpe que aguantás te afloja de la silla y el
// siguiente te encuentra peor agarrado. Si te dejan en paz unos segundos, te
// recomponés. No hay un tiro que te baje: hay una acumulación, y la respuesta
// correcta a que te tambaleen es salir de ahí, no seguir cargando.
export const AGARRE_AFLOJA = 0.26;    // lo que se pierde por cada golpe aguantado

// ---------------------------------------------------------------------------
// 5 · EL ALIENTO · por qué no corren siempre
// ---------------------------------------------------------------------------
//
// Los realistas corrían SIEMPRE y venían todos juntos. La causa era mecánica y
// no de IA: recargar lleva doce segundos y medio, así que casi siempre están
// descargados, y un hombre descargado con el enemigo cerca carga a la bayoneta.
// Descargados + cerca = corriendo, todo el tiempo, todos.
//
// El arreglo no es un temporizador: es que se cansen. Cuatro segundos de
// carrera, cinco de resuello. Los intervalos salen solos y nadie los
// coreografió. Medido sobre treinta hombres: corren el 3 % del tiempo con
// picos del 33 %, y los treinta corrieron en algún momento.
export const ALIENTO_TROPA = 100;
export const GASTO_CARRERA = 26;      // por segundo corriendo
export const RECUPERO = 13;           // por segundo caminando
export const CARRERA_MINIMA = 35;     // con menos que esto no arranca a correr

// -- y el del jugador --
export const GUARDIA_GASTO = 11;      // por segundo aguantando el sable en alto
export const BLOQUEO_GASTO = 26;      // lo que cuesta parar tarde
export const PECHADA_GASTO = 18;

// ---------------------------------------------------------------------------
// 6 · EL GENTÍO · cuántos, y quién le pega a quién
// ---------------------------------------------------------------------------
//
// Un blanco que ya tiene gente encima deja de ser atractivo. Sin esto, los
// doscientos cincuenta eligen siempre al más cercano —vos— y te llega una fila
// india de hombres sprintando de a uno, que es lo más robótico que puede pasar
// en un campo de batalla. Se paga en metros: cada atacante que ya tiene un
// blanco lo aleja siete metros a los ojos de los demás.
export const SATURACION = 7;

// Cuánta gente aguanta el campo en el modo suelto. NO son números inventados:
// salen de medir (pruebas/escala.mjs y pruebas/lejania.mjs). Con la lejanía el
// dibujo dejó de ser el techo —370 hombres en 99 llamadas— y ahora manda la
// simulación. Igual los topes suben de a poco: el número que aguanta la
// máquina y el número que hace buena la pelea no son el mismo.
export const ALIADOS_MAX = 20;
export const ENEMIGOS_MAX = 34;
export const MONTADOS = 0.66;         // qué proporción de granaderos sale a caballo
export const OLEADA_REALISTA = [3, 3];   // [mínimo, azar] segundos entre uno y otro
export const OLEADA_GRANADERO = [4, 4];

// ---------------------------------------------------------------------------
// 7 · EL ALCANCE DEL ACERO
// ---------------------------------------------------------------------------
export const PECHADA_ALCANCE = 2.2;
export const SABLE_ALCANCE = 2.4;
export const ALCANCE_MONTADO = 3.3;   // desde arriba llegás más lejos

// ---------------------------------------------------------------------------
// 8 · EL ÁNIMO · lo que hace que un hombre deje de pelear
// ---------------------------------------------------------------------------
//
// Esta sección existe porque a la batalla le faltaba un final. Hasta acá la
// única forma de ganar era matar a los doscientos cincuenta de a uno, que es
// exactamente lo contrario de lo que pasó: la línea realista se quebró y bajó
// corriendo la barranca a los botes, dejando las dos piezas y sus muertos.
// Ninguna tabla de daño convierte un exterminio en San Lorenzo.
//
// LA MORAL NO ES UNA BARRA DE EJÉRCITO. La tentación es un contador global:
// el bando acumula bajas, llega a cero y todos corren. Eso es una abstracción
// de juego de estrategia y desde adentro de un cuerpo, en primera persona, se
// siente arbitrario: de golpe, sin motivo visible, doscientos tipos dan media
// vuelta. Lo que rompe una línea en 1813 es LOCAL. Un hombre no sabe que el
// ejército perdió cuarenta; sabe que los tres que tenía al lado están en el
// piso, que le tiran desde el costado y que se le viene un caballo encima.
//
// Así que el ánimo va por hombre, y lo que lo baja es lo que ese hombre puede
// ver. Todo lo de acá abajo se paga POR SEGUNDO salvo donde dice de golpe.
export const ANIMO_TROPA = 100;

// El compañero que cae al lado. Es el término más pesado y es de golpe, no por
// segundo: un muerto se cobra una vez, no mientras el cadáver esté ahí. Contar
// cadáveres haría que un campo lleno de muertos siguiera desmoralizando cuarenta
// segundos después, que es al revés de como funciona el susto.
export const CAIDO_CERCA = 10;
export const CAIDO_RADIO = 6.5;

// EL FLANCO. Esto es la pinza, escrita como número. El juego ya obliga a girar
// antes de disparar —un fusil de chispa no se apunta hacia atrás— pero hasta
// ahora que te entraran por el costado no COSTABA nada: girabas y listo. Acá
// empieza a costar, y por eso pegarle a un flanco pasa a ser mejor que pegarle
// de frente, que es la razón de ser de toda la maniobra.
// Y el flanco NO es «un enemigo fuera de mi cono de tiro». Eso se arregla
// girando, y girar lleva un segundo: medido así, un flanqueo no cuesta nada.
//
// Lo que hace a un flanco un flanco es que la TROPA tiene un frente, y el
// frente de una tropa no se da vuelta como se da vuelta un hombre. Así que
// cada uno lleva un frente propio que persigue MUY despacio hacia dónde está
// mirando —diez segundos para media vuelta— y el flanco se mide contra ése.
//
// De ahí sale, escrita como número, la razón de ser de toda la maniobra del 3
// de febrero: contra dos columnas que entran por los dos costados no hay
// frente que alcance. No se puede estar orientado a dos lados a la vez.
export const FLANCO = 9;
export const FLANCO_RADIO = 22;
export const FLANCO_CONO = 1.0;       // ±57°: fuera de esto lo tengo al costado
export const FLANCO_LLENO = 3;        // con tres o más ya no empeora
export const FRENTE_GIRO = 0.32;      // rad/s: lo que tarda la tropa en reorientarse

// CABALLERÍA ENCIMA. Infantería sin cuadro contra caballo. Es literalmente lo
// que pasó: los desembarcaron, les cayeron encima y no llegaron a formar.
export const CABALLO_ENCIMA = 10;
export const CABALLO_RADIO = 15;
export const CABALLO_LLENO = 2;

// LA SOLEDAD. Un hombre en una línea apretada aguanta; el mismo hombre solo,
// no. Es la otra cara del gentío: la formación no sirve sólo para tirar juntos.
export const SOLEDAD = 5;
export const JUNTOS_RADIO = 9;
export const JUNTOS_MINIMO = 3;

export const HERIDO = 4;              // por segundo con menos de la mitad de la vida
export const PIEZA_CALLADA = 18;      // de golpe, a los de su bando a 30 m
export const PIEZA_RADIO = 30;

// Y se recompone. Mientras no pase nada de lo de arriba y tenga gente al lado,
// el ánimo vuelve. Toda la tensión de la pelea está en esta resta: si el
// recupero le gana a lo que entra, la línea aguanta.
export const APLOMO = 4;

// EL CONTAGIO, que es lo que hace que se vea como una desbandada y no como un
// deshielo. Sin esto, doscientos cincuenta hombres cruzan su umbral cada uno
// por su cuenta y la línea se disuelve pareja, de a uno, como hielo que se
// derrite. Con esto un pedazo cede y el hueco se propaga hacia afuera hasta que
// se va todo junto. Eso es una desbandada.
export const CONTAGIO = 18;
export const CONTAGIO_RADIO = 7.5;

// El temple de cada uno, para que no se quiebren todos en el mismo cuadro. Es
// el mismo recurso que el arrojo: multiplica lo que le entra.
export const TEMPLE = [0.72, 0.62];   // [mínimo, azar]

// LA LÍNEA ROTA. Cuando esta proporción del bando ya se quebró, lo que queda
// ve que se está yendo todo el mundo, y eso es un golpe aparte: es el momento
// en que la retirada ordenada se vuelve fuga. Sin él la desbandada se arrastra;
// con él tiene un instante.
export const LINEA_ROTA = 0.22;
export const DESBANDE = 45;

// Y a dónde corre el que se quebró. No «lejos»: los realistas bajan por donde
// subieron —la barranca está en z −85 y la escuadra fondeada detrás— y los
// granaderos vuelven atrás del convento. El que llega, se fue de la batalla.
export const REFUGIO_REALISTA = -82;
export const REFUGIO_GRANADERO = 58;
