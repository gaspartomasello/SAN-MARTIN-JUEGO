# El Clarín de San Lorenzo
### Documento de diseño — FPS histórico en three.js sobre la Batalla de San Lorenzo (3 de febrero de 1813)

> Estado: **Fase 1 en marcha**. Las cuatro decisiones abiertas están tomadas (§15) y el
> campo de tiro ya es jugable: ver [README](../README.md). El resto sigue siendo diseño.

---

## 1. Pitch

Un shooter en primera persona de 1813, donde tenés **un solo tiro** y quince segundos
para volver a cargar. Sos José de San Martín al mando del Regimiento de Granaderos a
Caballo, y la batalla dura lo que duró de verdad: quince minutos de humo, acero y
gritos sobre la barranca del Paraná.

No es Call of Duty con ropa de época. Es la sensación de Call of Duty —
inmediatez, impacto, coreografía— aplicada a un sistema de armas donde disparar es
un acontecimiento raro y el combate se resuelve, casi siempre, a sable.

**La frase que resume el juego:** *un disparo, quince segundos, y después el acero.*

| | |
|---|---|
| Género | FPS histórico de acción / duelo cuerpo a cuerpo |
| Motor | three.js + Vite (WebGL2, navegador, sin instalación) |
| Perspectiva | Primera persona a pie y montado |
| Jugadores | Un jugador, campaña de ~2 h + modos sueltos |
| Duración del acto central | ~15 minutos (los mismos de la batalla real) |
| Objetivo de rendimiento | 60 fps en notebook con gráficos integrados |

---

## 2. La historia que hay que recrear

Todo lo mecánico sale de acá. Los hechos, en orden:

| Hora aprox. | Hecho | Cómo se vuelve juego |
|---|---|---|
| 2–3 feb, noche | San Martín marcha de noche con 125 granaderos en dos escuadrones y esconde la tropa en el patio del Convento de San Carlos. | Acto de sigilo y aproximación. Tutorial de órdenes. |
| 05:00 | Observa desde el mirador del convento con catalejo. Los realistas desembarcan ~250 hombres de 11 embarcaciones, con dos cañones, bandera y tambor. | Acto de reconocimiento: catalejo, marcado de objetivos, planificación de la pinza. |
| ~06:00 | Toque de clarín. Carga en pinza: San Martín por la derecha (barranca), el capitán Justo Bermúdez por la izquierda. | Acto montado. La orden de flanqueo es del jugador. |
| Minuto 3 | El caballo de San Martín cae herido y le atrapa la pierna. Un realista se le viene encima con la bayoneta. | Estado "derribado". Punto de no retorno del acto. |
| Minuto 4 | **Juan Bautista Cabral** y Juan Bautista Baigorria acuden. Cabral libera a San Martín y recibe dos bayonetazos. Muere horas después. Es ascendido a sargento post mortem. | El momento central del juego. Ver §9. |
| Minutos 5–15 | Los realistas retroceden a los botes. Bouchard captura la bandera. Se toman los dos cañones, ~40 fusiles y 14 prisioneros. | Acto a pie: melee, cañones tomados, moral enemiga rota. |
| Después | Bajas: ~15 granaderos muertos y 27 heridos; ~40 realistas muertos. San Martín escribe el parte al pie de un pino. | Epílogo jugable sin combate. |

**Dos consecuencias de diseño que salen directo de la historia:**

1. **No se gana matando a los 250.** Se gana rompiendo su moral hasta que corren a los
   botes. El sistema de moral no es un agregado: es la condición de victoria real.
2. **San Martín peleó a caballo, con sable, no con fusil.** Un FPS de época no puede
   ser "apuntar y tirar" todo el tiempo. La campaña rota de postura —a pie, montado,
   derribado— y eso le da variedad sin inventar nada.

---

## 3. Bucle central

```
observar (el humo tapa todo)
   → posicionarse (¿tengo el tiro o me lo comen?)
      → un disparo (letal, pero te deja ciego y desarmado 15 s)
         → decidir: recargar bajo presión / sacar el sable
            → duelo cuerpo a cuerpo
               → romper la moral de esa unidad
                  → repetir con la siguiente
```

La tensión que sostiene todo: **el arma cargada es un recurso, no un estado por defecto.**
Guardarse el tiro para el momento justo es la decisión que se repite mil veces.

---

## 4. Armas

| Arma | Tiros | Recarga | Rol |
|---|---|---|---|
| Sable corvo | — | — | Principal cuerpo a cuerpo. Hoja de curva profunda, guarda en cruz, pomo en gancho: el de San Martín. |
| Tercerola (carabina de chispa) | 1 | 6,5 s | Único tiro a distancia propio del granadero. |
| Pistolón de arzón | 1 | 3,1 s | El tiro de emergencia. Inútil más allá de diez metros. |
| Fusil de chispa con bayoneta | 1 | 7,7 s | **Premio**: se le saca cargado a un realista caído con `G`. Más alcance y más daño en el cuerpo a cuerpo, más lento de cargar. |
| Cañón de a 4 (2 piezas) | metralla | escena guionada | Set piece: dar vuelta los cañones tomados contra las embarcaciones. |

**El golpe corto (`F`).** Cada arma larga pega con lo que tiene: la tercerola de
caballería **no llevaba bayoneta** —los granaderos eran jinetes—, así que da un
**culatazo** que aturde y empuja. El fusil que le sacás al enemigo da el **bayonetazo**,
con más alcance y más daño. Por eso el fusil es un premio y no un arma más: matás a uno,
le levantás el arma y ganás alcance en el acero.

Y si el arma está cargada, después del puntazo podés soltarle el tiro **a bocajarro**:
muerte instantánea, pero quedás descargado y ciego de humo un segundo entero.

**Lo que no va:** granadas. Los granaderos se llamaban así por herencia; en 1813, a
caballo, no las usaban. Meter granadas sería el atajo que arruina la identidad del juego.

### 4.1 Balística

- Ánima lisa: **sin mira**. Se apunta por el cañón (mira diegética, sin retícula por defecto).
- Cono de dispersión: ~3° desde la cadera, ~0,8° apuntando y conteniendo la respiración.
- Alcance útil 60–80 m; a 120 m es decorativo.
- Daño: **impacto en torso = muerte o baja inmediata**, en los dos sentidos. El TTK es 1.
- Retardo de percusión: 90 ms entre el gatillo y el disparo (el fogonazo de la cazoleta
  primero, después el tiro). Se siente rarísimo y es exactamente lo que corresponde.

### 4.2 La recarga (el sistema estrella)

Siete pasos reales, mapeados a tres momentos de timing. Se aprieta `R` **una vez** —no se
mantiene— y se marca el tiempo con **click izquierdo**, que mientras cargás no dispara. Un
cartel de **¡AHORA!** avisa las primeras veces y después se apaga solo. Volver a apretar
`R` pausa la carga sin perderla.

1. Sacar el cartucho de la cartuchera
2. **Morder el cartucho** ← timing
3. Cebar la cazoleta y cerrar el rastrillo
4. Verter la pólvora en el cañón
5. Introducir la bala con el papel
6. **Atacar con la baqueta** (dos golpes) ← timing
7. **Amartillar** ← timing

Reglas:

- Acertar el momento acelera el paso; errarlo cuesta +1,2 s y una animación de torpeza.
- **La recarga es interrumpible y persistente.** Si soltás a mitad para sacar el sable,
  el arma queda en el paso 4 y ahí la retomás. Nada de "recarga cancelada, empezar de cero".
- Bajo presión (enemigo a menos de 8 m, poco aliento, herido) las ventanas se achican y
  las manos tiemblan visiblemente.
- Fallas: **fogonazo sin tiro** (~4 %, más con humedad de río) → recebar, un paso rápido.
  Chispa fallida (~3 %) → volver a amartillar.
- Se puede **correr cargando**: cuesta un poco de velocidad y las ventanas de tiempo se
  achican con el traqueteo, pero nadie tiene que quedarse quieto para recargar.

> **Descartado:** el emplome del ánima —cada seis tiros, la carga un poco más lenta hasta
> limpiar con `L`—. Limpiar salía gratis y era instantáneo, así que no era una decisión
> sino un trámite, y el único aviso era un número en la esquina. Si vuelve, tiene que
> volver como probabilidad creciente de que el arma no dé fuego, y limpiar tiene que
> costar cuatro segundos de estar vendido.

Esta es la mecánica que hay que prototipar primero. Si recargar no es divertido, el
juego no existe.

**Medido en el prototipo de la Fase 1:** acertando los tres tiempos la carga completa
tarda **6,6 s**; errándolos todos, **10,5 s**. Casi cuatro segundos de diferencia entre
jugar bien y jugar mal — suficiente para que valga la pena prestar atención, y corto
como para no aburrir. La primera versión tardaba 10,3 s y se sentía eterna.

Y se arranca la partida con **todas las armas cargadas**: nadie quiere empezar recargando.

---

## 5. El humo no es un efecto: es una mecánica

Cada disparo deja una nube de pólvora negra que dura 10–15 s y deriva con el viento.

- El humo **bloquea la visión del jugador y también la de la IA**. Se implementa con una
  grilla 2D de densidad (celdas de 2 m) que consultan tanto el render como la percepción
  enemiga. Una misma verdad para los dos.
- Se acumula: después de tres descargas de línea el campo es niebla y la batalla se
  resuelve obligatoriamente a arma blanca. Eso pasó de verdad y acá pasa por sistema.
- Táctica emergente: disparar y desplazarse lateralmente, porque tu propia nube te marca.

### 4.3 Posturas

De pie, agachado (`C`) y cuerpo a tierra (`Z`). Cada una cambia velocidad, dispersión
y qué tan blanco sos. Pero la regla que importa es histórica:

> **Cuerpo a tierra no se puede recargar.** No hay forma de meter la baqueta por la boca
> del cañón acostado.

Así que tirarte te salva de una descarga cerrada y te deja sin poder cargar. Tenés que
decidir cuándo levantarte, y ese momento es el más peligroso de la partida. Las
transiciones tardan, así que cada postura es un compromiso y no un botón de esquivar.

El salto (`Espacio`) existe para pasar un parapeto: sin control en el aire, gasta aliento
e interrumpe la carga. La gravedad es la del Source —`sv_gravity 800`, o sea 15,24 m/s²—
con un impulso de 5,2 m/s: **89 cm de altura**, lo mismo que salta un jugador de
Counter-Strike.

---

## 6. Cuerpo a cuerpo (estilo Skyrim, con más intención)

Primera persona, arma a la vista, barra de **aliento** (no "stamina" en la UI).

- **Tres ataques:** tajo (rápido), revés cargado (lento, rompe guardia), estocada (alcance).
  La dirección sale del movimiento del mouse en el momento del click.
- **Guardia** (click derecho): bloquear consume aliento. Bloquear un revés cargado con
  poco aliento te desarma.
- **Parada perfecta:** ventana de 180 ms → el enemigo queda descubierto → *riposte*
  (remate animado, con 0,35 s a 0,4× de velocidad y un tirón leve de cámara). Es la
  única cámara lenta del juego junto con la muerte de Cabral. Usarla más la arruina.
- **Pechada** para romper guardias pasivas y sacar al enemigo del alcance.
- **Sable vs. fusil con bayoneta:** el sable gana en velocidad y a caballo; la bayoneta
  gana en alcance y presión frontal. Son dos estilos, no dos números.
- **Bocajarro:** si tenés el arma cargada, podés dispararla en pleno duelo. Muerte
  instantánea, pero quedás descargado y ciego de humo un segundo entero, con el resto
  de la línea encima.
- **Estado derribado:** en el piso, con una pistola de un tiro y patadas. Se enseña como
  mecánica normal en el acto 3 —para que en el acto 4 el jugador ya sepa lo que se siente.

### Máquina de estados del duelo

```
  neutral ──atacar──> compromiso ──impacto──> ventaja
     │  ▲                  │                     │
  guardia │             errar/parado             remate
     │  └────────────── recuperación <───────────┘
     └──parada perfecta──> riposte (letal)
```

Enemigos de élite (oficiales de marina con espada) usan fintas y cambios de ritmo:
son mini-jefes de duelo, no bolsas de vida.

---

## 7. A caballo

- El daño del sable **escala con la velocidad**: el choque al galope es lo que mata, no el brazo.
- Manejo con inercia: acelerar, frenar, girar con peso. Apuntar a caballo es pésimo a propósito.
- Los tramos montados son **corredores anchos**, no mundo abierto. Dirección clara, libertad táctica.
- El caballo tiene vida propia. Una descarga de línea lo voltea y pasás a pie — sin guión,
  como consecuencia. Salvo en el acto 4, donde la caída sí es la historia.

---

## 8. Mando de tropa y moral

Sos el jefe. Rueda de órdenes manteniendo `Q`:

| Orden | Efecto |
|---|---|
| ¡A la carga! | Empuje del escuadrón, +moral propia, −precisión |
| ¡Mantengan la línea! | Posición fija, fuego a discreción, mejor puntería |
| ¡Al flanco! | Dirige el segundo escuadrón: **la pinza de Bermúdez la ordenás vos** |
| ¡La bandera! | Marca el objetivo opcional (la captura de Bouchard) |

**Moral por unidad, de los dos lados.** Sube y baja con las bajas cercanas, la muerte del
oficial, el fuego de cañón, el tambor. A cero, la unidad rompe y corre a los botes.

Objetivos que bajan moral realista de forma no obvia y muy de época:
el **tambor** (sostiene la cohesión), el **abanderado**, los **artilleros**, el **oficial**.
Nadie te lo dice con un cartel; se descubre.

---

## 9. El acto Cabral

El momento que el juego tiene que ganarse. Estructura propuesta:

1. **Minuto 3, montado.** El caballo se desploma. Corte a negro de medio segundo.
2. **Primera persona en el piso**, pierna atrapada bajo el animal. Se ve el cielo, el
   humo, botas. Un realista se acerca con la bayoneta calada. El jugador forcejea
   (`A`/`D` alternado), saca la pistola, tiene **un tiro**. Falle o acierte, aparecen dos más.
3. **Cambio de personaje.** La cámara pasa a **Juan Bautista Cabral**, a treinta metros,
   corriendo. El jugador ahora es él: sable en mano, aliento en rojo, sin recarga posible.
   Objetivo: llegar hasta San Martín y sacarlo. No hay forma de sobrevivir — pero **cómo**
   llega y a cuántos se lleva puestos depende del jugador.
4. **Los dos bayonetazos** no son una animación que mira: llegan mientras el jugador
   sostiene el peso del caballo con Baigorria. El control sigue en sus manos hasta el final.
5. Vuelta a San Martín, de pie. La batalla sigue **sin pausa**. El duelo emocional se
   cobra después, en el epílogo.

**Por qué el cambio de personaje.** Si Cabral se sacrifica en una cinemática, el jugador
mira morir a un NPC. Si el jugador *es* Cabral esos cuarenta segundos, entiende con el
cuerpo lo que costó. Es la misma herramienta que usa Call of Duty en sus mejores momentos,
puesta al servicio de algo que pasó de verdad.

**Cuidado obligatorio.** Cabral fue un correntino afrodescendiente, soldado raso ascendido
a sargento post mortem. Se lo representa con nombre completo, cara, voz y decisión propia.
No es "el subalterno que se sacrifica por el héroe": es el hombre que en ese minuto tomó
la decisión más importante de la batalla. El acto está escrito desde su punto de vista.

---

## 10. Estructura de campaña

| # | Acto | Postura | Enseña / paga |
|---|---|---|---|
| 0 | **El Retiro** — cuartel, diciembre 1812 | A pie | Tutorial: cargar, tirar, sable |
| 1 | **La marcha nocturna** — llegada al convento | A pie, sigilo | Órdenes, moral, silencio |
| 2 | **La torre** — catalejo desde el mirador | Estático | Reconocimiento, planificación de la pinza |
| 3 | **El clarín** — la carga | Montado | Choque, velocidad, mando |
| 4 | **Bajo el caballo** — el momento Cabral | Derribado / Cabral | El corazón del juego |
| 5 | **La barranca** — empujar a los botes | A pie | Melee masivo, cañones, duelo con el oficial |
| 6 | **El pino** — el parte de batalla | A pie, sin combate | Cierre |

**Modos sueltos:** *Escaramuza* (oleadas sobre el campo del convento), *Duelo* (arena de
melee 1v1 y 1v3), *Recreación* (la batalla completa en tiempo real, sin marcadores, ~15 min).

**Dificultades:** Recluta / Granadero / Veterano / **Recreación histórica** (sin marcadores,
fallas de percusión reales, sin vendajes, sin recarga rápida).

---

## 11. Salud, HUD y presentación

- **Sin regeneración completa.** Tres estados: sano → herido (visión desaturada, menos
  aliento) → grave (cojera, no corrés) → muerte. Vendaje en 3 s, vulnerable, 3 por acto.
- **HUD diegético.** La munición se cuenta abriendo la cartuchera (gesto, tecla dedicada),
  no con un número. El estado del arma se lee **en el modelo**: rastrillo abierto o cerrado,
  martillo arriba o abajo. Los toques de clarín indican el objetivo. Todo con opción de
  activar indicadores clásicos por accesibilidad.
- **Apuntar** (`click derecho`): el ojo se pone por encima y por detrás del cañón, la
  culata queda detrás de la cámara y se ve el caño alejándose hacia el punto de mira de
  latón —lo único que había para apuntar en un ánima lisa—. El arma se dibuja en una
  pasada aparte y esa capa se **desenfoca salvo en el centro**: el fierro borroso, el
  objetivo nítido. Es mucho más barato que desenfocar la escena entera.
- **El fogonazo** es un chorro de pólvora ardiendo de casi un metro que ilumina el pasto,
  más una estrella que se lee desde cualquier ángulo. La bala no es trazadora —no se ve—,
  pero deja una **estela finita que se dibuja a 450 m/s**, la velocidad real: se entiende
  hacia dónde salió el tiro sin que parezca un láser.
- **Cámara:** FOV 80, que baja a 62 al apuntar; golpe de FOV al disparar; sacudida por trauma (`shake = trauma²`, ruido
  Perlin en rotación) para los cañonazos; balanceo lateral al correr; tirón direccional al
  ser herido.
- **Audio:** al reventar un cañón cerca, filtro pasabajos a 800 Hz + acúfeno durante 4 s
  (Web Audio API, `BiquadFilterNode`). Es de las cosas más baratas y más efectivas del juego.

### Los soldados

Cada soldado es una **figura con esqueleto**, no un montón de cajas apiladas
(`src/figura.js`). Once huesos: cadera, torso, cabeza, y hombro/codo por brazo y
muslo/rodilla por pierna. El frente de la figura es **−Z**, porque el soldado se orienta
con `atan2(x,z) + π`.

Dos decisiones que vale la pena no reabrir:

**Las piezas se funden.** Un granadero decente lleva unas cuarenta piezas —morrión,
chapa, cordones, carrilleras, penacho, charreteras, bocamangas, correas cruzadas,
cartuchera, morral, botas—. Cuarenta mallas por soldado se comen el presupuesto. Al
construirlo, cada pieza se cuece dentro del hueso que la mueve, con el color metido en
los vértices, y quedan **15 mallas por soldado** con dos materiales compartidos por todo
el ejército: paño y metal. Medido: 15 llamadas de dibujo y 2.364 triángulos por hombre,
menos llamadas que el modelo de cajas que reemplazó.

**Las poses se escriben con las manos, no con los ángulos.** Una pose no dice "hombro a
1,02 rad": dice *dónde va la mano derecha, hacia dónde mira el caño y a qué altura lo
agarra la izquierda*. Una cinemática inversa de dos huesos resuelve hombro y codo, y la
mano izquierda se ubica sobre el arma en el punto más lejano que el brazo alcanza. Sin
esto es imposible dejar las dos manos puestas sobre el fusil, y cada pose nueva sale de
tantear ángulos a ciegas.

Las medidas de la pose van en **espacio de cadera**, no de torso. Así el soldado puede
perfilarse para encarar —hombro izquierdo adelante— sin que el fusil se vaya con él.

Poses actuales: `marcha` (armas terciadas), `apuntar`, `recargar`, `guardia`, `cargar` y
`estocada`. Las tres últimas son el ciclo del cuerpo a cuerpo.

### El caballo (Fase 3)

`src/caballo.js`. Se construye con el mismo horno que los soldados —piezas fundidas por
hueso, color en los vértices—: un caballo entero cuesta **8 llamadas de dibujo**.

Lo que hace distinto al caballo no es que corra más: es que **no puede frenar ni doblar en
seco**. Ahí está toda la carga del acto 3.

| Andar | Velocidad | Arranca en | Radio de giro |
|---|---|---|---|
| Al paso | 1,9 m/s | 0,53 s | **0,85 m** |
| Al trote | 4,6 m/s | 1,30 s | 2,69 m |
| A galope | 10,2 m/s | 2,87 s | **16,45 m** |

Veinte veces más radio entre el paso y el galope. Y frenar desde el galope cuesta **1,93 s
y 9,9 metros**. Elegís la línea antes de entrar, no en el medio: eso es cargar.

`W` sube el andar y `S` lo baja (no se acelera reteniendo, se cambia de andar), `A`/`D`
doblan y el mouse mira libre — el jinete no mira siempre para donde va el caballo.

**El sable desde arriba corta por la velocidad, no por el brazo:** ×1 parado, ×1,9 al
trote, **×3 a galope**. Y el alcance sube de 2,4 a 3,3 m. Pero al trote o más rápido **no
se puede cargar** un arma de avancarga —la baqueta no entra— y la dispersión casi se
duplica. El caballo te da choque y alcance; te quita el fuego.

El caballo tiene vida propia (6 puntos) y **el 45 % del plomo que te apuntaba se lo come
él**. Cuando cae, te tira al suelo con 18 de daño y seguís a pie. Es la transición que
necesita el acto 4: *Bajo el caballo*.

### La caballería (Fase 3.5)

El caballo solo no alcanzaba. Faltaban tres cosas y las tres cambian cómo se
juega.

**El salto (Espacio).** Antes una tapia era un freno: el caballo chocaba, perdía
medio andar y se plantaba. Ahora una tapia es una decisión. El impulso sale de
la carrera que traés, así que el salto no se improvisa —se apunta antes de
batir, porque en el aire el caballo casi no corrige (25 % del giro normal).

| Andar | Ápice | Aire | Largo |
|---|---|---|---|
| Al trote (4,6 m/s) | 0,69 m | 0,50 s | 2,8 m |
| A galope (10,2 m/s) | 1,05 m | 0,73 s | 7,5 m |

Parado no se salta. Hacen falta 2,2 m/s de batida, igual que un caballo de
verdad.

**El choque dejó de ser un freno.** La colisión ahora mira con qué ángulo
llegaste. De frente contra una pared sigue costando la carrera —tiene que
costarla— pero de refilón el caballo *roza y sigue*: se desliza por la tangente
y no pierde ni el andar. Medido: entrando a 0,95 rad contra la misma tapia,
antes quedaba al trote a 4,6 m/s; ahora sale a galope a 10,2 m/s.

**Los lanceros.** Dos de cada tres granaderos salen montados con lanza de
2,70 m. No pelean parados: **cargan**. Y el jugador lee la carga por la
DISTANCIA, no por un reloj:

| Distancia | Qué hace | Qué significa |
|---|---|---|
| > 15 m | asta vertical, al galope | viene, pero no te eligió |
| 15 m | baja el asta en ristre | te eligió |
| 5,4 m | la echa atrás y grita | **EL AVISO** — la ventana para pararla |
| 3,6 m | el lanzazo, y sigue de largo | |

Después se abre 1,5 s, vuelve grupas **al trote** —porque al galope necesita
16 m de radio y al trote 2,7— y encara de nuevo. El lancero enseña con el
cuerpo la misma lección que el jugador tiene que aprender: al galope no se
dobla.

El asta llega **un metro antes** que la bayoneta, y ese metro es toda la
batalla. El lanzazo mata de una.

**Los realistas no montan. Nunca.** No es balance: es el hecho del que cuelga
toda la batalla. La fuerza de desembarco española eran 250 infantes con dos
cañones ligeros y ni un caballo, y por eso 120 granaderos les cayeron encima
antes de que pudieran formar el cuadro. Está cerrado por código —`montar()`
rechaza a un realista aunque le pongan un caballo suelto delante— y hay una
prueba que lo vigila, para que no se cuele nunca por una opción mal pasada.

**El desmonte.** Regla única para los dos bandos: *a caballo, un golpe fuerte
no mata — voltea*. El jinete rueda, queda 1,6 s tirado sin guardia y se levanta
a pie con lo que le quede. Al jugador lo voltea un balazo o un bayonetazo desde
abajo; a los lanceros los voltea la bayoneta, que es el único recurso que le
queda a la infantería española contra ellos. El suelo cobra 16 puntos y nunca
mata: si el porrazo pudiera matar, voltear sería lo mismo que abatir y se
perdería lo mejor —el lancero derribado que sigue peleando.

Un caballo sin dueño trota unos metros y afloja solo, un andar cada 2,2 s. Se
puede montar cualquiera que quede suelto: en el campo sobran caballos sin
jinete.

**El cadáver.** El caballo muerto se desploma para un costado (sorteado, no
siempre el mismo) y queda 45 segundos, lo mismo que el cuerpo de un hombre. El
campo se llena parejo.

### El lugar (Fase 4)

Hasta acá el campo era un polígono de tiro: una pared de cal, unos blancos y
pasto. Ahora es San Lorenzo, y el eje de la batalla ya estaba bien puesto sin
querer:

```
  +Z   convento de San Carlos, su iglesia y su huerta   ← de acá salís vos
   0   el campo abierto: acá se decide en quince minutos
 -85   la barranca: el suelo se cae nueve metros
-100   el río Paraná y la escuadra española fondeada
```

Los realistas vienen desde −Z **porque desembarcaron en la barranca**. Vos
salís desde +Z **porque los granaderos esperaron escondidos detrás del
convento**. El campo abierto del medio es el que cruzaron las dos columnas de
sesenta hombres.

**El convento** no es escenografía de fondo: es el accidente táctico de la
batalla. Detrás de esa mole se escondieron ciento veinte jinetes sin que la
infantería española los viera. Tiene su iglesia con techo a dos aguas, la tapia
de la huerta que cierra los flancos, el portón al medio y —lo que más
importa— la **espadaña**, el campanario que se ve desde todo el campo y le dice
al jugador dónde está parado.

**La barranca** se cae nueve metros en quince, con un perfil en S: arranca
suave, se desbarranca y vuelve a aplanar. Abajo está el Paraná y **seis buques
fondeados** de los que bajaron los doscientos cincuenta. El borde frena: no se
puede caminar al vacío. El suelo del campo termina justo ahí —un plano infinito
taparía la cuesta y el río— y el pasto tampoco crece sobre el agua.

### El presupuesto de dibujo, por fin cumplido

El GDD pedía 120 llamadas y el campo vacío gastaba 313. **Ahora gasta 99.**

Lo que lo arregló no fue quitar cosas: fue **fundirlas**. Todo el parque —once
hileras de sacos, cuatro carretas con sus radios, seis barriles con sus aros,
cuatro tapiales: unas doscientas mallas sueltas— es escenografía QUIETA. Nada
de eso se mueve nunca. Va fundido en una sola malla con color por vértice: **una
llamada de dibujo para todo el parque**. El convento, sesenta cajas, otra. La
escuadra, otra. La arboleda pasó a instanciada: dos llamadas para siete
árboles en vez de catorce.

La contrapartida de fundir es que las cajas de colisión ya no se pueden sacar de
los objetos: hay que escribirlas a mano. Vale la pena tres a uno.

Ahora **lo caro es la tropa, no el escenario**, que es el lugar correcto donde
estar. El siguiente paso para los 120 granaderos de verdad es el mismo truco un
escalón más arriba: un hombre a cuarenta metros no necesita quince mallas
articuladas, necesita una sola horneada.

### La polvareda y la cámara del galope

**La polvareda sale por el mismo sistema que el humo de pólvora**, así que
entra en la grilla de densidad que consultan el jugador *y* la IA para ver. Una
carga de caballería se tapa a sí misma, que es lo que pasaba en un campo seco
de febrero. Levanta **desde el trote** —al paso un caballo no hace polvo— y la
cantidad sale de la velocidad. El aterrizaje de un salto revienta su propio
golpe de tierra.

Dos decisiones que no son de comodidad:

- **La tierra es ocre y la pólvora es gris.** Se pintan con colores distintos
  (`uTierra` contra `uClaro`/`uOscuro`) porque en el campo se distinguen a
  simple vista y confundirlas sería mentir sobre qué te está tapando.
- **La tierra tapa un 62 % menos que la pólvora.** El humo de una descarga es
  mucho más espeso que el polvo de un casco. Con el mismo peso, una carga se
  cegaba a sí misma y no llegaba nunca: medido, el lancero se plantaba a 10,6 m
  del enemigo y daba vueltas. Con el peso corregido llega a 0,4 m.

El pozo de nubes es de 700 y lo comparte con la pólvora, que es una mecánica.
Por eso la polvareda es una bocanada grande cada metro y medio y no un chorro:
cinco caballos al galope sostienen ~115 nubes, no 231.

**La cámara a galope.** Cuatro cosas atadas a una sola variable —cuán rápido va
el caballo— para que el galope tenga una personalidad y no cuatro:

1. **El campo se abre**, no linealmente: `fovBase + 15·rapidez^1,6`. Casi no se
   nota al paso y se dispara a galope.
2. **Sube y baja con la ZANCADA**, no con un vaivén cualquiera: la cámara toma
   el mismo reloj que mueve las patas. Es lo que más vende que vas arriba de un
   animal y no de un vehículo.
3. **La cabeza se va atrás** con el envión, en su propio campo para que no la
   apague el retroceso del arma.
4. **El desenfoque radial**: el mundo se estira hacia afuera desde el punto al
   que vas. El centro queda nítido y los bordes se van en rayas. Es sutil a
   propósito, y **se apaga a medida que la vista se aparta de la marcha**: si
   mirás para el costado el centro del estirado se va del cuadro y todo quedaba
   lejos del centro, o sea todo borroso. Ahora sólo pega de lleno cuando mirás
   para donde vas.

Y el **túnel**, una viñeta que se cierra pasado el trote.

**Dos cosas que se probaron y se sacaron.** La cámara se inclinaba en las
curvas —un jinete se va con el caballo— pero el horizonte tumbado peleaba con
la mira y con la lectura del campo. Y había un viento en los oídos que subía
con la velocidad: sobraba, tapaba la batalla sin agregar nada. La velocidad se
cuenta con la imagen, no con el oído.

**El desenfoque de velocidad** (`pasadaVelocidad.js`). El centro del estirado
**no es el centro de la pantalla**: es la dirección de marcha del caballo
proyectada a pantalla. Arriba de un caballo el mouse mira libre, así que si vas
al galope mirando de costado las rayas convergen fuera del cuadro —que es
exactamente lo que ve un jinete—. Se apaga al apuntar, que es cuando menos
falta hace y más molesta. Cuesta una pasada de pantalla completa y **sólo se
paga cuando hay velocidad**: por debajo del umbral el mundo se dibuja derecho a
la pantalla, como siempre.

### Los dos cañones (Fase 5)

Los españoles bajaron dos piezas de campaña a la playa y alcanzaron a hacer un
solo disparo antes del choque: metralla —un tarro lleno de perdigones— que
volteó el caballo de San Martín. De ese disparo sale todo lo que viene después,
así que el cañón no podía ser un adorno.

**El aviso, en tres tiempos que se leen de lejos y sin HUD:**

| | |
|---|---|
| se orienta | la boca gira despacio y te busca (0,55 rad/s: una pieza se mueve a brazo) |
| **ceba** | la mecha humea sobre el oído — **2,1 segundos** |
| fuego | el abanico |

Con dos segundos alcanza para salirse del cono. **No para frenar el caballo.**
Encima, si estás adentro del cono mientras ceba, la pantalla late en rojo.

**El abanico** cobra por lo centrado y por lo cerca: el centro se lleva todo, el
borde la mitad, y a ochenta metros la metralla ya es lluvia sin fuerza. No
distingue bandos. Y se guarda para el que viene a caballo: a igualdad de
distancia elige al jinete, porque el jinete es el peligro.

**Se pueden callar.** Cada pieza tiene dos artilleros que no abandonan el
puesto —un artillero que sale a dar bayonetazos deja la pieza muda, y la pieza
vale más que él—. Si caen los dos, no vuelve a hablar. También se la puede
desmontar a tiros: cinco impactos y se tumba. Silenciar los cañones es un
objetivo táctico de verdad, no una tarea de lista.

Al caballo lo voltea de una: nueve de daño contra seis de vida.

### El acto Cabral (Fase 6)

La metralla voltea el caballo, que cae con la pierna aprisionada debajo. Un
soldado español se le viene encima con la bayoneta. Y entonces llega el
sargento **Juan Bautista Cabral** —correntino, afrodescendiente, hijo de
esclavos— que lo cubre, mata al que iba a matarlo, levanta el caballo para
sacarle la pierna, y recibe él las heridas de las que muere.

> *Muero contento, hemos batido al enemigo.*

**La decisión de diseño más importante del juego está acá, y es esta: el
jugador no puede hacer nada.**

Todo el resto es agencia — elegís el andar, medís la distancia, parás la
estocada. Acá no. La pierna está debajo de media tonelada de animal muerto y no
hay tecla que sirva. Hay una barra de forcejeo en el espacio: sube mientras
apretás, se topa en 0,82 y se vuelve a caer. **Nunca llega.** No es un desafío
mal calibrado: es una respuesta honesta a «¿puedo hacer algo?». No.

Era tentador darle al jugador un botón que lo salve, y habría sido una mentira.
Lo salvó otro. Un hombre al que la historia escolar recuerda por una frase y
casi nunca por su cara, su color ni su nombre completo. La única forma de que
eso se sienta es que el jugador esté genuinamente indefenso y tenga que mirar.

**No es un guion aparte: es la consecuencia de mecánicas que ya existían.** El
acto arranca la primera vez que te matan el caballo estando montado, que ya era
una cosa que pasaba. Al español no hay que guionarlo —camina hacia vos porque
sos lo más cercano que tiene enfrente y estás en el suelo—. A Cabral tampoco:
un granadero con el fusil descargado y un español a doce metros **corre a la
bayoneta**, que es la misma regla de la Fase 4.5. Los tiempos del acto salen de
cuánto tardan las piernas en llegar con las velocidades que ya tiene el juego;
si el guion se adelantara a las piernas, se vería el truco.

Lo único que se les toca: al español se le saca la capacidad de rematarte
—porque la historia dice que no llegó— y a Cabral no se lo deja morir antes de
tiempo.

Tres cosas más, todas por la misma razón —tirado en el pasto la cámara está a
62 cm y desde ahí no se ve nada—:

- **Nadie se te sube encima.** Se los mantiene a dos metros y medio, que es
  donde se los ve enteros. A un metro un hombre te tapa la pantalla con el
  calzón.
- **La cabeza se levanta sola** para mirarle el pecho al que está parado ahí.
  Sin eso sólo se le ven las botas.
- **La cabeza se va sola hacia lo que importa**, despacio, y se puede pelear
  contra eso con el mouse. Es la única concesión: si el jugador se pierde el
  momento por estar mirando el pasto, el acto no existió.

### La infantería: carrera, parapeto y rodilla

Tres cosas que valen para los dos bandos y que cambian cómo se lee el campo de
lejos. La silueta dice lo que el hombre va a hacer.

**A la carrera (4,3 m/s contra 1,85 de marcha).** Un soldado con el fusil
descargado y el enemigo a menos de 16 metros no se queda a recargar bajo
fuego: baja el arma, la toma corta y se le va encima a la bayoneta. La pose de
carrera es distinta de la de marcha —el fusil va bajo y al frente, no terciado
sobre el pecho— justamente para que se note desde lejos que eso que viene no
viene caminando.

**El bayonetazo de la carga no se avisa.** El que viene corriendo no frena, se
planta y recién entonces tira la estocada: el golpe lo pone el impulso, y con
llegar alcanza. Después sí se cruza el acero y empieza el duelo normal, con su
aviso y su ventana de parada. Pero el primer golpe de una carga no se avisa,
porque una carga no se avisa.

**El parapeto.** Nadie descarga parado en medio del campo si tiene una tapia, un
carro o un barril a mano. Los parapetos se calculan **una sola vez** al arrancar:
las cajas de colisión que llegan a la cintura (0,55 a 1,55 m) y no son paredes
enteras. El soldado elige el más conveniente por un puntaje que suma la
distancia que tiene que correr y **penaliza alejarse del enemigo** —taparse
caminando para atrás no es cubrirse, es huir— y se pone del lado que le da la
espalda al enemigo. Busca cada segundo y medio, no cada cuadro.

**La rodilla en tierra.** La derecha apoya en el suelo, la izquierda queda
adelante con el pie plano, la cadera baja de 0,92 a 0,52 m. Cumple dos
funciones y la segunda importa más que la primera:

- Afina la puntería: **un 35 % más de acierto**.
- **AVISA.** Un soldado que hinca la rodilla te está diciendo que va a
  disparar, y te lo dice desde lejos. Tarda 1,9 s en soltar el tiro en vez de
  1,5: ese medio segundo es tuyo.

Hincado el fusil sale desde 1,02 m en vez de 1,38, y la cabeza baja con él —así
que también es más difícil de acertar—. Se hinca siempre al llegar a un
parapeto y un 42 % de las veces a campo abierto. Se recarga hincado, y se pone
de pie para cruzar el acero.

### Las distancias se miden sobre el piso

Un error que estuvo mucho tiempo y explicaba bastante. La distancia entre un
soldado y su blanco se medía en tres dimensiones, pero `jugador.pos.y` está a
la altura del ojo (1,68 m) y el soldado tiene los pies en cero: la distancia 3D
nunca bajaba de 1,68. Con `ALCANCE_ACERO` en 1,90 eso dejaba el alcance real de
la bayoneta en **89 centímetros** —el enemigo tenía que meterse casi adentro
tuyo para poder usarla—, y es buena parte de por qué el cuerpo a cuerpo casi no
aparecía. Un hombre parado a dos metros está a dos metros, no a dos y medio.

### La tez de la tropa

El Regimiento de Granaderos a Caballo se nutrió de libertos y morenos. El
sargento **Juan Bautista Cabral**, hijo de esclavos, era uno de ellos. Una
tropa toda blanca sería una mentira, así que la paleta va de trigueño a
chocolate —nueve tonos— y la reparte el azar. La de Cabral no se sortea: es
siena oscuro y está escrita en el código (`PIEL_CABRAL`), lista para la Fase 6.

### Cuánta gente entra en el campo

Los números reales de San Lorenzo son 120 granaderos en dos columnas de 60 y
250 realistas de infantería con dos cañones. Medido (`pruebas/escala.mjs`):

| Campo | Hombres | Caballos | Antes | **Después de la Fase 4** |
|---|---|---|---|---|
| vacío | 0 | 1 | 313 | **99** |
| 20 lanceros | 20 | 21 | 572 | **360** |
| 40 lanceros | 40 | 41 | 899 | **594** |
| 90 lanceros + 60 a pie | 150 | 91 | 2.786 | **2.267** |

La simulación no es el problema: 150 hombres y 91 caballos cuestan 1,9 ms de
CPU por cuadro. El problema es que **cada hombre son ~11 llamadas de dibujo y
cada caballo ~9**, porque cada hueso lleva su propia malla para poder
articularse.

Los 120 de verdad entran recién con **niveles de detalle**. Eso es la Fase 7,
y está hecha: ver *La lejanía*, más abajo. Para probar a mano:
`juego.formar(20, 30)` desde la consola.

### La lejanía (Fase 7)

> **Un hombre a cuarenta metros no necesita quince mallas articuladas.**

Es la frase que venía escrita en el presupuesto desde la Fase 4, y resultó ser
literalmente el diseño. El problema medido era éste: 90 lanceros costaban 2.267
llamadas de dibujo contra un presupuesto de 120. No faltaba afinar: faltaba un
**orden de magnitud**.

Y no hacía falta inventar nada, hacía falta mirar la pantalla. Un granadero a
cuarenta metros ocupa veinte píxeles de alto. No se le ve la cara, no se le ven
los botones, del codo sólo se ve que el brazo está o no está. Lo único que se
lee a esa distancia es **la silueta, el color de la casaca, hacia dónde mira y
si se mueve**. Todo lo demás se está calculando para nadie.

Así que a partir de 30 metros el soldado deja de ser un esqueleto y pasa a ser
**una instancia**: una geometría horneada de antemano, compartida por todos los
que están en la misma postura, dibujada de una sola vez para los ciento veinte.

**Ciento veinte granaderos lejanos cuestan lo mismo que uno.**

#### Las posturas horneadas

El horno (`src/lejania.js`) cocina, al arrancar, cada familia en las posturas
que hace falta distinguir de lejos:

| Familia | Posturas |
|---|---|
| granadero / realista | de pie · paso A · paso B · caído · **rodilla en tierra** · **apuntando parado** |
| lancero | galope A · galope B · **en ristre** |
| caballo suelto | quieto · galope A · galope B · caído |

Las dos que están en negrita no son adorno, son **información de combate**. El
que hinca la rodilla te está avisando que va a disparar, y el fusil alcanza a
62 metros: si esa postura se perdiera de lejos, el aviso se perdería justo a la
distancia en la que sirve. Lo mismo el lancero en ristre. La regla del juego es
que todo golpe se avisa; la lejanía no la puede romper.

El paso se anima **alternando los dos fotogramas horneados**, que es exactamente
como caminaban los soldados de los juegos de hace treinta años, y a esa
distancia funciona igual de bien.

#### El lancero va entero

Arriba de la silla el hombre no se mueve por su cuenta, así que **caballo y
jinete se hornean juntos**: un lancero lejano es una sola instancia, no dos.

#### Lo que se paga

- La tez sorteada y el brillo del metal. A cuarenta metros la cara es un píxel;
  la casaca —que es lo que distingue un bando del otro— se conserva entera.
- Los triángulos más chicos que un píxel: ojos, botones, hebillas, bigote. El
  horno tira todo triángulo de menos de 30 cm², y un granadero pasa de 2.760 a
  **915 triángulos** sin que se le note nada que se pueda ver desde ahí.
- La sombra propia. Una sombra de tres píxeles no vale una pasada de sombras.

#### Lo que se gana además del dibujo

El que está lejos **tampoco resuelve cinemática inversa**. La IA sigue corriendo
entera —camina, busca parapeto, apunta, avisa, dispara, muere—, pero el cuerpo
no se arma. Eso es la mitad del costo de simulación de un soldado, y es la
razón por la que la simulación de 370 hombres bajó en vez de subir.

La prueba que importa (`pruebas/lejania.mjs`) no mide dibujo: suelta **dos
realistas idénticos contra el mismo blanco, uno articulado y otro horneado**, y
verifica que recorran lo mismo y disparen lo mismo. El hombre de lejos tiene
que ser *el mismo hombre*.

#### San Lorenzo entero, medido

Con los números reales de la batalla:

| Campo | Hombres | Antes | **Con lejanía** |
|---|---|---|---|
| vacío | 0 | 313 | **93** |
| 250 realistas | 250 | — | **95** |
| + columna de 60 | 310 | — | **99** |
| + columna de 60 | **370** | — | **99** |

370 hombres —los 120 granaderos a caballo en dos columnas de 60 y los 250
infantes realistas— en **99 llamadas de dibujo**, 486 mil triángulos y 1,7 ms
de simulación por cuadro. La batalla entera entra en el presupuesto.

Lo que ahora manda ya no es el dibujo sino **la simulación**, que crece con el
cuadrado de la gente porque cada hombre busca su blanco entre todos. A 370
todavía sobra muchísimo margen; el día que no sobre, la respuesta es una grilla
espacial, no menos granaderos.

#### Los topes suben de a poco

El número que aguanta la máquina y el número que hace buena la pelea **no son
el mismo**. Con la lejanía hecha, el campo pasó de 6 granaderos y 10 realistas
a **20 y 34**, y el paso de refuerzos se acortó para que ese campo llegue a
llenarse. La pinza de 120 es un modo aparte, no el ritmo de todos los días.

### La pinza (Fase 8) — «El clarín»

Es lo que ganó la batalla, y es una idea, no una carga.

Los realistas desembarcaron de noche y subieron de la barranca hacia el convento
con 250 infantes y dos piezas, convencidos de que enfrente no había nadie. San
Martín tenía 120 granaderos escondidos **detrás** del convento de San Carlos,
partidos en dos columnas de sesenta. A un toque de clarín las dos salieron cada
una por un costado y se cerraron sobre los dos flancos al mismo tiempo.

La batalla duró quince minutos.

De eso hay que poder jugar tres cosas, y ninguna es apretar un botón de atacar:

1. **La espera.** Estás formado, en silencio, sin que te vean. Todavía no pasó
   nada y ya ganaste, si nadie se mueve antes de tiempo.
2. **El toque.** Una sola señal y ciento veinte hombres arrancan juntos.
3. **El mando.** Tu columna te sigue **a vos**. No a un punto del mapa: a vos.
   Sesenta hombres van a donde vayas, y si los llevás mal, se pierden.

`juego.formarPinza()` la arma; la tecla **T** toca el clarín.

#### La formación, y por qué hacía falta un sistema nuevo

Sesenta lanceros con la IA de siempre no son una columna: son sesenta tipos a
caballo que eligieron cada uno su enemigo. Así que mientras la columna está
formada, cada hombre tiene una **plaza** —su sitio, colgado del eje de marcha
del que va adelante— y marchar le gana a atacar. La columna se rompe cuando la
rompe el que la manda, o cuando el enemigo está a menos de 26 m; ahí se les
devuelve la iniciativa y vuelve a mandar la caballería que ya sabíamos hacer.

Cuatro de frente, 2,6 m entre hombre y hombre, 3,4 m entre fila y fila. Un
escuadrón en columna es angosto a propósito: así cabe por el costado del
convento sin desbordarse a la vista.

El andar no sale de la distancia al enemigo sino de **la distancia a su propio
sitio**. El piso lo pone el que va adelante —si el jefe galopa, todos galopan,
aunque estén en su lugar— y el que se quedó atrás aprieta un escalón hasta
alcanzar. Con eso la columna se estira y se junta como se estira y se junta una
de verdad, sin coreografía.

#### Se dobla al trote

Al galope un caballo necesita dieciséis metros para girar y al trote menos de
tres. Eso ya estaba en el juego —es lo que obliga al lancero a volver grupas
despacio— y acá se cobra solo: una columna que toma las curvas a galope tendido
se estira setenta metros y llega al choque hecha una hilera de tipos sueltos.
Así que en las vueltas afloja al trote y suelta el galope recién en la recta,
que es exactamente lo que hace la caballería de verdad. Medido: veinte hombres
llegan al campo con 21 m de fondo sobre 17 nominales.

#### Dos bichos que costaron la maniobra

**El mundo terminaba en el frente del convento.** El tope de `z` era 20 y la
formación va en z=54: los ciento veinte nacían aplastados contra el portón. El
mundo tenía que llegar más atrás que el convento o la maniobra no cabía donde
ocurrió.

**Y el caballo vibraba contra la tapia.** El mismo bicho que ya habíamos
arreglado en los soldados: elegir el costado por el que rodear según hacia dónde
mira el que choca no sirve, porque cuando el golpe es de frente el producto da
cero, el costado se sortea de nuevo cada cuadro y el animal se queda temblando
contra el mismo ladrillo. Se rodea por **la punta más cercana**, que no cambia
porque uno se corra.

#### El presupuesto, ahora con garantía

El peor caso del juego no es la batalla: es **darte vuelta y mirar tu propia
columna**. Sesenta jinetes apilados en cincuenta metros, todos dentro del corte
de distancia: 1.765 llamadas de dibujo.

Un corte por distancia es una esperanza, no un presupuesto. Así que hay un techo
duro: **26 hombres articulados como mucho**, los más cercanos, y el resto pasa a
la lejanía esté a la distancia que esté. Y los más cercanos son, justamente, los
únicos a los que les vas a ver un codo. Con eso el peor caso queda en 778
llamadas y no depende de dónde mires.

| Momento | Hombres | Llamadas |
|---|---|---|
| formada, mirando la columna de frente | 374 | **778** |
| la carga, con las dos columnas en el campo | 374 | **781** |

---

### El jinete congelado en el aire

Un bicho que volvía una y otra vez, y volvía porque **la prueba que tenía que
cazarlo pasaba en falso**. Vale la pena dejarlo escrito entero.

**El síntoma.** Le matan el caballo a un lancero y el hombre queda flotando a
46 cm del suelo —la altura exacta de la silla—, con las piernas a horcajadas,
sentado sobre un caballo que ya se desplomó. Para siempre.

**La causa.** `montado` no es una bandera: es un getter.

```js
get montado () { return !!this.monta && this.monta.vivo; }
```

Cuando el caballo muere, ese getter pasa a `false` **en el mismo instante**. Y
el único código que bajaba al hombre del caballo muerto vivía adentro de
`if (this.montado) { … }`. O sea: **la limpieza estaba guardada detrás de la
condición que su propio disparador invalida.** Nunca corría.

**Por qué no lo cazaba la prueba.** Existía esta línea:

```js
ok('el jinete se baja solo', !l3.montado);
```

que comprueba el mismo getter. En cuanto el caballo moría daba `false` sin que
nadie se hubiera bajado de nada. Pasaba siempre, en verde, mientras el bicho
estaba ahí. Una prueba que interroga al mismo oráculo que causó el problema no
prueba nada.

**El arreglo**, en tres capas:

1. La bajada sale de la rama y va **primero, sin condición**:
   `if (this.monta && !this.monta.vivo) this.desmontar(true);`
2. El caballo **avisa en el acto** al morir, porque «al cuadro siguiente» no
   alcanza: los cañones resuelven la metralla *después* del bucle de soldados,
   así que ese jinete se dibujaría una vez sentado en el aire. (Al jugador no se
   le avisa —no tiene `jinete`— y es a propósito: ahí empieza el acto Cabral.)
3. Una red: un hombre a pie tiene `y = 0`. Siempre. Si no, algo se rompió.

Y de yapa, la misma trampa mordió dos veces: el primer intento del punto 2
escribía `if (this.jinete.montado === false) …` para no bajar dos veces al
mismo — con el getter ya en `false`, esa guarda se salteaba a sí misma siempre.

### Caza de fantasmas (`pruebas/fantasmas.mjs`)

Lo que quedó, y es más importante que el arreglo. En vez de buscar el bicho
adivinando, se escriben las reglas que **nunca** se pueden romper y se hace
correr la batalla entera hasta que alguien las rompa:

1. si va montado, está sentado exactamente encima de su caballo;
2. si va montado, su caballo está vivo y lo reconoce como jinete;
3. si no va montado, sus pies están en el piso — nadie flota;
4. un caballo con jinete anotado es el caballo de ese jinete;
5. nadie se dibuja por los dos lados ni por ninguno (malla contra lejanía);
6. ningún caballo queda simulado sin malla, ni montado fuera de la lista.

Lo que hace útil al detector no es la lista: es que **mide cuántos cuadros
seguidos** queda rota cada regla. Un cuadro suelto es el orden del bucle y se
resuelve solo; **659 cuadros seguidos es el bicho del que se quejó el jugador**.
Esos son los dos números que salieron de esta caza, antes y después.

Cuatro escenarios —escaramuza, metralla, partida con el jugador montando y
desmontando, y la pinza entera—, cada uno **dos veces**: todo cerca (malla
articulada) y todo lejos (instancia horneada), porque el bicho puede estar en
cualquiera de los dos caminos.

### El bucle es una función

Y para que todo eso sirva, hizo falta partir `cuadro()` en dos: `simular(dt)` y
el dibujo. Antes las pruebas **reconstruían el bucle a mano** —con render por
software el navegador da dos o tres cuadros por segundo, no había otra— y una
reconstrucción se desactualiza: terminás probando un juego que no existe. Los
bichos de jinetes congelados vivían justo en esa diferencia. Ahora la caza corre
**el** bucle, no uno parecido.

---

### La lección más cara hasta ahora: si no se ve, no existe

La pinza y el clarín estuvieron terminados y probados durante días, con
veintiuna pruebas en verde, y **el jugador no los vio nunca**. Porque para
armarlos había que escribir esto en la consola del navegador:

```js
juego.formarPinza()
```

Una función que hay que invocar desde la consola no es una función del juego:
es una nota del programador para sí mismo. Mientras tanto la portada seguía
diciendo *«Fases 1 a 3 · El campo de tiro»* y tenía un solo botón, así que el
que abría el archivo caía en el modo de práctica y no había manera de enterarse
de que existía otra cosa. El juego entero estaba ahí adentro, invisible.

Es un error de una clase distinta a un bicho: las pruebas no lo pueden agarrar,
porque las pruebas también llaman a la función directamente. Ninguna de las
ciento sesenta y cinco abría el juego como lo abre una persona.

**El arreglo.** La portada pasa a ser lo que tenía que haber sido: el nombre del
juego y dos modos, cada uno con lo que es.

| | |
|---|---|
| **El clarín** — *la batalla* | Formado detrás del convento, 120 contra 250. <kbd>T</kbd> toca el clarín. |
| **El campo de tiro** — *práctica* | El Retiro, para aprender a cargar, a parar y a andar a caballo. |

Y la puesta en escena de la batalla: **arrancás mirándolos**. El caballo apunta
al campo pero la cabeza va vuelta sobre el hombro, como la vuelve cualquiera
antes de dar una orden. La primera imagen del juego son sesenta hombres
esperando que hagas algo. Mirando al frente quedaban a tu espalda y no te
enterabas de que estaban — que es exactamente lo que pasó.

Queda una prueba nueva, `pruebas/portada.mjs`, que hace lo único que faltaba
hacer: abre el archivo, aprieta el botón de la batalla y aprieta <kbd>T</kbd>.
Sin tocar la consola.

---

### El duelo (Fase 2)

Dos formas de ganar un intercambio, y ninguna es apretar el botón de tajo.

**La paciente.** El realista en guardia **para el sablazo**: entrarle de frente sólo hace
sonar el acero. Hay que esperar el aviso. Alzar la guardia (click derecho con el sable en
mano) dentro de los **180 ms** del golpe es una **parada perfecta**: no te toca, no te
cuesta aliento, y lo deja aturdido 1,35 s. Se abre entonces la ventana del **remate** —
0,95 s— y ese tajo pasa por encima de cualquier guardia.

**La agresiva.** La **pechada** (`F` con el sable) no hiere: le rompe la guardia, lo empuja
setenta centímetros y lo deja abierto. Cuesta 18 de aliento.

Cubrirse tarde también sirve, pero se paga: **26 de aliento** y el envión igual te saca un
18 % del daño. Y aguantar el sable en alto drena **11 de aliento por segundo**, así que no
se puede jugar el duelo entero con el botón derecho apretado — sin aliento la guardia se
cae sola. Ése es el freno que impide que el sistema degenere en turtling.

| Número | Valor | Por qué |
|---|---|---|
| Ventana de parada | **180 ms** | Lo que separa "leí el golpe" de "aposté". Es el número que no se toca sin volver a probarlo. |
| Aviso del enemigo | 550 ms | Tiene que ser más largo que la ventana: si no, parar es reflejo y no lectura. |
| Ventana de remate | 950 ms | Suficiente para reaccionar, corta para que no sea gratis. |
| Aturdimiento | 1,35 s | Lo que tarda en volver a cubrirse. |

### La telegrafía del acero

El realista no clava la bayoneta de la nada. El ciclo es **guardia → aviso → estocada →
vuelta a la guardia**, y el aviso dura **0,55 s** en los que la figura echa el cuerpo
atrás, sube la bayoneta bien afuera del eje y grita. Es visible de frente, que es el único
ángulo desde el que el jugador lo mira.

`Soldado.avisando` es `true` exactamente durante esa ventana: es el enganche del que va a
colgar la parada perfecta de la Fase 2. Sin telegrafía, parar es lotería y el duelo entero
no sirve.

---

### Dirección de arte

Amanecer del 3 de febrero: sol rasante desde el este sobre el Paraná, niebla de río,
sombras largas, pasto amarillo de verano, cal blanca del convento. Azul granadero, vivos
rojos, bronce del morrión.

Estilo: **óleo histórico en 3D**, no fotorrealismo. Grano, contornos suaves, gradación de
color de pintura de batalla (LUT + grano + viñeta leve en un solo pase de post-proceso).
Da identidad y salva rendimiento al mismo tiempo.

---

## 12. Técnica (three.js)

- **Stack:** three.js + Vite + TypeScript. Sin motor pesado encima.
- **Física:** controlador de cápsula propio con raycast (determinista y barato). Rapier
  (WASM) sólo si queremos ragdolls y caballo con peso real.
- **Balas:** hitscan. Un raycast con cono de dispersión; la metralla son 8 raycasts.
- **Multitud:** los soldados lejanos son instancias con animación por textura de vértices
  (VAT); los cercanos (≤ 20) son skinned reales con LOD. Así entran 250 hombres en pantalla.
- **Humo:** 400–800 partículas instanciadas con *soft particles* (fade por profundidad),
  más la grilla 2D de densidad 64×64 compartida con la IA.
- **Presupuesto:** ≤ 120 draw calls, ≤ 1,5 M triángulos, una direccional con 2 cascadas de
  sombra, AO horneado (nada de SSAO), post-proceso en un solo pase.
  **Hoy no se cumple:** 304 llamadas con el campo vacío y 394 con seis soldados. Lo caro
  es el escenario, no la tropa. Se arregla en la Fase 4 con instancias y LOD, no antes.
- **Animación:** GLTF con esqueleto. La animación de recarga es la más importante del
  juego — hay que hacerla a mano, no sale de una biblioteca genérica.
- **Guardado:** `localStorage`. Un jugador, sin red.

### Estructura propuesta

```
src/
  core/        loop, tiempo, input, estados de juego
  render/      escena, luces, post-proceso, LODs
  player/      controlador, cámara, aliento, heridas
  weapons/     máquina de recarga, balística, humo
  melee/       máquina de estados del duelo, guardia, riposte
  ai/          percepción (con grilla de humo), formaciones, moral
  crowd/       instancias, VAT, LOD
  mount/       caballo
  audio/       Web Audio, mezcla, ducking
  levels/      actos 0–6
  ui/          HUD diegético, menús, accesibilidad
assets/        modelos, texturas, sonidos
```

---

## 13. Riesgos conocidos

| Riesgo | Mitigación |
|---|---|
| Recargar 15 s se vuelve tedioso | Tres armas cargadas encima + melee siempre disponible + recarga persistente |
| El caballo en primera persona marea | Opción de tercera persona sólo montado; reductor de balanceo |
| 250 soldados no entran a 60 fps | VAT + instancias + LOD agresivo; sólo 20 skinned reales |
| El acto Cabral cae en el golpe bajo | Se juega desde su lado, con nombre y voz propios; sin cámara lenta de más |
| Alcance total del proyecto | Vertical slice antes que campaña. Ver abajo. |

---

## 14. Plan de construcción

Cada fase existe para responder **una** pregunta. Si la respuesta es "no", se rediseña ahí
y no cuatro meses después.

| Fase | Qué se construye | Pregunta que responde |
|---|---|---|
| 1 | Campo de tiro: controlador FPS, recarga de 7 pasos con 3 timings, un arma, un enemigo, humo | **¿Recargar es divertido?** |
| 2 | Duelo: sable vs. bayoneta, guardia, parada perfecta, riposte, 3 enemigos | ¿El melee aguanta 20 minutos? |

La figura con esqueleto y la telegrafía del aviso (§12) son la parte de la Fase 2 que ya
está hecha: sin brazos articulados no hay golpe que leer, y sin golpe que leer no hay
parada. Falta la mitad del jugador — guardia, parada perfecta, riposte y pechada.
| 3 | **El caballo**: andares, radio de giro, filo por velocidad, monta y caída | ¿El choque se siente? |
| 4 | Escenario: convento, barranca, río, amanecer, post-proceso | ¿Se ve como una pintura o como un demo? |
| 5 | Multitud, moral, órdenes | ¿Se siente una batalla o un pasillo? |
| 6 | Acto 4 (Cabral) + epílogo del pino | ¿Emociona? |
| 7 | Audio, dificultades, modo Recreación, accesibilidad, pulido | ¿Está terminado? |

---

## 15. Decisiones tomadas

Las cuatro se resolvieron antes de escribir código. Quedan acá anotadas para que nadie
las reabra sin motivo:

| Decisión | Resuelto |
|---|---|
| Cámara montada | **Primera persona**, con manos y riendas. Tercera persona sólo como opción de accesibilidad. |
| Acto Cabral | **El jugador toma el control de Cabral** durante los cuarenta segundos. Es la diferencia entre ver y entender. |
| Tono | **Simulación accesible**: sistemas fieles, fricción quitada de la interfaz, nunca de las armas. |
| Primer entregable | **Vertical slice de los actos 3–4**. Un acto que se siente bien vale más que siete tibios. |

El orden de construcción arranca por la recarga (Fase 1 del plan de §14), que es donde
está el riesgo real del proyecto.
