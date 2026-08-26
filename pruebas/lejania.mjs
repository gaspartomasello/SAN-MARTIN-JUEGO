// LA LEJANÍA. Lo que hay que probar no es que se dibuje: es que el hombre de
// lejos sea EL MISMO hombre. Que pelee igual, que muera igual y que al volver
// a acercarse no haya perdido nada más que triángulos.
import { chromium } from 'playwright';
const nav = await chromium.launch({ executablePath: process.env.CHROMIUM,
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
const pag = await nav.newPage({ viewport: { width: 900, height: 620 } });
const errs = [];
pag.on('pageerror', e => errs.push(e.message));
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
  const lej = j.lejania;

  // ---------- 1. el horno ----------
  const lotes = [...lej.lotes.keys()];
  ok('hornea las cuatro familias', ['granadero', 'realista', 'lancero', 'caballo'].every(k => lotes.includes(k)), lotes.join(','));

  const huella = lista => lista.map(l => {
    const a = l.malla.geometry.attributes.position;
    let s = 0; for (let i = 0; i < a.count; i++) s += a.getX(i) * 1.7 + a.getY(i) * 3.1 + a.getZ(i) * 5.3;
    return Math.round(s * 100);
  });
  let repetidas = 0;
  for (const [, lista] of lej.lotes) if (new Set(huella(lista)).size !== lista.length) repetidas++;
  ok('cada postura sale distinta del horno', repetidas === 0, `${repetidas} familias con fases repetidas`);

  const g0 = lej.lotes.get('granadero')[0].malla.geometry;
  const tris = g0.attributes.position.count / 3;
  ok('la migaja se tira', tris < g0.userData.crudos * 0.5, `${tris} de ${g0.userData.crudos} triángulos`);
  ok('pero queda un hombre, no un palo', tris > 400, `${tris} triángulos`);

  // ---------- 2. el reparto ----------
  limpiar();
  j.jugador.pos.set(0, 1.68, 0);
  const cerca = j.soltarSoldado('realista', { pos: new T.Vector3(0, 0, -8) });
  const lejos = j.soltarSoldado('realista', { pos: new T.Vector3(0, 0, -70) });
  await esperar(4);
  ok('el de ocho metros se arma hueso por hueso', !cerca.lejos && cerca.malla.visible && !cerca.fig.lejos);
  ok('el de setenta lo dibuja la lejanía', lejos.lejos && !lejos.malla.visible && lejos.fig.lejos);
  ok('y quedan instancias puestas', lej.instancias >= 1, `${lej.instancias} instancias en ${lej.dibujando} lotes`);

  // ---------- 3. el de lejos pelea igual ----------
  //
  // La prueba que importa: dos realistas idénticos, uno articulado y otro
  // horneado, sueltos contra el mismo blanco. Si la lejanía tocara la IA,
  // acá se vería.
  limpiar();
  j.jugador.pos.set(0, 1.68, 0);
  const blanco = j.soltarSoldado('granadero', { pos: new T.Vector3(0, 0, -40) });
  blanco.alDisparar = null;
  const A = j.soltarSoldado('realista', { pos: new T.Vector3(-3, 0, -80) });
  const B = j.soltarSoldado('realista', { pos: new T.Vector3(3, 0, -80) });
  for (const s of [A, B]) { s.alDisparar = null; s.recarga = 0.4; }
  A.ponerLejos(false); B.ponerLejos(true);
  let tiros = { a: 0, b: 0 };
  A.alDisparar = () => tiros.a++; B.alDisparar = () => tiros.b++;
  for (let i = 0; i < 60 * 12; i++) {
    A.ponerLejos(false); B.ponerLejos(true);
    for (const s of [A, B, blanco]) s.actualizar(1 / 60, { pos: new T.Vector3(0, 1.68, 500), vivo: false, jugador: true }, j.soldados);
  }
  const dA = Math.hypot(A.pos.x + 3, A.pos.z + 80), dB = Math.hypot(B.pos.x - 3, B.pos.z + 80);
  ok('recorren lo mismo', Math.abs(dA - dB) < 0.6, `${dA.toFixed(1)} m vs ${dB.toFixed(1)} m`);
  ok('disparan lo mismo', Math.abs(tiros.a - tiros.b) <= 1, `${tiros.a} vs ${tiros.b}`);
  ok('el de lejos también cuenta el paso', B.fig.paso > 1, B.fig.paso.toFixed(1));
  // y la cuenta que NO paga: doce cuadros de cinemática inversa sobre un
  // hombre que nadie está mirando de cerca
  const antesQ = B.fig.h.hombroD.quaternion.clone();
  const antesM = B.fig.cur.manoD.clone();
  for (let i = 0; i < 12; i++) { B.ponerLejos(true); B.fig.poner('apuntar'); B.fig.actualizar(1 / 60, true, 2.3); }
  ok('pero no arma el cuerpo', B.fig.h.hombroD.quaternion.equals(antesQ) && B.fig.cur.manoD.equals(antesM));
  // y en cuanto vuelve, lo arma
  B.ponerLejos(false); B.fig.actualizar(1 / 60, true, 2.3);
  ok('y lo arma apenas se acerca', !B.fig.h.hombroD.quaternion.equals(antesQ));
  B.ponerLejos(true);

  // ---------- 4. cada estado en su fase ----------
  const fases = [];
  const espiar = (s) => {
    let vista = -1;
    const falso = { poner: (c, f) => { vista = f; return true; } };
    s.pintarLejos(falso);
    return vista;
  };
  limpiar();
  const p = j.soltarSoldado('realista', { pos: new T.Vector3(0, 0, -70) });
  p.ponerLejos(true);
  p.andando = false; p.rodilla = false; p.fig.pose = 'marcha';
  fases.push(['de pie', espiar(p), 0]);
  p.andando = true; p.fig.paso = 0.5;
  fases.push(['caminando', espiar(p), 1]);
  p.fig.paso = 0.5 + Math.PI;
  fases.push(['el otro pie', espiar(p), 2]);
  p.andando = false; p.fig.pose = 'apuntar';
  fases.push(['apuntando parado', espiar(p), 5]);
  p.rodilla = true;
  fases.push(['con la rodilla en tierra', espiar(p), 4]);
  p.rodilla = false; p.vivo = false;
  fases.push(['muerto', espiar(p), 3]);
  for (const [n, dio, esp] of fases) ok(n + ' → su fase', dio === esp, `fase ${dio}, esperada ${esp}`);

  // ---------- 5. el lancero va entero ----------
  limpiar();
  const lan = j.soltarSoldado('granadero', { montado: true, pos: new T.Vector3(0, 0, -70) });
  await esperar(4);
  ok('el lancero de lejos es una sola instancia', lan.lejos && lan.monta.lejos && !lan.monta.raiz.visible && !lan.malla.visible);
  let clave = null;
  lan.pintarLejos({ poner: c => { clave = c; return true; } });
  ok('y va en el lote del lancero', clave === 'lancero', clave);

  // ---------- 6. volver de lejos no rompe nada ----------
  lan.ponerLejos(false);
  lan.actualizar(1 / 60, j.jugador, j.soldados);
  ok('al acercarse vuelve a armarse', lan.malla.visible && !lan.fig.lejos && lan.monta.raiz.visible);

  // ---------- 7. la batalla entera ----------
  limpiar();
  j.jugador.pos.set(0, 1.68, 0);
  for (let k = 0; k < 250; k++) j.soltarSoldado('realista', { pos: new T.Vector3(-40 + (k % 50) * 1.6, 0, -62 - Math.floor(k / 50) * 3) });
  for (const lado of [-1, 1]) for (let k = 0; k < 60; k++) {
    j.soltarSoldado('granadero', { montado: true, pos: new T.Vector3(lado * (34 + (k % 6) * 2.4), 0, -4 - Math.floor(k / 6) * 3) });
  }
  await esperar(25);
  const draws = j.info.calls;
  ok('370 hombres en el campo', j.soldados.length === 370, `${j.soldados.length}`);
  ok('y entran en el presupuesto de 120 llamadas', draws <= 120, `${draws} llamadas`);
  ok('sin desbordes de capacidad', lej.desbordes === 0, `${lej.desbordes} instancias sin lugar`);
  ok('casi todos los dibuja la lejanía', lej.instancias > 330, `${lej.instancias} instancias en ${lej.dibujando} lotes`);

  const t0 = performance.now();
  for (let k = 0; k < 20; k++) {
    for (const s of j.soldados) s.actualizar(1 / 60, j.jugador, j.soldados);
    for (const c of j.caballos) { if (c.actualizado) { c.actualizado = false; continue; } c.actualizar(1 / 60, { girar: 0 }); }
  }
  const ms = (performance.now() - t0) / 20;
  ok('la simulación entra en un cuadro de 60', ms < 8, `${ms.toFixed(2)} ms por cuadro`);

  limpiar();
  return out;
});
for (const [e, n, x] of r) console.log(e.padEnd(4), n.padEnd(42), x);
const mal = r.filter(x => x[0] === 'MAL').length;
console.log(`\n${r.filter(x => x[0] === 'OK ').length} bien, ${mal} mal`);
console.log(errs.length ? 'ERRORES: ' + errs.join(' / ') : 'sin errores de consola');
await nav.close();
