// Roll Call Crane: the director. Act 1 sets the order (wheel or race), act 2 runs the crane once per group,
// the reveal takes the room, the teacher marks present or absent. Everything the class sees is staged here:
// house lights and letterbox follow the camera's drama, the countdown sits on the glass, the name gets the room.
(() => {
  const $ = s => document.querySelector(s);
  const { C, GROUP } = ART;
  const body = document.body, stage = $('#stage');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ANIMAL_KEYS = ['redpanda', 'turtle', 'axolotl', 'shark', 'pangolin'];
  const ORD = ['1ST', '2ND', '3RD', '4TH', '5TH', '6TH', '7TH', '8TH'];
  const WORD = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth'];
  const sfx = (n, v) => SFX[n] && SFX[n](v);
  const animalOf = key => (window.ANIMALS || {})[key];

  let roster = Roster.load();
  let groups = [];                  // { no, name, sty, animal, members: [names present] }
  let act = 'order', mode = 'wheel';
  let remaining = [], order = [], results = [], turn = -1;
  let revealCan = null, revealAt = 0, holdTimer = null, holdUntil = 0, lastMark = null, pendingNext = null, absentTimer = null;
  try { mode = localStorage.getItem('rcc-order-mode') === 'race' ? 'race' : 'wheel'; } catch (e) {}

  // ---------- small helpers ----------
  const upper = s => s.toUpperCase();
  const short = s => s.length > 12 ? s.slice(0, 11) + '…' : s;
  const copiesFor = n => Math.max(2, Math.min(6, Math.round(16 / Math.max(1, n))));
  const bibOf = g => { const s = GROUP[g.sty % GROUP.length]; return { n: g.no, bg: s.bg, fg: s.fg }; };
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
  function say(state, line = '') { $('#msg').textContent = state; $('#sub').textContent = line; }
  function sign(main, subline = '') { $('#sign').textContent = main; $('#signsub').textContent = subline; }
  function setAct(a) { act = a; body.dataset.act = a; }
  function badge(g) {
    const s = GROUP[g.sty % GROUP.length], b = document.createElement('span');
    b.className = 'g'; b.textContent = g.no; b.style.background = s.bg; b.style.color = s.fg; return b;
  }

  // ---------- fit the 1600x900 stage to the window ----------
  function fit() {
    const flow = innerWidth < 760 && innerHeight > innerWidth * 1.05;
    body.classList.toggle('flow', flow);
    stage.style.setProperty('--fit', Math.min(innerWidth / 1600, innerHeight / 900));
  }
  fit(); addEventListener('resize', fit);

  // ---------- the order wheel ----------
  const wheel = Roulette($('#wheel'), {
    unlock: SFX.unlock, sfx, roll: v => SFX.roll(v),
    onLaunch() { $('#spin').disabled = true; say('BALL ON THE TRACK', 'It slows, drops and lands in a pocket.'); },
    onWeak() { say('TOO SLOW TO LAUNCH', 'Drag the wheel and let go faster, or press Spin.'); },
    onResult(gi) {
      const g = remaining[gi];
      wheel.lock(true); sfx('ding');
      say(`${ORD[order.length]} · ${upper(short(g.name))}`, `${g.name} goes ${WORD[order.length]}.`);
      setTimeout(() => {
        remaining.splice(gi, 1); order.push(g); renderRows(order.length - 1);
        if (remaining.length === 1) {
          const last = remaining.pop();
          setTimeout(() => {
            order.push(last); wheel.setGroups([]); renderRows(order.length - 1);
            say('ORDER SET', `${last.name} goes last. The crane loads ${order[0].name} now.`);
            setTimeout(startPlay, 1900);
          }, 700);
        } else {
          wheel.setGroups(remaining); wheel.lock(false); $('#spin').disabled = false;
          say(`SPIN FOR ${ORD[order.length]}`, `${plural(remaining.length, 'group')} left on the wheel.`);
        }
      }, 1500);
    },
  });

  // ---------- the animal race ----------
  const race = Race($('#race'), {
    sfx, roll: v => SFX.roll(v),
    onLine() {},                       // the race prints its own commentary strip
    onFinish(list) {
      order = list.slice(); remaining = [];
      renderRows();
      say('ORDER SET', `${order[0].name} goes first. The crane loads now.`);
      setTimeout(startPlay, 1800);
    },
  });

  // ---------- the crane ----------
  const machine = Machine($('#machine'), {
    sfx, motor: (l, p) => SFX.motor(l, p),
    onReady() { say('COUNTDOWN', 'Then the crane picks one name. Every name has the same odds.'); },
    onSeek() { say('CRANE IS CHOOSING', 'It stops over one can and drops.'); },
    onMiss() { sfx('miss'); say('NO GRAB', 'Nothing in the chute. The crane goes again.'); },
    onSlip() { say('CAN SLIPPED', 'Weak grip is on. The crane goes again.'); },
    onPick(can) { showReveal(can); },
    onBeat() {},
  });

  // ---------- setup ----------
  function buildGroups() {
    groups = roster.groups.map((g, i) => ({
      no: i + 1, name: g.name, sty: i, animal: g.animal || ANIMAL_KEYS[i % ANIMAL_KEYS.length],
      members: g.members.filter(m => !m.away).map(m => m.name),
    })).filter(g => g.members.length);
    const p = Roster.present(roster);
    $('#rosterCount').textContent = `· ${p} in ${plural(groups.length, 'group')}`;
  }
  function reset() {
    clearTimeout(holdTimer); clearTimeout(pendingNext); clearTimeout(absentTimer); holdTimer = pendingNext = absentTimer = null;
    buildGroups();
    setAct('order'); remaining = groups.slice(); order = []; results = []; turn = -1; revealCan = null; lastMark = null;
    $('#reveal').hidden = true; $('#board').hidden = true;
    wheel.setGroups(remaining); wheel.lock(false);
    machine.attract(groups.flatMap(g => g.members));
    sign('ROLL CALL CRANE', 'One pick per group');
    applyMode();
    race.setup(groups);
    renderRows();
  }
  function applyMode() {
    body.dataset.mode = mode;
    $('#modeWheel').setAttribute('aria-checked', String(mode === 'wheel'));
    $('#modeRace').setAttribute('aria-checked', String(mode === 'race'));
    $('#spinLabel').textContent = mode === 'wheel' ? 'Spin' : 'Start the race';
    $('#spin').disabled = groups.length < 2;
    if (groups.length < 2) { say('NEEDS 2 GROUPS', 'Open the roster and add a group.'); return; }
    if (mode === 'wheel') say('READY', 'Spin the wheel. The ball sets which group goes first.');
    else {
      const names = groups.map(g => (animalOf(g.animal) || { name: g.animal }).name.toLowerCase());
      say('RACE READY', `${plural(groups.length, 'animal')} on the line, one per group. The finishing order sets the order.`);
      $('#sub').title = names.join(', ');
    }
  }
  function setMode(m) {
    if (act !== 'order' || order.length || wheel.busy || race.state === 'count' || race.state === 'run') return;
    mode = m; try { localStorage.setItem('rcc-order-mode', m); } catch (e) {}
    applyMode();
    if (m === 'race') race.setup(groups);
  }
  $('#modeWheel').addEventListener('click', () => setMode('wheel'));
  $('#modeRace').addEventListener('click', () => setMode('race'));

  function spin() {
    SFX.unlock();
    if (act !== 'order' || groups.length < 2) return;
    if (mode === 'wheel') wheel.spin();
    else if (race.state === 'ready') { $('#spin').disabled = true; race.start(); say('RACE ON', 'The finishing order sets the order of the groups.'); }
  }
  $('#spin').addEventListener('click', spin);

  // ---------- the list of order and picks ----------
  function renderRows(pop) {
    const ol = $('#rows'); ol.innerHTML = '';
    for (let i = 0; i < groups.length; i++) {
      const g = order[i], r = results[i], li = document.createElement('li');
      if (act === 'play' && i === turn) li.className = 'cur';
      if (i === pop) li.classList.add('pop');
      const n = document.createElement('span'); n.className = 'n'; n.textContent = i + 1;
      li.append(n);
      if (g) {
        li.append(badge(g));
        const who = document.createElement('span'); who.className = 'who';
        if (r && r.pick) who.textContent = r.pick;
        else if (r && r.none) { who.textContent = 'Nobody here'; who.classList.add('wait'); }
        else if (act === 'play' && i === turn) { who.textContent = revealCan ? `Roll call: ${revealCan.name}` : 'In the machine'; who.classList.add('wait'); }
        else { who.textContent = `${g.name} · ${plural(g.members.length, 'name')}`; who.classList.add('wait'); }
        li.append(who);
        if (r && r.absent.length) {
          const a = document.createElement('span'); a.className = 'abs'; a.append('Absent: ');
          r.absent.forEach((nm, k) => { if (k) a.append(', '); const s = document.createElement('s'); s.textContent = nm; a.append(s); });
          li.append(a);
        }
      } else li.append(document.createElement('span'));
      ol.append(li);
    }
    $('#listHead').textContent = act === 'order' ? 'Order' : 'Order and picks';
    const pool = $('#pool');
    pool.textContent = act === 'order' && remaining.length && mode === 'wheel' ? `On the wheel: ${remaining.map(g => g.name).join(', ')}` : '';
  }

  // ---------- rounds ----------
  function startPlay() {
    setAct('play'); loadTurn(0);
    if (body.classList.contains('flow')) $('.cabinet').scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  }
  function loadTurn(i) {
    turn = i; results[i] = { pick: null, absent: [], none: false }; revealCan = null; lastMark = null;
    const g = order[i], copies = copiesFor(g.members.length);
    machine.setRider(g.animal, bibOf(g));
    machine.play(g.members, g.name, copies);
    sign(upper(g.name), `Now picking · ${plural(g.members.length, 'name')}`);
    say('COIN IN', `${g.name}: ${plural(g.members.length, 'name')}, ${copies} cans each. The crane starts on its own.`);
    sfx('coin'); renderRows();
  }
  function nextTurn() { if (turn + 1 < order.length) loadTurn(turn + 1); else finish(); }
  function finish() {
    setAct('done'); turn = -1; renderRows();
    const ol = $('#boardRows'); ol.innerHTML = $('#rows').innerHTML; ol.querySelectorAll('li').forEach(li => li.classList.remove('cur', 'pop'));
    $('#boardDate').textContent = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    $('#board').hidden = false;
    sign('ROLL CALL DONE', `${plural(order.length, 'group')} picked`);
    say('ALL GROUPS DONE', 'Copy the list or run again.');
    sfx('ding');
  }

  // ---------- reveal ----------
  const pc = $('#portrait'), pg = pc.getContext('2d');
  const pdpr = Math.min(2, window.devicePixelRatio || 1);
  pc.width = 520 * pdpr; pc.height = 560 * pdpr;
  const rv = { t: 0, spin: .5, squash: 0, pose: 'idle', running: false, last: 0 };
  function paintPortrait(now) {
    if (!rv.running) return;
    const dt = Math.min(.05, (now - rv.last) / 1000 || 0); rv.last = now; rv.t += dt;
    const can = revealCan || rv.can;
    pg.setTransform(pdpr, 0, 0, pdpr, 0, 0); pg.clearRect(0, 0, 520, 560);
    // a pool of lamp light on the floor
    // an elliptical pool that fades out well inside the canvas, so no edge shows on the black room
    pg.save(); pg.translate(260, 478); pg.scale(1, .3);
    const pool = pg.createRadialGradient(0, 0, 8, 0, 0, 250);
    pool.addColorStop(0, 'rgba(255,233,196,.3)'); pool.addColorStop(1, 'rgba(255,233,196,0)');
    pg.fillStyle = pool; pg.beginPath(); pg.arc(0, 0, 250, 0, Math.PI * 2); pg.fill(); pg.restore();
    if (can) {
      const k = Math.min(1, rv.t / 1.1), e = 1 - Math.pow(1 - k, 3);
      const spin = reduced ? 0 : .5 * (1 - e);
      const sq = rv.squash, w = 200, h = w * (can.h / can.w);
      ART.drawCan(pg, can, 200, 470 - h / 2 * (1 - sq * .7), 0, w, h, { spin, squash: sq, shadow: true, rim: 1 });
    }
    const g = order[turn] || rv.group, A = g && animalOf(g.animal);
    if (A) { pg.save(); pg.translate(408, 500); A.draw(pg, { t: rv.t, mode: rv.pose, speed: 1, emotion: 'cheer', look: 0, bib: bibOf(g), scale: 1.45 }); pg.restore(); }
    requestAnimationFrame(paintPortrait);
  }
  function fitName(el, maxW) {
    for (let s = 125; s >= 62; s -= 3) { el.style.fontStretch = s + '%'; if (el.scrollWidth <= maxW) return; }
    let size = parseFloat(getComputedStyle(el).fontSize);
    while (el.scrollWidth > maxW && size > 24) { size -= 4; el.style.fontSize = size + 'px'; }
  }
  function showReveal(can) {
    revealCan = can; rv.can = can; rv.group = order[turn]; rv.t = 0; rv.squash = 0; rv.pose = 'idle';
    const g = order[turn], [first, last] = ART.splitName(can.name);
    const grp = $('#rvGroup'); grp.innerHTML = ''; grp.append(badge(g), g.name);
    const f = $('#rvFirst'), l = $('#rvLast');
    f.className = ''; l.className = ''; f.style.fontSize = ''; l.style.fontSize = '';
    f.textContent = first; l.textContent = last;
    $('#rvNext').innerHTML = ''; $('#stamp').className = 'stamp'; $('#stamp').textContent = '';
    $('#rvKeys').classList.remove('on'); $('#undo').hidden = true;
    $('#here').disabled = $('#absent').disabled = false;
    $('#reveal').hidden = false;
    const maxW = $('.rv-text').clientWidth || innerWidth * .5;
    fitName(f, maxW); fitName(l, maxW);
    revealAt = performance.now();
    sfx('vacuum', 500);
    say('IN THE CHUTE', `${can.name}. Mark present (P) or absent (A).`);
    renderRows();
    if (!rv.running) { rv.running = true; rv.last = performance.now(); requestAnimationFrame(paintPortrait); }
    setTimeout(() => { if (revealCan === can) { f.classList.add('in'); sfx('sting'); rv.pose = 'cheer'; } }, reduced ? 0 : 1100);
    setTimeout(() => { if (revealCan === can) l.classList.add('in'); }, reduced ? 0 : 1550);
    setTimeout(() => { if (revealCan === can) $('#rvKeys').classList.add('on'); }, reduced ? 0 : 1800);
  }
  function stamp(text, cls) {
    const st = $('#stamp'); st.textContent = text; st.className = 'stamp ' + cls; void st.offsetWidth; st.classList.add('go');
    sfx('stamp');
  }
  const canDecide = () => revealCan && !$('#reveal').hidden && performance.now() - revealAt > (reduced ? 200 : 1200);
  function markHere() {
    if (!canDecide()) return;
    const can = revealCan; revealCan = null;
    $('#here').disabled = $('#absent').disabled = true;
    stamp('PRESENT', 'ok'); setTimeout(() => sfx('popTop'), 110);
    results[turn].pick = can.name; renderRows(turn);
    lastMark = { kind: 'here', turn, can };
    $('#undo').hidden = false;
    const nextG = order[turn + 1];
    say('PRESENT', nextG ? `${can.name}. ${nextG.name} loads next.` : `${can.name}. That was the last group.`);
    const holdMs = 4000;
    const nx = $('#rvNext'); nx.innerHTML = '';
    nx.append(nextG ? `Next: ${nextG.name}. Space to go now.` : 'That was the last group. Space to see the list.');
    const barEl = document.createElement('span'); barEl.className = 'bar'; nx.append(barEl);
    barEl.animate([{ transform: 'scaleX(1)' }, { transform: 'scaleX(0)' }], { duration: holdMs, easing: 'linear', fill: 'forwards' });
    holdUntil = performance.now() + holdMs;
    holdTimer = setTimeout(proceed, holdMs);
  }
  function proceed() {
    clearTimeout(holdTimer); holdTimer = null; holdUntil = 0;
    if (lastMark && lastMark.kind === 'here' && lastMark.turn === turn) lastMark = null;
    rv.running = false; $('#reveal').hidden = true;
    nextTurn();
  }
  function markAbsent() {
    if (!canDecide()) return;
    const can = revealCan; revealCan = null;
    $('#here').disabled = $('#absent').disabled = true;
    stamp('ABSENT', 'no'); setTimeout(() => sfx('crush'), 90);
    const t0 = performance.now();
    const crush = now => { const k = Math.min(1, (now - t0) / 320); rv.squash = .62 * k * k; rv.pose = 'worry'; if (k < 1) requestAnimationFrame(crush); };
    if (!reduced) requestAnimationFrame(crush); else rv.squash = .62;
    results[turn].absent.push(can.name); renderRows(turn);
    lastMark = { kind: 'absent', turn, can };
    $('#undo').hidden = false;
    const g = order[turn];
    clearTimeout(absentTimer);
    absentTimer = setTimeout(() => {
      absentTimer = null;
      rv.running = false; $('#reveal').hidden = true;
      machine.removeStudent(can.name);
      const left = machine.students();
      if (left > 0) {
        machine.resume();
        say('ABSENT', `${plural(left, 'name')} left in ${g.name}. The crane goes again.`);
      } else {
        results[turn].none = true; renderRows();
        say('NOBODY HERE', order[turn + 1] ? `No one from ${g.name} is here. ${order[turn + 1].name} loads next.` : `No one from ${g.name} is here.`);
        pendingNext = setTimeout(nextTurn, 2400);
      }
    }, 1300);
  }
  function undo() {
    const m = lastMark;
    if (!m || m.turn !== turn) return;
    if (m.kind === 'here' && holdTimer) {
      clearTimeout(holdTimer); holdTimer = null;
      results[turn].pick = null; revealCan = m.can; revealAt = 0; lastMark = null;
      $('#stamp').className = 'stamp'; $('#rvNext').innerHTML = ''; $('#undo').hidden = true;
      $('#here').disabled = $('#absent').disabled = false;
      say('UNDONE', `${m.can.name}. Mark present (P) or absent (A).`);
      renderRows();
    } else if (m.kind === 'absent' && (absentTimer || pendingNext || machine.mode === 'aim' || machine.mode === 'seek' || machine.mode === 'load')) {
      clearTimeout(pendingNext); pendingNext = null;
      const r = results[turn], i = r.absent.lastIndexOf(m.can.name);
      if (i >= 0) r.absent.splice(i, 1);
      r.none = false; lastMark = null;
      if (absentTimer) {
        // still on the reveal: cancel the exit, take the stamp back and let the teacher decide again
        clearTimeout(absentTimer); absentTimer = null;
        rv.squash = 0; rv.pose = 'cheer'; revealCan = m.can; revealAt = 0;
        $('#stamp').className = 'stamp'; $('#undo').hidden = true; $('#here').disabled = $('#absent').disabled = false;
        say('UNDONE', `${m.can.name}. Mark present (P) or absent (A).`);
      } else {
        machine.restoreStudent(m.can.name);
        if (machine.mode !== 'aim' && machine.mode !== 'seek' && machine.mode !== 'load') machine.resume();
        say('UNDONE', `${m.can.name} is back in the machine.`);
      }
      renderRows();
    }
  }
  $('#here').addEventListener('click', markHere);
  $('#absent').addEventListener('click', markAbsent);
  $('#undo').addEventListener('click', undo);

  // ---------- teacher controls ----------
  function startNow() {
    const b = $('#start'); b.classList.add('hit'); setTimeout(() => b.classList.remove('hit'), 140);
    machine.go();
  }
  $('#start').addEventListener('click', () => { SFX.unlock(); startNow(); });
  $('#hard').addEventListener('click', e => {
    const on = e.currentTarget.getAttribute('aria-pressed') !== 'true';
    e.currentTarget.setAttribute('aria-pressed', String(on)); e.currentTarget.textContent = `Weak grip: ${on ? 'on' : 'off'}`;
    machine.setHard(on); e.currentTarget.blur();
  });
  function toggleSound() {
    SFX.unlock(); const on = SFX.toggle();
    const b = $('#sound'); b.setAttribute('aria-pressed', String(on)); b.textContent = `Sound: ${on ? 'on' : 'off'}`; b.blur();
  }
  $('#sound').addEventListener('click', toggleSound);
  function toggleFull() {
    const d = document;
    if (d.fullscreenElement) d.exitFullscreen && d.exitFullscreen();
    else d.documentElement.requestFullscreen && d.documentElement.requestFullscreen().catch(() => {});
    $('#full').blur();
  }
  $('#full').addEventListener('click', toggleFull);
  document.addEventListener('fullscreenchange', () => body.classList.toggle('presenting', !!document.fullscreenElement));
  let idleT = null;
  addEventListener('pointermove', () => { body.classList.remove('idle'); clearTimeout(idleT); idleT = setTimeout(() => body.classList.add('idle'), 2200); });
  const keys = $('#keys');
  $('#keysBtn').addEventListener('click', () => { keys.hidden = false; $('#keysClose').focus(); });
  $('#keysClose').addEventListener('click', () => { keys.hidden = true; stage.focus(); });
  function openRoster() {
    const picked = results.filter(r => r && (r.pick || r.none)).length;
    Roster.open(roster, r => { roster = r; reset(); }, () => stage.focus(), { midGame: act !== 'order' || order.length > 0, picked });
  }
  $('#openRoster').addEventListener('click', openRoster);
  Roster.wire();
  $('#again').addEventListener('click', reset);
  $('#copy').addEventListener('click', () => {
    const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    const txt = `Roll Call Crane · ${date}\n` + order.map((g, i) => {
      const r = results[i] || { absent: [] };
      return `${i + 1}. ${g.name}: ${r.pick || 'nobody here'}${r.absent.length ? ` (absent: ${r.absent.join(', ')})` : ''}`;
    }).join('\n');
    const btn = $('#copy');
    (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject())
      .then(() => { btn.textContent = 'Copied'; setTimeout(() => btn.textContent = 'Copy list', 1500); })
      .catch(() => say('CLIPBOARD BLOCKED', 'Select the list and copy it by hand.'));
  });

  addEventListener('keydown', e => {
    if (e.target.closest && e.target.closest('.sheet')) return;
    if (!$('#modal').hidden) return;
    const k = e.key;
    if (!keys.hidden) { if (k === 'Escape' || k === '?') keys.hidden = true; return; }
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
    SFX.unlock();
    const lower = k.length === 1 ? k.toLowerCase() : k;
    if (lower === 'f') { toggleFull(); e.preventDefault(); return; }
    if (lower === 'm') { toggleSound(); e.preventDefault(); return; }
    if (lower === '?') { keys.hidden = false; e.preventDefault(); return; }
    if (lower === 'z' || (k === 'Backspace' && !$('#reveal').hidden)) { undo(); e.preventDefault(); return; }
    if (lower === 'r' && act === 'order' && !order.length) { openRoster(); e.preventDefault(); return; }
    if (!$('#reveal').hidden) {
      if (lower === 'p' || lower === 'h') { markHere(); e.preventDefault(); }
      else if (lower === 'a' || lower === 'x') { markAbsent(); e.preventDefault(); }
      else if ((k === ' ' || k === 'Enter' || k === 'ArrowRight') && holdTimer) { proceed(); e.preventDefault(); }
      return;
    }
    if (k === ' ' || k === 'Enter' || k === 'ArrowRight' || k === 'PageDown') {
      if (e.target.tagName === 'BUTTON' && k !== 'ArrowRight' && k !== 'PageDown' && e.target !== $('#spin') && e.target !== $('#start')) return;
      if (act === 'order') spin(); else if (act === 'play') startNow();
      e.preventDefault();
    }
  });
  addEventListener('pointerdown', () => SFX.unlock(), { capture: true });

  // ---------- the loop: time, light, sound ----------
  const bulbRows = document.querySelectorAll('.bulbs');
  bulbRows.forEach(row => { for (let i = 0; i < 18; i++) row.append(document.createElement('i')); });
  let last = performance.now(), ts = 1, drama = 0, lastCount = 0, beat = 0, lightsDown = false;
  function lightCenter() {
    const el = act === 'order' ? (mode === 'wheel' ? $('.wheelbox') : $('.racebox')) : $('.glass');
    const r = el.getBoundingClientRect();
    if (!r.width) return;
    body.style.setProperty('--cx', ((r.left + r.width / 2) / innerWidth * 100).toFixed(1) + '%');
    body.style.setProperty('--cy', ((r.top + r.height / 2) / innerHeight * 100).toFixed(1) + '%');
  }
  function frame(now) {
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    let want = 1, d = 0;
    if (act === 'order' && mode === 'wheel') { want = 1 - (wheel.wantSlow || 0); ts += (want - ts) * (1 - Math.exp(-dt * 12)); wheel.step(dt * ts, dt); d = wheel.drama || 0; }
    else if (act === 'order') { race.step(dt); d = race.drama || 0; ts = race.timeScale ?? 1; }
    else { ts = 1; machine.frame(dt, dt); d = machine.drama || 0; }
    if (!$('#reveal').hidden) d = 1;
    drama += (d - drama) * (1 - Math.exp(-dt * 5));
    body.style.setProperty('--drama', drama.toFixed(3));
    const down = drama > .35;
    if (down !== lightsDown) { lightsDown = down; body.classList.toggle('lightsdown', down); }
    if (SFX.slow) SFX.slow(act === 'play' ? (machine.wantSlow ?? 1) : ts);
    lightCenter();
    // countdown numerals on the glass
    const cnt = $('#count');
    if (act === 'play' && machine.mode === 'aim') {
      const n = Math.max(1, Math.ceil(machine.timer / .6));
      if (n !== lastCount) { lastCount = n; cnt.textContent = n; cnt.classList.remove('tick'); void cnt.offsetWidth; cnt.classList.add('tick'); }
      $('#start').classList.add('ready');
    } else { lastCount = 0; $('#start').classList.remove('ready'); }
    // heartbeat while the camera is close
    if (drama > .55 && !reduced) { beat += dt * (1.2 + drama * .6); if (beat >= 1) { beat = 0; sfx('heart', drama); } } else beat = .6;
    // bulbs: chase when idle, all on during the countdown, dark during the grab
    const k = Math.floor(now / 140), m = machine.mode;
    const allOn = act === 'play' && m === 'aim', allOff = drama > .5;
    bulbRows.forEach((row, ri) => [...row.children].forEach((b, i) => b.classList.toggle('on', !allOff && (allOn || reduced || (i + k + ri) % 3 === 0))));
    requestAnimationFrame(frame);
  }

  reset();
  requestAnimationFrame(frame);
  if (location.hash === '#debug') window.__claw = {
    wheel, race, machine, get act() { return act; }, get mode() { return mode; },
    tick(n = 60) { for (let i = 0; i < n; i++) { if (act === 'order' && mode === 'wheel') wheel.step(1 / 60, 1 / 60); else if (act === 'order') race.step(1 / 60); else machine.frame(1 / 60, 1 / 60); } },
  };
})();
