// Sunda pangolin (Manis javanica). The coat is the whole identity, so it is built on a bendable spine:
// columns of proud, straw-edged keratin scales run from tail tip to nape, and the same coat works
// upright on the hind legs, half-curled round the crane cable, and rolled into a ball at full tilt.
// Personality: shy and gentle. Heavy-lidded eyes and a blush, front claws clasped at the chest, a long
// tongue it flicks out only after a glance to check nobody is looking, and when frightened it hides
// its face behind its claws. On the crane it sits hugging the cable, claws hooked round it, and peeks.
//
// Modelled, not outlined: a glossy enamel figure under the game's one lamp (ART.LIGHT). Every colour
// below is an albedo that the lamp and the room light turn into a shade from the surface normal, the way
// the roulette's wood and tin are lit. The coat is a lit barrel that follows the spine; every plate has a
// straw lip inside its free edge and throws a crevice shadow past it onto the plate beneath, so the columns
// read as overlapping shingles, and the plates facing the lamp carry a hard glint. Limbs are lit tubes,
// the head is a lit cone round the snout tip, the rolled-up ball is one lit sphere.
(() => {
  const { TAU, cyc, ease, cast, ao, eye3d } = AKIT;
  const PI = Math.PI;

  // albedos: olive-brown keratin with straw edges, pink-grey bare skin, horn claws
  const SC = [206, 150, 72], SC_F = [158, 114, 58], RIM = [244, 214, 150];
  const SKIN = [252, 206, 188], FOOT = [210, 152, 134], FOOT_F = [160, 114, 102];
  const CLAW = [252, 238, 206], CLAW_F = [204, 186, 150], NOSE = [92, 58, 50], TONGUE = [248, 118, 142], DUST = [238, 224, 198];
  // materials: [ambient, diffuse, specular, its tightness, ambient colour]. Keratin takes the cool room light in
  // its shadows like the roulette's wood; skin and horn are translucent, so their shadows stay warm.
  const ROOM = [.52, .56, .66], WARM = [.66, .5, .47], IVORY = [.66, .6, .52];
  const M_SC = [.5, .8, .14, 12, ROOM], M_RIM = [.55, .8, .1, 8, ROOM], M_SKIN = [.8, .62, .07, 5, WARM], M_HORN = [.74, .6, .38, 16, IVORY];
  const M_NOSE = [.7, .5, .55, 30, WARM], M_DUST = [.9, .42, 0, 1, IVORY], M_HAM = [.5, .8, .05, 8, ROOM];
  const EDGE = 'rgba(20,15,20,.55)', CREVICE = 'rgba(30,14,6,.46)';

  const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
  const mix = (a, b, k) => a + (b - a) * k;
  const frac = x => x - Math.floor(x);
  let PX = 0, PY = 0, IX = 0, IY = 0, OX = 0, OY = 0;

  // ---- the lamp, expressed in whatever frame we are drawing in -------------------------------------------
  const WL = (() => {
    const l = (window.ART && ART.LIGHT) || AKIT.LIGHT || { x: -.35, y: -.8, z: .5 }, n = Math.hypot(l.x, l.y, l.z) || 1;
    return [l.x / n, l.y / n, l.z / n];
  })();
  const LAMP = [1, .914, .769];
  let LX = WL[0], LY = WL[1], LZ = WL[2], HX = 0, HY = 0, HZ = 1, ZOOM = 1;
  function half() { const hz = LZ + 1, n = Math.hypot(LX, LY, hz); HX = LX / n; HY = LY / n; HZ = hz / n; }
  half();
  // read the canvas transform once per draw: the lamp stays put on screen however the caller rotates us
  function frame(g) {
    const m = g.getTransform && g.getTransform();
    let a = 1, b = 0, c = 0, d = 1;
    if (m && typeof m.a === 'number') { a = m.a; b = m.b; c = m.c; d = m.d; }
    const det = a * d - b * c || 1;
    const lx = (d * WL[0] - c * WL[1]) / det, ly = (-b * WL[0] + a * WL[1]) / det;
    const k = Math.hypot(WL[0], WL[1]) / (Math.hypot(lx, ly) || 1);
    LX = lx * k; LY = ly * k; LZ = WL[2]; half();
    ZOOM = Math.sqrt(Math.abs(det));
  }
  // after g.rotate(r) the lamp turns by -r in the new frame
  function turn(r) { const c = Math.cos(r), s = Math.sin(r), x = LX * c + LY * s, y = -LX * s + LY * c; LX = x; LY = y; half(); }
  // albedo lit from unit normal n: warm lamp on the facing side, the material's ambient everywhere, a broad specular lobe
  const RGB = [0, 0, 0];
  function shadeN(alb, nx, ny, nz, m) {
    const d = nx * LX + ny * LY + nz * LZ, h = nx * HX + ny * HY + nz * HZ;
    const df = d > 0 ? m[1] * d : 0, sp = h > 0 ? m[2] * Math.pow(h, m[3]) * 255 : 0, A = m[4];
    for (let i = 0; i < 3; i++) RGB[i] = alb[i] * (m[0] * A[i] + df * LAMP[i]) + sp * LAMP[i];
    return RGB;
  }
  const css = (r, g, b) => 'rgb(' + (r > 255 ? 255 : r | 0) + ',' + (g > 255 ? 255 : g | 0) + ',' + (b > 255 ? 255 : b | 0) + ')';
  function lit(alb, nx, ny, nz, m) { const c = shadeN(alb, nx, ny, nz, m); return css(c[0], c[1], c[2]); }
  // a round form of radius r at (cx, cy): a radial gradient sampled from the lit model. Each ring of the gradient
  // takes its colour mostly from where it crosses the lamp axis on the far side, a little from the lit side.
  const SF = [0, .18, .38, .56, .72, .86, 1], SW = [[-1, .62], [1, .38]];
  function sph(g, cx, cy, r, alb, m) {
    const ll = Math.hypot(LX, LY) || 1, ux = LX / ll, uy = LY / ll;
    const x0 = cx + ux * r * .42, y0 = cy + uy * r * .42, r0 = r * .08, x1 = cx - ux * r * .12, y1 = cy - uy * r * .12, r1 = r * 1.1;
    const gr = g.createRadialGradient(x0, y0, r0, x1, y1, r1);
    for (const f of SF) {
      const ccx = mix(x0, x1, f) - cx, ccy = mix(y0, y1, f) - cy, rr = mix(r0, r1, f);
      let R = 0, G = 0, B = 0;
      for (const [sgn, w] of SW) {
        let nx = (ccx + sgn * ux * rr) / r, ny = (ccy + sgn * uy * rr) / r;
        const q = nx * nx + ny * ny; if (q > 1) { const k = 1 / Math.sqrt(q); nx *= k; ny *= k; }
        const c = shadeN(alb, nx, ny, Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny)), m); R += c[0] * w; G += c[1] * w; B += c[2] * w;
      }
      gr.addColorStop(f, css(R, G, B));
    }
    return gr;
  }
  // a tube lit across its width: from (x0,y0) on one flank to (x1,y1) on the other, normals s*u + sqrt(1-s^2)*z
  const SL = [-1, -.6, -.2, .2, .6, 1];
  function across(g, x0, y0, x1, y1, alb, m) {
    const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l;
    const gr = g.createLinearGradient(x0, y0, x1, y1);
    for (const s of SL) gr.addColorStop((s + 1) / 2, lit(alb, s * ux, s * uy, Math.sqrt(1 - s * s), m));
    return gr;
  }
  function edge(g, w) { g.lineWidth = w; g.strokeStyle = EDGE; g.lineJoin = 'round'; g.lineCap = 'round'; g.stroke(); }
  function rr(g, x, y, w, h, r) { g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h); }

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
  const K = { x: [], y: [], tx: [], ty: [], nx: [], ny: [], top: [], bot: [], wv: [], tip: [], h: [], off: [], gap: [] };
  function columns() {
    for (let c = 0; c < NC; c++) {
      const u = COLS[c], q = at(u), tail = c < BODY0;
      K.x[c] = q.x; K.y[c] = q.y; K.tx[c] = q.tx; K.ty[c] = q.ty; K.nx[c] = q.nx; K.ny[c] = q.ny; K.wv[c] = q.wv;
      const bot = tail ? q.wv : q.wv * mix(.7, .45, clamp((u - 5.7) / 1.4));
      const span = q.wd + bot, rows = tail ? Math.max(1, Math.round(span / 10.5)) : 3;
      K.top[c] = q.wd; K.bot[c] = bot; K.h[c] = span / rows; K.off[c] = c & 1 ? .5 : 0;   // odd columns sit half a scale lower
      K.tip[c] = 3 + 4 * clamp(q.wd / 22);
    }
    for (let c = 0; c < NC; c++) K.gap[c] = c < NC - 1 ? Math.hypot(K.x[c + 1] - K.x[c], K.y[c + 1] - K.y[c]) : 12;
  }
  // point in a column's frame: a = along (+ toward the head), v = across (+ toward the back); OX/OY shift it
  function cp(c, a, v) { PX = K.x[c] + K.tx[c] * a + K.nx[c] * v + OX; PY = K.y[c] + K.ty[c] * a + K.ny[c] * v + OY; }
  function cq(g, c, ca, cv, a, v) { cp(c, ca, cv); const x = PX, y = PY; cp(c, a, v); g.quadraticCurveTo(x, y, PX, PY); }
  // across-body shading for column c: a cylinder from the belly edge (s = -1) to the ridge (s = +1)
  const SS = [-1, -.6, -.15, .3, .7, 1];
  function colGrad(g, c, alb, m) {
    const x = K.x[c], y = K.y[c], nx = K.nx[c], ny = K.ny[c], wv = K.wv[c], wd = K.top[c], sp = wv + wd;
    const gr = g.createLinearGradient(x - nx * wv, y - ny * wv, x + nx * wd, y + ny * wd);
    for (const s of SS) gr.addColorStop(s < 0 ? (1 + s) * wv / sp : (wv + s * wd) / sp, lit(alb, s * nx, s * ny, Math.sqrt(1 - s * s), m));
    return gr;
  }

  // silhouette: a serrated back and tail (a proud scale tip on every other column), a skirt on the belly side
  function bodyPath(g) {
    g.beginPath();
    let q = at(0), px = q.x - q.tx * 3.5, py = q.y - q.ty * 3.5;
    const x0 = px, y0 = py;
    g.moveTo(px, py);
    for (let c = 0; c < NC; c += 2) {
      const tip = K.tip[c], top = K.top[c];
      if (c) {
        cp(c, -tip - 1.6, top - 2.2); const ux = PX, uy = PY;
        g.quadraticCurveTo((px + ux) / 2 + K.nx[c] * 3.4, (py + uy) / 2 + K.ny[c] * 3.4, ux, uy);
        cp(c, -tip, top + .8); g.lineTo(PX, PY);
      } else { cp(c, -tip, top + .8); g.quadraticCurveTo((px + PX) / 2 + K.nx[c], (py + PY) / 2 + K.ny[c], PX, PY); }   // a pointed tail tip
      px = PX; py = PY;
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
      if (c) { cp(c, -tip - 1.6, -bot + 2.2); g.lineTo(PX, PY); }
      px = PX; py = PY;
    }
    q = at(0);
    g.quadraticCurveTo((px + x0) / 2 - q.nx * 2, (py + y0) / 2 - q.ny * 2, x0, y0);
    g.closePath();
  }
  // Each plate's free edge is two arcs, (0, v+h/2) -> tip (-tip, v) -> (0, v-h/2). A half is only used when it
  // lies inside the silhouette, so lips and crevices can be laid without a clip.
  function halves(c, v, h) {
    const top = K.top[c] + .8, bot = -K.bot[c] - .8;
    return (v >= bot && v + h * .5 <= top ? 1 : 0) | (v <= top && v - h * .5 >= bot ? 2 : 0);
  }
  // the straw lip inside every free edge of a column (appends to the current path)
  function lipPath(g, c) {
    const tip = K.tip[c], h = K.h[c], d = Math.min(2.4, tip * .36) - tip, lo = -K.bot[c] - h;
    for (let v = K.top[c] - K.off[c] * h; v > lo; v -= h) {
      const k = halves(c, v, h); if (!k) continue;
      if (k & 1) { cp(c, 0, v + h * .5); g.moveTo(PX, PY); cq(g, c, -tip * .8, v + h * .42, -tip, v); } else { cp(c, -tip, v); g.moveTo(PX, PY); }
      if (k & 2) { cq(g, c, -tip * .8, v - h * .42, 0, v - h * .5); cq(g, c, d, v - h * .25, d, v); } else { cp(c, d, v); g.lineTo(PX, PY); }
      if (k & 1) cq(g, c, d, v + h * .25, 0, v + h * .5);
      g.closePath();
    }
  }
  // the crevice just past every free edge, on the plate beneath: the edge and its copy pushed tail-ward and away
  // from the lamp (appends to the current path)
  function crevPath(g, c) {
    const tip = K.tip[c], h = K.h[c], lo = -K.bot[c] - h, dx = -K.tx[c] * 1.5 - LX * .7, dy = -K.ty[c] * 1.5 - LY * .7;
    for (let v = K.top[c] - K.off[c] * h; v > lo; v -= h) {
      const k = halves(c, v, h); if (!k) continue;
      if (k & 1) { cp(c, 0, v + h * .5); g.moveTo(PX, PY); cq(g, c, -tip * .8, v + h * .42, -tip, v); } else { cp(c, -tip, v); g.moveTo(PX, PY); }
      if (k & 2) cq(g, c, -tip * .8, v - h * .42, 0, v - h * .5);
      OX = dx; OY = dy;
      if (k & 2) { cp(c, 0, v - h * .5); g.lineTo(PX, PY); cq(g, c, -tip * .8, v - h * .42, -tip, v); } else { cp(c, -tip, v); g.lineTo(PX, PY); }
      if (k & 1) cq(g, c, -tip * .8, v + h * .42, 0, v + h * .5);
      OX = OY = 0;
      g.closePath();
    }
  }
  // Coat groups: runs of columns whose spine normal stays within ~20 degrees share one across-body gradient.
  // A group begins at its first column's free edges, so wherever two gradients meet there is a real plate edge.
  const GRP = [];
  function groupCols() {
    GRP.length = 0; GRP.push(0);
    let c0 = 0;
    for (let c = 1; c < NC; c++) if (c - c0 >= 7 || K.nx[c] * K.nx[c0] + K.ny[c] * K.ny[c0] < .94) { GRP.push(c); c0 = c; }
    GRP.push(NC);
  }
  // the region a group covers: its first column's zigzag, then round the outside of the silhouette to its end
  function groupPath(g, a, b) {
    const e = b < NC ? b : NC - 1, F = b < NC ? 2.5 : 18, h = K.h[a], lo = -K.bot[a] - h * .6;
    let v = K.top[a] - K.off[a] * h;
    g.beginPath();
    cp(a, 0, K.top[a] + 14); g.moveTo(PX, PY);
    cp(a, 0, v + h * .5); g.lineTo(PX, PY);
    for (; v > lo; v -= h) { cq(g, a, -K.tip[a] * .8, v + h * .42, -K.tip[a], v); cq(g, a, -K.tip[a] * .8, v - h * .42, 0, v - h * .5); }
    cp(a, 0, -K.wv[a] - 10); g.lineTo(PX, PY);
    for (let c = a + 1; c <= e; c++) { cp(c, c === e ? F : 0, -K.wv[c] - 10); g.lineTo(PX, PY); }
    for (let c = e; c > a; c--) { cp(c, c === e ? F : 0, K.top[c] + 14); g.lineTo(PX, PY); }
    g.closePath();
  }
  // lamp glints: a small hard oval on each plate, strongest where the plate faces the half vector
  const GL = [[], []];
  function glints(g) {
    for (const b of GL) b.length = 0;
    for (let c = 0; c < NC; c++) {
      const tip = K.tip[c], h = K.h[c], nx = K.nx[c], ny = K.ny[c], wd = K.top[c], wv = K.wv[c], lo = -K.bot[c] + h * .25;
      const la = LX * K.tx[c] + LY * K.ty[c], lv = LX * nx + LY * ny, a = (K.gap[c] - tip) * .5 - 1.2 + la * 1.6;
      for (let v = K.top[c] - K.off[c] * h; v > lo; v -= h) {
        const s = clamp(v > 0 ? v / wd : v / wv, -1, 1), q = Math.sqrt(1 - s * s), gv = v + lv * h * .22;
        const hd = s * (nx * HX + ny * HY) + q * HZ;
        if (hd < .8 || gv > wd - 1.5 || gv < -K.bot[c] + 1.5) continue;
        const I = Math.pow(hd, 14);
        GL[I > .6 ? 0 : 1].push(c, a, gv);
      }
    }
    const al = [.52, .26];
    for (let b = 0; b < 2; b++) {
      const L = GL[b]; if (!L.length) continue;
      g.beginPath();
      for (let i = 0; i < L.length; i += 3) {
        const c = L[i], h = K.h[c], ro = Math.atan2(K.ty[c], K.tx[c]) + .5; cp(c, L[i + 1], L[i + 2]);
        g.moveTo(PX + Math.cos(ro) * h * .17, PY + Math.sin(ro) * h * .17); g.ellipse(PX, PY, h * .17, h * .075, ro, 0, TAU);
      }
      g.fillStyle = `rgba(255,251,240,${al[b]})`; g.fill();
    }
  }
  const BU = [5.4, 6.2, 7.1, 8, 8.9, 9.7], BX = [], BY = [];
  function bellyPath(g) {
    for (let i = 0; i < BU.length; i++) { const q = at(BU[i]); BX[i] = q.x - q.nx * q.wv; BY[i] = q.y - q.ny * q.wv; }
    g.beginPath();
    let q = at(5.1); g.moveTo(q.x, q.y); g.lineTo(BX[0], BY[0]);
    for (let i = 1; i < BU.length - 1; i++) g.quadraticCurveTo(BX[i], BY[i], (BX[i] + BX[i + 1]) / 2, (BY[i] + BY[i + 1]) / 2);
    g.lineTo(BX[BU.length - 1], BY[BU.length - 1]);
    q = at(10); g.lineTo(q.x, q.y); g.closePath();
  }
  // bare pink belly, lit as the underside of the barrel, with the scale skirt's shadow along its top
  function belly(g) {
    bellyPath(g);
    const q = at(7.6), x = q.x, y = q.y, nx = q.nx, ny = q.ny, w = q.wv;
    const gr = g.createLinearGradient(x - nx * w, y - ny * w, x, y);
    for (const s of [-1, -.75, -.45, -.15, 0]) gr.addColorStop(1 + s, lit(SKIN, s * nx, s * ny, Math.sqrt(1 - s * s), M_SKIN));
    g.fillStyle = gr; g.fill(); edge(g, .8);
    // the scale skirt's shadow along the top of the belly (the coat, drawn next, covers the upper half of the line)
    OX = -nx * 1.2 - LX * 1.2; OY = -ny * 1.2 - LY * 1.2;
    g.beginPath(); cp(NC - 1, 0, -K.bot[NC - 1]); g.moveTo(PX, PY);
    let px = PX, py = PY;
    for (let c = NC - 2; c >= BODY0; c--) { cp(c, 0, -K.bot[c]); g.quadraticCurveTo((px + PX) / 2 - K.nx[c] * 2.4, (py + PY) / 2 - K.ny[c] * 2.4, PX, PY); px = PX; py = PY; }
    OX = OY = 0;
    g.lineCap = 'round'; g.lineWidth = 3.4; g.strokeStyle = 'rgba(70,24,16,.32)'; g.stroke();
  }
  // the coat: plates shaded group by group from the tail (the first group is the whole silhouette, later ones
  // lie over it inside a clip), then the straw lips, one crevice shadow past every free edge, the glints
  function body(g) {
    groupCols();
    const G = GRP.length - 1, mid = i => (GRP[i] + GRP[i + 1] - 1) >> 1;
    bodyPath(g); g.fillStyle = colGrad(g, mid(0), SC, M_SC); g.fill();
    if (G > 1) {
      g.save(); g.clip();
      for (let i = 1; i < G; i++) { groupPath(g, GRP[i], GRP[i + 1]); g.fillStyle = colGrad(g, mid(i), SC, M_SC); g.fill(); }
      g.restore();
    }
    for (let i = 0; i < G; i++) {
      g.beginPath(); for (let c = GRP[i]; c < GRP[i + 1]; c++) lipPath(g, c);
      g.fillStyle = colGrad(g, mid(i), RIM, M_RIM); g.fill();
    }
    g.beginPath(); for (let c = 0; c < NC; c++) crevPath(g, c);
    g.fillStyle = CREVICE; g.fill();
    if (ZOOM > .75) glints(g);
    bodyPath(g); edge(g, .9);
  }

  // ---- head, drawn in its own frame: origin at the nape, +x along the snout ----------------------------
  // The skin is lit as a cone whose apex is the snout tip: a conic gradient round the apex gives every point
  // its place between the throat (facing down) and the bridge (facing up), wherever the snout tapers.
  const AX = 35.4, AY = -.3, TB = PI - .32, TT = PI + .45, SH = [-1.3, -1, -.7, -.4, -.1, .2, .5, .75, .92, 1.3];
  function coneStop(alb, m, s) {
    const c = clamp(s, -1, 1), q = Math.sqrt(1 - c * c), nx = .1 * q, k = 1 / Math.hypot(nx, c, q);
    return lit(alb, nx * k, -c * k, q * k, m);
  }
  function coneGrad(g, alb, m) {
    if (g.createConicGradient) {
      const gr = g.createConicGradient(PI / 2, AX, AY), mid = (TB + TT) / 2, hw = (TT - TB) / 2;
      for (const s of SH) gr.addColorStop(clamp((mid + s * hw - PI / 2) / TAU), coneStop(alb, m, s));
      return gr;
    }
    const gr = g.createLinearGradient(0, 11, 0, -15.5);
    for (const s of SH) gr.addColorStop(clamp((s + 1) / 2), coneStop(alb, m, s));
    return gr;
  }
  function headPath(g) {
    g.beginPath();
    g.moveTo(-7, -9.5);
    g.bezierCurveTo(-2, -15.5, 8, -15.5, 15, -10.5);
    g.bezierCurveTo(21, -7.5, 27, -4.2, 33, -2.4);
    g.quadraticCurveTo(37, -1, 34.6, 1.8);
    g.bezierCurveTo(29, 4.2, 20, 5.2, 13, 7.8);
    g.bezierCurveTo(6, 10.5, -2, 11, -7, 8.5);
    g.closePath();
  }
  function capPath(g, ox, oy) {
    g.beginPath();
    g.moveTo(-9 + ox, 8.5 + oy);
    g.quadraticCurveTo(-2 + ox, 4 + oy, 1 + ox, -2.5 + oy);
    g.quadraticCurveTo(6 + ox, -9 + oy, 16.5 + ox, -10.7 + oy);
    g.bezierCurveTo(9 + ox, -16.2 + oy, -2.5 + ox, -16.3 + oy, -7.5 + ox, -10.3 + oy);
    g.quadraticCurveTo(-11.5 + ox, -11.2 + oy, -13.5 + ox, -8.6 + oy);
    g.quadraticCurveTo(-10.2 + ox, -6.6 + oy, -9 + ox, -3.6 + oy);
    g.quadraticCurveTo(-12.8 + ox, -2.6 + oy, -14 + ox, .4 + oy);
    g.quadraticCurveTo(-10.8 + ox, 2.6 + oy, -10 + ox, 4.4 + oy);
    g.quadraticCurveTo(-12.6 + ox, 5.8 + oy, -12.6 + ox, 8.6 + oy);
    g.closePath();
  }
  // crown shingles: two rows of free edges, each with its crevice shadow and a lit straw lip
  function capRows(g, ox, oy) {
    g.beginPath();
    g.moveTo(5.5 + ox, -14.4 + oy); g.quadraticCurveTo(1.2 + ox, -13.6 + oy, -1 + ox, -10.8 + oy); g.quadraticCurveTo(1.6 + ox, -9.6 + oy, 4 + ox, -7.4 + oy);
    g.quadraticCurveTo(-.2 + ox, -6.4 + oy, -2.2 + ox, -3.4 + oy);
  }
  const E = { t: 0, look: 0, lookX: .3, wide: false, happy: false, shut: false, lid: .25, brow: '', mouth: 'smile', tongue: 0, wag: 0, blush: 1, sweat: 0, tilt: 0 };
  function head(g, x, y, a) {
    g.save(); g.translate(x, y); g.rotate(a); turn(a);
    ao(g, -1, 7.5, 15, 6.5, .38);                                     // under the jaw, on the chest behind
    headPath(g);
    g.fillStyle = coneGrad(g, SKIN, M_SKIN); g.fill(); edge(g, .8);
    // a warm blush on the snout, soft-edged, flattened to the cheek
    const br = 3.4 * E.blush * 1.3;
    g.save(); g.translate(19.5, 2.6); g.scale(1, .55);
    let gr = g.createRadialGradient(0, 0, 0, 0, 0, br);
    gr.addColorStop(0, 'rgba(238,78,92,.42)'); gr.addColorStop(1, 'rgba(238,78,92,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, br, 0, TAU); g.fill();
    g.restore();
    // crown cap of small scales: its shadow on the neck and skull, then the keratin, then its rows
    capPath(g, -LX * 1.6 - .8, -LY * 1.6); g.fillStyle = 'rgba(30,14,6,.3)'; g.fill();
    capPath(g, 0, 0); g.fillStyle = coneGrad(g, SC, M_SC); g.fill();
    g.lineCap = 'round'; g.lineJoin = 'round';
    capRows(g, -.9 - LX * .6, -LY * .6); g.lineWidth = 1.6; g.strokeStyle = 'rgba(30,14,6,.38)'; g.stroke();
    capRows(g, 0, 0); g.lineWidth = .9; g.strokeStyle = 'rgba(255,232,176,.42)'; g.stroke();
    // mouth and tongue, tucked under the tip of the snout
    if (E.tongue > 0) {
      const L = 27 * E.tongue, w = E.wag;
      g.beginPath(); g.moveTo(30, 2.6);
      g.quadraticCurveTo(30 + L * .5, 2.6 + 4 * E.tongue + w * 3, 30 + L, 2.4 + 2 * E.tongue - w * 2);
      g.lineWidth = 3; g.strokeStyle = '#8e2c43'; g.stroke();
      g.lineWidth = 2.1; g.strokeStyle = lit(TONGUE, 0, -.3, .95, M_SKIN); g.stroke();
      g.beginPath(); g.moveTo(31, 2.1);
      g.quadraticCurveTo(30 + L * .5, 2.1 + 4 * E.tongue + w * 3, 30 + L * .9, 1.9 + 2 * E.tongue - w * 2);
      g.lineWidth = .6; g.strokeStyle = 'rgba(255,244,246,.55)'; g.stroke();
    }
    g.beginPath();
    if (E.mouth === 'grin') {
      g.moveTo(21, 1.8); g.quadraticCurveTo(25.5, 9, 31, 1.6); g.quadraticCurveTo(26, 3.4, 21, 1.8);
      gr = g.createLinearGradient(0, 2, 0, 7); gr.addColorStop(0, '#3a1016'); gr.addColorStop(1, '#7a2634');
      g.fillStyle = gr; g.fill(); g.lineWidth = .9; g.strokeStyle = '#4a1a22'; g.stroke();
      g.beginPath(); g.ellipse(26, 4.4, 2.6, 1.4, .1, 0, TAU); g.fillStyle = lit(TONGUE, 0, -.4, .9, M_SKIN); g.fill();
    } else {
      if (E.mouth === 'wobble') { g.moveTo(22, 3); g.quadraticCurveTo(24, 1.4, 26, 3); g.quadraticCurveTo(28, 4.4, 30.5, 2.4); }
      else if (E.mouth === 'frown') { g.moveTo(23, 3.6); g.quadraticCurveTo(26.5, 1, 30.5, 2.6); }
      else if (E.mouth === 'flat') { g.moveTo(24, 2.8); g.lineTo(30.5, 2.2); }
      else { g.moveTo(22.5, 2.4); g.quadraticCurveTo(26, 4.8, 30.5, 2); }
      g.lineWidth = 1.35; g.strokeStyle = '#5a2630'; g.stroke();
    }
    // nose pad: wet and dark, one hard reflection of the lamp
    g.beginPath(); g.ellipse(34.1, -.2, 2.3, 1.9, .3, 0, TAU);
    g.fillStyle = sph(g, 34.1, -.2, 2.4, NOSE, M_NOSE); g.fill();
    g.beginPath(); g.ellipse(34.1 + LX * 1.1, -.2 + LY * .9, .75, .45, .3, 0, TAU); g.fillStyle = 'rgba(255,250,240,.8)'; g.fill();
    // eye: small, heavy-lidded, seated in a soft socket
    const ex = 13, ey = -3.6;
    if (E.happy) {
      ao(g, ex, ey + .5, 5, 3.4, .16);
      g.beginPath(); g.moveTo(ex - 3.4, ey + 1); g.quadraticCurveTo(ex, ey - 4, ex + 3.4, ey + 1);
      g.lineCap = 'round'; g.lineWidth = 1.9; g.strokeStyle = '#2a1a1e'; g.stroke();
    } else {
      ao(g, ex, ey + .4, 5.6, 5, .22);
      eye3d(g, ex, ey, 3.3, { t: E.t, look: E.look, lookX: E.lookX, wide: E.wide, shut: E.shut, seed: 1.3 });
      const blinking = ((E.t + 1.3) % 3.7) < .12;
      if (E.lid > 0 && !E.shut && !blinking) {
        const r = 3.3 * (E.wide ? 1.25 : 1) + .7, ly = ey - r + 2 * r * E.lid, th = Math.acos(clamp((ey - ly) / r, -1, 1));
        g.beginPath(); g.arc(ex, ey, r, -PI / 2 - th, -PI / 2 + th); g.closePath();
        g.fillStyle = lit(SKIN, .1, -.62, .78, M_SKIN); g.fill();
        g.beginPath(); g.moveTo(ex + Math.cos(-PI / 2 + th) * r, ey + Math.sin(-PI / 2 + th) * r); g.lineTo(ex + Math.cos(-PI / 2 - th) * r, ey + Math.sin(-PI / 2 - th) * r);
        g.lineCap = 'round'; g.lineWidth = 1; g.strokeStyle = '#3b2228'; g.stroke();
      }
    }
    if (E.brow) {
      g.beginPath();
      if (E.brow === 'focus') { g.moveTo(9.4, -9.2); g.lineTo(17, -7.2); }
      else if (E.brow === 'worry') { g.moveTo(9.6, -7.6); g.quadraticCurveTo(13, -8.6, 16.8, -10.8); }
      else { g.moveTo(9.4, -6.8); g.quadraticCurveTo(12.5, -8.6, 16.6, -9.4); }
      g.lineCap = 'round'; g.lineWidth = 1.7; g.strokeStyle = '#4b2d27'; g.stroke();
    }
    g.restore(); turn(-a);
    if (E.sweat) {
      const k = frac(E.t * .7), ca = Math.cos(a), sa = Math.sin(a), lx = 2, ly = -17 + k * 5;
      g.globalAlpha = clamp((1 - k) * 3); drop(g, x + lx * ca - ly * sa, y + lx * sa + ly * ca, .9); g.globalAlpha = 1;
    }
  }
  // a bead of sweat: clear water, lit through, one glint toward the lamp
  function drop(g, x, y, s) {
    g.beginPath(); g.moveTo(x, y - 6 * s); g.quadraticCurveTo(x + 4 * s, y, x, y + 3 * s); g.quadraticCurveTo(x - 4 * s, y, x, y - 6 * s);
    const gr = g.createRadialGradient(x - LX * 1.5 * s, y - LY * .5 * s, .3 * s, x, y, 4.6 * s);
    gr.addColorStop(0, '#eef8ff'); gr.addColorStop(.45, '#a6d6fb'); gr.addColorStop(1, '#4a86ba');
    g.fillStyle = gr; g.fill(); g.lineWidth = .6; g.strokeStyle = 'rgba(28,52,84,.55)'; g.stroke();
    g.beginPath(); g.ellipse(x + LX * 1.3 * s, y - 1 + LY * .6 * s, .65 * s, 1.2 * s, -.3, 0, TAU); g.fillStyle = 'rgba(255,255,255,.9)'; g.fill();
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
  // one lit tube segment (round caps), shaded across its width
  function seg(g, x0, y0, x1, y1, w, alb) {
    const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy) || 1, ux = -dy / l, uy = dx / l, mx = (x0 + x1) / 2, my = (y0 + y1) / 2, r = w / 2;
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1);
    g.lineWidth = w; g.strokeStyle = across(g, mx - ux * r, my - uy * r, mx + ux * r, my + uy * r, alb, M_SC); g.stroke();
  }
  // a scaled limb: thin contour first, then each lit segment, then a shingle on each with its crevice and lip
  function tube(g, x0, y0, x1, y1, x2, y2, w, alb, far) {
    g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.lineTo(x2, y2); g.lineWidth = w + 1.2; g.strokeStyle = 'rgba(20,15,20,.5)'; g.stroke();
    seg(g, x0, y0, x1, y1, w, alb); seg(g, x1, y1, x2, y2, w, alb);
    if (far || ZOOM < .6) return;
    g.beginPath(); shingle(g, x0, y0, x1, y1, w, .9, 0, 0); shingle(g, x1, y1, x2, y2, w, .9, 0, 0);
    g.lineWidth = 1.2; g.strokeStyle = 'rgba(30,14,6,.42)'; g.stroke();
  }
  // a chevron across a segment, apex toward its far end (where the scale's tip points)
  function shingle(g, x0, y0, x1, y1, w, k, ox, oy) {
    const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l, px = -uy * w * .45 * k, py = ux * w * .45 * k;
    const mx = mix(x0, x1, .6) + ox, my = mix(y0, y1, .6) + oy;
    g.moveTo(mx + px - ux * 1.6, my + py - uy * 1.6); g.quadraticCurveTo(mx + ux * 1.6 + px * .3, my + uy * 1.6 + py * .3, mx + ux * 2.2, my + uy * 2.2);
    g.quadraticCurveTo(mx + ux * 1.6 - px * .3, my + uy * 1.6 - py * .3, mx - px - ux * 1.6, my - py - uy * 1.6);
  }
  // horn: lit across the claw, the upper edge toward the lamp
  function horn(g, y0, y1, far) {
    const gr = g.createLinearGradient(0, y0, 0, y1), alb = far ? CLAW_F : CLAW;
    for (const s of [1, .55, .1, -.4, -1]) gr.addColorStop((1 - s) / 2, lit(alb, 0, -s, Math.sqrt(1 - s * s) + .01, M_HORN));
    return gr;
  }
  // hind leg: scaled ham, stout shin, plantigrade foot with short claws
  function hindLeg(g, hx, hy, fx, fy, fa, far) {
    const col = far ? SC_F : SC, ax = fx - 1.5, ay = fy - 4.5, k = far ? .92 : 1;
    ik(hx, hy, ax, ay, 14.5, 13.5, 1); const kx = IX, ky = IY;
    g.save(); g.translate(fx, fy); g.rotate(fa); turn(fa); if (far) g.scale(k, k);
    g.beginPath(); g.moveTo(-5.5, 0); g.quadraticCurveTo(-7, -6, -1.5, -6.8); g.quadraticCurveTo(5.5, -6.6, 8.6, -1.6);
    g.quadraticCurveTo(9.6, .4, 6, .3); g.closePath();
    g.fillStyle = sph(g, 1, -4.5, 8, far ? FOOT_F : FOOT, M_SKIN); g.fill();
    g.beginPath();
    g.moveTo(6.4, -3.6); g.quadraticCurveTo(10.4, -3.8, 11.8, -.4); g.quadraticCurveTo(9.4, -1.2, 7.4, -.9);
    g.moveTo(3.6, -5.6); g.quadraticCurveTo(7.6, -6.4, 9.6, -3.4); g.quadraticCurveTo(7.2, -3.8, 5, -3.2);
    g.fillStyle = horn(g, -6.4, -.4, far); g.fill();
    g.restore(); turn(-fa);
    tube(g, hx, hy, kx, ky, ax, ay, 8.5 * k, col, far);
    const ta = Math.atan2(ky - hy, kx - hx), cx = mix(hx, kx, .4), cy = mix(hy, ky, .4);
    g.beginPath(); g.ellipse(cx, cy, 10 * k, 6.8 * k, ta, 0, TAU);
    g.fillStyle = sph(g, cx, cy, 12 * k, col, M_HAM); g.fill(); edge(g, .9);
    // two shingles on the ham: crevice shadow below each free edge, then the straw lip
    const c = Math.cos(ta), s = Math.sin(ta), mx = mix(hx, kx, .55), my = mix(hy, ky, .55);
    const ham = (ox, oy) => {
      g.beginPath(); g.moveTo(mx - s * 6.5 + ox, my + c * 6.5 + oy); g.quadraticCurveTo(mx - s * 2 + c * 4 + ox, my + c * 2 + s * 4 + oy, mx + c * 5 + ox, my + s * 5 + oy);
      g.quadraticCurveTo(mx + s * 3 + c * 3 + ox, my - c * 3 + s * 3 + oy, mx + s * 6 + ox, my - c * 6 + oy);
    };
    g.lineCap = 'round';
    if (far || ZOOM < .6) return;
    ham(c * 1.1 - LX * .6, s * 1.1 - LY * .6); g.lineWidth = 1.8; g.strokeStyle = 'rgba(30,14,6,.36)'; g.stroke();
    ham(0, 0); g.lineWidth = .9; g.strokeStyle = 'rgba(255,232,176,.38)'; g.stroke();
  }
  // front leg: short scaled arm ending in three big sickle claws (middle one longest)
  function foreLimb(g, sx, sy, ex, ey, wx, wy, ca, curl, far) {
    const k = far ? .92 : 1;
    tube(g, sx, sy, ex, ey, wx, wy, 7.2 * k, far ? SC_F : SC, far);
    g.save(); g.translate(wx, wy); g.rotate(ca); turn(ca); if (far) g.scale(k, k);
    if (!far) ao(g, 1.5, 0, 5, 4, .32);
    // three claws in one fill (the middle one last so its outline wins), one hard highlight along each back
    g.beginPath();
    for (const i of [-1, 1, 0]) {
      const L = i ? 9.5 : 12.5, s = i * .36, cs = Math.cos(s), sn = Math.sin(s), b = curl * L * .62;
      const r = (x, y) => { PX = x * cs - y * sn; PY = x * sn + y * cs; };
      r(-1, -2.4); g.moveTo(PX, PY);
      r(L * .74, -2.8); const x1 = PX, y1 = PY; r(L, b); g.quadraticCurveTo(x1, y1, PX, PY);
      r(L * .5, .8 + b * .4); const x2 = PX, y2 = PY; r(-1, 2.4); g.quadraticCurveTo(x2, y2, PX, PY);
      g.closePath();
    }
    g.fillStyle = horn(g, -3, 3, far); g.fill(); edge(g, .55);
    if (!far) {
      g.beginPath();
      for (const i of [-1, 1, 0]) {
        const L = i ? 9.5 : 12.5, s = i * .36, cs = Math.cos(s), sn = Math.sin(s), b = curl * L * .62;
        const r = (x, y) => { PX = x * cs - y * sn; PY = x * sn + y * cs; };
        r(0, -1.7); g.moveTo(PX, PY); r(L * .62, -2.1); const x3 = PX, y3 = PY; r(L * .9, b * .8 - .4); g.quadraticCurveTo(x3, y3, PX, PY);
      }
      g.lineWidth = .55; g.strokeStyle = 'rgba(255,252,240,.6)'; g.stroke();
    }
    g.restore(); turn(-ca);
  }

  // ---- one full figure from P (spine), J (joints), LB (limbs) and E (face) ---------------------------
  const J = { hx: [0, 0], hy: [0, 0], sx: [0, 0], sy: [0, 0] };
  const LB = { f: [[0, 0, 0], [0, 0, 0]], arm: [[0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0]], legFirst: false, cable: 0, cableLo: 0, bibU: 7.1, bibA: 0, ground: 0 };
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
  // soft contact darkening where feet and tail touch the ground (or the hub), gy = ground line in this frame
  function contact(g, gy) {
    for (let k = 0; k < 2; k++) {
      const F = LB.f[k], up = gy - F[1];
      if (up < 5) ao(g, F[0] + 2, gy + .3, 8.5, 2, .34 * (1 - up / 5));
    }
    for (let i = 0, n = 0; i < 5 && n < 2; i++) {
      const ny = S.ny[i], low = S.y[i] + (ny < 0 ? -ny * S.wv[i] : ny * S.wd[i]), up = gy - low;
      if (up < 6 && up > -4 && (!LB.cable || Math.abs(S.x[i]) < 48)) { ao(g, S.x[i], gy + .3, 10, 2, .3 * (1 - clamp(up / 6))); n++; }
    }
  }
  function figure(g, o) {
    g0 = g;
    contact(g, LB.ground);
    leg(0); arm(0);
    ao(g, J.hx[0] + 2, J.hy[0] - 2, 11, 9, .3);                    // the far leg tucks under the body
    if (LB.legFirst) leg(1);
    belly(g); body(g);
    ao(g, J.hx[1] + 1, J.hy[1] + 1, 12, 9, .26); ao(g, J.sx[1], J.sy[1], 7, 6, .28);  // where the near limbs meet the body
    if (!LB.cable) head(g, S.x[10], S.y[10], S.na + E.tilt);
    else cable(g, LB.cableLo, LB.cable, o.scale || 1);
    if (!LB.legFirst) leg(1);
    arm(1);
    if (LB.cable) head(g, S.x[10], S.y[10], S.na + E.tilt);          // riding: the face always peeks out in front
    if (o.bib) {
      const q = at(LB.bibU);
      tag(g, q.x + q.nx * 2, q.y + q.ny * 2, o.bib, 17, 13, LB.bibA, q.nx, q.ny, .3);
    }
  }
  // the crane cable passes in front of the rider's chest: its shadow on the coat, then the same braided cable
  function cable(g, lo, top, s) {
    const k = 1 / s;
    g.save(); bodyPath(g); g.clip();
    g.beginPath(); g.moveTo(-LX * 2.4, lo); g.lineTo(-LX * 2.4, top); g.lineWidth = 3.2 * k; g.strokeStyle = 'rgba(24,12,6,.3)'; g.stroke();
    g.restore();
    g.lineCap = 'butt';
    g.beginPath(); g.moveTo(0, lo); g.lineTo(0, top); g.lineWidth = 2.6 * k; g.strokeStyle = '#2d3136'; g.stroke();
    if (g.setLineDash) {
      g.lineWidth = .9 * k; g.setLineDash([1.6 * k, 1.6 * k]);
      g.strokeStyle = '#9da4aa'; g.beginPath(); g.moveTo(-.55 * k, lo); g.lineTo(-.55 * k, top); g.stroke();
      g.strokeStyle = '#5f666d'; g.lineDashOffset = 1.6 * k; g.beginPath(); g.moveTo(.55 * k, lo); g.lineTo(.55 * k, top); g.stroke();
      g.setLineDash([]); g.lineDashOffset = 0;
    }
  }
  // racing bib: a small enamelled tin tag tied on at (x, y), sitting on a surface whose in-plane normal is (nx, ny)
  // (tilt says how far it faces that way), lit like the coat, sheen toward the lamp, its own shadow underneath
  function tag(g, x, y, b, w, h, a, nx, ny, tilt) {
    if (!b) return;
    g.save(); g.translate(x, y); g.rotate(a); turn(a);
    const ca = Math.cos(-a), sa = Math.sin(-a), mx = (nx * ca - ny * sa) * tilt, my = (nx * sa + ny * ca) * tilt, mz = Math.sqrt(Math.max(0, 1 - mx * mx - my * my));
    const d = Math.max(0, mx * LX + my * LY + mz * LZ), dim = clamp(.55 - d, 0, .5) * .7;
    rr(g, -w / 2 - LX * 1.4, -h / 2 - LY * 1.4, w, h, 3); g.fillStyle = 'rgba(24,12,6,.34)'; g.fill();
    // the plate, curved round the body: lighter toward the lamp, darker away from it; the number printed on it
    const bg = AKIT.mix(b.bg, '#fff6e6', 0), lo = AKIT.shade(b.bg, .3 + dim);
    let gr = g.createLinearGradient(LX * w * .5, LY * h * .6, -LX * w * .5, -LY * h * .6);
    gr.addColorStop(0, AKIT.tint(b.bg, .2)); gr.addColorStop(.45, bg); gr.addColorStop(1, lo);
    rr(g, -w / 2, -h / 2, w, h, 3); g.fillStyle = gr; g.fill();
    g.fillStyle = b.fg; g.font = `${h * .8}px "Alfa Slab One", Rockwell, serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(String(b.n), 0, h * .06);
    // enamel sheen: one crisp diagonal band, kept inside the rounded corners
    g.beginPath(); g.moveTo(-w * .5 + .6, -h * .08); g.lineTo(-w * .5 + 3.4, -h * .5 + .5); g.lineTo(w * .04, -h * .5 + .5); g.lineTo(-w * .5 + .6, h * .26); g.closePath();
    g.fillStyle = 'rgba(255,255,255,.2)'; g.fill();
    // the tin edge: bright where it faces the lamp, dark on the far side
    gr = g.createLinearGradient(LX * w * .5, LY * h * .5, -LX * w * .5, -LY * h * .5);
    gr.addColorStop(0, 'rgba(255,248,230,.85)'); gr.addColorStop(.5, 'rgba(40,30,30,.35)'); gr.addColorStop(1, 'rgba(12,8,10,.7)');
    rr(g, -w / 2 + .4, -h / 2 + .4, w - .8, h - .8, 2.6); g.lineWidth = .8; g.strokeStyle = gr; g.stroke();
    g.restore(); turn(-a);
  }
  function faceReset(t) {
    P.tl = 1;
    E.t = t; E.look = .15; E.lookX = .35; E.wide = false; E.happy = false; E.shut = false; E.lid = .28; E.brow = '';
    E.mouth = 'smile'; E.tongue = 0; E.wag = 0; E.blush = 1; E.sweat = 0; E.tilt = 0;
    LB.legFirst = false; LB.cable = 0; LB.bibU = 7.1; LB.bibA = 0; LB.ground = 0;
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
    cast(g, 76);
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
    cast(g, 70);
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
    cast(g, 64, lift);
    g.save(); g.translate(0, -lift);
    faceReset(t);
    LB.ground = lift;
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
    cast(g, 66);
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
    ao(g, P.x + 5, 0, 20, 3.4, up ? .22 : .4);                   // rump seated on the hub
    figure(g, o);
    g.restore();
  }

  // ---- flat out: rolled into a scaly ball ---------------------------------------------------------------
  const BR = 27, BN = 12, BRIN = 7.5, BH = (BR - BRIN) / 2.5;
  function bp(th, a, r) { const q = th + a / Math.max(r, 3); PX = Math.cos(q) * r + OX; PY = Math.sin(q) * r + OY; }
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
  // the ball's lips and free edges, appended to the current path
  function ballLip(g, th, off) {
    for (let r = BR - off * BH; r > BRIN - BH * .3; r -= BH) {
      const tp = btip(r), d = Math.min(2.4, tp * .36);
      bp(th, 0, r + BH * .5); g.moveTo(PX, PY);
      bq(g, th, -tp * .8, r + BH * .42, -tp, r);
      bq(g, th, -tp * .8, r - BH * .42, 0, r - BH * .5);
      bq(g, th, 2 * (d - tp), r, 0, r + BH * .5);
    }
  }
  function ballZig(g, th, off) {
    let r = BR - off * BH;
    bp(th, 0, r + BH * .5); g.moveTo(PX, PY);
    for (; r > BRIN - BH * .3; r -= BH) { const tp = btip(r); bq(g, th, -tp * .8, r + BH * .42, -tp, r); bq(g, th, -tp * .8, r - BH * .42, 0, r - BH * .5); }
  }
  // the tail wrapped round the outside, tips pointing to its own tip
  function tailPath(g, tb, span, n) {
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
  }
  function tailRows(g, tb, span, n, dr, da) {
    g.beginPath();
    for (let i = 1; i < n; i++) {
      const s = i / n, th = tb - span * s + da, ro = BR + 6 - 5.5 * s + dr, w = 13 * Math.min(1, s / .12 + .15) * Math.pow(1 - s, .8) + 1.5;
      const ri = ro - w, rm = (ro + ri) / 2, tp = .18;
      g.moveTo(Math.cos(th) * (ro + .8), Math.sin(th) * (ro + .8));
      g.quadraticCurveTo(Math.cos(th + tp * .8) * (ro - w * .2), Math.sin(th + tp * .8) * (ro - w * .2), Math.cos(th + tp) * rm, Math.sin(th + tp) * rm);
      g.quadraticCurveTo(Math.cos(th + tp * .8) * (ri + w * .2), Math.sin(th + tp * .8) * (ri + w * .2), Math.cos(th) * ri, Math.sin(th) * ri);
    }
  }
  const BG = [[], [], []];
  function ball(g, o, sp, ph) {
    const t = o.t, ang = ph * TAU * .75;                    // clockwise: rolling toward +x
    const hop = 2.4 * Math.abs(Math.sin(ang * .5)), sq = clamp(1 - hop / .9);
    cast(g, 56, hop * 3);
    ao(g, 2, .3, 15, 2.4, .42 * (1 - clamp(hop / 2.4)));
    // speed ticks
    g.lineCap = 'round'; g.lineWidth = 1.6; g.strokeStyle = 'rgba(28,27,31,.32)';
    g.beginPath();
    for (let i = 0; i < 3; i++) {
      const y = -BR - hop + (i - 1) * 12, l = 9 + 7 * (.5 + .5 * Math.sin(t * 11 + i * 2.3)), x = -BR - 6 - (i % 2) * 4;
      g.moveTo(x, y); g.lineTo(x - l, y);
    }
    g.stroke();
    g.save(); g.translate(0, -hop); g.scale(1 + .06 * sq, 1 - .07 * sq); g.translate(0, -BR);
    // one lit sphere of keratin: straw lips on every plate, a crevice shadow past every free edge
    ring(g, ang); g.fillStyle = sph(g, 0, 0, BR + 2, SC, M_SC); g.fill();
    g.save(); g.clip();
    g.beginPath(); for (let k = 0; k < BN; k++) ballLip(g, ang + k * TAU / BN, k & 1 ? .5 : 0);
    g.fillStyle = sph(g, 0, 0, BR + 2, RIM, M_RIM); g.fill();
    g.beginPath();
    for (let k = 0; k < BN; k++) { const th = ang + k * TAU / BN; OX = Math.sin(th) * 1.3 - LX * .7; OY = -Math.cos(th) * 1.3 - LY * .7; ballZig(g, th, k & 1 ? .5 : 0); }
    OX = OY = 0;
    g.lineCap = 'round'; g.lineJoin = 'round'; g.lineWidth = 1.9; g.strokeStyle = CREVICE; g.stroke();
    if (ZOOM > .75) {                                        // glints on the plates that face the lamp
      for (const b of BG) b.length = 0;
      for (let k = 0; k < BN; k++) {
        const th = ang + k * TAU / BN, off = k & 1 ? .5 : 0;
        for (let r = BR - off * BH; r > BRIN; r -= BH) {
          const tp = btip(r), q = th + ((r * TAU / BN - tp) * .5 - 1) / r, x = Math.cos(q) * r + LX * 1.2, y = Math.sin(q) * r + LY * 1.2;
          const nx = x / (BR + 2), ny = y / (BR + 2), nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny)), hd = nx * HX + ny * HY + nz * HZ;
          if (hd < .8) continue;
          const I = Math.pow(hd, 14);
          BG[I > .7 ? 0 : I > .45 ? 1 : 2].push(x, y, q);
        }
      }
      const al = [.62, .4, .22];
      for (let b = 0; b < 3; b++) {
        const L = BG[b]; if (!L.length) continue;
        g.beginPath();
        for (let i = 0; i < L.length; i += 3) { const ro = L[i + 2] + PI / 2 + .5; g.moveTo(L[i] + Math.cos(ro) * 1.7, L[i + 1] + Math.sin(ro) * 1.7); g.ellipse(L[i], L[i + 1], 1.7, .75, ro, 0, TAU); }
        g.fillStyle = `rgba(255,251,240,${al[b]})`; g.fill();
      }
    }
    // tucked centre: a hollow where the snout and tail tip curl in, with a spiral crease
    let gr = g.createRadialGradient(0, 0, 0, 0, 0, 10);
    gr.addColorStop(0, 'rgba(18,9,4,.62)'); gr.addColorStop(1, 'rgba(18,9,4,0)');
    g.fillStyle = gr; g.fillRect(-10, -10, 20, 20);
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (const [dx, dy, w, c] of [[0, 0, 1.4, 'rgba(22,10,4,.6)'], [LX * .9, LY * .9, .7, 'rgba(255,228,176,.28)']]) {
      g.beginPath(); g.moveTo(dx, dy);
      for (let i = 1; i <= 8; i++) { const a = ang + i * .75, r = i * .85; g.lineTo(Math.cos(a) * r + dx, Math.sin(a) * r + dy); }
      g.lineWidth = w; g.strokeStyle = c; g.stroke();
    }
    // the tail's shadow on the ball, crowded toward the centre and thrown away from the lamp
    const tb = ang + 1.1, span = 3.5, n = 7;
    g.save(); g.translate(-LX * 1.8, -LY * 1.8); g.scale(.95, .95); tailPath(g, tb, span, n); g.fillStyle = 'rgba(24,12,6,.4)'; g.fill(); g.restore();
    g.restore();
    ring(g, ang); edge(g, .9);
    tailPath(g, tb, span, n);
    g.fillStyle = sph(g, 0, 0, BR + 9, SC, M_SC); g.fill(); edge(g, .9);
    g.lineCap = 'round';
    tailRows(g, tb, span, n, 0, -.06); g.lineWidth = 1.7; g.strokeStyle = 'rgba(30,14,6,.4)'; g.stroke();
    tailRows(g, tb, span, n, 0, 0); g.lineWidth = .9; g.strokeStyle = 'rgba(255,232,176,.4)'; g.stroke();
    // a peek out from under the tail tip
    const tipTh = tb - span, pe = tipTh - .42, pr = BR - 10, px = Math.cos(pe) * pr, py = Math.sin(pe) * pr;
    g.beginPath(); g.ellipse(px, py, 6.2, 4.8, pe + PI / 2, 0, TAU);
    gr = g.createRadialGradient(px, py, 0, px, py, 6.2);
    gr.addColorStop(0, '#0e0805'); gr.addColorStop(.7, '#1d120b'); gr.addColorStop(1, '#4a3320');
    g.fillStyle = gr; g.fill(); edge(g, .7);
    eye3d(g, px, py, 2.7, { t, look: .1, lookX: .8, seed: .4 });
    if (o.bib) tag(g, 0, 1, o.bib, 17, 13, .12 * Math.sin(t * 3.1), 0, 0, 0);
    g.restore();
  }
  // a dust cloud that hides the change between walking and rolling: soft lit lumps, no outline
  const PUFF = [];
  function puff(g, k, t) {
    const e = ease(clamp(k * 1.7));
    if (e < .02) return;
    PUFF.length = 0;
    PUFF.push(0, -34, 22 * e);
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * TAU + t * 2.4, r = (10 + 4 * Math.sin(t * 8 + i * 1.9)) * e;
      PUFF.push(Math.cos(a) * 25 * e, -34 + Math.sin(a) * 19 * e, r);
    }
    g.save(); g.translate(6 + 3 * e, 2); g.scale(1, .2);
    let gr = g.createRadialGradient(0, 0, 0, 0, 0, 40 * e);
    gr.addColorStop(0, `rgba(10,6,8,${.3 * e})`); gr.addColorStop(1, 'rgba(10,6,8,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 40 * e, 0, TAU); g.fill(); g.restore();
    // the back lumps first (upper ones sit behind), then the core, then the lower lumps in front
    const order = [1, 2, 3, 4, 5, 6, 7, 8].sort((a, b) => PUFF[a * 3 + 1] - PUFF[b * 3 + 1]);
    for (const j of [0, ...order]) {
      const x = PUFF[j * 3], y = PUFF[j * 3 + 1], r = Math.max(.5, PUFF[j * 3 + 2]);
      g.beginPath(); g.arc(x, y, r, 0, TAU); g.fillStyle = sph(g, x, y, r, DUST, M_DUST); g.fill();
    }
    g.globalAlpha = e;
    g.beginPath();
    for (let i = 0; i < 4; i++) {
      const a = i * 1.7 + t * 5, r = 30 + 10 * frac(t * 2 + i * .3);
      g.moveTo(Math.cos(a) * r, -34 + Math.sin(a) * r * .8); g.lineTo(Math.cos(a) * (r + 6), -34 + Math.sin(a) * (r + 6) * .8);
    }
    g.lineWidth = 1.6; g.lineCap = 'round'; g.strokeStyle = 'rgba(92,70,48,.7)'; g.stroke();
    g.globalAlpha = 1;
  }

  function draw(g, o) {
    const s = o.scale || 1;
    g.save(); g.scale(s, s); frame(g);
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
