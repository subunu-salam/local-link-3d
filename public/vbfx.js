/* Local Link — VoiceBite background motion (replaces fx.js).
   Soft bokeh lights + flowing silk ribbons inside every .atmo / .vbg,
   gentle scroll parallax, and the home header that tightens on scroll.
   Transforms and opacity only, so it stays smooth on cheap phones. */
(() => {
  /* Lite mode for cheap phones / data saver: no bokeh, ribbons, blur or grain. */
  const nav = navigator, conn = nav.connection || {};
  const LITE = !!(conn.saveData || /2g/.test(conn.effectiveType || '') || (nav.deviceMemory && nav.deviceMemory <= 3) || (nav.hardwareConcurrency && nav.hardwareConcurrency <= 4));
  if (LITE) document.documentElement.classList.add('lite');
  const RM = LITE || matchMedia('(prefers-reduced-motion: reduce)').matches;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const HUES = ['95,211,196', '255,190,90', '255,150,120', '255,255,255'];
  const RIB = `<svg class="silk" viewBox="0 0 1200 400" preserveAspectRatio="none"><defs>
    <linearGradient id="llsk1" x1="0" x2="1"><stop offset="0" stop-color="#0C8F82" stop-opacity="0"/><stop offset=".5" stop-color="#0C8F82" stop-opacity=".35"/><stop offset="1" stop-color="#F7C948" stop-opacity="0"/></linearGradient>
    <linearGradient id="llsk2" x1="0" x2="1"><stop offset="0" stop-color="#FF8A6B" stop-opacity="0"/><stop offset=".5" stop-color="#FF8A6B" stop-opacity=".4"/><stop offset="1" stop-color="#F7C948" stop-opacity="0"/></linearGradient></defs>
    <path d="M0 220 C150 120 300 320 450 220 S750 120 900 220 S1150 320 1200 220" stroke="url(#llsk1)" stroke-width="2" fill="none"/>
    <path d="M0 250 C150 160 300 340 450 250 S750 160 900 250 S1150 340 1200 250" stroke="url(#llsk2)" stroke-width="1.5" fill="none"/>
    <path d="M0 280 C150 200 300 360 450 280 S750 200 900 280 S1150 360 1200 280" stroke="url(#llsk1)" stroke-width="1" fill="none"/></svg>`;

  function fill(host, n, wide) {
    if (!host || host.__filled || RM) return null;
    host.__filled = true;
    const box = document.createElement('div'); box.className = 'floaters'; box.setAttribute('aria-hidden', 'true');
    for (let k = 0; k < n; k++) {
      const el = document.createElement('i'), size = rnd(wide ? 40 : 18, wide ? 130 : 70);
      el.className = 'bk';
      el.style.cssText = `--x:${rnd(0, 100)}%;--y:${rnd(5, 95)}%;--s:${size.toFixed(0)}px;--c:${HUES[k % HUES.length]};--o:${rnd(.25, .6).toFixed(2)};` +
        `--d:${rnd(14, 26).toFixed(1)}s;--dl:${(-rnd(0, 26)).toFixed(1)}s;--dx:${rnd(-40, 40).toFixed(0)}px;--dy:${rnd(-60, -20).toFixed(0)}px`;
      box.appendChild(el);
    }
    const r1 = document.createElement('div'); r1.className = 'ribbon'; r1.innerHTML = RIB + RIB; box.appendChild(r1);
    const r2 = document.createElement('div'); r2.className = 'ribbon rb2'; r2.innerHTML = RIB + RIB; box.appendChild(r2);
    host.appendChild(box); return box;
  }

  let inner = null;
  function scan() {
    document.querySelectorAll('.appwrap > .atmo').forEach(a => { if (innerWidth >= 900) fill(a, 10, true); });
    const pa = document.querySelector('.phone > .atmo');
    if (pa && !pa.__filled) inner = fill(pa, 9, false);
    document.querySelectorAll('.vbg').forEach(v => fill(v, 8, false));
    const sc = document.getElementById('screen');
    if (sc && !sc.__vbScroll) {
      sc.__vbScroll = true; let tick = 0;
      sc.addEventListener('scroll', () => {
        if (tick) return;
        tick = requestAnimationFrame(() => {
          tick = 0;
          if (inner) inner.style.transform = `translate3d(0,${(-sc.scrollTop * .12).toFixed(1)}px,0)`;
          const hd = sc.querySelector('.vhd, .qc-head'); if (hd) hd.classList.toggle('tight', sc.scrollTop > 40);
        });
      }, { passive: true });
    }
  }
  new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
  scan();
  document.addEventListener('visibilitychange', () =>
    document.querySelectorAll('.bk,.ribbon').forEach(f => f.style.animationPlayState = document.hidden ? 'paused' : 'running'));
})();
