// Old tin roulette. The rotor turns one way, a steel ball is launched the other way around the track,
// loses speed, drops past the diamond deflectors and rattles between the pocket frets until it rests.
// Where it rests decides the next group. Plain polar-coordinate physics, sub-stepped.
window.Roulette = function (canvas, hooks) {
  const { C, GROUP, TAU, rivet, star } = ART;
  const S = 330, cx = 165, cy = 165;
  const R_RIM = 161, R_TRACK = 141, R_DEF = 125, R_NUM1 = 115, R_NUM0 = 99, R_P0 = 72, R_CONE = 72, BALL = 6.5;
  const W_FALL = 4.4, DIAMONDS = 8;
  const g = canvas.getContext('2d');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = S * dpr; canvas.height = S * dpr;
  const mod = (a, m) => ((a % m) + m) % m;
  const wrapPi = a => Math.atan2(Math.sin(a), Math.cos(a));

  let groups = [], pockets = [], rot = 0, rotW = .25;
  const ball = { st: 'rest', r: R_P0 + BALL, a: 0, w: 0, vr: 0, rel: .1, relW: 0 };
  let live = false, dragging = false, samples = [], lastA = 0, locked = false, winGroup = -1, winT = 0, launchAt = 0;

  const ps = () => TAU / Math.max(1, pockets.length);

  function build(list) {
    groups = list.slice();
    pockets = [];
    const n = groups.length;
    if (n) {
      const m = Math.ceil(32 / n);
      let prev = -1;
      for (let k = 0; k < m; k++) {
        const perm = [...Array(n).keys()].sort(() => Math.random() - .5);
        if (perm[0] === prev && n > 1) perm.push(perm.shift());
        pockets.push(...perm); prev = perm[perm.length - 1];
      }
    }
    winGroup = -1; winT = 0;
    if (ball.st === 'rest') ball.rel = (Math.floor(Math.random() * Math.max(1, pockets.length)) + .5) * ps();
  }

  function launch() {
    if (!groups.length) return;
    const dir = rotW >= 0 ? -1 : 1;
    ball.st = 'track'; ball.a = rot + ball.rel; ball.r = R_TRACK - BALL; ball.vr = 0; ball.hits = 0;
    ball.w = dir * (10.5 + Math.random() * 4);
    live = true; hooks.onLaunch && hooks.onLaunch();
    hooks.sfx && hooks.sfx('ballDrop');
  }
  function spin() {
    if (locked || live || dragging || groups.length < 2) return false;
    rotW = (2.2 + Math.random() * 1.4) * (Math.random() < .5 ? 1 : -1);
    launch(); return true;
  }

  function step(dt) {
    const sub = 10, h = dt / sub;
    for (let i = 0; i < sub; i++) {
      if (!dragging) { rot += rotW * h; rotW *= 1 - (live ? .05 : .35) * h; }
      if (launchAt && performance.now() >= launchAt) { launchAt = 0; launch(); }
      if (ball.st === 'track') {
        ball.a += ball.w * h;
        const f = (1.3 + .06 * Math.abs(ball.w)) * h;
        ball.w -= Math.sign(ball.w) * f;
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
          if (da < .16 && ball.hits < 3) {
            ball.hits++;
            ball.r = R_DEF + .5; ball.vr = Math.abs(ball.vr) * (.35 + Math.random() * .25);
            ball.w *= .5 + Math.random() * .6; if (Math.random() < .25) ball.w = -ball.w * .6;
            if (Math.abs(ball.w) < 1.2) ball.w = (Math.random() < .5 ? -1 : 1) * (1.2 + Math.random());
            hooks.sfx && hooks.sfx('clack');
          }
        }
        if (ball.r <= R_NUM0 - 2) {
          ball.st = 'pocket'; ball.rel = ball.a - rot; ball.relW = ball.w - rotW;
          hooks.sfx && hooks.sfx('tick', 1.2);
        }
      } else if (ball.st === 'pocket') {
        const prevRel = ball.rel, s = Math.sign(ball.relW), d = BALL / ball.r;
        const lead0 = Math.floor((ball.rel + s * d) / ps());
        ball.rel += ball.relW * h;
        const lead1 = Math.floor((ball.rel + s * d) / ps());
        if (lead1 !== lead0) {
          if (Math.abs(ball.relW) > 5 && Math.random() < .55) {
            ball.relW *= .55; ball.vr = 70 + Math.random() * 60;
          } else {
            ball.rel = prevRel; ball.relW = -ball.relW * (.3 + Math.random() * .25); ball.vr += Math.random() * 40;
          }
          hooks.sfx && hooks.sfx('tick', Math.min(1.4, .4 + Math.abs(ball.relW) * .15));
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
    if (winT > 0) winT -= dt;
    const lvl = ball.st === 'track' ? Math.abs(ball.w) / 13 : ball.st === 'fall' ? .5 : ball.st === 'pocket' ? Math.min(.5, Math.abs(ball.relW) / 12) : 0;
    hooks.roll && hooks.roll(lvl);
    draw();
  }

  function settle() {
    ball.st = 'rest'; ball.relW = 0;
    const k = Math.floor(mod(ball.rel, TAU) / ps());
    ball.rel = Math.floor(ball.rel / ps()) * ps() + ps() * .5 + (Math.random() - .5) * ps() * .2;
    if (!live) return;
    live = false;
    const gi = pockets[k];
    winGroup = gi; winT = 1.8;
    hooks.onResult && hooks.onResult(gi);
  }

  // ---- drag the rotor ----
  function local(e) {
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) * S / r.width, y: (e.clientY - r.top) * S / r.height };
  }
  canvas.addEventListener('pointerdown', e => {
    if (locked || live || groups.length < 2) return;
    const p = local(e);
    if (Math.hypot(p.x - cx, p.y - cy) > R_RIM) return;
    e.preventDefault(); hooks.unlock && hooks.unlock();
    dragging = true; rotW = 0; canvas.setPointerCapture(e.pointerId); canvas.classList.add('grabbing');
    lastA = Math.atan2(p.y - cy, p.x - cx); samples = [{ t: performance.now(), a: rot }];
  });
  canvas.addEventListener('pointermove', e => {
    if (!dragging) return;
    const p = local(e), a = Math.atan2(p.y - cy, p.x - cx);
    rot += wrapPi(a - lastA); lastA = a;
    const t = performance.now(); samples.push({ t, a: rot });
    while (samples.length > 2 && t - samples[0].t > 120) samples.shift();
  });
  const release = () => {
    if (!dragging) return;
    dragging = false; canvas.classList.remove('grabbing');
    const t = performance.now(), s0 = samples[0], dtt = (t - s0.t) / 1000;
    const w = dtt > .015 ? (rot - s0.a) / dtt : 0;
    rotW = Math.max(-9, Math.min(9, w));
    if (Math.abs(w) >= 1.5) { launchAt = performance.now() + 250; live = true; }
    else hooks.onWeak && hooks.onWeak();
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);

  // ---- drawing ----
  function sector(r0, r1, a0, a1) {
    g.beginPath(); g.arc(0, 0, r1, a0, a1); g.arc(0, 0, r0, a1, a0, true); g.closePath();
  }
  function draw() {
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, S, S);
    g.save(); g.translate(cx, cy);
    // printed outer tin rim
    g.fillStyle = 'rgba(28,27,31,.25)'; g.beginPath(); g.arc(3, 5, R_RIM, 0, TAU); g.fill();
    g.fillStyle = C.MUSTARD; g.beginPath(); g.arc(0, 0, R_RIM, 0, TAU); g.fill();
    g.lineWidth = 3; g.strokeStyle = C.INK; g.stroke();
    g.fillStyle = C.INK; g.font = '700 11px "Barlow Condensed", "Arial Narrow", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const ring = '★ LUCKY ORDER ★ 행운의 순서 ★ LUCKY ORDER ★ 행운의 순서 ';
    const chars = [...ring], step = TAU / chars.length;
    chars.forEach((ch, i) => {
      const a = -Math.PI / 2 + i * step;
      g.save(); g.rotate(a); g.translate(0, -(R_RIM - 10)); g.fillText(ch, 0, 0); g.restore();
    });
    // bowl
    const bowl = g.createRadialGradient(0, 0, R_NUM1, 0, 0, R_TRACK + 2);
    bowl.addColorStop(0, '#9aa1a8'); bowl.addColorStop(.55, '#e9ecee'); bowl.addColorStop(1, '#bfc4c9');
    g.fillStyle = bowl; g.beginPath(); g.arc(0, 0, R_TRACK + 1, 0, TAU); g.fill();
    g.lineWidth = 2.5; g.strokeStyle = C.INK; g.stroke();
    g.lineWidth = 1; g.strokeStyle = 'rgba(28,27,31,.4)'; g.beginPath(); g.arc(0, 0, R_TRACK - BALL * 2 - 2, 0, TAU); g.stroke();
    for (let k = 0; k < DIAMONDS; k++) {
      const a = k * TAU / DIAMONDS + TAU / 16;
      g.save(); g.rotate(a); g.translate(R_DEF, 0);
      g.beginPath(); g.moveTo(-6, 0); g.lineTo(0, -4); g.lineTo(6, 0); g.lineTo(0, 4); g.closePath();
      g.fillStyle = '#f7f8f9'; g.fill(); g.lineWidth = 1.5; g.strokeStyle = C.INK; g.stroke();
      g.restore();
    }
    // rotor
    g.save(); g.rotate(rot);
    const P = pockets.length, a = ps();
    if (!P) {
      g.fillStyle = C.TIN; g.beginPath(); g.arc(0, 0, R_NUM1, 0, TAU); g.fill();
    }
    for (let k = 0; k < P; k++) {
      const gi = pockets[k], grp = groups[gi], sty = GROUP[grp.sty % GROUP.length];
      const flash = gi === winGroup && winT > 0 && Math.floor(winT * 8) % 2 === 0;
      const a0 = k * a, a1 = a0 + a;
      sector(R_NUM0, R_NUM1, a0, a1); g.fillStyle = flash ? C.WHITE : sty.bg; g.fill();
      sector(R_P0, R_NUM0, a0, a1); g.fillStyle = flash ? C.WHITE : sty.bg; g.fill();
      g.fillStyle = 'rgba(28,27,31,.28)'; sector(R_P0, R_NUM0, a0, a1); g.fill();
      g.save(); g.rotate(a0 + a / 2); g.translate((R_NUM0 + R_NUM1) / 2, 0); g.rotate(Math.PI / 2);
      g.fillStyle = flash ? C.INK : sty.fg; g.font = '11px "Alfa Slab One", Rockwell, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(String(grp.no), 0, 1); g.restore();
    }
    g.lineWidth = 2; g.strokeStyle = C.INK;
    for (let k = 0; k < P; k++) {
      const an = k * a;
      g.beginPath(); g.moveTo(Math.cos(an) * R_P0, Math.sin(an) * R_P0); g.lineTo(Math.cos(an) * R_NUM1, Math.sin(an) * R_NUM1); g.stroke();
    }
    g.beginPath(); g.arc(0, 0, R_NUM1, 0, TAU); g.stroke();
    g.beginPath(); g.arc(0, 0, R_NUM0, 0, TAU); g.lineWidth = 1.5; g.stroke();
    // cone and turret
    const cone = g.createRadialGradient(-14, -14, 4, 0, 0, R_CONE);
    cone.addColorStop(0, '#ffffff'); cone.addColorStop(.6, '#c9ced3'); cone.addColorStop(1, '#8b9299');
    g.fillStyle = cone; g.beginPath(); g.arc(0, 0, R_CONE, 0, TAU); g.fill(); g.lineWidth = 2.5; g.strokeStyle = C.INK; g.stroke();
    for (let k = 0; k < 4; k++) {
      g.save(); g.rotate(k * TAU / 4);
      g.fillStyle = C.TOMATO; g.fillRect(8, -3.5, R_CONE * .62, 7); g.lineWidth = 1.8; g.strokeRect(8, -3.5, R_CONE * .62, 7);
      g.beginPath(); g.arc(8 + R_CONE * .62, 0, 6, 0, TAU); g.fillStyle = C.MUSTARD; g.fill(); g.stroke();
      g.restore();
    }
    g.beginPath(); g.arc(0, 0, 20, 0, TAU); g.fillStyle = C.TOMATO; g.fill(); g.lineWidth = 2.5; g.stroke();
    star(g, 0, 0, 11); g.fillStyle = C.MUSTARD; g.fill(); g.lineWidth = 1.5; g.stroke();
    g.restore();
    if (!P) {
      ART.rr(g, -52, R_CONE + 4, 104, 24, 6); g.fillStyle = C.WHITE; g.fill(); g.lineWidth = 2.5; g.strokeStyle = C.INK; g.stroke();
      g.fillStyle = C.INK; g.font = '14px "Alfa Slab One", Rockwell, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('ORDER SET', 0, R_CONE + 16.5);
    }
    // rivets on the rim
    for (let k = 0; k < 4; k++) { const an = Math.PI / 4 + k * Math.PI / 2; rivet(g, Math.cos(an) * (R_TRACK + 10), Math.sin(an) * (R_TRACK + 10), 3.2); }
    // ball
    const bx = Math.cos(ball.a) * ball.r, by = Math.sin(ball.a) * ball.r;
    g.fillStyle = 'rgba(28,27,31,.3)'; g.beginPath(); g.arc(bx + 2, by + 3, BALL, 0, TAU); g.fill();
    const bg = g.createRadialGradient(bx - 2.2, by - 2.4, .5, bx, by, BALL);
    bg.addColorStop(0, '#ffffff'); bg.addColorStop(.5, '#cfd4d8'); bg.addColorStop(1, '#5f666d');
    g.fillStyle = bg; g.beginPath(); g.arc(bx, by, BALL, 0, TAU); g.fill();
    g.lineWidth = 1.5; g.strokeStyle = C.INK; g.stroke();
    g.restore();
  }

  return {
    setGroups(list) { build(list); draw(); },
    spin, step,
    lock(v) { locked = v; },
    get busy() { return live || dragging || !!launchAt; },
  };
};
