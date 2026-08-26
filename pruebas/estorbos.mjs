// LOS BOTS OCUPAN LUGAR. Que no se atraviesen entre ellos ni crucen las tapias
// es fácil; lo difícil es que eso no los deje clavados contra una pared ni
// frene una carga de caballería.
import { chromium } from 'playwright';
const nav = await chromium.launch({ executablePath: process.env.CHROMIUM,
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
const pag = await nav.newPage({ viewport: { width: 900, height: 620 } });
const errs = []; pag.on('pageerror', e => errs.push(e.message));
await pag.goto('http://localhost:8099/index.html', { waitUntil: 'load' });
await pag.waitForTimeout(1200); await pag.click('#empezar'); await pag.waitForTimeout(1800);

const r = await pag.evaluate(async () => {
  const j = window.juego, out = [];
  const T = await import('/vendor/three.module.js');
  const ok = (n, cond, extra) => out.push([cond ? 'OK ' : 'MAL', n, extra === undefined ? '' : extra]);
  const limpiar = () => {
    j.soldados.forEach(s => s.quitar()); j.soldados.length = 0;
    for (const c of j.caballos.slice()) if (j.jugador.monta !== c) c.quitar();
    j.caballos.length = 0;
  };
  const esperar = n => new Promise(res => { let i = 0; const f = () => (++i >= n ? res() : requestAnimationFrame(f)); requestAnimationFrame(f); });

  // ---------- 1. no se meten uno adentro del otro ----------
  limpiar();
  j.jugador.pos.set(0, 1.68, 0);
  const monton = [];
  for (let k = 0; k < 8; k++) {
    const s = j.soltarSoldado('realista', { pos: new T.Vector3(0.02 * k, 0, -30) });
    s.alDisparar = null; s.colisiones = [];
    monton.push(s);
  }
  await esperar(70);
  let minD = 99;
  for (let a = 0; a < monton.length; a++) for (let b = a + 1; b < monton.length; b++) {
    minD = Math.min(minD, Math.hypot(monton[a].pos.x - monton[b].pos.x, monton[a].pos.z - monton[b].pos.z));
  }
  ok('ocho amontonados se separan', minD > 0.6, `el par más junto quedó a ${minD.toFixed(2)} m`);

  // ---------- 2. los muertos no empujan ----------
  limpiar();
  j.jugador.pos.set(0, 1.68, 90);            // fuera de la cuenta: acá no se mide la IA
  const vivo = j.soltarSoldado('realista', { pos: new T.Vector3(0, 0, -30) });
  const finado = j.soltarSoldado('realista', { pos: new T.Vector3(0.1, 0, -30) });
  vivo.colisiones = []; finado.colisiones = [];
  vivo.actualizar = () => {};                // quieto: sólo interesa si el cuerpo lo empuja
  finado.vivo = false;
  for (let i = 0; i < 50; i++) j.separarAhora();
  const dm = Math.hypot(vivo.pos.x - finado.pos.x, vivo.pos.z - finado.pos.z);
  ok('por encima de un cuerpo se pasa', dm < 0.6, `${dm.toFixed(2)} m`);

  // ---------- 3. la tapia no se atraviesa ----------
  limpiar();
  // la tapia va ENTRE el hombre y su blanco, y el jugador se saca del medio
  // para que no se lo elija a él y camine para el otro lado
  j.jugador.pos.set(0, 1.68, 90);
  const tapia = { min: { x: -8, y: 0, z: -20 }, max: { x: 8, y: 1.2, z: -19 } };
  const t = j.soltarSoldado('realista', { pos: new T.Vector3(0, 0, -14) });
  t.colisiones = [tapia]; t.alDisparar = null; t.recarga = 999;   // descargado: se le viene encima
  const blanco = j.soltarSoldado('granadero', { pos: new T.Vector3(0, 0, -32) });
  blanco.colisiones = []; blanco.alDisparar = null; blanco.vida = 9999;
  blanco.actualizar = () => {};
  let cruzo = 0, lateral = 0;
  for (let i = 0; i < 60 * 6; i++) {
    t.actualizar(1 / 60, j.jugador, j.soldados);
    j.separarAhora();
    cruzo = Math.min(cruzo || 99, t.pos.z);
    lateral = Math.max(lateral, Math.abs(t.pos.x));
  }
  ok('el hombre no cruza la tapia', cruzo > -19.6, `lo más lejos que llegó: z=${cruzo.toFixed(2)}`);
  ok('y no se queda clavado: desliza de costado', lateral > 1.5, `se corrió ${lateral.toFixed(1)} m al costado`);

  // ---------- 4. el caballo empuja, no se deja empujar ----------
  limpiar();
  const l = j.soltarSoldado('granadero', { montado: true, pos: new T.Vector3(0, 0, 0) });
  l.monta.colisiones = []; l.monta.pos.set(0, 0, 0); l.monta.rumbo = 0;
  l.monta.andar = 3; l.monta.vel = 10.2; l._sentar();
  const enElMedio = j.soltarSoldado('realista', { pos: new T.Vector3(0.1, 0, -14) });
  enElMedio.colisiones = []; enElMedio.alDisparar = null; enElMedio.vida = 9999;
  let velMin = 99, distMin = 99;
  for (let i = 0; i < 60 * 4; i++) {
    l.actualizar(1 / 60, j.jugador, j.soldados);
    enElMedio.actualizar(1 / 60, j.jugador, j.soldados);
    j.separarAhora();
    if (!l.monta) break;                       // si lo desmontaron, la prueba ya no mide esto
    if (Math.abs(l.monta.pos.z - enElMedio.pos.z) < 3) {
      velMin = Math.min(velMin, l.monta.vel);
      distMin = Math.min(distMin, Math.hypot(l.monta.pos.x - enElMedio.pos.x, l.monta.pos.z - enElMedio.pos.z));
    }
  }
  ok('el infante no le frena la carga', velMin > 6 || velMin === 99, `bajó a ${velMin === 99 ? '—' : velMin.toFixed(1)} m/s`);
  ok('pero tampoco le pasa por adentro', distMin > 1.0 || distMin === 99, `se acercaron a ${distMin.toFixed(2)} m`);

  // ---------- 5. nadie queda clavado en el campo de verdad ----------
  limpiar();
  const tropa = [];
  for (let k = 0; k < 40; k++) {
    tropa.push(j.soltarSoldado('realista', { pos: new T.Vector3(-24 + k * 1.2, 0, -30 - (k % 5) * 4) }));
  }
  for (let k = 0; k < 10; k++) j.soltarSoldado('granadero', { pos: new T.Vector3(-10 + k * 2.2, 0, 4) });
  const inicio = tropa.map(s => ({ x: s.pos.x, z: s.pos.z }));
  await esperar(60 * 12);
  let quietos = 0;
  tropa.forEach((s, i) => {
    if (!s.vivo) return;
    if (Math.hypot(s.pos.x - inicio[i].x, s.pos.z - inicio[i].z) < 0.5) quietos++;
  });
  const vivos = tropa.filter(s => s.vivo).length;
  ok('la tropa avanza, no se traba en el decorado', quietos <= Math.max(2, vivos * 0.15),
    `${quietos} de ${vivos} vivos no se movieron`);

  // ---------- 6. lo que cuesta ----------
  limpiar();
  for (let k = 0; k < 250; k++) j.soltarSoldado('realista', { pos: new T.Vector3(-40 + (k % 50) * 1.6, 0, -62 - Math.floor(k / 50) * 3) });
  for (const lado of [-1, 1]) for (let k = 0; k < 60; k++) {
    j.soltarSoldado('granadero', { montado: true, pos: new T.Vector3(lado * (34 + (k % 6) * 2.4), 0, -4 - Math.floor(k / 6) * 3) });
  }
  await esperar(12);
  const t0 = performance.now();
  for (let k = 0; k < 40; k++) j.separarAhora();
  const ms = (performance.now() - t0) / 40;
  ok('la separación de 370 hombres es barata', ms < 2.5, `${ms.toFixed(2)} ms por cuadro`);
  limpiar();
  return out;
});
for (const [e, n, x] of r) console.log(e.padEnd(4), n.padEnd(46), x);
const mal = r.filter(x => x[0] === 'MAL').length;
console.log(`\n${r.filter(x => x[0] === 'OK ').length} bien, ${mal} mal`);
console.log(errs.length ? 'ERRORES: ' + errs.join(' / ') : 'sin errores de consola');
await nav.close();
