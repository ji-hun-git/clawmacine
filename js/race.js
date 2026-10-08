// The animal race: the second way to set the group order.
// Fairness first: the finishing order is a uniform random shuffle drawn before the gun. Each racer then
// gets its own speed curve (species flavour, lead changes) scaled so it crosses the line at its drawn time.
// Look: a lithographed tin diorama under one lamp, seen from above the front rail. A printed backdrop of the
// habitats, cut-outs on the verge, a tin track in true perspective, dark cut-outs passing close to the lens.
// The finish is judged like a real photo-finish camera: one pixel column on the line, recorded over time.
window.Race = function (canvas, hooks) {
  const { C, GROUP } = ART;
  const INK = C.INK, NIGHT = C.NIGHT || '#0e0d10', PAPER = C.PAPER || '#fbf8f1', LAMP = C.LAMP || '#ffe9c4';
  const TEAL = C.TEAL || '#1f97ad', WALLC = C.WALL || '#f2f1ee';
  const W = 960, H = 440, TL = 2600, START_X = 170, FINISH_X = START_X + TL;
  // depth: Z = 0 is the front edge of the track, 1 unit of Z doubles the distance to the lens
  const HOR = -60, GY = 392, ZT = .76, ZR = .8, ZB = 1.07, ZF = -.42, TRACK_MID = 300;
  const PPS = 220, SY0 = 86, SY1 = 432, SH = SY1 - SY0, RW = Math.ceil(PPS * 5.4);   // photo-finish strip
  const TAU = Math.PI * 2;
  const g = canvas.getContext('2d');
  // backing store follows the size the canvas is shown at (a projector upscales), capped at 2x
  let dpr = 1;
  function fit() {
    const r = canvas.getBoundingClientRect ? canvas.getBoundingClientRect() : null, css = r && r.width > 40 ? r.width / W : 1;
    const k = Math.round(Math.min(2, Math.max(1, css) * (window.devicePixelRatio || 1)) * 4) / 4;
    if (k !== dpr || canvas.width !== W * k) { dpr = k; canvas.width = W * dpr; canvas.height = H * dpr; banTex = null; strip = null; lampC = {}; }
  }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ease = x => x * x * (3 - 2 * x);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const sfx = (n, v) => hooks.sfx && hooks.sfx(n, v);
  const animals = () => window.ANIMALS || {};

  let racers = [], state = 'idle', t = 0, count = 0, finishOrder = [], crossed = [], flash = 0, freeze = 0, gray = 0;
  let line = '', lineT = 0, leader = -1, anim = 0, doneT = 0, drama = 0, saidNear = false, printT = 0;
  let dust = [], drops = [], wet = [], print = null, finished = false;
  const rec = { on: false, done: false, t0: 0, x: RW, pend: 0 };
  const cam = { x: START_X + 150, z: 1.28, fy: TRACK_MID, slow: 1 };

  // ---------- plan ----------
  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; }
  function makeCurve(key) {
    const K = 12, s = [];
    for (let k = 0; k < K; k++) s.push(.5 + Math.random());
    // species flavour: the hammerhead stalls and surges, the turtle keeps an even pace
    if (key === 'shark') for (let k = 0; k < K; k++) s[k] = k % 3 === 1 ? .22 + Math.random() * .3 : 1.05 + Math.random() * .8;
    if (key === 'turtle') for (let k = 0; k < K; k++) s[k] = .82 + Math.random() * .36;
    if (key === 'pangolin' && Math.random() < .7) { const k = 4 + (Math.random() * 6 | 0); s[k] = 2.1; s[k + 1] = 1.9; }
    s[0] = Math.min(s[0], .8); s.push(s[K - 1]);
    const cum = [0];
    for (let k = 0; k < K; k++) cum.push(cum[k] + (s[k] + s[k + 1]) / 2);
    const total = cum[K];
    const at = u => {
      const x = clamp(u, 0, 1) * K, k = Math.min(K - 1, Math.floor(x)), f = x - k;
      return (cum[k] + s[k] * f + (s[k + 1] - s[k]) * f * f / 2) / total;
    };
    const speed = u => { const x = clamp(u, 0, 1) * K, k = Math.min(K - 1, Math.floor(x)), f = x - k; return (s[k] + (s[k + 1] - s[k]) * f) * K / total; };
    return { at, speed };
  }
  function posAt(r, tt) {
    if (tt <= 0) return START_X;
    if (tt <= r.T) return START_X + TL * r.curve.at(tt / r.T);
    const v = TL * r.curve.speed(1) / r.T;           // px/s at the line, then ease to a stop
    return FINISH_X + v * (1 - Math.exp(-(tt - r.T) * 1.3)) / 1.3;
  }
  function leaderAt(tt) {
    let best = -1, bx = -1;
    racers.forEach((r, i) => { const x = posAt(r, tt); if (x > bx + .5) { bx = x; best = i; } });
    return best;
  }
  function plan() {
    const n = racers.length;
    // the order is drawn once; only the speed curves are re-rolled until the race has lead changes,
    // so the retry cannot favour any animal
    const perm = shuffle([...Array(n).keys()]);
    let T = 8 + Math.random() * .6;
    const close = Math.random() < .6;
    perm.forEach((ri, k) => { racers[ri].T = T; T += k === 0 ? (close ? .04 + Math.random() * .08 : .25 + Math.random() * .35) : .18 + Math.random() * .45; });
    for (let attempt = 0; attempt < 60; attempt++) {
      racers.forEach(r => { r.curve = makeCurve(r.key); });
      let changes = 0, last = -1;
      for (let tt = .8; tt < racers[perm[0]].T; tt += .1) { const l = leaderAt(tt); if (l !== last) { if (last !== -1) changes++; last = l; } }
      if (changes >= Math.min(3, n - 1)) break;
    }
    finishOrder = perm;
  }
  const TOF = k => racers[finishOrder[Math.min(k, finishOrder.length - 1)]].T;

  // ---------- commentary ----------
  function say(text) { line = text; lineT = 0; hooks.onLine && hooks.onLine(text); }
  const kindOf = r => (animals()[r.key] || { name: r.key }).name;
  const nameOf = r => `${r.grp.name} (${kindOf(r)})`;
  function hail(r) {
    const L = window.I18N, gap = racers.length > 1 ? TOF(1) - r.T : 1;
    say(gap < .16 ? (L ? L.t('race.photo', { name: nameOf(r) }) : `Photo finish · ${nameOf(r)}`) : (L ? L.t('race.wins', { name: nameOf(r) }) : `${nameOf(r)} wins`));
  }
  const ORD = n => n + (n % 10 === 1 && n % 100 !== 11 ? 'st' : n % 10 === 2 && n % 100 !== 12 ? 'nd' : n % 10 === 3 && n % 100 !== 13 ? 'rd' : 'th');

  // ---------- projection ----------
  // screen x/y of a world point (X along the track, Z depth, Y height), before the camera zoom
  const sAt = Z => 1 / (1 + Z);
  const px = (X, Z) => W / 2 + (X - cam.x) * sAt(Z);
  const py = (Z, Y = 0) => HOR + (GY - HOR - Y) * sAt(Z);
  const lanes = () => Math.max(1, racers.length);
  const laneZ = i => ZT * (1 - (i + .5) / lanes());
  const laneA = () => Math.min(.74, 2.5 / Math.max(3, lanes()) + .24);
  function quad(X0, X1, Za, Zb) {
    g.beginPath(); g.moveTo(px(X0, Za), py(Za)); g.lineTo(px(X1, Za), py(Za)); g.lineTo(px(X1, Zb), py(Zb)); g.lineTo(px(X0, Zb), py(Zb)); g.closePath();
  }
  const view = Z => { const h = (W / 2 + 40) / cam.z / sAt(Z); return [cam.x - h, cam.x + h]; };
  function font(wt, size, stretch = 'normal', fam = 'Archivo, "Helvetica Neue", Arial, sans-serif') {
    g.font = `${wt} ${size}px ${fam}`; if ('fontStretch' in g) g.fontStretch = stretch;
  }
  const SLAB = '"Alfa Slab One", Rockwell, serif';

  // where each animal's nose is, measured once from its own drawing, so the line judges noses, not feet
  const NOSE = { shark: 60, turtle: 56, axolotl: 50, redpanda: 46, pangolin: 44 };
  const noses = window.__raceNose || (window.__raceNose = {});
  function nose(key) {
    if (noses[key] != null) return noses[key];
    const A = animals()[key];
    if (!A) return 24;
    let v = NOSE[key] || 50;
    try {
      const c = document.createElement('canvas'); c.width = 420; c.height = 240;
      const x = c.getContext('2d', { willReadFrequently: true }), xs = [];
      for (let k = 0; k < 12; k++) {
        x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, 420, 240); x.translate(160, 200);
        A.draw(x, { t: k * .083, mode: 'run', speed: 1, emotion: 'focus', look: 0, bib: null, scale: 1 });
        const d = x.getImageData(0, 0, 420, 240).data;
        let m = -1;
        for (let col = 419; col > 160 && m < 0; col--) for (let row = 0; row < 240; row += 2) if (d[(row * 420 + col) * 4 + 3] > 90) { m = col; break; }
        if (m > 0) xs.push(m - 160);
      }
      if (xs.length) v = clamp(Math.max(...xs), 20, 110);   // the furthest reach, so a nose never shows past the line early
    } catch (e) { /* no pixel access: keep the table value */ }
    return (noses[key] = v);
  }

  // ---------- printed tin: backdrop panels, verge cut-outs, foreground cut-outs (built once per page) ----------
  const ZONES = [
    { key: 'reef', x0: -760, x1: 780, verge: '#e6d3a4', title: 'CORAL REEF', who: ['turtle', 'shark'], mid: ['dune'], fg: ['fgGrass'] },
    { key: 'canal', x0: 780, x1: 1480, verge: '#9cc39a', title: 'XOCHIMILCO', who: ['axolotl'], mid: ['reed'], fg: ['fgReed'] },
    { key: 'himalaya', x0: 1480, x1: 2180, verge: '#86ae88', title: 'EASTERN HIMALAYA', who: ['redpanda'], mid: ['bamboo'], fg: ['fgBamboo'] },
    { key: 'sunda', x0: 2180, x1: 4000, verge: '#c39457', title: 'SUNDA FOREST', who: ['pangolin'], mid: ['fern', 'mound'], fg: ['fgFern', 'fgVine'] },
  ];
  const DEFNAME = { turtle: 'Hawksbill Sea Turtle', shark: 'Great hammerhead', axolotl: 'Axolotl', redpanda: 'Red Panda', pangolin: 'Sunda pangolin' };
  const BX0 = ZONES[0].x0, BX1 = ZONES[3].x1, BH = 410, SB = sAt(ZB);
  const zoneAt = X => ZONES.find(z => X < z.x1) || ZONES[3];
  function mk(w, h, k = dpr) {
    const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w * k)); c.height = Math.max(1, Math.ceil(h * k));
    const x = c.getContext('2d'); x.scale(k, k); return [c, x];
  }
  const ARTS = window.__raceArt || (window.__raceArt = {});
  function art() {
    if (ARTS[dpr]) return ARTS[dpr];
    let seed = 11;
    const rnd = () => (seed = seed * 16807 % 2147483647) / 2147483647;
    const pats = {};
    const pat = (x, col, cell, r) => {
      const k = col + cell + r;
      if (!pats[k]) { const [c, t] = mk(cell, cell, 1); t.fillStyle = col; t.beginPath(); t.arc(cell / 2, cell / 2, r, 0, TAU); t.fill(); pats[k] = c; }
      return x.createPattern(pats[k], 'repeat');
    };
    // a stepped halftone screen: how a lithographer prints a gradient
    const screen = (x, col, x0, y0, x1, y1, radii, cell = 6) => {
      const bh = (y1 - y0) / radii.length;
      radii.forEach((r, i) => { if (r > .05) { x.fillStyle = pat(x, col, cell, r); x.fillRect(x0, y0 + i * bh, x1 - x0, bh + .5); } });
    };
    // flat ink, a halftone inside it, and the keyline printed a hair out of register
    const inked = (x, path, fill, lw = 1.4, inner = null) => {
      x.save(); x.translate(1, .6); path(x); x.fillStyle = fill; x.fill();
      if (inner) { x.clip(); inner(x); }
      x.restore();
      if (lw) { path(x); x.lineWidth = lw; x.strokeStyle = INK; x.lineJoin = 'round'; x.lineCap = 'round'; x.stroke(); }
    };
    const shadeR = (col, r, X, Y, w, h) => x => { x.fillStyle = pat(x, col, 5, r); x.fillRect(X, Y, w, h); };
    const blades = (x, X, B, n, len, spread, cols, lw = 1.2) => {
      for (let k = 0; k < n; k++) {
        const a = -Math.PI / 2 + (k / (n - 1) - .5) * spread + (rnd() - .5) * .2, L = len * (.6 + rnd() * .5), bw = 3 + rnd() * 3;
        const tx = X + Math.cos(a) * L, ty = B + Math.sin(a) * L, bend = (k / (n - 1) - .5) * L * .35;
        inked(x, p => { p.beginPath(); p.moveTo(X - bw, B); p.quadraticCurveTo(X + bend * .5 - bw * .4, B - L * .55, tx + bend, ty); p.quadraticCurveTo(X + bend * .5 + bw * .4, B - L * .5, X + bw, B); p.closePath(); }, cols[k % cols.length], lw);
      }
    };
    const culm = (x, X, B, h, w, col) => {
      inked(x, p => { p.beginPath(); p.rect(X - w / 2, B - h, w, h); }, col, 1.3, shadeR(INK, 1.1, X + w * .1, B - h, w, h));
      x.strokeStyle = INK; x.lineWidth = 1.3;
      for (let y = B - 26 - rnd() * 14; y > B - h + 8; y -= 30 + rnd() * 12) { x.beginPath(); x.moveTo(X - w / 2 - 1, y); x.quadraticCurveTo(X, y + 3, X + w / 2 + 1, y); x.stroke(); }
    };
    const leaf = (x, X, Y, a, L, col) => inked(x, p => {
      p.beginPath(); p.moveTo(X, Y);
      p.quadraticCurveTo(X + Math.cos(a - .3) * L * .5, Y + Math.sin(a - .3) * L * .5, X + Math.cos(a) * L, Y + Math.sin(a) * L);
      p.quadraticCurveTo(X + Math.cos(a + .3) * L * .5, Y + Math.sin(a + .3) * L * .5, X, Y); p.closePath();
    }, col, 1.1);
    const cloud = (x, cx, cy, w) => inked(x, p => {
      p.beginPath(); p.moveTo(cx - w / 2, cy);
      for (let k = 0; k < 4; k++) { const a = cx - w / 2 + (k + .5) * w / 4, r = w * (.12 + .07 * Math.abs(Math.sin(k * 2.1 + cx))); p.arc(a, cy - r * .55, r, Math.PI, 0); }
      p.lineTo(cx + w / 2, cy); p.closePath();
    }, PAPER, 1.2);
    const ridge = (x, x0, x1, base, amp, fill, inner, lw = 0) => {
      const pts = []; let y = base;
      for (let X = x0 - 10; X <= x1 + 30; X += 26 + rnd() * 30) { y = clamp(y + (rnd() - .5) * amp, base - amp, base + amp * .4); pts.push([X, y]); }
      inked(x, p => { p.beginPath(); p.moveTo(x0 - 10, BH); pts.forEach(q => p.lineTo(q[0], q[1])); p.lineTo(x1 + 30, BH); p.closePath(); }, fill, lw, inner);
    };
    const PANEL = {
      reef(x, x0, x1) {
        const WL = 150;
        x.fillStyle = PAPER; x.fillRect(x0, 0, x1 - x0, WL);
        screen(x, C.COBALT, x0, 0, x1, WL, [1.4, 1.15, .9, .65, .4, .2]);
        for (let X = x0 + 90; X < x1; X += 260 + rnd() * 160) cloud(x, X, 60 + rnd() * 50, 80 + rnd() * 70);
        x.fillStyle = TEAL; x.fillRect(x0, WL, x1 - x0, BH - WL);
        screen(x, C.COBALT, x0, WL, x1, BH, [.25, .55, .85, 1.15, 1.45, 1.75, 2.05, 2.35]);
        x.fillStyle = 'rgba(251,248,241,.12)';   // sun shafts, from the lamp's side
        for (let X = x0 + 30; X < x1; X += 140 + rnd() * 100) { const w = 18 + rnd() * 36; x.beginPath(); x.moveTo(X, WL); x.lineTo(X + w, WL); x.lineTo(X + w + 170, BH); x.lineTo(X + 120, BH); x.fill(); }
        x.lineWidth = 2.2; x.strokeStyle = PAPER; x.beginPath(); x.moveTo(x0, WL);
        for (let X = x0; X <= x1; X += 16) x.quadraticCurveTo(X + 8, WL - 7, X + 16, WL);
        x.stroke(); x.lineWidth = 1.1; x.strokeStyle = INK; x.stroke();
        for (let k = 0; k < 28; k++) {   // a school of small fish, printed in one ink
          const a = k / 28 * TAU, fx = x0 + 470 + Math.cos(a) * (70 + rnd() * 40), fy = 220 + Math.sin(a * 2) * 24 + rnd() * 12;
          x.fillStyle = INK; x.beginPath(); x.ellipse(fx, fy, 6, 2.4, 0, 0, TAU); x.moveTo(fx - 5, fy); x.lineTo(fx - 10, fy - 3.5); x.lineTo(fx - 10, fy + 3.5); x.fill();
        }
        for (let X = x0 + 6; X < x1; X += 46 + rnd() * 50) {
          const r = rnd();
          if (r < .4) {
            const segs = [], br = (bx, by, a, len, w, d) => { const ex = bx + Math.cos(a) * len, ey = by + Math.sin(a) * len; segs.push([bx, by, ex, ey, w]); if (d < 3) { br(ex, ey, a - .42 - rnd() * .2, len * .72, w * .72, d + 1); br(ex, ey, a + .38 + rnd() * .2, len * .7, w * .72, d + 1); } };
            br(X, BH, -Math.PI / 2 + (rnd() - .5) * .3, 32 + rnd() * 18, 9, 0);
            x.lineCap = 'round'; x.strokeStyle = INK; segs.forEach(s => { x.lineWidth = s[4] + 2.6; x.beginPath(); x.moveTo(s[0], s[1]); x.lineTo(s[2], s[3]); x.stroke(); });
            x.strokeStyle = C.TOMATO; segs.forEach(s => { x.lineWidth = s[4]; x.beginPath(); x.moveTo(s[0] + .9, s[1] + .5); x.lineTo(s[2] + .9, s[3] + .5); x.stroke(); });
          } else if (r < .7) {
            const R = 36 + rnd() * 22;
            inked(x, p => { p.beginPath(); p.moveTo(X - 3, BH); p.quadraticCurveTo(X - R * 1.1, BH - R * .9, X - R * .2, BH - R * 1.5); p.quadraticCurveTo(X + R * .9, BH - R * 1.4, X + R * .8, BH - R * .5); p.quadraticCurveTo(X + R * .5, BH - 8, X + 3, BH); p.closePath(); }, C.PLUM, 1.3,
              p => { p.strokeStyle = 'rgba(251,248,241,.45)'; p.lineWidth = .8; for (let k = -5; k <= 5; k++) { p.beginPath(); p.moveTo(X, BH); p.lineTo(X + k * R * .26, BH - R * 1.7); p.stroke(); } });
          } else {
            const R = 20 + rnd() * 14;
            inked(x, p => { p.beginPath(); p.ellipse(X, BH, R, R * .8, 0, Math.PI, 0); p.closePath(); }, C.ORANGE, 1.3,
              p => { p.strokeStyle = 'rgba(28,27,31,.5)'; p.lineWidth = 1; for (let k = 1; k < 5; k++) { p.beginPath(); for (let a = 0; a <= 1; a += .05) p.lineTo(X - R + a * 2 * R, BH - k * R * .16 - Math.sin(a * 14 + k) * 2.4); p.stroke(); } });
          }
          if (rnd() < .5) blades(x, X + 22, BH, 4, 34, .7, [C.MINT]);
        }
      },
      canal(x, x0, x1) {
        x.fillStyle = PAPER; x.fillRect(x0, 0, x1 - x0, 300);
        screen(x, C.COBALT, x0, 0, x1, 240, [1.05, .85, .65, .45, .28, .12]);
        const vx = x0 + 250;   // Popocatepetl, and the long ridge of Iztaccihuatl beside it
        inked(x, p => { p.beginPath(); p.moveTo(vx + 120, 270); p.quadraticCurveTo(vx + 330, 170, vx + 420, 176); p.quadraticCurveTo(vx + 480, 168, vx + 560, 190); p.quadraticCurveTo(vx + 640, 220, vx + 700, 270); p.closePath(); }, PAPER, 1.2, shadeR(C.PLUM, 1.1, vx, 150, 800, 130));
        inked(x, p => { p.beginPath(); p.moveTo(vx - 250, 272); p.lineTo(vx - 34, 122); p.quadraticCurveTo(vx - 10, 114, vx + 16, 120); p.lineTo(vx + 250, 272); p.closePath(); }, PAPER, 1.3, shadeR(C.PLUM, 1.6, vx - 260, 110, 520, 170));
        inked(x, p => { p.beginPath(); p.moveTo(vx - 34, 122); p.quadraticCurveTo(vx - 10, 114, vx + 16, 120); p.lineTo(vx + 52, 146); p.lineTo(vx + 30, 140); p.lineTo(vx + 16, 156); p.lineTo(vx - 4, 142); p.lineTo(vx - 24, 158); p.lineTo(vx - 44, 142); p.lineTo(vx - 64, 150); p.closePath(); }, PAPER, 1.2);
        for (let X = x0 + 14; X < x1; X += 34 + rnd() * 28) {   // ahuejote trees along the chinampas
          const h = 80 + rnd() * 60, w = 11 + rnd() * 6;
          inked(x, p => { p.beginPath(); p.ellipse(X, 296 - h / 2, w, h / 2, 0, 0, TAU); }, C.MINT, 1.2, shadeR(INK, 1.2, X + w * .15, 200, w, 120));
        }
        x.fillStyle = TEAL; x.fillRect(x0, 296, x1 - x0, BH - 296);
        screen(x, C.COBALT, x0, 296, x1, BH, [.5, .9, 1.3, 1.7]);
        x.fillStyle = 'rgba(251,248,241,.55)';
        for (let y = 306; y < BH; y += 9 + (y - 296) * .12) for (let X = x0 + rnd() * 40; X < x1; X += 40 + rnd() * 60) x.fillRect(X, y, 12 + rnd() * 26, 1.6);
        const bx = x0 + 470, by = 356;   // a trajinera tied up, its name painted on the arch
        inked(x, p => { p.beginPath(); p.moveTo(bx - 80, by - 14); p.lineTo(bx + 84, by - 14); p.lineTo(bx + 72, by + 4); p.lineTo(bx - 70, by + 4); p.closePath(); }, C.TOMATO, 1.4);
        x.fillStyle = C.MUSTARD; x.fillRect(bx - 78, by - 10, 158, 3);
        x.strokeStyle = INK; x.lineWidth = 2; for (const k of [-60, -20, 20, 60]) { x.beginPath(); x.moveTo(bx + k, by - 14); x.lineTo(bx + k, by - 44); x.stroke(); }
        inked(x, p => { p.beginPath(); p.moveTo(bx - 70, by - 44); p.lineTo(bx + 70, by - 44); p.lineTo(bx + 70, by - 62); p.quadraticCurveTo(bx, by - 84, bx - 70, by - 62); p.closePath(); }, C.MUSTARD, 1.4);
        x.fillStyle = C.TOMATO; x.font = `14px ${SLAB}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('LUPITA', bx, by - 56);
      },
      himalaya(x, x0, x1) {
        x.fillStyle = PAPER; x.fillRect(x0, 0, x1 - x0, BH);
        screen(x, C.MINT, x0, 0, x1, 180, [.9, .7, .5, .3]);
        ridge(x, x0, x1, 150, 70, PAPER, shadeR(C.MINT, 1.1, x0, 60, x1 - x0, 340), 1.1);
        x.fillStyle = 'rgba(251,248,241,.7)'; x.fillRect(x0, 196, x1 - x0, 22);
        ridge(x, x0, x1, 230, 50, PAPER, shadeR(C.MINT, 1.9, x0, 150, x1 - x0, 250), 1.2);
        ridge(x, x0, x1, 300, 36, C.MINT, shadeR(INK, .9, x0, 300, x1 - x0, 100), 1.3);
        for (let X = x0 + 20; X < x1; X += 44 + rnd() * 40) {
          const h = 240 + rnd() * 120, w = 9 + rnd() * 5;
          culm(x, X, BH, h, w, rnd() < .5 ? C.MINT : '#8fc29b');
          for (let k = 0; k < 4; k++) leaf(x, X, BH - h + 30 + k * 18, (k % 2 ? .35 : Math.PI - .35) + (rnd() - .5) * .5, 26 + rnd() * 14, C.MINT);
        }
      },
      sunda(x, x0, x1) {
        x.fillStyle = C.MUSTARD; x.fillRect(x0, 0, x1 - x0, BH);
        screen(x, C.ORANGE, x0, 0, x1, 300, [0, .4, .8, 1.2, 1.6, 2.0]);
        inked(x, p => { p.beginPath(); p.arc(x0 + 640, 250, 74, 0, TAU); }, PAPER, 0, shadeR(C.MUSTARD, 1.3, x0 + 560, 200, 160, 130));
        ridge(x, x0, x1, 250, 40, C.PLUM, shadeR(INK, 1.3, x0, 200, x1 - x0, 200), 1.2);
        for (let X = x0 + 30; X < x1; X += 110 + rnd() * 120) {   // dipterocarps: straight trunks to a flat crown
          const w = 12 + rnd() * 8, top = 40 + rnd() * 70;
          inked(x, p => { p.beginPath(); p.moveTo(X - w / 2 - 10, BH); p.quadraticCurveTo(X - w / 2, BH - 20, X - w / 2, BH - 40); p.lineTo(X - w / 2 + 3, top); p.lineTo(X + w / 2 - 3, top); p.lineTo(X + w / 2, BH - 40); p.quadraticCurveTo(X + w / 2, BH - 20, X + w / 2 + 12, BH); p.closePath(); }, INK, 0);
          x.fillStyle = C.MUSTARD; x.fillRect(X - w / 2 + 2, top + 10, 2, BH - top - 50);
          inked(x, p => { p.beginPath(); for (let k = 0; k < 5; k++) { const ex = X - 60 + k * 30, ey = top + 8 - Math.sin(k * 1.3) * 12; p.moveTo(ex + 30, ey); p.ellipse(ex, ey, 30, 16, 0, 0, TAU); } }, INK, 0, shadeR(C.PLUM, 1.8, X - 100, top - 40, 200, 30));
          if (rnd() < .6) { x.strokeStyle = INK; x.lineWidth = 1.6; x.beginPath(); x.moveTo(X + 20, top + 14); x.bezierCurveTo(X + 30, top + 120, X + 70, top + 90, X + 64, top + 200); x.stroke(); }
        }
        x.fillStyle = C.ORANGE; x.fillRect(x0, 336, x1 - x0, BH - 336); screen(x, INK, x0, 336, x1, BH, [.6, 1.0, 1.4]);
        for (let X = x0 + 20; X < x1; X += 70 + rnd() * 60) blades(x, X, BH, 5, 46, 1.6, [C.MINT, '#8fc29b'], 1.1);
      },
    };
    function caption(x, z) {
      const X = z.x0 + 34, Y = 300, A = animals(), sp = z.who.map(k => (A[k] || { name: DEFNAME[k] }).name.toUpperCase()).join('  ·  ');
      const st = ((A[z.who[0]] || {}).status || (z.key === 'himalaya' ? 'Endangered' : 'Critically Endangered')).toUpperCase();
      x.font = `26px ${SLAB}`; const w1 = x.measureText(z.title).width; x.font = `12px ${SLAB}`;
      const bw = Math.max(w1, x.measureText(sp).width, x.measureText(st).width) + 30;
      inked(x, p => { p.beginPath(); p.rect(X, Y, bw, 80); }, PAPER, 1.6);
      x.fillStyle = C.TOMATO; x.fillRect(X + 7, Y + 7, bw - 14, 3);
      x.fillStyle = INK; x.textAlign = 'left'; x.textBaseline = 'alphabetic';
      x.font = `26px ${SLAB}`; x.fillText(z.title, X + 15, Y + 40);
      x.font = `12px ${SLAB}`; x.fillText(sp, X + 15, Y + 57); x.fillStyle = C.TOMATO; x.fillText(st, X + 15, Y + 72);
    }
    const [bd, bx] = mk((BX1 - BX0) * SB, BH * SB);
    bx.scale(SB, SB); bx.translate(-BX0, 0);
    for (const z of ZONES) { bx.save(); bx.beginPath(); bx.rect(z.x0, 0, z.x1 - z.x0, BH); bx.clip(); PANEL[z.key](bx, z.x0, z.x1); caption(bx, z); bx.restore(); }
    for (const z of ZONES.slice(1)) {   // the panels are separate sheets: a folded seam and its tabs
      bx.fillStyle = 'rgba(255,246,228,.85)'; bx.fillRect(z.x0 - 3, 0, 1.4, BH);
      bx.fillStyle = 'rgba(18,16,20,.6)'; bx.fillRect(z.x0 - 1.6, 0, 3.4, BH);
      bx.fillStyle = 'rgba(18,16,20,.45)'; for (let y = 40; y < BH; y += 90) bx.fillRect(z.x0 + 3, y, 4, 16);
    }
    const bead = bx.createLinearGradient(0, 0, 0, 12);
    bead.addColorStop(0, '#fffaf0'); bead.addColorStop(.3, '#d8d2c6'); bead.addColorStop(.75, '#6b6660'); bead.addColorStop(1, 'rgba(40,36,40,0)');
    bx.fillStyle = bead; bx.fillRect(BX0, 0, BX1 - BX0, 12);

    // verge cut-outs: printed tin standees, anchored bottom centre (units: world)
    const sprite = (w, h, k, draw) => { const [c, x] = mk(w, h, k); x.translate(w / 2, h); draw(x); return { c, w, h }; };
    const K = dpr * .9, S = {};
    S.dune = sprite(90, 70, K, x => blades(x, 0, 0, 8, 62, 1.5, [C.MUSTARD, '#e8c56a', C.MINT]));
    S.reed = sprite(80, 170, K, x => {
      blades(x, 0, 0, 5, 150, .5, [C.MINT, '#8fc29b']);
      for (const [dx, h] of [[-12, 150], [10, 130]]) { x.strokeStyle = INK; x.lineWidth = 1.6; x.beginPath(); x.moveTo(dx, 0); x.lineTo(dx, -h); x.stroke(); inked(x, p => { p.beginPath(); p.ellipse(dx, -h + 16, 4.5, 15, 0, 0, TAU); }, '#8a4a2a', 1.2); }
    });
    S.bamboo = sprite(90, 260, K, x => { culm(x, -16, 0, 240, 13, C.MINT); culm(x, 14, 0, 200, 11, '#8fc29b'); for (let k = 0; k < 6; k++) leaf(x, k % 2 ? 14 : -16, -150 - k * 14, k % 2 ? .4 : Math.PI - .4, 30, C.MINT); });
    S.fern = sprite(130, 80, K, x => { for (let k = 0; k < 7; k++) { const a = -Math.PI / 2 + (k - 3) * .38; for (let j = 1; j < 7; j++) leaf(x, Math.cos(a) * j * 9, -8 + Math.sin(a) * j * 9, a + (j % 2 ? .9 : -.9), 12 - j, C.MINT); } });
    S.mound = sprite(70, 90, K, x => inked(x, p => { p.beginPath(); p.moveTo(-30, 0); p.quadraticCurveTo(-22, -40, -8, -80); p.quadraticCurveTo(2, -88, 8, -70); p.quadraticCurveTo(24, -36, 32, 0); p.closePath(); }, C.ORANGE, 1.4, shadeR(INK, 1.4, 0, -90, 40, 90)));
    // foreground cut-outs sit in the dark between the lamp and the lens: silhouettes with a warm rim, out of focus
    const sil = (w, h, draw, top = false) => {
      const k = dpr * .6, [a, x] = mk(w, h, k);
      x.translate(w / 2, top ? 0 : h);
      x.fillStyle = 'rgba(255,222,172,.6)'; draw(x); x.translate(2.6, 2); x.fillStyle = '#1c1714'; draw(x);
      const [c, y] = mk(w, h, k);
      if ('filter' in y) y.filter = `blur(${(3.2 * k).toFixed(1)}px)`;
      y.drawImage(a, 0, 0, w, h); return { c, w, h, top };
    };
    const blade = (x, X, len, a, w) => { const tx = X + Math.cos(a) * len, ty = Math.sin(a) * len; x.beginPath(); x.moveTo(X - w, 0); x.quadraticCurveTo(X + (tx - X) * .3, ty * .6, tx, ty); x.quadraticCurveTo(X + (tx - X) * .3 + w * .5, ty * .55, X + w, 0); x.fill(); };
    S.fgGrass = sil(260, 230, x => { for (let k = 0; k < 11; k++) blade(x, (k - 5) * 9, 120 + (k * 53 % 90), -Math.PI / 2 + (k - 5) * .15, 13 - Math.abs(k - 5)); });
    S.fgReed = sil(170, 280, x => { for (const [dx, h] of [[-26, 240], [2, 270], [30, 220]]) { x.fillRect(dx - 3, -h, 6, h); x.beginPath(); x.ellipse(dx, -h + 30, 10, 28, 0, 0, TAU); x.fill(); } blade(x, -14, 200, -Math.PI / 2 - .35, 13); blade(x, 16, 170, -Math.PI / 2 + .4, 12); });
    S.fgBamboo = sil(260, 300, x => { x.fillRect(-3, -290, 6, 290); for (let k = 0; k < 9; k++) { const y = -60 - k * 26, a = (k % 2 ? -.35 : -Math.PI + .35) + (k % 3 - 1) * .12; x.save(); x.translate(0, y); blade(x, 0, 96 - k * 4, a, 7); x.restore(); } });
    S.fgFern = sil(320, 200, x => { for (let k = 0; k < 7; k++) { const a = -Math.PI / 2 + (k - 3) * .36; x.save(); x.rotate(a + Math.PI / 2); for (let j = 0; j < 11; j++) { x.beginPath(); x.ellipse(j % 2 ? 11 : -11, -18 - j * 13, 14 - j * .8, 5.5, j % 2 ? -.5 : .5, 0, TAU); x.fill(); } x.fillRect(-2.5, -165, 5, 165); x.restore(); } });
    S.fgVine = sil(120, 320, x => { x.beginPath(); x.moveTo(-7, 0); x.bezierCurveTo(-32, 110, 30, 180, 0, 320); x.lineTo(10, 320); x.bezierCurveTo(40, 180, -22, 110, 7, 0); x.fill(); for (let y = 30; y < 300; y += 30) { x.beginPath(); x.ellipse(y % 60 ? 18 : -18, y, 19, 8, y % 60 ? .5 : -.5, 0, TAU); x.fill(); } }, true);
    // one soft shadow and one dust puff, stretched as needed
    const [soft, sx] = mk(128, 32, 1);
    const sg = sx.createRadialGradient(64, 16, 2, 64, 16, 62); sg.addColorStop(0, 'rgba(20,14,12,.55)'); sg.addColorStop(.6, 'rgba(20,14,12,.22)'); sg.addColorStop(1, 'rgba(20,14,12,0)');
    sx.setTransform(1, 0, 0, .25, 0, 12); sx.fillStyle = sg; sx.fillRect(0, -48, 128, 128);
    const [puff, ux] = mk(32, 32, 1);
    const ug = ux.createRadialGradient(13, 12, 1, 16, 16, 16); ug.addColorStop(0, 'rgba(246,226,196,.95)'); ug.addColorStop(.55, 'rgba(206,160,118,.55)'); ug.addColorStop(1, 'rgba(160,110,80,0)');
    ux.fillStyle = ug; ux.fillRect(0, 0, 32, 32);
    pat(bx, C.TOMATO, 5, 1.25); pat(bx, 'rgba(251,248,241,.9)', 9, .7);
    const dots = pats[C.TOMATO + 5 + 1.25], grain = pats['rgba(251,248,241,.9)' + 9 + .7];
    // verge props and foreground cut-outs, placed once
    const props = [], fg = [];
    for (let X = BX0 + 120; X < BX1 - 200; X += 90 + rnd() * 120) {
      const z = zoneAt(X);
      if (Math.abs(X - FINISH_X) < 90) continue;
      props.push({ X, Z: .87 + rnd() * .18, s: S[z.mid[(rnd() * z.mid.length) | 0]] });
    }
    props.sort((a, b) => b.Z - a.Z);
    for (let X = START_X - 170; X < FINISH_X - 560; X += 560 + rnd() * 380) { const z = zoneAt(X); fg.push({ X, s: S[z.fg[(rnd() * z.fg.length) | 0]] }); }
    // rasterise everything now, at setup, rather than on first sight in the middle of a race
    try { const [, zx] = mk(1, 1, 1); for (const c of [bd, soft, puff, ...Object.values(S).map(s => s.c)]) zx.drawImage(c, 0, 0, 1, 1); zx.getImageData(0, 0, 1, 1); } catch (e) { /* fine */ }
    return (ARTS[dpr] = { bd, props, fg, soft, puff, dots, grain });
  }

  // ---------- the diorama, each frame ----------
  let PT = null, banTex = null, strip = null, stripX = null, lampC = {};
  const onScreen = (x, m) => Math.abs(x - W / 2) < W / 2 / cam.z + m;
  // a tin tube standing on the sheet, shaded across its width by the lamp on the left
  function post(X0, X1, Z, h, A, lit = 1) {
    const s = sAt(Z), x0 = px(X0, Z), x1 = px(X1, Z), y = py(Z), top = py(Z, h);
    if (!onScreen((x0 + x1) / 2, 60)) return;
    g.globalAlpha = .5; g.drawImage(A.soft, x0 - 6 * s, y - 3 * s, x1 - x0 + 30 * s, 8 * s); g.globalAlpha = 1;
    const gr = g.createLinearGradient(x0, 0, x1, 0);
    gr.addColorStop(0, '#80868d'); gr.addColorStop(.22, lit ? '#f6f6f4' : '#c9ccd0'); gr.addColorStop(.5, '#b4b9bf'); gr.addColorStop(.85, '#5d636a'); gr.addColorStop(1, '#3a3f45');
    g.fillStyle = gr; g.fillRect(x0, top, x1 - x0, y - top);
    g.fillStyle = 'rgba(255,248,236,.8)'; g.fillRect(x0, top, x1 - x0, Math.max(.75, 1.2 * s));
  }
  function banner() {
    const X = FINISH_X + 5, Zf = -.1, Zb = ZT + .06, N = 18, Y0 = 186, Y1 = 238, dx = X - cam.x;
    if (Math.abs(dx) < 1 || !onScreen(px(X, 0), 400)) return;
    if (!banTex) {
      const [c, x] = mk(480, 64);
      x.fillStyle = PAPER; x.fillRect(0, 0, 480, 64); x.fillStyle = C.TOMATO; x.fillRect(0, 5, 480, 5); x.fillRect(0, 54, 480, 5);
      x.fillStyle = INK; x.font = `34px ${SLAB}`; x.textBaseline = 'middle'; x.textAlign = 'center';
      [...'FINISH'].forEach((ch, k) => x.fillText(ch, 90 + k * 60, 33));
      banTex = c;
    }
    const face = dx > 0;   // true: the face the runners see coming
    for (let k = 0; k < N; k++) {
      const za = Zb + (Zf - Zb) * k / N, zb = Zb + (Zf - Zb) * (k + 1) / N, zm = (za + zb) / 2, s = sAt(zm);
      const xa = px(X, za), xb = px(X, zb), u = face ? k / N : 1 - (k + 1) / N;
      const sh = 1 - .28 * (face ? 1 - k / N : k / N);   // the far end sits deeper in the lamp's falloff
      g.drawImage(banTex, u * banTex.width, 0, banTex.width / N, banTex.height, Math.min(xa, xb), py(zm, Y1), Math.abs(xb - xa) + .7, (Y1 - Y0) * s);
      if (sh < 1) { g.fillStyle = `rgba(14,13,16,${1 - sh})`; g.fillRect(Math.min(xa, xb), py(zm, Y1), Math.abs(xb - xa) + .7, (Y1 - Y0) * s); }
    }
    // the beam it hangs from: its lit top face and its side
    const X0 = FINISH_X + 6, X1 = FINISH_X + 22, H0 = 238, H1 = 250;
    g.beginPath(); g.moveTo(px(X0, Zf - .04), py(Zf - .04, H1)); g.lineTo(px(X1, Zf - .04), py(Zf - .04, H1)); g.lineTo(px(X1, ZT + .1), py(ZT + .1, H1)); g.lineTo(px(X0, ZT + .1), py(ZT + .1, H1)); g.closePath();
    g.fillStyle = '#e9eaeb'; g.fill();
    g.beginPath(); g.moveTo(px(X0, Zf - .04), py(Zf - .04, H1)); g.lineTo(px(X0, ZT + .1), py(ZT + .1, H1)); g.lineTo(px(X0, ZT + .1), py(ZT + .1, H0)); g.lineTo(px(X0, Zf - .04), py(Zf - .04, H0)); g.closePath();
    const bg = g.createLinearGradient(0, py(0, H1), 0, py(0, H0)); bg.addColorStop(0, '#b9bec3'); bg.addColorStop(1, '#5b6168');
    g.fillStyle = bg; g.fill();
  }
  function token(sty, no, sc) {
    const r = 30 * sc;
    g.beginPath(); g.arc(0, -r, r, 0, TAU); g.fillStyle = sty.bg; g.fill();
    const hl = g.createRadialGradient(-r * .4, -r * 1.45, r * .05, 0, -r, r * 1.05);
    hl.addColorStop(0, 'rgba(255,255,255,.7)'); hl.addColorStop(.35, 'rgba(255,255,255,0)'); hl.addColorStop(1, 'rgba(10,8,12,.45)');
    g.fillStyle = hl; g.fill();
    g.fillStyle = sty.fg; g.font = `${Math.round(r)}px ${SLAB}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(no), 0, -r);
  }
  function drawWorld(A) {
    if (!PT) PT = { dots: g.createPattern(A.dots, 'repeat'), grain: g.createPattern(A.grain, 'repeat') };
    const n = lanes();
    // printed backdrop, standing at the back of the box
    g.drawImage(A.bd, px(BX0, ZB), py(ZB, BH), (BX1 - BX0) * SB, BH * SB);
    // verge: one printed sheet per habitat, a dot screen, the backdrop's contact shadow
    const [v0, v1] = view(ZB);
    for (const z of ZONES) {
      const a = Math.max(z.x0, v0 - 400), b = Math.min(z.x1, v1 + 400);
      if (a >= b) continue;
      quad(a, b, ZT, ZB); g.fillStyle = z.verge; g.fill();
    }
    g.save(); quad(v0 - 400, v1 + 400, ZT, ZB); g.clip();
    const sm = sAt((ZT + ZB) / 2); g.globalAlpha = .35; g.translate(W / 2 - cam.x * sm, py(ZB)); g.scale(sm, sm * .5);
    g.fillStyle = PT.grain; g.fillRect(v0 - 400, 0, v1 - v0 + 800, 240); g.restore();
    const cs = g.createLinearGradient(0, py(ZB), 0, py(ZB) + 22); cs.addColorStop(0, 'rgba(20,14,16,.5)'); cs.addColorStop(1, 'rgba(20,14,16,0)');
    g.fillStyle = cs; g.fillRect(-W, py(ZB), 3 * W, 22);
    for (const p of A.props) {
      const s = sAt(p.Z), x = px(p.X, p.Z), w = p.s.w * s, h = p.s.h * s;
      if (!onScreen(x, w)) continue;
      const y = py(p.Z);
      g.globalAlpha = .45; g.drawImage(A.soft, x - w * .35, y - 3 * s, w * 1.1, 8 * s); g.globalAlpha = 1;
      g.drawImage(p.s.c, x - w / 2, y - h, w, h);
    }
    post(FINISH_X + 6, FINISH_X + 22, ZT + .1, 250, A);
    for (const f of [.25, .5, .75]) {   // quarter poles, striped like the real thing
      const X = START_X + TL * f, Z = ZT + .06, s = sAt(Z), x = px(X, Z);
      if (!onScreen(x, 20)) continue;
      post(X - 3, X + 3, Z, 64, A);
      g.fillStyle = 'rgba(226,55,44,.85)'; for (let k = 0; k < 4; k++) g.fillRect(x - 3 * s, py(Z, 58 - k * 14), 6 * s, 6 * s);
      g.beginPath(); g.arc(x, py(Z, 68), 6 * s, 0, TAU); const bgr = g.createRadialGradient(x - 2 * s, py(Z, 70), .5, x, py(Z, 68), 6 * s); bgr.addColorStop(0, '#fff'); bgr.addColorStop(.4, C.TOMATO); bgr.addColorStop(1, '#5a1410'); g.fillStyle = bgr; g.fill();
    }
    // the back rail: tin posts and a rolled tube
    const [r0, r1] = view(ZR);
    for (let X = Math.floor(r0 / 80) * 80; X < r1 + 80; X += 80) post(X - 2, X + 2, ZR, 26, A);
    const ry0 = py(ZR, 29), ry1 = py(ZR, 23), rg = g.createLinearGradient(0, ry0, 0, ry1);
    rg.addColorStop(0, '#fbfaf6'); rg.addColorStop(.4, '#d5d8db'); rg.addColorStop(1, '#6d737a');
    g.fillStyle = rg; g.fillRect(-W, ry0, 3 * W, ry1 - ry0);
    // the track: orange ink, a tomato screen per lane so the dots foreshorten, printed lines
    const [t0, t1] = view(ZT);
    quad(t0, t1, 0, ZT); g.fillStyle = C.ORANGE; g.fill();
    for (let i = 0; i < n; i++) {
      const Za = ZT * (1 - (i + 1) / n), Zb = ZT * (1 - i / n), s = sAt((Za + Zb) / 2);
      g.save(); quad(t0, t1, Za, Zb); g.clip();
      g.translate(W / 2 - cam.x * s, py(Zb)); g.scale(s, s * .6);
      g.fillStyle = PT.dots; g.fillRect(t0, 0, t1 - t0, (py(Za) - py(Zb)) / (s * .6) + 2); g.restore();
    }
    g.fillStyle = 'rgba(251,248,241,.92)';
    for (let i = 0; i <= n; i++) { const Z = ZT * i / n, th = 2.4 * sAt(Z); g.fillRect(-W, py(Z) - th / 2, 3 * W, th); }
    quad(START_X - 4, START_X + 4, 0, ZT); g.fill();
    // varnished tin catches the lamp: a soft glare that stays with the lens while the sheet slides under it
    g.save(); quad(t0, t1, 0, ZT); g.clip(); g.translate(W * .38, py(ZT * .58)); g.scale(1, .3);
    const gl = g.createRadialGradient(0, 0, 6, 0, 0, 330); gl.addColorStop(0, 'rgba(255,241,218,.3)'); gl.addColorStop(.5, 'rgba(255,241,218,.1)'); gl.addColorStop(1, 'rgba(255,241,218,0)');
    g.globalCompositeOperation = 'screen'; g.fillStyle = gl; g.fillRect(-340, -340, 680, 680); g.restore();
    quad(FINISH_X - 1.5, FINISH_X + 1.5, 0, ZT); g.fill();
    if (onScreen(px(FINISH_X, 0), 60)) for (let c = 0; c < 3; c++) for (let row = 0; row < n * 3; row++) {
      quad(FINISH_X - 27 + c * 8, FINISH_X - 19 + c * 8, ZT * row / (n * 3), ZT * (row + 1) / (n * 3));
      g.fillStyle = (row + c) % 2 ? INK : PAPER; g.fill();
    }
    if (onScreen(px(START_X, 0), 120)) racers.forEach((r, i) => {
      const Z = laneZ(i), s = sAt(Z);
      g.save(); g.translate(px(START_X - 118, Z), py(Z)); g.scale(s, s * .45);
      g.fillStyle = 'rgba(251,248,241,.85)'; g.font = `44px ${SLAB}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(r.grp.no), 0, 0); g.restore();
    });
    // the sheet's folded front lip, printed as a ruler
    const ly = py(0), lg = g.createLinearGradient(0, ly, 0, ly + 11);
    lg.addColorStop(0, '#fff4e2'); lg.addColorStop(.12, C.COBALT); lg.addColorStop(1, '#16275e');
    g.fillStyle = lg; g.fillRect(-W, ly, 3 * W, 11);
    g.fillStyle = 'rgba(251,248,241,.8)';
    for (let X = Math.floor(t0 / 20) * 20; X < t1; X += 20) g.fillRect(px(X, 0), ly + 2, 1, X % 100 ? 3 : 6);
    // wet prints left by the swimmers, then the racers, back lane first, then what they kick up
    for (const m of wet) {
      const s = sAt(m.Z), x = px(m.X, m.Z), y = py(m.Z), w = m.w * s;
      g.fillStyle = `rgba(88,30,12,${.32 * m.life})`; g.beginPath(); g.ellipse(x, y, w, w * .2, 0, 0, TAU); g.fill();
      g.fillStyle = `rgba(255,238,210,${.3 * m.life})`; g.beginPath(); g.ellipse(x - w * .35, y - w * .06, w * .28, w * .045, 0, 0, TAU); g.fill();
    }
    const a0 = laneA();
    racers.forEach((r, i) => {
      const Z = laneZ(i), s = sAt(Z), sc = a0 * s, x = px(r.x - nose(r.key) * a0, Z), y = py(Z);
      if (!onScreen(x, 160)) return;
      g.globalAlpha = .5; g.drawImage(A.soft, x - 30 * sc, y - 12 * sc, 124 * sc, 18 * sc); g.globalAlpha = 1;
      const AN = animals()[r.key], sty = GROUP[r.grp.sty % GROUP.length];
      g.save(); g.translate(x, y);
      if (AN) AN.draw(g, { t: anim + i * .37, mode: r.pose, speed: r.speed, emotion: 'focus', look: 0, bib: { n: String(r.grp.no), bg: sty.bg, fg: sty.fg }, scale: sc });
      else token(sty, r.grp.no, sc);
      g.restore();
    });
    for (const d of dust) {
      const s = sAt(d.Z), R = d.r * s; g.globalAlpha = Math.max(0, d.life) * .7;
      g.drawImage(A.puff, px(d.X, d.Z) - R, py(d.Z, d.Y) - R, R * 2, R * 2);
    }
    g.globalAlpha = 1;
    for (const d of drops) { const s = sAt(d.Z); g.fillStyle = `rgba(232,244,255,${Math.max(0, d.life)})`; g.fillRect(px(d.X, d.Z) - s, py(d.Z, d.Y) - s, 2.2 * s, 2.2 * s); }
    banner();
    post(FINISH_X + 6, FINISH_X + 22, -.14, 250, A);
    // the table the diorama stands on, catching a little of the lamp
    const tg = g.createLinearGradient(0, ly + 11, 0, H + 40); tg.addColorStop(0, '#2a2320'); tg.addColorStop(1, NIGHT);
    g.fillStyle = tg; g.fillRect(-W, ly + 11, 3 * W, H);
  }
  const mixc = (a, b, k) => `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * k)).join(',')})`;
  // the one lamp: a warm pool that tightens onto the line as the drama rises
  function lampPass() {
    const q = Math.round(clamp(drama, 0, 1) * 48);
    if (!lampC[q]) {   // a small light map per drama step, stretched: cheap on any machine
      const k = q / 48, cx = W * (.42 + .08 * k), cy = H * (.36 + .16 * k), R = W * (.82 - .3 * k), [c, x] = mk(W / 4, H / 4, 1);
      const gr = x.createRadialGradient(cx / 4, cy / 4, R * .01, cx / 4, cy / 4, R / 4);
      gr.addColorStop(0, '#fff8ea'); gr.addColorStop(.5, mixc([238, 220, 190], [205, 180, 148], k)); gr.addColorStop(1, mixc([52, 45, 54], [14, 13, 16], k));
      x.fillStyle = gr; x.fillRect(0, 0, W / 4, H / 4); lampC[q] = c;
    }
    g.globalCompositeOperation = 'multiply'; g.drawImage(lampC[q], 0, 0, W, H); g.globalCompositeOperation = 'source-over';
  }
  // the photo-finish camera: one column of pixels on the line, appended right to left as race time passes
  function capture() {
    if (!rec.on || rec.pend < 1 || rec.x <= 0) return;
    const n = Math.min(Math.floor(rec.pend), rec.x); rec.pend -= n; rec.x -= n;
    try { stripX.drawImage(canvas, Math.round(W / 2 * dpr) - 1, Math.round(SY0 * dpr), 2, Math.round(SH * dpr), rec.x, 0, n, SH); } catch (e) { /* ignore */ }
  }
  function drawFg(A) {
    const s = sAt(ZF);
    for (const f of A.fg) {
      const x = px(f.X, ZF), w = f.s.w * s, h = f.s.h * s;
      if (!onScreen(x, w)) continue;
      g.drawImage(f.s.c, x - w / 2, f.s.top ? -24 : py(ZF) - h, w, h);
    }
  }
  function drawTags() {
    const a0 = laneA();
    g.shadowColor = 'rgba(0,0,0,.65)'; g.shadowBlur = 10; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    racers.forEach((r, i) => {
      if (!r.place) return;
      const Z = laneZ(i), s = sAt(Z), x = px(r.x - nose(r.key) * a0, Z), y = py(Z) - 104 * a0 * s, k = ease(clamp((t - r.T) * 3, 0, 1));
      g.globalAlpha = k; font(800, Math.round(12 + 14 * s), 'semi-condensed');
      g.fillStyle = r.place === 1 ? LAMP : WALLC; g.fillText(ORD(r.place), x, y - 6 * (1 - k));
    });
    g.globalAlpha = 1; g.shadowColor = 'transparent'; g.shadowBlur = 0;
  }

  // ---------- the judges' print ----------
  function develop() {
    const x0 = Math.floor(rec.x), w = RW - x0;
    if (w < 8 || !strip) return;
    const [c, x] = mk(w, SH);
    x.drawImage(strip, x0 * dpr, 0, w * dpr, SH * dpr, 0, 0, w, SH);
    x.globalCompositeOperation = 'saturation'; x.fillStyle = '#808080'; x.fillRect(0, 0, w, SH);
    x.globalCompositeOperation = 'multiply'; x.fillStyle = '#eee4d0'; x.fillRect(0, 0, w, SH);
    x.globalCompositeOperation = 'source-over';
    print = { c, w, x0 }; printT = 0; sfx('sting');
  }
  function drawPrint() {
    const k = ease(clamp(printT / .6, 0, 1));
    const sc = Math.min(1, 720 / print.w, 232 / SH), iw = print.w * sc, ih = SH * sc, pad = 12, pw = iw + pad * 2, ph = ih + pad + 40;
    const x = (W - pw) / 2, y = H - 46 - ph + (1 - k) * (ph + 90);
    g.save(); g.translate(x + pw / 2, y + ph / 2); g.rotate(-.013 * k); g.translate(-pw / 2, -ph / 2);
    g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = 30; g.shadowOffsetY = 12;
    g.fillStyle = '#f3eee3'; g.fillRect(0, 0, pw, ph);
    g.shadowColor = 'transparent'; g.shadowBlur = 0; g.shadowOffsetY = 0;
    g.drawImage(print.c, pad, pad, iw, ih);
    // time runs right to left, as on a real finish print: whoever is furthest right got there first
    const X = tau => pad + (RW - (tau - rec.t0) * PPS - print.x0) * sc, tLeft = rec.t0 + print.w / PPS;
    const lab = [10, 20, 50, 100].find(s => s / 100 * PPS * sc >= 46) || 100, ty = pad + ih;
    g.fillStyle = INK; font(600, 10, 'semi-condensed'); g.textAlign = 'center'; g.textBaseline = 'top';
    for (let i = Math.ceil(rec.t0 * 100); i <= Math.floor(tLeft * 100); i++) {
      const tx = X(i / 100), big = i % 10 === 0;
      g.fillRect(tx - .5, ty, 1, big ? 9 : i % 5 === 0 ? 6 : 3);
      if (i % lab === 0) g.fillText((i / 100).toFixed(2), tx, ty + 12);
    }
    g.fillRect(pad, ty, iw, 1);
    finishOrder.forEach((ri, p) => {
      const r = racers[ri], sty = GROUP[r.grp.sty % GROUP.length], cx = X(r.T);
      if (cx < pad - 1 || cx > pad + iw + 1) return;
      g.fillStyle = sty.bg; g.fillRect(cx - .5, pad, 1, ih);
      const label = `${ORD(p + 1)}  ${r.T.toFixed(3)}`;
      font(700, 11, 'semi-condensed'); const tw = g.measureText(label).width + 26, tx = Math.max(pad, cx - tw), yy = pad + 6 + p * 18;
      g.fillStyle = 'rgba(243,238,227,.94)'; g.fillRect(tx, yy, tw, 15);
      g.fillStyle = sty.bg; g.fillRect(tx, yy, 15, 15);
      g.fillStyle = sty.fg; g.font = `9px ${SLAB}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(r.grp.no), tx + 7.5, yy + 8);
      font(700, 11, 'semi-condensed'); g.fillStyle = INK; g.textAlign = 'left'; g.fillText(label, tx + 20, yy + 8);
    });
    g.restore();
  }

  // ---------- screen layer: standings, clock, countdown, commentary ----------
  function drawHud() {
    const live = state === 'run' || state === 'done';
    const ranked = racers.map((r, i) => i).sort((a, b) => (racers[a].place || 99) - (racers[b].place || 99) || (live ? racers[b].x - racers[a].x : a - b));
    // standings and clock share one opaque timing bar across the top, so the printed habitat plaques
    // on the backdrop never sit under the standings
    const BAR = 34, CLOCK_W = 150, room = W - CLOCK_W - 16;
    g.fillStyle = 'rgba(14,13,16,.94)'; g.fillRect(0, 0, W, BAR);
    g.fillStyle = 'rgba(255,233,196,.28)'; g.fillRect(0, BAR, W, 1);
    g.textBaseline = 'middle';
    const entries = ranked.map(ri => ({ r: racers[ri], name: racers[ri].grp.name, kind: kindOf(racers[ri]) }));
    const measure = withKind => entries.reduce((s, e) => {
      font(600, 13, 'semi-condensed'); let w = (live ? 16 : 0) + 9 + g.measureText(e.name).width + 20;
      if (withKind) { font(400, 12, 'semi-condensed'); w += g.measureText(e.kind).width + 6; }
      return s + w;
    }, 16);
    let withKind = measure(true) <= room;
    if (!withKind && measure(false) > room) {
      // still too wide: shorten the group names evenly until the bar fits
      const each = (room - 16) / entries.length - (live ? 16 : 0) - 29;
      font(600, 13, 'semi-condensed');
      for (const e of entries) { let n = e.name; while (n.length > 2 && g.measureText(n + '…').width > each) n = n.slice(0, -1); if (n !== e.name) e.name = n + '…'; }
    }
    let x = 16;
    entries.forEach((e, k) => {
      const sty = GROUP[e.r.grp.sty % GROUP.length], y = BAR / 2 + 1;
      if (live) { font(700, 13, 'semi-condensed'); g.textAlign = 'left'; g.fillStyle = k === 0 ? LAMP : 'rgba(242,241,238,.6)'; g.fillText(String(k + 1), x, y); x += 16; }
      g.fillStyle = sty.bg; g.fillRect(x, y - 7, 3, 14); x += 9;
      font(600, 13, 'semi-condensed'); g.textAlign = 'left'; g.fillStyle = 'rgba(242,241,238,.94)'; g.fillText(e.name, x, y);
      x += g.measureText(e.name).width + 6;
      if (withKind) { font(400, 12, 'semi-condensed'); g.fillStyle = 'rgba(242,241,238,.55)'; g.fillText(e.kind, x, y); x += g.measureText(e.kind).width; }
      x += 14;
    });
    // race clock: stops on the winner and shows the thousandths, like a real timing board
    g.fillStyle = 'rgba(255,233,196,.18)'; g.fillRect(W - CLOCK_W, 6, 1, BAR - 12);
    const secs = live ? (crossed.length ? TOF(0) : Math.max(0, t)) : 0, txt = crossed.length ? secs.toFixed(3) : secs.toFixed(2);
    font(600, 20); g.fillStyle = LAMP; g.textAlign = 'center';
    for (let k = txt.length - 1, cx = W - 20; k >= 0; k--) { const cw = txt[k] === '.' ? 6 : 12.5; g.fillText(txt[k], cx - cw / 2, BAR / 2 + 1); cx -= cw; }
    if (state === 'count') {
      const n = Math.ceil(count), f = count - Math.floor(count);
      g.save(); g.globalAlpha = clamp(f * 3, 0, 1); g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = 40;
      font(800, Math.round(170 * (1 + .08 * f)), 'extra-condensed'); g.fillStyle = WALLC; g.textAlign = 'center';
      g.fillText(String(n), W / 2, H / 2 - 14); g.restore();
    }
    if (gray > .02 && crossed.length) {   // the frozen frame carries the camera's cursor on the line
      g.globalAlpha = gray; g.fillStyle = 'rgba(251,248,241,.9)'; g.fillRect(W / 2 - .5, 0, 1, H - 36);
      font(600, 13); g.textAlign = 'right'; g.fillText(TOF(0).toFixed(3), W / 2 - 8, 70); g.globalAlpha = 1;
    }
    if (line) {
      const a = Math.min(1, lineT * 5);
      g.fillStyle = `rgba(14,13,16,${.88 * a})`; g.fillRect(0, H - 36, W, 36);
      g.fillStyle = `rgba(255,233,196,${.3 * a})`; g.fillRect(0, H - 36, W, 1);
      g.save(); g.beginPath(); g.rect(0, H - 36, 22 + lineT * 1800, 36); g.clip();
      font(500, 18); g.fillStyle = WALLC; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText(line, 22, H - 17); g.restore();
    }
  }

  const zoom = () => { g.translate(W / 2, cam.fy); g.scale(cam.z, cam.z); g.translate(-W / 2, -cam.fy); };
  function draw() {
    const A = art();
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    if ('fontStretch' in g) g.fontStretch = 'normal';
    g.fillStyle = NIGHT; g.fillRect(0, 0, W, H);
    g.save(); zoom(); drawWorld(A); g.restore();
    lampPass(); capture();
    g.save(); zoom(); drawFg(A); drawTags(); g.restore();
    if (gray > 0) { g.globalCompositeOperation = 'saturation'; g.globalAlpha = gray; g.fillStyle = '#808080'; g.fillRect(0, 0, W, H); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; }
    if (flash > 0) { g.fillStyle = `rgba(255,252,246,${flash})`; g.fillRect(0, 0, W, H); }
    drawHud();
    if (print) drawPrint();
  }

  // ---------- simulation ----------
  const AQUA = { shark: 1, turtle: 1, axolotl: 1 };
  function spray(r, i, sdt, a0) {
    const Z = laneZ(i), X = r.x - nose(r.key) * a0;
    if (AQUA[r.key]) {   // the swimmers carry their water with them and leave it on the tin
      r.wetT = (r.wetT || 0) + sdt;
      if (r.wetT > .09) { r.wetT = 0; wet.push({ X: X + (Math.random() - .5) * 14, Z: Z + (Math.random() - .5) * .012, w: 11 + Math.random() * 12, life: 1 }); if (wet.length > 140) wet.shift(); }
      if (Math.random() < sdt * 14 * r.speed) drops.push({ X: X - 20 * a0, Z, Y: 10 + Math.random() * 18, vx: -40 - Math.random() * 90, vy: 60 + Math.random() * 90, life: .7 });
    } else if (Math.random() < sdt * 11 * r.speed) dust.push({ X: X - 26 * a0, Z: Z + .004, Y: 3, vx: -30 - Math.random() * 40, vy: 14 + Math.random() * 18, r: 5 + Math.random() * 5, life: .8 });
  }
  function aimCam(dt, tx, tz, fy, rate) {
    const e = 1 - Math.exp(-dt * rate), ez = 1 - Math.exp(-dt * 2.6);
    cam.x += (tx - cam.x) * e; cam.z += (tz - cam.z) * ez; cam.fy += (fy - cam.fy) * ez;
  }
  function step(dt) {
    dt = Math.min(dt, .1);
    lineT += dt; flash = Math.max(0, flash - dt * 2.2);
    if (state === 'count') {
      const before = Math.ceil(count); count -= dt; const after = Math.ceil(count);
      if (after !== before && after > 0) sfx('tickLow');
      if (count <= 0) { state = 'run'; t = 0; sfx('pistol'); say(''); racers.forEach(r => r.pose = 'run'); }
    }
    if (state !== 'run' && state !== 'done') {
      anim += dt; aimCam(dt, START_X + 150, reduced ? 1 : 1.18, TRACK_MID, 3.2);
      drama += ((state === 'count' ? .35 : 0) - drama) * Math.min(1, dt * 2.5);
      hooks.roll && hooks.roll(0); draw(); return;
    }
    const T0 = TOF(0), T1 = TOF(1), TN = TOF(racers.length - 1);
    const near = !crossed.length && t >= T0 - .9;
    const photo = crossed.length > 0 && t < T1 + .25;
    if (near && !saidNear) { saidNear = true; sfx('drum', .8); }
    let slowTo = near || photo ? .4 : 1;
    if (reduced) slowTo = 1;
    cam.slow += (slowTo - cam.slow) * Math.min(1, dt * 7);
    let sdt = dt * cam.slow;
    if (freeze > 0) { freeze -= dt; sdt = dt * .01; }
    gray = freeze > 0 ? 1 : Math.max(0, gray - dt * 2.5);
    t += sdt; anim += sdt;
    if (!rec.on && !rec.done && t >= T0 - .45) {
      rec.on = true; rec.t0 = t; rec.x = RW; rec.pend = 0;
      if (!strip) [strip, stripX] = mk(RW, SH); else stripX.clearRect(0, 0, RW, SH);
    }
    if (rec.on) rec.pend += sdt * PPS;
    const a0 = laneA();
    racers.forEach((r, i) => {
      const nx = posAt(r, t);
      const v = (nx - r.x) / Math.max(1e-4, sdt);
      r.speed = clamp(v / (TL / 8.8), .15, 1.6);
      if (state === 'run' && nx > r.x + .01 && !reduced) spray(r, i, sdt, a0);
      r.x = nx;
      // places go in the drawn order, so two noses over the line in one long frame cannot swap
      if (!r.place && t >= r.T) for (const j of finishOrder) {
        const q = racers[j];
        if (!q.place) {
          crossed.push(j); q.place = crossed.length; q.pose = q.place === 1 ? 'cheer' : 'idle';
          if (q.place === 1) {
            flash = reduced ? 0 : 1; freeze = reduced ? 0 : .7; sfx('drum', 0); sfx('shutter');
            hail(q); sfx('crowd');
          }
          if (crossed.length === racers.length) { state = 'done'; doneT = 0; }
        }
        if (q === r) break;
      }
      if (r.place > 1 && t > r.T + 1.2) r.pose = r.place === racers.length ? 'worry' : 'idle';
    });
    // commentary on lead changes
    if (state === 'run' && !crossed.length) {
      const l = leaderAt(t);
      if (l !== leader && t > .9) {
        const r = racers[l];
        if (leader !== -1) { const L = window.I18N; say(L ? L.t('race.leads', { name: nameOf(r) }) : `${nameOf(r)} leads`); if (near) sfx('gasp'); }
        leader = l;
      }
    }
    if (print) printT += dt;
    if (state === 'done') { doneT += dt; if (!finished && (printT > 1.8 || doneT > 7)) { finished = true; hooks.onFinish && hooks.onFinish(finishOrder.map(i => racers[i].grp)); } }
    for (const d of dust) { d.life -= sdt * 1.3; d.X += d.vx * sdt; d.Y += d.vy * sdt; d.r += sdt * 14; }
    for (const d of drops) { d.life -= sdt * 1.4; d.X += d.vx * sdt; d.Y += d.vy * sdt; d.vy -= 520 * sdt; if (d.Y < 0) { d.Y = 0; d.life = Math.min(d.life, .12); } }
    for (const m of wet) m.life -= sdt * .32;
    dust = dust.filter(d => d.life > 0); drops = drops.filter(d => d.life > 0); wet = wet.filter(m => m.life > 0);
    // camera: ride with the front of the pack, whip to the line and lock on it for the finish camera, then ease back
    let tx, tz = 1.2, fy = TRACK_MID - 10, rate = 3.2;
    if (!near && !crossed.length) { const xs = racers.map(r => r.x).sort((a, b) => b - a); tx = (xs[0] + (xs[1] ?? xs[0])) / 2 + 70; }
    else if (!rec.done) { tx = FINISH_X; tz = 1.5; fy = TRACK_MID; rate = 6; }
    else { tx = FINISH_X + 110; tz = 1.08; }
    if (reduced) tz = 1;
    aimCam(dt, tx, tz, fy, rate);
    if (rec.on) cam.x = FINISH_X;
    let dT = .12;
    if (near) dT = .85;
    if (crossed.length) dT = photo ? 1 : .55;
    if (freeze > 0) dT = 1;
    if (state === 'done') dT = print ? .75 : .55;
    drama += (dT - drama) * Math.min(1, dt * 2.5);
    hooks.roll && hooks.roll(state === 'run' ? .35 * cam.slow : 0);
    draw();
    if (rec.on && (t >= Math.max(TN + .35, rec.t0 + 2.6) || rec.x <= 0)) { rec.on = false; rec.done = true; develop(); }
  }
  // skip: the order was drawn before the gun, so jump to the end of this race. A print already made stays;
  // a strip still recording is dropped rather than developed half-way
  const skippable = () => state === 'count' || state === 'run' || (state === 'done' && !finished);
  function skip() {
    if (!skippable()) return false;
    const n = racers.length, hailed = crossed.length > 0;
    if (state !== 'done') { state = 'done'; doneT = 0; }
    finished = true; saidNear = true; t = Math.max(t, TOF(n - 1) + 2);
    sfx('drum', 0); hooks.roll && hooks.roll(0);
    finishOrder.forEach(i => { if (!racers[i].place) { crossed.push(i); racers[i].place = crossed.length; } });
    racers.forEach(r => {
      r.x = posAt(r, t); r.speed = clamp((r.x - posAt(r, t - .05)) / .05 / (TL / 8.8), .15, 1.6);
      r.pose = r.place === 1 ? 'cheer' : r.place === n ? 'worry' : 'idle';
    });
    if (!hailed) { hail(racers[crossed[0]]); sfx('crowd'); }
    lineT = Math.max(lineT, 1); flash = 0; freeze = 0; gray = 0; cam.slow = 1; dust = []; drops = []; wet = [];
    if (print) printT = Math.max(printT, .6); else { rec.on = false; rec.done = true; }
    cam.x = FINISH_X + 110; cam.z = reduced ? 1 : 1.08; cam.fy = TRACK_MID - 10; drama = print ? .75 : .55;
    hooks.onFinish && hooks.onFinish(finishOrder.map(i => racers[i].grp));
    draw();
    return true;
  }

  fit();
  return {
    setup(list) {
      fit();
      if (state === 'run' && !crossed.length) sfx('drum', 0);
      racers = list.map(grp => ({ grp, key: grp.animal, x: START_X, T: 9, speed: 0, pose: 'idle', place: 0, curve: null }));
      state = 'ready'; t = 0; crossed = []; leader = -1; flash = 0; freeze = 0; gray = 0; dust = []; drops = []; wet = [];
      line = ''; lineT = 0; print = null; printT = 0; finished = false; saidNear = false; doneT = 0; drama = 0; anim = 0;
      Object.assign(rec, { on: false, done: false, t0: 0, x: RW, pend: 0 });
      cam.x = START_X + 150; cam.z = reduced ? 1 : 1.18; cam.fy = TRACK_MID; cam.slow = 1;
      racers.forEach(r => nose(r.key));
      plan(); draw();
    },
    start() { if (state !== 'ready') return; state = 'count'; count = 2.4; sfx('tickLow'); racers.forEach(r => r.pose = 'worry'); say(''); },
    step,
    skip,
    get canSkip() { return skippable(); },
    get state() { return state; },
    get drama() { return clamp(drama, 0, 1); },
    get timeScale() { return freeze > 0 ? .01 : cam.slow; },
  };
};
