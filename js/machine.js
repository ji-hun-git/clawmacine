// The claw machine. Cans are Matter.js rigid bodies (they stack, topple and clank).
// The claw hangs from its gantry on a cable and swings as a driven pendulum; its two prongs are
// kinematic bodies that shove cans aside. A grabbed can is held by a soft spring, so it sways.
window.Machine = function (canvas, hooks) {
  const { Engine, Bodies, Body, Composite, Query, Events, Constraint } = Matter;
  const { C, TAU, rr, rivet, tinGrad, drawCan, canStyle } = ART;
  const W = 460, H = 580, CARR_Y = 30, L_REST = 64, FLOOR_Y = 548;
  const CHUTE_W = 130, CHUTE_IN = CHUTE_W - 14, CHUTE_TOP = 330, HOME_X = CHUTE_IN / 2;
  const PIV = 15, PL = 56, VMAX = 200, ACC = 560, G = 1500, DAMP = 3.2, STEP = 1 / 120, TIME = 15;
  const L_MAX = FLOOR_Y - CARR_Y - 24;
  const CAT_WORLD = 1, CAT_CAN = 2, CAT_CLAW = 4, MASK_ALL = 7, MASK_NOCLAW = 3;
  const PILE_X0 = CHUTE_W + 4, PILE_X1 = W - 6;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rot = (x, y, a) => ({ x: x * Math.cos(a) - y * Math.sin(a), y: x * Math.sin(a) + y * Math.cos(a) });
  const wrapPi = a => Math.atan2(Math.sin(a), Math.cos(a));
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const ctx = canvas.getContext('2d');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = W * dpr; canvas.height = H * dpr;

  const engine = Engine.create({ positionIterations: 12, velocityIterations: 10 });
  engine.gravity.y = 1; engine.gravity.scale = .0015;
  const world = engine.world;
  const wall = (x, y, w, h, extra = {}) => Bodies.rectangle(x, y, w, h, {
    isStatic: true, friction: .8, label: 'wall', collisionFilter: { category: CAT_WORLD, mask: CAT_CAN }, ...extra });
  Composite.add(world, [
    wall(-30, 0, 60, 1800),
    wall(W + 30, 0, 60, 1800),
    wall((CHUTE_IN + W + 60) / 2, FLOOR_Y + 40, W + 60 - CHUTE_IN, 80, { label: 'floor', friction: 1 }),
    wall(CHUTE_W - 7, (CHUTE_TOP + FLOOR_Y) / 2 + 10, 14, FLOOR_Y - CHUTE_TOP + 20, { chamfer: { radius: [7, 7, 0, 0] } }),
  ]);

  const clawOpt = { isStatic: true, friction: .9, label: 'claw', collisionFilter: { category: CAT_CLAW, mask: CAT_CAN } };
  const hub = Bodies.rectangle(HOME_X, CARR_Y + L_REST, 42, 20, { ...clawOpt, chamfer: { radius: 6 } });
  const prongs = [-1, 1].map(s => ({ s, body: Bodies.rectangle(0, 0, 9, PL, { ...clawOpt, chamfer: { radius: 4 } }) }));
  const clawBodies = [hub, ...prongs.map(p => p.body)];
  Composite.add(world, clawBodies);

  const c = { x: HOME_X, vx: 0, input: 0, auto: null, L: L_REST, Lprev: L_REST, th: 0, w: 0, open: .2, mode: 'off', t: 0,
    timer: TIME, contact: 0, cand: null, held: null, con: null, grip: 0, holdAng: 0 };
  let cans = [], pick = null, bonus = false, live = false, hard = false, shake = 0, puffs = [], label = '', acc = 0, clock = 0;
  let bg = null;
  const trace = hooks.trace || (() => {});

  // ---------- cans ----------
  function sizeFor(n) {
    if (n <= 4) return [60, 80];
    if (n <= 6) return [54, 72];
    if (n <= 9) return [48, 64];
    if (n <= 12) return [42, 56];
    return [36, 48];
  }
  function makeCan(name, x, y, w, h, ang) {
    const body = Bodies.rectangle(x, y, w, h, {
      chamfer: { radius: 3 }, restitution: .08, friction: .75, frictionStatic: 1.1, frictionAir: .012,
      density: .0022, slop: .02, label: 'can', angle: ang,
      collisionFilter: { category: CAT_CAN, mask: MASK_ALL } });
    const can = { name, w, h, body, ghost: 0, gone: false, ring: 0, ...canStyle(name) };
    body.plugin.can = can;
    return can;
  }
  const setClawCollide = (can, on) => { can.body.collisionFilter.mask = on ? MASK_ALL : MASK_NOCLAW; };
  function clearCans() { for (const k of cans) if (!k.gone) Composite.remove(world, k.body); cans = []; }
  function fill(names, pour) {
    clearCans(); pick = null; bonus = false;
    const [w, h] = sizeFor(names.length);
    const list = names.slice().sort(() => Math.random() - .5);
    const span = PILE_X1 - PILE_X0;
    if (pour) {
      list.forEach((n, i) => {
        const x = PILE_X0 + w / 2 + 6 + Math.random() * (span - w - 12);
        cans.push(makeCan(n, x, -h - 30 - i * h * 1.25, w, h, (Math.random() - .5) * 1.2));
      });
      Composite.add(world, cans.map(k => k.body));
      cans.forEach(k => Body.setAngularVelocity(k.body, (Math.random() - .5) * .25));
    } else {
      // carnival pyramid
      let base = 1; while (base * (base + 1) / 2 < list.length) base++;
      base = Math.min(base, Math.floor(span / (w + 3)));
      let i = 0, row = 0;
      while (i < list.length) {
        const count = Math.min(Math.max(1, base - row), list.length - i);
        const rowW = count * (w + 3) - 3, x0 = PILE_X0 + (span - rowW) / 2 + w / 2 + 8;
        for (let k = 0; k < count; k++, i++) cans.push(makeCan(list[i], x0 + k * (w + 3), FLOOR_Y - h / 2 - row * (h + .5) - .5, w, h, 0));
        row++;
      }
      Composite.add(world, cans.map(k => k.body));
      for (let s = 0; s < 90; s++) Engine.update(engine, STEP * 1000);
    }
  }
  const liveBodies = () => cans.filter(k => !k.gone).map(k => k.body);
  const settled = () => cans.every(k => k.gone || (k.body.speed < .15 && Math.abs(k.body.angularVelocity) < .015));

  // ---------- claw geometry ----------
  function pose() {
    const hx = c.x + c.L * Math.sin(c.th), hy = CARR_Y + c.L * Math.cos(c.th);
    return { hx, hy, phi: -c.th, a: .1 + c.open * .62 };
  }
  function placeClaw() {
    const { hx, hy, phi, a } = pose();
    Body.setPosition(hub, { x: hx, y: hy }, true); Body.setAngle(hub, phi, true);
    for (const p of prongs) {
      const ang = phi - p.s * a, piv = rot(p.s * PIV, 8, phi), off = rot(0, PL / 2, ang);
      Body.setPosition(p.body, { x: hx + piv.x + off.x, y: hy + piv.y + off.y }, true);
      Body.setAngle(p.body, ang, true);
    }
  }
  // how wide / tall a (possibly tipped) can is, measured in the claw's frame
  function extent(can, phi) {
    const d = can.body.angle - phi, cs = Math.abs(Math.cos(d)), sn = Math.abs(Math.sin(d));
    return { x: cs * can.w / 2 + sn * can.h / 2, y: sn * can.w / 2 + cs * can.h / 2 };
  }
  function anchor() {
    const { hx, hy, phi } = pose(), o = rot(0, 10 + c.held.ey, phi);
    return { x: hx + o.x, y: hy + o.y };
  }

  // ---------- actions ----------
  function setMode(m) { c.mode = m; c.t = 0; }
  function drop() {
    if (c.mode !== 'aim') return false;
    if (c.x < CHUTE_W + 14) { hooks.onNeedMove && hooks.onNeedMove(); return false; }
    c.auto = null; c.contact = 0; setMode('lower'); hooks.sfx('clack'); return true;
  }
  function autoAim() {
    if (c.mode !== 'aim') return;
    const pool = cans.filter(k => !k.gone && k.body.position.x > CHUTE_W + 20);
    if (!pool.length) return;
    // favour cans with nothing on top of them
    const top = pool.filter(k => !pool.some(o => o !== k && Math.abs(o.body.position.x - k.body.position.x) < k.w * .6 && o.body.position.y < k.body.position.y - 8));
    const choice = (top.length ? top : pool)[Math.random() * (top.length || pool.length) | 0];
    c.auto = clamp(choice.body.position.x + (Math.random() - .5) * 6, CHUTE_W + 18, W - 30);
  }
  function chooseCandidate() {
    const { hx, hy, phi, a } = pose();
    const span = PIV + PL * Math.sin(a);
    let best = null;
    for (const k of cans) {
      if (k.gone || k.ghost > 0) continue;
      const rel = rot(k.body.position.x - hx, k.body.position.y - hy, -phi), e = extent(k, phi);
      if (rel.y < 0 || rel.y > 10 + PL + e.y * .4) continue;
      if (e.x > span - 2) continue;              // too wide to fit between the prongs
      const q = 1 - Math.abs(rel.x) / span;
      if (q < .2) continue;
      if (!best || q > best.q) best = { k, q, e };
    }
    trace('cand', best ? { q: best.q, ex: best.e.x, span } : { none: true, hx, hy, cans: cans.filter(k => !k.gone).map(k => { const r2 = rot(k.body.position.x - hx, k.body.position.y - hy, -phi); return [Math.round(r2.x), Math.round(r2.y), extent(k, phi).x | 0]; }) });
    if (best) {
      const need = Math.asin(clamp((best.e.x + 1 - PIV) / PL, 0, 1));
      c.cand = { k: best.k, q: best.q, stop: clamp((need - .1) / .62, 0, 1) };
      setClawCollide(best.k, false);
    } else c.cand = null;
  }
  function tryGrip() {
    if (!c.cand) return;
    const { k, q } = c.cand, { hx, hy, phi } = pose();
    const rel = rot(k.body.position.x - hx, k.body.position.y - hy, -phi), e = extent(k, phi);
    if (Math.abs(rel.x) > PIV + PL * .55 || rel.y > 10 + PL + e.y * .5) { trace('gripFail', { x: rel.x, y: rel.y }); k.ghost = .4; c.cand = null; return; }
    trace('grip', { q });
    c.held = k; c.grip = q; k.ey = e.y;
    const d = k.body.angle - phi; c.holdAng = Math.round(d / (Math.PI / 2)) * (Math.PI / 2);
    c.con = Constraint.create({ pointA: anchor(), bodyB: k.body, pointB: { x: 0, y: 0 }, length: 0, stiffness: .2, damping: .08 });
    Composite.add(world, c.con);
    hooks.sfx('clank', 5);
  }
  function letGo() {
    if (!c.held) return;
    if (c.con) Composite.remove(world, c.con);
    c.con = null; c.held.ghost = .45; c.held = null; c.cand = null;
  }
  function slip() { if (!c.held) return; trace('slip', { mode: c.mode }); letGo(); hooks.sfx('clank', 4); hooks.onSlip && hooks.onSlip(); }

  // ---------- simulation ----------
  function stepClaw(dt) {
    clock += dt;
    let vDes = 0;
    if (c.mode === 'aim') vDes = c.auto != null ? clamp((c.auto - c.x) * 6, -VMAX, VMAX) : c.input * VMAX;
    else if (c.mode === 'carry' || c.mode === 'off') vDes = clamp((HOME_X - c.x) * 5, -VMAX * .85, VMAX * .85);
    vDes = clamp(vDes, -(c.x - HOME_X) * 8, (W - 30 - c.x) * 8);
    const a = clamp((vDes - c.vx) / dt, -ACC, ACC);
    c.vx += a * dt; c.x = clamp(c.x + c.vx * dt, HOME_X, W - 30);
    // driven pendulum with a changing cable length: swings when the gantry speeds up or brakes;
    // paying out cable (dL/dt > 0) bleeds off swing, as angular momentum is conserved
    const Lp = (c.L - c.Lprev) / dt; c.Lprev = c.L;
    const damp = DAMP * (c.mode === 'lower' || c.mode === 'close' ? 2 : 1);
    const alpha = -(G / c.L) * Math.sin(c.th) - (a / c.L) * Math.cos(c.th) - (2 * Lp / c.L) * c.w - damp * c.w;
    c.w += alpha * dt; c.th = clamp(c.th + c.w * dt, -.6, .6);

    switch (c.mode) {
      case 'load':
        c.t += dt;
        if (c.t > .9 && (settled() || c.t > 3.5)) { setMode('aim'); c.timer = TIME; hooks.onReady && hooks.onReady(); }
        break;
      case 'aim':
        c.open += (.2 - c.open) * Math.min(1, dt * 6);
        c.timer -= dt;
        if (c.timer <= 0) {
          c.timer = 0;
          if (c.auto == null) { if (c.x < CHUTE_W + 18) { autoAim(); hooks.onTimeUp && hooks.onTimeUp(); } else drop(); }
        }
        if (c.auto != null && Math.abs(c.auto - c.x) < 2.5 && Math.abs(c.vx) < 20 && Math.abs(c.th) < .03 && Math.abs(c.w) < .25) drop();
        break;
      case 'lower': {
        c.open = Math.min(1, c.open + dt * 3.2);
        if (c.open > .55) c.L = Math.min(L_MAX, c.L + 290 * dt);
        const { hy, a: pa } = pose(), tipY = hy + 8 + PL * Math.cos(pa), bodies = liveBodies();
        const hubHit = Query.collides(hub, bodies).length > 0;
        const prongHit = prongs.some(p => Query.collides(p.body, bodies).length > 0);
        c.contact = prongHit ? c.contact + dt : 0;
        if (hubHit || c.contact > .16 || tipY >= FLOOR_Y - 3 || c.L >= L_MAX) { chooseCandidate(); setMode('close'); hooks.sfx('clunk'); }
        break;
      }
      case 'close': {
        const stop = c.cand ? c.cand.stop : 0;
        c.open = Math.max(stop, c.open - dt * 1.8);
        if (c.open <= stop + 1e-4) { tryGrip(); setMode('pause'); }
        break;
      }
      case 'pause': c.t += dt; if (c.t > .28) setMode('raise'); break;
      case 'raise':
        c.L = Math.max(L_REST, c.L - 185 * dt);
        if (c.cand && !c.held) { c.cand.k.ghost = .45; c.cand = null; }
        if (c.L <= L_REST) setMode('top');
        break;
      case 'top':
        c.t += dt;
        if (c.t > .3) { if (c.held && hard && Math.random() < .1 + (1 - c.grip) * .55) slip(); setMode('carry'); }
        break;
      case 'carry':
        if (Math.abs(c.x - HOME_X) < 1.5 && Math.abs(c.vx) < 10) { c.t += dt; if (c.t > .15) setMode('release'); }
        break;
      case 'release':
        c.open = Math.min(1, c.open + dt * 2.4);
        if (c.open > .5 && c.held) letGo();
        if (c.open >= 1) setMode('check');
        break;
      case 'check':
        c.t += dt;
        if (pick) doReveal();
        else if (c.t > 1.6) { setMode('aim'); c.timer = TIME; hooks.onMiss && hooks.onMiss(); }
        break;
      default:
        c.open += (.2 - c.open) * Math.min(1, dt * 5);
    }
    if (c.held) {
      c.con.pointA = anchor();
      const b = c.held.body, ph = pose().phi;
      Body.setAngularVelocity(b, b.angularVelocity * .85 + wrapPi(ph + c.holdAng - b.angle) * .04);
      const st = Math.hypot(b.position.x - c.con.pointA.x, b.position.y - c.con.pointA.y);
      if (st > (hard ? 24 : 80)) slip();
    }
  }

  function postStep(dt) {
    for (const k of cans) {
      if (k.gone) continue;
      if (k.ring > 0) k.ring -= dt;
      if (k.ghost > 0) {
        k.ghost -= dt;
        if (k.ghost <= 0) { if (Query.collides(k.body, clawBodies).length) k.ghost = .1; else setClawCollide(k, true); }
      }
      if (k.body.position.y > H + 90) exitCan(k);
    }
  }
  function exitCan(k) {
    if (c.held === k) letGo();
    Composite.remove(world, k.body); k.gone = true;
    hooks.sfx('whoosh'); shake = Math.max(shake, 8);
    if (live && !pick) {
      pick = k;
      if (c.mode === 'aim' || c.mode === 'load') { bonus = true; doReveal(); }
    } else respawn(k);
  }
  function respawn(k) {
    k.gone = false; k.ghost = 0; setClawCollide(k, true);
    Body.setPosition(k.body, { x: PILE_X0 + k.w / 2 + 8 + Math.random() * (PILE_X1 - PILE_X0 - k.w - 16), y: -k.h - 20 });
    Body.setVelocity(k.body, { x: 0, y: 0 }); Body.setAngularVelocity(k.body, 0);
    Composite.add(world, k.body);
  }
  function doReveal() { setMode('reveal'); c.auto = null; hooks.onPick && hooks.onPick(pick, bonus); }

  Events.on(engine, 'collisionStart', ev => {
    for (const p of ev.pairs) {
      const A = p.bodyA, B = p.bodyB, ka = A.plugin && A.plugin.can, kb = B.plugin && B.plugin.can;
      if (!ka && !kb) continue;
      const v = Math.hypot(A.velocity.x - B.velocity.x, A.velocity.y - B.velocity.y) * 2;
      if (v < 1.4) continue;
      if (ka) ka.ring = .25; if (kb) kb.ring = .25;
      hooks.sfx('clank', v);
      const s = p.collision && p.collision.supports && p.collision.supports[0];
      if (s && v > 3.5 && !reduced) spark(s.x, s.y, v);
    }
  });
  function spark(x, y, v) {
    for (let i = 0; i < Math.min(8, v | 0); i++) {
      const a = Math.random() * TAU, sp = 40 + Math.random() * 90;
      puffs.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, life: .35 + Math.random() * .2, star: Math.random() < .4 });
    }
  }

  // ---------- drawing ----------
  function buildBg() {
    bg = document.createElement('canvas'); bg.width = W * dpr; bg.height = H * dpr;
    const g = bg.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = '#eef0f2'; g.fillRect(0, 0, W, H);
    // lithographed sunburst on the back wall
    const ox = (CHUTE_W + W) / 2, oy = FLOOR_Y + 20;
    for (let i = 0; i < 28; i++) {
      const a0 = Math.PI + i * Math.PI / 28, a1 = a0 + Math.PI / 56;
      g.beginPath(); g.moveTo(ox, oy); g.arc(ox, oy, 900, a0, a1); g.closePath();
      g.fillStyle = i % 2 ? 'rgba(243,178,27,.22)' : 'rgba(36,71,181,.07)'; g.fill();
    }
    // checkered floor mat
    const fx = CHUTE_IN;
    g.save(); g.beginPath(); g.rect(fx, FLOOR_Y, W - fx, H - FLOOR_Y); g.clip();
    for (let y = FLOOR_Y, r = 0; y < H; y += 12, r++) for (let x = fx, k = 0; x < W; x += 12, k++) {
      g.fillStyle = (r + k) % 2 ? C.TOMATO : C.WHITE; g.fillRect(x, y, 12, 12);
    }
    g.restore();
    g.fillStyle = C.INK; g.fillRect(fx, FLOOR_Y - 1.5, W - fx, 3);
    // prize well
    g.fillStyle = C.INK; g.fillRect(0, CHUTE_TOP, CHUTE_IN, H - CHUTE_TOP);
    // partition: pressed tin with rivets
    rr(g, CHUTE_IN, CHUTE_TOP, 14, H - CHUTE_TOP + 10, [7, 7, 0, 0]); g.fillStyle = tinGrad(g, CHUTE_IN, CHUTE_W); g.fill();
    g.lineWidth = 2; g.strokeStyle = C.INK; g.stroke();
    for (let y = CHUTE_TOP + 22; y < FLOOR_Y; y += 46) rivet(g, CHUTE_IN + 7, y, 2.6);
    // chute lip
    g.fillStyle = C.MUSTARD; g.fillRect(0, CHUTE_TOP, CHUTE_IN, 10);
    g.lineWidth = 2.5; g.strokeStyle = C.INK; g.strokeRect(1.25, CHUTE_TOP, CHUTE_IN - 1.25, 10);
    // gantry rail
    const rail = g.createLinearGradient(0, CARR_Y - 12, 0, CARR_Y + 2);
    rail.addColorStop(0, '#f2f4f5'); rail.addColorStop(.5, '#a3aab0'); rail.addColorStop(1, '#5f666d');
    g.fillStyle = rail; g.fillRect(0, CARR_Y - 12, W, 13);
    g.lineWidth = 2; g.strokeStyle = C.INK; g.strokeRect(-2, CARR_Y - 12, W + 4, 13);
    for (let x = 14; x < W; x += 36) rivet(g, x, CARR_Y - 5.5, 2.4);
  }

  function drawClaw(g) {
    const { hx, hy, phi, a } = pose();
    // carriage
    rr(g, c.x - 28, CARR_Y - 20, 56, 28, 7); g.fillStyle = C.TOMATO; g.fill(); g.lineWidth = 2.5; g.strokeStyle = C.INK; g.stroke();
    const lampOn = (c.mode === 'aim' && Math.floor(clock * 4) % 2) || c.mode === 'lower' || c.mode === 'close';
    g.beginPath(); g.arc(c.x, CARR_Y - 7, 5, 0, TAU); g.fillStyle = lampOn ? '#fff27a' : '#7d6a2a'; g.fill(); g.lineWidth = 1.5; g.stroke();
    if (lampOn) { g.fillStyle = 'rgba(255,242,122,.35)'; g.beginPath(); g.arc(c.x, CARR_Y - 7, 11, 0, TAU); g.fill(); }
    rivet(g, c.x - 20, CARR_Y - 7, 2.4); rivet(g, c.x + 20, CARR_Y - 7, 2.4);
    // cable (two twisted strands)
    const top = { x: c.x, y: CARR_Y + 8 }, bot = { x: hx + 10 * Math.sin(phi), y: hy - 10 * Math.cos(phi) };
    g.lineWidth = 2.2; g.strokeStyle = C.INK;
    g.beginPath(); g.moveTo(top.x - 1.2, top.y); g.lineTo(bot.x - 1.2, bot.y); g.stroke();
    g.strokeStyle = C.STEEL; g.lineWidth = 1.2; g.beginPath(); g.moveTo(top.x + 1, top.y); g.lineTo(bot.x + 1, bot.y); g.stroke();
    // prongs
    for (const s of [-1, 1]) {
      g.save(); g.translate(hx, hy); g.rotate(phi); g.translate(s * PIV, 8); g.rotate(-s * a);
      g.lineCap = 'round'; g.lineJoin = 'round';
      g.beginPath(); g.moveTo(0, 0); g.lineTo(s * 5, PL * .58); g.lineTo(0, PL); g.lineTo(-s * 12, PL - 1);
      g.lineWidth = 9; g.strokeStyle = C.INK; g.stroke();
      g.lineWidth = 3.5; g.strokeStyle = '#c3c9ce'; g.stroke();
      g.beginPath(); g.arc(-s * 12, PL - 1, 3.4, 0, TAU); g.fillStyle = C.TOMATO; g.fill(); g.lineWidth = 1.5; g.strokeStyle = C.INK; g.stroke();
      g.restore();
    }
    // hub
    g.save(); g.translate(hx, hy); g.rotate(phi);
    rr(g, -21, -10, 42, 20, 6); g.fillStyle = tinGrad(g, -21, 21); g.fill(); g.lineWidth = 2.5; g.strokeStyle = C.INK; g.stroke();
    g.fillStyle = C.MUSTARD; g.fillRect(-14, -3, 28, 6); g.lineWidth = 1.2; g.strokeRect(-14, -3, 28, 6);
    rivet(g, -PIV, 8, 3); rivet(g, PIV, 8, 3);
    g.restore();
  }

  function drawCanBody(g, k) {
    const b = k.body, wob = k.ring > 0 ? Math.sin(k.ring * 70) * k.ring * .08 : 0;
    drawCan(g, k, b.position.x, b.position.y, b.angle + wob, k.w, k.h);
  }

  function draw() {
    if (!bg) buildBg();
    const g = ctx;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.save();
    if (shake > .3 && !reduced) g.translate((Math.random() - .5) * shake, (Math.random() - .5) * shake);
    g.drawImage(bg, 0, 0, W, H);
    if (label) {
      g.font = '38px "Alfa Slab One", Rockwell, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = 'rgba(36,71,181,.14)'; g.fillText(label.toUpperCase(), (CHUTE_W + W) / 2, 170);
    }
    // aim guide
    if (c.mode === 'aim' && c.x > CHUTE_W + 14) {
      const { hx, hy } = pose();
      g.setLineDash([5, 7]); g.strokeStyle = 'rgba(28,27,31,.35)'; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(hx, hy + PL); g.lineTo(hx, FLOOR_Y); g.stroke(); g.setLineDash([]);
      let under = null;
      for (const k of cans) if (!k.gone && Math.abs(k.body.position.x - hx) < k.w * .45 && (!under || k.body.position.y < under.body.position.y)) under = k;
      if (under) {
        const b = under.body;
        g.save(); g.translate(b.position.x, b.position.y); g.rotate(b.angle);
        g.setLineDash([6, 5]); g.lineDashOffset = -clock * 30; g.strokeStyle = C.TOMATO; g.lineWidth = 3;
        rr(g, -under.w / 2 - 6, -under.h / 2 - 6, under.w + 12, under.h + 12, 8); g.stroke(); g.setLineDash([]);
        g.restore();
      }
    }
    g.fillStyle = 'rgba(28,27,31,.14)'; g.beginPath(); g.ellipse(pose().hx, FLOOR_Y + 5, 22, 4, 0, 0, TAU); g.fill();
    for (const k of cans) if (!k.gone && k !== c.held) drawCanBody(g, k);
    // prize-chute front panel covers anything falling out
    const FP = CHUTE_TOP + 78;
    g.fillStyle = C.COBALT; g.fillRect(0, FP, CHUTE_IN, H - FP);
    g.fillStyle = 'rgba(255,255,255,.14)'; for (let x = 6; x < CHUTE_IN; x += 12) g.fillRect(x, FP, 5, H - FP);
    g.lineWidth = 3; g.strokeStyle = C.INK; g.strokeRect(1.5, FP, CHUTE_IN - 1.5, H - FP + 4);
    g.fillStyle = C.WHITE; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '30px "Do Hyeon", "Malgun Gothic", sans-serif'; g.fillText('출구', CHUTE_IN / 2, FP + 38);
    g.font = '11px "Alfa Slab One", Rockwell, serif'; g.fillText('PRIZE', CHUTE_IN / 2, FP + 62);
    g.beginPath(); g.moveTo(CHUTE_IN / 2 - 10, FP + 80); g.lineTo(CHUTE_IN / 2 + 10, FP + 80); g.lineTo(CHUTE_IN / 2, FP + 94); g.closePath();
    g.fillStyle = C.MUSTARD; g.fill(); g.lineWidth = 2; g.stroke();
    rivet(g, 10, FP + 10, 2.6); rivet(g, CHUTE_IN - 10, FP + 10, 2.6);
    if (c.held) drawCanBody(g, c.held);
    drawClaw(g);
    // sparks
    for (const p of puffs) {
      g.globalAlpha = Math.max(0, p.life * 2.2);
      if (p.star) { ART.star(g, p.x, p.y, 4); g.fillStyle = C.MUSTARD; g.fill(); }
      else { g.fillStyle = C.INK; g.fillRect(p.x - 1.5, p.y - 1.5, 3, 3); }
    }
    g.globalAlpha = 1;
    // glass glare
    g.fillStyle = 'rgba(255,255,255,.3)';
    g.beginPath(); g.moveTo(W - 150, 0); g.lineTo(W - 104, 0); g.lineTo(W - 230, H); g.lineTo(W - 276, H); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(W - 90, 0); g.lineTo(W - 80, 0); g.lineTo(W - 206, H); g.lineTo(W - 216, H); g.closePath(); g.fill();
    g.restore();
  }

  function frame(dt) {
    acc += Math.min(dt, .05);
    while (acc >= STEP) {
      stepClaw(STEP); placeClaw();
      Engine.update(engine, STEP * 1000);
      postStep(STEP);
      acc -= STEP;
    }
    shake = Math.max(0, shake - dt * 28);
    for (const p of puffs) { p.vy += 500 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; }
    puffs = puffs.filter(p => p.life > 0);
    const moving = c.mode === 'lower' || c.mode === 'raise';
    hooks.motor && hooks.motor(moving ? .8 : Math.abs(c.vx) / VMAX, moving ? (c.mode === 'raise' ? 1.5 : 1.2) : .5 + Math.abs(c.vx) / VMAX * .5);
    draw();
  }

  placeClaw();
  return {
    attract(names) { live = false; label = ''; letGo(); c.auto = null; setMode('off'); fill(names, false); },
    play(names, lbl) { live = true; label = lbl; letGo(); c.auto = null; fill(names, true); setMode('load'); c.timer = TIME; },
    resume() { pick = null; bonus = false; c.auto = null; setMode('aim'); c.timer = TIME; },
    left() { return cans.filter(k => !k.gone).length; },
    setInput(v) { c.input = v; if (v) c.auto = null; },
    drop, autoAim,
    setHard(v) { hard = v; },
    kick(n) { shake = Math.max(shake, n); },
    get mode() { return c.mode; },
    get timer() { return c.timer; },
    frame,
  };
};
