import { chromium } from 'playwright';
const SP = process.env.SP || 'tropa';
const nav = await chromium.launch({ executablePath: process.env.CHROMIUM,
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
const pag = await nav.newPage({ viewport: { width: 1280, height: 720 } });
pag.on('pageerror', e => console.log('[EXCEPCION]', e.message));
pag.on('console', m => { if (m.type() === 'error') console.log('[CONSOLA]', m.text()); });
await pag.goto('http://localhost:8099/index.html', { waitUntil: 'load' });
await pag.waitForTimeout(1200); await pag.click('#modo-campo'); await pag.waitForTimeout(1500);
const ev = (f, ...a) => pag.evaluate(f, ...a);

// una línea de seis realistas viniendo de frente
await ev(() => {
  const j = window.juego;
  j.jugador.pos.set(0, 1.68, 6); j.jugador.yaw = 0; j.jugador.pitch = -0.03;
  j.soldados.forEach(s => s.quitar()); j.soldados.length = 0;
  for (let i = 0; i < 6; i++) {
    j.soltarSoldado(i < 4 ? 'realista' : 'granadero');
    const s = j.soldados[j.soldados.length - 1];
    s.pos.set(-4.5 + i * 1.8, 0, -6 - (i % 2) * 1.5);
  }
});
await pag.waitForTimeout(4000);
await pag.screenshot({ path: SP + '/linea.png' });

const stats = await ev(() => new Promise(r => {
  const inicio = performance.now(); let n = 0;
  const t = () => { n++; if (performance.now() - inicio < 3000) requestAnimationFrame(t);
    else r({ fps: Math.round(n / ((performance.now() - inicio) / 1000)),
             estado: window.juego.soldados.map(s => s.estado + (s.avisando ? '!' : '')).join(' ') }); };
  requestAnimationFrame(t);
}));
console.log('fps:', stats.fps, '| estados:', stats.estado);
await pag.waitForTimeout(6000);
await pag.screenshot({ path: SP + '/choque.png' });

// ---------------------------------------------------------------------------
// EL TAMBOR Y EL ABANDERADO
// ---------------------------------------------------------------------------
// Los dos hombres por los que uno se mete adentro del grupo. Lo que se prueba
// acá es que se los pueda ENCONTRAR: que el paño se mueva —una chapa pintada
// clavada a un palo no se lee como una bandera— y sobre todo que ninguno de
// los dos se vaya al LOD de lejanía, que los dibuja con posturas horneadas de
// una figura genérica y les borra justo lo único por lo que se los busca.
const papeles = await ev(() => {
  const j = window.juego, o = {};
  j.soldados.forEach(s => s.quitar()); j.soldados.length = 0;
  const tam = j.soltarSoldado('realista', { papel: 'tambor' });
  const ab = j.soltarSoldado('realista', { papel: 'abanderado' });
  const raso = j.soltarSoldado('realista');

  o.trapos = ab.fig.h.trapo ? ab.fig.h.trapo.length : 0;
  o.rasoSinTrapos = !raso.fig.h.trapo && !tam.fig.h.trapo;

  // dónde queda la punta del paño, en el mundo
  const V = Object.getPrototypeOf(ab.pos).constructor;
  const punta = () => {
    ab.fig.raiz.updateMatrixWorld(true);
    return ab.fig.h.trapo[1].localToWorld(new V(0.29, 0, 0));
  };
  const correr = n => { for (let i = 0; i < n; i++) ab.fig.actualizar(1 / 60, false, 1); };
  correr(1); const a1 = punta().clone();
  correr(40); const a2 = punta().clone();
  correr(40); const a3 = punta().clone();
  o.ida = +a1.distanceTo(a2).toFixed(3);
  o.vuelta = +a2.distanceTo(a3).toFixed(3);
  o.neto = +a1.distanceTo(a3).toFixed(3);

  // y el LOD: se los manda al lejos y tienen que negarse
  for (const s of [tam, ab, raso]) s.ponerLejos(true);
  o.lejos = [tam.lejos, ab.lejos, raso.lejos];
  return o;
});
// ---------------------------------------------------------------------------
// LO QUE CAE AL PASTO NO SE HUNDE EN EL PASTO
// ---------------------------------------------------------------------------
//
// Un cuerpo y un caballo giran sobre su raíz, que está a la altura de los pies
// y de los cascos: al volcarse, el hombro y el lomo pasan al otro lado del
// piso. Medido antes de arreglarlo: medio metro el hombre y UN METRO el
// caballo. Y con el abanderado era peor todavía, porque el asta se acostaba con
// él y el paño se metía un metro y cuarto bajo tierra: la bandera desaparecía
// justo cuando había que ir a buscarla.
const piso = await ev(() => {
  const j = window.juego, o = {};
  const bajoDe = (x) => { x.updateMatrixWorld(true); let m = Infinity;
    x.traverse(y => { if (!y.isMesh || !y.geometry) return;
      const g = y.geometry; if (!g.boundingBox) g.computeBoundingBox();
      const b = g.boundingBox.clone().applyMatrix4(y.matrixWorld);
      if (isFinite(b.min.y)) m = Math.min(m, b.min.y); }); return m; };
  const altoDe = (x) => { x.updateMatrixWorld(true); let m = -Infinity;
    x.traverse(y => { if (!y.isMesh || !y.geometry) return;
      const g = y.geometry; if (!g.boundingBox) g.computeBoundingBox();
      const b = g.boundingBox.clone().applyMatrix4(y.matrixWorld);
      if (isFinite(b.max.y)) m = Math.max(m, b.max.y); }); return m; };

  j.formarPinza(20, 120);
  const p = j.jugador; p.vida = 100; p.vivo = true;
  if (p.monta) p.desmontar();
  const pap = j.campo.papeles;

  const raso = j.soldados.find(s => s.esRealista && !s.papel);
  raso.recibir(999);
  for (let i = 0; i < 200; i++) raso.actualizar(1 / 60, p, j.soldados);
  o.cuerpo = +bajoDe(raso.malla).toFixed(3);

  const cab = j.caballos.find(c => c.vivo && c !== p.monta);
  if (cab) {
    cab.recibir(99);
    for (let i = 0; i < 200; i++) cab.actualizar(1 / 60, { girar: 0 });
    o.caballo = +bajoDe(cab.raiz).toFixed(3);
  }

  o.antesDeCaer = { suya: !pap.abanderado.sinBandera, piso: j.arsenal.banderaEnPiso };
  pap.abanderado.recibir(999);
  for (let i = 0; i < 200; i++) pap.abanderado.actualizar(1 / 60, p, j.soldados);
  j.moral.actualizar(1 / 60);
  o.entregada = pap.abanderado.sinBandera;
  o.plantada = j.arsenal.banderaEnPiso;
  // el levante del abanderado tiene que ser el de un CUERPO y no el de un asta
  o.levanteAb = +pap.abanderado.fig.hundimiento().toFixed(3);
  const otros = j.soldados.filter(s => s.esRealista && !s.papel).slice(0, 40)
    .map(s => s.fig.hundimiento());
  o.levanteMax = +Math.max(...otros).toFixed(3);

  const asta = j.escena.children.find(x => x.visible && x.children.length &&
    Math.abs(x.position.x - pap.abanderado.pos.x) < 0.01 &&
    Math.abs(x.position.z - pap.abanderado.pos.z) < 0.01);
  if (asta) { o.astaBajo = +bajoDe(asta).toFixed(3); o.astaAlto = +altoDe(asta).toFixed(2); }

  // levantarla, soltarla y volverla a levantar
  p.pos.set(pap.abanderado.pos.x + 1.5, 1.68, pap.abanderado.pos.z);
  o.levantada = j.arsenal.robarBandera();
  o.enMano = j.arsenal.tenesBandera && !j.arsenal.banderaEnPiso;
  p.pos.set(18, 1.68, -26);
  o.soltada = j.arsenal.soltarBandera();
  o.quedaEnPiso = j.arsenal.banderaEnPiso && !j.arsenal.tenesBandera;
  o.reLevantada = j.arsenal.robarBandera();

  // y cuánto de la pantalla tapa la que llevás en la mano
  let ban = null;
  j.camaraArma.traverse(x => { if (x.name === 'bandera-en-mano') ban = x; });
  if (ban) {
    ban.visible = true;
    j.camaraArma.updateMatrixWorld(true);
    const V3 = Object.getPrototypeOf(p.pos).constructor;
    let x0 = 9, x1 = -9, y0 = 9, y1 = -9;
    ban.traverse(m => {
      if (!m.isMesh || !m.geometry) return;
      const g = m.geometry; if (!g.boundingBox) g.computeBoundingBox();
      const b = g.boundingBox;
      for (const i of [0, 1]) for (const jj of [0, 1]) for (const k of [0, 1]) {
        const v = new V3(i ? b.max.x : b.min.x, jj ? b.max.y : b.min.y, k ? b.max.z : b.min.z)
          .applyMatrix4(m.matrixWorld).project(j.camaraArma);
        x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x);
        y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y);
      }
    });
    const ac = (a, b) => Math.max(0, Math.min(1, b) - Math.max(-1, a));
    o.tapa = Math.round(ac(x0, x1) * ac(y0, y1) / 4 * 100);
    o.tapaCentro = Math.round(ac(Math.max(x0, -0.44), Math.min(x1, 0.44)) *
      ac(Math.max(y0, -0.60), Math.min(y1, 0.60)) / (0.88 * 1.20) * 100);
    o.bordeDerecho = +x1.toFixed(2);
  }
  return o;
});

// ---------------------------------------------------------------------------
// EL VESTUARIO DEL CRUCE
// ---------------------------------------------------------------------------
// El poncho es del CAPÍTULO 2 y tiene que llegar por el mismo caño que la tez
// y el sombrero. La primera versión no llegaba: `soltarSoldado` armaba su
// propio paquete de opciones y se comía `vestuario` en el camino, así que
// nadie en la cordillera se abrigaba y el bug no lo agarraba nadie porque la
// figura por su cuenta andaba bien. Lo que se prueba acá es el CAÑO ENTERO,
// desde `soltarSoldado` hasta la silueta horneada de la lejanía.
const ropa = await ev(() => {
  const j = window.juego, o = {};
  j.soldados.forEach(s => s.quitar()); j.soldados.length = 0;
  const clases = {};
  let andes = 0, sanlorenzo = 0;
  for (let i = 0; i < 60; i++) {
    const sem = (i * 0.0163 + 0.011) % 1;
    const a = j.soltarSoldado('granadero', { semilla: sem, vestuario: 'granaderoAndes' });
    const b = j.soltarSoldado('granadero', { semilla: sem });
    if (a.fig.conPoncho) andes++;
    if (b.fig.conPoncho) sanlorenzo++;
    clases[(a.fig.conPoncho ? 'P' : '-') + (a.fig.conPanuelo ? 'ñ' : '-')] = 1;
    a.quitar(); b.quitar();
  }
  j.soldados.length = 0;
  o.andes = andes;
  o.sanlorenzo = sanlorenzo;
  o.clases = Object.keys(clases).sort().join(' ');

  // y de lejos: que no se cambie de ropa al cruzar los treinta metros
  const uno = j.soltarSoldado('granadero', { semilla: 0.5, vestuario: 'granaderoAndes' });
  const otro = j.soltarSoldado('granadero', { semilla: 0.5 });
  o.clave = uno.claveLejos;
  o.claveVieja = otro.claveLejos;
  o.hayLote = j.lejania.lotes.has('granaderoAndes');
  j.lejania.comenzar();
  uno.ponerLejos(true); uno.pintarLejos(j.lejania);
  otro.ponerLejos(true); otro.pintarLejos(j.lejania);
  j.lejania.terminar();
  o.lotesEncendidos = j.lejania.dibujando;
  o.instancias = j.lejania.instancias;
  uno.quitar(); otro.quitar(); j.soldados.length = 0;
  return o;
});

const T = [];
T.push([ropa.sanlorenzo === 0 ? 'OK ' : 'MAL',
  'el granadero de San Lorenzo no se abriga nunca',
  `${ropa.sanlorenzo} de 60 con poncho`]);
T.push([ropa.andes > 33 && ropa.andes < 51 ? 'OK ' : 'MAL',
  'y el del Cruce sí, pero no todos',
  `${ropa.andes} de 60 con poncho`]);
T.push([ropa.clases.split(' ').length === 4 ? 'OK ' : 'MAL',
  'poncho y pañuelo se cruzan: cuatro clases de hombre', ropa.clases]);
T.push([ropa.clave === 'granaderoAndes' && ropa.claveVieja === 'granadero' && ropa.hayLote ? 'OK ' : 'MAL',
  'de lejos cada uno va a su propia silueta horneada',
  `${ropa.claveVieja} · ${ropa.clave}`]);
T.push([ropa.lotesEncendidos === 2 && ropa.instancias === 2 ? 'OK ' : 'MAL',
  'y los dos juntos son dos lotes, no doce',
  `${ropa.lotesEncendidos} lotes para ${ropa.instancias} hombres`]);
T.push([papeles.trapos === 2 ? 'OK ' : 'MAL', 'el paño se parte en tiras con hueso propio',
  `${papeles.trapos} huesos que se mueven`]);
T.push([papeles.rasoSinTrapos ? 'OK ' : 'MAL', 'y nadie más los tiene, que son 250 esqueletos', '']);
T.push([papeles.ida > 0.03 ? 'OK ' : 'MAL', 'la punta del paño se mueve, no es una chapa',
  `${papeles.ida} m en 0,67 s`]);
T.push([papeles.vuelta > 0.03 && papeles.neto < papeles.ida + papeles.vuelta ? 'OK ' : 'MAL',
  'y flamea: va y vuelve, no se va para un lado',
  `ida ${papeles.ida} · vuelta ${papeles.vuelta} · neto ${papeles.neto}`]);
T.push([papeles.lejos[0] === false && papeles.lejos[1] === false && papeles.lejos[2] === true ? 'OK ' : 'MAL',
  'ninguno de los dos se va nunca al LOD de lejos',
  `tambor=${papeles.lejos[0]} bandera=${papeles.lejos[1]} raso=${papeles.lejos[2]}`]);
T.push([piso.cuerpo > -0.15 ? 'OK ' : 'MAL', 'el cuerpo caído se apoya en el pasto',
  `${piso.cuerpo} m contra los -0,50 de antes`]);
T.push([piso.caballo > -0.25 ? 'OK ' : 'MAL', 'y el caballo muerto también, que es el que peor se enterraba',
  `${piso.caballo} m contra los -1,00 de antes`]);
T.push([piso.antesDeCaer.suya && !piso.antesDeCaer.piso ? 'OK ' : 'MAL',
  'mientras vive, el estandarte lo lleva el abanderado', '']);
T.push([piso.entregada && piso.plantada ? 'OK ' : 'MAL',
  'y al caer deja el cuerpo y queda clavado en el campo', '']);
T.push([piso.levanteAb <= piso.levanteMax + 0.01 ? 'OK ' : 'MAL',
  'el abanderado se levanta como un cuerpo, no como un asta',
  `${piso.levanteAb} m contra ${piso.levanteMax} del que más vuelca`]);
T.push([piso.astaBajo > -0.10 ? 'OK ' : 'MAL', 'el asta plantada no se hunde',
  `lo más bajo del paño, ${piso.astaBajo} m`]);
T.push([piso.astaAlto > 1.6 ? 'OK ' : 'MAL', 'y se ve desde lejos', `${piso.astaAlto} m de alto`]);
T.push([piso.levantada && piso.enMano ? 'OK ' : 'MAL', 'se la levanta del pasto', '']);
T.push([piso.soltada && piso.quedaEnPiso ? 'OK ' : 'MAL',
  'se la suelta y queda ahí, al alcance de cualquiera', '']);
T.push([piso.reLevantada ? 'OK ' : 'MAL', 'y se la vuelve a levantar', '']);
T.push([piso.tapaCentro <= 6 && piso.bordeDerecho < -0.25 ? 'OK ' : 'MAL',
  'la que llevás no te tapa el centro de la vista',
  `${piso.tapa}% de pantalla · ${piso.tapaCentro}% del centro · borde en x=${piso.bordeDerecho}`]);

for (const [e, n, x] of T) console.log(e.padEnd(4), n.padEnd(46), x);
const malT = T.filter(x => x[0] === 'MAL').length;
console.log(`\n${T.length - malT} bien, ${malT} mal`);
await nav.close();
process.exit(malT ? 1 : 0);
