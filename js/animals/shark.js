// Great hammerhead shark. A fish racing on land: it flop-hops, curling into a C and snapping straight
// so the tail slaps the ground and launches it. Deadpan and dead serious, with swim goggles pushed up on
// the middle of its hammer (they could never reach its eyes, which sit out on the two tips).
(() => {
  const { C, TAU, LW, paint, sheen, eye, blush, sweat, bib, shadow, cyc, ease } = AKIT;

  // bronze-grey back over a white belly (countershading), printed on tin
  const BACK = '#8b8571', BACK_DK = '#5f5a4c', FACE = '#6c6654', BELLY = '#fbf7ec', MOUTH = '#3b1d22';
  const LENS = '#1f97ad', LENS_DK = '#115b6b', STRAP = C.TOMATO, DROP = '#9fd3ff';

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

  function body(g) {
    // outline loop: back from tail to head, round the snout, belly from head to tail, round the stock
    let n = 0;
    for (let i = N; i >= 0; i--) { QX[n] = PX[i] + Math.sin(TH[i]) * TOP[i]; QY[n++] = PY[i] - Math.cos(TH[i]) * TOP[i]; }
    QX[n] = PX[0] + Math.cos(TH[0]) * 7; QY[n++] = PY[0] + Math.sin(TH[0]) * 7;
    for (let i = 0; i <= N; i++) { QX[n] = PX[i] - Math.sin(TH[i]) * BOT[i]; QY[n++] = PY[i] + Math.cos(TH[i]) * BOT[i]; }
    QX[n] = PX[N] - Math.cos(TH[N]) * 2.5; QY[n++] = PY[N] - Math.sin(TH[N]) * 2.5;
    g.beginPath(); g.moveTo((QX[n - 1] + QX[0]) / 2, (QY[n - 1] + QY[0]) / 2);
    for (let k = 0; k < n; k++) { const j = (k + 1) % n; g.quadraticCurveTo(QX[k], QY[k], (QX[k] + QX[j]) / 2, (QY[k] + QY[j]) / 2); }
    g.closePath();
    // ink first at double width: the fills below cover its inner half, leaving one clean outline
    g.lineWidth = LW * 2; g.strokeStyle = C.INK; g.lineJoin = 'round'; g.lineCap = 'round'; g.stroke();
    g.save(); g.clip();
    paint(g, BELLY, { shadeFrom: P.shade, lw: 0 });
    // bronze back, down to the countershading line
    g.beginPath();
    pt(0, SEAM[0]); g.moveTo(X + Math.cos(A) * 16, Y + Math.sin(A) * 16); g.lineTo(X, Y);
    for (let i = 1; i < N; i++) {
      const cx = PX[i] - Math.sin(TH[i]) * SEAM[i], cy = PY[i] + Math.cos(TH[i]) * SEAM[i];
      const nx = PX[i + 1] - Math.sin(TH[i + 1]) * SEAM[i + 1], ny = PY[i + 1] + Math.cos(TH[i + 1]) * SEAM[i + 1];
      g.quadraticCurveTo(cx, cy, (cx + nx) / 2, (cy + ny) / 2);
    }
    pt(1, SEAM[N]); g.lineTo(X, Y); g.lineTo(X - Math.cos(A) * 16, Y - Math.sin(A) * 16);
    g.lineTo(X - Math.cos(A) * 16 + Math.sin(A) * 60, Y - Math.sin(A) * 16 - Math.cos(A) * 60);
    pt(0, SEAM[0]); g.lineTo(X + Math.cos(A) * 16 + Math.sin(A) * 60, Y + Math.sin(A) * 16 - Math.cos(A) * 60);
    g.closePath();
    g.fillStyle = BACK; g.fill(); g.lineWidth = LW * .55; g.stroke();
    at(g, .36, -8.5); sheen(g, 0, 0, 30, 6.5, .42); g.restore();
    // five gill slits, breathing
    g.beginPath();
    for (let i = 0; i < 5; i++) {
      const s = .095 + i * .024;
      pt(s, -7.5 + i * .4); g.moveTo(X, Y);
      pt(s - .018 - .012 * F.gill, -2.5); const cx = X, cy = Y;
      pt(s - .004, 2 - i * .3); g.quadraticCurveTo(cx, cy, X, Y);
    }
    g.lineWidth = LW * .45; g.stroke();
    g.restore();
  }

  function fin(g, s, v, rot, col, k, ky = 1) {
    at(g, s, v, rot); g.scale(k, k * ky);
    g.beginPath(); g.moveTo(6, -3); g.quadraticCurveTo(8.5, 14, -5, 27); g.quadraticCurveTo(-3, 12, -9, -1); g.closePath();
    paint(g, col, {});
    if (col === BACK) { g.beginPath(); g.moveTo(1, 1); g.quadraticCurveTo(2, 12, -3, 20); g.lineWidth = LW * .45; g.stroke(); }
    g.restore();
  }

  // riding: a pectoral hooked up and over the cable, which shows through the crook under the tip
  function hug(g, s, v, col, kx, H, droop) {
    at(g, s, v, 0);
    g.beginPath(); g.moveTo(-4.5, 1);
    g.quadraticCurveTo(-6, -H * .75, kx - 2, -H);
    g.quadraticCurveTo(kx + 6.5, -H - 1.5, kx + 7.5 + droop, -H + 10 + droop);
    g.quadraticCurveTo(kx + 4.5, -H + 6, kx + 2.4, -H + 6.5);
    g.quadraticCurveTo(kx - 7.5, -H + 5, 4, 1); g.closePath();
    paint(g, col, {});
    if (col === BACK) { g.beginPath(); g.moveTo(0, -2); g.quadraticCurveTo(-1, -H * .6, kx - 2, -H + 3.5); g.lineWidth = LW * .45; g.stroke(); }
    g.restore();
  }

  function fins(g) {
    // tail: heterocercal, the upper lobe far longer, with a small terminal lobe past the notch
    at(g, 1, 0, P.cau);
    g.beginPath(); g.moveTo(3, -4.5); g.quadraticCurveTo(-15, -10, -39, -31); g.quadraticCurveTo(-38, -25, -33, -23);
    g.lineTo(-29.5, -21.5); g.quadraticCurveTo(-21, -12, -14, -2.5); g.quadraticCurveTo(-18, 7, -22, 16.5);
    g.quadraticCurveTo(-8, 11, 3, 4); g.closePath();
    paint(g, BACK, {}); g.restore();
    // anal and pelvic fins, second dorsal
    at(g, .8, prof(BOT, .8) - 1.5, 0); g.beginPath(); g.moveTo(3, 0); g.quadraticCurveTo(0, 6, -5, 8); g.quadraticCurveTo(-4, 3, -6, -1); g.closePath(); paint(g, BACK, {}); g.restore();
    at(g, .6, prof(BOT, .6) - 2, 0); g.beginPath(); g.moveTo(4, 0); g.quadraticCurveTo(1, 8, -6, 11.5); g.quadraticCurveTo(-4, 4, -7, -1); g.closePath(); paint(g, BACK, {}); g.restore();
    at(g, .8, -prof(TOP, .8) + 2, P.dor * .6); g.beginPath(); g.moveTo(4, 2); g.quadraticCurveTo(2, -7, -5, -10); g.quadraticCurveTo(-3, -4, -7, -1.5); g.lineTo(-3, 2); g.closePath(); paint(g, BACK, {}); g.restore();
    // first dorsal: very tall and sickle-shaped
    at(g, .4, -prof(TOP, .4) + 2, P.dor);
    g.beginPath(); g.moveTo(9, 3); g.quadraticCurveTo(6, -33, -14, -44); g.quadraticCurveTo(-7, -24, -13, -3.5); g.lineTo(-7, 3); g.closePath();
    paint(g, BACK, {});
    g.beginPath(); g.moveTo(3, -2); g.quadraticCurveTo(1, -24, -8, -34); g.lineWidth = LW * .45; g.stroke();
    g.restore();
  }

  function lid(g, r) {
    const R = r * 1.12, a = Math.asin(Math.max(-1, Math.min(1, (2 * F.lid - 1))));
    g.save(); g.rotate(F.tilt);
    g.beginPath(); g.arc(0, 0, R, Math.PI - a, TAU + a); g.closePath();
    g.fillStyle = BACK; g.fill(); g.lineWidth = LW * .8; g.strokeStyle = C.INK; g.stroke();
    g.restore();
  }

  function hammer(g, t) {
    pt(0, 0);
    const R = A * P.hk + HT + P.ham;
    g.save(); g.translate(X, Y); g.rotate(R);
    g.beginPath(); g.moveTo(-5, -TOP[0] + 2);
    g.quadraticCurveTo(0, -HF + 8, -2.5, -HF + 2); g.quadraticCurveTo(-3, -HF - 3.5, 3, -HF - 3.5);
    g.quadraticCurveTo(9, -HF - 3.5, 9, -HF + 3);
    g.lineTo(9, -2); g.lineTo(7.3, 0); g.lineTo(9, 2); g.lineTo(9, HN - 3);
    g.quadraticCurveTo(9, HN + 3.5, 3, HN + 3.5); g.quadraticCurveTo(-3.5, HN + 3.5, -3.5, HN - 2);
    g.quadraticCurveTo(0, HN - 9, -6, BOT[0] - 1); g.lineTo(-6, SEAM[0]);
    // the chord back to the start runs through the head's own bronze and is never inked
    g.fillStyle = BACK; g.fill();
    g.fillStyle = FACE; g.fillRect(6.3, -HF + 1, 2.7, HF - 3.4); g.fillRect(6.3, 2.4, 2.7, HN - 4);
    g.lineWidth = LW; g.strokeStyle = C.INK; g.lineJoin = 'round'; g.stroke();
    goggles(g, t);
    // eyes out on the two tips; gaze, lids and brows stay upright on screen however the hammer swings
    for (let k = 0; k < 2; k++) {
      const near = k === 1, r = near ? 5.2 : 4.4, seed = near ? 0 : .04;
      g.save(); g.translate(2.8, near ? HN - 1 : -HF); g.rotate(-R);
      eye(g, 0, 0, r, { t, look: F.gy, lookX: F.gx, wide: F.wide, seed });
      const blink = ((t + seed) % 3.7) < .12;
      if (F.lid > 0 && !blink) lid(g, F.wide ? r * 1.25 : r);
      if (F.brow) {
        g.beginPath(); g.moveTo(-r, 1.4 - r * 1.8); g.quadraticCurveTo(0, -1.6 - r * 1.8, r, -1.4 - r * 1.8);
        g.lineWidth = LW * .9; g.stroke();
      }
      if (F.sweat >= 0 && !near) {
        g.globalAlpha = Math.sin(Math.PI * F.sweat);
        sweat(g, -r - 4, 2 + F.sweat * 8, .9);
        g.globalAlpha = 1;
      }
      g.restore();
    }
    g.restore();
  }

  // swim goggles pushed up on the middle of the hammer, well out of reach of the eyes on the tips
  function goggles(g, t) {
    g.save(); g.translate(2, -8.5); g.rotate(-.14);
    g.beginPath(); g.moveTo(-1, -4); g.quadraticCurveTo(-9, -6.5, -14, -1.5);
    g.lineWidth = 4.6; g.strokeStyle = C.INK; g.stroke(); g.lineWidth = 2.6; g.strokeStyle = STRAP; g.stroke();
    g.beginPath(); g.ellipse(0, -4, 3.5, 3.9, 0, 0, TAU); g.fillStyle = LENS_DK; g.fill(); g.lineWidth = 1.8; g.strokeStyle = C.INK; g.stroke();
    g.beginPath(); g.ellipse(0, 3.8, 3.7, 4.1, 0, 0, TAU); g.fillStyle = LENS; g.fill(); g.stroke();
    // a glint sweeps across the lenses now and then
    g.beginPath(); g.ellipse(-1.2, 2.2, 1, 1.4, .4, 0, TAU); g.ellipse(-1.1, -5.4, .8, 1.2, .4, 0, TAU);
    g.fillStyle = 'rgba(255,255,255,.85)'; g.fill();
    const u = frac(t / 4.3) * 4;
    if (u < 1) {
      g.beginPath(); g.ellipse(1.2 - u * 2, 6 - u * 12, .7, 2, .4, 0, TAU);
      g.fillStyle = `rgba(255,255,255,${(.9 * Math.sin(Math.PI * u)).toFixed(3)})`; g.fill();
    }
    g.restore();
  }

  function mouth(g) {
    at(g, .07, prof(BOT, .07) - 2.8, 0);
    g.beginPath(); g.lineWidth = LW * .8; g.strokeStyle = C.INK;
    if (F.mouth === 'grin') {
      g.moveTo(2, -1.4); g.quadraticCurveTo(-5, .8, -12.5, -3.4); g.quadraticCurveTo(-6, 9.5, 2, 3.5); g.closePath();
      g.fillStyle = MOUTH; g.fill(); g.stroke();
      g.beginPath(); g.moveTo(1, -1.1); g.lineTo(-.6, 1.8); g.lineTo(-2.4, -.4); g.lineTo(-4.2, 2.2); g.lineTo(-6, -.4);
      g.lineTo(-7.8, 1.9); g.lineTo(-9.6, -1.4); g.closePath(); g.fillStyle = C.WHITE; g.fill(); g.lineWidth = 1; g.stroke();
    } else if (F.mouth === 'wobble') {
      g.moveTo(1, .5); g.quadraticCurveTo(-2, -1.8, -5, .4); g.quadraticCurveTo(-8, 2.6, -11, .2); g.stroke();
    } else if (F.mouth === 'sad') {
      g.moveTo(1, 1.4); g.quadraticCurveTo(-5, -2, -11, 2.8); g.stroke();
    } else {
      g.moveTo(1, 0); g.lineTo(-9, .5); g.quadraticCurveTo(-11, .6, -11.5, 2.3); g.stroke();
      // one tooth poking up over the lip: the whole of its sense of humour
      g.beginPath(); g.moveTo(-2.2, .2); g.lineTo(-3.3, -2.6); g.lineTo(-4.5, .3); g.closePath();
      g.fillStyle = C.WHITE; g.fill(); g.lineWidth = 1.1; g.stroke();
    }
    g.restore();
  }

  function drops(g, x0, y0, u) {
    if (u < 0 || u >= 1) return;
    g.beginPath();
    for (let i = 0; i < 4; i++) {
      const x = x0 + DVX[i] * u, y = y0 + DVY[i] * u + 48 * u * u, r = DR[i] * (1 - .5 * u);
      g.moveTo(x + r, y); g.arc(x, y, r, 0, TAU);
    }
    g.globalAlpha = Math.min(1, (1 - u) * 3);
    g.fillStyle = DROP; g.fill(); g.lineWidth = 1.2; g.strokeStyle = C.INK; g.stroke();
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
    P.shade = (ride ? BOT[IA] : -oy) - 9;
    const ground = ride ? 1e9 : (P.lift - P.dy) / P.sy - oy;
    const kn = ride ? 1 : planted(.28, 5, P.pn, P.pk, ground), kf = ride ? 1 : planted(.26, 2, P.pf, P.pk, ground);
    if (!ride) shadow(g, 112, P.lift);
    if (drop >= 0) drops(g, dx0, dy0, drop);
    g.translate(P.dx, P.dy - P.lift); g.scale(P.sx, P.sy); g.translate(ox, oy);

    const kx = -P.dx / P.sx - ox;                  // the cable, in body coordinates
    if (P.hug) { pt(.26, 2); hug(g, .26, 2, BACK_DK, kx - X, 37 + P.hug, P.hug * .6); }
    else fin(g, .26, 2, P.pf, BACK_DK, P.pk, kf);  // far pectoral, behind the body
    fins(g);
    body(g);
    if (o.bib) { at(g, .52, -.5, 0); bib(g, 0, 0, o.bib, { w: 18, h: 14, a: 0 }); g.restore(); }
    mouth(g);
    if (P.hug) { pt(.28, 5); hug(g, .28, 5, BACK, kx - X, 33 + P.hug, P.hug); }
    else fin(g, .28, 5, P.pn, BACK, P.pk, kn);     // near pectoral
    hammer(g, t);
    g.restore();
  }

  AKIT.register({
    key: 'shark', name: 'Great hammerhead', status: 'Critically Endangered',
    fact: 'Its wide hammer head helps it pin stingrays, its favourite prey, to the sea floor.',
    draw,
  });
})();
