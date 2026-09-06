import { chromium } from 'playwright';
const nav = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined,
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
const pag = await nav.newPage({ viewport: { width: 800, height: 600 } });
pag.on('pageerror', e => console.log('[EXCEPCION]', e.message));
await pag.goto((process.env.URL || 'http://localhost:8099') + '/index.html', { waitUntil: 'load' });
await pag.waitForFunction(() => !!window.juego, null, { timeout: 90000 });

const r = await pag.evaluate(() => {
  const t = window.juego.arma;
  const dt = 1 / 120;
  function correr (presion) {
    // Reiniciar el arma pidiéndoselo AL ARMA, no copiando su secuencia acá.
    // Estaban escritos a mano los siete pasos del reglamento, y el día que la
    // carga pasó a cuatro esta prueba siguió pidiendo pasos que ya no existen.
    // Una prueba que repite por su cuenta lo que prueba deja de probarlo.
    t.dejarDescargada();
    t.cargando = true;
    let seg = 0;
    for (let i = 0; i < 120 * 40 && !t.lista; i++) {
      t.actualizar(dt, { apuntando: false, presion, penalCarga: 1, dispersion: 1 });
      seg += dt;
    }
    return { seg: +seg.toFixed(2), lista: t.lista };
  }
  // EL MINIJUEGO YA NO ESTÁ, y esto es lo que lo mantiene afuera. Había una
  // ventana por paso, el cartel ¡AHORA! y un click que adelantaba el paso o
  // cobraba nueve décimas; la carga tardaba distinto según qué tan bien lo
  // jugaras. Ahora tarda lo mismo siempre, que es lo que se pidió.
  const sinMinijuego = {
    noHayGolpe: typeof t.golpe !== 'function',
    noHayVentana: !!(() => { t.dejarDescargada(); t.cargando = true;
      t.actualizar(dt, { apuntando: false, presion: 0, penalCarga: 1, dispersion: 1 });
      const i = t.infoPaso();
      return i && i.ventana === undefined && i.marcado === undefined && i.golpe === undefined;
    })()
  };
  const tranquilo = correr(0);
  const bajoPresion = correr(1);
  sinMinijuego.tardaLoMismo = Math.abs(tranquilo.seg - bajoPresion.seg) < 0.05;

  // LA CARGA SOLA. Tres cosas distintas y las tres importan: que avance con el
  // arma GUARDADA —si no, el sable y las riendas te dejan con el caño vacío—,
  // que no cobre torpeza por no marcar el ritmo —no estás mirando el arma— y
  // que a pie con el arma en la mano NO pase nada de eso, que es donde el
  // minijuego vale.
  function sola (guardada, penalCarga = 1) {
    t.dejarDescargada();
    t.guardada = guardada;
    t.cargando = false;
    let seg = 0;
    for (let i = 0; i < 120 * 40 && !t.lista; i++) {
      t.actualizar(dt, { apuntando: false, presion: 0, penalCarga, dispersion: 1, sola: true });
      seg += dt;
    }
    const r = { seg: +seg.toFixed(2), lista: t.lista };
    t.guardada = false;
    return r;
  }
  const solaGuardada = sola(true);
  const solaEnMano = sola(false);
  // AL GALOPE TIENE QUE SEGUIR SIENDO TRES. penalCargaMontado vale 3,4 a galope
  // y multiplicaba el ciclo hasta diez segundos: el número pedido dejaba de ser
  // el número que pasa. La carga sola lo ignora; la de a mano no.
  const solaAlGalope = sola(false, 3.4);
  const aManoAlGalope = (() => {
    t.dejarDescargada(); t.cargando = true;
    let seg = 0;
    for (let i = 0; i < 120 * 40 && !t.lista; i++) {
      t.actualizar(dt, { apuntando: false, presion: 0, penalCarga: 3.4, dispersion: 1, sola: false });
      seg += dt;
    }
    return { seg: +seg.toFixed(2), lista: t.lista };
  })();

  // y a mano, guardada, no arranca sola ni loca
  t.dejarDescargada(); t.guardada = true; t.cargando = false;
  let segAMano = 0;
  for (let i = 0; i < 120 * 8; i++) {
    t.actualizar(dt, { apuntando: false, presion: 0, penalCarga: 1, dispersion: 1, sola: false });
    segAMano += dt;
  }
  const aMano = { arrancoSola: t.cargando, lista: t.lista };
  t.guardada = false;

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
  return { sinMinijuego, tranquilo, bajoPresion, solaGuardada, solaEnMano, solaAlGalope, aManoAlGalope, aMano,
    trasTiro, mitad, trasSoltar, retoma };
});
console.log(JSON.stringify(r, null, 2));
for (const [q, bien] of [
  ['el arma ya no tiene golpe de tiempo', r.sinMinijuego.noHayGolpe],
  ['el paso ya no informa ventana ni marca', r.sinMinijuego.noHayVentana],
  ['la carga tarda lo mismo con y sin presión', r.sinMinijuego.tardaLoMismo],
  ['y siempre termina', r.tranquilo.lista && r.bajoPresion.lista]
]) console.log((bien ? 'OK   ' : 'MAL  ') + q);
await nav.close();
