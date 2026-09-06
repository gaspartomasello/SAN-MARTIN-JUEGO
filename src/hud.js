// HUD diegético: lo mínimo indispensable. Sin retícula, sin número de balas
// permanente, sin barra de vida. Lo que el jugador necesita saber se lee en el
// arma, en la respiración y en la pantalla.

const $ = s => document.querySelector(s);

// Cuánto dura en pantalla la marca de un golpe. No es un número de combate: es
// cuánto tarda alguien en girar la cabeza para buscar de dónde vino.
const DANO_DURA = 2.4;

export class Hud {
  constructor () {
    this.paso = $('#paso');
    this.pasoNombre = $('#paso .nombre');
    this.pasoProg = $('#paso .prog');
    this.aliento = $('#aliento');
    this.alientoBarra = $('#aliento i');
    this.cartuchera = $('#cartuchera');
    this.cartucheraN = $('#cartuchera .n');
    this.remate = $('#remate');
    this.velocidad = $('#velocidad');
    this.fundido = $('#fundido');
    this.parpados = $('#parpados');
    this.metralla = $('#metralla');
    this.frase = $('#frase');
    this.forcejeo = $('#forcejeo');
    this.cartelEl = $('#cartel');
    this.cartelTexto = '';
    this.cartelT = 0;
    this.placaEl = $('#placa');
    this.placaT = 0;
    // los cuatro arcos del indicador de daño, y de dónde vino cada golpe
    this.arcos = [...document.querySelectorAll('#dano path')];
    this.golpes = this.arcos.map(() => ({ t: 0, x: 0, z: 0 }));
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
  // `quien` es opcional y cambia lo que ES la línea. Sin él, el subtítulo es la
  // voz del juego —el narrador que cuenta que están bajando la barranca—. Con
  // él, es alguien hablando en el campo, y entonces hay que decir quién: dos
  // hombres distintos diciéndose cosas sin nombre encima son un solo texto que
  // se contradice. El nombre va arriba y en bronce; la frase, abajo.
  decir (texto, segundos, quien) {
    // `decir('')` es «callate»: lo usa la T para cortar la introducción en
    // seco. Sin esto quedaba el renglón vacío prendido tres segundos más.
    if (!texto) { this.tFrase = 0; this.frase.classList.remove('si'); return; }
    if (quien) {
      this.frase.textContent = '';
      const b = document.createElement('b');
      b.textContent = quien;
      this.frase.appendChild(b);
      this.frase.appendChild(document.createTextNode(texto));
    } else {
      this.frase.textContent = texto;
    }
    this.frase.classList.add('si');
    this.tFrase = segundos || 3.2;
  }

  // DE DÓNDE TE PEGARON.
  //
  // Se guarda el VECTOR AL AGRESOR en coordenadas del mundo, no el ángulo ya
  // resuelto contra la pantalla. Ésa es toda la diferencia entre un indicador y
  // una brújula: el ángulo se rehace en cada cuadro contra hacia dónde estás
  // mirando, así que girando la cabeza el arco se corre y te lleva al que te
  // tiró. Con el ángulo guardado, el arco se quedaría clavado en la pantalla y
  // no serviría para buscar a nadie.
  //
  // Cuatro a la vez y se pisa el más viejo: en una descarga te pegan de tres
  // lados y lo que hace falta es ver los tres, no el último.
  marcarDano (x, z) {
    if (!this.golpes.length) return;
    const d = Math.hypot(x, z);
    if (!d) return;
    let peor = 0;
    for (let i = 1; i < this.golpes.length; i++) {
      if (this.golpes[i].t < this.golpes[peor].t) peor = i;
    }
    this.golpes[peor] = { t: DANO_DURA, x: x / d, z: z / d };
  }

  // y se dibujan: uno por arco, girados al rumbo que les toca AHORA
  _pintarDano (dt, yaw) {
    const co = Math.cos(yaw), si = Math.sin(yaw);
    for (let i = 0; i < this.golpes.length; i++) {
      const g = this.golpes[i], p = this.arcos[i];
      if (g.t <= 0) { if (p.style.opacity !== '0') p.style.opacity = '0'; continue; }
      g.t = Math.max(0, g.t - dt);
      // adelante es (-sen, -cos) y la derecha (cos, -sen): son las mismas dos
      // que usa audio.js para panear, y por eso el oído y la vista coinciden
      const adelante = g.x * -si + g.z * -co;
      const derecha = g.x * co + g.z * -si;
      const grados = Math.atan2(derecha, adelante) * 180 / Math.PI;
      p.setAttribute('transform', `rotate(${grados.toFixed(1)})`);
      // entra de golpe y se va apagando: un aviso que se enciende despacio
      // llega tarde, y lo que hay que hacer con esto es girar YA
      const v = g.t / DANO_DURA;
      // COLORADO SUAVE: tiene que avisar de dónde vino sin taparte el campo.
      // A 0,85 y con trazo grueso era un cartel encima de la pelea.
      p.style.opacity = (Math.min(1, v * 2.2) * 0.58).toFixed(3);
    }
  }

  // EL HUD SE CALLA. Lo pide la apertura mientras dura la cinemática: con el
  // contador de cartuchos y la barra de recarga puestos, lo que se ve no es
  // una escena, es una partida con letras encima.
  callar (si) {
    const h = document.getElementById('hud');
    if (h) { h.style.transitionDuration = ''; h.classList.toggle('callado', !!si); }
  }

  // LA PLACA DE LA MISIÓN. Tres renglones —dónde, cuándo, quiénes— sobre el
  // negro que se abre al empezar, y los mismos tres al cerrar con el saldo de
  // la batalla. Es la única parte del juego que habla desde afuera del campo,
  // así que no se mezcla con el HUD: tiene su capa y su tipografía.
  //
  // Se le pasa `null` para bajarla antes de tiempo, que es lo que hace la T
  // cuando el jugador no quiere ver la introducción.
  placa (partes, seg = 3) {
    if (!this.placaEl) return;
    if (!partes) {
      this.placaT = 0;
      this.placaEl.classList.remove('si');
      return;
    }
    const [t, s, c] = ['.t', '.s', '.c'].map(q => this.placaEl.querySelector(q));
    t.textContent = partes.titulo || '';
    s.textContent = partes.sub || '';
    c.textContent = partes.cuerpo || '';
    this.placaT = seg;
    this.placaEl.classList.add('si');
  }

  // EL FUNDIDO A NEGRO. Existe por una sola razón y es tapar el cambio de
  // cuerpo del acto Cabral: pasar de estar tirado bajo el caballo a estar de
  // pie once metros más atrás no se puede hacer con un corte, se ve el truco.
  fundir (a, segundos) {
    // CERO SEGUNDOS ES CERO, no «no me dijiste nada». Decía `segundos || 0.9`,
    // y con eso pedir el negro AL INSTANTE —que es lo que necesita la apertura
    // para tapar el primer cuadro— daba un fundido de casi un segundo: el
    // negro recién estaba entrando cuando ya lo mandaban a salir, y la placa
    // se leía sobre el campo en vez de sobre el negro.
    const seg = segundos === undefined ? 0.9 : segundos;
    this.fundido.style.transition = `opacity ${seg}s linear`;
    // OJO: cambiar la transición y el valor en el mismo tick hace que el
    // navegador salte al final en vez de animar —agrupa los dos cambios en un
    // solo recálculo y no le queda un valor de partida—. Leer una propiedad
    // que obliga a calcular el layout, en el medio, es lo que lo separa en dos.
    void this.fundido.offsetHeight;
    this.fundido.style.opacity = String(a);
  }

  // SE CIERRAN LOS OJOS. Tres cosas encadenadas y ninguna es un corte a negro:
  // la vista se va de foco, el campo se apaga desde los bordes como un párpado
  // que baja, y recién al final entra el negro. Un corte dice «terminó la
  // partida»; esto dice «se está muriendo», que no es lo mismo.
  // `conBotones` en false es para el acto: ahí los ojos que se cierran son los
  // de Cabral, no los tuyos. Se muere él, la partida sigue, y no hay nada que
  // elegir —ofrecer «volver a empezar» ahí sería decir que se terminó—.
  cerrarLosOjos (seg, conBotones = true) {
    const t = seg || 6;
    const l = document.getElementById('lienzo');
    if (l) { l.style.transitionDuration = (t * 0.55).toFixed(2) + 's'; l.classList.add('ojos'); }
    const h = document.getElementById('hud');
    if (h) { h.style.transitionDuration = (t * 0.28).toFixed(2) + 's'; h.classList.add('ojos'); }
    if (this.parpados) {
      this.parpados.style.transitionDuration = (t * 0.42).toFixed(2) + 's';
      this.parpados.classList.add('si');
    }
    setTimeout(() => this.fundir(1, t * 0.42), t * 0.5 * 1000);
    // los botones, recién cuando la pantalla ya está negra
    if (conBotones) this.mostrarCaido(true, t * 0.96);
  }

  // LOS BOTONES DEL QUE CAYÓ. Van al final del fundido y no al principio: una
  // interfaz encima de la vista que se apaga corta la escena justo donde no
  // hay que cortarla. Primero se termina de morir y después se decide.
  mostrarCaido (si, seg) {
    const caja = document.getElementById('caido');
    if (!caja) return;
    clearTimeout(this._tCaido);
    if (!si) { caja.classList.remove('si'); caja.classList.add('oculto'); return; }
    this._tCaido = setTimeout(() => {
      caja.classList.remove('oculto');
      // el mismo cuidado que en `fundir`: sacar el display y poner la opacidad
      // en el mismo tick hace que el navegador salte al final sin animar
      void caja.offsetHeight;
      caja.classList.add('si');
    }, Math.max(0, (seg || 0) * 1000));
  }

  // y se vuelven a abrir
  abrirLosOjos () {
    this.mostrarCaido(false);
    const l = document.getElementById('lienzo');
    if (l) { l.style.transitionDuration = '0.5s'; l.classList.remove('ojos'); }
    const h = document.getElementById('hud');
    if (h) { h.style.transitionDuration = '0.5s'; h.classList.remove('ojos'); }
    if (this.parpados) { this.parpados.style.transitionDuration = '0.5s'; this.parpados.classList.remove('si'); }
    this.fundir(0, 0.5);
  }

  destello (f) {
    this.flash.style.transition = 'none';
    this.flash.style.opacity = String(0.55 * f);
    requestAnimationFrame(() => {
      this.flash.style.transition = 'opacity .22s ease-out';
      this.flash.style.opacity = '0';
    });
  }

  // EL CARTEL GRANDE. Una sola línea, en el medio de la pantalla y en la
  // tipografía más grande que tiene el juego: se usa para lo que hay que leer
  // sin buscarlo —qué tecla apretar ahora, a quién hay que ir a salvar—. Dura
  // los segundos que se le pidan y se apaga sola. Pedir el mismo texto que ya
  // está no reinicia el reloj: si no, algo que se pide por cuadro no se apaga
  // nunca.
  cartel (texto, seg = 3) {
    if (!this.cartelEl) return;
    if (texto && texto === this.cartelTexto) return;
    this.cartelTexto = texto || '';
    this.cartelT = texto ? seg : 0;
    if (texto) this.cartelEl.textContent = texto;
    this.cartelEl.classList.toggle('si', !!texto);
  }

  actualizar (dt, datos) {
    this._pintarDano(dt, datos.yaw || 0);
    // la placa se apaga sola, como el cartel
    if (this.placaT > 0) {
      this.placaT -= dt;
      if (this.placaT <= 0) this.placaEl.classList.remove('si');
    }
    // el cartel se apaga solo
    if (this.cartelT > 0) {
      this.cartelT -= dt;
      if (this.cartelT <= 0) { this.cartelTexto = ''; this.cartelEl.classList.remove('si'); }
    }
    // --- paso de carga ---
    const p = datos.paso;
    if (p) {
      this.paso.style.opacity = '1';
      this.pasoNombre.textContent = `${p.indice}/${p.total} · ${p.nombre}`;
      this.pasoProg.style.width = (p.progreso * 100).toFixed(1) + '%';
    } else {
      this.paso.style.opacity = '0';
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
    // y no cuando estás muerto: ahí `atrapado` es la cámara cayéndose al pasto,
    // no una pierna abajo de un caballo, y no hay nada que forcejear
    // LA BARRA Y EL RÓTULO SON DOS COSAS. La barra sale cuando hay algo que
    // llenar —forcejeando bajo el caballo, o empujando el de San Martín— y el
    // rótulo puede salir solo: siendo Cabral, mientras corrés, dice a cuántos
    // metros está. Iban juntos y la barra acompañaba a los metros toda la
    // corrida, vacía; una barra vacía al lado de un número dice que ese número
    // se está llenando, que no es lo que pasa.
    const barra = (datos.atrapado > 0 && datos.vida > 0) || datos.empujando;
    const rotulo = datos.rotulo || (barra ? 'ESPACIO' : '');
    this.forcejeo.classList.toggle('si', barra || !!rotulo);
    this.forcejeo.classList.toggle('sinbarra', !barra);
    if (barra) this.forcejeo.querySelector('i').style.setProperty('--f',
      (Math.min(1, datos.forcejeo || 0) * 100).toFixed(0) + '%');
    if (rotulo) {
      const rot = this.forcejeo.querySelector('b');
      if (rot.textContent !== rotulo) rot.textContent = rotulo;
    }

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
