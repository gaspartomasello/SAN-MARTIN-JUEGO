import { chromium } from 'playwright';
const nav = await chromium.launch({ executablePath: process.env.CHROMIUM,
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
const pag = await nav.newPage({ viewport: { width: 900, height: 620 } });
const errs = [];
pag.on('pageerror', e => errs.push(e.message));
await pag.goto('http://localhost:8099/index.html', { waitUntil: 'load' });
await pag.waitForFunction(() => !!window.juego, null, { timeout: 90000 }); await pag.click('#modo-campo'); await pag.waitForTimeout(1600);

const r = await pag.evaluate(() => {
  const j = window.juego, out = [];
  const ok = (n, cond, extra) => out.push([cond ? 'OK ' : 'MAL', n, extra === undefined ? '' : extra]);
  const teclas = new Set();
  const acto = j.acto;

  // campo limpio y el jugador montado en medio del campo
  j.soldados.forEach(s => s.quitar()); j.soldados.length = 0;
  j.canones.forEach(c => { c.vivo = false; });
  const c = j.caballos.find(x => x.vivo) || j.caballo;
  c.pos.set(0, 0, -30); c.rumbo = 0; c.vida = 6; c.vivo = true; c.caida = 0;
  c.colisiones = [];
  j.jugador.vida = 100; j.jugador.vivo = true;
  j.jugador.montar(c);

  ok('arranca montado', !!j.jugador.monta);
  ok('el acto no arrancó todavía', !acto.activo);

  // le matan el caballo: acá empieza todo
  c.recibir(9);
  // un cuadro del bucle real es lo que dispara el acto
  const paso = (seg) => {
    for (let i = 0; i < seg * 60; i++) {
      if (j.jugador.monta && !j.jugador.monta.vivo) {
        if (acto.puedeArrancar(j.jugador.monta)) acto.arrancar(j.jugador.monta);
      }
      acto.actualizar((1 / 60) * acto.lento, teclas);
      for (const s of j.soldados) s.actualizar(1 / 60, j.jugador, j.soldados);
      for (const cb of j.caballos) { if (cb.actualizado) { cb.actualizado = false; continue; } cb.actualizar(1 / 60, { girar: 0 }); }
      j.jugador.actualizar(1 / 60, teclas, false, false);
    }
  };

  paso(0.2);
  ok('el acto arranca al caer el caballo', acto.activo);
  ok('quedás atrapado', j.jugador.atrapado > 0);
  ok('la cámara baja al pasto', j.jugador.pos.y < 0.8, `y=${j.jugador.pos.y.toFixed(2)}`);
  const caiste = { x: j.jugador.pos.x, z: j.jugador.pos.z };

  // EL FORCEJEO DE SAN MARTÍN NO ALCANZA, y eso no cambió: no te sacás medio
  // caballo de encima tirando de la pierna. Lo que cambió es lo que viene
  // después.
  teclas.add('Space');
  paso(1.6);
  ok('el forcejeo se topa y no libera', acto.forcejeo <= 0.83 && j.jugador.atrapado > 0,
    `barra ${acto.forcejeo.toFixed(2)}`);
  teclas.delete('Space');

  // ---- el cambio de cuerpo ----
  paso(2.4);
  ok('pasás a ser Cabral', acto.fase === 'cabral', `fase ${acto.fase}`);
  // A CABRAL LO PUEDEN MATAR. Tenía piso de vida en 60 «porque la historia dice
  // que llegó», y con eso no había forma de fallar: se podía terminar la
  // batalla entera sin haber salvado a San Martín.
  const vidaCabral = j.jugador.vida;
  j.jugador.recibir(45);
  const dolio = j.jugador.vida;
  paso(0.5);
  ok('y a Cabral se le baja la vida como a cualquiera',
    dolio < vidaCabral && j.jugador.vida <= dolio,
    `${vidaCabral} → ${dolio} → ${j.jugador.vida}`);
  j.jugador.vida = vidaCabral;
  ok('y te soltó', j.jugador.atrapado === 0);
  const sm = j.soldados.find(s => s.esSanMartin);
  ok('San Martín queda tirado en el campo', !!sm && sm.tirado > 0);
  // EL BICORNIO, y comprobado de verdad. La primera versión de esta línea
  // miraba que la figura tuviera hijos, que es cierto para cualquier soldado:
  // pasaba con el sombrero puesto y sin él. Se cuentan los vértices contra un
  // granadero normal —el bicornio y el morrión no arman la misma cabeza— así
  // que si alguien borra la rama del sombrero, esto se cae.
  const vertices = (x) => {
    let n = 0;
    x.malla.traverse(o => { if (o.geometry) n += o.geometry.attributes.position.count; });
    return n;
  };
  const comun = j.soltarSoldado('granadero');
  ok('y con el bicornio, que es lo que lo hace encontrable',
    !!sm && vertices(sm) !== vertices(comun),
    `${sm ? vertices(sm) : 0} vértices contra ${vertices(comun)} de un granadero`);
  comun.quitar(); j.soldados.splice(j.soldados.indexOf(comun), 1);
  const lejos = sm ? Math.hypot(sm.pos.x - j.jugador.pos.x, sm.pos.z - j.jugador.pos.z) : 0;
  ok('arrancás lejos de él, hay que ir', lejos > 8, `a ${lejos.toFixed(1)} m`);
  // TIRADO Y BAJO EL ANIMAL, que es lo que estaba mal: nacía donde había
  // quedado la CÁMARA y de pie, porque ni `tirado` ni `aturdido` acuestan a
  // nadie —lo único que tumba a un soldado es estar muerto—. El general
  // esperaba parado abajo de un caballo volcado.
  const alCaballo = sm ? Math.hypot(sm.pos.x - c.pos.x, sm.pos.z - c.pos.z) : 99;
  ok('queda pegado al caballo, no donde estaba la cámara', alCaballo < 1.1,
    `a ${alCaballo.toFixed(2)} m del animal`);
  ok('y en el sitio donde caíste', !!sm && Math.hypot(sm.pos.x - caiste.x, sm.pos.z - caiste.z) < 1.5);
  // El VALOR ABSOLUTO, no el signo: desde que cada figura se desploma para su
  // lado —el vuelco sale de la semilla, entre 0,95 y 1,70 rad— San Martín cae
  // a la izquierda o a la derecha según quién sea, y esta afirmación pedía que
  // fuera siempre para el mismo lado. Estaba tirado igual: daba -1,50 rad.
  ok('y TIRADO, no parado',
    !!sm && sm.tendido === true && Math.abs(sm.fig.raiz.rotation.z) > 0.9,
    sm ? `rotación ${sm.fig.raiz.rotation.z.toFixed(2)} rad` : '—');

  // EL CABALLO DE SAN MARTÍN ES EL CREMA. Es lo único que lo distingue de los
  // otros ciento diecinueve, que van vestidos igual.
  const tropero = j.soltarSoldado('granadero', { montado: true });
  ok('el caballo del jugador es el crema y el de la tropa no',
    c.crema === true && !!tropero.monta && tropero.monta.crema === false,
    `jugador=${c.crema} · tropa=${tropero.monta && tropero.monta.crema}`);
  tropero.quitar(); j.soldados.splice(j.soldados.indexOf(tropero), 1);

  // LO QUE HAY QUE MIRAR, MARCADO. Sin esto el acto es buscar a Wally entre
  // ciento veinte hombres vestidos igual, con humo y ocho segundos de reloj.
  ok('hay una vara de luz sobre él', !!acto.baliza &&
    Math.hypot(acto.baliza.position.x - (sm ? sm.pos.x : 0), acto.baliza.position.z - (sm ? sm.pos.z : 0)) < 0.2);
  ok('y se ve por encima de todo', !!acto.baliza && acto.baliza.userData.mat.depthTest === false);
  ok('el caballo tiene contorno', !!acto.contorno && acto.contorno.children.length > 0,
    acto.contorno ? `${acto.contorno.children.length} piezas` : '—');
  // y el contorno cuelga del hueso que se inclina al levantar: sube con él
  ok('y el contorno cuelga del caballo, así que sube con él',
    !!acto.contorno && acto.contorno.parent === c.raiz);

  ok('el corazón late aunque Cabral esté entero', acto.pulsoAlto === true);
  const rotLejos = acto.rotulo;
  ok('la barra dice dónde está', /SAN MART[IÍ]N · \d+ M/.test(rotLejos || ''), rotLejos);

  paso(2);
  ok('el español que lo iba a rematar aparece', j.soldados.some(s => s.esRealista));

  // ---- machacar el espacio ----
  // de lejos no se empuja nada, por mucho que la aprietes
  const machacar = (seg) => {
    for (let i = 0; i < seg * 60; i++) {
      if (i % 6 === 0) teclas.add('Space'); else teclas.delete('Space');
      paso(1 / 60);
    }
    teclas.delete('Space');
  };
  machacar(2);
  ok('de lejos no se levanta nada', acto.levante === 0, `barra ${acto.levante.toFixed(2)}`);
  ok('y de lejos la barra no sale, sólo los metros', !acto.puedeEmpujar && /\d+ M$/.test(acto.rotulo || ''),
    acto.rotulo);

  // CABRAL SALTA, que es lo que sabe hacer cualquiera de a pie. La primera
  // versión de esto le apagaba el salto durante TODO el acto para que el
  // espacio no lo hiciera brincar mientras empujaba, y de paso le sacaba once
  // metros de correr como una persona.
  let saltos = 0;
  const saltarOriginal = j.jugador.saltar.bind(j.jugador);
  j.jugador.saltar = () => { saltos++; return saltarOriginal(); };
  const espacio = () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' }));
  };
  j.jugador.aliento = 100;
  espacio(); paso(0.1);
  ok('corriendo hasta él, Cabral salta como cualquiera', saltos === 1, `${saltos} saltos`);
  paso(1.2);                      // que caiga antes de seguir

  // te acercás
  if (sm) j.jugador.pos.set(sm.pos.x + 1.2, j.jugador.pos.y, sm.pos.z);
  paso(0.2);
  ok('al lado sí se puede empujar', acto.puedeEmpujar);

  ok('y ahí la barra dice qué apretar', acto.rotulo === 'ESPACIO, MUCHAS VECES', acto.rotulo);

  // PERO AL LADO DEL CABALLO NO. Ahí el espacio es fuerza contra media
  // tonelada, y si además saltara, el sargento daría brincos arriba de un
  // hombre tirado en el pasto mientras lo levanta. Se prueba con teclas de
  // verdad, que es de donde salía el salto: `jugador.actualizar` no salta
  // solo, lo llamaba el mando.
  saltos = 0;
  j.jugador.aliento = 100;
  const altura0 = j.jugador.pos.y;
  for (let i = 0; i < 12; i++) { espacio(); paso(1 / 30); }
  ok('empujando el caballo, en cambio, no salta', saltos === 0, `${saltos} saltos`);
  ok('se queda en el lugar haciendo fuerza', Math.abs(j.jugador.pos.y - altura0) < 0.02,
    `y ${altura0.toFixed(2)} → ${j.jugador.pos.y.toFixed(2)}`);
  j.jugador.saltar = saltarOriginal;

  // una sola pulsación no alcanza: hay que machacar
  acto.levante = 0;
  teclas.add('Space'); paso(1 / 60); teclas.delete('Space'); paso(0.5);
  ok('un solo espacio no lo levanta', acto.levante < 0.5 && acto.fase === 'cabral',
    `barra ${acto.levante.toFixed(2)}`);

  // Y SOSTENER LA TECLA TAMPOCO, que es la regla de todo esto: no se levanta
  // medio caballo apoyándose, se levanta machacando. Sube DE GOLPE con cada
  // pulsación y baja sola, así que con la tecla hundida cuatro segundos la
  // barra queda donde la dejó el primer golpe y de ahí se cae.
  acto.levante = 0;
  teclas.add('Space');
  paso(4);
  teclas.delete('Space');
  ok('y tener la tecla apretada no levanta nada', acto.levante < 0.2 && acto.fase === 'cabral',
    `barra ${acto.levante.toFixed(2)} en 4 s`);

  // MACHACANDO RÁPIDO SÍ, y en poco: son unos segundos con un español encima,
  // así que lo que tiene que costar es la intensidad y no la duración.
  acto.levante = 0;
  let golpes = 0;
  for (let i = 0; i < 60 * 8 && acto.fase === 'cabral'; i++) {
    if (i % 6 === 0) { teclas.add('Space'); golpes++; } else teclas.delete('Space');
    paso(1 / 60);
  }
  teclas.delete('Space');
  ok('machacando rápido sale en unos pocos golpes', golpes > 6 && golpes < 22, `${golpes} espacios`);

  // Se machaca HASTA QUE SALE y ni un cuadro más: lo que viene después hay que
  // mirarlo en el instante en que la barra se llena.
  let golpe = 0;
  while (acto.fase === 'cabral' && golpe < 60 * 8) {
    if (golpe % 6 === 0) teclas.add('Space'); else teclas.delete('Space');
    paso(1 / 60); golpe++;
  }
  teclas.delete('Space');
  ok('machacando sí sale', acto.fase === 'cine', `fase ${acto.fase} · barra ${acto.levante.toFixed(2)}`);
  // LA BARRA LLENA SE TIENE QUE PODER VER. Se dibuja mientras dura la fase
  // 'cabral' y la fase cambia en el MISMO cuadro en que se completa: el que
  // machacaba el espacio la veía desaparecer sin haberla visto nunca llena.
  ok('y la barra llena queda un momento a la vista',
    acto.mostrandoBarra && acto.forcejeo >= 0.99,
    `fase ${acto.fase} · barra ${acto.forcejeo.toFixed(2)}`);
  ok('el caballo quedó levantado', c.raiz.position.y > 0.1, `y=${c.raiz.position.y.toFixed(2)}`);
  ok('y el que lo iba a rematar cayó', acto.verdugo && !acto.verdugo.vivo);
  // y se le devuelve al reloj lo que el machaque no gastó: antes esto eran seis
  // segundos fijos y lo que viene después está escrito contra ese reloj
  paso(Math.max(0, 6 - golpe / 60));


  // ---- la cinemática ----
  ok('va en cámara lenta', acto.lento < 1, `x${acto.lento}`);
  paso(2);
  ok('el segundo español le entra con la bayoneta', !!acto.segundo);
  ok('la cámara se cae y mira al cielo',
    j.jugador.atrapado > 0 && j.jugador.pitchAtrapado > 0.4,
    `pitch ${j.jugador.pitchAtrapado.toFixed(2)}`);

  ok('levantado el caballo, se apagan las marcas', !acto.baliza && !acto.contorno);
  // Y LA BARRA TAMPOCO SE QUEDA PEGADA. Ojo con el reloj: la cinemática va en
  // cámara lenta y `paso` multiplica por acto.lento, así que estos dos segundos
  // de reloj son bastante menos de acto. De sobra igual para medio segundo.
  ok('y la barra llena tampoco se queda pegada', !acto.mostrandoBarra);

  // A CABRAL SE LO MATA COMO A CUALQUIERA Y SE TIENE QUE VER IGUAL: la vista
  // que se nubla y se cierra, el sonido que se va con ella. Antes era un corte
  // a negro y se leía como el final de una escena, no como un hombre muriendo.
  paso(6);
  const lienzo = document.getElementById('lienzo');
  ok('a Cabral se le cierran los ojos, como a San Martín',
    lienzo.classList.contains('ojos'), lienzo.className);
  ok('y el sonido se va con ellos', j.sonido.muriendo === true);
  // pero SIN los botones: el que se muere es él y la partida sigue
  ok('y sin botones, porque no hay nada que elegir',
    document.getElementById('caido').classList.contains('oculto'));

  paso(12);
  ok('el acto termina', !acto.activo);
  ok('y al volver a ser vos, los ojos se abren',
    !lienzo.classList.contains('ojos') && j.sonido.muriendo === false);
  ok('y el tiempo vuelve a correr normal', acto.lento === 1);
  ok('volvés a ser San Martín, en su lugar',
    Math.hypot(j.jugador.pos.x - caiste.x, j.jugador.pos.z - caiste.z) < 1.5,
    `a ${Math.hypot(j.jugador.pos.x - caiste.x, j.jugador.pos.z - caiste.z).toFixed(1)} m`);
  ok('y el San Martín del suelo ya no está', !j.soldados.some(s => s.esSanMartin));
  ok('no se repite', !acto.puedeArrancar(c));

  // ---- EL RELOJ DEL 3 DE FEBRERO ----
  //
  // Al minuto del clarín pasa, te maten el caballo o no. Antes el acto dependía
  // de cómo te estuviera yendo: jugando bien no lo veías nunca.
  acto.hecho = false; acto.corriendo = false; acto.tClarin = 0;
  acto.enBatalla = true;
  const c2 = j.caballos.find(x => x.vivo && !x.montado) || j.caballo;
  c2.vivo = true; c2.vida = 18; c2.caida = 0; c2.pos.set(0, 0, -30);
  j.jugador.liberar(); j.jugador.vida = 100; j.jugador.montar(c2);

  acto.contar(30, false, c2);
  ok('sin clarín el reloj no corre', acto.tClarin === 0);
  acto.contar(30, true, c2);
  ok('con el clarín corre', acto.tClarin === 30);
  ok('y a los 30 s todavía no pasa nada', !acto.activo);

  // a pie no puede pasar: sin caballo encima no hay pierna aprisionada
  const guarda = j.jugador.monta;
  j.jugador.monta = null;
  acto.contar(40, true, null);
  ok('a pie espera, no salta solo', !acto.activo && acto.tClarin > 60);
  j.jugador.monta = guarda;

  acto.contar(0, true, c2);
  ok('y salta apenas volvés a montar', acto.activo);
  ok('con el caballo muerto encima, como fue', !c2.vivo);

  // y en el campo de práctica no corre
  acto.hecho = false; acto.corriendo = false; acto.tClarin = 0;
  acto.enBatalla = false;
  acto.contar(90, true, c2);
  ok('en el campo de práctica no pasa', acto.tClarin === 0 && !acto.activo);

  // =========================================================================
  // EL ACTO DE LA VICTORIA
  // =========================================================================
  //
  // El otro acto de este archivo: el que cierra la batalla. Va acá y no en uno
  // nuevo porque es la misma clase de cosa —un acto con fases, con su
  // disparador, que toma el HUD y lo devuelve— y porque prueba el mismo
  // archivo.
  //
  // Se pelea una batalla CHICA a propósito: lo que se prueba es el cierre, no
  // el balance, y treinta contra veinte se resuelve en dos minutos de reloj
  // simulado en vez de cuatro.
  const T = j.jugador.pos.constructor;
  const v = j.victoria;
  j.campo.limpiarCampo(); j.jugador.revivir(); j.jugador.pos.set(0, 1.68, 0);
  j.formarPinza(30, 20); j.pinza.tocar();
  ok('antes de pelear no hay victoria que cantar', v.fase === null);

  let t = 0;
  for (let i = 0; i < 60 * 300 && !v.activo; i++) { j.simular(1 / 60); t += 1 / 60; }
  ok('se dispara sola cuando no queda un realista peleando', v.activo,
    `a los ${t.toFixed(0)} s · fase=${v.fase}`);
  ok('y planta la flecha sobre el portón del convento',
    !!v.marca && Math.abs(v.marca.position.x) < 1 && Math.abs(v.marca.position.z - 16) < 5,
    v.marca ? `x=${v.marca.position.x.toFixed(0)} z=${v.marca.position.z.toFixed(0)}` : 'no hay flecha');

  const montados = () => j.soldados.filter(s => !s.esRealista && s.vivo && s.montado);
  const conPlaza = montados().filter(s => s.plaza).length;
  ok('y le da destino a TODOS los granaderos montados', conPlaza === montados().length && conPlaza > 0,
    `${conPlaza} de ${montados().length}`);

  // Y QUE DE VERDAD CAMINEN. Escribirles la plaza y que no se muevan sería lo
  // mismo que no hacer nada: la Pinza se apaga en el mismo acto y si el
  // destino no se leyera, el escuadrón se quedaría donde estaba.
  const alPorton = () => {
    const m = montados();
    return m.length ? m.reduce((a, s) => a + Math.hypot(s.pos.x, s.pos.z - 16), 0) / m.length : 0;
  };
  const antes = alPorton();
  for (let i = 0; i < 60 * 25; i++) j.simular(1 / 60);
  ok('y marchan hacia ahí', alPorton() < antes - 5,
    `de ${antes.toFixed(0)} m a ${alPorton().toFixed(0)} m`);
  ok('pero no se canta victoria por llegar ELLOS', v.fase === 'llamando', `fase=${v.fase}`);

  // EL JUGADOR LLEGA. Se le mueve también el caballo: montado, la posición del
  // hombre la manda el animal y mover sólo al jugador no lo lleva a ningún
  // lado —cosa que costó un rato entender—.
  j.jugador.revivir();
  j.jugador.pos.set(0, 1.68, 13);
  if (j.jugador.monta) j.jugador.monta.pos.set(0, 0, 13);
  for (let i = 0; i < 30; i++) j.simular(1 / 60);
  ok('y cuando llega el jugador, ahí sí', v.fase === 'llegado', `fase=${v.fase}`);
  ok('y la flecha se levanta', !v.marca);

  // LA PLACA DE CIERRE. No sale en el mismo instante que el «¡VICTORIA!»: se
  // deja terminar el renglón que cuenta lo que quedó en la barranca.
  const pla = document.getElementById('placa');
  ok('al llegar todavía no hay placa de cierre', !pla.classList.contains('si'));
  for (let i = 0; i < 30; i++) v.actualizar(0.1);
  ok('a los tres segundos sigue sin salir', !pla.classList.contains('si'));
  for (let i = 0; i < 20; i++) v.actualizar(0.1);
  const cierre = ['.t', '.s', '.c'].map(q => pla.querySelector(q).textContent).join(' · ');
  ok('y a los cuatro y pico entra', pla.classList.contains('si'));
  ok('diciendo misión cumplida, los quince minutos y para qué sirvió',
    /MISIÓN CUMPLIDA/.test(cierre) && /15 minutos/.test(cierre) &&
    /Paraná/.test(cierre) && /Granaderos a Caballo/.test(cierre), cierre.slice(0, 44) + '…');

  j.formarPinza(4, 4);
  ok('y al rearmar el campo la placa se va', !pla.classList.contains('si'));
  ok('al rearmar el campo vuelve a estar por ganarse', v.fase === null, `fase=${v.fase}`);

  // ------------------------------------------------------------------------
  // LA APERTURA DE LA MISIÓN
  // ------------------------------------------------------------------------
  // Se la maneja con su propio reloj adelantado a mano —`adelantar`— porque es
  // el de pared: esperar diecisiete segundos y medio de verdad para ver si el
  // cartel sale al final no es una prueba, es una siesta.
  const ap = j.apertura, H = j.hud;
  const placa = pla;
  const elHud = document.getElementById('hud');
  const negro = () => +getComputedStyle(document.getElementById('fundido')).opacity;
  const quien = () => { const b = document.querySelector('#frase b'); return b ? b.textContent : ''; };
  const dicho = () => document.getElementById('frase').classList.contains('si')
    ? document.getElementById('frase').textContent : '';
  const cartel = () => document.getElementById('cartel').classList.contains('si')
    ? document.getElementById('cartel').textContent : '';

  // EL NEGRO INSTANTÁNEO. Es de lo que depende que la placa se lea sobre negro
  // y no sobre el campo, y estuvo roto: `fundir` hacía `segundos || 0.9`, así
  // que pedirle cero le daba casi un segundo de fundido.
  H.fundir(1, 0);
  ok('el negro en cero segundos es negro de una', negro() > 0.99, `opacidad ${negro()}`);
  H.fundir(0, 0);

  ap.arrancar();
  ok('la apertura pone la placa', placa.classList.contains('si'));
  const pl = ['.t', '.s', '.c'].map(q => placa.querySelector(q).textContent).join(' · ');
  ok('y dice dónde, cuándo y qué unidad',
    /San Lorenzo/.test(pl) && /1813/.test(pl) && /05:15/.test(pl) && /Granaderos a Caballo/.test(pl),
    pl.slice(0, 44) + '…');
  ok('y calla el HUD: una cinemática no lleva cartuchos', elHud.classList.contains('callado'));
  ok('el reloj todavía no largó: el primer cuadro es el que tarda', ap.t0 === 0);

  ap.adelantar(1.0);
  ok('al segundo la placa sigue y no habla nadie', placa.classList.contains('si') && !quien());

  ap.adelantar(3.0);
  ok('abierto el negro, la placa se baja sola', !placa.classList.contains('si'));
  ok('y habla el granadero, con su nombre', quien() === 'Granadero', quien());
  ok('y trae el parte: cuántos y las dos piezas',
    /doscientos cincuenta/.test(dicho()) && /cañones/.test(dicho()));

  ap.adelantar(6.0);
  ok('después habla San Martín', quien() === 'San Martín', quien());
  ok('y parte la fuerza en dos columnas nombrando a Bermúdez',
    /dos columnas/.test(dicho()) && /Bermúdez/.test(dicho()));

  ap.adelantar(9.0);
  ok('a los diecisiete y medio se termina', !ap.activo, `t=${ap.t.toFixed(1)}`);
  ok('y vuelve el HUD', !elHud.classList.contains('callado'));
  ok('con el cartel del clarín puesto', /CLARÍN/.test(cartel()), cartel());

  // EL CARTEL NO PUEDE CRECER HASTA LOS BORDES.
  //
  // Es la tipografía del viejo «¡AHORA!» del minijuego de recarga y se queda
  // igual —el bronce, el peso, el interletrado—, pero aquello eran SIETE letras
  // y ocupaba el 25% del ancho: una estampilla en el medio de la pelea. Los
  // carteles de ahora tienen entre dieciséis y veinte, y al mismo cuerpo se
  // iban al 67% —al 94% en una ventana de 820— y dejaban de ser un grito para
  // ser un titular de diario. Lo que se prueba es la PROPORCIÓN, que es lo que
  // se ve, y no el cuerpo en píxeles, que depende de la ventana.
  const anchoCartel = (txt) => {
    const e = document.getElementById('cartel');
    const antes = e.textContent;
    e.textContent = txt; e.classList.add('si');
    const w = e.getBoundingClientRect().width / window.innerWidth;
    e.textContent = antes;
    return w;
  };
  const largos = ['[T] TOCÁ EL CLARÍN', '[E] ROBÁ LA BANDERA', '¡SALVÁ A SAN MARTÍN!'];
  const anchos = largos.map(anchoCartel);
  ok('y sin comerse la pantalla de borde a borde', Math.max(...anchos) < 0.5,
    anchos.map((w, i) => `${Math.round(w * 100)}%`).join(' · ') + ' del ancho');
  const est = getComputedStyle(document.getElementById('cartel'));
  // el interletrado se pregunta como PROPORCIÓN del cuerpo: el navegador ya lo
  // resolvió a píxeles y 0,1em son 2,97px o 4,2px según la ventana
  const suelto = parseFloat(est.letterSpacing) / parseFloat(est.fontSize);
  ok('con la misma tipografía que tenía el ¡AHORA!',
    est.fontWeight === '600' && Math.abs(suelto - 0.1) < 0.005 &&
    est.color === 'rgb(198, 155, 84)',
    `peso ${est.fontWeight} · suelto ${suelto.toFixed(3)}em · ${est.color}`);
  ok('y sin subtítulo abajo pisándolo', !dicho());

  // LA T CORTA LA INTRODUCCIÓN Y NO TOCA EL CLARÍN. Son dos apretones y a
  // propósito: que un apurado dispare la carga sin haberla pedido es
  // exactamente lo que no puede pasar.
  j.formarPinza(6, 6);
  j.jugador.liberar();
  ap.arrancar();
  ap.adelantar(1.0);
  const teclaT = () => document.dispatchEvent(
    new KeyboardEvent('keydown', { code: 'KeyT', bubbles: true }));
  teclaT();
  ok('la T baja la introducción', !ap.activo);
  ok('y se lleva la placa con ella', !placa.classList.contains('si'));
  ok('y devuelve el HUD', !elHud.classList.contains('callado'));
  ok('pero NO toca el clarín', j.pinza.tocado === false, `tocado=${j.pinza.tocado}`);
  teclaT();
  ok('la segunda T sí lo toca', j.pinza.tocado === true, `tocado=${j.pinza.tocado}`);

  return out;
});
for (const [e, n, x] of r) console.log(e.padEnd(4), n.padEnd(52), x);
const mal = r.filter(x => x[0] === 'MAL').length;
console.log(`\n${r.filter(x => x[0] === 'OK ').length} bien, ${mal} mal`);
console.log(errs.length ? 'ERRORES: ' + errs.join(' / ') : 'sin errores de consola');
await nav.close();
