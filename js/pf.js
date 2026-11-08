/* Portfólio: expositor 3D (coverflow) e modo "folhear" com página virando. */
(() => {
  const root = document.querySelector('[data-pf]');
  if (!root) return;
  let data = [];
  try { data = JSON.parse(document.getElementById('pf-data').textContent); } catch (_) {}
  const stage = root.querySelector('.pf__stage');
  const row = root.querySelector('.pf__row');
  const cards = [...row.children];
  const n = cards.length;
  const info = root.querySelector('.pf__info');
  const dotsEl = root.querySelector('.pf__dots');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };

  root.classList.add('pf--on');
  dotsEl.append(...cards.map((_, i) => { const d = el('i'); d.dataset.i = i; return d; }));
  const dots = [...dotsEl.children];
  const hint = root.querySelector('.pf__hint');
  if (hint) hint.textContent = 'Arraste, use as setas do teclado ou deslize no trackpad';

  let pos = 0, target = 0, raf = 0, W = 600, active = -1, drag = null, suppress = false, lastWheel = 0;

  function measure() { W = cards[0].offsetWidth || 600; }

  function paint() {
    cards.forEach((c, i) => {
      const d = i - pos, ad = Math.abs(d), s = Math.sign(d);
      const x = s * (Math.min(ad, 1) * W * 0.62 + Math.max(0, ad - 1) * W * 0.24);
      const z = -Math.min(ad, 1) * 200 - Math.max(0, ad - 1) * 110;
      const rot = -s * Math.min(ad, 1) * 52;
      c.style.transform = `translate3d(${x.toFixed(1)}px,0,${z.toFixed(1)}px) rotateY(${rot.toFixed(2)}deg)`;
      c.style.opacity = String(Math.max(0, 1 - Math.min(ad, 2) * 0.3).toFixed(3));
      c.style.zIndex = String(50 - Math.round(ad * 10));
      c.style.setProperty('--sh', Math.min(ad, 1).toFixed(3));
      c.classList.toggle('is-front', ad < 0.5);
    });
    const a = clamp(Math.round(pos), 0, n - 1);
    if (a !== active) { active = a; render(); }
  }

  function tick() {
    raf = 0;
    const diff = target - pos;
    if (reduce || Math.abs(diff) < 0.0015) { pos = target; paint(); return; }
    pos += diff * 0.11;
    paint();
    raf = requestAnimationFrame(tick);
  }
  function go(i) { target = clamp(Math.round(i), 0, n - 1); if (!raf) raf = requestAnimationFrame(tick); }

  function render() {
    dots.forEach((d, i) => d.classList.toggle('on', i === active));
    const p = data[active];
    info.textContent = '';
    if (!p) {
      info.append(el('p', 'pf__n', String(active + 1).padStart(2, '0') + ' / ' + String(n).padStart(2, '0')), el('h2', 'pf__t', 'Mais projetos a caminho'), el('p', 'pf__d', 'Os projetos novos entram primeiro no Behance e chegam aqui em seguida.'));
      const a = el('a', 'pf__btn pf__btn--line', 'Ver o perfil no Behance ↗'); a.href = cards[active].querySelector('a').href; a.target = '_blank'; a.rel = 'noopener';
      info.append(el('div', 'pf__act')); info.lastChild.append(a);
    } else {
      info.append(el('p', 'pf__n', String(active + 1).padStart(2, '0') + ' / ' + String(n).padStart(2, '0') + ' · ' + p.ano));
      info.append(el('h2', 'pf__t', p.title), el('p', 'pf__s', p.sub), el('p', 'pf__d', p.resumo));
      const ul = el('ul', 'pf__tags'); p.papeis.forEach((x) => ul.append(el('li', '', x))); info.append(ul);
      const act = el('div', 'pf__act');
      const b = el('button', 'pf__btn', 'Folhear projeto'); b.type = 'button'; b.addEventListener('click', () => openViewer(active, b));
      const a = el('a', 'pf__btn pf__btn--line', 'Ver no Behance ↗'); a.href = p.behance; a.target = '_blank'; a.rel = 'noopener';
      act.append(b, a); info.append(act);
    }
    if (window.InversoTypo) window.InversoTypo(info);
  }

  /* arrastar */
  const hasBtn = (t) => t.closest && t.closest('.pf__b, .pf__btn');
  stage.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || hasBtn(e.target)) return;
    drag = { x: e.clientX, p0: pos, t: performance.now(), lx: e.clientX, lt: performance.now(), v: 0, moved: 0 };
  });
  addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    drag.moved = Math.max(drag.moved, Math.abs(dx));
    if (drag.moved > 6) { stage.classList.add('drag'); }
    const now = performance.now();
    if (now - drag.lt > 16) { drag.v = (e.clientX - drag.lx) / (now - drag.lt); drag.lx = e.clientX; drag.lt = now; }
    pos = target = clamp(drag.p0 - dx / (W * 0.55), -0.35, n - 1 + 0.35);
    paint();
  });
  const end = () => {
    if (!drag) return;
    const d = drag; drag = null; stage.classList.remove('drag');
    if (d.moved > 6) { suppress = true; setTimeout(() => (suppress = false), 60); go(pos - d.v * 1.2); }
  };
  addEventListener('pointerup', end);
  addEventListener('pointercancel', end);

  /* clique na capa: a da frente abre o projeto; as laterais vêm para a frente */
  row.addEventListener('click', (e) => {
    const a = e.target.closest('.pf__cover'); if (!a) return;
    e.preventDefault();
    if (suppress) return;
    const i = Number(a.closest('.pf__c').dataset.i);
    if (i !== active) return go(i);
    if (a.dataset.soon) return window.open(a.href, '_blank', 'noopener');
    openViewer(i, a);
  });

  stage.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); go(active + 1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); go(active - 1); }
    else if (e.key === 'Home') { e.preventDefault(); go(0); }
    else if (e.key === 'End') { e.preventDefault(); go(n - 1); }
    else if ((e.key === 'Enter' || e.key === ' ') && data[active]) { e.preventDefault(); openViewer(active, stage); }
  });
  stage.addEventListener('wheel', (e) => {
    if (Math.abs(e.deltaX) <= Math.abs(e.deltaY) || Math.abs(e.deltaX) < 8) return;
    e.preventDefault();
    const t = performance.now(); if (t - lastWheel < 380) return; lastWheel = t;
    go(active + Math.sign(e.deltaX));
  }, { passive: false });
  root.querySelectorAll('.pf__b').forEach((b) => b.addEventListener('click', () => go(active + Number(b.dataset.dir))));
  dotsEl.addEventListener('click', (e) => { const d = e.target.closest('i'); if (d) go(Number(d.dataset.i)); });

  /* inclinação leve acompanhando o mouse */
  if (!reduce && matchMedia('(hover: hover)').matches) {
    stage.addEventListener('pointermove', (e) => {
      if (drag || e.pointerType !== 'mouse') return;
      const r = stage.getBoundingClientRect();
      row.style.setProperty('--ry', (((e.clientX - r.left) / r.width - 0.5) * 6).toFixed(2) + 'deg');
      row.style.setProperty('--rx', ((0.5 - (e.clientY - r.top) / r.height) * 4).toFixed(2) + 'deg');
    });
    stage.addEventListener('pointerleave', () => { row.style.setProperty('--ry', '0deg'); row.style.setProperty('--rx', '0deg'); });
  }

  addEventListener('resize', () => { measure(); paint(); });
  measure();
  if (reduce) { paint(); } else { pos = -0.9; paint(); go(0); }

  /* ---------- Modo folhear ---------- */
  let V = null;
  function openViewer(i, opener) {
    const p = data[i]; if (!p || V) return;
    const N = p.paginas.length;
    const base = '/img/portfolio/' + p.slug + '/';
    let cur = 0;
    const box = el('div', 'pv'); box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', 'Projeto ' + p.title);
    const top = el('div', 'pv__top');
    const ttl = el('p', 'pv__ttl'); ttl.append(el('b', '', p.title), el('span', '', p.sub));
    const tools = el('div', 'pv__tools');
    const bh = el('a', 'pv__link', 'Ver no Behance ↗'); bh.href = p.behance; bh.target = '_blank'; bh.rel = 'noopener';
    const close = el('button', 'pv__x', 'Fechar'); close.type = 'button'; close.setAttribute('aria-label', 'Fechar projeto');
    tools.append(bh, close); top.append(ttl, tools);
    const main = el('div', 'pv__main');
    const prev = el('button', 'pv__nav pv__nav--p', '←'); prev.type = 'button'; prev.setAttribute('aria-label', 'Prancha anterior');
    const next = el('button', 'pv__nav pv__nav--n', '→'); next.type = 'button'; next.setAttribute('aria-label', 'Próxima prancha');
    const book = el('div', 'pv__book'); const stack = el('div', 'pv__stack');
    const leaves = p.paginas.map((pg, k) => {
      const l = el('div', 'pv__leaf'); l.style.zIndex = String(N - k);
      const im = el('img'); im.alt = 'Prancha ' + (k + 1) + ' de ' + N + ' do projeto ' + p.title; im.draggable = false; im.dataset.src = base + pg.f + '.webp'; im.decoding = 'async';
      l.append(im); stack.append(l); return l;
    });
    book.append(stack); main.append(prev, book, next);
    const bot = el('div', 'pv__bot');
    const count = el('p', 'pv__count'); count.setAttribute('aria-live', 'polite');
    const thumbs = el('div', 'pv__thumbs'); thumbs.setAttribute('role', 'list');
    const tb = p.paginas.map((pg, k) => {
      const b = el('button', 'pv__th'); b.type = 'button'; b.setAttribute('role', 'listitem'); b.setAttribute('aria-label', 'Ir para a prancha ' + (k + 1));
      const im = el('img'); im.src = base + pg.f + '-t.webp'; im.alt = ''; im.loading = 'lazy'; im.decoding = 'async'; im.draggable = false; b.append(im);
      b.addEventListener('click', () => set(k)); thumbs.append(b); return b;
    });
    bot.append(count, thumbs);
    box.append(top, main, bot);
    document.body.append(box);
    document.documentElement.classList.add('pv-lock');

    const load = (k) => { const im = leaves[k] && leaves[k].firstChild; if (im && !im.src) im.src = im.dataset.src; };
    function set(c) {
      cur = clamp(c, 0, N - 1);
      leaves.forEach((l, k) => {
        l.classList.toggle('is-past', k < cur); l.classList.toggle('is-cur', k === cur);
        l.classList.toggle('is-next', k === cur + 1); l.classList.toggle('is-far', k > cur + 1);
        l.setAttribute('aria-hidden', String(k !== cur));
      });
      [cur - 1, cur, cur + 1, cur + 2].forEach(load);
      tb.forEach((b, k) => { b.classList.toggle('on', k === cur); if (k === cur) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current'); });
      const t = tb[cur]; if (t && t.scrollIntoView) { const w = thumbs; w.scrollTo({ left: t.offsetLeft - w.clientWidth / 2 + t.clientWidth / 2, behavior: reduce ? 'auto' : 'smooth' }); }
      count.textContent = 'Prancha ' + (cur + 1) + ' de ' + N;
      prev.disabled = cur === 0; next.disabled = cur === N - 1;
    }
    set(0);
    requestAnimationFrame(() => box.classList.add('on'));

    const shut = () => {
      removeEventListener('keydown', key, true);
      box.classList.remove('on');
      document.documentElement.classList.remove('pv-lock');
      setTimeout(() => box.remove(), reduce ? 0 : 300);
      V = null; if (opener && opener.focus) opener.focus({ preventScroll: true });
      if (location.hash === '#' + p.slug) history.replaceState(null, '', location.pathname);
    };
    const key = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); shut(); }
      else if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); set(cur + 1); }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); set(cur - 1); }
      else if (e.key === 'Home') { e.preventDefault(); set(0); }
      else if (e.key === 'End') { e.preventDefault(); set(N - 1); }
      else if (e.key === 'Tab') {
        const f = [...box.querySelectorAll('a[href],button:not([disabled])')].filter((x) => x.offsetParent !== null); if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    addEventListener('keydown', key, true);
    close.addEventListener('click', shut);
    prev.addEventListener('click', () => set(cur - 1));
    next.addEventListener('click', () => set(cur + 1));
    box.addEventListener('click', (e) => { if (e.target === box || e.target === main) shut(); });
    let sx = null, sy = 0;
    book.addEventListener('pointerdown', (e) => { sx = e.clientX; sy = e.clientY; });
    book.addEventListener('pointerup', (e) => {
      if (sx == null) return; const dx = e.clientX - sx, dy = e.clientY - sy; sx = null;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) set(cur + (dx < 0 ? 1 : -1));
      else if (Math.abs(dx) < 8 && Math.abs(dy) < 8) { const r = book.getBoundingClientRect(); set(cur + (e.clientX - r.left > r.width / 2 ? 1 : -1)); }
    });
    book.addEventListener('pointercancel', () => (sx = null));
    book.addEventListener('wheel', (e) => { if (Math.abs(e.deltaX) < 8 || Math.abs(e.deltaX) < Math.abs(e.deltaY)) return; e.preventDefault(); const t = performance.now(); if (t - lastWheel < 450) return; lastWheel = t; set(cur + Math.sign(e.deltaX)); }, { passive: false });
    V = box; close.focus({ preventScroll: true });
    history.replaceState(null, '', '#' + p.slug);
  }

  if (location.hash) { const i = data.findIndex((p) => '#' + p.slug === location.hash); if (i >= 0) { go(i); setTimeout(() => openViewer(i, stage), reduce ? 0 : 900); } }
})();
