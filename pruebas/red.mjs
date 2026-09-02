// LOS DOS COSTADOS. Dos navegadores de verdad, el servidor de verdad y el
// cable de verdad. Lo que hay que probar no es que se conecten: es que los dos
// estén viendo LA MISMA batalla.
//
// Cuatro cosas, y si falla cualquiera el modo no sirve:
//
//   1. que el invitado vea el campo entero sin simularlo —los hombres, los
//      caballos y las piezas que armó el otro—;
//   2. que lo vea en el mismo lugar, no cerca;
//   3. que un tiro del invitado MATE del lado del anfitrión, que es lo único
//      que hace que peleen la misma batalla y no dos parecidas;
//   4. que la columna del este siga al invitado, que es la pinza.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const PUERTO = 8123;
const servidor = spawn(process.execPath, ['herramientas/servidor.mjs', String(PUERTO)],
  { stdio: ['ignore', 'pipe', 'pipe'] });
const dicho = [];
servidor.stdout.on('data', d => dicho.push(String(d)));
servidor.stderr.on('data', d => dicho.push('ERR ' + d));
await new Promise(r => setTimeout(r, 900));

// El servidor se apaga pase lo que pase, y esto va ACÁ y no más abajo: si la
// prueba se cae en el primer paso, un servidor huérfano deja el puerto tomado
// y la corrida siguiente falla sin ningún motivo aparente.
const cerrar = () => { try { servidor.kill(); } catch { /* ya no estaba */ } };
process.on('exit', cerrar);
process.on('uncaughtException', e => { console.error(e); cerrar(); process.exit(1); });

const nav = await chromium.launch({ executablePath: process.env.CHROMIUM,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox',
    '--autoplay-policy=no-user-gesture-required'] });

// ---------------------------------------------------------------------------
// 0 · LA SALA, ANTES QUE NADA Y SIN CARGAR EL JUEGO
// ---------------------------------------------------------------------------
//
// Esto va primero y con una página en blanco a propósito: una sala rota tiene
// que fallar en diez segundos y no después de armar dos batallas enteras. Y lo
// que se prueba —quién es quién, qué pasa con el tercero, y sobre todo si el
// que queda se entera de que el otro se fue— no necesita un solo granadero.
//
// El agujero que encontró esta prueba: el aviso de «se fue» colgaba de una
// bandera que la trama de cierre ya había bajado, así que sólo avisaba cuando
// alguien se iba MAL —un cable, un wifi cortado—. Cerrar la pestaña, que es lo
// que hace todo el mundo, dejaba el lugar tomado por un muerto y la sala
// inservible hasta reiniciar el servidor.
{
  const navSala = await chromium.launch({ executablePath: process.env.CHROMIUM, args: ['--no-sandbox'] });
  const pag = await navSala.newPage();
  await pag.goto('about:blank');
  const r = await pag.evaluate(async (puerto) => {
    const out = [];
    const ok = (n, cond, extra) => out.push([cond ? 'OK ' : 'MAL', n, extra === undefined ? '' : extra]);
    const abiertas = [];
    // en el momento del techo hay tres adentro: el anfitrión, el tres y el cuatro
    const sala1Cuantos = () => 3;
    const abrirWs = () => new Promise(res => {
      const ws = new WebSocket('ws://localhost:' + puerto);
      const yo = { ws, mensajes: [] };
      ws.onmessage = e => { try { yo.mensajes.push(JSON.parse(e.data)); } catch { /* binario */ } };
      ws.onopen = () => res(yo);
      abiertas.push(yo);
    });
    const esperar = (yo, t, ms = 4000) => new Promise(res => {
      const desde = Date.now();
      const i = setInterval(() => {
        const m = yo.mensajes.filter(x => x.t === t).pop();
        if (m || Date.now() - desde > ms) { clearInterval(i); res(m || null); }
      }, 25);
    });

    const uno = await abrirWs();
    const m1 = await esperar(uno, 'sala');
    ok('el primero es el anfitrión', m1 && m1.rol === 'anfitrion', m1 && m1.rol);
    ok('y le toca el número cero', m1 && m1.j === 0, m1 && String(m1.j));
    ok('y la sala todavía no está completa', m1 && !m1.completa);

    const dos = await abrirWs();
    const m2 = await esperar(dos, 'sala');
    ok('el segundo es el invitado', m2 && m2.rol === 'invitado', m2 && m2.rol);
    ok('y es el jugador uno, que es Bermúdez', m2 && m2.j === 1, m2 && String(m2.j));
    ok('y ahí sí está completa', m2 && !!m2.completa);
    const entro2 = await esperar(uno, 'par');
    ok('al anfitrión le avisan quién entró', entro2 && entro2.entra === true && entro2.j === 1,
      JSON.stringify(entro2));

    // EL TERCERO YA NO REBOTA: es un granadero. Esto es lo que cambió.
    const tres = await abrirWs();
    const m3 = await esperar(tres, 'sala');
    ok('el tercero entra, y es el jugador dos', m3 && m3.j === 2, m3 ? String(m3.j) : 'rebotó');

    // ---- el encaminado, que es lo único que el servidor mira del sobre ----
    uno.ws.send(JSON.stringify({ t: 'aviso', texto: 'a todos', tipo: 'bien' }));
    const t2 = await esperar(dos, 'aviso');
    const t3 = await esperar(tres, 'aviso');
    ok('sin «para», lo del anfitrión llega a todos',
      t2 && t2.texto === 'a todos' && t3 && t3.texto === 'a todos');

    uno.ws.send(JSON.stringify({ t: 'frase', texto: 'sólo al dos', para: 2 }));
    const s3 = await esperar(tres, 'frase', 1500);
    const s2 = await esperar(dos, 'frase', 600);
    ok('con «para», llega a ese y a nadie más', s3 && s3.texto === 'sólo al dos' && s2 === null,
      `dos: ${s2 ? 'le llegó' : 'nada'}`);

    // Y DE VUELTA, EL REMITENTE. Es lo único que el anfitrión no puede saber
    // por su cuenta: por acá todos le llegan por el mismo caño.
    tres.ws.send(JSON.stringify({ t: 'reunir' }));
    const vuelta = await esperar(uno, 'reunir');
    ok('lo del invitado sube al anfitrión con el remitente puesto',
      vuelta && vuelta.de === 2, JSON.stringify(vuelta));

    dos.ws.close();
    const salio = await esperar(uno, 'par', 6000);
    ok('al anfitrión le avisan que se fue, y cuál', salio && salio.entra === false && salio.j === 1,
      JSON.stringify(salio));

    // y el lugar queda libre de verdad: si no, la sala muere con el primero
    // que cierre la pestaña y hay que reiniciar el servidor
    const cuatro = await abrirWs();
    const m4 = await esperar(cuatro, 'sala');
    ok('y su lugar queda libre para otro', m4 && m4.j === 1, m4 ? String(m4.j) : 'no entró');

    // el techo: diez adentro y el que sobra rebota con motivo
    const sobra = [];
    for (let k = sala1Cuantos(); k < 10; k++) sobra.push(await abrirWs());
    for (const a of sobra) await esperar(a, 'sala');
    const once = await abrirWs();
    ok('el número once rebota, y con motivo', (await esperar(once, 'lleno')) !== null);

    for (const a of abiertas) { try { a.ws.close(); } catch { /* ya estaba */ } }
    return out;
  }, PUERTO);
  await navSala.close();
  for (const [e, n, x] of r) console.log(e.padEnd(4), n.padEnd(44), x);
  const malSala = r.filter(x => x[0] === 'MAL').length;
  console.log(`  la sala: ${r.length - malSala} bien, ${malSala} mal\n`);
  if (malSala) { cerrar(); process.exit(1); }
  await new Promise(r2 => setTimeout(r2, 400));
}

const errs = [];
async function abrir (quien) {
  const p = await nav.newPage({ viewport: { width: 700, height: 460 } });
  p.on('pageerror', e => errs.push(`${quien}: ${e.message}`));
  await p.goto(`http://localhost:${PUERTO}/index.html`, { waitUntil: 'load', timeout: 120000 });
  await p.waitForFunction('window.juego && window.juego.red', null, { timeout: 25000 });
  return p;
}

// ---------------------------------------------------------------------------
// 0 bis · UN CÓDIGO MAL ESCRITO NO PUEDE TRABAR LA PUERTA
// ---------------------------------------------------------------------------
//
// Cuatro letras dictadas en voz alta se copian mal, y eso está previsto: sale
// el cartel de «no hay ninguna sala con ese código». Lo que no estaba previsto
// es lo que pasaba DESPUÉS.
//
// `entrarASala` arma el cable ANTES de que la conexión se abra —`cableDePar`
// envuelve la conexión en el molde de un WebSocket, y ese objeto existe desde
// el primer momento aunque del otro lado no conteste nadie—. Así que el
// intento fallido dejaba dos cosas puestas: el peer vivo y un cable en cero. Y
// el guardián de la entrada, «si ya hay peer o cable no hagas nada», los leía
// como una partida en curso: el segundo intento, con el código BUENO, salía
// por ahí sin llamar a nadie. Quedaba el cartel del error viejo en pantalla y
// ninguna forma de seguir salvo recargar la página.
//
// Se prueba con un directorio de mentira y sin red: lo que importa acá es el
// estado en el que queda el juego, no el directorio.
{
  const pag = await abrir('reintento');
  const r = await pag.evaluate(async () => {
    const out = [];
    const ok = (n, cond, extra) => out.push([cond ? 'OK ' : 'MAL', n, extra === undefined ? '' : extra]);
    const red = window.juego.red;
    let armados = 0;
    let romper = null;
    // Un directorio de mentira: abre, deja pedir una sala, y falla igual que
    // el de verdad cuando el código no existe.
    window.Peer = function () {
      armados++;
      const oyentes = {};
      this.on = (ev, f) => { (oyentes[ev] = oyentes[ev] || []).push(f); };
      this.destroy = () => {};
      this.connect = () => ({ on: () => {}, send: () => {}, close: () => {} });
      setTimeout(() => { for (const f of (oyentes.open || [])) f(); }, 10);
      romper = t => { for (const f of (oyentes.error || [])) f({ type: t }); };
    };
    const esperarFase = (f, ms = 3000) => new Promise(res => {
      const desde = Date.now();
      const i = setInterval(() => {
        if (red.parte().fase === f || Date.now() - desde > ms) { clearInterval(i); res(red.parte().fase); }
      }, 20);
    });

    red.cortar();
    red.entrarASala('ABCD');
    await esperarFase('llamando', 1000);
    // el respiro es lo que reproduce el bicho: sin él la conexión —y el cable
    // a medio armar que la envuelve— todavía no existe
    await new Promise(r2 => setTimeout(r2, 80));
    romper('peer-unavailable');
    ok('el código que no existe avisa y no conecta', red.parte().fase === 'caido', red.parte().fase);
    ok('y lo dice en castellano', /ninguna sala con ese código/.test(red.parte().motivo), red.parte().motivo);

    const antes = armados;
    red.entrarASala('WXYZ');
    const f2 = await esperarFase('llamando', 2000);
    ok('el segundo intento SÍ vuelve a llamar', f2 === 'llamando', f2);
    ok('y llama de nuevo al directorio', armados === antes + 1, `${armados - antes} llamadas`);
    ok('con el código nuevo puesto', red.codigo === 'WXYZ', String(red.codigo));

    red.cortar();
    ok('y volver atrás lo deja suelto', red.parte().fase === 'suelto', red.parte().fase);
    return out;
  });
  await pag.close();
  for (const [e, n, x] of r) console.log(e.padEnd(4), n.padEnd(44), x);
  const malCod = r.filter(x => x[0] === 'MAL').length;
  console.log(`  el reintento: ${r.length - malCod} bien, ${malCod} mal\n`);
  if (malCod) { cerrar(); process.exit(1); }
}

// 0 TER · EL DIRECTORIO QUE NO CONTESTA NUNCA
//
// El otro bicho de la misma puerta, y peor que el del código mal escrito
// porque no dice nada: el directorio de salas acepta la conexión y después se
// queda mudo. No hay error, así que no había cartel; y como los botones se
// escondían apenas se empezaba a llamar, la pantalla quedaba pelada —sin
// código, sin botones, con un «golpeando la puerta del servidor…» que no se
// movía más—. «Toco Crear sala y no aparece nada.» Pasa por datos del celular,
// que es justo lo que uno prueba cuando el wifi del colegio no deja.
//
// Ahora todo intento tiene plazo, se insiste, y la pantalla nunca queda muda.
{
  const pag = await abrir('mudo');
  // la pantalla de la sala tiene que estar a la vista: lo que se prueba acá es
  // tanto el estado como lo que se ve
  await pag.click('#modo-red');
  await pag.waitForTimeout(800);
  const r = await pag.evaluate(async () => {
    const out = [];
    const ok = (n, cond, extra) => out.push([cond ? 'OK ' : 'MAL', n, extra === undefined ? '' : extra]);
    const red = window.juego.red;
    const ver = () => ({
      fase: red.parte().fase,
      motivo: red.parte().motivo,
      botones: !document.getElementById('sala-elegir').classList.contains('oculto'),
      caja: !document.getElementById('sala-codigo-grande').classList.contains('oculto'),
      clave: document.getElementById('sala-clave').textContent,
      rotulo: document.getElementById('sala-codigo-grande').querySelector('label').textContent
    });
    const dormir = ms => new Promise(res => setTimeout(res, ms));

    // ---- un directorio que ni abre ni falla ----
    let armados = 0;
    window.Peer = function () {
      armados++;
      this.on = () => {};
      this.destroy = () => {};
      this.connect = () => ({ on: () => {}, send: () => {}, close: () => {} });
    };
    red.acortarPlazo(120);
    red.cortar();
    red.crearSala();
    await dormir(30);
    const enCurso = ver();
    ok('mientras llama, el código YA se ve', enCurso.caja && /^[A-Z]{4}$/.test(enCurso.clave), enCurso.clave);
    ok('y dice que todavía se está abriendo', /Abriendo/.test(enCurso.rotulo), enCurso.rotulo);
    ok('y los botones siguen ahí para reintentar', enCurso.botones);

    // ---- se vence el plazo tres veces y recién ahí se rinde ----
    await dormir(700);
    const caido = ver();
    ok('el que no contesta termina en un cartel, no en el limbo', caido.fase === 'caido', caido.fase);
    ok('y el cartel dice qué pasó', /directorio de salas no contestó/.test(caido.motivo), caido.motivo);
    ok('antes de rendirse insistió', armados === 3, armados + ' llamadas');
    ok('y los botones quedan para volver a probar', caido.botones);

    // ---- el mismo directorio, pero que abre a la tercera ----
    let n = 0;
    window.Peer = function (id) {
      const mio = ++n;
      this.on = (ev, f) => { if (ev === 'open' && mio >= 3) setTimeout(() => f(id), 5); };
      this.destroy = () => {};
      this.connect = () => ({ on: () => {}, send: () => {}, close: () => {} });
    };
    red.cortar();
    red.crearSala();
    await dormir(500);
    const abierta = ver();
    ok('insistiendo, la sala se abre igual', abierta.fase === 'esperando', abierta.fase);
    ok('y recién ahí el código se dicta', /Dictales/.test(abierta.rotulo), abierta.rotulo);
    ok('con un código de cuatro letras', /^[A-Z]{4}$/.test(abierta.clave), abierta.clave);

    // ---- entrar a una sala que existe pero con la que no se puede hablar ----
    // El caso de la red que no deja pasar la conexión directa: el directorio
    // contesta, el código existe, y el apretón de manos no llega nunca. Antes
    // se quedaba llamando para siempre; ahora se dice, y se dice otra cosa.
    window.Peer = function (id) {
      this.on = (ev, f) => { if (ev === 'open') setTimeout(() => f(id || 'x'), 5); };
      this.destroy = () => {};
      this.connect = () => ({ on: () => {}, send: () => {}, close: () => {} });
    };
    red.cortar();
    red.entrarASala('ABCD');
    await dormir(500);
    const mudo = ver();
    ok('la mano que no se da también se avisa', mudo.fase === 'caido', mudo.fase);
    ok('y no se confunde con «no existe esa sala»',
      /no se pudo abrir la conexión directa/.test(mudo.motivo), mudo.motivo);
    ok('el que entra no ve ningún código: el código no es suyo', !mudo.caja);

    red.cortar();
    red.acortarPlazo(9000);
    return out;
  });
  await pag.close();
  for (const [e, n, x] of r) console.log(e.padEnd(4), n.padEnd(44), x);
  const malMudo = r.filter(x => x[0] === 'MAL').length;
  console.log(`  el directorio mudo: ${r.length - malMudo} bien, ${malMudo} mal\n`);
  if (malMudo) { cerrar(); process.exit(1); }
}

// ---------------------------------------------------------------------------
// 0 QUATER · EL CAMINO DEL CÓDIGO, CON DOS NAVEGADORES DE VERDAD
// ---------------------------------------------------------------------------
//
// Todo lo de acá abajo prueba el OTRO camino: el servidor de sala, donde el
// número de cada uno lo reparte el servidor en la carta de entrada. Por el
// código no hay servidor que hable: el número se lo dice el anfitrión, y esa
// diferencia de un renglón es la que tenía roto el modo en red entero.
//
// EL BICHO. El anfitrión le manda al que entra «sos el 1» con el sobre puesto
// —`para: 1`—, y del otro lado el filtro de destinatario compara ese 1 con su
// propio número, que hasta que llegue esa misma carta vale CERO. Así que la
// tiraba. El invitado se quedaba creyéndose el cero para siempre, y desde ahí
// se caía todo lo demás: el parte de la batalla venía marcado «para el 1» y
// también se tiraba. Se armaba la sala, se veían los dos, se salía al campo
// y no aparecía un solo granadero. Un campo de tiro con pasto.
//
// No lo agarraba ninguna prueba porque por el servidor de sala el número llega
// en un mensaje SIN sobre, así que ahí `yo` siempre estuvo bien. Por eso este
// bloque: el directorio es de mentira —el de verdad no se puede alcanzar desde
// una prueba— pero los dos navegadores, los dos juegos y los dos caños son de
// verdad, y el apretón de manos pasa por el mismo código que en la escuela.
{
  // Un `Peer` que se habla por BroadcastChannel: dos pestañas del MISMO
  // contexto comparten origen, y con eso alcanza para que una llame a la otra.
  const PEER_FALSO = `(() => {
    const nuevoId = () => 'x' + Math.random().toString(36).slice(2, 10);
    class Cable {
      constructor (nombre, lado) {
        this.lado = lado; this.h = {}; this.abierta = false; this.cerrada = false;
        this.canal = new BroadcastChannel(nombre);
        this.canal.onmessage = ev => {
          const m = ev.data;
          if (m.lado === this.lado) return;
          if (m.t === 'hola') { this.abrir(); this.canal.postMessage({ lado: this.lado, t: 'hola2' }); }
          else if (m.t === 'hola2') this.abrir();
          else if (m.t === 'dato') this.tirar('data', m.d);
          else if (m.t === 'chau') this.morir();
        };
      }
      abrir () { if (this.abierta) return; this.abierta = true; this.tirar('open'); }
      on (e, f) { (this.h[e] = this.h[e] || []).push(f); }
      tirar (e, a) { for (const f of (this.h[e] || [])) f(a); }
      send (d) { if (!this.cerrada) this.canal.postMessage({ lado: this.lado, t: 'dato', d }); }
      close () { if (this.cerrada) return; try { this.canal.postMessage({ lado: this.lado, t: 'chau' }); } catch { /* ya estaba */ } this.morir(); }
      morir () { if (this.cerrada) return; this.cerrada = true; this.tirar('close'); try { this.canal.close(); } catch { /* ya estaba */ } }
      saludar () { this.canal.postMessage({ lado: this.lado, t: 'hola' }); }
    }
    return function PeerFalso (id) {
      const yo = id || nuevoId();
      const h = {};
      let muerto = false;
      const tirar = (e, a) => { for (const f of (h[e] || [])) f(a); };
      const dir = new BroadcastChannel('directorio-de-mentira');
      dir.onmessage = ev => {
        const m = ev.data;
        if (muerto || m.t !== 'conectar' || m.a !== yo) return;
        const c = new Cable(m.canal, 'b');
        tirar('connection', c);
        c.saludar();
      };
      this.id = yo;
      this.on = (e, f) => { (h[e] = h[e] || []).push(f); };
      this.destroy = () => { muerto = true; try { dir.close(); } catch { /* ya estaba */ } };
      this.connect = (a) => {
        const canal = 'c' + nuevoId();
        const c = new Cable(canal, 'a');
        dir.postMessage({ t: 'conectar', de: yo, a, canal });
        setTimeout(() => { if (!c.abierta && !muerto) tirar('error', { type: 'peer-unavailable' }); }, 2500);
        return c;
      };
      setTimeout(() => { if (!muerto) tirar('open', yo); }, 20);
    };
  })()`;

  const ctx = await nav.newContext({ viewport: { width: 700, height: 460 } });
  const cargar = async (quien) => {
    const p = await ctx.newPage();
    p.on('pageerror', e => errs.push(`${quien}: ${e.message}`));
    await p.goto(`http://localhost:${PUERTO}/index.html`, { waitUntil: 'load', timeout: 120000 });
    await p.waitForFunction('window.juego && window.juego.red', null, { timeout: 25000 });
    // el directorio de mentira se pone DESPUÉS de que cargue el módulo, que es
    // el que trae el `Peer` de verdad y lo pisaría
    await p.evaluate(f => { window.Peer = eval(f); }, PEER_FALSO);
    // la página se sirve por http, así que el juego tantea si hay sala local:
    // acá no la queremos, queremos el camino del código
    await p.evaluate(() => window.juego.red.cortar());
    return p;
  };

  const r = [];
  const ok = (n, cond, extra) => r.push([cond ? 'OK ' : 'MAL', n, extra === undefined ? '' : extra]);

  const sm = await cargar('San Martín');
  const bm = await cargar('Bermúdez');

  // La página la sirve el servidor de sala de la prueba, así que al abrir la
  // pantalla el juego se engancha solo ahí. Acá no queremos ese camino:
  // se corta y quedan los botones del código, que es lo que se prueba.
  for (const p of [sm, bm]) {
    await p.click('#modo-red');
    await p.waitForTimeout(600);
    await p.evaluate(() => window.juego.red.cortar());
    await p.waitForSelector('#sala-crear:visible', { timeout: 10000 });
  }
  await sm.click('#sala-crear');
  await sm.waitForFunction("window.juego.red.parte().rol === 'anfitrion'", null, { timeout: 10000 });
  const codigo = await sm.$eval('#sala-clave', e => e.textContent.trim());
  ok('el anfitrión abre la sala y le sale un código', /^[A-Z]{4}$/.test(codigo), codigo);

  await bm.fill('#sala-codigo', codigo);
  await bm.click('#sala-unirse');
  for (const p of [sm, bm]) {
    await p.waitForFunction("window.juego.red.parte().fase === 'listo'", null, { timeout: 15000 })
      .catch(() => { /* lo dice la afirmación de abajo */ });
  }

  const psm = await sm.evaluate(() => window.juego.red.parte());
  const pbm = await bm.evaluate(() => window.juego.red.parte());
  ok('los dos se ven en la sala', psm.fase === 'listo' && pbm.fase === 'listo', `${psm.fase} / ${pbm.fase}`);
  // ESTA ES LA QUE FALLABA. Sin ella todo lo de abajo es humo.
  ok('y el que entra SABE QUE ES EL UNO', pbm.j === 1, 'se cree el ' + pbm.j);
  ok('el anfitrión sigue siendo el cero', psm.j === 0, String(psm.j));
  ok('y por eso sabe a quién juega', pbm.nombre.includes('Bermúdez'), pbm.nombre);
  ok('los dos cuentan dos', psm.cuantos === 2 && pbm.cuantos === 2, `${psm.cuantos} / ${pbm.cuantos}`);

  // Y AHORA EL CAMPO, EN EL ORDEN EN QUE PASA DE VERDAD: el invitado sale
  // primero —el botón se le habilita al mismo tiempo— y el anfitrión forma
  // después. Si el sobre se pierde, lo que sigue es pasto.
  for (const p of [bm, sm]) {
    await p.click('#sala-entrar');
    await p.waitForSelector('#plano:not(.oculto)', { timeout: 10000 });
    await p.click('#plano-entrar');
    await p.waitForTimeout(300);
  }
  // chica, que son dos navegadores con render por software
  await sm.evaluate(() => window.juego.red.formarBatalla(6, 12));
  for (let i = 0; i < 30; i++) {
    await Promise.all([sm, bm].map(p =>
      p.evaluate(() => { for (let k = 0; k < 6; k++) window.juego.simular(1 / 30); })));
    await sm.waitForTimeout(12);
  }

  const censo = p => p.evaluate(() => ({
    soldados: window.juego.soldados.length,
    canones: window.juego.canones.length,
    columna: window.juego.red.parte().columna
  }));
  const csm = await censo(sm), cbm = await censo(bm);
  r.push(['—', 'anfitrión', JSON.stringify(csm)]);
  r.push(['—', 'invitado ', JSON.stringify(cbm)]);
  ok('al invitado le llega la batalla y no un campo vacío', cbm.soldados > 0, String(cbm.soldados));
  ok('y le llega ENTERA', cbm.soldados === csm.soldados, `${cbm.soldados} contra ${csm.soldados}`);
  ok('con las dos piezas', cbm.canones === 2, String(cbm.canones));
  ok('y sale por el costado que le toca', cbm.columna === 'este', cbm.columna);

  await ctx.close();
  for (const [e, n, x] of r) console.log(e.padEnd(4), n.padEnd(48), x);
  const malCod2 = r.filter(x => x[0] === 'MAL').length;
  console.log(`  el camino del código: ${r.length - malCod2} bien, ${malCod2} mal\n`);
  if (malCod2) { cerrar(); process.exit(1); }
}

// El anfitrión entra PRIMERO: el que llega primero a la sala es el que lleva
// la batalla, y eso es parte de lo que se prueba.
const anf = await abrir('anfitrión');
await anf.click('#modo-red');
await anf.waitForTimeout(500);
const inv = await abrir('invitado');
await inv.click('#modo-red');
// se espera a que los DOS se den por completos: en una máquina cargada el
// apretón de manos puede tardar más que cualquier número que uno invente
for (const p of [anf, inv]) {
  await p.waitForFunction("window.juego.red.parte().fase === 'listo'", null, { timeout: 15000 })
    .catch(() => {});
}
await anf.waitForTimeout(200);

const out = [];
const ok = (n, cond, extra) => out.push([cond ? 'OK ' : 'MAL', n, extra === undefined ? '' : extra]);

const papel = async p => p.evaluate(() => window.juego.red.parte());
const pa = await papel(anf), pi = await papel(inv);
ok('el primero en llegar es el anfitrión', pa.rol === 'anfitrion', pa.rol);
ok('el segundo es el invitado', pi.rol === 'invitado', pi.rol);
ok('los dos ven la sala completa', pa.fase === 'listo' && pi.fase === 'listo', `${pa.fase} / ${pi.fase}`);
ok('y saben a quién están jugando', pa.nombre.includes('San Martín') && pi.nombre.includes('Bermúdez'),
  `${pa.nombre} / ${pi.nombre}`);
ok('el botón de salir al campo se habilitó solo',
  !(await anf.$eval('#sala-entrar', b => b.disabled)) && !(await inv.$eval('#sala-entrar', b => b.disabled)));

// ---- al campo, por el botón, como una persona ----
// los dos pasan por el plano, que además les dice cuál de las dos columnas
// les tocó: es lo único que distingue a San Martín de Bermúdez antes de entrar
for (const [p, quien] of [[anf, 'oeste'], [inv, 'este']]) {
  await p.click('#sala-entrar');
  await p.waitForSelector('#plano:not(.oculto)', { timeout: 10000 });
  const dice = await p.$eval('#plano-tuya', e => e.textContent);
  ok(`el plano le dice al ${quien === 'este' ? 'invitado' : 'anfitrión'} qué columna lleva`,
    dice.includes(quien), dice);
  await p.click('#plano-entrar');
  await p.waitForTimeout(400);
}

// Y se vuelve a formar chico: doscientos cincuenta hombres por dos navegadores
// con render por software no es una prueba, es una siesta. De paso se prueba
// el barrido: los trescientos setenta primeros tienen que DESAPARECER del lado
// del invitado, no quedar de fantasmas.
await anf.evaluate(() => window.juego.red.formarBatalla(8, 24));

// EL BUCLE, A MANO Y EN LOS DOS. Con render por software el navegador da dos
// cuadros por segundo: si esperáramos al reloj, esto tardaría media hora. Se
// corre el mundo de verdad —juego.simular— a paso fijo, alternando, y entre
// tanda y tanda se le deja al navegador el respiro que necesita para entregar
// lo que llegó por el cable.
async function latir (segundos, dt = 1 / 30, paginas = null) {
  const todas = paginas || [anf, inv];
  const cuadros = Math.round(segundos / dt);
  for (let i = 0; i < cuadros; i += 6) {
    const n = Math.min(6, cuadros - i);
    await Promise.all(todas.map(p =>
      p.evaluate(([n, dt]) => { for (let k = 0; k < n; k++) window.juego.simular(dt); }, [n, dt])));
    await anf.waitForTimeout(12);
  }
}

await latir(2.5);

const censo = p => p.evaluate(() => {
  const j = window.juego;
  return {
    soldados: j.soldados.length,
    granaderos: j.soldados.filter(s => s.bando === 'granadero').length,
    realistas: j.soldados.filter(s => s.esRealista).length,
    caballos: j.caballos.length,
    canones: j.canones.length,
    titeres: j.soldados.filter(s => s.titere).length,
    kbs: j.red.parte().kbs
  };
});

const ca = await censo(anf), ci = await censo(inv);
out.push(['—', 'anfitrión', JSON.stringify(ca)]);
out.push(['—', 'invitado ', JSON.stringify(ci)]);

// 8 + 8 granaderos + el compañero + 24 realistas + 4 artilleros
ok('el invitado ve a toda la tropa del anfitrión', ci.soldados === ca.soldados,
  `${ci.soldados} contra ${ca.soldados}`);
ok('y a todos los caballos', ci.caballos >= ca.caballos - 1, `${ci.caballos} contra ${ca.caballos}`);
ok('y las dos piezas', ci.canones === 2, String(ci.canones));
ok('el anfitrión no simula ningún títere salvo el compañero', ca.titeres === 1, String(ca.titeres));
ok('el invitado no simula NADA: todos son títeres', ci.titeres === ci.soldados, `${ci.titeres}/${ci.soldados}`);
ok('el barrido borró los 370 del primer armado', ci.realistas === ca.realistas,
  `${ci.realistas} contra ${ca.realistas}`);

// ---- 2. en el MISMO lugar, no cerca ----
const sitios = p => p.evaluate(() => {
  const m = {};
  for (const s of window.juego.soldados) if (s._red) m[s._red] = [+s.pos.x.toFixed(2), +s.pos.z.toFixed(2)];
  return m;
});
const sa = await sitios(anf), si = await sitios(inv);
let peor = 0, pares = 0;
for (const id of Object.keys(sa)) {
  if (!si[id]) continue;
  pares++;
  peor = Math.max(peor, Math.hypot(sa[id][0] - si[id][0], sa[id][1] - si[id][1]));
}
ok('todos los hombres emparejados por número', pares === Object.keys(sa).length, `${pares} pares`);
ok('y ninguno a más de medio metro del suyo', peor < 0.5, `el peor a ${peor.toFixed(2)} m`);

// ---- 3. el tiro del invitado mata del lado del anfitrión ----
//
// Es la prueba central del modo. Si esto falla, cada uno está peleando su
// propia batalla contra copias del mismo ejército.
const antes = await anf.evaluate(() => window.juego.soldados.filter(s => s.esRealista && s.vivo).length);
const pegado = await inv.evaluate(() => {
  const j = window.juego;
  const o = j.soldados.find(s => s.esRealista && s.vivo);
  if (!o) return null;
  const id = o._red;
  // el mismo golpe que da el sable: combate.js no sabe que hay una red
  const murio = o.recibir(99, null, 0);
  return { id, murio, vidaLocal: o.vida };
});
await latir(0.5);
const despues = await anf.evaluate(id => {
  const j = window.juego;
  const o = j.soldados.find(s => s._red === id);
  return { vivos: j.soldados.filter(s => s.esRealista && s.vivo).length, sigueVivo: o ? o.vivo : null };
}, pegado.id);
ok('el golpe del invitado viajó y mató del otro lado',
  despues.sigueVivo === false && despues.vivos === antes - 1,
  `${antes} → ${despues.vivos} vivos`);
const eco = await inv.evaluate(id => {
  const o = window.juego.soldados.find(s => s._red === id);
  return o ? o.vivo : 'ya no está';
}, pegado.id);
ok('y el parte de vuelta lo dio por muerto también acá', eco === false || eco === 'ya no está', String(eco));

// ---- 4. la columna del este sigue al invitado ----
const lejosAntes = await anf.evaluate(() => {
  const p = window.juego.pinza;
  return { conRemota: !!p.este.remota, sinJefe: p.este.jefe === null, hombres: p.este.hombres.length };
});
ok('la columna del este quedó sin jefe propio', lejosAntes.sinJefe && lejosAntes.conRemota);

// EL CLARÍN LO TOCA SAN MARTÍN Y SALEN LAS DOS COLUMNAS. La del este está en
// la máquina del anfitrión pero la manda el invitado: la señal tiene que
// largarla igual.
await anf.evaluate(() => window.juego.tocarClarin());
await latir(0.5);
const largada = await anf.evaluate(() => window.juego.pinza.este.estado);
ok('con el clarín, la columna del invitado también arranca', largada !== 'formada', largada);

// el invitado se lleva su caballo y los sesenta tienen que ir detrás
const dondeEstan = () => anf.evaluate(() => {
  const p = window.juego.pinza;
  const cab = p.este.remota ? p.este.remota() : null;
  if (!cab) return null;
  const ds = p.este.hombres.filter(h => h.vivo && h.montado)
    .map(h => Math.hypot(h.monta.pos.x - cab.x, h.monta.pos.z - cab.z));
  return { cab: [Math.round(cab.x), Math.round(cab.z)], n: ds.length,
    lejos: ds.length ? Math.max(...ds) : -1 };
});
// se lo mueve DENTRO del campo propio, detrás del convento: acá se mide si la
// columna lo sigue, no si sobrevive a que lo metan solo entre los realistas
await inv.evaluate(() => {
  const j = window.juego;
  if (j.jugador.monta) { j.jugador.monta.pos.set(6, 0, 40); j.jugador.monta.rumbo = Math.PI; }
});
await latir(0.4);
const antesDeSeguir = await dondeEstan();
await latir(4);
const siguen = await dondeEstan();
out.push(['—', 'la cabeza del este, vista por el anfitrión', JSON.stringify(siguen)]);
ok('el anfitrión sabe dónde está el invitado', !!siguen && Math.abs(siguen.cab[0] - 6) < 5,
  siguen ? `x=${siguen.cab[0]}` : 'perdió la cabeza de la columna');
// no se mide la distancia final —cuatro segundos no alcanzan para cruzar el
// campo— sino que los sesenta VAYAN PARA ALLÁ, que es lo que hay que probar
ok('y sus sesenta van detrás de él',
  !!siguen && !!antesDeSeguir && siguen.n > 0 && siguen.lejos < antesDeSeguir.lejos - 3,
  siguen && antesDeSeguir
    ? `${antesDeSeguir.lejos.toFixed(0)} m → ${siguen.lejos.toFixed(0)} m con ${siguen.n} montados`
    : 'se quedó sin cabeza');

// ---- el cable ----
const kbs = Math.max(ca.kbs, ci.kbs);
ok('el cable no se desborda', kbs < 400, `${kbs} KB/s con ${ca.soldados} hombres`);

// ---- y el compañero se ve ----
const verse = await Promise.all([anf, inv].map(p => p.evaluate(() => {
  const c = window.juego.red.companero;
  return c ? { hay: true, montado: c.montado, x: Math.round(c.pos.x), z: Math.round(c.pos.z) } : { hay: false };
})));
out.push(['—', 'el compañero, de los dos lados', JSON.stringify(verse)]);
ok('cada uno tiene el cuerpo del otro en el campo', verse[0].hay && verse[1].hay);
ok('y lo ve montado', verse[0].montado && verse[1].montado);

// UN SOLO CABALLO DEBAJO DEL COMPAÑERO. El cuerpo del otro viaja aparte, con
// su propia montura; si además se replicara el animal de verdad quedarían dos
// caballos superpuestos temblando uno sobre el otro. No lo agarra ninguna
// cuenta global: hay que ir a mirar el lugar exacto.
const encimados = await Promise.all([anf, inv].map(p => p.evaluate(() => {
  const j = window.juego, c = j.red.companero;
  if (!c) return -1;
  return j.caballos.filter(h => Math.hypot(h.pos.x - c.pos.x, h.pos.z - c.pos.z) < 1.6).length;
})));
ok('nadie ve dos caballos encimados debajo del compañero',
  encimados[0] === 0 && encimados[1] === 0, `anfitrión ${encimados[0]} · invitado ${encimados[1]}`);

// ---- 5. LA BATALLA ENTERA POR EL CABLE ----
//
// Lo de arriba se midió con cuarenta y cinco hombres para que la prueba no
// tarde una hora. Pero San Lorenzo son trescientos setenta, y el número que
// importa es cuánto cable comen ésos: si no entra en una red de casa, el modo
// no existe. Se arma la batalla de verdad y se mide.
await anf.evaluate(() => window.juego.red.formarBatalla(60, 250));
await latir(2.5);
const grande = await Promise.all([anf, inv].map(censo));
out.push(['—', 'la batalla entera, anfitrión', JSON.stringify(grande[0])]);
out.push(['—', 'la batalla entera, invitado ', JSON.stringify(grande[1])]);
ok('el invitado recibe los 370 sin perder a nadie', grande[1].soldados === grande[0].soldados,
  `${grande[1].soldados} contra ${grande[0].soldados}`);
ok('y sigue sin simular a ninguno', grande[1].titeres === grande[1].soldados);
// veinte partes por segundo de 370 hombres y 130 caballos: seis kilobytes cada
// uno. Ciento treinta por segundo es un megabit: cualquier wifi de casa mueve
// cincuenta veces eso.
ok('la batalla entera entra cómoda en una red de casa',
  Math.max(grande[0].kbs, grande[1].kbs) < 300,
  `${Math.max(grande[0].kbs, grande[1].kbs)} KB/s`);

// ---------------------------------------------------------------------------
// 5 · EL TERCERO ES UN GRANADERO, Y OCUPA UN PUESTO
// ---------------------------------------------------------------------------
//
// Acá está lo que cambia de verdad al pasar de dos a diez, y no es la
// conexión: es que el escuadrón NO CREZCA. Un jugador que se suma tiene que
// sacarle el lugar a un bot, no ponerse al lado. Si se pone al lado, a los seis
// jugadores San Lorenzo se pelea con ciento veintiséis granaderos, que es otra
// batalla —y una que se gana más fácil—.
//
// Se prueba con tres navegadores de verdad, contra el servidor de verdad, y lo
// que se mira es la cuenta: el mismo número de granaderos en el campo antes y
// después de que entre el tercero.
// Y SE VUELVE A FORMAR CHICO ANTES DE ABRIR LA TERCERA PÁGINA. Recién corrió
// la batalla entera —375 hombres por dos navegadores con render por software—
// y en ese estado el tercero tardaba más de dos minutos en cargar y la prueba
// se caía por reloj. No es un problema del juego: es que tres Chromium sin
// placa de video no entran en una máquina. Con la formación chica carga solo.
await anf.evaluate(() => window.juego.red.formarBatalla(8, 24));
await latir(0.8);

const antesDelTercero = await anf.evaluate(() => ({
  granaderos: window.juego.soldados.filter(s => s.bando === 'granadero').length,
  oeste: window.juego.pinza.oeste.hombres.length,
  este: window.juego.pinza.este.hombres.length
}));

const tres = await abrir('granadero');
// la columna se elige ANTES de entrar: es lo primero que dice al conectarse
await tres.evaluate(() => window.juego.red.elegirColumna('este'));
await tres.click('#modo-red');
await tres.waitForFunction("window.juego.red.parte().fase === 'listo'", null, { timeout: 15000 })
  .catch(() => {});
await tres.waitForTimeout(300);

const pt = await tres.evaluate(() => window.juego.red.parte());
ok('el tercero entra y es granadero', pt.j === 2 && !pt.manda, `j=${pt.j} manda=${pt.manda}`);
ok('le respetaron la columna que pidió', pt.columna === 'este', pt.columna);
ok('y se llama como un granadero, no como un jefe', /Granadero/.test(pt.nombre), pt.nombre);
ok('los tres se ven en el padrón de la sala', (pt.jugadores || []).length === 3,
  String((pt.jugadores || []).length));

await tres.click('#sala-entrar');
await tres.waitForSelector('#plano:not(.oculto)', { timeout: 10000 });
await tres.click('#plano-entrar');
await tres.waitForTimeout(300);

// se rearma con los tres adentro: es el armado el que reparte los puestos
await anf.evaluate(() => window.juego.red.formarBatalla(8, 24));
await latir(2, 1 / 30, [anf, inv, tres]);

const conElTercero = await anf.evaluate(() => ({
  granaderos: window.juego.soldados.filter(s => s.bando === 'granadero').length,
  oeste: window.juego.pinza.oeste.hombres.length,
  este: window.juego.pinza.este.hombres.length,
  pares: window.juego.red.pares.length,
  enSoldados: window.juego.red.pares.filter(p => window.juego.soldados.includes(p.soldado)).length
}));
out.push(['—', 'el escuadrón, antes y después',
  `${JSON.stringify(antesDelTercero)} → ${JSON.stringify(conElTercero)}`]);
ok('el escuadrón no crece cuando entra un jugador',
  conElTercero.granaderos === antesDelTercero.granaderos,
  `${antesDelTercero.granaderos} → ${conElTercero.granaderos}`);
ok('el granadero le sacó el puesto a un bot de SU columna',
  conElTercero.este === conElTercero.oeste - 1,
  `oeste ${conElTercero.oeste} · este ${conElTercero.este}`);
ok('el anfitrión lleva el cuerpo de los otros dos', conElTercero.pares === 2,
  String(conElTercero.pares));
// si no están en `soldados`, los realistas no los eligen de blanco: son
// fantasmas a los que nadie ataca, que es la peor manera de acompañar a
// alguien a una batalla
ok('y los dos están en el campo, para que les tiren', conElTercero.enSoldados === 2,
  String(conElTercero.enSoldados));

const seVen = await Promise.all([anf, inv, tres].map(p => p.evaluate(() => ({
  pares: window.juego.red.pares.length,
  montados: window.juego.red.pares.filter(x => x.soldado.montado).length
}))));
ok('cada uno ve a los otros dos, y montados',
  seVen.every(v => v.pares === 2 && v.montados === 2), JSON.stringify(seVen));

// La Q es de quien manda una columna. Un granadero no manda: hay que decírselo,
// y sobre todo NO hay que dejar que le desarme la formación a nadie.
const qs = await Promise.all([anf, inv, tres].map(p =>
  p.evaluate(() => window.juego.red.reunir())));
ok('la Q del granadero no manda nada', qs[2] === 'tropa', String(qs[2]));
ok('y la de las dos cabezas sí', qs[0] !== 'tropa' && qs[1] !== 'tropa', JSON.stringify(qs));

await tres.close();
await latir(0.6);

// ---------------------------------------------------------------------------
// 6 · EL QUE CAE MIRA, NO ESPERA
// ---------------------------------------------------------------------------
//
// Va último a propósito: mata al invitado, así que no puede correr antes de las
// comprobaciones de arriba. En una partida de a dos el que muere no puede
// quedarse veinte minutos mirando el pasto ni obligar a los otros a esperarlo:
// vuela por encima del campo hasta que la batalla termina. Y vuela SIN QUE LO
// VEAN: lo que queda abajo es su cadáver, donde cayó, y ahí se queda —si se
// mandara la posición de la cámara, el otro vería un muerto paseándose por el
// cielo—.
// PRIMERO SE MUERE Y DESPUÉS SE VUELA, y entre las dos cosas hay un fundido.
// Antes se pasaba a espectador en el mismo cuadro del golpe, sin negro y sin
// frase, y morirse —lo más importante que te pasa en la batalla— se leía como
// un cambio de cámara. Ahora la pantalla se va a negro, se lee una frase de
// San Martín, y recién ahí despega.
//
// Se ESPERA A QUE DESPEGUE en vez de dormir un número: el fundido dura lo que
// diga main.js y una prueba que copia esa constante se desactualiza sola.
const alCaer = await inv.evaluate(() => {
  const j = window.juego;
  j.jugador.revivir();
  j.jugador.pos.set(9, 1.68, -12);
  j.jugador.recibir(999, null);
  return { espectador: j.jugador.espectador, vivo: j.jugador.vivo,
    negro: !!document.querySelector('#lienzo.ojos') };
});
ok('al caer NO se vuela de una: primero la pantalla se va a negro',
  !alCaer.espectador && !alCaer.vivo && alCaer.negro,
  `espectador=${alCaer.espectador} negro=${alCaer.negro}`);
await inv.waitForFunction(() => window.juego.jugador.espectador, null, { timeout: 15000 })
  .catch(() => { /* lo dice la afirmación de abajo */ });
ok('y después del fundido sí pasa a mirar',
  await inv.evaluate(() => window.juego.jugador.espectador));

const esp = await inv.evaluate(async () => {
  const j = window.juego, r = {};
  r.espectador = j.jugador.espectador;
  r.murioEn = j.jugador.murioEn;
  r.arriba = j.jugador.pos.y;
  const t = new Set(['KeyW']);
  j.jugador.yaw = 0; j.jugador.pitch = 0;
  const z0 = j.jugador.pos.z;
  for (let i = 0; i < 60; i++) j.jugador.actualizar(1 / 60, t, false, false);
  r.volo = Math.abs(j.jugador.pos.z - z0);
  r.cuerpoQuieto = { x: j.jugador.murioEn.x, z: j.jugador.murioEn.z };
  r.camaraLejos = Math.hypot(j.jugador.pos.x - 9, j.jugador.pos.z + 12);
  return r;
});
ok('el invitado que cae pasa a mirar', esp.espectador);
ok('y despega del piso', esp.arriba >= 6, `y=${esp.arriba.toFixed(1)}`);
ok('vuela, y rápido', esp.volo > 20, `${esp.volo.toFixed(0)} m en un segundo`);
ok('pero su cuerpo se queda donde cayó', esp.camaraLejos > 20 &&
  Math.abs(esp.cuerpoQuieto.x - 9) < 0.01 && Math.abs(esp.cuerpoQuieto.z + 12) < 0.01,
  `cámara a ${esp.camaraLejos.toFixed(0)} m del cuerpo`);

// Y EL ANFITRIÓN LO VE MUERTO Y QUIETO, NO VOLANDO. Se espera a que el títere
// LLEGUE, no una cantidad de milisegundos: el parte sale veinte veces por
// segundo y el cuerpo se interpola hasta el sitio nuevo, así que un sleep fijo
// mide la suerte del momento y no lo que se quiere probar.
await anf.waitForFunction(() => {
  const c = window.juego.red.companero;
  return c && !c.vivo && Math.hypot(c.pos.x - 9, c.pos.z + 12) < 3;
}, null, { timeout: 15000 }).catch(() => {});
const visto = await anf.evaluate(() => {
  const c = window.juego.red.companero;
  return c ? { vivo: c.vivo, x: +c.pos.x.toFixed(1), z: +c.pos.z.toFixed(1) } : null;
});
ok('y del otro lado se lo ve caído y quieto en el sitio',
  visto && !visto.vivo && Math.abs(visto.x - 9) < 3 && Math.abs(visto.z + 12) < 3,
  JSON.stringify(visto));

for (const [e, n, x] of out) console.log(e.padEnd(4), n.padEnd(52), x);
const mal = out.filter(x => x[0] === 'MAL').length;
console.log(`\n${out.filter(x => x[0] === 'OK ').length} bien, ${mal} mal`);
console.log(errs.length ? 'ERRORES: ' + errs.join(' / ') : 'sin errores de consola');
await nav.close();
servidor.kill();
if (dicho.some(d => d.startsWith('ERR'))) console.log('el servidor dijo:\n' + dicho.join(''));
process.exit(mal ? 1 : 0);
