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
  for (const id of ['modo-batalla', 'modo-red', 'modo-campo', 'ver-opciones', 'ver-creditos']) {
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

// el botón de la batalla, como lo aprieta cualquiera
await pag.click('#modo-batalla');
// entre elegir la batalla y salir al campo está el plano de la maniobra
await pag.waitForSelector('#plano:not(.oculto)', { timeout: 10000 });
await pag.click('#plano-entrar');
await pag.waitForTimeout(2600);
await pag.screenshot({ path: 'tropa/q-1-formada.png' });
const antes = await pag.evaluate(() => ({
  columna: window.juego.pinza.oeste.montados,
  otra: window.juego.pinza.este.montados,
  realistas: window.juego.soldados.filter(s => s.esRealista && s.vivo).length,
  esperando: window.juego.pinza.sonando,
  draws: window.juego.info.calls
}));

// y el clarín, como lo toca cualquiera
await pag.keyboard.press('KeyT');
await pag.waitForTimeout(900);
await pag.evaluate(() => { for (let i = 0; i < 60 * 5; i++) window.juego.simular(1 / 60); });
await pag.waitForTimeout(1800);
await pag.screenshot({ path: 'tropa/q-2-salida.png' });
const dur = await pag.evaluate(() => ({ estado: window.juego.pinza.oeste.estado, tocado: window.juego.pinza.tocado }));

console.log('al elegir la batalla:', JSON.stringify(antes));
console.log('tras la T:          ', JSON.stringify(dur));
console.log(errs.length ? 'ERRORES: ' + errs.join(' / ') : 'sin errores');
await nav.close();
