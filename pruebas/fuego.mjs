// ===========================================================================
// EL FUEGO DE ELLOS · ¿los realistas disparan, y cuándo?
// ===========================================================================
//
// Jugando no se ve una descarga. Puede ser por cuatro motivos distintos y hay
// que separarlos antes de tocar un número:
//
//   1. nunca llegan a 'apuntar'  → se van a la bayoneta antes
//   2. llegan y no aprietan      → _lineaLibre() les tapa el tiro
//   3. aprietan y no le pegan a nadie → puntería
//   4. disparan pero no se ve    → humo, sonido, o que le tiran a otro
//
// Así que se cuenta cada paso por separado: intentos de apuntar, vetos de la
// línea, tiros efectivos, y aciertos por franja de distancia.
import { chromium } from 'playwright';
const nav = await chromium.launch({ executablePath: process.env.CHROMIUM,
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
const pag = await nav.newPage({ viewport: { width: 800, height: 540 } });
const errs = []; pag.on('pageerror', e => errs.push(e.message));
await pag.goto('http://localhost:8099/index.html', { waitUntil: 'load' });
await pag.waitForTimeout(1200); await pag.click('#modo-campo'); await pag.waitForTimeout(1800);

const r = await pag.evaluate(async () => {
  const j = window.juego;
  j.campo.limpiarCampo(); j.jugador.revivir(); j.jugador.pos.set(0, 1.68, 0);
  j.formarPinza(60, 250); j.pinza.tocar();

  const P = j.soldados[0].constructor.prototype;
  const c = { encarar: 0, veto: 0, tiro: 0, distancias: [], estados: [],
              baja: {}, desmonte: {} };

  // QUÉ MATA A LOS GRANADEROS. Dos veces se ajustó este balance adivinando la
  // causa y las dos veces la adivinanza estaba mal. El daño se aplica dentro
  // de _descargar (bala) y de _acero (bayoneta), y las dos son síncronas: si
  // se marca quién está pegando justo antes de llamar, recibir() sabe de qué
  // murió. Sin esto, "los granaderos se evaporan" no es un diagnóstico.
  let causa = 'otra';
  const marcar = (nombre, m) => function (...a) {
    const antes = causa; causa = nombre;
    try { return m.apply(this, a); } finally { causa = antes; }
  };
  P._acero = marcar('acero', P._acero);

  const _rec = P.recibir;
  P.recibir = function (...a) {
    const montado = this.montado;
    const murio = _rec.apply(this, a);
    if (this.esRealista) return murio;
    if (murio) c.baja[causa] = (c.baja[causa] || 0) + 1;
    else if (montado && !this.montado) c.desmonte[causa] = (c.desmonte[causa] || 0) + 1;
    return murio;
  };

  const _mirar = P._mirarLinea;
  P._mirarLinea = function () { const v = _mirar.call(this); if (!v) c.veto++; return v; };
  const _enc = P._encarar;
  P._encarar = function (k) { if (this.esRealista) c.encarar++; return _enc.call(this, k); };
  const _des = P._descargar;
  P._descargar = marcar('bala', function () {
    if (this.esRealista) {
      c.tiro++;
      c.distancias.push(Math.hypot(this.objetivo.pos.x - this.pos.x, this.objetivo.pos.z - this.pos.z));
    }
    return _des.call(this);
  });

  let t = 0, prox = 0;
  while (t < 240) {
    if (j.jugador.monta) {
      j.jugador.monta.andar = 3;
      j.jugador.monta.rumbo = Math.atan2(-j.jugador.monta.pos.x, -62 - j.jugador.monta.pos.z) + Math.PI;
    }
    j.simular(1 / 60); t += 1 / 60;
    if (t < prox) continue;
    prox = t + 20;
    const re = j.soldados.filter(s => s.esRealista && s.vivo && !s.quebrado);
    if (!re.length) break;
    const por = {};
    for (const s of re) por[s.estado] = (por[s.estado] || 0) + 1;
    c.estados.push({ t: Math.round(t), vivos: re.length, ...por });
  }
  c.seg = t;
  return c;
});
await nav.close();
if (errs.length) console.log('ERRORES:', errs.slice(0, 3));

console.log(`\n${r.seg.toFixed(0)} s de batalla`);
console.log(`  encararon el fusil ....... ${r.encarar}`);
console.log(`  vetos de línea propia .... ${r.veto}`);
console.log(`  TIROS EFECTIVOS .......... ${r.tiro}`);
const d = r.distancias;
if (d.length) {
  d.sort((a, b) => a - b);
  console.log(`  distancia de tiro ........ mediana ${d[d.length >> 1].toFixed(1)} m · máx ${d[d.length - 1].toFixed(1)} m`);
}
const tot = o => Object.values(o).reduce((a, b) => a + b, 0);
const linea = o => Object.entries(o).sort((a, b) => b[1] - a[1])
  .map(([k, v]) => `${k} ${v}`).join(' · ') || 'ninguna';
console.log(`\n  GRANADEROS`);
console.log(`  bajas por causa .......... ${tot(r.baja)} · ${linea(r.baja)}`);
console.log(`  desmontes por causa ...... ${tot(r.desmonte)} · ${linea(r.desmonte)}`);
console.log('\n  t   vivos  estados');
for (const e of r.estados) {
  const { t, vivos, ...st } = e;
  console.log(`  ${String(t).padStart(3)}  ${String(vivos).padStart(4)}   ` +
    Object.entries(st).map(([k, v]) => `${k}:${v}`).join('  '));
}
