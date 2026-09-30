// Sunda pangolin (Manis javanica). The coat is the whole identity, so it is built on a bendable spine:
// columns of proud, straw-edged keratin scales run from tail tip to nape, and the same coat works
// upright on the hind legs, half-curled round the crane cable, and rolled into a ball at full tilt.
// Personality: shy and gentle. Heavy-lidded eyes and a blush, front claws clasped at the chest, a long
// tongue it flicks out only after a glance to check nobody is looking, and when frightened it hides
// its face behind its claws. On the crane it sits hugging the cable, claws hooked round it, and peeks.
(() => {
  const { C, TAU, LW, paint, sheen, eye, blush, sweat, bib, shadow, cyc, ease } = AKIT;
  const PI = Math.PI;

  // olive-brown keratin with straw edges, pink-grey bare skin, horn-coloured claws
  const SC = '#a67a39', SC_FAR = '#7b5b2b', RIM = '#f0d592';
  const SKIN = '#f1c5af', FOOT = '#b58372', FOOT_FAR = '#8a5f53';
  const CLAW = '#f6e7c3', CLAW_FAR = '#cdb788', NOSE = '#4a2e28', TONGUE = '#ee6f89', MOUTH = '#7b2b35', GAP = '#3b2a1c';

  const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
  const mix = (a, b, k) => a + (b - a) * k;
  const frac = x => x - Math.floor(x);
  let PX = 0, PY = 0, IX = 0, IY = 0;

  // ---- spine: 11 points, tail tip (0) .. hip (5) .. shoulder (9), nape (10) -------------------------
  const TAIL = [13, 12.5, 12, 11, 10];                       // hip -> tail tip
  const BODY = [12, 12, 12, 11, 7];                          // hip -> shoulder -> nape
  const WD = [1.6, 5, 8, 10.5, 13, 16.5, 21.5, 24, 23, 19, 13.5];   // back-side half thickness
  const WV = [1.6, 4.5, 7, 9, 11, 13.5, 16.5, 17.5, 16, 12.5, 9];   // belly-side half thickness
  const COLS = [0.45, 1.2, 1.95, 2.7, 3.45, 4.2, 4.95, 5.7, 6.4, 7.1, 7.8, 8.5, 9.2, 9.85];
  const NC = COLS.length, BODY0 = 7;                         // columns before BODY0 are tail (fully scaled)

  const P = { x: 0, y: 0, a: 0, bend: 0, neck: 0, st: 1, wk: 1, ta: 0, tb: [0, 0, 0, 0, 0], tl: 1 };
  const S = { x: [], y: [], nx: [], ny: [], wd: [], wv: [], na: 0 };

  function spine() {
    let x = P.x, y = P.y, a = P.a;
    S.x[5] = x; S.y[5] = y;
    for (let i = 0; i < 5; i++) {
      if (i) a += i === 4 ? P.neck : P.bend;
      const l = BODY[i] * (i === 4 ? 1 : P.st);
      x += Math.cos(a) * l; y += Math.sin(a) * l; S.x[6 + i] = x; S.y[6 + i] = y;
    }
    S.na = a;
    x = P.x; y = P.y; a = P.ta;
    for (let i = 0; i < 5; i++) {
      a += P.tb[i];
      x += Math.cos(a) * TAIL[i] * P.tl; y += Math.sin(a) * TAIL[i] * P.tl; S.x[4 - i] = x; S.y[4 - i] = y;
    }
    for (let i = 0; i < 11; i++) {
      const i0 = i ? i - 1 : 0, i1 = i < 10 ? i + 1 : 10;
      const tx = S.x[i1] - S.x[i0], ty = S.y[i1] - S.y[i0], l = Math.hypot(tx, ty) || 1;
      S.nx[i] = ty / l; S.ny[i] = -tx / l;                   // unit normal pointing to the back
      const k = i >= 5 ? P.wk : 1;
      S.wd[i] = WD[i] * k; S.wv[i] = WV[i] * k;
    }
  }
  // interpolated frame at fractional spine index u
  const Q = { x: 0, y: 0, nx: 0, ny: 0, tx: 0, ty: 0, wd: 0, wv: 0 };
  function at(u) {
    const i = u < 0 ? 0 : u >= 9 ? 9 : Math.floor(u), f = u - i;
    Q.x = mix(S.x[i], S.x[i + 1], f); Q.y = mix(S.y[i], S.y[i + 1], f);
    let nx = mix(S.nx[i], S.nx[i + 1], f), ny = mix(S.ny[i], S.ny[i + 1], f);
    const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
    Q.nx = nx; Q.ny = ny; Q.tx = -ny; Q.ty = nx;
    Q.wd = mix(S.wd[i], S.wd[i + 1], f); Q.wv = mix(S.wv[i], S.wv[i + 1], f);
    return Q;
  }

  // ---- scale columns: each is a vertical run of shingles whose tips point to the tail ----------------
  const K = { x: [], y: [], tx: [], ty: [], nx: [], ny: [], top: [], bot: [], tip: [], h: [], off: [] };
  function columns() {
    for (let c = 0; c < NC; c++) {
      const u = COLS[c], q = at(u), tail = c < BODY0;
      K.x[c] = q.x; K.y[c] = q.y; K.tx[c] = q.tx; K.ty[c] = q.ty; K.nx[c] = q.nx; K.ny[c] = q.ny;
      const bot = tail ? q.wv : q.wv * mix(.7, .45, clamp((u - 5.7) / 1.4));
      const span = q.wd + bot, rows = tail ? Math.max(1, Math.round(span / 10.5)) : 3;
      K.top[c] = q.wd; K.bot[c] = bot; K.h[c] = span / rows; K.off[c] = c & 1 ? .5 : 0;   // odd columns sit half a scale lower
      K.tip[c] = 3 + 4 * clamp(q.wd / 22);
    }
  }
  // point in a column's frame: a = along (+ toward the head), v = across (+ toward the back)
  function cp(c, a, v) { PX = K.x[c] + K.tx[c] * a + K.nx[c] * v; PY = K.y[c] + K.ty[c] * a + K.ny[c] * v; }
  function cq(g, c, ca, cv, a, v) { cp(c, ca, cv); const x = PX, y = PY; cp(c, a, v); g.quadraticCurveTo(x, y, PX, PY); }

  // silhouette: a serrated back and tail (a proud scale tip on every other column), a skirt on the belly side
  function bodyPath(g) {
    g.beginPath();
    let q = at(0), px = q.x - q.tx * 3.5, py = q.y - q.ty * 3.5;
    const x0 = px, y0 = py;
    g.moveTo(px, py);
    for (let c = 0; c < NC; c += 2) {
      const tip = K.tip[c], top = K.top[c];
      cp(c, -tip - 1.6, top - 2.2); const ux = PX, uy = PY;
      g.quadraticCurveTo((px + ux) / 2 + K.nx[c] * 3.4, (py + uy) / 2 + K.ny[c] * 3.4, ux, uy);
      cp(c, -tip, top + .8); g.lineTo(PX, PY); px = PX; py = PY;
    }
    q = at(10.1);
    g.quadraticCurveTo(q.x + q.nx * q.wd * 1.1, q.y + q.ny * q.wd * 1.1, q.x + q.tx * 5, q.y + q.ty * 5);
    const vx = q.x - q.nx * q.wv, vy = q.y - q.ny * q.wv;
    cp(NC - 1, 0, -K.bot[NC - 1]); g.quadraticCurveTo(vx, vy, PX, PY); px = PX; py = PY;
    for (let c = NC - 2; c >= BODY0; c--) {
      cp(c, 0, -K.bot[c]);
      g.quadraticCurveTo((px + PX) / 2 - K.nx[c] * 2.4, (py + PY) / 2 - K.ny[c] * 2.4, PX, PY); px = PX; py = PY;
    }
    for (let c = BODY0 - 1; c >= 0; c -= 2) {
      const tip = K.tip[c], bot = K.bot[c];
      cp(c, -tip, -bot - .8);
      g.quadraticCurveTo((px + PX) / 2 - K.nx[c] * 3.4, (py + PY) / 2 - K.ny[c] * 3.4, PX, PY);
      cp(c, -tip - 1.6, -bot + 2.2); g.lineTo(PX, PY); px = PX; py = PY;
    }
    q = at(0);
    g.quadraticCurveTo((px + x0) / 2 - q.nx * 2, (py + y0) / 2 - q.ny * 2, x0, y0);
    g.closePath();
  }
  // the coat: staggered shingles (a pine-cone lattice), straw crescents on the lit upper rows, ink free edges
  function coat(g) {
    g.beginPath();
    for (let c = 0; c < NC; c++) {
      const tip = K.tip[c], h = K.h[c], d = Math.min(3.4, tip * .5);
      for (let j = 0; j < 2; j++) {
        const v = K.top[c] - (j + K.off[c]) * h;
        cp(c, 0, v + h * .5); g.moveTo(PX, PY);
        cq(g, c, -tip * .8, v + h * .42, -tip, v);
        cq(g, c, -tip * .8, v - h * .42, 0, v - h * .5);
        cq(g, c, 2 * (d - tip), v, 0, v + h * .5);
      }
    }
    g.fillStyle = RIM; g.fill();
    g.beginPath();
    for (let c = 0; c < NC; c++) {
      const tip = K.tip[c], h = K.h[c], lo = -K.bot[c] - h * .6;
      let v = K.top[c] - K.off[c] * h;
      cp(c, 0, v + h * .5); g.moveTo(PX, PY);
      for (; v > lo; v -= h) {
        cq(g, c, -tip * .8, v + h * .42, -tip, v);
        cq(g, c, -tip * .8, v - h * .42, 0, v - h * .5);
      }
    }
    g.lineCap = 'round'; g.lineJoin = 'round'; g.lineWidth = LW * .75; g.strokeStyle = C.INK; g.stroke();
  }
  const BU = [5.4, 6.2, 7.1, 8, 8.9, 9.7], BX = [], BY = [];
  function belly(g) {
    for (let i = 0; i < BU.length; i++) { const q = at(BU[i]); BX[i] = q.x - q.nx * q.wv; BY[i] = q.y - q.ny * q.wv; }
    g.beginPath();
    let q = at(5.1); g.moveTo(q.x, q.y); g.lineTo(BX[0], BY[0]);
    for (let i = 1; i < BU.length - 1; i++) g.quadraticCurveTo(BX[i], BY[i], (BX[i] + BX[i + 1]) / 2, (BY[i] + BY[i + 1]) / 2);
    g.lineTo(BX[BU.length - 1], BY[BU.length - 1]);
    q = at(10); g.lineTo(q.x, q.y); g.closePath();
    paint(g, SKIN, { lw: LW });
  }
  function body(g) {
    bodyPath(g);
    g.fillStyle = SC; g.fill();
    g.save(); g.clip();
    coat(g);
    const b = at(7.4);
    sheen(g, b.x + b.nx * b.wd * .55, b.y + b.ny * b.wd * .55, 8, 5.5, .5);
    g.restore();
    bodyPath(g);
    const q = at(7);
    g.save(); g.translate(q.x, q.y); g.rotate(-.5);           // halftone on the side away from the light
    paint(g, 'rgba(0,0,0,0)', { shadeFrom: 5, lw: LW });
    g.restore();
  }

  // ---- head, drawn in its own frame: origin at the nape, +x along the snout ----------------------------
  const E = { t: 0, look: 0, lookX: .3, wide: false, happy: false, shut: false, lid: .25, brow: '', mouth: 'smile', tongue: 0, wag: 0, blush: 1, sweat: 0, tilt: 0 };
  function head(g, x, y, a) {
    g.save(); g.translate(x, y); g.rotate(a);
    // bare-skinned cone: domed crown, long tapered snout, soft throat
    g.beginPath();
    g.moveTo(-7, -9.5);
    g.bezierCurveTo(-2, -15.5, 8, -15.5, 15, -10.5);
    g.bezierCurveTo(21, -7.5, 27, -4.2, 33, -2.4);
    g.quadraticCurveTo(37, -1, 34.6, 1.8);
    g.bezierCurveTo(29, 4.2, 20, 5.2, 13, 7.8);
    g.bezierCurveTo(6, 10.5, -2, 11, -7, 8.5);
    g.closePath();
    paint(g, SKIN, { lw: LW });
    // crown cap of small scales, tips spilling back over the neck
    g.beginPath();
    g.moveTo(-9, 8.5);
    g.quadraticCurveTo(-2, 4, 1, -2.5);
    g.quadraticCurveTo(6, -9, 16.5, -10.7);
    g.bezierCurveTo(9, -16.2, -2.5, -16.3, -7.5, -10.3);
    g.quadraticCurveTo(-11.5, -11.2, -13.5, -8.6);
    g.quadraticCurveTo(-10.2, -6.6, -9, -3.6);
    g.quadraticCurveTo(-12.8, -2.6, -14, .4);
    g.quadraticCurveTo(-10.8, 2.6, -10, 4.4);
    g.quadraticCurveTo(-12.6, 5.8, -12.6, 8.6);
    g.closePath();
    paint(g, SC, { lw: LW });
    g.beginPath();
    g.moveTo(5.5, -14.4); g.quadraticCurveTo(1.2, -13.6, -1, -10.8); g.quadraticCurveTo(1.6, -9.6, 4, -7.4);
    g.quadraticCurveTo(-.2, -6.4, -2.2, -3.4);
    g.lineWidth = 2.2; g.strokeStyle = RIM; g.stroke();
    g.beginPath();
    g.moveTo(4.2, -15); g.quadraticCurveTo(-.5, -14, -3, -10.6); g.quadraticCurveTo(0, -9.4, 2.6, -7.2);
    g.quadraticCurveTo(-1.8, -6, -4, -2.6);
    g.lineWidth = LW * .75; g.strokeStyle = C.INK; g.stroke();
    blush(g, 20, 3.6, 3.4 * E.blush);
    // mouth and tongue, tucked under the tip of the snout
    g.lineCap = 'round'; g.lineJoin = 'round';
    if (E.tongue > 0) {
      const L = 27 * E.tongue, w = E.wag;
      g.beginPath(); g.moveTo(30, 2.6);
      g.quadraticCurveTo(30 + L * .5, 2.6 + 4 * E.tongue + w * 3, 30 + L, 2.4 + 2 * E.tongue - w * 2);
      g.lineWidth = 4; g.strokeStyle = C.INK; g.stroke();
      g.lineWidth = 2.2; g.strokeStyle = TONGUE; g.stroke();
    }
    g.beginPath();
    if (E.mouth === 'grin') {
      g.moveTo(21, 1.8); g.quadraticCurveTo(25.5, 9, 31, 1.6); g.quadraticCurveTo(26, 3.4, 21, 1.8);
      paint(g, MOUTH, { lw: LW * .8 });
      g.beginPath(); g.ellipse(26, 4.4, 2.6, 1.4, .1, 0, TAU); g.fillStyle = TONGUE; g.fill();
    } else {
      if (E.mouth === 'wobble') { g.moveTo(22, 3); g.quadraticCurveTo(24, 1.4, 26, 3); g.quadraticCurveTo(28, 4.4, 30.5, 2.4); }
      else if (E.mouth === 'frown') { g.moveTo(23, 3.6); g.quadraticCurveTo(26.5, 1, 30.5, 2.6); }
      else if (E.mouth === 'flat') { g.moveTo(24, 2.8); g.lineTo(30.5, 2.2); }
      else { g.moveTo(22.5, 2.4); g.quadraticCurveTo(26, 4.8, 30.5, 2); }
      g.lineWidth = LW * .75; g.strokeStyle = C.INK; g.stroke();
    }
    // nose pad
    g.beginPath(); g.ellipse(34.1, -.2, 2.3, 1.9, .3, 0, TAU); g.fillStyle = NOSE; g.fill();
    // eye: small, heavy-lidded
    const ex = 13, ey = -3.6;
    if (E.happy) {
      g.beginPath(); g.moveTo(ex - 3.4, ey + 1); g.quadraticCurveTo(ex, ey - 4, ex + 3.4, ey + 1);
      g.lineWidth = LW; g.strokeStyle = C.INK; g.stroke();
    } else {
      eye(g, ex, ey, 3.3, { t: E.t, look: E.look, lookX: E.lookX, wide: E.wide, shut: E.shut, seed: 1.3 });
      const blinking = ((E.t + 1.3) % 3.7) < .12;
      if (E.lid > 0 && !E.shut && !blinking) {
        const r = 3.3 * (E.wide ? 1.25 : 1) + .7, ly = ey - r + 2 * r * E.lid, th = Math.acos(clamp((ey - ly) / r, -1, 1));
        g.beginPath(); g.arc(ex, ey, r, -PI / 2 - th, -PI / 2 + th); g.closePath();
        paint(g, SKIN, { lw: LW * .7 });
      }
    }
    if (E.brow) {
      g.beginPath();
      if (E.brow === 'focus') { g.moveTo(9.4, -9.2); g.lineTo(17, -7.2); }
      else if (E.brow === 'worry') { g.moveTo(9.6, -7.6); g.quadraticCurveTo(13, -8.6, 16.8, -10.8); }
      else { g.moveTo(9.4, -6.8); g.quadraticCurveTo(12.5, -8.6, 16.6, -9.4); }
      g.lineWidth = LW; g.strokeStyle = C.INK; g.stroke();
    }
    g.restore();
    if (E.sweat) {
      const k = frac(E.t * .7), ca = Math.cos(a), sa = Math.sin(a), lx = 2, ly = -17 + k * 5;
      g.globalAlpha = clamp((1 - k) * 3); sweat(g, x + lx * ca - ly * sa, y + lx * sa + ly * ca, .9); g.globalAlpha = 1;
    }
  }

  // ---- limbs -------------------------------------------------------------------------------------------
  function ik(ax, ay, bx, by, l1, l2, side) {
    let dx = bx - ax, dy = by - ay, d = Math.hypot(dx, dy);
    if (d < 1e-3) { dx = 0; dy = 1; d = 1e-3; }
    const dd = Math.min(d, l1 + l2 - .01);
    const c = clamp((l1 * l1 + dd * dd - l2 * l2) / (2 * l1 * dd), -1, 1);
    const k = Math.atan2(dy, dx) - side * Math.acos(c);
    IX = ax + Math.cos(k) * l1; IY = ay + Math.sin(k) * l1;
  }
  function tube(g, x0, y0, x1, y1, x2, y2, w, fill) {
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.lineTo(x2, y2);
    g.lineCap = 'round'; g.lineJoin = 'round';
    g.lineWidth = w + LW * 2; g.strokeStyle = C.INK; g.stroke();
    g.lineWidth = w; g.strokeStyle = fill; g.stroke();
  }
  // hind leg: scaled ham, stout shin, plantigrade foot with short claws
  function hindLeg(g, hx, hy, fx, fy, fa, far) {
    const col = far ? SC_FAR : SC, ax = fx - 1.5, ay = fy - 4.5;
    ik(hx, hy, ax, ay, 14.5, 13.5, 1); const kx = IX, ky = IY;
    g.save(); g.translate(fx, fy); g.rotate(fa);
    g.beginPath(); g.moveTo(-5.5, 0); g.quadraticCurveTo(-7, -6, -1.5, -6.8); g.quadraticCurveTo(5.5, -6.6, 8.6, -1.6);
    g.quadraticCurveTo(9.6, .4, 6, .3); g.closePath();
    paint(g, far ? FOOT_FAR : FOOT, { lw: LW * .9 });
    g.beginPath();
    g.moveTo(6.4, -3.6); g.quadraticCurveTo(10.4, -3.8, 11.8, -.4); g.quadraticCurveTo(9.4, -1.2, 7.4, -.9);
    g.moveTo(3.6, -5.6); g.quadraticCurveTo(7.6, -6.4, 9.6, -3.4); g.quadraticCurveTo(7.2, -3.8, 5, -3.2);
    paint(g, far ? CLAW_FAR : CLAW, { lw: LW * .6 });
    g.restore();
    tube(g, hx, hy, kx, ky, ax, ay, 8.5, col);
    const ta = Math.atan2(ky - hy, kx - hx);
    g.beginPath(); g.ellipse(mix(hx, kx, .4), mix(hy, ky, .4), 10, 6.8, ta, 0, TAU);
    paint(g, col, { lw: LW });
    // two shingles on the ham
    const c = Math.cos(ta), s = Math.sin(ta), mx = mix(hx, kx, .55), my = mix(hy, ky, .55);
    g.beginPath(); g.moveTo(mx - s * 6.5, my + c * 6.5); g.quadraticCurveTo(mx - s * 2 + c * 4, my + c * 2 + s * 4, mx + c * 5, my + s * 5);
    g.quadraticCurveTo(mx + s * 3 + c * 3, my - c * 3 + s * 3, mx + s * 6, my - c * 6);
    g.lineWidth = LW * .7; g.strokeStyle = C.INK; g.stroke();
  }
  // front leg: short scaled arm ending in three big sickle claws (middle one longest)
  function foreLimb(g, sx, sy, ex, ey, wx, wy, ca, curl, far) {
    tube(g, sx, sy, ex, ey, wx, wy, 7.2, far ? SC_FAR : SC);
    g.save(); g.translate(wx, wy); g.rotate(ca);
    for (const i of [-1, 1, 0]) {
      const L = i ? 9.5 : 12.5, s = i * .36, cs = Math.cos(s), sn = Math.sin(s), b = curl * L * .62;
      const r = (x, y) => { PX = x * cs - y * sn; PY = x * sn + y * cs; };
      g.beginPath();
      r(-1, -2.4); g.moveTo(PX, PY);
      r(L * .74, -2.8); const x1 = PX, y1 = PY; r(L, b); g.quadraticCurveTo(x1, y1, PX, PY);
      r(L * .5, .8 + b * .4); const x2 = PX, y2 = PY; r(-1, 2.4); g.quadraticCurveTo(x2, y2, PX, PY);
      g.closePath();
      paint(g, far ? CLAW_FAR : CLAW, { lw: LW * .7 });
    }
    g.restore();
  }

  // ---- one full figure from P (spine), J (joints), LB (limbs) and E (face) ---------------------------
  const J = { hx: [0, 0], hy: [0, 0], sx: [0, 0], sy: [0, 0] };
  const LB = { f: [[0, 0, 0], [0, 0, 0]], arm: [[0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0]], legFirst: false, cable: 0, cableLo: 0, bibU: 7.1, bibA: 0 };
  function joints() {
    spine(); columns();
    let q = at(5.5);
    J.hx[1] = q.x - q.nx * q.wv * .5; J.hy[1] = q.y - q.ny * q.wv * .5;
    J.hx[0] = J.hx[1] - 1.5; J.hy[0] = J.hy[1] - 2;
    q = at(8.7);
    J.sx[1] = q.x - q.nx * q.wv * .45; J.sy[1] = q.y - q.ny * q.wv * .45;
    J.sx[0] = J.sx[1] + q.nx * 3 + 1; J.sy[0] = J.sy[1] + q.ny * 3 - 1;
  }
  // arm from angles (upper arm a1, forearm a2, claws ca)
  function armA(k, a1, a2, ca, curl) {
    const A = LB.arm[k], ex = J.sx[k] + Math.cos(a1) * 9.5, ey = J.sy[k] + Math.sin(a1) * 9.5;
    A[0] = ex; A[1] = ey; A[2] = ex + Math.cos(a2) * 8.5; A[3] = ey + Math.sin(a2) * 8.5; A[4] = ca; A[5] = curl;
  }
  // arm reaching for a point, elbow on `side`
  function armT(k, wx, wy, side, ca, curl) {
    ik(J.sx[k], J.sy[k], wx, wy, 9.5, 8.5, side);
    const A = LB.arm[k]; A[0] = IX; A[1] = IY; A[2] = wx; A[3] = wy; A[4] = ca; A[5] = curl;
  }
  function leg(k) { const F = LB.f[k]; hindLeg(g0, J.hx[k], J.hy[k], F[0], F[1], F[2], !k); }
  function arm(k) { const A = LB.arm[k]; foreLimb(g0, J.sx[k], J.sy[k], A[0], A[1], A[2], A[3], A[4], A[5], !k); }
  let g0 = null;
  function figure(g, o) {
    g0 = g;
    leg(0); arm(0);
    if (LB.legFirst) leg(1);
    belly(g); body(g);
    if (!LB.cable) head(g, S.x[10], S.y[10], S.na + E.tilt);
    else cable(g, LB.cableLo, LB.cable, o.scale || 1);
    if (!LB.legFirst) leg(1);
    arm(1);
    if (LB.cable) head(g, S.x[10], S.y[10], S.na + E.tilt);          // riding: the face always peeks out in front
    if (o.bib) {
      const q = at(LB.bibU);
      bib(g, q.x + q.nx * 2, q.y + q.ny * 2, o.bib, { w: 17, h: 13, a: LB.bibA });
    }
  }
  // the crane cable passes in front of the rider's chest: repaint it over the body, same two strands
  function cable(g, lo, top, s) {
    g.lineCap = 'butt';
    g.beginPath(); g.moveTo(-1.2 / s, lo); g.lineTo(-1.2 / s, top); g.lineWidth = 2.2 / s; g.strokeStyle = C.INK; g.stroke();
    g.beginPath(); g.moveTo(1 / s, lo); g.lineTo(1 / s, top); g.lineWidth = 1.2 / s; g.strokeStyle = C.STEEL; g.stroke();
  }
  function faceReset(t) {
    P.tl = 1;
    E.t = t; E.look = .15; E.lookX = .35; E.wide = false; E.happy = false; E.shut = false; E.lid = .28; E.brow = '';
    E.mouth = 'smile'; E.tongue = 0; E.wag = 0; E.blush = 1; E.sweat = 0; E.tilt = 0;
    LB.legFirst = false; LB.cable = 0; LB.bibU = 7.1; LB.bibA = 0;
  }
  // shy habit: a glance back to check nobody is watching, then a quick flick of that long tongue
  function tongueHabit(t, period) {
    const p = frac(t / period);
    if (p > .7 && p < .8) E.lookX = -.7;
    if (p > .8) { const k = (p - .8) / .2; E.tongue = Math.pow(Math.sin(k * PI), .6); E.wag = Math.sin(k * TAU * 2) * .6; E.mouth = 'flat'; }
  }

  // ---- modes ---------------------------------------------------------------------------------------------
  // Gait phase in cycles. The race feeds a live speed every frame, so t * rate(speed) would make the legs
  // lurch (or run backwards) whenever speed changes late in a race: integrate the rate per racer instead,
  // keyed by bib, and fall back to t * rate on a first draw or any jump in t.
  const GAIT = {};
  function gait(o, rate) {
    const key = o.bib ? String(o.bib.n) : '-', t = o.t;
    let s = GAIT[key];
    if (!s || t < s.t || t - s.t > .25) { s = GAIT[key] = { t, p: t * rate }; }
    else { s.p = (s.p + (t - s.t) * rate) % 4; s.t = t; }        // every gait/roll curve repeats within 4 cycles
    return s.p;
  }
  // bipedal waddle: hind legs only, claws tucked, tail out behind as a counterweight
  function walk(g, o, sp, hunch, ph) {
    const t = o.t, q = ph * TAU, c2 = Math.cos(2 * q);
    const bob = (1.2 + sp * 1.4) * c2;
    shadow(g, 76);
    faceReset(t);
    P.x = -14 + hunch * 3; P.y = -32 + bob + hunch * 4;
    P.a = -.72 + sp * .06 + .04 * Math.sin(q) + hunch * .15;
    P.bend = .09 + hunch * .2; P.neck = .36 + .1 * Math.sin(2 * q - 1.2) + hunch * .7;
    P.st = 1 - .05 * c2; P.wk = 1 + .045 * c2;
    P.ta = PI - .3 - .06 * c2 - hunch * .3;
    const sw = .05 + sp * .05;
    for (let i = 0; i < 5; i++) P.tb[i] = (i ? .09 : 0) + sw * Math.sin(2 * q - 1 - i * .85) + hunch * .12;
    joints();
    const A = 3.5 + sp * 6, lift = 3 + sp * 4.5;
    for (let k = 0; k < 2; k++) {
      const qq = q + (k ? 0 : PI), s = Math.sin(qq), F = LB.f[k];
      F[0] = 2 - A * Math.cos(qq); F[1] = -lift * Math.max(0, s); F[2] = s > 0 ? .4 * s : 0;
    }
    for (let k = 0; k < 2; k++) {
      const sw2 = .2 * Math.sin(2 * q - 1.6 + k * .7);
      armA(k, 1.3 + sw2 - hunch * .4, -.3 + sw2 * 1.4 - hunch * .5, 1.95 + sw2, 1.15);
    }
    const effort = clamp((sp - .95) / .3);
    E.tilt = .12 + .06 * Math.sin(2 * q - 1.9) + hunch * .3; E.look = .1; E.lookX = .5;
    if (effort > .4) { E.brow = 'focus'; E.lid = .18; E.mouth = 'flat'; E.tongue = .16 * effort; E.wag = Math.sin(q * 2) * .5; }
    E.blush = 1 + effort * .3;
    LB.bibA = -.25;
    figure(g, o);
  }
  // sentinel stance: upright on the hind legs, tail on the ground as a prop, claws clasped at the chest
  function idle(g, o) {
    const t = o.t, b = cyc(t, .45);
    shadow(g, 70);
    faceReset(t);
    P.x = -8; P.y = -21 + b * .6;
    P.a = -1.3; P.bend = .08; P.neck = .95 + .06 * cyc(t, .23);
    P.st = 1 + .012 * b; P.wk = 1 + .03 * b;
    P.ta = 2.3; P.tb[0] = 0; P.tb[1] = .4; P.tb[2] = .35; P.tb[3] = .15; P.tb[4] = .2 + .12 * cyc(t, .6);
    joints();
    LB.f[0][0] = -3; LB.f[0][1] = 0; LB.f[0][2] = 0; LB.f[1][0] = 4; LB.f[1][1] = 0; LB.f[1][2] = 0;
    const tw = cyc(t, 1.1);
    armA(0, 1.3, -.45, .75 - tw * .12, .95);
    armA(1, 1.25, -.5, .7 + tw * .15, .95);
    E.look = .35; E.lookX = .15; E.lid = .3;
    E.tilt = .05 * Math.sin(t * TAU * .23 + 1);
    tongueHabit(t, 3.4);
    LB.bibA = -.08;
    figure(g, o);
  }
  // victory hop: crouch, spring, claws flung up, tail flicked up behind
  function cheer(g, o) {
    const t = o.t, p = frac(t / .95);
    let lift = 0, sq = 0;
    if (p < .2) sq = Math.sin(p / .2 * PI);
    else if (p < .8) lift = Math.sin((p - .2) / .6 * PI) * 24;
    else sq = .8 * Math.sin((p - .8) / .2 * PI);
    const air = lift / 24;
    shadow(g, 64, lift);
    g.save(); g.translate(0, -lift);
    faceReset(t);
    P.x = -7; P.y = -21 + sq * 4;
    P.a = -1.42; P.bend = .04; P.neck = 1 - air * .15;
    P.st = 1 - .1 * sq + .05 * air; P.wk = 1 + .08 * sq - .02 * air;
    P.ta = 2.55 - air * .3;
    for (let i = 0; i < 5; i++) P.tb[i] = (i ? .32 + air * .12 : 0) + .1 * Math.sin(t * TAU * 1.05 - i * .7);
    joints();
    for (let k = 0; k < 2; k++) {
      const F = LB.f[k]; F[0] = k ? 4 + air * 2 : -3 + air * 2; F[1] = -air * 6; F[2] = air * .5;
      const w = .3 * Math.sin(t * TAU * 2.1 + k * 1.3);
      if (k) armA(1, -1.6 - air * .2 + w * .25, -1.85 + w, -1.75 + w, .3);       // near claw punched straight up
      else armA(0, -2.3 - air * .2 + w * .3, -2.1 + w, -1.95 + w, .3);          // far claw flung up behind
    }
    E.happy = true; E.mouth = 'grin'; E.tongue = 0; E.blush = 1.35; E.tilt = -.12 + .06 * cyc(t, 2.1);
    LB.bibA = .1 * cyc(t, 1.05);
    figure(g, o);
    g.restore();
  }
  // half-curled on its haunches, back rounded, tail tucked into a tight hook, face hidden behind the claws, peeking
  function worry(g, o) {
    const t = o.t, sh = cyc(t, 9) * .55;
    shadow(g, 66);
    faceReset(t);
    g.save(); g.translate(sh, 0);
    P.x = -10; P.y = -19;
    P.a = -1.15; P.bend = .33; P.neck = .95 + .04 * cyc(t, 1.3);
    P.st = .96; P.wk = 1.04;
    P.ta = 2.6; P.tb[0] = 0; P.tb[1] = .35; P.tb[2] = .4; P.tb[3] = .45; P.tb[4] = .5 + .1 * cyc(t, 1.7);
    joints();
    LB.f[0][0] = 3; LB.f[0][1] = 0; LB.f[0][2] = 0; LB.f[1][0] = 8; LB.f[1][1] = 0; LB.f[1][2] = 0;
    // claws over the face: wrist under the eye, claws raised across the snout
    const ha = S.na + .1, hc = Math.cos(ha), hs = Math.sin(ha), nx = S.x[10], ny = S.y[10];
    const tap = cyc(t, 2.6);
    armT(0, nx + 21 * hc - 5 * hs, ny + 21 * hs + 5 * hc, -1, ha - 1.9, .5);
    armT(1, nx + 17 * hc - 7.5 * hs, ny + 17 * hs + 7.5 * hc, -1, ha - 1.45 + tap * .1, .45);
    E.tilt = .1; E.wide = true; E.lid = 0; E.brow = 'worry'; E.mouth = 'wobble'; E.sweat = 1;
    E.look = -.2; E.lookX = .7 * cyc(t, .8); E.blush = 1.3;
    LB.bibU = 6.6; LB.bibA = -.2;
    figure(g, o);
    g.restore();
  }
  // riding: sat on the hub curled round the cable, belly to it and claws hooked round it like a tree
  // trunk, tail hung over the end of the hub, face peeking out past the cable at the cans
  function ride(g, o) {
    const t = o.t, em = o.emotion || 'focus', look = clamp(o.look || 0, -1, 1), b = cyc(t, .5);
    faceReset(t);
    g.save();
    if (em === 'worry') g.translate(cyc(t, 10) * .5, 0);
    const up = em === 'cheer' ? 3.5 * Math.abs(cyc(t, 1.6)) : 0;
    const sad = em === 'sad' ? 1 : 0, tight = em === 'worry' ? 1 : 0;
    P.x = -19 - tight * 1.5; P.y = -12 - up;
    P.a = -1.45 - up * .01; P.bend = .1 + tight * .05 + sad * .06;
    P.neck = .55 - tight * .1 + sad * .15 + .03 * b;
    P.st = 1 + .012 * b; P.wk = 1 + .02 * b;
    // tail hung over the end of the hub as a counterweight, tip curled
    const tw = .07 * cyc(t, .6);
    P.tl = .85; P.ta = 2.45; P.tb[0] = 0; P.tb[1] = -.55; P.tb[2] = -.25 + tw; P.tb[3] = .35 + tw; P.tb[4] = .6 + tw * 1.5;
    joints();
    LB.cable = -78 - up; LB.cableLo = -2; LB.bibU = 6.4; LB.bibA = -.08;
    LB.f[0][0] = 0; LB.f[0][1] = 0; LB.f[0][2] = 0; LB.f[1][0] = 5; LB.f[1][1] = 0; LB.f[1][2] = 0;
    if (em === 'cheer') {                                        // lets go with both claws; the tail holds on
      const w = .3 * cyc(t, 2.2);
      armA(0, -2.35 + w * .3, -1.9 + w, -1.8 + w, .3);
      armA(1, -1.95 - w * .3, -1.5 - w, -1.35 - w, .3);
    } else {
      const grip = sad ? .55 : 1.1, sl = sad * 4 - tight * 2;
      armT(0, 7.5, -44 + sl, 1, 2.95 + sad * .3, grip);
      armT(1, 8.5, -33 + sl, 1, 2.85 + sad * .3, grip);
    }
    E.tilt = .25 + look * (look > 0 ? 1.05 : .6) + sad * .2 - tight * .15; E.look = clamp(.15 + look * .85, -1, 1); E.lookX = .45;
    if (em === 'focus') { E.brow = 'focus'; E.lid = .2; E.mouth = 'flat'; E.tongue = .13; E.wag = cyc(t, .9) * .4; }
    else if (em === 'worry') { E.wide = true; E.lid = 0; E.brow = 'worry'; E.mouth = 'wobble'; E.sweat = 1; E.blush = 1.3; }
    else if (em === 'cheer') { E.happy = true; E.mouth = 'grin'; E.blush = 1.4; E.tilt -= .25; }
    else { E.lid = .62; E.brow = 'sad'; E.mouth = 'frown'; E.look = clamp(E.look + .3, -1, 1); E.blush = .7; }
    figure(g, o);
    g.restore();
  }

  // ---- flat out: rolled into a scaly ball ---------------------------------------------------------------
  const BR = 27, BN = 12, BRIN = 7.5, BH = (BR - BRIN) / 2.5;
  function bp(th, a, r) { const q = th + a / Math.max(r, 3); PX = Math.cos(q) * r; PY = Math.sin(q) * r; }
  function bq(g, th, ca, cr, a, r) { bp(th, ca, cr); const x = PX, y = PY; bp(th, a, r); g.quadraticCurveTo(x, y, PX, PY); }
  const btip = r => Math.min(8.5, .7 * r * TAU / BN);
  // outline: a proud tip on every other column (the ones whose top scale sits on the rim)
  function ring(g, ang) {
    const tt = btip(BR) / BR;
    g.beginPath();
    for (let k = 0; k <= BN; k += 2) {
      const th = ang + k * TAU / BN, ua = th - tt - .07, ux = Math.cos(ua) * (BR - 2.4), uy = Math.sin(ua) * (BR - 2.4);
      if (!k) g.moveTo(ux, uy);
      else { const ma = th - TAU / BN - tt; g.quadraticCurveTo(Math.cos(ma) * (BR + 4.2), Math.sin(ma) * (BR + 4.2), ux, uy); }
      if (k < BN) g.lineTo(Math.cos(th - tt) * (BR + .8), Math.sin(th - tt) * (BR + .8));
    }
    g.closePath();
  }
  function ball(g, o, sp, ph) {
    const t = o.t, ang = ph * TAU * .75;                    // clockwise: rolling toward +x
    const hop = 2.4 * Math.abs(Math.sin(ang * .5)), sq = clamp(1 - hop / .9);
    shadow(g, 56, hop * 3);
    // speed ticks
    g.lineCap = 'round'; g.lineWidth = 2; g.strokeStyle = 'rgba(28,27,31,.45)';
    g.beginPath();
    for (let i = 0; i < 3; i++) {
      const y = -BR - hop + (i - 1) * 12, l = 9 + 7 * (.5 + .5 * Math.sin(t * 11 + i * 2.3)), x = -BR - 6 - (i % 2) * 4;
      g.moveTo(x, y); g.lineTo(x - l, y);
    }
    g.stroke();
    g.save(); g.translate(0, -hop); g.scale(1 + .06 * sq, 1 - .07 * sq); g.translate(0, -BR);
    // toothed rim (one proud scale tip per column), then the same shingle lattice as the body, radially
    ring(g, ang); g.fillStyle = SC; g.fill();
    g.save(); g.clip();
    g.beginPath();
    for (let k = 0; k < BN; k++) {
      const th = ang + k * TAU / BN, off = k & 1 ? .5 : 0;
      for (let j = 0; j < 2; j++) {
        const r = BR - (j + off) * BH, tp = btip(r), d = Math.min(3.4, tp * .5);
        bp(th, 0, r + BH * .5); g.moveTo(PX, PY);
        bq(g, th, -tp * .8, r + BH * .42, -tp, r);
        bq(g, th, -tp * .8, r - BH * .42, 0, r - BH * .5);
        bq(g, th, 2 * (d - tp), r, 0, r + BH * .5);
      }
    }
    g.fillStyle = RIM; g.fill();
    g.beginPath();
    for (let k = 0; k < BN; k++) {
      const th = ang + k * TAU / BN, off = k & 1 ? .5 : 0;
      bp(th, 0, BR + (.5 - off) * BH); g.moveTo(PX, PY);
      for (let r = BR - off * BH; r > BRIN - BH * .3; r -= BH) {
        const tp = btip(r);
        bq(g, th, -tp * .8, r + BH * .42, -tp, r);
        bq(g, th, -tp * .8, r - BH * .42, 0, r - BH * .5);
      }
    }
    g.lineCap = 'round'; g.lineJoin = 'round'; g.lineWidth = LW * .75; g.strokeStyle = C.INK; g.stroke();
    sheen(g, -BR * .36, -BR * .42, 9, 6.5, .5);
    g.restore();
    ring(g, ang);
    g.save(); g.rotate(-.5); paint(g, 'rgba(0,0,0,0)', { shadeFrom: 5, lw: LW }); g.restore();
    // the tail, wrapped round the outside, tips pointing to its own tip
    const tb = ang + 1.1, span = 3.5, n = 7;
    g.beginPath();
    for (let i = 0; i <= n; i++) {
      const s = i / n, th = tb - span * s, ro = BR + 6 - 5.5 * s;
      if (!i) { g.moveTo(Math.cos(th) * (BR - 3), Math.sin(th) * (BR - 3)); continue; }
      const pth = tb - span * (i - .5) / n;
      g.quadraticCurveTo(Math.cos(pth) * (ro + 3.5), Math.sin(pth) * (ro + 3.5), Math.cos(th) * (ro + .8), Math.sin(th) * (ro + .8));
      if (i < n) g.lineTo(Math.cos(th + .07) * (ro - 1.8), Math.sin(th + .07) * (ro - 1.8));
    }
    const tipTh = tb - span;
    g.lineTo(Math.cos(tipTh - .12) * (BR - .5), Math.sin(tipTh - .12) * (BR - .5));
    for (let i = n; i >= 0; i--) {
      const s = i / n, th = tb - span * s, w = 13 * Math.min(1, s / .12 + .15) * Math.pow(1 - s, .8) + 1.5, ri = BR + 6 - 5.5 * s - w;
      g.lineTo(Math.cos(th) * ri, Math.sin(th) * ri);
    }
    g.closePath();
    paint(g, SC, { lw: LW });
    g.beginPath();
    for (let i = 1; i < n; i++) {
      const s = i / n, th = tb - span * s, ro = BR + 6 - 5.5 * s, w = 13 * Math.min(1, s / .12 + .15) * Math.pow(1 - s, .8) + 1.5;
      const ri = ro - w, rm = (ro + ri) / 2, tp = .18;
      g.moveTo(Math.cos(th) * (ro + .8), Math.sin(th) * (ro + .8));
      g.quadraticCurveTo(Math.cos(th + tp * .8) * (ro - w * .2), Math.sin(th + tp * .8) * (ro - w * .2), Math.cos(th + tp) * rm, Math.sin(th + tp) * rm);
      g.quadraticCurveTo(Math.cos(th + tp * .8) * (ri + w * .2), Math.sin(th + tp * .8) * (ri + w * .2), Math.cos(th) * ri, Math.sin(th) * ri);
    }
    g.lineWidth = LW * .75; g.strokeStyle = C.INK; g.stroke();
    // a peek out from under the tail tip
    const pe = tipTh - .42, pr = BR - 10, px = Math.cos(pe) * pr, py = Math.sin(pe) * pr;
    g.beginPath(); g.ellipse(px, py, 6.2, 4.8, pe + PI / 2, 0, TAU); paint(g, GAP, { lw: LW * .8 });
    eye(g, px, py, 2.7, { t, look: .1, lookX: .8, seed: .4 });
    // tucked centre
    g.beginPath(); g.moveTo(0, 0);
    for (let i = 1; i <= 8; i++) { const a = ang + i * .75, r = i * .85; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    g.lineWidth = LW * .8; g.strokeStyle = C.INK; g.stroke();
    if (o.bib) bib(g, 0, 1, o.bib, { w: 17, h: 13, a: .12 * Math.sin(t * 3.1) });
    g.restore();
  }
  // cartoon dust cloud that hides the change between walking and rolling
  function puff(g, k, t) {
    const e = ease(clamp(k * 1.7));
    for (let pass = 0; pass < 2; pass++) {
      g.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = i / 8 * TAU + t * 2.4, r = (10 + 4 * Math.sin(t * 8 + i * 1.9)) * e + (pass ? 0 : LW);
        const x = Math.cos(a) * 25 * e, y = -34 + Math.sin(a) * 19 * e;
        g.moveTo(x + r, y); g.arc(x, y, r, 0, TAU);
      }
      const r0 = 22 * e + (pass ? 0 : LW);
      g.moveTo(r0, -34); g.arc(0, -34, r0, 0, TAU);
      g.fillStyle = pass ? C.CREAM : C.INK; g.fill();
    }
    g.globalAlpha = e;
    g.beginPath();
    for (let i = 0; i < 4; i++) {
      const a = i * 1.7 + t * 5, r = 30 + 10 * frac(t * 2 + i * .3);
      g.moveTo(Math.cos(a) * r, -34 + Math.sin(a) * r * .8); g.lineTo(Math.cos(a) * (r + 6), -34 + Math.sin(a) * (r + 6) * .8);
    }
    g.lineWidth = 2; g.lineCap = 'round'; g.strokeStyle = C.INK; g.stroke();
    g.globalAlpha = 1;
  }

  function draw(g, o) {
    const s = o.scale || 1;
    g.save(); g.scale(s, s);
    const mode = o.mode || 'idle';
    if (mode === 'run') {
      const sp = clamp(o.speed == null ? 1 : o.speed, .2, 1.6);
      const pf = clamp(1 - Math.abs(sp - 1.3) / .07);
      const ph = gait(o, .8 + sp * 1.25);
      if (sp < 1.3) walk(g, o, sp, ease(pf), ph); else ball(g, o, sp, ph);
      if (pf > 0) puff(g, pf, o.t);
    } else if (mode === 'ride') ride(g, o);
    else if (mode === 'cheer') cheer(g, o);
    else if (mode === 'worry') worry(g, o);
    else idle(g, o);
    g.restore();
  }

  AKIT.register({
    key: 'pangolin', name: 'Sunda pangolin', status: 'Critically Endangered',
    fact: 'Pangolins are the only mammals covered in scales, made of keratin like our nails.',
    draw,
  });
})();
