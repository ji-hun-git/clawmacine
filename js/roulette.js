// Old roulette on a card table under the one lamp (ART.LIGHT). A turned walnut bowl with a lacquered ball track,
// a spun-tin apron with eight chrome diamonds, and a printed tin rotor with chrome frets turns one way while a
// steel ball runs the other way, drops and rattles between the frets. Where it rests sets the next group.
// Drawn as a tabletop seen from a chair: wheel-plane y is scaled by T, height z lifts by E.
// Physics is polar on a fixed 1/600 s step fed only by simDt, so slow motion never changes where the ball lands.
// Staging (camera, drama, wantSlow, flashes) reads the physics and never writes it; it uses realDt and no Math.random.
window.Roulette = function (canvas, hooks) {
  const { GROUP, TAU } = ART;
  const S = 330, cx = 165, cy = 168, ZB = .9, T = .76, E = Math.sqrt(1 - T * T), H = 1 / 600;
  const R_OUT = 160, R_TRACK = 141, R_APR = 128, R_DEF = 125, R_ROT = 117, R_NUM0 = 99, R_P0 = 72, R_KNOB = 18, BALL = 6.5;
  const Z_RIM = 22, Z_TRK = 18, Z_APR = 13, Z_GAP = 8, Z_NUM = 6.5, Z_POC = 3, Z_CN0 = 5, Z_CN1 = 15;
  const W_FALL = 4.4, DIAMONDS = 8;
  const g0 = canvas.getContext('2d');
  let g = g0;
  const mod = (a, m) => ((a % m) + m) % m, wrapPi = a => Math.atan2(Math.sin(a), Math.cos(a));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), ease = x => x * x * (3 - 2 * x);
  const reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  let groups = [], pockets = [], rot = 0, rotW = .25, acc = 0;
  const ball = { st: 'rest', r: R_P0 + BALL, a: 0, w: 0, vr: 0, rel: .1, relW: 0, hits: 0, hop: 0 };
  let live = false, dragging = false, samples = [], lastA = 0, locked = false, launchIn = 0, winGroup = -1;
  const cam = { x: S / 2, y: S / 2, z: 1 };
  let drama = 0, slowS = 0, stop = 0, stT = 0, lastSt = 'rest', resT = -1, hang = 0, ticks = 0, winK = 0, dRel = ball.rel;
  let shake = 0, seed = 7, scale = 1, dirty = true, frameN = 0, shown = true, quiet = false;
  const flash = new Array(DIAMONDS).fill(0), trail = [];
  const fx = (...a) => !quiet && hooks.sfx && hooks.sfx(...a);

  const ps = () => TAU / Math.max(1, pockets.length);

  function build(list) {
    const had = pockets.length;
    groups = list.slice(); pockets = [];
    const n = groups.length;
    if (n) {
      let k = 2, best = 1e9;   // pockets per group: an even ring of about 18, never fewer than 2 each
      for (let m = 2; m <= 18; m++) if ((n * m) % 2 === 0 && Math.abs(n * m - 18) < best) { best = Math.abs(n * m - 18); k = m; }
      let prev = -1;
      for (let j = 0; j < k; j++) {
        const perm = [...Array(n).keys()];
        for (let i = n - 1; i > 0; i--) { const r = Math.floor(Math.random() * (i + 1)); [perm[i], perm[r]] = [perm[r], perm[i]]; }
        if (perm[0] === prev && n > 1) perm.push(perm.shift());
        pockets.push(...perm); prev = perm[n - 1];
      }
      const L = pockets.length;
      if (n > 2 && pockets[0] === pockets[L - 1]) [pockets[L - 1], pockets[L - 2]] = [pockets[L - 2], pockets[L - 1]];
    }
    winGroup = -1; winK = 0; if (!live) resT = -1; dirty = true;
    if (ball.st === 'rest' && pockets.length) ball.rel = had ? (Math.floor(mod(ball.rel, TAU) / ps()) + .5) * ps() : (Math.floor(Math.random() * pockets.length) + .5) * ps();
    if (!had) dRel = ball.rel;
  }

  function launch() {
    if (!groups.length) return;
    const dir = rotW >= 0 ? -1 : 1;
    ball.st = 'track'; ball.a = rot + ball.rel; ball.r = R_TRACK - BALL; ball.vr = 0; ball.hits = 0; ball.hop = 0;
    ball.w = dir * (10.5 + Math.random() * 4);
    live = true; resT = -1; hang = 0; ticks = 0; winGroup = -1; winK = 0; trail.length = 0;
    hooks.onLaunch && hooks.onLaunch();
    fx('ballDrop');
  }
  function spin() {
    if (locked || live || dragging || launchIn || groups.length < 2) return false;
    rotW = (2.2 + Math.random() * 1.4) * (Math.random() < .5 ? 1 : -1);
    launch(); return true;
  }

  // one physics step of H seconds
  function phys() {
    const h = H;
    if (!dragging) { rot += rotW * h; rotW *= 1 - (live ? .05 : .35) * h; if (!live && Math.abs(rotW) < 1e-3) rotW = 0; }
    if (ball.hop > 0) ball.hop = Math.max(0, ball.hop - 6 * h);
    if (ball.st === 'track') {
      ball.a += ball.w * h;
      ball.w -= Math.sign(ball.w) * (2.3 + .09 * Math.abs(ball.w)) * h;
      if (Math.abs(ball.w) < W_FALL) { ball.st = 'fall'; ball.vr = -10; }
    } else if (ball.st === 'fall') {
      ball.a += ball.w * h;
      ball.w -= Math.sign(ball.w) * .5 * h;
      const pr = ball.r;
      ball.vr -= 520 * h; ball.r += ball.vr * h;
      if (ball.r > R_TRACK - BALL) { ball.r = R_TRACK - BALL; ball.vr = -Math.abs(ball.vr) * .3; }
      if (pr > R_DEF && ball.r <= R_DEF) {
        const k = Math.round((mod(ball.a, TAU) - TAU / 16) / (TAU / DIAMONDS));
        const da = Math.abs(wrapPi(ball.a - (k * TAU / DIAMONDS + TAU / 16)));
        if (da < .28 && ball.hits < 3) {
          ball.hits++;
          ball.r = R_DEF + .5; ball.vr = Math.abs(ball.vr) * (.35 + Math.random() * .25);
          ball.w *= .5 + Math.random() * .6; if (Math.random() < .25) ball.w = -ball.w * .6;
          if (Math.abs(ball.w) < 1.2) ball.w = (Math.random() < .5 ? -1 : 1) * (1.2 + Math.random());
          flash[mod(k, DIAMONDS)] = .09; stop = Math.max(stop, .06); ball.hop = .7;
          fx('clack');
        }
      }
      if (ball.r <= R_NUM0 - 2) {
        ball.st = 'pocket'; ball.rel = ball.a - rot; ball.relW = ball.w - rotW;
        fx('tick', 1.2);
      }
    } else if (ball.st === 'pocket') {
      const prevRel = ball.rel, s = Math.sign(ball.relW), d = BALL / ball.r;
      const lead0 = Math.floor((ball.rel + s * d) / ps());
      ball.rel += ball.relW * h;
      const lead1 = Math.floor((ball.rel + s * d) / ps());
      if (lead1 !== lead0) {
        if (Math.abs(ball.relW) > 5 && Math.random() < .55) {
          ball.relW *= .55; ball.vr = 70 + Math.random() * 60; ball.hop = 1;
        } else {
          ball.rel = prevRel; ball.relW = -ball.relW * (.3 + Math.random() * .25); ball.vr += Math.random() * 40; ball.hop = Math.max(ball.hop, .45);
        }
        if (++ticks <= 2) stop = Math.max(stop, .04);
        shake = Math.max(shake, 1.5);
        fx('tick', Math.min(1.4, .4 + Math.abs(ball.relW) * .15));
      }
      const f = (1.8 + .45 * Math.abs(ball.relW)) * h;
      ball.relW = Math.abs(ball.relW) <= f ? 0 : ball.relW - Math.sign(ball.relW) * f;
      ball.vr -= 360 * h; ball.r += ball.vr * h;
      if (ball.r < R_P0 + BALL) { ball.r = R_P0 + BALL; ball.vr = Math.abs(ball.vr) * .35; if (ball.vr < 8) ball.vr = 0; }
      if (ball.r > R_NUM0 - BALL) { ball.r = R_NUM0 - BALL; ball.vr = -Math.abs(ball.vr) * .4; }
      ball.a = rot + ball.rel;
      if (Math.abs(ball.relW) < .08 && ball.vr === 0 && ball.r <= R_P0 + BALL + .5) settle();
    } else {
      ball.a = rot + ball.rel;
    }
  }

  function settle() {
    ball.st = 'rest'; ball.relW = 0; dRel = ball.rel;
    const k = Math.floor(mod(ball.rel, TAU) / ps());
    ball.rel = Math.floor(ball.rel / ps()) * ps() + ps() * .5 + (Math.random() - .5) * ps() * .2;
    if (!live) return;
    live = false;
    const gi = pockets[k];
    winGroup = gi; resT = 0; stop = Math.max(stop, .15);
    hooks.onResult && hooks.onResult(gi);
  }

  function step(simDt, realDt) {
    if (realDt === undefined) realDt = simDt;
    simDt = Math.max(0, +simDt || 0); realDt = Math.max(0, +realDt || 0);
    if (launchIn > 0 && (launchIn -= realDt) <= 0) { launchIn = 0; launch(); }
    acc += Math.min(simDt, .05);
    while (acc >= H * .999) { acc -= H; phys(); }
    direct(realDt);
    const lvl = ball.st === 'track' ? Math.abs(ball.w) / 13 : ball.st === 'fall' ? .5 : ball.st === 'pocket' ? Math.min(.5, Math.abs(ball.relW) / 12) : 0;
    hooks.roll && hooks.roll(lvl);
    draw();
  }

  // the result still on stage: the hold on the pocket, the slow-motion wish, the lights coming back up
  const staging = () => resT >= 0 && (resT < .4 || stop > 0 || slowS > 0 || drama > 0);
  // the rest of the spin at once: the same fixed steps run to the result, unstaged and without per-step sound
  function skip() {
    if (!live && !(launchIn > 0) && !staging()) return false;
    quiet = true;
    try {
      if (launchIn > 0) { for (let n = Math.round(launchIn / H); n > 0; n--) phys(); launchIn = 0; launch(); }
      for (let n = 120 / H; live && n > 0; n--) phys();
      if (live) { if (ball.st !== 'pocket') ball.rel = ball.a - rot; ball.r = R_P0 + BALL; ball.vr = 0; settle(); }
    } finally { quiet = false; }
    cam.x = cam.y = S / 2; cam.z = 1; drama = slowS = stop = shake = ball.hop = 0; trail.length = 0; flash.fill(0);
    if (winGroup >= 0) { resT = .4; winK = 1; }
    dRel = ball.rel; dirty = true;
    hooks.roll && hooks.roll(0);
    draw(true);
    return true;
  }

  // ---- staging: camera, drama and the slow-motion wish, all on real time ----
  const zAt = r => r >= R_TRACK ? Z_TRK : r >= R_APR ? Z_APR + (r - R_APR) / (R_TRACK - R_APR) * (Z_TRK - Z_APR)
    : r >= R_ROT + 1 ? Z_GAP + (r - R_ROT - 1) / (R_APR - R_ROT - 1) * (Z_APR - Z_GAP)
    : r >= R_NUM0 ? Z_NUM : r >= R_NUM0 - BALL ? Z_POC + (r - R_NUM0 + BALL) / BALL * (Z_NUM - Z_POC) : Z_POC;
  const proj = (r, a, z) => [cx + r * Math.cos(a), cy + r * Math.sin(a) * T - z * E];
  function ballView() {
    const a = ball.st === 'track' || ball.st === 'fall' ? ball.a : ball.st === 'pocket' ? rot + ball.rel : rot + dRel;
    const zs = zAt(ball.r), zc = zs + BALL + ball.hop * 7, p = proj(ball.r, a, zc);
    const w = ball.st === 'pocket' ? rotW + ball.relW : ball.st === 'rest' ? rotW : ball.w;
    return { x: p[0], y: p[1], a, zs, zc, w };
  }
  function direct(dt) {
    if (ball.st !== lastSt) { lastSt = ball.st; stT = 0; } else stT += dt;
    if (resT >= 0) resT += dt;
    const b = ballView(), sg = Math.sign(b.w) || 1, lx = -Math.sin(b.a) * sg, ly = Math.cos(b.a) * T * sg;
    let tz = 1, tx = S / 2, ty = S / 2, k = 3, dr = 0, slow = 0;
    if (ball.st === 'track') {
      const p = ease(clamp(stT / 2.6, 0, 1));
      tz = 1 + .12 * p; tx += (b.x - tx) * .16 * p; ty += (b.y - ty) * .16 * p; k = 1.2; dr = .2 + .3 * p;
    } else if (ball.st === 'fall') {
      tz = 2; tx = b.x + lx * 20; ty = b.y + ly * 20; k = 11; dr = .8; slow = .35;
    } else if (ball.st === 'pocket') {
      tz = 2.2; tx = b.x + lx * 10; ty = b.y + ly * 10; k = 9; dr = 1; slow = .55;
      const s = Math.sign(ball.relW), frac = mod(ball.rel + s * BALL / ball.r, ps()), gap = s > 0 ? ps() - frac : frac;
      if (Math.abs(ball.relW) < 1.5 && Math.abs(ball.relW) > .06 && gap < .15 * ps() && hang < .35) { hang += dt; slow = .8; }
    } else if (resT >= 0 && resT < .4) { tz = 2.2; tx = b.x; ty = b.y; k = 9; dr = 1; }
    else if (resT >= 0) k = 5;
    if (reduced) { tz = 1; tx = S / 2; ty = S / 2; slow = 0; }
    const f = 1 - Math.exp(-dt * k);
    cam.z += (tz - cam.z) * f; cam.x += (tx - cam.x) * f; cam.y += (ty - cam.y) * f;
    drama += (dr - drama) * (1 - Math.exp(-dt * (dr > drama ? 4 : 2.2)));
    slowS += (slow - slowS) * (1 - Math.exp(-dt * 10));
    if (Math.abs(slowS) < 1e-4) slowS = 0;
    if (drama < 1e-3 && dr === 0) drama = 0;
    stop = Math.max(0, stop - dt);
    shake = reduced ? 0 : Math.max(0, shake - dt * 9);
    for (let i = 0; i < DIAMONDS; i++) flash[i] = Math.max(0, flash[i] - dt);
    winK += ((winGroup >= 0 ? 1 : 0) - winK) * (1 - Math.exp(-dt * 7));
    if (ball.st === 'rest') { dRel += wrapPi(ball.rel - dRel) * (1 - Math.exp(-dt * 14)); if (Math.abs(wrapPi(ball.rel - dRel)) < 1e-4) dRel = ball.rel; }
    if (ball.st === 'track' && Math.abs(ball.w) > 6 && dt > 0) { trail.push([b.x, b.y]); if (trail.length > 7) trail.shift(); } else if (trail.length) trail.shift();
  }

  // ---- drag the rotor ----
  function local(e) {
    const r = canvas.getBoundingClientRect(), v = view();
    const sx = (e.clientX - r.left) * S / r.width, sy = (e.clientY - r.top) * S / r.height;
    const x = v.X + (sx - S / 2) / v.z, y = v.Y + (sy - S / 2) / v.z;
    return { x: x - cx, y: (y - cy + Z_NUM * E) / T };
  }
  canvas.addEventListener('pointerdown', e => {
    if (locked || live || launchIn || groups.length < 2) return;
    const p = local(e);
    if (Math.hypot(p.x, p.y) > R_OUT + 4) return;
    e.preventDefault(); hooks.unlock && hooks.unlock();
    dragging = true; rotW = 0; canvas.setPointerCapture(e.pointerId); canvas.classList.add('grabbing');
    lastA = Math.atan2(p.y, p.x); samples = [{ t: performance.now(), a: rot }];
  });
  canvas.addEventListener('pointermove', e => {
    if (!dragging) return;
    const p = local(e), a = Math.atan2(p.y, p.x);
    rot += wrapPi(a - lastA); lastA = a; dirty = true;
    const t = performance.now(); samples.push({ t, a: rot });
    while (samples.length > 2 && t - samples[0].t > 120) samples.shift();
  });
  const release = () => {
    if (!dragging) return;
    dragging = false; canvas.classList.remove('grabbing');
    const t = performance.now(), s0 = samples[0], dtt = (t - s0.t) / 1000;
    const w = dtt > .015 ? (rot - s0.a) / dtt : 0;
    rotW = Math.max(-9, Math.min(9, w));
    if (Math.abs(w) >= 1.5) launchIn = .25;
    else hooks.onWeak && hooks.onWeak();
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);

  // ---- light: one lamp, upper-left-front of the screen; converted into the tilted table frame ----
  const Ls = (() => {
    const l = ART.LIGHT, v = Array.isArray(l) ? l : l ? [l.x, l.y, l.z] : [-.35, -.8, .5], n = Math.hypot(v[0], v[1], v[2]);
    return n > 0 ? v.map(c => c / n) : [-.346, -.791, .494];
  })();
  const nrm = v => { const n = Math.hypot(v[0], v[1], v[2]); return v.map(c => c / n); };
  const Lw = [Ls[0], Ls[1] * T + Ls[2] * E, -Ls[1] * E + Ls[2] * T];          // light in table space (x right, y toward you, z up)
  const Hw = nrm([Lw[0], Lw[1] + E, Lw[2] + T]);                               // half vector toward the eye
  const Hs = nrm([Ls[0], Ls[1], Ls[2] + 1]);                                   // same, for round things drawn on screen
  const SHX = -Lw[0] / Lw[2], SHY = -Lw[1] / Lw[2];                            // shadow run on the table per unit of height
  const AZ = Math.atan2(Lw[1], Lw[0]), AH = Math.atan2(Hw[1], Hw[0]), AZS = Math.atan2(Ls[1], Ls[0]);
  const LAMP = [1, .914, .769], ROOM = [.52, .56, .66];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  function shade(alb, n, m) {          // m = [ambient, diffuse, broad spec, its power, tight spec, its power]
    const d = Math.max(0, dot(n, Lw)), h = Math.max(0, dot(n, Hw)), s = m[2] * Math.pow(h, m[3]) + m[4] * Math.pow(h, m[5]);
    return [0, 1, 2].map(i => Math.min(255, alb[i] * (m[0] * ROOM[i] + m[1] * d * LAMP[i]) + 255 * s * LAMP[i]));
  }
  const slopeN = (a, s) => { const k = 1 / Math.hypot(1, s); return [-s * Math.cos(a) * k, -s * Math.sin(a) * k, k]; };
  const wallN = (a, o) => [o * Math.cos(a), o * Math.sin(a), 0];
  const rgba = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
  const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  const hex = s => /^#[0-9a-f]{6}$/i.test(s) ? [1, 3, 5].map(i => parseInt(s.slice(i, i + 2), 16)) : [128, 128, 128];
  const lobe = (a, c, p) => Math.pow(Math.max(0, Math.cos(a - c)), p);
  const bow = a => lobe(a, AH, 14) + lobe(a, AH + Math.PI, 14);   // spun metal: the lamp smears into a radial bow tie

  const WALNUT = [92, 56, 33], MAHOG = [92, 48, 28], CONEW = [98, 50, 30], TIN = [188, 192, 196], CHROME = [176, 181, 187], IVORY = [236, 227, 203], INK = [31, 29, 32];
  const M_WOOD = [.36, .82, .06, 4, .2, 60], M_GLOSS = [.38, .8, .08, 6, .7, 120], M_LAC = [.36, .78, .03, 4, .5, 160], M_TIN = [.4, .66, .3, 8, .45, 60];
  const M_PRINT = [.38, .7, .04, 4, .1, 90], M_CHROME = [.42, .72, .5, 10, 1.1, 90];
  const G = {};                        // gradients; lighting is fixed to the room, so they are made once

  function conic(fn, n = 72) {
    if (!g.createConicGradient) {
      const gr = g.createLinearGradient(-160 * Math.cos(AZ), -160 * Math.sin(AZ), 160 * Math.cos(AZ), 160 * Math.sin(AZ));
      [[0, AZ + Math.PI], [.5, AZ + Math.PI / 2], [1, AZ]].forEach(([t, a]) => { const c = fn(a); gr.addColorStop(t, rgba(c, c[3] ?? 1)); });
      return gr;
    }
    const gr = g.createConicGradient(0, 0, 0);
    for (let i = 0; i <= n; i++) { const c = fn(i / n * TAU); gr.addColorStop(i / n, rgba(c, c[3] ?? 1)); }
    return gr;
  }
  // deterministic texture data: wood grain on the rim, lathe marks on the spun tin
  const rnd = (s => () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; })(930);
  const GRAIN = [], LATHE = [], CG = Math.cos(.38), SG = Math.sin(.38);
  for (let i = 0; i < 66; i++) {
    const v = -180 + i * 5.5 + rnd() * 3.5, p1 = rnd() * TAU, p2 = rnd() * TAU, amp = 1.5 + rnd() * 3.5, pts = [];
    for (let u = -184; u <= 184; u += 8) { const y = v + amp * Math.sin(u * .017 + p1) + 1.1 * Math.sin(u * .058 + p2); pts.push([u * CG - y * SG, u * SG + y * CG]); }
    GRAIN.push({ pts, w: .3 + rnd() * 1.3, a: .1 + rnd() * .22, lt: rnd() < .16 });
  }
  for (let r = R_KNOB - 1; r < R_APR; r += .7 + rnd() * .5) LATHE.push({ r, w: .3 + rnd() * .35, c: rnd() < .5 ? `rgba(255,255,255,${.04 + rnd() * .07})` : `rgba(20,24,28,${.04 + rnd() * .06})` });

  // ---- drawing helpers ----
  const dy = (z, z0) => (z0 - z) * E / T;                       // circle centre shift for height z, drawn in plane(z0)
  function plane(z) { g.translate(cx, cy - z * E); g.scale(1, T); }
  function band(r1, z1, r0, z0, zr) { g.beginPath(); g.arc(0, dy(z1, zr), r1, 0, TAU); g.arc(0, dy(z0, zr), r0, TAU, 0, true); }
  function sector(r0, r1, a0, a1, oy = 0) { g.beginPath(); g.arc(0, oy, r1, a0, a1); g.arc(0, oy, r0, a1, a0, true); g.closePath(); }
  function lipShade(r, oy, hgt, a) {  // soft shadow a raised edge throws inward, away from the lamp
    g.fillStyle = `rgba(12,8,6,${a})`;
    for (const k of [1, .66, .33]) { g.beginPath(); g.rect(-200, -200, 400, 400); g.arc(SHX * hgt * k, oy + SHY * hgt * k, r, 0, TAU); g.fill('evenodd'); }
  }
  function lathe(r0, r1, zf, zr) {
    for (const L of LATHE) if (L.r > r0 && L.r < r1) { g.strokeStyle = L.c; g.lineWidth = L.w; g.beginPath(); g.arc(0, dy(zf(L.r), zr), L.r, 0, TAU); g.stroke(); }
  }
  function cylGrad(x0, x1, alb, m, spec) {  // an upright turned part, lit the way the cans are lit
    const gr = g.createLinearGradient(x0, 0, x1, 0), us = clamp(Ls[0] * .55, -.8, .8);
    for (let i = 0; i <= 12; i++) {
      const u = -1 + i / 6, q = Math.sqrt(Math.max(0, 1 - u * u)), d = Math.max(0, u * Ls[0] + q * Ls[2]);
      const c = alb.map((v, j) => Math.min(255, v * (m[0] * ROOM[j] + m[1] * d * LAMP[j]) * (.35 + .65 * q)));
      gr.addColorStop(i / 12, rgba(c));
    }
    if (spec) { const t = (us + 1) / 2; gr.addColorStop(clamp(t - .05, 0, 1), rgba(mix(alb, [255, 255, 255], .5))); gr.addColorStop(t, `rgba(255,250,238,${spec})`); gr.addColorStop(clamp(t + .04, 0, 1), rgba(mix(alb, [40, 44, 48], .2))); }
    return gr;
  }
  function sphere(x, y, r, under) {   // polished steel: sky in the middle, a dark horizon, the table below, one lamp
    g.save(); g.beginPath(); g.arc(x, y, r, 0, TAU); g.clip();
    const v = g.createLinearGradient(x, y - r, x, y + r);
    v.addColorStop(0, rgba(mix(under, [0, 0, 0], .55))); v.addColorStop(.08, '#8e8b86'); v.addColorStop(.2, '#e4e6e7');
    v.addColorStop(.5, '#b8bdc2'); v.addColorStop(.66, '#7b8187'); v.addColorStop(.7, '#24201d');
    v.addColorStop(.79, rgba(mix(under, [24, 18, 14], .35))); v.addColorStop(1, rgba(mix(under, [0, 0, 0], .72)));
    g.fillStyle = v; g.fillRect(x - r, y - r, 2 * r, 2 * r);
    const hx = x + Hs[0] * r * .9, hy = y + Hs[1] * r * .9;
    const q = g.createRadialGradient(hx, hy, 0, x, y, r);
    q.addColorStop(0, 'rgba(255,246,228,.3)'); q.addColorStop(.55, 'rgba(0,0,0,0)'); q.addColorStop(1, 'rgba(0,0,0,.55)');
    g.fillStyle = q; g.fillRect(x - r, y - r, 2 * r, 2 * r);
    const s = g.createRadialGradient(hx, hy, 0, hx, hy, r * .36);
    s.addColorStop(0, 'rgba(255,253,246,1)'); s.addColorStop(.28, 'rgba(255,247,228,.85)'); s.addColorStop(1, 'rgba(255,240,210,0)');
    g.fillStyle = s; g.fillRect(x - r, y - r, 2 * r, 2 * r);
    g.restore();
    g.beginPath(); g.arc(x, y, r - .38, AZS - .95, AZS + .95); g.strokeStyle = 'rgba(255,244,222,.38)'; g.lineWidth = .75; g.stroke();
  }

  // ---- the wheel, back to front ----
  function table() {
    g.save(); plane(0);
    const ox = SHX * 9, oy = SHY * 9;
    if (!G.tab) {
      const r = g.createRadialGradient(ox, oy, 150, ox, oy, 182);
      r.addColorStop(0, 'rgba(8,6,4,.62)'); r.addColorStop(.32, 'rgba(8,6,4,.42)'); r.addColorStop(.55, 'rgba(8,6,4,.15)'); r.addColorStop(1, 'rgba(8,6,4,0)');
      G.tab = r;
    }
    g.fillStyle = G.tab; g.beginPath(); g.arc(ox, oy, 182, 0, TAU); g.fill();
    g.restore();
  }
  function side() {
    g.save(); plane(0);
    g.beginPath(); g.arc(0, dy(Z_RIM, 0), R_OUT, 0, Math.PI); g.arc(0, 0, R_OUT, Math.PI, 0, true); g.closePath();
    g.fillStyle = G.side ||= cylGrad(-R_OUT, R_OUT, WALNUT, [.5, .9], 0); g.fill();
    g.clip();
    for (let i = 0; i < 26; i++) { const x = -R_OUT + i * 12.4 + Math.sin(i * 2.3) * 4; g.fillStyle = i % 3 ? 'rgba(20,10,4,.13)' : 'rgba(255,214,170,.05)'; g.fillRect(x, -40, .6 + (i % 4) * .4, 240); }
    g.lineWidth = 3; g.strokeStyle = 'rgba(6,4,2,.45)'; g.beginPath(); g.arc(0, 0, R_OUT, .02, Math.PI - .02); g.stroke();
    g.restore();
  }
  function lip() {
    g.save(); plane(Z_TRK);
    band(R_TRACK, Z_RIM, R_TRACK, Z_TRK, Z_TRK);
    g.fillStyle = G.lip ||= conic(a => shade(WALNUT, wallN(a, -1), M_WOOD).map(v => v * .75)); g.fill();
    g.restore();
  }
  function track() {
    const zr = (Z_TRK + Z_APR) / 2;
    g.save(); plane(zr);
    band(R_TRACK, Z_TRK, R_APR, Z_APR, zr);
    g.fillStyle = G.trk ||= conic(a => shade(MAHOG, slopeN(a, (Z_TRK - Z_APR) / (R_TRACK - R_APR)), M_GLOSS)); g.fill();
    g.clip();
    g.lineWidth = 7; g.strokeStyle = 'rgba(255,224,186,.035)'; g.beginPath(); g.arc(0, dy(zAt(R_TRACK - BALL), zr), R_TRACK - BALL, 0, TAU); g.stroke();
    if (!G.trkAO) { const o = dy(Z_TRK, zr), r = g.createRadialGradient(0, o, 0, 0, o, R_TRACK); r.addColorStop(.9, 'rgba(10,5,2,0)'); r.addColorStop(1, 'rgba(10,5,2,.4)'); G.trkAO = r; }
    g.fillStyle = G.trkAO; g.fillRect(-170, -190, 340, 380);
    lipShade(R_TRACK, dy(Z_RIM, zr), Z_RIM - Z_TRK, .15);
    g.restore();
  }
  function apron() {
    const za = (Z_APR + Z_GAP) / 2, s = (Z_APR - Z_GAP) / (R_APR - R_ROT - 1);
    g.save(); plane(za);
    band(R_APR, Z_APR, R_ROT + 1, Z_GAP, za);
    g.fillStyle = G.apr ||= conic(a => shade(TIN, slopeN(a, s), M_TIN)); g.fill();
    g.clip();
    lathe(R_ROT + 1, R_APR, r => Z_GAP + (r - R_ROT - 1) * s, za);
    g.fillStyle = G.aprB ||= conic(a => [255, 250, 240, bow(a) * .32]); g.fillRect(-170, -190, 340, 380);
    lipShade(R_APR, dy(Z_APR, za), 1.2, .12);
    g.restore();
  }
  function diamonds(sel) {
    for (let k = 0; k < DIAMONDS; k++) {
      if (sel && !sel(k)) continue;
      const a = k * TAU / DIAMONDS + TAU / 16, r = 123.2, z0 = zAt(r) + .2, ca = Math.cos(a), sa = Math.sin(a);
      const long = k % 2 ? [ca, sa] : [-sa, ca], short = k % 2 ? [-sa, ca] : [ca, sa], l1 = k % 2 ? 6.6 : 9.4, l2 = k % 2 ? 3.4 : 3.6;
      const c = [r * ca, r * sa, z0], ap = [c[0], c[1], z0 + 3.2];
      const v = [[c[0] + long[0] * l1, c[1] + long[1] * l1, z0], [c[0] + short[0] * l2, c[1] + short[1] * l2, z0],
        [c[0] - long[0] * l1, c[1] - long[1] * l1, z0], [c[0] - short[0] * l2, c[1] - short[1] * l2, z0]];
      const P = p => [cx + p[0], cy + p[1] * T - p[2] * E];
      const sp = P([c[0] + SHX * 1.6, c[1] + SHY * 1.6, z0]);
      if (!sel) {
      g.save(); g.translate(sp[0], sp[1]); g.scale(1, T);
      const sh = g.createRadialGradient(0, 0, 0, 0, 0, l1 + 1.5); sh.addColorStop(0, 'rgba(0,0,0,.4)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = sh; g.beginPath(); g.arc(0, 0, l1 + 1.5, 0, TAU); g.fill(); g.restore();
      }
      const fl = flash[k] > 0 ? flash[k] / .09 : 0;
      for (let i = 0; i < 4; i++) {
        const p0 = v[i], p1 = v[(i + 1) % 4], e1 = [p0[0] - ap[0], p0[1] - ap[1], p0[2] - ap[2]], e2 = [p1[0] - ap[0], p1[1] - ap[1], p1[2] - ap[2]];
        let n = nrm([e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]]);
        if (n[2] < 0) n = n.map(q => -q);
        const col = mix(shade(CHROME, n, M_CHROME), [255, 255, 250], fl);
        const A = P(ap), B = P(p0), C2 = P(p1);
        g.beginPath(); g.moveTo(A[0], A[1]); g.lineTo(B[0], B[1]); g.lineTo(C2[0], C2[1]); g.closePath(); g.fillStyle = rgba(col); g.fill();
      }
    }
  }
  function tones(k) {                 // printed field, pocket floor and numeral inks for pocket k (after the win lights up)
    if (!pockets.length) return null;
    const gi = pockets[k], dark = k % 2 === 1;
    let f = dark ? INK : IVORY, nm = dark ? IVORY : INK;
    if (winGroup >= 0 && winK > .002) {
      if (gi === winGroup) { const sty = GROUP[groups[gi].sty % GROUP.length]; f = mix(f, hex(sty.bg), winK); nm = mix(nm, hex(sty.fg), winK); }
      else { f = mix(f, f.map(v => v * .32), winK); nm = mix(nm, nm.map(v => v * .4), winK); }
    }
    return { f: shade(f, [0, 0, 1], M_PRINT), p: shade(f.map(v => v * .9), [0, 0, 1], M_PRINT), n: shade(nm, [0, 0, 1], M_PRINT) };
  }
  function rotor() {
    const P = pockets.length, n = P || 16, a = TAU / n, bare = !P, tn = [];
    for (let k = 0; k < n; k++) tn.push(tones(k));
    g.save(); plane(Z_GAP); g.fillStyle = '#0b0908'; g.beginPath(); g.arc(0, 0, R_ROT + 1, 0, TAU); g.fill(); g.restore();
    // pocket floors, sunk below the printed ring
    g.save(); plane(Z_POC);
    const tinF = rgba(shade(TIN.map(v => v * .72), [0, 0, 1], M_TIN));
    for (let k = 0; k < n; k++) { sector(R_P0 - 1, R_NUM0, rot + k * a, rot + (k + 1) * a + .002); g.fillStyle = bare ? tinF : rgba(tn[k].p); g.fill(); }
    band(R_NUM0, Z_POC, R_P0 - 1, Z_POC, Z_POC); g.clip();
    if (!G.pAO) { const r = g.createRadialGradient(0, 0, R_P0, 0, 0, R_NUM0); r.addColorStop(0, 'rgba(0,0,0,.16)'); r.addColorStop(.3, 'rgba(0,0,0,0)'); r.addColorStop(.75, 'rgba(0,0,0,.04)'); r.addColorStop(1, 'rgba(0,0,0,.34)'); G.pAO = r; }
    g.fillStyle = G.pAO; g.fillRect(-110, -110, 220, 220);
    g.fillStyle = G.rotF ||= conic(q => [20, 12, 8, .16 * lobe(q, AZ + Math.PI, 1.5)]); g.fillRect(-110, -110, 220, 220);
    lipShade(R_NUM0, dy(Z_NUM, Z_POC), Z_NUM - Z_POC, .13);
    g.fillStyle = 'rgba(12,8,6,.12)';
    for (const k of [1, .66, .33]) { g.beginPath(); g.arc(SHX * 7 * k, SHY * 7 * k + dy(Z_CN0, Z_POC), R_P0, 0, TAU); g.fill(); }
    g.restore();
    // the ring's inner wall, seen on the far side
    g.save(); plane(Z_POC);
    for (let k = 0; k < n; k++) {
      const a0 = rot + k * a, a1 = a0 + a + .002, col = bare ? TIN.map(v => v * .6) : tn[k].p;
      g.beginPath(); g.arc(0, dy(Z_NUM, Z_POC), R_NUM0, a0, a1); g.arc(0, 0, R_NUM0, a1, a0, true); g.closePath();
      g.fillStyle = rgba(shade(col.map(v => v * 1.1), wallN(a0 + a / 2, -1), [.55, .5, 0, 1, 0, 1]).map(v => Math.min(255, v))); g.fill();
    }
    g.restore();
    // chrome frets: a lit face, a rounded crown that catches the lamp as it turns, a soft shadow on the floor
    const zt = Z_NUM + .6, sx = SHX * 2.6, sy = SHY * 2.6 * T;
    g.save(); g.lineCap = 'round';
    for (let k = 0; k < n; k++) {
      const an = rot + k * a, c = Math.cos(an), fn = c >= 0 ? [-Math.sin(an), c, 0] : [Math.sin(an), -c, 0];
      const b0 = proj(R_P0 + 1, an, Z_POC), b1 = proj(R_NUM0, an, Z_POC), t0 = proj(R_P0 + 1, an, zt), t1 = proj(R_NUM0, an, zt);
      g.strokeStyle = 'rgba(8,6,4,.28)'; g.lineWidth = 1.8; g.beginPath(); g.moveTo(b0[0] + sx, b0[1] + sy); g.lineTo(b1[0] + sx, b1[1] + sy); g.stroke();
      g.fillStyle = rgba(shade(CHROME, fn, M_CHROME)); g.beginPath(); g.moveTo(b0[0], b0[1]); g.lineTo(b1[0], b1[1]); g.lineTo(t1[0], t1[1]); g.lineTo(t0[0], t0[1]); g.closePath(); g.fill();
      const lit = Math.pow(Math.abs(Math.sin(an - AH)), 3);
      g.strokeStyle = rgba(mix([112, 118, 124], [252, 250, 244], .15 + .85 * lit)); g.lineWidth = .85;
      g.beginPath(); g.moveTo(t0[0], t0[1]); g.lineTo(t1[0], t1[1]); g.stroke();
    }
    g.restore();
    // the printed number ring
    g.save(); plane(Z_NUM);
    const tinR = G.bare ||= conic(q => shade(TIN, [0, 0, 1], M_TIN).map(v => v * (.92 + .1 * bow(q))));
    for (let k = 0; k < n; k++) { sector(R_NUM0, R_ROT, rot + k * a, rot + (k + 1) * a + .002); g.fillStyle = bare ? tinR : rgba(tn[k].f); g.fill(); }
    if (!bare) {
      const fs = groups.length > 9 ? 11 : 13;
      g.font = `${fs}px "Alfa Slab One", Rockwell, serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      for (let k = 0; k < n; k++) {
        g.save(); g.rotate(rot + (k + .5) * a); g.translate((R_NUM0 + R_ROT) / 2 + .6, 0); g.rotate(Math.PI / 2);
        g.fillStyle = rgba(tn[k].n); g.fillText(String(groups[pockets[k]].no), .35, .75); g.restore();
      }
      g.lineWidth = .6; g.strokeStyle = 'rgba(31,29,32,.85)'; g.beginPath(); g.arc(0, 0, R_ROT - 1.3, 0, TAU); g.stroke();
      g.beginPath(); g.arc(0, 0, R_NUM0 + 1.1, 0, TAU); g.stroke();
    }
    sector(R_NUM0, R_ROT, 0, TAU);
    g.fillStyle = G.numS ||= conic(q => [255, 247, 230, .16 * lobe(q, AZ, 3) + .1 * lobe(q, AH + Math.PI, 18)]); g.fill();
    g.fillStyle = G.rotF; g.fill();
    g.lineWidth = 1.3; g.strokeStyle = G.bead ||= conic(q => mix([74, 80, 86], [248, 248, 244], .25 + .75 * bow(q)).concat(1));
    g.beginPath(); g.arc(0, 0, R_ROT - .3, 0, TAU); g.stroke();
    g.lineWidth = .75; g.strokeStyle = G.numE ||= conic(q => [255, 246, 226, .5 * lobe(q, AZ + Math.PI, 2)]);
    g.beginPath(); g.arc(0, 0, R_NUM0 + .3, 0, TAU); g.stroke();
    g.restore();
  }
  const coneZ = r => Z_CN0 + (Z_CN1 - Z_CN0) * Math.sin(clamp((R_P0 - r) / (R_P0 - R_KNOB), 0, 1) * Math.PI / 2);
  function cone() {
    g.save(); plane(Z_POC);
    g.beginPath(); g.arc(0, dy(Z_CN0, Z_POC), R_P0, 0, Math.PI); g.arc(0, 0, R_P0, Math.PI, 0, true); g.closePath();
    g.fillStyle = G.skirt ||= conic(a => shade(CONEW, wallN(a, 1), M_LAC).map(v => v * .8)); g.fill();
    g.restore();
    const zc = 10;
    g.save(); plane(zc);
    g.beginPath(); g.arc(0, dy(Z_CN0, zc), R_P0, 0, TAU);
    g.fillStyle = G.cone ||= conic(a => shade(CONEW, slopeN(a, -.16), M_LAC)); g.fill();
    g.clip();
    for (const [r0, r1, s] of [[R_KNOB, 34, -.55], [34, 52, -.3]]) {   // the turned profile steepens toward the turret
      g.beginPath(); g.arc(0, dy(coneZ(r1 - 6), zc), r1, 0, TAU);
      g.fillStyle = G['cn' + r0] ||= conic(a => shade(CONEW, slopeN(a, s), M_LAC).concat(.6)); g.fill();
    }
    for (const L of LATHE) if (L.r > R_KNOB && L.r < R_P0 - 2) {
      g.strokeStyle = L.c.replace('255,255,255', '255,200,160'); g.lineWidth = L.w * .7;
      g.beginPath(); g.arc(0, dy(coneZ(L.r), zc), L.r, 0, TAU); g.stroke();
    }
    for (const r of [R_P0 - 5, 44, 29]) {      // three cut rings, each with its lit lip
      g.lineWidth = .9; g.strokeStyle = 'rgba(16,7,3,.55)'; g.beginPath(); g.arc(0, dy(coneZ(r), zc), r, 0, TAU); g.stroke();
      g.lineWidth = .6; g.strokeStyle = 'rgba(255,220,180,.2)'; g.beginPath(); g.arc(-SHX * .6, dy(coneZ(r), zc) - SHY * .6, r + .5, 0, TAU); g.stroke();
    }
    g.lineWidth = 2.2; g.strokeStyle = 'rgba(8,4,2,.35)'; g.beginPath(); g.arc(0, dy(Z_CN0, zc), R_P0 - .8, 0, TAU); g.stroke();
    g.restore();
  }
  function turret() {                 // its shadow on the cone, then a turned chrome knob on a flanged collar
    g.save(); plane(Z_CN1);
    for (let i = 0; i <= 6; i++) {
      const t = i / 6, h = t * 32, x = SHX * h, y = SHY * h, r = 6 + t * 4 + (i === 6 ? 5 : 0), q = g.createRadialGradient(x, y, 0, x, y, r);
      q.addColorStop(0, 'rgba(8,4,2,.16)'); q.addColorStop(1, 'rgba(8,6,4,0)'); g.fillStyle = q; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    }
    g.restore();
    const yb = cy - Z_CN1 * E, Y = h => yb - h * 1.3 * E;
    const PROF = [[0, 14.5], [1.8, 14.5], [1.8, 12], [3.2, 8.4], [4.4, 4.2], [14.5, 3.2], [14.5, 5.6], [16.4, 5.6], [16.4, 2.7], [18.5, 2.5]].map(([h, r]) => [h, r * 1.3]);
    for (let i = 0; i < PROF.length - 1; i++) {
      const [h0, r0] = PROF[i], [h1, r1] = PROF[i + 1];
      if (h0 === h1) {
        if (r0 > r1) {
          g.beginPath(); g.ellipse(cx, Y(h0), r0, r0 * T, 0, 0, TAU);
          const q = g.createLinearGradient(cx - r0, Y(h0) - r0 * T, cx + r0, Y(h0) + r0 * T);
          q.addColorStop(0, '#f6f5f0'); q.addColorStop(.45, '#b9bec3'); q.addColorStop(1, '#6a7076'); g.fillStyle = q; g.fill();
          g.beginPath(); g.ellipse(cx, Y(h0), r1 + .8, (r1 + .8) * T, 0, 0, TAU); g.fillStyle = 'rgba(20,22,26,.35)'; g.fill();
        }
        continue;
      }
      g.beginPath(); g.ellipse(cx, Y(h0), r0, r0 * T, 0, Math.PI, 0, true); g.lineTo(cx + r1, Y(h1)); g.ellipse(cx, Y(h1), r1, r1 * T, 0, 0, Math.PI, false); g.closePath();
      const rm = Math.max(r0, r1), up = (r0 - r1) / (h1 - h0) > .8;
      g.fillStyle = cylGrad(cx - rm, cx + rm, up ? [214, 218, 222] : CHROME, [.45, up ? 1.1 : .85], 1); g.fill();
    }
    sphere(cx, Y(23.5), 8.3, CONEW);
    sphere(cx, Y(31.2), 2.7, CONEW);
  }
  function rim() {
    g.save(); plane(Z_RIM);
    g.beginPath(); g.arc(0, 0, R_OUT, 0, TAU); g.arc(0, 0, R_TRACK, TAU, 0, true);
    g.fillStyle = G.rim ||= conic(a => shade(WALNUT, [0, 0, 1], M_WOOD).map(v => Math.min(255, v * (.9 + .22 * lobe(a, AZ, 2) + .12 * lobe(a, AH, 6))))); g.fill();
    g.clip();
    g.lineCap = 'round';
    for (const L of GRAIN) {
      g.strokeStyle = L.lt ? `rgba(255,212,160,${L.a * .35})` : `rgba(24,11,4,${L.a})`; g.lineWidth = L.w;
      g.beginPath(); L.pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.stroke();
    }
    for (const r of [145.6, 155.4]) {
      g.lineWidth = .8; g.strokeStyle = 'rgba(14,7,3,.5)'; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.stroke();
      g.lineWidth = .6; g.strokeStyle = 'rgba(255,220,176,.16)'; g.beginPath(); g.arc(-SHX * .7, -SHY * .7, r + .2, 0, TAU); g.stroke();
    }
    g.restore();
    g.save(); plane(Z_RIM);
    g.lineWidth = .75;
    g.strokeStyle = G.rimO ||= conic(a => [255, 238, 208, .6 * lobe(a, AZ, 2)]); g.beginPath(); g.arc(0, 0, R_OUT - .45, 0, TAU); g.stroke();
    g.strokeStyle = G.rimI ||= conic(a => [255, 232, 200, .45 * lobe(a, AZ + Math.PI, 2)]); g.beginPath(); g.arc(0, 0, R_TRACK + .45, 0, TAU); g.stroke();
    g.restore();
  }
  function falloff(path) {            // the lamp is a point: the far side of the wheel sits a little deeper in the dark (baked)
    g.save(); g.beginPath(); path(); g.clip();
    const lx = cx + Ls[0] * 150, ly = cy + Ls[1] * 110;
    const q = g.createRadialGradient(lx, ly, 30, lx, ly, 360);
    q.addColorStop(0, 'rgba(255,250,240,1)'); q.addColorStop(.45, 'rgba(236,228,216,1)'); q.addColorStop(1, 'rgba(120,112,104,1)');
    g.globalCompositeOperation = 'multiply'; g.fillStyle = q; g.fillRect(0, 0, S, S);
    g.restore();
  }
  function drawBall() {
    const b = ballView(), hop = ball.hop, rr = BALL * (1 + .12 * hop);
    for (let i = 1; i < trail.length; i++) {
      const t = i / trail.length; g.lineCap = 'round'; g.strokeStyle = `rgba(214,216,218,${.07 * t})`; g.lineWidth = BALL * 2 * (.35 + .55 * t);
      g.beginPath(); g.moveTo(trail[i - 1][0], trail[i - 1][1]); g.lineTo(trail[i][0], trail[i][1]); g.stroke();
    }
    const sp = proj(ball.r, b.a, b.zs), hgt = b.zc - b.zs, k = 1 / (1 + hop * 1.4);
    g.save(); g.translate(sp[0] + SHX * hgt * .8, sp[1] + SHY * hgt * .8 * T); g.scale(1, T * .92);
    const q = g.createRadialGradient(0, 0, 0, 0, 0, BALL * (1.25 + hop * .5));
    q.addColorStop(0, `rgba(6,4,2,${.62 * k})`); q.addColorStop(.55, `rgba(6,4,2,${.3 * k})`); q.addColorStop(1, 'rgba(6,4,2,0)');
    g.fillStyle = q; g.beginPath(); g.arc(0, 0, BALL * (1.25 + hop * .5), 0, TAU); g.fill(); g.restore();
    let under = MAHOG.map(v => v * 1.4);
    if (ball.st === 'pocket' || ball.st === 'rest') {
      const t = pockets.length ? tones(Math.floor(mod(ball.st === 'rest' ? dRel : ball.rel, TAU) / ps()) % pockets.length) : null;
      under = t ? t.p : TIN.map(v => v * .6);
    } else if (ball.r < R_APR) under = TIN.map(v => v * .8);
    sphere(b.x, b.y, rr, under);
  }

  function fit() {
    let w = 0; try { w = canvas.getBoundingClientRect().width; } catch (e) { w = 0; }
    if (shown !== w > 0) dirty = true;
    shown = w > 0;
    if (!shown) return;
    const want = Math.round(clamp(w * (window.devicePixelRatio || 1), S, 1600));
    if (canvas.width !== want || canvas.height !== want) { canvas.width = want; canvas.height = want; dirty = true; }
    scale = want / S;
  }
  // the bowl, rim, diamonds, cone and turret never move relative to the lamp: bake them once, sharp enough for the push-in
  let layA = null, layB = null, layQ = 0;
  const AO = -20, AW = S + 40, BX = cx - 80, BY = cy - 96, BW = 160;
  function bake() {
    const q = Math.min(scale * ZB * (reduced ? 1 : 2.2), 2048 / AW);
    if (layA && Math.abs(q - layQ) < .01) return;
    layQ = q; for (const k in G) delete G[k];
    const mk = (w, ox, oy, fn) => {
      const c = document.createElement('canvas'); c.width = c.height = Math.ceil(w * q);
      g = c.getContext('2d'); g.setTransform(q, 0, 0, q, -ox * q, -oy * q); fn(); g = g0; return c;
    };
    layA = mk(AW, AO, AO, () => {
      table(); side(); lip(); track(); apron(); diamonds(); rim();
      const el = (y, r, ccw) => { g.moveTo(cx + r, y); g.ellipse(cx, y, r, r * T, 0, ccw ? TAU : 0, ccw ? 0 : TAU, !!ccw); };
      falloff(() => { el(cy - Z_RIM * E, R_OUT); el(cy, R_OUT); el(cy - Z_GAP * E, R_ROT + 1, true); el(cy - Z_GAP * E, R_ROT + 1, true); });
    });
    layB = mk(BW, BX, BY, () => {
      cone();
      falloff(() => { g.ellipse(cx, cy - Z_CN0 * E, R_P0, R_P0 * T, 0, 0, TAU); });
      turret();
    });
  }
  function view() {                   // camera frame: zoom about (X, Y), never showing past the canvas once zoomed in
    const z = cam.z * ZB, lo = S / 2 / z, fx = v => lo < S - lo ? clamp(v, lo, S - lo) : S / 2;
    return { z, X: fx(cam.x), Y: fx(cam.y) };
  }
  function draw(force) {
    if (force || dirty || ++frameN % 30 === 0) fit();
    const still = !live && !dragging && !launchIn && rotW === 0 && Math.abs(cam.z - 1) < 1e-3 && Math.abs(cam.x - S / 2) + Math.abs(cam.y - S / 2) < .03
      && Math.abs((winGroup >= 0 ? 1 : 0) - winK) < 1e-3 && dRel === ball.rel && !shake && drama === 0 && !flash.some(f => f > 0);
    if (!shown || (still && !dirty && !force)) return;
    dirty = false;
    g.setTransform(scale, 0, 0, scale, 0, 0); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    g.clearRect(0, 0, S, S);
    const { z, X, Y } = view();
    let jx = 0, jy = 0;
    if (shake) { seed = (seed * 16807) % 2147483647; jx = ((seed / 2147483647) - .5) * shake; seed = (seed * 16807) % 2147483647; jy = ((seed / 2147483647) - .5) * shake; }
    g.save(); g.translate(S / 2 + jx, S / 2 + jy); g.scale(z, z); g.translate(-X, -Y);
    bake();
    g.drawImage(layA, AO, AO, AW, AW);
    if (flash.some(f => f > 0)) diamonds(k => flash[k] > 0);
    rotor();
    g.drawImage(layB, BX, BY, BW, BW);
    drawBall();
    g.restore();
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { dirty = true; draw(true); });
  if (window.addEventListener) window.addEventListener('resize', () => { dirty = true; });

  return {
    setGroups(list) { build(list); draw(true); },
    spin, step, skip,
    lock(v) { locked = !!v; },
    get busy() { return live || dragging || launchIn > 0; },
    // a spin under way, a flick about to throw the ball or a result still on stage: skip() ends it now
    get canSkip() { return live || launchIn > 0 || staging(); },
    // 0..1: how much the wheel wants the room dark and the eye on the ball (rises with the drop, peaks in the pocket)
    get drama() { return drama; },
    // 0..1: slow motion the wheel asks for, already eased; the director runs the wheel at timeScale = 1 - wantSlow
    get wantSlow() { return stop > 0 ? 1 : slowS; },
  };
};
