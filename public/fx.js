/* Local Link — FX layer
   3D scene, screen transitions, tilt, ripples, reveal-on-scroll, counters.
   Pure vanilla JS + Canvas 2D with a hand-rolled 3D projection — no dependencies.
   Everything is additive: it watches the DOM the app renders and decorates it. */
(() => {
  'use strict';
  const RM = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const FINE = window.matchMedia('(pointer: fine)').matches;
  const doc = document.documentElement;
  doc.classList.add('fx-on');
  if (RM) doc.classList.add('fx-reduced');

  /* ------------------------------------------------------------------ *
   * 1. 3D "Local Network" scene — a rotating globe of glowing nodes,
   *    connection arcs and floating location pins, with mouse parallax.
   * ------------------------------------------------------------------ */
  const PAL = {
    navy: [10, 92, 85], blue: [12, 143, 130], sky: [23, 182, 166], amber: [255, 107, 74], gold: [255, 138, 91],
  };
  const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

  function isDark() {
    const th = doc.getAttribute('data-theme');
    if (th) return th === 'dark' || document.body.classList.contains('cdark');
    return window.matchMedia('(prefers-color-scheme: dark)').matches || document.body.classList.contains('cdark');
  }
  function makeScene(canvas, opts = {}) {
    const ctx = canvas.getContext('2d');
    const o = Object.assign({ nodes: 220, pins: 7, radius: 0.36, speed: 1, dark: true, links: 2, cx: 0.5, cy: 0.5, stars: 90 }, opts);
    let W = 0, H = 0, DPR = Math.min(window.devicePixelRatio || 1, 2);
    let rotY = 0, rotX = -0.35, tx = 0, ty = 0, mx = 0, my = 0, t0 = performance.now(), alive = true, visible = true;

    // fibonacci sphere → evenly spread "places"
    const pts = [];
    for (let i = 0; i < o.nodes; i++) {
      const y = 1 - (i / (o.nodes - 1)) * 2, r = Math.sqrt(1 - y * y), th = Math.PI * (3 - Math.sqrt(5)) * i;
      pts.push({ x: Math.cos(th) * r, y, z: Math.sin(th) * r, hot: Math.random() < 0.12, ph: Math.random() * 6.28 });
    }
    // links between near neighbours (the "local links")
    const links = [];
    pts.forEach((p, i) => {
      if (!p.hot) return;
      const near = pts.map((q, j) => [j, (p.x - q.x) ** 2 + (p.y - q.y) ** 2 + (p.z - q.z) ** 2]).filter(a => a[0] !== i).sort((a, b) => a[1] - b[1]).slice(0, o.links);
      near.forEach(([j]) => links.push([i, j, Math.random() * 6.28]));
    });
    // long arcs between random hot nodes (signals travelling)
    const hot = pts.filter(p => p.hot);
    const arcs = Array.from({ length: Math.min(9, hot.length >> 1) }, () => ({ a: hot[Math.random() * hot.length | 0], b: hot[Math.random() * hot.length | 0], t: Math.random(), sp: 0.12 + Math.random() * 0.18 }));
    // floating pins orbiting the globe
    const pins = Array.from({ length: o.pins }, (_, i) => ({ ang: (i / o.pins) * 6.28, el: (Math.random() - 0.5) * 1.1, d: 1.35 + Math.random() * 0.35, bob: Math.random() * 6.28, s: 0.8 + Math.random() * 0.5, c: i % 3 === 0 ? PAL.amber : PAL.sky }));
    const stars = Array.from({ length: o.stars }, () => ({ x: Math.random(), y: Math.random(), z: Math.random(), tw: Math.random() * 6.28 }));

    function resize() {
      const r = canvas.getBoundingClientRect();
      W = Math.max(1, r.width); H = Math.max(1, r.height);
      canvas.width = W * DPR; canvas.height = H * DPR; ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    }
    const ro = 'ResizeObserver' in window ? new ResizeObserver(resize) : null;
    ro ? ro.observe(canvas) : window.addEventListener('resize', resize);
    resize();

    function project(x, y, z, R, cx, cy) {
      // rotate Y then X
      const cy_ = Math.cos(rotY), sy = Math.sin(rotY), cx_ = Math.cos(rotX), sx = Math.sin(rotX);
      let X = x * cy_ - z * sy, Z = x * sy + z * cy_;
      let Y = y * cx_ - Z * sx; Z = y * sx + Z * cx_;
      const f = 2.6 / (2.6 + Z);         // perspective
      return { x: cx + X * R * f, y: cy + Y * R * f, z: Z, f };
    }

    function pinPath(x, y, s) { // map-pin glyph
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.bezierCurveTo(x - 9 * s, y - 11 * s, x - 11 * s, y - 17 * s, x - 11 * s, y - 22 * s);
      ctx.arc(x, y - 22 * s, 11 * s, Math.PI, 0);
      ctx.bezierCurveTo(x + 11 * s, y - 17 * s, x + 9 * s, y - 11 * s, x, y);
      ctx.closePath();
    }

    function frame(now) {
      if (!alive) return;
      requestAnimationFrame(frame);
      if (!visible) return;
      const t = (now - t0) / 1000;
      tx += (mx - tx) * 0.04; ty += (my - ty) * 0.04;
      rotY = t * 0.12 * o.speed + tx * 0.6;
      rotX = -0.35 + ty * 0.35;
      ctx.clearRect(0, 0, W, H);
      if (o.auto) o.dark = isDark();
      const cx = W * o.cx + tx * 18, cy = H * o.cy + ty * 14, R = Math.min(W, H) * o.radius;

      // stars (parallax depth)
      for (const s of stars) {
        const a = (0.25 + 0.35 * Math.sin(t * 1.3 + s.tw)) * (o.dark ? 1 : 0.5);
        ctx.fillStyle = rgba(o.dark ? PAL.sky : PAL.blue, a * s.z);
        const sx = (s.x * W - tx * 30 * s.z + W) % W, sy = (s.y * H - ty * 20 * s.z + H) % H;
        ctx.fillRect(sx, sy, 1.4 * s.z + 0.4, 1.4 * s.z + 0.4);
      }

      // atmospheric halo
      const g = ctx.createRadialGradient(cx, cy, R * 0.2, cx, cy, R * 1.6);
      g.addColorStop(0, rgba(PAL.blue, o.dark ? 0.22 : 0.12));
      g.addColorStop(0.55, rgba(PAL.navy, o.dark ? 0.10 : 0.05));
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R * 1.6, 0, 6.29); ctx.fill();

      // orbit rings (tilted ellipses)
      ctx.lineWidth = 1;
      for (let k = 0; k < 3; k++) {
        ctx.strokeStyle = rgba(k === 1 ? PAL.amber : PAL.sky, o.dark ? 0.16 : 0.22);
        ctx.beginPath();
        ctx.ellipse(cx, cy, R * (1.25 + k * 0.17), R * (0.32 + k * 0.05), -0.35 + k * 0.28 + Math.sin(t * 0.2 + k) * 0.05, 0, 6.29);
        ctx.stroke();
      }

      const P = pts.map(p => project(p.x, p.y, p.z, R, cx, cy));

      // links
      for (const [i, j, ph] of links) {
        const a = P[i], b = P[j];
        const depth = (2 - (a.z + b.z) / 2) / 3;
        ctx.strokeStyle = rgba(o.dark ? PAL.sky : PAL.blue, (o.dark ? 1 : 0.8) * (0.08 + 0.18 * depth) * (0.6 + 0.4 * Math.sin(t * 2 + ph)));
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }

      // arcs with travelling signal
      for (const arc of arcs) {
        arc.t += arc.sp * 0.016 * (RM ? 0 : 1);
        if (arc.t > 1) { arc.t = 0; arc.a = hot[Math.random() * hot.length | 0]; arc.b = hot[Math.random() * hot.length | 0]; }
        const steps = 26; let prev = null, head = null;
        for (let s = 0; s <= steps; s++) {
          const u = s / steps;
          let x = arc.a.x + (arc.b.x - arc.a.x) * u, y = arc.a.y + (arc.b.y - arc.a.y) * u, z = arc.a.z + (arc.b.z - arc.a.z) * u;
          const len = Math.hypot(x, y, z) || 1, lift = 1 + Math.sin(u * Math.PI) * 0.35;
          const q = project(x / len * lift, y / len * lift, z / len * lift, R, cx, cy);
          if (prev) {
            const near = Math.abs(u - arc.t) < 0.12;
            ctx.strokeStyle = rgba(near ? PAL.gold : PAL.amber, near ? 0.9 : (q.z < 0 ? 0.22 : 0.08));
            ctx.lineWidth = near ? 2 : 1;
            ctx.beginPath(); ctx.moveTo(prev.x, prev.y); ctx.lineTo(q.x, q.y); ctx.stroke();
          }
          if (Math.abs(u - arc.t) < 1 / steps) head = q;
          prev = q;
        }
        if (head) { ctx.fillStyle = rgba(PAL.gold, 0.95); ctx.beginPath(); ctx.arc(head.x, head.y, 2.6, 0, 6.29); ctx.fill(); }
      }
      ctx.lineWidth = 1;

      // nodes (back to front)
      const order = P.map((p, i) => i).sort((a, b) => P[b].z - P[a].z);
      for (const i of order) {
        const p = P[i], src = pts[i], front = p.z < 0;
        const a = front ? 0.95 : 0.25;
        if (src.hot) {
          const pulse = 1 + 0.6 * Math.sin(t * 3 + src.ph);
          ctx.fillStyle = rgba(PAL.amber, a * 0.18); ctx.beginPath(); ctx.arc(p.x, p.y, 6 * pulse * p.f, 0, 6.29); ctx.fill();
          ctx.fillStyle = rgba(PAL.gold, a); ctx.beginPath(); ctx.arc(p.x, p.y, 2.2 * p.f, 0, 6.29); ctx.fill();
        } else {
          ctx.fillStyle = rgba(o.dark ? PAL.sky : PAL.blue, a * 0.75); ctx.beginPath(); ctx.arc(p.x, p.y, 1.3 * p.f, 0, 6.29); ctx.fill();
        }
      }

      // floating 3D pins
      const pz = pins.map(pn => {
        const ang = pn.ang + t * 0.25 * o.speed;
        const x = Math.cos(ang) * pn.d, z = Math.sin(ang) * pn.d, y = pn.el + Math.sin(t * 1.4 + pn.bob) * 0.06;
        return { pn, q: project(x, y, z, R, cx, cy) };
      }).sort((a, b) => b.q.z - a.q.z);
      for (const { pn, q } of pz) {
        const s = pn.s * q.f * (R / 260), front = q.z < 0, a = front ? 1 : 0.35;
        ctx.save();
        ctx.globalAlpha = a;
        ctx.shadowColor = rgba(pn.c, 0.8); ctx.shadowBlur = 18 * s;
        const lg = ctx.createLinearGradient(q.x - 11 * s, q.y - 33 * s, q.x + 11 * s, q.y);
        lg.addColorStop(0, rgba(pn.c === PAL.amber ? PAL.gold : PAL.sky, 1)); lg.addColorStop(1, rgba(pn.c === PAL.amber ? PAL.amber : PAL.blue, 1));
        ctx.fillStyle = lg; pinPath(q.x, q.y, s); ctx.fill();
        ctx.shadowBlur = 0; ctx.fillStyle = rgba(PAL.navy, 0.9); ctx.beginPath(); ctx.arc(q.x, q.y - 22 * s, 4.2 * s, 0, 6.29); ctx.fill();
        // ground ripple
        ctx.strokeStyle = rgba(pn.c, 0.35 * a); ctx.beginPath(); ctx.ellipse(q.x, q.y + 2, 9 * s * (1 + (t * 0.8 + pn.bob) % 1), 3 * s * (1 + (t * 0.8 + pn.bob) % 1), 0, 0, 6.29); ctx.stroke();
        ctx.restore();
      }
    }

    const io = 'IntersectionObserver' in window ? new IntersectionObserver(es => { visible = es[0].isIntersecting && !document.hidden; }) : null;
    io && io.observe(canvas);
    document.addEventListener('visibilitychange', () => { visible = !document.hidden; });
    const onMove = e => { mx = (e.clientX / innerWidth - 0.5) * 2; my = (e.clientY / innerHeight - 0.5) * 2; };
    if (!RM) window.addEventListener('pointermove', onMove, { passive: true });
    if (RM) { t0 = performance.now() - 4000; frame(performance.now()); alive = false; } else requestAnimationFrame(frame);
    return { destroy() { alive = false; ro && ro.disconnect(); io && io.disconnect(); window.removeEventListener('pointermove', onMove); } };
  }

  /* global background scene */
  const bg = document.createElement('canvas');
  bg.id = 'fx3d'; bg.setAttribute('aria-hidden', 'true');
  const aurora = document.createElement('div'); aurora.className = 'fx-aurora'; aurora.setAttribute('aria-hidden', 'true');
  aurora.innerHTML = '<i></i><i></i><i></i>';
  const grain = document.createElement('div'); grain.className = 'fx-grain'; grain.setAttribute('aria-hidden', 'true');
  document.body.prepend(grain); document.body.prepend(bg); document.body.prepend(aurora);
  const _launcher = () => document.body.classList.toggle('fx-launch', !!document.querySelector('.launcher'));
  makeScene(bg, { nodes: 260, radius: 0.34, cx: 0.5, cy: 0.52, pins: 8, auto: true });

  /* scoped scenes inside hero panels (admin login brand, launcher, splash) */
  function mountLocal(host, opts) {
    if (!host || host.__fx3d) return;
    const c = document.createElement('canvas'); c.className = 'fx3d-local'; c.setAttribute('aria-hidden', 'true');
    host.prepend(c); host.__fx3d = makeScene(c, opts);
  }

  /* ------------------------------------------------------------------ *
   * 2. Cursor spotlight + progress bar
   * ------------------------------------------------------------------ */
  if (FINE && !RM) {
    const spot = document.createElement('div'); spot.className = 'fx-spot'; document.body.appendChild(spot);
    let sx = innerWidth / 2, sy = innerHeight / 2, cx = sx, cy = sy;
    window.addEventListener('pointermove', e => { sx = e.clientX; sy = e.clientY; }, { passive: true });
    (function loop() { cx += (sx - cx) * 0.15; cy += (sy - cy) * 0.15; spot.style.transform = `translate3d(${cx}px,${cy}px,0)`; requestAnimationFrame(loop); })();
  }
  const bar = document.createElement('div'); bar.className = 'fx-progress'; document.body.appendChild(bar);
  let pending = 0, barT;
  const _fetch = window.fetch.bind(window);
  window.fetch = function (...a) {
    const isApi = String(a[0] && a[0].url || a[0]).includes('/api/');
    if (isApi) { pending++; clearTimeout(barT); bar.classList.add('on'); }
    return _fetch(...a).finally(() => { if (isApi && --pending <= 0) { pending = 0; barT = setTimeout(() => bar.classList.remove('on'), 180); } });
  };

  /* ------------------------------------------------------------------ *
   * 3. Ripple + magnetic press on every button
   * ------------------------------------------------------------------ */
  document.addEventListener('pointerdown', e => {
    const b = e.target.closest('button, .btn, .chip, a.lc-link, .side a');
    if (!b || RM) return;
    const r = b.getBoundingClientRect(); const d = Math.max(r.width, r.height) * 2.2;
    const s = document.createElement('span'); s.className = 'fx-ripple';
    s.style.cssText = `width:${d}px;height:${d}px;left:${e.clientX - r.left - d / 2}px;top:${e.clientY - r.top - d / 2}px`;
    if (getComputedStyle(b).position === 'static') b.style.position = 'relative';
    b.classList.add('fx-clip'); b.appendChild(s); setTimeout(() => s.remove(), 650);
  }, { passive: true });

  /* ------------------------------------------------------------------ *
   * 4. 3D tilt + glare on cards
   * ------------------------------------------------------------------ */
  const TILT = '.launch-card, .card, .cat, .ocard, .ncard, .ecard, .brow, .stat, .offcard, .promo, .hero, .pcard, .ncat, .tile, .bcard';
  let tiltEl = null;
  if (FINE && !RM) {
    document.addEventListener('pointermove', e => {
      const el = e.target.closest(TILT);
      if (tiltEl && tiltEl !== el) { tiltEl.style.transform = ''; tiltEl.classList.remove('fx-tilting'); tiltEl = null; }
      if (!el || el.closest('.side, table, .sheet, .modal')) return;
      const r = el.getBoundingClientRect(); if (r.width > 720 || r.height > 520) return;
      tiltEl = el; el.classList.add('fx-tilt', 'fx-tilting');
      const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
      const k = r.width > 300 ? 5 : 9;
      el.style.transform = `perspective(900px) rotateX(${(0.5 - py) * k}deg) rotateY(${(px - 0.5) * k}deg) translateZ(6px)`;
      el.style.setProperty('--gx', (px * 100) + '%'); el.style.setProperty('--gy', (py * 100) + '%');
    }, { passive: true });
    document.addEventListener('pointerleave', () => { if (tiltEl) { tiltEl.style.transform = ''; tiltEl = null; } });
  }

  /* ------------------------------------------------------------------ *
   * 5. Screen transitions + staggered reveal
   * ------------------------------------------------------------------ */
  const REVEAL = [
    '.sec-head', '.nsec', '.card', '.cat', '.ocard', '.ncard', '.ecard', '.brow', '.stat', '.offcard', '.promo', '.hero',
    '.launch-card', '.panel', '.field', '.btn.block', '.bill', '.chat', '.dealrow', '.plist > *', '.empty', '.ncat', '.tile',
    'table tbody tr', '.addrbar', '.vbar', '.countdown', '.ostack', '.intro', '.auth-hero'
  ].join(',');
  // one observer, viewport root: browsers clip by scrolling ancestors (#screen) automatically
  const revealIO = 'IntersectionObserver' in window ? new IntersectionObserver(es => es.forEach(en => {
    if (en.isIntersecting) { en.target.classList.add('fx-in'); revealIO.unobserve(en.target); }
  }), { threshold: 0.04 }) : null;
  function decorate(root) {
    if (RM || !root) return;
    const io = revealIO; if (!io) return;
    let i = 0;
    root.querySelectorAll(REVEAL).forEach(el => {
      if (el.classList.contains('fx-rv')) return;
      if (el.closest('.sheet, .toast, .bnav')) return;
      el.classList.add('fx-rv');
      el.style.setProperty('--fx-d', Math.min(i++, 14) * 45 + 'ms');
      io.observe(el);
      // safety net: never leave content hidden if the observer misses it
      setTimeout(() => { const r = el.getBoundingClientRect(); if (r.top < innerHeight && r.bottom > 0) el.classList.add('fx-in'); }, 900 + Math.min(i, 14) * 45);
    });
    countUp(root);
  }
  function enter(el, dir) {
    if (RM || !el) return;
    el.classList.remove('fx-enter', 'fx-enter-back'); void el.offsetWidth;
    el.classList.add(dir === 'back' ? 'fx-enter-back' : 'fx-enter');
  }

  /* number counters for stat tiles */
  function countUp(root) {
    root.querySelectorAll('.stat b, .stat .v, .stat h2, .stat h3, .stat strong, .kpi b').forEach(el => {
      if (el.__fxc) return; el.__fxc = 1;
      const raw = el.textContent.trim(); const m = raw.match(/^([^\d-]*)([\d,]+(?:\.\d+)?)(.*)$/);
      if (!m) return; const target = parseFloat(m[2].replace(/,/g, '')); if (!isFinite(target) || target === 0) return;
      const dec = (m[2].split('.')[1] || '').length, t0 = performance.now(), dur = 1100;
      (function tick(now) {
        const p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 4);
        el.textContent = m[1] + (target * e).toLocaleString('en-IN', { minimumFractionDigits: dec, maximumFractionDigits: dec }) + m[3];
        if (p < 1) requestAnimationFrame(tick); else el.textContent = raw;
      })(t0);
    });
  }

  /* watch the app's render targets */
  let lastDepth = 0, lastMain = null, decoQ = new Set(), decoT = 0;
  const mo = new MutationObserver(muts => {
    for (const m of muts) {
      if (m.type !== 'childList' || !m.addedNodes.length) continue;
      const t = m.target;
      // a real screen swap = the app replaced #screen's (or #stage's) direct children
      if (t.id === 'screen') {
        const depth = document.querySelectorAll('#__back').length;
        enter(t, depth < lastDepth ? 'back' : 'fwd'); lastDepth = depth;
      } else if (t.id === 'stage') enter(t.firstElementChild, 'fwd');
      decoQ.add(t);
    }
    // desktop admin: animate the main pane when its content block is replaced
    const main = document.querySelector('.desk > :not(.side)');
    const first = main && main.querySelector(':scope > :last-child');
    if (first && first !== lastMain) { lastMain = first; enter(first, 'fwd'); }
    _launcher(); cancelAnimationFrame(decoT);
    decoT = requestAnimationFrame(() => {
      decoQ.forEach(t => t.isConnected && decorate(t)); decoQ.clear();
      mountLocal(document.querySelector('.crm-brand'), { nodes: 200, radius: 0.32, cx: 0.62, cy: 0.62, pins: 6 });
      mountLocal(document.querySelector('.launch-hero'), { nodes: 150, radius: 0.36, cx: 0.5, cy: 0.5, pins: 6, stars: 0 });
      mountLocal(document.querySelector('.splash'), { nodes: 180, radius: 0.36, cx: 0.5, cy: 0.42, pins: 6, stars: 60 });
    });
  });
  const start = () => {
    mo.observe(document.getElementById('stage'), { childList: true, subtree: true });
    decorate(document.getElementById('stage'));
    const intro = document.getElementById('fx-intro');
    if (intro) setTimeout(() => { intro.classList.add('out'); setTimeout(() => intro.remove(), 900); }, RM ? 0 : 900);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();

  /* toasts slide in with spring (they're appended to #toast-host) */
  const th = document.getElementById('toast-host');
  if (th) new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => n.classList && n.classList.add('fx-toast')))).observe(th, { childList: true });

  window.LocalLinkFX = { makeScene };
})();
