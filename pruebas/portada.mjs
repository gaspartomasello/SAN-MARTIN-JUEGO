// LO QUE VE EL QUE ABRE EL ARCHIVO. Sin consola, sin comandos: la portada, el
// botón de la batalla, y lo primero que aparece en pantalla al elegirlo.
import { chromium } from 'playwright';
const nav = await chromium.launch({ executablePath: process.env.CHROMIUM,
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
const pag = await nav.newPage({ viewport: { width: 1100, height: 720 } });
const errs = []; pag.on('pageerror', e => errs.push(e.message));
await pag.goto('http://localhost:8099/index.html', { waitUntil: 'load' });
await pag.waitForTimeout(1400);
await pag.screenshot({ path: 'tropa/q-0-portada.png' });

// ---- la portada nueva: una foto, cinco renglones y ni una barra de scroll ----
//
// La revisión del oro no es un capricho: la primera versión de este menú salió
// EN BLANCO. El renglón se pinta con un degradado recortado sobre la letra
// (background-image + background-clip:text + relleno transparente), y alcanzó
// con que una regla posterior escribiera el atajo `background` para borrar el
// degradado y dejar letra transparente sobre nada. Se ve en pantalla y no en el
// código, así que la prueba pregunta las dos cosas juntas.
const tapa = await pag.evaluate(() => {
  const r = { faltan: [], sinOro: [], chicos: [] };
  for (const id of ['modo-batalla', 'modo-red', 'modo-campo', 'modo-andes', 'ver-opciones', 'ver-creditos']) {
    const b = document.getElementById(id);
    if (!b) { r.faltan.push(id); continue; }
    const e = getComputedStyle(b);
    const transparente = e.webkitTextFillColor === 'rgba(0, 0, 0, 0)' || e.color === 'rgba(0, 0, 0, 0)';
    if (transparente && e.backgroundImage === 'none') r.sinOro.push(id);
    if (b.getBoundingClientRect().height < 24) r.chicos.push(id);
  }
  r.desbordeY = document.documentElement.scrollHeight - innerHeight;
  r.desbordeX = document.documentElement.scrollWidth - innerWidth;
  r.pie = [...document.querySelectorAll('#portada .pieportada span')].map(s => s.textContent.trim());
  return r;
});
console.log('la tapa:', JSON.stringify(tapa));
if (tapa.faltan.length) console.log('MAL · renglones que no están:', tapa.faltan.join(' '));
if (tapa.sinOro.length) console.log('MAL · renglones transparentes sin degradado:', tapa.sinOro.join(' '));
if (tapa.chicos.length) console.log('MAL · renglones sin alto:', tapa.chicos.join(' '));
if (tapa.desbordeY > 0 || tapa.desbordeX > 0) console.log('MAL · la portada scrollea');

// ---- el renglón cuando le pasás el mouse por encima ----
//
// Acá hubo un defecto que se veía y no se leía: al pasar el mouse, el renglón
// entero se volvía un ladrillo dorado y la letra desaparecía. La causa no era
// ninguna regla del menú sino la global `button:hover{background:...}`: el
// ATAJO `background` no sólo pinta el fondo, también devuelve background-clip
// a border-box, y el degradado dejaba de seguir la letra. Por eso se mide el
// recorte EN LOS DOS ESTADOS, que es donde estaba la diferencia.
//
// Y de paso lo que se anima: si en la lista de transiciones aparece algo que
// obliga a recalcular el layout —padding, width, left, margin— la animación
// del botón trabajaba de más en cada cuadro. Sólo transform.
const CARO = ['padding', 'width', 'height', 'left', 'top', 'margin', 'filter', 'all'];
const antesDeTocar = (await pag.locator('#modo-batalla').boundingBox()).x;
await pag.hover('#modo-batalla');
await pag.waitForTimeout(450);
// el corrimiento se mide por dónde QUEDÓ la caja y no por la propiedad
// transform: en modo compositor getComputedStyle todavía informa la identidad.
const corrido = (await pag.locator('#modo-batalla').boundingBox()).x - antesDeTocar;
const encima = await pag.evaluate(() => {
  const b = document.getElementById('modo-batalla');
  const e = getComputedStyle(b);
  const p = getComputedStyle(b, '::before');
  return { clip: e.webkitBackgroundClip, oro: e.backgroundImage, mueve: e.transform,
    transiciona: (e.transitionProperty + ',' + p.transitionProperty) };
});
const quieto = await pag.evaluate(() => {
  const e = getComputedStyle(document.getElementById('modo-campo'));
  return { clip: e.webkitBackgroundClip, oro: e.backgroundImage };
});
// Cuánto colorado tiene el degradado: la distancia máxima entre el rojo y el
// verde de sus paradas. El oro llega a 43 y el colorado a 160, así que 90
// parte al medio sin rozar ninguno de los dos. Mirar SÓLO la primera parada no
// alcanzaba: la primera del colorado es un coral pálido y daba 60.
const rojez = t => Math.max(...[...t.matchAll(/rgba?\(([^)]+)\)/g)]
  .map(m => m[1].split(',').map(n => +n))
  .map(([r, g]) => r - g));
const rq = rojez(quieto.oro), re = rojez(encima.oro);
const caras = CARO.filter(c => encima.transiciona.includes(c));
console.log('el renglón encima:', JSON.stringify({
  clipQuieto: quieto.clip, clipEncima: encima.clip, mueve: encima.mueve,
  rojez: [rq, re], corrido, transiciona: encima.transiciona }));
if (quieto.clip !== 'text') console.log('MAL · quieto el degradado no está recortado sobre la letra');
if (encima.clip !== 'text') console.log('MAL · encima el degradado pinta la caja y borra la letra');
if (!(rq < 90)) console.log('MAL · quieto no parece dorado');
if (!(re > 90)) console.log('MAL · encima no se pone colorada');
if (!(corrido > 5 && corrido < 14)) console.log('MAL · el renglón no se corre al pasar el mouse');
if (caras.length) console.log('MAL · anima cosas que cuestan layout:', caras.join(' '));
await pag.mouse.move(4, 4);
await pag.waitForTimeout(250);

// las dos hojas: abren, la casilla de sangre vive adentro de Opciones, y cierran
await pag.click('#ver-opciones');
await pag.waitForSelector('#portada-opciones:not(.oculto)', { timeout: 4000 });
const dentro = await pag.evaluate(() => {
  const c = document.getElementById('op-sangre');
  return !!c && !!c.closest('#portada-opciones') && c.offsetParent !== null;
});
console.log('la sangre vive en Opciones:', dentro);
await pag.keyboard.press('Escape');
await pag.waitForTimeout(250);
await pag.click('#ver-creditos');
await pag.waitForSelector('#portada-creditos:not(.oculto)', { timeout: 4000 });
await pag.click('#cerrar-creditos');
await pag.waitForTimeout(250);
const cerradas = await pag.evaluate(() => ['portada-opciones', 'portada-creditos']
  .every(id => document.getElementById(id).classList.contains('oculto')));
console.log('las hojas cierran:', cerradas);

// ---------------------------------------------------------------------------
// EL MENÚ EN UNA PANTALLA BAJA
// ---------------------------------------------------------------------------
// Partir el menú por capítulos le agregó dos renglones y un rótulo, y en una
// notebook de 560 de alto —con la barra del navegador puesta— el título se
// salía por arriba y Créditos quedaba abajo del borde: el juego tenía un
// botón que no se podía apretar. No se ve en una pantalla grande, así que se
// mide en la chica.
const bajas = [];
for (const [an, al] of [[1280, 560], [1024, 520], [1440, 900]]) {
  await pag.setViewportSize({ width: an, height: al });
  await pag.waitForTimeout(220);
  const m = await pag.evaluate(() => {
    const t = document.getElementById('portada-menu').getBoundingClientRect();
    const c = document.getElementById('ver-creditos').getBoundingClientRect();
    return { arriba: Math.round(t.top), abajo: Math.round(c.bottom), alto: innerHeight };
  });
  bajas.push([an + 'x' + al, m]);
}
await pag.setViewportSize({ width: 1100, height: 720 });
await pag.waitForTimeout(250);
const seSale = bajas.filter(([, m]) => m.arriba < -2 || m.abajo > m.alto + 2);
console.log('el menú en pantalla baja:', JSON.stringify(bajas));
if (seSale.length) console.log('MAL · el menú se sale de la pantalla en', seSale.map(b => b[0]).join(' '));

// ---------------------------------------------------------------------------
// EL CAPÍTULO 2, DESDE EL BOTÓN
// ---------------------------------------------------------------------------
// El armazón de capítulos entero, por donde lo toca el que juega: apretar
// «Reconocimiento» tiene que apagar San Lorenzo —el convento, la barranca, el
// río y sus colisiones—, prender la madrugada y sacar a los granaderos CON
// PONCHO. Lo último es lo que más fácil se rompe: la ropa viaja por tres
// saltos y ya se perdió una vez en el camino.
await pag.click('#modo-andes');
await pag.waitForTimeout(2600);
await pag.screenshot({ path: 'tropa/q-3-andes.png' });
const cordillera = await pag.evaluate(() => {
  const j = window.juego;
  const g = j.escena.getObjectByName('sanlorenzo');
  return {
    capitulo: j.capitulo,
    sanLorenzoPrendido: !!(g && g.visible),
    colisiones: j.mundo.colisiones.length,
    hombres: j.soldados.length,
    conPoncho: j.soldados.filter(s => s.fig.conPoncho).length,
    claves: [...new Set(j.soldados.map(s => s.claveLejos))].join(' '),
    niebla: '#' + j.escena.fog.color.getHexString(),
    limite: j.mundo.limite,
    draws: j.info.calls
  };
});
console.log('la cordillera:', JSON.stringify(cordillera));
const malAndes = [];
if (cordillera.capitulo !== 'andes') malAndes.push('no entró al capítulo 2');
if (cordillera.sanLorenzoPrendido) malAndes.push('San Lorenzo sigue dibujándose');
// las colisiones tienen que ser LAS DEL PASO y no las del convento: son otras
// tantas, pero lo que importa es que se hayan cambiado enteras
if (cordillera.colisiones < 60) malAndes.push('el paso se quedó sin sus colisiones');
if (cordillera.limite > -200) malAndes.push('el mundo sigue terminando en el río: ' + cordillera.limite);
if (cordillera.hombres < 10) malAndes.push('no salió la partida');
if (cordillera.conPoncho < 5) malAndes.push('los granaderos salieron sin poncho');
if (cordillera.claves !== 'granaderoAndes') malAndes.push('de lejos se cambian de ropa: ' + cordillera.claves);
if (cordillera.niebla === '#d2d0c2') malAndes.push('sigue la niebla del Paraná');
for (const m of malAndes) console.log('MAL ·', m);
if (malAndes.length) errs.push('el capítulo 2 no entra bien');

// y de vuelta a San Lorenzo: el mundo tiene que volver entero, que es la mitad
// que nadie prueba nunca
await pag.reload({ waitUntil: 'load' });
await pag.waitForFunction(() => !!window.juego, null, { timeout: 60000 });
await pag.waitForTimeout(1200);

// el botón de la batalla, como lo aprieta cualquiera
await pag.click('#modo-batalla');
// entre elegir la batalla y salir al campo está el plano de la maniobra
await pag.waitForSelector('#plano:not(.oculto)', { timeout: 10000 });
await pag.click('#plano-entrar');
await pag.waitForTimeout(2600);
await pag.screenshot({ path: 'tropa/q-1-formada.png' });
const antes = await pag.evaluate(() => ({
  capitulo: window.juego.capitulo,
  colisiones: window.juego.mundo.colisiones.length,
  sanLorenzoPrendido: !!window.juego.escena.getObjectByName('sanlorenzo').visible,
  columna: window.juego.pinza.oeste.montados,
  otra: window.juego.pinza.este.montados,
  realistas: window.juego.soldados.filter(s => s.esRealista && s.vivo).length,
  esperando: window.juego.pinza.sonando,
  draws: window.juego.info.calls
}));

// LA T, DOS VECES, DESDE EL TECLADO DE VERDAD. Entrando por la portada la
// primera baja la introducción de la misión y la segunda toca el clarín. Acá
// se prueba el camino entero —tecla, mando.js, apertura, pinza— y no la clase
// suelta, que es lo que ya hace pruebas/acto.mjs.
const dice = [];
const dilo = (n, cond, extra) => dice.push([cond ? 'OK ' : 'MAL', n, extra === undefined ? '' : extra]);

dilo('al entrar corre la introducción', await pag.evaluate(() => window.juego.apertura.activo));
dilo('y San Lorenzo volvió entero', antes.capitulo === 'sanlorenzo' &&
  antes.sanLorenzoPrendido && antes.colisiones > 40,
  `${antes.colisiones} colisiones`);

await pag.keyboard.press('KeyT');
await pag.waitForTimeout(900);
const una = await pag.evaluate(() => ({
  activo: window.juego.apertura.activo, tocado: window.juego.pinza.tocado }));
dilo('la primera T la baja', !una.activo);
dilo('y todavía no toca el clarín', una.tocado === false, `tocado=${una.tocado}`);

await pag.keyboard.press('KeyT');
await pag.waitForTimeout(900);
await pag.evaluate(() => { for (let i = 0; i < 60 * 5; i++) window.juego.simular(1 / 60); });
await pag.waitForTimeout(1800);
await pag.screenshot({ path: 'tropa/q-2-salida.png' });
const dur = await pag.evaluate(() => ({ estado: window.juego.pinza.oeste.estado, tocado: window.juego.pinza.tocado }));
dilo('la segunda sí, y la columna sale', dur.tocado === true && dur.estado !== 'formada',
  JSON.stringify(dur));

console.log('al elegir la batalla:', JSON.stringify(antes));
for (const [e, n, x] of dice) console.log(e.padEnd(4), n.padEnd(38), x);
if (dice.some(d => d[0] === 'MAL')) errs.push('la T no hace las dos cosas en orden');
console.log(errs.length ? 'ERRORES: ' + errs.join(' / ') : 'sin errores');
await nav.close();
