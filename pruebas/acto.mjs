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
  const teclas = new Set();
  const acto = j.acto;

  // campo limpio y el jugador montado en medio del campo
  j.soldados.forEach(s => s.quitar()); j.soldados.length = 0;
  j.canones.forEach(c => { c.vivo = false; });
  const c = j.caballos.find(x => x.vivo) || j.caballo;
  c.pos.set(0, 0, -30); c.rumbo = 0; c.vida = 6; c.vivo = true; c.caida = 0;
  c.colisiones = [];
  j.jugador.vida = 100; j.jugador.vivo = true;
  j.jugador.montar(c);

  ok('arranca montado', !!j.jugador.monta);
  ok('el acto no arrancó todavía', !acto.activo);

  // le matan el caballo: acá empieza todo
  c.recibir(9);
  // un cuadro del bucle real es lo que dispara el acto
  const paso = (seg) => {
    for (let i = 0; i < seg * 60; i++) {
      if (j.jugador.monta && !j.jugador.monta.vivo) {
        if (acto.puedeArrancar(j.jugador.monta)) acto.arrancar(j.jugador.monta);
      }
      acto.actualizar(1 / 60, teclas);
      for (const s of j.soldados) s.actualizar(1 / 60, j.jugador, j.soldados);
      for (const cb of j.caballos) { if (cb.actualizado) { cb.actualizado = false; continue; } cb.actualizar(1 / 60, { girar: 0 }); }
      j.jugador.actualizar(1 / 60, teclas, false, false);
    }
  };

  paso(0.2);
  ok('el acto arranca al caer el caballo', acto.activo);
  ok('quedás atrapado', j.jugador.atrapado > 0);
  ok('la cámara baja al pasto', j.jugador.pos.y < 0.8, `y=${j.jugador.pos.y.toFixed(2)}`);

  // el forcejeo NUNCA alcanza
  teclas.add('Space');
  paso(6);
  ok('el forcejeo se topa y no libera', acto.forcejeo <= 0.83 && j.jugador.atrapado > 0,
    `barra ${acto.forcejeo.toFixed(2)}`);
  teclas.delete('Space');

  const hay = b => j.soldados.filter(s => s.bando === b);
  ok('apareció el español que te iba a rematar', hay('realista').length >= 1);
  ok('apareció Cabral', j.soldados.some(s => s.esCabral));
  const cab = j.soldados.find(s => s.esCabral);
  ok('Cabral es de tez oscura', !!cab);

  // no te pueden matar mientras estás debajo del caballo
  const vidaAntes = j.jugador.vida;
  paso(2);
  ok('nadie te remata ahí abajo', j.jugador.vida >= vidaAntes - 1, `${vidaAntes} → ${Math.round(j.jugador.vida)}`);

  // Cabral llega y mata al español
  paso(2);
  const dCab = Math.hypot(cab.pos.x - j.jugador.pos.x, cab.pos.z - j.jugador.pos.z);
  ok('Cabral llegó hasta vos', dCab < 6, `a ${dCab.toFixed(1)} m`);
  ok('el que te iba a rematar cayó', acto.verdugo && !acto.verdugo.vivo);

  // levanta el caballo y te suelta
  paso(4.5);
  ok('te libera', j.jugador.atrapado === 0, `paso ${acto._paso}`);
  ok('el caballo se levantó de encima', c.raiz.position.y > 0.1, `y=${c.raiz.position.y.toFixed(2)}`);

  // y muere
  paso(3);
  ok('Cabral cae', !cab.vivo);
  paso(8);
  ok('el acto termina', !acto.activo);
  ok('no se repite', !acto.puedeArrancar(c));
  return out;
});
for (const [e, n, x] of r) console.log(e.padEnd(4), n.padEnd(42), x);
const mal = r.filter(x => x[0] === 'MAL').length;
console.log(`\n${r.filter(x => x[0] === 'OK ').length} bien, ${mal} mal`);
console.log(errs.length ? 'ERRORES: ' + errs.join(' / ') : 'sin errores de consola');
await nav.close();
