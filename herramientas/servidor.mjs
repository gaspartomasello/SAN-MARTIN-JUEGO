// ===========================================================================
// EL SERVIDOR DE LA SALA · para jugar los dos en la misma red
// ===========================================================================
//
//   node herramientas/servidor.mjs
//
// Hace dos cosas y ninguna más:
//
//   1. SIRVE EL JUEGO por HTTP, para que el de la otra máquina no tenga que
//      copiarse nada: abre la dirección que este programa imprime y listo.
//   2. PASA MENSAJES entre los dos navegadores. Nada más. No sabe qué es un
//      granadero, ni cuánto duele un lanzazo, ni quién ganó.
//
// Esa segunda parte es una decisión, no una limitación. La batalla la simula
// UNO de los dos navegadores —el anfitrión— y el otro mira y pelea. Si el
// servidor simulara, habría que tener la batalla escrita dos veces: una en
// src/ para el navegador y otra acá para node, y las dos se irían separando.
// Así hay una sola batalla, la de src/, y esto es un cable.
//
// SIN DEPENDENCIAS. El apretón de manos de WebSocket son veinte líneas y el
// formato de trama son sesenta: no vale la pena arrastrar un paquete para
// esto, y de paso el que clona el repo no tiene que instalar nada nuevo.
// (RFC 6455, si a alguien le interesa el detalle.)

import http from 'node:http';
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUERTO = Number(process.env.PUERTO || process.argv[2] || 8099);
const MAGIA = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

// ---------------------------------------------------------------------------
// la parte HTTP: servir el repo tal cual está
// ---------------------------------------------------------------------------
const servidor = http.createServer((pedido, respuesta) => {
  let ruta = decodeURIComponent((pedido.url || '/').split('?')[0]);
  if (ruta === '/') ruta = '/index.html';
  // nadie se sale de la carpeta del proyecto
  const archivo = path.join(RAIZ, path.normalize(ruta).replace(/^(\.\.[/\\])+/, ''));
  if (!archivo.startsWith(RAIZ)) { respuesta.writeHead(403).end('no'); return; }
  fs.readFile(archivo, (err, datos) => {
    if (err) { respuesta.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('No está: ' + ruta); return; }
    respuesta.writeHead(200, {
      'content-type': TIPOS[path.extname(archivo).toLowerCase()] || 'application/octet-stream',
      'cache-control': 'no-cache'
    });
    respuesta.end(datos);
  });
});

// ---------------------------------------------------------------------------
// la parte WebSocket: el apretón de manos y las tramas
// ---------------------------------------------------------------------------
//
// Una conexión abierta es un objeto con dos métodos —mandar y cerrar— y tres
// ganchos. El resto de este archivo no vuelve a mirar bytes.
function abrazar (pedido, enchufe, cabeza) {
  const clave = pedido.headers['sec-websocket-key'];
  if (!clave) { enchufe.destroy(); return null; }
  const acepta = crypto.createHash('sha1').update(clave + MAGIA).digest('base64');
  enchufe.write(
    'HTTP/1.1 101 Switching Protocols\r\n' +
    'Upgrade: websocket\r\nConnection: Upgrade\r\n' +
    'Sec-WebSocket-Accept: ' + acepta + '\r\n\r\n');
  enchufe.setNoDelay(true);   // sin Nagle: son paquetes chicos y frecuentes

  const cn = {
    enchufe,
    vivo: true,
    rol: null,
    alTexto: null,
    alBinario: null,
    alCerrar: null,
    mandar (dato) { escribir(enchufe, dato); },
    cerrar (motivo) {
      if (!cn.vivo) return;
      cn.vivo = false;
      try { enchufe.end(trama(0x8, Buffer.from(motivo || '', 'utf8'))); } catch { /* ya estaba caído */ }
      enchufe.destroy();
      adios();
    }
  };

  let cola = cabeza && cabeza.length ? Buffer.from(cabeza) : Buffer.alloc(0);
  let armando = null;          // mensaje partido en varias tramas
  let armandoTipo = 0;

  enchufe.on('data', trozo => {
    cola = cola.length ? Buffer.concat([cola, trozo]) : trozo;
    for (;;) {
      const t = leerTrama(cola);
      if (!t) break;
      cola = cola.subarray(t.largo);
      if (t.op === 0x8) { cn.cerrar(); return; }
      if (t.op === 0x9) { enchufe.write(trama(0xA, t.datos)); continue; }
      if (t.op === 0xA) continue;
      if (t.op === 0x0) {
        armando = armando ? Buffer.concat([armando, t.datos]) : t.datos;
      } else {
        armando = t.datos;
        armandoTipo = t.op;
      }
      if (!t.fin) continue;
      const completo = armando;
      armando = null;
      if (armandoTipo === 0x1) { if (cn.alTexto) cn.alTexto(completo.toString('utf8')); }
      else if (cn.alBinario) cn.alBinario(completo);
    }
  });
  // EL QUE SE VA TIENE QUE LIBERAR SU LUGAR, y esto estaba roto de la peor
  // manera: sólo fallaba cuando el otro se iba BIEN.
  //
  // El aviso colgaba de `cn.vivo`, y `cerrar()` —que es lo que corre cuando
  // llega la trama de cierre, o sea cuando alguien cierra la pestaña— ya lo
  // había puesto en false. Así que `adios` no avisaba a nadie: el lugar
  // quedaba tomado por un muerto, el compañero se quedaba mirando un campo
  // congelado sin que nadie le dijera nada, y la sala no aceptaba a nadie más
  // hasta reiniciar el servidor. Una desconexión sucia —un cable, un wifi que
  // se corta— sí avisaba, porque ahí `cerrar()` no llega a correr.
  //
  // Ahora el aviso tiene su propia guarda y sale una sola vez, venga por donde
  // venga: trama de cierre, socket cerrado o error.
  let avisado = false;
  const adios = () => {
    if (avisado) return;
    avisado = true;
    cn.vivo = false;
    if (cn.alCerrar) cn.alCerrar();
  };
  enchufe.on('close', adios);
  enchufe.on('error', adios);
  return cn;
}

// Una trama del cliente siempre viene enmascarada; una del servidor, nunca.
function leerTrama (b) {
  if (b.length < 2) return null;
  const fin = (b[0] & 0x80) !== 0;
  const op = b[0] & 0x0f;
  const conMascara = (b[1] & 0x80) !== 0;
  let n = b[1] & 0x7f;
  let i = 2;
  if (n === 126) { if (b.length < i + 2) return null; n = b.readUInt16BE(i); i += 2; }
  else if (n === 127) { if (b.length < i + 8) return null; n = Number(b.readBigUInt64BE(i)); i += 8; }
  if (conMascara) { if (b.length < i + 4) return null; }
  const mascara = conMascara ? b.subarray(i, i + 4) : null;
  if (conMascara) i += 4;
  if (b.length < i + n) return null;
  const datos = Buffer.from(b.subarray(i, i + n));
  if (mascara) for (let k = 0; k < n; k++) datos[k] ^= mascara[k & 3];
  return { fin, op, datos, largo: i + n };
}

function trama (op, carga) {
  const n = carga.length;
  let cab;
  if (n < 126) { cab = Buffer.alloc(2); cab[1] = n; }
  else if (n < 65536) { cab = Buffer.alloc(4); cab[1] = 126; cab.writeUInt16BE(n, 2); }
  else { cab = Buffer.alloc(10); cab[1] = 127; cab.writeBigUInt64BE(BigInt(n), 2); }
  cab[0] = 0x80 | op;
  return Buffer.concat([cab, carga]);
}

function escribir (enchufe, dato) {
  if (enchufe.destroyed) return;
  if (typeof dato === 'string') enchufe.write(trama(0x1, Buffer.from(dato, 'utf8')));
  else enchufe.write(trama(0x2, Buffer.from(dato)));
}

// ---------------------------------------------------------------------------
// LA SALA. Diez lugares, y el que llega primero es el anfitrión.
// ---------------------------------------------------------------------------
//
// El anfitrión simula la batalla entera. Por eso no da lo mismo quién es
// quién: si el anfitrión se va, la batalla se termina para todos, y hay que
// decirlo en vez de dejar a los demás mirando un campo congelado.
//
// ESTO YA NO ES UN CABLE PELADO, Y NO SE PUEDE EVITAR. Con dos jugadores el
// servidor podía pasar todo de uno al otro sin mirarlo: sólo había un destino
// posible. Con más, la red es una ESTRELLA —cada invitado habla con el
// anfitrión y con nadie más— y hacen falta las dos únicas cosas que sólo el
// servidor sabe:
//
//   `de`    DE QUIÉN VINO. Por el código el anfitrión lo sabe porque cada
//           invitado llega por su propio caño; acá todos llegan por caños
//           distintos pero el anfitrión tiene uno solo, así que si el servidor
//           no lo estampa, no hay forma de saber quién habló.
//   `para`  A QUIÉN VA. Lo pone el anfitrión y el servidor lo obedece. Sin
//           `para`, a todos.
//
// Sigue sin saber qué es un granadero, ni cuánto duele un lanzazo, ni quién
// ganó. Mira dos campos de un sobre, no la carta.
const MAX = 10;
const sala = new Map();          // número de jugador → conexión

function anfitrion () { return sala.get(0) || null; }
function avisar (cn, obj) { if (cn && cn.vivo) cn.mandar(JSON.stringify(obj)); }

servidor.on('upgrade', (pedido, enchufe, cabeza) => {
  const cn = abrazar(pedido, enchufe, cabeza);
  if (!cn) return;

  let j = -1;
  for (let k = 0; k < MAX; k++) if (!sala.has(k)) { j = k; break; }
  if (j < 0) {
    avisar(cn, { t: 'lleno' });
    setTimeout(() => cn.cerrar('sala llena'), 60);
    console.log(`· alguien quiso entrar y la sala ya tenía ${MAX}`);
    return;
  }
  sala.set(j, cn);
  cn.j = j;
  cn.rol = j === 0 ? 'anfitrion' : 'invitado';

  console.log(`· entra el jugador ${j} (${cn.rol})  — ${sala.size} en la sala`);
  avisar(cn, { t: 'sala', rol: cn.rol, j, completa: sala.size > 1 });
  if (j > 0) avisar(anfitrion(), { t: 'par', entra: true, j, rol: cn.rol });

  cn.alTexto = txt => {
    if (j === 0) {
      // del anfitrión: lo que lleva `para` va a uno; lo demás, a todos
      let para;
      try { para = JSON.parse(txt).para; } catch { /* que lo tire el que reciba */ }
      if (para === undefined || para === null) {
        for (const [k, c] of sala) { if (k !== 0 && c.vivo) c.mandar(txt); }
      } else {
        const c = sala.get(para);
        if (c && c.vivo) c.mandar(txt);
      }
      return;
    }
    // de un invitado: siempre al anfitrión, con el remitente estampado. Se
    // mete la clave al principio del sobre en vez de armar el objeto de nuevo:
    // son treinta cartas por segundo por jugador y no hay nada que interpretar.
    const a = anfitrion();
    if (!a || !a.vivo) return;
    a.mandar(txt.length > 2 && txt[0] === '{' ? '{"de":' + j + ',' + txt.slice(1) : txt);
  };
  // el parte del mundo, en binario: sale del anfitrión y va a todos
  cn.alBinario = buf => {
    if (j !== 0) return;
    for (const [k, c] of sala) { if (k !== 0 && c.vivo) c.mandar(buf); }
  };
  cn.alCerrar = () => {
    sala.delete(j);
    // SI SE VA EL QUE SIMULA, SE ACABÓ PARA TODOS. Dejarlos conectados a una
    // sala sin batalla es dejarlos mirando un campo congelado sin que nadie se
    // los diga; se les avisa y se los cierra, y arman otra.
    if (j === 0) {
      console.log('· se fue el anfitrión: la sala se cierra');
      const quedan = [...sala.values()];
      sala.clear();
      for (const c of quedan) {
        avisar(c, { t: 'par', entra: false, j: 0, rol: 'anfitrion' });
        setTimeout(() => c.cerrar('se fue el anfitrión'), 60);
      }
      return;
    }
    console.log(`· se fue el jugador ${j}  — quedan ${sala.size}`);
    avisar(anfitrion(), { t: 'par', entra: false, j, rol: cn.rol });
  };
});

// ---------------------------------------------------------------------------
// arrancar, y decir en voz alta a dónde tiene que entrar el otro
// ---------------------------------------------------------------------------
function direccionesDeRed () {
  const salida = [];
  for (const listas of Object.values(os.networkInterfaces())) {
    for (const d of listas || []) {
      if (d.family === 'IPv4' && !d.internal) salida.push(d.address);
    }
  }
  return salida;
}

// ABRIR EL NAVEGADOR SOLO. El que levanta la sala ya hizo doble clic en un
// archivo; pedirle además que copie una dirección a mano es una oportunidad más
// de que algo salga mal. Si no se puede abrir no pasa nada: la dirección está
// impresa acá arriba.
function abrirNavegador (url) {
  const cmd = process.platform === 'win32' ? 'cmd'
    : process.platform === 'darwin' ? 'open' : 'xdg-open';
  const args = process.platform === 'win32' ? ['/c', 'start', '""', url] : [url];
  // OJO: spawn avisa el fallo por un EVENTO, no por una excepción, así que un
  // try/catch no alcanza. Sin el manejador, una máquina sin xdg-open —o sea
  // media Linux— tumbaba la sala entera al abrirla. Si no se puede abrir el
  // navegador no pasa nada: la dirección está impresa acá arriba.
  try {
    const p = spawn(cmd, args, { detached: true, stdio: 'ignore' });
    p.on('error', () => {});
    p.unref();
  } catch { /* que se copie la dirección a mano */ }
}

// Y SI EL PUERTO ESTÁ OCUPADO, se dice en castellano. Node tira un volcado de
// veinte líneas con «EADDRINUSE» que no le dice nada a nadie, y la causa casi
// siempre es la misma y tiene arreglo de una: ya hay una sala abierta.
servidor.on('error', e => {
  console.log('');
  if (e.code === 'EADDRINUSE') {
    console.log(`  Ya hay una sala abierta en el puerto ${PUERTO}.`);
    console.log('  Cerrá la otra ventana negra y volvé a intentar,');
    console.log('  o entrá directamente a http://localhost:' + PUERTO);
  } else if (e.code === 'EACCES') {
    console.log(`  El sistema no deja abrir el puerto ${PUERTO}.`);
    console.log('  Probá con otro: node herramientas/servidor.mjs 8100');
  } else {
    console.log('  No se pudo abrir la sala: ' + e.message);
  }
  console.log('');
  process.exitCode = 1;
});

servidor.listen(PUERTO, () => {
  const ips = direccionesDeRed();
  console.log('');
  console.log('  EL CLARÍN DE SAN LORENZO · sala de hasta diez');
  console.log('  ─────────────────────────────────────────────');
  console.log(`  En esta máquina:   http://localhost:${PUERTO}`);
  if (ips.length) {
    console.log('  En la otra máquina, cualquiera de éstas:');
    for (const ip of ips) console.log(`                     http://${ip}:${PUERTO}`);
  } else {
    console.log('  (no encontré ninguna dirección de red: revisá el wifi o el cable)');
  }
  console.log('');
  console.log('  Todos abren esa dirección y eligen «Los dos costados».');
  console.log('  El primero es San Martín y lleva la columna del oeste; el segundo,');
  console.log('  Bermúdez y la del este. Del tercero en adelante, granaderos.');
  console.log('');
  console.log('  Dejá esta ventana abierta mientras juegan. Se cierra con Ctrl+C.');
  console.log('');
  abrirNavegador(`http://localhost:${PUERTO}`);
});
