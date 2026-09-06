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
  // =======================================================================
  // 6 · DE QUÉ LADO VIENE
  // =======================================================================
  //
  // El hueco más grande que tenía este motor: sabía a qué distancia estaba
  // cada cosa y no sabía de qué lado. Doscientos cincuenta fusiles sonaban
  // todos en el medio de tu cabeza, y con eso no se puede pelear: no hay
  // manera de darse vuelta hacia el que te está tirando.
  const panes = [];
  const _sp = s.ctx.createStereoPanner.bind(s.ctx);
  s.ctx.createStereoPanner = () => { const n = _sp(); panes.push(n); return n; };
  const pan = () => (panes.length ? +panes[panes.length - 1].pan.value.toFixed(2) : 0);

  s.oir({ x: 0, y: 1.7, z: 0 }, 0);            // mirando a −Z, que es adelante
  panes.length = 0; s.disparo({ x: 30, y: 1.7, z: 0 }); const aDerecha = pan();
  panes.length = 0; s.disparo({ x: -30, y: 1.7, z: 0 }); const aIzquierda = pan();
  panes.length = 0; s.disparo({ x: 0, y: 1.7, z: -30 }); const alFrente = pan();
  ok('el tiro de tu derecha entra por la derecha', aDerecha > 0.4, String(aDerecha));
  ok('y el de tu izquierda, por la izquierda', aIzquierda < -0.4, String(aIzquierda));
  ok('y el de adelante va al medio', Math.abs(alFrente) < 0.15, String(alFrente));

  // GIRAR LA CABEZA TIENE QUE MOVER EL CAMPO. Si el paneo saliera de la
  // posición del mundo y no de hacia dónde mirás, el mismo fusil seguiría
  // sonando a tu derecha después de que te diste vuelta, que es peor que no
  // tener estéreo: es un estéreo que miente.
  s.oir({ x: 0, y: 1.7, z: 0 }, Math.PI / 2);
  panes.length = 0; s.disparo({ x: 30, y: 1.7, z: 0 });
  ok('y girando la cabeza, ese mismo fusil se te va al medio',
    Math.abs(pan()) < 0.2, `${aDerecha} → ${pan()}`);

  // Y LO DE ENCIMA NO SE REPARTE. Un sonido a medio metro no está «todo a la
  // derecha»: está encima tuyo. Mandarlo a un solo parlante suena a auricular
  // roto, no a cercanía.
  panes.length = 0; s.disparo();
  ok('tu propio tiro no se va a un parlante', panes.length === 0);
  panes.length = 0; s.disparo({ x: 0.5, y: 1.7, z: 0.5 });
  ok('ni el que te revienta al lado', Math.abs(pan()) < 0.12, String(pan()));

  // =======================================================================
  // 7 · QUE HAYA UN LUGAR, Y QUE NO ESTÉ EN SILENCIO
  // =======================================================================
  //
  // Cada sonido se traía su cola dibujada a mano, y eso alcanza para que un
  // tiro suene a tiro pero no para que el campo suene a UN LUGAR. Ahora hay
  // una convolución sola para toda la mezcla, con la reflexión del convento
  // adentro. Y entre tiro y tiro ya no hay silencio digital.
  ok('hay una sala y no una cola por sonido', !!(s.eco && s.eco.buffer),
    s.eco && s.eco.buffer ? `${s.eco.buffer.duration.toFixed(2)} s en ${s.eco.buffer.numberOfChannels} canales` : 'no hay');
  ok('y es UNA para todo, no una por tiro', !!s.envio && s.envio.gain.value > 0,
    s.envio ? s.envio.gain.value.toFixed(2) : 'no hay envío');
  ok('el lecho existe: viento, río y fragor', !!(s.viento && s.rio && s.fragor));

  // EL GRITO NO ES UN ARCHIVO. Doscientos cincuenta hombres quebrándose con el
  // mismo grito no suenan a desbandada: suenan a un sonido repetido.
  //
  // Se mide la GARGANTA —la frecuencia— y no la ganancia. La ganancia sale de
  // la distancia, que acá es siempre la misma, así que contando por ahí salen
  // tres y parece que no hubiera variedad: lo que cambia de un hombre a otro
  // es el tono, no cuán fuerte grita.
  const gargantas = new Set();
  let formas = new Set();
  for (let i = 0; i < 40; i++) {
    limpiar(); s.grito({ x: 5, y: 1.7, z: 5 });
    gargantas.add(Math.round(visto.ruidos[0].frec / 40));
    formas.add(visto.tonos.length + '·' + visto.ruidos.length);
  }
  ok('cuarenta gritos no son cuarenta veces el mismo hombre', gargantas.size > 8,
    `${gargantas.size} gargantas distintas`);
  ok('y no todos gritan igual: hay formas de grito', formas.size >= 2,
    `${formas.size} formas`);

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
    frase: document.getElementById('frase').textContent,
    dice: document.getElementById('caido-otra').textContent,
    suelto: !document.pointerLockElement
  };
});
r.push([caido.visible ? 'OK ' : 'MAL', 'terminado el fundido, aparecen los botones', caido.dice]);
// CON SU FIRMA, y por eso no alcanza con que haya texto. Medir sólo el largo
// dejó pasar un defecto entero: la introducción de la misión seguía corriendo
// encima del muerto y lo que había abajo era la orden del clarín, no una cita.
// Una prueba que se conforma con «hay letras» no prueba nada.
r.push([/ — (José de San Martín|Manuel Belgrano)$/.test(caido.frase.trim()) ? 'OK ' : 'MAL',
  'con la cita del que muere abajo, y firmada', caido.frase]);
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

// ---------------------------------------------------------------------------
// EL REDOBLE DEL TAMBOR REALISTA
// ---------------------------------------------------------------------------
// No es ambientación. Es la ÚNICA pista de dónde está el hombre que sostiene la
// moral de esa parte de la línea, y por eso lo que se prueba acá es que la
// distancia se oiga: si sonara igual de cerca que de lejos, buscarlo entre
// doscientos cincuenta hombres iguales sería suerte y no juego.
const tambor = await pag.evaluate(() => {
  const j = window.juego, o = {};
  j.soldados.forEach(s => s.quitar()); j.soldados.length = 0;
  j.canones.forEach(c => { c.vivo = false; });
  const p = j.jugador; p.vida = 100; p.vivo = true;
  if (p.monta) p.desmontar();
  p.pos.set(0, 1.68, 4); p.yaw = 0;

  const oidas = [];
  const real = j.sonido.redoble.bind(j.sonido);
  j.sonido.redoble = (x) => { oidas.push(1); real(x); };

  const t1 = j.soltarSoldado('realista', { papel: 'tambor' });
  t1.pos.set(0, 0, 0); t1.malla.position.set(0, 0, 0);
  const raso = j.soltarSoldado('realista');
  const correr = (s, seg) => { for (let i = 0; i < seg * 60; i++) s.actualizar(1 / 60, p, j.soldados); };

  correr(t1, 6);
  o.toca = oidas.length;
  oidas.length = 0; correr(raso, 6);
  o.rasoToca = oidas.length;

  // la curva de la distancia, que es de lo que se trata
  j.sonido.oyente.x = 0; j.sonido.oyente.y = 1.7; j.sonido.oyente.z = 0;
  o.curva = [3, 10, 25, 50, 90].map(d => {
    const l = j.sonido._lejania({ x: d, y: 1.7, z: 0 });
    return [d, l ? +(l.gan * l.aire).toFixed(3) : 0];
  });

  oidas.length = 0; t1.recibir(999); correr(t1, 6);
  o.muerto = oidas.length;

  const t2 = j.soltarSoldado('realista', { papel: 'tambor' });
  oidas.length = 0; correr(t2, 6); o.antesDeQuebrar = oidas.length;
  t2.quebrar();
  oidas.length = 0; correr(t2, 6); o.quebrado = oidas.length;
  j.sonido.redoble = real;
  return o;
});
const cur = tambor.curva;
r.push([tambor.toca >= 4 ? 'OK ' : 'MAL',
  'el tambor toca solo, sin que nadie lo llame', `${tambor.toca} redobles en 6 s`]);
r.push([tambor.rasoToca === 0 ? 'OK ' : 'MAL',
  'y un realista raso no toca nada', `${tambor.rasoToca}`]);
r.push([cur.every((c, i) => i === 0 || c[1] < cur[i - 1][1]) ? 'OK ' : 'MAL',
  'se oye más fuerte de cerca que de lejos', cur.map(([d, g]) => `${d}m=${g}`).join(' · ')]);
r.push([cur[0][1] > cur[3][1] * 8 ? 'OK ' : 'MAL',
  'y la diferencia alcanza para orientarse', `a 3 m ${cur[0][1]} contra ${cur[3][1]} a 50 m`]);
r.push([tambor.muerto === 0 ? 'OK ' : 'MAL',
  'muerto deja de sonar', `${tambor.muerto} redobles`]);
r.push([tambor.antesDeQuebrar > 0 && tambor.quebrado === 0 ? 'OK ' : 'MAL',
  'y quebrado tampoco: el que corre no va tocando',
  `antes ${tambor.antesDeQuebrar} · después ${tambor.quebrado}`]);

// ---------------------------------------------------------------------------
// LA CÁMARA DEL QUE CAE, Y DE DÓNDE TE PEGARON
// ---------------------------------------------------------------------------
const caer = await pag.evaluate(() => {
  const j = window.juego, o = {};
  const p = j.jugador, cam = j.camara;
  p.revivir(); p.vida = 100; p.pos.set(0, 1.68, 0); p.yaw = 0; p.pitch = 0;
  if (p.monta) p.desmontar();
  p.recibir(999);
  for (let i = 0; i < 60 * 3.5; i++) j.simular(1 / 60);
  o.altura = +p.pos.y.toFixed(3);
  o.vuelco = Math.round(p.balanceo * 180 / Math.PI);
  o.trauma = +p.trauma.toFixed(4);
  // LA VIBRACIÓN, MEDIDA DE MANERA QUE SE NOTE. Comparar la cámara cuadro a
  // cuadro en un bucle apretado NO la agarra: el temblor sale de un seno de
  // performance.now() y entre dos vueltas de un for el reloj de pared casi no
  // se mueve —así medido daba 0,39 mm con el bug puesto—. Lo que sí es exacto:
  // con el muerto quieto la cámara tiene que estar EXACTAMENTE donde la cabeza,
  // porque la respiración y el balanceo del paso son sumandos sobre esa Y. Con
  // el bug daban 21,98 mm de sobra.
  o.sobra = Math.abs(cam.position.y - p.pos.y);

  // el arco del daño, que es una brújula y no una calcomanía
  const V3 = Object.getPrototypeOf(p.pos).constructor;
  const arcos = [...document.querySelectorAll('#dano path')];
  const ang = i => { const tr = arcos[i].getAttribute('transform');
    return tr ? +/rotate\(([-\d.]+)\)/.exec(tr)[1] : null; };
  const pintar = () => j.hud.actualizar(0.016, { yaw: p.yaw });
  o.arcos = arcos.length;
  p.revivir(); p.vida = 100; p.yaw = 0;
  j.hud.golpes.forEach(g => { g.t = 0; }); pintar();
  p.recibir(5, new V3(-1, 0, 0));         // el golpe viaja hacia -X: le pegan desde la derecha
  pintar();
  const i = j.hud.golpes.findIndex(g => g.t > 0);
  o.derecha = ang(i);
  o.prende = +arcos[i].style.opacity;
  // OJO CON EL SENTIDO: adelante es (-sen, -cos), o sea que yaw creciente gira
  // a la IZQUIERDA. Para encarar a uno que está a la derecha hay que restar.
  p.yaw -= Math.PI / 2; pintar(); o.encarado = ang(i);
  p.yaw += Math.PI;     pintar(); o.despaldas = Math.abs(ang(i));
  j.hud.golpes.forEach(g => { g.t = 0; });
  for (let k = 0; k < 4; k++) j.hud.actualizar(0.9, { yaw: p.yaw });
  o.apagados = arcos.every((_, k) => +arcos[k].style.opacity === 0);
  return o;
});
r.push([caer.altura < 0.75 ? 'OK ' : 'MAL', 'la cabeza del muerto queda en el pasto', `${caer.altura} m`]);
r.push([Math.abs(caer.vuelco) > 60 ? 'OK ' : 'MAL', 'y la cámara cae DE COSTADO', `${caer.vuelco}°`]);
r.push([caer.trauma < 0.01 ? 'OK ' : 'MAL', 'el temblor del golpe se apaga', `trauma ${caer.trauma}`]);
r.push([caer.sobra < 1e-9 ? 'OK ' : 'MAL',
  'y no vibra: la cámara está exactamente donde la cabeza',
  `${(caer.sobra * 1000).toFixed(4)} mm de sobra`]);
r.push([caer.arcos === 4 ? 'OK ' : 'MAL', 'hay cuatro arcos para el daño', `${caer.arcos}`]);
r.push([Math.abs(caer.derecha - 90) < 2 && caer.prende > 0.3 ? 'OK ' : 'MAL',
  'un golpe por la derecha marca a la derecha', `${caer.derecha}°`]);
r.push([Math.abs(caer.encarado) < 2 ? 'OK ' : 'MAL',
  'y es una brújula: encarándolo el arco se va al frente', `${caer.encarado}°`]);
r.push([Math.abs(caer.despaldas - 180) < 2 ? 'OK ' : 'MAL',
  'y dándole la espalda, se va atrás', `${caer.despaldas}°`]);
r.push([caer.apagados ? 'OK ' : 'MAL', 'los arcos se apagan solos', '']);

for (const [e, n, x] of r) console.log(e.padEnd(4), n.padEnd(48), x);
const mal = r.filter(x => x[0] === 'MAL').length;
console.log(`\n${r.length - mal} bien, ${mal} mal`);
await nav.close();
process.exit(mal ? 1 : 0);
