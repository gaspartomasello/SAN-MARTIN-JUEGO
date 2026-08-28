// ===========================================================================
// EL DESBANDE · ¿cuándo se quiebra la línea, y con cuántos hombres en pie?
// ===========================================================================
//
// balance.mjs mide las tablas de daño y moral.mjs mide que flanquear sirva.
// Falta la pregunta del reloj, que es la que se hace el que juega: CUÁNTO DURA
// la batalla antes de que los realistas bajen la barranca.
//
// No alcanza con el tiempo. Una línea que se quiebra a los tres minutos con
// veinte hombres en pie no es San Lorenzo: es un exterminio que además tardó.
// Así que se anota el reloj Y la gente que quedaba parada en ese instante.
//
// Y se corre VARIAS VECES, porque esta batalla tiene mucho ruido: la misma
// tabla da corridas que se quiebran a los ciento cincuenta segundos y corridas
// que se empantanan. Una sola corrida no dice nada.
//
//   node pruebas/desbande.mjs            tres corridas
//   CORRIDAS=6 node pruebas/desbande.mjs seis
//   DIAG=1 node pruebas/desbande.mjs     una corrida, desglosada cada 15 s
//
// OJO CON LEER MAL EL PILOTO. Acá el jugador carga de frente al galope y sin
// disparar hasta que lo matan, que es lo peor que se puede hacer. Un jugador
// de verdad se lleva muchos más hombres y adelanta el quiebre: estos números
// son el piso, no lo que vas a ver jugando.
import { chromium } from 'playwright';
const nav = await chromium.launch({ executablePath: process.env.CHROMIUM,
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
const pag = await nav.newPage({ viewport: { width: 800, height: 540 } });
const errs = []; pag.on('pageerror', e => errs.push(e.message));
await pag.goto('http://localhost:8099/index.html', { waitUntil: 'load' });
await pag.waitForTimeout(1200); await pag.click('#modo-campo'); await pag.waitForTimeout(1800);

// EL DESGLOSE. La moral anota por hombre por qué le baja el ánimo (s.porQue).
// Promediado sobre los realistas vivos cada quince segundos, dice de una ojeada
// qué término está haciendo el trabajo y cuál está en cero —que es la única
// manera de ajustar esto sin adivinar. Y al lado va cuántos granaderos siguen
// MONTADOS, que es el dato que explica casi todo: sin jinetes no hay
// CABALLO_ENCIMA, y sin CABALLO_ENCIMA no se quiebra ninguna línea.
if (process.env.DIAG) {
  const filas = await pag.evaluate(async () => {
    const j = window.juego;
    j.campo.limpiarCampo(); j.jugador.revivir(); j.jugador.pos.set(0, 1.68, 0);
    j.formarPinza(60, 250); j.pinza.tocar();
    const salida = [];
    let t = 0, prox = 0;
    while (t < 300) {
      if (j.jugador.monta) {
        j.jugador.monta.andar = 3;
        j.jugador.monta.rumbo = Math.atan2(-j.jugador.monta.pos.x, -62 - j.jugador.monta.pos.z) + Math.PI;
      }
      j.simular(1 / 60); t += 1 / 60;
      if (t < prox) continue;
      prox = t + 15;
      const re = j.soldados.filter(s => s.esRealista && s.vivo && !s.quebrado);
      if (!re.length) break;
      const m = k => re.reduce((a, s) => a + ((s.porQue && s.porQue[k]) || 0), 0) / re.length;
      salida.push({
        t: Math.round(t),
        vivos: re.length,
        gr: j.soldados.filter(s => !s.esRealista && s.vivo).length,
        montados: j.soldados.filter(s => !s.esRealista && s.vivo && s.montado).length,
        animo: re.reduce((a, s) => a + s.animo, 0) / re.length,
        techo: re.reduce((a, s) => a + s.techo, 0) / re.length,
        flanco: m('flanco'), jinetes: m('jinetes'), solo: m('solo'),
        herido: m('herido'), rotos: m('rotos'),
        quebrados: j.soldados.filter(s => s.esRealista && s.vivo && s.quebrado).length
      });
    }
    j.campo.limpiarCampo();
    return salida;
  });
  console.log('  t  realistas granad montad   ánimo  techo | flanco jinetes  solo herido rotos | quebrados');
  for (const f of filas) {
    console.log(String(f.t).padStart(3) + '  ' +
      String(f.vivos).padStart(9) + String(f.gr).padStart(7) + String(f.montados).padStart(7) +
      f.animo.toFixed(1).padStart(8) + f.techo.toFixed(1).padStart(7) + ' |' +
      f.flanco.toFixed(2).padStart(7) + f.jinetes.toFixed(2).padStart(8) +
      f.solo.toFixed(2).padStart(6) + f.herido.toFixed(2).padStart(7) +
      f.rotos.toFixed(2).padStart(6) + ' |' + String(f.quebrados).padStart(10));
  }
  console.log(errs.length ? 'ERRORES: ' + errs.join(' / ') : 'sin errores de consola');
  await nav.close();
  process.exit(0);
}

const CORRIDAS = Number(process.env.CORRIDAS || 3);
const r = await pag.evaluate(async (CORRIDAS) => {
  const j = window.juego;
  const filas = [];
  for (let k = 0; k < CORRIDAS; k++) {
    j.campo.limpiarCampo(); j.jugador.revivir(); j.jugador.pos.set(0, 1.68, 0);
    j.formarPinza(60, 250); j.pinza.tocar();
    const gr0 = j.soldados.filter(s => !s.esRealista).length;
    const re0 = j.soldados.filter(s => s.esRealista).length;
    let t = 0, tRoto = -1, tRotoGr = -1, muerto = -1, enPie = -1, grEnPie = -1;
    while (t < 6 * 60) {
      if (j.jugador.monta) { j.jugador.monta.andar = 3;
        j.jugador.monta.rumbo = Math.atan2(-j.jugador.monta.pos.x, -62 - j.jugador.monta.pos.z) + Math.PI; }
      j.simular(1 / 60); t += 1 / 60;
      if (muerto < 0 && !j.jugador.vivo) muerto = t;
      const lr = j.moral.lineaRota;
      if (tRoto < 0 && lr.realista) {
        tRoto = t;
        enPie = j.soldados.filter(s => s.esRealista && s.vivo).length;
        grEnPie = j.soldados.filter(s => !s.esRealista && s.vivo).length;
      }
      if (tRotoGr < 0 && lr.granadero) tRotoGr = t;
      const re = j.soldados.filter(s => s.esRealista && s.vivo).length;
      const gr = j.soldados.filter(s => !s.esRealista && s.vivo).length;
      if (!re || !gr) break;
      if (tRoto > 0 && t > tRoto + 90) break;
    }
    const p = j.moral.parte();
    const muertosRe = re0 - p.realistas.vivos - 0;
    filas.push({
      quiebre: tRoto, quiebreGr: tRotoGr, fin: t, muerto, enPie, grEnPie,
      re0, gr0,
      reVivos: p.realistas.vivos, reRotos: p.realistas.rotos,
      grVivos: p.granaderos.vivos, grRotos: p.granaderos.rotos,
      idos: p.idos
    });
  }
  j.campo.limpiarCampo();
  return filas;
}, CORRIDAS);

const med = k => (r.reduce((a, f) => a + f[k], 0) / r.length);
for (const f of r) {
  console.log(`quiebre realista ${f.quiebre < 0 ? 'NUNCA' : f.quiebre.toFixed(0) + ' s'}` +
    ` · quiebre granadero ${f.quiebreGr < 0 ? 'no' : f.quiebreGr.toFixed(0) + ' s'}` +
    ` · fin ${(f.fin / 60).toFixed(1)} min` +
    ` · vos ${f.muerto < 0 ? 'vivo' : 'caíste ' + f.muerto.toFixed(0) + ' s'}` +
    ` · al quebrarse quedaban ${f.enPie}/${f.re0} realistas y ${f.grEnPie}/${f.gr0} granaderos` +
    ` · final: realistas ${f.reVivos} (${f.idos} se fueron)` +
    ` · granaderos ${f.grVivos}`);
}
console.log(`\nPROMEDIO quiebre ${med('quiebre').toFixed(0)} s · en pie al quebrarse ${med('enPie').toFixed(0)}/${r[0].re0} realistas y ${med('grEnPie').toFixed(0)}/${r[0].gr0} granaderos · muertos al final: realistas ${(r[0].re0 - med('reVivos') - med('idos')).toFixed(0)}, granaderos ${(r[0].gr0 - med('grVivos')).toFixed(0)}`);
console.log(errs.length ? 'ERRORES: ' + errs.join(' / ') : 'sin errores de consola');
await nav.close();
