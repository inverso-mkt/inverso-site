(() => {
  const root = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const stage = document.getElementById('stage');
  if (!stage) return;

  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const ease = (t) => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  /* ---------- Íris: a página branca se abre a partir do "o" da marca ---------- */

  if (!reduce) {
    const pin = stage.querySelector('.pin');
    const iris = stage.querySelector('.iris');
    const text = stage.querySelector('.iris__text');
    const o = stage.querySelector('.o-anchor');
    let ox = 0, oy = 0, maxR = 0, ticking = false;

    const measure = () => {
      const p = pin.getBoundingClientRect();
      const r = o.getBoundingClientRect();
      ox = r.left + r.width / 2 - p.left;
      oy = r.top + r.height / 2 - p.top;
      const w = p.width, h = p.height;
      maxR = Math.hypot(Math.max(ox, w - ox), Math.max(oy, h - oy));
    };

    const draw = () => {
      ticking = false;
      const rect = stage.getBoundingClientRect();
      const total = rect.height - innerHeight;
      const p = clamp(-rect.top / total);
      const radius = ease(clamp(p / .72)) * maxR * 1.02;
      iris.style.clipPath = `circle(${radius.toFixed(1)}px at ${ox.toFixed(1)}px ${oy.toFixed(1)}px)`;
      text.style.opacity = clamp((p - .3) / .35).toFixed(3);
    };

    const request = () => { if (!ticking) { ticking = true; requestAnimationFrame(draw); } };

    root.classList.add('is-live');
    measure();
    draw();
    addEventListener('scroll', request, { passive: true });
    addEventListener('resize', () => { measure(); request(); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { measure(); request(); });
    addEventListener('load', () => { measure(); request(); });
  }

  /* ---------- Lente: segue o mouse e inverte as cores embaixo dela ---------- */

  const lens = document.querySelector('.lens');
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;

  if (lens && fine && !reduce) {
    let tx = -200, ty = -200, x = tx, y = ty, s = 1, ts = 1, running = false;

    const step = () => {
      x += (tx - x) * .18;
      y += (ty - y) * .18;
      s += (ts - s) * .16;
      lens.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) scale(${s.toFixed(3)})`;
      const moving = Math.abs(tx - x) > .3 || Math.abs(ty - y) > .3 || Math.abs(ts - s) > .005;
      if (moving) requestAnimationFrame(step); else running = false;
    };
    const wake = () => { if (!running) { running = true; requestAnimationFrame(step); } };

    addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      if (!lens.classList.contains('on')) { x = tx = e.clientX; y = ty = e.clientY; lens.classList.add('on'); }
      tx = e.clientX; ty = e.clientY;
      wake();
    }, { passive: true });

    document.addEventListener('pointerover', (e) => {
      ts = e.target.closest && e.target.closest('a, button') ? .35 : 1;
      wake();
    });

    document.documentElement.addEventListener('mouseleave', () => lens.classList.remove('on'));
    document.documentElement.addEventListener('mouseenter', () => lens.classList.add('on'));
  }
})();
