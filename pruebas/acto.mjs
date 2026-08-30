import { chromium } from 'playwright';
const nav = await chromium.launch({ executablePath: process.env.CHROMIUM,
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
const pag = await nav.newPage({ viewport: { width: 900, height: 620 } });
const errs = [];
pag.on('pageerror', e => errs.push(e.message));
await pag.goto('http://localhost:8099/index.html', { waitUntil: 'load' });
await pag.waitForFunction(() => !!window.juego, null, { timeout: 90000 }); await pag.click('#modo-campo'); await pag.waitForTimeout(1600);

const r = await pag.evaluate(() => {
  const j = window.juego, out = [];
  const ok = (n, cond, extra) => out.push([cond ? 'OK ' : 'MAL', n, extra === undefined ? '' : extra]);
  const teclas = new Set();
  const acto = j.acto;

  // campo limpio y el jugador montado en medio del campo
  j.soldados.forEach(s => s.quitar()); j.soldados.length = 0;
  j.canones.forEach(c => { c.vivo = false; });
  const c = j.caballos.find(x => x.vivo) || j.caballo;
  c.pos.set(0, 0, -30); c.rumbo = 0; c.vida = 6; c.vivo = true; c.caida = 0;
  c.colisiones = [];
  j.jugador.vida = 100; j.jugador.vivo = true;
  j.jugador.montar(c);

  ok('arranca montado', !!j.jugador.monta);
  ok('el acto no arrancó todavía', !acto.activo);

  // le matan el caballo: acá empieza todo
  c.recibir(9);
  // un cuadro del bucle real es lo que dispara el acto
  const paso = (seg) => {
    for (let i = 0; i < seg * 60; i++) {
      if (j.jugador.monta && !j.jugador.monta.vivo) {
        if (acto.puedeArrancar(j.jugador.monta)) acto.arrancar(j.jugador.monta);
      }
      acto.actualizar((1 / 60) * acto.lento, teclas);
      for (const s of j.soldados) s.actualizar(1 / 60, j.jugador, j.soldados);
      for (const cb of j.caballos) { if (cb.actualizado) { cb.actualizado = false; continue; } cb.actualizar(1 / 60, { girar: 0 }); }
      j.jugador.actualizar(1 / 60, teclas, false, false);
    }
  };

  paso(0.2);
  ok('el acto arranca al caer el caballo', acto.activo);
  ok('quedás atrapado', j.jugador.atrapado > 0);
  ok('la cámara baja al pasto', j.jugador.pos.y < 0.8, `y=${j.jugador.pos.y.toFixed(2)}`);
  const caiste = { x: j.jugador.pos.x, z: j.jugador.pos.z };

  // EL FORCEJEO DE SAN MARTÍN NO ALCANZA, y eso no cambió: no te sacás medio
  // caballo de encima tirando de la pierna. Lo que cambió es lo que viene
  // después.
  teclas.add('Space');
  paso(1.6);
  ok('el forcejeo se topa y no libera', acto.forcejeo <= 0.83 && j.jugador.atrapado > 0,
    `barra ${acto.forcejeo.toFixed(2)}`);
  teclas.delete('Space');

  // ---- el cambio de cuerpo ----
  paso(2.4);
  ok('pasás a ser Cabral', acto.fase === 'cabral', `fase ${acto.fase}`);
  ok('y te soltó', j.jugador.atrapado === 0);
  const sm = j.soldados.find(s => s.esSanMartin);
  ok('San Martín queda tirado en el campo', !!sm && sm.tirado > 0);
  // EL BICORNIO, y comprobado de verdad. La primera versión de esta línea
  // miraba que la figura tuviera hijos, que es cierto para cualquier soldado:
  // pasaba con el sombrero puesto y sin él. Se cuentan los vértices contra un
  // granadero normal —el bicornio y el morrión no arman la misma cabeza— así
  // que si alguien borra la rama del sombrero, esto se cae.
  const vertices = (x) => {
    let n = 0;
    x.malla.traverse(o => { if (o.geometry) n += o.geometry.attributes.position.count; });
    return n;
  };
  const comun = j.soltarSoldado('granadero');
  ok('y con el bicornio, que es lo que lo hace encontrable',
    !!sm && vertices(sm) !== vertices(comun),
    `${sm ? vertices(sm) : 0} vértices contra ${vertices(comun)} de un granadero`);
  comun.quitar(); j.soldados.splice(j.soldados.indexOf(comun), 1);
  const lejos = sm ? Math.hypot(sm.pos.x - j.jugador.pos.x, sm.pos.z - j.jugador.pos.z) : 0;
  ok('arrancás lejos de él, hay que ir', lejos > 8, `a ${lejos.toFixed(1)} m`);
  ok('donde caíste es donde quedó él',
    !!sm && Math.hypot(sm.pos.x - caiste.x, sm.pos.z - caiste.z) < 0.5);

  paso(2);
  ok('el español que lo iba a rematar aparece', j.soldados.some(s => s.esRealista));

  // ---- machacar el espacio ----
  // de lejos no se empuja nada, por mucho que la aprietes
  const machacar = (seg) => {
    for (let i = 0; i < seg * 60; i++) {
      if (i % 6 === 0) teclas.add('Space'); else teclas.delete('Space');
      paso(1 / 60);
    }
    teclas.delete('Space');
  };
  machacar(2);
  ok('de lejos no se levanta nada', acto.levante === 0, `barra ${acto.levante.toFixed(2)}`);

  // te acercás
  if (sm) j.jugador.pos.set(sm.pos.x + 1.2, j.jugador.pos.y, sm.pos.z);
  paso(0.2);
  ok('al lado sí se puede empujar', acto.puedeEmpujar);

  // una sola pulsación no alcanza: hay que machacar
  teclas.add('Space'); paso(1 / 60); teclas.delete('Space'); paso(0.5);
  ok('un solo espacio no lo levanta', acto.levante < 0.5 && acto.fase === 'cabral',
    `barra ${acto.levante.toFixed(2)}`);

  machacar(6);
  ok('machacando sí sale', acto.fase === 'cine', `fase ${acto.fase} · barra ${acto.levante.toFixed(2)}`);
  ok('el caballo quedó levantado', c.raiz.position.y > 0.1, `y=${c.raiz.position.y.toFixed(2)}`);
  ok('y el que lo iba a rematar cayó', acto.verdugo && !acto.verdugo.vivo);

  // ---- la cinemática ----
  ok('va en cámara lenta', acto.lento < 1, `x${acto.lento}`);
  paso(2);
  ok('el segundo español le entra con la bayoneta', !!acto.segundo);
  ok('la cámara se cae y mira al cielo',
    j.jugador.atrapado > 0 && j.jugador.pitchAtrapado > 0.4,
    `pitch ${j.jugador.pitchAtrapado.toFixed(2)}`);

  paso(12);
  ok('el acto termina', !acto.activo);
  ok('y el tiempo vuelve a correr normal', acto.lento === 1);
  ok('volvés a ser San Martín, en su lugar',
    Math.hypot(j.jugador.pos.x - caiste.x, j.jugador.pos.z - caiste.z) < 1.5,
    `a ${Math.hypot(j.jugador.pos.x - caiste.x, j.jugador.pos.z - caiste.z).toFixed(1)} m`);
  ok('y el San Martín del suelo ya no está', !j.soldados.some(s => s.esSanMartin));
  ok('no se repite', !acto.puedeArrancar(c));

  // ---- EL RELOJ DEL 3 DE FEBRERO ----
  //
  // Al minuto del clarín pasa, te maten el caballo o no. Antes el acto dependía
  // de cómo te estuviera yendo: jugando bien no lo veías nunca.
  acto.hecho = false; acto.corriendo = false; acto.tClarin = 0;
  acto.enBatalla = true;
  const c2 = j.caballos.find(x => x.vivo && !x.montado) || j.caballo;
  c2.vivo = true; c2.vida = 18; c2.caida = 0; c2.pos.set(0, 0, -30);
  j.jugador.liberar(); j.jugador.vida = 100; j.jugador.montar(c2);

  acto.contar(30, false, c2);
  ok('sin clarín el reloj no corre', acto.tClarin === 0);
  acto.contar(30, true, c2);
  ok('con el clarín corre', acto.tClarin === 30);
  ok('y a los 30 s todavía no pasa nada', !acto.activo);

  // a pie no puede pasar: sin caballo encima no hay pierna aprisionada
  const guarda = j.jugador.monta;
  j.jugador.monta = null;
  acto.contar(40, true, null);
  ok('a pie espera, no salta solo', !acto.activo && acto.tClarin > 60);
  j.jugador.monta = guarda;

  acto.contar(0, true, c2);
  ok('y salta apenas volvés a montar', acto.activo);
  ok('con el caballo muerto encima, como fue', !c2.vivo);

  // y en el campo de práctica no corre
  acto.hecho = false; acto.corriendo = false; acto.tClarin = 0;
  acto.enBatalla = false;
  acto.contar(90, true, c2);
  ok('en el campo de práctica no pasa', acto.tClarin === 0 && !acto.activo);

  return out;
});
for (const [e, n, x] of r) console.log(e.padEnd(4), n.padEnd(42), x);
const mal = r.filter(x => x[0] === 'MAL').length;
console.log(`\n${r.filter(x => x[0] === 'OK ').length} bien, ${mal} mal`);
console.log(errs.length ? 'ERRORES: ' + errs.join(' / ') : 'sin errores de consola');
await nav.close();
