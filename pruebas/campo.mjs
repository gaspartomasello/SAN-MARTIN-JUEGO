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

// EL VALLE DOBLA, que es lo que lo saca de ser un pasillo. Se mide el EJE del
// paso de punta a punta: con el eje clavado en cero —como estaba— desde la boca
// se veía el fondo, el corral y la salida de un saque, y no había una sola
// esquina en trescientos metros.
const forma = await ev(() => {
  const e = window.juego.paso.eje;
  const ejes = [];
  for (let z = 90; z >= -210; z -= 5) ejes.push(e(z));
  return {
    min: +Math.min(...ejes).toFixed(1),
    max: +Math.max(...ejes).toFixed(1),
    // cuánto se corre el eje de tramo a tramo: si no se mueve, no dobla
    codo: +Math.max(...ejes.map((v, i) => i ? Math.abs(v - ejes[i - 1]) : 0)).toFixed(2)
  };
});
dilo('el valle dobla y no es un pasillo', forma.max - forma.min > 40 && forma.codo > 0.4,
  `el eje va de ${forma.min} a ${forma.max}`);

// EL DERRUMBE ESTÁ DONDE TIENE QUE ESTAR — y esto agarró un defecto del Horno
// que llevaba meses: `cocinar` transformaba y DISPONÍA la geometría del que
// llamaba, así que compartir una geometría entre varias piezas mandaba a todas
// menos la primera a cualquier lado. Con las indexadas no se notaba porque
// `toNonIndexed()` ya devolvía copia; con las poliédricas —los peñones— sí. De
// veintiséis piedras del derrumbe no aparecía ninguna.
const piedras = await ev(() => {
  const j = window.juego;
  const m = j.escena.getObjectByName('paso-piedras');
  if (!m) return null;
  const p = m.geometry.attributes.position;
  const z = j.paso.zDerrumbe, e = j.paso.eje(z), an = j.paso.medio(z);
  let dentro = 0;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), zz = p.getZ(i);
    if (zz > z - 9 && zz < z + 9 && x > e - an - 6 && x < e + an) dentro++;
  }
  return { total: p.count, dentro };
});
dilo('el derrumbe tiene piedra de verdad, no una caja invisible',
  !!piedras && piedras.dentro > 200,
  piedras ? `${piedras.dentro} vértices adentro del derrumbe, de ${piedras.total}` : 'no está la malla');

// LA PARED, CAMINANDO DE VERDAD Y NO TELETRANSPORTADO. La primera versión de
// esta prueba plantaba al jugador ADENTRO de la piedra y miraba si lo escupía,
// y no lo escupía: el que saca de las cajas es `_mover`, o sea que sólo corre
// cuando alguien camina. Eso no es un defecto —nadie aparece adentro de una
// montaña salvo una prueba— pero la prueba estaba midiendo algo que el juego
// no hace. Ahora se aprieta la D, como el que juega.
// y se planta SOBRE EL EJE, que ahora el valle dobla: parado en x = 0 a esta
// altura del paso ya estaría adentro de la roca
const garganta = await ev(() => {
  const j = window.juego;
  const e = j.paso.eje(-58);
  j.jugador.pos.set(e, 1.75, -58); j.jugador.yaw = 0; j.jugador.pitch = 0;
  return { eje: +e.toFixed(1), medio: +j.paso.medio(-58).toFixed(1) };
});
// Y EL TIEMPO LO PONE LA PRUEBA, no el reloj: con SwiftShader el juego corre a
// dos cuadros por segundo, así que tres segundos de teclado apretado son tres
// décimas de mundo y el hombre camina un metro y medio. La tecla se aprieta de
// verdad —para que pase por mando.js— y los cuatro segundos se simulan.
// Y SE CAMINA HACIA LA IZQUIERDA. Para la derecha, a esta altura del paso, hay
// un grupo de peñones puesto a propósito —para que el primer centinela se pueda
// esquivar— y el hombre se va deslizando contra las piedras: lo que se mediría
// es la roca suelta y no la pared. La pared se prueba donde no hay nada.
await pag.keyboard.down('KeyA');
await ev(() => { for (let i = 0; i < 240; i++) window.juego.simular(1 / 60); });
await pag.keyboard.up('KeyA');
const pared = await ev(({ eje }) => {
  const j = window.juego;
  return { x: +j.jugador.pos.x.toFixed(1), anduvo: +(eje - j.jugador.pos.x).toFixed(1) };
}, garganta);

dilo('en San Lorenzo el mundo termina en el río', topeSanLorenzo > -106 && topeSanLorenzo < -104,
  `z=${topeSanLorenzo}`);
dilo('y en el paso se llega hasta el fondo', paso.fondo[1] < -185, `z=${paso.fondo[1]}`);
dilo('se llega al corral de pircas', paso.corral[1] < -110, `z=${paso.corral[1]}`);
// se frena ANTES del borde del piso y no mucho antes: lo primero es que no se
// camine sobre la roca, y lo segundo que no haya pared invisible sobre la nieve
// El margen de arriba es el largo del tramo de pared: la caja se toma
// conservadora dentro de cada tramo de dos metros y medio, así que puede quedar
// hasta un metro por fuera del borde real. Lo que no puede pasar es lo otro:
// frenarte con nieve pisable por delante.
dilo('la pared de piedra frena justo en el borde del piso',
  pared.anduvo > garganta.medio - 2.5 && pared.anduvo <= garganta.medio + 1.2,
  `caminaste ${pared.anduvo} m desde el eje, con media garganta en ${garganta.medio}`);
dilo('el paso se dibuja y San Lorenzo no', paso.dibujado && !paso.sanLorenzo);
dilo('y tiene sus propias colisiones', paso.colisiones > 60, `${paso.colisiones} cajas`);
const techo = Math.max(...infoPaso.map(([, c]) => c));
dilo('el desfiladero entra en el presupuesto', techo < 120, `${techo} llamadas, techo 120`);

for (const [e, n, x] of T) console.log(e.padEnd(4), n.padEnd(44), x);
const mal = T.filter(t => t[0] === 'MAL').length;
console.log(`\n${T.length - mal} bien, ${mal} mal`);
await nav.close();
process.exit(mal ? 1 : 0);
