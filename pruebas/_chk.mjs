import { chromium } from 'playwright';
const nav = await chromium.launch({ executablePath: process.env.CHROMIUM,
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
const p = await nav.newPage({ viewport: { width: 800, height: 500 } });
await p.goto('http://localhost:8099/index.html', { waitUntil: 'load' });
await p.waitForTimeout(1500); await p.click('#modo-batalla'); await p.waitForTimeout(1500);
await p.click('#plano-entrar'); await p.waitForTimeout(3000);
console.log(await p.evaluate(() => {
  const j = window.juego;
  j.mando.teclas.add('KeyW'); j.mando.teclas.add('ShiftLeft');
  // contar de qué muere cada CABALLO
  const C = j.caballos[0].constructor.prototype;
  const causa = { metralla: 0, bala: 0, otro: 0 };
  const _rec = C.recibir;
  C.recibir = function (d, ...r) {
    const antes = this.vivo;
    const v = _rec.call(this, d, ...r);
    if (antes && !this.vivo) causa[d >= 20 ? 'metralla' : d <= 3 ? 'bala' : 'otro']++;
    return v;
  };
  const filas = [];
  for (let s = 0; s < 8; s++) {
    for (let i = 0; i < 60 * 12; i++) j.simular(1/60);
    const gr = j.soldados.filter(x => !x.esRealista && x.vivo);
    filas.push(`t=${(s+1)*12}s granaderos ${String(gr.length).padStart(3)} montados ${String(gr.filter(x=>x.montado).length).padStart(3)} · caballos muertos: metralla ${causa.metralla} bala ${causa.bala} otro ${causa.otro}`);
    if (!gr.length) break;
  }
  return filas.join('\n');
}));
await nav.close();
