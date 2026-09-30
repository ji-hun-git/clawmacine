// The crane. Cans are Matter.js rigid bodies (they stack, topple and clank). The claw hangs from its
// trolley on a cable and swings as a driven pendulum; its two prongs are kinematic bodies that shove cans
// aside, and a gripped can hangs on a soft spring. Nobody steers: a short countdown runs while the cans
// settle, the crane draws a NAME (every name in the machine has the same chance), teases one other
// student's can, then goes for the drawn student's most reachable can. A miss or a slip retries the same
// name, so staging and physics never change who gets picked.
// Lighting: one warm lamp at upper left front (ART.LIGHT) models every metal part; the trolley lamp throws
// a cone down into the box and the rest of the interior falls into shadow as the drama rises.
window.Machine = function (canvas, hooks) {
  const { Engine, Bodies, Body, Composite, Query, Events, Constraint } = Matter;
  const { TAU, drawCan, canStyle } = ART;
  const IC = ART.C || {};
  const INK = IC.INK || '#1c1b1f', PAPER = IC.PAPER || '#fbf8f1', TOMATO = IC.TOMATO || '#e2372c';
  const W = 460, H = 580, CARR_Y = 30, L_REST = 64, FLOOR_Y = 548;
  const CHUTE_W = 130, CHUTE_IN = CHUTE_W - 14, CHUTE_TOP = 330, HOME_X = CHUTE_IN / 2, FP = CHUTE_TOP + 3;
  const PIV = 15, PL = 56, G = 1500, DAMP = 3.2, STEP = 1 / 120, COUNTDOWN = 1.8;
  const VMAX = 230, ACC = 650, VAPP = 180, KAPP = 3, VCARRY = 320, ACC_CARRY = 900, VLOWER = 330, VRAISE = 300;
  const L_MAX = FLOOR_Y - CARR_Y - 24, X_MAX = W - 30, SEEK_X0 = CHUTE_W + 18;
  const CAT_WORLD = 1, CAT_CAN = 2, CAT_CLAW = 4, MASK_ALL = 7, MASK_NOCLAW = 3;
  const PILE_X0 = CHUTE_W + 4, PILE_X1 = W - 6;
  // the interior is a shallow box: back wall inset toward a vanishing point at the eye height of a class
  const VP = { x: W / 2, y: 150 }, DEPTH = .14;
  const BX0 = VP.x * DEPTH, BX1 = W - BX0, BY0 = VP.y * DEPTH, BY1 = H + (VP.y - H) * DEPTH, M = 80;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rot = (x, y, a) => ({ x: x * Math.cos(a) - y * Math.sin(a), y: x * Math.sin(a) + y * Math.cos(a) });
  const wrapPi = a => Math.atan2(Math.sin(a), Math.cos(a));
  const ease = (v, to, k, dt) => v + (to - v) * (1 - Math.exp(-dt * k));
  const LV = (() => {
    const v = ART.LIGHT || [-.35, -.8, .5], a = Array.isArray(v) ? v : [v.x, v.y, v.z], n = Math.hypot(a[0], a[1], a[2]) || 1;
    return { x: a[0] / n, y: a[1] / n, z: a[2] / n };
  })();
  const L2 = { x: LV.x / Math.hypot(LV.x, LV.y), y: LV.y / Math.hypot(LV.x, LV.y) };
  const SHX = -LV.x * 12, SHY = -LV.y * 12;                  // where a soft shadow lands, away from the lamp
  const mq = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)').matches : false;
  const calm = () => (typeof ART.motion === 'function' ? ART.motion() === 'calm' : mq);
  const fire = (n, ...a) => { const f = hooks[n]; if (typeof f === 'function') f(...a); };
  const beat = n => fire('onBeat', n);
  const sfx = (n, v) => fire('sfx', n, v);
  const trace = hooks.trace || (() => {});

  const ctx = canvas.getContext('2d');
  let S = 0, CS = 1, lay = null, visible = true, vis = 0;

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

  const c = { x: HOME_X, vx: 0, auto: null, L: L_REST, Lprev: L_REST, th: 0, w: 0, open: .2, mode: 'off', t: 0, age: 0,
    timer: COUNTDOWN, count: 0, contact: 0, cand: null, held: null, con: null, grip: 0, holdAng: 0, plan: [], sub: '',
    name: null, target: null, aimOff: 0, under: null, dropped: null, jolt: 0, jolted: false, slipped: false, tries: 0, ratchet: 0,
    push: 0, benchT: 0, slips: 0 };
  let cans = [], pick = null, pickT = 0, live = false, hard = false, rider = null, acc = 0, clock = 0;
  let shake = 0, puffs = [], rev = 0, jig = 0, absentSlow = 0, lamp = .6, dark = .1, drama = 0;
  const cam = { z: 1, x: W / 2, y: H / 2, slow: 1 };
  const motes = Array.from({ length: 70 }, () => ({ x: CHUTE_W * .5 + Math.random() * (W - CHUTE_W * .5), y: 50 + Math.random() * (FLOOR_Y - 50),
    r: .5 + Math.random() * .9, p: Math.random() * TAU, s: .3 + Math.random() * .7 }));

  // ---------- cans ----------
  function sizeFor(n) {
    if (n <= 4) return [60, 80];
    if (n <= 6) return [54, 72];
    if (n <= 9) return [48, 64];
    if (n <= 12) return [44, 58];
    if (n <= 16) return [40, 54];
    return [36, 48];
  }
  function makeCan(name, x, y, w, h, ang) {
    const body = Bodies.rectangle(x, y, w, h, {
      chamfer: { radius: 3 }, restitution: .08, friction: .75, frictionStatic: 1.1, frictionAir: .012,
      density: .0022, slop: .02, label: 'can', angle: ang,
      collisionFilter: { category: CAT_CAN, mask: MASK_ALL } });
    // spin: each can sits a little turned on its axis, so the pile reads as cylinders, not stickers
    const can = { name, w, h, body, ghost: 0, gone: false, leaving: false, out: false, bench: false, fromClaw: false, ring: 0,
      spin: (1 + (Math.random() - .5) * .12) % 1, shift: null, turnW: 0, ...canStyle(name) };
    body.plugin.can = can;
    return can;
  }
  const setClawCollide = (can, on) => { can.body.collisionFilter.mask = on ? MASK_ALL : MASK_NOCLAW; };
  function clearCans() { for (const k of cans) if (!k.gone) Composite.remove(world, k.body); cans = []; }
  function fill(names, pour) {
    clearCans(); pick = null; pickT = 0;
    const [w, h] = sizeFor(names.length);
    const list = names.slice().sort(() => Math.random() - .5);
    const span = PILE_X1 - PILE_X0;
    if (pour) {
      list.forEach((n, i) => {
        const x = PILE_X0 + w / 2 + 6 + Math.random() * (span - w - 12);
        cans.push(makeCan(n, x, -h - 30 - i * h * .75, w, h, (Math.random() - .5) * 1.2));
      });
      Composite.add(world, cans.map(k => k.body));
      cans.forEach(k => Body.setAngularVelocity(k.body, (Math.random() - .5) * .25));
    } else {
      // a stacked pyramid, as the machine is stocked between rounds
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
  const inPlay = () => cans.filter(k => !k.gone && !k.leaving && !k.out);
  const liveBodies = () => inPlay().map(k => k.body);

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
  // how wide / tall a (possibly tipped) can is, measured in a frame turned by phi
  function extent(can, phi) {
    const d = can.body.angle - phi, cs = Math.abs(Math.cos(d)), sn = Math.abs(Math.sin(d));
    return { x: cs * can.w / 2 + sn * can.h / 2, y: sn * can.w / 2 + cs * can.h / 2 };
  }
  function anchor() {
    const { hx, hy, phi } = pose(), o = rot(0, 10 + c.held.ey + c.jolt, phi);
    return { x: hx + o.x, y: hy + o.y };
  }

  // ---------- choosing ----------
  const inPile = k => !k.gone && !k.leaving && !k.out && k.body.position.x > CHUTE_W + 6 && k.body.position.y > 0;
  // how much room the claw has around a can: the hub must reach low enough that the prongs close around
  // the can's upper half, before the hub lands on a neighbour or a prong jams against one
  function reach(k, pool, off = 0) {
    const p = k.body.position, e = extent(k, 0), top = p.y - e.y, ax = p.x + off;
    const need = top + .45 * e.y - 72;
    let lim = FLOOR_Y - 58;
    for (const o of pool) {
      if (o === k) continue;
      const oe = extent(o, 0), oTop = o.body.position.y - oe.y, dc = Math.abs(o.body.position.x - ax), u0 = dc - oe.x, u1 = dc + oe.x;
      if (u0 < 21) lim = Math.min(lim, oTop - 10);                                           // the hub lands on it
      if (u0 < 54 && u1 > 15) lim = Math.min(lim, oTop - (8 + (Math.min(u1, 52) - 15) * 1.135) + 2); // a prong lands on it
    }
    let s = lim - need - Math.abs(off) * .4;
    if (ax < CHUTE_W + 24 || ax > W - 24) s -= 12;
    if (e.x > 44) s -= 60;                                            // lying across, too wide for the prongs
    return s;
  }
  // the drawn name's easiest can, and where to hang the claw over it (a little off centre can keep a
  // prong clear of a taller neighbour)
  function bestCan(name) {
    const pool = cans.filter(inPile), mine = pool.filter(k => k.name === name);
    if (!mine.length) { c.aimOff = 0; return inPlay().find(k => k.name === name) || null; }
    let best = null, bs = -1e9, bo = 0;
    for (const k of mine) for (const off of [0, -7, 7, -13, 13]) {
      const s = reach(k, pool, off) + Math.random() * 3;
      if (s > bs) { bs = s; best = k; bo = off; }
    }
    c.aimOff = bo;
    return best;
  }
  function decoyFor(t) {
    const pool = cans.filter(k => inPile(k) && k.name !== c.name && k.body.position.x > SEEK_X0 - 8 && k.body.position.x < X_MAX + 8);
    if (!pool.length) return null;
    const tx = t ? t.body.position.x : W / 2;
    const all = cans.filter(inPile), free = pool.filter(k => reach(k, all) > 0);
    const list = free.length ? free : pool;
    const far = list.filter(k => Math.abs(k.body.position.x - tx) > 60 && Math.abs(k.body.position.x - tx) < 240);
    const from = far.length ? far : list.filter(k => Math.abs(k.body.position.x - tx) > 30);
    return from.length ? from[Math.random() * from.length | 0] : null;
  }
  // FAIR: the name is drawn uniformly over the names still in the machine, however many cans each has
  // or wherever they lie. A retry keeps the drawn name.
  function startPick(retry) {
    const names = [...new Set(inPlay().map(k => k.name))];
    if (!names.length) { c.name = null; setMode('reveal'); return; }
    for (const k of cans) k.fromClaw = false;
    if (!retry || !c.name || !names.includes(c.name)) { c.name = names[Math.random() * names.length | 0]; c.tries = 0; c.slips = 0; }
    else c.tries++;
    c.target = bestCan(c.name); c.plan = []; c.slipped = false;
    if (!retry && names.length > 1) {
      const d = decoyFor(c.target);
      if (d) c.plan.push({ can: d, x: d.body.position.x, hold: .7 + Math.random() * .2, arrived: false });
    }
    c.sub = c.plan.length ? 'wander' : 'approach';
    trace('start', { name: c.name, retry: !!retry, decoy: c.plan.length });
    setMode('seek'); fire('onSeek'); beat(retry ? 'retry' : 'go'); sfx('clack');
  }
  // the prongs slide down around the target instead of shoving it; the hub stops on its top
  function drop() { trace('drop', { m: c.target && reach(c.target, cans.filter(inPile), c.aimOff), off: c.aimOff }); c.auto = null; c.contact = 0; c.push = 0; if (c.target) setClawCollide(c.target, false); setMode('lower'); beat('drop'); sfx('clack'); }
  function chooseCandidate() {
    const { hx, hy, phi, a } = pose();
    const span = PIV + PL * Math.sin(a);
    let best = null;
    for (const k of cans) {
      if (k.gone || k.leaving || k.out || k.ghost > 0 || k.name !== c.name) continue;
      const rel = rot(k.body.position.x - hx, k.body.position.y - hy, -phi), e = extent(k, phi);
      if (rel.y < 0 || rel.y > 16 + PL + e.y * .55) continue;       // prongs close around at least its upper part
      if (e.x > span - 2) continue;
      const q = 1 - Math.abs(rel.x) / span;
      if (q < (k === c.target ? .2 : .5)) continue;
      if (!best || q > best.q) best = { k, q, e };
    }
    trace('cand', best ? { q: best.q, ex: best.e.x, span } : { none: true });
    if (best) {
      const need = Math.asin(clamp((best.e.x + 1 - PIV) / PL, 0, 1));
      c.cand = { k: best.k, q: best.q, stop: clamp((need - .1) / .62, 0, 1) };
      setClawCollide(best.k, false);
    } else c.cand = null;
    if (c.target && (!c.cand || c.cand.k !== c.target)) c.target.ghost = Math.max(c.target.ghost, .3);
  }
  function tryGrip() {
    if (!c.cand) { beat('empty'); return; }
    const { k, q } = c.cand, { hx, hy, phi } = pose();
    const rel = rot(k.body.position.x - hx, k.body.position.y - hy, -phi), e = extent(k, phi);
    if (Math.abs(rel.x) > PIV + PL * .6 || rel.y > 28 + PL + e.y * .6) { trace('gripFail', { x: rel.x, y: rel.y }); k.ghost = .4; c.cand = null; beat('empty'); return; }
    trace('grip', { q });
    c.held = k; c.grip = q; k.ey = e.y;
    k.shift = 0; k.turnW = (Math.random() < .5 ? -1 : 1) * (.55 + Math.random() * .3);
    const d = k.body.angle - phi; c.holdAng = Math.round(d / (Math.PI / 2)) * (Math.PI / 2);
    c.con = Constraint.create({ pointA: anchor(), bodyB: k.body, pointB: { x: 0, y: 0 }, length: 0, stiffness: .2, damping: .08 });
    Composite.add(world, c.con);
    beat('grip'); sfx('clank', 5);
  }
  function letGo() {
    if (!c.held) return;
    if (c.con) Composite.remove(world, c.con);
    c.held.fromClaw = true; c.dropped = c.held; c.con = null; c.held.ghost = .45; c.held = null; c.cand = null;
  }
  function slip() { if (!c.held) return; trace('slip', { mode: c.mode }); letGo(); c.slipped = true; c.slips++; sfx('clank', 4); beat('slip'); fire('onSlip'); }
  function retry() {
    trace('miss', { slipped: c.slipped });
    if (!c.slipped) { beat('miss'); fire('onMiss'); }
    letGo(); startPick(true);
  }
  function setMode(m) { c.mode = m; c.t = 0; c.age = 0; if (m === 'lower') c.jolted = false; }

  // ---------- simulation ----------
  function stepClaw(dt) {
    c.age += dt;
    if (c.jolt > 0) c.jolt = Math.max(0, c.jolt - dt * 18);
    const m = c.mode;
    let vDes = 0, amax = ACC;
    if (m === 'seek' && c.auto != null) {
      const d = c.auto - c.x;
      vDes = c.plan.length ? clamp(d * 6, -VMAX, VMAX) : clamp(d * KAPP, -VAPP, VAPP);   // slow final approach
    } else if (m === 'carry') { vDes = clamp((HOME_X - c.x) * 5, -VCARRY, VCARRY); amax = ACC_CARRY; }
    else if (m === 'off' || m === 'load' || m === 'aim' || m === 'check' || m === 'reveal') vDes = clamp((HOME_X - c.x) * 4, -VMAX, VMAX);
    vDes = clamp(vDes, -(c.x - HOME_X) * 8, (X_MAX - c.x) * 8);
    const a = clamp((vDes - c.vx) / dt, -amax, amax);
    c.vx += a * dt; c.x = clamp(c.x + c.vx * dt, HOME_X, X_MAX);
    // driven pendulum with a changing cable length: it swings when the trolley speeds up or brakes,
    // and paying out cable (dL/dt > 0) bleeds off swing, as angular momentum is conserved
    const Lp = (c.L - c.Lprev) / dt; c.Lprev = c.L;
    const hold = m === 'seek' && (c.sub === 'lock' || (c.plan[0] && c.plan[0].arrived));
    const damp = DAMP * (m === 'lower' || m === 'close' ? 2 : hold ? 4 : 1);
    const alpha = -(G / c.L) * Math.sin(c.th) - (a / c.L) * Math.cos(c.th) - (2 * Lp / c.L) * c.w - damp * c.w;
    c.w += alpha * dt; c.th = clamp(c.th + c.w * dt, -.6, .6);
    const relax = to => { c.open += (to - c.open) * Math.min(1, dt * 6); };

    switch (m) {
      case 'load':
        relax(.2); c.t += dt;
        if (c.t > .9) { setMode('aim'); c.timer = COUNTDOWN; c.count = 0; fire('onReady'); }
        break;
      case 'aim': {
        relax(.2);
        c.timer -= dt;
        const n = Math.ceil(c.timer / (COUNTDOWN / 3) - 1e-6);
        if (n !== c.count && n > 0 && n <= 3) { c.count = n; beat('count' + n); sfx('tickLow'); rev = .18; jig = .15; lamp = 1.25; }
        if (c.timer <= 0) { c.timer = 0; c.count = 0; startPick(false); }
        break;
      }
      case 'seek': {
        if (!c.target || c.target.gone || c.target.leaving || c.target.name !== c.name) {
          if (!inPlay().some(k => k.name === c.name)) { startPick(false); break; }
          c.target = bestCan(c.name);
        }
        const leg = c.plan[0];
        if (leg) {
          relax(.2);
          if (leg.can.gone || leg.can.leaving) { c.plan.shift(); break; }
          if (!leg.arrived) leg.x = leg.can.body.position.x;
          c.auto = clamp(leg.x, SEEK_X0, X_MAX);
          if (!leg.arrived) {
            if (Math.abs(c.auto - c.x) < 3 && Math.abs(c.vx) < 30) { leg.arrived = true; c.t = 0; beat('tease'); }
          } else {
            // the tease: stop over someone else's can, lamp steady, prongs flex as if about to drop
            c.t += dt;
            const f = clamp((c.t - leg.hold * .35) / .3, 0, 1);
            c.open = .2 + Math.sin(f * Math.PI) * .2;
            if (c.t > leg.hold) {
              c.plan.shift(); c.sub = 'approach'; beat('leave');
              c.target = bestCan(c.name);                 // re-pick the drawn name's most reachable can
            }
          }
        } else {
          relax(.2);
          const tx = clamp(c.target.body.position.x + (c.aimOff || 0), SEEK_X0, X_MAX);
          if (c.sub !== 'lock') {
            c.sub = 'approach'; c.auto = tx;
            if (Math.abs(c.auto - c.x) < 3 && Math.abs(c.vx) < 20) { c.sub = 'lock'; c.t = 0; beat('lock'); }
          } else {
            c.t += dt;
            if (Math.abs(tx - c.auto) > 12) { c.sub = 'approach'; break; }
            c.auto += (tx - c.auto) * Math.min(1, dt * 4);
            if ((c.t > .4 && Math.abs(c.th) < .05 && Math.abs(c.w) < .4) || c.t > 1) drop();
          }
        }
        // a tick each time a new can passes under the claw
        const hx = pose().hx; let under = null;
        for (const k of cans) if (!k.gone && !k.leaving && !k.out && Math.abs(k.body.position.x - hx) < k.w * .45 && (!under || k.body.position.y < under.body.position.y)) under = k;
        if (under !== c.under) { c.under = under; if (under) sfx('tick', .8); }
        break;
      }
      case 'lower': {
        c.open = Math.min(1, c.open + dt * 3.2);
        const { hx: X, hy: Y, phi: F, a: pa } = pose(), tipY = Y + 8 + PL * Math.cos(pa), bodies = liveBodies();
        const others = c.target ? bodies.filter(b => b !== c.target.body) : bodies;
        const hubOn = Query.collides(hub, others).length > 0, hubTarget = !!c.target && Query.collides(hub, [c.target.body]).length > 0;
        const prongHit = prongs.some(p => Query.collides(p.body, others).length > 0);
        c.contact = prongHit ? c.contact + dt : 0;
        c.push = hubOn ? c.push + dt : 0;
        // while the target is still too deep to close around, the claw digs: it keeps pressing down
        // (slower) and shoves what lies on or beside the target out of the way, for a moment
        let deep = false;
        if (c.target) {
          const r = rot(c.target.body.position.x - X, c.target.body.position.y - Y, -F);
          deep = Math.abs(r.x) < 22 && r.y > 12 + PL + extent(c.target, F).y * .5;
        }
        if (c.open > .55) { c.L = Math.min(L_MAX, c.L + VLOWER * (c.contact > 0 || hubOn ? .45 : 1) * dt); cable(); }
        const stop = hubTarget || (hubOn && (!deep || c.push > .5)) || c.contact > (deep ? .6 : .12) || tipY >= FLOOR_Y - 3 || c.L >= L_MAX;
        if (stop) {
          trace('stop', { hubTarget, hubOn, push: c.push, contact: c.contact, deep, L: c.L });
          chooseCandidate(); setMode('close'); beat('contact'); sfx('clunk'); shake = Math.max(shake, 2.5);
        }
        break;
      }
      case 'close': {
        const stop = c.cand ? c.cand.stop : 0;
        c.open = Math.max(stop, c.open - dt * 2.2);
        if (c.cand) {
          // the closing prongs sweep the can in toward the middle and pinch it
          const { hx: X, hy: Y, phi: F } = pose(), b = c.cand.k.body, r = rot(b.position.x - X, b.position.y - Y, -F);
          const v = rot(b.velocity.x, b.velocity.y, -F), want = rot(v.x * .6 - r.x * .045, v.y * .8, F);
          Body.setVelocity(b, want);
        }
        if (c.open <= stop + 1e-4) { tryGrip(); setMode('pause'); }
        break;
      }
      case 'pause': c.t += dt; if (c.t > .2) { setMode('raise'); beat('lift'); } break;
      case 'raise':
        c.t += dt;
        c.L = Math.max(L_REST, c.L - VRAISE * dt); cable();
        if (c.cand && !c.held) { c.cand.k.ghost = .45; c.cand = null; }
        if (c.L <= L_REST) setMode('top');
        break;
      case 'top':
        c.t += dt;
        if (!c.held) { if (c.t > .35) retry(); break; }
        if (!c.jolted && c.t > .1) {
          // near miss: the can drops a notch in the prongs and swings, then holds
          c.jolted = true; c.jolt = 14; c.open = Math.min(1, c.open + .07); shake = Math.max(shake, 3); beat('jolt'); sfx('gasp');
        }
        if (c.t > .5) {
          if (hard && c.slips < 2 && Math.random() < .22 + (1 - c.grip) * .5) { slip(); c.t = 0; break; }
          setMode('carry'); beat('carry');
        }
        break;
      case 'carry':
        if (Math.abs(c.x - HOME_X) < 2 && Math.abs(c.vx) < 12) { c.t += dt; if (c.t > .08) { setMode('release'); beat('release'); sfx('clack'); } }
        break;
      case 'release':
        c.open = Math.min(1, c.open + dt * 2.6);
        if (c.open > .45 && c.held) letGo();
        if (c.open >= 1) setMode('check');
        break;
      case 'check':
        c.t += dt;
        if (!pick && c.t > 1.4) { trace('lost', c.dropped && { x: c.dropped.body.position.x, y: c.dropped.body.position.y, gone: c.dropped.gone }); retry(); }
        break;
      default:
        c.open += (.2 - c.open) * Math.min(1, dt * 5);
    }
    if (c.held) {
      const k = c.held;
      c.con.pointA = anchor();
      const b = k.body, ph = pose().phi;
      Body.setAngularVelocity(b, b.angularVelocity * .85 + wrapPi(ph + c.holdAng - b.angle) * .04);
      // weak grip: once the spring has pulled the can in, a hard swing or a snag shakes it loose; after two
      // slips on the same name the grip holds, so a pick always ends
      const st = Math.hypot(b.position.x - c.con.pointA.x, b.position.y - c.con.pointA.y);
      const settled = m === 'top' || m === 'carry' || (m === 'raise' && c.t > .3);
      if (st > (hard && c.slips < 2 && settled ? 30 : 90)) slip();
    }
    for (const k of cans) if (k.shift != null && !k.gone) { k.shift += k.turnW * dt; k.turnW = k.turnW * (1 - .5 * dt) + Math.sign(k.turnW) * .12 * dt; }
    // watchdog: no beat may run away (a can wedged under the hub, a pile that never settles)
    if (live && c.age > 12 && m !== 'aim' && m !== 'reveal' && m !== 'off' && m !== 'load' && !pick) { trace('watchdog', { mode: m }); retry(); }
  }
  // a ratchet click every 14 px of cable
  function cable() { if (Math.abs(c.L - c.ratchet) > 14) { c.ratchet = c.L; sfx('tick', .45); } }

  function postStep(dt) {
    for (const k of cans) {
      if (k.gone) continue;
      const p = k.body.position;
      if (k.leaving || k.out) {
        if (p.y < -160 || p.y > H + 60) { Composite.remove(world, k.body); k.gone = true; }
        continue;
      }
      if (k.ring > 0) k.ring -= dt;
      if (k.ghost > 0) {
        k.ghost -= dt;
        if (k.ghost <= 0) { if (Query.collides(k.body, clawBodies).length) k.ghost = .1; else setClawCollide(k, true); }
      }
      if (p.x < CHUTE_IN - 2 && p.y - k.h / 2 > FP) {
        // behind the chute panel: only the drawn name's can, let go by the claw, counts; anything else is put back
        if (live && !pick && k.fromClaw && k.name === c.name && k !== c.held) { pick = k; k.out = true; pickT = .25; trace('pick', { name: k.name }); beat('fall'); }
        else respawn(k);
      } else if (p.y > H + 60) respawn(k);
    }
  }
  function respawn(k) {
    if (c.held === k) letGo();
    if (!k.gone) Composite.remove(world, k.body);
    k.gone = false; k.leaving = false; k.bench = false; k.ghost = 0; k.fromClaw = false; k.shift = null;
    k.body.frictionAir = .012; setClawCollide(k, true);
    Body.setPosition(k.body, { x: PILE_X0 + k.w / 2 + 8 + Math.random() * (PILE_X1 - PILE_X0 - k.w - 16), y: -k.h - 20 - Math.random() * 60 });
    Body.setVelocity(k.body, { x: 0, y: 0 }); Body.setAngularVelocity(k.body, (Math.random() - .5) * .2);
    Composite.add(world, k.body);
  }
  function doReveal() { setMode('reveal'); c.auto = null; c.plan = []; fire('onPick', pick, false); }
  // an absent student's other cans jump up and out of the machine and wait on the bench
  function removeStudent(name) {
    let n = 0;
    for (const k of cans) {
      if (k.gone || k.leaving || k.out || k.name !== name) continue;
      if (c.held === k) letGo();
      k.leaving = true; k.bench = true; k.body.collisionFilter.mask = 0; k.body.frictionAir = 0;
      Body.setVelocity(k.body, { x: (Math.random() - .5) * 5, y: -25 - Math.random() * 4 });
      Body.setAngularVelocity(k.body, (Math.random() - .5) * .5);
      n++;
    }
    if (n) { sfx('whoosh'); beat('absent'); c.benchT = 1.2; if (!calm()) absentSlow = .8; }
    if (c.name === name) { c.name = null; c.target = null; }
    return n;
  }
  // undo: the benched cans pour back in from the top
  function restoreStudent(name) {
    let n = 0;
    for (const k of cans) if (k.bench && k.name === name) { respawn(k); n++; }
    if (n) { sfx('whoosh'); beat('restore'); }
    return n;
  }

  Events.on(engine, 'collisionStart', ev => {
    for (const p of ev.pairs) {
      const A = p.bodyA, B = p.bodyB, ka = A.plugin && A.plugin.can, kb = B.plugin && B.plugin.can;
      if (!ka && !kb) continue;
      const v = Math.hypot(A.velocity.x - B.velocity.x, A.velocity.y - B.velocity.y) * 2;
      if (v < 1.4) continue;
      if (ka) ka.ring = .25; if (kb) kb.ring = .25;
      sfx('clank', v);
      const s = p.collision && p.collision.supports && p.collision.supports[0];
      if (s && v > 3.5 && !calm()) spark(s.x, s.y, v);
    }
  });
  // metal on metal: a few short glints, gone in a fifth of a second
  function spark(x, y, v) {
    for (let i = 0; i < Math.min(6, v * .7 | 0); i++) {
      const a = -Math.PI / 2 + (Math.random() - .5) * 2.6, sp = 120 + Math.random() * 220;
      puffs.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: .1 + Math.random() * .1 });
    }
  }

  // ---------- camera and staging ----------
  function heldPos() { return c.held ? c.held.body.position : null; }
  function shot() {
    const { hx, hy, a } = pose(), m = c.mode, hp = heldPos(), tipY = hy + 8 + PL * Math.cos(a);
    const t = c.target && !c.target.gone ? c.target.body.position : null;
    if (!live) return { z: 1.035 + .025 * Math.sin(clock * TAU / 14), x: W * .55 + 26 * Math.sin(clock * TAU / 19), y: H * .56, k: .8, d: 0, dk: .1 };
    switch (m) {
      case 'load': return { z: 1, x: W / 2, y: H / 2, k: 2, d: .06, dk: .12 };
      case 'aim': return c.benchT > 0 ? { z: 1, x: W / 2, y: H / 2, k: 4, d: .2, dk: .25 } : { z: 1 + .08 * (1 - c.timer / COUNTDOWN), x: (CHUTE_W + W) / 2, y: 330, k: 1.7, d: .16, dk: .3 };
      case 'seek': {
        const leg = c.plan[0];
        if (leg && leg.arrived) return { z: 1.28, x: leg.can.body.position.x, y: (hy + leg.can.body.position.y) / 2 + 20, k: 3, d: .46, dk: .52 };
        if (c.sub === 'lock' && t) return { z: 1.75, x: hx, y: (hy + t.y) / 2 + 10, k: 5, d: .6, dk: .58 };
        if (c.sub === 'approach' && t) return { z: 1.45, x: c.x, y: t.y - 60, k: 3.2, d: .44, dk: .48 };
        return { z: 1.1, x: c.x + c.vx * .25, y: 272, k: 2.6, d: .3, dk: .42 };
      }
      case 'lower': {
        const f = clamp((c.L - L_REST) / (L_MAX - L_REST), 0, 1);
        return { z: 1.75 + f * .45, x: hx, y: tipY - 10, k: 6, d: .7, dk: .62 };
      }
      case 'close': case 'pause': return { z: 2.35, x: hx, y: tipY - 4, k: 5, d: .86, dk: .7 };
      case 'raise': return hp ? { z: 2.3 + clamp(c.t / 1.2, 0, 1) * .5, x: hp.x, y: hp.y - 16, k: 6, d: 1, dk: .72 } : { z: 1.5, x: hx, y: hy + 30, k: 3, d: .5, dk: .5 };
      case 'top': return hp ? { z: 2.85, x: hp.x, y: hp.y - 20, k: 5, d: 1, dk: .76 } : { z: 1.3, x: hx, y: hy + 40, k: 3, d: .35, dk: .4 };
      case 'carry': return hp ? { z: 1.7, x: c.x - 50, y: hp.y + 20, k: 3.5, d: .82, dk: .62 } : { z: 1.1, x: c.x, y: H / 2, k: 2, d: .3, dk: .35 };
      case 'release': case 'check': {
        const k = c.dropped, y = k && !k.gone && k !== pick ? clamp(k.body.position.y, 190, CHUTE_TOP - 70) : CHUTE_TOP - 70;
        return { z: 1.9, x: HOME_X + 40, y, k: 5, d: .94, dk: .7 };
      }
      case 'reveal': return { z: 1.2, x: HOME_X + 60, y: CHUTE_TOP - 20, k: 1.2, d: 1, dk: .55 };
    }
    return { z: 1, x: W / 2, y: H / 2, k: 2, d: 0, dk: .1 };
  }
  function slowWish() {
    if (calm()) return 1;
    if (absentSlow > 0) return .5;
    const m = c.mode;
    if (m === 'close' || m === 'pause') return .5;
    if (m === 'raise' && c.t < .12) return .5;
    if (m === 'top' && c.held && c.t > .08 && c.t < .36) return .42;
    return 1;
  }
  function moveCamera(dt) {
    const s = shot(), zmax = calm() ? 1.25 : 4;
    cam.z = ease(cam.z, Math.min(s.z, zmax), s.k, dt);
    cam.x = ease(cam.x, s.x, s.k, dt); cam.y = ease(cam.y, s.y, s.k, dt);
    const hw = W / 2 / cam.z, hh = H / 2 / cam.z;
    cam.x = clamp(cam.x, hw, W - hw); cam.y = clamp(cam.y, hh, H - hh);
    cam.slow = ease(cam.slow, slowWish(), 9, dt);
    drama = ease(drama, s.d, 3, dt);
    dark = ease(dark, s.dk, 2.4, dt);
    lamp = ease(lamp, live ? 1 : .75, 7, dt);
  }

  // ---------- drawing: cached layers ----------
  function layer(w, h, s) {
    const cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.round(w * s)); cv.height = Math.max(1, Math.round(h * s));
    const g = cv.getContext('2d'); g.setTransform(s, 0, 0, s, 0, 0);
    return { cv, g };
  }
  const quad = (g, p) => { g.beginPath(); g.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) g.lineTo(p[i], p[i + 1]); g.closePath(); };
  function rrect(g, x, y, w, h, r) { g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h); }
  // polished steel across a width from (x0,y0) to (x1,y1): dark on the side turned from the lamp, a hard
  // highlight near the side that faces it, a little floor bounce on the dark edge. (lx, ly) = lamp in local space.
  function steel(g, x0, y0, x1, y1, lx = L2.x, ly = L2.y) {
    const f = (x1 - x0) * lx + (y1 - y0) * ly;
    const gr = f >= 0 ? g.createLinearGradient(x0, y0, x1, y1) : g.createLinearGradient(x1, y1, x0, y0);
    const col = (r, gg, b) => `rgb(${r},${gg},${b})`;
    gr.addColorStop(0, col(78, 85, 92)); gr.addColorStop(.14, col(38, 43, 48)); gr.addColorStop(.46, col(122, 130, 138));
    gr.addColorStop(.72, col(226, 231, 235)); gr.addColorStop(.8, col(252, 253, 253)); gr.addColorStop(.9, col(190, 197, 203)); gr.addColorStop(1, col(140, 148, 156));
    return gr;
  }
  function lampFalloff(g, x0, y0, w, h) {
    g.globalCompositeOperation = 'multiply';
    const r = g.createRadialGradient(W * .5 - 90, -60, 60, W * .5 - 90, -60, 660);
    r.addColorStop(0, 'rgba(255,236,190,0)'); r.addColorStop(.45, 'rgba(210,180,140,.22)'); r.addColorStop(1, 'rgba(20,12,6,.74)');
    g.fillStyle = r; g.fillRect(x0, y0, w, h);
    g.globalCompositeOperation = 'source-over';
  }
  function buildLayers() {
    const far = layer(W + 2 * M, H + 2 * M, CS), box = layer(W, H, CS), front = layer(CHUTE_IN, H - FP + 6, CS), glass = layer(W + 40, H, CS);
    const sh = layer(W / 4, H / 4, 1), cone = layer(W / 4, H / 4, 1), dk = layer(W / 4, H / 4, 1), mir = layer(W / 3, H / 3, 1);
    paintFar(far.g); paintBox(box.g); paintFront(front.g); paintGlass(glass.g);
    const ao = layer(64, 16, 1), ag = ao.g.createRadialGradient(32, 8, 1, 32, 8, 32);
    ag.addColorStop(0, 'rgba(10,6,4,.6)'); ag.addColorStop(.55, 'rgba(10,6,4,.25)'); ag.addColorStop(1, 'rgba(10,6,4,0)');
    ao.g.setTransform(1, 0, 0, .25, 0, 6); ao.g.fillStyle = ag; ao.g.fillRect(0, -24, 64, 64);
    lay = { far, box, front, glass, sh, cone, dk, ao, mir };
  }
  // back wall: a smoked mirror, drawn with extra margin because it moves less than the room (parallax)
  function paintFar(g) {
    g.translate(M, M);
    const gr = g.createLinearGradient(0, BY0, 0, BY1);
    gr.addColorStop(0, '#302d31'); gr.addColorStop(.5, '#1f1d22'); gr.addColorStop(1, '#141316');
    g.fillStyle = gr; g.fillRect(-M, -M, W + 2 * M, H + 2 * M);
    for (const [u, w, a] of [[.16, 30, .035], [.41, 9, .05], [.6, 46, .025], [.84, 15, .045]]) {
      const sx = BX0 + (BX1 - BX0) * u, sg = g.createLinearGradient(sx - w, 0, sx + w, 0);
      sg.addColorStop(0, 'rgba(255,248,235,0)'); sg.addColorStop(.5, `rgba(255,248,235,${a})`); sg.addColorStop(1, 'rgba(255,248,235,0)');
      g.fillStyle = sg; g.fillRect(sx - w, -M, w * 2, H + 2 * M);
    }
    const rg = g.createRadialGradient(W * .3, BY0 + 26, 4, W * .3, BY0 + 26, 190);
    rg.addColorStop(0, 'rgba(255,233,196,.16)'); rg.addColorStop(1, 'rgba(255,233,196,0)');
    g.fillStyle = rg; g.fillRect(-M, -M, W + 2 * M, H + 2 * M);
    lampFalloff(g, -M, -M, W + 2 * M, H + 2 * M);
    const top = g.createLinearGradient(0, BY0, 0, BY0 + 50);
    top.addColorStop(0, 'rgba(0,0,0,.55)'); top.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = top; g.fillRect(-M, -M, W + 2 * M, BY0 + 50 + M);
  }
  // the room: ceiling, side walls, printed tin floor, the chute well and its partition, the rail
  function paintBox(g) {
    const ceil = g.createLinearGradient(0, 0, 0, BY0);
    ceil.addColorStop(0, '#0f0e10'); ceil.addColorStop(1, '#1d1b1e');
    quad(g, [0, 0, W, 0, BX1, BY0, BX0, BY0]); g.fillStyle = ceil; g.fill();
    // side walls: dark litho tin, darker toward the glass; the right wall turns toward the lamp
    let sg = g.createLinearGradient(0, 0, BX0, 0);
    sg.addColorStop(0, '#15120f'); sg.addColorStop(1, '#2d2723');
    quad(g, [0, 0, BX0, BY0, BX0, BY1, 0, H]); g.fillStyle = sg; g.fill();
    sg = g.createLinearGradient(W, 0, BX1, 0);
    sg.addColorStop(0, '#272019'); sg.addColorStop(1, '#4b423a');
    quad(g, [W, 0, BX1, BY0, BX1, BY1, W, H]); g.fillStyle = sg; g.fill();
    // floor: a printed checker in perspective; squares are equal on the tin, so rows shrink toward the back
    g.save(); quad(g, [0, H, BX0, BY1, BX1, BY1, W, H]); g.clip();
    const D = 1 / (1 - DEPTH) - 1, P = (x0, s) => { const f = 1 / (1 + s * D); return [VP.x + (x0 - VP.x) * f, VP.y + (H - VP.y) * f]; };
    const cols = 24, rows = 7;
    for (const pass of [0, 1]) {
      g.beginPath();
      for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
        if ((i + j) % 2 !== pass) continue;
        const x0 = j * W / cols, x1 = (j + 1) * W / cols, s0 = i / rows, s1 = (i + 1) / rows;
        const a = P(x0, s0), b = P(x1, s0), d = P(x1, s1), e = P(x0, s1);
        g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(d[0], d[1]); g.lineTo(e[0], e[1]); g.closePath();
      }
      g.fillStyle = pass ? '#c8412f' : '#ebe2cf'; g.fill();
    }
    // satin: the lamp's reflection smeared across the tin, and wear toward the front edge
    const sat = g.createLinearGradient(0, BY1, 0, H);
    sat.addColorStop(0, 'rgba(0,0,0,.28)'); sat.addColorStop(.5, 'rgba(255,240,215,.1)'); sat.addColorStop(1, 'rgba(0,0,0,.2)');
    g.fillStyle = sat; g.fillRect(0, BY1, W, H - BY1);
    g.restore();
    // the prize chute is a box in the front left corner, open at the top: seen from above the lip, its
    // opening is a dark band that runs back to the rear wall; its right wall faces the pile
    const back = (x, y) => [VP.x + (x - VP.x) * (1 - DEPTH), VP.y + (y - VP.y) * (1 - DEPTH)];
    const [hx0, hy0] = back(0, CHUTE_TOP), [hx1] = back(CHUTE_IN, CHUTE_TOP), [px1, py1] = back(CHUTE_W, CHUTE_TOP), [, pyb] = back(CHUTE_W, H);
    const face = g.createLinearGradient(CHUTE_W, 0, px1, 0);
    face.addColorStop(0, '#34383d'); face.addColorStop(1, '#1b1d20');
    quad(g, [CHUTE_W - 1, CHUTE_TOP, px1, py1, px1, pyb, CHUTE_W - 1, H]); g.fillStyle = face; g.fill();
    const hole = g.createLinearGradient(0, hy0, 0, CHUTE_TOP);
    hole.addColorStop(0, '#2a2622'); hole.addColorStop(.25, '#0b0a0c'); hole.addColorStop(1, '#030304');
    quad(g, [0, CHUTE_TOP, CHUTE_IN, CHUTE_TOP, hx1, hy0, hx0, hy0]); g.fillStyle = hole; g.fill();
    quad(g, [CHUTE_IN, CHUTE_TOP, CHUTE_W, CHUTE_TOP, px1, py1, hx1, hy0]);
    g.fillStyle = steel(g, 0, CHUTE_TOP, 0, py1); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = .75;
    g.beginPath(); g.moveTo(hx1, hy0); g.lineTo(px1, py1); g.stroke();
    g.beginPath(); g.moveTo(hx0, hy0); g.lineTo(hx1, hy0); g.strokeStyle = 'rgba(255,233,196,.18)'; g.stroke();
    // lamp falloff over everything but the hole where the back wall shows through
    g.save(); g.beginPath(); g.rect(0, 0, W, H); g.rect(BX0, BY0, BX1 - BX0, BY1 - BY0); g.clip('evenodd');
    lampFalloff(g, 0, 0, W, H);
    const hd = g.createLinearGradient(0, 0, 0, 56);
    hd.addColorStop(0, 'rgba(0,0,0,.6)'); hd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = hd; g.fillRect(0, 0, W, 56);
    g.restore();
    // the gantry rail across the top front
    const ry0 = CARR_Y - 12, ry1 = CARR_Y + 1;
    const under = g.createLinearGradient(0, ry1, 0, ry1 + 12);
    under.addColorStop(0, 'rgba(0,0,0,.45)'); under.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = under; g.fillRect(0, ry1, W, 12);
    g.fillStyle = steel(g, 0, ry1, 0, ry0); g.fillRect(0, ry0, W, ry1 - ry0);
    g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, ry0 + 2.2, W, 1.2);
    g.fillStyle = 'rgba(255,255,255,.55)'; g.fillRect(0, ry0, W, .75);
  }
  // the chute front: a lithographed tin plate with a rolled chrome top edge
  function paintFront(g) {
    const w = CHUTE_IN, h = H - FP + 6;
    g.translate(0, 4);                                   // local y 0 = FP
    const base = g.createLinearGradient(0, 0, 0, h);
    base.addColorStop(0, '#26429a'); base.addColorStop(.3, '#1f3780'); base.addColorStop(1, '#0f1d4d');
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    const side = g.createLinearGradient(0, 0, w, 0);
    side.addColorStop(0, 'rgba(255,255,255,.1)'); side.addColorStop(.5, 'rgba(255,255,255,0)'); side.addColorStop(1, 'rgba(0,0,0,.3)');
    g.fillStyle = side; g.fillRect(0, 0, w, h);
    // printed: a paper rule inset from the edge and the word, with the ink keyline of the print
    g.strokeStyle = 'rgba(251,248,241,.8)'; g.lineWidth = 1.2; g.strokeRect(7.5, 12.5, w - 15, h - 30);
    g.font = '25px "Alfa Slab One", Rockwell, Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    if ('letterSpacing' in g) g.letterSpacing = '1.5px';
    g.lineJoin = 'round'; g.lineWidth = 2.4; g.strokeStyle = INK; g.strokeText('PRIZE', w / 2 + 1, 46);
    g.fillStyle = PAPER; g.fillText('PRIZE', w / 2 + 1, 46);
    if ('letterSpacing' in g) g.letterSpacing = '0px';
    g.fillStyle = 'rgba(251,248,241,.8)'; g.fillRect(20, 66, w - 40, 1.2);
    // halftone wear along the bottom
    g.fillStyle = 'rgba(0,0,0,.2)';
    for (let y = h - 60; y < h; y += 4) for (let x = (y / 4 % 2) * 2; x < w; x += 4) { const r = (y - h + 60) / 60 * 1.4; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
    // rolled lip of the opening
    g.fillStyle = steel(g, 0, 3, 0, -4); g.fillRect(0, -4, w, 7);
    g.fillStyle = 'rgba(255,255,255,.6)'; g.fillRect(0, -4, w, .75);
    g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, 3, w, 2);
  }
  // the front glass: one wide soft reflection band, the marquee lamp reflected at the top, dust and two
  // fingerprints that only show where the band catches them
  function paintGlass(g) {
    const w = W + 40, band = (gg, a) => {
      const gr = gg.createLinearGradient(w * .5, 0, w * .82, 0);
      gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(.5, `rgba(255,255,255,${a})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
      return gr;
    };
    g.save(); g.setTransform(CS, 0, 0, CS, 0, 0); g.transform(1, 0, -.42, 1, 0, 0); g.translate(H * .42 * .5, 0);
    g.fillStyle = band(g, .11); g.fillRect(0, 0, w + H, H);
    g.restore();
    const blob = g.createRadialGradient(w * .36, -10, 4, w * .36, -10, 150);
    blob.addColorStop(0, 'rgba(255,220,150,.22)'); blob.addColorStop(1, 'rgba(255,220,150,0)');
    g.fillStyle = blob; g.fillRect(0, 0, w, 170);
    const dust = layer(w, H, CS);
    for (let i = 0; i < 700; i++) {
      dust.g.fillStyle = `rgba(255,255,255,${.12 + Math.random() * .3})`;
      dust.g.beginPath(); dust.g.arc(Math.random() * w, Math.random() * H, .35 + Math.random() * .8, 0, TAU); dust.g.fill();
    }
    for (const [fx, fy] of [[w * .62, H * .38], [w * .7, H * .47], [w * .3, H * .8]]) {
      const sm = dust.g.createRadialGradient(fx, fy, 1, fx, fy, 16);
      sm.addColorStop(0, 'rgba(255,255,255,.1)'); sm.addColorStop(1, 'rgba(255,255,255,0)');
      dust.g.fillStyle = sm; dust.g.fillRect(fx - 16, fy - 16, 32, 32);
      dust.g.strokeStyle = 'rgba(255,255,255,.05)'; dust.g.lineWidth = .6;
      for (let r = 3; r < 13; r += 1.8) { dust.g.beginPath(); dust.g.ellipse(fx, fy, r, r * .78, .6, .3, TAU - .5); dust.g.stroke(); }
    }
    dust.g.globalCompositeOperation = 'destination-in';
    dust.g.setTransform(CS, 0, 0, CS, 0, 0); dust.g.transform(1, 0, -.42, 1, 0, 0); dust.g.translate(H * .42 * .5, 0);
    dust.g.fillStyle = band(dust.g, 1); dust.g.fillRect(0, 0, w + H, H);
    g.drawImage(dust.cv, 0, 0, w, H);
    g.fillStyle = 'rgba(255,255,255,.22)'; g.fillRect(20, 0, 1, H);
  }

  // ---------- drawing: per frame ----------
  function view(g, z, x, y) { g.translate(W / 2, H / 2); g.scale(z, z); g.translate(-x, -y); }
  // how much of the trolley lamp's cone reaches (x, y): 1 on the axis, 0 outside
  function coneAt(x, y) {
    const v = clamp((y - CARR_Y) / (FLOOR_Y - CARR_Y), 0, 1), half = 8 + v * 72;
    return clamp(1 - (Math.abs(x - c.x) - half * .55) / (half * .7), 0, 1);
  }
  function conePath(g, grow) {
    const t = CARR_Y + 14, b = FLOOR_Y + 30, ht = 8 + grow * .3, hb = 75 + grow;
    g.beginPath(); g.moveTo(c.x - ht, t); g.lineTo(c.x + ht, t); g.lineTo(c.x + hb, b); g.lineTo(c.x - hb, b); g.closePath();
  }
  // the pile and the claw seen again in the smoked mirror: smaller (farther), soft (a third of the
  // resolution, so it blurs), and only the backs of the labels
  function drawMirror(g) {
    const { cv, g: mg } = lay.mir, f = .87, mx = x => VP.x + (x - VP.x) * f, my = y => VP.y + (y - VP.y) * f;
    const LB = ART.LABELS || [];
    mg.setTransform(1, 0, 0, 1, 0, 0); mg.clearRect(0, 0, cv.width, cv.height); mg.setTransform(1 / 3, 0, 0, 1 / 3, 0, 0);
    for (const k of cans) {
      if (k.gone) continue;
      const b = k.body, L = LB[k.label] || {}, w = k.w * f, h = k.h * f;
      mg.save(); mg.translate(mx(b.position.x), my(b.position.y)); mg.rotate(b.angle);
      mg.fillStyle = L.bg || '#8f969e'; mg.fillRect(-w / 2, -h / 2, w, h);
      const cy = mg.createLinearGradient(-w / 2, 0, w / 2, 0);
      cy.addColorStop(0, 'rgba(0,0,0,.7)'); cy.addColorStop(.35, 'rgba(255,255,255,.12)'); cy.addColorStop(1, 'rgba(0,0,0,.8)');
      mg.fillStyle = cy; mg.fillRect(-w / 2, -h / 2, w, h);
      mg.fillStyle = 'rgba(190,196,202,.8)'; mg.fillRect(-w / 2, -h / 2, w, 3); mg.fillRect(-w / 2, h / 2 - 3, w, 3);
      mg.restore();
    }
    const { hx, hy } = pose();
    mg.fillStyle = '#9aa1a8'; mg.fillRect(mx(hx) - 18 * f, my(hy) - 9 * f, 36 * f, 18 * f);
    mg.fillRect(mx(c.x) - 1, my(CARR_Y), 2, my(hy) - my(CARR_Y));
    g.save(); g.beginPath(); g.rect(BX0, BY0, BX1 - BX0, BY1 - BY0); g.clip();
    g.globalAlpha = .26; g.drawImage(cv, 0, 0, W, H);
    g.globalAlpha = .05 * clamp(lamp, 0, 1); g.globalCompositeOperation = 'screen';
    const cg = g.createLinearGradient(0, my(CARR_Y), 0, my(FLOOR_Y));
    cg.addColorStop(0, '#ffe9c4'); cg.addColorStop(1, 'rgba(255,233,196,0)');
    g.fillStyle = cg; g.beginPath(); g.moveTo(mx(c.x) - 6, my(CARR_Y)); g.lineTo(mx(c.x) + 6, my(CARR_Y)); g.lineTo(mx(c.x) + 64, my(FLOOR_Y)); g.lineTo(mx(c.x) - 64, my(FLOOR_Y)); g.fill();
    g.globalAlpha = 1; g.globalCompositeOperation = 'multiply'; g.fillStyle = 'rgba(30,40,55,.35)'; g.fillRect(BX0, BY0, BX1 - BX0, BY1 - BY0);
    g.globalCompositeOperation = 'source-over';
    g.restore();
  }
  function clawShape(g, lw) {
    const { hx, hy, phi, a } = pose();
    g.lineCap = 'round'; g.lineWidth = lw;
    g.beginPath(); g.moveTo(c.x, CARR_Y + 6); g.lineTo(hx, hy); g.stroke();
    g.save(); g.translate(hx, hy); g.rotate(phi);
    g.fillRect(-21, -10, 42, 20);
    if (rider) { g.beginPath(); g.ellipse(0, -24, 13, 15, 0, 0, TAU); g.fill(); }
    for (const s of [-1, 1]) {
      g.save(); g.translate(s * PIV, 8); g.rotate(-s * a);
      g.lineWidth = 6; g.beginPath(); g.moveTo(0, 0); g.lineTo(s * 5, PL * .58); g.lineTo(0, PL); g.lineTo(-s * 12, PL - 1); g.stroke();
      g.restore();
    }
    g.restore();
  }
  function drawShadows(g) {
    const { cv, g: sg } = lay.sh;
    sg.setTransform(1, 0, 0, 1, 0, 0); sg.clearRect(0, 0, cv.width, cv.height); sg.setTransform(.25, 0, 0, .25, 0, 0);
    sg.fillStyle = '#000'; sg.strokeStyle = '#000';
    for (const k of cans) {
      if (k.gone) continue;
      const b = k.body; sg.save(); sg.translate(b.position.x, b.position.y); sg.rotate(b.angle); sg.fillRect(-k.w / 2, -k.h / 2, k.w, k.h); sg.restore();
    }
    clawShape(sg, 3);
    g.globalCompositeOperation = 'multiply'; g.globalAlpha = .42;
    g.drawImage(cv, SHX, SHY, W, H);
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    // contact shadow where a can stands on the floor
    for (const k of cans) {
      if (k.gone || k.leaving) continue;
      const b = k.body, e = extent(k, 0);
      if (b.position.y + e.y < FLOOR_Y - 4) continue;
      const rx = e.x * 1.3; g.drawImage(lay.ao.cv, b.position.x - rx + 2, FLOOR_Y - 3, rx * 2, 8);
    }
  }
  // the claw's own shadow straight down on the pile: wide and faint up high, tight and dark near contact
  function drawSpot(g) {
    const { hx, hy, a } = pose(), tip = hy + 8 + PL * Math.cos(a);
    let surf = FLOOR_Y;
    for (const k of cans) if (!k.gone && !k.leaving && !k.out && k !== c.held && Math.abs(k.body.position.x - hx) < k.w * .6) surf = Math.min(surf, k.body.position.y - extent(k, 0).y);
    const d = clamp(surf - tip, 0, 480), rx = 16 + d * .12, al = .42 * (1 - d / 480) * clamp(lamp, 0, 1);
    if (al < .02) return;
    g.globalAlpha = al; g.globalCompositeOperation = 'multiply';
    g.drawImage(lay.ao.cv, hx - rx, surf - rx * .22, rx * 2, rx * .5);
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  }
  function drawCanBody(g, k, zr) {
    const b = k.body, wob = k.ring > 0 ? Math.sin(k.ring * 70) * k.ring * .08 : 0;
    const cf = coneAt(b.position.x, b.position.y), lit = 1 - dark * (1 - cf) * .55;
    const o = { lit, rim: k === c.held ? zr : zr * cf * .7 };
    if (k.shift != null) o.labelShift = k.shift; else o.spin = k.spin;
    drawCan(g, k, b.position.x, b.position.y, b.angle + wob, k.w, k.h, o);
  }
  // pivot pin: a turned steel head sitting in its own little seat shadow
  function pin(g, x, y, r) {
    g.fillStyle = 'rgba(0,0,0,.4)'; g.beginPath(); g.arc(x + .5, y + .7, r + .4, 0, TAU); g.fill();
    const gr = g.createRadialGradient(x - r * .4, y - r * .45, r * .1, x, y, r);
    gr.addColorStop(0, '#ffffff'); gr.addColorStop(.4, '#b3bac0'); gr.addColorStop(1, '#40464c');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
  }
  function drawClaw(g) {
    const { hx, hy, phi, a } = pose();
    const top = { x: c.x + jigX(), y: CARR_Y + 6 }, bot = { x: hx + 12 * Math.sin(phi), y: hy - 12 * Math.cos(phi) };
    // cable: two braided strands; the lay of the braid runs with the cable as it pays out
    g.lineCap = 'butt'; g.strokeStyle = '#2d3136'; g.lineWidth = 2.6;
    g.beginPath(); g.moveTo(top.x, top.y); g.lineTo(bot.x, bot.y); g.stroke();
    if (g.setLineDash) {
      g.lineWidth = .9; g.setLineDash([1.6, 1.6]);
      g.strokeStyle = '#9da4aa'; g.lineDashOffset = -c.L; g.beginPath(); g.moveTo(top.x - .55, top.y); g.lineTo(bot.x - .55, bot.y); g.stroke();
      g.strokeStyle = '#5f666d'; g.lineDashOffset = -c.L + 1.6; g.beginPath(); g.moveTo(top.x + .55, top.y); g.lineTo(bot.x + .55, bot.y); g.stroke();
      g.setLineDash([]);
    }
    // prongs: tapered polished steel, lit from the lamp at the prong's own angle; rubber pads at the tips
    for (const s of [-1, 1]) {
      const wa = phi - s * a, l = rot(L2.x, L2.y, -wa);
      g.save(); g.translate(hx, hy); g.rotate(phi); g.translate(s * PIV, 8); g.rotate(-s * a);
      const P = [[0, -2], [s * 5, PL * .58], [0, PL - 3]], hw = [3.7, 3, 2.3];
      const N = P.map((p, i) => {
        const q0 = P[Math.max(0, i - 1)], q1 = P[Math.min(2, i + 1)], dx = q1[0] - q0[0], dy = q1[1] - q0[1], n = Math.hypot(dx, dy);
        return [-dy / n, dx / n];
      });
      g.beginPath();
      P.forEach((p, i) => (i ? g.lineTo : g.moveTo).call(g, p[0] + N[i][0] * hw[i], p[1] + N[i][1] * hw[i]));
      for (let i = 2; i >= 0; i--) g.lineTo(P[i][0] - N[i][0] * hw[i], P[i][1] - N[i][1] * hw[i]);
      g.closePath(); g.fillStyle = steel(g, -5, 0, 5, 0, l.x, l.y); g.fill();
      // specular on the lamp-facing edge
      const sd = l.x < 0 ? 1 : -1;
      g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = .75; g.beginPath();
      P.forEach((p, i) => (i ? g.lineTo : g.moveTo).call(g, p[0] + N[i][0] * hw[i] * sd * .8, p[1] + N[i][1] * hw[i] * sd * .8));
      g.stroke();
      // the hooked foot
      g.beginPath(); g.moveTo(1.8 * s, PL - 5.5); g.lineTo(-s * 11, PL - 3.5); g.lineTo(-s * 11, PL + 1.2); g.lineTo(1.8 * s, PL + 1.5); g.closePath();
      g.fillStyle = steel(g, 0, PL + 1.5, 0, PL - 5.5, l.x, l.y); g.fill();
      const pad = g.createRadialGradient(-s * 11 - .8, PL - 2.8, .3, -s * 11, PL - 1.2, 3.6);
      pad.addColorStop(0, '#9a2b21'); pad.addColorStop(1, '#3b0d0a');
      g.fillStyle = pad; g.beginPath(); g.arc(-s * 11, PL - 1.2, 3.3, 0, TAU); g.fill();
      g.restore();
    }
    // hub: a turned steel housing with a split line and the two pivot pins
    g.save(); g.translate(hx, hy); g.rotate(phi);
    const l = rot(L2.x, L2.y, -phi);
    g.fillStyle = steel(g, 0, 10, 0, -10, l.x, l.y); rrect(g, -5, -15, 10, 6, 1.5); g.fill();
    rrect(g, -21, -10, 42, 20, 5); g.fillStyle = steel(g, 0, 10, 0, -10, l.x, l.y); g.fill();
    const hs = g.createLinearGradient(-21, 0, 21, 0);
    hs.addColorStop(0, `rgba(255,255,255,${l.x < 0 ? .16 : 0})`); hs.addColorStop(.5, 'rgba(0,0,0,0)'); hs.addColorStop(1, `rgba(0,0,0,${l.x < 0 ? .3 : .1})`);
    g.fillStyle = hs; rrect(g, -21, -10, 42, 20, 5); g.fill();
    g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(-20, 1, 40, 1);
    g.fillStyle = 'rgba(255,255,255,.28)'; g.fillRect(-20, 2, 40, .75);
    g.fillStyle = 'rgba(255,255,255,.65)'; g.fillRect(-16, -9.6, 32, .75);
    pin(g, -PIV, 8, 3); pin(g, PIV, 8, 3);
    g.restore();
  }
  function riderPose() {
    const m = c.mode, held = !!c.held;
    if (!live) return ['focus', 0];
    if (m === 'aim') return ['focus', .3];
    if (m === 'seek') return ['focus', c.plan[0] && c.plan[0].arrived ? .75 : c.sub === 'lock' ? .9 : .3];
    if (m === 'lower') return ['focus', 1];
    if (m === 'close' || m === 'pause') return ['worry', 1];
    if (m === 'top' && held && c.jolt > 5) return ['worry', 1];
    if (m === 'raise' || m === 'top' || m === 'carry') return held ? ['cheer', .4] : ['sad', .8];
    if (m === 'release') return ['cheer', 1];
    if (m === 'check') return pick ? ['cheer', 1] : ['sad', 1];
    if (m === 'reveal') return ['cheer', .2];
    return ['focus', 0];
  }
  function drawRider(g) {
    const A = rider && window.ANIMALS && window.ANIMALS[rider.key];
    if (!A || typeof A.draw !== 'function') return;
    const { hx, hy, phi } = pose(), [emotion, look] = riderPose();
    g.save(); g.translate(hx, hy); g.rotate(phi); g.translate(0, -10);
    try { A.draw(g, { t: clock, mode: 'ride', emotion, look, bib: rider.bib || null, scale: .42 }); } catch (e) { rider.bad = (rider.bad || 0) + 1; if (rider.bad > 3) rider = null; }
    g.restore();
  }
  const jigX = () => (jig > 0 ? Math.sin(clock * 90) * 2.2 * (jig / .15) : 0);
  function drawCarriage(g) {
    const x = c.x + jigX(), y = CARR_Y;
    // wheels riding the rail; their spokes turn with the travel
    for (const s of [-1, 1]) {
      const wx = x + s * 17, wy = y - 17;
      const wg = g.createRadialGradient(wx - 1.8, wy - 2, .5, wx, wy, 5.2);
      wg.addColorStop(0, '#d9dee2'); wg.addColorStop(.6, '#6b737a'); wg.addColorStop(1, '#2a2e33');
      g.fillStyle = wg; g.beginPath(); g.arc(wx, wy, 5, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(20,22,26,.8)'; g.lineWidth = .9; const r0 = c.x / 5;
      for (let i = 0; i < 3; i++) { const an = r0 + i * TAU / 3; g.beginPath(); g.moveTo(wx, wy); g.lineTo(wx + Math.cos(an) * 4, wy + Math.sin(an) * 4); g.stroke(); }
    }
    // body: enamelled dark steel with a printed tomato stripe
    rrect(g, x - 26, y - 14, 52, 20, 3);
    const bg = g.createLinearGradient(0, y - 14, 0, y + 6);
    bg.addColorStop(0, '#4a4f56'); bg.addColorStop(.3, '#2c3035'); bg.addColorStop(1, '#17191c');
    g.fillStyle = bg; g.fill();
    const bs = g.createLinearGradient(x - 26, 0, x + 26, 0);
    bs.addColorStop(0, 'rgba(255,255,255,.1)'); bs.addColorStop(1, 'rgba(0,0,0,.3)');
    g.fillStyle = bs; rrect(g, x - 26, y - 14, 52, 20, 3); g.fill();
    g.fillStyle = TOMATO; g.fillRect(x - 26, y - 5, 52, 3);
    g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(x - 26, y - 2, 52, .8);
    g.fillStyle = 'rgba(255,255,255,.45)'; g.fillRect(x - 23, y - 14, 46, .75);
    // lamp socket
    g.fillStyle = steel(g, x - 4, 0, x + 4, 0); g.fillRect(x - 4, y + 6, 8, 3.5);
  }
  function drawBulb(g) {
    const x = c.x + jigX(), y = CARR_Y + 13.5, on = clamp(lamp, 0, 1.4);
    const halo = g.createRadialGradient(x, y, 1, x, y, 18);
    halo.addColorStop(0, `rgba(255,233,196,${.55 * on})`); halo.addColorStop(1, 'rgba(255,233,196,0)');
    g.globalCompositeOperation = 'screen'; g.fillStyle = halo; g.fillRect(x - 18, y - 18, 36, 36); g.globalCompositeOperation = 'source-over';
    const bl = g.createRadialGradient(x - 1.2, y - 1.4, .4, x, y, 4.6);
    bl.addColorStop(0, '#fffdf5'); bl.addColorStop(.5, `rgb(255,${Math.round(214 + 20 * Math.min(1, on))},150)`); bl.addColorStop(1, '#c9913d');
    g.fillStyle = bl; g.beginPath(); g.arc(x, y, 4.4, 0, TAU); g.fill();
    // wire cage
    g.strokeStyle = 'rgba(40,43,48,.9)'; g.lineWidth = .7;
    g.beginPath(); g.ellipse(x, y, 5.6, 5.6, 0, Math.PI * .95, Math.PI * 2.05); g.stroke();
    for (const s of [-.45, 0, .45]) { g.beginPath(); g.moveTo(x + s * 6, y - 4.5); g.quadraticCurveTo(x + s * 11, y + 3, x + s * 2, y + 6.4); g.stroke(); }
  }
  // the trolley lamp: everything outside its cone goes dark, the cone itself carries a little warm haze
  function drawLight(g) {
    const { cv: ccv, g: cg } = lay.cone, { cv: dcv, g: dg } = lay.dk;
    cg.setTransform(1, 0, 0, 1, 0, 0); cg.clearRect(0, 0, ccv.width, ccv.height); cg.setTransform(.25, 0, 0, .25, 0, 0);
    const vg = cg.createLinearGradient(0, CARR_Y, 0, FLOOR_Y + 30);
    const on = clamp(lamp, 0, 1);
    vg.addColorStop(0, `rgba(255,233,196,${on})`); vg.addColorStop(1, `rgba(255,233,196,${.72 * on})`);
    cg.fillStyle = vg;
    for (const [grow, al] of [[36, .3], [18, .45], [0, 1]]) { cg.globalAlpha = al; conePath(cg, grow); cg.fill(); }
    cg.globalAlpha = 1;
    const dd = clamp(dark, 0, .92);
    dg.setTransform(1, 0, 0, 1, 0, 0); dg.globalCompositeOperation = 'source-over'; dg.clearRect(0, 0, dcv.width, dcv.height);
    dg.fillStyle = `rgba(9,7,11,${dd})`; dg.fillRect(0, 0, dcv.width, dcv.height);
    dg.globalCompositeOperation = 'destination-out'; dg.drawImage(ccv, 0, 0);
    dg.globalCompositeOperation = 'source-over';
    g.drawImage(dcv, 0, 0, W, H);
    g.globalCompositeOperation = 'screen'; g.globalAlpha = .1 + dd * .12;
    g.drawImage(ccv, 0, 0, W, H);
    // dust hanging in the beam
    g.globalAlpha = 1; g.fillStyle = '#fff4de';
    for (const p of motes) {
      const x = p.x + Math.sin(clock * .21 * p.s + p.p) * 9, y = p.y + Math.sin(clock * .13 * p.s + p.p * 2) * 7;
      const k = coneAt(x, y) * on;
      if (k < .05) continue;
      g.globalAlpha = k * (.28 + .22 * Math.sin(clock * 1.7 * p.s + p.p)); g.beginPath(); g.arc(x, y, p.r, 0, TAU); g.fill();
    }
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  }
  function drawSparks(g) {
    if (!puffs.length) return;
    g.globalCompositeOperation = 'lighter'; g.lineCap = 'round'; g.lineWidth = 1.1 / cam.z; g.strokeStyle = '#fff6e6';
    for (const p of puffs) {
      g.globalAlpha = clamp(p.life / .15, 0, 1);
      g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - p.vx * .02, p.y - p.vy * .02); g.stroke();
    }
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  }
  function drawChuteGlow(g) {
    if (!c.held || (c.mode !== 'carry' && c.mode !== 'release')) return;
    const k = clamp(1 - Math.abs(c.x - HOME_X) / 220, 0, 1) * .3;
    if (k < .01) return;
    const r = g.createRadialGradient(HOME_X, CHUTE_TOP, 2, HOME_X, CHUTE_TOP, 80);
    r.addColorStop(0, `rgba(255,214,120,${k})`); r.addColorStop(1, 'rgba(255,214,120,0)');
    g.globalCompositeOperation = 'screen'; g.fillStyle = r; g.fillRect(HOME_X - 80, CHUTE_TOP - 80, 160, 160); g.globalCompositeOperation = 'source-over';
  }

  function draw() {
    if (!lay) buildLayers();
    const g = ctx;
    g.setTransform(S, 0, 0, S, 0, 0);
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    g.fillStyle = '#0e0d10'; g.fillRect(0, 0, W, H);
    const shk = shake > .3 && !calm(), sx = shk ? (Math.random() - .5) * shake : 0, sy = shk ? (Math.random() - .5) * shake : 0;
    const zf = 1 + (cam.z - 1) * .6, zr = clamp((cam.z - 1.35) / 1.2, 0, 1);
    // far: the mirrored back wall moves less than the room
    g.save(); g.translate(sx * .3, sy * .3); view(g, zf, cam.x, cam.y);
    g.drawImage(lay.far.cv, -M, -M, W + 2 * M, H + 2 * M);
    drawMirror(g);
    g.restore();
    // the room and everything in it
    g.save(); g.translate(sx, sy); view(g, cam.z, cam.x, cam.y);
    g.drawImage(lay.box.cv, 0, 0, W, H);
    drawShadows(g);
    for (const k of cans) if (!k.gone && !k.leaving && k !== c.held) drawCanBody(g, k, zr);
    for (const k of cans) if (!k.gone && k.leaving) drawCanBody(g, k, 0);
    drawSpot(g);
    g.drawImage(lay.front.cv, 0, FP - 4, CHUTE_IN, H - FP + 6);
    if (c.held) drawCanBody(g, c.held, zr);
    drawClaw(g);
    drawRider(g);
    drawCarriage(g);
    drawLight(g);
    drawChuteGlow(g);
    drawBulb(g);
    drawSparks(g);
    g.restore();
    // the front glass stays put while the room moves behind it
    g.globalCompositeOperation = 'multiply'; g.fillStyle = 'rgba(70,110,100,.07)'; g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'screen'; g.globalAlpha = .75 + dark * .5;
    g.drawImage(lay.glass.cv, -20 - (cam.x - W / 2) * .05 * cam.z, 0, W + 40, H);
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  }

  // backing store follows the size the canvas is shown at, so close-ups stay sharp
  function sizeCanvas() {
    const dpr = Math.min(2.5, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
    let cssW = W;
    try { const r = canvas.getBoundingClientRect(); if (r && r.width > 20) cssW = r.width; } catch (e) { /* not in a page */ }
    const s = clamp(Math.round(cssW / W * dpr * 4) / 4, 1, 3);
    if (s !== S) {
      S = s; canvas.width = Math.round(W * S); canvas.height = Math.round(H * S);
      const cs = Math.min(4, S * 1.5);
      if (!lay || Math.abs(cs - CS) / CS > .2) { CS = cs; lay = null; }
    }
    visible = !(typeof canvas.getClientRects === 'function' && canvas.getClientRects().length === 0);
  }

  function frame(simDt, realDt) {
    if (realDt == null) realDt = simDt;
    const rdt = clamp(realDt, 0, .05);
    clock += rdt;
    if ((vis -= rdt) <= 0) { vis = .5; sizeCanvas(); }
    moveCamera(rdt);
    if (absentSlow > 0) absentSlow -= rdt;
    if (c.benchT > 0) c.benchT -= rdt;
    acc += clamp(simDt, 0, .05) * cam.slow;
    while (acc >= STEP) {
      stepClaw(STEP); placeClaw();
      Engine.update(engine, STEP * 1000);
      postStep(STEP);
      acc -= STEP;
    }
    if (pick && pickT > 0) { pickT -= rdt; if (pickT <= 0 && c.mode !== 'reveal') doReveal(); }
    shake = Math.max(0, shake - rdt * 28); rev = Math.max(0, rev - rdt); jig = Math.max(0, jig - rdt);
    for (const p of puffs) { p.vy += 900 * rdt; p.x += p.vx * rdt; p.y += p.vy * rdt; p.life -= rdt; }
    puffs = puffs.filter(p => p.life > 0);
    // motor: the gantry hums with speed, the winch groans; it cuts out while the crane holds its breath
    const m = c.mode, winch = m === 'lower' || m === 'raise';
    const hush = m === 'top' || (m === 'seek' && (c.sub === 'lock' || (c.plan[0] && c.plan[0].arrived)));
    let lv = winch ? .8 : Math.abs(c.vx) / VMAX, pt = winch ? (m === 'raise' ? 1.5 : 1.2) : .5 + Math.abs(c.vx) / VMAX * .5;
    if (hush) lv = 0;
    if (rev > 0) { lv = .9; pt = [0, 1.3, 1, .8][c.count] || 1; }
    fire('motor', lv, pt * cam.slow);
    if (visible) draw();
  }

  sizeCanvas();
  placeClaw();
  return {
    attract(names) { live = false; letGo(); c.auto = null; c.plan = []; c.name = null; c.target = null; setMode('off'); fill(names, false); },
    // copies: identical cans per student, the same count for everyone, so the odds stay equal
    play(names, label, copies = 1) {
      live = true; letGo(); c.auto = null; c.plan = []; c.name = null; c.target = null;
      fill(names.flatMap(n => Array(Math.max(1, copies | 0)).fill(n)), true); setMode('load'); c.timer = COUNTDOWN;
    },
    resume() { pick = null; pickT = 0; letGo(); c.auto = null; c.plan = []; c.name = null; c.target = null; c.count = 0; setMode('aim'); c.timer = COUNTDOWN; },
    go() { if (c.mode === 'aim') c.timer = 0; },
    removeStudent,
    restoreStudent,
    students() { return new Set(inPlay().map(k => k.name)).size; },
    cansLeft() { return inPlay().length; },
    setHard(v) { hard = !!v; },
    setRider(key, bib) { rider = key ? { key, bib: bib || null } : null; },
    kick(n) { shake = Math.max(shake, n); },
    frame,
    get mode() { return c.mode; },
    get timer() { return c.timer; },
    get drama() { return drama; },
    get wantSlow() { return cam.slow; },
    get focus() { return { x: cam.x / W, y: cam.y / H, z: cam.z }; },
  };
};
