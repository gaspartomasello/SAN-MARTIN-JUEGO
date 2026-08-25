# El Clarín de San Lorenzo

FPS histórico de la **Batalla de San Lorenzo** (3 de febrero de 1813) en three.js,
para navegador. Sos José de San Martín al mando de los Granaderos a Caballo.

> **Un disparo, quince segundos, y después el acero.**

El diseño completo de la mecánica está en **[docs/GDD.md](docs/GDD.md)**: armas, humo,
cuerpo a cuerpo, moral, la estructura de los siete actos y el acto del Sargento Cabral.

---

## Estado: Fase 1 — el campo de tiro

Cada fase del proyecto existe para responder **una** pregunta. Esta responde la más
riesgosa de todas: **¿recargar es divertido?**

Lo que ya funciona:

- **Carga de chispa en siete pasos** con tres momentos de tiempo (morder, baqueta,
  amartillar). Interrumpible y **persistente**: si soltás a mitad para sacar el sable,
  el arma queda en el paso donde estaba y ahí la retomás.
- **Fallas de época**: fogonazo sin tiro (4 %), chispa fallida (3 %), emplome del ánima
  cada seis disparos, y 90 ms de retardo de percusión entre el gatillo y la bala.
- **Humo con grilla de densidad** de 2 m compartida por el render y la percepción
  enemiga: la nube que te tapa a vos también los ciega a ellos.
- **Balística de ánima lisa**: sin retícula, cono de 3° desde la cadera y 0,8° apuntando
  por el cañón, un impacto en torso es una baja.
- **Realistas** que avanzan, apuntan con aviso audible, descargan y recargan doce
  segundos y medio; si te pierden en el humo, van a donde te vieron por última vez.
- **HUD diegético**: el estado del arma se lee en el modelo —martillo y rastrillo—, los
  cartuchos se cuentan abriendo la cartuchera y la salud es una viñeta, no una barra.
- **Cámara**: sacudida por trauma, golpe de FOV, retroceso, cabeceo y respiración.
- **Sonido procedural** con Web Audio, sin un solo archivo de audio: el disparo deja
  sordera momentánea con un pasabajos que se abre de a poco.

Lo que **todavía no** está: el duelo completo (guardia, parada perfecta, riposte) es la
Fase 2, el escenario del convento la Fase 3, la multitud y la moral la Fase 4.

## Cómo probarlo

**Camino corto — un archivo, doble clic.** Empaqueta todo (three.js incluido) en un
`.html` autocontenido que abre desde el escritorio, sin servidor ni instalación:

```bash
npm install
npm run empaquetar      # genera clarin-san-lorenzo.html
```

**Camino de desarrollo — servidor estático.** No hay build: three.js está vendorizado en
`vendor/`, así que alcanza con servir la carpeta y recargar el navegador.

```bash
npm run servir          # o: npx serve .
# abrir http://localhost:8099
```

En los dos casos hay que hacer clic en **Formar** para que el navegador entregue el
mouse; `Esc` lo suelta. Anda en Chrome, Edge y Firefox de escritorio — necesita teclado
y mouse, así que en celular no se juega.

## Controles

| Tecla | Acción |
|---|---|
| `W A S D` | moverse · `Shift` correr |
| Click izq. | disparar / tajo |
| Click der. | apuntar por el cañón |
| `R` sostenida | cargar el arma |
| `Espacio` | golpe de tiempo durante la carga |
| `1` / `2` | tercerola / sable |
| `C` | revisar la cartuchera |
| `V` | vendarse · `L` limpiar el ánima |
| `G` | que vengan los realistas |
| `F3` | datos de depuración |

## Pruebas

```bash
npm run ritmo         # mide la carga con y sin acertar los tiempos
npm run rendimiento   # llamadas de dibujo y triángulos bajo carga
npm run capturas      # capturas de pantalla a capturas/
```

Requieren `npm i` y un Chromium; si no está en el `PATH` de Playwright,
pasarlo con `CHROMIUM=/ruta/al/chrome`.

**Números medidos hoy** (con seis realistas y 57 nubes de humo en pantalla):

| Medición | Valor |
|---|---|
| Carga acertando los tres tiempos | **10,3 s** |
| Carga errándolos todos | **15,7 s** |
| Llamadas de dibujo | 195 |
| Triángulos | 15.750 |

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
