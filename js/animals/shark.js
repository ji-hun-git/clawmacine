// Great hammerhead shark. A fish racing on land: it flop-hops, curling into a C and snapping straight
// so the tail slaps the ground and launches it. Deadpan and dead serious, with swim goggles pushed up on
// the middle of its hammer (they could never reach its eyes, which sit out on the two tips).
// Made as a glossy enamel figure under the one lamp: the body is lit as a tube, section by section along
// its bending spine; fins are cambered plates whose lamp-side edges catch the light; no ink outlines.
(() => {
  const { C, TAU, cyc, ease, LIGHT, mix, shade, tint, ao, cast, eye3d } = AKIT;

  // bronze-grey back over a white belly (countershading), in enamel
  const BACK = '#8b8571', BACK_DK = '#5f5a4c', BELLY = '#fbf7ec';
  const LENS = '#1f97ad', LENS_DK = '#115b6b', STRAP = C.TOMATO;
  const CONTOUR = 'rgba(20,15,20,.55)';

  // spine: N + 1 samples from the head (s = 0, where the hammer sits) to the tail stock (s = 1)
  const N = 8, L = 80, IA = 3, SA = IA / N;
  const TOP = [11.5, 16, 18.5, 18.5, 17, 14, 10.5, 7, 4.5];     // back above the spine
  const BOT = [10, 13.5, 15, 15, 13.5, 11.5, 9, 6, 4];          // belly below it
  const SEAM = [3, 3.5, 4, 4, 3.5, 3, 2, 1.2, .6];              // where the bronze meets the white
  const HF = 21, HN = 22, HT = -.06;                            // hammer half-spans (far, near tip) and lean
  const FR = Math.hypot(5, 27), FD = Math.atan2(27, -5);        // pectoral fin reach and rest direction
  const PX = [], PY = [], TH = [], QX = [], QY = [];
  const P = {}, F = {};                                         // pose and face, reused every frame
  let X = 0, Y = 0, A = 0;

  // ---------- light: the lamp's direction in whatever frame is current, and cached gradients ----------
  const LXY = Math.hypot(LIGHT.x, LIGHT.y), LZ = LIGHT.z, LA = Math.atan2(LIGHT.y, LIGHT.x);
  const HL = Math.hypot(LIGHT.x, LIGHT.y, LIGHT.z + 1), HXY = LXY / HL, HZ = (LIGHT.z + 1) / HL;   // half vector
  let LAB = LA, LUX = Math.cos(LA), LUY = Math.sin(LA);        // lamp in the body frame (set once per draw)
  let PUX = LUX, PUY = LUY;                                      // lamp in the frame of the part being painted
  function lamp(g) {
    const m = g.getTransform && g.getTransform();
    if (!m || typeof m.a !== 'number') return LA;
    const det = m.a * m.d - m.b * m.c;
    if (!det) return LA;
    return Math.atan2((-m.b * LIGHT.x + m.a * LIGHT.y) / det, (m.d * LIGHT.x - m.c * LIGHT.y) / det);
  }
  // gradients are made once per context in a unit frame and placed with the transform
  const GC = new WeakMap();
  function cached(g, key) { let c = GC.get(g); if (!c) { c = new Map(); GC.set(g, c); } return [c, c.get(key)]; }
  function linear(g, key, stops, x0 = -1, y0 = 0, x1 = 1, y1 = 0) {
    const [c, hit] = cached(g, key); if (hit) return hit;
    const gr = g.createLinearGradient(x0, y0, x1, y1); for (const s of stops) gr.addColorStop(s[0], s[1]);
    c.set(key, gr); return gr;
  }
  function radial(g, key, stops, fx = 0, fy = 0) {
    const [c, hit] = cached(g, key); if (hit) return hit;
    const gr = g.createRadialGradient(fx, fy, 0, 0, 0, 1); for (const s of stops) gr.addColorStop(s[0], s[1]);
    c.set(key, gr); return gr;
  }
  // transform-only save/restore: restore() re-applies any active clip, which is what makes it expensive
  // (setTransform is given six numbers: handing it the DOMMatrix itself takes Chrome's slow path)
  function pushT(g) {
    const m = g.getTransform && g.getTransform();
    if (m && typeof m.a === 'number') return [m.a, m.b, m.c, m.d, m.e, m.f];
    g.save(); return null;
  }
  function popT(g, m) { if (m) g.setTransform(m[0], m[1], m[2], m[3], m[4], m[5]); else g.restore(); }
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

  // The body in cross-section: a glossy enamel tube, bronze over white. For a section whose back faces
  // angle d away from the lamp, one opaque gradient from the back edge (0) to the belly edge (1): warm lamp
  // light, cool room light past the terminator, and the warm bounce off the ground under the belly. The
  // countershading line rides at the same place in it. (The blade of the hammer, kind 1, also carries the
  // clear coat's streak; the body's streak is a stroke of its own, see streak().)
  const NB = 144, TUBE = [[], []], TS = .655;
  const LAMPC = [1, .94, .83], ROOM = [.6, .63, .7], BOUNCE = [1, .62, .38];
  const rgb = c => { const n = parseInt(c.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  const ALB_B = rgb(BACK), ALB_W = rgb(BELLY);
  function tone(alb, w, Lu, Hu, hm, spk = 1) {
    const c = -w, s = Math.sqrt(Math.max(0, 1 - w * w));
    const d = Math.max(0, (c * Lu + s * LZ + .22) / 1.22), h = Math.max(0, c * Hu + s * HZ) / hm;
    // the streak stays a streak as the body turns; it only dims a little as it turns off the lamp
    const b = w > .35 ? .36 * ((w - .35) / .65) ** 2 : 0, sp = 255 * (.46 * spk * h ** 130 * hm ** 14 + .07 * h ** 6);
    let o = 'rgb(';
    for (let i = 0; i < 3; i++) o += Math.min(255, alb[i] * (.54 * ROOM[i] + .88 * d * LAMPC[i] + b * BOUNCE[i]) + sp * LAMPC[i]) | 0, o += i < 2 ? ',' : ')';
    return o;
  }
  // kind 0: the countershaded body; kind 1: bronze all round (the hammer's blade). Stops are few (every stop
  // costs raster time on every fill): an even spread, the countershading line softened by a hair, and for
  // the blade a tight cluster on its streak.
  function tubeStops(b, kind) {
    const cd = Math.cos(b / NB * TAU), Lu = LXY * cd, Hu = HXY * cd, hm = Math.hypot(Hu, HZ), e = .01, tp = (1 - Hu / hm) / 2, out = [];
    const ts = kind ? [0, .08, .17, .26, .36, .48, .62, .78, 1] : [0, .1, .22, .35, .5, TS - e, TS + e, .78, .9, 1];
    if (kind) for (const d of [-.05, -.026, -.01, 0, .01, .026, .05]) ts.push(tp + d);
    ts.sort((a, c) => a - c);
    let last = -1;
    for (const t of ts) {
      if (t < 0 || t > 1 || t - last < .004 || (!kind && t > TS - e && t < TS + e)) continue;
      out.push([t, tone(kind || t < TS ? ALB_B : ALB_W, 2 * t - 1, Lu, Hu, hm, kind)]); last = t;
    }
    return out;
  }
  function tubeGrad(g, rel, kind = 0) {
    let b = Math.round(rel / TAU * NB) % NB; if (b < 0) b += NB;
    const T = TUBE[kind];
    return linear(g, 'tube' + kind + '.' + b, T[b] || (T[b] = tubeStops(b, kind)), 0, -1, 0, 1);
  }

  // A fin's face is a gently cambered plate: it takes the same light as the body over a narrower arc of the
  // tube, with the broad sheen but not the streak. Radial, from its lamp side (0) out to its far side (1);
  // the glossy variant carries a soft sheen at its heart.
  const ALB_F = rgb(BACK_DK);
  function plate(alb, wl, wd, gl) {
    const o = [];
    for (const t of [0, .08, .17, .3, .45, .62, .8, 1]) {
      const c = tone(alb, wl + (wd - wl) * t, LXY, HXY, 1, 0);
      o.push([t, gl ? mix(c, '#fff8ea', gl * Math.exp(-((t / .2) ** 2))) : c]);
    }
    return o;
  }
  const edge = a => [[0, 'rgba(255,244,226,0)'], [.5, 'rgba(255,244,226,0)'], [1, `rgba(255,244,226,${a})`]];
  const PAL_BACK = { k: 'pb', st: plate(ALB_B, -.95, .75, 0), gl: plate(ALB_B, -.95, .75, .42), edge: edge(.6) };
  const PAL_LOW = { k: 'pl', st: plate(ALB_B, -.5, .9, 0), gl: plate(ALB_B, -.5, .9, .3), edge: edge(.4) };
  const PAL_FAR = { k: 'pf', st: plate(ALB_F, -.7, .85, 0), gl: plate(ALB_F, -.7, .85, .12), edge: edge(.26) };
  const BEAD = [[0, 'rgba(236,248,255,.92)'], [.5, 'rgba(160,212,244,.55)'], [.82, 'rgba(78,140,196,.7)'], [1, 'rgba(34,76,118,.9)']];
  const CAPS = [[0, 'rgba(255,244,226,.26)'], [.1, 'rgba(255,244,226,0)'], [.8, 'rgba(18,12,24,0)'], [1, 'rgba(18,12,24,.42)']];
  const FACEX = [[0, 'rgba(255,240,218,0)'], [.07, 'rgba(255,240,218,0)'], [.11, 'rgba(255,240,218,.32)'], [.19, 'rgba(255,240,218,.28)'],
    [.22, 'rgba(26,20,24,0)'], [.3, 'rgba(26,20,24,.3)'], [1, 'rgba(26,20,24,.36)']];
  const SOCK = [[0, 'rgba(14,8,12,.36)'], [.55, 'rgba(14,8,12,.16)'], [1, 'rgba(14,8,12,0)']];
  const LIDG = [[0, tint(BACK, .32)], [.45, BACK], [1, shade(BACK, .5)]];
  const RIM = [[0, '#101417'], [.5, '#262d32'], [.85, '#4d585f'], [1, '#76828a']];
  const GLASS = [[0, tint(LENS, .38)], [.45, LENS], [.8, LENS_DK], [1, '#06242b']];
  const STRAP_DK = shade(STRAP, .5), STRAP_HI = tint(STRAP, .5), BROW_HI = tint(BACK, .35);
  const MAW = [[0, '#6a2a33'], [.55, '#3b1d22'], [1, '#120709']];
  const IVORY = [[0, '#fffaf0'], [.6, '#efe6d2'], [1, '#b8ab94']];
  const HAME = edge(.42), BODYE = edge(.5), TAGE = edge(.7), TAGC = new Map(), TAGSH = [[0, 'rgba(255,246,230,.16)'], [.35, 'rgba(255,246,230,0)'], [.5, 'rgba(22,16,30,0)'], [1, 'rgba(22,16,30,.3)']];

  // Paint a part (path(g) builds it in the current frame) as a cambered enamel plate centred at (cx, cy),
  // radius R: a faint dark contour, one radial fill turning from the lamp with its sheen toward it, and
  // the lamp-side edges catching the light. One path, no clip: this runs for every fin, every frame.
  function part(g, path, pal, cx, cy, R, gloss, lit = true) {
    const la = lamp(g), ux = Math.cos(la), uy = Math.sin(la); PUX = ux; PUY = uy;
    // the contour goes on first at twice its width, so the fill leaves only its outer half
    path(g); g.lineWidth = 1.6; g.strokeStyle = CONTOUR; g.lineJoin = 'round'; g.stroke();
    let m = pushT(g); g.translate(cx + ux * R * .45, cy + uy * R * .45); g.scale(R * 1.45, R * 1.45);
    g.fillStyle = gloss > .2 ? radial(g, pal.k + 'g', pal.gl) : radial(g, pal.k, pal.st); g.fill(); popT(g, m);
    if (!lit) return;
    m = pushT(g); g.translate(cx, cy); g.rotate(la); g.scale(R, R);
    g.lineWidth = .9 / R; g.strokeStyle = linear(g, pal.k + 'e', pal.edge); g.stroke(); popT(g, m);
  }
  // a moulded crease: a groove in shadow with its lamp-side lip lit
  // (a fin's ray is only the lit lip: one stroke)
  function crease(g, path, a = .34) {
    g.lineCap = 'round';
    if (a >= .4) { path(g); g.lineWidth = 1.1; g.strokeStyle = `rgba(28,16,22,${a})`; g.stroke(); }
    const m = pushT(g); g.translate(PUX * .85, PUY * .85); path(g); g.lineWidth = .75; g.strokeStyle = `rgba(255,244,228,${(a * .9).toFixed(2)})`; g.stroke(); popT(g, m);
  }

  // keyframed channels (p, value, p, value ...), eased between keys, first value = last value
  function key(p, K) {
    for (let i = 2; i < K.length; i += 2) if (p <= K[i]) {
      const u = (p - K[i - 2]) / (K[i] - K[i - 2]);
      return K[i - 1] + (K[i + 1] - K[i - 1]) * ease(u);
    }
    return K[K.length - 1];
  }
  const frac = x => x - Math.floor(x);
  // run phase per racer (keyed by bib), integrated so a change of speed never makes the gait jump
  const PH = {};
  function runPhase(o, t, rate) {
    const id = o.bib ? String(o.bib.n) : '-', s = PH[id];
    if (!s || t < s.t || t - s.t > .5) { PH[id] = { t, p: t * rate }; return frac(t * rate); }
    s.p = frac(s.p + (t - s.t) * rate); s.t = t;
    return s.p;
  }
  // run: coil into a C (0-.25), snap straight so the tail slaps (.25-.41), hop (.39-.87), land and squash
  const R_C = [0, .15, .25, 1.05, .41, -.3, .54, -.12, .75, .02, .88, .12, 1, .15];
  const R_TL = [0, .1, .25, .45, .41, -.45, .52, -.2, .64, .12, .88, 0, 1, .1];
  const R_H = [0, -.4, .25, -.52, .41, -.25, .62, -.34, .88, -.3, 1, -.4];
  const R_PHI = [0, 0, .28, 0, .44, -.14, .64, -.05, .85, .07, .92, 0, 1, 0];
  const R_SY = [0, .97, .25, .9, .4, 1.12, .54, 1.03, .84, 1, .9, .84, 1, .97];
  const R_CAU = [0, -.05, .27, -.3, .41, .35, .52, -.35, .64, .15, .8, -.06, 1, -.05];
  const R_DOR = [0, .04, .3, .1, .46, -.22, .64, .04, .86, -.02, .95, .16, 1, .04];
  const R_HAM = [0, 0, .41, -.06, .5, .07, .88, 0, .94, .08, 1, 0];
  const R_DX = [0, -1, .3, -3, .6, 1.5, .88, 3, 1, -1];
  // cheer: crouch, breach straight up with the nose high and the fins flung up, land
  const K_C = [0, .1, .2, .55, .35, -.35, .55, -.25, .8, .05, .88, .2, 1, .1];
  const K_PHI = [0, 0, .2, .05, .36, -.42, .56, -.32, .78, .1, .88, 0, 1, 0];
  const K_TL = [0, .1, .2, .4, .35, -.3, .47, .2, .6, -.1, .78, .25, 1, .1];
  const K_H = [0, -.4, .32, -.55, .6, -.45, .88, -.35, 1, -.4];
  const K_SY = [0, .97, .2, .88, .34, 1.1, .5, 1.02, .82, 1, .88, .86, 1, .97];
  const K_PEC = [0, -.4, .2, .2, .38, -2.7, .7, -2.7, .86, -.6, 1, -.4];
  // water droplets thrown off the tail (velocity per unit of their life, size)
  const DVX = [-34, -20, -46, -10], DVY = [-40, -54, -26, -34], DR = [2.7, 2.1, 1.9, 2.4];

  function spine() {
    for (let i = 0; i <= N; i++) {
      const s = i / N;
      let th = P.phi + P.c * (s - SA);
      if (s < P.hs) th += P.h * Math.pow((P.hs - s) / P.hs, 1.4);
      if (s > .45) th += P.tl * Math.pow((s - .45) / .55, 1.4);
      TH[i] = th;
    }
    const ds = L / N;
    PX[IA] = 0; PY[IA] = 0;
    for (let i = IA - 1; i >= 0; i--) { const a = (TH[i] + TH[i + 1]) / 2; PX[i] = PX[i + 1] + Math.cos(a) * ds; PY[i] = PY[i + 1] + Math.sin(a) * ds; }
    for (let i = IA + 1; i <= N; i++) { const a = (TH[i] + TH[i - 1]) / 2; PX[i] = PX[i - 1] - Math.cos(a) * ds; PY[i] = PY[i - 1] - Math.sin(a) * ds; }
  }
  // point on the body at s (0 head .. 1 tail stock), v below the spine (negative = toward the back)
  function pt(s, v) {
    const f = Math.min(N - 1e-6, Math.max(0, s * N)), i = Math.floor(f), k = f - i;
    A = TH[i] + (TH[i + 1] - TH[i]) * k;
    X = PX[i] + (PX[i + 1] - PX[i]) * k - Math.sin(A) * v;
    Y = PY[i] + (PY[i + 1] - PY[i]) * k + Math.cos(A) * v;
  }
  // enter a local frame at (s, v): +x toward the head, +y toward the belly
  function at(g, s, v, rot = 0) { pt(s, v); g.save(); g.translate(X, Y); g.rotate(A + rot); }
  function prof(arr, s) { const f = Math.min(N - 1e-6, Math.max(0, s * N)), i = Math.floor(f); return arr[i] + (arr[i + 1] - arr[i]) * (f - i); }
  // lowest point of the belly, the hammer tips and the lower tail lobe (what touches the ground)
  function lowest() {
    let m = -1e9;
    for (let i = 0; i <= N; i++) m = Math.max(m, PY[i] + Math.cos(TH[i]) * BOT[i]);
    const r = TH[0] * P.hk + HT + P.ham;
    m = Math.max(m, PY[0] + 3 * Math.sin(r) + (HN + 3.5) * Math.cos(r), PY[0] + 3 * Math.sin(r) - (HF + 3.5) * Math.cos(r));
    const c = TH[N] + P.cau;
    return Math.max(m, PY[N] - 22 * Math.sin(c) + 16.5 * Math.cos(c));
  }
  // a pectoral fin never digs into the ground: pressed against it, it foreshortens along its length
  function planted(s, v, a, k, ground) {
    pt(s, v);
    const drop = FR * k * Math.sin(A + a + FD), room = ground - 1 - Y;
    return drop <= room || drop <= 0 ? 1 : Math.max(.3, room / drop);
  }

  // ---------- the body ----------
  function outline() {
    // back from tail to head, round the snout, belly from head to tail, round the stock
    let n = 0;
    for (let i = N; i >= 0; i--) { QX[n] = PX[i] + Math.sin(TH[i]) * TOP[i]; QY[n++] = PY[i] - Math.cos(TH[i]) * TOP[i]; }
    QX[n] = PX[0] + Math.cos(TH[0]) * 7; QY[n++] = PY[0] + Math.sin(TH[0]) * 7;
    for (let i = 0; i <= N; i++) { QX[n] = PX[i] - Math.sin(TH[i]) * BOT[i]; QY[n++] = PY[i] + Math.cos(TH[i]) * BOT[i]; }
    QX[n] = PX[N] - Math.cos(TH[N]) * 2.5; QY[n++] = PY[N] - Math.sin(TH[N]) * 2.5;
    QX.length = n;
  }
  function bodyPath(g) {
    const n = QX.length;
    g.beginPath(); g.moveTo((QX[n - 1] + QX[0]) / 2, (QY[n - 1] + QY[0]) / 2);
    for (let k = 0; k < n; k++) { const j = (k + 1) % n; g.quadraticCurveTo(QX[k], QY[k], (QX[k] + QX[j]) / 2, (QY[k] + QY[j]) / 2); }
    g.closePath();
  }
  // five gill slits, breathing
  function gillPath(g) {
    g.beginPath();
    for (let i = 0; i < 5; i++) {
      const s = .095 + i * .024;
      pt(s, -7.5 + i * .4); g.moveTo(X, Y);
      pt(s - .018 - .012 * F.gill, -2.5); const cx = X, cy = Y;
      pt(s - .004, 2 - i * .3); g.quadraticCurveTo(cx, cy, X, Y);
    }
  }
  // The body, painted as tube regions that end exactly on its outline, so nothing has to be clipped (a clip
  // made every fill inside it cost several times more). The outline is a quadratic spline through the
  // midpoints of its control points; cut at those midpoints (half way between spine samples), each section
  // holds exactly one curve piece along the back and one along the belly. Above the countershading line a
  // section is two triangles, each getting the tube gradient placed by the exact affine map that hits the
  // right place in the tube at its three corners, so the shading runs on without a seam; below it, where
  // the tube changes slowly, one band does.
  const YS = 2 * TS - 1, SX = [], SY = [], MTX = [], MTY = [], MBX = [], MBY = [];
  let GROW = .5, BASE = null, RX = 0, RY = 0, GX = 0, GY = 0;
  function grow(x, y) {      // a pixel out from the region's middle: neighbours overlap, no hairline seams
    const d = Math.hypot(x - RX, y - RY) || 1; GX = x + (x - RX) * GROW / d; GY = y + (y - RY) * GROW / d;
  }
  function plane(g, x1, y1, v1, x2, y2, v2, x3, y3, v3) {
    const ax = x2 - x1, ay = y2 - y1, bx = x3 - x1, by = y3 - y1, det = ax * by - ay * bx;
    if (Math.abs(det) < 1e-6) return false;
    const al = ((v2 - v1) * by - (v3 - v1) * ay) / det, be = ((v3 - v1) * ax - (v2 - v1) * bx) / det, q = al * al + be * be;
    if (q < 1e-9) return false;
    const nx = al / q, ny = be / q;
    if (!BASE) g.save();
    g.transform(-ny, nx, nx, ny, x1 - v1 * nx, y1 - v1 * ny);
    return true;
  }
  function unplane(g) { if (BASE) g.setTransform(BASE[0], BASE[1], BASE[2], BASE[3], BASE[4], BASE[5]); else g.restore(); }
  // a triangle 1-2-3 of the tube; with a control point, its side from 2 to 3 is the outline's own curve
  function region(g, x1, y1, v1, x2, y2, v2, x3, y3, v3, cx, cy) {
    RX = (x1 + x2 + x3) / 3; RY = (y1 + y2 + y3) / 3;
    g.beginPath(); grow(x1, y1); g.moveTo(GX, GY); grow(x2, y2); g.lineTo(GX, GY);
    if (cx === undefined) { grow(x3, y3); g.lineTo(GX, GY); }
    else { grow(cx, cy); const qx = GX, qy = GY; grow(x3, y3); g.quadraticCurveTo(qx, qy, GX, GY); }
    if (plane(g, x1, y1, v1, x2, y2, v2, x3, y3, v3)) { g.fill(); unplane(g); }
  }
  // one band of a section: from the countershading line (1, 2) out to the outline (3, curve, 4); its plane is
  // exact along the line and at the middle of the outline's chord, so the line itself never steps
  function band(g, x1, y1, x2, y2, x3, y3, cx, cy, x4, y4, vo) {
    RX = (x1 + x2 + x3 + x4) / 4; RY = (y1 + y2 + y3 + y4) / 4;
    g.beginPath(); grow(x1, y1); g.moveTo(GX, GY); grow(x2, y2); g.lineTo(GX, GY); grow(x3, y3); g.lineTo(GX, GY);
    grow(cx, cy); const qx = GX, qy = GY; grow(x4, y4); g.quadraticCurveTo(qx, qy, GX, GY);
    if (plane(g, x1, y1, YS, x2, y2, YS, (x3 + x4) / 2, (y3 + y4) / 2, vo)) { g.fill(); unplane(g); }
  }
  function tube(g) {
    const m = g.getTransform && g.getTransform(), ok = m && typeof m.a === 'number', sc = ok ? Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)) : 1;
    GROW = Math.max(.3, .9 / (sc || 1)); BASE = ok ? [m.a, m.b, m.c, m.d, m.e, m.f] : null;
    // outline control points: back of sample i = QX[N - i], snout = QX[N + 1], belly of sample i = QX[N + 2 + i], stock = QX[2N + 3]
    for (let i = 0; i < N; i++) {
      const a = (TH[i] + TH[i + 1]) / 2, tp = (TOP[i] + TOP[i + 1]) / 2, bt = (BOT[i] + BOT[i + 1]) / 2, ys = TS * (tp + bt) - tp;
      SX[i] = (PX[i] + PX[i + 1]) / 2 - Math.sin(a) * ys; SY[i] = (PY[i] + PY[i + 1]) / 2 + Math.cos(a) * ys;
      MTX[i] = (QX[N - i] + QX[N - i - 1]) / 2; MTY[i] = (QY[N - i] + QY[N - i - 1]) / 2;
      MBX[i] = (QX[N + 2 + i] + QX[N + 3 + i]) / 2; MBY[i] = (QY[N + 2 + i] + QY[N + 3 + i]) / 2;
    }
    // the two ends, each one region wrapping round the snout or the stock
    for (const e of [0, 1]) {
      const h = e ? N - 1 : 0, s = e ? N : 0, tip = e ? 2 * N + 3 : N + 1, dir = e ? -6 : 6;
      const tx = QX[N - s], ty = QY[N - s], bx = QX[N + 2 + s], by = QY[N + 2 + s], zx = QX[tip], zy = QY[tip];
      g.fillStyle = tubeGrad(g, TH[s] - Math.PI / 2 - LAB);
      g.beginPath(); g.moveTo(SX[h], SY[h]); g.lineTo(MTX[h], MTY[h]);
      g.quadraticCurveTo(tx, ty, (tx + zx) / 2, (ty + zy) / 2); g.quadraticCurveTo(zx, zy, (zx + bx) / 2, (zy + by) / 2);
      g.quadraticCurveTo(bx, by, MBX[h], MBY[h]); g.closePath();
      if (plane(g, SX[h], SY[h], YS, MTX[h], MTY[h], -1, SX[h] + Math.cos(TH[s]) * dir, SY[h] + Math.sin(TH[s]) * dir, YS)) { g.fill(); unplane(g); }
    }
    for (let i = 1; i < N; i++) {
      const l = i - 1, r = i;
      g.fillStyle = tubeGrad(g, TH[i] - Math.PI / 2 - LAB);
      // above the line the tube turns fast: two exact triangles
      region(g, SX[l], SY[l], YS, MTX[l], MTY[l], -1, MTX[r], MTY[r], -1, QX[N - i], QY[N - i]);
      region(g, SX[l], SY[l], YS, MTX[r], MTY[r], -1, SX[r], SY[r], YS);
      // below it the tube changes slowly: one band
      band(g, SX[l], SY[l], SX[r], SY[r], MBX[r], MBY[r], QX[N + 2 + i], QY[N + 2 + i], MBX[l], MBY[l], 1);
    }
  }
  // The clear coat's streak: the lamp mirrored along the back, where the tube's normal meets the half vector,
  // drawn as a line that bends with the body and fades out toward the snout and the stock.
  const KX = [], KY = [], STREAK = [[0, 'rgba(255,249,238,0)'], [.22, 'rgba(255,249,238,1)'], [.8, 'rgba(255,249,238,1)'], [1, 'rgba(255,249,238,0)']];
  function streak(g) {
    for (let i = 1; i < N; i++) {
      const Hu = HXY * Math.cos(TH[i] - Math.PI / 2 - LAB), hm = Math.hypot(Hu, HZ), T = TOP[i], B = BOT[i];
      const v = TS * (T + B) - T + (-Hu / hm - YS) * (T + B) / 2;
      KX[i] = PX[i] - Math.sin(TH[i]) * v; KY[i] = PY[i] + Math.cos(TH[i]) * v;
    }
    g.beginPath(); g.moveTo(KX[1], KY[1]);
    for (let i = 2; i < N - 1; i++) g.quadraticCurveTo(KX[i], KY[i], (KX[i] + KX[i + 1]) / 2, (KY[i] + KY[i + 1]) / 2);
    g.lineTo(KX[N - 1], KY[N - 1]);
    const dx = KX[1] - KX[N - 1], dy = KY[1] - KY[N - 1], m = pushT(g);
    g.transform(dx, dy, -dy, dx, KX[N - 1], KY[N - 1]);            // unit frame along the streak: 0 at the tail end, 1 at the head end
    const k = 1 / Math.hypot(dx, dy); g.strokeStyle = linear(g, 'streak', STREAK, 0, 0, 1, 0); g.lineCap = 'round';
    g.globalAlpha = .09; g.lineWidth = 6.5 * k; g.stroke();
    g.globalAlpha = .14; g.lineWidth = 3.8 * k; g.stroke();
    g.globalAlpha = .28; g.lineWidth = 1.7 * k; g.stroke();
    g.globalAlpha = 1; popT(g, m);
  }
  // racing number: a small enamelled tin tag with real thickness, pinned to the flank
  function tagPath(g, x, y, w, h) { g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, 3); else g.rect(x, y, w, h); }
  function tag(g, b) {
    at(g, .52, -.5, 0);
    const w = 18, h = 14, la = lamp(g), ux = Math.cos(la), uy = Math.sin(la);
    let tc = TAGC.get(b.bg); if (!tc) { tc = { side: shade(b.bg, .5), hi: tint(b.bg, .55) }; TAGC.set(b.bg, tc); }
    tagPath(g, -w / 2 - ux * 2.2, -h / 2 - uy * 2.2, w, h); g.fillStyle = 'rgba(16,10,14,.3)'; g.fill();
    tagPath(g, -w / 2 - ux * 1, -h / 2 - uy * 1, w, h); g.fillStyle = tc.side; g.fill();
    tagPath(g, -w / 2, -h / 2, w, h); g.fillStyle = b.bg; g.fill();
    let m = pushT(g); g.rotate(la); g.scale(10, 10); g.lineWidth = .1; g.strokeStyle = linear(g, 'tage', TAGE); g.stroke(); popT(g, m);
    g.fillStyle = b.fg; g.font = `${h * .8}px "Alfa Slab One", Rockwell, serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(String(b.n), 0, h * .06);
    // it sits on the flank, so it turns from the lamp the way the flank does
    tagPath(g, -w / 2, -h / 2, w, h);
    m = pushT(g); g.scale(1, h / 2); g.fillStyle = linear(g, 'tagsh', TAGSH, 0, -1, 0, 1); g.fill(); popT(g, m);
    const rx = w / 2 - 2.3, ry = -h / 2 + 2.3;
    g.beginPath(); g.arc(-rx, ry, .95, 0, TAU); g.moveTo(rx + .95, ry); g.arc(rx, ry, .95, 0, TAU); g.fillStyle = '#3a3f45'; g.fill();
    g.beginPath(); g.arc(-rx + ux * .35, ry + uy * .35, .45, 0, TAU); g.moveTo(rx + ux * .35 + .45, ry + uy * .35); g.arc(rx + ux * .35, ry + uy * .35, .45, 0, TAU);
    g.fillStyle = '#eef0f1'; g.fill();
    g.restore();
  }

  function body(g, o) {
    outline();
    tube(g); streak(g);
    PUX = LUX; PUY = LUY; crease(g, gillPath, .5);
    if (o.bib) tag(g, o.bib);
    // the near pectoral's shadow, thrown onto the flank away from the lamp (the one clip left on the body)
    g.save(); bodyPath(g); g.clip(); g.translate(-LUX * 3.4, -LUY * 3.4);
    if (P.hug) { pt(.28, 5); g.translate(X, Y); g.rotate(A); HH = 33 + P.hug; HKX = NKX - X; HDR = P.hug; pHug(g); }
    else { pt(.28, 5); g.translate(X, Y); g.rotate(A + P.pn); g.scale(P.pk, P.pk * NKN); pFin(g); }
    g.fillStyle = 'rgba(20,12,18,.2)'; g.fill(); g.restore();
    // a faint dark contour, and the clear coat catching the lamp along the back
    bodyPath(g); g.lineWidth = 1.1; g.strokeStyle = CONTOUR; g.lineJoin = 'round'; g.stroke();
    const m = pushT(g); g.translate(PX[4], PY[4]); g.rotate(LAB); g.scale(50, 50);
    g.lineWidth = 1.2 / 50; g.strokeStyle = linear(g, 'bodye', BODYE); g.stroke(); popT(g, m);
  }

  // ---------- fins ----------
  let HH = 0, HKX = 0, HDR = 0, NKX = 0, NKN = 1;
  function pFin(g) { g.beginPath(); g.moveTo(6, -3); g.quadraticCurveTo(8.5, 14, -5, 27); g.quadraticCurveTo(-3, 12, -9, -1); g.closePath(); }
  function cFin(g) { g.beginPath(); g.moveTo(1, 1); g.quadraticCurveTo(2, 12, -3, 20); }
  function fin(g, s, v, rot, far, k, ky = 1) {
    const f = far ? .92 : 1;
    at(g, s, v, rot); g.scale(k * f, k * ky * f);
    part(g, pFin, far ? PAL_FAR : PAL_BACK, -1, 12, 15, far ? .12 : .42, !far);
    if (!far) crease(g, cFin, .28);
    if (!far) ao(g, -1.5, -1.5, 8, 3.6, .34);
    g.restore();
  }
  // riding: a pectoral hooked up and over the cable, which shows through the crook under the tip
  function pHug(g) {
    const H = HH, kx = HKX, droop = HDR;
    g.beginPath(); g.moveTo(-4.5, 1);
    g.quadraticCurveTo(-6, -H * .75, kx - 2, -H);
    g.quadraticCurveTo(kx + 6.5, -H - 1.5, kx + 7.5 + droop, -H + 10 + droop);
    g.quadraticCurveTo(kx + 4.5, -H + 6, kx + 2.4, -H + 6.5);
    g.quadraticCurveTo(kx - 7.5, -H + 5, 4, 1); g.closePath();
  }
  function cHug(g) { g.beginPath(); g.moveTo(0, -2); g.quadraticCurveTo(-1, -HH * .6, HKX - 2, -HH + 3.5); }
  function hug(g, s, v, far, kx, H, droop) {
    at(g, s, v, 0); HH = H; HKX = kx; HDR = droop;
    part(g, pHug, far ? PAL_FAR : PAL_BACK, kx * .5, -H * .55, H * .55 + 6, far ? .12 : .42, !far);
    if (!far) crease(g, cHug, .28);
    if (!far) ao(g, 0, 0, 7, 3.6, .34);
    g.restore();
  }
  function pCaud(g) {
    g.beginPath(); g.moveTo(3, -4.5); g.quadraticCurveTo(-15, -10, -39, -31); g.quadraticCurveTo(-38, -25, -33, -23);
    g.lineTo(-29.5, -21.5); g.quadraticCurveTo(-21, -12, -14, -2.5); g.quadraticCurveTo(-18, 7, -22, 16.5);
    g.quadraticCurveTo(-8, 11, 3, 4); g.closePath();
  }
  function pAnal(g) { g.beginPath(); g.moveTo(3, 0); g.quadraticCurveTo(0, 6, -5, 8); g.quadraticCurveTo(-4, 3, -6, -1); g.closePath(); }
  function pPelv(g) { g.beginPath(); g.moveTo(4, 0); g.quadraticCurveTo(1, 8, -6, 11.5); g.quadraticCurveTo(-4, 4, -7, -1); g.closePath(); }
  function pDor2(g) { g.beginPath(); g.moveTo(4, 2); g.quadraticCurveTo(2, -7, -5, -10); g.quadraticCurveTo(-3, -4, -7, -1.5); g.lineTo(-3, 2); g.closePath(); }
  function pDor(g) { g.beginPath(); g.moveTo(9, 3); g.quadraticCurveTo(6, -33, -14, -44); g.quadraticCurveTo(-7, -24, -13, -3.5); g.lineTo(-7, 3); g.closePath(); }
  function cDor(g) { g.beginPath(); g.moveTo(3, -2); g.quadraticCurveTo(1, -24, -8, -34); }
  function fins(g) {
    // tail: heterocercal, the upper lobe far longer, with a small terminal lobe past the notch
    at(g, 1, 0, P.cau); part(g, pCaud, PAL_BACK, -17, -7, 25, .4); ao(g, -1, 0, 8, 6, .4); g.restore();
    // anal and pelvic fins, second dorsal
    at(g, .8, prof(BOT, .8) - 1.5, 0); part(g, pAnal, PAL_LOW, -1.5, 3.5, 6, 0, false); g.restore();
    at(g, .6, prof(BOT, .6) - 2, 0); part(g, pPelv, PAL_LOW, -1.5, 5, 8, 0, false); g.restore();
    at(g, .8, -prof(TOP, .8) + 2, P.dor * .6); part(g, pDor2, PAL_BACK, -1.5, -4, 7.5, 0, false); g.restore();
    // first dorsal: very tall and sickle-shaped
    at(g, .4, -prof(TOP, .4) + 2, P.dor);
    part(g, pDor, PAL_BACK, -3, -20, 25, .45); crease(g, cDor, .26); ao(g, -2, 2, 11, 3.8, .36);
    g.restore();
  }

  // ---------- the hammer, its eyes and the goggles ----------
  function hammerPath(g) {   // left open: the chord back to the start runs across the head and is never outlined
    g.beginPath(); g.moveTo(-5, -TOP[0] + 2);
    g.quadraticCurveTo(0, -HF + 8, -2.5, -HF + 2); g.quadraticCurveTo(-3, -HF - 3.5, 3, -HF - 3.5);
    g.quadraticCurveTo(9, -HF - 3.5, 9, -HF + 3);
    g.lineTo(9, -2); g.lineTo(7.3, 0); g.lineTo(9, 2); g.lineTo(9, HN - 3);
    g.quadraticCurveTo(9, HN + 3.5, 3, HN + 3.5); g.quadraticCurveTo(-3.5, HN + 3.5, -3.5, HN - 2);
    g.quadraticCurveTo(0, HN - 9, -6, BOT[0] - 1); g.lineTo(-6, SEAM[0]);
  }
  function lid(g, r) {
    const R = r * 1.12, a = Math.asin(clamp(2 * F.lid - 1, -1, 1)), cy = R * Math.sin(a), cx = R * Math.cos(a);
    g.save(); g.rotate(F.tilt);
    // the lid's shadow on the eyeball, a crescent just under its rim
    const hw = r * Math.sqrt(Math.max(0, 1 - (cy / r) ** 2)) * .94;
    if (hw > .5) {
      g.beginPath(); g.moveTo(-hw, cy); g.quadraticCurveTo(0, cy + r * .55, hw, cy); g.closePath();
      g.fillStyle = 'rgba(26,12,18,.3)'; g.fill();
    }
    g.beginPath(); g.arc(0, 0, R, Math.PI - a, TAU + a); g.closePath();
    const m = pushT(g); g.scale(R, R); g.fillStyle = linear(g, 'lid', LIDG, 0, -1, 0, 1); g.fill(); popT(g, m);
    g.beginPath(); g.moveTo(-cx * .86, cy - .75); g.lineTo(cx * .86, cy - .75);
    g.lineCap = 'round'; g.lineWidth = .8; g.strokeStyle = 'rgba(255,242,222,.5)'; g.stroke();
    g.restore();
  }
  function brow(g, r) {
    g.beginPath(); g.moveTo(-r, 1.4 - r * 1.8); g.quadraticCurveTo(0, -1.6 - r * 1.8, r, -1.4 - r * 1.8);
    g.lineCap = 'round'; g.lineWidth = 2.6; g.strokeStyle = '#3e3a31'; g.stroke();
    g.save(); g.translate(-.25, -.55);
    g.beginPath(); g.moveTo(-r * .8, 1 - r * 1.8); g.quadraticCurveTo(0, -1.9 - r * 1.8, r * .8, -1.6 - r * 1.8);
    g.lineWidth = .9; g.strokeStyle = BROW_HI; g.stroke(); g.restore();
  }
  // a bead of water: clear, the lamp caught on top, its light gathered at the bottom
  function drip(g, x, y, s) {
    g.beginPath(); g.moveTo(x, y - 6 * s); g.quadraticCurveTo(x + 4 * s, y, x, y + 3 * s); g.quadraticCurveTo(x - 4 * s, y, x, y - 6 * s);
    const m = pushT(g); g.translate(x, y); g.scale(3.2 * s, 3.6 * s); g.fillStyle = radial(g, 'bead', BEAD, .35, .45); g.fill(); popT(g, m);
    g.lineWidth = .6; g.strokeStyle = 'rgba(24,60,98,.5)'; g.stroke();
    g.beginPath(); g.ellipse(x - 1.1 * s, y - 1.2 * s, .75 * s, 1.5 * s, .35, 0, TAU); g.fillStyle = 'rgba(255,255,255,.9)'; g.fill();
  }
  function bead(g, x, y, r) {
    g.beginPath(); g.arc(x, y, r, 0, TAU);
    g.save(); g.translate(x, y); g.scale(r, r); g.fillStyle = radial(g, 'bead', BEAD, .35, .45); g.fill();
    g.beginPath(); g.ellipse(-.36, -.4, .26, .2, -.5, 0, TAU); g.fillStyle = 'rgba(255,255,255,.95)'; g.fill();
    g.restore();
  }
  // one lens cup: a charcoal rubber rim lit on the lamp side, teal glass with the lamp in it
  function cup(g, x, y, rx, ry, la) {
    g.beginPath(); g.ellipse(x, y, rx + 1.3, ry + 1.3, 0, 0, TAU);
    let m = pushT(g); g.translate(x, y); g.rotate(la); g.scale(rx + 1.3, rx + 1.3); g.fillStyle = linear(g, 'rim', RIM); g.fill(); popT(g, m);
    g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, TAU);
    m = pushT(g); g.translate(x, y); g.scale(rx, ry); g.fillStyle = radial(g, 'glass', GLASS, .35, .42); g.fill(); popT(g, m);
  }
  // swim goggles pushed up on the middle of the hammer, well out of reach of the eyes on the tips
  function strapPath(g) { g.beginPath(); g.moveTo(-1, -4); g.quadraticCurveTo(-9, -6.5, -14, -1.5); }
  function goggles(g, t) {
    g.save(); g.translate(2, -8.5); g.rotate(-.14);
    const la = lamp(g), ux = Math.cos(la), uy = Math.sin(la);
    // their shadow on the hammer, thrown away from the lamp
    g.beginPath(); g.ellipse(-ux * 1.8, -4 - uy * 1.8, 4.8, 5.2, 0, 0, TAU);
    g.moveTo(-ux * 1.8 + 5, 3.8 - uy * 1.8); g.ellipse(-ux * 1.8, 3.8 - uy * 1.8, 5, 5.4, 0, 0, TAU);
    g.fillStyle = 'rgba(16,10,14,.26)'; g.fill();
    // the rubber strap
    g.lineCap = 'round';
    strapPath(g); g.lineWidth = 3; g.strokeStyle = STRAP_DK; g.stroke();
    let m = pushT(g); g.translate(ux * .35, uy * .35); strapPath(g); g.lineWidth = 2.3; g.strokeStyle = STRAP; g.stroke(); popT(g, m);
    m = pushT(g); g.translate(ux * .6, uy * .6); strapPath(g); g.lineWidth = .7; g.strokeStyle = STRAP_HI; g.stroke(); popT(g, m);
    cup(g, 0, -4, 3.5, 3.9, la);
    cup(g, 0, 3.8, 3.7, 4.1, la);
    // the lamp in the glass, and a glint that sweeps across the lenses now and then
    g.beginPath(); g.ellipse(-1.2, 2.1, .95, 1.4, .4, 0, TAU); g.ellipse(-1.1, -5.5, .75, 1.15, .4, 0, TAU);
    g.fillStyle = 'rgba(255,252,244,.9)'; g.fill();
    const u = frac(t / 4.3) * 4;
    if (u < 1) {
      g.beginPath(); g.ellipse(1.2 - u * 2, 6 - u * 12, .7, 2, .4, 0, TAU);
      g.fillStyle = `rgba(255,255,255,${(.9 * Math.sin(Math.PI * u)).toFixed(3)})`; g.fill();
    }
    g.restore();
  }

  function hammer(g, t) {
    pt(0, 0);
    const R = A * P.hk + HT + P.ham;
    g.save(); g.translate(X, Y); g.rotate(R);
    // the blade: a flattened bar of the same enamel, lit across its width like the body; its upper
    // tip turns up into the lamp, its lower tip turns down away from it
    const la = lamp(g), ux = Math.cos(la), uy = Math.sin(la);
    hammerPath(g); g.lineWidth = 1.8; g.strokeStyle = CONTOUR; g.lineJoin = 'round'; g.stroke();
    // every layer is another fill of the same path, so none of them needs a clip
    let m = pushT(g); g.transform(0, 1, 7.6, 0, 1.4, 0); g.fillStyle = tubeGrad(g, Math.PI - la, 1); g.fill(); popT(g, m);
    m = pushT(g); g.translate(0, (HN - HF) / 2); g.scale(1, (HN + HF) / 2 + 3.5); g.fillStyle = linear(g, 'caps', CAPS, 0, -1, 0, 1); g.fill(); popT(g, m);
    // its leading face, turned away from the lamp, shows as a darker band of thickness under a lit arris
    m = pushT(g); g.translate(7.7, 0); g.scale(1.9, 1); g.fillStyle = linear(g, 'facex', FACEX); g.fill(); popT(g, m);
    // the eye sockets, sunk into the blade
    for (let k = 0; k < 2; k++) {
      m = pushT(g); g.translate(3.4, k ? HN - .5 : -HF + .5); g.scale(6.8, 6.2);
      g.fillStyle = radial(g, 'sock', SOCK); g.fill(); popT(g, m);
    }
    m = pushT(g); g.translate(1.5, 0); g.rotate(la); g.scale(24, 24); g.lineWidth = 1 / 24; g.strokeStyle = linear(g, 'hame', HAME); g.stroke(); popT(g, m);
    goggles(g, t);
    // eyes out on the two tips; gaze, lids and brows stay upright on screen however the hammer swings
    for (let k = 0; k < 2; k++) {
      const near = k === 1, r = near ? 5.2 : 4.4, seed = near ? 0 : .04;
      g.save(); g.translate(2.8, near ? HN - 1 : -HF); g.rotate(-R);
      eye3d(g, 0, 0, r, { t, look: F.gy, lookX: F.gx, wide: F.wide, seed });
      const blink = ((t + seed) % 3.7) < .12;
      if (F.lid > 0 && !blink) lid(g, F.wide ? r * 1.25 : r);
      if (F.brow) brow(g, r);
      if (F.sweat >= 0 && !near) {
        g.globalAlpha = Math.sin(Math.PI * F.sweat);
        drip(g, -r - 4, 2 + F.sweat * 8, .9);
        g.globalAlpha = 1;
      }
      g.restore();
    }
    g.restore();
  }

  // ---------- mouth ----------
  function mFlat(g) { g.beginPath(); g.moveTo(1, 0); g.lineTo(-9, .5); g.quadraticCurveTo(-11, .6, -11.5, 2.3); }
  function mWob(g) { g.beginPath(); g.moveTo(1, .5); g.quadraticCurveTo(-2, -1.8, -5, .4); g.quadraticCurveTo(-8, 2.6, -11, .2); }
  function mSad(g) { g.beginPath(); g.moveTo(1, 1.4); g.quadraticCurveTo(-5, -2, -11, 2.8); }
  function lip(g, path) {       // a cut in the enamel: dark groove, the lower lip catching the lamp
    path(g); g.lineCap = 'round'; g.lineJoin = 'round'; g.lineWidth = 1.7; g.strokeStyle = 'rgba(40,14,22,.85)'; g.stroke();
    const m = pushT(g); g.translate(0, 1.2); path(g); g.lineWidth = .8; g.strokeStyle = 'rgba(255,246,232,.42)'; g.stroke(); popT(g, m);
  }
  function mouth(g) {
    at(g, .07, prof(BOT, .07) - 2.8, 0);
    if (F.mouth === 'grin') {
      g.beginPath(); g.moveTo(2, -1.4); g.quadraticCurveTo(-5, .8, -12.5, -3.4); g.quadraticCurveTo(-6, 9.5, 2, 3.5); g.closePath();
      let m = pushT(g); g.translate(-4, -1); g.scale(8, 8); g.fillStyle = linear(g, 'maw', MAW, 0, -.2, 0, 1); g.fill(); popT(g, m);
      g.lineWidth = .9; g.strokeStyle = 'rgba(30,10,16,.7)'; g.stroke();
      g.beginPath(); g.moveTo(1, -1.1); g.lineTo(-.6, 1.8); g.lineTo(-2.4, -.4); g.lineTo(-4.2, 2.2); g.lineTo(-6, -.4);
      g.lineTo(-7.8, 1.9); g.lineTo(-9.6, -1.4); g.closePath();
      m = pushT(g); g.translate(-4, -1); g.scale(4, 4); g.fillStyle = linear(g, 'ivory', IVORY, 0, -.4, 0, 1); g.fill(); popT(g, m);
      g.lineWidth = .5; g.strokeStyle = 'rgba(90,60,50,.55)'; g.stroke();
      g.beginPath(); g.moveTo(1.5, 4.6); g.quadraticCurveTo(-5, 9.6, -11, -1.2);
      g.lineCap = 'round'; g.lineWidth = .8; g.strokeStyle = 'rgba(255,246,232,.4)'; g.stroke();
    } else if (F.mouth === 'wobble') lip(g, mWob);
    else if (F.mouth === 'sad') lip(g, mSad);
    else {
      lip(g, mFlat);
      // one tooth poking up over the lip: the whole of its sense of humour
      g.beginPath(); g.moveTo(-2.2, .2); g.lineTo(-3.3, -2.8); g.lineTo(-4.5, .3); g.closePath();
      const m = pushT(g); g.translate(-3.3, -2.4); g.scale(3, 3); g.fillStyle = linear(g, 'ivory', IVORY, 0, -.4, 0, 1); g.fill(); popT(g, m);
      g.lineWidth = .5; g.strokeStyle = 'rgba(70,46,40,.6)'; g.stroke();
    }
    g.restore();
  }

  function drops(g, x0, y0, u) {
    if (u < 0 || u >= 1) return;
    g.globalAlpha = Math.min(1, (1 - u) * 3);
    for (let i = 0; i < 4; i++) bead(g, x0 + DVX[i] * u, y0 + DVY[i] * u + 48 * u * u, DR[i] * (1 - .5 * u));
    g.globalAlpha = 1;
  }

  function draw(g, o) {
    const t = o.t || 0, mode = o.mode || 'idle';
    g.save(); g.scale(o.scale || 1, o.scale || 1);
    P.phi = 0; P.c = .12; P.h = -.25; P.hs = .3; P.tl = .2; P.cau = 0; P.dor = 0; P.ham = 0;
    P.pn = -.3; P.pf = -.2; P.pk = 1; P.hk = .35; P.hug = 0; P.sx = 1; P.sy = 1; P.lift = 0; P.dx = 0; P.dy = 0;
    F.lid = .36; F.tilt = 0; F.wide = false; F.gy = 0; F.gx = .4; F.mouth = 'flat'; F.brow = false; F.sweat = -1; F.gill = 0;
    let drop = -1, dx0 = -50, dy0 = -8, ride = false, ox = 20;

    if (mode === 'run') {
      const spd = Math.max(.2, Math.min(1.6, o.speed == null ? 1 : o.speed));
      const p = runPhase(o, t, .7 + 1.2 * spd);
      P.c = key(p, R_C); P.tl = key(p, R_TL); P.h = key(p, R_H); P.phi = key(p, R_PHI);
      P.sy = key(p, R_SY); P.sx = 1 + (1 - P.sy) * .8; P.dx = key(p, R_DX);
      P.cau = key(p, R_CAU); P.dor = key(p, R_DOR); P.ham = key(p, R_HAM);
      const air = p > .39 && p < .87 ? (p - .39) / .48 : -1;
      if (air >= 0) P.lift = (13 + 7 * spd) * 4 * air * (1 - air);
      const env = .45 + .55 * Math.sin(Math.PI * Math.max(0, air));
      P.pn = -.35 + .6 * env * cyc(p, 2); P.pf = -.3 + .6 * env * cyc(p, 2, .25);
      F.lid = .3; F.tilt = .32; F.gx = .6; F.gill = cyc(p, 2);
      if (p >= .39 && p < .83) drop = (p - .39) / .44;
    } else if (mode === 'cheer') {
      const p = frac(t * 1.05);
      P.c = key(p, K_C); P.phi = key(p, K_PHI); P.tl = key(p, K_TL); P.h = key(p, K_H);
      P.sy = key(p, K_SY); P.sx = 1 + (1 - P.sy) * .8;
      const air = p > .33 && p < .84 ? (p - .33) / .51 : -1;
      if (air >= 0) P.lift = 34 * 4 * air * (1 - air);
      const wave = .28 * cyc(t, 3.2);
      const up = key(p, K_PEC); P.pn = up + wave; P.pf = up * .85 - wave + .1;
      P.cau = .3 * cyc(t, 2.1, -.2); P.dor = -.1 * cyc(p, 1, -.1); P.ham = .08 * cyc(t, 2.1, -.3);
      F.lid = 0; F.mouth = 'grin'; F.gx = .3; F.gy = -.2; F.gill = cyc(t, 2);
      if (p >= .33 && p < .78) { drop = (p - .33) / .45; dx0 = -58; dy0 = -10; }
    } else if (mode === 'worry') {
      P.dx = .7 * cyc(t, 7.5);
      P.c = .32; P.h = -.12 + .04 * cyc(t, .5); P.tl = .5 + .07 * cyc(t, 2.2);
      P.cau = .24 * cyc(t, 2.2, -.2); P.dor = -.14 + .05 * cyc(t, 2.2, -.3);
      P.pn = -.15 + .4 * cyc(t, 1.7); P.pf = -.15 + .4 * cyc(t, 1.7, .5);
      P.sy = .96 + .015 * cyc(t, 3); P.sx = 1.02; P.ham = .13 * cyc(t, .55);
      F.wide = true; F.lid = 0; F.gx = .8 * cyc(t, .55, .1); F.gy = -.1; F.mouth = 'wobble'; F.brow = true;
      F.sweat = frac(t * .6); F.gill = cyc(t, 3);
    } else if (mode === 'ride') {
      // lying along the hub, pectorals wrapped up round the cable, the head over the right-hand end
      ride = true; ox = -16.6; P.hk = 1; P.hug = 1 + .6 * cyc(t, .5);
      const look = Math.max(-1, Math.min(1, o.look == null ? .5 : o.look)), em = o.emotion || 'focus';
      P.hs = .22; P.c = -.08; P.h = look > 0 ? -.3 + 1.25 * look : -.3 + .2 * look;
      P.tl = -.25 + .08 * cyc(t, .3); P.cau = .2 * cyc(t, .3, -.2); P.dor = -.24 + .03 * cyc(t, .3, -.3);
      // the hammer see-saws, so one tip-eye and then the other dips to peer down at the cans
      P.ham = (.18 + .22 * Math.max(0, look)) * cyc(t, .22);
      F.gy = Math.max(-.6, look); F.gx = .25; F.lid = .3; F.tilt = .34; F.gill = cyc(t, .4);
      if (em === 'worry') {
        P.dx = .6 * cyc(t, 8); P.hug = 3.2 + .5 * cyc(t, 8); P.tl = -.1 + .08 * cyc(t, 2.4);
        P.dor = -.3; F.wide = true; F.lid = 0; F.brow = true; F.mouth = 'wobble'; F.sweat = frac(t * .6); F.gill = cyc(t, 3);
      } else if (em === 'cheer') {
        P.dy = -2.6 * (1 + cyc(t, 1.8)); P.tl = -.1 + .4 * cyc(t, 1.8, -.15); P.cau = .3 * cyc(t, 1.8, -.35);
        P.hug = 0; P.pn = -3.35 + .35 * cyc(t, 2.6); P.pf = -2.6 + .35 * cyc(t, 2.6, .3); P.pk = 1.3; P.dor = 0;
        F.lid = 0; F.mouth = 'grin'; F.gy = -.2; P.ham *= .5;
      } else if (em === 'sad') {
        P.h += .25; P.tl = -.7 + .03 * cyc(t, .2); P.dor = -.36; P.sy = .97; P.hug = -2.5;
        P.ham *= .4; F.lid = .52; F.tilt = -.3; F.mouth = 'sad';
      }
    } else {
      const b = cyc(t, .3);
      P.c = .1 + .03 * b; P.h = -.45 + .025 * cyc(t, .3, .15); P.tl = .25 + .12 * cyc(t, .22);
      P.cau = .16 * cyc(t, .22, -.18); P.dor = .04 * cyc(t, .22, -.3);
      P.sy = 1 + .018 * b; P.sx = 1 - .01 * b; P.pn = .5 + .04 * b; P.pf = .6;
      P.ham = .07 * cyc(t, .09); F.lid = .38; F.gill = b;
    }

    spine();
    const oy = ride ? -BOT[IA] : -lowest();
    const ground = ride ? 1e9 : (P.lift - P.dy) / P.sy - oy;
    const kn = ride ? 1 : planted(.28, 5, P.pn, P.pk, ground), kf = ride ? 1 : planted(.26, 2, P.pf, P.pk, ground);
    if (!ride) {
      cast(g, 112, P.lift);
      if (P.lift < 6) ao(g, 18 + P.dx, .6, 30, 2.4, .36 * (1 - P.lift / 6));   // where the belly presses on the ground
    }
    else ao(g, 2 + P.dx, 1, 24, 4, .42);           // where the belly rests on the hub
    if (drop >= 0) drops(g, dx0, dy0, drop);
    g.translate(P.dx, P.dy - P.lift); g.scale(P.sx, P.sy); g.translate(ox, oy);
    LAB = lamp(g); LUX = Math.cos(LAB); LUY = Math.sin(LAB);

    const kx = -P.dx / P.sx - ox;                  // the cable, in body coordinates
    if (P.hug) { pt(.26, 2); hug(g, .26, 2, true, kx - X, 37 + P.hug, P.hug * .6); }
    else fin(g, .26, 2, P.pf, true, P.pk, kf);     // far pectoral, behind the body
    fins(g);
    NKX = kx; NKN = kn;
    body(g, o);
    pt(.02, 1); ao(g, X - 3, Y, 6.5, 13, .34, A);  // under the hammer, where the head meets it
    mouth(g);
    if (P.hug) { pt(.28, 5); hug(g, .28, 5, false, kx - X, 33 + P.hug, P.hug); }
    else fin(g, .28, 5, P.pn, false, P.pk, kn);    // near pectoral
    hammer(g, t);
    g.restore();
  }

  AKIT.register({
    key: 'shark', name: 'Great hammerhead', status: 'Critically Endangered',
    fact: 'Its wide hammer head helps it pin stingrays, its favourite prey, to the sea floor.',
    draw,
  });
})();
