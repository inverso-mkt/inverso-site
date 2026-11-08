/* Seção Equipe: carrossel infinito de crachás (arrastar, deslizar, setas, teclado),
   relógio da parede e inclinação suave da sala com o mouse. */
(function () {
  var room = document.querySelector('[data-eq]');
  if (!room) return;
  var sec = room.closest('.eq');
  var stage = room.querySelector('.eq__stage');
  var row = room.querySelector('.eq__row');
  var items = [].slice.call(row.children);
  var N = items.length / 3;                       // pessoas de verdade (o resto é cópia pro loop)
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hover = matchMedia('(hover: hover)').matches;
  var mqM = matchMedia('(max-width: 45.99rem)');
  var mqT = matchMedia('(max-width: 63.99rem)');
  var dots = [].slice.call(sec.querySelectorAll('.eq__dot'));

  var W = 0, S = 0, O = 0, vis = 4;               // largura da sala, largura de cada casa, deslocamento, quantos aparecem
  var pos = N;                                    // posição em "casas": N = fila do meio, alinhada
  var anim = 0, interacted = false;

  function mod(a, n) { return ((a % n) + n) % n; }

  // todos os crachás ficam da altura do verso mais comprido (nada de texto cortado)
  var cards = [].slice.call(row.querySelectorAll('.crc__card'));
  function equalize() {
    cards.forEach(function (c) { c.style.minHeight = ''; });
    var h = 0;
    cards.forEach(function (c) { h = Math.max(h, c.offsetHeight); });
    if (h) cards.forEach(function (c) { c.style.minHeight = h + 'px'; });
  }

  function layout() {
    W = room.clientWidth;
    equalize();
    if (mqM.matches) { vis = 1; S = W * 0.77; O = (W - S) / 2; }
    else { vis = mqT.matches ? 2 : 4; S = W / vis; O = 0; }
    room.style.setProperty('--S', S + 'px');
    draw();
  }

  function draw() {
    while (pos >= 2 * N) pos -= N;
    while (pos < N) pos += N;
    row.style.transform = 'translate3d(' + (O - pos * S).toFixed(2) + 'px,0,0)';
    var cur = mod(Math.round(pos), N);
    dots.forEach(function (d, i) { d.classList.toggle('is-cur', i === cur); });
  }

  function ease(t) { return 1 - Math.pow(1 - t, 3); }

  function glide(to, ms) {
    cancelAnimationFrame(anim);
    if (reduce) { pos = to; draw(); return; }
    var from = pos, t0 = performance.now(), d = ms || (450 + 260 * Math.min(Math.abs(to - from), 3));
    (function step(now) {
      var t = Math.min(1, (now - t0) / d);
      pos = from + (to - from) * ease(t);
      draw();
      if (t < 1) anim = requestAnimationFrame(step);
    })(t0);
  }

  function go(dir) { interacted = true; glide(Math.round(pos) + dir); }

  // ---- arrastar (mouse, toque e caneta)
  var down = false, moved = false, startX = 0, startPos = 0, lastX = 0, lastT = 0, vel = 0, pid = null;
  room.addEventListener('pointerdown', function (e) {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    interacted = true; cancelAnimationFrame(anim);
    down = true; moved = false; startX = lastX = e.clientX; startPos = pos; lastT = performance.now(); vel = 0; pid = e.pointerId;
  });
  room.addEventListener('pointermove', function (e) {
    if (!down || e.pointerId !== pid) return;
    var dx = e.clientX - startX;
    if (!moved && Math.abs(dx) > 6) {
      moved = true; room.classList.add('is-drag');
      try { room.setPointerCapture(pid); } catch (_) {}
    }
    if (!moved) return;
    var now = performance.now(), dt = Math.max(1, now - lastT);
    vel = 0.8 * vel + 0.2 * (-(e.clientX - lastX) / S / dt);   // casas por ms
    lastX = e.clientX; lastT = now;
    pos = startPos - dx / S; draw();
  });
  function up(e) {
    if (!down || (e && e.pointerId !== pid)) return;
    down = false;
    if (moved) {
      room.classList.remove('is-drag');
      var to = Math.round(pos + Math.max(-1.5, Math.min(1.5, vel * 260)));
      glide(to);
      try { room.releasePointerCapture(pid); } catch (_) {}
    }
  }
  room.addEventListener('pointerup', up);
  room.addEventListener('pointercancel', up);
  // um arrasto não pode virar clique (virar o crachá sem querer)
  row.addEventListener('click', function (e) { if (moved) { e.stopPropagation(); e.preventDefault(); moved = false; } }, true);
  row.addEventListener('dragstart', function (e) { e.preventDefault(); });

  // ---- trackpad / roda horizontal
  var wheelT = 0;
  room.addEventListener('wheel', function (e) {
    if (Math.abs(e.deltaX) <= Math.abs(e.deltaY) || !e.deltaX) return;
    e.preventDefault(); interacted = true; cancelAnimationFrame(anim);
    pos += e.deltaX / S; draw();
    clearTimeout(wheelT); wheelT = setTimeout(function () { glide(Math.round(pos)); }, 140);
  }, { passive: false });

  // ---- setas, bolinhas e teclado
  [].forEach.call(sec.querySelectorAll('.eq__btn'), function (b) {
    b.addEventListener('click', function () { go(Number(b.getAttribute('data-dir'))); });
  });
  dots.forEach(function (d) {
    d.addEventListener('click', function () {
      interacted = true;
      var want = Number(d.getAttribute('data-go')), cur = mod(Math.round(pos), N), delta = mod(want - cur, N);
      if (delta > N / 2) delta -= N;
      glide(Math.round(pos) + delta);
    });
  });
  room.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
  });
  // foco por Tab num crachá fora da vista: traz ele pra dentro
  room.addEventListener('focusin', function (e) {
    var li = e.target.closest && e.target.closest('.crc');
    if (!li) return;
    var idx = items.indexOf(li), rel = idx - pos;
    if (rel < -0.01 || rel > vis - 1 + 0.01) glide(vis === 1 ? idx : Math.round(rel < 0 ? idx : idx - (vis - 1)), 500);
  });

  // ---- toque: um crachá aberto por vez
  function closeAll() { items.forEach(function (c) { c.classList.remove('is-on'); }); }
  if (!hover) {
    items.forEach(function (c) {
      c.addEventListener('click', function (e) {
        var on = c.classList.contains('is-on');
        closeAll();
        if (!on) c.classList.add('is-on');
        e.stopPropagation();
      });
    });
    document.addEventListener('click', closeAll);
    row.addEventListener('pointerdown', closeAll);
  }
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { closeAll(); if (document.activeElement && room.contains(document.activeElement)) document.activeElement.blur(); }
  });

  // ---- relógio com a hora do visitante
  var h = room.querySelector('.eq__h'), m = room.querySelector('.eq__m');
  function tick() {
    var d = new Date(), mi = d.getMinutes(), hr = d.getHours() % 12;
    if (h) h.style.transform = 'rotate(' + ((hr + mi / 60) * 30) + 'deg)';
    if (m) m.style.transform = 'rotate(' + (mi * 6) + 'deg)';
  }
  tick(); setInterval(tick, 30000);

  // ---- a sala acompanha o mouse de leve
  if (hover && !reduce && stage) {
    var raf = 0, nx = 0, ny = 0;
    var applyTilt = function () {
      raf = 0;
      stage.style.setProperty('--ry', (nx * 5).toFixed(2) + 'deg');
      stage.style.setProperty('--rx', (-ny * 3).toFixed(2) + 'deg');
    };
    room.addEventListener('pointermove', function (e) {
      if (e.pointerType !== 'mouse' || down) return;
      var r = room.getBoundingClientRect();
      nx = (e.clientX - r.left) / r.width - .5; ny = (e.clientY - r.top) / r.height - .5;
      if (!raf) raf = requestAnimationFrame(applyTilt);
    });
    room.addEventListener('pointerleave', function () { nx = ny = 0; if (!raf) raf = requestAnimationFrame(applyTilt); });
  }

  // ---- entrada: os crachás descem; uma "empurradinha" mostra que dá pra arrastar
  function enter() {
    sec.classList.add('is-in');
    if (reduce) return;
    setTimeout(function () {
      if (interacted) return;
      glide(N + 0.3, 700);
      setTimeout(function () { if (!interacted) glide(N, 900); }, 900);
    }, 1100);
  }
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { enter(); io.disconnect(); } });
    }, { threshold: .3 });
    io.observe(room);
  } else sec.classList.add('is-in');

  layout();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(layout);
  window.addEventListener('resize', layout);
  if (window.ResizeObserver) new ResizeObserver(layout).observe(room);
})();
