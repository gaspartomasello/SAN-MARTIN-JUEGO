import { chromium } from 'playwright';
const nav = await chromium.launch({ executablePath: process.env.CHROMIUM,
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
const pag = await nav.newPage({ viewport: { width: 900, height: 620 } });
const errs = [];
pag.on('pageerror', e => errs.push(e.message));
await pag.goto('http://localhost:8099/index.html', { waitUntil: 'load' });
await pag.waitForTimeout(1200); await pag.click('#empezar'); await pag.waitForTimeout(1400);

const r = await pag.evaluate(() => {
  const j = window.juego, out = [];
  const ok = (n, cond, extra) => out.push([cond ? 'OK ' : 'MAL', n, extra === undefined ? '' : extra]);
  const paso = (c, seg, mando = {}) => { for (let i = 0; i < seg * 60; i++) c.actualizar(1 / 60, { girar: 0, ...mando }); };
  const c = j.caballo;
  c.montado = true;   // acá se mide física de andar, no el caballo suelto

  // ---------- 1. el salto ----------
  c.colisiones = [];
  c.pos.set(0, 0, 0); c.rumbo = 0; c.vel = 0; c.andar = 0; c.alto = 0; c.enElAire = false; c.tSalto = 0;
  ok('parado no salta', c.saltar() === false);

  c.vel = 10.2; c.andar = 3; c.tSalto = 0;
  ok('al galope sí salta', c.saltar() === true);
  let apice = 0, aire = 0, z0 = c.pos.z;
  while (c.enElAire && aire < 4) { c.actualizar(1 / 60, { girar: 0 }); apice = Math.max(apice, c.alto); aire += 1 / 60; }
  out.push(['—', 'salto a galope', `apice ${apice.toFixed(2)} m · aire ${aire.toFixed(2)} s · largo ${Math.abs(c.pos.z - z0).toFixed(1)} m`]);
  ok('aterriza', !c.enElAire && c.alto === 0);

  c.pos.set(0, 0, 0); c.vel = 4.6; c.andar = 2; c.tSalto = 0; c.enElAire = false; c.alto = 0;
  c.saltar();
  let ap2 = 0, t2 = 0; z0 = c.pos.z;
  while (c.enElAire && t2 < 4) { c.actualizar(1 / 60, { girar: 0 }); ap2 = Math.max(ap2, c.alto); t2 += 1 / 60; }
  out.push(['—', 'salto al trote', `apice ${ap2.toFixed(2)} m · largo ${Math.abs(c.pos.z - z0).toFixed(1)} m`]);
  ok('el galope salta más alto que el trote', apice > ap2 + 0.15);

  // ---------- 2. la tapia: chocarla, rozarla, saltarla ----------
  const tapia = { min: { x: -6, y: 0, z: -12 }, max: { x: 6, y: 1.1, z: -11 } };
  const correr = (rumbo, saltarA) => {
    c.colisiones = [tapia];
    c.pos.set(0, 0, 0); c.rumbo = rumbo; c.vel = 10.2; c.andar = 3;
    c.alto = 0; c.enElAire = false; c.tSalto = 0; c.golpeo = false; c.montado = true;
    for (let i = 0; i < 60 * 3; i++) {
      const d = Math.abs(c.pos.z - tapia.max.z);
      c.actualizar(1 / 60, { girar: 0, saltar: saltarA && d < saltarA && !c.enElAire });
    }
    return { z: +c.pos.z.toFixed(1), vel: +c.vel.toFixed(1), andar: c.nombreAndar, golpeo: !!c.golpeo };
  };
  const frente = correr(0, 0);
  out.push(['—', 'de frente sin saltar', JSON.stringify(frente)]);
  ok('de frente la tapia frena', frente.z > -11 && frente.vel < 6);

  const refilon = correr(0.95, 0);
  out.push(['—', 'de refilón', JSON.stringify(refilon)]);
  ok('de refilón NO se planta', refilon.vel > 5.5, `quedó a ${refilon.vel} m/s`);
  ok('de refilón no baja el andar', refilon.andar === 'a galope');

  const saltada = correr(0, 5);
  out.push(['—', 'saltando la tapia', JSON.stringify(saltada)]);
  ok('la tapia se salta', saltada.z < -12, `llegó a z=${saltada.z}`);

  // ---------- 3. el lancero ----------
  c.colisiones = j.escena ? c.colisiones : c.colisiones;
  const antes = j.soldados.length;
  const l = j.soltarSoldado('granadero', { montado: true });
  ok('el lancero nace montado', l.montado === true);
  ok('lleva lanza', l.lancero === true);
  ok('el caballo entró a la lista', j.caballos.includes(l.monta));
  const asiento = l.malla.position.y;
  ok('va sentado en la silla', asiento > 0.35 && asiento < 0.65, `y=${asiento.toFixed(2)}`);

  // que cargue contra un realista y le pegue. Se deja UN solo realista vivo
  // para que la carga no elija otro blanco a mitad de camino.
  for (const s of j.soldados) if (s.esRealista) s.vivo = false;
  const enemigo = j.soltarSoldado('realista');
  enemigo.malla.position.set(l.malla.position.x, 0, l.malla.position.z - 45);
  let pegó = false, distMin = 999, andares = new Set();
  const golpeOriginal = l.alGolpear;
  l.alGolpear = (q, o) => { pegó = true; if (golpeOriginal) golpeOriginal(q, o); };
  for (let i = 0; i < 60 * 22; i++) {
    l.actualizar(1 / 60, j.jugador, j.soldados);
    if (enemigo.vivo) enemigo.actualizar(1 / 60, j.jugador, j.soldados);
    if (l.monta) andares.add(l.monta.nombreAndar);
    distMin = Math.min(distMin, l.pos.distanceTo(enemigo.pos));
  }
  ok('el lancero llega y ensarta', pegó, `distancia mínima ${distMin.toFixed(1)} m`);
  out.push(['—', 'andares usados en la carga', [...andares].join(', ')]);

  // ---------- 4. el desmonte ----------
  const l2 = j.soltarSoldado('granadero', { montado: true });
  l2.recibir(1);
  ok('un raspón no desmonta', l2.montado === true);
  l2.recibir(99);
  ok('el golpe fuerte voltea, no mata', l2.montado === false && l2.vivo);
  ok('queda tirado un rato', l2.tirado > 0);
  ok('las piernas se cierran al caer', l2.fig.montura === false);

  // ---------- 5. el cadáver del caballo ----------
  const l3 = j.soltarSoldado('granadero', { montado: true });
  const cab = l3.monta;
  cab.recibir(6);
  ok('el caballo muere', !cab.vivo);
  paso(cab, 1.2);
  ok('se desploma de costado', Math.abs(cab.raiz.rotation.z) > 1.2, `z=${cab.raiz.rotation.z.toFixed(2)}`);
  ok('el jinete se baja solo', !l3.montado);
  const tAntes = cab.tMuerto;
  paso(cab, 3);
  ok('el cadáver cuenta su tiempo', cab.tMuerto > tAntes + 2.5, `${cab.tMuerto.toFixed(1)} s`);

  // ---------- 6. voltear al jugador ----------
  const cj = j.caballo || j.caballos.find(x => x.vivo && !x.montado);
  cj.vida = 6; cj.vivo = true; cj.caida = 0; cj.pos.copy(j.jugador.pos); cj.pos.y = 0;
  j.jugador.vida = 100;
  j.jugador.montar(cj);
  const vidaAntes = j.jugador.vida;
  const volteado = j.voltear('prueba');
  ok('voltear te baja', volteado && !j.jugador.monta);
  ok('la caída cuesta vida', j.jugador.vida < vidaAntes, `${vidaAntes} → ${Math.round(j.jugador.vida)}`);

  // ---------- 7. pieles ----------
  return out;
});
for (const [e, n, x] of r) console.log(e.padEnd(4), n.padEnd(34), x);
const mal = r.filter(x => x[0] === 'MAL').length;
console.log(`\n${r.filter(x => x[0] === 'OK ').length} bien, ${mal} mal`);
console.log(errs.length ? 'ERRORES: ' + errs.join(' / ') : 'sin errores de consola');
await nav.close();
process.exit(mal ? 1 : 0);
