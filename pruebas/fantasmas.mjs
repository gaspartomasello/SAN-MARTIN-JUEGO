// CAZA DE FANTASMAS.
//
// El bicho que se repite: un jinete que queda congelado en el aire, sentado
// sobre un caballo que no está. No se busca adivinando: se escribe la regla que
// NUNCA se puede romper y se hace correr la batalla entera hasta que alguien la
// rompa. Después el informe dice quién, cuándo y en qué estado.
//
// Las reglas, todas obvias y todas necesarias:
//   1. si va montado, está sentado EXACTAMENTE encima de su caballo
//   2. si va montado, su caballo está vivo y lo reconoce como jinete
//   3. si NO va montado, sus pies están en el piso — nadie flota
//   4. un caballo con jinete anotado tiene que ser el caballo de ese jinete
//   5. un caballo suelto no puede tener jinete anotado
import { chromium } from 'playwright';
const nav = await chromium.launch({ executablePath: process.env.CHROMIUM,
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
const pag = await nav.newPage({ viewport: { width: 900, height: 620 } });
const errs = []; pag.on('pageerror', e => errs.push(e.message));
await pag.goto('http://localhost:8099/index.html', { waitUntil: 'load' });
await pag.waitForTimeout(1200); await pag.click('#empezar'); await pag.waitForTimeout(1800);

const r = await pag.evaluate(async () => {
  const j = window.juego;
  const T = await import('/vendor/three.module.js');
  const fallas = [];
  const vistos = new Map();

  // CUÁNTOS CUADROS DURA. Un cuadro suelto en el que el caballo murió después
  // de que su jinete ya se actualizó no es un bicho: es el orden del bucle, y
  // al cuadro siguiente está resuelto. Un jinete CONGELADO dura para siempre.
  // Así que no se cuenta cuántas veces se rompe la regla, se cuenta cuántos
  // cuadros seguidos sigue rota para el mismo hombre.
  const rachas = new Map();
  let cuadro = 0;

  const anotar = (regla, s, extra) => {
    const suyo = regla + '#' + s.orden;
    const r = rachas.get(suyo);
    const largo = (r && r.hasta === cuadro - 1) ? r.largo + 1 : 1;
    rachas.set(suyo, { hasta: cuadro, largo });

    const clave = regla + '|' + (s.estado || '') + '|' + (s.lancero ? 'lancero' : 'pie');
    const antes = vistos.get(clave);
    if (antes && antes.racha >= largo) return;   // ya tenemos una peor de esta especie
    const ficha = {
      regla,
      racha: largo,
      bando: s.bando,
      estado: s.estado,
      vivo: s.vivo,
      montado: s.montado,
      lancero: s.lancero,
      lejos: s.lejos,
      plaza: !!s.plaza,
      y: +s.pos.y.toFixed(3),
      caballo: s.monta ? { vivo: s.monta.vivo, alto: +s.monta.alto.toFixed(2), aire: s.monta.enElAire,
        jineteOk: s.monta.jinete === s, d: +Math.hypot(s.pos.x - s.monta.pos.x, s.pos.z - s.monta.pos.z).toFixed(2) } : null,
      ...extra
    };
    if (antes) { const i = fallas.indexOf(antes.ficha); if (i >= 0) fallas.splice(i, 1); }
    vistos.set(clave, { racha: largo, ficha });
    fallas.push(ficha);
  };

  const revisar = () => {
    cuadro++;
    for (const s of j.soldados) {
      if (s.montado) {
        const c = s.monta;
        if (!c) { anotar('montado sin caballo', s); continue; }
        if (!c.vivo) anotar('montado en un caballo muerto', s);
        if (c.jinete !== s) anotar('el caballo no lo reconoce', s);
        const d = Math.hypot(s.pos.x - c.pos.x, s.pos.z - c.pos.z);
        if (d > 0.15) anotar('montado pero despegado', s, { despegue: +d.toFixed(2) });
      } else {
        if (s.monta) anotar('desmontado pero con caballo puesto', s);
        // en el piso: vivo a 0, muerto se hunde 10 cm. Nada por el aire.
        if (s.pos.y > 0.06) anotar('a pie pero flotando', s);
        // la parte que se VE del bicho: sigue con las piernas abiertas como si
        // el caballo estuviera abajo
        if (s.fig.montura) anotar('a pie pero a horcajadas', s);
      }
    }
    for (const c of j.caballos) {
      if (c.jinete) {
        if (c.jinete.monta !== c) suelto('caballo con jinete que no lo monta');
        if (!c.montado) suelto('caballo suelto con jinete anotado');
      }
      // un caballo al que le sacaron la malla pero sigue en la lista: invisible,
      // y sin embargo sigue empujando gente y ocupando lugar
      if (!c.raiz.parent) suelto('caballo fantasma: sin malla y todavía en la lista');
    }
    // y al revés: un caballo montado que ya no está en la lista no lo actualiza
    // nadie salvo su jinete, así que se sale de la simulación por la puerta de atrás
    for (const s of j.soldados) {
      if (s.monta && !j.caballos.includes(s.monta)) anotar('monta un caballo que no está en la lista', s);
      if (s.malla.visible === s.lejos) anotar('dibujado por los dos lados o por ninguno', s);
    }
    if (j.lejania.desbordes > 0) suelto('la lejanía se quedó sin lugar: ' + j.lejania.desbordes);
  };

  // fallas que no cuelgan de un soldado concreto
  const sueltosVistos = new Set();
  const suelto = (regla) => {
    if (sueltosVistos.has(regla)) return;
    sueltosVistos.add(regla);
    fallas.push({ regla, racha: 999 });
  };

  // EL BUCLE DE VERDAD. No una reconstrucción: la misma función que corre el
  // juego, llamada a paso fijo y sin dibujar. Si el bicho está en el orden del
  // bucle, acá aparece.
  // un guion mínimo que revuelve el avispero: el jugador se baja, se sube y le
  // matan el caballo, que es lo que hace en una partida de verdad
  let guion = -1;
  const paso = () => {
    if (guion >= 0) {
      guion++;
      if (guion === 60 * 8) j.montarODesmontar();
      if (guion === 60 * 12) { const c = j.caballos.find(x => x.vivo && !x.montado); if (c) j.jugador.montar(c); }
      if (guion === 60 * 20 && j.jugador.monta) j.jugador.monta.recibir(9);
      if (guion === 60 * 40) { const c = j.caballos.find(x => x.vivo && !x.montado); if (c) j.jugador.montar(c); }
      // y a los lanceros les van matando los caballos, que es el disparador
      if (guion % 90 === 0) {
        const v = j.soldados.filter(s => s.montado);
        if (v.length) v[Math.floor(Math.random() * v.length)].monta.recibir(9);
      }
    }
    j.simular(1 / 60);
    revisar();
  };

  const limpiar = () => {
    j.soldados.forEach(s => s.quitar()); j.soldados.length = 0;
    for (const c of j.caballos.slice()) if (j.jugador.monta !== c) c.quitar();
    j.caballos.length = 0;
    j.pinza.desarmar();
  };

  const cortes = {};
  let previo = 0;
  const escenario = (nombre, armar, segundos) => {
    // CADA UNO DOS VECES: con todo cerca —malla articulada— y con todo lejos
    // —instancia horneada—. El bicho puede estar en cualquiera de los dos
    // caminos y el jugador los cruza todo el tiempo.
    for (const corte of [30, 4]) {
      limpiar();
      j.lod(corte);
      armar();
      for (let i = 0; i < 60 * segundos; i++) paso();
      cortes[nombre + (corte === 4 ? ' (lejos)' : '')] = fallas.length - previo;
      previo = fallas.length;
    }
    j.lod(30);
  };

  escenario('escaramuza', () => {
    j.jugador.pos.set(0, 1.68, 10); j.jugador.vivo = true;
    for (let k = 0; k < 14; k++) j.soltarSoldado('granadero', { montado: true, pos: new T.Vector3(-24 + k * 4, 0, -6) });
    for (let k = 0; k < 30; k++) j.soltarSoldado('realista', { pos: new T.Vector3(-22 + k * 1.5, 0, -52) });
  }, 55);

  escenario('metralla', () => {
    j.ponerCanones();
    for (let k = 0; k < 12; k++) j.soltarSoldado('granadero', { montado: true, pos: new T.Vector3(-18 + k * 3.4, 0, -30) });
  }, 45);

  // El juego como se juega: refuerzos que van cayendo, el jugador montando y
  // desmontando, y el caballo del jugador muriéndose —que es de donde sale el
  // acto Cabral y el único momento en que el jugador queda a media altura a
  // propósito—.
  escenario('partida', () => {
    j.jugador.pos.set(0, 1.68, 6); j.jugador.vivo = true; j.jugador.vida = 100;
    j.ponerCanones();
    for (let k = 0; k < 8; k++) j.soltarSoldado('granadero', { montado: true, pos: new T.Vector3(-14 + k * 4, 0, -4) });
    for (let k = 0; k < 20; k++) j.soltarSoldado('realista', { pos: new T.Vector3(-16 + k * 1.7, 0, -46) });
    // el jugador se sube a un caballo y lo va a hacer matar
    if (!j.jugador.monta) { const c = j.caballos.find(x => x.vivo && !x.montado); if (c) j.jugador.montar(c); }
    guion = 0;
  }, 60);

  escenario('pinza', () => {
    j.formarPinza(24, 80);
    for (let i = 0; i < 60 * 4; i++) paso();
    j.pinza.tocar();
  }, 65);

  limpiar();
  return { fallas, cortes };
});

// Un parpadeo de uno o dos cuadros es el orden del bucle. Tres o más cuadros
// seguidos ya es algo que se ve. Y cien es el bicho del que se quejó el jugador.
const graves = r.fallas.filter(f => f.racha >= 3);
console.log('violaciones por escenario:', JSON.stringify(r.cortes));
console.log(`peor racha de cada especie (${r.fallas.length} especies):`);
for (const f of r.fallas.sort((a, b) => b.racha - a.racha)) {
  console.log(`  ${String(f.racha).padStart(5)} cuadros · ${f.regla}`);
}
if (!graves.length) console.log('\nOK   sin fantasmas: ninguna regla queda rota más de dos cuadros');
for (const f of graves) console.log('\nMAL  ' + f.regla + ' (' + f.racha + ' cuadros)\n     ' + JSON.stringify(f));
console.log(`\n${graves.length ? 0 : 1} bien, ${graves.length} mal`);
console.log(errs.length ? '\nERRORES: ' + errs.join(' / ') : '\nsin errores de consola');
await nav.close();
