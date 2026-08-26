import { chromium } from 'playwright';
const nav = await chromium.launch({ executablePath: process.env.CHROMIUM,
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
const pag = await nav.newPage({ viewport: { width: 900, height: 620 } });
const errs = [];
pag.on('pageerror', e => errs.push(e.message));
await pag.goto('http://localhost:8099/index.html', { waitUntil: 'load' });
await pag.waitForTimeout(1200); await pag.click('#empezar'); await pag.waitForTimeout(1400);

const r = await pag.evaluate(() => {
  const j = window.juego, out = {};
  const paso = (c, seg, mando = {}) => { for (let i = 0; i < seg * 60; i++) c.actualizar(1 / 60, { girar: 0, ...mando }); };

  // cuánto tarda en llegar a cada andar desde parado
  const c = j.caballo;
  c.montado = true;   // acá se mide física de andar, no el caballo suelto
  // se le sacan los obstáculos: acá se miden los números del andar, no el choque
  c.colisiones = [];
  const libre = () => { c.pos.set(0, 0, 0); c.rumbo = 0; };
  const tiempos = {};
  for (let a = 1; a <= 3; a++) {
    libre(); c.vel = 0; c.andar = a;
    let t = 0;
    const meta = [0, 1.9, 4.6, 10.2][a];
    while (c.vel < meta * 0.95 && t < 12) { c.actualizar(1 / 60, { girar: 0 }); t += 1 / 60; }
    tiempos[c.nombreAndar] = +t.toFixed(2);
  }
  out.arrancar = tiempos;

  // radio de giro: cuánto espacio necesita para dar media vuelta a cada andar
  const radios = {};
  for (let a = 1; a <= 3; a++) {
    libre(); c.andar = a; c.vel = [0, 1.9, 4.6, 10.2][a];
    const r0 = c.rumbo;
    let ancho = 0;
    for (let i = 0; i < 60 * 12 && Math.abs(c.rumbo - r0) < Math.PI; i++) {
      c.actualizar(1 / 60, { girar: 1 });
      ancho = Math.max(ancho, Math.abs(c.pos.x));
    }
    radios[c.nombreAndar] = +(ancho / 2).toFixed(2);
  }
  out.radioDeGiro = radios;

  // el filo por velocidad
  const filo = {};
  for (const v of [0, 1.9, 4.6, 10.2]) { c.vel = v; filo[v] = +c.filoPorVelocidad.toFixed(2); }
  out.filoPorVelocidad = filo;

  // frenar desde el galope
  libre(); c.vel = 10.2; c.andar = 0;
  let tf = 0, d0 = 0;
  const z0 = c.pos.z;
  while (c.vel > 0.2 && tf < 10) { c.actualizar(1 / 60, { girar: 0 }); tf += 1 / 60; d0 = Math.abs(c.pos.z - z0); }
  out.frenarDesdeGalope = { segundos: +tf.toFixed(2), metros: +d0.toFixed(1) };

  // te matan el caballo → al suelo
  c.vida = 6; c.vivo = true; c.caida = 0; c.andar = 0; c.vel = 0;
  c.pos.copy(j.jugador.pos); c.pos.y = 0;
  j.jugador.montar(c);
  const montadoAntes = !!j.jugador.monta;
  c.recibir(6);
  j.jugador.actualizar(1 / 60, new Set(), false, false);
  out.caballoMuerto = { montadoAntes: +montadoAntes, siguenVivos: +c.vivo };
  return out;
});
for (const [k, v] of Object.entries(r)) console.log(k.padEnd(18), JSON.stringify(v));
console.log(errs.length ? 'ERRORES: ' + errs.join(' / ') : '\nsin errores');
await nav.close();
