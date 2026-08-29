// LA PINZA. Lo que hay que probar no es que salgan corriendo: es que salgan
// FORMADOS, que no arranquen antes del clarín, que tu columna te siga A VOS y
// que la formación se rompa sola en el choque y no antes.
import { chromium } from 'playwright';
const nav = await chromium.launch({ executablePath: process.env.CHROMIUM,
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
const pag = await nav.newPage({ viewport: { width: 900, height: 620 } });
const errs = []; pag.on('pageerror', e => errs.push(e.message));
await pag.goto('http://localhost:8099/index.html', { waitUntil: 'load' });
await pag.waitForTimeout(1200); await pag.click('#modo-campo'); await pag.waitForTimeout(1800);

const r = await pag.evaluate(async () => {
  const j = window.juego, out = [];
  const ok = (n, cond, extra) => out.push([cond ? 'OK ' : 'MAL', n, extra === undefined ? '' : extra]);
  const p = j.pinza;

  // el mundo entero a mano: acá se mide la maniobra, no el reloj del navegador
  const correr = (segs, mando = {}) => {
    for (let i = 0; i < segs * 60; i++) {
      p.actualizar(1 / 60, j.jugador, j.soldados.filter(s => s.esRealista));
      for (const s of j.soldados) s.actualizar(1 / 60, j.jugador, j.soldados);
      for (const c of j.caballos) { if (c.actualizado) { c.actualizado = false; continue; } c.actualizar(1 / 60, { girar: 0, ...mando }); }
    }
  };

  // ---------- 1. se forma ----------
  // sin infantería enfrente: en las secciones 1 a 5 se mide LA MANIOBRA, no la
  // pelea. El enemigo aparece recién en la 6, que es la que prueba el choque.
  const armada = j.formarPinza(20, 0);
  for (const s of j.soldados) if (s.esRealista) { s.alDisparar = null; s.alGolpear = null; }
  ok('dos columnas', p.oeste.hombres.length === 20 && p.este.hombres.length === 20,
    `${p.oeste.hombres.length} y ${p.este.hombres.length}`);
  ok('la tuya la mandás vos', p.oeste.jefe === null);
  ok('la otra tiene su propio jefe', !!p.este.jefe && p.este.jefe.montado);
  ok('arrancás montado y a la cabeza', !!j.jugador.monta);
  ok('todos a caballo con lanza', p.oeste.hombres.every(h => h.montado && h.lancero));

  // ---------- 2. nadie se mueve antes del clarín ----------
  const antes = p.este.hombres.map(h => ({ x: h.monta.pos.x, z: h.monta.pos.z }));
  correr(4);
  let corrido = 0;
  p.este.hombres.forEach((h, i) => {
    if (!h.montado) return;
    corrido = Math.max(corrido, Math.hypot(h.monta.pos.x - antes[i].x, h.monta.pos.z - antes[i].z));
  });
  ok('sin clarín no se mueve nadie', corrido < 2.5, `el que más se movió: ${corrido.toFixed(2)} m`);
  ok('y siguen formados, no sueltos', p.este.estado === 'formada' && p.oeste.estado === 'formada');
  ok('están escondidos detrás del convento', p.este.hombres.every(h => !h.montado || h.monta.pos.z > 14));

  // ---------- 3. el clarín ----------
  let sono = 0;
  p.alTocar = () => sono++;
  ok('el clarín está por sonar', p.sonando === true);
  ok('suena', p.tocar() === true);
  ok('y una sola vez', p.tocar() === false && sono === 1);
  ok('las dos columnas arrancan juntas',
    p.oeste.estado === 'saliendo' && p.este.estado === 'saliendo');

  // ---------- 4. la columna del este rodea el convento sola ----------
  const jefeZ0 = p.este.jefe.monta.pos.z;
  correr(9);
  const jefe = p.este.jefe;
  ok('el jefe baja al campo', jefe && jefe.monta && jefe.monta.pos.z < jefeZ0 - 25,
    jefe && jefe.monta ? `de z=${jefeZ0.toFixed(0)} a z=${jefe.monta.pos.z.toFixed(0)}` : 'sin jefe');
  ok('y rodea por su costado, no por el medio', !jefe || !jefe.monta || jefe.monta.pos.x > 12,
    jefe && jefe.monta ? `x=${jefe.monta.pos.x.toFixed(0)}` : '');
  // La columna sigue siendo una columna. Veinte hombres de a cuatro ocupan
  // 17 m de fondo; en las curvas se estiran y después se vuelven a juntar, que
  // es lo que hace una columna de verdad. Lo que no puede pasar es que llegue
  // al choque convertida en una hilera de tipos sueltos.
  const largo = () => {
    let m = 0;
    for (const h of p.este.hombres) {
      if (!h.montado || h === jefe || !jefe || !jefe.monta) continue;
      m = Math.max(m, Math.hypot(h.monta.pos.x - jefe.monta.pos.x, h.monta.pos.z - jefe.monta.pos.z));
    }
    return m;
  };
  const trasLaCurva = largo();
  correr(2);
  const enLaRecta = largo();
  // veinte de a cuatro son 17 m de fondo; en las curvas se estiran un poco
  ok('la columna no se desarma en el camino', p.este.estado === 'saliendo' && trasLaCurva < 30,
    `el último va a ${trasLaCurva.toFixed(0)} m`);
  ok('y sigue junta en la recta', enLaRecta < 30, `${trasLaCurva.toFixed(0)} m → ${enLaRecta.toFixed(0)} m`);

  // y cada uno va EN SU SITIO, no simplemente cerca del jefe
  let fuera = 0;
  for (const h of p.este.hombres) {
    if (!h.montado || h === jefe || !h.plaza) continue;
    if (Math.hypot(h.monta.pos.x - h.plaza.x, h.monta.pos.z - h.plaza.z) > 6) fuera++;
  }
  ok('y cada uno en su sitio, no apelotonados', fuera <= 3, `${fuera} fuera de lugar`);

  // ---------- 5. tu columna te sigue A VOS ----------
  //
  // Se lleva al jugador para un lado cualquiera y se mira si los sesenta van
  // detrás. Esto es el mando: no siguen un punto del mapa, te siguen a vos.
  const c = j.jugador.monta;
  if (c) {
    c.pos.set(-20, 0, -10); c.rumbo = Math.PI / 2; c.andar = 2;
    const cola = () => {
      let m = 0, n = 0;
      for (const h of p.oeste.hombres) {
        if (!h.montado) continue;
        n++;
        m = Math.max(m, Math.hypot(h.monta.pos.x - c.pos.x, h.monta.pos.z - c.pos.z));
      }
      return { m, n };
    };
    correr(3, { hacia: Math.PI / 2 });
    const d1 = cola();
    correr(11, { hacia: Math.PI / 2 });
    const d2 = cola();
    ok('tu columna te viene siguiendo', d2.n > 0 && d2.m < d1.m,
      `${d1.m.toFixed(0)} m → ${d2.m.toFixed(0)} m con ${d2.n} montados`);
    ok('y te alcanza', d2.m < 45, `el último a ${d2.m.toFixed(0)} m`);
  }

  // ---------- 6. la formación se rompe SOLA en el choque ----------
  const antesDeSoltar = p.oeste.estado;
  // se le pone un realista encima a la cabeza de la columna del este
  const jf = p.este.jefe;
  if (jf && jf.monta) {
    const e = j.soltarSoldado('realista', {
      pos: new (Object.getPrototypeOf(jf.monta.pos).constructor)(jf.monta.pos.x, 0, jf.monta.pos.z - 12)
    });
    correr(0.2);
    ok('con el enemigo encima, la columna se suelta', p.este.estado === 'suelta', p.este.estado);
    ok('y a cada uno se le devuelve la iniciativa', p.este.hombres.every(h => h.plaza === null));
  }
  // ---------- 7. ¡A MÍ! la columna se rehace y vuelve a entrar ----------
  //
  // La orden de la Q. Lo que hay que probar no es que se junten: es que la
  // columna SUELTA se pueda volver a formar, que se forme atrás del jugador y
  // que se suelte sola cuando la volvés a llevar al choque. O sea que la carga
  // tenga ida y vuelta y no una sola dirección.
  // A los realistas de la sección anterior se los manda lejos en vez de sacarlos
  // de la lista: j.soldados es el array de main.js y soltarSoldado empuja ahí,
  // así que si acá se lo reemplaza por otro, el realista que se suelte después
  // no entra nunca en la simulación y la columna no se suelta jamás.
  for (const s of j.soldados) if (s.esRealista) s.pos.set(0, 0, 400);
  p.oeste.soltar();
  ok('la columna estaba suelta', p.oeste.estado === 'suelta');
  ok('y sin plaza: cada uno peleando por su cuenta',
    p.oeste.hombres.every(h => h.plaza === null));

  ok('la Q la vuelve a formar', p.reunir(false) === true);
  ok('y no dos veces seguidas', p.reunir(false) === false);
  // y en red la Q de Bermúdez llama a la SUYA, la del este, no a la de San Martín
  ok('la columna de cada uno es la suya',
    p.tuya(false) === p.oeste && p.tuya(true) === p.este);
  correr(1.5);
  const conPlaza = p.oeste.hombres.filter(h => h.vivo && h.montado && h.plaza).length;
  ok('todos vuelven a tener sitio', conPlaza > 0, `${conPlaza} formados`);

  // ¿se forman ATRÁS del jugador? El sitio de cada uno cuelga del eje de marcha
  // de la cabeza, así que tiene que quedar a la espalda de su caballo.
  const cb = j.jugador.monta;
  if (cb) {
    const fx = -Math.sin(cb.rumbo), fz = -Math.cos(cb.rumbo);
    const detras = p.oeste.hombres.filter(h => h.plaza &&
      ((h.plaza.x - cb.pos.x) * fx + (h.plaza.z - cb.pos.z) * fz) < 0).length;
    ok('y todos atrás tuyo, no adelante', detras === conPlaza, `${detras} de ${conPlaza}`);
  }

  // y se vuelve a soltar sola con el enemigo encima
  if (cb) {
    j.soltarSoldado('realista', {
      pos: new (Object.getPrototypeOf(cb.pos).constructor)(cb.pos.x, 0, cb.pos.z - 12)
    });
    correr(0.2);
    ok('y con el enemigo encima se suelta otra vez', p.oeste.estado === 'suelta', p.oeste.estado);
  }

  out.push(['—', 'formada con', JSON.stringify(armada)]);
  return out;
});
for (const [e, n, x] of r) console.log(e.padEnd(4), n.padEnd(48), x);
const mal = r.filter(x => x[0] === 'MAL').length;
console.log(`\n${r.filter(x => x[0] === 'OK ').length} bien, ${mal} mal`);
console.log(errs.length ? 'ERRORES: ' + errs.join(' / ') : 'sin errores de consola');
await nav.close();
