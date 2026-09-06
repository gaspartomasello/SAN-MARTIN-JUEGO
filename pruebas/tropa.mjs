import { chromium } from 'playwright';
const SP = process.env.SP || 'tropa';
const nav = await chromium.launch({ executablePath: process.env.CHROMIUM,
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
const pag = await nav.newPage({ viewport: { width: 1280, height: 720 } });
pag.on('pageerror', e => console.log('[EXCEPCION]', e.message));
pag.on('console', m => { if (m.type() === 'error') console.log('[CONSOLA]', m.text()); });
await pag.goto('http://localhost:8099/index.html', { waitUntil: 'load' });
await pag.waitForTimeout(1200); await pag.click('#modo-campo'); await pag.waitForTimeout(1500);
const ev = (f, ...a) => pag.evaluate(f, ...a);

// una línea de seis realistas viniendo de frente
await ev(() => {
  const j = window.juego;
  j.jugador.pos.set(0, 1.68, 6); j.jugador.yaw = 0; j.jugador.pitch = -0.03;
  j.soldados.forEach(s => s.quitar()); j.soldados.length = 0;
  for (let i = 0; i < 6; i++) {
    j.soltarSoldado(i < 4 ? 'realista' : 'granadero');
    const s = j.soldados[j.soldados.length - 1];
    s.pos.set(-4.5 + i * 1.8, 0, -6 - (i % 2) * 1.5);
  }
});
await pag.waitForTimeout(4000);
await pag.screenshot({ path: SP + '/linea.png' });

const stats = await ev(() => new Promise(r => {
  const inicio = performance.now(); let n = 0;
  const t = () => { n++; if (performance.now() - inicio < 3000) requestAnimationFrame(t);
    else r({ fps: Math.round(n / ((performance.now() - inicio) / 1000)),
             estado: window.juego.soldados.map(s => s.estado + (s.avisando ? '!' : '')).join(' ') }); };
  requestAnimationFrame(t);
}));
console.log('fps:', stats.fps, '| estados:', stats.estado);
await pag.waitForTimeout(6000);
await pag.screenshot({ path: SP + '/choque.png' });

// ---------------------------------------------------------------------------
// EL TAMBOR Y EL ABANDERADO
// ---------------------------------------------------------------------------
// Los dos hombres por los que uno se mete adentro del grupo. Lo que se prueba
// acá es que se los pueda ENCONTRAR: que el paño se mueva —una chapa pintada
// clavada a un palo no se lee como una bandera— y sobre todo que ninguno de
// los dos se vaya al LOD de lejanía, que los dibuja con posturas horneadas de
// una figura genérica y les borra justo lo único por lo que se los busca.
const papeles = await ev(() => {
  const j = window.juego, o = {};
  j.soldados.forEach(s => s.quitar()); j.soldados.length = 0;
  const tam = j.soltarSoldado('realista', { papel: 'tambor' });
  const ab = j.soltarSoldado('realista', { papel: 'abanderado' });
  const raso = j.soltarSoldado('realista');

  o.trapos = ab.fig.h.trapo ? ab.fig.h.trapo.length : 0;
  o.rasoSinTrapos = !raso.fig.h.trapo && !tam.fig.h.trapo;

  // dónde queda la punta del paño, en el mundo
  const V = Object.getPrototypeOf(ab.pos).constructor;
  const punta = () => {
    ab.fig.raiz.updateMatrixWorld(true);
    return ab.fig.h.trapo[1].localToWorld(new V(0.29, 0, 0));
  };
  const correr = n => { for (let i = 0; i < n; i++) ab.fig.actualizar(1 / 60, false, 1); };
  correr(1); const a1 = punta().clone();
  correr(40); const a2 = punta().clone();
  correr(40); const a3 = punta().clone();
  o.ida = +a1.distanceTo(a2).toFixed(3);
  o.vuelta = +a2.distanceTo(a3).toFixed(3);
  o.neto = +a1.distanceTo(a3).toFixed(3);

  // y el LOD: se los manda al lejos y tienen que negarse
  for (const s of [tam, ab, raso]) s.ponerLejos(true);
  o.lejos = [tam.lejos, ab.lejos, raso.lejos];
  return o;
});
const T = [];
T.push([papeles.trapos === 2 ? 'OK ' : 'MAL', 'el paño se parte en tiras con hueso propio',
  `${papeles.trapos} huesos que se mueven`]);
T.push([papeles.rasoSinTrapos ? 'OK ' : 'MAL', 'y nadie más los tiene, que son 250 esqueletos', '']);
T.push([papeles.ida > 0.03 ? 'OK ' : 'MAL', 'la punta del paño se mueve, no es una chapa',
  `${papeles.ida} m en 0,67 s`]);
T.push([papeles.vuelta > 0.03 && papeles.neto < papeles.ida + papeles.vuelta ? 'OK ' : 'MAL',
  'y flamea: va y vuelve, no se va para un lado',
  `ida ${papeles.ida} · vuelta ${papeles.vuelta} · neto ${papeles.neto}`]);
T.push([papeles.lejos[0] === false && papeles.lejos[1] === false && papeles.lejos[2] === true ? 'OK ' : 'MAL',
  'ninguno de los dos se va nunca al LOD de lejos',
  `tambor=${papeles.lejos[0]} bandera=${papeles.lejos[1]} raso=${papeles.lejos[2]}`]);
for (const [e, n, x] of T) console.log(e.padEnd(4), n.padEnd(46), x);
const malT = T.filter(x => x[0] === 'MAL').length;
console.log(`\n${T.length - malT} bien, ${malT} mal`);
await nav.close();
process.exit(malT ? 1 : 0);
