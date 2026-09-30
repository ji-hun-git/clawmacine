// Hawksbill sea turtle (Eretmochelys imbricata), IUCN Critically Endangered.
// Character: an old sea captain who has seen worse weather than a race. Heavy-lidded and unbothered,
// barnacles on his shell, an anchor tattooed on his flipper, and a terry sweatband he put on for the day.
// Anatomy: narrow hooked hawk beak, long shield of overlapping tortoiseshell scutes with a serrated back
// rim, long paddle fore-flippers with two claws each, small rudder hind flippers.
// Gait: the sea-turtle haul. Both fore-flippers reach forward together, plant and pull; the shell lifts
// and surges, the head thrusts on each pull, then the body drops back onto the plastron.
(() => {
  const { C, TAU, LW, paint, sheen, eye, blush, sweat, bib, shadow, cyc, ease } = AKIT;

  // tortoiseshell and skin inks
  const AMBER = '#d98b2b', GOLD = '#f4b949', CHESTNUT = '#8a3d17', UMBER = '#3a1f10', RIM = '#b35d1b',
    PLASTRON = '#f2d690', SKIN = '#e8bb5a', SCALE = '#6c3519', SCALE_FAR = '#48220e',
    SEAM = '#f5cf78', LID = '#93501f', BARNACLE = '#efe6cd';

  const lerp = (a, b, k) => a + (b - a) * k;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const bell = x => (1 - Math.cos(TAU * x)) / 2;          // 0 -> 1 -> 0 across [0, 1], flat at both ends
  const wrap = x => ((x % 1) + 1) % 1;
  const quadAt = (p0, p1, p2, s) => {
    const k = 1 - s;
    return [k * k * p0[0] + 2 * k * s * p1[0] + s * s * p2[0], k * k * p0[1] + 2 * k * s * p1[1] + s * s * p2[1]];
  };

  // Static outlines are built once as Path2D (where available) so each frame only builds what moves.
  const P2D = typeof Path2D === 'function', cache = {};
  function shape(g, key, build) {
    if (!P2D) { g.beginPath(); build(g); return null; }
    if (!cache[key]) { const p = new Path2D(); build(p); cache[key] = p; }
    return cache[key];
  }
  function fillS(g, key, build, fill) { const p = shape(g, key, build); g.fillStyle = fill; if (p) g.fill(p); else g.fill(); }
  function strokeS(g, key, build, color, lw) {
    const p = shape(g, key, build); g.lineWidth = lw; g.strokeStyle = color; g.lineJoin = 'round'; g.lineCap = 'round';
    if (p) g.stroke(p); else g.stroke();
  }
  function inkS(g, key, build, fill, lw = LW) {
    const p = shape(g, key, build); g.fillStyle = fill; g.lineWidth = lw; g.strokeStyle = C.INK; g.lineJoin = 'round'; g.lineCap = 'round';
    if (p) { g.fill(p); g.stroke(p); } else { g.fill(); g.stroke(); }
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
  // each costal plate's back edge laps over the next one: a soft umber shadow just behind every seam
  const lapB = p => {
    p.moveTo(17.3, -8.9); p.quadraticCurveTo(10.5, -20.7, 16.8, -33.2);
    p.moveTo(-7, -4.3); p.quadraticCurveTo(-14, -19.2, -6.8, -34.3);
    p.moveTo(-28.6, -3.4); p.quadraticCurveTo(-36, -15.7, -29, -29.2);
  };
  // two barnacles low on the rear slope of the dome, riding along since his first voyage
  const BARNS = [[-22.9, -40.4, -.354, -.935, 4.6, 3.8], [-36.3, -33.5, -.553, -.833, 3.3, 3]];
  const barnB = p => {
    for (const [x, y, nx, ny, b, h] of BARNS) {
      const at = (u, v) => [x - ny * u + nx * v, y + nx * u + ny * v];
      const q = [at(-b, -1.5), at(-b * .95, .8), at(-b * .62, h), at(b * .62, h), at(b * .95, .8), at(b, -1.5)];
      p.moveTo(q[0][0], q[0][1]); p.lineTo(q[1][0], q[1][1]); p.quadraticCurveTo(q[2][0] - nx, q[2][1] - ny, q[2][0], q[2][1]);
      p.lineTo(q[3][0], q[3][1]); p.quadraticCurveTo(q[3][0] - nx, q[3][1] - ny, q[4][0], q[4][1]); p.lineTo(q[5][0], q[5][1]); p.closePath();
    }
  };
  const barnHoleB = p => {
    for (const [x, y, nx, ny, b, h] of BARNS) {
      const cx = x + nx * h, cy = y + ny * h;
      p.moveTo(cx + b * .45, cy); p.ellipse(cx, cy, b * .45, .95, Math.atan2(nx, -ny), 0, TAU);
    }
  };

  function shell(g, sx, sy) {
    g.save(); g.scale(sx, sy);
    inkS(g, 'plastron', plastronB, PLASTRON);
    const cp = shape(g, 'carapace', carapaceB);
    g.save(); if (cp) g.clip(cp); else g.clip();
    g.fillStyle = AMBER; if (cp) g.fill(cp); else g.fill();
    fillS(g, 'chestnut', chestnutB, CHESTNUT); fillS(g, 'umber', umberB, UMBER); fillS(g, 'gold', goldB, GOLD);
    fillS(g, 'rim', rimB, RIM);
    strokeS(g, 'laps', lapB, 'rgba(58,31,16,.55)', LW * 1.1);
    strokeS(g, 'seams', seamB, C.INK, LW * .7);
    g.restore();
    g.beginPath(); carapaceB(g); paint(g, 'rgba(0,0,0,0)', { shadeFrom: -16 });
    sheen(g, 0, -32, 30, 10, .45);
    inkS(g, 'barnacles', barnB, BARNACLE, LW * .7);
    fillS(g, 'barnHoles', barnHoleB, C.INK);
    g.restore();
  }

  // Flipper = a short arm from the root plus a blade profile laid along the blade angle.
  // Blade frame: u from the wrist toward the tip, -v on the leading edge. k2 < 1 foreshortens the blade
  // when it turns edge-on to the viewer. pts: [start, (control, end) x n].
  const FORE_BLADE = { w0: 6, pts: [[0, -5], [10, -9], [20, -7], [29, -4.2], [35, 1], [27, 2.6], [19, 3.9], [9, 7.4], [0, 5.2]] };
  const HIND_BLADE = { w0: 4.8, pts: [[0, -4.4], [7, -8.6], [13, -6.6], [18.5, -3.6], [17, 2.6], [11, 6.2], [0, 4.6]] };
  const NECK_TUBE = { w0: 7.4, pts: [[0, -7.6], [6, -8], [9, 0], [6, 8], [0, 7.4]] };
  function paddle(g, x, y, a1, a2, L1, k2, prof, fill) {
    const c1 = Math.cos(a1), s1 = Math.sin(a1), c2 = Math.cos(a2), s2 = Math.sin(a2);
    const wx = x + c1 * L1, wy = y + s1 * L1, w0 = prof.w0, pts = prof.pts;
    const at = (u, v) => [wx + c2 * u * k2 - s2 * v, wy + s2 * u * k2 + c2 * v];
    g.beginPath(); g.moveTo(x + s1 * w0, y - c1 * w0);
    let e = at(pts[0][0], pts[0][1]); g.lineTo(e[0], e[1]);
    for (let i = 1; i < pts.length; i += 2) {
      const q = at(pts[i][0], pts[i][1]); e = at(pts[i + 1][0], pts[i + 1][1]);
      g.quadraticCurveTo(q[0], q[1], e[0], e[1]);
    }
    g.lineTo(x - s1 * w0, y + c1 * w0); g.closePath();
    paint(g, fill);
    return { at, wx, wy, c1, s1, a2 };
  }
  const anchorB = p => {
    p.moveTo(-2.3, 0); p.arc(-3.2, 0, .85, 0, TAU);
    p.moveTo(-2.3, 0); p.lineTo(3.4, 0); p.moveTo(-1.1, -1.9); p.lineTo(-1.1, 1.9);
    p.moveTo(1.3, -2.7); p.quadraticCurveTo(3.9, -2.4, 3.9, 0); p.quadraticCurveTo(3.9, 2.4, 1.3, 2.7);
  };
  // the near fore-flipper's printed details: two claws on the leading edge, a pale trailing margin, the anchor tattoo
  function foreDetails(g, L) {
    const { at } = L;
    g.beginPath();
    for (const [u, v] of [[8, -8.2], [14.5, -8.4]]) {
      let p = at(u - 1.6, v + .5); g.moveTo(p[0], p[1]);
      p = at(u + 3, v - 3.4); g.lineTo(p[0], p[1]);
      p = at(u + 1.6, v + .3); g.lineTo(p[0], p[1]); g.closePath();
    }
    g.fillStyle = C.INK; g.fill();
    // pale scale margin along the trailing edge
    g.beginPath();
    let p = at(3, 3.4); g.moveTo(p[0], p[1]);
    let q = at(10, 5.2); p = at(18.5, 2.3); g.quadraticCurveTo(q[0], q[1], p[0], p[1]);
    q = at(26, .9); p = at(31.5, .3); g.quadraticCurveTo(q[0], q[1], p[0], p[1]);
    g.lineWidth = LW * .5; g.strokeStyle = SEAM; g.stroke();
    p = at(9, -1);
    g.save(); g.translate(p[0], p[1]); g.rotate(L.a2);
    strokeS(g, 'anchor', anchorB, SEAM, 1.1);
    g.restore();
  }
  function neck(g, x, y, a, bend, len) {
    const L = paddle(g, x, y, a, a + bend, len - 6, 1, NECK_TUBE, SKIN);
    // old-salt wrinkles just behind the head
    g.beginPath();
    for (const u of [-7, -3.5]) {
      let p = L.at(u, -7.2); g.moveTo(p[0], p[1]);
      const q = L.at(u + 2.4, 0); p = L.at(u, 6.6); g.quadraticCurveTo(q[0], q[1], p[0], p[1]);
    }
    g.lineWidth = LW * .5; g.strokeStyle = CHESTNUT; g.stroke();
    return L.at(3, 0);
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

  function head(g, F, t) {
    inkS(g, 'head', headB, SKIN);
    inkS(g, 'plates', platesB, SCALE, LW * .8);
    strokeS(g, 'plateSeams', plateSeamB, SEAM, LW * .45);
    fillS(g, 'nostril', nostrilB, C.INK);
    const m = MOUTH[F.mouth] ? F.mouth : 'flat';
    if (m === 'grin' || m === 'o') fillS(g, 'mouth-' + m, MOUTH[m], C.INK);
    else strokeS(g, 'mouth-' + m, MOUTH[m], C.INK, LW * .75);
    if (m === 'grin') fillS(g, 'tongue', tongueB, C.TOMATO);
    if (F.blush) blush(g, 9, 5, 3.2);
    // eye under a heavy, unbothered lid; the kit's blink clock is mirrored so the lid steps aside for it
    const ex = 12, ey = -4.3, er = 4.3, shut = F.lid > .93 || ((t + .7) % 3.7) < .12;
    eye(g, ex, ey, er, { t, look: F.look, lookX: F.lookX, wide: F.wide, shut, seed: .7 });
    if (!shut && F.lid > .03) {
      const r = (F.wide ? er * 1.25 : er) + .7, a = Math.asin(clamp(2 * F.lid - 1, -.97, .97));
      g.save(); g.translate(ex, ey); g.rotate(F.tilt);
      g.beginPath(); g.ellipse(0, 0, r, r * 1.08, 0, Math.PI - a, TAU + a); g.closePath();
      g.restore();
      paint(g, LID, { lw: LW * .75 });
    }
    inkS(g, 'band', bandB, C.WHITE, LW * .75);
    strokeS(g, 'stripe', stripeB, C.TOMATO, 2.4);
    if (F.sweat) {
      const q = wrap(t * .8);
      g.globalAlpha = Math.sin(Math.PI * q); sweat(g, 17, -16 + q * 5, .9); g.globalAlpha = 1;
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
        sx: 1 + .03 * flat, sy: 1 + .015 * br - .06 * flat + .04 * air, k: .88,
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
    const frame = () => { g.translate(P.x, P.y); g.rotate(P.rot); };
    // far limbs first, darker
    g.save(); frame();
    let p = S(FORE_FAR);
    paddle(g, p[0], p[1], P.fF[0], P.fF[1], FL1, P.fF[2], FORE_BLADE, SCALE_FAR);
    p = S(HIND_FAR); paddle(g, p[0], p[1], P.rF[0], P.rF[1], 5, 1, HIND_BLADE, SCALE_FAR);
    p = S(NECK); const N = neck(g, p[0], p[1], P.neck[0], P.neck[1], P.neck[2]);
    shell(g, P.sx, P.sy);
    if (o.bib) bib(g, -14 * P.sx, -19 * P.sy, o.bib, { a: -P.rot * .85 });
    p = S(HIND); paddle(g, p[0], p[1], P.rN[0], P.rN[1], 5, 1, HIND_BLADE, SCALE);
    g.save();
    g.translate(N[0], N[1]); g.rotate(P.head); g.scale(HEAD, HEAD);
    head(g, P.F, t);
    g.restore();
    p = S(FORE);
    foreDetails(g, paddle(g, p[0], p[1], P.fN[0], P.fN[1], FL1, P.fN[2], FORE_BLADE, SCALE));
    g.restore();
  }

  function draw(g, o) {
    const s = o.scale || 1, t = o.t || 0;
    const P = (POSE[o.mode] || POSE.idle)(o, t);
    g.save(); g.scale(s, s);
    if (o.mode !== 'ride') shadow(g, 118, P.lift);
    if (P.k !== 1) g.scale(P.k, P.k);
    render(g, P, o, t);
    g.restore();
  }

  AKIT.register({
    key: 'turtle', name: 'Hawksbill Sea Turtle', status: 'Critically Endangered',
    fact: 'Hawksbills eat sea sponges, using that narrow beak to reach into reef cracks.', draw,
  });
})();
