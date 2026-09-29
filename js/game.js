// Game flow: roster → roulette sets the group order → one claw round per group → roll call.
(() => {
  const $ = s => document.querySelector(s);
  const { C, GROUP, drawCan, canStyle } = ART;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  let roster = Roster.load();
  let groups = [];            // playable groups: { no, name, sty, members: [names present] }
  let phase = 'order';        // order | play | done
  let remaining = [], order = [], results = [], turn = -1, revealCan = null;

  // ---------- counter display (mechanical flip digits + message) ----------
  const flip = $('#flip'), fg = flip.getContext('2d');
  const fdpr = Math.min(2, window.devicePixelRatio || 1);
  flip.width = 58 * fdpr; flip.height = 44 * fdpr;
  function setFlip(str) {
    fg.setTransform(fdpr, 0, 0, fdpr, 0, 0); fg.clearRect(0, 0, 58, 44);
    [...str.padStart(2, ' ').slice(-2)].forEach((ch, i) => {
      const x = 2 + i * 28;
      ART.rr(fg, x, 2, 26, 40, 4); fg.fillStyle = '#2c2b30'; fg.fill();
      fg.fillStyle = '#f3efe4'; fg.font = '26px "Alfa Slab One", Rockwell, serif'; fg.textAlign = 'center'; fg.textBaseline = 'middle';
      fg.fillText(ch, x + 13, 24);
      fg.fillStyle = 'rgba(0,0,0,.55)'; fg.fillRect(x, 21.5, 26, 1.5);
    });
  }
  function led(msg, sub = '') { $('#msg').textContent = msg; $('#sub').textContent = sub; }
  function banner(text) { const b = $('#banner'); b.textContent = text; b.classList.remove('go'); void b.offsetWidth; b.classList.add('go'); }
  function stepRail(n) {
    document.querySelectorAll('#steps li').forEach(li => {
      const s = +li.dataset.step;
      li.classList.toggle('on', s === n); li.classList.toggle('did', s < n);
      if (s === n) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
    });
  }

  // ---------- roulette ----------
  const wheel = Roulette($('#wheel'), {
    unlock: SFX.unlock,
    sfx: (n, v) => SFX[n] && SFX[n](v),
    roll: v => SFX.roll(v),
    onLaunch() { $('#spin').disabled = true; led('NO MORE BETS!', 'The ball is rolling…'); },
    onWeak() { led('GIVE IT A REAL FLICK', 'Drag the wheel and let go fast, or press Spin.'); },
    onResult(gi) {
      const g = remaining[gi];
      wheel.lock(true);
      SFX.ding(); banner(`${g.name}!`);
      led(`#${order.length + 1} · ${g.name.toUpperCase()}`, '');
      setTimeout(() => {
        remaining.splice(gi, 1); order.push(g); renderTickets(order.length - 1); renderLegend();
        if (remaining.length === 1) {
          const last = remaining.pop();
          setTimeout(() => {
            order.push(last); wheel.setGroups([]); renderTickets(order.length - 1); renderLegend();
            banner(`${last.name} last`); SFX.coin();
            led('ORDER IS SET', `${last.name} goes last. Get ready to catch!`);
            setTimeout(startPlay, 1800);
          }, 700);
        } else {
          wheel.setGroups(remaining); wheel.lock(false); $('#spin').disabled = false;
          led('SPIN AGAIN', `${remaining.length} groups left on the wheel`);
        }
      }, 1600);
    },
  });

  // ---------- claw machine ----------
  const machine = Machine($('#machine'), {
    sfx: (n, v) => SFX[n] && SFX[n](v),
    motor: (l, p) => SFX.motor(l, p),
    onReady() { led(`${order[turn].name.toUpperCase()} · YOUR MOVE`, 'Aim with the stick, then GRAB. 15 seconds.'); },
    onNeedMove() { led('MOVE THE CLAW FIRST', 'Steer it over a can, then grab.'); SFX.miss(); },
    onTimeUp() { banner('TIME UP'); led('TIME UP!', 'The claw picks by itself.'); },
    onMiss() { banner('MISS!'); SFX.miss(); led('SO CLOSE!', 'The timer is reset. Try again.'); },
    onSlip() { banner('SLIPPED!'); led('IT SLIPPED!', 'Hard claw is on. Aim for the middle.'); },
    onPick(can, bonus) { showReveal(can, bonus); },
  });

  // ---------- setup ----------
  function buildGroups() {
    groups = roster.groups.map((g, i) => ({ no: i + 1, name: g.name, sty: i, members: g.members.filter(m => !m.away).map(m => m.name) }))
      .filter(g => g.members.length);
    const p = Roster.present(roster);
    $('#rosterCount').textContent = `${p} · ${groups.length}`;
    $('#openRoster').setAttribute('aria-label', `Roster: ${p} students here in ${groups.length} groups. Edit.`);
  }
  function reset() {
    buildGroups();
    phase = 'order'; remaining = groups.slice(); order = []; results = []; turn = -1; revealCan = null;
    wheel.setGroups(remaining); wheel.lock(false);
    $('#spin').disabled = groups.length < 2;
    $('#endRow').hidden = true; $('#reveal').hidden = true;
    machine.attract(groups.flatMap(g => g.members));
    renderTickets(); renderLegend(); setFlip('--'); stepRail(2);
    led(groups.length < 2 ? 'NEED 2 GROUPS' : 'FLICK THE WHEEL', groups.length < 2 ? 'Open the roster and add groups.' : 'The ball decides which group plays first.');
  }

  function renderLegend() {
    const ul = $('#legend'); ul.innerHTML = '';
    groups.forEach(g => {
      const li = document.createElement('li');
      if (!remaining.includes(g)) li.className = 'out';
      const n = document.createElement('span'); n.className = 'num'; n.textContent = g.no;
      const s = GROUP[g.sty % GROUP.length]; n.style.background = s.bg; n.style.color = s.fg;
      const t = document.createElement('span'); t.textContent = `${g.name} · ${g.members.length}`;
      li.append(n, t); ul.append(li);
    });
  }

  function renderTickets(popIdx) {
    const ol = $('#tickets'); ol.innerHTML = '';
    for (let i = 0; i < groups.length; i++) {
      const g = order[i], r = results[i], li = document.createElement('li');
      li.className = 'ticket';
      if (phase === 'play' && i === turn) li.classList.add('cur');
      if (r && r.pick) li.classList.add('done');
      if (i === popIdx) li.classList.add('pop');
      const stub = document.createElement('div'); stub.className = 'stub'; stub.textContent = g ? `#${i + 1}` : '?';
      const body = document.createElement('div'); body.className = 'tbody';
      if (g) {
        const tg = document.createElement('div'); tg.className = 'tg';
        const n = document.createElement('span'); n.className = 'num'; n.textContent = g.no;
        const s = GROUP[g.sty % GROUP.length]; n.style.background = s.bg; n.style.color = s.fg;
        const nm = document.createElement('span'); nm.textContent = g.name;
        tg.append(n, nm); body.append(tg);
        const tp = document.createElement('div');
        if (r && r.pick) { tp.className = 'tp'; tp.textContent = r.pick; }
        else {
          tp.className = 'tp wait';
          tp.textContent = phase === 'play' && i === turn ? (revealCan ? `Checking ${revealCan.name}…` : 'Catching now…')
            : phase === 'done' || (r && r.none) ? 'Nobody here' : `${g.members.length} cans waiting`;
        }
        body.append(tp);
        if (r && r.absent.length) {
          const ta = document.createElement('div'); ta.className = 'ta'; ta.append('Absent: ');
          r.absent.forEach((nm2, k) => { if (k) ta.append(', '); const s2 = document.createElement('s'); s2.textContent = nm2; ta.append(s2); });
          body.append(ta);
        }
      } else {
        const tp = document.createElement('div'); tp.className = 'tp wait'; tp.textContent = 'Spin to reveal'; body.append(tp);
      }
      li.append(stub, body); ol.append(li);
    }
    const done = results.filter(r => r && (r.pick || r.none)).length;
    $('#ticketSub').textContent = phase === 'order' ? 'Order and picks' : `${done} of ${groups.length} picked`;
  }

  // ---------- rounds ----------
  function startPlay() {
    phase = 'play'; stepRail(3); loadTurn(0);
    // one-column layout: bring the machine into view for the catching part
    if (matchMedia('(max-width: 1080px)').matches) $('.cabinet').scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  }
  function loadTurn(i) {
    turn = i; results[i] = { pick: null, absent: [], none: false }; revealCan = null;
    const g = order[i];
    banner(g.name); SFX.coin();
    machine.play(g.members, g.name);
    led(`${g.name.toUpperCase()} · INSERT COIN`, `${g.members.length} cans dropping in…`);
    renderTickets();
  }
  function nextTurn() { if (turn + 1 < order.length) loadTurn(turn + 1); else finish(); }
  function finish() {
    phase = 'done'; turn = -1; renderTickets();
    banner('GAME CLEAR!'); SFX.fanfare(); confetti(); setTimeout(confetti, 450);
    led('GAME CLEAR!', 'Copy the tickets or play a rematch.'); setFlip('--');
    machine.attract(groups.flatMap(g => g.members));
    $('#endRow').hidden = false;
  }

  // ---------- reveal ----------
  const pc = $('#portrait'), pg = pc.getContext('2d');
  const pdpr = Math.min(2, window.devicePixelRatio || 1);
  pc.width = 150 * pdpr; pc.height = 170 * pdpr;
  function portrait(can, squash = 0, tilt = 0) {
    pg.setTransform(pdpr, 0, 0, pdpr, 0, 0); pg.clearRect(0, 0, 150, 170);
    const sq = Math.min(.62, squash);
    drawCan(pg, can, 75, 88 + sq * 50, tilt, 96, 128, { squash: sq, shadow: true });
  }
  function animate(ms, fn, done) {
    const t0 = performance.now();
    (function tick(now) { const k = Math.min(1, (now - t0) / ms); fn(k); if (k < 1) requestAnimationFrame(tick); else done && done(); })(t0);
  }
  function showReveal(can, bonus) {
    revealCan = can;
    portrait(can);
    $('#rvGroup').innerHTML = '';
    const g = order[turn], n = document.createElement('span'); n.className = 'num'; n.textContent = g.no;
    const s = GROUP[g.sty % GROUP.length]; n.style.background = s.bg; n.style.color = s.fg;
    $('#rvGroup').append(n, `${g.name}${bonus ? ' · Bonus drop!' : ''}`);
    $('#rvName').textContent = can.name;
    const st = $('#stamp'); st.className = 'stamp'; st.textContent = '';
    $('#here').disabled = $('#absent').disabled = false;
    $('#reveal').hidden = false;
    const card = $('#card'); card.classList.remove('in'); void card.offsetWidth; card.classList.add('in');
    SFX.fanfare();
    led(`PICKED: ${can.name.toUpperCase()}`, 'Is this student here today?');
    renderTickets();
    $('#here').focus({ preventScroll: true });
    if (!reduced) animate(500, k => portrait(can, 0, Math.sin(k * Math.PI * 3) * .12 * (1 - k)));
  }
  function stamp(text, cls) {
    const st = $('#stamp'); st.textContent = text; st.className = 'stamp ' + cls; void st.offsetWidth; st.classList.add('go');
    const card = $('#card'); card.classList.remove('thud', 'in'); void card.offsetWidth; card.classList.add('thud');
    SFX.stamp(); machine.kick(5);
  }
  function markHere() {
    if (!revealCan) return;
    const can = revealCan; revealCan = null;
    $('#here').disabled = $('#absent').disabled = true;
    stamp('PRESENT', 'ok'); setTimeout(SFX.popTop, 120); confetti();
    results[turn].pick = can.name; renderTickets(turn);
    led(`${can.name.toUpperCase()} IS UP!`, turn + 1 < order.length ? `Next: ${order[turn + 1].name}` : 'That was the last group.');
    setTimeout(() => { $('#reveal').hidden = true; nextTurn(); }, 1700);
  }
  function markAbsent() {
    if (!revealCan) return;
    const can = revealCan; revealCan = null;
    $('#here').disabled = $('#absent').disabled = true;
    stamp('ABSENT', 'no'); setTimeout(SFX.crush, 100); setTimeout(SFX.buzz, 380);
    if (!reduced) animate(420, k => portrait(can, k * .62));
    else portrait(can, .62);
    results[turn].absent.push(can.name); renderTickets(turn);
    setTimeout(() => {
      $('#reveal').hidden = true;
      const left = machine.left();
      if (left > 0) {
        machine.resume(); banner('ONE MORE CHANCE!'); SFX.coin();
        led('ONE MORE CHANCE!', `${left} can${left === 1 ? '' : 's'} left for ${order[turn].name}.`);
        renderTickets();
      } else {
        results[turn].none = true; renderTickets();
        banner('NOBODY LEFT'); led('NOBODY LEFT', `No one from ${order[turn].name} is here.`);
        setTimeout(nextTurn, 1600);
      }
    }, 1400);
  }
  $('#here').addEventListener('click', markHere);
  $('#absent').addEventListener('click', markAbsent);

  // ---------- controls ----------
  $('#spin').addEventListener('click', () => { SFX.unlock(); if (phase === 'order') wheel.spin(); });
  const joy = $('#joy'), stick = $('#joyStick');
  let joyId = null, keyDir = 0;
  function setJoy(v) {
    stick.style.transform = `rotate(${v * 30}deg)`;
    joy.setAttribute('aria-valuenow', v.toFixed(1));
    machine.setInput(v);
  }
  function moveJoy(e) {
    const r = joy.getBoundingClientRect();
    setJoy(Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (r.width * .34))));
  }
  joy.addEventListener('pointerdown', e => { SFX.unlock(); joyId = e.pointerId; joy.setPointerCapture(e.pointerId); joy.classList.add('dragging'); moveJoy(e); });
  joy.addEventListener('pointermove', e => { if (e.pointerId === joyId) moveJoy(e); });
  ['pointerup', 'pointercancel'].forEach(t => joy.addEventListener(t, e => {
    if (e.pointerId !== joyId) return;
    joyId = null; joy.classList.remove('dragging'); setJoy(keyDir);
  }));
  function grab() {
    SFX.unlock();
    const b = $('#grab'); b.classList.add('hit'); setTimeout(() => b.classList.remove('hit'), 140);
    if (phase === 'play') machine.drop();
    else if (phase === 'order') led('SPIN THE WHEEL FIRST', 'The order decides which group catches first.');
  }
  $('#grab').addEventListener('click', grab);
  $('#auto').addEventListener('click', () => { SFX.unlock(); machine.autoAim(); });

  const held = new Set();
  const syncKeys = () => { keyDir = (held.has('R') ? 1 : 0) - (held.has('L') ? 1 : 0); if (joyId == null) setJoy(keyDir); };
  addEventListener('keydown', e => {
    const tag = e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || !$('#modal').hidden) return;
    SFX.unlock();
    const k = e.key;
    if (!$('#reveal').hidden) {
      if (k === 'h' || k === 'H') { markHere(); e.preventDefault(); }
      if (k === 'x' || k === 'X') { markAbsent(); e.preventDefault(); }
      return;
    }
    if (k === 'ArrowLeft' || k === 'a' || k === 'A') { held.add('L'); syncKeys(); e.preventDefault(); }
    else if (k === 'ArrowRight' || k === 'd' || k === 'D') { held.add('R'); syncKeys(); e.preventDefault(); }
    else if ((k === ' ' || k === 'ArrowDown' || k === 'Enter') && !e.repeat) {
      if (tag === 'BUTTON' && k !== 'ArrowDown') return;
      if (phase === 'order') wheel.spin(); else if (phase === 'play') grab();
      e.preventDefault();
    }
  });
  addEventListener('keyup', e => {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') held.delete('L');
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') held.delete('R');
    syncKeys();
  });
  addEventListener('blur', () => { held.clear(); syncKeys(); });
  addEventListener('pointerdown', () => SFX.unlock(), { capture: true });

  $('#hard').addEventListener('click', e => {
    const on = e.currentTarget.getAttribute('aria-pressed') !== 'true';
    e.currentTarget.setAttribute('aria-pressed', String(on)); machine.setHard(on);
  });
  $('#sound').addEventListener('click', e => { SFX.unlock(); e.currentTarget.setAttribute('aria-pressed', String(SFX.toggle())); });
  $('#openRoster').addEventListener('click', () => {
    stepRail(1);
    Roster.open(roster, r => { roster = r; reset(); }, () => stepRail(phase === 'order' ? 2 : 3));
  });
  Roster.wire();
  $('#again').addEventListener('click', reset);
  $('#copy').addEventListener('click', () => {
    const txt = 'Tin Can Roulette results\n' + order.map((g, i) => {
      const r = results[i] || { absent: [] };
      return `#${i + 1} ${g.name}: ${r.pick || 'nobody here'}${r.absent.length ? ` (absent: ${r.absent.join(', ')})` : ''}`;
    }).join('\n');
    const btn = $('#copy');
    (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject())
      .then(() => { btn.textContent = 'Copied'; setTimeout(() => btn.textContent = 'Copy results', 1500); })
      .catch(() => led('COPY WAS BLOCKED', 'Select the tickets and copy them by hand.'));
  });

  // ---------- marquee bulbs + confetti ----------
  const bulbRows = document.querySelectorAll('.bulbs');
  bulbRows.forEach(row => { for (let i = 0; i < 16; i++) row.append(document.createElement('i')); });
  const fx = $('#fx'), fxg = fx.getContext('2d');
  let bits = [];
  function sizeFx() { const d = Math.min(2, window.devicePixelRatio || 1); fx.width = innerWidth * d; fx.height = innerHeight * d; fxg.setTransform(d, 0, 0, d, 0, 0); }
  sizeFx(); addEventListener('resize', sizeFx);
  function confetti() {
    if (reduced) return;
    const box = $('#machine').getBoundingClientRect(), ox = box.left + box.width / 2, oy = box.top + box.height * .35;
    const cols = [C.TOMATO, C.MUSTARD, C.COBALT, C.MINT, C.WHITE];
    for (let i = 0; i < 140; i++) bits.push({
      x: ox, y: oy, vx: (Math.random() - .5) * 13, vy: -Math.random() * 11 - 3, s: 5 + Math.random() * 6,
      r: Math.random() * 6, vr: (Math.random() - .5) * .35, c: cols[i % cols.length], star: i % 7 === 0, life: 130 + Math.random() * 50 });
  }

  // ---------- loop ----------
  let last = performance.now(), lastSec = -1;
  function frame(now) {
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    wheel.step(dt);
    machine.frame(dt);
    if (phase === 'play' && machine.mode === 'aim') {
      const s = Math.ceil(machine.timer);
      if (s !== lastSec) { lastSec = s; setFlip(String(s)); if (s <= 3 && s > 0) SFX.beep(s === 1); }
    } else if (lastSec !== -1) { lastSec = -1; setFlip('--'); }
    const k = Math.floor(now / 140);
    bulbRows.forEach((row, ri) => [...row.children].forEach((b, i) => b.classList.toggle('on', reduced || (i + k + ri) % 3 === 0)));
    fxg.clearRect(0, 0, innerWidth, innerHeight);
    bits = bits.filter(b => b.life-- > 0 && b.y < innerHeight + 30);
    for (const b of bits) {
      b.vy += .3; b.vx *= .99; b.x += b.vx; b.y += b.vy; b.r += b.vr;
      fxg.save(); fxg.translate(b.x, b.y); fxg.rotate(b.r); fxg.fillStyle = b.c; fxg.strokeStyle = C.INK; fxg.lineWidth = 1.2;
      if (b.star) { ART.star(fxg, 0, 0, b.s * .8); fxg.fill(); fxg.stroke(); }
      else { fxg.fillRect(-b.s / 2, -b.s / 4, b.s, b.s / 2); fxg.strokeRect(-b.s / 2, -b.s / 4, b.s, b.s / 2); }
      fxg.restore();
    }
    requestAnimationFrame(frame);
  }

  reset();
  requestAnimationFrame(frame);
  // #debug exposes the parts so a test can step frames by hand
  if (location.hash === '#debug') window.__claw = {
    wheel, machine, get phase() { return phase; },
    tick(n = 60) { for (let i = 0; i < n; i++) { wheel.step(1 / 60); machine.frame(1 / 60); } },
  };
  if (document.fonts) document.fonts.ready.then(() => { setFlip('--'); });
})();
