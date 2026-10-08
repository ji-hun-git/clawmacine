// The crane. Cans are Matter.js rigid bodies (they stack, topple and clank). The claw hangs from its
// trolley on a cable and swings as a driven pendulum; its two prongs are kinematic bodies that shove cans
// aside, and a gripped can hangs on a soft spring. Nobody steers: a short countdown runs while the cans
// settle, the crane draws a NAME (every name in the machine has the same chance), plays with one or two
// other cans (a tease, a swat that knocks one flying, or a grab it lifts and drops), then goes for the drawn
// student's most reachable can. A miss or a slip retries the same name, so staging and physics never change
// who gets picked. Inside the machine every can wears a "?" label: the name is shown only on the reveal.
// The first pick of each group waits for START; the countdown runs after it. SKIP ends a pick on the spot:
// the name already drawn (or drawn then, the same way) gets one of its cans, so the odds stay the same.
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
  const smooth = x => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
  let anon = true;                                // the names stay hidden on the cans in the machine

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
    push: 0, benchT: 0, slips: 0, armed: false, fake: null };
  let cans = [], pick = null, pickT = 0, live = false, hard = false, rider = null, acc = 0, clock = 0;
  let shake = 0, puffs = [], rev = 0, jig = 0, absentSlow = 0, lamp = .6, dark = .1, drama = 0, quiet = 0, unseen = false;
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
      spin: (1 + (Math.random() - .5) * .12) % 1, shift: null, turnW: 0, ...canStyle(name),
      anonLabel: Math.random() * ART.LABELS.length | 0, anonCan: null };
    body.plugin.can = can;
    return can;
  }
  // the face a can shows inside the machine: a question mark on a label that says nothing about whose it is
  const anonOf = k => k.anonCan || (k.anonCan = { name: '?', label: k.anonLabel, lot: '??', copy: k.copy, body: k.body });
  const setClawCollide = (can, on) => { can.body.collisionFilter.mask = on ? MASK_ALL : MASK_NOCLAW; };
  function clearCans() { dropFake(); for (const k of cans) if (!k.gone) Composite.remove(world, k.body); cans = []; }
  function fill(names, pour) {
    clearCans(); pick = null; pickT = 0; quiet = 0;
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
  function hubLimit(k, pool, ax) {
    let lim = FLOOR_Y - 58;
    for (const o of pool) {
      if (o === k) continue;
      const oe = extent(o, 0), oTop = o.body.position.y - oe.y, dc = Math.abs(o.body.position.x - ax), u0 = dc - oe.x, u1 = dc + oe.x;
      if (u0 < 21) lim = Math.min(lim, oTop - 10);                                           // the hub lands on it
      if (u0 < 54 && u1 > 15) lim = Math.min(lim, oTop - (8 + (Math.min(u1, 52) - 15) * 1.135) + 2); // a prong lands on it
    }
    return lim;
  }
  function reach(k, pool, off = 0) {
    const p = k.body.position, e = extent(k, 0), top = p.y - e.y, ax = p.x + off;
    const need = top + .45 * e.y - 72;
    const lim = hubLimit(k, pool, ax);
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
  const namesIn = () => [...new Set(inPlay().map(k => k.name))];
  function drawName(names) { c.name = names[Math.random() * names.length | 0]; c.tries = 0; c.slips = 0; }
  function startPick(retry) {
    const names = namesIn();
    if (!names.length) { c.name = null; setMode('reveal'); return; }
    for (const k of cans) k.fromClaw = false;
    if (!retry || !c.name || !names.includes(c.name)) drawName(names);
    else c.tries++;
    c.target = bestCan(c.name); c.plan = []; c.slipped = false; dropFake();
    if (!retry && names.length > 1) {
      // theatre only, the name is already drawn: a tease, a swat that knocks a can flying, or a grab that
      // lifts someone else's can and lets it fall
      const legs = Math.random() < .45 ? 2 : 1, used = new Set();
      for (let i = 0; i < legs; i++) {
        let d = null;
        for (let tries = 0; tries < 5 && (!d || used.has(d)); tries++) d = decoyFor(c.target);
        if (!d || used.has(d)) break;
        used.add(d);
        const r = Math.random(), kind = calm() ? 'tease' : r < .4 ? 'slap' : r < .75 ? 'fake' : 'tease';
        const hold = kind === 'slap' ? 1.25 : kind === 'fake' ? 2.3 : .7 + Math.random() * .2;
        c.plan.push({ can: d, x: d.body.position.x, hold, kind, arrived: false, done: false, loose: false });
      }
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
  // ---------- the show before the pick ----------
  function startLeg(leg) {
    const k = leg.can, e = extent(k, 0), top = k.body.position.y - e.y, pool = cans.filter(inPile);
    const lim = hubLimit(k, pool, leg.x) - CARR_Y;
    leg.dir = Math.sign(k.body.position.x - (c.target ? c.target.body.position.x : W / 2)) || (k.body.position.x < W * .55 ? 1 : -1);
    if (leg.kind === 'slap') leg.L = clamp(Math.min(lim, top - 60 - CARR_Y), L_REST, L_MAX * .85);
    else if (leg.kind === 'fake') {
      leg.L = clamp(Math.min(lim, top + .45 * e.y - 66 - CARR_Y), L_REST, L_MAX * .9);
      leg.Lup = Math.max(L_REST, leg.L - 92);
      const need = Math.asin(clamp((e.x + 1 - PIV) / PL, 0, 1));
      leg.stop = clamp((need - .1) / .62, 0, 1);
      setClawCollide(k, false);                     // the prongs close round it instead of knocking it away
    }
    trace('leg', { kind: leg.kind, th: c.th, cx: c.x, lx: leg.x, kx: k.body.position.x });
    beat(leg.kind === 'tease' ? 'tease' : 'dip'); sfx('clack');
  }
  function endLeg() {
    const leg = c.plan.shift();
    if (leg && leg.kind === 'fake') { dropFake(); if (!leg.can.gone) leg.can.ghost = Math.max(leg.can.ghost, .45); }
    c.sub = c.plan.length ? 'wander' : 'approach'; c.age = 0; beat('leave');
    c.target = bestCan(c.name);                   // re-pick the drawn name's most reachable can
  }
  // a swat: down to the can's top, a swing that knocks it across the pile, back up
  function slapLeg(leg, u) {
    const down = u < .3 ? smooth(u / .3) : u < .42 ? 1 : 1 - smooth((u - .42) / .58);
    c.L = L_REST + (leg.L - L_REST) * down; cable();
    c.open = .25 + down * .35;
    if (!leg.wound && u > .2) { leg.wound = true; c.w -= leg.dir * .35; }
    if (!leg.done && u > .3) {
      leg.done = true; leg.loose = true;
      const k = leg.can, b = k.body, { hx, hy, a } = pose();
      c.w += leg.dir * .8;
      Body.setVelocity(b, { x: leg.dir * (4 + Math.random() * 3), y: -(5 + Math.random() * 3) });
      Body.setAngularVelocity(b, leg.dir * (.18 + Math.random() * .16));
      k.ring = .5; shake = Math.max(shake, 7); lamp = 1.35; jig = .25;
      spark(hx + leg.dir * PL * Math.sin(a), hy + 8 + PL * Math.cos(a), 10);
      sfx('clank', 10); sfx('gasp'); beat('slap');
    }
  }
  // a fake: closes round someone else's can, lifts it, shakes it loose and lets it fall
  function fakeLeg(leg, u) {
    const k = leg.can;
    if (u < .3) { c.L = L_REST + (leg.L - L_REST) * smooth(u / .3); c.open += (.95 - c.open) * .12; }
    else if (u < .42) {
      c.L = leg.L; c.open = .95 - (.95 - leg.stop) * smooth((u - .3) / .12);
      if (!leg.done && u > .4) {
        leg.done = true;
        const { hx, hy, phi } = pose(), e = extent(k, phi), o = rot(0, 10 + e.y, phi), A = { x: hx + o.x, y: hy + o.y };
        const gap = Math.hypot(k.body.position.x - A.x, k.body.position.y - A.y);
        trace('fake', { gap, L: leg.L, ey: e.y, dx: k.body.position.x - hx, th: c.th, cx: c.x, lx: leg.x, kx: k.body.position.x });
        if (gap < 60) {
          c.fake = { k, ey: e.y, con: Constraint.create({ pointA: A, bodyB: k.body, pointB: { x: 0, y: 0 }, length: 0, stiffness: .2, damping: .08 }) };
          Composite.add(world, c.fake.con);
          sfx('clunk'); beat('grip');
        } else beat('empty');
      }
    } else if (u < .7) { c.L = leg.L + (leg.Lup - leg.L) * smooth((u - .42) / .26); c.open = leg.stop; }
    else {
      if (!leg.loose) {
        leg.loose = true;
        const held = !!c.fake; dropFake();
        c.w += (Math.random() < .5 ? -1 : 1) * 1.1; c.open = .75; shake = Math.max(shake, held ? 4 : 2);
        if (held) { k.ring = .4; sfx('clank', 6); sfx('gasp'); beat('fumble'); }
      }
      c.L = leg.Lup + (L_REST - leg.Lup) * smooth((u - .7) / .3);
      c.open += (.3 - c.open) * .06;
    }
    cable();
    if (c.fake) {
      const { hx, hy, phi } = pose(), o = rot(0, 10 + c.fake.ey, phi);
      c.fake.con.pointA = { x: hx + o.x, y: hy + o.y };
    }
  }
  function dropFake() {
    if (!c.fake) return;
    Composite.remove(world, c.fake.con);
    c.fake.k.ghost = Math.max(c.fake.k.ghost, .45);
    c.fake = null;
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
    const hold = m === 'seek' && (c.sub === 'lock' || (c.plan[0] && c.plan[0].arrived && !c.plan[0].loose));
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
        if (!c.armed) break;
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
        if (c.L > L_REST + .5 && !(leg && leg.arrived)) {
          // a show leg cut short: wind the claw back up before the trolley moves on
          c.L = Math.max(L_REST, c.L - VRAISE * dt); cable(); c.auto = c.x; relax(.2); break;
        }
        if (leg) {
          if (leg.kind === 'tease' || !leg.started) relax(.2);
          if (leg.can.gone || leg.can.leaving || leg.can.out) { endLeg(); break; }
          if (!leg.arrived) leg.x = leg.can.body.position.x;
          c.auto = clamp(leg.x, SEEK_X0, X_MAX);
          if (!leg.arrived) {
            if (Math.abs(c.auto - c.x) < 3 && Math.abs(c.vx) < 30) { leg.arrived = true; c.t = 0; if (leg.kind === 'tease') { leg.started = true; startLeg(leg); } }
          } else if (!leg.started) {
            // the claw stops swinging before it goes down
            c.t += dt;
            if ((Math.abs(c.th) < .08 && Math.abs(c.w) < .5) || c.t > .6) { leg.started = true; c.t = 0; startLeg(leg); }
          } else {
            c.t += dt;
            const u = c.t / leg.hold;
            if (leg.kind === 'slap') slapLeg(leg, u);
            else if (leg.kind === 'fake') fakeLeg(leg, u);
            else {
              // the tease: stop over someone else's can, lamp steady, prongs flex as if about to drop
              const f = clamp((c.t - leg.hold * .35) / .3, 0, 1);
              c.open = .2 + Math.sin(f * Math.PI) * .2;
            }
            if (c.t > leg.hold) endLeg();
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
  // SKIP: straight to the reveal. FAIR: a name already drawn keeps it (staging never changes who is picked);
  // before the draw, the name is drawn now with startPick's own draw over the same names
  const SKIPPABLE = new Set(['load', 'aim', 'seek', 'lower', 'close', 'pause', 'raise', 'top', 'carry', 'release', 'check']);
  // a START wait is skipped only once it has been on screen, so a skip chain that loads the next group stops at its START
  const skippable = () => live && c.mode !== 'reveal' && !(unseen && !c.armed) && (pick ? pickT > 0 : SKIPPABLE.has(c.mode) && inPlay().length > 0);
  function skip() {
    if (!skippable()) return false;
    letGo(); dropFake();
    if (!pick) {
      const names = namesIn();
      if (!c.name || !names.includes(c.name)) drawName(names);
      const mine = k => k && cans.includes(k) && !k.gone && !k.leaving && !k.out && k.name === c.name;
      const k = [c.dropped, c.target].find(mine) || bestCan(c.name);
      if (anon) anonOf(k);
      pick = k; k.out = true; k.fromClaw = true; Composite.remove(world, k.body); k.gone = true;
      trace('skip', { name: k.name, mode: c.mode }); beat('fall');
    }
    pickT = 0;
    // the pile keeps its cans where they lie; the claw goes home, up and open, and the box falls quiet
    for (const k of cans) if (!k.gone && !k.leaving && !k.out) { k.fromClaw = false; if (k.body.collisionFilter.mask !== MASK_ALL) k.ghost = Math.max(k.ghost, .1); }
    c.x = HOME_X; c.vx = 0; c.L = c.Lprev = c.ratchet = L_REST; c.th = 0; c.w = 0; c.open = .2; c.jolt = 0; c.contact = 0; c.push = 0;
    c.auto = null; c.cand = null; c.target = null; c.plan = []; c.sub = ''; c.slipped = false; c.timer = 0; c.count = 0; c.armed = true;
    placeClaw();
    shake = rev = jig = absentSlow = c.benchT = 0; puffs = []; quiet = .5;
    setMode('reveal'); moveCamera(30); fire('motor', 0, .5);
    doReveal();
    return true;
  }
  // an absent student's other cans jump up and out of the machine and wait on the bench
  function removeStudent(name) {
    let n = 0;
    for (const k of cans) {
      if (k.gone || k.leaving || k.out || k.name !== name) continue;
      if (c.held === k) letGo();
      if (c.fake && c.fake.k === k) dropFake();
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
      if (v < 1.4 || quiet > 0) continue;
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
    // the gantry: two round steel rods across the top front, the far one higher (seen a little from above),
    // each with its own soft shade below it and falling off to the right, away from the marquee lamp
    for (const [ry, rr, k] of [[RAIL_B, 2.3, .72], [RAIL_F, 3, .95]]) {
      const sh = g.createLinearGradient(0, ry, 0, ry + rr + 8);
      sh.addColorStop(0, 'rgba(0,0,0,.55)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = sh; g.fillRect(0, ry, W, rr + 8);
      g.fillStyle = barGrad(g, 0, ry - rr, 0, ry + rr, Math.PI / 2, CHROME, k); g.fillRect(0, ry - rr, W, 2 * rr);
      const fo = g.createLinearGradient(0, 0, W, 0);
      fo.addColorStop(0, 'rgba(0,0,0,0)'); fo.addColorStop(.5, 'rgba(0,0,0,.12)'); fo.addColorStop(1, 'rgba(0,0,0,.42)');
      g.fillStyle = fo; g.fillRect(0, ry - rr, W, 2 * rr);
    }
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
      const b = k.body, L = LB[anon ? k.anonLabel : k.label] || {}, w = k.w * f, h = k.h * f;
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
    g.lineCap = 'round'; g.lineJoin = 'round'; g.lineWidth = lw;
    g.beginPath(); g.moveTo(c.x, CARR_Y + 6); g.lineTo(hx, hy); g.stroke();
    g.fillRect(c.x - TR.hw, TR.y0 - 3, 2 * TR.hw, TR.y1 - TR.y0 + 3);              // the trolley and its shade
    g.beginPath(); g.ellipse(c.x, SHADE.y1 - 1, SHADE.r1, 4, 0, 0, TAU); g.fill();
    g.save(); g.translate(hx, hy); g.rotate(phi);
    g.beginPath(); g.ellipse(0, HUB.top, HUB.rTop, HUB.rTop * CE, 0, 0, TAU); g.fill();
    g.fillRect(-HUB.rDrum, HUB.top, 2 * HUB.rDrum, HUB.fl - HUB.top);
    g.beginPath(); g.ellipse(0, HUB.flB - 1, HUB.rFl, HUB.rFl * CE + 1.8, 0, 0, TAU); g.fill();
    g.fillRect(-HUB.rBody, HUB.flB, 2 * HUB.rBody, HUB.nutB - HUB.flB);
    if (rider) { g.beginPath(); g.ellipse(0, -24, 13, 15, 0, 0, TAU); g.fill(); }
    g.lineWidth = 6;
    for (const s of [-1, 1]) {
      const F = FINGER[s];
      g.save(); g.translate(s * PIV, 8); g.rotate(-s * a);
      g.beginPath(); for (const p of F.up) g.lineTo(p.x, p.y); for (const p of F.lo) g.lineTo(p.x, p.y); g.stroke();
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
    const cf = coneAt(b.position.x, b.position.y), lit = 1 - dark * (1 - cf) * .3;
    const o = { lit, rim: k === c.held ? zr : zr * cf * .7 };
    if (k.shift != null) o.labelShift = k.shift; else o.spin = k.spin;
    drawCan(g, anon ? anonOf(k) : k, b.position.x, b.position.y, b.angle + wob, k.w, k.h, o);
  }
  // ---------- drawing: the claw assembly ----------
  // Modelled the way the roulette's turret is: the one lamp (ART.LIGHT) on every part, round parts seen a
  // little from above (a top face is an ellipse CE of its width deep, as on the cans), polished chrome that
  // mirrors the room (a hard lamp stripe on the side toward the lamp, a dark band where it sees the unlit box,
  // a warm bounce from the pile on edges that face down), soft contact shadows, and no outlines.
  const CE = .24;
  const LAMPK = [1, .914, .769], ROOMK = [.52, .56, .66];
  const bell = (d, w) => Math.exp(-(d * d) / (w * w));
  const rgbs = (c, k = 1, up = 0) => `rgb(${Math.min(255, c[0] * k + up) | 0},${Math.min(255, c[1] * k + up) | 0},${Math.min(255, c[2] * k + up) | 0})`;
  const HV = (() => { const v = [LV.x, LV.y - CE, LV.z + Math.sqrt(1 - CE * CE)], n = Math.hypot(v[0], v[1], v[2]); return v.map(q => q / n); })();
  // a lit face with normal n (x right, y down, z toward the viewer); m = [ambient, diffuse, specular, its power]
  function litFace(alb, n, m) {
    const d = Math.max(0, n[0] * LV.x + n[1] * LV.y + n[2] * LV.z), h = Math.max(0, n[0] * HV[0] + n[1] * HV[1] + n[2] * HV[2]);
    const s = m[2] * Math.pow(h, m[3]);
    return [0, 1, 2].map(i => Math.min(255, alb[i] * (m[0] * ROOMK[i] + m[1] * d * LAMPK[i]) + 255 * s * LAMPK[i]));
  }
  const CHROME = { id: 0, chrome: true }, RUBBER = { id: 1, alb: [132, 40, 32], m: [.3, .74, .12, 16] };
  const ENAMEL = [170, 38, 30], M_ENAMEL = [.36, .8, .5, 70];
  const qa = an => ((Math.round(an / TAU * 256) % 256) + 256) % 256;
  // colour across a round bar whose width runs along world angle q/256 turn, as [offset 0..1, [r, g, b]].
  // Chrome: v = sin(half the angle the reflection turns through), so the middle mirrors the glass and the room
  // in front, the edges the dark box behind; the lamp is a hard stripe in a soft bloom.
  const PROFS = new Map();
  function barProfile(q, mat) {
    const key = mat.id * 256 + q;
    let p = PROFS.get(key); if (p) return p;
    const a = q / 256 * TAU, px = Math.cos(a), py = Math.sin(a);
    const lp = LV.x * px + LV.y * py, fl = Math.atan2(lp, LV.z), sl = lp >= 0 ? 1 : -1;
    const hs = 1 - .5 * Math.abs(LV.y * px - LV.x * py), vh = Math.sin(fl / 2);
    const V = [-1, -.96, -.86, -.7, -.45, -.2, .1, .4, .66, .84, .95, 1];
    for (const d of [-.16, -.07, 0, .07, .16]) if (Math.abs(vh + d) < .985) V.push(vh + d);
    V.sort((x, y) => x - y);
    p = V.map(v => {
      const ph = 2 * Math.asin(clamp(v, -1, 1));
      let col;
      if (mat.chrome) {
        const cf = Math.max(0, Math.cos(ph)), side = Math.max(0, Math.sin(ph) * sl);
        const env = 24 + 124 * Math.pow(cf, 1.3) + 74 * side * (.55 + .45 * cf);
        const sp = hs * (1.25 * bell(ph - fl, .17) + .32 * bell(ph - fl, .7));
        const warm = Math.max(0, Math.sin(ph) * py);
        col = [env + 34 * warm + 255 * sp * LAMPK[0], env + 14 * warm + 255 * sp * LAMPK[1], env * 1.05 - 4 * warm + 255 * sp * LAMPK[2]];
      } else col = litFace(mat.alb, [v * px, v * py, Math.sqrt(Math.max(0, 1 - v * v))], mat.m).map(x => x * (.55 + .45 * Math.sqrt(Math.max(0, 1 - v * v))));
      return [(v + 1) / 2, col.map(x => Math.max(0, Math.min(255, x)))];
    });
    PROFS.set(key, p); return p;
  }
  // Gradients are kept per context. A canvas gradient lives in the user space of the fill, not of its making,
  // so one made from -1 to 1 serves every bar, band and slice, filled under a transform that sizes it.
  const GC = new WeakMap();
  function gcache(g, key, make) {
    let m = GC.get(g); if (!m) GC.set(g, m = new Map());
    let v = m.get(key); if (v) return v;
    if (m.size > 1600) m.clear();
    v = make(); m.set(key, v); return v;
  }
  // that profile across (x0,y0)-(x1,y1) in the current frame; `an` = the same direction in the world (the
  // frame's rotation added in); k darkens (a part in shade), up lifts (a surface that faces the sky)
  function barGrad(g, x0, y0, x1, y1, an, mat = CHROME, k = 1, up = 0) {
    const gr = g.createLinearGradient(x0, y0, x1, y1);
    for (const [o, col] of barProfile(qa(an), mat)) gr.addColorStop(o, rgbs(col, k, up));
    return gr;
  }
  function unitGrad(g, an, mat = CHROME, k = 1, up = 0) {
    const q = qa(an), kq = Math.round(k * 40), uq = Math.round(up);
    return gcache(g, `u${mat.id}|${q}|${kq}|${uq}`, () => barGrad(g, -1, 0, 1, 0, q / 256 * TAU, mat, kq / 40, uq));
  }
  // fill the current path as a bar r either side of x = cx, across the frame's x axis
  function fillBar(g, cx, r, an, mat = CHROME, k = 1, up = 0) {
    g.save(); g.translate(cx, 0); g.scale(r, 1); g.fillStyle = unitGrad(g, an, mat, k, up); g.fill(); g.restore();
  }
  // the front half of a turned band between (y0, r0) above and (y1, r1) below
  function turnBand(g, y0, r0, y1, r1) {
    g.beginPath(); g.ellipse(0, y0, r0, r0 * CE, 0, Math.PI, 0, true); g.lineTo(r1, y1); g.ellipse(0, y1, r1, r1 * CE, 0, 0, Math.PI, false); g.closePath();
  }
  // lathe marks, the same on every turned face: [radius fraction, width, colour]
  const LATHE = (() => {
    let s = 911; const r = () => (s = (s * 16807) % 2147483647) / 2147483647, out = [];
    for (let f = .14; f < .985; f += .028 + r() * .05) out.push([f, .22 + r() * .32, r() < .55 ? `rgba(255,250,240,${(.06 + r() * .1).toFixed(3)})` : `rgba(8,10,14,${(.06 + r() * .08).toFixed(3)})`]);
    return out;
  })();
  // the radial bow the lamp makes across lathe marks (as on the roulette's spun apron)
  const AH = Math.atan2(HV[2], HV[0]);
  function bowGrad(g) {
    return gcache(g, 'bow', () => {
      const lobe = a => Math.pow(Math.max(0, Math.cos(a - AH)), 10) + Math.pow(Math.max(0, Math.cos(a - AH - Math.PI)), 10) * .7;
      let b;
      if (g.createConicGradient) {
        b = g.createConicGradient(0, 0, 0);
        for (let i = 0; i <= 48; i++) b.addColorStop(i / 48, `rgba(255,248,234,${(.42 * lobe(i / 48 * TAU)).toFixed(3)})`);
      } else {
        b = g.createLinearGradient(-20 * Math.cos(AH), -20 * Math.sin(AH), 20 * Math.cos(AH), 20 * Math.sin(AH));
        b.addColorStop(0, 'rgba(255,248,234,.12)'); b.addColorStop(.5, 'rgba(255,248,234,0)'); b.addColorStop(1, 'rgba(255,248,234,.2)');
      }
      return b;
    });
  }
  // a turned face that looks up (radius ro) at height y: lit from overhead, brighter on the lamp's side, the
  // bow across it, then the lathe marks
  const TOP = litFace([184, 188, 194], [0, -1, 0], [.4, .78, 0, 1]);
  function turnedFace(g, y, ro, k = 1) {
    g.save(); g.translate(0, y); g.scale(ro, ro * CE);
    g.beginPath(); g.arc(0, 0, 1, 0, TAU);
    g.fillStyle = gcache(g, 'tf' + k, () => {
      const lg = g.createLinearGradient(-.8, .6, .8, -.6);
      lg.addColorStop(0, rgbs(TOP, 1.08 * k, 8)); lg.addColorStop(.55, rgbs(TOP, .86 * k)); lg.addColorStop(1, rgbs(TOP, .6 * k));
      return lg;
    });
    g.fill();
    g.save(); g.clip();
    g.globalAlpha = k; g.fillStyle = bowGrad(g); g.fillRect(-1, -1, 2, 2); g.globalAlpha = 1;
    g.restore();
    g.restore();
    // lathe marks: drawn unscaled so the lines keep their weight
    g.save(); g.translate(0, y); g.scale(1, CE);
    for (const [f, w, col] of LATHE) { g.lineWidth = w; g.strokeStyle = col; g.beginPath(); g.arc(0, 0, ro * f, 0, TAU); g.stroke(); }
    g.restore();
  }

  // One finger for the right-hand prong, in the prong's own frame (pivot at 0,0, the prong runs down +y,
  // +x = outward); the left one is its mirror image. Two links: the upper bows out a little to a knuckle,
  // the lower curls in to a rubber tip. Samples carry position, unit tangent and half width.
  const FINGER = (() => {
    const bez = (P, n, w0, w1) => {
      const out = [];
      for (let i = 0; i <= n; i++) {
        const t = i / n, u = 1 - t;
        const x = u * u * u * P[0] + 3 * u * u * t * P[2] + 3 * u * t * t * P[4] + t * t * t * P[6];
        const y = u * u * u * P[1] + 3 * u * u * t * P[3] + 3 * u * t * t * P[5] + t * t * t * P[7];
        const dx = 3 * u * u * (P[2] - P[0]) + 6 * u * t * (P[4] - P[2]) + 3 * t * t * (P[6] - P[4]);
        const dy = 3 * u * u * (P[3] - P[1]) + 6 * u * t * (P[5] - P[3]) + 3 * t * t * (P[7] - P[5]);
        const l = Math.hypot(dx, dy) || 1;
        out.push({ x, y, tx: dx / l, ty: dy / l, w: w0 + (w1 - w0) * t });
      }
      return out;
    };
    const up = bez([0, -1.5, 1.5, 9, 3.5, 18, 3.5, 29], 8, 3.2, 2.75);
    const lo = bez([3.5, 29, 3.5, 40.5, .4, 54.8, -8.4, 55.4], 12, 2.75, 2.05);
    // the rubber boot over the last quarter, swelling a little toward the end
    const tip = lo.slice(9).map((p, i, A) => ({ ...p, w: p.w + .45 * i / (A.length - 1) }));
    const mirror = P => P.map(p => ({ x: -p.x, y: p.y, tx: -p.tx, ty: p.ty, w: p.w }));
    const knuckle = { x: 3.5, y: 29 };
    return { 1: { up, lo, tip, k: knuckle }, [-1]: { up: mirror(up), lo: mirror(lo), tip: mirror(tip), k: { x: -3.5, y: 29 } } };
  })();
  // a tapered round bar along samples P in the current frame, whose +x points along world angle wa:
  // clipped to its outline (round ends), shaded in short slices across its own width, so the lamp's
  // stripe follows the bend (a sample's own k, if it has one, shades it further)
  function tube(g, P, wa, mat = CHROME, k = 1, grow = 0) {
    const n = P.length - 1, b = P[0], e = P[n], ab = Math.atan2(b.tx, -b.ty), ae = Math.atan2(e.tx, -e.ty);
    g.save();
    g.beginPath();
    for (let i = 0; i <= n; i++) { const p = P[i], w = p.w + grow; g.lineTo(p.x - p.ty * w, p.y + p.tx * w); }
    g.arc(e.x, e.y, e.w + grow, ae, ae - Math.PI, true);
    for (let i = n; i >= 0; i--) { const p = P[i], w = p.w + grow; g.lineTo(p.x + p.ty * w, p.y - p.tx * w); }
    g.arc(b.x, b.y, b.w + grow, ab + Math.PI, ab, true);
    g.closePath(); g.clip();
    for (let i = 0; i < n; i++) {
      const p = P[i], q = P[i + 1], l = Math.hypot(q.x - p.x, q.y - p.y) || 1, ux = (q.x - p.x) / l, uy = (q.y - p.y) / l;
      const nx = -uy, ny = ux, w = (p.w + q.w) / 2 + grow;
      const e0 = i === 0 ? w + 1 : .45, e1 = i === n - 1 ? w + 1 : .45, kk = p.k == null ? k : k * (p.k + q.k) / 2;
      g.save(); g.transform(nx * w, ny * w, ux, uy, (p.x + q.x) / 2, (p.y + q.y) / 2);   // x across (1 = the edge), y along
      g.beginPath(); g.rect(-1.7, -l / 2 - e0, 3.4, l + e0 + e1);
      g.fillStyle = unitGrad(g, Math.atan2(ny, nx) + wa, mat, kk); g.fill();
      g.restore();
    }
    g.restore();
  }
  // soft round shade: a blurred disc of darkness at (x, y), squashed by sy
  function blot(g, x, y, r, a, sy = 1) {
    g.save(); g.translate(x, y); g.scale(r, r * sy);
    g.fillStyle = gcache(g, 'blot' + a, () => {
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, 1);
      gr.addColorStop(0, `rgba(8,6,8,${a})`); gr.addColorStop(.55, `rgba(8,6,8,${(a * .45).toFixed(3)})`); gr.addColorStop(1, 'rgba(8,6,8,0)');
      return gr;
    });
    g.beginPath(); g.arc(0, 0, 1, 0, TAU); g.fill(); g.restore();
  }
  // the lamp's direction in a frame turned by `an` (for radial highlights)
  const lampIn = an => rot(L2.x, L2.y, -an);
  // a turned pin boss: a lit disc with a hard rim on the lamp side, sat in its own shade, a domed pin head
  function boss(g, x, y, r, an) {
    const l = lampIn(an), q = qa(an);
    blot(g, x - l.x * 1.1, y - l.y * 1.1, r * 1.55, .5);
    g.save(); g.translate(x, y); g.scale(r, r);
    g.fillStyle = gcache(g, 'boss' + q, () => {
      const L = lampIn(q / 256 * TAU), gr = g.createRadialGradient(L.x * .45, L.y * .45, .08, 0, 0, 1);
      gr.addColorStop(0, '#fbfaf5'); gr.addColorStop(.3, '#c3c8cc'); gr.addColorStop(.75, '#5d646b'); gr.addColorStop(1, '#2b2f34');
      return gr;
    });
    g.beginPath(); g.arc(0, 0, 1, 0, TAU); g.fill();
    g.restore();
    const la = Math.atan2(l.y, l.x);
    g.lineWidth = r * .14; g.strokeStyle = 'rgba(255,248,232,.55)'; g.beginPath(); g.arc(x, y, r * .9, la - .8, la + .8); g.stroke();
    if (ART.rivet) ART.rivet(g, x, y, r * .42);
  }
  function finger(g, s, wa) {
    const F = FINGER[s];
    tube(g, F.lo, wa, CHROME, .96);
    tube(g, F.tip, wa, RUBBER, 1, .6);
    // the rubber boot's lip, where it grips the steel
    const t0 = F.tip[0];
    g.lineWidth = .55; g.strokeStyle = 'rgba(20,6,6,.55)';
    g.beginPath(); g.moveTo(t0.x - t0.ty * (t0.w + .6), t0.y + t0.tx * (t0.w + .6)); g.lineTo(t0.x + t0.ty * (t0.w + .6), t0.y - t0.tx * (t0.w + .6)); g.stroke();
    // the upper link overlaps the lower at the knuckle, in its own shade
    blot(g, F.k.x + 1, F.k.y + 2.4, 5.2, .45, 1.2);
    tube(g, F.up, wa, CHROME, 1);
    boss(g, F.k.x, F.k.y, 3.4, wa);
  }
  // the fork on the flange that holds a finger's pivot
  function lug(g, s, an) {
    const x = s * PIV, r = 3.9, l = lampIn(an);
    g.beginPath(); g.moveTo(x - r, -1); g.lineTo(x + r, -1); g.lineTo(x + r, 8); g.arc(x, 8, r, 0, Math.PI); g.closePath();
    fillBar(g, x, r, an, CHROME, .9);
    const sd = l.x < 0 ? -1 : 1;
    g.lineWidth = .7; g.strokeStyle = 'rgba(255,248,232,.6)'; g.beginPath(); g.moveTo(x + sd * (r - .35), -1); g.lineTo(x + sd * (r - .35), 8); g.stroke();
    g.strokeStyle = 'rgba(0,0,0,.4)'; g.beginPath(); g.arc(x, 8, r - .35, Math.PI * .1, Math.PI * .9); g.stroke();
    if (ART.rivet) ART.rivet(g, x, 8, 1.8);
  }
  // the hub, a turned chrome head: the rider's disc on top, a drum, a flange that carries the finger lugs,
  // and under it a short body, a cone and a nut that come down on a can. y down, at the hub's centre.
  const HUB = { top: -10, rTop: 16.2, cham: -8.7, rDrum: 17.8, fl: -2.2, rFl: 21, flB: 1.4, rBody: 12.4, cone: 6.6, rCone: 7.2, nut: 9.2, rNut: 4.6, nutB: 10.6, boss: -12.8, rBoss: 3.5 };
  function hubBelow(g, an) {
    const U = HUB;
    turnBand(g, U.nut, U.rNut, U.nutB, U.rNut * .92); fillBar(g, 0, U.rNut, an, CHROME, .78);
    turnBand(g, U.cone, U.rBody, U.nut, U.rCone); fillBar(g, 0, U.rBody, an, CHROME, .62);
    turnBand(g, U.flB - 1, U.rBody, U.cone, U.rBody); fillBar(g, 0, U.rBody, an, CHROME, .8);
    // the flange throws its shade down the body
    g.save(); g.clip();
    g.fillStyle = gcache(g, 'flsh', () => {
      const fs = g.createLinearGradient(0, U.flB + 3, 0, U.flB + 7.5);
      fs.addColorStop(0, 'rgba(8,6,8,.7)'); fs.addColorStop(1, 'rgba(8,6,8,0)');
      return fs;
    });
    g.fillRect(-U.rBody, U.flB - 2, 2 * U.rBody, 12);
    g.restore();
  }
  function hubAbove(g, an) {
    const U = HUB;
    // flange: its rim, then its top face
    turnBand(g, U.fl, U.rFl, U.flB, U.rFl); fillBar(g, 0, U.rFl, an, CHROME, .95);
    g.lineWidth = .6; g.strokeStyle = 'rgba(0,0,0,.45)';
    g.beginPath(); g.ellipse(0, U.flB, U.rFl - .2, (U.rFl - .2) * CE, 0, .06, Math.PI - .06); g.stroke();
    turnedFace(g, U.fl, U.rFl, .96);
    g.lineWidth = .7; g.strokeStyle = 'rgba(255,250,238,.55)';
    g.beginPath(); g.ellipse(0, U.fl, U.rFl - .35, (U.rFl - .35) * CE, 0, Math.PI * .55, Math.PI * 1.35); g.stroke();
    // the drum stands on it: a dark ring where they meet
    g.save(); g.translate(0, U.fl); g.scale(1, CE);
    g.fillStyle = gcache(g, 'drumao', () => {
      const ao = g.createRadialGradient(0, 0, U.rDrum - .5, 0, 0, U.rDrum + 2.6);
      ao.addColorStop(0, 'rgba(6,5,8,.62)'); ao.addColorStop(1, 'rgba(6,5,8,0)');
      return ao;
    });
    g.beginPath(); g.arc(0, 0, U.rDrum + 2.6, 0, TAU); g.fill();
    g.restore();
    turnBand(g, U.cham, U.rDrum, U.fl, U.rDrum); fillBar(g, 0, U.rDrum, an, CHROME, 1);
    // a turned groove round the drum
    for (const [dy, col, w] of [[0, 'rgba(6,6,10,.55)', .8], [.75, 'rgba(255,250,240,.28)', .5]]) {
      g.lineWidth = w; g.strokeStyle = col; g.beginPath(); g.ellipse(0, -5.4 + dy, U.rDrum - .1, (U.rDrum - .1) * CE, 0, .04, Math.PI - .04); g.stroke();
    }
    // chamfer: the drum's top edge, turned toward the sky
    turnBand(g, U.top, U.rTop, U.cham, U.rDrum); fillBar(g, 0, U.rDrum, an, CHROME, 1.05, 34);
    turnedFace(g, U.top, U.rTop, 1);
    g.lineWidth = .6; g.strokeStyle = 'rgba(255,250,238,.5)';
    g.beginPath(); g.ellipse(0, U.top, U.rTop - .3, (U.rTop - .3) * CE, 0, Math.PI * .6, Math.PI * 1.3); g.stroke();
    // the cable swivel boss in the middle of the top face
    blot(g, 1.2, U.top + .9, U.rBoss * 1.9, .5, CE * 1.4);
    turnBand(g, U.boss, U.rBoss, U.top, U.rBoss); fillBar(g, 0, U.rBoss, an, CHROME, .95);
    g.beginPath(); g.ellipse(0, U.boss, U.rBoss, U.rBoss * CE, 0, 0, TAU); g.fillStyle = rgbs(TOP, 1.05); g.fill();
    g.beginPath(); g.ellipse(0, U.boss, 1.6, 1.6 * CE, 0, 0, TAU); g.fillStyle = 'rgba(10,10,14,.7)'; g.fill();
  }
  const RAIL_F = CARR_Y - 6, RAIL_B = CARR_Y - 14.6;
  // the cable: a wire rope, its strands laid in a helix; the lay is fixed at the hub end, so it pays out with it
  function drawCable(g, top, bot) {
    const dx = top.x - bot.x, dy = top.y - bot.y, len = Math.hypot(dx, dy);
    if (len < 1) return;
    const th = Math.atan2(-dx, dy), hw = 1.4, P = 2.3;
    g.save(); g.translate(bot.x, bot.y); g.rotate(th);
    g.beginPath(); g.rect(-hw, -.5, 2 * hw, len + .5);
    fillBar(g, 0, hw, th, CHROME, .4);
    g.clip();
    const q = qa(th);
    g.lineCap = 'round'; g.lineWidth = P * .5; g.strokeStyle = gcache(g, 'cable' + q, () => barGrad(g, -hw, 0, hw, 0, q / 256 * TAU, CHROME, .92));
    g.beginPath();
    for (let y = -P; y < len + P; y += P) { g.moveTo(-hw * 1.15, y - P * .45); g.lineTo(hw * 1.15, y + P * .45); }
    g.stroke();
    g.restore();
  }
  function drawClaw(g) {
    const { hx, hy, phi, a } = pose();
    const top = { x: c.x + jigX(), y: CARR_Y + 6 }, b = rot(0, HUB.boss + .6, phi);
    drawCable(g, top, { x: hx + b.x, y: hy + b.y });
    g.save(); g.translate(hx, hy); g.rotate(phi);
    hubBelow(g, phi);
    for (const s of [-1, 1]) {
      g.save(); g.translate(s * PIV, 8); g.rotate(-s * a);
      finger(g, s, phi - s * a);
      g.restore();
      lug(g, s, phi);
    }
    hubAbove(g, phi);
    g.restore();
  }
  // the third finger hangs from the back of the hub (a little round to the right) and swings away from us
  // as the claw opens, so it shows nearly end on, foreshortened, between the other two. Its inner face turns
  // from the lamp as it curls, which is what shows the curl. Drawn before the cans, which stand in front of it.
  const BACK = .45;
  function drawClawBack(g) {
    const { hx, hy, phi, a } = pose(), sa = Math.sin(a), ca = Math.cos(a), sb = Math.sin(BACK), cb = Math.cos(BACK), F = FINGER[1];
    const dX = [ca * sb, -sa, -ca * cb], dY = [sa * sb, ca, -sa * cb], O = [15 * sb, 8, -15 * cb];
    const map = (P, w = .9) => {
      const out = P.map(p => {
        const x = O[0] + p.x * dX[0] + p.y * dY[0], y = O[1] + p.x * dX[1] + p.y * dY[1], z = O[2] + p.x * dX[2] + p.y * dY[2];
        const N = [-p.ty * dX[0] + p.tx * dY[0], -p.ty * dX[1] + p.tx * dY[1], -p.ty * dX[2] + p.tx * dY[2]];
        return { x, y: y + z * CE, w: p.w * w, k: .34 + .62 * Math.max(0, N[0] * LV.x + N[1] * LV.y + N[2] * LV.z) };
      });
      for (let i = 0; i < out.length; i++) {
        const A = out[Math.max(0, i - 1)], B = out[Math.min(out.length - 1, i + 1)], l = Math.hypot(B.x - A.x, B.y - A.y) || 1;
        out[i].tx = (B.x - A.x) / l; out[i].ty = (B.y - A.y) / l;
      }
      return out;
    };
    g.save(); g.translate(hx, hy); g.rotate(phi);
    const lo = map(F.lo), tip = map(F.tip), up = map(F.up);
    tube(g, lo, phi, CHROME, .85);
    tube(g, tip, phi, RUBBER, .9, .55);
    tube(g, up, phi, CHROME, .85);
    // the knuckle pin, seen from its side
    const K = up[up.length - 1], ka = Math.atan2(K.ty, K.tx) - Math.PI / 2;
    g.save(); g.translate(K.x, K.y); g.rotate(ka);
    rrect(g, -K.w - .6, -1.3, 2 * K.w + 1.2, 2.6, 1.2);
    g.rotate(Math.PI / 2); g.scale(1.3, 1); g.fillStyle = unitGrad(g, ka + phi + Math.PI / 2, CHROME, .42); g.fill();
    g.restore();
    // the pad at the end of the curl looks straight at us
    const e = tip[tip.length - 1], l = lampIn(phi), r = e.w + .8;
    const pg = g.createRadialGradient(e.x + l.x * r * .4, e.y + l.y * r * .4, r * .1, e.x, e.y, r);
    pg.addColorStop(0, rgbs(litFace(RUBBER.alb, [0, 0, 1], RUBBER.m), .8, 6)); pg.addColorStop(1, rgbs(RUBBER.alb, .2));
    g.fillStyle = pg; g.beginPath(); g.ellipse(e.x, e.y + .4, r, r * .8, 0, 0, TAU); g.fill();
    g.restore();
  }
  // the claw's own shade on the cans it works: fingers and flange, thrown a little down and right, and only
  // where a can is there to catch it (the far, soft shadow on the back wall is drawShadows')
  function drawClawShade(g) {
    const { hx, hy, phi, a } = pose(), tipY = hy + 8 + PL * Math.cos(a), near = [];
    let top = 1e9;
    for (const k of cans) {
      if (k.gone || k.leaving || k.out) continue;
      const p = k.body.position, e = extent(k, 0);
      if (Math.abs(p.x - hx) > e.x + 46 || p.y + e.y < hy - 6 || p.y - e.y > tipY + 20) continue;
      near.push(k);
      if (Math.abs(p.x - hx) < e.x + 14) top = Math.min(top, p.y - e.y);
    }
    if (!near.length) return;
    const gap = c.held ? 0 : clamp(top - (hy + HUB.nutB), 0, 90), al = 1 - gap / 90;
    if (al < .04) return;
    const off = 1.4 + gap * .3, sf = 1 + gap * .05;
    g.save();
    g.beginPath();
    for (const k of near) {
      const b = k.body, cs = Math.cos(b.angle), sn = Math.sin(b.angle), hw = k.w / 2 + .4, hh = k.h / 2 + k.w * .1;
      const P = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map(([u, v]) => [b.position.x + u * cs - v * sn, b.position.y + u * sn + v * cs]);
      g.moveTo(P[0][0], P[0][1]); g.lineTo(P[1][0], P[1][1]); g.lineTo(P[2][0], P[2][1]); g.lineTo(P[3][0], P[3][1]); g.closePath();
    }
    g.clip();
    g.translate(hx + .45 * off, hy + .9 * off); g.rotate(phi);
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (const [grow, k] of [[5 * sf, .06], [2.4 * sf, .09], [0, .13]]) {
      const col = `rgba(10,6,8,${(k * al).toFixed(3)})`;
      g.strokeStyle = col; g.fillStyle = col; g.lineWidth = 5.4 + grow;
      for (const s of [-1, 1]) {
        const F = FINGER[s];
        g.save(); g.translate(s * PIV, 8); g.rotate(-s * a);
        g.beginPath(); for (const p of F.up) g.lineTo(p.x, p.y); for (const p of F.lo) g.lineTo(p.x, p.y); g.stroke();
        g.restore();
      }
      g.beginPath(); g.ellipse(0, HUB.flB, HUB.rFl + grow / 2, HUB.rFl * CE + 1.5 + grow / 2, 0, 0, TAU); g.fill();
      g.beginPath(); g.ellipse(0, HUB.nut, HUB.rBody + grow / 2, 4 + grow / 2, 0, 0, TAU); g.fill();
    }
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
    g.save(); g.translate(hx, hy); g.rotate(phi);
    // it sits on the hub's turned top face: a soft contact shade under it, kept on the face
    g.save(); g.beginPath(); g.ellipse(0, HUB.top, HUB.rTop, HUB.rTop * CE, 0, 0, TAU); g.clip();
    blot(g, 1.6, HUB.top + .5, 15, .55, CE * 1.25);
    g.restore();
    g.translate(0, HUB.top);
    try { A.draw(g, { t: clock, mode: 'ride', emotion, look, bib: rider.bib || null, scale: .42 }); } catch (e) { rider.bad = (rider.bad || 0) + 1; if (rider.bad > 3) rider = null; }
    g.restore();
  }
  const jigX = () => (jig > 0 ? Math.sin(clock * 90) * 2.2 * (jig / .15) : 0);
  // the trolley: a cast box in red enamel riding the two rods, seen a little from above (its top face shows)
  // and in the room's perspective (the side toward the middle shows); bevelled edges catch the lamp, a raised
  // plate and four bolts on the front, and a spun shade for the lamp under its nose
  const TR = { hw: 26, y0: CARR_Y - 14, y1: CARR_Y + 5, d: 21, bev: 1.7 };
  const SHADE = { y0: CARR_Y + 6.4, r0: 3.2, y1: CARR_Y + 10.8, r1: 8.2 };
  function drawCarriage(g) {
    const x = c.x + jigX(), { hw, y0, y1, d, bev } = TR;
    const dx = clamp((VP.x - x) * .026, -5, 5), dy = -d * CE, sd = dx >= 0 ? 1 : -1;
    const face = (n, k = 1, up = 0) => rgbs(litFace(ENAMEL, n, M_ENAMEL), k, up);
    // where the rods run into the far side: a little contact shade on them
    blot(g, x - sd * hw - sd * 1.5, RAIL_F, 5, .45, .8);
    // the side toward the middle, with the rods going in
    const xs = x + sd * hw;
    quad(g, [xs, y0, xs + dx, y0 + dy, xs + dx, y1 + dy, xs, y1]);
    g.fillStyle = gcache(g, 'tside' + sd, () => {
      const gr = g.createLinearGradient(0, y0 + dy, 0, y1);
      gr.addColorStop(0, face([sd * .7, -.7, .2])); gr.addColorStop(.3, face([sd, 0, 0])); gr.addColorStop(1, face([sd, .3, 0], .7));
      return gr;
    });
    g.fill();
    for (const [ry, rr, f] of [[RAIL_B, 2.3, .8], [RAIL_F, 3, .3]]) {
      const hx0 = xs + dx * f;
      g.beginPath(); g.ellipse(hx0, ry, Math.max(.5, Math.abs(dx) * .16), rr + .7, 0, 0, TAU); g.fillStyle = 'rgba(12,4,4,.7)'; g.fill();
      g.fillStyle = gcache(g, 'thole' + ry, () => barGrad(g, 0, ry - rr, 0, ry + rr, Math.PI / 2, CHROME, .8));
      g.beginPath(); g.ellipse(hx0 + sd * .4, ry, Math.max(.35, Math.abs(dx) * .1), rr, 0, 0, TAU); g.fill();
    }
    // top face, lit from overhead, with the lamp's soft reflection in the enamel toward the front left
    quad(g, [x - hw, y0, x + hw, y0, x + hw + dx, y0 + dy, x - hw + dx, y0 + dy]);
    g.fillStyle = face([0, -1, 0]); g.fill();
    g.save(); g.clip(); g.translate(x, 0);
    g.fillStyle = gcache(g, 'ttop', () => {
      const gr = g.createRadialGradient(-hw * .3, y0 - 1, 0, -hw * .3, y0 - 1, hw * .9);
      gr.addColorStop(0, 'rgba(255,238,215,.34)'); gr.addColorStop(1, 'rgba(255,238,215,0)');
      return gr;
    });
    g.fillRect(-hw - 6, y0 + dy - 2, 2 * hw + 12, -dy + 4);
    g.fillStyle = 'rgba(40,6,4,.35)'; g.fillRect(-hw - 6, y0 + dy - 1, 2 * hw + 12, 1.4);
    g.restore();
    // front: a bevelled frame round a flat face
    const X0 = x - hw, X1 = x + hw, I0 = X0 + bev, I1 = X1 - bev, J0 = y0 + bev, J1 = y1 - bev;
    quad(g, [X0, y0, X1, y0, I1, J0, I0, J0]); g.fillStyle = face([0, -.72, .7], 1, 6); g.fill();
    quad(g, [X0, y0, I0, J0, I0, J1, X0, y1]); g.fillStyle = face([-.72, 0, .7]); g.fill();
    quad(g, [X1, y0, X1, y1, I1, J1, I1, J0]); g.fillStyle = face([.72, 0, .7], .9); g.fill();
    quad(g, [I0, J1, I1, J1, X1, y1, X0, y1]); g.fillStyle = face([0, .72, .7], .8); g.fill();
    g.fillStyle = gcache(g, 'tfront', () => {
      const gr = g.createLinearGradient(0, J0, 0, J1);
      gr.addColorStop(0, face([0, -.3, .95], 1.02)); gr.addColorStop(.4, face([0, 0, 1])); gr.addColorStop(1, face([0, .35, .94], .78));
      return gr;
    });
    g.fillRect(I0, J0, I1 - I0, J1 - J0);
    g.lineWidth = .6; g.strokeStyle = 'rgba(255,240,226,.7)';
    g.beginPath(); g.moveTo(X0 + .5, y0 + .3); g.lineTo(X1 - .5, y0 + .3); g.stroke();
    // the raised plate: lit on its top and left edges, in shade on the others
    const p0 = X0 + 6, p1 = X1 - 6, q0 = y0 + 4.6, q1 = y1 - 4.6;
    g.fillStyle = face([0, -.08, 1], 1.04); g.fillRect(p0, q0, p1 - p0, q1 - q0);
    g.lineWidth = .8;
    g.strokeStyle = 'rgba(255,226,210,.55)'; g.beginPath(); g.moveTo(p0, q1); g.lineTo(p0, q0); g.lineTo(p1, q0); g.stroke();
    g.strokeStyle = 'rgba(30,4,4,.55)'; g.beginPath(); g.moveTo(p1, q0 + .4); g.lineTo(p1, q1); g.lineTo(p0 + .4, q1); g.stroke();
    // motor vents cast into the plate: dark slots, the lamp on each lower lip
    for (let i = -3; i <= 3; i++) {
      const vx = x + i * 5, v0 = q0 + 2, v1 = q1 - 2;
      rrect(g, vx - 1.15, v0, 2.3, v1 - v0, 1.15); g.fillStyle = 'rgba(22,3,3,.8)'; g.fill();
      g.lineWidth = .45; g.strokeStyle = 'rgba(255,222,204,.45)';
      g.beginPath(); g.moveTo(vx - .9, v1 + .35); g.lineTo(vx + .9, v1 + .35); g.stroke();
    }
    if (ART.rivet) for (const [bx, by] of [[X0 + 3.1, y0 + 3.1], [X1 - 3.1, y0 + 3.1], [X0 + 3.1, y1 - 3.1], [X1 - 3.1, y1 - 3.1]]) ART.rivet(g, bx, by, 1.25);
    // the lamp shade: a short stem, then spun nickel flaring out to a rolled rim
    const S0 = SHADE;
    blot(g, x + 1.5, y1 + 1.4, 11, .45, .45);
    g.save(); g.translate(x, 0);
    turnBand(g, S0.y0, S0.r0, S0.y1, S0.r1); fillBar(g, 0, S0.r1, 0, CHROME, .9, 16);
    g.save(); g.clip();
    for (const [f, col] of [[.22, 'rgba(255,250,240,.2)'], [.4, 'rgba(10,10,14,.18)'], [.58, 'rgba(255,250,240,.16)'], [.78, 'rgba(10,10,14,.2)']]) {
      const yy = S0.y0 + (S0.y1 - S0.y0) * f, rr = S0.r0 + (S0.r1 - S0.r0) * f;
      g.lineWidth = .35; g.strokeStyle = col; g.beginPath(); g.ellipse(0, yy, rr, rr * CE, 0, .05, Math.PI - .05); g.stroke();
    }
    g.restore();
    g.lineWidth = .9; g.strokeStyle = 'rgba(255,248,232,.6)';
    g.beginPath(); g.ellipse(0, S0.y1 - .3, S0.r1 - .2, (S0.r1 - .2) * CE, 0, .12, Math.PI - .12); g.stroke();
    turnBand(g, y1 - .6, 2.1, S0.y0, 2.1); fillBar(g, 0, 2.1, 0, CHROME, .85);
    g.restore();
  }
  function drawBulb(g) {
    const x = c.x + jigX(), y = CARR_Y + 13.5, on = clamp(lamp, 0, 1.4), S0 = SHADE;
    const halo = g.createRadialGradient(x, y, 1, x, y, 18);
    halo.addColorStop(0, `rgba(255,233,196,${.55 * on})`); halo.addColorStop(1, 'rgba(255,233,196,0)');
    g.globalCompositeOperation = 'screen'; g.fillStyle = halo; g.fillRect(x - 18, y - 18, 36, 36); g.globalCompositeOperation = 'source-over';
    // the bulb and its wire guard hang out of the shade: only what is below its front rim shows
    g.save();
    g.beginPath(); g.moveTo(x - 30, S0.y1); g.lineTo(x - S0.r1, S0.y1); g.ellipse(x, S0.y1, S0.r1, S0.r1 * CE, 0, Math.PI, 0, true);
    g.lineTo(x + 30, S0.y1); g.lineTo(x + 30, S0.y1 + 30); g.lineTo(x - 30, S0.y1 + 30); g.closePath(); g.clip();
    const bl = g.createRadialGradient(x - 1.2, y - 1.4, .4, x, y, 4.6);
    bl.addColorStop(0, '#fffdf5'); bl.addColorStop(.5, `rgb(255,${Math.round(214 + 20 * Math.min(1, on))},150)`); bl.addColorStop(1, '#c9913d');
    g.fillStyle = bl; g.beginPath(); g.arc(x, y, 4.4, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(40,43,48,.9)'; g.lineWidth = .7;
    g.beginPath(); g.ellipse(x, y, 5.6, 5.6, 0, Math.PI * .95, Math.PI * 2.05); g.stroke();
    for (const s of [-.45, 0, .45]) { g.beginPath(); g.moveTo(x + s * 6, y - 4.5); g.quadraticCurveTo(x + s * 11, y + 3, x + s * 2, y + 6.4); g.stroke(); }
    g.restore();
    // the rolled rim of the shade, lit from the bulb beneath it
    g.lineWidth = .8; g.strokeStyle = `rgba(255,226,170,${(.55 * Math.min(1, on)).toFixed(3)})`;
    g.beginPath(); g.ellipse(x, S0.y1 + .35, S0.r1 - .3, (S0.r1 - .3) * CE, 0, .15, Math.PI - .15); g.stroke();
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
    const dd = clamp(dark * .55, 0, .42);
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
    drawClawBack(g);
    for (const k of cans) if (!k.gone && !k.leaving && k !== c.held) drawCanBody(g, k, zr);
    for (const k of cans) if (!k.gone && k.leaving) drawCanBody(g, k, 0);
    drawSpot(g);
    g.drawImage(lay.front.cv, 0, FP - 4, CHUTE_IN, H - FP + 6);
    if (c.held) drawCanBody(g, c.held, zr);
    drawClawShade(g);
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
    clock += rdt; unseen = false;
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
    if (quiet > 0) quiet = inPlay().some(k => k.body.speed > .3) ? .5 : quiet - rdt;   // after a skip, silent until the pile has rested half a second
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
      fill(names.flatMap(n => Array(Math.max(1, copies | 0)).fill(n)), true); setMode('load'); c.timer = COUNTDOWN; c.armed = false; unseen = true;
    },
    resume() { pick = null; pickT = 0; quiet = 0; letGo(); dropFake(); c.auto = null; c.plan = []; c.name = null; c.target = null; c.count = 0; setMode('aim'); c.timer = COUNTDOWN; c.armed = true; },
    // START: the first press starts the countdown (pressed during the pour, it starts once the cans land); a second press skips it
    go() {
      if (c.mode === 'load') { c.armed = true; return true; }
      if (c.mode !== 'aim') return false;
      if (!c.armed) { c.armed = true; c.timer = COUNTDOWN; } else c.timer = 0;
      return true;
    },
    get armed() { return !!c.armed; },
    // SKIP: from the pour to the fall of the can, ends the pick at once and fires onPick (pressed on the START wait, it starts and skips)
    skip,
    get canSkip() { return skippable(); },
    get claw() { return { x: c.x, th: c.th, L: c.L, open: c.open }; },
    setAnon(v) { anon = !!v; },
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
