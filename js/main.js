(() => {
  const root = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const stage = document.getElementById('stage');
  if (!stage) return;

  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const ease = (t) => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  /* ---------- Íris + história: a página abre a partir do "o" e a narrativa anda com a rolagem ---------- */

  {
    const pin = stage.querySelector('.pin');
    const iris = stage.querySelector('.iris');
    const o = stage.querySelector('.o-anchor');
    const seal = stage.querySelector('.seal');
    const mark = stage.querySelector('.mark__f');
    const chaps = [...stage.querySelectorAll('.chap')];
    const scenes = [...stage.querySelectorAll('.s3')];
    const head = stage.querySelector('.s3__head');
    const items = head ? [...head.querySelectorAll('li')] : [];
    // Tudo medido em "telas" de rolagem. [início, fim] de cada capítulo.
    const S3_START = 4.4, S3_LEN = 1.0, N3 = scenes.length;
    const SCREENS = S3_START + N3 * S3_LEN + 1.35, IN = .6, OUT = .5;
    const range = [[.5, 1.95], [1.8, 3.15], [3.0, 4.5], [SCREENS - 1.45, SCREENS]];
    let ox = 0, oy = 0, maxR = 0, W = 0, H = 0, sz = 0, ticking = false;

    const measure = () => {
      const p = pin.getBoundingClientRect();
      const r = o.getBoundingClientRect();
      ox = r.left + r.width / 2 - p.left;
      oy = r.top + r.height / 2 - p.top;
      W = p.width; H = p.height;
      maxR = Math.hypot(Math.max(ox, W - ox), Math.max(oy, H - oy));
      sz = seal ? parseFloat(getComputedStyle(seal).width) : 0;
      stage.style.height = ((SCREENS + 1) * 100) + 'vh';
    };

    const draw = () => {
      ticking = false;
      const rect = stage.getBoundingClientRect();
      const total = rect.height - innerHeight;
      const S = clamp(-rect.top, 0, total) / innerHeight;   // quantas telas já rolamos
      iris.style.clipPath = `circle(${(ease(clamp(S / .8)) * maxR * 1.02).toFixed(1)}px at ${ox.toFixed(1)}px ${oy.toFixed(1)}px)`;
      // capítulos 1 a 3 e o final
      chaps.forEach((c, i) => {
        const [s, e] = range[i];
        const inn = clamp((S - s) / IN);
        const out = i === chaps.length - 1 ? 0 : clamp((S - (e - OUT)) / OUT);
        c.style.setProperty('--in', inn.toFixed(3));
        c.style.setProperty('--out', out.toFixed(3));
        c.classList.toggle('on', inn > 0 && out < 1);
      });
      // cenas 3D: uma por tópico, na ordem
      let active = -1;
      scenes.forEach((c, i) => {
        const u = clamp((S - (S3_START + i * S3_LEN)) / S3_LEN);
        const live = S >= S3_START + i * S3_LEN - .02 && S <= S3_START + (i + 1) * S3_LEN + .02;
        c.style.setProperty('--u', u.toFixed(4));
        c.style.setProperty('--si', clamp(u / .26).toFixed(3));
        c.style.setProperty('--so', (i === scenes.length - 1 ? clamp((u - .86) / .14) : clamp((u - .8) / .2)).toFixed(3));
        c.classList.toggle('on', live);
        if (live && u > .02 && u < .98) active = i;
      });
      if (head) {
        head.classList.toggle('on', active > -1);
        items.forEach((li, k) => { li.classList.toggle('is-act', k === active); li.classList.toggle('is-past', active > -1 && k < active); });
      }
      const fill = clamp((S - (SCREENS - .75)) / .25);
      if (mark) mark.style.setProperty('--fillup', fill.toFixed(3));
      if (seal) {
        const g = clamp((S - (SCREENS - .5)) / .5);
        const full = (Math.hypot(W, H) / (sz || 1)) * 1.08;
        const sc = g <= 0 ? 0 : 1 + ease(g) * (full - 1);
        seal.style.setProperty('--sc', sc.toFixed(3));
      }
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
