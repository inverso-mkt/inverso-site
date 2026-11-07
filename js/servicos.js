/* Serviços: linha do tempo vertical. Um passo aberto por vez; a linha se enche até o passo ativo. */
(() => {
  const tl = document.getElementById('tl');
  if (!tl) return;

  const steps = [...tl.querySelectorAll('.step')];
  const panels = steps.map((s) => document.getElementById(s.getAttribute('aria-controls')));
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const desktop = matchMedia('(min-width: 64rem)');
  let cur = 0;

  // Mede a posição das bolinhas e ajusta a linha (funciona igual no desktop e no acordeão do celular)
  function measure() {
    const top = tl.getBoundingClientRect().top;
    const center = (i) => {
      const r = steps[i].querySelector('.step__dot').getBoundingClientRect();
      return r.top - top + r.height / 2;
    };
    const a = center(0);
    const b = center(steps.length - 1);
    tl.style.setProperty('--t', a + 'px');
    tl.style.setProperty('--len', b - a + 'px');
    tl.style.setProperty('--fill', center(cur) - a + 'px');
  }

  function select(i, opts = {}) {
    cur = i;
    steps.forEach((s, k) => {
      s.setAttribute('aria-expanded', String(k === i));
      s.classList.toggle('is-past', k < i);
      panels[k].classList.toggle('is-open', k === i);
    });
    measure();
    if (opts.focus) steps[i].focus({ preventScroll: true });
    // No celular o painel abre embaixo do passo: leva o passo para o topo da tela
    if (opts.scroll && !desktop.matches) {
      steps[i].scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    } else if (opts.scroll) {
      const r = tl.getBoundingClientRect();
      if (r.top < 0 || r.top > innerHeight * 0.4) {
        tl.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
      }
    }
    requestAnimationFrame(measure);
  }

  steps.forEach((s, i) => {
    s.style.setProperty('--k', i);
    s.addEventListener('click', () => select(i, { scroll: !desktop.matches }));
    s.addEventListener('keydown', (e) => {
      const keys = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };
      let n = null;
      if (e.key in keys) n = Math.min(steps.length - 1, Math.max(0, i + keys[e.key]));
      else if (e.key === 'Home') n = 0;
      else if (e.key === 'End') n = steps.length - 1;
      if (n === null) return;
      e.preventDefault();
      select(n, { focus: true });
    });
  });
  tl.querySelectorAll('.tl__label').forEach((l, k) => l.style.setProperty('--k', k * 4));

  panels.forEach((p, i) => {
    p.querySelector('[data-next]')?.addEventListener('click', () => {
      const n = (i + 1) % steps.length;
      select(n, { focus: true, scroll: true });
    });
    // Brilho do vidro que acompanha o mouse
    if (fine && !reduce) {
      p.addEventListener('pointermove', (e) => {
        const r = p.getBoundingClientRect();
        p.style.setProperty('--mx', e.clientX - r.left + 'px');
        p.style.setProperty('--my', e.clientY - r.top + 'px');
      });
    }
    // Inclinação leve da cena, em 3D
    const scene = p.querySelector('.scene');
    const tilt = scene && scene.querySelector('.scene__tilt');
    if (tilt && fine && !reduce) {
      scene.addEventListener('pointermove', (e) => {
        const r = scene.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        tilt.style.setProperty('--rx', (-y * 8).toFixed(2) + 'deg');
        tilt.style.setProperty('--ry', (x * 10).toFixed(2) + 'deg');
      });
      scene.addEventListener('pointerleave', () => {
        tilt.style.setProperty('--rx', '0deg');
        tilt.style.setProperty('--ry', '0deg');
      });
    }
  });

  // A linha entra quando a seção aparece
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((es) => {
      if (es.some((e) => e.isIntersecting)) {
        tl.classList.add('in');
        io.disconnect();
        requestAnimationFrame(measure);
      }
    }, { threshold: 0.12 });
    io.observe(tl);
  } else {
    tl.classList.add('in');
  }

  addEventListener('resize', measure);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
  select(0);
})();
