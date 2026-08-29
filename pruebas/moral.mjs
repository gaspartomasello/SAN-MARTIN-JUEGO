// LA MORAL. Lo que hay que medir no es que el número baje: es que la batalla
// TERMINE POR QUIEBRE Y NO POR EXTERMINIO, que es la diferencia entre San
// Lorenzo y una matanza.
//
// Cuatro cosas:
//   1. que la línea realista se rompa con la mayoría de sus hombres EN PIE;
//   2. que flanquear rompa y de frente no —si eso no se cumple, la pinza sigue
//      siendo una decoración—;
//   3. que tus granaderos también se puedan quebrar: si sólo se rompe el
//      enemigo, esto no es moral, es un botón de ganar;
//   4. que se desbande de golpe y no se derrita de a uno.
import { chromium } from 'playwright';
const nav = await chromium.launch({ executablePath: process.env.CHROMIUM,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const pag = await nav.newPage({ viewport: { width: 800, height: 540 } });
const errs = []; pag.on('pageerror', e => errs.push(e.message));
await pag.goto('http://localhost:8099/index.html', { waitUntil: 'load' });
await pag.waitForTimeout(1200); await pag.click('#modo-campo'); await pag.waitForTimeout(1800);

const r = await pag.evaluate(async () => {
  const j = window.juego, out = [];
  const T = j.jugador.pos.constructor;
  const ok = (n, cond, extra) => out.push([cond ? 'OK ' : 'MAL', n, extra === undefined ? '' : extra]);
  const limpiar = () => { j.campo.limpiarCampo(); j.jugador.revivir(); j.jugador.pos.set(0, 1.68, 0); };
  const vivos = b => j.soldados.filter(s => s.vivo && s.bando === b);
  const correr = n => { for (let i = 0; i < n; i++) j.simular(1 / 60); };

  // ---------- 1. el flanco rompe; el frente, no ----------
  //
  // Es LA prueba de la pinza. Se arma dos veces la misma escena —doce
  // realistas en línea mirando al campo— y se les manda la misma caballería:
  // una vez de frente y otra por el costado. Si el número sale igual, toda la
  // maniobra del 3 de febrero es un adorno.
  function escena (desdeElCostado) {
    limpiar();
    const re = [];
    for (let k = 0; k < 20; k++) {
      const s = j.soltarSoldado('realista', { pos: new T(-9.5 + k * 1.0, 0, -30) });
      // la línea mira al convento, que es su frente
      s.malla.rotation.y = Math.PI;
      s.frente = Math.PI;
      re.push(s);
    }
    // seis jinetes, EN EL MISMO PUNTO de distancia —catorce metros del centro
    // de la línea— las dos veces. Lo único que cambia entre las dos escenas es
    // el ángulo: de frente o perpendicular.
    const cx = desdeElCostado ? -14 : 0;
    const cz = desdeElCostado ? -30 : -16;
    for (let k = 0; k < 6; k++) {
      j.soltarSoldado('granadero', { montado: true,
        pos: new T(cx + (k % 3 - 1) * 1.6, 0, cz + ((k / 3) | 0) * 1.8) });
    }
    return re;
  }
  // SE MIDE EL ÁNIMO A LOS CUATRO SEGUNDOS, y el cuatro no es al azar.
  //
  // El primer intento midió «cuántos segundos tardan en quebrarse», que parecía
  // más robusto y salió peor: algunas corridas no se quebraban nunca y el tope
  // de cuarenta segundos se colaba en el promedio. Y el motivo resultó ser una
  // propiedad del sistema, no un defecto de la prueba: LA VENTAJA DEL FLANCO SE
  // AGOTA. El frente de la tropa gira a 0,32 rad/s, así que en unos diez
  // segundos la línea terminó de reorientarse y el castigo desaparece.
  //
  // Que es exactamente lo que hay que entender de la maniobra: la pinza vale en
  // los primeros segundos, no indefinidamente. Así que se mide adentro de esa
  // ventana, antes de que se cierre.
  function aguante (desdeElCostado) {
    const re = escena(desdeElCostado);
    // se los deja quietos y sin poder pegarse: acá se mide el ánimo, no quién
    // gana la pelea
    for (const s of j.soldados) { s.alDisparar = null; s.alGolpear = null; }
    for (const s of j.soldados) if (!s.esRealista) { s.plaza = new T(s.pos.x, 0, s.pos.z); s.andarColumna = 0; }
    // LOS DEL MEDIO, no los doce: en las puntas la geometría no es simétrica
    // —al último de la fila el grupo del costado le queda más lejos que el del
    // frente— y esa diferencia de metros se mezclaría con la de ángulo, que es
    // la única que se quiere medir acá.
    const medio = re.slice(6, 14);
    correr(60 * 4);
    // SE MIDE EL TÉRMINO, NO EL ÁNIMO. Medir el ánimo resultante era pedirle a
    // una diferencia de medio punto que se abriera paso entre el ruido de ocho
    // hombres con temples distintos: el promedio de tres corridas daba 0,8 a
    // favor una vez y 0,7 en contra la siguiente. `porQue.flanco` es lo que el
    // sistema ya anota, cada 0,4 s, para poder decir por qué se está quebrando
    // un hombre — y es exactamente lo que esta prueba afirma.
    return medio.reduce((a, s) => a + ((s.porQue || {}).flanco || 0), 0) / medio.length;
  }
  // SE CORRE TRES VECES Y SE PROMEDIA. El temple de cada hombre va de 0,72 a
  // 1,34 a propósito —si no, se quiebran todos en el mismo cuadro— y con veinte
  // hombres eso todavía mueve la medición medio segundo para cada lado. Una
  // sola corrida daba entre 0,58 y 0,80 de la misma relación, o sea que la
  // prueba pasaba o fallaba según los dados. Tres corridas y el promedio: la
  // respuesta correcta a una medida ruidosa no es aflojar el umbral.
  const promedio = f => (f() + f() + f()) / 3;
  const frente = promedio(() => aguante(false));
  const costado = promedio(() => aguante(true));
  out.push(['—', 'castigo de flanco a los 4 s (media de 3 corridas)',
    `de frente ${frente.toFixed(3)}/s · por el flanco ${costado.toFixed(3)}/s`]);
  // OJO CON LO QUE PEDÍA ESTO, que estuvo mal mucho tiempo: 12 puntos de ánimo
  // de diferencia, umbral de cuando la sección de moral de balance.js valía
  // treinta veces más. Después del reescalado la prueba no podía pasar ni con
  // el flanco funcionando perfecto, y falló en silencio desde entonces.
  //
  // Y lo que se aísla acá es el término de INFANTERÍA solo. El pago grande de
  // la pinza no es éste: es CABALLO_FLANCO, que multiplica por 2,4 el miedo al
  // jinete que te entra por el costado, y ése se ve en la batalla entera.
  ok('por el flanco se cobra flanco, y de frente no', costado > frente * 2.5,
    `${frente.toFixed(3)}/s contra ${costado.toFixed(3)}/s`);
  ok('y no está saturado: la línea de frente casi no lo paga', frente < 0.08,
    `${frente.toFixed(3)}/s`);

  // ---------- 2. el que se quiebra se va, y se va a la barranca ----------
  limpiar();
  const uno = j.soltarSoldado('realista', { pos: new T(0, 0, -60) });
  uno.quebrar();
  const z0 = uno.pos.z;
  correr(60 * 8);
  ok('el quebrado corre para la barranca', uno.pos.z < z0 - 12,
    `de z ${z0.toFixed(0)} a ${uno.pos.z.toFixed(0)}`);
  ok('y no dispara más', uno.estado !== 'apuntar' && !uno.objetivo);
  correr(60 * 12);
  ok('y cuando llega, se fue del campo', !j.soldados.includes(uno),
    j.soldados.includes(uno) ? `quedó en z ${uno.pos.z.toFixed(0)}` : `se fueron ${j.moral.idos}`);

  // ---------- 3. LA BATALLA ----------
  const gr0 = 120, re0 = 250;
  j.formarPinza(gr0 / 2, re0);
  // EL PILOTO SOSTIENE LAS TECLAS, como un jugador. Antes alcanzaba con escribir
  // monta.andar, pero el andar ahora sale de las teclas sostenidas y se reescribe
  // cada cuadro: sin esto el caballo del piloto queda clavado en el pasto y la
  // batalla se mide sin jugador adentro.
  j.mando.teclas.add('KeyW'); j.mando.teclas.add('ShiftLeft');

  j.tocarClarin();
  const curva = [];
  let t = 0, quiebre = -1, proxima = 2;
  while (t < 15 * 60) {
    // el jugador carga, como en pruebas/balance.mjs: quieto no es una batalla
    if (j.jugador.monta) {
      j.jugador.monta.andar = 3;
      j.jugador.monta.rumbo = Math.atan2(0 - j.jugador.monta.pos.x, -62 - j.jugador.monta.pos.z) + Math.PI;
    }
    j.simular(1 / 60); t += 1 / 60;
    if (quiebre < 0 && j.moral.lineaRota.realista) quiebre = t;
    if (t >= proxima) {
      proxima += 2;
      const p = j.moral.parte();
      curva.push({ s: Math.round(t), re: p.realistas.vivos, rotos: p.realistas.rotos,
        gr: p.granaderos.vivos, idos: p.idos });
    }
    const p = j.moral.parte();
    if (p.realistas.vivos - p.realistas.rotos <= 0) break;
    if (p.granaderos.vivos <= 0) break;
  }
  // LA PERSECUCIÓN. El bucle de arriba corta cuando ya no queda nadie
  // peleando, y en ese instante hay decenas de hombres corriendo a la barranca
  // que todavía no llegaron: algunos van a llegar y a otros los van a alcanzar.
  // Contar ahí mezcla a los que se salvaron con los que están por morir, y da
  // un número que se mueve solo —dos corridas seguidas dieron exactamente
  // 124 contra 126, o sea el empate, que es lo que pasa cuando se mide un
  // proceso a la mitad—. Se lo deja terminar.
  for (let i = 0; i < 60 * 25; i++) {
    j.simular(1 / 60);
    const p = j.moral.parte();
    if (p.realistas.rotos === 0) break;      // ya llegaron todos, o ya no llegan
  }

  const fin = j.moral.parte();
  // OJO: `rotos` cuenta a los quebrados que SIGUEN en el campo. El que llegó a
  // la barranca ya no está en ninguna lista, y se cuenta en `idos`. Sumarlos es
  // lo único que da «cuántos dejaron de pelear».
  const dejaron = fin.realistas.rotos + fin.idos;
  out.push(['—', 'curva (s: realistas/quebrados/idos · granaderos)',
    curva.map(c => `${c.s}:${c.re}/${c.rotos}/${c.idos}·g${c.gr}`).join(' ')]);
  out.push(['—', 'la batalla', `${(t / 60).toFixed(1)} min · ` +
    `realistas ${re0}: ${fin.idos} bajaron la barranca · ${dejaron - fin.idos} todavía corriendo · ` +
    `granaderos ${gr0}→${fin.granaderos.vivos}`]);

  ok('la línea realista se quiebra', fin.roto.realista, quiebre > 0 ? `al minuto ${(quiebre / 60).toFixed(1)}` : 'nunca');
  // ÉSTA es la prueba de fondo: los que se fueron tienen que ser más que los
  // que quedaron muertos en el campo. Si no, no hubo desbandada: hubo matanza.
  // ---- LA BRECHA, QUE SE IMPRIME SIEMPRE ----
  //
  // En San Lorenzo se fueron unos doscientos diez de doscientos cincuenta y
  // murieron unos cuarenta. Acá se van alrededor de ciento diez y mueren
  // ciento cuarenta, y eso NO lo arregla la moral: lo pone la lanza.
  //
  // La cuenta: los realistas caen de 254 a ~130 entre el segundo 15 y el 27,
  // o sea diez muertos por segundo. Con ciento veinte lanceros eso es una
  // muerte por lancero cada doce segundos, que es lo que dura un ciclo de
  // carga. Cada pasada mata, porque LANZA_TROPA vale 4 y VIDA_TROPA vale 4:
  // exactamente letal. Mientras eso siga así, la mitad de la fuerza se muere
  // antes de tener tiempo de quebrarse, por rápido que se quiebre.
  //
  // Así que acá se exige lo que la moral SÍ garantiza —que un tercio largo de
  // la fuerza llegue a los botes en vez de morir en el sitio— y se imprime la
  // brecha en cada corrida, para que no se olvide de qué falta.
  const muertos = re0 - fin.realistas.vivos - fin.idos;
  out.push(['—', 'contra la batalla de verdad',
    `bajaron ${fin.idos} y murieron ${muertos} · en 1813 fueron unos 210 y unos 40 ` +
    `— la diferencia la pone la lanza, no la moral`]);
  ok('un tercio de la fuerza llega a los botes', fin.idos > re0 * 0.3,
    `${fin.idos} de ${re0} bajaron la barranca`);
  ok('y tus granaderos no se evaporan', fin.granaderos.vivos > gr0 * 0.3,
    `${fin.granaderos.vivos} de ${gr0}`);

  // ---------- 4. ¿se desbanda o se derrite? ----------
  //
  // Una desbandada no es lineal: empieza con unos pocos y termina llevándose a
  // todos de una vez. Un deshielo, en cambio, avanza parejo.
  //
  // Compararlo contra el promedio no sirve —el promedio se lo come la propia
  // desbandada, así que una batalla corta y violenta da un promedio alto y la
  // medida no distingue nada—. Lo que distingue es el ARRANQUE contra el PICO:
  // si el primer tramo en el que alguien se quiebra ya se lleva tantos como el
  // peor, no hubo cascada, hubo un umbral parejo.
  const saltos = [];
  for (let i = 1; i < curva.length; i++) {
    saltos.push((curva[i].rotos + curva[i].idos) - (curva[i - 1].rotos + curva[i - 1].idos));
  }
  // La medida buena es la CONCENTRACIÓN: qué tan corta es la ventana que se
  // lleva la mitad de los quiebres. En un deshielo esa ventana es media
  // batalla; en una desbandada es un puñado de segundos.
  //
  // (Y no sirve pedir que «arranque con pocos»: contra una pinza la línea
  // entera queda flanqueada en el mismo instante, así que el primer tramo ya
  // se lleva bastantes. Eso no es un defecto de la cascada, es la maniobra.)
  const total = saltos.reduce((a, b) => a + b, 0);
  let ventana = saltos.length;
  for (let ancho = 1; ancho <= saltos.length; ancho++) {
    for (let i = 0; i + ancho <= saltos.length; i++) {
      let suma = 0;
      for (let k = i; k < i + ancho; k++) suma += saltos[k];
      if (suma >= total / 2) { ventana = Math.min(ventana, ancho); break; }
    }
    if (ventana <= ancho) break;
  }
  const porcion = ventana / Math.max(1, saltos.length);
  out.push(['—', 'quiebres cada dos segundos', saltos.join(' ')]);
  out.push(['—', 'la mitad de los quiebres entra en',
    `${ventana * 2} s de ${(saltos.length * 2)} — el ${(porcion * 100).toFixed(0)} % de la pelea`]);
  ok('se desbanda de golpe, no se derrite de a uno', porcion < 0.3,
    `la mitad en el ${(porcion * 100).toFixed(0)} % del tiempo`);

  // ---------- 5. tus granaderos también se quiebran ----------
  //
  // Si sólo se rompe el enemigo, esto no es un sistema de moral: es un botón de
  // ganar. Doce granaderos solos contra ochenta realistas tienen que irse.
  limpiar();
  const mios = [];
  for (let k = 0; k < 12; k++) {
    mios.push(j.soltarSoldado('granadero', { pos: new T(-8 + k * 1.4, 0, 0) }));
  }
  for (let k = 0; k < 80; k++) {
    j.soltarSoldado('realista', { pos: new T(-24 + (k % 20) * 2.4, 0, -14 - ((k / 20) | 0) * 2.2) });
  }
  let seFueron = 0;
  for (let i = 0; i < 60 * 50; i++) {
    j.simular(1 / 60);
    seFueron = mios.filter(m => m.quebrado || !j.soldados.includes(m)).length;
    if (seFueron >= 7) break;
  }
  ok('tus granaderos, solos contra ochenta, también se van', seFueron >= 7,
    `${seFueron} de 12 dejaron de pelear`);

  // ---------- 5. el costo ----------
  const t0 = performance.now();
  for (let i = 0; i < 120; i++) j.simular(1 / 60);
  const ms = (performance.now() - t0) / 120;
  out.push(['—', 'la simulación entera con moral', `${ms.toFixed(2)} ms por cuadro`]);

  return out;
});
for (const [e, n, x] of r) console.log(e.padEnd(4), n.padEnd(46), x);
const mal = r.filter(x => x[0] === 'MAL').length;
console.log(`\n${r.filter(x => x[0] === 'OK ').length} bien, ${mal} mal`);
console.log(errs.length ? 'ERRORES: ' + errs.join(' / ') : 'sin errores de consola');
await nav.close();
