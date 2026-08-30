import { chromium } from 'playwright';
const nav = await chromium.launch({ executablePath: process.env.CHROMIUM,
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
const pag = await nav.newPage({ viewport: { width: 900, height: 620 } });
const errs = [];
pag.on('pageerror', e => errs.push(e.message));
await pag.goto('http://localhost:8099/index.html', { waitUntil: 'load' });
await pag.waitForFunction(() => !!window.juego, null, { timeout: 90000 }); await pag.click('#modo-campo'); await pag.waitForTimeout(1400);

const r = await pag.evaluate(() => {
  const j = window.juego, out = [];
  const ok = (n, cond, extra) => out.push([cond ? 'OK ' : 'MAL', n, extra === undefined ? '' : extra]);
  const paso = (c, seg, mando = {}) => { for (let i = 0; i < seg * 60; i++) c.actualizar(1 / 60, { girar: 0, ...mando }); };
  const c = j.caballo;
  c.montado = true;   // acá se mide física de andar, no el caballo suelto

  // ---------- 1. el salto ----------
  c.colisiones = [];
  c.pos.set(0, 0, 0); c.rumbo = 0; c.vel = 0; c.andar = 0; c.alto = 0; c.enElAire = false; c.tSalto = 0;
  ok('parado no salta', c.saltar() === false);

  c.vel = 10.2; c.andar = 3; c.tSalto = 0;
  ok('al galope sí salta', c.saltar() === true);
  let apice = 0, aire = 0, z0 = c.pos.z;
  while (c.enElAire && aire < 4) { c.actualizar(1 / 60, { girar: 0 }); apice = Math.max(apice, c.alto); aire += 1 / 60; }
  out.push(['—', 'salto a galope', `apice ${apice.toFixed(2)} m · aire ${aire.toFixed(2)} s · largo ${Math.abs(c.pos.z - z0).toFixed(1)} m`]);
  ok('aterriza', !c.enElAire && c.alto === 0);

  c.pos.set(0, 0, 0); c.vel = 4.6; c.andar = 2; c.tSalto = 0; c.enElAire = false; c.alto = 0;
  c.saltar();
  let ap2 = 0, t2 = 0; z0 = c.pos.z;
  while (c.enElAire && t2 < 4) { c.actualizar(1 / 60, { girar: 0 }); ap2 = Math.max(ap2, c.alto); t2 += 1 / 60; }
  out.push(['—', 'salto al trote', `apice ${ap2.toFixed(2)} m · largo ${Math.abs(c.pos.z - z0).toFixed(1)} m`]);
  ok('el galope salta más alto que el trote', apice > ap2 + 0.15);

  // ---------- 2. la tapia: chocarla, rozarla, saltarla ----------
  const tapia = { min: { x: -6, y: 0, z: -12 }, max: { x: 6, y: 1.1, z: -11 } };
  const correr = (rumbo, saltarA) => {
    c.colisiones = [tapia];
    c.pos.set(0, 0, 0); c.rumbo = rumbo; c.vel = 10.2; c.andar = 3;
    c.alto = 0; c.enElAire = false; c.tSalto = 0; c.golpeo = false; c.montado = true;
    for (let i = 0; i < 60 * 3; i++) {
      const d = Math.abs(c.pos.z - tapia.max.z);
      c.actualizar(1 / 60, { girar: 0, saltar: saltarA && d < saltarA && !c.enElAire });
    }
    return { z: +c.pos.z.toFixed(1), vel: +c.vel.toFixed(1), andar: c.nombreAndar, golpeo: !!c.golpeo };
  };
  const frente = correr(0, 0);
  out.push(['—', 'de frente sin saltar', JSON.stringify(frente)]);
  // La tapia PARA, no FRENA. Son dos cosas distintas: no la puede atravesar,
  // pero tampoco lo puede dejar clavado en medio del campo.
  ok('la tapia no se atraviesa', frente.z > -11.9, `quedó en z=${frente.z}`);
  ok('pero no lo deja clavado', frente.vel > 1.5, `quedó a ${frente.vel} m/s`);
  ok('el golpe de frente se siente', frente.golpeo);
  ok('y no le baja el andar', frente.andar === 'a galope', frente.andar);

  const refilon = correr(0.95, 0);
  out.push(['—', 'de refilón', JSON.stringify(refilon)]);
  ok('de refilón NO se planta', refilon.vel > 5.5, `quedó a ${refilon.vel} m/s`);
  ok('de refilón no baja el andar', refilon.andar === 'a galope');

  const saltada = correr(0, 5);
  out.push(['—', 'saltando la tapia', JSON.stringify(saltada)]);
  ok('la tapia se salta', saltada.z < -12, `llegó a z=${saltada.z}`);

  // ---------- 3. el lancero ----------
  c.colisiones = j.escena ? c.colisiones : c.colisiones;
  const antes = j.soldados.length;
  const l = j.soltarSoldado('granadero', { montado: true });
  // posiciones fijas: el spawn de lanceros es aleatorio y la prueba no puede
  // depender de dónde cayó
  l.monta.pos.set(0, 0, 0); l.monta.rumbo = 0; l.monta.vel = 0; l.monta.andar = 0;
  l.monta.colisiones = [];   // acá se mide la carga, no el choque contra el decorado
  l._sentar();
  ok('el lancero nace montado', l.montado === true);
  ok('lleva lanza', l.lancero === true);
  ok('el caballo entró a la lista', j.caballos.includes(l.monta));
  const asiento = l.malla.position.y;
  ok('va sentado en la silla', asiento > 0.35 && asiento < 0.65, `y=${asiento.toFixed(2)}`);

  // que cargue contra un realista y le pegue. Se deja UN solo realista vivo
  // para que la carga no elija otro blanco a mitad de camino.
  for (const s of j.soldados) if (s.esRealista) s.vivo = false;
  const enemigo = j.soltarSoldado('realista');
  enemigo.malla.position.set(0, 0, -45);
  // se le quita el fusil: a 45 m un realista bien puede matar al lancero antes
  // de que llegue —está bien que pueda— pero acá se mide la carga, no el tiro
  enemigo.alDisparar = null;
  enemigo.recarga = 999;
  let pegó = false, distMin = 999, andares = new Set();
  const golpeOriginal = l.alGolpear;
  l.alGolpear = (q, o) => { pegó = true; if (golpeOriginal) golpeOriginal(q, o); };
  for (let i = 0; i < 60 * 16; i++) {
    l.actualizar(1 / 60, j.jugador, j.soldados);
    if (enemigo.vivo) enemigo.actualizar(1 / 60, j.jugador, j.soldados);
    if (l.monta) andares.add(l.monta.nombreAndar);
    distMin = Math.min(distMin, l.pos.distanceTo(enemigo.pos));
  }
  ok('el lancero llega y ensarta', pegó, `distancia mínima ${distMin.toFixed(1)} m`);
  out.push(['—', 'andares usados en la carga', [...andares].join(', ')]);

  // ---------- 3 bis. los españoles no tienen caballos ----------
  const caballosAntes = j.caballos.length;
  const esp = j.soltarSoldado('realista', { montado: true });
  ok('un realista no nace montado', esp.montado === false && !esp.monta);
  ok('no se le fabrica caballo', j.caballos.length === caballosAntes);
  ok('no lleva lanza', esp.lancero === false);
  const suelto = j.caballos.find(c => c.vivo && !c.montado);
  ok('un realista no puede montar ni un caballo suelto', suelto ? esp.montar(suelto) === false : true);

  // ---------- 3 ter. el jinete NO se despega del caballo ----------
  //
  // El bug: sin enemigos vivos el jinete dejaba de sentarse y el caballo se
  // iba galopando solo. Se reproduce dejando el campo sin un solo realista.
  for (const s of j.soldados) if (s.esRealista) s.vivo = false;
  const solo = j.soltarSoldado('granadero', { montado: true });
  solo.monta.andar = 3; solo.monta.vel = 10.2;
  let despegue = 0;
  for (let i = 0; i < 60 * 6; i++) {
    solo.actualizar(1 / 60, j.jugador, j.soldados);
    if (!solo.monta) break;
    const dx = solo.malla.position.x - solo.monta.pos.x;
    const dz = solo.malla.position.z - solo.monta.pos.z;
    despegue = Math.max(despegue, Math.hypot(dx, dz));
  }
  ok('sin enemigos el jinete sigue en la silla', despegue < 0.05, `se despegó ${despegue.toFixed(2)} m`);
  ok('y el caballo aflojó en vez de dispararse', solo.monta && solo.monta.andar <= 1, solo.monta && solo.monta.nombreAndar);

  // ---------- 3 quater. la polvareda ----------
  // se apaga todo lo demás para que el polvo medido sea el de este caballo
  for (const s of j.soldados) if (s !== solo) s.vivo = false;
  for (const n of j.humo.nubes) n.viva = false;
  j.humo.actualizar(1 / 60);
  const nubes0 = j.humo.vivas;
  solo.monta.andar = 3; solo.monta.vel = 10.2;
  for (let i = 0; i < 60 * 2; i++) { solo.monta.actualizar(1 / 60, {}); j.humo.actualizar(1 / 60); }
  const conGalope = j.humo.vivas;
  ok('al galope los cascos levantan tierra', conGalope > nubes0 + 3, `${nubes0} → ${conGalope} nubes`);
  solo.monta.vel = 1.2; solo.monta.andar = 1;
  for (let i = 0; i < 60 * 6; i++) { solo.monta.actualizar(1 / 60, {}); j.humo.actualizar(1 / 60); }
  ok('al paso no hace polvo', j.humo.vivas < conGalope, `quedaron ${j.humo.vivas}`);

  // ---------- 4. el desmonte ----------
  //
  // La regla cambió: ya no desmonta el DAÑO, desmonta el ARMA. Cada golpe trae
  // su probabilidad y sin ella no te baja nadie, por fuerte que pegue.
  const l2 = j.soltarSoldado('granadero', { montado: true });
  l2.vida = 9999;
  l2.recibir(1, null, 0);
  ok('un raspón no desmonta', l2.montado === true);
  l2.recibir(99, null, 0);
  ok('ni un golpe fuerte sin arma que voltee', l2.montado === true, `vida ${l2.vida}`);
  // Y ES UNA TIRADA, no una certeza: volteo 1 contra OFICIO_TROPA 0,75 sale una
  // de cada cuatro. Con un solo golpe esta comprobación fallaba tres veces de
  // cada cuatro —de ahí venía que esta prueba oscilara entre 47 y 44— y lo que
  // se quiere saber no es si salió esta vez, es que PUEDE salir y que cuando
  // sale no mata.
  let golpes = 0;
  while (l2.montado && golpes < 60) { l2.recibir(2, null, 1); golpes++; }
  ok('el arma que voltea, voltea; y no mata', l2.montado === false && l2.vivo,
    `hicieron falta ${golpes} golpes`);
  ok('queda tirado un rato', l2.tirado > 0);
  ok('las piernas se cierran al caer', l2.fig.montura === false);

  // ---------- 5. el cadáver del caballo ----------
  const l3 = j.soltarSoldado('granadero', { montado: true });
  const cab = l3.monta;
  // OJO: no un número fijo. Decía recibir(6) de cuando un caballo tenía menos de
  // seis de vida; con VIDA_CABALLO en 18 el animal quedaba vivo y las ocho
  // comprobaciones de abajo fallaban sin que hubiera nada roto en el juego.
  cab.recibir(cab.vida);
  ok('el caballo muere', !cab.vivo);
  // ESTA ES LA PRUEBA QUE MENTÍA. Decía «el jinete se baja solo» y comprobaba
  // `!l3.montado`, que es un getter que lee `monta.vivo`: en cuanto el caballo
  // muere da false SIN QUE NADIE SE HAYA BAJADO DE NADA. Pasaba siempre, y
  // mientras tanto el hombre quedaba con el caballo puesto, a horcajadas y
  // flotando a 46 cm del suelo. Ahora se comprueba el HECHO, no el getter.
  ok('el jinete se baja solo, de verdad', l3.monta === null, `monta=${l3.monta ? 'puesta' : 'null'}`);
  ok('y el caballo lo suelta a él', cab.jinete === null && cab.montado === false);
  ok('cae al piso, no queda flotando', Math.abs(l3.pos.y) < 0.06, `y=${l3.pos.y.toFixed(3)}`);
  ok('y cierra las piernas', l3.fig.montura === false);
  paso(cab, 1.2);
  ok('se desploma de costado', Math.abs(cab.raiz.rotation.z) > 1.2, `z=${cab.raiz.rotation.z.toFixed(2)}`);
  l3.actualizar(1 / 60, j.jugador, j.soldados);
  ok('y un cuadro después sigue en el piso', Math.abs(l3.pos.y) < 0.06, `y=${l3.pos.y.toFixed(3)}`);
  const tAntes = cab.tMuerto;
  paso(cab, 3);
  ok('el cadáver cuenta su tiempo', cab.tMuerto > tAntes + 2.5, `${cab.tMuerto.toFixed(1)} s`);

  // ---------- 6. voltear al jugador ----------
  const cj = j.caballo || j.caballos.find(x => x.vivo && !x.montado);
  cj.vida = 6; cj.vivo = true; cj.caida = 0; cj.pos.copy(j.jugador.pos); cj.pos.y = 0;
  j.jugador.vida = 100;
  j.jugador.montar(cj);
  const vidaAntes = j.jugador.vida;
  const volteado = j.voltear('prueba');
  ok('voltear te baja', volteado && !j.jugador.monta);
  ok('la caída cuesta vida', j.jugador.vida < vidaAntes, `${vidaAntes} → ${Math.round(j.jugador.vida)}`);

  // ---------- 7. lo que cambia desde la silla ----------
  //
  // Tres cosas, y las tres dicen lo mismo: montado no peleás mejor, peleás
  // distinto, y lo que te sirve es la velocidad.
  const limpiar = () => { j.soldados.forEach(x => x.quitar()); j.soldados.length = 0; };
  const alFrente = (d) => {
    const s = j.soltarSoldado('realista');
    const v = j.jugador.pos.clone();
    j.camara.getWorldDirection(v);
    s.pos.copy(j.jugador.pos).addScaledVector(v, d); s.pos.y = 0;
    s.estado = 'acero'; s.tAcero = 0; s.aturdido = 0; s.avisando = false; s.vida = 8;
    return s;
  };

  // el corvo, más rápido
  j.sable.guardado = false; j.sable.t = -1; j.sable.tRemate = 0;
  j.sable.tajo(false); const aPie = j.sable.duracion;
  j.sable.t = -1; j.sable.tRemate = 0;
  j.sable.tajo(true); const enSilla = j.sable.duracion;
  j.sable.t = -1;
  ok('el corvo va más rápido desde la silla', enSilla < aPie,
    `${aPie.toFixed(2)} s a pie · ${enSilla.toFixed(2)} s montado`);

  // la guardia contra un caballo lanzado
  const cbs = j.jugador.monta || j.caballos.find(x => x.vivo && !x.montado);
  if (!j.jugador.monta) { j.jugador.vida = 100; j.jugador.montar(cbs); }
  limpiar();
  cbs.vel = 9;
  const g1 = alFrente(2.4); const v1 = g1.vida;
  ok('en guardia y de a pie no te lo podrías llevar', g1.cubierto === true);
  j.sable.alGolpear();
  ok('pero la guardia no para un sablazo a la carrera', g1.vida < v1,
    `vida ${v1} → ${g1.vida}`);

  limpiar();
  cbs.vel = 0;
  const g2 = alFrente(2.4); const v2 = g2.vida;
  j.sable.alGolpear();
  ok('y montado pero frenado, la para igual que siempre', g2.vida === v2,
    `vida ${v2} → ${g2.vida}`);

  // el atropello
  limpiar();
  cbs.vel = 9; cbs.rumbo = 0;                 // rumbo 0 mira a −z
  const a1 = j.soltarSoldado('realista');
  a1.pos.set(cbs.pos.x, 0, cbs.pos.z - 1); a1.vida = 8; a1.aturdido = 0;
  const va1 = a1.vida, za1 = a1.pos.z;
  j.combate.arrollar(cbs, a1);
  ok('tu caballo lanzado arrolla', a1.vida < va1 && a1.aturdido > 0,
    `vida ${va1} → ${a1.vida}, aturdido ${a1.aturdido.toFixed(1)} s`);
  ok('y lo despide para adelante', a1.pos.z < za1 - 1, `z ${za1.toFixed(1)} → ${a1.pos.z.toFixed(1)}`);

  cbs.vel = 2;
  const a2 = j.soltarSoldado('realista');
  a2.pos.set(cbs.pos.x, 0, cbs.pos.z - 1); a2.vida = 8; a2.aturdido = 0;
  j.combate.arrollar(cbs, a2);
  ok('al paso no arrolla: aparta y sigue', a2.vida === 8 && a2.aturdido === 0);

  // EL ATROPELLO ES TUYO Y DE NADIE MÁS, y no es una concesión: ciento veinte
  // granaderos arrollando son un veneno que corre solo. Hasta la versión sin
  // daño —sólo el trastabillar— baja `desbande` de 3 quiebres a 2. Las cuatro
  // mediciones están contadas en balance.js. Si esto se cae, la batalla se
  // termina por exterminio y no por quiebre, que es lo que la moral evita.
  const gr = j.soltarSoldado('granadero', { montado: true });
  gr.monta.vel = 9; gr.monta.rumbo = 0;
  const a3 = j.soltarSoldado('realista');
  a3.pos.set(gr.monta.pos.x, 0, gr.monta.pos.z - 1); a3.vida = 8; a3.aturdido = 0;
  j.combate.arrollar(gr.monta, a3);
  ok('el granadero aparta y sigue: no arrolla', a3.vida === 8 && a3.aturdido === 0,
    `vida ${a3.vida}, aturdido ${a3.aturdido}`);

  // ---------- 8. pieles ----------
  return out;
});
for (const [e, n, x] of r) console.log(e.padEnd(4), n.padEnd(34), x);
const mal = r.filter(x => x[0] === 'MAL').length;
console.log(`\n${r.filter(x => x[0] === 'OK ').length} bien, ${mal} mal`);
console.log(errs.length ? 'ERRORES: ' + errs.join(' / ') : 'sin errores de consola');
await nav.close();
process.exit(mal ? 1 : 0);
