import { chromium } from 'playwright';
const nav = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined,
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
const pag = await nav.newPage({ viewport: { width: 800, height: 600 } });
pag.on('pageerror', e => console.log('[EXCEPCION]', e.message));
await pag.goto((process.env.URL || 'http://localhost:8099') + '/index.html', { waitUntil: 'load' });
await pag.waitForTimeout(2000);

const r = await pag.evaluate(() => {
  const t = window.juego.arma;
  const dt = 1 / 120;
  function correr (jugarBien, presion) {
    // reiniciar el arma
    t.polvora = t.bala = t.cebado = t.amartillada = false;
    t.secuencia = ['cartucho','morder','cebar','polvora','bala','baqueta','amartillar'];
    t.paso = 0; t.tPaso = 0; t.penal = 0; t.marcado = null; t.cargando = true;
    let seg = 0, aciertos = 0, fallos = 0;
    for (let i = 0; i < 120 * 40 && !t.lista; i++) {
      const info = t.infoPaso();
      if (info && info.golpe && !t.marcado && jugarBien) {
        const [a, b] = info.ventana;
        if (info.progreso >= a + (b - a) * 0.3 && info.progreso <= b) t.golpe();
      }
      const antes = t.marcado;
      t.actualizar(dt, { apuntando: false, presion, penalCarga: 1, dispersion: 1 });
      if (t.marcado === 'bien' && antes !== 'bien') aciertos++;
      if (t.marcado === 'mal' && antes !== 'mal') fallos++;
      seg += dt;
    }
    return { seg: +seg.toFixed(2), lista: t.lista, aciertos, fallos };
  }
  const perfecto = correr(true, 0);
  const torpe = correr(false, 0);
  const bajoPresion = correr(true, 1);

  // disparo
  t.gatillo();
  for (let i = 0; i < 30; i++) t.actualizar(dt, { apuntando: false, presion: 0, penalCarga: 1, dispersion: 1 });
  const trasTiro = { etiqueta: t.etiquetaEstado, cargada: t.cargada, tiros: t.tiros, nubes: window.juego.humo.nubes.filter(n => n.viva).length };

  // retomar una carga a medias
  t.iniciarCarga();
  for (let i = 0; i < 120 * 5; i++) t.actualizar(dt, { apuntando: false, presion: 0, penalCarga: 1, dispersion: 1 });
  const mitad = { paso: t.paso, etiqueta: t.etiquetaEstado };
  t.soltarCarga();
  for (let i = 0; i < 120 * 3; i++) t.actualizar(dt, { apuntando: false, presion: 0, penalCarga: 1, dispersion: 1 });
  const trasSoltar = { paso: t.paso, igual: t.paso === mitad.paso };
  t.iniciarCarga();
  const retoma = { pasoAlRetomar: t.paso, secuencia: t.secuencia.length };

  // oclusión del humo
  const H = window.juego.humo;
  const T = window.THREE_TEST || null;
  H.soltar({ x: 0, y: 1.5, z: -10, clone(){return this;}, copy(){return this;} }, { x:0,y:0,z:-1, clone(){return this;}, multiplyScalar(){return this;} }, { cantidad: 2 });
  return { perfecto, torpe, bajoPresion, trasTiro, mitad, trasSoltar, retoma };
});
console.log(JSON.stringify(r, null, 2));
await nav.close();
