# El Clarín de San Lorenzo

**La campaña de San Martín, jugada desde adentro.** Un FPS histórico en three.js, para
navegador, donde sos José de San Martín y la cámara está a la altura de sus ojos.

**San Lorenzo es el principio de todo.** El 3 de febrero de 1813, a orillas del Paraná,
es su primer combate en suelo americano —todavía no es nadie, todavía no hay Ejército de
los Andes— y es también donde se construye **el sistema**: cómo se carga un arma de
chispa, cómo se pelea a sable, cómo se lleva un caballo, y sobre todo **cuándo un
hombre deja de pelear y se va**. Todo eso es lo que después tiene que servir para
Chacabuco, para Maipú y para el cruce. Por eso los quince minutos de San Lorenzo se
miden tanto: lo que quede mal acá se arrastra a toda la campaña.

> **Un disparo, quince segundos, y después el acero.**

El diseño completo está en **[docs/GDD.md](docs/GDD.md)**.

---

## Cómo jugar

### https://gaspartomasello.github.io/SAN-MARTIN-JUEGO/

Ese link **es** el juego. Se abre en el navegador y listo: nada que bajar, nada que
instalar, nada que clonar. Y no se queda viejo — cada vez que se toca el código, GitHub
lo vuelve a armar solo y el link pasa a servir la versión nueva. Es siempre el mismo link.

Anda en Chrome, Edge y Firefox de escritorio. Necesita teclado y mouse: en celular no.

### Sin internet

El juego es **un solo archivo** `.html` de un megabyte y pico con todo adentro —three.js,
el código, las texturas, el sonido—, y viaja armado en el repo como
`clarin-san-lorenzo.html`. Doble clic y anda: no necesita servidor, ni `npm install`, ni
conexión.

Si tenés el repo clonado, **doble clic en `JUGAR.bat`** (o `jugar.sh` en macOS y Linux)
trae lo último y lo abre; sin internet lo abre igual con lo que tengas.

Adentro:

1. Elegís uno de los **tres modos** de la portada.
2. **Clic en la pantalla** para que el navegador entregue el mouse.
3. **`Esc`** lo suelta y pausa: aparece el cursor, nadie avanza ni te tira, y con un clic
   volvés al combate.

Anda en Chrome, Edge y Firefox de escritorio. Necesita teclado y mouse: en celular no.

### Los tres modos

| | |
|---|---|
| **El clarín** — *la batalla* | Arranca con **el plano de la maniobra**, como el de los libros. Después, cinco y media de la mañana: ciento veinte granaderos formados **detrás** del convento en dos columnas de sesenta, y doscientos cincuenta realistas subiendo de la barranca con dos cañones sin saber que estás ahí. Vas a la cabeza de una columna: los sesenta te siguen **a vos**. Cuando quieras, tocás el clarín con **`T`** y salen las dos a la vez. |
| **El campo de tiro** — *práctica* | Cuartel del Retiro, diciembre de 1812. Para aprender lo que no se parece a un shooter moderno: cargar en cuatro tiempos, parar una bayoneta en el instante justo y andar a caballo sin que te maten. Con **`O`** empiezan a venir. |
| **Los dos costados** — *de a dos, red local* | La misma batalla con un amigo, cada uno en su máquina. Necesita levantar una sala: ver **[De a dos](#de-a-dos-en-la-misma-red)**, más abajo. |

---

## Trabajar en varias máquinas

El proyecto se toca desde varias computadoras y la única fuente de verdad es el repo.

**Doble clic en `SINCRONIZAR.bat`** (o `sincronizar.sh`). Hace las cuatro cosas en orden:
guarda lo que tocaste acá, trae lo de las otras máquinas, rearma el juego y sube todo.
Te pregunta una sola cosa —qué hiciste— y con Enter le pone una descripción por defecto.

Lo único que necesita es **Node** y que git tenga permiso de subir. Para *jugar* no hace
falta ni Node.

### Por qué hay una herramienta para esto y no seis comandos de git

`clarin-san-lorenzo.html` es el juego armado y viaja en el repo a propósito: si no
viajara, la máquina que no tiene esbuild instalado se quedaría con el código fuente y sin
manera de jugar. Pero es un archivo **generado** de un megabyte, así que dos máquinas que
tocaron cualquier cosa de `src/` lo van a tener distinto siempre, y git no lo puede
fusionar —no hay líneas que combinar, hay un bundle—.

La salida no es pelearse con ese choque: es no leerlo. Ese archivo no tiene información
propia, sale entero de `src/` e `index.html`, así que cuando choca **se tira y se rearma
desde el código ya fusionado**. Es la única resolución correcta posible, y por eso se
puede automatizar sin riesgo. De eso se ocupa `herramientas/sincronizar.mjs`.

Si chocan archivos de verdad —dos máquinas que tocaron el mismo código— la herramienta se
para, te dice cuáles y no inventa nada.

---

## Cómo está armado

La separación que importa, y que es la razón de ser del proyecto: **lo que es sistema
tiene que servir para toda la campaña; lo que es San Lorenzo es contenido de esta
batalla.**

### El sistema — vale para cualquier batalla

| | |
|---|---|
| `balance.js` | **Todos** los números de la pelea: vida, daño, puntería, volteo, moral. Ningún otro archivo inventa un número de combate. Para reequilibrar se abre éste y ninguno más. |
| `combate.js` | Quién le pega a quién y qué pasa. La mecánica; los números están en `balance.js`. |
| `moral.js` | Cuándo un bando deja de pelear y se va. Lo único que le puede dar un final a una batalla que no sea el exterminio. |
| `soldados.js` | El hombre: qué decide, cuándo se da vuelta, cuánto aguanta. |
| `armas.js` · `arsenal.js` | Las armas de chispa y la carga en cuatro tiempos. |
| `sable.js` · `caballo.js` | El duelo de acero y los cuatro andares. |
| `figura.js` · `lejania.js` | El cuerpo humano por huesos y el truco para dibujar 370 a la vez. |
| `humo.js` · `fuego.js` · `audio.js` · `hud.js` | Humo con densidad, trazas, sonido, pantalla. |
| `jugador.js` · `mando.js` | Vos, y el teclado. |
| `gentio.js` · `estorbos.js` | Que no se apilen y que no atraviesen paredes. |
| `red.js` · `protocolo.js` · `herramientas/servidor.mjs` | Jugar de a dos en red local. |

### San Lorenzo — el contenido de esta batalla

| | |
|---|---|
| `sanlorenzo.js` | **El lugar**: el convento de San Carlos, la barranca de nueve metros, el Paraná y la escuadra fondeada. |
| `despliegue.js` · `pinza.js` | Quién sale al campo, dónde, y las dos columnas de sesenta. |
| `canon.js` | Las dos piezas ligeras que trajeron los realistas. |
| `acto.js` | El acto del sargento Cabral, que arranca la primera vez que te matan el caballo estando montado. |
| `plano.js` | El plano de la maniobra, dibujado con las medidas de verdad del nivel. |
| `mundo.js` | El amanecer del 3 de febrero. |

Una batalla nueva de la campaña necesita su propio *lugar*, su propio *despliegue* y sus
propias *piezas*. El sistema no se toca — y si hay que tocarlo, es señal de que estaba
mal generalizado.

---

## Estado

Lo que **ya funciona**:

- **Carga de chispa en cuatro tiempos** con tres momentos que se marcan a mano,
  interrumpible y persistente, con las fallas de época: fogonazo sin tiro, chispa
  fallida y retardo de percusión. Arranca sola después del tiro, y **se puede cargar
  arriba del caballo en los cuatro andares** —al galope cuesta tres veces y media lo
  que a pie—.
- **Humo con grilla de densidad** compartida por el render y la percepción enemiga: la
  nube que te tapa a vos también los ciega a ellos.
- **Duelo de acero**: guardia, aviso telegrafiado, **parada perfecta** de 180 ms, remate
  y pechada, todo pagado con aliento.
- **El caballo**: cuatro andares, salto de tapias, radio de giro que se abre con la
  velocidad, filo por velocidad, y una tapia nunca lo frena del todo.
- **Caballería con lanza**: la carga en tres tiempos que se lee por la distancia, y el
  desmonte como tirada por arma, con el oficio de jinete restando aparte.
- **Los dos cañones ligeros** con aviso de tres tiempos y metralla en abanico que no
  distingue bandos.
- **El acto Cabral.**
- **La lejanía**: los 370 hombres de la batalla entran en 99 llamadas de dibujo.
- **La pinza**: las dos columnas de sesenta, la formación que se rompe sola en el choque,
  y el clarín que las larga.
- **El tiro que puede errar.** La bala sale de un cono y cae donde cae, se ve la
  polvareda donde pega y se oye zumbar la que pasa cerca. Contra un hombre de frente:

  | 5 m | 10 m | 20 m | 40 m |
  |---|---|---|---|
  | 45 % | 20 % | 7 % | 2 % |

  De rodilla se tira al doble de bien; dentro del humo, a casi nada.
- **Vos matás de una, ellos no.** El sable corvo y tu bala matan de un golpe, y tu
  disparo distingue **dónde** pegó: al pecho o a la cabeza mata, al brazo o a la pierna
  hiere y el tipo sigue en pie. Los golpes de la tropa, en cambio, hieren: hacen falta
  varios. Sos uno contra doscientos cincuenta y sos el único que apunta de verdad.
- **La moral, y con ella un final.** Cada hombre lleva su ánimo, se lo bajan los que caen
  al lado, el flanco, la caballería encima y la soledad, y el quiebre **contagia**. La
  batalla no termina cuando muere el último: termina cuando la línea se rompe y baja la
  barranca a los botes. Cada hombre deja anotado qué le está bajando el ánimo
  (`juego.soldados[0].porQue` en la consola), que es lo que permite ajustarlo.

  El flanco y la soledad se cobran **sólo a pie** —una carga se mete adentro del enemigo:
  quedar rodeado es el objetivo—, así que al que le voltean el caballo se le vienen los
  dos encima de golpe.

Lo que **falta ajustar**, medido y sin maquillar:

- **La línea se quiebra entre los 2:50 y los 3:35** de pelea, con setenta a noventa
  realistas todavía en pie y unos sesenta granaderos vivos para verlo. Antes se quebraba
  a los **dieciocho segundos** y a los cuarenta y cinco no quedaba nadie en el campo.
- Pero **todavía mueren demasiados**: unos 190 de 250, cuando en 1813 murieron alrededor
  de 40 y unos 210 bajaron la barranca. Es el hueco más grande que queda.
- **Una corrida de cada tres se empantana.** Si a los granaderos les matan los caballos
  temprano, no queda quién dé miedo y la batalla se vuelve una riña de infantería que
  ganan ellos por número.
- Falta **el cierre**: no hay pantalla final ni parte de bajas. La línea se quiebra, se
  van, y el campo queda como queda.

Después de eso: las órdenes de tropa, bajar a la barranca detrás de ellos, el epílogo del
pino y los modos sueltos.

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
| `R` | cargar el arma (arranca sola tras el tiro; `R` la pausa o la adelanta) |
| `F` | culatazo (tercerola) / bayonetazo (fusil) |
| `1` `2` `3` | arma larga · sable corvo · pistolón |
| `G` | tomar el fusil de un realista caído / intercambiar |
| `B` | revisar la cartuchera |
| `V` | vendarse |
| `T` | **tocar el clarín** (en la batalla; en red, sólo San Martín) |
| `O` | que vengan los realistas |
| `H` | montar / desmontar · a caballo, `W` sube el andar y `S` lo baja |
| `F3` | datos de depuración |

---

## De a dos, en la misma red

San Martín no cargó solo. Partió los ciento veinte granaderos en dos escuadrones: llevó
uno él y el otro lo llevó el capitán **Justo Bermúdez**. Las dos columnas salieron a la
vez por los dos costados del convento. Eso es la pinza, y es lo único que ganó la batalla.

**En una de las dos máquinas** —cualquiera, pero con el proyecto clonado y Node
instalado:

```bash
npm run sala
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
| **Anfitrión** · José de San Martín · columna del **oeste** | **Simula la batalla entera** en su máquina y es el único que **toca el clarín**. |
| **Invitado** · capitán Justo Bermúdez · columna del **este** | Sus sesenta granaderos lo siguen a él. Sale cuando suena el clarín del otro. |

**El clarín lo toca uno solo, y a propósito.** Dos clarines son dos cargas; uno solo es
una pinza. Esa espera es lo que se sintió el 3 de febrero a las cinco y media.

Detalles que conviene saber:

- **El servidor no tiene dependencias.** Son doscientas líneas de Node que sirven los
  archivos y pasan mensajes entre los dos navegadores. No sabe qué es un granadero.
- **Es red local.** Las dos máquinas tienen que verse: el mismo wifi o el mismo cable.
  Si están en una red institucional puede haber **aislamiento de clientes** —se ve
  internet pero las máquinas no se ven entre sí— y ahí no hay nada que hacer desde el
  lado de uno: sirve el hotspot del celular, un router propio o un cable directo.
- **En Windows hay que abrirle el puerto a Node una vez:**
  `netsh advfirewall firewall add rule name="Clarin" dir=in action=allow protocol=TCP localport=8099`
- **Cuesta un megabit por segundo.** Medido con la batalla entera —375 hombres y 121
  caballos— da **114 KB/s**.
- **Si se va el anfitrión, se termina la batalla**, porque era el que la estaba pensando.
- **El archivo único no sirve para esto.** Sin servidor no hay sala.

---

## Desarrollo

```bash
npm install             # sólo si vas a tocar el código
npm run jugar           # rearma el .html y lo abre
npm run servir          # servidor estático, para recargar el navegador al toque
npm run empaquetar      # rearma clarin-san-lorenzo.html a mano
```

No hay build: three.js está vendorizado en `vendor/`, así que para desarrollar alcanza
con servir la carpeta y recargar.

**Después de tocar cualquier cosa de `src/` hay que rearmar el `.html`**, o el que lo
abra a doble clic va a estar jugando la versión anterior. `SINCRONIZAR.bat` lo hace solo.

## Pruebas

Los números de esta batalla no se calibran a ojo: se miden.

```bash
npm run desbande      # cuándo se quiebra la línea y con cuánta gente en pie
npm run moral         # que la batalla termine por quiebre y no por exterminio
npm run ritmo         # la carga con y sin acertar los tiempos
npm run rendimiento   # llamadas de dibujo y triángulos bajo carga
npm run red           # dos navegadores, el servidor y el cable de verdad
npm run capturas      # capturas de pantalla a capturas/
```

`npm run desbande` corre la batalla entera varias veces y contesta las dos preguntas
juntas —**cuándo** se quiebra y **con cuántos en pie**—, porque quebrarse a los tres
minutos con veinte hombres parados no es San Lorenzo, es un exterminio que además tardó.
Con `CORRIDAS=6` hace más pasadas y con `DIAG=1` desglosa cada quince segundos qué
término de la moral está haciendo el trabajo.

Ojo con leer mal esos números: **el piloto de la prueba es suicida** —carga de frente al
galope sin disparar y lo matan a los cuarenta segundos—. Un jugador de verdad se lleva
muchos más hombres y adelanta el quiebre. Son el piso, no lo que vas a ver jugando.

Requieren `npm i` y un Chromium; si no está en el `PATH` de Playwright, pasarlo con
`CHROMIUM=/ruta/al/chrome`.
