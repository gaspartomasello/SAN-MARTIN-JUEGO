// ESTORBOS — lo que ocupa lugar.
//
// Hasta acá los soldados eran fantasmas: se atravesaban entre ellos y cruzaban
// las tapias como si no estuvieran. Se notaba sobre todo en dos momentos: una
// fila de realistas que camina hacia vos y termina toda amontonada en el mismo
// punto, y un lancero que te pasa POR ADENTRO en vez de tener que rodearte.
//
// Dos cosas hacen falta y son distintas:
//
//   · contra el escenario —tapias, carros, la pieza— se empuja al hombre
//     afuera de la caja y se lo deja deslizar por la pared. Igual que el
//     jugador y que el caballo: nadie se clava, todos raspan y siguen.
//
//   · entre ellos, una separación mutua. Y acá hay un problema de cuentas: 370
//     hombres son 68 mil pares por cuadro si se prueban todos contra todos.
//     Por eso la rejilla: cada uno mira sólo las nueve celdas de alrededor y
//     el costo pasa a crecer con la cantidad de gente, no con su cuadrado.

export const RADIO_HOMBRE = 0.40;      // lo que ocupa un hombre de a pie
export const RADIO_CABALLO = 1.05;     // lo que ocupa el animal, de ancho

// Empuja un punto fuera de una caja. Devuelve 0 si no tocó, o cuánto hubo que
// moverlo. Deja la normal en `n` para el que quiera deslizar.
export function sacarDeCaja (pos, radio, caja, n) {
  const cx = Math.max(caja.min.x, Math.min(pos.x, caja.max.x));
  const cz = Math.max(caja.min.z, Math.min(pos.z, caja.max.z));
  const dx = pos.x - cx, dz = pos.z - cz;
  const d2 = dx * dx + dz * dz;
  if (d2 >= radio * radio) return 0;

  if (d2 > 1e-8) {
    const d = Math.sqrt(d2);
    const empuje = radio - d;
    n.x = dx / d; n.z = dz / d;
    pos.x += n.x * empuje;
    pos.z += n.z * empuje;
    return empuje;
  }

  // el centro quedó adentro: sale por la cara más próxima
  const salidas = [
    [pos.x - caja.min.x, -1, 0, caja.min.x - radio, pos.z],
    [caja.max.x - pos.x, 1, 0, caja.max.x + radio, pos.z],
    [pos.z - caja.min.z, 0, -1, pos.x, caja.min.z - radio],
    [caja.max.z - pos.z, 0, 1, pos.x, caja.max.z + radio]
  ];
  salidas.sort((a, b) => a[0] - b[0]);
  const [, sx, sz, px, pz] = salidas[0];
  n.x = sx; n.z = sz;
  const antes = Math.hypot(pos.x - px, pos.z - pz);
  pos.x = px; pos.z = pz;
  return antes;
}

// Rejilla de vecindad. Se rehace entera cada cuadro —es más barato que
// mantenerla— y sirve para preguntar «quién tengo al lado» sin recorrer a todo
// el ejército.
export class Rejilla {
  constructor (celda = 2) {
    this.celda = celda;
    this.celdas = new Map();
  }

  _clave (x, z) {
    return (((x / this.celda) | 0) + 512) * 4096 + (((z / this.celda) | 0) + 512);
  }

  rehacer (cosas) {
    this.celdas.clear();
    for (const c of cosas) {
      const k = this._clave(c.pos.x, c.pos.z);
      const l = this.celdas.get(k);
      if (l) l.push(c); else this.celdas.set(k, [c]);
    }
  }

  // llama a fn(otro) por cada cosa de las nueve celdas de alrededor
  cerca (x, z, fn) {
    const c = this.celda;
    const cx = (x / c) | 0, cz = (z / c) | 0;
    for (let i = -1; i <= 1; i++) {
      for (let k = -1; k <= 1; k++) {
        const l = this.celdas.get((cx + i + 512) * 4096 + (cz + k + 512));
        if (!l) continue;
        for (const o of l) fn(o);
      }
    }
  }
}

// Separación mutua entre hombres de a pie. Cada par se resuelve UNA vez —el de
// índice menor manda— y los dos ceden la mitad, así nadie tiene prioridad por
// haber nacido antes. Los muertos no empujan: por encima de un cuerpo se pasa.
export function separar (soldados, rejilla, radio = RADIO_HOMBRE) {
  const d = radio * 2;
  const d2 = d * d;
  rejilla.rehacer(soldados);
  for (let i = 0; i < soldados.length; i++) {
    const a = soldados[i];
    if (!a.vivo || a.montado) continue;
    rejilla.cerca(a.pos.x, a.pos.z, b => {
      if (b.orden <= a.orden || !b.vivo || b.montado) return;
      const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z;
      const q = dx * dx + dz * dz;
      if (q >= d2) return;
      if (q < 1e-6) {
        // exactamente encima: se los abre por un eje cualquiera pero estable,
        // si no tiemblan para siempre
        const s = (a.orden % 2) ? 1 : -1;
        a.pos.x -= s * radio * 0.5; b.pos.x += s * radio * 0.5;
        return;
      }
      const l = Math.sqrt(q);
      const empuje = (d - l) * 0.5;
      const nx = dx / l * empuje, nz = dz / l * empuje;
      a.pos.x -= nx; a.pos.z -= nz;
      b.pos.x += nx; b.pos.z += nz;
    });
  }
}
