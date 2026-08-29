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

Por eso: **tocar un número de `balance.js` obliga a correr `desbande` y `moral`**,
no alcanza con que compile.

---

## Rendimiento

No optimizar preventivamente. Lo único medido y resuelto es la caché de vecinos
de `_lineaLibre()`: sin ella, 370 hombres pasan de 1,5 ms a 11,6 ms por cuadro,
de un cuadro de 16. No crear geometrías ni materiales dentro del bucle de
dibujo.
