// Shared drawing kit for the animal racers. Every animal module draws in the same tin-toy
// lithograph style with these helpers, so the five of them look like one set.
//
// Coordinate contract for ANIMALS[key].draw(g, o):
//   origin (0, 0) = the point between the feet on the ground (for 'ride', the top of the crane hub)
//   facing +x (right); the animal is about 100 units tall at o.scale = 1 (sitting riders ~ 80)
//   o = { t, mode, speed, emotion, look, bib, scale }
//     t        seconds, the animation clock (keep motion periodic in t)
//     mode     'run' | 'idle' | 'ride' | 'cheer' | 'worry'
//     speed    0..1.6, how fast the run cycle goes (run only)
//     emotion  'focus' | 'worry' | 'cheer' | 'sad' (ride only)
//     look     -1..1, head/eyes tilt; +1 = looking down (ride), 0 = ahead
//     bib      { n: '3', bg: '#e2372c', fg: '#fff' } or null: racing bib / number patch
//     scale    overall scale
window.ANIMALS = window.ANIMALS || {};
window.AKIT = (() => {
  const C = {
    INK: '#1c1b1f', WHITE: '#ffffff', CREAM: '#f6efe0', TOMATO: '#e2372c', COBALT: '#2447b5',
    MUSTARD: '#f3b21b', MINT: '#46b089', STEEL: '#8f969e', BLUSH: 'rgba(226,55,44,.28)',
  };
  const TAU = Math.PI * 2;
  const LW = 2.6;                      // ink outline width at scale 1
  const cache = {};

  function register(def) { window.ANIMALS[def.key] = def; }

  // litho halftone pattern in any colour (for shading on flat fills)
  function dots(g, color, size = 5, r = .9) {
    const key = color + size + r;
    if (!cache[key]) {
      const c = document.createElement('canvas'); c.width = c.height = size;
      const x = c.getContext('2d'); x.fillStyle = color; x.beginPath(); x.arc(size / 2, size / 2, r, 0, TAU); x.fill();
      cache[key] = c;
    }
    return g.createPattern(cache[key], 'repeat');
  }
  // fill the current path, lay a halftone shadow on its lower part, then ink the outline
  function paint(g, fill, { shade = 'rgba(28,27,31,.32)', shadeFrom = null, lw = LW, stroke = C.INK } = {}) {
    g.fillStyle = fill; g.fill();
    if (shadeFrom !== null) {
      g.save(); g.clip();
      g.fillStyle = dots(g, shade); g.fillRect(-400, shadeFrom, 800, 400);
      g.restore();
    }
    if (lw) { g.lineWidth = lw; g.strokeStyle = stroke; g.lineJoin = 'round'; g.lineCap = 'round'; g.stroke(); }
  }
  // soft top-left sheen used on every body, so the light always comes from the same place
  function sheen(g, x, y, rx, ry, a = .35) {
    const gr = g.createRadialGradient(x - rx * .35, y - ry * .45, 1, x, y, Math.max(rx, ry));
    gr.addColorStop(0, `rgba(255,255,255,${a})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, TAU); g.fill();
  }
  // the one eye style every animal uses: white, ink pupil, glint; blinks on its own clock
  function eye(g, x, y, r, { t = 0, look = 0, lookX = .25, wide = false, shut = false, seed = 0 } = {}) {
    const blink = shut || ((t + seed) % 3.7) < .12;
    if (blink) {
      g.beginPath(); g.moveTo(x - r, y); g.quadraticCurveTo(x, y + r * .6, x + r, y);
      g.lineWidth = LW * .8; g.strokeStyle = C.INK; g.stroke(); return;
    }
    const rr = wide ? r * 1.25 : r;
    g.beginPath(); g.ellipse(x, y, rr, rr * 1.08, 0, 0, TAU); g.fillStyle = C.WHITE; g.fill();
    g.lineWidth = LW * .7; g.strokeStyle = C.INK; g.stroke();
    const px = x + rr * lookX * .5, py = y + rr * look * .45, pr = rr * (wide ? .42 : .58);
    g.beginPath(); g.arc(px, py, pr, 0, TAU); g.fillStyle = C.INK; g.fill();
    g.beginPath(); g.arc(px - pr * .35, py - pr * .4, pr * .32, 0, TAU); g.fillStyle = C.WHITE; g.fill();
  }
  function blush(g, x, y, r) { g.beginPath(); g.ellipse(x, y, r, r * .6, 0, 0, TAU); g.fillStyle = C.BLUSH; g.fill(); }
  function sweat(g, x, y, s = 1) {
    g.beginPath(); g.moveTo(x, y - 6 * s); g.quadraticCurveTo(x + 4 * s, y, x, y + 3 * s); g.quadraticCurveTo(x - 4 * s, y, x, y - 6 * s);
    g.fillStyle = '#9fd3ff'; g.fill(); g.lineWidth = 1.4; g.strokeStyle = C.INK; g.stroke();
  }
  // racing bib: a small printed tin tag with the group number, tied on at (x, y), rotated by a
  function bib(g, x, y, b, { w = 18, h = 14, a = 0 } = {}) {
    if (!b) return;
    g.save(); g.translate(x, y); g.rotate(a);
    g.beginPath(); if (g.roundRect) g.roundRect(-w / 2, -h / 2, w, h, 3); else g.rect(-w / 2, -h / 2, w, h);
    g.fillStyle = b.bg; g.fill(); g.lineWidth = 1.8; g.strokeStyle = C.INK; g.stroke();
    g.fillStyle = b.fg; g.font = `${h * .8}px "Alfa Slab One", Rockwell, serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(String(b.n), 0, h * .06);
    g.restore();
  }
  // ground shadow under the animal (call first, at origin, before transforming)
  function shadow(g, w, lift = 0) {
    const k = 1 / (1 + lift * .02);
    g.beginPath(); g.ellipse(0, 1, w * .5 * k, 5 * k, 0, 0, TAU); g.fillStyle = `rgba(28,27,31,${.22 * k})`; g.fill();
  }
  // helpers for periodic motion
  const cyc = (t, rate = 1, off = 0) => Math.sin((t * rate + off) * TAU);
  const ease = x => x * x * (3 - 2 * x);

  // ---------- 3D modelling (the roulette's look): one lamp, volume, gloss, contact darkening ----------
  // The same key light as the cans and the wheel: upper-left-front, warm.
  const LIGHT = (window.ART && ART.LIGHT) || { x: -.35 / 1.008, y: -.8 / 1.008, z: .5 / 1.008 };
  function hex(c) {
    if (c[0] === '#') { const n = parseInt(c.length === 4 ? c.replace(/#(.)(.)(.)/, '#$1$1$2$2$3$3').slice(1) : c.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
    const m = c.match(/[\d.]+/g); return m ? [+m[0], +m[1], +m[2]] : [128, 128, 128];
  }
  // mix two colours; t = 0 gives a, 1 gives b
  function mix(a, b, t) { const A = hex(a), B = hex(b); return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',')})`; }
  const shade = (c, k) => mix(c, '#140f14', k);     // toward the room's shadow colour
  const tint = (c, k) => mix(c, '#fff6e6', k);      // toward the lamp colour
  // Fill the current path as a rounded 3D form centred at (cx, cy) with radius r (in the current, possibly
  // rotated, frame). The highlight sits toward the lamp in SCREEN space, whatever rotation is applied.
  // o: { gloss 0..1 (specular strength), soft 0..1 (1 = fur/felt, broad falloff), depth 0..1 (how dark the far side),
  //      rim 0..1 (warm bounce light on the shadow edge), edge (thin dark contour width, 0 = none) }
  function vol(g, base, cx, cy, r, o = {}) {
    const gloss = o.gloss ?? .35, soft = o.soft ?? 0, depth = o.depth ?? .55, rim = o.rim ?? .25, edge = o.edge ?? .9;
    const m = (g.getTransform && g.getTransform()) || { a: 1, b: 0, c: 0, d: 1 };
    // light direction expressed in the local frame (inverse of the current linear transform)
    const det = m.a * m.d - m.b * m.c || 1;
    let lx = (m.d * LIGHT.x - m.c * LIGHT.y) / det, ly = (-m.b * LIGHT.x + m.a * LIGHT.y) / det;
    const ll = Math.hypot(lx, ly) || 1; lx /= ll; ly /= ll;
    const hx = cx + lx * r * .45, hy = cy + ly * r * .45;
    const gr = g.createRadialGradient(hx, hy, r * .05, cx - lx * r * .15, cy - ly * r * .15, r * (1.15 + soft * .25));
    gr.addColorStop(0, tint(base, .28 - soft * .12));
    gr.addColorStop(.35 + soft * .15, base);
    gr.addColorStop(.78, shade(base, depth * .55));
    gr.addColorStop(1, shade(base, depth));
    g.fillStyle = gr; g.fill();
    g.save(); g.clip();
    if (rim > 0) {          // warm bounce on the shadow side
      const rg = g.createRadialGradient(cx - lx * r * 1.05, cy - ly * r * 1.05, r * .7, cx - lx * r * 1.05, cy - ly * r * 1.05, r * 1.05);
      rg.addColorStop(0, 'rgba(255,190,120,0)'); rg.addColorStop(1, `rgba(255,190,120,${.35 * rim})`);
      g.fillStyle = rg; g.fillRect(cx - r * 2.2, cy - r * 2.2, r * 4.4, r * 4.4);
    }
    if (gloss > 0) {        // a specular: small and hard for glossy enamel, broad and faint for fur
      const sx = cx + lx * r * .55, sy = cy + ly * r * .55, sr = r * (.18 + soft * .35);
      const sg = g.createRadialGradient(sx, sy, 0, sx, sy, sr);
      sg.addColorStop(0, `rgba(255,252,244,${gloss * (1 - soft * .6)})`); sg.addColorStop(1, 'rgba(255,252,244,0)');
      g.fillStyle = sg; g.fillRect(sx - sr, sy - sr, sr * 2, sr * 2);
    }
    g.restore();
    if (edge) { g.lineWidth = edge; g.strokeStyle = 'rgba(20,15,20,.55)'; g.lineJoin = 'round'; g.stroke(); }
  }
  // Contact darkening where two forms meet (a soft dark ellipse, drawn after the form behind it).
  function ao(g, x, y, rx, ry, a = .35, rot = 0) {
    g.save(); g.translate(x, y); g.rotate(rot); g.scale(1, ry / rx);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, rx);
    gr.addColorStop(0, `rgba(12,8,12,${a})`); gr.addColorStop(1, 'rgba(12,8,12,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, rx, 0, TAU); g.fill(); g.restore();
  }
  // Soft cast shadow on the ground, thrown away from the lamp (down-right), shrinking as the body lifts.
  function cast(g, w, lift = 0) {
    const k = 1 / (1 + lift * .025);
    g.save(); g.translate(8 + lift * .25, 1); g.scale(1, .22);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, w * .62 * k);
    gr.addColorStop(0, `rgba(10,6,8,${.42 * k})`); gr.addColorStop(1, 'rgba(10,6,8,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, w * .62 * k, 0, TAU); g.fill(); g.restore();
  }
  // A glossy 3D eye (wet lens, reflection of the lamp, soft lid shadow). Same arguments as eye().
  function eye3d(g, x, y, r, o = {}) {
    const blink = o.shut || (((o.t || 0) + (o.seed || 0)) % 3.7) < .12;
    if (blink) { g.beginPath(); g.moveTo(x - r, y); g.quadraticCurveTo(x, y + r * .6, x + r, y); g.lineWidth = Math.max(1, r * .28); g.strokeStyle = '#1c1b1f'; g.stroke(); return; }
    const rr = o.wide ? r * 1.25 : r;
    g.beginPath(); g.ellipse(x, y, rr, rr * 1.08, 0, 0, TAU);
    const wg = g.createRadialGradient(x - rr * .3, y - rr * .35, rr * .1, x, y, rr * 1.1);
    wg.addColorStop(0, '#ffffff'); wg.addColorStop(.7, '#ece6dc'); wg.addColorStop(1, '#b9b0a4');
    g.fillStyle = wg; g.fill();
    const px = x + rr * (o.lookX ?? .25) * .5, py = y + rr * (o.look || 0) * .45, pr = rr * (o.wide ? .42 : .6);
    const pg = g.createRadialGradient(px - pr * .3, py - pr * .3, pr * .1, px, py, pr);
    pg.addColorStop(0, '#3a3140'); pg.addColorStop(1, '#0d0a0e');
    g.beginPath(); g.arc(px, py, pr, 0, TAU); g.fillStyle = pg; g.fill();
    g.beginPath(); g.ellipse(px - pr * .38, py - pr * .42, pr * .34, pr * .26, -.5, 0, TAU); g.fillStyle = 'rgba(255,255,255,.95)'; g.fill();
    g.beginPath(); g.arc(px + pr * .35, py + pr * .35, pr * .12, 0, TAU); g.fillStyle = 'rgba(255,255,255,.55)'; g.fill();
    g.save(); g.beginPath(); g.ellipse(x, y, rr, rr * 1.08, 0, 0, TAU); g.clip();
    g.fillStyle = 'rgba(40,20,30,.18)'; g.fillRect(x - rr, y - rr * 1.1, rr * 2, rr * .55); g.restore();
    g.beginPath(); g.ellipse(x, y, rr, rr * 1.08, 0, 0, TAU); g.lineWidth = Math.max(.8, rr * .12); g.strokeStyle = 'rgba(28,20,24,.7)'; g.stroke();
  }

  return { C, TAU, LW, register, dots, paint, sheen, eye, blush, sweat, bib, shadow, cyc, ease,
    LIGHT, mix, shade, tint, vol, ao, cast, eye3d };
})();
