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
// LA VIDA SUBIÓ AL DOBLE, y no fue un capricho: era la única manera de que la
// batalla llegara a los tres minutos. Con cuatro de vida, ciento veinte
// granaderos consumían doscientos cincuenta realistas en cuarenta segundos y la
// moral no llegaba nunca a tener algo que decir.
export const VIDA_TROPA = 8;          // seis balazos de tropa, uno del jugador
export const VIDA_CABALLO = 18;       // nueve impactos de bala, uno de metralla

// ---------------------------------------------------------------------------
// 2 · EL DAÑO · lo que cuesta cada golpe
// ---------------------------------------------------------------------------
//
// Estaba todo al doble de lo que aguanta una pelea: un balazo se llevaba medio
// jugador y dos te mataban, con un 40-75 % de acierto por disparo. Morías en
// segundos y la batalla se terminaba antes de empezar. Ahora hacen falta
// cuatro balazos o seis bayonetazos, y acertar cuesta mucho más. No es que te
// peguen menos: es que te pegan menos veces y cada golpe no te parte al medio.
//
// Y hay una asimetría deliberada entre VOS y ELLOS, que es el eje de toda esta
// tanda: los golpes de la tropa NO matan de una y los tuyos SÍ. Un lancero que
// pasa te hiere; un sablazo tuyo, o un tiro tuyo al pecho, mata. Vos sos uno
// contra doscientos cincuenta y apuntás de verdad; ellos son muchos y tienen
// que durar.

// -- contra el jugador, sobre cien --
export const DANO_BALA = 26;
export const DANO_BAYONETA = 14;
export const DANO_METRALLA = 58;      // ya no te mata de un tarro si estás sano
export const CAIDA = 12;              // lo que cuesta pegar contra el suelo
export const BAYONETA_PARADA = 0.18;  // el acero no entra, pero el envión sí

// LA BALA QUE VIENE DE LEJOS NO ENTRA IGUAL. Una bala de plomo blando pierde
// energía rápido, y a cincuenta metros llega a hacer lo que un bayonetazo: te
// saca de la pelea, no te mata. De cerca es otra cosa.
//
// Esto no reemplaza a la puntería, la acompaña. De lejos ya era MUY difícil
// que te acertaran (a cuarenta metros, dos de cada cien tiros); ahora además,
// cuando aciertan, duele menos. Lo que hace peligrosa la distancia no es un
// tirador: son ciento cincuenta a la vez.
export const BALA_CERCA = 12;         // metros: de acá para adentro entra entera
export const BALA_LEJOS = 55;         // de acá para afuera es un balazo cansado
export const BALA_RESTA = 0.46;       // cuánto pierde en el camino

// Un solo perfil de caída, y vale para las dos puntas: contra vos y contra la
// tropa. Si fueran dos cuentas distintas, en tres semanas una estaría vieja.
export function caidaBala (dist) {
  const t = Math.max(0, Math.min(1, (dist - BALA_CERCA) / (BALA_LEJOS - BALA_CERCA)));
  return 1 - BALA_RESTA * t;
}

export function danoBalaEnemiga (dist) { return DANO_BALA * caidaBala(dist); }
export function balaContraTropa (dist) { return BALA_TROPA * caidaBala(dist); }

// DÓNDE LE PEGASTE. Tu bala mata de una, pero no desde cualquier lado: al
// pecho o a la cabeza mata, al brazo o a la pierna hiere. Es la única
// distinción de zona del juego y sólo vale para VOS —a la tropa se le pide que
// acierte, no que elija dónde—, porque sos el único que apunta de verdad.
//
// Se miden como fracción de la altura del ojo y no en metros, así valen igual
// para un hombre parado, uno hincado y uno arriba del caballo, que son tres
// alturas distintas del mismo cuerpo.
export const ZONA_CABEZA = 0.93;      // del ojo para arriba
export const ZONA_PECHO = 0.55;       // de acá para abajo ya son las piernas

// -- del jugador, en golpes de tropa --
//
// Tu bala mata de una. Duplicar la vida de la tropa tenía que hacer que la
// pelea ENTRE ELLOS durara el doble, no que vos necesitaras dos tiros para lo
// mismo: acá el que apunta sos vos, y ya pagaste los quince segundos de carga.
// Por eso todo lo tuyo subió junto con la vida y nada de lo tuyo perdió filo.
export const BALA_JUGADOR = 8;
export const BALA_MIEMBRO = 4;        // brazo o pierna: lo saca de la pelea, no lo mata
export const DANO_SABLE = 8;          // contra 8 de vida: el corvo mata de una
export const DANO_REMATE = 10;        // mata de una y además atraviesa la guardia
export const CULATAZO = 4;            // el arma larga dada vuelta, de apuro
export const BAYONETAZO = 6;          // el puntazo del fusil: llega más y duele más

// -- entre la tropa --
// Contra ocho de vida son nueve balazos de cerca y catorce de lejos. Parece
// muchísimo y es exactamente el punto: con la puntería de un ánima lisa a
// quince metros —once por ciento— un fusil de tropa es un arma de desgaste, no
// de decisión. Lo que decide esta batalla es la caballería encima, no el fuego.
//
// BAJÓ DE 1,5 A 0,9 CUANDO SE ARREGLÓ LA LÍNEA DE TIRO. Antes los realistas se
// vetaban el tiro entre ellos y pegaban 294 tiros en toda la batalla; arreglado
// eso pegan 653, y con el daño viejo se comían la caballería antes de los dos
// minutos. Sin jinetes no hay CABALLO_ENCIMA y sin CABALLO_ENCIMA no se quiebra
// ninguna línea: la batalla se plantaba en 64 de ánimo y no bajaba más.
//
// O sea: no bajó porque una bala duela menos. Bajó porque ahora hay el doble de
// balas, y lo que importa es el producto.
export const BALA_TROPA = 0.9;
export const BAYONETA_TROPA = 1.5;
// EL ASTA YA NO MATA DE UNA. Estaba en cuatro contra cuatro de vida, o sea que
// cada pasada de lancero era exactamente letal, y con ciento veinte granaderos
// entrando al galope eso no es una batalla: es una cosecha. Medido, se llevaba
// unos ciento treinta y cinco realistas de doscientos cincuenta, cuando en San
// Lorenzo murieron alrededor de cuarenta.
//
// Bajarlo a la mitad no alcanzó y hubo que llegar hasta acá, que al principio
// pareció demasiado: ocho pasadas para matar a un hombre sano. Pero es lo que
// dice la batalla. LA CARGA NO MATABA LA LÍNEA: LA ROMPÍA. Lo que hizo el
// regimiento el 3 de febrero fue meterse adentro y no dejarlos formar, y los
// doscientos diez que se salvaron se salvaron corriendo, no peleando. El
// lanzazo hiere, voltea y aterra —CABALLO_ENCIMA, más abajo, es el término que
// hace el trabajo—; matar es lo que menos hace.
export const LANZA_TROPA = 1;
export const METRALLA_TROPA = 6;

// -- al caballo --
//
// Un caballo es un blanco enorme y va adelante, así que la mayoría de lo que
// le tiran a un jinete se lo come él. Por eso un montado aguanta el doble que
// un hombre a pie: tres impactos al animal y recién ahí está el hombre.
// «Si te baja a la mitad, perdés el caballo» — literalmente.
export const CABALLO_COME = 0.6;      // seis de cada diez impactos van al animal
export const BALA_AL_CABALLO = 2;     // contra 18 de vida: nueve impactos
export const METRALLA_CABALLO = 20;   // lo voltea de una

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
//
// EL CONO SE ABRIÓ, de 0,043 a 0,105. Y se abrió el cono y no el temblor a
// propósito, porque son dos cosas distintas: el temblor manda a bocajarro y el
// cono manda de lejos, así que tocar sólo el cono deja el tiro a cinco metros
// casi igual y convierte el de veinte en lo que era de verdad. Medido contra un
// hombre de frente, antes y ahora:
//
//      5 m  64 → 45 %  ·  10 m  51 → 20 %  ·  20 m  26 → 7 %  ·  40 m  9 → 2 %
//
// El motivo es de balance y no de sabor. Doscientos cincuenta fusiles que
// aciertan uno de cada cuatro a veinte metros son una ametralladora: barrían a
// los ciento veinte granaderos en dos minutos y medio, o sea antes de que la
// moral llegara a hacer nada, y la batalla terminaba en una riña de infantería
// que ganaban ellos porque son el doble. Con el cono abierto la carga alcanza a
// llegar, que es lo que tiene que pasar.
//
// De rodilla se tira casi al doble de bien, porque el arma se apoya. Dentro
// del humo se cae a casi nada, y es el mismo campo de densidad que te tapa a
// vos. La tabla entera la imprime pruebas/balance.mjs.
export const CONO_FUSIL = 0.105;      // radianes: el cono del que salen los tiros
export const CONO_HINCADO = 0.62;     // con la rodilla en tierra el arma se apoya
export const CONO_HUMO = 1.6;         // por unidad de oclusión, el cono se abre
export const TEMBLOR = 0.52;          // metros de error que NO dependen de la distancia
export const BLANCO_HOMBRE = 0.34;    // medio ancho de un hombre de frente, en metros
// UN HOMBRE A CABALLO ES MÁS GRANDE, PERO NO VEINTISÉIS VECES MÁS. Estaba en
// 1,75 m de medio ancho contra 0,34 del hombre a pie, y como el blanco es un
// círculo eso es veintiséis veces el área: un jinete a veinte metros comía el
// 60 % de los tiros. Un caballo con jinete es más ancho y mucho más alto que un
// hombre, no una pared de tres metros y medio.
export const BLANCO_MONTADO = 0.62;   // contra 0,34 a pie: tres veces el área
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

// Y EL DE LA TROPA. Los granaderos no eran reclutas arriba de un caballo: eran
// el regimiento que San Martín se pasó un año instruyendo justamente en esto.
// Pero no tenían oficio ninguno: la constante de acá arriba estaba importada en
// soldados.js y sin usar, así que a un lancero cada bayonetazo lo bajaba una de
// cada tres veces y cada balazo una de cada cinco, sin descuento.
//
// Medido, eso se llevaba puesta la mecánica entera: de ciento veinte granaderos
// montados quedaban cincuenta y cinco a los treinta segundos y ninguno a los dos
// minutos. Y un granadero desmontado no da miedo —CABALLO_ENCIMA es lo único que
// quiebra una línea de infantería—, así que la carga se apagaba antes de que la
// moral llegara a hacer nada y la batalla terminaba en una riña de infantería
// que ganaban ellos, que son el doble.
//
// Es más bajo que el de San Martín, que además tiene el agarre: él es comandante
// de caballería y ellos son su tropa.
export const OFICIO_TROPA = 0.75;

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
//
// ---------------------------------------------------------------------------
// LA ESCALA DE ESTA SECCIÓN BAJÓ COMO TREINTA VECES, Y ES EL CAMBIO MÁS GRANDE
// ---------------------------------------------------------------------------
//
// La línea realista se quebraba a los DIECIOCHO SEGUNDOS y la batalla entera se
// terminaba en cuarenta y cinco. Eso no es una desbandada: es un portazo. El
// término que lo hacía era CABALLO_ENCIMA, que a once por segundo y con el
// multiplicador de flanco llegaba a veintiséis: cien de ánimo en cuatro
// segundos. Un hombre no decide en cuatro segundos.
//
// Ahora el quiebre cae entre los ciento setenta y los doscientos quince
// segundos —tres minutos y pico— con setenta a noventa realistas todavía en
// pie. Medido en pruebas/desbande.mjs, seis corridas.
//
// Nada de esto se puede tocar de a un número: bajar la moral sola hacía que la
// línea aguantara hasta que no quedara caballería para asustarla, y la batalla
// no se alargaba, cambiaba de ganador. La escala de acá abajo va atada a tres
// cosas de más arriba —la vida de la tropa, el cono del fusil y el oficio del
// jinete— y si se mueve una hay que volver a medir las cuatro.
export const ANIMO_TROPA = 100;

// El compañero que cae al lado. Es de golpe, no por segundo: un muerto se cobra
// una vez, no mientras el cadáver esté ahí. Contar cadáveres haría que un campo
// lleno de muertos siguiera desmoralizando cuarenta segundos después, que es al
// revés de como funciona el susto.
//
// Es el único término que crece con las BAJAS y no con la caballería, y por eso
// se lo subió aparte cuando todo lo demás bajaba: es el que salva las corridas
// en que la carga sale mal. Si a los granaderos les matan los caballos temprano
// no queda quién dé miedo, y sin esto la batalla se empantanaba media hora.
export const CAIDO_CERCA = 6;
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
//
// (El número es chico porque toda esta sección bajó de escala; lo que importa
// no es cuánto vale sino cuánto vale AL LADO de los otros, y contra el APLOMO.)
// OJO: EL FLANCO Y LA SOLEDAD SON DE LA INFANTERÍA, no de todo el mundo.
//
// Los dos primeros números que salieron de medir esto eran una injusticia con
// la caballería: al granadero le cobraban 1,62 de flanco por segundo contra
// 0,57 al realista, o sea que el sistema castigaba a la tropa que hacía bien
// su trabajo. Y con razón, porque los dos conceptos son de LÍNEA:
//
//   · el flanco duele porque una línea de infantería NO se puede reorientar.
//     Una carga de caballería, en cambio, se mete adentro del enemigo: quedar
//     rodeado es el objetivo. Y el lancero vuelve grupas todo el tiempo, así
//     que su frente de tropa nunca alcanza a su rumbo y quedaba leyéndose como
//     flanqueado permanente;
//   · la soledad duele porque la infantería pelea hombro con hombro. Un
//     lancero necesita cancha para embalar: le estábamos cobrando la
//     dispersión que la carga exige.
//
// Los dos se cobran SÓLO A PIE. Y al que le voltearon el caballo en medio del
// desembarco se le cobran los dos de golpe, que es exactamente lo que tiene
// que sentir: ya no es caballería, es un hombre solo y rodeado.
export const FLANCO = 0.22;
export const FLANCO_RADIO = 22;
export const FLANCO_CONO = 1.0;       // ±57°: fuera de esto lo tengo al costado
export const FLANCO_LLENO = 3;        // con tres o más ya no empeora
// Y ESTE NÚMERO TUVO QUE BAJAR CON LA ESCALA. La ventaja del flanco no es
// eterna: se agota cuando la línea termina de reorientarse, y a 0,32 rad/s eso
// era media vuelta en diez segundos. Con una batalla de cuarenta y cinco
// segundos, diez segundos era un cuarto de la pelea y flanquear decidía. Con
// una de tres minutos y medio pasaba a ser el cinco por ciento: la maniobra del
// 3 de febrero quedaba convertida en un detalle de los primeros segundos.
//
// Medido, se notaba: la prueba del flanco daba 99 contra 100 de ánimo, o sea
// nada. A 0,08 la media vuelta lleva cuarenta segundos y la ventaja vuelve a
// durar la misma FRACCIÓN de la batalla que antes, que es lo que hay que
// conservar. Una línea de infantería del XIX no se reorienta rápido: para eso
// se inventó atacarla por el costado.
export const FRENTE_GIRO = 0.08;      // rad/s: media vuelta en cuarenta segundos

// CABALLERÍA ENCIMA. Infantería sin cuadro contra caballo. Es literalmente lo
// que pasó: los desembarcaron, les cayeron encima y no llegaron a formar.
export const CABALLO_ENCIMA = 0.23;
// Y SE VE VENIR DE LEJOS, que es el punto entero.
//
// Estaba en quince metros y ahí no servía para nada: una carga al galope cruza
// quince metros en segundo y medio, así que el miedo llegaba junto con la
// lanza. Cuando la tenés encima ya es tarde para tener miedo —ya estás muerto o
// ya estás corriendo—. A treinta y ocho metros la ves cerrarse durante cuatro
// segundos largos antes de que te toque, y ésos son los segundos en los que una
// línea decide si aguanta o se va. Medido, es la diferencia entre que se
// quiebren después de perder ciento treinta hombres o antes.
export const CABALLO_RADIO = 38;
export const CABALLO_LLENO = 2;

// Y NO DA LO MISMO DE DÓNDE VIENE, que es lo que junta a este término con el
// flanco en vez de dejarlos peleándose.
//
// Subir el radio a treinta y ocho metros —para que el miedo llegue antes que la
// lanza— tuvo un efecto que no había visto: el terror pasó a pesar igual desde
// cualquier ángulo, y aplastó la ventaja de flanquear. Dos términos tirando
// para lados distintos.
//
// Son una sola idea. Caballería que ves venir de frente es espantosa;
// caballería que te aparece por un costado al que no podés dar la cara es otra
// cosa. Así que el miedo al jinete se multiplica según cuántos de ellos estén
// fuera del frente de la tropa, y la pinza vuelve a ser la mejor manera de
// entrar sin que haya que decirlo aparte.
export const CABALLO_FLANCO = 2.4;

// LA SOLEDAD. Un hombre en una línea apretada aguanta; el mismo hombre solo,
// no. Es la otra cara del gentío: la formación no sirve sólo para tirar juntos.
export const SOLEDAD = 0.12;
export const JUNTOS_RADIO = 9;
export const JUNTOS_MINIMO = 3;

// ¿Y QUÉ LE DA MIEDO A LA CABALLERÍA, ENTONCES?
//
// Sacados el flanco y la soledad, al granadero montado le queda el compañero
// que cae al lado, sus propias heridas y el contagio. Se probó agregarle el
// ATASCO —quedarse frenado adentro del montón, que es cuando una carga deja de
// ser una carga y pasa a ser un blanco a la altura de la bayoneta— y se midió:
// con enemigos a menos de ocho metros, el lancero NUNCA baja de cuatro metros
// por segundo. El 58 % del tiempo va a galope tendido. Entra, pega y sale, que
// es exactamente lo que tiene que hacer, así que la constante no se disparaba
// jamás. Se sacó: un número que nunca se usa es peor que no tenerlo, porque
// miente sobre lo que la tabla hace.
//
// Lo que sí le da miedo a la caballería, y ya estaba, es DEJAR DE SERLO: al
// que le voltean el caballo pasa a ser un hombre solo y rodeado, y ahí se le
// cobran de golpe el flanco y la soledad enteros.
export const HERIDO = 0.1;              // por segundo con menos de la mitad de la vida
export const PIEZA_CALLADA = 4;      // de golpe, a los de su bando a 30 m
export const PIEZA_RADIO = 30;

// Y se recompone. Mientras no pase nada de lo de arriba y tenga gente al lado,
// el ánimo vuelve. Toda la tensión de la pelea está en esta resta: si el
// recupero le gana a lo que entra, la línea aguanta.
export const APLOMO = 0.3;
// Ojo con este número: es el que decide si la batalla termina. Si le gana a lo
// que entra, la línea no se quiebra NUNCA y la batalla se vuelve una molienda
// de media hora. Está apenas por debajo de la presión de una carga sostenida, a
// propósito: la línea aguanta mientras la caballería afloje y cede cuando no.

// Y NO SE RECOMPONE ENTERO. Cada cosa que le entra se lleva una parte del
// TECHO —hasta dónde puede volver el ánimo—, y el techo baja y no sube nunca.
//
// Sin esto la moral era una resta pura y el resultado, una moneda al aire: al
// que le tocaba buen temple y una pausa se le recomponía el ánimo entero y no
// se quebraba jamás. Medido sobre la misma batalla y los mismos números, unas
// corridas se quebraban a los cien segundos y otras terminaban en exterminio a
// los nueve minutos. No era una dificultad variada: eran dos juegos distintos.
//
// Con el techo el castigo se acumula, la línea se va gastando y el quiebre
// llega igual —más tarde si aguantan bien, pero llega—, que es la diferencia
// entre una desbandada progresiva y una lotería.
export const DESGASTE = 0.5;         // qué parte de cada golpe se lleva el techo

// EL CONTAGIO, que es lo que hace que se vea como una desbandada y no como un
// deshielo. Sin esto, doscientos cincuenta hombres cruzan su umbral cada uno
// por su cuenta y la línea se disuelve pareja, de a uno, como hielo que se
// derrite. Con esto un pedazo cede y el hueco se propaga hacia afuera hasta que
// se va todo junto. Eso es una desbandada.
// PRIMERO EL QUE TODAVÍA PELEA. Al que ya se está yendo se lo mira a lo
// último, y esto faltaba: sin la regla, los ciento veinte granaderos soltaban a
// los que les tiraban para correr atrás del más cercano, que casi siempre era
// alguno huyendo. Medido, la persecución se llevaba 145 de 250 —más de la
// mitad— cuando en San Lorenzo murieron unos cuarenta.
//
// No es piedad: es prioridad. El que corre ya no te dispara; el que se quedó,
// sí. Se paga en metros, con la misma moneda que la saturación: el quebrado se
// ve como si estuviera veintidós metros más lejos de lo que está.
export const PERSEGUIR = 22;

export const CONTAGIO = 0.42;
export const CONTAGIO_RADIO = 7.5;

// El temple de cada uno, para que no se quiebren todos en el mismo cuadro. Es
// el mismo recurso que el arrojo: multiplica lo que le entra.
export const TEMPLE = [0.72, 0.62];   // [mínimo, azar]

// LA LÍNEA ROTA. Cuando esta proporción del bando ya se quebró, lo que queda
// ve que se está yendo todo el mundo, y eso es un golpe aparte: es el momento
// en que la retirada ordenada se vuelve fuga. Sin él la desbandada se arrastra;
// con él tiene un instante.
// Y hace falta una LÍNEA para que se pueda quebrar una línea: con menos que
// esto no hay bando que se desbande, hay unos tipos peleando. Sin el mínimo,
// en una escaramuza de doce hombres bastaban dos quebrados para dispararle el
// desbande a los diez restantes.
export const LINEA_MINIMA = 30;
export const LINEA_ROTA = 0.17;
// Ochenta y ocho por ciento más chico que antes, porque antes valía la mitad de
// un ánimo entero: la línea rota se llevaba puesto a todo el que quedaba en el
// mismo cuadro y no había desbandada, había un apagón.
export const DESBANDE = 14;

// Y a dónde corre el que se quebró. No «lejos»: los realistas bajan por donde
// subieron —la barranca está en z −85 y la escuadra fondeada detrás— y los
// granaderos vuelven atrás del convento. El que llega, se fue de la batalla.
export const REFUGIO_REALISTA = -82;
export const REFUGIO_GRANADERO = 58;
