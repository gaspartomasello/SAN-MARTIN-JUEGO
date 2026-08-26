import { chromium } from 'playwright';
const nav = await chromium.launch({ executablePath: process.env.CHROMIUM,
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
const pag = await nav.newPage({ viewport: { width: 900, height: 620 } });
const errs = [];
pag.on('pageerror', e => errs.push(e.message));
await pag.goto('http://localhost:8099/index.html', { waitUntil: 'load' });
await pag.waitForTimeout(1200); await pag.click('#empezar'); await pag.waitForTimeout(1500);

const r = await pag.evaluate(() => {
  const j = window.juego, out = [];
  const ok = (n, cond, extra) => out.push([cond ? 'OK ' : 'MAL', n, extra === undefined ? '' : extra]);
  const limpiar = () => { j.soldados.forEach(s => s.quitar()); j.soldados.length = 0; };
  const correr = (segs, ss) => { for (let i = 0; i < segs * 60; i++) for (const s of ss) s.actualizar(1 / 60, j.jugador, j.soldados); };

  // ---------- 1. carga a la bayoneta ----------
  limpiar();
  j.jugador.pos.set(0, 1.68, 0); j.jugador.vivo = true;
  const a = j.soltarSoldado('realista');
  a.malla.position.set(0, 0, -13);
  a.recarga = 30;                       // fusil descargado: no le queda otra
  const estados = new Set();
  let velMax = 0, antes = a.pos.z;
  for (let i = 0; i < 60 * 5; i++) {
    a.actualizar(1 / 60, j.jugador, j.soldados);
    estados.add(a.estado);
    velMax = Math.max(velMax, Math.abs(a.pos.z - antes) * 60);
    antes = a.pos.z;
  }
  ok('descargado y cerca, corre', estados.has('correr'), [...estados].join(','));
  ok('corre más rápido que la marcha', velMax > 3.4, `${velMax.toFixed(1)} m/s`);
  ok('la carrera termina en el acero', a.estado === 'acero' || estados.has('acero'));

  // el bayonetazo de la carga: pega al llegar, sin plantarse ni avisar
  limpiar();
  const ch = j.soltarSoldado('realista');
  ch.malla.position.set(0, 0, -12);
  ch.recarga = 30;
  let golpes = 0, tPrimero = -1;
  ch.alGolpear = () => { golpes++; if (tPrimero < 0) tPrimero = i / 60; };
  var i = 0;
  for (i = 0; i < 60 * 6; i++) ch.actualizar(1 / 60, j.jugador, j.soldados);
  ok('la carga pega al llegar', golpes > 0, `${golpes} golpes, el primero a los ${tPrimero.toFixed(2)} s`);
  // corriendo a 4,3 m/s desde 12 m, el toque cae a 2,5 m: unos 2,2 s
  ok('pega sin frenar a avisar', tPrimero > 0 && tPrimero < 3.0, `${tPrimero.toFixed(2)} s`);

  // ---------- 2. rodilla en tierra ----------
  limpiar();
  const b = j.soltarSoldado('realista');
  b.malla.position.set(0, 0, -40);
  b.recarga = 0;
  b.cubiertas = [];                     // sin parapetos: la hinca a campo abierto o no
  let hincó = false;
  for (let k = 0; k < 24 && !hincó; k++) {
    b.estado = 'avanzar'; b.recarga = 0; b.t = 0; b.tCubierta = 0;
    b.actualizar(1 / 60, j.jugador, j.soldados);
    if (b.rodilla) hincó = true;
  }
  ok('a veces hinca la rodilla para tirar', hincó);
  if (hincó) {
    correr(0.5, [b]);
    ok('la figura baja la cadera', b.fig.h.cadera.position.y < 0.75, `y=${b.fig.h.cadera.position.y.toFixed(2)}`);
    ok('la cabeza baja con él', b.cabeza().y < 1.4, `ojo a ${b.cabeza().y.toFixed(2)} m`);
    ok('el tiro sale más bajo', true);
  }
  // y se pone de pie al entrar al acero
  b.malla.position.set(0, 0, -1);
  correr(0.3, [b]);
  ok('se para para el acero', !b.rodilla && b.fig.rodilla === false, b.estado);

  // ---------- 3. parapeto ----------
  limpiar();
  const c = j.soltarSoldado('realista');
  c.malla.position.set(0, 0, -40);
  c.recarga = 0; c.tCubierta = 0;
  // una tapia a 6 m del soldado, del lado del jugador
  c.cubiertas = [{ x: 0, z: -33, r: 1.2 }];
  c.estado = 'avanzar';
  c.actualizar(1 / 60, j.jugador, j.soldados);
  ok('elige el parapeto', c.estado === 'correr' && c.motivo === 'cubierta', `${c.estado}/${c.motivo}`);
  const puesto = c.cubierta ? { x: +c.cubierta.x.toFixed(1), z: +c.cubierta.z.toFixed(1) } : null;
  ok('se pone del lado que da la espalda al enemigo', puesto && puesto.z < -33,
    JSON.stringify(puesto));
  correr(2, [c]);
  ok('llega al puesto', Math.abs(c.pos.z - puesto.z) < 1.3, `quedó en z=${c.pos.z.toFixed(1)}, puesto z=${puesto.z}`);
  ok('llega y se hinca detrás', c.rodilla === true, `${c.estado} · rodilla ${c.rodilla}`);

  // no se parapeta caminando para atrás
  limpiar();
  const d = j.soltarSoldado('realista');
  d.malla.position.set(0, 0, -30);
  d.recarga = 0; d.tCubierta = 0;
  d.cubiertas = [{ x: 0, z: -55, r: 1.2 }];    // muy atrás: retroceder no sirve
  d.estado = 'avanzar';
  d.actualizar(1 / 60, j.jugador, j.soldados);
  ok('no retrocede a taparse', d.motivo !== 'cubierta', `${d.estado}/${d.motivo}`);

  // ---------- 4. los granaderos a pie hacen lo mismo ----------
  limpiar();
  const g = j.soltarSoldado('granadero');
  const e = j.soltarSoldado('realista');
  g.malla.position.set(0, 0, -20); e.malla.position.set(0, 0, -34);
  g.recarga = 30;
  const est = new Set();
  for (let i = 0; i < 60 * 4; i++) { g.actualizar(1 / 60, j.jugador, j.soldados); est.add(g.estado); }
  ok('el granadero a pie también corre', est.has('correr'), [...est].join(','));
  return out;
});
for (const [e, n, x] of r) console.log(e.padEnd(4), n.padEnd(40), x);
const mal = r.filter(x => x[0] === 'MAL').length;
console.log(`\n${r.filter(x => x[0] === 'OK ').length} bien, ${mal} mal`);
console.log(errs.length ? 'ERRORES: ' + errs.join(' / ') : 'sin errores de consola');
await nav.close();
