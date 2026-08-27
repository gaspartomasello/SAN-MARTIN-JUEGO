# El Clarín de San Lorenzo

FPS histórico de la **Batalla de San Lorenzo** (3 de febrero de 1813) en three.js,
para navegador. Sos José de San Martín al mando de los Granaderos a Caballo.

> **Un disparo, quince segundos, y después el acero.**

El diseño completo de la mecánica está en **[docs/GDD.md](docs/GDD.md)**: armas, humo,
cuerpo a cuerpo, moral, la estructura de los siete actos y el acto del Sargento Cabral.

---

## Cómo abrir el juego

**Doble clic y listo.** El juego es **un solo archivo** `.html` autocontenido: three.js,
el código, las texturas y el sonido van todos adentro. No hace falta servidor, ni
instalar nada, ni internet.

```bash
npm install
npm run empaquetar      # genera clarin-san-lorenzo.html (~1,3 MB)
```

Después se abre con doble clic desde el escritorio. Adentro:

1. Elegís uno de los **tres modos** de la portada.
2. **Clic en la pantalla** para que el navegador entregue el mouse.
3. **`Esc`** lo suelta y pausa la partida: aparece el cursor, nadie avanza ni te tira, y
   con un clic volvés al combate.

Anda en Chrome, Edge y Firefox de escritorio. Necesita teclado y mouse, así que en
celular no se juega.

### Los tres modos

| | |
|---|---|
| **El clarín** — *la batalla* | 3 de febrero de 1813, cinco y media de la mañana. Ciento veinte granaderos formados **detrás** del convento en dos columnas de sesenta, y doscientos cincuenta realistas subiendo de la barranca con dos cañones sin saber que estás ahí. Vas a la cabeza de una columna: los sesenta te siguen **a vos**. Cuando quieras, tocás el clarín con **`T`** y salen las dos a la vez. |
| **Los dos costados** — *de a dos, red local* | La misma batalla con un amigo, cada uno en su máquina. Uno lleva la columna del oeste como San Martín y el otro la del este como el capitán **Justo Bermúdez**, que es como fue. Hace falta levantar la sala: ver más abajo. |
| **El campo de tiro** — *práctica* | Cuartel del Retiro, diciembre de 1812. Para aprender lo que no se parece a un shooter moderno: cargar en siete pasos, parar una bayoneta en el instante justo y andar a caballo sin que te maten. Con **`O`** empiezan a venir. |

---

## De a dos, en la misma red

San Martín no cargó solo. Partió los ciento veinte granaderos en dos escuadrones: llevó
uno él y el otro lo llevó el capitán **Justo Bermúdez**. Las dos columnas salieron a la
vez por los dos costados del convento y se cerraron sobre el desembarco al mismo tiempo.
Eso es la pinza, y es lo único que ganó la batalla.

Hasta ahora una columna la llevaba el jugador y la otra la máquina. Ahora la otra la
puede llevar otra persona.

**En una de las dos máquinas** —cualquiera de las dos, pero tiene que tener el proyecto
clonado y Node instalado:

```bash
npm run sala            # node herramientas/servidor.mjs
```

Imprime algo así:

```
  En esta máquina:   http://localhost:8099
  En la otra máquina, cualquiera de éstas:
                     http://192.168.0.7:8099
```

**Los dos abren esa dirección** —el que levantó la sala también, por `localhost`— y
eligen **«Los dos costados»**. El primero que entra es el anfitrión.

| | |
|---|---|
| **Anfitrión** · José de San Martín · columna del **oeste** | **Simula la batalla entera** en su máquina y es el único que **toca el clarín**. Es el que entra primero a la sala. |
| **Invitado** · capitán Justo Bermúdez · columna del **este** | Sus sesenta granaderos lo siguen a él. Sale cuando suena el clarín del otro. |

**El clarín lo toca uno solo, y a propósito.** Dos clarines son dos cargas; uno solo es
una pinza. Esa espera —estar formado detrás del convento sin poder hacer nada hasta que
el otro dé la señal— es lo que se sintió el 3 de febrero a las cinco y media.

Detalles que conviene saber:

- **No hace falta instalar nada más.** El servidor son doscientas líneas de Node sin una
  sola dependencia: sirve los archivos del juego y pasa mensajes entre los dos
  navegadores. No sabe qué es un granadero.
- **Es red local.** Las dos máquinas tienen que verse: el mismo wifi o el mismo cable.
  No hay servidores en internet ni cuentas ni nada por el estilo.
- **Cuesta un megabit por segundo.** Medido con la batalla entera —375 hombres y 121
  caballos— da **114 KB/s**. Cualquier wifi de casa mueve cincuenta veces eso.
- **Si se va el anfitrión, se termina la batalla**, porque era el que la estaba
  pensando. El invitado se entera con un cartel en vez de quedarse mirando un campo
  congelado.
- **El archivo único no sirve para esto.** El `.html` autocontenido se abre sin
  servidor, y sin servidor no hay sala. Para jugar de a dos hay que entrar por la
  dirección que imprime `npm run sala`. Si se lo intenta igual, el juego lo dice.
- **El acto Cabral es de San Martín.** Cabral no se murió por cualquiera: se murió por
  el que quedó con la pierna abajo del caballo. Al invitado le matan el caballo y se
  cae, como a todo el mundo.

---

**Camino de desarrollo — servidor estático.** No hay build: three.js está vendorizado en
`vendor/`, así que alcanza con servir la carpeta y recargar el navegador.

```bash
npm run servir          # o: npx serve .
# abrir http://localhost:8099
```

---

## Estado

Lo que **ya funciona**:

- **Carga de chispa en siete pasos** con tres momentos de tiempo, interrumpible y
  persistente, con las fallas de época: fogonazo sin tiro, chispa fallida, emplome del
  ánima y retardo de percusión.
- **Humo con grilla de densidad** compartida por el render y la percepción enemiga: la
  nube que te tapa a vos también los ciega a ellos.
- **Duelo de acero**: guardia, aviso telegrafiado, **parada perfecta** de 180 ms, remate
  y pechada, todo pagado con aliento.
- **El caballo**: cuatro andares, salto de tapias, radio de giro que se abre con la
  velocidad, filo por velocidad, y una tapia nunca lo frena del todo.
- **Caballería con lanza**: la carga en tres tiempos que se lee por la distancia, y el
  desmonte como tirada por arma —la bala 20 %, la bayoneta 34 %, el asta 58 %, la
  metralla 100 %—, con el oficio de jinete restando aparte.
- **El lugar**: convento de San Carlos, barranca, el Paraná y los buques, al amanecer.
- **Los dos cañones ligeros** con aviso de tres tiempos y metralla en abanico que no
  distingue bandos.
- **El acto Cabral**, que arranca la primera vez que te matan el caballo estando montado.
- **La lejanía**: a partir de cierta distancia el soldado deja de ser un esqueleto y pasa
  a ser una instancia horneada. Los 370 hombres de la batalla entran en 99 llamadas de
  dibujo.
- **La pinza**: las dos columnas de sesenta, la formación que se mantiene y se rompe sola
  en el choque, y el clarín que las larga.
- **El tiro que puede errar**: la bala sale de un cono y cae donde cae —64 % de acierto a
  cinco metros, 9 % a cuarenta—, se ve la polvareda donde pega y se oye zumbar la que
  pasa cerca. De rodilla se tira al doble de bien; dentro del humo, al 6 %.
- **La tropa que se cansa y se acomoda**: corren a intervalos porque el aliento es un
  recurso, no se apilan todos sobre el mismo blanco, se dan vuelta antes de apuntar y no
  le tiran en la nuca al compañero de adelante.
- **La pinza de a dos, en red local**: las dos columnas llevadas por dos personas, cada
  una en su máquina, con una sola simulación de por medio para que no haya dos batallas.

Lo que **todavía no** está: **la moral**, y por lo tanto el final. Hoy la única forma de
ganar es matar a los 250 de a uno, que es justo lo contrario de lo que pasó —la línea se
quebró y salieron corriendo a los botes—. Por eso la batalla dura hoy dos minutos y no
quince: ninguna tabla de daño convierte un exterminio en San Lorenzo. Después de eso: las órdenes de tropa, la
barranca, el epílogo del pino y los modos sueltos.

> Agacharse va en `C` y no en `Ctrl` a propósito: `Ctrl+W` es un atajo del navegador
> para cerrar la pestaña y ninguna página puede bloquearlo.

## Controles

| Tecla | Acción |
|---|---|
| `W A S D` | moverse · `Shift` correr |
| `Espacio` | saltar |
| `C` | agacharse · `Z` cuerpo a tierra |
| Click izq. | disparar · **marcar el tiempo mientras cargás** |
| Click der. | apuntar por el cañón |
| `R` | cargar el arma (una apretada; otra la pausa) |
| `F` | culatazo (tercerola) / bayonetazo (fusil) |
| `1` `2` `3` | arma larga · sable corvo · pistolón |
| `G` | tomar el fusil de un realista caído / intercambiar |
| `B` | revisar la cartuchera |
| `V` | vendarse |
| `T` | **tocar el clarín** (en la batalla; en red, sólo San Martín) |
| `O` | que vengan los realistas |
| `F3` | datos de depuración |

## Pruebas

```bash
npm run ritmo         # mide la carga con y sin acertar los tiempos
npm run rendimiento   # llamadas de dibujo y triángulos bajo carga
npm run capturas      # capturas de pantalla a capturas/
npm run red           # dos navegadores, el servidor y el cable de verdad
```

`npm run red` levanta la sala, abre **dos** navegadores, los conecta y comprueba que los
dos estén viendo *la misma* batalla: que el invitado reciba los 375 hombres sin perder a
nadie, que estén en el mismo lugar y no cerca, que un tiro suyo **mate del lado del
anfitrión** y que la columna del este lo siga a él.

Requieren `npm i` y un Chromium; si no está en el `PATH` de Playwright,
pasarlo con `CHROMIUM=/ruta/al/chrome`.

**Números medidos hoy:**

| Medición | Valor |
|---|---|
| Carga acertando los tres tiempos | **6,6 s** (pistolón: 3,1 s) |
| Carga errándolos todos | **10,5 s** |
| Altura de salto | 0,89 m (gravedad 15,24 m/s², como `sv_gravity 800`) |
| Bala de mosquete sobre el jugador | 52 de 100 · regenera tras 4,5 s |

Las 195 llamadas ya pasan el presupuesto de 120 del GDD: cada realista son trece mallas
sueltas. Es exactamente el problema que resuelve el sistema de multitud de la Fase 4.

## Los sistemas

El código está partido por **sistema**, no por tipo de archivo, y cada uno importa sólo
hacia abajo: no hay ciclos. Si hay que tocar algo, esta tabla dice dónde.

| Archivo | De qué es dueño | Se abre cuando… |
|---|---|---|
| **`src/balance.js`** | **la tabla de la pelea**: vida, daño, puntería, volteo, aliento, saturación y cuántos entran | …la batalla dura poco, te matan rápido o los bots no fallan nunca |
| `src/combate.js` | quién le pega a quién y qué pasa: tu tiro, tu sablazo, el fuego de ellos, la metralla, la tirada de la silla | …una regla de impacto está mal (no *cuánto* duele: eso es balance) |
| `src/arsenal.js` | lo que llevás encima: tercerola, pistolón, sable, el fusil que le sacás a un caído, cartuchos, qué tenés en la mano | …se cambia de arma, se toma un fusil o se toca la carga |
| `src/despliegue.js` | quién sale al campo, dónde y cuándo: la pinza, los cañones, los caballos, las oleadas | …hay que mover una formación o cambiar dónde desembarcan |
| `src/gentio.js` | quién se dibuja entero y quién ocupa lugar: reparto de la lejanía y separación de los bots | …el cuadro se cae con mucha gente, o alguien atraviesa a alguien |
| `src/mando.js` | teclado, mouse, captura del puntero, pausa, la sala de dos y los tres botones de la portada | …se rebindea una tecla |
| `src/red.js` | **el otro costado de la pinza**: quién simula, qué se replica, los títeres y el cuerpo del compañero | …algo se ve distinto en las dos máquinas |
| `src/protocolo.js` | **qué se manda por el cable**, byte por byte. Hoja del árbol: no importa nada del proyecto | …hay que agregar algo al parte del mundo |
| `src/soldados.js` | **el comportamiento** de un hombre: qué decide, cuándo corre, cuándo se da vuelta, la lanza | …un bot hace algo raro |
| `src/caballo.js` | cuatro andares, salto, radio de giro, filo por velocidad | |
| `src/jugador.js` | posturas, aliento, heridas, cámara, colisión | |
| `src/pinza.js` | la maniobra: columnas, huecos, rutas. **Geometría pura: no sabe qué es un soldado** | |
| `src/acto.js` | el acto Cabral | |
| `src/lejania.js` | el horneado de posturas y las instancias | |
| `src/estorbos.js` | radios, cajas y la rejilla de hash espacial | |
| `src/armas.js` `src/sable.js` `src/canon.js` | las armas por dentro: carga de siete pasos, guardia, mecha | |
| `src/figura.js` | la anatomía: huesos, IK, fusión de geometría | |
| `src/mundo.js` `src/sanlorenzo.js` | el escenario: convento, barranca, el Paraná, luz de amanecer | |
| `src/humo.js` `src/fuego.js` `src/audio.js` `src/hud.js` | efectos, sonido sintetizado e interfaz | |
| `src/pasadaVelocidad.js` `src/pasadaArma.js` | las dos pasadas de render | |
| **`src/main.js`** | **nada propio**: monta el escenario, ata los sistemas y corre el bucle | …hay que enchufar un sistema nuevo |

La regla que ordena todo esto: **ningún archivo inventa un número de combate**. Si una
bala hace 26, lo dice `balance.js` y nada más que `balance.js`. Para reequilibrar la
batalla se abre un archivo solo.

```
index.html        portada de tres modos, sala de dos, HUD y capas de presentación
herramientas/     el empaquetador de un solo archivo y el servidor de la sala
pruebas/          40 archivos de prueba, sobre Playwright
docs/GDD.md       el documento de diseño y el registro de por qué
```
