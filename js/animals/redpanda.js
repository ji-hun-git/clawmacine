// Red panda (Ailurus fulgens). A rust-red show-off in a cobalt racing neckerchief: it bounds like a
// ferret, steers with a ringed tail as long as its body, and rides the crane with that tail looped
// round the cable like a safety line. The white brow spots double as its eyebrows.
(() => {
  const { C, TAU, LW, paint, sheen, eye, blush, sweat, bib, shadow, cyc, ease } = AKIT;

  const RUST = '#c64a1e', RUST_DK = '#8a2a12', OCHRE = '#f0c47e', RUST_FAR = '#9b3815', OCHRE_FAR = '#c99a5e',
    FUR = C.CREAM, FUR_FAR = '#e2d5bd',
    LEG = '#3e251d', LEG_FAR = '#21130e', BELLY = '#2f1c16', SCARF = C.COBALT, SCARF_DK = '#1b3180',
    MOUTH = '#5c1913', TONGUE = '#ee8680';
  const PI = Math.PI, HR = 17, RING = [7, 8], RING_OFF = 7, STITCH = [1.6, 2.4], SOLID = [];
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  // brow spots: [near angle, far angle, near dy, far dy]
  const BROWS = {
    focus: [.5, -.5, 1.4, 1.4], worry: [-.5, .5, -2.2, -2.2], cheer: [-.2, .2, -3.2, -3.2],
    sad: [-.42, .42, .6, .6], smug: [.22, -.32, .8, -2.8],
  };

  // ---------- rig helpers ----------
  // two-bone IK: anchor -> knee -> foot; bend +1 puts the joint behind (elbow), -1 in front (knee)
  function ik(ax, ay, fx, fy, l1, l2, bend) {
    const dx = fx - ax, dy = fy - ay, d0 = Math.hypot(dx, dy) || 1e-3, ux = dx / d0, uy = dy / d0;
    const d = clamp(d0, Math.abs(l1 - l2) + .5, l1 + l2 - .01);
    const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
    return [ax + ux * a - uy * h * bend, ay + uy * a + ux * h * bend, ax + ux * d, ay + uy * d];
  }
  // an inked tube along a polyline (legs, arms, feet)
  function limb(g, p, w, col) {
    g.beginPath(); g.moveTo(p[0], p[1]);
    for (let i = 2; i < p.length; i += 2) g.lineTo(p[i], p[i + 1]);
    g.lineCap = 'round'; g.lineJoin = 'round';
    g.lineWidth = w + LW * 2; g.strokeStyle = C.INK; g.stroke();
    g.lineWidth = w; g.strokeStyle = col; g.stroke();
  }
  function leg(g, ax, ay, fx, fy, l1, l2, bend, pa, w, col, pl = 5) {
    const k = ik(ax, ay, fx, fy, l1, l2, bend);
    limb(g, [ax, ay, k[0], k[1], k[2], k[3], k[2] + Math.cos(pa) * pl, k[3] + Math.sin(pa) * pl], w, col);
  }
  function polyLen(p) {
    let s = 0;
    for (let i = 2; i < p.length; i += 2) s += Math.hypot(p[i] - p[i - 2], p[i + 1] - p[i - 1]);
    return s;
  }

  // torso as a bean between a hip circle and a chest circle; arch bows the back, belly the underside
  function bean(g, hx, hy, rH, cx, cy, rC, arch, belly) {
    let dx = cx - hx, dy = cy - hy; const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
    const nx = dy, ny = -dx, mx = (hx + cx) / 2, my = (hy + cy) / 2, rm = (rH + rC) / 2, k = 1.33;
    g.beginPath(); g.moveTo(hx + nx * rH, hy + ny * rH);
    g.quadraticCurveTo(mx + nx * (rm + 2 * arch), my + ny * (rm + 2 * arch), cx + nx * rC, cy + ny * rC);
    g.bezierCurveTo(cx + nx * rC + dx * rC * k, cy + ny * rC + dy * rC * k, cx - nx * rC + dx * rC * k, cy - ny * rC + dy * rC * k, cx - nx * rC, cy - ny * rC);
    g.quadraticCurveTo(mx - nx * (rm + 2 * belly), my - ny * (rm + 2 * belly), hx - nx * rH, hy - ny * rH);
    g.bezierCurveTo(hx - nx * rH - dx * rH * k, hy - ny * rH - dy * rH * k, hx + nx * rH - dx * rH * k, hy + ny * rH - dy * rH * k, hx + nx * rH, hy + ny * rH);
    g.closePath();
  }
  // rust coat, halftone underside, soot-black belly
  function torso(g, hx, hy, rH, cx, cy, rC, arch, belly, shadeY) {
    bean(g, hx, hy, rH, cx, cy, rC, arch, belly);
    paint(g, RUST, { shadeFrom: shadeY, lw: 0 });
    g.save(); g.clip();
    let dx = cx - hx, dy = cy - hy; const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
    const rm = (rH + rC) / 2, k = rm * 1.05 + belly;
    g.beginPath(); g.ellipse((hx + cx) / 2 - dy * k, (hy + cy) / 2 + dx * k, L * .62 + rm * .7, rm * .62, Math.atan2(dy, dx), 0, TAU);
    g.fillStyle = BELLY; g.fill();
    g.restore();
    bean(g, hx, hy, rH, cx, cy, rC, arch, belly);
    g.lineWidth = LW; g.strokeStyle = C.INK; g.lineJoin = 'round'; g.stroke();
  }

  // the ringed brush. sp = spine points (flat x,y list); draws the stretch of spine points a..b, so a
  // tail can be drawn in pieces (behind and in front of the cable) that still join up. The rings are
  // one dashed stroke along the spine, clipped to the fur outline, so they bend with the tail and
  // never slide. open = no ink across the cut ends (for a piece laid over another); far = the
  // darker inks of a stretch that passes behind something.
  function tail(g, sp, wMax, a = 0, b = sp.length / 2 - 1, { taper = true, open = false, far = false } = {}) {
    const nT = sp.length / 2 - 1, n = b - a, N2 = n * 2, tip = b === nT, L = [], R = [], P = sp.slice(a * 2, b * 2 + 2);
    let tx = 1, ty = 0, off = RING_OFF;
    for (let i = 1; i <= a; i++) off += Math.hypot(sp[i * 2] - sp[i * 2 - 2], sp[i * 2 + 1] - sp[i * 2 - 1]);
    for (let i = a; i <= b; i++) {
      const p = Math.max(0, i - 1) * 2, q = Math.min(nT, i + 1) * 2;
      tx = sp[q] - sp[p]; ty = sp[q + 1] - sp[p + 1];
      const d = Math.hypot(tx, ty) || 1; tx /= d; ty /= d;
      const w = wMax * (taper ? .58 + .42 * Math.sin(Math.min(1, i / nT / .3) * PI / 2) : 1) * (i % 2 ? .9 : 1) * (tip && i === nT ? .82 : 1);
      L.push(sp[i * 2] - ty * w, sp[i * 2 + 1] + tx * w); R.push(sp[i * 2] + ty * w, sp[i * 2 + 1] - tx * w);
    }
    const ext = tip ? wMax * .95 : 0, ex = P[N2] + tx * ext, ey = P[N2 + 1] + ty * ext;
    const sideL = () => { for (let i = 1; i < n; i++) g.quadraticCurveTo(L[i * 2], L[i * 2 + 1], (L[i * 2] + L[i * 2 + 2]) / 2, (L[i * 2 + 1] + L[i * 2 + 3]) / 2); };
    const sideR = () => { for (let i = n - 1; i >= 1; i--) g.quadraticCurveTo(R[i * 2], R[i * 2 + 1], (R[i * 2] + R[i * 2 - 2]) / 2, (R[i * 2 + 1] + R[i * 2 - 1]) / 2); g.lineTo(R[0], R[1]); };
    g.beginPath(); g.moveTo(L[0], L[1]); sideL();
    if (tip) { g.quadraticCurveTo(L[N2], L[N2 + 1], ex, ey); g.quadraticCurveTo(R[N2], R[N2 + 1], (R[N2] + R[N2 - 2]) / 2, (R[N2 + 1] + R[N2 - 1]) / 2); }
    else { g.lineTo(L[N2], L[N2 + 1]); g.lineTo(R[N2], R[N2 + 1]); g.lineTo((R[N2] + R[N2 - 2]) / 2, (R[N2 + 1] + R[N2 - 1]) / 2); }
    sideR(); g.closePath();
    // outline at double width under the fill: the fill trims it to one clean line outside
    g.lineJoin = 'round';
    if (!open) { g.lineWidth = LW * 2; g.strokeStyle = C.INK; g.stroke(); }
    g.fillStyle = far ? RUST_FAR : RUST; g.fill();
    g.save(); g.clip();
    g.beginPath(); g.moveTo(P[0], P[1]);
    for (let i = 1; i < n; i++) g.quadraticCurveTo(P[i * 2], P[i * 2 + 1], (P[i * 2] + P[i * 2 + 2]) / 2, (P[i * 2 + 1] + P[i * 2 + 3]) / 2);
    g.lineTo(P[N2], P[N2 + 1]); g.lineTo(ex + tx * 6, ey + ty * 6);
    g.lineCap = 'butt'; g.lineWidth = wMax * 2.1 + 1; g.strokeStyle = far ? OCHRE_FAR : OCHRE;
    g.setLineDash(RING); g.lineDashOffset = off; g.stroke(); g.setLineDash(SOLID);
    if (tip) {   // soot-dark brush tip
      g.beginPath(); g.moveTo((P[N2 - 2] + P[N2]) / 2, (P[N2 - 1] + P[N2 + 1]) / 2); g.lineTo(P[N2], P[N2 + 1]); g.lineTo(ex + tx * 6, ey + ty * 6);
      g.strokeStyle = RUST_DK; g.stroke();
    }
    g.restore();
    if (open) {   // ink the long sides (and the tip) but not the cut ends
      g.beginPath(); g.moveTo(L[0], L[1]); sideL();
      if (tip) { g.quadraticCurveTo(L[N2], L[N2 + 1], ex, ey); g.quadraticCurveTo(R[N2], R[N2 + 1], (R[N2] + R[N2 - 2]) / 2, (R[N2 + 1] + R[N2 - 1]) / 2); }
      else { g.lineTo(L[N2], L[N2 + 1]); g.moveTo(R[N2], R[N2 + 1]); g.lineTo((R[N2] + R[N2 - 2]) / 2, (R[N2 + 1] + R[N2 - 1]) / 2); }
      sideR();
      g.lineWidth = LW; g.strokeStyle = C.INK; g.stroke();
    }
  }

  // ---------- head ----------
  function ear(g, x, y, a, k, far) {
    g.save(); g.translate(x, y); g.rotate(a); g.scale(k, k);
    g.beginPath(); g.moveTo(-7.5, 3); g.quadraticCurveTo(-7.6, -9, 0, -15.5); g.quadraticCurveTo(7.6, -9, 7.5, 3); g.closePath();
    paint(g, far ? FUR_FAR : FUR, { lw: LW / k });
    g.beginPath(); g.moveTo(-4.2, 3); g.quadraticCurveTo(-4.3, -5.5, 0, -10.4); g.quadraticCurveTo(4.3, -5.5, 4.2, 3); g.closePath();
    g.fillStyle = far ? RUST_DK : RUST; g.fill();
    g.restore();
  }
  // a fur eyelid over the top of an eye (k = how far it is shut)
  function lid(g, x, y, r, k, tilt) {
    g.save(); g.beginPath(); g.ellipse(x, y, r, r * 1.08, 0, 0, TAU); g.clip();
    g.translate(x, y); g.rotate(tilt);
    const yl = -r * 1.1 + 2.2 * r * k;
    g.fillStyle = RUST; g.fillRect(-r * 1.6, -r * 1.7, r * 3.2, yl + r * 1.7);
    g.beginPath(); g.moveTo(-r * 1.3, yl); g.lineTo(r * 1.3, yl); g.lineWidth = LW * .8; g.strokeStyle = C.INK; g.stroke();
    g.restore();
  }
  function mouth(g, R, m) {
    g.lineWidth = LW * .8; g.strokeStyle = C.INK; g.lineCap = 'round'; g.lineJoin = 'round';
    if (m === 'grin') {
      g.beginPath(); g.moveTo(R * .28, R * .56); g.quadraticCurveTo(R * .62, R * .64, R * .94, R * .5);
      g.quadraticCurveTo(R * .66, R * 1.12, R * .28, R * .56); g.fillStyle = MOUTH; g.fill(); g.stroke();
      g.beginPath(); g.ellipse(R * .6, R * .75, R * .17, R * .08, -.1, 0, TAU); g.fillStyle = TONGUE; g.fill();
      return;
    }
    g.beginPath(); g.moveTo(R * .66, R * .45); g.lineTo(R * .64, R * .58);
    if (m === 'focus') {   // tongue tip poking out of the corner: concentrating hard
      g.stroke();
      g.beginPath(); g.ellipse(R * .86, R * .63, 2.8, 2.1, .6, 0, TAU); g.fillStyle = TONGUE; g.fill(); g.lineWidth = LW * .6; g.stroke();
      g.lineWidth = LW * .8; g.beginPath(); g.moveTo(R * .42, R * .6); g.quadraticCurveTo(R * .62, R * .7, R * .86, R * .56);
    } else if (m === 'wavy') {
      g.moveTo(R * .4, R * .66); g.quadraticCurveTo(R * .47, R * .58, R * .55, R * .65);
      g.quadraticCurveTo(R * .63, R * .72, R * .71, R * .64); g.quadraticCurveTo(R * .78, R * .57, R * .85, R * .64);
    } else if (m === 'frown') {
      g.moveTo(R * .42, R * .73); g.quadraticCurveTo(R * .63, R * .56, R * .84, R * .7);
    } else {   // smirk: one corner hooked up
      g.moveTo(R * .42, R * .62); g.quadraticCurveTo(R * .64, R * .7, R * .86, R * .52);
    }
    g.stroke();
  }
  // head in a 3/4 turn toward +x, centred at (x, y)
  function head(g, x, y, a, f) {
    const R = HR, B = BROWS[f.brow] || BROWS.smug;
    g.save(); g.translate(x, y); g.rotate(a);
    ear(g, R * .52, -R * .7, f.eF, .84, true);
    ear(g, -R * .45, -R * .72, f.eN, 1, false);
    g.beginPath(); g.moveTo(0, -R);
    g.bezierCurveTo(R * .8, -R, R * 1.1, -R * .5, R * 1.06, R * .08);
    g.bezierCurveTo(R * 1.02, R * .72, R * .5, R * .98, 0, R * .94);
    g.bezierCurveTo(-R * .62, R * .92, -R * 1.08, R * .6, -R * 1.08, 0);
    g.bezierCurveTo(-R * 1.08, -R * .62, -R * .72, -R, 0, -R);
    paint(g, RUST);
    sheen(g, -R * .3, -R * .5, R * .55, R * .36, .45);
    // white cheek ruffs flaring past the jaw
    g.beginPath(); g.moveTo(-R * .32, R * .1);
    g.quadraticCurveTo(-R * .85, 0, -R * 1.32, R * .3); g.lineTo(-R * 1.03, R * .45); g.lineTo(-R * 1.22, R * .68);
    g.quadraticCurveTo(-R * .62, R * 1.02, -R * .12, R * .76); g.quadraticCurveTo(-R * .06, R * .36, -R * .32, R * .1);
    paint(g, FUR, { lw: LW * .8 });
    g.beginPath(); g.moveTo(R * .86, R * .04);
    g.quadraticCurveTo(R * 1.18, R * .1, R * 1.27, R * .36); g.lineTo(R * 1.04, R * .46);
    g.quadraticCurveTo(R * 1.0, R * .74, R * .76, R * .68); g.quadraticCurveTo(R * .74, R * .3, R * .86, R * .04);
    paint(g, FUR_FAR, { lw: LW * .8 });
    // muzzle, then the tear tracks that run from each eye to the mouth corner
    g.beginPath(); g.ellipse(R * .37, R * .5, R * .43, R * .33, -.08, 0, TAU);
    paint(g, FUR, { lw: LW * .8 });
    g.lineCap = 'round'; g.strokeStyle = RUST_DK;
    g.beginPath(); g.moveTo(-R * .14, R * .12); g.quadraticCurveTo(-R * .1, R * .46, R * .06, R * .74); g.lineWidth = 3.2; g.stroke();
    g.beginPath(); g.moveTo(R * .64, R * .1); g.quadraticCurveTo(R * .8, R * .36, R * .8, R * .64); g.lineWidth = 2.4; g.stroke();
    // brow spots
    g.fillStyle = FUR;
    g.beginPath(); g.ellipse(-R * .14, -R * .55 + B[2], 3.9, 2.3, B[0], 0, TAU); g.fill();
    g.beginPath(); g.ellipse(R * .62, -R * .55 + B[3], 3.2, 2.1, B[1], 0, TAU); g.fill();
    const eo = { t: f.t, look: f.look || 0, lookX: f.lookX == null ? .3 : f.lookX, wide: !!f.wide, seed: f.seed || 0 };
    eye(g, -R * .13, -R * .1, 4.4, eo);
    eye(g, R * .62, -R * .12, 3.7, eo);
    if (f.lid) { lid(g, -R * .13, -R * .1, 4.4, f.lid, .18); lid(g, R * .62, -R * .12, 3.7, f.lid, -.18); }
    // nose
    g.beginPath(); g.moveTo(R * .5, R * .27); g.quadraticCurveTo(R * .65, R * .17, R * .82, R * .27);
    g.quadraticCurveTo(R * .74, R * .45, R * .66, R * .46); g.quadraticCurveTo(R * .56, R * .44, R * .5, R * .27);
    g.fillStyle = C.INK; g.fill();
    mouth(g, R, f.mouth);
    if (f.blush) blush(g, -R * .6, R * .46, 4.6);
    if (f.sweat) sweat(g, -R * 1.05, -R * .28 + 1.2 * cyc(f.t, .9), 1.1);
    g.restore();
  }

  // ---------- costume ----------
  // neckerchief: band round the neck, a point on the chest, a knot at the nape
  function scarf(g, x, y, a) {
    g.save(); g.translate(x, y); g.rotate(a);
    g.beginPath(); g.moveTo(-1, 2); g.lineTo(13, 0); g.lineTo(6.5, 12); g.closePath(); paint(g, SCARF, { lw: LW * .9 });
    g.beginPath(); g.moveTo(-11, -3); g.quadraticCurveTo(0, 7, 13, -2);
    g.lineCap = 'round'; g.lineWidth = 6 + LW * 2; g.strokeStyle = C.INK; g.stroke(); g.lineWidth = 6; g.strokeStyle = SCARF; g.stroke();
    g.beginPath(); g.arc(-11, -3, 3.6, 0, TAU); paint(g, SCARF_DK, { lw: LW * .9 });
    g.restore();
  }
  const napeX = (x, a) => x - 11 * Math.cos(a) + 3 * Math.sin(a);
  const napeY = (y, a) => y - 11 * Math.sin(a) - 3 * Math.cos(a);
  // one streaming tail of the neckerchief; the wave travels out to the free end
  function ribbon(g, x, y, a, len, ph, amp) {
    const ca = Math.cos(a), sa = Math.sin(a), P = [];
    for (let j = 1; j <= 3; j++) { const w = amp * j / 3 * Math.sin(ph - j * 1.1); P.push(x + ca * len * j / 3 - sa * w, y + sa * len * j / 3 + ca * w); }
    g.beginPath(); g.moveTo(x, y);
    g.quadraticCurveTo(P[0], P[1], (P[0] + P[2]) / 2, (P[1] + P[3]) / 2); g.quadraticCurveTo(P[2], P[3], P[4], P[5]);
    g.lineCap = 'round'; g.lineJoin = 'round';
    g.lineWidth = 5 + LW * 2; g.strokeStyle = C.INK; g.stroke();
    g.lineWidth = 5; g.strokeStyle = SCARF; g.stroke();
    g.setLineDash(STITCH); g.lineDashOffset = 0; g.lineWidth = 1.1; g.strokeStyle = 'rgba(255,255,255,.85)'; g.stroke(); g.setLineDash(SOLID);
  }
  function ribbons(g, x, y, a, ph, amp, len = 15) {
    ribbon(g, x, y, a + .22, len * .8, ph + 1.3, amp);
    ribbon(g, x, y, a - .08, len, ph, amp);
  }

  // ---------- poses ----------
  function drawIdle(g, o, t, seed) {
    const br = cyc(t, .42), tw = Math.pow(Math.max(0, cyc(t, .23, .1)), 12);   // breath, a rare ear flick
    shadow(g, 90);
    const Hx = -23, Hy = -30, rH = 14.5, Cx = 13, Cy = -32 - br * .5, rC = 12.6 + br * .3;
    leg(g, Cx - 2, Cy + 4, Cx + 8, -5.5, 13.5, 13.5, 1, 0, 7.5, LEG_FAR);
    leg(g, Hx - 3, Hy + 3, Hx - 7, -5.5, 12.5, 14, -1, 0, 7.5, LEG_FAR);
    const sp = [];
    let x = Hx - rH * .72, y = Hy - rH * .55; sp.push(x, y);
    for (let i = 1; i <= 8; i++) {
      const a = PI + .55 - .3 * i + .022 * i * i + .11 * (.3 + i / 8) * cyc(t, .32, -i * .07);
      x += Math.cos(a) * 8; y += Math.sin(a) * 8; sp.push(x, y);
    }
    tail(g, sp, 10.5);
    torso(g, Hx, Hy, rH, Cx, Cy, rC, 2.5, .5, Cy + 3);
    leg(g, Cx + 2, Cy + 4, Cx + 3, -4, 13.5, 13.5, 1, 0, 8, LEG);
    leg(g, Hx + 2, Hy + 3, Hx + 1, -4, 12.5, 14, -1, 0, 8.5, LEG);
    bib(g, (Hx + Cx) / 2 - 6, (Hy + Cy) / 2 - 3, o.bib, { a: -.04 });
    const na = .5, nx = Cx + 7, ny = Cy - 8;
    ribbons(g, napeX(nx, na), napeY(ny, na), PI * .64 + .07 * cyc(t, .5), t * TAU * .5, 2, 16);
    scarf(g, nx, ny, na);
    head(g, Cx + 14, Cy - 22 + br * .6, -.04 + .02 * br, {
      t, seed, look: o.look || 0, lookX: .35 + .45 * cyc(t, .12), brow: 'smug', mouth: 'smirk', lid: .3,
      eN: -.32 - tw * .4, eF: .3,
    });
  }

  function drawRun(g, o, t, seed) {
    const spd = clamp(o.speed == null ? 1 : o.speed, .2, 1.6);
    const th = t * (1.1 + 1.8 * spd) * TAU, S = Math.sin(th);
    // spine: stretched long in the extended flight, bunched and arched as the hind feet swing under
    const bob = -3.2 * S - .8, span = 36 + 7 * S, sq = 1 - .07 * S, pit = 2.6 * Math.sin(th - 1.1);
    const Hx = -4 - span / 2, Cx = -4 + span / 2, Hy = -30 + bob + pit, Cy = -31 + bob - pit;
    const rH = 14.5 * sq, rC = 12.5 * sq, arch = 1.5 + 6.5 * Math.max(0, -S);
    shadow(g, 74 + 10 * S, Math.max(0, -bob) * 3);
    const A = 8 + 3.5 * Math.min(1, spd), lift = 6 + 3 * Math.min(1, spd);
    const pF = th + PI / 2, pH = th - PI / 2;
    const foot = (ax, ay, off, p, fr, w, col) => {
      const sn = Math.sin(p);
      leg(g, ax, ay, ax + off - A * Math.cos(p), -4 - lift * Math.max(0, sn), fr ? 13.5 : 12.5, fr ? 13.5 : 14, fr ? 1 : -1, (fr ? 1.9 : 1.5) * Math.max(0, sn), w, col);
    };
    foot(Cx - 1, Cy + 4, 5, pF + .55, true, 7.5, LEG_FAR);
    foot(Hx - 3, Hy + 3, -2, pH + .5, false, 7.5, LEG_FAR);
    const sp = [];
    let x = Hx - rH * .72, y = Hy - rH * .5; sp.push(x, y);
    for (let i = 1; i <= 8; i++) {
      const a = PI + .28 - .02 * i + (.1 + .035 * i) * Math.sin(th - 1.7 - i * .55);
      x += Math.cos(a) * 8; y += Math.sin(a) * 8; sp.push(x, y);
    }
    tail(g, sp, 10.5);
    torso(g, Hx, Hy, rH, Cx, Cy, rC, arch, -arch * .5, Math.max(Hy, Cy) + 3);
    foot(Cx + 2, Cy + 4, 2, pF, true, 8, LEG);
    foot(Hx + 2, Hy + 3, 1, pH, false, 8.5, LEG);
    bib(g, (Hx + Cx) / 2 - 5, (Hy + Cy) / 2 - 3, o.bib, { a: Math.atan2(Cy - Hy, Cx - Hx) - .04 });
    const na = .55, nx = Cx + 6, ny = Cy - 7;
    ribbons(g, napeX(nx, na), napeY(ny, na), PI + .1, th * 2, 3.5, 24);
    scarf(g, nx, ny, na);
    head(g, Cx + 13, Cy - 19 + 1.8 * Math.sin(th - 1.4), -.04 + .06 * Math.sin(th - 1.8), {
      t, seed, look: o.look || 0, lookX: .75, brow: 'focus', mouth: 'grin',
      eN: -.75 + .15 * Math.sin(th - 2.2), eF: -.15 + .15 * Math.sin(th - 2.5),
    });
  }

  function drawCheer(g, o, t, seed) {
    // the red panda "surprise stand": up on the hind feet, arms flung high, hopping
    const rate = 1.45, u = ((t * rate) % 1 + 1) % 1, air = u < .7, ua = u / .7;
    const hgt = air ? 68 * ua * (1 - ua) : 0;
    const sq = air ? 0 : Math.sin(PI * (u - .7) / .3), st = air ? .07 * Math.pow(Math.sin(2 * PI * ua), 2) : 0;
    const tuck = air ? 5 * Math.sin(PI * ua) : 0, wv = cyc(t, rate * 2);
    shadow(g, 52, hgt);
    g.save(); g.translate(0, -hgt); g.scale(1 + sq * .1 - st * .5, 1 - sq * .13 + st);
    const Hx = -1, Hy = -23, rH = 13.5, Cx = 1, Cy = -47, rC = 11;
    const sp = [];
    let x = Hx - rH * .75, y = Hy + rH * .3; sp.push(x, y);
    for (let i = 1; i <= 8; i++) {
      const a = PI - .5 + .24 * i + .16 * (i / 8) * cyc(t, rate, -.12 - i * .05);
      x += Math.cos(a) * 7.5; y += Math.sin(a) * 7.5; sp.push(x, y);
    }
    tail(g, sp, 10);
    leg(g, Hx - 3, Hy + 6, -6, -4 - tuck, 10, 10, -1, 0, 7.5, LEG_FAR);
    leg(g, Cx - 3, Cy - 7, Cx - 23 - 2 * wv, Cy - 23 + 2 * wv, 13, 13, -1, -PI / 2 - .5, 7, LEG_FAR, 4);
    torso(g, Hx, Hy, rH, Cx, Cy, rC, 1.5, 0, Hy + 2);
    leg(g, Hx + 3, Hy + 7, 6, -4 - tuck, 10, 10, -1, 0, 8.5, LEG);
    bib(g, Hx - 3, Hy - 10, o.bib, { a: -.08 });
    leg(g, Cx + 4, Cy - 7, Cx + 25 + 2 * wv, Cy - 22 - 2 * wv, 13, 13, 1, -PI / 2 + .5, 8, LEG, 4);
    const na = .12, nx = Cx + 1, ny = Cy - 6;
    ribbons(g, napeX(nx, na), napeY(ny, na), PI * .82 - .45 * cyc(t, rate, -.2), t * TAU * 2.5, 2.5, 16);
    scarf(g, nx, ny, na);
    head(g, Cx + 2, Cy - 19, .07 * cyc(t, rate, .3), {
      t, seed, look: -.5, lookX: .2, brow: 'cheer', mouth: 'grin', blush: true,
      eN: -.2 + .12 * wv, eF: .22 - .12 * wv,
    });
    g.restore();
  }

  function drawWorry(g, o, t, seed) {
    // hunched on its haunches, hugging its own tail, eyes darting
    const fid = cyc(t, 1.7), sw = .035 * cyc(t, .8);
    shadow(g, 62);
    g.save(); g.rotate(sw); g.translate(.35 * cyc(t, 7), 0);
    const Hx = -5, Hy = -15, rH = 14.5, Cx = 3, Cy = -39, rC = 11;
    leg(g, Cx - 1, Cy + 4, Cx + 13, Cy + 13 + 1.5 * Math.max(0, -fid), 10, 10, 1, -.3, 7, LEG_FAR, 4);
    torso(g, Hx, Hy, rH, Cx, Cy, rC, 3, 0, Hy);
    bib(g, Hx - 5, Hy - 12, o.bib, { a: -.15 });
    const sp = [];
    let x = Hx - rH * .5, y = Hy + rH * .45; sp.push(x, y);
    for (let i = 1; i <= 8; i++) {
      const a = .05 - .235 * i + .05 * (i / 8) * cyc(t, 1.1, -i * .06);
      x += Math.cos(a) * 7; y += Math.sin(a) * 7; sp.push(x, y);
    }
    tail(g, sp, 9.5);
    leg(g, Cx + 3, Cy + 5, Cx + 16, Cy + 16 + 1.5 * Math.max(0, fid), 10, 10, 1, -.2, 8, LEG, 4);
    const na = .15, nx = Cx + 3, ny = Cy - 6;
    ribbons(g, napeX(nx, na), napeY(ny, na), PI * .56 + .05 * cyc(t, 6), t * TAU * .8, 1.2, 13);
    scarf(g, nx, ny, na);
    head(g, Cx + 5, Cy - 18, -.04 + .05 * cyc(t, .8, .2), {
      t, seed, look: .1, lookX: .95 * Math.tanh(2.5 * cyc(t, .45)), wide: true, brow: 'worry', mouth: 'wavy', sweat: true,
      eN: -1 + .06 * fid, eF: .95 - .06 * fid,
    });
    g.restore();
  }

  function drawRide(g, o, t, seed, s) {
    const look = clamp(o.look || 0, -1, 1), emo = ['focus', 'worry', 'cheer', 'sad'].includes(o.emotion) ? o.emotion : 'focus';
    const wor = emo === 'worry', che = emo === 'cheer', sad = emo === 'sad';
    const br = cyc(t, .5), tx = wor ? .6 * cyc(t, 7.5) : 0, wv = cyc(t, 3.2);
    g.save(); g.translate(tx, che ? -3 * Math.abs(Math.sin(PI * 1.8 * t)) : 0);
    // perched on the right end of the hub, leaning out over the edge to peer down
    const lean = .45 + .1 * look + (sad ? .2 : 0) + (wor ? .06 : 0), tl = sad ? 19 : wor ? 20 : 21;
    const Hx = 12, Hy = -12, rH = 12, rC = 10.5 + br * .25;
    const Cx = Hx + tl * Math.sin(lean), Cy = Hy - tl * Math.cos(lean) + br * .4;
    // tail wrapped round the cable (x = 0) like a safety line: out from under the haunch and round
    // behind the cable (darker, with a stub of cable over it), then back across in front
    const wag = che ? 3 * cyc(t, 3) : wor ? .7 * cyc(t, 8) : 1.2 * cyc(t, .6), dr = sad ? 1 : 0;
    const T = [8, -7, 0, -10, -9, -14, -10, -19, -3, -24, 6, -28, 9, -31, 3, -35, -6, -38, -10, -42,
      -12 - 2 * dr + wag * .3, -50 + 3 * dr, -10 - 9 * dr + wag * .7, -57 + 12 * dr, -5 - 18 * dr + wag, -61 + 21 * dr];
    tail(g, T, 6.5, 0, 6, { far: true });
    const cw = 1 / s;
    g.lineCap = 'butt';
    g.beginPath(); g.moveTo(-tx - 1.2 * cw, -48); g.lineTo(-tx - 1.2 * cw, -2); g.lineWidth = 2.2 * cw; g.strokeStyle = C.INK; g.stroke();
    g.beginPath(); g.moveTo(-tx + cw, -48); g.lineTo(-tx + cw, -2); g.lineWidth = 1.2 * cw; g.strokeStyle = C.STEEL; g.stroke();
    tail(g, T, 6.5, 6, 12, { open: true });
    // far arm: grips the hub edge, or reaches up to hang on to the cable while cheering
    if (che) leg(g, Cx - 2, Cy - 4, 1.5 - tx, Cy - 20, 12.5, 12, -1, PI, 7, LEG_FAR, 4);
    else leg(g, Cx - 1, Cy + 4, 12.5, -3.2, 12.5, 12, 1, .9, 7, LEG_FAR, 4);
    torso(g, Hx, Hy, rH, Cx, Cy, rC, 1.5, 0, Hy);
    bib(g, Cx - 10, Cy + 7, o.bib, { a: lean - .5 });
    if (che) leg(g, Cx + 6, Cy - 2, Cx + 29 + wv, Cy - 16 - 4 * wv, 12.5, 12, 1, -PI / 2 + .3 + .3 * wv, 8, LEG, 4);
    else {
      leg(g, Cx + 3, Cy + 5, 19.5, -3.2, 12.5, 12, 1, .9, 8, LEG, 4);
      // claws hooked over the edge
      g.beginPath(); g.moveTo(21.6, -1.8); g.lineTo(23, 1.2); g.moveTo(19.8, -.6); g.lineTo(20.8, 2.4);
      g.lineWidth = 1.3; g.strokeStyle = FUR; g.lineCap = 'round'; g.stroke();
    }
    scarf(g, Cx + 5, Cy - 6, .3);
    head(g, Cx + 5 + 2 * look, Cy - 18 + 3 * look + (sad ? 2 : 0) + (che ? -2 : 0),
      .3 * look + (sad ? .12 : 0) + (che ? -.08 + .06 * cyc(t, 1.8) : 0), {
        t, seed, look, lookX: .2, brow: emo, wide: wor, lid: sad ? .55 : 0, blush: che, sweat: wor,
        mouth: che ? 'grin' : wor ? 'wavy' : sad ? 'frown' : 'focus',
        eN: wor ? -1 : sad ? -1.15 : che ? -.2 + .1 * wv : -.35, eF: wor ? .95 : sad ? 1.05 : che ? .2 : .32,
      });
    g.restore();
  }

  function draw(g, o) {
    const s = o.scale || 1, t = o.t || 0, seed = o.bib ? (parseFloat(o.bib.n) || 0) * .61 : 0;
    g.save(); g.scale(s, s);
    if (o.mode === 'run') drawRun(g, o, t, seed);
    else if (o.mode === 'ride') drawRide(g, o, t, seed, s);
    else if (o.mode === 'cheer') drawCheer(g, o, t, seed);
    else if (o.mode === 'worry') drawWorry(g, o, t, seed);
    else drawIdle(g, o, t, seed);
    g.restore();
  }

  AKIT.register({
    key: 'redpanda', name: 'Red Panda', status: 'Endangered',
    fact: 'Red pandas wrap their bushy tails around themselves like a blanket to keep warm.',
    draw,
  });
})();
