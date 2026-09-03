import { chromium } from 'playwright';
const nav = await chromium.launch({ executablePath: process.env.CHROMIUM,
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
const pag = await nav.newPage({ viewport: { width: 1280, height: 720 } });
pag.on('pageerror', e => console.log('[EXCEPCION]', e.message));
await pag.goto('http://localhost:8099/index.html', { waitUntil: 'load' });
await pag.waitForTimeout(1200); await pag.click('#modo-campo'); await pag.waitForTimeout(1500);

// cinco lanceros cruzando el campo al galope, vistos de costado
const r = await pag.evaluate(() => {
  const j = window.juego;
  j.soldados.forEach(s => s.quitar()); j.soldados.length = 0;
  for (const c of [...j.caballos]) { c.quitar(); j.caballos.splice(j.caballos.indexOf(c), 1); }
  j.jugador.pos.set(-4, 2.2, -33); j.jugador.yaw = Math.PI * 0.5; j.jugador.pitch = -0.02;
  for (let i = 0; i < 5; i++) {
    const s = j.soltarSoldado('granadero', { montado: true });
    s.monta.pos.set(-40 - i * 6, 0, -40 - (i % 3) * 6);
    s.monta.rumbo = -Math.PI / 2; s.monta.andar = 3; s.monta.vel = 10.2;
    s.actualizar = dt => { s.fig.poner('enristre'); s.fig.actualizar(dt, false);
      s.monta.actualizar(dt, {}); s.monta.actualizado = true; s._sentar(); };
  }
  // correr la simulación a mano: bajo swiftshader el bucle real va a 2 fps
  for (let i = 0; i < 60 * 3; i++) {
    for (const s of j.soldados) s.actualizar(1 / 60, j.jugador, j.soldados);
    j.humo.actualizar(1 / 60);
  }
  const n = j.humo.nubes.filter(x => x.viva && x.tierra > 0);
  const c = j.soldados[0] && j.soldados[0].monta;
  return { nubes: j.humo.vivas, tierra: n.length,
    caballoEn: c ? [+c.pos.x.toFixed(1), +c.pos.z.toFixed(1)] : null,
    polvoEn: n.length ? [+n[0].pos.x.toFixed(1), +n[0].pos.y.toFixed(1), +n[0].pos.z.toFixed(1)] : null };
});
await pag.waitForTimeout(900);
await pag.screenshot({ path: 'tropa/d-1-polvareda.png' });
console.log(JSON.stringify(r));
// ===========================================================================
// CHISPAS, Y LA SANGRE QUE SÓLO SALE SI LA PIDEN
// ===========================================================================
//
// Dos efectos que se agregaron juntos porque son el mismo sistema: un puñado
// de puntitos que salen de un sitio, caen y se apagan. Van en UN `Points` cada
// uno —una llamada de dibujo para las noventa y seis—, con el buffer reservado
// de una vez y las partículas recicladas: nada se crea mientras se juega.
//
// LA SANGRE VIENE APAGADA. Es la opción de la portada y la decisión de fondo:
// el juego que se abre por primera vez es apto para cualquiera. Lo que se
// prueba acá es que la puerta funcione en los DOS sentidos, porque una opción
// que no se puede apagar no es una opción, y una que no se puede encender
// tampoco.
const efectos = await pag.evaluate(() => {
  const j = window.juego, out = [];
  const ok = (n, c, x) => out.push([c ? 'OK ' : 'MAL', n, x === undefined ? '' : x]);
  const V = j.jugador.pos.constructor;
  const vivas = e => e.granos.filter(g => g.t >= 0).length;

  j.fuego.chispas(new V(0, 1.2, -2), new V(0, 1, 0));
  ok('el acero contra el acero suelta chispas', vivas(j.fuego.acero) > 8,
    `${vivas(j.fuego.acero)} chispas`);
  ok('y van todas en un solo Points', j.fuego.acero.malla.type === 'Points');

  // REDONDAS, NO CUADRADAS. `PointsMaterial` sin textura dibuja cada partícula
  // como un cuadrito plano —es lo que hace WebGL por defecto con los sprites de
  // punto— y salieron así a la calle una versión entera: chispas cuadradas y
  // gotas de sangre cuadradas. No se nota escribiéndolo, se nota jugando.
  const conMapa = [j.fuego.acero, j.fuego.sangre, j.fuego.pavesa]
    .filter(e => e.malla.material.map).length;
  ok('los tres enjambres tienen textura redonda, no el cuadrado de fábrica',
    conMapa === 3, `${conMapa} de 3`);

  // el blanco se pone donde la CÁMARA mira y a la distancia que ella mide: el
  // jugador puede estar montado y entonces la cámara no está donde él
  j.campo.limpiarCampo(); j.jugador.revivir(); j.jugador.pos.set(0, 1.68, 0);
  const mira = j.camara.getWorldDirection(new V());
  const donde = j.camara.position.clone().addScaledVector(mira, 1.6); donde.y = 0;
  const o = j.campo.soltarSoldado('realista', { pos: donde });
  const golpear = () => { const a = o.vida; j.combate.resolverGolpe(3.5, 1, 'prueba'); return a - o.vida; };

  const guardada = j.opciones.sangre;
  j.opciones.sangre = false;
  const pego = golpear();
  ok('el golpe de prueba conecta, que si no esto no prueba nada', pego > 0, `${pego} de vida`);
  ok('con la opción APAGADA no sale una gota', vivas(j.fuego.sangre) === 0,
    String(vivas(j.fuego.sangre)));

  j.opciones.sangre = true;
  o.vida = 99; o.vivo = true;
  golpear();
  ok('y encendida sí salpica', vivas(j.fuego.sangre) > 4, `${vivas(j.fuego.sangre)} gotas`);

  // LAS PAVESAS: los granos de pólvora que salen ardiendo por la boca, que es
  // lo que hace que un arma de chispa se vea sucia y no como un láser. Son
  // pocas por tiro a propósito —con quince y seiscientos cincuenta tiros por
  // batalla el enjambre viviría lleno y nunca se vería una apagarse— y el
  // enjambre tiene techo, así que una descarga entera no lo desborda.
  for (let i = 0; i < 60; i++) j.fuego.actualizar(0.05);
  j.fuego.disparo(new V(0, 1.5, -1), new V(0, 0, -1), 60);
  ok('el fogonazo tira pavesas', j.fuego.pavesa.granos.filter(g => g.t >= 0).length > 2,
    `${j.fuego.pavesa.granos.filter(g => g.t >= 0).length} pavesas`);
  for (let i = 0; i < 200; i++) j.fuego.disparo(new V(0, 1.5, -1), new V(0, 0, -1), 60);
  ok('y doscientos tiros seguidos no desbordan el enjambre',
    j.fuego.pavesa.granos.filter(g => g.t >= 0).length <= 96);

  // LA BALA QUE NO LE DIO A NADIE. Sin marca donde cae, apuntar y errar se ve
  // igual que no haber disparado, y no hay forma de corregir la puntería.
  //
  // Se CALCULA dónde corta el suelo, no se tira un rayo: el rayo del disparo
  // prueba contra soldados, blancos y piezas —el suelo no está ahí— y meter el
  // terreno adentro sería pagar un raycast más caro en cada tiro para dibujar
  // una nube. Y `humo.vivas` es un contador que se refresca en `actualizar`,
  // no al soltar: para verlo en el mismo instante hay que contar el pool.
  const nubesVivas = () => j.humo.nubes.filter(n => n.viva).length;
  const antesSuelo = nubesVivas();
  j.combate.resolverDisparo(new V(0, 1.7, 0), new V(0, -0.35, -1).normalize(), 0);
  ok('la bala que se va al suelo levanta tierra donde cae', nubesVivas() > antesSuelo,
    `${nubesVivas() - antesSuelo} nubes`);
  const antesCielo = nubesVivas();
  j.combate.resolverDisparo(new V(0, 1.7, 0), new V(0, 0.4, -1).normalize(), 0);
  ok('y la que se va al cielo no levanta nada', nubesVivas() === antesCielo);

  // EL CAÑONAZO. Era un 0,5 plano: una pieza a cien metros movía la cámara
  // igual que una a diez. El oído ya distinguía —sólo ensordece a menos de
  // cuarenta y cinco metros— así que la vista iba por detrás del oído.
  const sacudidas = [];
  const _sac = j.jugador.sacudir.bind(j.jugador);
  j.jugador.sacudir = f => { sacudidas.push(+f.toFixed(2)); return _sac(f); };
  const piezaA = d => ({ pos: new V(0, 0, -d), fuerzaSobre: () => 0 });
  j.jugador.pos.set(0, 1.68, 0);
  sacudidas.length = 0; j.combate.resolverMetralla(piezaA(8)); const cerca = sacudidas[0];
  sacudidas.length = 0; j.combate.resolverMetralla(piezaA(95)); const lejos = sacudidas[0];
  j.jugador.sacudir = _sac;
  ok('el cañón de cerca sacude mucho más que el de lejos', cerca > lejos * 2.5,
    `a 8 m ${cerca} · a 95 m ${lejos}`);

  // LAS MANCHAS. Son lo único de los efectos que SE QUEDA, y eso trae dos
  // problemas que las partículas no tienen: se acumulan, y tienen que seguir
  // al cuerpo donde están pegadas. Las dos cosas se prueban acá.
  const usadas = () => j.fuego._mancha.filter(m => m.usada).length;
  j.fuego.limpiarManchas();
  j.opciones.sangre = false;
  o.vida = 99; o.vivo = true; o.pos.copy(donde);
  golpear();
  ok('con la sangre apagada no queda ninguna marca', usadas() === 0, String(usadas()));

  j.opciones.sangre = true;
  o.vida = 99; o.vivo = true;
  golpear();
  ok('encendida, el golpe deja marca en el cuerpo', usadas() > 0, `${usadas()} manchas`);
  const pegada = j.fuego._mancha.find(m => m.usada && m.quien === o);
  ok('y la marca está pegada A ESE hombre', !!pegada);
  if (pegada) {
    const antesM = pegada.pos.clone();
    o.pos.x += 4; o.pos.z -= 3;
    j.fuego.actualizar(0.016);
    ok('la mancha camina con él', pegada.pos.distanceTo(antesM) > 3,
      `se movió ${pegada.pos.distanceTo(antesM).toFixed(1)} m`);
  }

  // EL TECHO. Sin él, doscientos cincuenta hombres recibiendo golpes terminan
  // siendo el juego entero: es lo único que separa esto de una fuga.
  for (let i = 0; i < 200; i++) j.fuego.mancharPiso(new V(Math.random() * 20, 0, Math.random() * 20), 0.4);
  ok('doscientas marcas no desbordan el techo de 44', usadas() <= 44, `${usadas()} de 44`);
  j.fuego.actualizar(0.016);
  // Son TRES instancias y no una: un `InstancedMesh` tiene una sola textura, y
  // con una sola forma veinte manchas en el piso son la misma calcomanía veinte
  // veces. Tres llamadas en el peor caso, ninguna si no hay manchas.
  const enInstancias = j.fuego.manchas.reduce((a, im) => a + im.count, 0);
  ok('van todas en instancias, no una malla por mancha',
    enInstancias === usadas() && j.fuego.manchas.every(im => im.isInstancedMesh),
    `${enInstancias} repartidas en ${j.fuego.manchas.length} formas`);
  ok('y las tres formas se usan, no siempre la misma',
    new Set(j.fuego._mancha.filter(m => m.usada).map(m => m.forma)).size >= 2,
    [...new Set(j.fuego._mancha.filter(m => m.usada).map(m => m.forma))].join(','));
  j.fuego.limpiarManchas();
  ok('rearmar el campo las barre', usadas() === 0, String(usadas()));
  j.opciones.sangre = guardada;

  for (let i = 0; i < 90; i++) j.fuego.actualizar(0.016);
  ok('todo se apaga solo, no queda nada colgado',
    vivas(j.fuego.acero) === 0 && vivas(j.fuego.sangre) === 0 && vivas(j.fuego.pavesa) === 0);
  ok('y el Points se esconde cuando no queda ninguna',
    !j.fuego.acero.malla.visible && !j.fuego.sangre.malla.visible && !j.fuego.pavesa.malla.visible);
  return out;
});
console.log('');
for (const [e, n, x] of efectos) console.log(e.padEnd(4), n.padEnd(54), x);
const malE = efectos.filter(x => x[0] === 'MAL').length;
console.log(`\n${efectos.filter(x => x[0] === 'OK ').length} bien, ${malE} mal`);
await nav.close();
process.exit(malE ? 1 : 0);
