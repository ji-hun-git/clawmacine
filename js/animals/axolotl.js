// Axolotl: the grinning "walking fish" from the Xochimilco canals. Relentlessly cheerful, a bit clumsy:
// the head nods a beat late, one hind foot slaps higher than the other, and it sheds canal water as it runs.
// Modelled like a glossy wet-skin figure under the cabinet lamp (AKIT.LIGHT, the one the wheel and the cans use):
// the body is a tube swept along the spine, the head a flattened ellipsoid, limbs and gill fronds are shaded
// across their width, and every shadow falls away from the lamp. No ink outlines, only a faint contour.
(() => {
  const { TAU, cyc, ao, cast, eye3d } = AKIT;

  // leucistic axolotl albedos; the lamp and the room do the shading
  const SKIN = '#f7a3b6', SKIN_FAR = '#d9819a', FIN = '#fcccd6', GILL = '#d9335b', GILL_FAR = '#a3284a', TONGUE = '#f27b93';
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
      shadow: 128, lift: 0, x: 0, y: 0, rot: 0, sx: 1, sy: 1, px: 0, py: 0,
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
    P.shadow = 0; P.ride = true;
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


  // ---------- light ----------
  // One lamp, upper left and in front of the glass. Colours come from a small lighting model (ambient room,
  // wrapped diffuse for skin, warm bounce from the floor on the far side, a tight specular for the wet gloss).
  const LIT = AKIT.LIGHT, LXY = Math.hypot(LIT.x, LIT.y) || 1, LZ = LIT.z;
  const HN = Math.hypot(LIT.x, LIT.y, LIT.z + 1), HXY = Math.hypot(LIT.x, LIT.y) / HN, HZ = (LIT.z + 1) / HN;
  const ROOM = [.42, .34, .41], LAMP = [1, .95, .88], BOUNCE = [.62, .34, .27];
  // materials: ambient, diffuse, wrap (soft terminator), bounce, specular, its power, sheen, its power
  const WET = [1, .66, .3, .5, .5, 55, .1, 7];
  const FEATHER = [1.12, .72, .6, .7, .3, 28, .06, 4];
  const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const css = c => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
  let tid = 0;
  const tone = (hex, m) => ({ id: tid++, alb: rgb(hex), m, flat: {} });
  const T_SKIN = tone(SKIN, WET), T_FAR = tone(SKIN_FAR, WET), T_FIN = tone(FIN, WET), T_GILL = tone(GILL, FEATHER), T_GILLF = tone(GILL_FAR, FEATHER);
  // colour of a surface whose normal makes nl with the lamp, nh with the half vector, nb with the floor bounce
  function lit(T, nl, nh, nb) {
    const m = T.m, d = Math.max(0, (nl + m[2]) / (1 + m[2])), b = Math.max(0, nb) * m[3];
    const h = Math.max(0, nh), s = m[4] * Math.pow(h, m[5]) + m[6] * Math.pow(h, m[7]);
    return [0, 1, 2].map(i => Math.min(255, T.alb[i] * (m[0] * ROOM[i] + m[1] * d * LAMP[i] + b * BOUNCE[i]) + 255 * s * LAMP[i]));
  }
  // one flat tone of a round part: u runs along the lamp's axis, -1 the far edge .. 1 the edge facing the lamp
  function flat(T, u, spec = false) {
    const key = Math.round(u * 100) + (spec ? 1000 : 0);
    let c = T.flat[key]; if (c) return c;
    const q = Math.sqrt(Math.max(0, 1 - u * u));
    c = css(lit(T, u * LXY + q * LZ, spec ? u * HXY + q * HZ : 0, Math.pow(Math.max(0, -u), 2)));
    return (T.flat[key] = c);
  }
  // colour stops across a tube (offset 0 = the -normal edge, 1 = the +normal edge); k = cos(normal, lamp) in the picture
  const STOPS = new Map();
  function tubeStops(T, q) {
    const key = T.id * 128 + q; let st = STOPS.get(key); if (st) return st;
    // the streak stays crisp when the lamp sits partly along the tube (it is a lamp, not a point)
    const k = q / 40 - 1, kh = k * HXY, hp = Math.hypot(kh, HZ), sp = kh / hp;
    const S = [-1, -.95, -.84, -.66, -.42, -.16, .12, .38, .6, .78, .9, .97, 1];
    for (const d of [-.2, -.11, -.055, -.02, 0, .02, .055, .11, .2]) if (Math.abs(sp + d) < .985) S.push(sp + d);
    S.sort((a, b) => a - b);
    st = S.map(s => {
      const c = Math.sqrt(Math.max(0, 1 - s * s));
      return [(s + 1) / 2, css(lit(T, s * k * LXY + c * LZ, (s * kh + c * HZ) / hp, Math.pow(Math.max(0, -s * k), 2)))];
    });
    STOPS.set(key, st); return st;
  }
  // gradients are built in unit frames, so one per context serves every frame and every racer
  const GC = new WeakMap();
  function cached(g, key, make) {
    let m = GC.get(g); if (!m) { m = new Map(); GC.set(g, m); }
    let gr = m.get(key);
    if (!gr) { if (m.size > 1500) m.clear(); gr = make(); m.set(key, gr); }
    return gr;
  }
  const tubeGrad = (g, T, q) => cached(g, T.id * 1000 + q, () => {
    const gr = g.createLinearGradient(0, -1, 0, 1);
    for (const [o, c] of tubeStops(T, q)) gr.addColorStop(o, c);
    return gr;
  });
  // a round part in its unit circle, lamp at angle q (of 192): two-point radial, lit spot toward the lamp
  const ballGrad = (g, T, q) => cached(g, 1e5 + T.id * 1000 + q, () => {
    const an = q / 192 * TAU, lx = Math.cos(an), ly = Math.sin(an);
    const gr = g.createRadialGradient(lx * .5, ly * .5, 0, lx * 1.2, ly * 1.2, 2.2);
    for (const t of [0, .05, .1, .16, .23, .31, .4, .5, .6, .7, .8, .9, 1]) {
      const u = Math.max(-1, .5 - 1.5 * t), c = Math.sqrt(1 - u * u);
      gr.addColorStop(t, css(lit(T, u * LXY + c * LZ, 0, Math.pow(Math.max(0, -u), 2))));
    }
    return gr;
  });
  // the lamp's direction in the picture plane, expressed in the current (rotated, squashed, maybe mirrored) frame
  function lampIn(g) {
    const m = typeof g.getTransform === 'function' ? g.getTransform() : null;
    let a = 1, b = 0, c = 0, d = 1;
    if (m && Number.isFinite(m.a) && Number.isFinite(m.d)) { a = m.a; b = m.b; c = m.c; d = m.d; }
    const det = a * d - b * c || 1, x = (d * LIT.x - c * LIT.y) / det, y = (-b * LIT.x + a * LIT.y) / det, n = Math.hypot(x, y) || 1;
    return [x / n, y / n];
  }
  // fill the current path as a slice of a tube: centre (x, y), unit normal (nx, ny) toward the +1 side, half width w
  function tubeFill(g, T, L, x, y, nx, ny, w) {
    const q = Math.round((clamp(nx * L[0] + ny * L[1], -1, 1) + 1) * 40);
    g.save(); g.transform(-ny, nx, nx * w, ny * w, x, y);
    g.fillStyle = tubeGrad(g, T, q); g.fill(); g.restore();
  }
  // fill the current path as a rounded part: an ellipsoid centred at (cx, cy) with radii rx, ry
  function ballFill(g, T, cx, cy, rx, ry, rot = 0) {
    g.save(); g.translate(cx, cy); if (rot) g.rotate(rot); g.scale(rx, ry);
    const L = lampIn(g), q = ((Math.round(Math.atan2(L[1], L[0]) / TAU * 192) % 192) + 192) % 192;
    g.fillStyle = ballGrad(g, T, q); g.fill(); g.restore();
  }
  // the lamp's reflection on a glossy rounded part: a hot core in a small bloom, where the half vector lands
  function glint(g, cx, cy, rx, ry, size, a) {
    g.save(); g.translate(cx, cy); g.scale(rx, ry);
    const L = lampIn(g), x = L[0] * HXY, y = L[1] * HXY, gr = g.createRadialGradient(x, y, 0, x, y, size);
    gr.addColorStop(0, `rgba(255,253,247,${a})`); gr.addColorStop(.34, `rgba(255,250,240,${a * .85})`);
    gr.addColorStop(.6, `rgba(255,246,232,${a * .18})`); gr.addColorStop(1, 'rgba(255,246,232,0)');
    g.fillStyle = gr; g.fillRect(x - size, y - size, size * 2, size * 2); g.restore();
  }
  // colour (diffuse and bounce, no specular) at s across a tube whose normal makes k with the lamp
  const TT = new Map();
  function tubeTone(T, k, s) {
    const ki = Math.round((clamp(k, -1, 1) + 1) * 50), si = Math.round((clamp(s, -1, 1) + 1) * 25), key = (T.id * 128 + ki) * 64 + si;
    let c = TT.get(key); if (c) return c;
    const kq = ki / 50 - 1, sq = si / 25 - 1, q = Math.sqrt(Math.max(0, 1 - sq * sq));
    c = css(lit(T, sq * kq * LXY + q * LZ, 0, Math.pow(Math.max(0, -sq * kq), 2)));
    TT.set(key, c); return c;
  }
  // fill a shape with a soft edge (blur radius r in local units): only its shadow is drawn, the shape itself is
  // thrown thousands of pixels aside, outside the clip; the shadow offset brings the blur back into place
  function soft(g, colour, r, build) {
    const m = typeof g.getTransform === 'function' ? g.getTransform() : null;
    let a = 1, b = 0, c = 0, d = 1;
    if (m && Number.isFinite(m.a) && Number.isFinite(m.d)) { a = m.a; b = m.b; c = m.c; d = m.d; }
    const det = a * d - b * c || 1, px = Math.sqrt(Math.abs(det)) || 1, F = 5000;
    g.save();
    g.translate(-F * d / det, F * b / det);
    g.shadowColor = colour; g.shadowBlur = r * px; g.shadowOffsetX = F; g.shadowOffsetY = 0;
    build(); g.fillStyle = '#000'; g.fill();
    g.restore();
  }
  // the lamp caught along the silhouette that faces it (wet skin is bright at grazing angles); stroke is clipped inside
  function rim(g, cx, cy, R) {
    const L = lampIn(g), gr = g.createLinearGradient(cx + L[0] * R, cy + L[1] * R, cx, cy);
    gr.addColorStop(0, 'rgba(255,244,236,.55)'); gr.addColorStop(.55, 'rgba(255,244,236,.12)'); gr.addColorStop(1, 'rgba(255,244,236,0)');
    g.lineWidth = 2.2; g.strokeStyle = gr; g.lineJoin = 'round'; g.stroke();
  }
  const CLR = {};
  const clear = c => CLR[c] || (CLR[c] = c.replace('rgb(', 'rgba(').replace(')', ',0)'));
  function edge(g, w = .9, c = 'rgba(62,12,34,.42)') { g.lineWidth = w; g.strokeStyle = c; g.lineJoin = 'round'; g.lineCap = 'round'; g.stroke(); }

  // ---------- parts ----------
  // a pair of limbs: short wet tubes (strokes stacked toward the lamp) ending in small splayed toes on a paddle
  function limbs(g, A, B, T, w, nf, L, fade) {
    const ox = L[0], oy = L[1], toes = [];
    for (const l of [A, B]) {
      const cu = l[9] * D, cc = Math.cos(cu), cs = Math.sin(cu);
      for (let k = 0; k < nf; k++) {
        const a = (l[6] + (k - (nf - 1) / 2) * l[7] * 3 / (nf - 1)) * D, x = Math.cos(a), y = Math.sin(a) * l[8];
        const dx = x * cc - y * cs, dy = x * cs + y * cc, r = w * .36 + (k && k < nf - 1 ? 5.4 : 4.4);
        toes.push(l[4] + dx * 2, l[5] + dy * 2, l[4] + dx * r, l[5] + dy * r);
      }
    }
    const toePath = d => {
      g.beginPath();
      for (let i = 0; i < toes.length; i += 4) { g.moveTo(toes[i] + ox * d, toes[i + 1] + oy * d); g.lineTo(toes[i + 2] + ox * d, toes[i + 3] + oy * d); }
    };
    const legPath = (l, d) => { g.beginPath(); g.moveTo(l[0] + ox * d, l[1] + oy * d); g.quadraticCurveTo(l[2] + ox * d, l[3] + oy * d, l[4] + ox * d, l[5] + oy * d); };
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (const l of [A, B]) {
      // near limbs fade in from the shoulder, so they grow out of the flank instead of sitting on it
      const fx = l[0] + (l[4] - l[0]) * .34, fy = l[1] + (l[5] - l[1]) * .34;
      const n = fade ? 7 : 5;                                       // tones stepping toward the lamp, then (near) the wet line
      for (let i = 0; i <= n; i++) {
        const f = i / (n - 1), spec = i === n;
        if (spec && !fade) break;
        const d = spec ? w * .27 : w * .24 * f, lw = spec ? w * .08 : w * (1 - .7 * f);
        const col = spec ? 'rgb(255,250,242)' : flat(T, -.74 + 1.34 * f);
        let st = col;
        if (fade) { st = g.createLinearGradient(l[0], l[1], fx, fy); st.addColorStop(0, clear(col)); st.addColorStop(1, spec ? 'rgba(255,250,242,.3)' : col); }
        legPath(l, d); g.lineWidth = lw; g.strokeStyle = st; g.stroke();
      }
    }
    toePath(0); g.lineWidth = 3.7; g.strokeStyle = flat(T, -.62); g.stroke();
    toePath(.45); g.lineWidth = 2; g.strokeStyle = flat(T, .1); g.stroke();
    // the paddle of the foot lies on the floor plane (a flattened disc), covering the toe roots
    for (const l of [A, B]) {
      const cu = l[9] * D, f = Math.max(.55, l[8]), pr = w * .36;
      g.beginPath(); g.ellipse(l[4], l[5], pr, pr * f, cu, 0, TAU);
      ballFill(g, T, l[4], l[5], pr, pr * f, cu); edge(g, .5, 'rgba(62,12,34,.28)');
    }
  }
  // one side's three feathery gill stalks, in head space; returns the top stalk's tip
  function gills(g, set, G, t, T, quill, nf, Tm, ph, L) {
    const S = [];
    for (let i = 0; i < 3; i++) {
      const r = set[i];
      let a = r[2];
      a += (-180 - a) * G.stream;
      a += (-212 - a) * G.droop;
      a = -150 + (a + 150) * (1 + G.fan);
      a = (a + G.amp * cyc(t, G.rate, -i * .13 - ph)) * D;
      const Ln = r[3] * (1 - .15 * G.droop), ca = Math.cos(a), sa = Math.sin(a);
      const tx = r[0] + ca * Ln, ty = r[1] + sa * Ln;
      const k = (.14 + G.curl + .07 * cyc(t, G.rate, -i * .13 - ph - .22)) * Ln;   // bow follows the swing late
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
        const a = at(sa), e = at(se), lo = sa < se ? a : e, hi = sa < se ? e : a, T2 = Tm * (1.1 - .3 * (sa + se)), h = core + T2 * 1.5;
        const cl = [lo[0] - lo[3] * h * .55 * side, lo[1] + lo[2] * h * .55 * side];
        const ch = [hi[0] - hi[3] * h * side + hi[2] * T2 * .6, hi[1] + hi[2] * h * side + hi[3] * T2 * .6];
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
      // the frond is a flattened tube along its chord: lit on the lamp side, deep crimson on the other
      let dx = tx - rx, dy = ty - ry; const dl = Math.hypot(dx, dy) || 1; dx /= dl; dy /= dl;
      tubeFill(g, T, L, (rx + 2 * cx + tx) / 4, (ry + 2 * cy + ty) / 4, -dy, dx, core + Tm * 1.4);
      edge(g, .75, 'rgba(74,4,26,.5)');
      if (!quill) continue;
      const q = .9, qp = at(q), quillPath = d => {
        g.beginPath(); g.moveTo(rx + L[0] * d, ry + L[1] * d);
        g.quadraticCurveTo(rx + (cx - rx) * q + L[0] * d, ry + (cy - ry) * q + L[1] * d, qp[0] + L[0] * d, qp[1] + L[1] * d);
      };
      g.lineCap = 'round';
      quillPath(0); g.lineWidth = 2.5; g.strokeStyle = flat(T_SKIN, -.3); g.stroke();
      quillPath(.45); g.lineWidth = 1.1; g.strokeStyle = flat(T_SKIN, .5); g.stroke();
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
  function bodyAndFin(g, P, L) {
    const sp = P.sp, th = P.th, N = [];
    for (let i = 0; i < 6; i++) {
      const a = sp[Math.max(0, i - 1)], b = sp[Math.min(5, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
      N.push([-dy / l, dx / l]);                                     // points to the back (up when standing)
    }
    const off = (i, d) => [sp[i][0] + N[i][0] * d, sp[i][1] + N[i][1] * d];
    const e = sp[5], q = sp[4], el = Math.hypot(e[0] - q[0], e[1] - q[1]) || 1;
    const finPath = () => {
      g.beginPath();
      loop(g, [off(1, th[1] + FIN_T[1]), off(2, th[2] + FIN_T[2]), off(3, th[3] + FIN_T[3]), off(4, th[4] + FIN_T[4]),
        off(5, th[5] + FIN_T[5]), [e[0] + (e[0] - q[0]) / el * 10, e[1] + (e[1] - q[1]) / el * 10],
        off(5, -th[5] - FIN_B[5]), off(4, -th[4] - FIN_B[4]), off(3, -th[3] - FIN_B[3]), sp[2]]);
    };
    const bodyPath = () => {
      g.beginPath();
      loop(g, [off(0, th[0]), off(1, th[1]), off(2, th[2]), off(3, th[3]), off(4, th[4]), sp[5],
        off(4, -th[4]), off(3, -th[3]), off(2, -th[2]), off(1, -th[1]), off(0, -th[0])]);
    };
    // fin: a thin membrane standing on the back and wrapping the tail; the lamp shines through its rim
    finPath();
    const fx = sp[3][0] - 10, fy = sp[3][1] - 4, R = 52, fg = g.createLinearGradient(fx + L[0] * R, fy + L[1] * R, fx - L[0] * R, fy - L[1] * R);
    fg.addColorStop(0, flat(T_FIN, .95)); fg.addColorStop(.45, flat(T_FIN, .35)); fg.addColorStop(1, flat(T_FIN, -.6));
    g.globalAlpha = .9; g.fillStyle = fg; g.fill(); g.globalAlpha = 1;
    g.save(); g.clip();
    g.lineWidth = 2.4; g.strokeStyle = 'rgba(255,247,244,.26)'; g.stroke();
    g.beginPath();
    for (const [r, s] of RAYS) {
      const i = Math.floor(r), f = r - i, j = Math.min(5, i + 1), lerp = (A, B) => A + (B - A) * f;
      const px = lerp(sp[i][0], sp[j][0]), py = lerp(sp[i][1], sp[j][1]), nx = lerp(N[i][0], N[j][0]) * s, ny = lerp(N[i][1], N[j][1]) * s;
      const t0 = lerp(th[i], th[j]), fin = s > 0 ? lerp(FIN_T[i], FIN_T[j]) : lerp(FIN_B[i], FIN_B[j]);
      g.moveTo(px + nx * t0, py + ny * t0); g.lineTo(px + nx * (t0 + fin), py + ny * (t0 + fin));
    }
    g.lineWidth = 1; g.strokeStyle = 'rgba(150,52,86,.2)'; g.stroke();
    bodyPath(); g.strokeStyle = 'rgba(72,10,36,.1)'; g.lineWidth = 5; g.stroke(); g.lineWidth = 2.5; g.stroke();   // the crease where the fin leaves the back
    g.restore();
    finPath(); edge(g, .8, 'rgba(110,34,62,.38)');
    // body: a tube swept along the spine. The turned-away tone first, then soft bands that follow the spine and
    // its taper: the half facing the lamp, the floor's warm bounce under the belly, the wet streak on the back
    const k = N.map(n => clamp(n[0] * L[0] + n[1] * L[1], -1, 1)), k2 = k[2], thR = th[2];
    const sc = k2 * LXY / Math.hypot(k2 * LXY, LZ);
    bodyPath(); g.fillStyle = tubeTone(T_SKIN, k2, sc - 1.6); g.fill();
    g.save(); g.clip();
    const band = (lo, hi) => {             // a strip between s = lo and s = hi, both measured from each station's lit line
      const A = [], B = [];
      for (let i = -1; i < 6; i++) {
        const j = Math.max(0, i), p = i < 0 ? [2 * sp[0][0] - sp[1][0], 2 * sp[0][1] - sp[1][1]] : sp[j], n = N[j], t = th[j];
        const kj = k[j], c = kj * LXY / Math.hypot(kj * LXY, LZ), h = kj * HXY / Math.hypot(kj * HXY, HZ);
        const s0 = lo[0] * c + lo[1] * h + lo[2], s1 = hi[0] * c + hi[1] * h + hi[2];
        A.push([p[0] + n[0] * t * s1, p[1] + n[1] * t * s1]); B.unshift([p[0] + n[0] * t * s0, p[1] + n[1] * t * s0]);
      }
      g.beginPath(); loop(g, A.concat(B));
    };
    soft(g, tubeTone(T_SKIN, k2, sc - .9), thR * .5, () => band([1, 0, -1.25], [1, 0, 1.4]));
    soft(g, tubeTone(T_SKIN, k2, sc), thR * .55, () => band([1, 0, -.6], [1, 0, 1.6]));
    soft(g, 'rgba(255,168,138,.4)', thR * .3, () => band([1, 0, -3.2], [1, 0, -1.72]));
    // costal grooves between the legs: shallow rings round the tube, a dark channel with its lamp-side wall lit
    const groove = (dx, dy) => {
      g.beginPath();
      for (let u = .7; u < 2.8; u += .26) {
        const i = Math.floor(u), f = u - i, lp = (a, b) => a + (b - a) * f, t = lp(th[i], th[i + 1]);
        let nx = lp(N[i][0], N[i + 1][0]), ny = lp(N[i][1], N[i + 1][1]); const nn = Math.hypot(nx, ny) || 1; nx /= nn; ny /= nn;
        const px = lp(sp[i][0], sp[i + 1][0]) + dx, py = lp(sp[i][1], sp[i + 1][1]) + dy, bx = ny * t * .1, by = -nx * t * .1;
        g.moveTo(px + nx * t * .42, py + ny * t * .42);
        g.quadraticCurveTo(px - nx * t * .15 + bx, py - ny * t * .15 + by, px - nx * t * .74, py - ny * t * .74);
      }
    };
    g.lineCap = 'round';
    groove(-N[2][1] * .7, N[2][0] * .7); g.lineWidth = .6; g.strokeStyle = 'rgba(255,230,236,.1)'; g.stroke();
    groove(0, 0); g.lineWidth = .85; g.strokeStyle = 'rgba(92,20,46,.16)'; g.stroke();
    soft(g, 'rgba(255,248,238,.16)', thR * .3, () => band([0, 1, -.32], [0, 1, .3]));
    soft(g, 'rgba(255,252,246,.7)', thR * .09, () => band([0, 1, -.07], [0, 1, .07]));
    bodyPath(); rim(g, sp[2][0], sp[2][1], 20);
    g.restore();
    bodyPath(); edge(g);
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
  function crease(g, m) {
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
  // the piece of a quadratic curve between t0 and t1, shifted down by dy, as the current path
  function qpart(g, P0, P1, P2, t0, t1, dy) {
    const L = (p, q, t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
    const B = t => L(L(P0, P1, t), L(P1, P2, t), t), a = B(t0), b = B(t1), c = L(L(P0, P1, t0), L(P1, P2, t0), t1);
    g.beginPath(); g.moveTo(a[0], a[1] + dy); g.quadraticCurveTo(c[0], c[1] + dy, b[0], b[1] + dy);
  }
  function mouth(g, m) {
    g.lineCap = 'round'; g.lineJoin = 'round';
    if (m === 'grin') {
      const lips = () => { g.beginPath(); g.moveTo(27, 3); g.quadraticCurveTo(12, 23, -4, 4); g.quadraticCurveTo(11, 10, 27, 3); };
      lips();
      const mg = g.createLinearGradient(0, 5, 0, 16); mg.addColorStop(0, '#2a0510'); mg.addColorStop(1, '#6e1a33');
      g.fillStyle = mg; g.fill();
      g.save(); g.clip();
      g.beginPath(); g.ellipse(11, 14, 8, 4, 0, 0, TAU);
      const tg = g.createRadialGradient(8.5, 12.2, .4, 11, 14.5, 8.5);
      tg.addColorStop(0, '#ffc2cf'); tg.addColorStop(.4, TONGUE); tg.addColorStop(1, '#8a2640');
      g.fillStyle = tg; g.fill();
      g.beginPath(); g.moveTo(27, 3); g.quadraticCurveTo(11, 10, -4, 4);                  // the upper lip shades the mouth
      g.lineWidth = 3.2; g.strokeStyle = 'rgba(18,2,8,.55)'; g.stroke();
      g.restore();
      lips(); edge(g, 1.1, 'rgba(56,8,24,.8)');
      qpart(g, [27, 3], [12, 23], [-4, 4], .2, .8, 1.4);                                   // the lower lip catches the lamp
      g.lineWidth = 1; g.strokeStyle = 'rgba(255,228,234,.36)'; g.stroke();
      g.beginPath(); g.moveTo(-4, 4); g.quadraticCurveTo(-7, 2.5, -6.5, -.5); edge(g, 1.3, 'rgba(70,12,32,.8)');
      return;
    }
    // a closed mouth is a groove: dark in its depth, the lip below it facing up into the light
    g.save(); g.translate(.2, 1.3); crease(g, m); g.lineWidth = 1; g.strokeStyle = 'rgba(255,230,236,.5)'; g.stroke(); g.restore();
    crease(g, m); g.lineWidth = 1.9; g.strokeStyle = 'rgba(82,14,38,.92)'; g.stroke();
  }
  // glossy water: clear, darker toward its rim, light gathered on the side away from the lamp, one hot reflection
  function water(g, r, path) {
    const gr = g.createRadialGradient(r * .35, r * .4, r * .05, 0, 0, r * 1.25);
    gr.addColorStop(0, 'rgba(238,250,255,.95)'); gr.addColorStop(.55, 'rgba(146,202,244,.82)'); gr.addColorStop(1, 'rgba(52,108,170,.9)');
    path(); g.fillStyle = gr; g.fill(); edge(g, .6, 'rgba(28,62,110,.55)');
    g.beginPath(); g.ellipse(-r * .34, -r * .38, r * .3, r * .22, -.6, 0, TAU); g.fillStyle = 'rgba(255,255,255,.95)'; g.fill();
  }
  function sweat(g, x, y, s) {
    g.save(); g.translate(x, y + s); g.scale(s, s);
    water(g, 3.2, () => { g.beginPath(); g.moveTo(0, -7); g.quadraticCurveTo(4, -1, 0, 2); g.quadraticCurveTo(-4, -1, 0, -7); });
    g.restore();
  }
  function drops(g, S, ph) {
    for (let k = 0; k < 2; k++) {
      const f = frac(ph + k * .5), r = 2.8 * Math.sin(Math.PI * f), x = S[4] - 26 * f, y = S[5] - 8 * f + 30 * f * f;
      if (r > .3) { g.save(); g.translate(x, y); water(g, r, () => { g.beginPath(); g.arc(0, 0, r, 0, TAU); }); g.restore(); }
    }
  }
  // an upper lid of skin over the eye, its edge along a line dep * r above the centre tilted by a; lays a thin shadow
  function lid(g, x, y, r, a, dep) {
    const R = r * 1.13, e = -dep * r;
    g.save(); g.beginPath(); g.ellipse(x, y, R, R * 1.08, 0, 0, TAU); g.clip();
    g.translate(x, y); g.rotate(a);
    g.beginPath(); g.rect(-R * 1.6, -R * 2.2, R * 3.2, R * 2.2 + e);
    const lg = g.createLinearGradient(0, -R, 0, e); lg.addColorStop(0, flat(T_SKIN, .75)); lg.addColorStop(1, flat(T_SKIN, -.2));
    g.fillStyle = lg; g.fill();
    g.beginPath(); g.moveTo(-R * 1.6, e + 1); g.lineTo(R * 1.6, e + 1); g.lineWidth = 1.4; g.strokeStyle = 'rgba(20,6,12,.2)'; g.stroke();
    g.beginPath(); g.moveTo(-R * 1.6, e); g.lineTo(R * 1.6, e); g.lineWidth = 1.2; g.strokeStyle = 'rgba(66,10,32,.88)'; g.stroke();
    g.restore();
  }
  const EYES = [[19, -15, 3.3], [8, -7, 4.4]];
  function face(g, F, t) {
    // painted on the skin (clipped to the head): a warm flush in the cheek, the mouth, the eye sockets' shade
    g.save(); headPath(g); g.clip();
    g.save(); g.translate(3, 1.5); g.scale(1, .62);
    const bg = g.createRadialGradient(0, 0, 0, 0, 0, 7); bg.addColorStop(0, 'rgba(232,64,92,.36)'); bg.addColorStop(1, 'rgba(232,64,92,0)');
    g.fillStyle = bg; g.fillRect(-7, -7, 14, 14); g.restore();
    mouth(g, F.mouth);
    for (const [x, y, r] of EYES) ao(g, x + .9, y + 1.5, r * 1.75, r * 1.45, .3);
    g.restore();
    const eo = { t, look: F.look, lookX: F.lookX, wide: F.wide, shut: F.shut };
    for (const [x, y, r] of EYES) eye3d(g, x, y, r, eo);
    const blink = F.shut || (t % 3.7) < .12;                          // eye3d's own blink clock
    if (F.half && !blink) { lid(g, 19, -15, 3.3, .3, 0); lid(g, 8, -7, 4.4, -.3, 0); }   // heavy lids, drooping outward
    if (F.brow) {                                                     // determined: lids lowered toward each other
      if (!blink) { lid(g, 19, -15, 3.3, -.34, .36); lid(g, 8, -7, 4.4, .38, .38); }
      const furrow = () => { g.beginPath(); g.moveTo(1.5, -16.2); g.quadraticCurveTo(7, -15.8, 12, -13.4); };
      g.lineCap = 'round';
      g.save(); g.translate(.2, 1.1); furrow(); g.lineWidth = .9; g.strokeStyle = 'rgba(255,230,236,.45)'; g.stroke(); g.restore();
      furrow(); g.lineWidth = 1.6; g.strokeStyle = 'rgba(80,14,38,.75)'; g.stroke();
    }
    if (F.sweat) sweat(g, -6, -25 + 1.2 * cyc(t, .8), .9);
  }
  // head: a flattened ellipsoid of wet skin, the gloss coat over the painted face
  const HC = [2.5, -2], HR = [30, 19.5];
  function head(g, F, t) {
    headPath(g); ballFill(g, T_SKIN, HC[0], HC[1], HR[0], HR[1]);
    face(g, F, t);
    headPath(g); g.save(); g.clip();
    glint(g, HC[0], HC[1], HR[0], HR[1], .5, .16);
    glint(g, HC[0], HC[1], HR[0], HR[1], .17, .92);
    headPath(g); rim(g, HC[0], HC[1], 30);
    g.restore();
    headPath(g); edge(g);
  }
  // racing bib: a pressed tin tag standing a hair off the skin, bent round the flank, printed number, bright edge
  function bib3d(g, x, y, b, w, h, a) {
    if (!b) return;
    g.save(); g.translate(x, y); g.rotate(a);
    const L = lampIn(g);
    const tag = (dx, dy, gr = 0) => {
      g.beginPath();
      if (g.roundRect) g.roundRect(-w / 2 + dx - gr, -h / 2 + dy - gr, w + gr * 2, h + gr * 2, 3 + gr); else g.rect(-w / 2 + dx - gr, -h / 2 + dy - gr, w + gr * 2, h + gr * 2);
    };
    tag(-L[0] * 1.7, -L[1] * 1.7, 1); g.fillStyle = 'rgba(70,10,34,.16)'; g.fill();
    tag(-L[0] * 1.1, -L[1] * 1.1); g.fillStyle = 'rgba(70,10,34,.24)'; g.fill();
    tag(0, 0); g.fillStyle = b.bg; g.fill();
    g.save(); g.clip();
    g.fillStyle = b.fg; g.font = `${h * .8}px "Alfa Slab One", Rockwell, serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(String(b.n), 0, h * .06);
    const sg = g.createLinearGradient(0, -h / 2, 0, h / 2);
    sg.addColorStop(0, 'rgba(255,247,230,.34)'); sg.addColorStop(.28, 'rgba(255,247,230,.05)'); sg.addColorStop(.5, 'rgba(24,6,16,0)'); sg.addColorStop(1, 'rgba(24,6,16,.42)');
    g.fillStyle = sg; g.fillRect(-w / 2, -h / 2, w, h);
    g.restore();
    tag(0, 0);
    const eg = g.createLinearGradient(L[0] * w * .5, L[1] * h * .5, -L[0] * w * .5, -L[1] * h * .5);
    eg.addColorStop(0, 'rgba(255,250,238,.85)'); eg.addColorStop(.5, 'rgba(120,96,90,.3)'); eg.addColorStop(1, 'rgba(24,8,16,.7)');
    g.lineWidth = .9; g.strokeStyle = eg; g.stroke();
    g.restore();
  }
  // pose frame -> the unrotated frame at the feet (for things on the floor)
  function outer(P, x, y) {
    const c = Math.cos(P.rot), s = Math.sin(P.rot), dx = (x - P.px) * P.sx, dy = (y - P.py) * P.sy;
    return [P.px + P.x + dx * c - dy * s, P.py + P.y + dx * s + dy * c];
  }

  function render(g, P, t, bibSpec) {
    if (P.shadow) {
      g.save(); g.translate(-8, 0); cast(g, P.shadow, P.lift); g.restore();
      for (let i = 0; i < 4; i++) {                                 // each planted foot presses a contact into the floor
        const l = P.legs[i], f = outer(P, l[4], l[5]), h = Math.max(0, -f[1]);
        if (h < 7) ao(g, f[0] + 1.5, .4, i & 2 ? 7.5 : 6, 1.8, .36 * (1 - h / 7));
      }
      for (let i = 3; i < 6; i++) {                                 // the tail (and its lower fin) where it drags low
        const f = outer(P, P.sp[i][0], P.sp[i][1] + P.th[i] + FIN_B[i] * .7), h = Math.max(0, -f[1]);
        if (h < 6) ao(g, f[0] + 1, .4, 11, 2, .3 * (1 - h / 6));
      }
    } else if (P.ride) ao(g, -3, .5, 27, 3.4, .42);                  // belly pressed on the hub
    g.save();
    g.translate(P.px + P.x, P.py + P.y);
    if (P.rot) g.rotate(P.rot);
    g.scale(P.sx, P.sy);
    g.translate(-P.px, -P.py);
    const L = lampIn(g), Lg = P.legs, gt = P.gt == null ? t : P.gt;
    limbs(g, Lg[0], Lg[1], T_FAR, 9.4, 3, L, false);
    for (const l of [Lg[0], Lg[1]]) ao(g, l[0] + 1, l[1] + 5, 9, 6, .42);      // tucked under the belly, in its shadow
    // head frame: pivot at the neck, head centre 18 units ahead
    const hp = P.hp || [P.sp[0][0] + 4, P.sp[0][1] - 6], ca = Math.cos(P.ha), sa = Math.sin(P.ha);
    const hx = hp[0] + 18 * ca + 4 * sa, hy = hp[1] + 18 * sa - 4 * ca;
    g.save(); g.translate(hx, hy); g.rotate(P.ha);
    const LH = lampIn(g);
    gills(g, GILLS_FAR, P.G, gt, T_GILLF, false, 3, 5.4, .3, LH);
    g.restore();
    bodyAndFin(g, P, L);
    g.save(); g.translate(hx, hy); g.rotate(P.ha);
    ao(g, -3, 15.5, 22, 7, .36);                                     // the broad head shades the throat and chest
    g.restore();
    if (bibSpec) bib3d(g, P.bibAt[0], P.bibAt[1], bibSpec, 22, 17, P.bibAt[2]);
    g.save(); g.translate(hx, hy); g.rotate(P.ha);
    const top = gills(g, GILLS_NEAR, P.G, gt, T_GILL, true, 4, 6.4, 0, LH);
    if (P.drops >= 0) drops(g, top, P.drops);
    ao(g, -21, -1, 9, 15, .42);                                      // where the fronds go in behind the head
    head(g, P.F, t);
    g.restore();
    for (const l of [Lg[2], Lg[3]]) ao(g, l[0] + 1.5, l[1] + 3, 9.5, 6.5, .3);   // limb roots press into the flank
    limbs(g, Lg[2], Lg[3], T_SKIN, 10.5, 4, L, true);
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
