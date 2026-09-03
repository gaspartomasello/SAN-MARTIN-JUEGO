import { chromium } from 'playwright';
const nav = await chromium.launch({ executablePath: process.env.CHROMIUM,
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
const pag = await nav.newPage({ viewport: { width: 900, height: 700 } });
const errs = [];
pag.on('pageerror', e => errs.push(e.message));
await pag.goto('http://localhost:8099/index.html', { waitUntil: 'load' });
await pag.waitForFunction(() => !!window.juego, null, { timeout: 90000 }); await pag.click('#modo-campo'); await pag.waitForTimeout(1400);

const r = await pag.evaluate(() => {
  const j = window.juego;
  const out = {};
  // sable en mano
  dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit2' }));

  const poner = () => {
    j.soldados.forEach(s => s.quitar()); j.soldados.length = 0;
    j.soltarSoldado('realista');
    const s = j.soldados[0];
    const v = j.jugador.pos.clone();
    j.camara.getWorldDirection(v);
    s.pos.copy(j.jugador.pos).addScaledVector(v, 1.5); s.pos.y = 0;
    s.estado = 'acero'; s.tAcero = 0; s.aturdido = 0; s.vida = 2;
    return s;
  };
  const sano = () => { j.jugador.vida = 100; j.jugador.aliento = 100; j.sable.tRemate = 0;
    j.sable.bajarGuardia(); j.sable.tParada = -1; j.sable.t = -1; };

  // A · guardia alzada en el momento → parada perfecta
  let s = poner(); sano();
  j.sable.alzarGuardia();
  s.alGolpear(s, { jugador: true });
  out.perfecta = { vida: j.jugador.vida, aturdido: +(s.aturdido > 0), remate: +(j.sable.tRemate > 0) };

  // B · guardia vieja → bloqueo: no te clava, pero te cuesta aliento
  s = poner(); sano();
  j.sable.alzarGuardia(); j.sable.tGuardia = 0.9;
  s.alGolpear(s, { jugador: true });
  out.bloqueo = { vida: j.jugador.vida, aliento: Math.round(j.jugador.aliento), aturdido: +(s.aturdido > 0) };

  // C · sin guardia → bayonetazo entero
  s = poner(); sano();
  s.alGolpear(s, { jugador: true });
  out.abierto = { vida: j.jugador.vida };

  // D · sablazo contra un realista en guardia → choca el acero
  s = poner(); sano();
  s.tAcero = 0.1;
  out.enGuardia = { cubierto: +s.cubierto };
  j.sable.alGolpear();
  out.contraGuardia = { vidaEnemigo: s.vida };

  // E · sablazo cuando ya está comprometido en el aviso → entra
  s = poner(); sano();
  s.tAcero = 0.9; s.avisando = true;
  out.avisando = { cubierto: +s.cubierto };
  j.sable.alGolpear();
  out.contraAviso = { vidaEnemigo: s.vida, muerto: +!s.vivo };

  // F · remate: pasa por encima de la guardia
  s = poner(); sano();
  s.tAcero = 0.1;
  j.sable.tRemate = 0.5;
  j.sable.tajo();
  const fueRemate = j.sable.remate;
  j.sable.alGolpear();
  out.remate = { fueRemate: +fueRemate, vidaEnemigo: s.vida, muerto: +!s.vivo };

  // G · pechada: no hiere, pero lo abre y lo empuja
  s = poner(); sano();
  s.tAcero = 0.1;
  const antes = s.pos.distanceTo(j.jugador.pos);
  dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyF' }));
  out.pechada = { vidaEnemigo: s.vida, aturdido: +(s.aturdido > 0),
    empujo: +(s.pos.distanceTo(j.jugador.pos) > antes + 0.3),
    aliento: Math.round(j.jugador.aliento) };

  // H · la guardia se cae sola sin aliento
  sano(); j.jugador.aliento = 3;
  j.sable.alzarGuardia();
  out.antesDeCansarse = +j.sable.guardia;
  return out;
});
for (const [k, v] of Object.entries(r)) console.log(k.padEnd(16), JSON.stringify(v));

// ===========================================================================
// EL ARCO DEL SABLE, Y LAS MANGAS QUE SE CORTABAN
// ===========================================================================
//
// Dos cosas que se ven jugando y que ninguna prueba miraba.
//
// EL TAJO ERA HORIZONTAL. La animación tenía un solo reloj —un seno que va y
// vuelve— y con una función simétrica el sable sale, cruza y regresa por donde
// vino: en la pantalla eso es una raya. Un tajo empieza arriba y termina
// abajo. Se mide la punta de la hoja respecto del puño, que es la única forma
// honesta de saber para dónde fue: los ángulos son tres rotaciones compuestas
// y no se leen de un vistazo.
//
// Y DESDE LA SILLA TIENE QUE CAER MÁS, porque estás dos metros por encima del
// que tenés adelante.
const arco = await pag.evaluate(() => {
  const j = window.juego, s = j.sable, V = j.jugador.pos.constructor;
  const hoja = s.grupo.children.find(c => c.geometry && c.geometry.attributes.position.count > 60);
  const a = hoja.geometry.attributes.position;
  const punta = new V(a.getX(a.count - 1), a.getY(a.count - 1), a.getZ(a.count - 1));
  const altura = () => {
    s.actualizar(0.0001); s.grupo.updateMatrixWorld(true);
    return punta.clone().applyMatrix4(hoja.matrixWorld).y - s.grupo.getWorldPosition(new V()).y;
  };
  const correr = (montado, zurdo) => {
    s.guardado = false; s.grupo.visible = true; s.t = -1; s.tRemate = 0;
    s.zurdo = !zurdo;                 // tajo() lo invierte
    s.tajo(montado);
    // en `u = 1` clavado el tajo YA terminó —`actualizar` lo da por cerrado y
    // devuelve el reposo—, así que el final se mide un pelo antes
    s.t = 0; const desde = altura();
    s.t = s.duracion * 0.95; const hasta = altura();
    s.t = -1;
    return { desde: +desde.toFixed(2), hasta: +hasta.toFixed(2) };
  };
  return { tajo: correr(false, false), reves: correr(false, true),
    tajoSilla: correr(true, false), revesSilla: correr(true, true) };
});
const out = [];
const ok = (n, c, x) => out.push([c ? 'OK ' : 'MAL', n, x === undefined ? '' : x]);
const cae = k => `${arco[k].desde} → ${arco[k].hasta}`;
ok('el tajo NO es horizontal: la punta arranca arriba y termina abajo',
  arco.tajo.hasta < arco.tajo.desde - 0.25, cae('tajo'));
ok('y el revés a pie sube, que para eso son dos tajos distintos',
  arco.reves.hasta > arco.reves.desde - 0.10, cae('reves'));
ok('desde la silla el tajo cae MÁS que a pie',
  arco.tajoSilla.hasta < arco.tajo.hasta - 0.05,
  `a pie ${arco.tajo.hasta} · montado ${arco.tajoSilla.hasta}`);
ok('y desde la silla el revés también cae, porque arriba no hay nadie',
  arco.revesSilla.hasta < arco.reves.hasta - 0.30, cae('revesSilla'));

// LAS MANGAS. Eran antebrazos de largo fijo colgados del grupo del arma, así
// que al salir el arma para adelante en un culatazo —treinta y cuatro
// centímetros— el brazo se iba con ella y el codo se despegaba del hombro: la
// manga terminaba en el aire. Ahora unen la muñeca con el hombro, se apuntan y
// se estiran, que es lo que el sable ya hacía.
const mangas = await pag.evaluate(async () => {
  const j = window.juego, V = j.jugador.pos.constructor;
  dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit1' }));
  await new Promise(r => setTimeout(r, 350));
  const a = j.arma;
  if (!a || !a.brazos || !a.brazos.length) return { hay: 0 };
  const hueco = () => {
    a._acomodarBrazos();
    let peor = 0;
    for (const b of a.brazos) {
      b.updateMatrixWorld(true);
      const punta = new V(0, 0, 1).applyMatrix4(b.matrixWorld);
      peor = Math.max(peor, punta.distanceTo(b.userData.hombro));
    }
    return +peor.toFixed(3);
  };
  const quieto = hueco();
  a.tGolpe = a.cfg.golpe.dur * 0.5;          // en pleno culatazo, el arma adelante
  for (let i = 0; i < 6; i++) a._animar(1 / 60);
  const pegando = hueco();
  a.tGolpe = -1;
  return { hay: a.brazos.length, quieto, pegando };
});
ok('el arma tiene sus dos brazos, y van aparte del arma', mangas.hay === 2, String(mangas.hay));
ok('la manga llega al hombro estando quieto', mangas.quieto < 0.02, `${mangas.quieto} m de hueco`);
ok('y TAMBIÉN en pleno culatazo, que es donde se cortaba',
  mangas.pegando < 0.02, `${mangas.pegando} m de hueco`);

console.log('');
for (const [e, n, x] of out) console.log(e.padEnd(4), n.padEnd(58), x);
const mal = out.filter(x => x[0] === 'MAL').length;
console.log(`\n${out.filter(x => x[0] === 'OK ').length} bien, ${mal} mal`);
console.log(errs.length ? 'ERRORES: ' + errs.join(' / ') : '\nsin errores de consola');
await nav.close();
process.exit(mal ? 1 : 0);
