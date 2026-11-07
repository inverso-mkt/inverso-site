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
