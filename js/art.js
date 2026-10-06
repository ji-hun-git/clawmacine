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
  // Shading happens in a world frame (x right, y up, z out of the glass toward the viewer). The camera looks a
  // little down into the machine (sin elevation = E), so every end that faces up or toward us shows as an ellipse.
  const rgbOf = s => [1, 3, 5].map(i => parseInt(s.slice(i, i + 2), 16));
  const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const css = (c, a = 1) => `rgba(${clamp(c[0], 0, 255) | 0},${clamp(c[1], 0, 255) | 0},${clamp(c[2], 0, 255) | 0},${+clamp(a, 0, 1).toFixed(3)})`;
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const n3 = a => { const n = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / n, a[1] / n, a[2] / n]; };
  const lin3 = (a, ka, b, kb) => [a[0] * ka + b[0] * kb, a[1] * ka + b[1] * kb, a[2] * ka + b[2] * kb];
  const lobe = (a, c, p) => Math.pow(Math.max(0, Math.cos(a - c)), p);
  const Lw = [LIGHT.x, -LIGHT.y, LIGHT.z], Dv = [0, E, Math.sqrt(1 - E * E)], Hv = n3(lin3(Lw, 1, Dv, 1));
  // the same room as the wheel: cool fill from the dark cabinet, warm key from the lamp
  const ROOM = [.52, .56, .66], PROOM = [.64, .67, .74], LAMPK = rgbOf(C.LAMP).map(v => v / 255), LAMPP = [1, .955, .87];
  const TINA = [176, 182, 189], WALLR = [.66, .6, .52];
  const YAW = .075;                                          // radians per step of a can's turn toward or away from us

  // A can's pose in 3D from its screen angle (q/256 turn of its local +x), a mirror flag and a yaw step.
  // Its axis stays the physics axis on screen; yaw only decides how much of an end we see and how it is lit.
  const POSE = new Map();
  function pose(q, mir, yq) {
    const key = (q * 2 + mir) * 32 + yq + 16; let p = POSE.get(key); if (p) return p;
    const an = q / 256 * TAU, ca = Math.cos(an), sa = Math.sin(an), ux = mir ? -sa : sa, uy = mir ? -ca : ca, ps = yq * YAW;
    const A = [ux * Math.cos(ps), uy, ux * Math.sin(ps)], ad = dot(A, Dv), s = ad >= 0 ? 1 : -1;
    const Cf = n3(lin3(Dv, 1, A, -ad));                       // the side normal that faces the camera
    let Bs = n3([A[1] * Cf[2] - A[2] * Cf[1], A[2] * Cf[0] - A[0] * Cf[2], A[0] * Cf[1] - A[1] * Cf[0]]);
    if (Bs[0] * ca - Bs[1] * sa < 0) Bs = [-Bs[0], -Bs[1], -Bs[2]];   // Bs runs along local +x
    const Ne = [A[0] * s, A[1] * s, A[2] * s], Ey = [Cf[0] * s, Cf[1] * s, Cf[2] * s];   // the visible end: normal, and its local +y
    const bh = dot(Bs, Hv), ch = dot(Cf, Hv), hp = Math.hypot(bh, ch);
    const dE = dot(Ne, Lw), hE = dot(Ne, Hv), Lt = lin3(Lw, 1, Ne, -dE), Ht = lin3(Hv, 1, Ne, -hE);
    const ltx = dot(Lt, Bs), lty = dot(Lt, Ey), sh = 1 / Math.max(.2, dE);
    p = { A, s, k: Math.abs(ad), Bs, Cf, Ne, Ey, us: bh / (hp || 1), str: .22 + .78 * Math.pow(hp, 6), bl: dot(Bs, Lw), cl: dot(Cf, Lw),
      la: dot(A, Lw), dE, hE, AZ: Math.atan2(lty, ltx), AH: Math.atan2(dot(Ht, Ey), dot(Ht, Bs)), lt: Math.hypot(ltx, lty),
      shx: -ltx * sh, shy: -lty * sh };
    POSE.set(key, p); return p;
  }
  // light across the turned side, u = -1..1 along local x: tin (a dark mirror of the cabinet with the lamp in it),
  // the multiply that lights printed ink (cool in shade, warm toward the lamp), and the varnish's own highlight
  const SIDE = new Map();
  function side(p, lq) {
    const key = p; let m = SIDE.get(key); if (!m) SIDE.set(key, m = []);
    if (m[lq]) return m[lq];
    const lit = lq / 20, us = p.us, uo = clamp(us + (us < 0 ? .98 : -.98), -.93, .93);
    const U = [-1, -.975, -.93, -.85, -.72, -.55, -.32, -.1, .1, .32, .55, .72, .85, .93, .975, 1];
    for (const d of [-.3, -.16, -.08, -.035, 0, .035, .08, .16, .3]) if (us + d > -1 && us + d < 1) U.push(us + d);
    U.sort((a, b) => a - b);
    const metal = [], shade = [], gloss = [];
    for (const u of U) {
      const o = (u + 1) / 2, e = Math.abs(u), q = Math.sqrt(Math.max(0, 1 - u * u)), d = Math.max(0, u * p.bl + q * p.cl), du = u - us;
      const fr = 1 - .5 * Math.pow(e, 5);                       // grazing tin mirrors the black back of the cabinet
      const lamp = lit * p.str * (1.2 * bell(du, .04) + .36 * bell(du, .14) + .16 * bell(du, .4));
      const wall = lit * .2 * bell(u - uo, .16);
      metal.push([o, css([0, 1, 2].map(i => (TINA[i] * (.44 * ROOM[i] + .74 * lit * d * LAMPK[i]) * fr + 255 * (lamp * LAMPK[i] + wall * WALLR[i]))))]);
      const ml = [0, 1, 2].map(i => Math.min(1, .38 * PROOM[i] + 1.02 * lit * d * LAMPP[i]) * (1 - .3 * Math.pow(e, 7)));
      const dk = clamp(1 - (ml[0] + ml[1] + ml[2]) / 2.9, 0, .9), wa = .1 * lit * d * (1 - 2 * dk);   // over the ink: cool dark or warm cast
      shade.push([o, dk > wa ? css([14, 18, 30], dk) : css([255, 224, 176], wa)]);
      gloss.push([o, css([255, 248, 236], lit * p.str * (.2 * bell(du, .05) + .13 * bell(du, .22)) + .05 * lit * Math.pow(e, 8) * (u * us > 0 ? 1 : 0))]);
    }
    return (m[lq] = { metal, shade, gloss });
  }
  function stops(gr, list) { for (const [o, c] of list) gr.addColorStop(clamp(o, 0, 1), c); return gr; }
  const lin = (g, hw, list) => stops(g.createLinearGradient(-hw, 0, hw, 0), list);
  // kept for metalGrad: a rolled surface whose +u side points along q
  const profile = (q, lq) => side(pose(q, 0, 0), lq);
  // an angle-only gradient round a centre (lid rings, spun tin), from stops sampled round the circle;
  // a ramp across the lamp azimuth stands in where conic gradients are missing
  const CN = 36;
  function conic(g, list, az, r) {
    if (typeof g.createConicGradient === 'function') {
      const gr = g.createConicGradient(0, 0, 0);
      if (gr && typeof gr.addColorStop === 'function') { for (let i = 0; i <= CN; i++) gr.addColorStop(i / CN, list[i % CN]); return gr; }
    }
    const at = a => list[((Math.round(a / TAU * CN) % CN) + CN) % CN], ca = Math.cos(az), sa = Math.sin(az);
    const gr = g.createLinearGradient(-r * ca, -r * sa, r * ca, r * sa);
    gr.addColorStop(0, at(az + Math.PI)); gr.addColorStop(.5, at(az + Math.PI / 2)); gr.addColorStop(1, at(az));
    return gr;
  }

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

  // per-context gradients in local units, so one set serves every can of that size, pose and lamp level
  const GC = new WeakMap();
  function grads(g, q, lq, mir, yq, hw, h) {
    let m = GC.get(g); if (!m) GC.set(g, m = new Map());
    const key = (((((q * 21 + lq) * 2 + mir) * 32 + yq + 16) * 4096) + Math.min(4095, Math.round(hw * 8))) * 8192 + Math.min(8191, Math.round(h * 8));
    let r = m.get(key); if (r) return r;
    if (m.size > 1200) m.clear();
    const P = pose(q, mir, yq), S = side(P, lq), lit = lq / 20, up = Math.max(0, P.la * P.s);
    r = { P, lit, lq, hw, metal: lin(g, hw, S.metal), shade: lin(g, hw, S.shade), gloss: lin(g, hw, S.gloss), lid: null,
      seamHi: `rgba(255,246,228,${(.1 + .5 * lit * Math.max(0, P.dE)).toFixed(3)})`,
      footHi: `rgba(255,246,228,${(.06 + .34 * lit * up).toFixed(3)})`,
      lipAO: `rgba(12,9,7,${(.22 + .16 * lit * up).toFixed(3)})`,
      edge: `rgba(255,240,215,${(.1 + .32 * lit).toFixed(3)})` };
    const st = g.createRadialGradient(0, 0, 0, 0, 0, 1), sa = lit * P.str;
    st.addColorStop(0, `rgba(255,251,242,${(.62 * sa).toFixed(3)})`); st.addColorStop(.3, `rgba(255,248,236,${(.3 * sa).toFixed(3)})`); st.addColorStop(1, 'rgba(255,248,236,0)');
    r.streak = st;
    // the lamp hangs above: the end toward it keeps the light, the other sinks into the shade of the pile
    const hp = Math.min(h / 2 - hw * E * .6, h / 2 + hw * E * .4 - hw * P.k), toward = P.la * P.s > 0 ? -P.s : P.s, fall = g.createLinearGradient(0, toward * hp, 0, -toward * hp);
    fall.addColorStop(0, 'rgba(10,8,6,0)'); fall.addColorStop(.45, 'rgba(10,8,6,0)'); fall.addColorStop(1, `rgba(10,8,6,${(.07 + .2 * Math.abs(P.la)).toFixed(3)})`);
    r.fall = fall;
    m.set(key, r); return r;
  }
  // the end we look at: crest of the double seam, countersink wall, spun panel, and the lights on its beads.
  // Colour stops round the circle depend only on pose and lamp, so they are shared by every context.
  const LIDS = new Map();
  function lidStops(P, lq) {
    let m = LIDS.get(P); if (!m) LIDS.set(P, m = []);
    if (m[lq]) return m[lq];
    const lit = lq / 20, Ne = P.Ne, Bs = P.Bs, Ey = P.Ey;
    const tin = (N, amb, kd, ks, pw, k2) => {
      const d = Math.max(0, dot(N, Lw)), hs = Math.max(0, dot(N, Hv)), sp = lit * (ks * Math.pow(hs, pw) + k2 * Math.pow(hs, 4));
      return css([0, 1, 2].map(i => TINA[i] * (amb * ROOM[i] + kd * lit * d * LAMPK[i]) + 255 * sp * LAMPK[i]));
    };
    const bowK = lit * .3 * clamp(.35 + P.hE, .25, 1), dE = Math.max(0, P.dE), o = { crest: [], wall: [], panel: [], out: [], lip: [] };
    for (let i = 0; i < CN; i++) {
      const a = i / CN * TAU, rd = lin3(Bs, Math.cos(a), Ey, Math.sin(a));
      o.crest.push(tin(n3(lin3(Ne, .6, rd, .8)), .42, .8, .75, 28, .12));
      o.wall.push(tin(n3(lin3(rd, -.9, Ne, .3)), .3, .85, .45, 16, .06));
      const b = lobe(a, P.AH, 12) + lobe(a, P.AH + Math.PI, 12), t = 1 + .08 * lit * lobe(a, P.AZ, 1.5);
      o.panel.push(css([0, 1, 2].map(k => TINA[k] * (.42 * ROOM[k] + .7 * lit * dE * LAMPK[k]) * t + 255 * bowK * b * LAMPK[k])));
      const l = lobe(a, P.AZ, 2) * P.lt, d = lobe(a, P.AZ + Math.PI, 2) * P.lt;
      o.out.push(l >= d ? css([255, 243, 222], .75 * lit * l) : css([10, 8, 6], .5 * d));
      o.lip.push(css([10, 8, 6], .16 + (.2 + .22 * lit) * Math.min(1, P.lt * 1.4) * lobe(a, P.AZ, 1.6)));
    }
    return (m[lq] = o);
  }
  function lidGrads(g, r) {
    if (r.lid) return r.lid;
    const P = r.P, hw = r.hw, S = lidStops(P, r.lq);
    return (r.lid = { crest: conic(g, S.crest, P.AZ, hw), wall: conic(g, S.wall, P.AZ, hw), panel: conic(g, S.panel, P.AZ, hw),
      out: conic(g, S.out, P.AZ, hw), lip: conic(g, S.lip, P.AZ, hw) });
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
  function arcLine(g, y, rx, ry, s, lw, col) { g.beginPath(); g.moveTo(-rx, y); half(g, y, rx, ry, s, true); g.lineWidth = lw; g.strokeStyle = col; g.stroke(); }
  // Soft shadow on the floor: a dark ring where the rim meets it, then the can's shade thrown right and back,
  // away from the lamp (the floor seen from a little above, so "back" is up the screen).
  const SHF = [-Lw[0] / Lw[1], Lw[2] / Lw[1] * E];
  function dropShadow(g, ang, w, h) {
    const c = Math.abs(Math.cos(ang)), s = Math.abs(Math.sin(ang));
    const ex = w / 2 * c + h / 2 * s, ey = w / 2 * s + h / 2 * c, tall = h * c + w * s * .9;
    g.save(); g.translate(0, ey - ex * E * .45); g.scale(1, E);          // the floor's own plane, seen from a little above
    const tx = SHF[0] * tall * .9, ty = -SHF[1] / E * tall * .9, gr = g.createLinearGradient(0, 0, tx, ty);
    gr.addColorStop(0, 'rgba(8,6,5,.3)'); gr.addColorStop(.55, 'rgba(8,6,5,.12)'); gr.addColorStop(1, 'rgba(8,6,5,0)');
    g.strokeStyle = gr; g.lineCap = 'round';
    for (const k of [1.32, 1.14, .98]) { g.lineWidth = 2 * ex * k; g.beginPath(); g.moveTo(0, 0); g.lineTo(tx, ty); g.stroke(); }
    const cg = g.createRadialGradient(0, 0, ex * .84, 0, 0, ex * 1.12);
    cg.addColorStop(0, 'rgba(6,5,4,.6)'); cg.addColorStop(1, 'rgba(6,5,4,0)');
    g.fillStyle = cg; g.beginPath(); g.arc(0, 0, ex * 1.12, 0, TAU); g.fill();
    g.restore();
  }

  const RB = .972;                                            // the body sits a hair inside its seams
  const labelH = (w, h) => h * .844 - w * E * .6;
  // lathe marks on the spun panel (fractions of the radius)
  const LATHE = (() => { const R = rng(0x1a7e), out = []; for (let r = .1; r < .84; r += .018 + R() * .03) out.push({ r, w: .004 + R() * .006, c: R() < .5 ? `rgba(255,250,240,${(.05 + R() * .08).toFixed(3)})` : `rgba(14,16,20,${(.05 + R() * .07).toFixed(3)})` }); return out; })();
  // The can in its own frame (axis along y), shaded by the lighting set R chosen for its world pose.
  function paintCan(g, L, T, w, h, R, sc, u0, rim) {
    const P = R.P, hw = w / 2, rb = hw * RB, hh = h / 2, s = P.s, ryM = hw * E, ry = Math.max(.01, hw * P.k), ryb = ry * RB;
    const hp = Math.min(hh - ryM * .6, hh + ryM * .4 - ry), seam = h * .052, foot = h * .044, ga = alphaOf(g);
    const ly0 = -hp + seam + h * .026, capY = -s * hp, baseY = s * hp;
    const lh = 2 * -ly0, px = w * sc, upr = hw / T.P, n = px < 28 ? 10 : px < 70 ? 16 : px < 140 ? 24 : px < 260 ? 36 : 48;
    const dt = Math.PI / n, ov = .8 / sc, sw = dt * upr * T.per, thin = Math.max(.5 / sc, h * .01), fine = px > 22;
    // body: bare tin wherever the print does not cover it
    g.beginPath(); g.moveTo(-rb, capY); half(g, capY, rb, ryb, -s, true); g.lineTo(rb, baseY); half(g, baseY, rb, ryb, s, false); g.closePath();
    g.fillStyle = R.metal; g.fill();
    // printed label, wrapped: equal steps of turn, so the print crowds together toward the silhouette.
    // Held a hair inside the silhouette: image edges are not antialiased, the shading that covers them is.
    const lr = rb - .9 / sc;
    let xa = -lr;
    for (let i = 0; i < n; i++) {
      const t0 = -Math.PI / 2 + i * dt, xb = i === n - 1 ? lr : lr * Math.sin(t0 + dt);
      let u = u0 + t0 * upr; u -= Math.floor(u);
      g.drawImage(T.cv, u * T.per, 0, sw, T.cv.height, xa, ly0 + s * ryb * Math.cos(t0 + dt / 2), xb - xa + (i < n - 1 ? ov : 0), lh);
      xa = xb;
    }
    // the lamp on the ink: cool shade where the side turns away, a warm cast toward the lamp, the varnish's own highlight
    band(g, ly0, -ly0, rb, ryb, s);
    if (!L.bare) { g.fillStyle = R.shade; g.fill(); }
    g.globalAlpha = ga * (L.bare ? .45 : 1); g.fillStyle = R.gloss; g.fill(); g.globalAlpha = ga;
    if (!L.bare && px > 26 && Math.abs(P.us) < .8) {
      // the varnish carries the lamp as a streak that runs with the axis, strongest toward the lamp's end
      const yc = (P.la * s > 0 ? -1 : 1) * s * lh * .1;
      g.save(); g.translate(P.us * rb, yc); g.scale(rb * .075, lh * .44);
      g.fillStyle = R.streak; g.beginPath(); g.arc(0, 0, 1, 0, TAU); g.fill(); g.restore();
    }
    if (fine && !L.bare) {
      g.beginPath(); g.moveTo(-rb, ly0); half(g, ly0, rb, ryb, s, true); g.moveTo(-rb, -ly0); half(g, -ly0, rb, ryb, s, true);
      g.lineWidth = thin * .7; g.strokeStyle = 'rgba(0,0,0,.18)'; g.stroke();
    }
    // the end we look at: countersink wall, the spun panel sunk below the seam, then the seam's crest over both
    if (ry * sc > .9) {
      const Z = lidGrads(g, R), k = ry / hw, dc = w * .032;
      g.save(); g.translate(0, capY); g.scale(1, k);
      g.beginPath(); g.arc(0, 0, hw * .885, 0, TAU); g.fillStyle = Z.wall; g.fill();
      if (ry * sc > 1.6) {
        // seen from above, the far wall of the countersink shows as a crescent; what pokes out near us is covered by the seam
        g.save(); g.translate(0, s * dc * Math.sqrt(Math.max(0, 1 - P.k * P.k)) / k);
        g.beginPath(); g.arc(0, 0, hw * .85, 0, TAU); g.fillStyle = Z.panel; g.fill();
        if (px > 90) for (const l of LATHE) { g.beginPath(); g.arc(0, 0, hw * l.r, 0, TAU); g.lineWidth = hw * l.w; g.strokeStyle = l.c; g.stroke(); }
        if (px > 26) {
          // expansion beads: the flank that faces the lamp catches it, the other side drops into shade
          const bw = Math.max(.6 / sc, hw * .035), rs = px > 70 ? [.64, .43] : [.58];
          g.lineWidth = bw; g.strokeStyle = Z.out; g.beginPath();
          for (const f of rs) { g.moveTo(hw * f + bw * .5, 0); g.arc(0, 0, hw * f + bw * .5, 0, TAU); }
          g.stroke(); g.rotate(Math.PI); g.beginPath();                     // the inner flanks: the same light turned half round
          for (const f of rs) { g.moveTo(hw * f - bw * .5, 0); g.arc(0, 0, hw * f - bw * .5, 0, TAU); }
          g.stroke(); g.rotate(-Math.PI);
          // the seam's shadow along the lamp side of the panel, over the dark of the countersink
          g.lineWidth = hw * .13; g.strokeStyle = Z.lip; g.beginPath(); g.arc(0, 0, hw * .79, 0, TAU); g.stroke();
        }
        g.restore();
      }
      g.beginPath(); g.arc(0, 0, hw, 0, TAU); g.arc(0, 0, hw * .885, 0, TAU); g.fillStyle = Z.crest; g.fill('evenodd');
      g.lineWidth = Math.max(.6 / sc, hw * .028); g.strokeStyle = Z.out; g.beginPath(); g.arc(0, 0, hw * .975, 0, TAU); g.stroke();
      if (ry * sc > 1.6) { g.rotate(Math.PI); g.lineWidth = Math.max(.6 / sc, hw * .03); g.beginPath(); g.arc(0, 0, hw * .9, 0, TAU); g.stroke(); }
      g.restore();
    }
    // the two double seams stand proud of the body: a turned band each, a lit crest, a shadow tucked under
    band(g, baseY - s * foot, baseY, hw, ry, s);
    g.moveTo(-hw, capY); half(g, capY, hw, ry, s, true); g.lineTo(hw, capY + s * seam); half(g, capY + s * seam, hw, ry, s, false); g.closePath();
    g.fillStyle = R.metal; g.fill();
    if (fine) {
      const lw = Math.max(.5 / sc, h * .013), ya = capY + s * (seam + lw * .5), yb = baseY - s * (foot + lw * .45);
      g.beginPath(); g.moveTo(-rb, ya); half(g, ya, rb, ryb, s, true); g.moveTo(-rb, yb); half(g, yb, rb, ryb, s, true);
      g.lineWidth = lw; g.strokeStyle = R.lipAO; g.stroke();
      arcLine(g, capY + s * seam * .32, hw, ry, s, lw * .9, R.seamHi);
      arcLine(g, baseY - s * foot * .72, hw, ry, s, lw * .8, R.footHi);
    }
    band(g, capY, baseY, hw, ry, s); g.fillStyle = R.fall; g.fill();
    // the edge that faces the lamp
    if (Math.abs(P.us) > .04) {
      const lw = .75 / sc, xs = (P.us < 0 ? -1 : 1) * (rb - lw / 2);
      g.beginPath(); g.moveTo(xs, capY + s * seam); g.lineTo(xs, baseY - s * foot); g.lineWidth = lw; g.strokeStyle = R.edge; g.stroke();
    }
    if (rim > 0) rimLight(g, w, h, R, sc, rim);
  }
  // warm rim on the lamp side; additive, so it can go over a cached sprite as well
  function rimLight(g, w, h, R, sc, rim) {
    const P = R.P, hw = w / 2, s = P.s, ryM = hw * E, ry = Math.max(.01, hw * P.k), hp = Math.min(h / 2 - ryM * .6, h / 2 + ryM * .4 - ry), capY = -s * hp, baseY = s * hp;
    const xs = P.us < 0 ? -hw : hw, dir = P.us < 0 ? 1 : -1, gr = g.createLinearGradient(xs, 0, xs + dir * w * .22, 0), lw = 1.5 / sc;
    gr.addColorStop(0, `rgba(255,217,154,${(.6 * rim).toFixed(3)})`); gr.addColorStop(1, 'rgba(255,217,154,0)');
    g.save(); g.globalCompositeOperation = 'lighter';
    g.beginPath(); g.moveTo(-hw, capY); half(g, capY, hw, ry, -s, true); g.lineTo(hw, baseY); half(g, baseY, hw, ry, s, false); g.closePath();
    g.fillStyle = gr; g.fill();
    g.strokeStyle = `rgba(255,217,154,${rim.toFixed(3)})`; g.lineWidth = lw;
    g.beginPath(); g.moveTo(xs + dir * lw / 2, capY); g.lineTo(xs + dir * lw / 2, baseY); g.stroke();
    if (ry * sc > 1) { g.beginPath(); g.moveTo(-hw, capY); half(g, capY, hw, ry, -s, true); g.globalAlpha = alphaOf(g) * .7; g.stroke(); }
    g.restore();
  }
  // crushed: the ends keep their round, the wall between them buckles into folds that bulge out
  function crush(g, L, T, w, h, R, sc, u0, sq, seed) {
    const P = R.P, s = P.s, hw = w / 2, ry = Math.max(.01, hw * P.k), hp = Math.min(h / 2 - hw * E * .6, h / 2 + hw * E * .4 - ry);
    const y0 = -s * (hp - h * .06), y1 = s * (hp - h * .05), N = 2 + Math.round(sq * 4), up = P.la * s > 0 ? 1 : -1, rnd = rng(seed), lit = R.lit;
    const ys = []; for (let i = 0; i <= N; i++) ys.push(y0 + (y1 - y0) * (i + (i && i < N ? (rnd() - .5) * .3 : 0)) / N);
    for (let i = 0; i < N; i++) {
      const b = 1 + sq * (i & 1 ? .03 : .15 + rnd() * .05), ya = ys[i], yb = ys[i + 1], sh = (rnd() - .5) * sq * w * .06;
      // each fold is the wall again, pushed out from the axis, cut along the crease lines above and below it
      g.save(); band(g, ya, yb, hw * b * 1.02, ry * b, s); g.clip(); g.translate(sh, 0); g.scale(b, 1);
      paintCan(g, L, T, w, h, R, sc, u0, 0); g.restore();
      // its upper facet turns toward the lamp, the lower one away
      const gr = g.createLinearGradient(0, ya, 0, yb), lo = `rgba(8,6,5,${(.42 * sq).toFixed(3)})`, hi = `rgba(255,244,226,${(.2 * sq * lit).toFixed(3)})`;
      gr.addColorStop(0, up > 0 ? hi : lo); gr.addColorStop(.42, 'rgba(128,120,110,0)'); gr.addColorStop(.58, 'rgba(128,120,110,0)'); gr.addColorStop(1, up > 0 ? lo : hi);
      g.save(); g.translate(sh, 0); band(g, ya, yb, hw * b, ry * b, s); g.fillStyle = gr; g.fill(); g.restore();
      // creases in the print where the tin kinked
      g.lineCap = 'round';
      for (let k = 0; k < 5; k++) {
        const x = (rnd() * 1.6 - .8) * hw, yy = ya + (yb - ya) * (.2 + rnd() * .6), dx = (rnd() - .5) * hw * .5, dy = (yb - ya) * (rnd() - .5) * .6, lw = Math.max(.6 / sc, w * .012);
        g.lineWidth = lw;
        g.strokeStyle = `rgba(8,6,5,${(.3 * sq).toFixed(3)})`; g.beginPath(); g.moveTo(x, yy); g.lineTo(x + dx, yy + dy); g.stroke();
        g.strokeStyle = `rgba(255,248,236,${(.28 * sq * lit).toFixed(3)})`; g.beginPath(); g.moveTo(x, yy - lw); g.lineTo(x + dx, yy + dy - lw); g.stroke();
      }
    }
    for (let i = 1; i < N; i++) {
      const lw = Math.max(1 / sc, w * .03);
      arcLine(g, ys[i] + s * lw * .4, hw * (1 + sq * .03), ry, s, lw, `rgba(8,6,5,${(.5 * sq).toFixed(3)})`);
      arcLine(g, ys[i] - s * lw * .5, hw * (1 + sq * .03), ry, s, lw * .5, `rgba(255,248,236,${(.35 * sq * lit).toFixed(3)})`);
    }
  }

  // each copy of a can lies a little turned toward or away from us, so a can on its side shows one end
  const YAWS = new WeakMap();
  function yawOf(can, o) {
    if (typeof o.yaw === 'number' && isFinite(o.yaw)) return clamp(Math.round(o.yaw / YAW), -15, 15);
    if (!can || typeof can !== 'object') return 0;
    let y = YAWS.get(can);
    if (y == null) {
      const id = can.copy != null ? can.copy | 0 : can.body && can.body.id != null ? can.body.id | 0 : 0, hh = hash(String(can.name) + '#' + id);
      YAWS.set(can, y = (1 + hh % 4) * (hh & 64 ? 1 : -1));
    }
    return y;
  }

  // A can that holds still is painted once into a sprite at its pose and light, then only blitted.
  const SPR = new Map(), SEEN = new WeakMap(), STIERS = [1, 1.5, 2, 3, 4, 6, 8];
  let sprT = -1e9, sprBud = 0;
  function spendSprite() { const t = now(); if (t - sprT > 12) { sprT = t; sprBud = 8; } return sprBud-- > 0; }
  function sprite(L, T, w, h, q, lq, mir, yq, ts, spinQ) {
    const key = `${T.key}|${q}|${mir}|${yq}|${lq}|${ts}|${spinQ}|${h}`;
    let s = SPR.get(key);
    if (s && s.T === T) { SPR.delete(key); SPR.set(key, s); return s; }
    if (!spendSprite()) return null;
    const SW = Math.ceil(w * ts) + 4, SH = Math.ceil((h + w * E) * ts) + 4, cv = s ? s.cv : document.createElement('canvas');
    cv.width = SW; cv.height = SH;
    const t = cv.getContext('2d');
    t.setTransform(ts, 0, 0, ts, SW / 2, SH / 2);
    paintCan(t, L, T, w, h, grads(t, q, lq, mir, yq, w / 2, h), ts, .5 + spinQ / 128 * Math.PI * w / T.P, 0);
    s = { cv, T, ox: SW / 2 / ts, oy: SH / 2 / ts, sw: SW / ts, sh: SH / ts };
    SPR.delete(key); SPR.set(key, s);
    if (SPR.size > 260) for (const [k, v] of SPR) { if (SPR.size <= 200) break; if (k !== key) { v.cv.width = 0; SPR.delete(k); } }
    return s;
  }

  // Draw one tin can centred at (x, y), rotated by ang.
  // o: squash 0..1, shadow, spin 0..1 (0 = name to the front, .5 = back), labelShift (scrolls a big printed
  // name round the can while it is carried), rim 0..1 (warm rim light), lit 0..1 (how much lamp reaches it),
  // yaw (optional, radians: how far the can is turned toward us; each can has its own when left out).
  function drawCan(g, can, x, y, ang, w, h, o) {
    if (!can || !(w > 0 && h > 0)) return;
    o = o || {};
    ang = +ang || 0;
    const sq = clamp(+o.squash || 0, 0, 1), lit = clamp(o.lit == null ? 1 : +o.lit || 0, 0, 1), rim = clamp(+o.rim || 0, 0, 1);
    g.save(); g.translate(x, y);
    if (o.shadow) dropShadow(g, ang, w * (1 + sq * .12), h * (1 - sq * .72));
    g.rotate(ang);
    const F = frame(g), sc = F.sc, cv = g.canvas;
    if (F.ok && cv && typeof cv.width === 'number') {
      const rad = Math.hypot(w, h) * .62 * sc + 4;
      if (F.e < -rad || F.f < -rad || F.e > cv.width + rad || F.f > cv.height + rad) { g.restore(); return; }
    }
    const name = String(can.name == null ? '' : can.name), st = can.label == null || can.lot == null ? canStyle(name) : null;
    const li = ((st ? st.label : can.label | 0) % LABELS.length + LABELS.length) % LABELS.length, L = LABELS[li], lot = st ? st.lot : can.lot;
    // light is worked out every 2.8 degrees of turn (the drawing itself turns exactly); cans on the move take
    // the lamp in steps of a tenth, still ones cross-fade between two sprites
    const q = quant(Math.atan2(F.xy, F.xx)) & ~1, lq = Math.round(lit * 10) * 2, mir = F.mir, lh = labelH(w, h), yq = yawOf(can, o);
    const carry = typeof o.labelShift === 'number' && isFinite(o.labelShift), spin = +o.spin || 0;
    if (!carry && !sq && typeof can === 'object') {
      const ts = STIERS.find(v => v >= sc * .98) || 8;
      const spinQ = ((Math.round((spin - Math.floor(spin)) * 128) % 128) + 128) % 128;
      const sk = `${q}|${mir}|${yq}|${ts}|${spinQ}|${w}|${h}`;
      let seen = SEEN.get(can);
      if (!seen) SEEN.set(can, seen = { k: '', n: 0 });
      if (seen.k === sk) seen.n++; else { seen.k = sk; seen.n = 0; }
      if (seen.n >= 5) {
        // lamp partly on: cross-fade the unlit sprite into the lit one
        const T = texFor(can, name, li, lot, w, lh, false, sc), ga = alphaOf(g);
        const a = lit < 1 ? sprite(L, T, w, h, q, 0, mir, yq, ts, spinQ) : null, b = lit > 0 ? sprite(L, T, w, h, q, 20, mir, yq, ts, spinQ) : null;
        if ((lit === 1 || a) && (lit === 0 || b)) {
          if (a) g.drawImage(a.cv, -a.ox, -a.oy, a.sw, a.sh);
          if (b) { g.globalAlpha = ga * (a ? lit : 1); g.drawImage(b.cv, -b.ox, -b.oy, b.sw, b.sh); g.globalAlpha = ga; }
          if (rim > 0) rimLight(g, w, h, grads(g, q, 20, mir, yq, w / 2, h), sc, rim);
          g.restore(); return;
        }
      }
    }
    const T = texFor(can, name, li, lot, w, lh, carry, sc), u0 = .5 + spin * Math.PI * w / T.P + (carry ? o.labelShift : 0);
    if (!sq) paintCan(g, L, T, w, h, grads(g, q, lq, mir, yq, w / 2, h), sc, u0, rim);
    else {
      const h2 = h * (1 - sq * .72), R = grads(g, q, lq, mir, yq, w / 2, h2);
      paintCan(g, L, T, w, h2, R, sc, u0, 0);
      if (sq > .12) crush(g, L, T, w, h2, R, sc, u0, sq, hash(name));
      if (rim > 0) rimLight(g, w, h2, R, sc, rim);
    }
    g.restore();
  }
  const drawCanFlat = (g, can, x, y, w, h, o) => drawCan(g, can, x, y, 0, w, h, o);

  // one way to write a name everywhere: every word capitalised, the rest lower case
  const properName = s => String(s).replace(/\s+/g, ' ').trim().toLowerCase().replace(/(^|[\s'\-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase());
  // names that have left the class: removed from the defaults and from any roster or board saved in a browser
  const RETIRED = new Set(['jiyoung lim']);
  const isRetired = s => RETIRED.has(String(s).replace(/\s+/g, ' ').trim().toLowerCase());

  return { C, GROUP, LABELS, TAU, LIGHT, hash, canStyle, splitName, rr, star, rivet, tinGrad, metalGrad, drawCan, drawCanFlat, properName, isRetired };
})();
