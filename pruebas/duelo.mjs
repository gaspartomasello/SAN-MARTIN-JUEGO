import { chromium } from 'playwright';
const nav = await chromium.launch({ executablePath: process.env.CHROMIUM,
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
const pag = await nav.newPage({ viewport: { width: 900, height: 700 } });
const errs = [];
pag.on('pageerror', e => errs.push(e.message));
await pag.goto('http://localhost:8099/index.html', { waitUntil: 'load' });
await pag.waitForTimeout(1200); await pag.click('#modo-campo'); await pag.waitForTimeout(1400);

const r = await pag.evaluate(() => {
  const j = window.juego;
  const out = {};
  // sable en mano
  dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit2' }));

  const poner = () => {
    j.soldados.forEach(s => s.quitar()); j.soldados.length = 0;
    j.soltarSoldado('realista');
    const s = j.soldados[0];
    const v = j.jugador.pos.clone();
    j.camara.getWorldDirection(v);
    s.pos.copy(j.jugador.pos).addScaledVector(v, 1.5); s.pos.y = 0;
    s.estado = 'acero'; s.tAcero = 0; s.aturdido = 0; s.vida = 2;
    return s;
  };
  const sano = () => { j.jugador.vida = 100; j.jugador.aliento = 100; j.sable.tRemate = 0;
    j.sable.bajarGuardia(); j.sable.tParada = -1; j.sable.t = -1; };

  // A · guardia alzada en el momento → parada perfecta
  let s = poner(); sano();
  j.sable.alzarGuardia();
  s.alGolpear(s, { jugador: true });
  out.perfecta = { vida: j.jugador.vida, aturdido: +(s.aturdido > 0), remate: +(j.sable.tRemate > 0) };

  // B · guardia vieja → bloqueo: no te clava, pero te cuesta aliento
  s = poner(); sano();
  j.sable.alzarGuardia(); j.sable.tGuardia = 0.9;
  s.alGolpear(s, { jugador: true });
  out.bloqueo = { vida: j.jugador.vida, aliento: Math.round(j.jugador.aliento), aturdido: +(s.aturdido > 0) };

  // C · sin guardia → bayonetazo entero
  s = poner(); sano();
  s.alGolpear(s, { jugador: true });
  out.abierto = { vida: j.jugador.vida };

  // D · sablazo contra un realista en guardia → choca el acero
  s = poner(); sano();
  s.tAcero = 0.1;
  out.enGuardia = { cubierto: +s.cubierto };
  j.sable.alGolpear();
  out.contraGuardia = { vidaEnemigo: s.vida };

  // E · sablazo cuando ya está comprometido en el aviso → entra
  s = poner(); sano();
  s.tAcero = 0.9; s.avisando = true;
  out.avisando = { cubierto: +s.cubierto };
  j.sable.alGolpear();
  out.contraAviso = { vidaEnemigo: s.vida, muerto: +!s.vivo };

  // F · remate: pasa por encima de la guardia
  s = poner(); sano();
  s.tAcero = 0.1;
  j.sable.tRemate = 0.5;
  j.sable.tajo();
  const fueRemate = j.sable.remate;
  j.sable.alGolpear();
  out.remate = { fueRemate: +fueRemate, vidaEnemigo: s.vida, muerto: +!s.vivo };

  // G · pechada: no hiere, pero lo abre y lo empuja
  s = poner(); sano();
  s.tAcero = 0.1;
  const antes = s.pos.distanceTo(j.jugador.pos);
  dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyF' }));
  out.pechada = { vidaEnemigo: s.vida, aturdido: +(s.aturdido > 0),
    empujo: +(s.pos.distanceTo(j.jugador.pos) > antes + 0.3),
    aliento: Math.round(j.jugador.aliento) };

  // H · la guardia se cae sola sin aliento
  sano(); j.jugador.aliento = 3;
  j.sable.alzarGuardia();
  out.antesDeCansarse = +j.sable.guardia;
  return out;
});
for (const [k, v] of Object.entries(r)) console.log(k.padEnd(16), JSON.stringify(v));
console.log(errs.length ? 'ERRORES: ' + errs.join(' / ') : '\nsin errores de consola');
await nav.close();
