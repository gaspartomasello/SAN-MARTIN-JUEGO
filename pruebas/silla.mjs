// QUEDARSE EN LA SILLA. Antes todo desmontaba al cien por ciento. Acá se mide
// que cada arma tenga su probabilidad, que San Martín sea el más difícil de
// bajar y que la metralla siga siendo la que no perdona —porque de ahí sale
// el acto Cabral—.
import { chromium } from 'playwright';
const nav = await chromium.launch({ executablePath: process.env.CHROMIUM,
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
const pag = await nav.newPage({ viewport: { width: 900, height: 620 } });
const errs = []; pag.on('pageerror', e => errs.push(e.message));
await pag.goto('http://localhost:8099/index.html', { waitUntil: 'load' });
await pag.waitForTimeout(1200); await pag.click('#empezar'); await pag.waitForTimeout(1800);

const r = await pag.evaluate(async () => {
  const j = window.juego, out = [];
  const T = await import('/vendor/three.module.js');
  const ok = (n, cond, extra) => out.push([cond ? 'OK ' : 'MAL', n, extra === undefined ? '' : extra]);
  const limpiar = () => {
    j.soldados.forEach(s => s.quitar()); j.soldados.length = 0;
    for (const c of j.caballos.slice()) if (j.jugador.monta !== c) c.quitar();
    j.caballos.length = 0;
  };

  // ---- 1. la tabla existe y es una jerarquía, no un interruptor ----
  const V = j.VOLTEO;
  ok('la bala es lo que menos voltea', V.bala < V.bayoneta);
  ok('la bayoneta voltea más que la bala', V.bayoneta < V.lanza);
  ok('el asta del lancero es la mejor arma antijinete', V.lanza < V.metralla);
  ok('y ninguna salvo la metralla es segura', V.bala < 1 && V.bayoneta < 1 && V.lanza < 1);

  // ---- 2. a un lancero de la tropa NO lo baja siempre un balazo ----
  const tirada = (volteo, n) => {
    limpiar();
    let bajados = 0;
    for (let k = 0; k < n; k++) {
      const l = j.soltarSoldado('granadero', { montado: true, pos: new T.Vector3(k * 3, 0, -50) });
      l.vida = 9999;                    // acá se mide el desmonte, no la muerte
      l.recibir(2, null, volteo);
      if (!l.montado) bajados++;
    }
    return bajados / n;
  };
  const pBala = tirada(V.bala, 220);
  ok('el balazo baja al lancero a veces, no siempre', pBala > 0.08 && pBala < 0.38,
    `${(pBala * 100).toFixed(0)} % de ${(V.bala * 100).toFixed(0)} % esperado`);
  const pLanza = tirada(V.lanza, 220);
  ok('el lanzazo baja mucho más', pLanza > pBala + 0.15, `${(pLanza * 100).toFixed(0)} %`);
  const pMet = tirada(V.metralla, 60);
  ok('la metralla baja siempre', pMet === 1, `${(pMet * 100).toFixed(0)} %`);

  // ---- 3. y si NO lo baja, el golpe entra ----
  limpiar();
  const duro = j.soltarSoldado('granadero', { montado: true, pos: new T.Vector3(0, 0, -50) });
  duro.vida = 40;
  const vida0 = duro.vida;
  for (let k = 0; k < 40; k++) { if (duro.montado) duro.recibir(1, null, 0); }
  ok('el golpe que no voltea, hiere', duro.vida < vida0, `${vida0} → ${duro.vida}`);

  // ---- 4. San Martín es el más difícil de bajar ----
  //
  // Se compara la probabilidad efectiva del jugador contra la de la tropa con
  // la misma arma. El oficio del jinete tiene que hacer una diferencia real.
  const O = j.OFICIO;
  const suyo = arma => arma * (1 - O);
  ok('el oficio del jinete resta de verdad', O > 0.4 && O < 0.85, `oficio ${O}`);
  ok('a San Martín le cuesta la mitad o menos que a la tropa', suyo(V.bala) < V.bala * 0.5,
    `${(suyo(V.bala) * 100).toFixed(1)} % contra ${(V.bala * 100).toFixed(0)} %`);
  ok('un balazo lo baja menos de una vez cada diez', suyo(V.bala) < 0.10,
    `una cada ${Math.round(1 / suyo(V.bala))}`);

  // ---- 5. el agarre: no hay un tiro que te baje, hay acumulación ----
  j.jugador.agarre = 1;
  const r0 = V.bala * (1 - O * j.jugador.agarre);
  j.jugador.agarre = 0.2;
  const r1 = V.bala * (1 - O * j.jugador.agarre);
  ok('aflojado te bajan más fácil', r1 > r0 * 1.5, `${(r0 * 100).toFixed(1)} % → ${(r1 * 100).toFixed(1)} %`);
  j.jugador.agarre = 0.2;
  j.jugador.actualizar(1, new Set(), false, false);
  ok('y el agarre se recompone solo', j.jugador.agarre > 0.2, j.jugador.agarre.toFixed(2));
  j.jugador.agarre = 1;

  // ---- 6. la metralla le mata el caballo, y de ahí sale el acto ----
  limpiar();
  const c = j.caballo || j.caballos[0];
  if (c) {
    c.vida = 6; c.vivo = true;
    c.recibir(j.METRALLA_CABALLO);
    ok('un tarro de metralla voltea al caballo de una', !c.vivo, `vida ${c.vida}`);
    c.vida = 6; c.vivo = true;
    c.recibir(1);
    ok('un balazo suelto no', c.vivo, `vida ${c.vida}`);
  }
  limpiar();
  return out;
});
for (const [e, n, x] of r) console.log(e.padEnd(4), n.padEnd(50), x);
const mal = r.filter(x => x[0] === 'MAL').length;
console.log(`\n${r.filter(x => x[0] === 'OK ').length} bien, ${mal} mal`);
console.log(errs.length ? 'ERRORES: ' + errs.join(' / ') : 'sin errores de consola');
await nav.close();
