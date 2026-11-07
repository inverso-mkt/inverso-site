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
    if (typeof syncAll === 'function') requestAnimationFrame(syncAll);
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


  /* ---------- Motor das cenas: passos, cursor guia, repetição ---------- */
  const reduceMotion = reduce;
  const pauseBtn = document.getElementById('svc-pause');
  const eng = { paused: reduceMotion, tab: !document.hidden };
  const svcRoot = document.getElementById('servicos');
  const controllers = [];
  const CUR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 2.5l.2 17.6 4.6-4.3 3.3 7.5 3.1-1.4-3.3-7.3 6.4-.6z" fill="#fff" stroke="#000" stroke-width="1.6" stroke-linejoin="round"/></svg>';

  function initEngine(p) {
    const stage = p.querySelector('.stage-c');
    if (!stage) return null;
    const subs = [...stage.querySelectorAll('.sub')];
    const sbs = [...p.querySelectorAll('.sb')];
    const cur = document.createElement('div');
    cur.className = 'cur';
    cur.setAttribute('aria-hidden', 'true');
    cur.innerHTML = CUR;
    stage.appendChild(cur);
    let idx = 0, locked = false, tok = 0, running = false, inView = false;

    const sleep = (ms, t) => new Promise((r) => setTimeout(() => r(t === tok), ms));

    function show(i, final) {
      idx = i;
      subs.forEach((s, k) => s.classList.toggle('is-on', k === i));
      sbs.forEach((b, k) => { b.setAttribute('aria-pressed', String(k === i)); b.classList.remove('run'); });
      const sub = subs[i];
      if (final) sub.style.setProperty('--s', 99);
      if (!final && !locked) {
        const dw = 500 + 1700 + [...Array(+sub.dataset.k)].reduce((t, _, k) =>
          t + (sub.querySelector('[data-c~="' + (k + 1) + '"]') ? 1100 : 0) + 1100, 0);
        sbs[i].style.setProperty('--dur', dw + 'ms');
        void sbs[i].offsetWidth;
        sbs[i].classList.add('run');
      }
    }

    function aim(el) {
      const sr = stage.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      const em = sr.width / 34;
      const x = (r.left + r.width * 0.5 - sr.left) / em - 0.35;
      const y = (r.top + r.height * 0.5 - sr.top) / em - 0.2;
      cur.style.setProperty('--cx', Math.max(-1, Math.min(34, x)).toFixed(2));
      cur.style.setProperty('--cy', Math.max(-1, Math.min(30, y)).toFixed(2));
    }

    async function play(i, t) {
      const sub = subs[i];
      const K = +sub.dataset.k;
      sub.classList.add('rst');
      sub.style.setProperty('--s', 0);
      void sub.offsetWidth;
      sub.classList.remove('rst');
      show(i, false);
      if (!(await sleep(550, t))) return false;
      for (let k = 1; k <= K; k++) {
        const el = sub.querySelector('[data-c~="' + k + '"]');
        if (el) {
          aim(el);
          if (!(await sleep(950, t))) return false;
          cur.classList.remove('click'); void cur.offsetWidth; cur.classList.add('click');
          el.classList.add('press');
          setTimeout(() => el.classList.remove('press'), 400);
          if (!(await sleep(140, t))) return false;
        }
        sub.style.setProperty('--s', k);
        if (!(await sleep(1100, t))) return false;
      }
      return sleep(1700, t);
    }

    async function loop(t) {
      cur.classList.add('on');
      while (t === tok) {
        const ok = await play(idx, t);
        if (!ok) return;
        if (!locked) idx = (idx + 1) % subs.length;
      }
    }

    function sync() {
      const want = !eng.paused && eng.tab && inView && p.classList.contains('is-open');
      if (want && !running) {
        running = true;
        p.classList.toggle('is-auto', !locked);
        loop(++tok);
      } else if (!want && running) {
        running = false;
        tok++;
        cur.classList.remove('on');
        sbs.forEach((b) => b.classList.remove('run'));
        // parado: mostra a cena completa, nunca uma cena pela metade
        subs[idx].style.setProperty('--s', 99);
      }
    }

    sbs.forEach((b, i) => b.addEventListener('click', () => {
      locked = true;
      p.classList.remove('is-auto');
      idx = i;
      if (running) loop(++tok); else show(i, true);
      if (!desktop.matches) stage.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
    }));

    if ('IntersectionObserver' in window) {
      new IntersectionObserver((es) => { inView = es.some((e) => e.isIntersecting); sync(); }, { threshold: 0.25 }).observe(stage);
    } else { inView = true; }
    show(0, true);
    return { sync, stop: () => { tok++; running = false; } };
  }

  panels.forEach((p) => { const c = initEngine(p); if (c) controllers.push(c); });
  const syncAll = () => controllers.forEach((c) => c.sync());
  document.addEventListener('visibilitychange', () => { eng.tab = !document.hidden; syncAll(); });
  if (pauseBtn) {
    const label = () => {
      pauseBtn.setAttribute('aria-pressed', String(eng.paused));
      pauseBtn.querySelector('span').textContent = eng.paused ? (reduceMotion ? 'Reproduzir animações' : 'Retomar animações') : 'Pausar animações';
    };
    label();
    pauseBtn.addEventListener('click', () => {
      eng.paused = !eng.paused;
      // quem pediu menos movimento no sistema só vê movimento se clicar aqui
      if (svcRoot) svcRoot.classList.toggle('anim-on', !eng.paused);
      label();
      syncAll();
    });
  }

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
