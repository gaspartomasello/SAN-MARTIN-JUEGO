# El clarín de San Lorenzo

FPS histórico en three.js. Se juega como San Martín en la batalla de San Lorenzo,
3 de febrero de 1813. **Todo en castellano rioplatense**: nombres, comentarios,
avisos del HUD, mensajes de commit.

El proyecto es la **campaña completa de San Martín**. San Lorenzo es la primera
batalla, no el juego: lo que se construye acá es el sistema que después tiene que
servir para Chacabuco, Maipú y el cruce de los Andes.

---

## Cómo se juega y cómo se arma

- **Jugar:** https://gaspartomasello.github.io/SAN-MARTIN-JUEGO/ — se redespliega
  solo en cada push.
- **Sin internet:** doble clic en `clarin-san-lorenzo.html`.
- **Armar:** `npm run empaquetar`. Un solo `.html` con three.js y todo adentro.
- three.js está vendorizado en `vendor/` con importmap: **`npm install` no hace
  falta para jugar**, sólo para empaquetar y para las pruebas.

## Archivos generados — NO editar a mano

| Archivo | Se arma con |
|---|---|
| `clarin-san-lorenzo.html` | `npm run empaquetar` |
| `_sitio/` | el workflow de Pages |

Si tocaste `src/`, rearmá. Si el `.html` tiene un conflicto de git, **se descarta
y se rearma** — no se resuelve a mano, no tiene información propia.

---

## Estructura

`src/` es plano a propósito. **No crear carpetas.** La división es por CAPÍTULO
y por lo que significa, no por dónde está el archivo.

### Núcleo — la campaña entera

Todo lo que sirve igual en San Lorenzo, en el Cruce y en Chacabuco:

`balance` · `combate` · `moral` · `soldados` · `figura` · `caballo` · `armas` ·
`armas-modelos` · `arsenal` · `sable` · `jugador` · `mando` · `hud` · `audio` ·
`humo` · `fuego` · `lejania` · `gentio` · `estorbos` · `mundo` ·
`pasadaArma` · `pasadaVelocidad` · `main`

`main.js` **coordina**: no lleva reglas de combate, moral, IA ni daño.

### Capítulo 1 · Batalla de San Lorenzo

`sanlorenzo` (el convento, la barranca, el Paraná, la escuadra) · `despliegue` ·
`pinza` · `canon` · `acto` · `plano`

### Capítulo 2 · Cruce de los Andes

Todavía no hay ningún archivo propio, y hay **armazón**: el capítulo se elige en
la portada y el juego entra. Lo que existe hoy:

- el **vestuario**, en el núcleo a propósito: la pinta `granaderoAndes` de
  `figura.js` —poncho y pañuelo, con variación por hombre— y su silueta
  horneada en `lejania.js`;
- la **hora y el lugar**, en `mundo.entrarCapitulo()`: madrugada de luna, sin
  pasto ni arboleda, con San Lorenzo apagado;
- una **partida de reconocimiento**, `campo.formarCordillera()`, provisional y
  anotada como tal en `despliegue.js`: se muda entera el día que exista
  `andes.js`.

Falta todo lo demás: el desfiladero, la nieve, las mulas, el sigilo y la moral
de la altura. El capítulo 1 no se entera de nada de esto porque lee la pinta
`granadero`, que quedó palabra por palabra igual.

**Un capítulo no se carga: se prende.** Todo se arma una vez al arrancar y
cambiar de capítulo es apagar un grupo y cambiar la luz —un grupo invisible no
gasta una llamada de dibujo—. Rearmar el mundo obligaría a diferir la
construcción entera hasta que el que juega elige, y eso es reescribir `main.js`:
el jugador y los trescientos setenta hombres tienen agarrado lo que devuelve
`construirMundo` desde el primer renglón. Por lo mismo, **las colisiones se
vacían y se rellenan en el MISMO array**.

### Aislado

`red` + `protocolo` (multiplayer, hoy en pausa). No meter dependencias de red en
gameplay.

---

### Dónde está cada cosa cuando hay que ir a buscarla

Lo que más cuesta es acertarle al archivo, y varias cosas NO están donde parece:

- **El uniforme y el cuerpo** están en `figura.js`, que es NÚCLEO y no Capítulo
  1: los Granaderos a Caballo son el mismo regimiento en Chacabuco y en Maipú.
  Y vive en TRES lugares que hay que mantener juntos —`figura.js` el cuerpo de
  la tropa, `armas-modelos.js` el brazo que ves vos en primera persona,
  `red.js` el morrión de oficial del otro jugador—. Tocar uno solo los
  desincroniza, y el que más se olvida es el brazo.
- **Los números de pelea**, todos en `balance.js`. Ningún otro archivo inventa
  uno. Lo que NO va ahí: tiempos de animación, velocidades de marcha,
  distancias de aviso.
- **El terreno de una batalla** va en su archivo de capítulo (`sanlorenzo.js`),
  pero el suelo, el cielo, la niebla y la arboleda son de `mundo.js`.
- **Las poses y el esqueleto** en `figura.js`; **la IA del hombre** en
  `soldados.js`; **lo que ve la tropa alrededor** en `moral.js`.
- **La ropa de un capítulo** es una PINTA nueva en `figura.js` y una clave
  horneada en `lejania.js`, y viaja como `vestuario` por `soltarSoldado` →
  `Soldado` → `Figura`. Los tres saltos hay que hacerlos: el primer poncho no
  se le veía a nadie porque `soltarSoldado` armaba su propio paquete de
  opciones y se comía la palabra en el camino.
- **En qué capítulo estamos** lo sabe `main.entrarCapitulo()` y NADIE más lo
  pregunta. Se lo avisa a los dos únicos que se enteran: `mundo.js` prende el
  lugar y la hora, `despliegue.js` decide con qué ropa sale un granadero. Ni
  una regla de pelea depende del capítulo, y por eso el 2 no puede ensuciar el
  1 aunque quiera: no hay dónde.

### Tres archivos de frontera, anotados antes de que muerdan

- **`canon.js`** está en Capítulo 1 porque hoy sirve las dos piezas de la playa,
  pero la pieza en sí es genérica y en el Cruce hay que subir cañones a la
  cumbre. Cuando llegue ese día, se muda al núcleo.
- **`pinza.js`** es la maniobra del 3 de febrero, pero la máquina de «una
  columna que te sigue, se te descuelga y se vuelve a formar» es exactamente lo
  que necesita el Cruce. Se va a partir en dos: el motor de columnas al núcleo,
  la pinza en Capítulo 1.
- **`despliegue.js`** es casi todo San Lorenzo, pero `soltarSoldado` lo usa todo
  el mundo.

---

## Reglas

**1 · `balance.js` es la fuente de verdad de los números de pelea.** Ningún otro
archivo inventa un número de combate. No fragmentarlo. Lo que NO va: tiempos de
animación, velocidades de marcha, distancias de aviso.

**2 · No crear archivos ni carpetas por defecto.** Antes preguntate si se
resuelve modificando uno que ya existe. Nada de `managers/`, `factories/`,
`systems/`. Sin React, sin ECS, sin capas de abstracción "por escalabilidad".

**3 · Tarea chica → cambio chico.** "Mejorar el retroceso de los enemigos" no
toca seis archivos más el README.

**4 · Buscá antes de escribir.** Ya existe un sistema de daño, de moral, de
armas, de partículas, de sonido y de spawn. No hagas otro.

**5 · Visual y gameplay separados.** Geometrías, materiales y animaciones por un
lado; daño, vida, moral y estados por el otro.

**6 · El jugador no es un soldado más, y la asimetría es a propósito.** Sos uno
contra doscientos cincuenta: si peleás con las reglas de la tropa, no hay
batalla. Lo que ya está torcido a tu favor:

| | Vos | La tropa |
|---|---|---|
| Bala | `BALA_JUGADOR` 8 — mata de una al pecho | `BALA_TROPA` 0,9 — nueve balazos |
| Zonas de impacto | cabeza, pecho y miembro | no tiene: acierta o no |
| Sable | `DANO_SABLE` 8 — el corvo mata de una | — |
| Girar a caballo | `RIENDA` ×1,85 | el giro pelado |
| Contra una pared | desliza y sigue | se le acomoda el rumbo |
| Atropellar | el caballo lanzado tira, hiere y despide | aparta y sigue, nada más |
| Sable a la carrera | pasa la guardia, y el corvo va ×0,62 | — |
| Mando | `Q` rehace tu columna y volvés a cargar | la otra se reúne sola |

**Cuando toques uno de estos números, fijate de qué lado está.** Los dos casos
peores del proyecto salieron de mover algo que sin querer valía para las dos
puntas: subir `ANDARES.giro` apelotonó las columnas de la pinza, y sacarle el
acomodamiento contra paredes dejó a la caballería trabada en el convento. Las
dos veces la línea realista dejó de quebrarse. Si el cambio es para el que
juega, va en el camino del jugador —`mando.girar`, `resolverDisparo`— y no en
la tabla compartida.

---

## Pruebas

```
npm run tablas       aritmética de balance.js, 0,1 s, sin navegador
npm run balance      lo anterior + el juego cargado
npm run desbande     cuándo se quiebra la línea y con cuánta gente en pie
npm run moral        que la batalla termine por quiebre y no por exterminio
npm run fuego        si los realistas realmente disparan
npm run pruebas      lista las 46 que hay y cómo correr cualquiera
```

Las 46 pruebas de `pruebas/` menos la mitad rápida de `balance.mjs` necesitan
Chromium: `CHROMIUM=/ruta/al/chrome node pruebas/loquesea.mjs`, con
`npm run servir` levantado en 8099.

**Empezá siempre por `npm run tablas`**: cuesta 0,1 s y agarra las relaciones
rotas (que el corvo deje de matar de una, que una bala de tropa pase a decidir).
Recién si eso pasa, gastá una corrida con navegador.

**Antes de crear una prueba, buscá si ya hay una del tema y ampliala.**

---

## Cuidado con esto

Los sistemas están acoplados **por los números, no por el código**. Los imports
están limpios; el balance no. Casos reales, ya medidos:

- **`RECARGA` hace doble trabajo.** Es el tiempo de recarga *y* la puerta de la
  carga a la bayoneta (`recarga > 0` = "estoy descargado, voy al acero").
  Subirla a 20 s hace que los realistas pasen la batalla entera descargados,
  carguen al acero sin parar y liquiden a la caballería. Medido: la línea deja
  de quebrarse.
- **Sin jinetes no se quiebra ninguna línea.** `CABALLO_ENCIMA` es el único
  término de moral que rompe infantería. Cualquier cambio que mate granaderos
  más rápido mata también el final de la batalla.
- **Lo que importa es el producto, no el factor.** Al arreglar la línea de tiro
  los tiros pasaron de 294 a 653 por batalla, y `BALA_TROPA` tuvo que bajar de
  1,5 a 0,9 sin que una bala "duela menos".
- **`ANIMO_TROPA` es la escala de toda la moral, y se toca ahí y no término por
  término.** Bajarlo acelera el desgaste entero sin mover una sola relación. Fue
  lo que destrabó la batalla: con 100, un realista tardaba 330 s en quebrarse y
  lo mataban a los 200, así que de 250 se quebraban 41 y los otros 209 morían en
  su puesto —213 muertos peleando contra 8 muertos huyendo—. Con 72 se quiebran
  164, escapan 95 y los muertos bajan de 218 a 157.
- **Antes de tocar un número, fijate si el que miente es la prueba.** Dos
  umbrales de `moral.mjs` eran de cuando la sección de moral valía treinta veces
  más y fallaban en silencio desde el reescalado. Y el del flanco además medía
  mal: pedía la diferencia en el ánimo resultante, que es medio punto contra el
  ruido de ocho hombres. Midiendo `porQue.flanco` —el desglose que el sistema ya
  guarda— da 0,000/s de frente contra 0,220/s por el costado, exacto y sin ruido.
- **A tus granaderos no los puede quebrar la infantería sola**, y por eso
  `moral.mjs` falla ahí. `CABALLO_ENCIMA` es el único término que rompe una
  línea y los realistas no tienen un solo caballo; lo que les queda —FLANCO,
  SOLEDAD, HERIDO— suma 0,44/s contra un pozo de 72. Arreglarlo es agregar un
  término de «rodeado» y volver a medir la batalla entera.
- **Lo que se reparte sobre TODO el campo no tiene versión chica.** El
  atropello del granadero se probó con daño 4, con 1, con medio segundo de
  revolcón y con uno cada seis segundos por hombre: las cuatro veces los 250
  realistas muertos sin quiebre. Ciento veinte caballos cruzando doscientos
  cincuenta hombres se tocan siempre, así que el período no modera, fija. Antes
  de bajarle el número a algo que toca a todos, preguntate si hay número.
- **La caballería se sostiene con DOS cosas, y sueltas no sirven.** La reunión
  del escuadrón (`pinza.js`) y la regla de que a un caballo lanzado no se lo
  persigue (`soldados.js`). Medido por separado: sólo la persecución da
  exterminio sin quiebre —los granaderos matan a los 254—; sólo la reunión da
  supervivencia sin pelea —110 de 120 en pie y siete realistas muertos—. Juntas
  dan quiebre a los 201 s con 92 granaderos en pie. La reunión les baja el ritmo
  de matar para que la moral llegue a tiempo; la otra los mantiene vivos.

Por eso: **tocar un número de `balance.js` obliga a correr `desbande` y `moral`**,
no alcanza con que compile.

---

## Rendimiento

No optimizar preventivamente. Dos cosas ya están medidas, así que no hace falta
volver a mirarlas:

- **La caché de vecinos de `_lineaLibre()`.** Sin ella, 370 hombres pasan de
  1,5 ms a 11,6 ms por cuadro, de un cuadro de 16.
- **Las geometrías y materiales.** Hay 130 en `src/` y **ninguno corre por
  cuadro**: están todos en constructores que se ejecutan una vez al armar. No
  agregues uno dentro del bucle de dibujo.

También hay **un solo raycast** en todo el proyecto. La línea de tiro de la
tropa no usa rayos: usa la caché de vecinos.
