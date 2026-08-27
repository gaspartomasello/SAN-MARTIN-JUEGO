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

1. Elegís uno de los **dos modos** de la portada.
2. **Clic en la pantalla** para que el navegador entregue el mouse.
3. **`Esc`** lo suelta y pausa la partida: aparece el cursor, nadie avanza ni te tira, y
   con un clic volvés al combate.

Anda en Chrome, Edge y Firefox de escritorio. Necesita teclado y mouse, así que en
celular no se juega.

### Los dos modos

| | |
|---|---|
| **El clarín** — *la batalla* | 3 de febrero de 1813, cinco y media de la mañana. Ciento veinte granaderos formados **detrás** del convento en dos columnas de sesenta, y doscientos cincuenta realistas subiendo de la barranca con dos cañones sin saber que estás ahí. Vas a la cabeza de una columna: los sesenta te siguen **a vos**. Cuando quieras, tocás el clarín con **`T`** y salen las dos a la vez. |
| **El campo de tiro** — *práctica* | Cuartel del Retiro, diciembre de 1812. Para aprender lo que no se parece a un shooter moderno: cargar en siete pasos, parar una bayoneta en el instante justo y andar a caballo sin que te maten. Con **`O`** empiezan a venir. |

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

Lo que **todavía no** está: **la moral**, y por lo tanto el final. Hoy la única forma de
ganar es matar a los 250 de a uno, que es justo lo contrario de lo que pasó —la línea se
quebró y salieron corriendo a los botes—. Después de eso: las órdenes de tropa, la
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
| `O` | que vengan los realistas |
| `F3` | datos de depuración |

## Pruebas

```bash
npm run ritmo         # mide la carga con y sin acertar los tiempos
npm run rendimiento   # llamadas de dibujo y triángulos bajo carga
npm run capturas      # capturas de pantalla a capturas/
```

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

## Estructura

```
index.html        portada, HUD y capas de presentación
src/main.js       bucle, balística, oleadas y cableado
src/mundo.js      escena, luz de amanecer, cielo, pasto, blancos
src/tercerola.js  modelo del arma y máquina de carga de siete pasos
src/sable.js      sable curvo (lo mínimo hasta la Fase 2)
src/humo.js       nubes instanciadas + grilla de densidad
src/enemigo.js    infante de marina realista
src/jugador.js    controlador, aliento, heridas, cámara
src/hud.js        interfaz diegética
src/audio.js      sonido sintetizado con Web Audio
docs/GDD.md       documento de diseño completo
```
