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

  return { C, TAU, LW, register, dots, paint, sheen, eye, blush, sweat, bib, shadow, cyc, ease };
})();
