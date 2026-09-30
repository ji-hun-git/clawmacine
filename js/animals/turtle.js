// Hawksbill sea turtle (Eretmochelys imbricata), IUCN Critically Endangered.
// Character: an old sea captain who has seen worse weather than a race. Heavy-lidded and unbothered,
// barnacles on his shell, an anchor tattooed on his flipper, and a terry sweatband he put on for the day.
// Anatomy: narrow hooked hawk beak, long shield of overlapping tortoiseshell scutes with a serrated back
// rim, long paddle fore-flippers with two claws each, small rudder hind flippers.
// Gait: the sea-turtle haul. Both fore-flippers reach forward together, plant and pull; the shell lifts
// and surges, the head thrusts on each pull, then the body drops back onto the plastron.
// Look: a lacquered vinyl collectible under the game's one lamp (AKIT.LIGHT, upper left, in front). Every part is a
// lit volume; the shell is a dome of domed plates that each throw a glint; markings are painted first and take the
// same light as the form under them. No ink keylines: edges come from the light and a faint contour.
(() => {
  const { C, TAU, blush, cyc, ease, ao, cast, eye3d, shade, tint } = AKIT;
  const LAMP = AKIT.LIGHT;

  // tortoiseshell and skin inks
  const AMBER = '#d98b2b', GOLD = '#f4b949', CHESTNUT = '#8a3d17', UMBER = '#3a1f10', RIM = '#b35d1b',
    PLASTRON = '#f2d690', SKIN = '#e8bb5a', SCALE = '#6c3519', SCALE_FAR = '#48220e',
    SEAM = '#f5cf78', LID = '#93501f', BARNACLE = '#e3d9c3', BAND = '#f6f0e4', HORN = '#5c3b1d';
  const DK = '20,15,20', LT = '255,246,230', EDGE = 'rgba(20,15,20,.5)';   // the room's shadow and the lamp's colour

  const lerp = (a, b, k) => a + (b - a) * k;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const bell = x => (1 - Math.cos(TAU * x)) / 2;          // 0 -> 1 -> 0 across [0, 1], flat at both ends
  const wrap = x => ((x % 1) + 1) % 1;
  const quadAt = (p0, p1, p2, s) => {
    const k = 1 - s;
    return [k * k * p0[0] + 2 * k * s * p1[0] + s * s * p2[0], k * k * p0[1] + 2 * k * s * p1[1] + s * s * p2[1]];
  };

  // Static outlines are built once as Path2D (where available) so each frame only builds what moves.
  // Without Path2D the path is traced into the context on every use.
  const P2D = typeof Path2D === 'function', cache = {};
  function trace(g, key, build) {
    if (!P2D) { g.beginPath(); build(g); return null; }
    if (!key) { const p = new Path2D(); build(p); return p; }
    let p = cache[key];
    if (!p) { p = new Path2D(); build(p); cache[key] = p; }
    return p;
  }
  const fillP = (g, p, st) => { g.fillStyle = st; if (p) g.fill(p); else g.fill(); };
  const strokeP = (g, p, st, w) => { g.strokeStyle = st; g.lineWidth = w; if (p) g.stroke(p); else g.stroke(); };
  const retrace = (g, p, build) => { if (!p) { g.beginPath(); build(g); } };
  function strokeAt(g, key, build, dx, dy, st, w) {
    g.save(); g.translate(dx, dy); strokeP(g, trace(g, key, build), st, w); g.restore();
  }

  // ---- the lamp ----
  // its direction in the current local frame (a unit 2D vector toward the light, whatever rotation is applied)
  const ID = { a: 1, b: 0, c: 0, d: 1 };
  function lamp(g) {
    const m = (g.getTransform && g.getTransform()) || ID, det = m.a * m.d - m.b * m.c || 1;
    const x = (m.d * LAMP.x - m.c * LAMP.y) / det, y = (-m.b * LAMP.x + m.a * LAMP.y) / det, n = Math.hypot(x, y) || 1;
    return [x / n, y / n];
  }
  const turn = (L, a) => { const c = Math.cos(a), s = Math.sin(a); return [L[0] * c + L[1] * s, -L[0] * s + L[1] * c]; };
  // The kit's vol() falloff as a translucent layer (tint toward the lamp, shade toward the room), so whatever is
  // painted underneath, scales, flames or a tattoo, turns away from the light with the form it is painted on.
  function falloff(g, cx, cy, r, L, lit = .26, depth = .55, soft = 0) {
    const m = .35 + soft * .15;
    const gr = g.createRadialGradient(cx + L[0] * r * .45, cy + L[1] * r * .45, r * .05, cx - L[0] * r * .15, cy - L[1] * r * .15, r * (1.15 + soft * .25));
    gr.addColorStop(0, `rgba(${LT},${lit})`); gr.addColorStop(m, `rgba(${LT},0)`); gr.addColorStop(m, `rgba(${DK},0)`);
    gr.addColorStop(.78, `rgba(${DK},${depth * .55})`); gr.addColorStop(1, `rgba(${DK},${depth})`);
    return gr;
  }
  function glossAt(g, cx, cy, r, L, a, soft = 0) {
    const sx = cx + L[0] * r * .55, sy = cy + L[1] * r * .55, sr = r * (.2 + soft * .35);
    const gr = g.createRadialGradient(sx, sy, 0, sx, sy, sr);
    gr.addColorStop(0, `rgba(255,252,244,${a})`); gr.addColorStop(.3, `rgba(255,252,244,${a * .5})`); gr.addColorStop(1, 'rgba(255,252,244,0)');
    return gr;
  }
  // soft darkening at a point, used as a fill of the part it darkens so it never spills into the air
  function dim(g, x, y, r, a) {
    const q = g.createRadialGradient(x, y, 0, x, y, r);
    q.addColorStop(0, `rgba(12,8,12,${a})`); q.addColorStop(1, 'rgba(12,8,12,0)');
    return q;
  }
  // a crisp specular of the lamp on lacquer: a hot core in a faint halo, lying across the light
  function spark(g, x, y, rx, ry, rot, a) {
    g.beginPath(); g.ellipse(x, y, rx * 1.8, ry * 2.4, rot, 0, TAU); g.fillStyle = `rgba(255,250,236,${a * .2})`; g.fill();
    g.beginPath(); g.ellipse(x, y, rx, ry, rot, 0, TAU); g.fillStyle = `rgba(255,252,244,${a})`; g.fill();
  }
  // the same, soft all the way through: a wet reflection of the lamp on a rounded plate
  function glint(g, x, y, rx, ry, rot, a) {
    g.save(); g.translate(x, y); g.rotate(rot); g.scale(rx, ry);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, 1);
    gr.addColorStop(0, `rgba(255,252,244,${a})`); gr.addColorStop(.3, `rgba(255,250,238,${a * .5})`); gr.addColorStop(1, 'rgba(255,248,232,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 1, 0, TAU); g.fill(); g.restore();
  }
  // a painted part: base colour, its printed details, then the lamp over both, the gloss, and a faint contour
  function solid(g, key, build, base, cx, cy, r, L, o, detail) {
    const p = trace(g, key, build);
    fillP(g, p, base);
    if (detail) { detail(); retrace(g, p, build); }
    fillP(g, p, falloff(g, cx, cy, r, L, o.lit ?? .26, o.depth ?? .55, o.soft || 0));
    if (o.gloss) fillP(g, p, glossAt(g, cx, cy, r, L, o.gloss, o.soft || 0));
    if (o.edge !== 0) strokeP(g, p, EDGE, o.edge || .8);
    return p;
  }

  // ---- baked parts ----
  // What never changes shape (the shell with its barnacles, the head's base, the sweatband, the bib) is painted once
  // into a sprite, at the resolution it is shown at and for the lamp's direction in its own frame in steps of ASTEP,
  // the way the roulette bakes its bowl. Each frame just lays the sprite down, so the light still sits in screen
  // space when the body tilts. Least recently used sprites are dropped past a pixel budget.
  const ASTEP = .08, sprites = new Map();
  let spritePx = 0, fontOK = false;
  function resOf(g) {
    const m = (g.getTransform && g.getTransform()) || ID, k = Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)) || 1;
    return clamp(Math.pow(2, Math.ceil(Math.log2(k) * 2 - 1e-6) / 2), .5, 8);
  }
  function stamp(g, key, box, L, paint) {
    const q = Math.round(Math.atan2(L[1], L[0]) / ASTEP), res = resOf(g), id = key + '|' + res + '|' + q;
    let c = sprites.get(id);
    if (c) { sprites.delete(id); sprites.set(id, c); }
    else {
      c = document.createElement('canvas');
      c.width = Math.max(1, Math.ceil(box[2] * res)); c.height = Math.max(1, Math.ceil(box[3] * res));
      const x = c.getContext('2d');
      x.setTransform(res, 0, 0, res, -box[0] * res, -box[1] * res); x.lineJoin = 'round'; x.lineCap = 'round';
      paint(x, [Math.cos(q * ASTEP), Math.sin(q * ASTEP)]);
      sprites.set(id, c); spritePx += c.width * c.height;
      for (const [k, v] of sprites) { if (spritePx < 3e6) break; sprites.delete(k); spritePx -= v.width * v.height; }
    }
    g.drawImage(c, box[0], box[1], c.width / res, c.height / res);
  }

  const flames = list => p => {
    for (const f of list) {
      p.moveTo(f[0], f[1]);
      for (let i = 2; i < f.length; i += 4) p.quadraticCurveTo(f[i], f[i + 1], f[i + 2], f[i + 3]);
      p.closePath();
    }
  };

  // ---- shell frame: origin mid-way along the lower rim of the carapace, +x toward the head ----
  const NECK = [38, -16], FORE = [27, -3], FORE_FAR = [23, -6], HIND = [-30, -1], HIND_FAR = [-33, -4];
  const FL1 = 12, FL2 = 34, HEAD = 1.12;

  function carapaceB(p) {
    p.moveTo(44, -10);
    p.bezierCurveTo(46, -26, 30, -44, 6, -45);
    p.bezierCurveTo(-20, -46, -42, -34, -54, -16);
    // serrated trailing rim: the posterior marginals end in saw teeth
    p.lineTo(-60.5, -13); p.lineTo(-53.8, -10.6); p.lineTo(-59, -6.6); p.lineTo(-51.2, -5.2); p.lineTo(-54.6, -.8); p.lineTo(-46, -1);
    p.quadraticCurveTo(0, 5, 44, -10);
    p.closePath();
  }
  const plSeamB = p => { for (const [x, y0, y1] of [[-24, 1.4, 5], [-6, 1.7, 5.7], [12, .3, 3.4], [28, -4.4, -1.1]]) { p.moveTo(x, y0); p.lineTo(x - .6, y1); } };
  const plastronB = p => { p.moveTo(-44, -1); p.quadraticCurveTo(0, 4.5, 42, -9.5); p.lineTo(37, -4.2); p.quadraticCurveTo(0, 12, -38, 3); p.closePath(); };
  // tortoiseshell: chestnut flames fanning forward from each scute's trailing seam, umber cores, gold flashes
  const chestnutB = flames([
    [15, -10, 20, -22, 33, -27, 26, -19, 30, -13, 22, -12, 17, -8],
    [-8, -8, -2, -20, 12, -29, 3, -21, 5, -17, 9, -14, 15, -12, 4, -9, -4, -5],
    [-29, -8, -24, -22, -10, -30, -18, -22, -16, -17, -12, -12, -7, -10, -17, -8, -24, -4.5],
    [-50, -14, -44, -24, -32, -28, -39, -20, -36, -15, -33, -10, -30, -7, -40, -8, -47, -6],
    [-17, -34, -8, -44, 6, -44, -4, -40, -2, -36],
    [10, -36, 18, -42, 30, -37, 20, -38, 16, -34],
    [-44, -20, -36, -34, -22, -40, -30, -33, -32, -28],
  ]);
  const umberB = flames([
    [17, -11, 22, -18, 28, -22, 22, -15, 20, -9.5],
    [-6, -9, 1, -18, 9, -24, 1, -15, -3, -7],
    [-27, -9, -21, -20, -13, -26, -20, -17, -23, -6],
    [-47, -12, -41, -20, -35, -23, -40, -15, -44, -8],
    [-12, -36, -5, -41, 3, -41, -4, -38, -6, -35],
  ]);
  const goldB = flames([
    [6, -12, 11, -17, 17, -18, 12, -15, 8, -11],
    [-18, -11, -14, -17, -8, -19, -13, -15, -15, -10],
    [26, -31, 30, -33, 36, -29, 31, -30, 28, -29],
    [-38, -15, -35, -21, -30, -23, -33, -19, -35, -14],
  ]);
  // marginal scutes: a darker rim band that runs round into the saw teeth
  const rimB = p => {
    p.moveTo(-54, -18); p.quadraticCurveTo(-50, -5.5, -36, -4.2); p.quadraticCurveTo(0, -1, 40, -15.5);
    p.lineTo(52, -10); p.lineTo(52, 12); p.lineTo(-66, 12); p.lineTo(-66, -18); p.closePath();
  };
  const rimEdgeB = p => { p.moveTo(-54, -18); p.quadraticCurveTo(-50, -5.5, -36, -4.2); p.quadraticCurveTo(0, -1, 40, -15.5); };
  const bellyB = p => { p.moveTo(-46, -1); p.quadraticCurveTo(0, 5, 44, -10); };
  const teethB = p => { p.moveTo(-54, -16); p.lineTo(-60.5, -13); p.moveTo(-53.8, -10.6); p.lineTo(-59, -6.6); p.moveTo(-51.2, -5.2); p.lineTo(-54.6, -.8); };
  // scute seams; the costal seams bow backward so each plate overlaps the next like roof tiles
  const TICKS = [.12, .3, .48, .66, .84].map(s => quadAt([-36, -4.2], [0, -1], [40, -15.5], s));
  const seamB = p => {
    p.moveTo(36, -19); p.quadraticCurveTo(28, -36, 4, -35); p.quadraticCurveTo(-26, -35, -46, -18);
    p.moveTo(19.3, -9.2); p.quadraticCurveTo(12.5, -21, 18.8, -33.5);
    p.moveTo(-5, -4.6); p.quadraticCurveTo(-12, -19.5, -4.8, -34.6);
    p.moveTo(-26.6, -3.7); p.quadraticCurveTo(-34, -16, -27, -29.5);
    p.moveTo(8.6, -35); p.quadraticCurveTo(4, -41, 7, -50); p.moveTo(-18.4, -32.3); p.quadraticCurveTo(-22.5, -39, -19.5, -50);
    for (const [x, y] of TICKS) { p.moveTo(x, y); p.lineTo(x - 1.2, y + 9); }
    p.moveTo(-50.7, -11.5); p.lineTo(-53.8, -10.6); p.moveTo(-44.6, -6.5); p.lineTo(-51.2, -5.2);
  };
  // each costal plate's leading edge tucks under the trailing edge of the plate in front: a crevice behind every seam
  const lapB = p => {
    p.moveTo(17.3, -8.9); p.quadraticCurveTo(10.5, -20.7, 16.8, -33.2);
    p.moveTo(-7, -4.3); p.quadraticCurveTo(-14, -19.2, -6.8, -34.3);
    p.moveTo(-28.6, -3.4); p.quadraticCurveTo(-36, -15.7, -29, -29.2);
  };
  // The plates as closed outlines, each with the centre and radius of its own shallow dome and how far toward the
  // lamp its glint sits. Built from the same curves as the seams: costal row, then the vertebral row along the top.
  const qf = (a, b, c) => s => quadAt(a, b, c, s);
  const run = (f, s0, s1, n = 5) => Array.from({ length: n + 1 }, (_, i) => f(s0 + (s1 - s0) * i / n));
  const V1 = qf([36, -19], [28, -36], [4, -35]), V2 = qf([4, -35], [-26, -35], [-46, -18]);
  const M0 = qf([-54, -18], [-50, -5.5], [-36, -4.2]), M1 = qf([-36, -4.2], [0, -1], [40, -15.5]);
  const K1 = qf([19.3, -9.2], [12.5, -21], [18.8, -33.5]), K2 = qf([-5, -4.6], [-12, -19.5], [-4.8, -34.6]), K3 = qf([-26.6, -3.7], [-34, -16], [-27, -29.5]);
  const W1 = qf([8.6, -35], [4, -41], [7, -50]), W2 = qf([-18.4, -32.3], [-22.5, -39], [-19.5, -50]);
  const SCUTES = [
    [[...run(K1, 0, 1), ...run(V1, .65, 0), [47, -24], [47, -12.3], ...run(M1, 1, .74, 2)], 30, -20, 14, .5],
    [[...run(K2, 0, 1), ...run(V2, .15, 0, 2), ...run(V1, 1, .65, 3), ...run(K1, 1, 0), ...run(M1, .74, .42, 3)], 7, -19, 15, .5],
    [[...run(K3, 0, 1), ...run(V2, .575, .15), ...run(K2, 1, 0), ...run(M1, .42, .13, 3)], -16, -18, 14, .5],
    [[...run(K3, 0, 1), ...run(V2, .575, 1), [-54, -18], ...run(M0, 0, 1), ...run(M1, 0, .13, 2)], -39, -15, 14, .5],
    [[...run(V1, 0, .9), ...run(W1, 0, 1, 3), [60, -52], [47, -24]], 27, -31, 11, .3],
    [[...run(V1, .9, 1, 2), ...run(V2, 0, .4, 3), ...run(W2, 0, 1, 3), ...run(W1, 1, 0, 3)], -5, -40, 12, .25],
    [[...run(V2, .4, 1), [-54, -18], [-66, -20], [-66, -52], ...run(W2, 1, 0, 3)], -33, -30, 12, .3],
  ].map(([pts, x, y, r, gk], i) => ({
    key: 'scute' + i, x, y, r, gk,
    build: p => { p.moveTo(pts[0][0], pts[0][1]); for (let j = 1; j < pts.length; j++) p.lineTo(pts[j][0], pts[j][1]); p.closePath(); },
  }));
  // the carapace as one dome (an ellipsoid over the rim), for the light it takes as a whole
  const DOME = { x: -6, y: -4, a: 54, b: 44 };
  // two barnacles low on the rear slope of the dome, riding along since his first voyage
  const BARNS = [[-22.9, -40.4, -.354, -.935, 4.6, 3.8], [-36.3, -33.5, -.553, -.833, 3.3, 3]];
  const barnB = i => p => {
    const [x, y, nx, ny, b, h] = BARNS[i];
    const at = (u, v) => [x - ny * u + nx * v, y + nx * u + ny * v];
    const q = [at(-b, -1.5), at(-b * .95, .8), at(-b * .62, h), at(b * .62, h), at(b * .95, .8), at(b, -1.5)];
    p.moveTo(q[0][0], q[0][1]); p.lineTo(q[1][0], q[1][1]); p.quadraticCurveTo(q[2][0] - nx, q[2][1] - ny, q[2][0], q[2][1]);
    p.lineTo(q[3][0], q[3][1]); p.quadraticCurveTo(q[3][0] - nx, q[3][1] - ny, q[4][0], q[4][1]); p.lineTo(q[5][0], q[5][1]); p.closePath();
  };
  const BARN_B = BARNS.map((_, i) => barnB(i));
  // the shell plates of each barnacle: two ridges running up the cone
  const barnRidgeB = i => p => {
    const [x, y, nx, ny, b, h] = BARNS[i];
    const at = (u, v) => [x - ny * u + nx * v, y + nx * u + ny * v];
    for (const s of [-.4, .3]) { let q = at(s * b * 1.3, 0); p.moveTo(q[0], q[1]); q = at(s * b * .75, h * .92); p.lineTo(q[0], q[1]); }
  };
  const BARN_R = BARNS.map((_, i) => barnRidgeB(i));

  function barnacles(g, L) {
    for (let i = 0; i < BARNS.length; i++) {
      const [x, y, nx, ny, b, h] = BARNS[i], tilt = Math.atan2(nx, -ny);
      ao(g, x - nx * .6, y - ny * .6, b * 1.5, b * .55, .45, tilt);     // seated in its own little shadow
      solid(g, 'barn' + i, BARN_B[i], BARNACLE, x + nx * h * .45, y + ny * h * .45, b * 1.35, L,
        { lit: .3, depth: .62, soft: .5, gloss: .18, edge: .5 },
        () => strokeP(g, trace(g, 'barnR' + i, BARN_R[i]), 'rgba(120,100,76,.55)', .5));
      // the open crater at the top: dark inside, its far lip lit
      const cx = x + nx * h, cy = y + ny * h;
      g.beginPath(); g.ellipse(cx, cy, b * .5, 1.25, tilt, 0, TAU); g.fillStyle = '#2a1c12'; g.fill();
      g.beginPath(); g.ellipse(cx, cy, b * .5, 1.25, tilt, .2, Math.PI - .2); g.strokeStyle = 'rgba(255,246,226,.6)'; g.lineWidth = .45; g.stroke();
    }
  }

  // the racing bib: a small enamelled tin tag tied on over the plates; its face takes the lamp like everything else
  function rrect(g, x, y, w, h, r) { g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h); }
  function tagArt(g, b, L) {
    const w = 18, h = 14, e = 11;
    ao(g, -L[0] * 2.2, -L[1] * 2.2 + .6, 13, 10, .42);                  // it stands off the shell a little
    rrect(g, -w / 2 - L[0] * 1.1, -h / 2 - L[1] * 1.1, w, h, 3); g.fillStyle = shade(b.bg, .6); g.fill();   // tin edge
    rrect(g, -w / 2, -h / 2, w, h, 3); g.fillStyle = b.bg; g.fill();
    g.fillStyle = b.fg; g.font = `${h * .8}px "Alfa Slab One", Rockwell, serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(String(b.n), 0, h * .06);
    const lg = g.createLinearGradient(L[0] * e, L[1] * e, -L[0] * e, -L[1] * e);
    lg.addColorStop(0, `rgba(${LT},.18)`); lg.addColorStop(.42, `rgba(${LT},0)`); lg.addColorStop(.42, `rgba(${DK},0)`); lg.addColorStop(1, `rgba(${DK},.26)`);
    rrect(g, -w / 2, -h / 2, w, h, 3); g.fillStyle = lg; g.fill();
    // the pressed rim: bright where it turns to the lamp, dark where it turns away
    const eg = g.createLinearGradient(L[0] * e, L[1] * e, -L[0] * e, -L[1] * e);
    eg.addColorStop(0, 'rgba(255,248,230,.8)'); eg.addColorStop(.5, 'rgba(255,248,230,0)'); eg.addColorStop(.5, `rgba(${DK},0)`); eg.addColorStop(1, `rgba(${DK},.6)`);
    rrect(g, -w / 2 + .5, -h / 2 + .5, w - 1, h - 1, 2.6); g.strokeStyle = eg; g.lineWidth = .9; g.stroke();
    // the two eyelets it is tied on by
    for (const s of [-1, 1]) {
      const x = s * (w / 2 - 2.4), y = -h / 2 + 2.3;
      g.beginPath(); g.arc(x, y, .95, 0, TAU); g.fillStyle = '#1a1418'; g.fill();
      g.beginPath(); g.arc(x, y, .95, .2, Math.PI - .2); g.strokeStyle = 'rgba(255,244,222,.6)'; g.lineWidth = .4; g.stroke();
    }
  }

  function shellArt(g, L) {
    // plastron: the belly plate, tucked in under the carapace and turned away from the lamp
    const pl = trace(g, 'plastron', plastronB);
    fillP(g, pl, PLASTRON);
    // a convex belly: dark in the gap under the carapace rim, a little light across its middle, turning under again
    // at the bottom where only the floor's bounce reaches it; its scutes meet in shallow grooves
    const bg = g.createRadialGradient(0, -60, 58, 0, -60, 67);
    bg.addColorStop(0, `rgba(${DK},.76)`); bg.addColorStop(.3, `rgba(${DK},.5)`); bg.addColorStop(.6, `rgba(${DK},.36)`);
    bg.addColorStop(.86, `rgba(${DK},.5)`); bg.addColorStop(1, `rgba(${DK},.64)`);
    fillP(g, pl, bg);
    strokeAt(g, 'plSeams', plSeamB, 0, 0, 'rgba(60,34,12,.45)', .7);
    strokeAt(g, 'plSeams', plSeamB, .7, 0, 'rgba(255,236,190,.14)', .5);
    strokeAt(g, 'plastron', plastronB, 0, -.6, 'rgba(255,196,130,.16)', 1);    // floor bounce along its lower edge
    strokeP(g, trace(g, 'plastron', plastronB), EDGE, .7);
    // carapace: the printed tortoiseshell first, then the plates' relief, then the light on the dome
    const cp = trace(g, 'carapace', carapaceB);
    g.save(); if (cp) g.clip(cp); else g.clip();
    fillP(g, cp, AMBER);
    // the pigment sits inside the horn, so every flame bleeds softly into the amber around it
    let fl = trace(g, 'chestnut', chestnutB); strokeP(g, fl, 'rgba(138,61,23,.35)', 3); retrace(g, fl, chestnutB); fillP(g, fl, CHESTNUT);
    fl = trace(g, 'umber', umberB); strokeP(g, fl, 'rgba(58,31,16,.35)', 2.2); retrace(g, fl, umberB); fillP(g, fl, UMBER);
    fl = trace(g, 'gold', goldB); strokeP(g, fl, 'rgba(244,185,73,.4)', 2); retrace(g, fl, goldB); fillP(g, fl, GOLD);
    fillP(g, trace(g, 'rim', rimB), RIM);
    // every plate is a shallow dome of its own: lit on the lamp side, turning dark toward its far edge
    for (const s of SCUTES) {
      const gr = g.createRadialGradient(s.x + L[0] * s.r * .5, s.y + L[1] * s.r * .5, s.r * .05, s.x - L[0] * s.r * .1, s.y - L[1] * s.r * .1, s.r * 1.15);
      gr.addColorStop(0, `rgba(${LT},.2)`); gr.addColorStop(.4, `rgba(${LT},0)`); gr.addColorStop(.4, `rgba(${DK},0)`);
      gr.addColorStop(.82, `rgba(${DK},.14)`); gr.addColorStop(1, `rgba(${DK},.34)`);
      fillP(g, trace(g, s.key, s.build), gr);
    }
    // the marginals roll over the edge: a lit crest under the costal groove, the underside turning away,
    // a little warm light bounced up from the floor, and each saw tooth catching the lamp on its upper face
    strokeAt(g, 'rimEdge', rimEdgeB, 0, 1.5, 'rgba(255,212,150,.3)', 2.2);
    strokeAt(g, 'belly', bellyB, 0, 0, `rgba(${DK},.3)`, 6);
    strokeAt(g, 'belly', bellyB, 0, -.8, 'rgba(255,188,120,.2)', 1.2);
    strokeAt(g, 'teeth', teethB, .35, .5, 'rgba(255,222,165,.4)', 1.3);
    // the grooves between plates: a dark crevice, the lip beyond it lit
    strokeAt(g, 'laps', lapB, 0, 0, 'rgba(58,31,16,.32)', 2.2);
    strokeAt(g, 'rimEdge', rimEdgeB, 0, 0, 'rgba(40,16,6,.6)', .9);
    strokeAt(g, 'seams', seamB, 0, 0, 'rgba(38,16,6,.8)', .9);
    strokeAt(g, 'seams', seamB, -L[0] * .8, -L[1] * .8, 'rgba(255,228,176,.36)', .6);
    // lacquer: each plate throws its own glint of the lamp, brightest where the dome faces the eye
    const hx = DOME.x + DOME.a * L[0] * .47, hy = DOME.y + DOME.b * L[1] * .47, rot = Math.atan2(L[1], L[0]) + Math.PI / 2;
    for (const s of SCUTES) {
      const d2 = (s.x - hx) * (s.x - hx) + (s.y - hy) * (s.y - hy);
      const a = .08 + .72 * Math.exp(-d2 / 700);
      if (a > .12) glint(g, s.x + L[0] * s.r * s.gk, s.y + L[1] * s.r * s.gk, s.r * .42, s.r * .15, rot, a);
    }
    // the dome as a whole: bright on the upper slope toward the lamp, the core shadow low on the front
    g.save(); g.translate(DOME.x, DOME.y); g.scale(DOME.a, DOME.b);
    const ux = L[0] * .82, uy = L[1] * .82, dg = g.createRadialGradient(ux, uy, 0, ux, uy, 1.9);
    dg.addColorStop(0, `rgba(${LT},.2)`); dg.addColorStop(.2, `rgba(${LT},.07)`); dg.addColorStop(.36, `rgba(${LT},0)`); dg.addColorStop(.36, `rgba(${DK},0)`);
    dg.addColorStop(.52, `rgba(${DK},.14)`); dg.addColorStop(.7, `rgba(${DK},.4)`); dg.addColorStop(1, `rgba(${DK},.56)`);
    g.fillStyle = dg; g.fillRect(-1.3, -1.3, 2.6, 2.6);
    const sx = L[0] * .45, sy = L[1] * .45, sg = g.createRadialGradient(sx, sy, 0, sx, sy, .45);
    sg.addColorStop(0, 'rgba(255,250,236,.2)'); sg.addColorStop(1, 'rgba(255,250,236,0)');
    g.fillStyle = sg; g.fillRect(sx - .45, sy - .45, .9, .9);
    g.restore();
    g.restore();
    strokeAt(g, 'carapace', carapaceB, 0, 0, EDGE, .8);
    barnacles(g, L);
  }
  const SHELL_BOX = [-65, -54, 117, 65], TAG_BOX = [-13, -11, 27, 24];
  function shell(g, P, L, b) {
    g.save(); g.scale(P.sx, P.sy);
    stamp(g, 'shell', SHELL_BOX, L, shellArt);
    if (b) {                          // the bib, tied on over the plates; it hangs nearly level whatever the shell does
      if (!fontOK && document.fonts && document.fonts.check) fontOK = document.fonts.check('12px "Alfa Slab One"');
      g.translate(-14, -19); g.scale(1 / P.sx, 1 / P.sy); g.rotate(-P.rot * .85);
      stamp(g, `tag|${b.n}|${b.bg}|${b.fg}|${fontOK}`, TAG_BOX, turn(L, -P.rot * .85), (x, Lq) => tagArt(x, b, Lq));
    }
    g.restore();
  }

  // Flipper = a short arm from the root plus a blade profile laid along the blade angle.
  // Blade frame: u from the wrist toward the tip, -v on the leading edge. k2 < 1 foreshortens the blade
  // when it turns edge-on to the viewer. pts: [start, (control, end) x n]. f scales the whole limb (far side).
  // lead / trail: where the wet rounded edge catches the lamp, just inside each edge.
  const FORE_BLADE = {
    w0: 6, len: 35, pts: [[0, -5], [10, -9], [20, -7], [29, -4.2], [35, 1], [27, 2.6], [19, 3.9], [9, 7.4], [0, 5.2]],
    lead: [[3, -4.1], [10, -7.8], [20, -5.9], [28, -3.3], [32.4, .4]], trail: [[4, 4.4], [10, 6], [19, 2.8], [26, 1.5], [31.5, .9]],
    // hawksbill scales in the blade frame [u, v, ru, rv]: big plates down the leading edge, smaller ones outboard;
    // the root half stays smooth skin (that is where the anchor went)
    cells: [[4.2, -4.4, 2.6, 1.5], [9.6, -5.5, 2.7, 1.7], [15, -5.8, 2.7, 1.7], [20.4, -5, 2.6, 1.6], [25.4, -3.7, 2.4, 1.4], [29.8, -2.1, 1.9, 1.1],
      [17.4, -1.7, 2.3, 1.5], [22.4, -1.3, 2.2, 1.4], [27.1, -.7, 1.9, 1.2], [31.3, 0, 1.3, .85], [16.2, 2.1, 1.9, 1.1], [20.6, 1.8, 1.8, 1.05], [24.7, 1.3, 1.5, .9]],
  };
  const HIND_BLADE = {
    w0: 4.8, len: 18.5, pts: [[0, -4.4], [7, -8.6], [13, -6.6], [18.5, -3.6], [17, 2.6], [11, 6.2], [0, 4.6]],
    lead: [[2, -3.3], [7, -7.3], [13, -5.5], [17.3, -3.1], [16.2, 1.3]], trail: [[2, 3.5], [9, 5.4], [15.8, 2.2]],
    cells: [[4.4, -3.6, 2.3, 1.4], [9.2, -4.6, 2.3, 1.5], [13.6, -3.4, 2, 1.3], [7, .2, 2, 1.3], [11.8, .6, 1.8, 1.2], [15.4, .1, 1.1, .9], [3.4, 1.4, 1.7, 1.1]],
  };
  const NECK_TUBE = { w0: 7.4, len: 9, pts: [[0, -7.6], [6, -8], [9, 0], [6, 8], [0, 7.4]] };
  function blade(x, y, a1, a2, L1, k2, prof, f = 1) {
    const c1 = Math.cos(a1), s1 = Math.sin(a1), c2 = Math.cos(a2), s2 = Math.sin(a2);
    const wx = x + c1 * L1 * f, wy = y + s1 * L1 * f, w0 = prof.w0 * f, pts = prof.pts;
    const at = (u, v) => [wx + (c2 * u * k2 - s2 * v) * f, wy + (s2 * u * k2 + c2 * v) * f];
    const build = p => {
      p.moveTo(x + s1 * w0, y - c1 * w0);
      let e = at(pts[0][0], pts[0][1]); p.lineTo(e[0], e[1]);
      for (let i = 1; i < pts.length; i += 2) {
        const q = at(pts[i][0], pts[i][1]); e = at(pts[i + 1][0], pts[i + 1][1]);
        p.quadraticCurveTo(q[0], q[1], e[0], e[1]);
      }
      p.lineTo(x - s1 * w0, y + c1 * w0); p.closePath();
    };
    return { at, build, x0: x, y0: y, wx, wy, k2, c2, s2, a2, f };
  }
  // the scale plates, drawn straight in the blade frame: each a little darker than the skin, rimmed in pale horn
  function scales(g, B, prof) {
    g.save(); g.translate(B.wx, B.wy); g.rotate(B.a2); g.scale(B.k2 * B.f, B.f);
    g.beginPath();
    for (const [u, v, ru, rv] of prof.cells) { g.moveTo(u + ru, v); g.ellipse(u, v, ru, rv, 0, 0, TAU); }
    g.restore();
    g.fillStyle = 'rgba(40,16,6,.34)'; g.fill();
    g.strokeStyle = 'rgba(245,207,120,.38)'; g.lineWidth = .45; g.stroke();
  }
  function flipper(g, B, prof, base, L, far, detail) {
    const p = trace(g, null, B.build);
    fillP(g, p, base);
    if (!far) { scales(g, B, prof); if (detail) detail(g, B); retrace(g, p, B.build); }
    // one gradient carries the fall-off and, at its focus, the wet glint; the root is past its dark rim
    const c = B.at(prof.len * .42, 0), r = prof.len * .62 * B.f;
    const gr = g.createRadialGradient(c[0] + L[0] * r * .5, c[1] + L[1] * r * .5, 0, c[0] - L[0] * r * .15, c[1] - L[1] * r * .15, r * 1.15);
    if (far) { gr.addColorStop(0, `rgba(${LT},.12)`); gr.addColorStop(.35, `rgba(${LT},0)`); }
    else { gr.addColorStop(0, 'rgba(255,252,244,.42)'); gr.addColorStop(.08, `rgba(${LT},.3)`); gr.addColorStop(.35, `rgba(${LT},0)`); }
    gr.addColorStop(.35, `rgba(${DK},0)`); gr.addColorStop(.78, `rgba(${DK},${far ? .4 : .28})`); gr.addColorStop(1, `rgba(${DK},${far ? .72 : .55})`);
    fillP(g, p, gr);
    strokeP(g, p, EDGE, .7);
    if (far) return;
    // the wet rounded leading edge catches the lamp; when the blade turns over, the trailing edge does
    const fc = B.s2 * L[0] - B.c2 * L[1], st = fc >= 0 ? prof.lead : prof.trail;
    const a = .45 * Math.min(1, Math.abs(fc) * 1.5) * (fc >= 0 ? 1 : .55);
    if (a > .03) {
      g.beginPath(); let e = B.at(st[0][0], st[0][1]); g.moveTo(e[0], e[1]);
      for (let i = 1; i < st.length; i += 2) { const q = B.at(st[i][0], st[i][1]); e = B.at(st[i + 1][0], st[i + 1][1]); g.quadraticCurveTo(q[0], q[1], e[0], e[1]); }
      g.strokeStyle = `rgba(255,248,232,${a})`; g.lineWidth = .8; g.stroke();
    }
  }
  const anchorB = p => {
    p.moveTo(-2.3, 0); p.arc(-3.2, 0, .85, 0, TAU);
    p.moveTo(-2.3, 0); p.lineTo(3.4, 0); p.moveTo(-1.1, -1.9); p.lineTo(-1.1, 1.9);
    p.moveTo(1.3, -2.7); p.quadraticCurveTo(3.9, -2.4, 3.9, 0); p.quadraticCurveTo(3.9, 2.4, 1.3, 2.7);
  };
  // the near fore-flipper's printed details: two horn claws on the leading edge, a pale trailing margin and the
  // anchor tattoo. All painted before the light goes on, so they turn with the blade.
  function foreDetails(g, B) {
    const { at } = B;
    g.beginPath();
    let p = at(3, 3.9); g.moveTo(p[0], p[1]);
    let q = at(10, 5.6); p = at(18.5, 2.8); g.quadraticCurveTo(q[0], q[1], p[0], p[1]);
    q = at(26, 1.3); p = at(31.5, .6); g.quadraticCurveTo(q[0], q[1], p[0], p[1]);
    g.lineWidth = .9; g.strokeStyle = 'rgba(245,207,120,.6)'; g.stroke();
    g.beginPath();
    for (const [u, v] of [[8, -8.2], [14.5, -8.4]]) {
      const a = at(u - 1.6, v + .5), b = at(u + 3, v - 3.4), d = at(u + 1.6, v + .3);
      g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(d[0], d[1]); g.closePath();
    }
    g.fillStyle = HORN; g.fill();
    p = at(9, -1);
    g.save(); g.translate(p[0], p[1]); g.rotate(B.a2);
    strokeP(g, trace(g, 'anchor', anchorB), 'rgba(245,207,120,.9)', 1.1);
    g.restore();
  }
  function neck(g, x, y, a, bend, len, L) {
    const B = blade(x, y, a, a + bend, len - 6, 1, NECK_TUBE);
    const p = trace(g, null, B.build);
    fillP(g, p, SKIN);
    // old-salt folds just behind the head: a crease, and the ridge beside it catching the lamp
    const fold = (dx, dy, st, w) => {
      g.beginPath();
      for (const u of [-7, -3.5]) {
        let q = B.at(u, -7.2); g.moveTo(q[0] + dx, q[1] + dy);
        const c = B.at(u + 2.4, 0); q = B.at(u, 6.6); g.quadraticCurveTo(c[0] + dx, c[1] + dy, q[0] + dx, q[1] + dy);
      }
      g.strokeStyle = st; g.lineWidth = w; g.stroke();
    };
    fold(0, 0, 'rgba(112,52,16,.6)', 1.1); fold(-L[0] * .9, -L[1] * .9, 'rgba(255,238,196,.38)', .6);
    retrace(g, p, B.build);
    // a tube: lit along the side that faces the lamp, the core shadow along the other, a little bounce at the edge
    const ca = Math.cos(a), sa = Math.sin(a), nx = -sa, ny = ca, sd = nx * L[0] + ny * L[1] >= 0 ? 1 : -1, hw = 8.5;
    const mx = x + ca * (len - 6) * .55, my = y + sa * (len - 6) * .55;
    const gr = g.createLinearGradient(mx + nx * hw * sd, my + ny * hw * sd, mx - nx * hw * sd, my - ny * hw * sd);
    gr.addColorStop(0, `rgba(${LT},.1)`); gr.addColorStop(.18, `rgba(${LT},.22)`); gr.addColorStop(.42, `rgba(${LT},0)`); gr.addColorStop(.42, `rgba(${DK},0)`);
    gr.addColorStop(.74, `rgba(${DK},.34)`); gr.addColorStop(.92, `rgba(${DK},.5)`); gr.addColorStop(1, `rgba(${DK},.38)`);
    fillP(g, p, gr);
    const N = B.at(3, 0);
    fillP(g, p, dim(g, x + ca * 3, y + sa * 3, 12, .6));          // coming out from under the carapace
    strokeP(g, p, EDGE, .8);
    return N;
  }

  // ---- head frame: origin at the back of the skull on the neck axis, beak toward +x ----
  // a long wedge of a head: flat crown sloping straight down into the narrow hawk beak
  const headB = p => {
    p.moveTo(-1, -8); p.bezierCurveTo(3, -12.5, 10, -12.2, 18, -9.5);
    p.bezierCurveTo(24, -7.5, 30, -4, 34, 1.6); p.quadraticCurveTo(32, 1.6, 30.4, 3);
    p.quadraticCurveTo(19, 10, 3, 9.4); p.quadraticCurveTo(-4, 3, -1, -8); p.closePath();
  };
  // dark scaled crown running down the beak ridge, each scale edged in pale yellow (the hawksbill's
  // two pairs of prefrontals sit between the eyes); jaws and throat stay yellow horn
  const platesB = p => {
    p.moveTo(-1, -8); p.bezierCurveTo(3, -12.5, 10, -12.2, 18, -9.5); p.bezierCurveTo(24, -7.5, 28.5, -4.8, 31, -1.4);
    p.quadraticCurveTo(26, -1.8, 21, -1.8); p.quadraticCurveTo(12, -1.2, -2.6, -1); p.closePath();
  };
  const plateSeamB = p => {
    p.moveTo(17.6, -9.6); p.quadraticCurveTo(18.6, -5.6, 17.8, -1.9); p.moveTo(24.2, -7.2); p.quadraticCurveTo(25, -4.4, 24.4, -1.9);
  };
  const ridgeB = p => { p.moveTo(18.6, -8.4); p.bezierCurveTo(23.5, -6.8, 28, -3.9, 31, -.6); };
  const nostrilB = p => { p.moveTo(28.6, -2.2); p.arc(27.8, -2.2, .8, 0, TAU); };
  const MOUTH = {
    grin: p => { p.moveTo(30.4, 3); p.quadraticCurveTo(20, 16.5, 10, 4); p.quadraticCurveTo(20, 4.2, 30.4, 3); },
    o: p => { p.moveTo(29.5, 3.3); p.quadraticCurveTo(24, 10, 18.5, 4.5); p.quadraticCurveTo(24, 5.4, 29.5, 3.3); },
    flat: p => { p.moveTo(30.4, 3); p.quadraticCurveTo(21, 5, 12.5, 3.2); },
    sad: p => { p.moveTo(30.4, 3); p.quadraticCurveTo(21, 3.8, 12.5, 6.2); },
  };
  const tongueB = p => { p.moveTo(21.5, 8.4); p.quadraticCurveTo(17, 11, 13.5, 8.2); p.quadraticCurveTo(17.5, 7.2, 21.5, 8.4); };
  // terry sweatband across the forehead, wrapping round the back of the skull
  const bandB = p => {
    p.moveTo(-3.2, -5.8); p.quadraticCurveTo(-1.4, -15.2, 6.5, -15.8); p.quadraticCurveTo(11.5, -16.1, 14.4, -14.4);
    p.lineTo(13.4, -8.9); p.quadraticCurveTo(9, -9.8, 4.5, -8.8); p.quadraticCurveTo(.6, -7.6, -1.8, -2.2); p.closePath();
  };
  const stripeB = p => { p.moveTo(-2.4, -4.1); p.quadraticCurveTo(-.6, -12.2, 6.5, -12.5); p.quadraticCurveTo(11, -12.8, 13.9, -11.7); };

  // the heavy, unbothered lid over the eye: a scaly hood with a rounded rim, shadowing the eyeball under it
  const LIDC = [tint(LID, .45), tint(LID, .22), LID, shade(LID, .33), shade(LID, .6)];
  function lidFill(g, r, L) {
    const gr = g.createRadialGradient(L[0] * r * .55, -r * .35 + L[1] * r * .55, 0, -L[0] * r * .2, -r * .35 - L[1] * r * .2, r * 1.5);
    gr.addColorStop(0, LIDC[0]); gr.addColorStop(.1, LIDC[1]); gr.addColorStop(.35, LIDC[2]); gr.addColorStop(.75, LIDC[3]); gr.addColorStop(1, LIDC[4]);
    g.fillStyle = gr; g.fill();
  }
  function lid(g, ex, ey, er, F, shut, L) {
    const re = F.wide ? er * 1.25 : er, r = re + .7, Ll = turn(L, F.tilt);
    g.save(); g.translate(ex, ey); g.rotate(F.tilt);
    if (shut) {
      g.beginPath(); g.ellipse(0, 0, r, r * 1.08, 0, 0, TAU); lidFill(g, r, Ll);
      g.beginPath(); g.moveTo(-r * .85, .2); g.quadraticCurveTo(0, r * .62, r * .85, .2);
      g.strokeStyle = 'rgba(36,12,4,.8)'; g.lineWidth = .8; g.stroke();
      g.beginPath(); g.moveTo(-r * .7, -.5); g.quadraticCurveTo(0, r * .38, r * .7, -.5);
      g.strokeStyle = 'rgba(255,226,180,.4)'; g.lineWidth = .55; g.stroke();
      g.restore(); return;
    }
    const k = clamp(2 * F.lid - 1, -.97, .97), a = Math.asin(k), yc = 1.08 * r * k, hx = r * Math.cos(a);
    // the lid's shadow across the eyeball, a band just under its rim
    const ry = re * 1.08, y0 = clamp(yc, -ry * .98, ry * .98), y1 = clamp(yc + r * .45, -ry * .98, ry * .98);
    if (y1 > y0) {
      const t0 = Math.asin(y0 / ry), t1 = Math.asin(y1 / ry);
      g.beginPath(); g.ellipse(0, 0, re, ry, 0, t0, t1); g.ellipse(0, 0, re, ry, 0, Math.PI - t1, Math.PI - t0); g.closePath();
      g.fillStyle = `rgba(${DK},.3)`; g.fill();
    }
    g.beginPath(); g.ellipse(0, 0, r, r * 1.08, 0, Math.PI - a, TAU + a); g.closePath(); lidFill(g, r, Ll);
    g.beginPath(); g.moveTo(-hx, yc); g.lineTo(hx, yc); g.strokeStyle = 'rgba(36,12,4,.75)'; g.lineWidth = .7; g.stroke();
    g.beginPath(); g.moveTo(-hx * .85, yc - .75); g.lineTo(hx * .85, yc - .75); g.strokeStyle = 'rgba(255,226,180,.45)'; g.lineWidth = .55; g.stroke();
    g.restore();
  }
  // a bead of sweat: clear water, lit from the lamp side, a hard glint
  function drop(g, x, y, s) {
    g.beginPath(); g.moveTo(x, y - 6 * s); g.quadraticCurveTo(x + 4 * s, y, x, y + 3 * s); g.quadraticCurveTo(x - 4 * s, y, x, y - 6 * s);
    const gr = g.createRadialGradient(x - s, y - .5 * s, .3 * s, x, y, 4.5 * s);
    gr.addColorStop(0, '#eaf7ff'); gr.addColorStop(.5, '#9fd3ff'); gr.addColorStop(1, '#4b8cc2');
    g.fillStyle = gr; g.fill(); g.lineWidth = .5; g.strokeStyle = 'rgba(20,50,90,.55)'; g.stroke();
    g.beginPath(); g.ellipse(x - 1.1 * s, y - 1.2 * s, .6 * s, 1.2 * s, .3, 0, TAU); g.fillStyle = 'rgba(255,255,255,.85)'; g.fill();
  }

  // the head's base: horn skin, the dark crown scales, the lamp over it all (a long ellipsoid), the sweatband's
  // shadow on the skull, the lacquer on the beak, and the socket the eye sits in
  function headArt(g, L) {
    const hp = trace(g, 'head', headB);
    fillP(g, hp, SKIN);
    const pp = trace(g, 'plates', platesB);
    fillP(g, pp, SCALE);
    strokeP(g, pp, 'rgba(245,207,120,.7)', .6);
    strokeP(g, trace(g, 'plateSeams', plateSeamB), SEAM, .6);
    fillP(g, trace(g, 'nostril', nostrilB), '#24140c');
    g.save(); if (P2D) g.clip(trace(g, 'head', headB)); else { g.beginPath(); headB(g); g.clip(); }
    g.save(); g.translate(-L[0] * 1.4, -L[1] * 1.4 + .3); fillP(g, trace(g, 'band', bandB), `rgba(${DK},.3)`); g.restore();
    g.translate(13, -1.5); g.scale(21, 12);
    const ux = L[0] * .72, uy = L[1] * .72, hg = g.createRadialGradient(ux, uy, 0, ux, uy, 1.85);
    hg.addColorStop(0, `rgba(${LT},.26)`); hg.addColorStop(.22, `rgba(${LT},.08)`); hg.addColorStop(.38, `rgba(${LT},0)`); hg.addColorStop(.38, `rgba(${DK},0)`);
    hg.addColorStop(.56, `rgba(${DK},.18)`); hg.addColorStop(.74, `rgba(${DK},.42)`); hg.addColorStop(1, `rgba(${DK},.55)`);
    g.fillStyle = hg; g.fillRect(-1.4, -1.4, 2.8, 2.8);
    g.restore();
    strokeAt(g, 'ridge', ridgeB, 0, 0, 'rgba(255,246,222,.42)', .7);
    spark(g, 20.5 + L[0] * 1.2, -6.4 + L[1] * 1.2, 2.6, .6, .55, .55);
    strokeP(g, trace(g, 'head', headB), EDGE, .8);
    ao(g, 12.6, -3.5, 6.7, 5.8, .42);
  }
  // the terry band: soft, matte, the red stripe woven in and turning with it
  function bandArt(g, L) {
    solid(g, 'band', bandB, BAND, 5.5, -12, 10.5, L, { lit: .2, depth: .48, soft: .85, gloss: .08, edge: .6 }, () => {
      strokeP(g, trace(g, 'stripe', stripeB), C.TOMATO, 2.4);
    });
  }
  const HEAD_BOX = [-7, -15, 44, 28], BAND_BOX = [-5, -18, 21, 18];
  function head(g, F, t, L) {
    stamp(g, 'head', HEAD_BOX, L, headArt);
    const m = MOUTH[F.mouth] ? F.mouth : 'flat';
    if (m === 'grin' || m === 'o') fillP(g, trace(g, 'mouth-' + m, MOUTH[m]), '#321210');
    else {
      strokeAt(g, 'mouth-' + m, MOUTH[m], 0, .9, 'rgba(255,232,180,.3)', .7);     // the lower lip catching the lamp
      strokeAt(g, 'mouth-' + m, MOUTH[m], 0, 0, 'rgba(48,20,8,.85)', 1.2);
    }
    if (m === 'grin') {
      fillP(g, trace(g, 'tongue', tongueB), '#c83226');
      g.beginPath(); g.ellipse(18.5, 8.3, 1.8, .45, -.1, 0, TAU); g.fillStyle = 'rgba(255,236,226,.5)'; g.fill();
    }
    if (F.blush) blush(g, 9, 5, 3.2);
    // eye under a heavy, unbothered lid; the kit's blink clock is mirrored so the lid steps aside for it
    const ex = 12, ey = -4.3, er = 4.3, shut = F.lid > .93 || ((t + .7) % 3.7) < .12;
    if (shut) lid(g, ex, ey, er, F, true, L);
    else {
      eye3d(g, ex, ey, er, { t, look: F.look, lookX: F.lookX, wide: F.wide, shut: false, seed: .7 });
      if (F.lid > .03) lid(g, ex, ey, er, F, false, L);
    }
    stamp(g, 'band', BAND_BOX, L, bandArt);
    if (F.sweat) {
      const q = wrap(t * .8);
      g.globalAlpha = Math.sin(Math.PI * q); drop(g, 17, -16 + q * 5, .9); g.globalAlpha = 1;
    }
  }

  // two-bone reach for a flipper tip at world (tx, ty); returns [arm, blade] angles in the shell frame.
  // bend +1 lifts the wrist above the root-to-tip line for a limb reaching forward, -1 flips the elbow.
  function reach(P, root, tx, ty, L2 = FL2, bend = 1) {
    const c = Math.cos(P.rot), s = Math.sin(P.rot), lx = root[0] * P.sx, ly = root[1] * P.sy;
    const Sx = P.x + lx * c - ly * s, Sy = P.y + lx * s + ly * c;
    const d = clamp(Math.hypot(tx - Sx, ty - Sy), Math.abs(FL1 - L2) + .5, FL1 + L2 - .5);
    const phi = Math.atan2(ty - Sy, tx - Sx), al = Math.acos((FL1 * FL1 + d * d - L2 * L2) / (2 * FL1 * d));
    const a1 = phi - bend * al, wx = Sx + Math.cos(a1) * FL1, wy = Sy + Math.sin(a1) * FL1;
    let a2 = Math.atan2(ty - wy, tx - wx);
    while (a2 - a1 > Math.PI) a2 -= TAU;
    while (a2 - a1 < -Math.PI) a2 += TAU;
    return [a1 - P.rot, a2 - P.rot];
  }
  const base = p => Object.assign({ x: 0, y: -7.5, rot: 0, sx: 1, sy: 1, k: 1, lift: 0 }, p);

  // the run phase is integrated per racer (keyed by bib) so a changing speed never makes the gait skip
  const clocks = new Map();
  function gaitPhase(o, t, rate) {
    const key = o.bib ? String(o.bib.n) : '', c = clocks.get(key);
    const ph = wrap(c && t >= c.t && t - c.t < .25 ? c.ph + (t - c.t) * rate : t * rate);
    clocks.set(key, { t, ph });
    return ph;
  }

  // one fore-flipper through the haul: swing forward edge-on (recovery), then plant and pull (power)
  function haul(P, u, root, far, amp) {
    const R = .42, ty = far ? -3.5 : -1.2, fwd = far ? 66 : 72, back = far ? -6 : -2;
    if (u >= R) {
      // planted: the tip digs in a little and the blade turns out toward the viewer mid-stroke
      const p = (u - R) / (1 - R), k2 = 1 - .4 * bell(p);
      return [...reach(P, root, lerp(fwd, back, .25 * p + .75 * ease(p)), ty + 2.5 * bell(p), FL2 * k2), k2];
    }
    // recovery: arm lifts, the blade trails edge-on (foreshortened) and swings through to the next reach
    const r = u / R, fl = bell(r), A = reach(P, root, back, ty), B = reach(P, root, fwd, ty);
    return [lerp(A[0], B[0], ease(r)) - 1.1 * fl * amp, lerp(A[1], B[1], ease(clamp((r - .15) / .85, 0, 1))) - .35 * fl, 1 - .55 * fl];
  }

  const POSE = {
    run(o, t) {
      const sp = clamp(o.speed == null ? 1 : o.speed, .15, 1.6), amp = .75 + .25 * Math.min(1, sp);
      const u = gaitPhase(o, t, .6 + .9 * sp);
      const lift = u < .42 ? 0 : Math.sin(Math.PI * Math.pow((u - .42) / .58, .75)) ** 2;
      const land = u < .22 ? Math.sin(Math.PI * u / .22) ** 2 : 0;
      const P = base({
        x: 2.4 * lift - 1.2 * land, y: -7.5 - 7 * amp * lift + 1.4 * land, rot: -.075 * lift + .035 * land,
        sx: 1 + .055 * land - .03 * lift, sy: 1 - .065 * land + .045 * lift, lift: 7 * amp * lift,
      });
      P.fN = haul(P, u, FORE, false, amp);
      P.fF = haul(P, wrap(u - .06), FORE_FAR, true, amp);
      const rn = 2.35 - .42 * lift + .08 * cyc(u, 1, -.1), rf = 2.5 - .3 * lift + .08 * cyc(u, 1, .4);
      P.rN = [rn, rn + .42 + .3 * cyc(u, 1, -.32)];
      P.rF = [rf, rf + .38 + .3 * cyc(u, 1, .18)];
      const ext = .5 + .5 * cyc(u, 1, -.47);
      P.neck = [-.5 - .1 * ext, .1, 12 + 6 * ext * amp];
      P.head = .12 + .12 * cyc(u, 1, -.55) - .5 * P.rot;
      P.F = { lid: .42, tilt: .3, look: .15, lookX: 1, mouth: 'flat' };
      return P;
    },
    idle(o, t) {
      const b = cyc(t, .3), P = base({ y: -7.5 - .5 * b, sx: 1 - .008 * b, sy: 1 + .02 * b });
      P.fN = [...reach(P, FORE, 71 + .8 * cyc(t, .3, -.1), -1.2), 1];
      P.fF = [...reach(P, FORE_FAR, 64, -3.5), 1];
      P.rN = [2.45, 2.85 + .08 * cyc(t, .3, -.2)];
      P.rF = [2.55, 2.95 + .08 * cyc(t, .3, .3)];
      P.neck = [-.55 + .03 * cyc(t, .3, -.15), .08, 14 + .6 * b];
      P.head = .1 + .05 * cyc(t, .17);
      // an unhurried slow blink every few seconds
      const q = wrap(t / 6.3) * 6.3 / 1.1, droop = q < 1 ? Math.sin(Math.PI * q) ** 2 : 0;
      P.F = { lid: .44 + .56 * droop, tilt: .12, look: .1, lookX: .35 + .45 * cyc(t, .09), mouth: 'flat' };
      return P;
    },
    cheer(o, t) {
      const h = wrap(t * 1.15), G = .18, q = h < G ? 0 : (h - G) / (1 - G), air = 4 * q * (1 - q);
      const land = h < G ? Math.sin(Math.PI * h / G) ** 2 : 0;
      const P = base({
        y: -7.5 - 17 * air + 1.6 * land, rot: -.24 * air, sx: 1 + .08 * land - .03 * air, sy: 1 - .09 * land + .05 * air, lift: 17 * air,
      });
      const w = cyc(t, 2.3), wf = cyc(t, 2.3, .5);
      // both flippers punched straight up behind the head, waving out of step
      P.fN = [-1.5 + .2 * w - P.rot, -1.5 + .2 * w + .32 * cyc(t, 2.3, -.12) - P.rot, 1];
      P.fF = [-1.3 + .2 * wf - P.rot, -1.35 + .2 * wf + .32 * cyc(t, 2.3, .38) - P.rot, 1];
      P.rN = [2.15 + .35 * air, 2.6 + .35 * air + .2 * cyc(t, 2.3, -.2)];
      P.rF = [2.3 + .3 * air, 2.7 + .3 * air + .2 * cyc(t, 2.3, .3)];
      P.neck = [-.9, .05, 17];
      P.head = -.3 + .06 * cyc(t, 2.3, -.1);
      P.F = { lid: .12, tilt: 0, look: -.45, lookX: .6, mouth: 'grin', blush: true };
      return P;
    },
    worry(o, t) {
      const tr = cyc(t, 7.5), P = base({ x: -1.5, y: -7.2 + .3 * tr, rot: .012 * tr, sx: 1.02, sy: .98 + .006 * cyc(t, 7.5, .25) });
      // flippers pulled in tight along the plastron, tips tapping
      P.fN = [...reach(P, FORE, 4 + 3 * cyc(t, 1.6), -1.2 - 4 * Math.max(0, cyc(t, 1.6, .2))), 1];
      P.fF = [...reach(P, FORE_FAR, 0 + 3 * cyc(t, 1.6, .5), -3.5 - 3 * Math.max(0, cyc(t, 1.6, .7))), 1];
      P.rN = [2.6, 2.95 + .12 * cyc(t, 3)];
      P.rF = [2.7, 3.05 + .12 * cyc(t, 3, .5)];
      P.neck = [-.3, .05, 8];
      P.head = .12 + .05 * cyc(t, .8);
      P.F = { lid: 0, tilt: -.3, look: -.1, lookX: cyc(t, .7), wide: true, mouth: 'o', sweat: true };
      return P;
    },
    // basking on the claw hub like a turtle on a rock: fore-flippers hooked over the front of the hub,
    // hind flippers trailing off the back, neck craned out over the edge with the beak aimed at the cans
    ride(o, t) {
      const em = o.emotion || 'focus', look = clamp(o.look == null ? .5 : o.look, -1, 1);
      const br = cyc(t, .35), tr = em === 'worry' ? cyc(t, 7.5) : 0, sad = em === 'sad' ? 1 : 0;
      const hop = em === 'cheer' ? wrap(t * 1.6) : 0, air = em === 'cheer' ? Math.sin(Math.PI * hop) ** 2 : 0;
      const flat = em === 'worry' ? 1 : 0;
      const P = base({
        x: -8, y: -6.5 - 7 * air + .35 * tr + 1.2 * flat, rot: .05 - .1 * air + .01 * tr + .05 * sad,
        sx: 1 + .03 * flat, sy: 1 + .015 * br - .06 * flat + .04 * air, k: .88, lift: 7 * air,
      });
      if (em === 'cheer') {
        const w = cyc(t, 2.2);
        P.fN = [-1.5 + .2 * w - P.rot, -1.5 + .2 * w + .32 * cyc(t, 2.2, -.12) - P.rot, 1];
      } else P.fN = [.5 + .25 * sad - P.rot, 2.15 + .3 * flat - .45 * sad + .03 * br - P.rot, .85 - .08 * flat];
      P.fF = [.2 + .2 * sad - P.rot, 1.15 + .25 * flat - P.rot, .6];
      P.rN = [2.1 - P.rot + .08 * cyc(t, .45), 1.9 - P.rot + .16 * cyc(t, .45, -.18)];
      P.rF = [2.3 - P.rot + .08 * cyc(t, .45, .4), 2.1 - P.rot + .16 * cyc(t, .45, .22)];
      const hang = em === 'sad' ? .3 : em === 'worry' ? -.1 : em === 'cheer' ? -.9 : 0;
      P.neck = [.1 + .45 * look + .4 * hang - P.rot, .12, em === 'worry' ? 9 : em === 'sad' ? 19 : 17];
      P.head = .2 + .95 * look + hang + .04 * br - P.rot;
      const F = { lid: .45, tilt: .35, look: .5 * look, lookX: .5, mouth: 'flat' };
      if (em === 'worry') Object.assign(F, { lid: 0, tilt: -.3, wide: true, mouth: 'o', sweat: true, lookX: cyc(t, .8) });
      if (em === 'cheer') Object.assign(F, { lid: .1, tilt: 0, mouth: 'grin', blush: true, look: -.2 });
      if (em === 'sad') Object.assign(F, { lid: .62, tilt: -.35, mouth: 'sad', look: .4 });
      P.F = F;
      return P;
    },
  };

  function render(g, P, o, t) {
    const S = p => [p[0] * P.sx, p[1] * P.sy];
    g.save(); g.translate(P.x, P.y); g.rotate(P.rot);
    g.lineJoin = 'round'; g.lineCap = 'round';
    const L = lamp(g);
    // far side first: the far flippers, a touch smaller and deeper in the shell's shadow
    let p = S(FORE_FAR);
    flipper(g, blade(p[0], p[1], P.fF[0], P.fF[1], FL1, P.fF[2], FORE_BLADE, .94), FORE_BLADE, SCALE_FAR, L, true);
    p = S(HIND_FAR); flipper(g, blade(p[0], p[1], P.rF[0], P.rF[1], 5, 1, HIND_BLADE, .94), HIND_BLADE, SCALE_FAR, L, true);
    p = S(NECK); const N = neck(g, p[0], p[1], P.neck[0], P.neck[1], P.neck[2], L);
    shell(g, P, L, o.bib);
    // near hind flipper, its root darkening the shell where it comes out
    p = S(HIND); ao(g, p[0] + 2, p[1] - 1.5, 10, 6, .4);
    flipper(g, blade(p[0], p[1], P.rN[0], P.rN[1], 5, 1, HIND_BLADE), HIND_BLADE, SCALE, L, false);
    g.save();
    g.translate(N[0], N[1]); g.rotate(P.head); g.scale(HEAD, HEAD);
    head(g, P.F, t, turn(L, P.head));
    g.restore();
    p = S(FORE); ao(g, p[0], p[1] - 1.5, 11, 7, .45);
    flipper(g, blade(p[0], p[1], P.fN[0], P.fN[1], FL1, P.fN[2], FORE_BLADE), FORE_BLADE, SCALE, L, false, foreDetails);
    g.restore();
  }

  function draw(g, o) {
    const s = o.scale || 1, t = o.t || 0;
    const P = (POSE[o.mode] || POSE.idle)(o, t);
    g.save(); g.scale(s, s);
    if (o.mode !== 'ride') {
      // thrown away from the lamp across the floor, and a tight contact shadow right under the plastron
      cast(g, 118, P.lift);
      const k = 1 / (1 + P.lift * .15);
      ao(g, -3, 0, 52 * k, 3.6 * k, .55 * k);
    }
    if (P.k !== 1) g.scale(P.k, P.k);
    if (o.mode === 'ride') { const k = 1 / (1 + P.lift * .15); ao(g, -9, .2, 40 * k, 3 * k, .5 * k); }   // pressed onto the hub
    render(g, P, o, t);
    g.restore();
  }

  AKIT.register({
    key: 'turtle', name: 'Hawksbill Sea Turtle', status: 'Critically Endangered',
    fact: 'Hawksbills eat sea sponges, using that narrow beak to reach into reef cracks.', draw,
  });
})();
