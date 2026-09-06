import { chromium } from 'playwright';
const nav = await chromium.launch({ executablePath: process.env.CHROMIUM,
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
const pag = await nav.newPage({ viewport: { width: 1280, height: 620 } });
pag.on('pageerror', e => console.log('[EXCEPCION]', e.message));
await pag.goto('http://localhost:8099/index.html', { waitUntil: 'load' });
await pag.waitForFunction(() => !!window.juego, null, { timeout: 90000 }); await pag.click('#modo-campo'); await pag.waitForTimeout(2200);
const ev = (f, ...a) => pag.evaluate(f, ...a);

const tomas = [
  { n: 'c-1-convento', pos: [0, 1.75, -22], yaw: Math.PI, pitch: 0.10 },
  { n: 'c-2-campo',    pos: [0, 1.75, -6],  yaw: 0,        pitch: -0.02 },
  { n: 'c-3-barranca', pos: [4, 1.75, -70], yaw: 0,        pitch: -0.06 },
  { n: 'c-4-rio',      pos: [4, 4.20, -80], yaw: 0,        pitch: -0.13 }
];
const info = [];
for (const t of tomas) {
  await ev(d => {
    const j = window.juego;
    j.soldados.forEach(s => s.quitar()); j.soldados.length = 0;
    j.jugador.desmontar && j.jugador.monta && j.jugador.desmontar();
    j.jugador.pos.set(d.pos[0], d.pos[1], d.pos[2]);
    j.jugador.yaw = d.yaw; j.jugador.pitch = d.pitch;
  }, t);
  await pag.waitForTimeout(1600);
  await pag.screenshot({ path: 'tropa/' + t.n + '.png' });
  info.push([t.n, await ev(() => window.juego.info.calls)]);
}
console.log(info.map(([n, c]) => `${n}: ${c} llamadas`).join('\n'));

// ---------------------------------------------------------------------------
// EL PASO · el escenario del capítulo 2
// ---------------------------------------------------------------------------
// Cuatro vistas del desfiladero, y las tres cosas que un desfiladero tiene que
// cumplir para ser un desfiladero: que se pueda llegar hasta el fondo, que las
// paredes frenen, y que el capítulo 1 no aparezca por atrás.
const T = [];
const dilo = (n, ok, x) => T.push([ok ? 'OK ' : 'MAL', n, x === undefined ? '' : x]);

// hasta dónde se llega en San Lorenzo, para compararlo con el paso
const topeSanLorenzo = await ev(() => {
  const j = window.juego;
  j.jugador.pos.set(0, 1.75, -200);
  for (let i = 0; i < 20; i++) j.simular(1 / 60);
  return +j.jugador.pos.z.toFixed(1);
});

await ev(() => { document.exitPointerLock(); document.getElementById('portada').classList.remove('oculto'); });
await pag.waitForTimeout(400);
await ev(() => document.getElementById('modo-andes').click());
await pag.waitForTimeout(2600);

const vistas = [
  { n: 'p-1-boca',      pos: [0, 1.75, 46],   yaw: 0, pitch: 0.00 },
  { n: 'p-2-garganta',  pos: [0, 1.75, -58],  yaw: 0, pitch: 0.12 },
  { n: 'p-3-corral',    pos: [-9, 1.75, -104], yaw: 0, pitch: 0.02 },
  { n: 'p-4-salida',    pos: [0, 1.75, -168], yaw: 0, pitch: 0.10 }
];
const infoPaso = [];
for (const t of vistas) {
  await ev(d => {
    const j = window.juego;
    j.jugador.pos.set(d.pos[0], d.pos[1], d.pos[2]);
    j.jugador.yaw = d.yaw; j.jugador.pitch = d.pitch;
    for (let i = 0; i < 12; i++) j.simular(1 / 60);
  }, t);
  await pag.waitForTimeout(1500);
  await pag.screenshot({ path: 'tropa/' + t.n + '.png' });
  infoPaso.push([t.n, await ev(() => window.juego.info.calls)]);
}
console.log(infoPaso.map(([n, c]) => `${n}: ${c} llamadas`).join('\n'));

const paso = await ev(() => {
  const j = window.juego, p = j.jugador;
  const donde = (x, z) => {
    p.pos.set(x, 1.75, z);
    for (let i = 0; i < 20; i++) j.simular(1 / 60);
    return [+p.pos.x.toFixed(1), +p.pos.z.toFixed(1)];
  };
  return {
    // EL DEFECTO QUE ESTO AGARRA: los límites del mundo estaban escritos en
    // jugador.js con los valores de San Lorenzo, así que el jugador se frenaba
    // solo en −105 —el río del Paraná— a sesenta metros de un corral al que no
    // se podía llegar de ninguna manera.
    fondo: donde(0, -190),
    corral: donde(-9, -112),
    sanLorenzo: !!j.escena.getObjectByName('sanlorenzo').visible,
    dibujado: !!j.escena.getObjectByName('andes').visible,
    colisiones: j.mundo.colisiones.length
  };
});

// LA PARED, CAMINANDO DE VERDAD Y NO TELETRANSPORTADO. La primera versión de
// esta prueba plantaba al jugador ADENTRO de la piedra y miraba si lo escupía,
// y no lo escupía: el que saca de las cajas es `_mover`, o sea que sólo corre
// cuando alguien camina. Eso no es un defecto —nadie aparece adentro de una
// montaña salvo una prueba— pero la prueba estaba midiendo algo que el juego
// no hace. Ahora se aprieta la D, como el que juega.
await ev(() => {
  const j = window.juego;
  j.jugador.pos.set(0, 1.75, -58); j.jugador.yaw = 0; j.jugador.pitch = 0;
});
// Y EL TIEMPO LO PONE LA PRUEBA, no el reloj: con SwiftShader el juego corre a
// dos cuadros por segundo, así que tres segundos de teclado apretado son tres
// décimas de mundo y el hombre camina un metro y medio. La tecla se aprieta de
// verdad —para que pase por mando.js— y los cuatro segundos se simulan.
await pag.keyboard.down('KeyD');
await ev(() => { for (let i = 0; i < 240; i++) window.juego.simular(1 / 60); });
await pag.keyboard.up('KeyD');
const pared = await ev(() => {
  const j = window.juego;
  return { x: +j.jugador.pos.x.toFixed(1), anduvo: +Math.abs(j.jugador.pos.x).toFixed(1),
    medio: 8 };
});

dilo('en San Lorenzo el mundo termina en el río', topeSanLorenzo > -106 && topeSanLorenzo < -104,
  `z=${topeSanLorenzo}`);
dilo('y en el paso se llega hasta el fondo', paso.fondo[1] < -185, `z=${paso.fondo[1]}`);
dilo('se llega al corral de pircas', paso.corral[1] < -110, `z=${paso.corral[1]}`);
dilo('la pared de piedra frena', Math.abs(pared.x) < 13 && pared.anduvo > 3,
  `caminaste ${pared.anduvo} m y te frenó en x=${pared.x}, con la garganta en ${pared.medio}`);
dilo('el paso se dibuja y San Lorenzo no', paso.dibujado && !paso.sanLorenzo);
dilo('y tiene sus propias colisiones', paso.colisiones > 60, `${paso.colisiones} cajas`);
const techo = Math.max(...infoPaso.map(([, c]) => c));
dilo('el desfiladero entra en el presupuesto', techo < 120, `${techo} llamadas, techo 120`);

for (const [e, n, x] of T) console.log(e.padEnd(4), n.padEnd(44), x);
const mal = T.filter(t => t[0] === 'MAL').length;
console.log(`\n${T.length - mal} bien, ${mal} mal`);
await nav.close();
process.exit(mal ? 1 : 0);
