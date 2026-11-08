/* Seção Equipe: relógio da parede, inclinação suave da sala com o mouse e toque nos crachás. */
(function () {
  var room = document.querySelector('[data-eq]');
  if (!room) return;
  var sec = room.closest('.eq');
  var stage = room.querySelector('.eq__stage');
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hover = matchMedia('(hover: hover)').matches;
  var cards = [].slice.call(room.querySelectorAll('.crc'));

  // relógio com a hora do visitante
  var h = room.querySelector('.eq__h'), m = room.querySelector('.eq__m');
  function tick() {
    var d = new Date(), mi = d.getMinutes(), hr = d.getHours() % 12;
    if (h) h.style.transform = 'rotate(' + ((hr + mi / 60) * 30) + 'deg)';
    if (m) m.style.transform = 'rotate(' + (mi * 6) + 'deg)';
  }
  tick(); setInterval(tick, 30000);

  // entrada: os crachás "descem" quando a seção aparece
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { sec.classList.add('is-in'); io.disconnect(); } });
    }, { threshold: .25 });
    io.observe(room);
  } else sec.classList.add('is-in');

  // a sala acompanha o mouse de leve (só com mouse e sem "reduzir movimento")
  if (hover && !reduce && stage) {
    var raf = 0, nx = 0, ny = 0;
    function apply() {
      raf = 0;
      stage.style.setProperty('--ry', (nx * 6).toFixed(2) + 'deg');
      stage.style.setProperty('--rx', (-ny * 3.5).toFixed(2) + 'deg');
    }
    room.addEventListener('pointermove', function (e) {
      if (e.pointerType !== 'mouse') return;
      var r = room.getBoundingClientRect();
      nx = (e.clientX - r.left) / r.width - .5;
      ny = (e.clientY - r.top) / r.height - .5;
      if (!raf) raf = requestAnimationFrame(apply);
    });
    room.addEventListener('pointerleave', function () { nx = ny = 0; if (!raf) raf = requestAnimationFrame(apply); });
  }

  // toque: um crachá aberto por vez; toque fora fecha
  function closeAll() { cards.forEach(function (c) { c.classList.remove('is-on'); }); }
  if (!hover) {
    cards.forEach(function (c) {
      c.addEventListener('click', function (e) {
        var on = c.classList.contains('is-on');
        closeAll();
        if (!on) c.classList.add('is-on');
        e.stopPropagation();
      });
    });
    document.addEventListener('click', closeAll);
  }
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { closeAll(); if (document.activeElement && room.contains(document.activeElement)) document.activeElement.blur(); }
  });
})();
