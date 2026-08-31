// EL OÍDO. Cinco cosas que no se ven y por eso nadie las mira hasta que
// suenan mal:
//
//   1. que un fusil a ochenta metros no suene igual que uno al lado —y que a
//      doscientos no suene—;
//   2. que el tiro de la fila de atrás NO te deje sordo, que era el bicho:
//      con seiscientos cincuenta tiros por batalla el filtro de aturdimiento
//      se reponía a los dos segundos y el tiro siguiente lo volvía a cerrar,
//      así que el juego entero sonaba tapado en pleno tiroteo;
//   3. que el corazón sólo se oiga cuando estás mal, y más rápido cuanto peor;
//   4. que cada andar tenga SU compás, y que el galope tenga el silencio del
//      salto —sin eso es un trote apurado—;
//   5. que morirse apague el sonido en los mismos segundos que la vista.
import { chromium } from 'playwright';

const nav = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox',
    '--autoplay-policy=no-user-gesture-required'] });
const pag = await nav.newPage({ viewport: { width: 700, height: 460 } });
pag.on('pageerror', e => console.log('[EXCEPCION]', e.message));
await pag.goto((process.env.URL || 'http://localhost:8099') + '/index.html', { waitUntil: 'load' });
await pag.waitForFunction(() => !!(window.juego && window.juego.sonido), null, { timeout: 90000 });

const r = await pag.evaluate(() => {
  const out = [];
  const ok = (n, cond, extra) => out.push([cond ? 'OK ' : 'MAL', n, extra === undefined ? '' : extra]);
  const s = window.juego.sonido;
  s.iniciar();

  // ---- el espía: en vez de escuchar, se mira qué se manda a sonar ----
  const visto = { ruidos: [], tonos: [], latidos: 0, cascos: [], pitidos: 0, rampas: [] };
  const _r = s._ruido.bind(s), _t = s._tono.bind(s);
  s._ruido = (dur, gan, tipo, frec, q, op) => { visto.ruidos.push({ gan, frec, cuando: (op && op.cuando) || 0 }); return _r(dur, gan, tipo, frec, q, op); };
  s._tono = (f, ff, dur, gan, tipo, op) => { visto.tonos.push({ gan, cuando: (op && op.cuando) || 0 }); return _t(f, ff, dur, gan, tipo, op); };
  const _l = s._latido.bind(s), _c = s._casco.bind(s);
  s._latido = f => { visto.latidos++; _l(f); };
  s._casco = (f, p) => { visto.cascos.push(visto.reloj); };
  // el pitido es el único oscilador que va a `interno`: se lo cuenta ahí
  const _con = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function (d) { if (d === s.interno) visto.internos = (visto.internos || 0) + 1; return _con.call(this, d); };
  const _exp = AudioParam.prototype.exponentialRampToValueAtTime;
  AudioParam.prototype.exponentialRampToValueAtTime = function (v, t) {
    if (this === s.apagon.gain) visto.rampas.push({ v: +v.toFixed(5), t: +(t - s.t).toFixed(2) });
    return _exp.call(this, v, t);
  };
  const limpiar = () => { visto.ruidos = []; visto.tonos = []; visto.latidos = 0; visto.cascos = []; visto.internos = 0; visto.rampas = []; };
  const fuerzaTotal = () => visto.ruidos.concat(visto.tonos).reduce((a, x) => a + x.gan, 0);

  // =======================================================================
  // 1 · LA DISTANCIA
  // =======================================================================
  s.oir({ x: 0, y: 1.7, z: 0 });
  limpiar(); s.disparo(); const propio = fuerzaTotal();
  limpiar(); s.disparo({ x: 0, y: 1.7, z: 12 }); const cerca = fuerzaTotal();
  limpiar(); s.disparo({ x: 0, y: 1.7, z: 70 }); const lejos = fuerzaTotal();
  const retardoLejos = Math.max(...visto.ruidos.map(x => x.cuando));
  limpiar(); s.disparo({ x: 0, y: 1.7, z: 200 }); const fuera = visto.ruidos.length + visto.tonos.length;

  ok('el tiro propio suena entero', propio > 2, propio.toFixed(2));
  ok('a doce metros ya pesa la mitad o menos', cerca < propio * 0.55 && cerca > 0,
    `${propio.toFixed(2)} → ${cerca.toFixed(2)}`);
  ok('a setenta metros es un eco', lejos < cerca * 0.35, `${cerca.toFixed(2)} → ${lejos.toFixed(2)}`);
  ok('y tarda en llegar, porque el sonido viaja', retardoLejos > 0.19,
    `${retardoLejos.toFixed(2)} s para 70 m`);
  ok('a doscientos metros no se programa nada', fuera === 0, String(fuera));

  // =======================================================================
  // 2 · DISPARAR NO TOCA EL OÍDO
  // =======================================================================
  // Hubo un pitido de oído acá y duró una versión: sonaba en CADA tiro propio,
  // o sea cada tres segundos durante quince minutos, y cualquier cosa que suene
  // en cada tiro deja de ser un efecto y pasa a ser el juego.
  //
  // Y abajo de eso estaba el bicho que esta prueba cuida de verdad: `disparo`
  // cerraba el filtro de aturdimiento SIEMPRE, viniera de donde viniera. Con
  // seiscientos cincuenta tiros por batalla se reponía a los dos segundos y el
  // siguiente lo volvía a cerrar: el juego entero sonaba tapado en el tiroteo.
  //
  // Así que la regla ahora es una sola y es fácil de mirar: NINGÚN disparo
  // toca el oído. Sólo lo que te pasa a vos.
  let sordeces = 0;
  const _e = s.ensordecer.bind(s);
  s.ensordecer = f => { sordeces++; return _e(f); };

  limpiar(); sordeces = 0;
  s.disparo();                                       // el tuyo, pegado a la oreja
  ok('tu propio tiro no te deja sordo', sordeces === 0, String(sordeces));
  for (let i = 0; i < 40; i++) s.disparo({ x: (i % 20) - 10, y: 1.5, z: 25 + i });
  ok('ni cuarenta de la tropa', sordeces === 0, String(sordeces));
  s.disparo({ x: 0, y: 1.7, z: 2 });
  ok('ni el que te pasa al lado', sordeces === 0, String(sordeces));

  sordeces = 0;
  s.golpeRecibido(1.25);
  ok('pero que te bajen del caballo, sí', sordeces === 1, String(sordeces));
  sordeces = 0;
  s.canon({ x: 0, y: 1, z: 10 });
  ok('y una pieza a diez metros, también', sordeces === 1, String(sordeces));
  sordeces = 0;
  s.canon({ x: 0, y: 1, z: 110 });
  ok('la misma pieza a ciento diez metros, no', sordeces === 0, String(sordeces));

  // =======================================================================
  // 3 · EL CORAZÓN
  // =======================================================================
  const latidosEn = (vida, seg) => {
    limpiar();
    s.faseCorazon = 0;
    const dt = 1 / 60;
    for (let i = 0; i < seg / dt; i++) s.actualizar(dt, { vida, vivo: true, montado: false, vel: 0 });
    return visto.latidos / seg;
  };
  const sano = latidosEn(100, 4);
  const tocado = latidosEn(40, 4);
  const alBorde = latidosEn(6, 4);
  ok('sano no se oye el corazón', sano === 0, String(sano));
  // EL CORAZÓN VA POR DENTRO. `interno` esquiva la sordina y el filtro, así que
  // un golpe cerca te tapa el mundo y no te tapa el pulso. Sacado el pitido,
  // es lo único que sale por ahí, y por eso se puede contar.
  ok('y sale por dentro, no por la mezcla del campo', (visto.internos || 0) > 0,
    `${visto.internos || 0} nodos a interno`);
  ok('herido late', tocado > 0.9 && tocado < 2.4, `${(tocado * 60).toFixed(0)} por minuto`);
  ok('y al borde late más rápido', alBorde > tocado * 1.3,
    `${(tocado * 60).toFixed(0)} → ${(alBorde * 60).toFixed(0)} por minuto`);
  s.muriendo = true;
  const muriendo = latidosEn(0, 4);
  s.muriendo = false;
  ok('muriéndote afloja, no se acelera', muriendo < alBorde * 0.75,
    `${(alBorde * 60).toFixed(0)} → ${(muriendo * 60).toFixed(0)} por minuto`);

  // =======================================================================
  // 4 · LOS CASCOS, Y EL SILENCIO DEL GALOPE
  // =======================================================================
  const cascosA = (vel, seg) => {
    limpiar();
    s.faseCasco = 0; s.ultimoCasco = -1;
    const dt = 1 / 120;
    visto.reloj = 0;
    for (let i = 0; i < seg / dt; i++) {
      visto.reloj += dt;
      s.actualizar(dt, { vida: 100, vivo: true, montado: true, vel });
    }
    const golpes = visto.cascos.slice();
    const huecos = [];
    for (let i = 1; i < golpes.length; i++) huecos.push(golpes[i] - golpes[i - 1]);
    return { por: golpes.length / seg, huecos };
  };
  const quieto = cascosA(0, 2);
  const paso = cascosA(1.9, 4);
  const trote = cascosA(4.6, 4);
  const galope = cascosA(9.5, 4);
  ok('parado no suena ningún casco', quieto.por === 0, String(quieto.por));
  ok('al paso son cuatro por zancada', paso.por > 2.5 && paso.por < 4.5,
    `${paso.por.toFixed(1)} por segundo`);
  ok('al trote, menos golpes que al paso', trote.por < paso.por,
    `paso ${paso.por.toFixed(1)} · trote ${trote.por.toFixed(1)}`);
  ok('al galope, más que al trote', galope.por > trote.por,
    `trote ${trote.por.toFixed(1)} · galope ${galope.por.toFixed(1)}`);
  // EL SILENCIO ES EL GALOPE. Cuatro golpes apretados y después el salto, en
  // el que el animal está entero en el aire. Si los huecos son todos iguales
  // no es un galope: es un trote apurado.
  const desparejo = (h) => Math.max(...h) / Math.min(...h);
  ok('el galope tiene el silencio del salto', desparejo(galope.huecos) > 2.2,
    `hueco mayor / menor = ${desparejo(galope.huecos).toFixed(1)}`);
  ok('y el trote no: va parejo', desparejo(trote.huecos) < 1.6,
    `${desparejo(trote.huecos).toFixed(2)}`);

  // =======================================================================
  // 5 · MORIRSE
  // =======================================================================
  limpiar();
  s.morir(7);
  const apaga = visto.rampas.filter(x => x.v < 0.01)[0];
  ok('la muerte apaga el sonido', !!apaga, JSON.stringify(visto.rampas));
  ok('y tarda lo mismo que la vista en cerrarse', apaga && apaga.t > 5.5 && apaga.t <= 7,
    apaga ? `${apaga.t} s de 7` : '—');
  ok('y el corazón queda muriéndose', s.muriendo === true);
  limpiar();
  s.revivir();
  const vuelve = visto.rampas.filter(x => x.v > 0.5)[0];
  ok('y volver en pie lo devuelve', !!vuelve && s.muriendo === false,
    vuelve ? `a ${vuelve.v} en ${vuelve.t} s` : '—');

  AudioNode.prototype.connect = _con;
  AudioParam.prototype.exponentialRampToValueAtTime = _exp;
  return out;
});

// ===========================================================================
// 6 · LA MUERTE ENTERA, EN EL JUEGO DE VERDAD
// ===========================================================================
//
// Va acá y no en un archivo aparte porque es lo mismo: lo que hay que probar
// es que el oído y la vista se apaguen JUNTOS. Si el sonido se corta antes se
// lee como que se colgó; si sigue después de que la pantalla está negra, se lee
// como que falta una pantalla. Y al final del fundido tiene que haber una
// salida: morirse y quedar mirando un negro sin botones es un callejón.
await pag.click('#modo-batalla');
await pag.waitForSelector('#plano:not(.oculto)', { timeout: 20000 });
await pag.click('#plano-entrar');
await pag.waitForTimeout(600);

const antes = await pag.evaluate(() => ({
  formada: window.juego.pinza.viva,
  hombres: window.juego.pinza.oeste.hombres.length
}));
r.push(['OK ', 'la batalla arrancó formada', `${antes.hombres} en la columna`]);

await pag.evaluate(() => { window.juego.jugador.recibir(999, null); });
await pag.waitForTimeout(1200);
const enElAire = await pag.evaluate(() => ({
  muriendo: window.juego.sonido.muriendo,
  ojos: document.getElementById('lienzo').classList.contains('ojos'),
  botones: !document.getElementById('caido').classList.contains('oculto')
}));
r.push([enElAire.muriendo && enElAire.ojos ? 'OK ' : 'MAL',
  'al segundo, el oído y la vista ya se van juntos', JSON.stringify(enElAire)]);
r.push([!enElAire.botones ? 'OK ' : 'MAL',
  'y los botones todavía no, para no cortar el fundido', String(enElAire.botones)]);

// el fundido dura siete segundos: los botones entran al final
await pag.waitForTimeout(7200);
const caido = await pag.evaluate(() => {
  const c = document.getElementById('caido');
  return {
    visible: !c.classList.contains('oculto') && c.classList.contains('si'),
    frase: document.getElementById('frase').textContent.slice(0, 34),
    dice: document.getElementById('caido-otra').textContent,
    suelto: !document.pointerLockElement
  };
});
r.push([caido.visible ? 'OK ' : 'MAL', 'terminado el fundido, aparecen los botones', caido.dice]);
r.push([caido.frase.length > 8 ? 'OK ' : 'MAL', 'con la frase de San Martín abajo', caido.frase + '…']);
r.push([caido.suelto ? 'OK ' : 'MAL', 'y el mouse es tuyo, si no no se puede apretar nada']);

// VOLVER A EMPEZAR es empezar de nuevo, no levantarse: la pinza tiene que
// estar formada otra vez y el clarín sin tocar.
await pag.evaluate(() => { window.juego.pinza.tocar(); });
await pag.click('#caido-otra');
await pag.waitForTimeout(700);
const devuelta = await pag.evaluate(() => ({
  vivo: window.juego.jugador.vivo,
  muriendo: window.juego.sonido.muriendo,
  formada: window.juego.pinza.viva,
  tocado: window.juego.pinza.tocado,
  hombres: window.juego.pinza.oeste.hombres.length,
  botones: !document.getElementById('caido').classList.contains('oculto'),
  negro: document.getElementById('fundido').style.opacity
}));
r.push([devuelta.vivo && !devuelta.muriendo ? 'OK ' : 'MAL',
  'volver a empezar te devuelve el oído y la vida', JSON.stringify({ vivo: devuelta.vivo, muriendo: devuelta.muriendo })]);
r.push([devuelta.formada && !devuelta.tocado && devuelta.hombres === antes.hombres ? 'OK ' : 'MAL',
  'y rearma la pinza, con el clarín sin tocar', `${devuelta.hombres} formados · tocado=${devuelta.tocado}`]);
r.push([!devuelta.botones && devuelta.negro === '0' ? 'OK ' : 'MAL',
  'los botones se van y la pantalla se abre', `negro=${devuelta.negro}`]);

for (const [e, n, x] of r) console.log(e.padEnd(4), n.padEnd(48), x);
const mal = r.filter(x => x[0] === 'MAL').length;
console.log(`\n${r.length - mal} bien, ${mal} mal`);
await nav.close();
process.exit(mal ? 1 : 0);
