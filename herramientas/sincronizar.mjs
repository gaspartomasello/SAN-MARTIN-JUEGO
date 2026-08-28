// ===========================================================================
// SINCRONIZAR · traer lo de las otras máquinas y subir lo de ésta
// ===========================================================================
//
// Esto existe porque el proyecto se trabaja en varias computadoras a la vez —la
// de casa, la de la escuela, la del amigo— y la única fuente de verdad es el
// repo. Sin esto, sincronizar son seis comandos de git que hay que acordarse en
// el orden correcto, y el resultado previsible es que una máquina se quede una
// semana atrás y después haya que resolver un choque de veinte archivos.
//
// EL CHOQUE QUE ESTO EVITA DE VERDAD
//
// clarin-san-lorenzo.html —el juego armado en un solo archivo, el que se abre
// con doble clic— viaja en el repo a propósito: si no viajara, la máquina que
// no tiene esbuild instalado se quedaría con el código fuente y sin manera de
// jugar. Pero es un archivo GENERADO de un megabyte y pico, así que dos
// máquinas que tocaron cualquier cosa de src/ lo van a tener distinto SIEMPRE,
// y git no lo puede fusionar: no hay líneas que combinar, hay un bundle.
//
// La salida no es pelearse con el choque: es no leerlo. Ese archivo no tiene
// información propia —sale entero de src/ e index.html—, así que cuando choca
// se tira y se rearma desde el código ya fusionado. Es la única resolución
// correcta posible, y por eso se puede automatizar sin riesgo.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { hostname } from 'node:os';

const ARMADO = 'clarin-san-lorenzo.html';

function git (...args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}
// la que puede fallar sin que sea un problema: devuelve el código y la salida
function gitQuizas (...args) {
  const r = spawnSync('git', args, { encoding: 'utf8' });
  return { ok: r.status === 0, salida: (r.stdout || '') + (r.stderr || '') };
}
function paso (t) { console.log(`\n  ${t}`); }
function bien (t) { console.log(`  · ${t}`); }

// ---------------------------------------------------------------------------
try { git('rev-parse', '--is-inside-work-tree'); } catch {
  console.error('\n  Acá no hay repositorio de git. ¿Estás en la carpeta del proyecto?\n');
  process.exit(1);
}
const rama = git('rev-parse', '--abbrev-ref', 'HEAD');
console.log(`\n  EL CLARÍN DE SAN LORENZO · sincronizar`);
console.log(`  ──────────────────────────────────────────`);
console.log(`  Máquina: ${hostname()}   Rama: ${rama}`);

// ---------------------------------------------------------------------------
// 1. LO QUE TOCASTE EN ESTA MÁQUINA
// ---------------------------------------------------------------------------
//
// Se pregunta ANTES de traer nada. Si hay trabajo sin guardar y se hace el pull
// primero, git se planta con «tenés cambios locales» y el que corrió esto se
// queda con medio proceso hecho y un error que no pidió.
paso('1 · Mirando qué tocaste acá');
// el armado no cuenta como trabajo tuyo: se regenera al final igual
let sucio = git('status', '--porcelain')
  .split('\n').filter(l => l.trim() && !l.includes(ARMADO));

if (sucio.length) {
  for (const l of sucio.slice(0, 20)) bien(l.trim());
  if (sucio.length > 20) bien(`... y ${sucio.length - 20} más`);

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const fecha = new Date().toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
  const porDefecto = `Cambios desde ${hostname()} · ${fecha}`;
  const msj = (await rl.question(`\n  ¿Qué hiciste? (Enter para «${porDefecto}»)\n  > `)).trim();
  rl.close();

  git('add', '-A');
  git('commit', '-m', msj || porDefecto);
  bien('guardado');
} else {
  bien('nada nuevo, esta máquina está limpia');
}

// ---------------------------------------------------------------------------
// 2. LO QUE HICIERON LAS OTRAS
// ---------------------------------------------------------------------------
paso('2 · Trayendo lo de las otras máquinas');
let r = gitQuizas('pull', '--rebase', 'origin', rama);

if (!r.ok) {
  // ¿el choque es SÓLO el archivo armado? Entonces no es un choque de verdad.
  const chocados = git('diff', '--name-only', '--diff-filter=U')
    .split('\n').filter(Boolean);
  const soloElArmado = chocados.length > 0 && chocados.every(f => f === ARMADO);

  if (soloElArmado) {
    bien('chocó el juego armado, que es generado: se rearma y listo');
    // PRIMERO se saca el choque de encima quedándose con UNA de las dos
    // versiones, y recién después se rearma. Al revés —rearmar y agregar— hay
    // un camino que termina comiteando las marcas de conflicto adentro del
    // archivo: el de la máquina que no tiene esbuild y no puede rearmar nada.
    // Cuál de las dos se elija da igual, porque las dos se van a pisar en el
    // paso siguiente; lo que no da igual es que quede una sola y limpia.
    gitQuizas('checkout', '--ours', '--', ARMADO);
    if (!armar()) bien('ojo: sin rearmar, el juego quedó como estaba en el repo');
    git('add', ARMADO);
    const c = gitQuizas('rebase', '--continue');
    if (!c.ok) {
      // el rebase pide un mensaje por editor; con esto no lo pide
      process.env.GIT_EDITOR = 'true';
      const c2 = spawnSync('git', ['rebase', '--continue'],
        { encoding: 'utf8', env: { ...process.env, GIT_EDITOR: 'true' } });
      if (c2.status !== 0) { rendirse(c2.stderr || c.salida); }
    }
    bien('resuelto');
  } else if (chocados.length) {
    rendirse(
      'Chocaron archivos que SÍ tienen tu trabajo adentro y eso no lo puedo\n' +
      '  resolver solo — hay que mirarlos a mano:\n\n' +
      chocados.map(f => '    ' + f).join('\n') +
      '\n\n  Cuando los arregles:  git add . && git rebase --continue');
  } else {
    rendirse(r.salida);
  }
} else {
  bien(r.salida.includes('up to date') ? 'ya estabas al día' : 'traído');
}

// ---------------------------------------------------------------------------
// 3. REARMAR EL JUEGO
// ---------------------------------------------------------------------------
//
// Siempre, no sólo cuando chocó. Si otra máquina cambió el balance, el armado
// que acabás de bajar es el de ELLA y coincide; pero si acá tocaste src/, el
// armado quedó viejo respecto de tu propio código. Rearmarlo siempre es barato
// —dos segundos— y garantiza que lo que se juega es lo que dice el código.
paso('3 · Rearmando el juego de un solo archivo');
if (armar()) {
  if (git('status', '--porcelain', ARMADO)) {
    git('add', ARMADO);
    git('commit', '-m', 'Rearmado el juego de un solo archivo');
    bien('quedó al día con el código');
  } else {
    bien('ya estaba al día');
  }
}

// ---------------------------------------------------------------------------
// 4. SUBIR
// ---------------------------------------------------------------------------
paso('4 · Subiendo');
r = gitQuizas('push', '-u', 'origin', rama);
if (!r.ok) {
  // un push puede fallar por red; se reintenta con paciencia creciente
  let subio = false;
  for (const espera of [2000, 4000, 8000]) {
    console.log(`  · falló, reintento en ${espera / 1000} s...`);
    execFileSync(process.execPath, ['-e', `setTimeout(()=>{},${espera})`]);
    r = gitQuizas('push', '-u', 'origin', rama);
    if (r.ok) { subio = true; break; }
  }
  if (!subio) rendirse(r.salida);
}
bien('todo arriba');

console.log(`\n  ✓ Listo. Las otras máquinas ya lo pueden traer con JUGAR.bat.\n`);

// ---------------------------------------------------------------------------
function armar () {
  if (!existsSync('node_modules/esbuild')) {
    bien('sin esbuild en esta máquina: se deja el armado como vino del repo');
    bien('(si querés armarlo acá: npm install)');
    return false;
  }
  const b = spawnSync(process.execPath, ['herramientas/empaquetar.mjs'], { encoding: 'utf8' });
  if (b.status !== 0) { rendirse(b.stderr || 'no se pudo armar el juego'); }
  bien(b.stdout.trim());
  return true;
}

function rendirse (t) {
  console.error(`\n  SE FRENÓ ACÁ:\n\n  ${String(t).trim()}\n`);
  process.exit(1);
}
