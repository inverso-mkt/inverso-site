/* Inverso: tipografia (sem viúvas), formulário de contato e barra de leitura. */
(() => {
  'use strict';

  /* 1. Tipografia: palavras curtas ficam coladas na seguinte e o último par nunca quebra sozinho */
  const NB = ' ';
  const SKIP = '.stage-c, .scene, svg, script, style, code, pre, textarea, select, option, .chap, .lens, [data-notp]';
  const TARGET = 'p, li, h1, h2, h3, h4, figcaption, td, th, .sb__d span, .panel__lead, .panel__get, .step__s, .ct__ig, label';

  function fixText(node, isLast) {
    let t = node.nodeValue;
    if (!t || !t.trim()) return;
    // artigos, preposições e conjunções de até 2 letras ficam com a palavra seguinte
    t = t.replace(/(^|[\s («“"'])([A-Za-zÀ-ÿ]{1,2})[ \t\n]+(?=[^\s])/g, '$1$2' + NB);
    t = t.replace(/\s×\s/g, NB + '×' + NB);
    // número + unidade
    t = t.replace(/(\d)[ ]+(px|min|s|KB|MB|GB|fps|FPS|h|%)(?![A-Za-zÀ-ÿ])/g, '$1' + NB + '$2');
    if (isLast) {
      const words = t.trim().split(/\s+/);
      if (words.length > 2) t = t.replace(/\s+(\S+\s*)$/, NB + '$1');
    }
    if (t !== node.nodeValue) node.nodeValue = t;
  }

  function fixEl(el) {
    if (el.dataset.tp || el.closest(SKIP)) return;
    el.dataset.tp = '1';
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
      acceptNode: n => n.parentElement.closest(SKIP) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
    });
    const nodes = [];
    while (w.nextNode()) nodes.push(w.currentNode);
    nodes.forEach((n, i) => fixText(n, i === nodes.length - 1));
  }

  function typo(scope = document) {
    scope.querySelectorAll(TARGET).forEach(fixEl);
  }

  /* 2. Formulário de contato (Netlify Forms) */
  function bindForms() {
    document.querySelectorAll('form.fm').forEach(form => {
      const box = form.closest('.ct__box');
      const ok = box && box.querySelector('.fok');
      const err = form.querySelector('.fm__err');
      const btn = form.querySelector('.fsub');
      form.addEventListener('submit', async e => {
        e.preventDefault();
        if (!form.reportValidity()) return;
        if (err) err.hidden = true;
        btn.disabled = true;
        const label = btn.querySelector('.fsub__t');
        const old = label.textContent;
        label.textContent = 'Enviando…';
        try {
          const body = new URLSearchParams(new FormData(form)).toString();
          const r = await fetch('/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
          if (!r.ok) throw new Error(r.status);
          form.hidden = true;
          if (ok) { ok.hidden = false; ok.focus(); }
          form.reset();
        } catch (_) {
          if (err) err.hidden = false;
          label.textContent = old;
          btn.disabled = false;
        }
      });
    });
  }

  /* 3. Barra de leitura nos artigos */
  function progress() {
    const art = document.querySelector('.art');
    if (!art) return;
    const bar = document.createElement('div');
    bar.className = 'rp';
    bar.setAttribute('aria-hidden', 'true');
    document.body.appendChild(bar);
    let tick = false;
    const upd = () => {
      tick = false;
      const r = art.getBoundingClientRect();
      const total = r.height - innerHeight * .5;
      const p = Math.min(1, Math.max(0, (-r.top + innerHeight * .2) / Math.max(1, total)));
      bar.style.transform = `scaleX(${p.toFixed(4)})`;
    };
    addEventListener('scroll', () => { if (!tick) { tick = true; requestAnimationFrame(upd); } }, { passive: true });
    addEventListener('resize', upd);
    upd();
  }

  /* A lente de inversão sai de cena sobre o formulário, para não atrapalhar quem digita */
  function lensOff() {
    document.querySelectorAll('.ct__box').forEach(b => {
      b.addEventListener('pointerenter', () => document.documentElement.classList.add('lens-off'));
      b.addEventListener('pointerleave', () => document.documentElement.classList.remove('lens-off'));
    });
  }

  const init = () => { typo(); bindForms(); progress(); lensOff(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  window.InversoTypo = typo;
})();

/* Barra superior que desce quando o mouse encosta no topo (e, no toque, quando se rola para cima) */
(() => {
  const bar = document.querySelector('.bar');
  if (!bar) return;
  const tab = document.createElement('button');
  tab.className = 'bartab'; tab.type = 'button'; tab.setAttribute('aria-label', 'Abrir o menu');
  bar.insertAdjacentElement('afterend', tab);
  let on = false, lastY = scrollY, hold = 0;
  const set = (v) => { if (on === v) return; on = v; bar.classList.toggle('on', v); document.body.classList.toggle('bar-on', v); };
  tab.addEventListener('click', () => { set(true); hold = performance.now() + 4000; });
  addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    if (e.clientY <= 26) set(true);
    else if (on && e.clientY > bar.offsetHeight + 28 && !bar.matches(':focus-within')) set(false);
  }, { passive: true });
  document.documentElement.addEventListener('mouseleave', (e) => { if (e.clientY <= 0) set(true); });
  addEventListener('scroll', () => {
    const y = scrollY, d = y - lastY; lastY = y;
    if (matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    if (d < -8) set(true);
    else if (d > 8 && performance.now() > hold) set(false);
  }, { passive: true });
  addEventListener('keydown', (e) => { if (e.key === 'Escape') set(false); });
  bar.addEventListener('click', (e) => { if (e.target.closest('a') && !matchMedia('(hover: hover) and (pointer: fine)').matches) setTimeout(() => set(false), 300); });
})();

/* Mostruário 3D: os artigos em um anel que se gira arrastando, com setas, teclado ou roda do mouse */
(() => {
  const grid = document.querySelector('.bgrid3');
  if (!grid) return;
  const cards = [...grid.children];
  const n = cards.length;
  if (n < 2) return;
  const wrap = document.createElement('div');
  wrap.className = 'cx';
  grid.parentNode.insertBefore(wrap, grid);
  wrap.appendChild(grid);
  const ring = document.createElement('div');
  ring.className = 'cx__ring';
  cards.forEach((c) => ring.appendChild(c));
  grid.appendChild(ring);
  const floor = document.createElement('div'); floor.className = 'cx__floor'; floor.setAttribute('aria-hidden', 'true'); grid.appendChild(floor);
  const full = n >= 8;                               // com muitos artigos vira um anel fechado
  const step = full ? 360 / n : 44;
  const ui = document.createElement('div');
  ui.className = 'cx__ui';
  ui.innerHTML = '<button class="cx__b" type="button" aria-label="Artigo anterior">←</button><div class="cx__dots" aria-hidden="true">' + cards.map(() => '<i></i>').join('') + '</div><button class="cx__b" type="button" aria-label="Próximo artigo">→</button>';
  wrap.appendChild(ui);
  const hint = document.createElement('p'); hint.className = 'cx__hint'; hint.textContent = 'Arraste, use as setas ou a roda do mouse para girar'; wrap.appendChild(hint);
  const [bPrev, bNext] = ui.querySelectorAll('.cx__b');
  const dots = [...ui.querySelectorAll('.cx__dots i')];
  grid.tabIndex = 0;
  grid.setAttribute('role', 'region');
  grid.setAttribute('aria-roledescription', 'carrossel');
  grid.setAttribute('aria-label', 'Artigos do blog');
  wrap.classList.add('cx--on');

  let active = 0, rot = 0, dragging = false, sx = 0, srot = 0, moved = 0, lastDx = 0;
  const norm = (a) => ((a + 540) % 360) - 180;

  function layout() {
    const cw = Math.min(innerWidth * 0.78, 24 * 16);
    wrap.style.setProperty('--cw', cw + 'px');
    const R = full ? Math.max(cw / (2 * Math.tan(Math.PI / n)), cw * 0.9) : cw / (2 * Math.tan((step / 2) * Math.PI / 180));
    wrap.style.setProperty('--R', R.toFixed(1) + 'px');
    wrap.style.setProperty('--step', step + 'deg');
    cards.forEach((c, i) => c.style.setProperty('--i', i));
    const h = Math.max(...cards.map((c) => c.offsetHeight));
    wrap.style.setProperty('--ch', (h + 80) + 'px');
    paint();
  }

  function paint() {
    ring.style.transform = `translateZ(${-parseFloat(getComputedStyle(wrap).getPropertyValue('--R'))}px) rotateY(${rot}deg)`;
    cards.forEach((c, i) => {
      const a = Math.abs(norm(i * step + rot));
      c.style.opacity = Math.max(0, 1 - Math.max(0, a - 10) / (full ? 120 : 62)).toFixed(2);
      c.style.pointerEvents = a < 80 ? 'auto' : 'none';
      c.tabIndex = a < 12 ? 0 : -1;
      c.setAttribute('aria-hidden', a < 12 ? 'false' : 'true');
    });
    dots.forEach((d, i) => d.classList.toggle('on', i === active));
    bPrev.disabled = !full && active === 0;
    bNext.disabled = !full && active === n - 1;
  }

  function go(i) {
    active = full ? ((i % n) + n) % n : Math.max(0, Math.min(n - 1, i));
    if (full) {
      // gira pelo caminho mais curto
      const target = -active * step;
      rot = target + 360 * Math.round((rot - target) / 360);
    } else rot = -active * step;
    paint();
  }

  bPrev.addEventListener('click', () => go(active - 1));
  bNext.addEventListener('click', () => go(active + 1));
  dots.forEach((d, i) => d.addEventListener('click', () => go(i)));
  grid.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(active - 1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); go(active + 1); }
  });

  grid.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    dragging = true; moved = 0; sx = e.clientX; srot = rot; lastDx = 0;
  });
  addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - sx;
    moved = Math.max(moved, Math.abs(dx));
    if (moved > 6 && !grid.classList.contains('drag')) { grid.classList.add('drag'); try { grid.setPointerCapture(e.pointerId); } catch (_) {} }
    if (!grid.classList.contains('drag')) return;
    let r = srot + dx * 0.22;
    if (!full) r = Math.max(-(n - 1) * step - 14, Math.min(14, r));   // elástico nas pontas
    rot = r; lastDx = dx; paint();
  });
  const end = () => {
    if (!dragging) return;
    dragging = false;
    const was = grid.classList.contains('drag');
    grid.classList.remove('drag');
    if (was) go(Math.round(-rot / step));
  };
  addEventListener('pointerup', end);
  addEventListener('pointercancel', end);

  // clicar num cartão ao lado gira até ele; no cartão da frente abre o artigo
  grid.addEventListener('click', (e) => {
    if (moved > 6) { e.preventDefault(); return; }
    const c = e.target.closest('.bc');
    if (!c) return;
    const i = cards.indexOf(c);
    if (Math.abs(norm(i * step + rot)) > 12) { e.preventDefault(); go(i); }
  });
  let wheelLock = 0;
  grid.addEventListener('wheel', (e) => {
    if (Math.abs(e.deltaX) <= Math.abs(e.deltaY) || performance.now() < wheelLock) return;
    e.preventDefault();
    wheelLock = performance.now() + 450;
    go(active + (e.deltaX > 0 ? 1 : -1));
  }, { passive: false });
  grid.addEventListener('dragstart', (e) => e.preventDefault());

  addEventListener('resize', layout);
  addEventListener('load', layout);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(layout);
  if ('ResizeObserver' in window) new ResizeObserver(() => { const h = Math.max(...cards.map((c) => c.offsetHeight)) + 80; if (Math.abs(h - parseFloat(wrap.style.getPropertyValue('--ch'))) > 2) wrap.style.setProperty('--ch', h + 'px'); }).observe(cards[0]);
  layout();
})();

/* Fio de rolagem: uma linha com o símbolo da marca que desce junto com a página e liga as seções */
(() => {
  const stage = document.getElementById('stage');
  if (!stage || !matchMedia('(min-width: 60rem)').matches) return;
  const marks = [['Início', () => 0], ['Serviços', () => document.getElementById('servicos').offsetTop], ['Blog', () => document.getElementById('blog').offsetTop], ['Contato', () => document.getElementById('contato').offsetTop]];
  const th = document.createElement('nav');
  th.className = 'thread'; th.setAttribute('aria-label', 'Progresso da página');
  th.innerHTML = '<i class="thread__line"></i><i class="thread__fill"></i><i class="thread__sym"></i>';
  const btns = marks.map(([name]) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'thread__t'; b.innerHTML = `<span>${name}</span>`; b.setAttribute('aria-label', 'Ir para ' + name); th.appendChild(b); return b; });
  document.body.appendChild(th);
  const max = () => Math.max(1, document.documentElement.scrollHeight - innerHeight);
  const place = () => marks.forEach(([, f], i) => { btns[i].style.top = Math.min(100, f() / max() * 100) + '%'; });
  btns.forEach((b, i) => b.addEventListener('click', () => scrollTo({ top: marks[i][1](), behavior: 'smooth' })));
  let tick = false;
  const upd = () => { tick = false; th.style.setProperty('--tp', Math.min(1, Math.max(0, scrollY / max())).toFixed(4)); };
  addEventListener('scroll', () => { if (!tick) { tick = true; requestAnimationFrame(upd); } }, { passive: true });
  addEventListener('resize', () => { place(); upd(); });
  addEventListener('load', () => { place(); upd(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { place(); upd(); });
  place(); upd();
})();
