// ¿El galope oscurece la imagen? Se leen los píxeles del CENTRO de la pantalla
// —lejos de la viñeta— con la pasada de velocidad apagada y encendida. Es el
// mismo cuadro, la misma luz: lo único que cambia es pasar o no por el
// render target.
import { chromium } from 'playwright';
const nav = await chromium.launch({ executablePath: process.env.CHROMIUM,
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
const pag = await nav.newPage({ viewport: { width: 700, height: 480 } });
const errs = []; pag.on('pageerror', e => errs.push(e.message));
await pag.goto('http://localhost:8099/index.html', { waitUntil: 'load' });
await pag.waitForTimeout(1200); await pag.click('#empezar'); await pag.waitForTimeout(1800);

const r = await pag.evaluate(() => {
  const j = window.juego;
  j.soldados.forEach(s => s.quitar()); j.soldados.length = 0;
  j.jugador.pos.set(0, 1.68, 0); j.jugador.yaw = 0; j.jugador.pitch = -0.05;
  j.camara.position.copy(j.jugador.pos);

  const gl = j.render.getContext();
  const pv = j.pasadaVel;
  const leer = (f, forzar) => {
    if (forzar === 'lienzo') {
      // el patrón: el mundo dibujado DERECHO a la pantalla, sin pasada
      j.render.setRenderTarget(null);
      j.render.render(pv.escena, pv.camara);
    } else if (forzar === undefined) pv.dibujar(f, null);
    else {
      // misma ruta (por el target y el quad) pero con la fuerza que yo diga
      pv.material.uniforms.uFuerza.value = forzar;
      pv.material.uniforms.uCentro.value.set(0.5, 0.5);
      pv.render.setRenderTarget(pv.destino);
      pv.render.clear();
      pv.render.render(pv.escena, pv.camara);
      pv.render.setRenderTarget(null);
      const a = pv.render.autoClear; pv.render.autoClear = true;
      pv.render.render(pv.escenaQuad, pv.camaraQuad);
      pv.render.autoClear = a;
    }
    const t = j.render.getSize(new (Object.getPrototypeOf(j.camara.position).constructor)());
    const w = 120, h = 100;
    const x = Math.floor(gl.drawingBufferWidth / 2 - w / 2);
    const y = Math.floor(gl.drawingBufferHeight / 2 - h / 2);
    const px = new Uint8Array(w * h * 4);
    gl.readPixels(x, y, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
    let s = 0;
    for (let i = 0; i < px.length; i += 4) s += (px[i] + px[i + 1] + px[i + 2]) / 3;
    return s / (px.length / 4);
  };
  return { apagado: leer(0, 'lienzo'), porTarget: leer(0, 0), galope: leer(0, 0.030) };
});
const filas = [
  ['por el target, quieto', r.porTarget],
  ['por el target, a galope', r.galope]
];
console.log('directo al lienzo'.padEnd(26), r.apagado.toFixed(1));
let mal = 0;
for (const [n2, v] of filas) {
  const d = (v - r.apagado) / r.apagado * 100;
  const bien = Math.abs(d) < 1.5;      // un 1,5 % es ruido de medición; 26 % era el bug
  if (!bien) mal++;
  console.log((bien ? 'OK  ' : 'MAL ') + n2.padEnd(26), v.toFixed(1), ' desvío ' + d.toFixed(1) + ' %');
}
console.log(`\n${filas.length - mal} bien, ${mal} mal`);
console.log(errs.length ? 'ERRORES: ' + errs.join(' / ') : 'sin errores');
await nav.close();
