(() => {
  const section = document.getElementById('servicos');
  if (!section) return;

  const tabs = Array.from(section.querySelectorAll('[role="tab"]'));
  const panels = tabs.map((t) => document.getElementById(t.getAttribute('aria-controls')));
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const flow = section.querySelector('.flow');

  /* A linha do fluxo se desenha uma vez, quando a seção aparece */
  if ('IntersectionObserver' in window && !reduce) {
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { flow.classList.add('in'); io.disconnect(); }
    }, { threshold: .25 });
    io.observe(flow);
  } else {
    flow.classList.add('in');
  }

  /* Abre o painel a partir do ponto clicado */
  const reveal = (panel, originX, originY) => {
    if (reduce) return;
    const r = panel.getBoundingClientRect();
    const x = originX - r.left, y = originY - r.top;
    const R = Math.hypot(Math.max(x, r.width - x), Math.max(Math.abs(y), r.height - y)) + 4;
    panel.style.transition = 'none';
    panel.style.clipPath = `circle(0px at ${x}px ${y}px)`;
    panel.getBoundingClientRect(); // força o navegador a registrar o estado inicial
    panel.style.transition = 'clip-path .75s cubic-bezier(.7, 0, .2, 1)';
    panel.style.clipPath = `circle(${R}px at ${x}px ${y}px)`;
    const done = () => { panel.style.clipPath = ''; panel.style.transition = ''; };
    panel.addEventListener('transitionend', done, { once: true });
  };

  const select = (index, from, focus) => {
    tabs.forEach((t, i) => {
      const on = i === index;
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.tabIndex = on ? 0 : -1;
      panels[i].hidden = !on;
    });
    if (focus) tabs[index].focus();
    const t = tabs[index].getBoundingClientRect();
    const ox = from ? from.x : t.left + t.width / 2;
    const oy = from ? from.y : t.bottom;
    reveal(panels[index], ox, oy);
  };

  tabs.forEach((tab, i) => {
    tab.addEventListener('click', (e) => {
      const keyboard = e.detail === 0;
      select(i, keyboard ? null : { x: e.clientX, y: e.clientY }, false);
    });
    tab.addEventListener('keydown', (e) => {
      const last = tabs.length - 1;
      let next = null;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = i === last ? 0 : i + 1;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = i === 0 ? last : i - 1;
      if (e.key === 'Home') next = 0;
      if (e.key === 'End') next = last;
      if (next !== null) { e.preventDefault(); select(next, null, true); }
    });
  });

  /* Com JavaScript: um painel por vez. Sem JavaScript, todos ficam visíveis. */
  panels.forEach((p, i) => { p.hidden = i !== 0; });
})();
