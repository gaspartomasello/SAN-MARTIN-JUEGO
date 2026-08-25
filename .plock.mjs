import { chromium } from 'playwright';
const SP = process.env.SP;
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
for (const [nombre, url] of [['file://', 'file://' + SP + '/clarin-san-lorenzo.html'],
                             ['http://', 'http://localhost:8099/index.html']]) {
  const pag = await nav.newPage({ viewport: { width: 900, height: 600 } });
  await pag.goto(url, { waitUntil: 'load' });
  await pag.waitForTimeout(1500);
  await pag.click('#empezar');
  await pag.waitForTimeout(1200);
  const r = await pag.evaluate(() => ({
    bloqueado: document.pointerLockElement !== null,
    yawAntes: window.juego.jugador.yaw
  }));
  await pag.mouse.move(450, 300);
  await pag.mouse.move(560, 300);
  await pag.waitForTimeout(400);
  const yawDespues = await pag.evaluate(() => window.juego.jugador.yaw);
  console.log(nombre, 'pointer lock:', r.bloqueado, '| giró la vista:', Math.abs(yawDespues - r.yawAntes) > 0.001);
  await pag.close();
}
await nav.close();
