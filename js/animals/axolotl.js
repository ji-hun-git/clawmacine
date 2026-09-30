// Axolotl: the grinning "walking fish" from the Xochimilco canals. Relentlessly cheerful, a bit clumsy:
// the head nods a beat late, one hind foot slaps higher than the other, and it sheds canal water as it runs.
(() => {
  const { C, TAU, LW, paint, sheen, eye, blush, sweat, bib, shadow, cyc, ease } = AKIT;

  // leucistic axolotl inks
  const SKIN = '#f7a3b6', SKIN_FAR = '#d9819a', FIN = '#fcccd6', GILL = '#d9335b', GILL_FAR = '#a3284a';
  const MOUTH = '#7b1c36', TONGUE = '#f27b93', DROP = '#9fd3ff', HALFTONE = 'rgba(178,34,86,.55)';
  const D = Math.PI / 180;
  const frac = x => x - Math.floor(x);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

  // body spine from neck to tail tip (standing), half thickness, fin height above / below the spine
  const SPINE = [[24, -31], [8, -29], [-8, -27], [-26, -26], [-50, -29], [-76, -35]];
  const TH = [15, 16, 15, 12, 6.5, 1];
  const FIN_T = [0, 2.2, 4.5, 7, 10, 7], FIN_B = [0, 0, 0, 1.5, 8, 6];
  const RAYS = [[3, 1], [3.9, 1], [4.6, 1], [4.2, -1]];
  // three gill stalks per side in head space: root x, root y, rest angle (deg), length
  const GILLS_NEAR = [[-17, -11, -116, 30], [-20, -4, -150, 28], [-20, 4, -184, 24]];
  const GILLS_FAR = [[-12, -15, -97, 27], [-16, -9, -131, 25], [-18, -2, -165, 21]];
  // limbs: shoulder, elbow control, foot, finger heading (deg), finger spread, ground foreshortening, curl
  // order: far front, far hind, near front, near hind
  const REST = [
    [19, -22, 16, -9, 26, -2, 20, 30, .45, 0],
    [-21, -22, -12, -9, -17, -2, 10, 30, .45, 0],
    [15, -19, 12, -5, 22, 0, 25, 32, .45, 0],
    [-26, -19, -16, -6, -21, 0, 15, 32, .45, 0],
  ];

  function base() {
    return {
      shadow: 128, lift: 0, x: 0, y: 0, rot: 0, sx: 1, sy: 1, px: 0, py: 0, shadeY: -24,
      sp: SPINE.map(p => p.slice()), th: TH, hp: null, ha: -.06,
      G: { stream: 0, droop: 0, fan: 0, amp: 5, rate: .55, curl: 0 },
      legs: REST.map(l => l.slice()),
      F: { mouth: 'smile', wide: false, shut: false, half: false, brow: false, look: 0, lookX: .5, sweat: false },
      drops: -1, bibAt: [-9, -26, -.04],
    };
  }
  // pose-frame point -> body space (undo the pose rotation and squash, not the hop)
  function inv(P, x, y) {
    const dx = x - P.px, dy = y - P.py, c = Math.cos(P.rot), s = Math.sin(P.rot);
    return [P.px + (dx * c + dy * s) / P.sx, P.py + (-dx * s + dy * c) / P.sy];
  }
  function tailSway(P, t, rate, a) {
    const s = P.sp;
    s[3][1] += .6 * a * cyc(t, rate, -.05); s[4][1] += 1.6 * a * cyc(t, rate, -.15);
    s[5][1] += 3.2 * a * cyc(t, rate, -.3); s[5][0] += 1.5 * a * cyc(t, rate, -.05);
  }

  // ---------- poses ----------
  function poseIdle(t) {
    const P = base(), br = cyc(t, .3);
    P.sy = 1 + .02 * br; P.sx = 1 - .012 * br;
    tailSway(P, t, .22, 1);
    P.ha = -.06 + .035 * cyc(t, .13);
    const puff = Math.pow(Math.max(0, cyc(t, .16)), 4);          // now and then the gills fluff out
    P.G = { stream: 0, droop: 0, fan: .3 * puff, amp: 4 + 3 * puff, rate: .5, curl: .04 * puff };
    P.F.lookX = .7 * cyc(t, .07);
    return P;
  }

  // Gait phase integrated over o.t: the race changes o.speed every frame, and t * rate(speed) would
  // make the legs skip whenever a racer speeds up. Keyed by bib; any jump in t falls back to t * rate.
  const gait = {};
  function gaitPhase(t, o, rate) {
    const id = o.bib ? String(o.bib.n) : '', s = gait[id];
    if (s && t >= s.t && t - s.t < .25) { s.ph += (t - s.t) * rate; s.t = t; return s.ph; }
    gait[id] = { t, ph: t * rate };
    return t * rate;
  }

  function poseRun(t, o) {
    const P = base(), v = clamp(o.speed == null ? 1 : +o.speed || 0, .2, 1.6);
    const rate = .8 + 1.5 * v, ph = gaitPhase(t, o, rate), k = .7 + .3 * Math.min(1, v);
    const step = cyc(ph, 2, .59);                                // lowest just after each footfall
    P.y = -1.5 * (1 + step) * k; P.sy = 1 + .05 * step * k; P.sx = 1 - .035 * step * k;
    P.rot = .025 * v;
    // sprawling wiggle: shoulders and hips swing against each other (seen from a little above, the
    // side-to-side S shows as an up-down S), and the wave runs on down the tail
    const A = [1.4, 2.2, .5, 2.2, 4.5, 9], PH = [.02, 0, .25, .5, .62, .78];
    for (let i = 0; i < 6; i++) P.sp[i][1] += A[i] * k * cyc(ph, 1, -PH[i]);
    P.sp[5][0] += 4 * k * cyc(ph, 1, -.55); P.sp[4][0] += 1.5 * k * cyc(ph, 1, -.4);
    P.sp[5][1] -= 3 * v; P.sp[4][1] -= v;
    P.ha = -.07 + .05 * cyc(ph, 1, -.18) + .025 * cyc(ph, 2, .4);   // the nod lags the body
    P.G = { stream: Math.min(.65, .15 + .35 * v), droop: 0, fan: 0, amp: 6 + 4 * v, rate: 1, curl: .03 };
    P.gt = ph;                                                   // gills flap on the gait clock
    const S = 6 + 3.5 * Math.min(v, 1.2), Lf = 4 + 2 * Math.min(v, 1), off = [.5, 0, 0, .5];
    for (let i = 0; i < 4; i++) {
      const l = P.legs[i], a = TAU * (ph + off[i]);
      const slap = i === 3 ? 1 + .35 * (1 + cyc(ph, .5)) : 1;   // the clumsy hind foot
      const lift = Lf * Math.max(0, -Math.sin(a)) * slap, dx = S * Math.cos(a);
      l[2] += dx * .45; l[3] -= lift * .5; l[4] += dx; l[5] -= lift; l[9] = 30 * lift / Lf;
    }
    P.F.mouth = v > 1.15 ? 'grin' : 'smile'; P.F.lookX = .8; P.F.look = .05;
    P.drops = v > .45 ? frac(ph * .5) : -1;
    return P;
  }

  function poseCheer(t) {
    const P = base(), u = frac(t * .95);
    const air = u > .12 && u < .72 ? Math.sin(Math.PI * (u - .12) / .6) : 0;
    const sq = u >= .72 ? Math.sin(Math.PI * (u - .72) / .4) : u < .12 ? Math.sin(Math.PI * (u + .28) / .4) : 0;
    // rears up on hind feet and tail, hops, jazz hands
    P.px = -20; P.rot = -.27 - .05 * air + .04 * sq; P.y = -11 * air; P.lift = 11 * air;
    P.sx = 1 + .09 * sq - .03 * air; P.sy = 1 - .13 * sq + .05 * air;
    P.sp[4] = inv(P, -50, -9 - 3 * air); P.sp[5] = inv(P, -73, -15 - 8 * air + 2.5 * cyc(t, 1.9));
    P.ha = .2 + .05 * sq;
    const w = cyc(t, 2.6), w2 = cyc(t, 2.6, .5), fz = 12 * cyc(t, 5.2), ground = -P.rot / D;
    P.legs[0] = [19, -22, 26, -27, 27 + 2.5 * w2, -38 + w2, -80 + fz, 28, 1, 0];
    P.legs[2] = [15, -19, 23, -23, 24 + 2.5 * w, -34 + w, -75 - fz, 28, 1, 0];
    const fh = inv(P, -15, -2 + 4 * air), nh = inv(P, -19, 4 * air);
    P.legs[1] = [-21, -22, -14, -10, fh[0], fh[1], 10, 30, .45, ground + 30 * air];
    P.legs[3] = [-26, -19, -17, -7, nh[0], nh[1], 15, 32, .45, ground + 30 * air];
    P.G = { stream: 0, droop: .35 * sq, fan: .35 - .25 * sq, amp: 7, rate: 2.2, curl: .05 * air };
    P.F.mouth = 'grin'; P.F.shut = air > .7; P.F.look = -.25; P.F.lookX = .6;
    return P;
  }

  function poseWorry(t) {
    const P = base(), sway = cyc(t, .9);
    P.x = -2 + 1.6 * sway + .35 * cyc(t, 7.5); P.sy = .95; P.sx = 1.02; P.rot = .015 * cyc(t, .9, .25);
    P.hp = [P.sp[0][0] + 2, P.sp[0][1] - 3]; P.ha = .06 + .03 * cyc(t, .9, .1);     // head pulled in
    P.sp[4] = [-45, -22]; P.sp[5] = [-52 + 1.5 * cyc(t, 3.2), -38 + cyc(t, 3.2, .25)];  // tail hooked up, tip twitching
    P.G = { stream: .55, droop: .15, fan: -.15, amp: 2.5, rate: 5, curl: -.05 };
    const f = cyc(t, 2.6);
    P.legs[2] = [15, -19, 20, -14, 31, -27 + .8 * f, -65 + 14 * f, 24, 1, 0];          // fingers at its lip
    P.F = { mouth: 'wobble', wide: true, shut: false, half: false, brow: false, look: .1, lookX: .9 * Math.tanh(3 * cyc(t, .5)), sweat: true };
    return P;
  }

  function poseRide(t, o) {
    const P = base(), em = o.emotion || 'focus', look = clamp(+o.look || 0, -1, 1);
    P.shadow = 0; P.shadeY = -10;
    // belly down along the hub, tail draped over the back edge
    P.sp = [[16, -14], [3, -13.5], [-9, -13.5], [-20, -12.5], [-30, -2], [-35, 15]];
    P.th = [13, 14, 13.5, 11, 6, 1];
    P.sy = 1 + .02 * cyc(t, .4);
    P.sp[4][0] += 1.2 * cyc(t, .35, -.1); P.sp[5][0] += 4 * cyc(t, .35, -.3); P.sp[5][1] += cyc(t, .7);
    P.hp = [21, -19]; P.ha = -.12 + look * .72;
    P.legs = [
      [15, -9, 22, -8, 24.5, -1, 75, 24, 1, 0],
      [-14, -9, -20, -8, -19.5, -1, 105, 24, 1, 0],
      [11, -6, 19, -6, 21.5, 1.5, 80, 24, 1, 0],
      [-17, -5, -22, -4, -21.5, 1.5, 100, 24, 1, 0],
    ];
    P.G = { stream: .1, droop: 0, fan: 0, amp: 5, rate: .9, curl: 0 };
    P.F.look = look * .9; P.F.lookX = .4; P.bibAt = [-12, -14, -.06];
    if (em === 'worry') {
      P.x = .45 * cyc(t, 8); P.sy = .95;
      P.sp[4] = [-27, -1]; P.sp[5] = [-24, 11];
      P.G = { stream: .5, droop: .1, fan: -.2, amp: 2, rate: 6, curl: -.05 };
      P.F.wide = true; P.F.sweat = true; P.F.mouth = 'wobble';
    } else if (em === 'cheer') {
      const b = cyc(t, 1.7), w = cyc(t, 2.6), fz = 12 * cyc(t, 5.2);
      P.y = -2.5 - 2.5 * b; P.ha -= .1;
      P.sp[5][0] += 5 * cyc(t, 1.7, -.3);
      P.legs[0] = [15, -9, 22, -15, 27 + 2 * cyc(t, 2.6, .5), -27, -80 + fz, 28, 1, 0];
      P.legs[2] = [11, -6, 18, -13, 22 + 2 * w, -24 + w, -75 - fz, 28, 1, 0];
      P.G = { stream: 0, droop: 0, fan: .35, amp: 10, rate: 2.2, curl: .04 };
      P.F.mouth = 'grin';
    } else if (em === 'sad') {
      P.sy = .93; P.ha += .22;
      P.sp[5] = [-31, 20];
      P.G = { stream: .05, droop: .8, fan: 0, amp: 1.5, rate: .4, curl: 0 };
      P.F.half = true; P.F.mouth = 'small'; P.F.look = Math.max(look, .4);
    } else {
      P.F.brow = true; P.ha += .06;
    }
    return P;
  }

  // ---------- drawing ----------
  function tube(g, w, col, ow) {
    g.lineCap = 'round'; g.lineJoin = 'round';
    g.lineWidth = w + ow * 2; g.strokeStyle = C.INK; g.stroke();
    g.lineWidth = w; g.strokeStyle = col; g.stroke();
  }
  // a pair of limbs: inked tubes ending in four small splayed fingers
  function limbs(g, A, B, col, w, nf) {
    const legPath = () => { g.beginPath(); for (const l of [A, B]) { g.moveTo(l[0], l[1]); g.quadraticCurveTo(l[2], l[3], l[4], l[5]); } };
    legPath(); g.lineCap = 'round'; g.lineJoin = 'round'; g.lineWidth = w + LW * 1.7; g.strokeStyle = C.INK; g.stroke();
    g.beginPath();
    for (const l of [A, B]) {
      const cu = l[9] * D, cc = Math.cos(cu), cs = Math.sin(cu);
      for (let k = 0; k < nf; k++) {
        const a = (l[6] + (k - (nf - 1) / 2) * l[7] * 3 / (nf - 1)) * D, x = Math.cos(a), y = Math.sin(a) * l[8];
        const dx = x * cc - y * cs, dy = x * cs + y * cc, r = w * .5 + (k && k < nf - 1 ? 5.2 : 4.2);
        g.moveTo(l[4] + dx * 2, l[5] + dy * 2); g.lineTo(l[4] + dx * r, l[5] + dy * r);
      }
    }
    tube(g, 2.3, col, 1.1);
    legPath(); g.lineWidth = w; g.strokeStyle = col; g.stroke();   // palm over the finger roots
  }
  // one side's three feathery gill stalks, in head space; returns the top stalk's tip
  function gills(g, set, G, t, fil, quill, nf, Tm, ph) {
    const S = [];
    for (let i = 0; i < 3; i++) {
      const r = set[i];
      let a = r[2];
      a += (-180 - a) * G.stream;
      a += (-212 - a) * G.droop;
      a = -150 + (a + 150) * (1 + G.fan);
      a = (a + G.amp * cyc(t, G.rate, -i * .13 - ph)) * D;
      const L = r[3] * (1 - .15 * G.droop), ca = Math.cos(a), sa = Math.sin(a);
      const tx = r[0] + ca * L, ty = r[1] + sa * L;
      const k = (.14 + G.curl + .07 * cyc(t, G.rate, -i * .13 - ph - .22)) * L;   // bow follows the swing late
      S.push([r[0], r[1], (r[0] + tx) / 2 - sa * k, (r[1] + ty) / 2 + ca * k, tx, ty]);
    }
    // each stalk is a feather: a fringe of soft lobes (leaning to the tip, smaller toward it) round a pink quill
    const s0 = .18, ds = (1 - s0) / nf, core = 1.5;
    for (const [rx, ry, cx, cy, tx, ty] of S) {
      const at = s => {
        const u = 1 - s;
        let dx = u * (cx - rx) + s * (tx - cx), dy = u * (cy - ry) + s * (ty - cy);
        const n = Math.hypot(dx, dy) || 1; dx /= n; dy /= n;
        return [u * u * rx + 2 * u * s * cx + s * s * tx, u * u * ry + 2 * u * s * cy + s * s * ty, dx, dy];
      };
      // one swept barb between notches at sa and se (side +1 / -1): rises gently, overhangs toward the tip
      const notch = (p, s, side) => { const o = core + .4 * Tm * (1.1 - .6 * s); return [p[0] - p[3] * o * side, p[1] + p[2] * o * side]; };
      const lobe = (side, sa, se) => {
        const a = at(sa), e = at(se), lo = sa < se ? a : e, hi = sa < se ? e : a, T = Tm * (1.1 - .3 * (sa + se)), h = core + T * 1.5;
        const cl = [lo[0] - lo[3] * h * .55 * side, lo[1] + lo[2] * h * .55 * side];
        const ch = [hi[0] - hi[3] * h * side + hi[2] * T * .6, hi[1] + hi[2] * h * side + hi[3] * T * .6];
        const [c1, c2] = sa < se ? [cl, ch] : [ch, cl], n = notch(e, se, side);
        g.bezierCurveTo(c1[0], c1[1], c2[0], c2[1], n[0], n[1]);
      };
      g.beginPath();
      const b = notch(at(s0), s0, 1), e = at(1), te = Tm * .8;
      g.moveTo(b[0], b[1]);
      for (let j = 0; j < nf; j++) lobe(1, s0 + j * ds, s0 + (j + 1) * ds);
      const p1 = notch(e, 1, 1), p2 = notch(e, 1, -1);
      g.bezierCurveTo(p1[0] + e[2] * te, p1[1] + e[3] * te, p2[0] + e[2] * te, p2[1] + e[3] * te, p2[0], p2[1]);
      for (let j = nf - 1; j >= 0; j--) lobe(-1, s0 + (j + 1) * ds, s0 + j * ds);
      g.closePath();
      paint(g, fil, { lw: LW * .7 });
      if (!quill) continue;
      const q = .9, qp = at(q);
      g.beginPath(); g.moveTo(rx, ry); g.quadraticCurveTo(rx + (cx - rx) * q, ry + (cy - ry) * q, qp[0], qp[1]);
      g.lineCap = 'round'; g.lineWidth = 2.6; g.strokeStyle = quill; g.stroke();
    }
    return S[0];
  }
  // closed smooth loop through points (quadratic curves between midpoints)
  function loop(g, pts) {
    const n = pts.length;
    let a = pts[n - 1], b = pts[0];
    g.moveTo((a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
    for (let i = 0; i < n; i++) { a = pts[i]; b = pts[(i + 1) % n]; g.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2); }
    g.closePath();
  }
  function bodyAndFin(g, P) {
    const sp = P.sp, th = P.th, N = [];
    for (let i = 0; i < 6; i++) {
      const a = sp[Math.max(0, i - 1)], b = sp[Math.min(5, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
      N.push([-dy / l, dx / l]);                                     // points to the back (up when standing)
    }
    const off = (i, d) => [sp[i][0] + N[i][0] * d, sp[i][1] + N[i][1] * d];
    const e = sp[5], q = sp[4], el = Math.hypot(e[0] - q[0], e[1] - q[1]) || 1;
    // fin ridge: starts low on the back, grows along the tail and wraps under it
    g.beginPath();
    loop(g, [off(1, th[1] + FIN_T[1]), off(2, th[2] + FIN_T[2]), off(3, th[3] + FIN_T[3]), off(4, th[4] + FIN_T[4]),
      off(5, th[5] + FIN_T[5]), [e[0] + (e[0] - q[0]) / el * 10, e[1] + (e[1] - q[1]) / el * 10],
      off(5, -th[5] - FIN_B[5]), off(4, -th[4] - FIN_B[4]), off(3, -th[3] - FIN_B[3]), sp[2]]);
    paint(g, FIN, { lw: LW * .85 });
    g.save(); g.clip(); g.beginPath();
    for (const [r, s] of RAYS) {
      const i = Math.floor(r), f = r - i, j = Math.min(5, i + 1), lerp = (A, B) => A + (B - A) * f;
      const px = lerp(sp[i][0], sp[j][0]), py = lerp(sp[i][1], sp[j][1]), nx = lerp(N[i][0], N[j][0]) * s, ny = lerp(N[i][1], N[j][1]) * s;
      const t0 = lerp(th[i], th[j]), fin = s > 0 ? lerp(FIN_T[i], FIN_T[j]) : lerp(FIN_B[i], FIN_B[j]);
      g.moveTo(px + nx * t0, py + ny * t0); g.lineTo(px + nx * (t0 + fin), py + ny * (t0 + fin));
    }
    g.lineWidth = 1.1; g.strokeStyle = 'rgba(28,27,31,.32)'; g.stroke(); g.restore();
    g.beginPath();
    loop(g, [off(0, th[0]), off(1, th[1]), off(2, th[2]), off(3, th[3]), off(4, th[4]), sp[5],
      off(4, -th[4]), off(3, -th[3]), off(2, -th[2]), off(1, -th[1]), off(0, -th[0])]);
    paint(g, SKIN, { shade: HALFTONE, shadeFrom: P.shadeY });
  }
  // broad, flat head with a blunt snout
  function headPath(g) {
    g.beginPath();
    g.moveTo(-21, -14);
    g.bezierCurveTo(-7, -21, 15, -21.5, 25, -14);
    g.bezierCurveTo(32, -9, 33, 4, 26, 9);
    g.bezierCurveTo(17, 16, -5, 17.5, -17, 13);
    g.bezierCurveTo(-27, 9, -28, -9, -21, -14);
    g.closePath();
  }
  function mouth(g, m) {
    g.lineCap = 'round'; g.lineJoin = 'round';
    if (m === 'grin') {
      const lips = () => { g.beginPath(); g.moveTo(27, 3); g.quadraticCurveTo(12, 23, -4, 4); g.quadraticCurveTo(11, 10, 27, 3); };
      lips(); g.fillStyle = MOUTH; g.fill();
      g.save(); g.clip(); g.beginPath(); g.ellipse(11, 14, 8, 4, 0, 0, TAU); g.fillStyle = TONGUE; g.fill(); g.restore();
      lips(); g.moveTo(-4, 4); g.quadraticCurveTo(-7, 2.5, -6.5, -.5);
    } else {
      g.beginPath(); g.moveTo(27, 4);
      if (m === 'wobble') {
        g.quadraticCurveTo(23, 8.5, 18, 7); g.quadraticCurveTo(13, 5.5, 8, 8);
        g.quadraticCurveTo(3, 10.5, -3, 5.5); g.quadraticCurveTo(-6.5, 3.5, -6, .5);
      } else if (m === 'small') {
        g.quadraticCurveTo(16, 10, 6, 7); g.quadraticCurveTo(3, 6, 3.5, 3.5);
      } else {
        g.quadraticCurveTo(12, 12.5, -3, 5.5); g.quadraticCurveTo(-6.5, 3.5, -6, .5);
      }
    }
    g.lineWidth = LW * .85; g.strokeStyle = C.INK; g.stroke();
  }
  function face(g, F, t) {
    blush(g, 3, 1, 5.5);
    mouth(g, F.mouth);
    const eo = { t, look: F.look, lookX: F.lookX, wide: F.wide, shut: F.shut };
    eye(g, 19, -15, 3.3, eo);
    eye(g, 8, -7, 4.4, eo);
    if (F.half) {                                                     // heavy lids, drooping at the outer corners
      g.beginPath(); g.ellipse(19, -15, 3.9, 4.1, .3, Math.PI, TAU); g.closePath();
      g.ellipse(8, -7, 5.2, 5.4, -.3, Math.PI, TAU); g.closePath();
      g.fillStyle = SKIN; g.fill(); g.lineWidth = LW * .7; g.strokeStyle = C.INK; g.stroke();
    }
    if (F.brow) {                                                     // determined: knitted toward the snout
      g.beginPath(); g.moveTo(2, -15.5); g.lineTo(12.5, -13); g.moveTo(15.5, -20.5); g.lineTo(23, -22.5);
      g.lineWidth = LW; g.strokeStyle = C.INK; g.lineCap = 'round'; g.stroke();
    }
    if (F.sweat) sweat(g, -6, -25 + 1.2 * cyc(t, .8), .9);
  }
  function drops(g, S, ph) {
    g.beginPath();
    for (let k = 0; k < 2; k++) {
      const f = frac(ph + k * .5), r = 2.8 * Math.sin(Math.PI * f), x = S[4] - 26 * f, y = S[5] - 8 * f + 30 * f * f;
      if (r > .3) { g.moveTo(x + r, y); g.arc(x, y, r, 0, TAU); }
    }
    g.fillStyle = DROP; g.fill(); g.lineWidth = 1.2; g.strokeStyle = C.INK; g.stroke();
  }

  function render(g, P, t, bibSpec) {
    if (P.shadow) shadow(g, P.shadow, P.lift);
    g.save();
    g.translate(P.px + P.x, P.py + P.y);
    if (P.rot) g.rotate(P.rot);
    g.scale(P.sx, P.sy);
    g.translate(-P.px, -P.py);
    const L = P.legs, gt = P.gt == null ? t : P.gt;
    limbs(g, L[0], L[1], SKIN_FAR, 7, 3);
    // head frame: pivot at the neck, head centre 18 units ahead
    const hp = P.hp || [P.sp[0][0] + 4, P.sp[0][1] - 6], ca = Math.cos(P.ha), sa = Math.sin(P.ha);
    const hx = hp[0] + 18 * ca + 4 * sa, hy = hp[1] + 18 * sa - 4 * ca;
    g.save(); g.translate(hx, hy); g.rotate(P.ha);
    gills(g, GILLS_FAR, P.G, gt, GILL_FAR, null, 3, 5.4, .3);
    g.restore();
    bodyAndFin(g, P);
    if (bibSpec) bib(g, P.bibAt[0], P.bibAt[1], bibSpec, { a: P.bibAt[2], w: 22, h: 17 });
    g.save(); g.translate(hx, hy); g.rotate(P.ha);
    const top = gills(g, GILLS_NEAR, P.G, gt, GILL, SKIN, 4, 6.4, 0);
    if (P.drops >= 0) drops(g, top, P.drops);
    headPath(g); paint(g, SKIN, { shade: HALFTONE, shadeFrom: 9 });
    sheen(g, -3, -9, 21, 9, .45);
    face(g, P.F, t);
    g.restore();
    limbs(g, L[2], L[3], SKIN, 8, 4);
    g.restore();
  }

  function draw(g, o) {
    const t = o.t || 0, m = o.mode;
    const P = m === 'run' ? poseRun(t, o) : m === 'ride' ? poseRide(t, o) : m === 'cheer' ? poseCheer(t) : m === 'worry' ? poseWorry(t) : poseIdle(t);
    g.save(); g.scale(o.scale || 1, o.scale || 1);
    render(g, P, t, o.bib);
    g.restore();
  }

  AKIT.register({
    key: 'axolotl', name: 'Axolotl', status: 'Critically Endangered',
    fact: 'An axolotl can regrow a lost leg, and even parts of its heart and brain.',
    draw,
  });
})();
