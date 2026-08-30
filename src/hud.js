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
    this.ahora = $('#ahora');
    this.remate = $('#remate');
    this.velocidad = $('#velocidad');
    this.fundido = $('#fundido');
    this.metralla = $('#metralla');
    this.frase = $('#frase');
    this.forcejeo = $('#forcejeo');
    this.tFrase = 0;
    this.tomar = $('#tomar');
    this.aviso = $('#aviso');
    this.estado = $('#estado');
    this.depurar = $('#depurar');
    this.vida = $('#vida');
    this.vidaLleno = $('#vida .lleno');
    this.vidaNum = $('#vida .txt b');
    this.humoPantalla = $('#humo-pantalla');
    this.sangre = $('#sangre');
    this.flash = $('#flash');

    this.tAviso = 0;
    this.tCartuchera = 0;
    this.vecesQueAcerto = 0;     // el cartel grande se apaga solo cuando ya entendiste
    this.verDepurar = false;
    this.tVidaVisible = 0;
  }

  mostrarAviso (texto, tipo) {
    this.aviso.textContent = texto;
    this.aviso.className = tipo || '';
    this.aviso.style.opacity = '1';
    this.tAviso = 1.4;
  }

  verCartuchera () { this.tCartuchera = 2.6; }

  // Una línea sola, abajo y al centro. Es la voz del acto: no hay más HUD que
  // esto durante los diecisiete segundos que dura.
  decir (texto, segundos) {
    this.frase.textContent = texto;
    this.frase.classList.add('si');
    this.tFrase = segundos || 3.2;
  }

  // EL FUNDIDO A NEGRO. Existe por una sola razón y es tapar el cambio de
  // cuerpo del acto Cabral: pasar de estar tirado bajo el caballo a estar de
  // pie once metros más atrás no se puede hacer con un corte, se ve el truco.
  fundir (a, segundos) {
    this.fundido.style.transition = `opacity ${segundos || 0.9}s linear`;
    this.fundido.style.opacity = String(a);
  }

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
        // el aviso grande: mientras la ventana está abierta y no marcaste
        this.ahora.classList.toggle('si', !!p.enVentana && this.vecesQueAcerto < 6);
        const [a, b] = p.ventana;
        this.pasoWin.style.left = (a * 100).toFixed(1) + '%';
        this.pasoWin.style.width = ((b - a) * 100).toFixed(1) + '%';
        this.pasoWin.style.background = p.marcado === 'mal' ? '#E4797B'
          : (p.marcado === 'bien' ? '#9BC48F' : 'var(--bronce)');
      } else {
        this.paso.classList.remove('golpe');
        this.ahora.classList.remove('si');
      }
    } else {
      this.paso.style.opacity = '0';
      this.ahora.classList.remove('si');
    }

    // ventana del remate abierta tras una parada perfecta
    this.remate.classList.toggle('si', datos.remate > 0);
    // el túnel del galope: no se enciende hasta pasado el trote
    const gal = Math.max(0, ((datos.rapidez || 0) - 4.2) / 6);
    this.velocidad.style.opacity = Math.min(1, gal).toFixed(3);
    // el aviso de la metralla: cuanto más centrado en el cono, más fuerte
    this.metralla.style.opacity = Math.min(1, (datos.metralla || 0) * 1.4).toFixed(3);

    if (this.tFrase > 0) {
      this.tFrase -= dt;
      if (this.tFrase <= 0) this.frase.classList.remove('si');
    }
    // La misma barra dice dos cosas opuestas: tirado bajo el caballo es lo que
    // NO alcanza, y de pie empujándolo es lo que sí. Es a propósito que sea la
    // misma: el jugador ya aprendió a mirarla en el peor momento del juego.
    const barra = datos.atrapado > 0 || datos.empujando;
    this.forcejeo.classList.toggle('si', barra);
    if (barra) this.forcejeo.querySelector('i').style.setProperty('--f',
      (Math.min(1, datos.forcejeo || 0) * 100).toFixed(0) + '%');

    this.tomar.style.opacity = datos.puedeTomarFusil ? '1' : '0';

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

    // --- vida: barra que aparece cuando hace falta y se va sola ---
    const v = Math.max(0, Math.min(100, datos.vida));
    this.vidaLleno.style.width = v + '%';
    this.vidaNum.textContent = Math.round(v);
    this.vida.classList.toggle('grave', v < 32);
    this.vida.classList.toggle('regenerando', datos.regenerando && v < 100);
    if (v < 100) this.tVidaVisible = 2.2;
    else this.tVidaVisible = Math.max(0, this.tVidaVisible - dt);
    this.vida.style.opacity = this.tVidaVisible > 0 ? '1' : '0';

    // la pantalla se tiñe a medida que baja la vida
    const dano = 1 - v / 100;
    this.sangre.style.opacity = String(Math.pow(dano, 1.4) * 0.9);

    // --- línea de estado ---
    let txt = `${datos.nombreArma} · <b>${datos.estadoArma}</b> · ${datos.postura}`;
    if (v <= 0) txt += ' · <span class="mal">fuera de combate — Enter para volver a formar</span>';
    else if (datos.vendando > 0) txt += ' · <span class="mal">vendando…</span>';
    if (datos.postura === 'cuerpo a tierra') txt += ' · <span class="mal">no se puede cargar tirado</span>';
    txt += `<br>realistas ${datos.enemigos} · granaderos ${datos.aliados} · vendas ${datos.vendas}`;
    // LOS QUE SE ESTÁN YENDO. Es el número que dice si estás ganando, y no es
    // el de muertos: San Lorenzo se ganó cuando la línea se quebró, con la
    // mayoría de los doscientos cincuenta todavía en pie.
    const q = datos.quiebre;
    if (q && (q.realistas.rotos || q.idos)) {
      txt += ` · <span class="bien">${q.realistas.rotos + q.idos} realistas quebrados</span>`;
    }
    if (q && q.granaderos.rotos) {
      txt += ` · <span class="mal">${q.granaderos.rotos} de los tuyos se van</span>`;
    }
    // Tu columna. Mientras esté formada es un número que no querés ver bajar:
    // son sesenta hombres que te siguen a vos y a nadie más.
    if (datos.columna) {
      txt += `<br><b>tu columna ${datos.columna.tuya}</b> · la otra ${datos.columna.otra}`;
      if (datos.columna.esperando) txt += ' · <span class="bien">[T] el clarín</span>';
      // Ya en la pelea, la otra orden: volverlos a formar para entrar de nuevo.
      else if (datos.columna.suelta) txt += ' · <span class="bien">[Q] ¡a mí!</span>';
    }
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
