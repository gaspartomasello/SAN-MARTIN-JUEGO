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

`src/` es plano a propósito. **No crear carpetas.** Se divide en dos por lo que
significa, no por dónde está:

**El sistema** — vale para cualquier batalla de la campaña:
`balance` · `combate` · `moral` · `soldados` · `armas` · `arsenal` · `sable` ·
`caballo` · `figura` · `jugador` · `mando` · `hud` · `humo` · `fuego` · `audio` ·
`lejania` · `gentio` · `estorbos` · `mundo`

**San Lorenzo** — contenido de esta batalla:
`sanlorenzo` (el convento, la barranca, el Paraná) · `despliegue` · `pinza` ·
`canon` · `acto` · `plano`

**Aislado:** `red` + `protocolo` (multiplayer, hoy en pausa). No meter
dependencias de red en gameplay.

`main.js` **coordina**: no lleva reglas de combate, moral, IA ni daño.

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
