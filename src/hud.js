// HUD diegético: lo mínimo indispensable. Sin retícula, sin número de balas
// permanente, sin barra de vida. Lo que el jugador necesita saber se lee en el
// arma, en la respiración y en la pantalla.

const $ = s => document.querySelector(s);

export class Hud {
  constructor () {
    this.paso = $('#paso');
    this.pasoNombre = $('#paso .nombre');
    this.pasoProg = $('#paso .prog');
    this.pasoWin = $('#paso .win');
    this.aliento = $('#aliento');
    this.alientoBarra = $('#aliento i');
    this.cartuchera = $('#cartuchera');
    this.cartucheraN = $('#cartuchera .n');
    this.aviso = $('#aviso');
    this.estado = $('#estado');
    this.depurar = $('#depurar');
    this.humoPantalla = $('#humo-pantalla');
    this.sangre = $('#sangre');
    this.flash = $('#flash');

    this.tAviso = 0;
    this.tCartuchera = 0;
    this.verDepurar = false;
    this._grano();
  }

  _grano () {
    const c = document.getElementById('grano');
    const x = c.getContext('2d');
    const n = 220;
    c.width = c.height = n;
    const img = x.createImageData(n, n);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random() * 255;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    c.style.width = '100%';
    c.style.height = '100%';
  }

  mostrarAviso (texto, tipo) {
    this.aviso.textContent = texto;
    this.aviso.className = tipo || '';
    this.aviso.style.opacity = '1';
    this.tAviso = 1.4;
  }

  verCartuchera () { this.tCartuchera = 2.6; }

  destello (f) {
    this.flash.style.transition = 'none';
    this.flash.style.opacity = String(0.55 * f);
    requestAnimationFrame(() => {
      this.flash.style.transition = 'opacity .22s ease-out';
      this.flash.style.opacity = '0';
    });
  }

  actualizar (dt, datos) {
    // --- paso de carga ---
    const p = datos.paso;
    if (p) {
      this.paso.style.opacity = '1';
      this.pasoNombre.textContent = `${p.indice}/${p.total} · ${p.nombre}`;
      this.pasoProg.style.width = (p.progreso * 100).toFixed(1) + '%';
      if (p.golpe) {
        this.paso.classList.add('golpe');
        const [a, b] = p.ventana;
        this.pasoWin.style.left = (a * 100).toFixed(1) + '%';
        this.pasoWin.style.width = ((b - a) * 100).toFixed(1) + '%';
        this.pasoWin.style.background = p.marcado === 'mal' ? '#E4797B'
          : (p.marcado === 'bien' ? '#9BC48F' : 'var(--bronce)');
      } else {
        this.paso.classList.remove('golpe');
      }
    } else {
      this.paso.style.opacity = '0';
    }

    // --- aliento: sólo aparece cuando falta ---
    const al = datos.aliento;
    this.aliento.style.opacity = al < 72 ? String(Math.min(1, (72 - al) / 26)) : '0';
    this.alientoBarra.style.width = al + '%';
    this.alientoBarra.style.background = al < 25 ? '#E4797B' : '#8FA6C4';

    // --- cartuchera ---
    if (this.tCartuchera > 0) {
      this.tCartuchera -= dt;
      this.cartuchera.style.opacity = '1';
      this.cartucheraN.textContent = datos.cartuchos;
    } else this.cartuchera.style.opacity = '0';

    // --- aviso ---
    if (this.tAviso > 0) {
      this.tAviso -= dt;
      if (this.tAviso <= 0) this.aviso.style.opacity = '0';
    }

    // --- humo en los ojos ---
    this.humoPantalla.style.opacity = String(Math.min(0.86, datos.humoLocal * 0.95));

    // --- heridas ---
    const h = datos.heridas;
    this.sangre.style.opacity = h === 0 ? '0' : (h === 1 ? '0.42' : (h === 2 ? '0.8' : '0.95'));

    // --- línea de estado ---
    let txt = `arma: <b>${datos.estadoArma}</b>`;
    if (datos.emplome > 0) txt += ` · ánima: ${datos.emplome} tiros`;
    if (h === 1) txt += ' · <span class="mal">herido</span>';
    if (h === 2) txt += ' · <span class="mal">grave</span>';
    if (h >= 3) txt += ' · <span class="mal">fuera de combate — Enter para volver a formar</span>';
    if (datos.vendando > 0) txt += ` · vendando ${datos.vendando.toFixed(1)}s`;
    txt += `<br>realistas en pie: ${datos.enemigos} · vendas: ${datos.vendas}`;
    this.estado.innerHTML = txt;

    // --- depuración ---
    if (this.verDepurar) {
      this.depurar.style.display = 'block';
      this.depurar.innerHTML = [
        `fps ${datos.fps.toFixed(0)}`,
        `nubes de humo ${datos.nubes}`,
        `densidad local ${datos.humoLocal.toFixed(2)}`,
        `presión ${datos.presion.toFixed(2)}`,
        `llamadas de dibujo ${datos.draws}`,
        `triángulos ${datos.tris}`
      ].join('<br>');
    } else this.depurar.style.display = 'none';
  }
}
