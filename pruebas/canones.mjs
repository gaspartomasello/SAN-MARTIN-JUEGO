import { chromium } from 'playwright';
const nav = await chromium.launch({ executablePath: process.env.CHROMIUM,
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
const pag = await nav.newPage({ viewport: { width: 900, height: 620 } });
const errs = [];
pag.on('pageerror', e => errs.push(e.message));
await pag.goto('http://localhost:8099/index.html', { waitUntil: 'load' });
await pag.waitForTimeout(1200); await pag.click('#modo-campo'); await pag.waitForTimeout(1600);

const r = await pag.evaluate(() => {
  const j = window.juego, out = [];
  const ok = (n, cond, extra) => out.push([cond ? 'OK ' : 'MAL', n, extra === undefined ? '' : extra]);
  const c = j.canones[0];

  ok('hay dos piezas', j.canones.length === 2);
  ok('cada una con sus artilleros', c.sirvientes.length === 2 && c.servido);
  ok('los artilleros tienen puesto', c.sirvientes.every(s => !!s.puesto));

  // ---------- el cono ----------
  c.pos.set(0, 0, -40); c.rumbo = Math.PI;      // mirando campo arriba (+Z)
  const en = (x, z) => c.fuerzaSobre({ x, y: 0, z });
  ok('al frente y cerca pega fuerte', en(0, -25) > 0.7, en(0, -25).toFixed(2));
  ok('al frente y lejos pega poco', en(0, 25) < 0.35 && en(0, 25) > 0, en(0, 25).toFixed(2));
  // a 20 m adelante el abanico tiene 7,5 m de semiancho
  ok('al borde del cono pega menos que en el centro', en(6, -20) > 0.2 && en(6, -20) < en(0, -20) * 0.85,
    `borde ${en(6, -20).toFixed(2)} vs centro ${en(0, -20).toFixed(2)}`);
  ok('fuera del cono no pega nada', en(12, -20) === 0, en(12, -20).toFixed(2));
  ok('a la espalda no pega nada', en(0, -60) === 0);
  ok('más allá del alcance, nada', en(0, 45) === 0, en(0, 45).toFixed(2));

  // ---------- el aviso ----------
  const paso = (seg, cand) => { for (let i = 0; i < seg * 60; i++) c.actualizar(1 / 60, cand); };
  c.estado = 'buscando'; c.recarga = 0; c.t = 0; c.vida = 5; c.vivo = true;
  const blanco = { pos: { x: 0, y: 0, z: -18 }, montado: false };
  let disparos = 0, avisoDesde = -1, avisoHasta = -1, t = 0;
  c.alDisparar = () => { disparos++; avisoHasta = t; };
  for (let i = 0; i < 60 * 10; i++) {
    c.actualizar(1 / 60, [blanco]);
    t += 1 / 60;
    if (c.cebando && avisoDesde < 0) avisoDesde = t;
    if (disparos) break;
  }
  ok('la pieza dispara', disparos === 1);
  const aviso = avisoHasta - avisoDesde;
  ok('avisa antes de tirar', aviso > 1.8, `${aviso.toFixed(2)} s de mecha encendida`);
  ok('después queda recargando', c.recarga > 10, `${c.recarga.toFixed(0)} s`);

  // ---------- prefiere al que viene a caballo ----------
  c.estado = 'buscando'; c.recarga = 0;
  const aPie = { pos: { x: -14, y: 0, z: -25 }, montado: false };
  const aCaballo = { pos: { x: 14, y: 0, z: -18 }, montado: true };
  c.actualizar(1 / 60, [aPie, aCaballo]);
  ok('la metralla se guarda para la caballería', c.objetivo === aCaballo,
    c.objetivo === aPie ? 'eligió al de a pie' : 'eligió al jinete');

  // ---------- se puede callar ----------
  const c2 = j.canones[1];
  c2.sirvientes.forEach(s => { s.vivo = false; });
  c2.actualizar(1 / 60, [blanco]);
  ok('sin artilleros la pieza calla', c2.estado === 'callado');
  // y desmontarla a tiros
  const antes = c.vivo;
  for (let k = 0; k < 5; k++) c.recibir(1);
  ok('se puede desmontar a tiros', antes && !c.vivo);
  ok('desmontada se tumba', Math.abs(c.malla.rotation.z) > 0.3);
  return out;
});
for (const [e, n, x] of r) console.log(e.padEnd(4), n.padEnd(40), x);
const mal = r.filter(x => x[0] === 'MAL').length;
console.log(`\n${r.filter(x => x[0] === 'OK ').length} bien, ${mal} mal`);
console.log(errs.length ? 'ERRORES: ' + errs.join(' / ') : 'sin errores de consola');
await nav.close();
