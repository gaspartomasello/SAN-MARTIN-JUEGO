# Traspaso técnico · El clarín de San Lorenzo

**Fecha:** commit `7596ab1`, rama `claude/fps-san-lorenzo-mechanics-a1dtcg` (es la rama
**por defecto** del repo: no hay `main`).
**Repo:** `gaspartomasello/SAN-MARTIN-JUEGO`

> **Cómo leer este documento.** Todo lo que está acá sin marca fue verificado
> leyendo el código o corriendo las pruebas. Lo que no se pudo confirmar está
> marcado con **[NO VERIFICADO]** y explica por qué. No hay nada inventado: si
> algo no aparece, es porque no existe o porque no se pudo comprobar.
>
> **El otro documento obligatorio es `CLAUDE.md`.** Este traspaso describe el
> estado; `CLAUDE.md` tiene las reglas y las trampas medidas del proyecto, y es
> el que hay que respetar para no romper nada. Si los dos se contradicen, gana
> `CLAUDE.md`.

---

## 1 · Qué es el proyecto y cómo se ejecuta

FPS histórico en el navegador, en three.js. Se juega como José de San Martín. El
proyecto se plantea como **la campaña completa**: San Lorenzo (3 de febrero de
1813) es el capítulo 1 y está terminado como batalla jugable; el Cruce de los
Andes es el capítulo 2 y está a medio hacer.

**Todo el proyecto está en castellano rioplatense**: nombres de variables,
funciones, archivos, comentarios, textos del HUD y mensajes de commit. No es
decorativo, es una convención dura del repo. Si vas a seguir, escribí en
castellano.

### Tres maneras de ejecutarlo

| Cómo | Comando | Notas |
|---|---|---|
| **Publicado** | — | https://gaspartomasello.github.io/SAN-MARTIN-JUEGO/ — se redespliega solo en cada push a la rama por defecto |
| **Un solo archivo** | doble clic en `clarin-san-lorenzo.html` | No necesita servidor ni `npm install`. Es un archivo armado, ver §2 |
| **Desde el fuente** | `npm run servir` y abrir `http://localhost:8099/index.html` | `index.html` carga `src/main.js` como módulo, con importmap a `vendor/` |

**No hace falta `npm install` para jugar.** three.js está vendorizado en
`vendor/` y `index.html` lo resuelve por importmap. `npm install` hace falta
sólo para **empaquetar** (esbuild) y para **correr las pruebas** (playwright).

---

## 2 · Stack, dependencias y estructura

### Stack

- **three.js 0.180.0**, vendorizado en `vendor/three.module.js` + `vendor/three.core.js`.
- **JavaScript ES modules puro.** Sin framework, sin TypeScript, sin bundler en
  desarrollo, sin paso de compilación para jugar. `index.html` importa
  `src/main.js` y listo.
- **esbuild ^0.28.2** (devDependency) sólo para armar el archivo único.
- **playwright 1.49.1** (devDependency) sólo para las pruebas.
- **PeerJS** vendorizado en `vendor/peerjs.min.js` para el multijugador.
- **Audio: WebAudio sintetizado.** No hay un solo archivo de sonido en el repo;
  todo —disparos, cascos, gritos, clarín, redoble— se genera con osciladores y
  ruido en `src/audio.js`.

### Estructura

```
SAN-MARTIN-JUEGO/
├── index.html            el juego desde el fuente (HTML + TODO el CSS + el HUD)
├── clarin-san-lorenzo.html   GENERADO · el juego en un solo archivo
├── portada.jpg           la foto del menú
├── plano.webp            la lámina del plano de la batalla
├── CLAUDE.md             ← LAS REGLAS. Leer antes de tocar nada
├── README.md             para el que llega al repo
├── docs/GDD.md           el diseño del juego
├── src/                  31 archivos, PLANO A PROPÓSITO (ver abajo)
├── pruebas/              49 archivos .mjs, casi todos con playwright
├── herramientas/         empaquetar.mjs · servidor.mjs · abrir.mjs · sincronizar.mjs
├── vendor/               three.module.js · three.core.js · peerjs.min.js
├── capturas/ y tropa/    salida de las pruebas (tropa/*.png está en .gitignore)
└── .github/workflows/publicar.yml   GitHub Pages
```

**`src/` es plano y NO se deben crear carpetas.** Es una regla explícita de
`CLAUDE.md`. La división es por capítulo y por significado, no por ubicación.

### Archivos generados — no editar a mano

| Archivo | Se arma con |
|---|---|
| `clarin-san-lorenzo.html` | `npm run empaquetar` |
| `_sitio/` | el workflow de Pages |

Si tocaste `src/` o `index.html`, **rearmá**. Si el `.html` da conflicto de git,
se descarta y se rearma: no tiene información propia.

---

## 3 · Sistemas implementados y dónde está cada uno

### Núcleo — sirve para toda la campaña

| Archivo | Qué hace |
|---|---|
| `balance.js` | **Fuente única de los números de pelea**: vida, daño, puntería, volteo, moral. Nadie más inventa un número de combate |
| `combate.js` | Quién le pega a quién y qué pasa: disparos, sablazos, metralla, atropellos |
| `moral.js` | Cuándo un hombre deja de pelear y se va. Ánimo por hombre, techo que nunca sube, desglose `porQue`, caché de vecinos, cono de flanco |
| `soldados.js` | La IA del hombre: elegir blanco, avanzar, apuntar, recargar, cargar al acero, huir. El archivo más grande (1.5k líneas) |
| `figura.js` | El cuerpo y el uniforme: esqueleto, poses, `SkinnedMesh` con skinning rígido, tez, tambor, bandera, poncho |
| `caballo.js` | El animal: andares, patas, giro, salto, muerte |
| `armas.js` / `armas-modelos.js` / `arsenal.js` | Reglas de las armas · geometría del arma en primera persona · qué llevás encima |
| `sable.js` | El corvo: tajo, guardia, parada, remate |
| `jugador.js` | Vos: cámara, movimiento, posturas, vida, vendas, montar, morir. También el objeto `CAMPO` (límites del mundo) |
| `mando.js` | Teclado, mouse, pausa, y los botones de la portada |
| `hud.js` | Todo lo que se dibuja encima: avisos, placas, subtítulos, barra de recarga, brújula de daño, ojo de la guardia |
| `audio.js` | WebAudio sintetizado, con posición y mirada del oyente |
| `musica.js` | La partitura de la Marcha de San Lorenzo y la banda que la toca |
| `humo.js` | Grilla de humo. `humo.oclusion(a,b)` es lo que decide si un tirador te ve |
| `fuego.js` | Partículas, fogonazos, manchas |
| `lejania.js` | **LOD**: los hombres a más de 30 m se dibujan con posturas horneadas en `InstancedMesh` |
| `gentio.js` | Quién se dibuja entero y quién ocupa lugar; reparto y separación |
| `estorbos.js` | Colisiones: `sacarDeCaja`, rejilla espacial, separación entre hombres |
| `mundo.js` | Suelo, cielo, niebla, arboleda, pasto, cobertura **y el cambio de capítulo** |
| `pasadaArma.js` / `pasadaVelocidad.js` | Los dos pases de render (el arma con otra cámara, y el desenfoque de velocidad) |
| `main.js` | **Coordina y nada más.** Arma el escenario, ata los sistemas, corre el bucle. No lleva reglas de combate, moral, IA ni daño |

### Capítulo 1 · San Lorenzo — terminado y jugable

`sanlorenzo.js` (el convento, la barranca, el Paraná, la escuadra, y las
herramientas `Horno`/`MAT`) · `despliegue.js` (quién sale al campo y dónde) ·
`pinza.js` (la maniobra de las dos columnas) · `canon.js` (las dos piezas de la
playa) · `acto.js` (apertura, muerte de Cabral, victoria) · `plano.js` (el mapa
de la maniobra antes de salir: la lámina `plano.webp` con la orden del día
escrita encima).

### Capítulo 2 · Cruce de los Andes — el paso, jugable de punta a punta

`andes.js` lleva el desfiladero, el sigilo, la marcha de la partida y ahora la
**misión** (`class Mision`): la casucha del Rey con la patrulla de vanguardia,
el puesto realista de catorce hombres con su pieza —que arranca `dormido`— y la
fogata de señales. Dada la alarma, un realista corre a prenderla y hay **cinco
segundos** para bajarlo; si la prende, la pieza despierta. Limpiar el puesto
termina el nivel. Falta: las mulas, la moral de la altura y que el derrumbe
caiga de verdad.

**Flujo completo:** portada → plano de la maniobra → cinemática de apertura
(3 s de negro + placa + parte del granadero + orden de San Martín, y la `T`
temprana la corta) → batalla → el cierre cuando llegás al portón.

### Capítulo 2 · Cruce de los Andes — a medio hacer

Un solo archivo: **`andes.js`**. Contiene:

- **El paso**: piso de nieve y las dos paredes del desfiladero en **una sola
  malla** (heightfield con normales geométricas), el corral de pircas, doce
  peñones, la cordillera del fondo, y los `LIMITES` del mundo del capítulo.
- **El plano de la partida**: `columnaDelPaso()` dice dónde va cada granadero;
  `despliegue.js` los suelta.
- **El sigilo**: `class Sigilo` — seis centinelas quietos, conos de visión que
  barren, línea de vista contra las cajas bajas, sospecha 0→1, alarma, y el
  corral dado por tomado.

Lo demás del capítulo 2 vive en el núcleo a propósito: el **vestuario**
(`granaderoAndes` en `figura.js` + su silueta horneada en `lejania.js`) y la
**hora** (`mundo.entrarCapitulo()`).

**Falta la misión completa**: las mulas, que la partida marche de verdad detrás
tuyo, y la moral de la altura.

---

## 4 · Decisiones técnicas y convenciones

### Las seis reglas del proyecto (están en `CLAUDE.md`, acá el resumen)

1. **`balance.js` es la fuente de verdad de los números de pelea.** No se
   fragmenta. Lo que **no** va ahí: tiempos de animación, velocidades de marcha,
   distancias de aviso.
2. **No crear archivos ni carpetas por defecto.** Nada de `managers/`,
   `factories/`, `systems/`. Sin React, sin ECS, sin capas "por escalabilidad".
3. **Tarea chica → cambio chico.**
4. **Buscá antes de escribir.** Ya existe sistema de daño, moral, armas,
   partículas, sonido y spawn.
5. **Visual y gameplay separados.**
6. **El jugador no es un soldado más, y la asimetría es a propósito.** Hay una
   tabla en `CLAUDE.md` de todo lo que está torcido a tu favor. Antes de tocar
   uno de esos números, fijate de qué lado está.

### Convenciones de código

- **Castellano en todo**, incluido el mensaje de commit.
- **Comentarios densos y explicativos.** El estilo del repo es escribir *por
  qué* está así, qué se probó antes y qué se midió. No son comentarios
  decorativos: son el registro de las decisiones. Respetalo.
- **Ejes:** `−Z` es el frente (de ahí viene el enemigo, para ahí sale el fusil),
  `+Z` es la espalda. Vale igual en San Lorenzo y en los Andes, a propósito.
- **`yaw = 0` mira a −Z.** El vector de frente es `(−sin yaw, −cos yaw)`.
  Aumentar `yaw` gira a la **izquierda**.
- **Nada de `Math.random()` para el terreno ni para el reparto de figuras.** Se
  usan hashes deterministas de la semilla o de la posición, para que las dos
  máquinas de una partida de a dos vean lo mismo y las pruebas no tiemblen.
- **Ninguna geometría ni material se crea dentro del bucle de dibujo.** Hay ~130
  en `src/` y están todos en constructores.
- **Un solo raycast en todo el proyecto.** La línea de tiro de la tropa no usa
  rayos: usa la caché de vecinos. El sigilo tampoco: usa segmento contra caja.

### Cómo funciona el cambio de capítulo

**Un capítulo no se carga: se prende.** Todo el mundo se arma una vez al
arrancar; entrar a la cordillera es apagar el grupo de San Lorenzo, prender el
del paso y cambiar la luz. Un grupo invisible **no gasta una llamada de dibujo**.

- `main.entrarCapitulo(cual)` es el único que sabe en qué capítulo estamos. Le
  avisa a dos: `mundo.js` (lugar, hora, colisiones, límites) y `despliegue.js`
  (con qué ropa sale un granadero).
- **Las colisiones se vacían y se rellenan en el MISMO array** (`length = 0` +
  `push`), porque el jugador y los 370 hombres se quedaron con la referencia.
- Rearmar el mundo obligaría a diferir la construcción entera hasta que el
  jugador elige, y eso es reescribir `main.js`.

---

## 5 · Bugs conocidos, pendientes y prioridades

### Confirmado en esta sesión

| Qué | Dónde | Gravedad |
|---|---|---|
| **`npm run servir` usa `python3`** literal. En Windows sin python3 no levanta | `package.json` | Media — bloquea a quien clone en Windows |
| **Las fuentes se bajan de Google Fonts** (`fonts.googleapis.com`). El archivo único **no es del todo offline**: sin internet cae al fallback (Georgia) | `index.html` línea 9 | Baja — cosmética, pero contradice "sin internet, doble clic" |
| **`.plock.mjs` en la raíz está muerto**: es un script de prueba viejo, versionado en git, que hace clic en `#empezar` — un botón que ya no existe (la portada usa `#modo-batalla`, `#modo-red`, `#modo-campo`, `#modo-andes`) | `.plock.mjs` | Baja — basura, se puede borrar |
| **`CLAUDE.md` dice "46 pruebas"; hay 49 archivos** en `pruebas/` | `CLAUDE.md` | Baja — dato viejo |
| **`pruebas/moral.mjs` da 24 bien / 1 mal**, siempre. Es un fallo **documentado y aceptado**: a los granaderos no los puede quebrar la infantería sola, porque `CABALLO_ENCIMA` es el único término de moral que rompe una línea y los realistas no tienen caballos | `pruebas/moral.mjs` | Conocida — **el dueño del proyecto pidió expresamente NO volver sobre este tema** |

### Reportado en sesiones anteriores, **[NO VERIFICADO]** en ésta

Los anoto para que no se pierdan, pero **no los pude reproducir ni descartar hoy**:

- El servidor de sala (`npm run sala`) se caería, bloqueando el modo Cooperativo.
- Un `computeBoundingSphere(): radius is NaN` en consola.
- `pruebas/lanceros.mjs` no termina en 500 s.

**Antes de tocar cualquiera de estos tres, reproducilo primero.** Es la costumbre
del proyecto: medir antes de cambiar, y verificar que la medición no sea la que
miente.

### Pendientes, por prioridad

1. **Que la partida del paso marche detrás tuyo** en vez de esperar plantada. Es
   lo que más cambia el juego. El motor está: `pinza.js` ya sabe hacer «una
   columna que te sigue, se te descuelga y se vuelve a formar». `CLAUDE.md` ya
   anota que ese motor **se va a partir en dos**: el motor de columnas al núcleo,
   la maniobra de la pinza al capítulo 1.
2. **Las mulas.** Probablemente una variante de `caballo.js`. **Ojo con el
   presupuesto de dibujo**: cada silueta nueva multiplica los lotes horneados de
   `lejania.js` (ver §10).
3. **La moral de la altura** (frío, apunamiento, rezagados). **Toca `balance.js`**,
   así que obliga a correr `desbande` y `moral` y a re-medir la batalla entera.
4. Limpiezas anotadas: mudar `Horno`/`MAT` al núcleo (hoy arma un ciclo de
   imports), mudar `canon.js` al núcleo cuando haya cañones en la cumbre.

---

## 6 · Cambios recientes

Los cinco últimos commits son todos del capítulo 2:

| Commit | Qué |
|---|---|
| `7596ab1` | **El sigilo del paso**: guardia realista, conos de visión, alarma |
| `04b282b` | **El paso de Los Patos**: el escenario del Cruce |
| `a1fb186` | **El armazón de capítulos**: se elige el Cruce en la portada |
| `6b10177` | **El poncho del Cruce**: el vestuario del capítulo 2 |
| `fe05fa2` | El mapa por capítulos en `CLAUDE.md` |

### Archivos tocados en esos cinco commits

**Nuevos:** `src/andes.js`, `pruebas/sigilo.mjs`.

**Modificados:** `src/figura.js` (pinta `granaderoAndes`, poncho, pañuelo,
sorteo por semilla), `src/lejania.js` (silueta horneada del Cruce),
`src/soldados.js` (`vestuario`, `claveLejos`, bandera `centinela`),
`src/despliegue.js` (`vestuario` en `soltarSoldado`, `formarCordillera`, la
guardia), `src/mundo.js` (`entrarCapitulo`, las dos horas, el paso apagado),
`src/main.js` (`entrarCapitulo`, el `Sigilo`, el HUD del sigilo),
`src/mando.js` (el botón del capítulo 2), `src/jugador.js` (`CAMPO` +
`ponerCampo`), `src/caballo.js` (usa `CAMPO`), `src/sanlorenzo.js` (grupo
propio + `LIMITES`), `src/hud.js` (`hud.sigilo`), `index.html` (menú por
capítulos, `#sigilo`, tipografía que mide contra el alto), `CLAUDE.md`,
`pruebas/campo.mjs`, `pruebas/portada.mjs`, `pruebas/tropa.mjs`.

### Tres defectos de fondo que aparecieron y se arreglaron (vale conocerlos)

1. **El vestuario no llegaba a nadie.** `despliegue.soltarSoldado` armaba su
   propio paquete de opciones y se comía la palabra `vestuario`. Hay **tres
   saltos** que hacer: `soltarSoldado → Soldado → Figura`.
2. **Los límites del mundo estaban clavados a San Lorenzo** dentro de
   `jugador.js` —un archivo del núcleo con los números del capítulo 1—. En el
   paso, el jugador se frenaba en el aire a 60 m de un corral inalcanzable.
3. **El sorteo por semilla estaba mal.** Era `floor(semilla*613) % 10`; con
   semillas en fila (como las reparte una prueba) el resto casi no se movía y
   los sesenta hombres salían iguales. Ahora la semilla se revuelve con un hash
   y cada prenda tiene su sal.

---

## 7 · Cómo continuar sin romper nada

### El ciclo de trabajo del proyecto

1. **Leé `CLAUDE.md` entero.** No es opcional: tiene las trampas medidas.
2. **`npm run tablas` primero.** Cuesta 0,1 s, no necesita navegador y agarra
   las relaciones rotas. Recién si eso pasa, gastá una corrida con navegador.
3. **Medí antes de cambiar.** Y después **verificá que la medición sea válida**:
   varias veces en este proyecto el que mentía era el banco de pruebas, no el
   código.
4. **Un cambio = un commit**, con los números medidos en el mensaje.
5. **Si tocaste `src/` o `index.html`, corré `npm run empaquetar`** antes de
   commitear.

### Reglas duras

- **Tocar un número de `balance.js` obliga a correr `desbande` y `moral`.** No
  alcanza con que compile: los sistemas están acoplados por los números, no por
  el código.
- **No crear archivos en `src/`** salvo que sea el archivo de un capítulo nuevo.
- **El uniforme vive en TRES lugares** que hay que mantener juntos: `figura.js`
  (el cuerpo de la tropa), `armas-modelos.js` (el brazo que ves en primera
  persona) y `red.js` (el morrión del otro jugador). **El que más se olvida es
  el brazo.**
- **Antes de agregar un número a un archivo del núcleo, preguntate de qué
  capítulo es.**
- **Antes de crear una prueba, buscá si ya hay una del tema y ampliala.**

### Cómo agregar un capítulo nuevo

1. Un archivo `src/<capitulo>.js` que exporte `construir…(escena, colisiones)`
   devolviendo un `THREE.Group`, y sus `LIMITES`.
2. `mundo.js`: armarlo apagado y prenderlo en `entrarCapitulo`.
3. Si cambia la ropa: pinta nueva en `figura.js` + clave horneada en
   `lejania.js` + que `vestuario` viaje por los tres saltos.
4. Un botón en `index.html` y su `arrancar(modo)` en `mando.js`.
5. Su prueba, ampliando `pruebas/campo.mjs`.

---

## 8 · Estado de cada subsistema

| Sistema | Estado | Dónde |
|---|---|---|
| **Multijugador** | **Implementado, hoy en pausa.** Modelo anfitrión-autoritario: una máquina simula toda la batalla y manda un parte 20 veces/s; los demás dibujan. Anfitrión = San Martín (oeste), segundo = Bermúdez (este), del tercero en adelante son granaderos que ocupan el puesto de un bot. Dos transportes: **PeerJS** (`vendor/peerjs.min.js`, con el broker público por defecto —no hay `host` configurado—) y un **servidor de sala propio** por WebSocket sin dependencias (`herramientas/servidor.mjs`, `npm run sala`) que además sirve el juego en la LAN. El protocolo son dos formatos: binario para el mundo, JSON para los eventos. **[NO VERIFICADO] si el modo funciona hoy de punta a punta** — hay un reporte previo de que el servidor de sala se caía | `red.js`, `protocolo.js`, `herramientas/servidor.mjs` |
| **IA** | Completa para infantería y caballería: elegir blanco con saturación y terquedad, avanzar, buscar cubierta, apuntar, recargar, cargar al acero, huir, y la carga a lanza en tres tiempos. **Novedad del capítulo 2:** la bandera `centinela` —un hombre sin objetivo se queda donde está, así que la guardia no necesitó IA nueva | `soldados.js` |
| **Armas** | Tercerola (`1`), sable corvo (`2`), pistolón (`3`) y un Remington 1860 (`4`) que el propio código rotula «fuera de época» —carga de un tiempo, es el arma de fantasía—. Minijuego de recarga por tiempos. Zonas de impacto (cabeza / pecho / miembro) sólo para el jugador | `armas.js`, `arsenal.js`, `sable.js` |
| **HUD** | Completo: avisos, placas de misión, subtítulos con orador, barra de recarga, cartuchera, vida, vendas, aliento, forcejeo, **brújula de daño** (cuatro arcos SVG que apuntan al que te pegó) y el **ojo de la guardia** del sigilo | `hud.js` + todo el CSS en `index.html` |
| **Animaciones** | Esqueleto propio con skinning rígido (`skinIndex`/`skinWeight` = 1), poses interpoladas, desplome al morir, flameo de la bandera en tres huesos. **No hay animaciones importadas** ni glTF: todo es código | `figura.js`, `caballo.js` |
| **Audio** | WebAudio **sintetizado**, cero archivos. Oyente con posición y mirada, sordina, filtro de aturdimiento tras el disparo, latido y pitido internos, apagón al morir. **Música**: una sola obra, la Marcha de San Lorenzo, y suena nada más que mientras jugás como Cabral | `audio.js` · `musica.js` |
| **Misiones** | Capítulo 1: apertura cinemática, muerte de Cabral, y cierre al llegar al portón. Capítulo 2: llegar al corral sin que te vean lo da por tomado. **No hay sistema de misiones genérico**: cada capítulo tiene el suyo escrito a mano | `acto.js`, `andes.js` |
| **Guardado** | **Prácticamente no existe.** Lo único que se persiste es `localStorage['clarin.opciones']` con `{ sangre: boolean }`. No hay partida guardada, ni progreso, ni capítulos desbloqueados | `main.js` (objeto `opciones`) |

---

## 9 · Comandos

### Instalación

```bash
npm install          # sólo hace falta para empaquetar y para las pruebas
```

### Desarrollo

```bash
npm run servir       # OJO: es literalmente `python3 -m http.server 8099`
# y abrir http://localhost:8099/index.html
```

### Build

```bash
npm run empaquetar   # arma clarin-san-lorenzo.html (un solo archivo, con three adentro)
npm run jugar        # empaqueta y abre el archivo
```

El despliegue a GitHub Pages es automático: `.github/workflows/publicar.yml`
corre en cada push a `claude/fps-san-lorenzo-mechanics-a1dtcg`, hace
`npm ci --ignore-scripts` y `node herramientas/empaquetar.mjs _sitio/index.html`.

### Pruebas

```bash
npm run tablas       # 0,1 s, SIN navegador. Empezá siempre por acá
npm run balance      # lo anterior + el juego cargado
npm run desbande     # cuándo se quiebra la línea y con cuánta gente en pie
npm run moral        # que la batalla termine por quiebre y no por exterminio
npm run fuego        # si los realistas realmente disparan
npm run oido         # sonido, cámara del muerto, brújula de daño
npm run pruebas      # lista todas las pruebas y cómo correr cualquiera
```

**Las 49 pruebas de `pruebas/` menos la mitad rápida de `balance.mjs` necesitan
Chromium y el servidor levantado:**

```bash
npm run servir &                                    # en 8099
CHROMIUM=/ruta/al/chrome node pruebas/loquesea.mjs
```

Pruebas clave del capítulo 2 (nuevas o ampliadas): `sigilo.mjs` (10 bien),
`campo.mjs` (7 bien, incluye las cuatro vistas del paso y las de San Lorenzo),
`portada.mjs`, `tropa.mjs` (21 bien), `escala.mjs`, `lejania.mjs`.

### Multijugador en la LAN

```bash
npm run sala         # sirve el juego y pasa mensajes; imprime la IP a compartir
```

---

## 10 · Riesgos y partes delicadas

### 1 · Los sistemas están acoplados por los NÚMEROS, no por el código

Los imports están limpios; el balance no. Casos reales, ya medidos, que están
todos documentados en `CLAUDE.md` y que conviene leer antes de tocar nada:

- **`RECARGA` hace doble trabajo**: es el tiempo de recarga *y* la puerta de la
  carga a la bayoneta. Subirla rompe la batalla entera.
- **Sin jinetes no se quiebra ninguna línea**: `CABALLO_ENCIMA` es el único
  término de moral que rompe infantería.
- **`ANIMO_TROPA` es la escala de toda la moral** y se toca ahí, no término por
  término.
- **Lo que se reparte sobre todo el campo no tiene versión chica.**
- **La caballería se sostiene con DOS cosas** y sueltas no sirven: la reunión
  del escuadrón (`pinza.js`) y la regla de no perseguir a un caballo lanzado
  (`soldados.js`).

### 2 · El presupuesto de dibujo

Techo de **200 llamadas** (lo vigila `pruebas/escala.mjs`; hoy da entre 100 y
112 según la corrida). El riesgo concreto: **cada silueta nueva multiplica los
lotes horneados de `lejania.js`** — son 6 fases por clave de figura. Ya se
revirtieron los pelajes de caballo por esto. Un lote vacío no cuesta nada
(`visible = n > 0`), así que agregar una clave que un capítulo no usa es gratis;
agregar *variantes* de una que sí se usa, no.

### 3 · La medición es ruidosa y hay que saber qué mirar

- `simMs` bajo SwiftShader **no es confiable** (1,38 vs 1,94 en código idéntico).
- El juego corre a **2 cuadros por segundo** bajo software rendering: cualquier
  prueba que mida en tiempo de reloj mide cualquier cosa. Se simula con
  `juego.simular(dt)` a paso fijo.
- Las cuentas de `desbande` varían mucho entre corridas (quiebre entre 96 s y
  167 s con el mismo código). **Mirá el promedio de tres, no una corrida.**
- Los conteos deterministas y confiables son los de **`pruebas/campo.mjs`**
  (49 · 93 · 46 · 39 llamadas en las cuatro vistas de San Lorenzo). Si esos
  cuatro números se mueven, tocaste el escenario.

### 4 · El banco de pruebas tiene que volver el mundo a cero

Aprendido a los golpes en `sigilo.mjs`: comparaba posturas una atrás de otra y
daba que agacharse no servía. Cada alarma dejaba al centinela caminando y a los
catorce granaderos en marcha, así que **cada corrida medía la anterior**. Para
comparar A contra B hay que dejar UNA sola cosa cambiando, y eso incluye
deshacer lo que hizo la medición de antes.

### 5 · Trampas puntuales que ya mordieron

- **`vel.lengthSq()` incluye la componente vertical**, y la gravedad nunca está
  exactamente en cero. Para "está quieto" hay que usar sólo `x` y `z`.
- **`segundos || 0.9` trata el 0 como falso.** Usá `=== undefined`.
- **En CSS, el atajo `background` resetea `background-clip`**, y eso borró el
  degradado de oro del menú.
- **Los colores por vértice MULTIPLICAN la textura**: los dos extremos tienen
  que promediar cerca del blanco o el campo se apaga.
- **Ningún color multiplicado le saca el verde a un mapa verde.** Por eso el
  paso tiene su propia textura de nieve y no el suelo de San Lorenzo tintado.
- **Las normales se sacan del producto vectorial**, nunca escritas a mano: un
  signo de Z al revés iluminó la barranca entera del lado equivocado y nadie lo
  vio hasta que cambió la luz.
- **El acto de apertura corre con `performance.now()`**, no con el `dt` de la
  simulación: el `dt` está topeado a 0,05, multiplicado por la cámara lenta y
  puesto en cero en pausa.

### 6 · Dos pedidos explícitos del dueño del proyecto

Se los transcribe porque son restricciones de trabajo, no opiniones técnicas:

- **No volver sobre el defecto de moral** (que a los granaderos no los quiebre
  la infantería sola) **ni sobre la recarga bajo presión.** Están discutidos y
  cerrados.
- **Avisar antes de programar cualquier cosa.** El flujo es: proponer, esperar
  el visto bueno, y recién ahí escribir código.
