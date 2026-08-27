// ¿CUÁNTO DURA LA BATALLA Y CUÁNTO DURÁS VOS?
//
// Los números de pelea no se calibran a ojo: se miden. Esto corre la batalla de
// verdad con el bucle de verdad y contesta tres preguntas —cuánto vive el
// jugador quieto en medio del campo, qué porcentaje de los tiros enemigos
// acierta a cada distancia, y en cuánto se consumen los dos ejércitos—.
import { chromium } from 'playwright';
const nav = await chromium.launch({ executablePath: process.env.CHROMIUM,
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
const pag = await nav.newPage({ viewport: { width: 900, height: 620 } });
const errs = []; pag.on('pageerror', e => errs.push(e.message));
await pag.goto('http://localhost:8099/index.html', { waitUntil: 'load' });
await pag.waitForTimeout(1200); await pag.click('#modo-campo'); await pag.waitForTimeout(1800);

const r = await pag.evaluate(async () => {
  const j = window.juego;
  const T = await import('/vendor/three.module.js');
  const out = [];
  const ok = (n, cond, extra) => out.push([cond ? 'OK ' : 'MAL', n, extra === undefined ? '' : extra]);
  const limpiar = () => {
    j.soldados.forEach(s => s.quitar()); j.soldados.length = 0;
    for (const c of j.caballos.slice()) if (j.jugador.monta !== c) c.quitar();
    j.caballos.length = 0;
    j.pinza.desarmar();
  };

  // ---------- 1. la dispersión: qué tan seguido acierta un fusil ----------
  limpiar();
  const tirador = j.soltarSoldado('realista', { pos: new T.Vector3(0, 0, -60) });
  const tabla = [];
  for (const d of [5, 10, 20, 40, 60]) {
    let dio = 0;
    for (let k = 0; k < 4000; k++) if (tirador.apuntarA(d, 0, 0.34).acierto) dio++;
    tabla.push([d, dio / 4000]);
  }
  for (const [d, p] of tabla) out.push(['—', `acierto a ${d} m`, `${(p * 100).toFixed(0)} %`]);
  ok('a cinco metros no es seguro', tabla[0][1] < 0.85 && tabla[0][1] > 0.4);
  ok('a veinte metros ya falla más de lo que acierta', tabla[2][1] < 0.45);
  ok('a sesenta metros es casi suerte', tabla[4][1] < 0.14);
  ok('cae con la distancia, sin escalones', tabla.every((f, i) => i === 0 || f[1] < tabla[i - 1][1]));
  let hincado = 0;
  tirador.rodilla = true;
  for (let k = 0; k < 4000; k++) if (tirador.apuntarA(20, 0, 0.34).acierto) hincado++;
  tirador.rodilla = false;
  ok('hincado apunta mejor', hincado / 4000 > tabla[2][1] * 1.2,
    `${(hincado / 40).toFixed(0)} % contra ${(tabla[2][1] * 100).toFixed(0)} %`);
  let conHumo = 0;
  for (let k = 0; k < 4000; k++) if (tirador.apuntarA(20, 1, 0.34).acierto) conHumo++;
  ok('el humo le abre el tiro', conHumo / 4000 < tabla[2][1] * 0.6, `${(conHumo / 40).toFixed(0)} %`);

  // ---------- 2. cuánto vivís parado en el medio ----------
  const sobrevivir = (n, dist) => {
    limpiar();
    j.jugador.pos.set(0, 1.68, 0);
    j.jugador.vida = 100; j.jugador.vendas = 0;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      j.soltarSoldado('realista', { pos: new T.Vector3(Math.sin(a) * dist, 0, Math.cos(a) * dist) });
    }
    let t = 0;
    while (j.jugador.vida > 0 && t < 180) { j.simular(1 / 60); t += 1 / 60; }
    return t;
  };
  const solo = sobrevivir(1, 18);
  const seis = sobrevivir(6, 18);
  out.push(['—', 'contra 1 realista a 18 m', `${solo.toFixed(0)} s`]);
  out.push(['—', 'contra 6 realistas a 18 m', `${seis.toFixed(0)} s`]);
  // Ojo con leer esto mal: acá el jugador es una ESTATUA con cien de vida, sin
  // parar, sin disparar, sin moverse. Es un piso, no un objetivo. Lo que se
  // mide es que haya tiempo de reaccionar, no que se sobreviva sin hacer nada.
  ok('contra uno solo hay tiempo de sobra para responder', solo > 16, `${solo.toFixed(0)} s`);
  ok('contra seis morís, pero da para salir de ahí', seis > 6, `${seis.toFixed(0)} s`);

  // ---------- 3. ¿corren siempre? ¿vienen todos juntos? ----------
  limpiar();
  j.jugador.pos.set(0, 1.68, 0); j.jugador.revivir();
  for (let k = 0; k < 30; k++) {
    j.soltarSoldado('realista', { pos: new T.Vector3(-20 + k * 1.4, 0, -34) });
  }
  let cuadros = 0, corriendoSuma = 0, corriendoPico = 0, conCarrera = 0;
  const trote = new Array(30).fill(0);
  for (let i = 0; i < 60 * 40; i++) {
    j.simular(1 / 60);
    const re = j.soldados.filter(s => s.esRealista && s.vivo);
    if (!re.length) break;
    const corren = re.filter(s => s.estado === 'correr').length;
    corriendoSuma += corren / re.length;
    corriendoPico = Math.max(corriendoPico, corren / re.length);
    if (corren > 0) conCarrera++;
    cuadros++;
    re.forEach((s, k) => { if (k < 30 && s.estado === 'correr') trote[k]++; });
  }
  const mediaCorriendo = corriendoSuma / Math.max(1, cuadros);
  out.push(['—', 'proporción corriendo', `promedio ${(mediaCorriendo * 100).toFixed(0)} % · pico ${(corriendoPico * 100).toFixed(0)} %`]);
  ok('no corren todos siempre', mediaCorriendo < 0.45, `${(mediaCorriendo * 100).toFixed(0)} % del tiempo`);
  ok('ni siquiera todos a la vez en el peor momento', corriendoPico < 0.9, `pico ${(corriendoPico * 100).toFixed(0)} %`);
  const alguno = trote.filter(v => v > 0).length;
  ok('pero corren: no es que dejaron de correr', alguno > 12, `${alguno} de 30 corrieron alguna vez`);

  // ---------- 4. la batalla entera: ¿dura? ----------
  limpiar();
  j.jugador.revivir();          // venía muerto de la prueba anterior
  j.formarPinza(60, 250);
  j.pinza.tocar();
  const gr0 = j.soldados.filter(s => !s.esRealista).length;
  const re0 = j.soldados.filter(s => s.esRealista).length;
  const curva = [];
  let t = 0, muerteJugador = -1, acosoMax = 0, acosoSuma = 0, muestras = 0;
  while (t < 15 * 60) {
    // el jugador CARGA: si se queda quieto no es una batalla, es una foto
    if (j.jugador.monta) { j.jugador.monta.andar = 3; j.jugador.monta.rumbo = Math.atan2(0 - j.jugador.monta.pos.x, -62 - j.jugador.monta.pos.z) + Math.PI; }
    j.simular(1 / 60); t += 1 / 60;
    if (muerteJugador < 0 && !j.jugador.vivo) muerteJugador = t;
    if (j.jugador.vivo) {
      // cuántos lo tienen a menos de cuatro metros: el acoso real
      let n = 0;
      for (const s of j.soldados) if (s.vivo && s.esRealista && Math.hypot(s.pos.x - j.jugador.pos.x, s.pos.z - j.jugador.pos.z) < 4) n++;
      acosoMax = Math.max(acosoMax, n); acosoSuma += n; muestras++;
    }
    if (Math.abs(t % 60) < 1 / 90) {
      curva.push({
        min: Math.round(t / 60),
        gr: j.soldados.filter(s => !s.esRealista && s.vivo).length,
        re: j.soldados.filter(s => s.esRealista && s.vivo).length,
        vos: Math.round(j.jugador.vida)
      });
    }
    const gr = j.soldados.filter(s => !s.esRealista && s.vivo).length;
    const re = j.soldados.filter(s => s.esRealista && s.vivo).length;
    if (gr === 0 || re === 0) break;
  }
  out.push(['—', 'vos, cargando', muerteJugador > 0 ? `caíste a los ${muerteJugador.toFixed(0)} s` : `sobreviviste con ${Math.round(j.jugador.vida)} de vida`]);
  out.push(['—', 'gente encima tuyo', `pico ${acosoMax} · promedio ${(acosoSuma / Math.max(1, muestras)).toFixed(1)}`]);
  ok('no te caen todos encima a la vez', acosoMax <= 6, `pico de ${acosoMax}`);
  const grF = j.soldados.filter(s => !s.esRealista && s.vivo).length;
  const reF = j.soldados.filter(s => s.esRealista && s.vivo).length;
  out.push(['—', 'la batalla', `${(t / 60).toFixed(1)} min · granaderos ${gr0}→${grF} · realistas ${re0}→${reF}`]);
  for (const c of curva) out.push(['—', `  minuto ${c.min}`, `granaderos ${c.gr} · realistas ${c.re} · vos ${c.vos}`]);
  ok('los 120 granaderos no se evaporan en el primer minuto',
    !curva[0] || curva[0].gr > gr0 * 0.45, curva[0] ? `quedaban ${curva[0].gr} al minuto 1` : '');
  // CÓMO TERMINA LA BATALLA YA NO SE MIDE ACÁ.
  //
  // Este archivo pedía que la batalla durara más de minuto y medio, y tenía
  // razón mientras la única forma de terminarla fuera matarlos a todos: ahí,
  // que se resolviera rápido quería decir que alguien barría al otro.
  //
  // Con moral eso se dio vuelta. Terminar rápido pasó a ser lo que se buscaba
  // —la línea se quiebra y baja la barranca— y el reloj dejó de decir nada
  // por sí solo: media hora de exterminio y medio minuto de desbandada dan
  // números opuestos y sólo el segundo es San Lorenzo.
  //
  // Así que la pregunta se mudó entera a pruebas/moral.mjs, que mide lo que
  // ahora importa: si se van más de los que mueren. Acá quedan las tablas de
  // daño, que es lo de este archivo.
  ok('y los dos bandos se hacen daño', reF < re0 * 0.5 && grF < gr0,
    `realistas ${re0}→${reF}, granaderos ${gr0}→${grF}`);
  limpiar();
  return out;
});
for (const [e, n, x] of r) console.log(e.padEnd(4), n.padEnd(42), x);
const mal = r.filter(x => x[0] === 'MAL').length;
console.log(`\n${r.filter(x => x[0] === 'OK ').length} bien, ${mal} mal`);
console.log(errs.length ? 'ERRORES: ' + errs.join(' / ') : 'sin errores de consola');
await nav.close();
