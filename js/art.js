// Shared palette, the one scene light, and the lithographed tin can (machine, reveal, roster).
// Everything metal is shaded from LIGHT in world space; ink keylines exist only inside printed labels.
window.ART = (() => {
  const C = {
    INK: '#1c1b1f', TIN: '#d9dcdf', STEEL: '#8f969e', WHITE: '#ffffff',
    TOMATO: '#e2372c', COBALT: '#2447b5', MUSTARD: '#f3b21b', MINT: '#46b089',
    PLUM: '#7a3e8e', ORANGE: '#ef7d22', TEAL: '#1f97ad',
    NIGHT: '#0e0d10', WALL: '#f2f1ee', PAPER: '#fbf8f1', LAMP: '#ffe9c4', TIN_HI: '#f4f5f6', TIN_LO: '#3a3f45',
  };
  // one printed ink per group (pockets on the wheel, swatches, tickets)
  const GROUP = [
    { bg: C.TOMATO, fg: C.WHITE }, { bg: C.COBALT, fg: C.WHITE }, { bg: C.MUSTARD, fg: C.INK }, { bg: C.MINT, fg: C.INK },
    { bg: C.INK, fg: C.WHITE }, { bg: C.PLUM, fg: C.WHITE }, { bg: C.ORANGE, fg: C.INK }, { bg: C.TEAL, fg: C.WHITE },
  ];
  // label systems; each student always gets the same one (hashed from the name)
  const LABELS = [
    { kind: 'field', bg: C.TOMATO, band: C.PAPER, text: C.PAPER, sub: C.MUSTARD, back: C.PAPER },
    { kind: 'paper', bg: C.PAPER, band: C.COBALT, text: C.INK, sub: C.COBALT, back: C.INK },
    { kind: 'cartouche', bg: C.COBALT, band: C.MUSTARD, panel: C.PAPER, text: C.INK, sub: C.TOMATO, back: C.MUSTARD },
    { kind: 'halftone', bg: C.MUSTARD, band: C.TOMATO, text: C.INK, sub: C.TOMATO, back: C.INK },
    { kind: 'tin', bg: C.TIN, bare: true, band: C.INK, text: C.INK, sub: C.INK, back: C.INK },
    { kind: 'field', bg: C.INK, band: C.MUSTARD, text: C.MUSTARD, sub: C.PAPER, back: C.MUSTARD },
    { kind: 'band', bg: C.MINT, band: C.PAPER, panel: C.PAPER, text: C.INK, sub: C.COBALT, back: C.INK },
  ];
  const TAU = Math.PI * 2;
  const unit = (x, y, z) => { const n = Math.hypot(x, y, z); return Object.freeze({ x: x / n, y: y / n, z: z / n }); };
  const LIGHT = unit(-.35, -.8, .5);                        // the marquee lamp: upper left, in front of the glass
  const HALF = unit(LIGHT.x, LIGHT.y, LIGHT.z + 1);         // half vector for a viewer square to the glass
  const E = .24;                                            // sin(camera elevation): how much lid an upright can shows
  const SLAB = '"Alfa Slab One", Rockwell, Georgia, serif';
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const bell = (d, w) => Math.exp(-(d / w) * (d / w));
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

  function hash(s) {
    let h = 2166136261;
    for (const ch of s) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function canStyle(name) {
    const h = hash(name.trim().toLowerCase());
    return { label: h % LABELS.length, lot: String(10 + (h >>> 7) % 90) };
  }
  function splitName(n) {
    const p = n.trim().split(/\s+/);
    return p.length === 1 ? [p[0], ''] : [p[0], p.slice(1).join(' ')];
  }
  function rr(g, x, y, w, h, r) {
    g.beginPath();
    if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h);
  }
  // kept for older callers; nothing in the new look draws stars
  function star(g, x, y, R, r = R * .45) {
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 5, rad = i % 2 ? r : R;
      g.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
    }
    g.closePath();
  }
  function rng(seed) {
    let a = seed >>> 0;
    return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  // ---------- light ----------
  const rgbOf = s => [1, 3, 5].map(i => parseInt(s.slice(i, i + 2), 16));
  const LO = rgbOf(C.TIN_LO), LAMPC = rgbOf(C.LAMP);
  const HIW = rgbOf(C.TIN_HI).map((v, i) => v * (.55 + .45 * LAMPC[i] / 255));   // lit tin takes the lamp's warmth
  const GLINT = [255, 250, 240];
  const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const css = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${+a.toFixed(3)})`;
  const tinRGB = f => { f = clamp(f, 0, 1.2); return f <= 1 ? mixc(LO, HIW, f) : mixc(HIW, GLINT, (f - 1) / .2); };

  // Shading across a cylinder whose +u side points along world angle q/256 turns. Cached, context free.
  const PROF = new Map();
  function profile(q, lq) {
    const key = q * 21 + lq; let p = PROF.get(key); if (p) return p;
    const an = q / 256 * TAU, ex = Math.cos(an), ey = Math.sin(an), lit = lq / 20;
    const k = LIGHT.x * ex + LIGHT.y * ey, kh = HALF.x * ex + HALF.y * ey, ha = HALF.y * ex - HALF.x * ey;
    const str = .3 + .7 * Math.pow(Math.max(0, 1 - ha * ha), 3);   // weaker streak when the lamp sits along the axis
    const us = kh / Math.hypot(kh, HALF.z);
    const diff = u => Math.max(0, u * k + Math.sqrt(Math.max(0, 1 - u * u)) * LIGHT.z);
    const U = [-1, -.93, -.8, -.6, -.35, 0, .35, .6, .8, .93, 1];
    for (const d of [-.3, -.14, -.05, 0, .05, .14, .3]) if (us + d > -1 && us + d < 1) U.push(us + d);
    U.sort((a, b) => a - b);
    const metal = [], shade = [], gloss = [];
    for (const u of U) {
      const o = (u + 1) / 2, e = Math.abs(u), dd = diff(u), du = u - us;
      // tin mostly mirrors a dark room: a dim body, one hard streak of lamp, a softer bloom round it
      const sp = str * lit * (bell(du, .05) + .32 * bell(du, .22));
      metal.push([o, css(mixc(tinRGB((.1 + .6 * lit * dd) * (1 - .45 * Math.pow(e, 6))), GLINT, Math.min(1, sp)))]);
      shade.push([o, `rgba(0,0,0,${clamp(1 - (.2 + 1.25 * lit * dd) * (1 - .55 * Math.pow(e, 7)), 0, .92).toFixed(3)})`]);
      gloss.push([o, `rgba(255,247,232,${Math.min(.6, .36 * str * lit * (bell(du, .1) + .35 * bell(du, .32))).toFixed(3)})`]);
    }
    p = { k, us, str, metal, shade, gloss };
    PROF.set(key, p); return p;
  }
  function stops(gr, list) { for (const [o, c] of list) gr.addColorStop(clamp(o, 0, 1), c); return gr; }
  const lin = (g, hw, list) => stops(g.createLinearGradient(-hw, 0, hw, 0), list);

  // current transform: world directions of the local axes, device pixels per unit, screen position
  const FR = { a: 1, b: 0, c: 0, d: 1, xx: 1, xy: 0, sc: 1, mir: 0, e: 0, f: 0, ok: false };
  function frame(g) {
    const m = typeof g.getTransform === 'function' ? g.getTransform() : null;
    const ok = !!m && typeof m.a === 'number' && isFinite(m.a);
    const a = ok ? m.a : 1, b = ok ? m.b : 0, c = ok ? m.c : 0, d = ok ? m.d : 1;
    const sx = Math.hypot(a, b) || 1, sy = Math.hypot(c, d) || 1;
    FR.a = a; FR.b = b; FR.c = c; FR.d = d; FR.xx = a / sx; FR.xy = b / sx;
    FR.sc = Math.sqrt(sx * sy) || 1; FR.mir = a * d - b * c < 0 ? 1 : 0; FR.e = ok ? m.e : 0; FR.f = ok ? m.f : 0; FR.ok = ok;
    return FR;
  }
  const alphaOf = g => (typeof g.globalAlpha === 'number' && isFinite(g.globalAlpha) ? g.globalAlpha : 1);
  const quant = an => ((Math.round(an / TAU * 256) % 256) + 256) % 256;

  // per-context gradients: built in local units, so one set serves every can of that size and angle
  const GC = new WeakMap();
  function grads(g, q, lq, mir, hw) {
    let m = GC.get(g); if (!m) GC.set(g, m = new Map());
    const key = ((q * 21 + lq) * 2 + mir) * 4096 + Math.min(4095, Math.round(hw * 8));
    let r = m.get(key); if (r) return r;
    if (m.size > 1200) m.clear();
    const p = profile(q, lq), an = q / 256 * TAU, lit = lq / 20, fl0 = mir ? -1 : 1;
    const cu = fl0 * Math.cos(an), s = cu >= 0 ? 1 : -1;
    const dCap = s * fl0 * (LIGHT.x * Math.sin(an) - LIGHT.y * Math.cos(an));   // lamp on the lid that faces up
    const fl = .1 + .72 * lit * Math.max(0, dCap), sg = p.k < 0 ? 1 : -1, up = Math.max(0, dCap), dn = Math.max(0, -dCap);
    r = {
      k: p.k, s, cu, metal: lin(g, hw, p.metal), shade: lin(g, hw, p.shade), gloss: lin(g, hw, p.gloss),
      lid: lin(g, hw, [[0, css(tinRGB(fl * (1 + .13 * sg)))], [.5, css(tinRGB(fl))], [1, css(tinRGB(fl * (1 - .13 * sg)))]]),
      capTone: up ? `rgba(255,246,230,${(.2 * lit * up).toFixed(3)})` : `rgba(0,0,0,${(.3 * dn).toFixed(3)})`,
      baseTone: `rgba(0,0,0,${(.08 + .26 * up).toFixed(3)})`,
      crestA: `rgba(255,250,240,${(.18 + .45 * lit * up).toFixed(3)})`, crestB: `rgba(255,250,240,${(.1 + .22 * lit * dn).toFixed(3)})`,
      sheen: (() => { const gr = g.createRadialGradient(-hw * .3 * sg, -hw * .45 * s, 0, -hw * .3 * sg, -hw * .45 * s, hw * .95);
        gr.addColorStop(0, `rgba(255,244,222,${(.34 * lit * up).toFixed(3)})`); gr.addColorStop(1, 'rgba(255,244,222,0)'); return gr; })(),
      edge: `rgba(255,244,226,${(.12 + .3 * lit).toFixed(3)})`, groove: `rgba(0,0,0,${(.22 + .12 * lit).toFixed(3)})`,
      wall: `rgba(255,248,236,${(.08 + .2 * lit * up).toFixed(3)})`, crescent: `rgba(255,250,240,${(.2 + .5 * lit * up).toFixed(3)})`,
    };
    m.set(key, r); return r;
  }

  // ---------- metal helpers for the rest of the scene ----------
  // lit metal gradient across a rolled surface from (x0,y0) to (x1,y1), shaded from LIGHT whatever the transform
  function metalGrad(g, x0, y0, x1, y1, o = {}) {
    const F = frame(g), dx = x1 - x0, dy = y1 - y0;
    const q = quant(Math.atan2(F.b * dx + F.d * dy, F.a * dx + F.c * dy));
    return stops(g.createLinearGradient(x0, y0, x1, y1), profile(q, Math.round(clamp(o.lit == null ? 1 : o.lit, 0, 1) * 20)).metal);
  }
  const tinGrad = (g, x0, x1, o) => metalGrad(g, x0, 0, x1, 0, o);
  // a domed rivet head: lit toward the lamp, seated in its own soft shadow, no outline
  function rivet(g, x, y, r) {
    r = Math.max(.2, r);
    const F = frame(g), det = F.a * F.d - F.b * F.c || 1;
    let lx = (F.d * LIGHT.x - F.c * LIGHT.y) / det, ly = (-F.b * LIGHT.x + F.a * LIGHT.y) / det;
    const n = Math.hypot(lx, ly) || 1; lx /= n; ly /= n;
    const sa = Math.atan2(-ly, -lx);
    g.beginPath(); g.arc(x, y, r * 1.16, sa - 1.35, sa + 1.35);
    g.lineWidth = r * .36; g.strokeStyle = 'rgba(0,0,0,.3)'; g.stroke();
    const gr = g.createRadialGradient(x + lx * r * .42, y + ly * r * .42, r * .05, x - lx * r * .1, y - ly * r * .1, r * 1.05);
    gr.addColorStop(0, '#fffaf0'); gr.addColorStop(.22, '#d6d8da'); gr.addColorStop(.68, '#7b8289'); gr.addColorStop(1, C.TIN_LO);
    g.beginPath(); g.arc(x, y, r, 0, TAU); g.fillStyle = gr; g.fill();
    g.beginPath(); g.arc(x, y, r * .8, sa - .8, sa + .8); g.lineWidth = r * .12; g.strokeStyle = 'rgba(255,238,210,.2)'; g.stroke();
  }

  // ---------- printed label textures ----------
  const TEX = new Map(), TIERS = [2, 4, 8], TEX_LIMIT = 16e6;
  let texPx = 0, fontGen = 0, budT = -1e9, bud = 0, mcv = null;
  function spend() { const t = now(); if (t - budT > 12) { budT = t; bud = 3; } return bud-- > 0; }
  function meas() { if (!mcv) mcv = document.createElement('canvas').getContext('2d'); return mcv; }
  try {
    const fs = typeof document !== 'undefined' && document.fonts;
    if (fs) {
      if (fs.addEventListener) fs.addEventListener('loadingdone', () => fontGen++);
      if (fs.load) fs.load(`40px ${SLAB}`).then(() => fontGen++, () => {});
    }
  } catch (e) { /* fonts API missing: the fallback face stays */ }

  function slab(t, str, x, yc, maxW, fs, minFs, col, squeeze) {
    if (!str) return;
    t.font = `${fs}px ${SLAB}`;
    let tw = t.measureText(str).width || 1, sx = 1;
    if (tw > maxW) {
      sx = Math.max(squeeze, maxW / tw);                 // condense first, as a sign writer would
      if (tw * sx > maxW) { fs = Math.max(minFs, fs * maxW / (tw * sx)); t.font = `${fs}px ${SLAB}`; tw = t.measureText(str).width || 1; sx = clamp(maxW / tw, .6, 1); }
    }
    t.save(); t.translate(x, yc + fs * .35); t.scale(sx, 1); t.fillStyle = col; t.fillText(str, 0, 0); t.restore();
  }
  // tinted areas are a real 45 degree screen: dots swell into solid toward the edge of the label
  function halftone(t, P, lh, col) {
    const p = Math.max(.8, lh * .05), depth = lh * .27, rM = p * .52;
    t.fillStyle = col; t.beginPath();
    for (let j = 0; j * p / 2 <= depth; j++) {
      const yy = j * p / 2, r = rM * Math.pow(1 - yy / depth, .85);
      if (r < p * .06) continue;
      for (let x = (j & 1) * p / 2; x <= P + p; x += p) { t.moveTo(x + r, yy); t.arc(x, yy, r, 0, TAU); t.moveTo(x + r, lh - yy); t.arc(x, lh - yy, r, 0, TAU); }
    }
    t.fill();
  }
  // uneven ink film on solid fields
  function mottle(t, P, lh, seed) {
    const R = rng(seed ^ 0x5bd1e995);
    t.save(); t.globalCompositeOperation = 'source-atop';
    for (let i = 0; i < 6; i++) {
      const x = R() * P, y = R() * lh, r = lh * (.3 + R() * .5), dark = R() < .5, gr = t.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, dark ? 'rgba(0,0,0,.05)' : 'rgba(255,255,255,.05)'); gr.addColorStop(1, dark ? 'rgba(0,0,0,0)' : 'rgba(255,255,255,0)');
      t.fillStyle = gr; t.fillRect(x - r, y - r, r * 2, r * 2);
    }
    t.restore();
  }
  // handling marks differ per copy of a can: scratches to bright tin, rubbed edges, now and then a dent
  function wear(t, P, lh, w, cx, seed) {
    const R = rng(seed);
    t.lineCap = 'round';
    for (let i = 0, n = 8 + (R() * 14 | 0); i < n; i++) {
      const x = R() * P, y = R() * lh, len = 1 + R() * 4.5, a = (R() - .5) * .8 + (R() < .3 ? 1.2 : 0);
      t.strokeStyle = `rgba(255,252,245,${(.1 + R() * .18).toFixed(2)})`; t.lineWidth = .15 + R() * .2;
      t.beginPath(); t.moveTo(x, y); t.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len); t.stroke();
    }
    t.globalCompositeOperation = 'destination-out';
    for (let side = 0; side < 2; side++) for (let x = 0; x < P; x += 1.2) {
      const p = R(); if (p < .68) continue;
      const hg = .25 + R() * (p > .92 ? 1.3 : .6);
      t.globalAlpha = .45 + R() * .5; t.fillRect(x, side ? lh - hg : 0, 1.2 + R() * 1.6, hg);
    }
    t.globalAlpha = 1; t.globalCompositeOperation = 'source-over';
    if (R() < .45) {
      const x = cx + (R() - .5) * w * 1.3, y = lh * (.25 + R() * .5), r = w * (.05 + R() * .04);
      for (const [ox, oy, col] of [[-.3, -.35, '0,0,0'], [.3, .35, '255,250,240']]) {
        const gr = t.createRadialGradient(x + ox * r, y + oy * r, 0, x + ox * r, y + oy * r, r);
        gr.addColorStop(0, `rgba(${col},.16)`); gr.addColorStop(1, `rgba(${col},0)`);
        t.fillStyle = gr; t.fillRect(x - r * 1.4, y - r * 1.4, r * 2.8, r * 2.8);
      }
    }
  }
  // The whole label, flat, one circumference wide (name centred at u = .5, side seam at u = 0).
  function paint(t, L, P, lh, w, FU, RU, lot, h32, v, cr) {
    const Y = f => f * lh, cx = P / 2, INK = C.INK, panel = L.kind === 'band' || L.kind === 'cartouche';
    const mx = ((h32 >>> 3) % 5 - 2) * .16, my = ((h32 >>> 6) % 5 - 2) * .16;   // key plate lands a hair off register
    const key = fn => { t.save(); t.translate(mx, my); fn(); t.restore(); };
    const bar = (y, th, col) => { t.fillStyle = col; t.fillRect(-1, Y(y), P + 2, Y(th)); };
    const bars = (y, th, col) => { bar(y, th, col); bar(1 - y - th, th, col); };
    t.save(); t.beginPath(); t.rect(0, 0, P, lh); t.clip();
    t.textAlign = 'center'; t.textBaseline = 'alphabetic';
    if (!L.bare) { t.fillStyle = L.bg; t.fillRect(0, 0, P, lh); mottle(t, P, lh, h32); }
    let pw = 0;
    if (L.kind === 'field') { bars(.075, .03, L.band); bars(.128, .012, L.band); key(() => bars(0, .02, INK)); }
    else if (L.kind === 'paper') { bars(0, .15, L.band); key(() => { bars(.185, .022, INK); bars(.222, .008, INK); }); }
    else if (L.kind === 'halftone') { halftone(t, P, lh, L.band); bars(0, .035, L.band); key(() => bars(0, .012, INK)); }
    else if (L.kind === 'tin') key(() => { bars(.025, .035, INK); bars(.095, .01, INK); });
    else if (L.kind === 'cartouche') bars(.07, .012, L.band);
    else if (L.kind === 'band') bars(.085, .012, L.band);
    if (L.kind === 'band' || (L.kind === 'cartouche' && cr)) {
      bar(.22, .56, L.panel); key(() => { bar(.22, .012, INK); bar(.768, .012, INK); });
    } else if (L.kind === 'cartouche') {
      pw = Math.min(w * 1.3, P * .42);
      const x0 = cx - pw / 2, x1 = cx + pw / 2, y0 = Y(.19), y1 = Y(.81), c = Y(.09);
      const oct = i => {
        const X0 = x0 + i, X1 = x1 - i, Y0 = y0 + i, Y1 = y1 - i, k = c - i * .414;
        t.beginPath(); t.moveTo(X0 + k, Y0); t.lineTo(X1 - k, Y0); t.lineTo(X1, Y0 + k); t.lineTo(X1, Y1 - k);
        t.lineTo(X1 - k, Y1); t.lineTo(X0 + k, Y1); t.lineTo(X0, Y1 - k); t.lineTo(X0, Y0 + k); t.closePath();
      };
      oct(0); t.fillStyle = L.panel; t.fill();
      key(() => { oct(Y(.035)); t.lineWidth = Y(.012); t.strokeStyle = INK; t.stroke(); });
    }
    if (cr) {
      // carried: the name runs round the can in big type, so only a few letters face the room at once
      t.font = `${cr.cfs}px ${SLAB}`; t.textAlign = 'left'; t.fillStyle = L.text;
      const yb = Y(.5) + cr.cfs * .35;
      const run = () => { let x = cx - cr.wn / 2; for (const ch of cr.full) { t.fillText(ch, x, yb); x += t.measureText(ch).width + cr.track; } };
      if (L.text === INK) key(run); else run();
      t.textAlign = 'center';
    } else {
      const maxW = pw ? pw - Y(.16) : w * 1.12;
      const first = () => slab(t, FU, cx, Y(RU ? (panel ? .44 : .43) : .5), maxW, lh * (panel ? .3 : .36), lh * .14, L.text, .78);
      if (L.text === INK) key(first); else first();
      if (RU) { const sub = () => slab(t, RU, cx, Y(panel ? .66 : .67), maxW * .96, lh * .15, lh * .08, L.sub, .7); if (L.sub === INK) key(sub); else sub(); }
      t.globalAlpha = .85; slab(t, 'No ' + lot, P * .085, Y(.5), w * .5, lh * .12, lh * .08, L.back, .9); t.globalAlpha = 1;
    }
    // side seam: an unprinted strip of tin where the body sheet laps over itself
    t.clearRect(-1, -1, 1.45, lh + 2); t.clearRect(P - .45, -1, 1.45, lh + 2);
    t.fillStyle = 'rgba(0,0,0,.3)'; t.fillRect(P - .2, 0, .22, lh);
    t.fillStyle = 'rgba(255,255,255,.22)'; t.fillRect(.08, 0, .16, lh);
    wear(t, P, lh, w, cx, (h32 + Math.imul(v + 1, 0x9e3779b1)) >>> 0);
    t.globalCompositeOperation = L.bare ? 'source-atop' : 'multiply';     // warm varnish over the print
    t.fillStyle = 'rgba(255,214,150,.1)'; t.fillRect(0, 0, P, lh);
    t.restore();
  }
  function make(L, name, lot, w, lh, v, carry, dWant) {
    const [F, R] = splitName(name || ' ');
    const FU = F.toUpperCase(), RU = R.toUpperCase(), h32 = hash(name.trim().toLowerCase());
    let P = Math.PI * w, cr = null;
    if (carry) {
      const full = RU ? FU + ' ' + RU : FU, cfs = lh * (L.kind === 'band' || L.kind === 'cartouche' ? .4 : .5), m = meas();
      const n = Math.max(1, [...full].length - 1);
      m.font = `${cfs}px ${SLAB}`;
      let track = cfs * .08, wn = (m.measureText(full).width || 0) + track * n;
      if (wn < w * 1.1) { track += (w * 1.1 - wn) / n; wn = w * 1.1; }
      P = Math.max(P, wn + w * .9); cr = { full, cfs, track, wn };
    }
    const d = Math.max(.5, Math.min(dWant, 4096 / (P * 1.06), 2048 / lh));
    const per = P * d, W = Math.ceil(per * 1.06) + 1, H = Math.max(1, Math.ceil(lh * d));
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const t = cv.getContext('2d');
    t.setTransform(d, 0, 0, d, 0, 0);
    paint(t, L, P, lh, w, FU, RU, lot, h32, v, cr);
    t.setTransform(1, 0, 0, 1, 0, 0); t.globalCompositeOperation = 'source-over'; t.globalAlpha = 1;
    t.drawImage(cv, 0, 0, W - per, H, per, 0, W - per, H);        // wrap margin: the period's start again after its end
    return { cv, per, P, d, gen: fontGen, px: W * H };
  }
  function evict(keep) {
    for (const [k, e] of TEX) {
      if (texPx <= TEX_LIMIT) break;
      if (k === keep) continue;
      for (const t of e) if (t) { texPx -= t.px; t.cv.width = 0; }
      TEX.delete(k);
    }
  }
  // cached per (label, name, w, h, copy); resolution follows the zoom, upgraded a few per frame
  function texFor(can, name, li, lot, w, lh, carry, need) {
    const v = Math.abs(can.copy != null ? can.copy | 0 : can.body && can.body.id != null ? can.body.id | 0 : 0) % 3;
    const key = `${li}|${name}|${w}|${lh}|${v}${carry ? '|c' : ''}`;
    let e = TEX.get(key);
    if (e) TEX.delete(key); else e = [null, null, null];
    TEX.set(key, e);
    const want = need <= 2.2 ? 0 : need <= 4.4 ? 1 : 2;
    for (let i = want; i < 3; i++) if (e[i] && e[i].gen === fontGen) return e[i];
    let t = e[want];
    if (!t) for (let i = 2; i >= 0; i--) if (e[i]) { t = e[i]; break; }
    if (t && !spend()) return t;
    const i = t ? want : Math.min(want, 1);
    if (e[i]) { texPx -= e[i].px; e[i].cv.width = 0; }
    t = e[i] = make(LABELS[li], name, lot, w, lh, v, carry, TIERS[i]); t.key = key;
    texPx += t.px; if (texPx > TEX_LIMIT) evict(key);
    return t;
  }

  // ---------- the can ----------
  // half ellipse centred (0, cy), bulging toward +y when dir > 0, traced left to right when ltr
  function half(g, cy, rx, ry, dir, ltr) {
    if (dir > 0) g.ellipse(0, cy, rx, ry, 0, ltr ? Math.PI : 0, ltr ? 0 : Math.PI, ltr);
    else g.ellipse(0, cy, rx, ry, 0, ltr ? Math.PI : TAU, ltr ? TAU : Math.PI, !ltr);
  }
  function band(g, y0, y1, hw, ry, s) {
    g.beginPath(); g.moveTo(-hw, y0); half(g, y0, hw, ry, s, true); g.lineTo(hw, y1); half(g, y1, hw, ry, s, false); g.closePath();
  }
  function dropShadow(g, ang, w, h) {
    const c = Math.abs(Math.cos(ang)), s = Math.abs(Math.sin(ang));
    const ex = w / 2 * c + h / 2 * s, ey = w / 2 * s + h / 2 * c, rx = ex * 1.15, ry = Math.max(2.5, w * .12);
    g.save(); g.translate(ex * .16, ey - ry * .3); g.scale(1, ry / rx);   // falls right and back, away from the lamp
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, rx);
    gr.addColorStop(0, 'rgba(10,9,12,.42)'); gr.addColorStop(.45, 'rgba(10,9,12,.2)'); gr.addColorStop(1, 'rgba(10,9,12,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, rx, 0, TAU); g.fill(); g.restore();
  }

  const labelH = (w, h) => h * .844 - w * E * .6;
  // The can in its own frame (axis along y), shaded by the lighting set R that was chosen for its world pose.
  function paintCan(g, L, T, w, h, R, sc, u0, rim) {
    const hw = w / 2, hh = h / 2, s = R.s, ryM = hw * E, ry = Math.max(.01, ryM * Math.abs(R.cu)), hp = hh - ryM * .6;
    const seam = h * .05, ly0 = -hp + seam + h * .028, capY = -s * hp, baseY = s * hp, ga = alphaOf(g);
    const lh = 2 * -ly0, px = w * sc, upr = hw / T.P, n = px < 28 ? 10 : px < 70 ? 16 : px < 140 ? 24 : px < 260 ? 36 : 48;
    const dt = Math.PI / n, ov = .8 / sc, sw = dt * upr * T.per, thin = Math.max(.5 / sc, h * .01), fine = px > 22;
    const outline = () => { g.beginPath(); g.moveTo(-hw, capY); half(g, capY, hw, ry, -s, true); g.lineTo(hw, baseY); half(g, baseY, hw, ry, s, false); g.closePath(); };
    outline(); g.fillStyle = R.metal; g.fill();
    // printed label, wrapped: equal steps of turn, so the print crowds together toward the silhouette.
    // Held a hair inside the silhouette: image edges are not antialiased, the shading that covers them is.
    const lr = hw - .9 / sc;
    let xa = -lr;
    for (let i = 0; i < n; i++) {
      const t0 = -Math.PI / 2 + i * dt, xb = i === n - 1 ? lr : lr * Math.sin(t0 + dt);
      let u = u0 + t0 * upr; u -= Math.floor(u);
      g.drawImage(T.cv, u * T.per, 0, sw, T.cv.height, xa, ly0 + s * ry * Math.cos(t0 + dt / 2), xb - xa + (i < n - 1 ? ov : 0), lh);
      xa = xb;
    }
    // lamp and varnish over the print (bare tin is already shaded underneath, and its ink is black)
    band(g, ly0, -ly0, hw, ry, s);
    if (!L.bare) { g.fillStyle = R.shade; g.fill(); }
    g.globalAlpha = ga * (L.bare ? .5 : 1); g.fillStyle = R.gloss; g.fill(); g.globalAlpha = ga;
    if (fine && !L.bare) {
      g.lineWidth = thin * .8; g.strokeStyle = 'rgba(0,0,0,.2)';
      g.beginPath(); g.moveTo(-hw, ly0); half(g, ly0, hw, ry, s, true); g.moveTo(-hw, -ly0); half(g, -ly0, hw, ry, s, true); g.stroke();
    }
    // double seams: the end nearer the lamp catches it, the far end sits in its own shade
    band(g, capY, capY + s * seam, hw, ry, s); g.fillStyle = R.capTone; g.fill();
    band(g, baseY - s * seam, baseY, hw, ry, s); g.fillStyle = R.baseTone; g.fill();
    if (fine) {
      g.lineWidth = Math.max(.5 / sc, h * .014);
      g.beginPath(); g.moveTo(-hw, capY + s * seam * .45); half(g, capY + s * seam * .45, hw, ry, s, true); g.strokeStyle = R.crestA; g.stroke();
      g.beginPath(); g.moveTo(-hw, baseY - s * seam * .55); half(g, baseY - s * seam * .55, hw, ry, s, true); g.strokeStyle = R.crestB; g.stroke();
    }
    // the lid on whichever end faces up
    if (ry * sc > .9) {
      g.beginPath(); g.ellipse(0, capY, hw, ry, 0, 0, TAU); g.fillStyle = R.lid; g.fill();
      g.save(); g.translate(0, capY); g.scale(1, ry / hw); g.fillStyle = R.sheen; g.beginPath(); g.arc(0, 0, hw, 0, TAU); g.fill(); g.restore();
      if (ry * sc > 2) {
        g.lineWidth = Math.max(.9 / sc, w * .028); g.strokeStyle = R.groove;
        g.beginPath(); g.ellipse(0, capY, hw * .84, ry * .84, 0, 0, TAU); g.stroke();                 // countersink
        g.lineWidth = Math.max(.6 / sc, w * .012); g.strokeStyle = R.wall;
        g.beginPath(); g.moveTo(-hw * .79, capY); half(g, capY, hw * .79, ry * .79, s, true); g.stroke();
        g.lineWidth = Math.max(.7 / sc, w * .02); g.strokeStyle = R.crescent;
        g.beginPath(); g.moveTo(-hw * .955, capY); half(g, capY, hw * .955, ry * .955, -s, true); g.stroke();   // seam crest, far side
        g.lineWidth = thin; g.strokeStyle = 'rgba(0,0,0,.26)';
        g.beginPath(); g.moveTo(-hw, capY); half(g, capY, hw, ry, s, true); g.stroke();
        if (px > 80) for (const k of [.6, .38]) {
          g.lineWidth = thin * .8;
          g.strokeStyle = 'rgba(0,0,0,.1)'; g.beginPath(); g.moveTo(-hw * k, capY); half(g, capY, hw * k, ry * k, -s, true); g.stroke();
          g.strokeStyle = 'rgba(255,250,240,.12)'; g.beginPath(); g.moveTo(-hw * k, capY); half(g, capY, hw * k, ry * k, s, true); g.stroke();
        }
      }
    }
    // the edge that faces the lamp
    if (Math.abs(R.k) > .04) {
      const lw = .75 / sc, xs = (R.k < 0 ? -1 : 1) * (hw - lw / 2);
      g.beginPath(); g.moveTo(xs, capY); g.lineTo(xs, baseY); g.lineWidth = lw; g.strokeStyle = R.edge; g.stroke();
    }
    if (rim > 0) rimLight(g, w, h, R, sc, rim);
  }
  // warm rim on the lamp side; additive, so it can go over a cached sprite as well
  function rimLight(g, w, h, R, sc, rim) {
    const hw = w / 2, s = R.s, ryM = hw * E, ry = Math.max(.01, ryM * Math.abs(R.cu)), hp = h / 2 - ryM * .6, capY = -s * hp, baseY = s * hp;
    const xs = R.k < 0 ? -hw : hw, dir = R.k < 0 ? 1 : -1, gr = g.createLinearGradient(xs, 0, xs + dir * w * .22, 0), lw = 1.5 / sc;
    gr.addColorStop(0, `rgba(255,217,154,${(.6 * rim).toFixed(3)})`); gr.addColorStop(1, 'rgba(255,217,154,0)');
    g.save(); g.globalCompositeOperation = 'lighter';
    g.beginPath(); g.moveTo(-hw, capY); half(g, capY, hw, ry, -s, true); g.lineTo(hw, baseY); half(g, baseY, hw, ry, s, false); g.closePath();
    g.fillStyle = gr; g.fill();
    g.strokeStyle = `rgba(255,217,154,${rim.toFixed(3)})`; g.lineWidth = lw;
    g.beginPath(); g.moveTo(xs + dir * lw / 2, capY); g.lineTo(xs + dir * lw / 2, baseY); g.stroke();
    if (ry * sc > 1) { g.beginPath(); g.moveTo(-hw, capY); half(g, capY, hw, ry, -s, true); g.globalAlpha = alphaOf(g) * .7; g.stroke(); }
    g.restore();
  }

  // A can that holds still is painted once into a sprite at its pose and light, then only blitted.
  const SPR = new Map(), SEEN = new WeakMap(), STIERS = [1, 1.5, 2, 3, 4, 6, 8];
  let sprT = -1e9, sprBud = 0;
  function spendSprite() { const t = now(); if (t - sprT > 12) { sprT = t; sprBud = 8; } return sprBud-- > 0; }
  function sprite(L, T, w, h, q, lq, mir, ts, spinQ) {
    const key = `${T.key}|${q}|${mir}|${lq}|${ts}|${spinQ}|${h}`;
    let s = SPR.get(key);
    if (s && s.T === T) { SPR.delete(key); SPR.set(key, s); return s; }
    if (!spendSprite()) return null;
    const SW = Math.ceil(w * ts) + 4, SH = Math.ceil((h + w * E) * ts) + 4, cv = s ? s.cv : document.createElement('canvas');
    cv.width = SW; cv.height = SH;
    const t = cv.getContext('2d');
    t.setTransform(ts, 0, 0, ts, SW / 2, SH / 2);
    paintCan(t, L, T, w, h, grads(t, q, lq, mir, w / 2), ts, .5 + spinQ / 128 * Math.PI * w / T.P, 0);
    s = { cv, T, ox: SW / 2 / ts, oy: SH / 2 / ts, sw: SW / ts, sh: SH / ts };
    SPR.delete(key); SPR.set(key, s);
    if (SPR.size > 260) for (const [k, v] of SPR) { if (SPR.size <= 200) break; if (k !== key) { v.cv.width = 0; SPR.delete(k); } }
    return s;
  }

  // Draw one tin can centred at (x, y), rotated by ang.
  // o: squash 0..1, shadow, spin 0..1 (0 = name to the front, .5 = back), labelShift (scrolls a big printed
  // name round the can while it is carried), rim 0..1 (warm rim light), lit 0..1 (how much lamp reaches it).
  function drawCan(g, can, x, y, ang, w, h, o) {
    if (!can || !(w > 0 && h > 0)) return;
    o = o || {};
    ang = +ang || 0;
    const sq = clamp(+o.squash || 0, 0, 1), lit = clamp(o.lit == null ? 1 : +o.lit || 0, 0, 1), rim = clamp(+o.rim || 0, 0, 1);
    g.save(); g.translate(x, y);
    if (o.shadow) dropShadow(g, ang, w * (1 + sq * .55), h * (1 - sq * .72));
    g.rotate(ang);
    if (sq) g.scale(1 + sq * .55, 1 - sq * .72);
    const F = frame(g), sc = F.sc, cv = g.canvas;
    if (F.ok && cv && typeof cv.width === 'number') {
      const rad = Math.hypot(w, h) * .62 * sc + 4;
      if (F.e < -rad || F.f < -rad || F.e > cv.width + rad || F.f > cv.height + rad) { g.restore(); return; }
    }
    const name = String(can.name == null ? '' : can.name), st = can.label == null || can.lot == null ? canStyle(name) : null;
    const li = ((st ? st.label : can.label | 0) % LABELS.length + LABELS.length) % LABELS.length, L = LABELS[li], lot = st ? st.lot : can.lot;
    const q = quant(Math.atan2(F.xy, F.xx)), lq = Math.round(lit * 20), mir = F.mir, lh = labelH(w, h);
    const carry = typeof o.labelShift === 'number' && isFinite(o.labelShift), spin = +o.spin || 0;
    if (!carry && !sq && typeof can === 'object') {
      const ts = STIERS.find(v => v >= sc * .98) || 8;
      const spinQ = ((Math.round((spin - Math.floor(spin)) * 128) % 128) + 128) % 128;
      const sk = `${q}|${mir}|${ts}|${spinQ}|${w}|${h}`;
      let seen = SEEN.get(can);
      if (!seen) SEEN.set(can, seen = { k: '', n: 0 });
      if (seen.k === sk) seen.n++; else { seen.k = sk; seen.n = 0; }
      if (seen.n >= 2) {
        // lamp partly on: cross-fade the unlit sprite into the lit one
        const T = texFor(can, name, li, lot, w, lh, false, sc), ga = alphaOf(g);
        const a = lit < 1 ? sprite(L, T, w, h, q, 0, mir, ts, spinQ) : null, b = lit > 0 ? sprite(L, T, w, h, q, 20, mir, ts, spinQ) : null;
        if ((lit === 1 || a) && (lit === 0 || b)) {
          if (a) g.drawImage(a.cv, -a.ox, -a.oy, a.sw, a.sh);
          if (b) { g.globalAlpha = ga * (a ? lit : 1); g.drawImage(b.cv, -b.ox, -b.oy, b.sw, b.sh); g.globalAlpha = ga; }
          if (rim > 0) rimLight(g, w, h, grads(g, q, 20, mir, w / 2), sc, rim);
          g.restore(); return;
        }
      }
    }
    const T = texFor(can, name, li, lot, w, lh, carry, sc), R = grads(g, q, lq, mir, w / 2);
    const u0 = .5 + spin * Math.PI * w / T.P + (carry ? o.labelShift : 0);
    if (sq > .12) {
      // crushed: the wall folds into an accordion, each ring pushed off the one below
      const hh = h / 2, hw = w / 2, N = 2 + Math.round(sq * 6), bh = h / N, off = sq * w * .03;
      const ry = Math.max(.01, hw * E * Math.abs(R.cu)), s = R.s, lim = hh - hw * E;
      for (let i = 0; i < N; i++) {
        const ya = i ? -hh + i * bh : -h * 2, yb = i === N - 1 ? h * 2 : -hh + (i + 1) * bh + .5 / sc;
        g.save(); g.beginPath(); g.rect(-w * 2, ya, w * 4, yb - ya); g.clip(); g.translate(i & 1 ? off : -off, 0); paintCan(g, L, T, w, h, R, sc, u0, rim);
        // alternate pleats face the lamp or turn away from it
        const y0 = Math.max(ya, -lim), y1 = Math.min(yb, lim);
        if (y1 > y0) { g.fillStyle = (i & 1) === (s > 0 ? 1 : 0) ? `rgba(0,0,0,${(.2 * sq).toFixed(3)})` : `rgba(255,245,230,${(.1 * sq).toFixed(3)})`; g.fillRect(-hw, y0, w, y1 - y0); }
        g.restore();
      }
      for (let i = 1; i < N; i++) {
        const yy = -hh + i * bh;
        g.lineWidth = Math.max(.6 / sc, w * .02); g.strokeStyle = `rgba(255,248,236,${(.5 * sq).toFixed(3)})`;
        g.beginPath(); g.moveTo(-hw, yy - 1); half(g, yy - 1, hw, ry, s, true); g.stroke();
        g.lineWidth = Math.max(1.5 / sc, w * .055); g.strokeStyle = `rgba(0,0,0,${(.45 * sq).toFixed(3)})`;
        g.beginPath(); g.moveTo(-hw, yy + 1.3); half(g, yy + 1.3, hw, ry, s, true); g.stroke();
      }
    } else paintCan(g, L, T, w, h, R, sc, u0, rim);
    g.restore();
  }
  const drawCanFlat = (g, can, x, y, w, h, o) => drawCan(g, can, x, y, 0, w, h, o);

  return { C, GROUP, LABELS, TAU, LIGHT, hash, canStyle, splitName, rr, star, rivet, tinGrad, metalGrad, drawCan, drawCanFlat };
})();
