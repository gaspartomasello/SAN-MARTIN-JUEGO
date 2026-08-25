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
| 3 | Escenario: convento, barranca, río, amanecer, post-proceso | ¿Se ve como una pintura o como un demo? |
| 4 | Multitud, moral, órdenes, carga montada | ¿Se siente una batalla o un pasillo? |
| 5 | Acto 4 (Cabral) + epílogo del pino | ¿Emociona? |
| 6 | Audio, dificultades, modo Recreación, accesibilidad, pulido | ¿Está terminado? |

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
