// Roll Call Crane: the director. Act 1 sets the order (wheel or race), act 2 runs the crane once per group,
// the reveal takes the room, the teacher marks present or absent. Board mode is its own game: a light board
// picks single names, and a name that has been picked sits out the next picks. Everything the class sees is staged here:
// house lights and letterbox follow the camera's drama, the countdown sits on the glass, the name gets the room.
(() => {
  const $ = s => document.querySelector(s);
  const { GROUP } = ART;
  const t = (k, v) => I18N.t(k, v);
  const body = document.body, stage = $('#stage');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ANIMAL_KEYS = ['redpanda', 'turtle', 'axolotl', 'shark', 'pangolin'];
  const sfx = (n, v) => SFX[n] && SFX[n](v);
  const animalOf = key => (window.ANIMALS || {})[key];

  let roster = Roster.load();
  let groups = [];                  // { no, name, sty, animal, members: [names present] }
  let act = 'order', mode = 'wheel', orderReady = false, settling = false;
  let remaining = [], order = [], results = [], turn = -1;
  let revealCan = null, revealAt = 0, holdTimer = null, lastMark = null, pendingNext = null, absentTimer = null;
  // a board mark waits for the name card to close, so the class sees the tile fly; landing = the tile is in the air
  let boardPending = null, landing = false;
  // the crane waits for the teacher: after the order is set (a short lockout so a spare Space cannot skip it),
  // before each group's countdown (START), and after PRESENT (Next)
  let craneAt = 0, toCrane = false, nextReady = false, nextAt = 0, curtainTok = 0, flashUntil = 0;
  // game speed (the slider): scales physics, animation and the gaps between beats; holds for calling a name stay readable
  let speed = 1;
  try { speed = Math.max(.5, Math.min(3, +localStorage.getItem('rcc-speed') || 1)); } catch (e) {}
  const T = ms => ms / speed, HOLD = ms => Math.max(1500, ms / speed);
  try { const m = localStorage.getItem('rcc-order-mode'); mode = m === 'race' || m === 'board' ? m : 'wheel'; } catch (e) {}

  // ---------- small helpers ----------
  const upper = s => s.toUpperCase();
  const short = s => s.length > 12 ? s.slice(0, 11) + '…' : s;
  const copiesFor = n => Math.max(2, Math.min(6, Math.round(16 / Math.max(1, n))));
  const bibOf = g => { const s = GROUP[g.sty % GROUP.length]; return { n: g.no, bg: s.bg, fg: s.fg }; };
  const names = n => I18N.count(n, 'n.name', 'n.names');
  const ord = i => t('ord')[i] || `${i + 1}`;
  const today = () => new Date().toLocaleDateString(I18N.lang === 'ko' ? 'ko-KR' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  function say(state, line = '') { $('#msg').textContent = state; $('#sub').textContent = line; }
  function sign(main, subline = '') { $('#sign').textContent = main; $('#signsub').textContent = subline; }
  function setAct(a) { act = a; body.dataset.act = a; lightDirty = true; }
  function badge(g) {
    const s = GROUP[g.sty % GROUP.length], b = document.createElement('span');
    b.className = 'g'; b.textContent = g.no; b.style.background = s.bg; b.style.color = s.fg; return b;
  }
  // a control clicked with the mouse gives the keyboard back to the game, so Space never re-presses it
  const release = el => { if (el && el.blur) el.blur(); stage.focus({ preventScroll: true }); };

  // ---------- fit the 1600x900 stage to the window ----------
  function fit() {
    const flow = innerWidth < 760 && innerHeight > innerWidth * 1.05;
    body.classList.toggle('flow', flow);
    stage.style.setProperty('--fit', Math.min(innerWidth / 1600, innerHeight / 900));
    lightDirty = true;
  }
  let lightDirty = true;
  fit(); addEventListener('resize', fit);

  // ---------- the order wheel ----------
  const wheel = Roulette($('#wheel'), {
    unlock: SFX.unlock, sfx, roll: v => SFX.roll(v),
    onLaunch() { $('#spin').disabled = true; say(t('s.ball')); },
    onWeak() { say(t('s.slow')); },
    onResult(gi) {
      const g = remaining[gi];
      wheel.lock(true); sfx('ding'); settling = true;
      say(t('s.place', { ord: ord(order.length), name: upper(short(g.name)) }));
      setTimeout(() => {
        if (mode !== 'wheel' || act !== 'order') { settling = false; return; }
        remaining.splice(gi, 1); order.push(g); renderRows(order.length - 1);
        if (remaining.length === 1) {
          const last = remaining.pop();
          setTimeout(() => {
            settling = false;
            if (mode !== 'wheel' || act !== 'order') return;
            order.push(last); wheel.setGroups([]); renderRows(order.length - 1);
            awaitCrane();
          }, T(700));
        } else {
          settling = false;
          wheel.setGroups(remaining); wheel.lock(false); $('#spin').disabled = false;
          say(t('s.spinfor', { ord: ord(order.length) }), I18N.count(remaining.length, 'n.groupleft', 'n.groupsleft'));
        }
      }, T(1500));
    },
  });

  // ---------- the animal race ----------
  const race = Race($('#race'), {
    sfx, roll: v => SFX.roll(v),
    onLine() {},                       // the race prints its own commentary strip
    onFinish(list) {
      if (mode !== 'race' || act !== 'order') return;
      order = list.slice(); remaining = [];
      renderRows();
      awaitCrane();
    },
  });

  // ---------- the crane ----------
  const machine = Machine($('#machine'), {
    sfx, motor: (l, p) => SFX.motor(l, p),
    onReady() { if (machine.armed) say(t('s.countdown')); else say(t('s.ready'), t('s.pressstart')); },
    onSeek() { say(t('s.choosing')); },
    onMiss() { sfx('miss'); say(t('s.nograb')); },
    onSlip() { say(t('s.slipped')); },
    onPick(can) { showReveal(can); },
    onBeat(b) { beatFx(b); },
  });
  // the cabinet answers what happens inside: the bulbs flicker and the whole box takes the knock
  function flash(ms) { flashUntil = performance.now() + (reduced ? 0 : ms); }
  function punch(px) {
    if (reduced) return;
    const c = $('.cabinet'), s = Math.random() < .5 ? -1 : 1;
    c.animate([{ transform: 'none' }, { transform: `translate(${s * px}px,${px * .4}px) rotate(${s * px * .05}deg)` },
      { transform: `translate(${-s * px * .6}px,${-px * .2}px)` }, { transform: `translate(${s * px * .25}px,0)` }, { transform: 'none' }],
      { duration: 320, easing: 'cubic-bezier(.2,0,.3,1)' });
  }
  function beatFx(b) {
    if (b === 'slap') { flash(650); punch(9); setTimeout(() => sfx('crowd'), T(180)); }
    else if (b === 'fumble') { flash(420); punch(5); }
    else if (b === 'grip') punch(2.5);
    else if (b === 'jolt') { flash(240); punch(4); }
    else if (b === 'fall') flash(900);
  }
  // two shutters close over the room, the act changes behind them, they open again
  function curtain(mid) {
    const tok = curtainTok, go = () => { if (tok === curtainTok) mid(); };
    if (reduced) { go(); return; }
    const el = $('#curtain'), d = Math.max(260, T(420));
    el.hidden = false;
    for (const h of el.children) h.animate([{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)', offset: .42 }, { transform: 'scaleY(1)', offset: .58 }, { transform: 'scaleY(0)' }],
      { duration: d * 2.4, easing: 'cubic-bezier(.7,0,.3,1)' });
    sfx('whoomp');
    setTimeout(go, d * 1.2);
    setTimeout(() => { el.hidden = true; }, d * 2.4 + 60);
  }

  // ---------- the light board ----------
  const rosterNames = () => roster.groups.flatMap(g => g.members.filter(m => !m.away).map(m => m.name));
  const boardOn = () => mode === 'board' && act === 'order';
  const board = Board($('#boardbox'), {
    sfx,
    onStart() { $('#spin').disabled = true; say(t('s.lights')); },
    onShuffle() { $('#spin').disabled = true; say(t('s.shuffling')); },
    onShuffled() { boardIdle(); },
    onPick(name) { if (boardOn()) showReveal({ name, ...ART.canStyle(name), w: 60, h: 80 }); },
    onChange() { if (boardOn() && !board.busy && !landing && $('#reveal').hidden) boardIdle(); },
    onDuplicate(name) { say(t('s.onboard'), name); },
    onEditExit() { setEditing(false); },
  }, $('#lbTray'));
  board.load(rosterNames());
  function boardIdle() {
    if (!boardOn()) return;
    const left = board.left, total = board.names.length;
    $('#spinLabel').textContent = t('btn.light');
    $('#spin').disabled = !left || board.editing || board.busy || landing;
    $('#lbShuffle').disabled = left < 2 || board.editing || board.busy || landing;
    if (board.editing) say(t('s.editing'), names(total));
    else if (!total) say(t('s.nonames'), t('btn.edit'));
    else if (!left) say(t('s.allpicked'), names(total));
    else say(t('s.ready'), t('n.leftof', { left, total }));
  }
  function setEditing(on) {
    if (board.busy || landing || !$('#reveal').hidden) return;
    on = board.edit(on);
    const b = $('#lbEdit'); b.setAttribute('aria-pressed', String(on)); b.textContent = t(on ? 'btn.done' : 'btn.edit');
    if (!on) stage.focus({ preventScroll: true });
    boardIdle();
  }

  // ---------- setup ----------
  function buildGroups() {
    groups = roster.groups.map((g, i) => ({
      no: i + 1, name: g.name, sty: i, animal: g.animal || ANIMAL_KEYS[i % ANIMAL_KEYS.length],
      members: g.members.filter(m => !m.away).map(m => m.name),
    })).filter(g => g.members.length);
    $('#rosterCount').textContent = `· ${t('roster.count', { p: names(Roster.present(roster)), g: I18N.count(groups.length, 'n.group', 'n.groups') })}`;
  }
  // the wheel/race order starts over (used by reset and when leaving those modes mid-way)
  function resetOrder() {
    orderReady = false; settling = false; remaining = groups.slice(); order = []; results = []; turn = -1;
    wheel.setGroups(remaining); wheel.lock(false);
    race.setup(groups);
  }
  function reset() {
    clearTimeout(holdTimer); clearTimeout(pendingNext); clearTimeout(absentTimer); holdTimer = pendingNext = absentTimer = null;
    curtainTok++; toCrane = false; nextReady = false;
    buildGroups();
    if (board.busy) board.stop();
    setAct('order'); revealCan = null; lastMark = null; boardPending = null;
    $('#reveal').hidden = true; $('#board').hidden = true;
    resetOrder();
    machine.attract(groups.flatMap(g => g.members));
    sign(t('sign.title'));
    applyMode();
    if (mode !== 'board') renderRows();
  }
  function applyMode() {
    body.dataset.mode = mode; lightDirty = true;
    $('#modeWheel').setAttribute('aria-checked', String(mode === 'wheel'));
    $('#modeRace').setAttribute('aria-checked', String(mode === 'race'));
    $('#modeBoard').setAttribute('aria-checked', String(mode === 'board'));
    if (mode === 'board') { board.render(); boardIdle(); return; }
    $('#spinLabel').textContent = orderReady ? t('btn.crane') : t(mode === 'wheel' ? 'btn.spin' : 'btn.race');
    $('#spin').disabled = groups.length < 2 || toCrane || (orderReady && performance.now() < craneAt);
    if (groups.length < 2) { say(t('s.need2'), t('bar.roster')); return; }
    if (orderReady) say(t('s.orderset'));
    else say(t(mode === 'wheel' ? 's.ready' : 's.raceready'));
  }
  function setMode(m) {
    if (m === mode || act !== 'order') return;
    if (settling || toCrane || landing || boardPending || board.busy || wheel.busy || race.state === 'count' || race.state === 'run' || !$('#reveal').hidden) {
      say(t('s.wait')); return;
    }
    if (board.editing) setEditing(false);
    clearTimeout(pendingNext); pendingNext = null;
    if (order.length || orderReady) resetOrder();     // a half-set order belongs to the mode being left
    mode = m; try { localStorage.setItem('rcc-order-mode', m); } catch (e) {}
    applyMode();
    if (m === 'race') race.setup(groups);
    if (m !== 'board') renderRows();
  }
  [['#modeWheel', 'wheel'], ['#modeRace', 'race'], ['#modeBoard', 'board']].forEach(([id, m]) =>
    $(id).addEventListener('click', e => { setMode(m); release(e.currentTarget); }));

  // board tools: edit in place; the two destructive ones need a second, real click
  function shuffleBoard() {
    if (!boardOn() || board.busy || board.editing || !$('#reveal').hidden || boardPending || landing) return;
    SFX.unlock(); board.clearWin(); board.shuffle();
  }
  $('#lbShuffle').addEventListener('click', e => { release(e.currentTarget); shuffleBoard(); });
  $('#lbEdit').addEventListener('click', e => { release(e.currentTarget); setEditing(!board.editing); });
  function armed(btn, key, armedKey, run) {
    btn.addEventListener('click', e => {
      release(btn);
      if (board.busy || landing || !$('#reveal').hidden) return;
      if (btn.classList.contains('arm')) {
        if (e.detail === 0) return;               // a keyboard press never confirms
        clearTimeout(btn._t); btn.classList.remove('arm'); btn.textContent = t(key); run(); return;
      }
      btn.classList.add('arm'); btn.textContent = t(armedKey);
      btn._t = setTimeout(() => { btn.classList.remove('arm'); btn.textContent = t(key); }, 3000);
    });
  }
  armed($('#lbClear'), 'btn.clear', 'btn.clear2', () => { clearTimeout(pendingNext); pendingNext = null; board.clearMarks(); lastMark = null; boardIdle(); });
  armed($('#lbRoster'), 'btn.load', 'btn.load2', () => { clearTimeout(pendingNext); pendingNext = null; board.setNames(rosterNames()); lastMark = null; boardIdle(); });
  function boardText() {
    let n = 0;
    return `${t('copy.board')} · ${today()}\n` + board.marks.map(m => m.kind === 'here' ? `${++n}. ${m.name}` : `   ${m.name} (${t('copy.absent')})`).join('\n');
  }
  function copyText(txt, btn, key) {
    (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject())
      .then(() => { if (btn) { btn.textContent = t('btn.copied'); setTimeout(() => btn.textContent = t(key), 1500); } })
      .catch(() => say(t('s.clip')));
  }
  $('#lbCopy').addEventListener('click', e => { const b = e.currentTarget; release(b); copyText(boardText(), b, 'btn.copy'); });

  // the order is set: hold here until the teacher sends it to the crane
  function awaitCrane() {
    orderReady = true; craneAt = performance.now() + 1400;
    $('#spinLabel').textContent = t('btn.crane'); $('#spin').disabled = true;
    say(t('s.orderset'));
    setTimeout(() => { if (orderReady && act === 'order' && !toCrane) $('#spin').disabled = false; }, 1400);
  }
  function spin() {
    SFX.unlock();
    if (mode === 'board') {
      if (!boardOn() || board.busy || board.editing || !$('#reveal').hidden || boardPending || landing) return;
      clearTimeout(pendingNext); pendingNext = null;
      if (!board.left) { boardIdle(); return; }
      board.clearWin(); board.pick(); return;
    }
    if (act !== 'order' || groups.length < 2 || settling) return;
    if (toCrane) return;
    if (orderReady) {
      if (performance.now() < craneAt) return;
      orderReady = false; toCrane = true; $('#spin').disabled = true;
      curtain(() => { toCrane = false; startPlay(); });
      return;
    }
    if (mode === 'wheel') wheel.spin();
    else if (race.state === 'ready') { $('#spin').disabled = true; race.start(); say(t('s.raceon')); }
  }
  $('#spin').addEventListener('click', e => { spin(); release(e.currentTarget); });

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
        else if (r && r.none) { who.textContent = t('who.nobody'); who.classList.add('wait'); }
        else if (act === 'play' && i === turn) { who.textContent = revealCan ? t('who.rollcall', { name: revealCan.name }) : t('who.inmachine'); who.classList.add('wait'); }
        else { who.textContent = `${g.name} · ${names(g.members.length)}`; who.classList.add('wait'); }
        li.append(who);
        if (r && r.absent.length) {
          const a = document.createElement('span'); a.className = 'abs'; a.append(`${t('tray.absent')}: `);
          r.absent.forEach((nm, k) => { if (k) a.append(', '); const s = document.createElement('s'); s.textContent = nm; a.append(s); });
          li.append(a);
        }
      } else li.append(document.createElement('span'));
      ol.append(li);
    }
    $('#listHead').textContent = act === 'order' ? t('list.order') : t('list.orderpicks');
    $('#pool').textContent = act === 'order' && remaining.length && mode === 'wheel' ? t('list.onwheel', { names: remaining.map(g => g.name).join(', ') }) : '';
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
    sign(upper(g.name), names(g.members.length));
    say(t('s.coin'), t('n.cans', { names: names(g.members.length), cans: g.members.length * copies }));
    sfx('coin'); renderRows();
  }
  function nextTurn() { if (turn + 1 < order.length) loadTurn(turn + 1); else finish(); }
  function finish() {
    setAct('done'); turn = -1; renderRows();
    const ol = $('#boardRows'); ol.innerHTML = $('#rows').innerHTML; ol.querySelectorAll('li').forEach(li => li.classList.remove('cur', 'pop'));
    $('#boardDate').textContent = today();
    $('#board').hidden = false;
    sign(t('sign.done'));
    say(t('s.done'));
    sfx('ding');
  }

  // ---------- reveal ----------
  const pc = $('#portrait'), pg = pc.getContext('2d');
  let pdpr = 1;
  function sizePortrait() { const d = Math.min(2, window.devicePixelRatio || 1); if (d !== pdpr || pc.width !== 520 * d) { pdpr = d; pc.width = 520 * d; pc.height = 560 * d; } }
  sizePortrait();
  const rv = { t: 0, squash: 0, pose: 'idle', running: false, last: 0 };
  function paintPortrait(now) {
    if (!rv.running) return;
    const dt = Math.min(.05, (now - rv.last) / 1000 || 0); rv.last = now; rv.t += dt;
    const can = revealCan || rv.can;
    pg.setTransform(pdpr, 0, 0, pdpr, 0, 0); pg.clearRect(0, 0, 520, 560);
    // the lamp's beam and an elliptical pool that fades out well inside the canvas
    const beam = pg.createLinearGradient(0, 0, 0, 500);
    beam.addColorStop(0, 'rgba(255,233,196,0)'); beam.addColorStop(1, 'rgba(255,233,196,.16)');
    pg.fillStyle = beam; pg.beginPath(); pg.moveTo(190, 0); pg.lineTo(330, 0); pg.lineTo(470, 500); pg.lineTo(50, 500); pg.closePath(); pg.fill();
    pg.save(); pg.translate(260, 478); pg.scale(1, .3);
    const pool = pg.createRadialGradient(0, 0, 8, 0, 0, 250);
    pool.addColorStop(0, 'rgba(255,233,196,.6)'); pool.addColorStop(1, 'rgba(255,233,196,0)');
    pg.fillStyle = pool; pg.beginPath(); pg.arc(0, 0, 250, 0, Math.PI * 2); pg.fill(); pg.restore();
    if (can) {
      const k = Math.min(1, rv.t * speed / 1.1), e = 1 - Math.pow(1 - k, 3);
      const sq = rv.squash, w = 200, h = w * (can.h / can.w);
      // a crane can comes out still wearing its "?" and turns twice; the name comes round on the last half turn
      const mystery = !reduced && can.anonCan, turns = mystery ? 2 * (1 - e) : .5 * (1 - e);
      const face = mystery && turns > .5 ? can.anonCan : can;
      ART.drawCan(pg, face, 200, 470 - h / 2 * (1 - sq * .7), 0, w, h, { spin: reduced ? 0 : turns, squash: sq, shadow: true, rim: 1 });
    }
    const g = mode === 'board' ? null : (order[turn] || rv.group), A = g && animalOf(g.animal);
    if (A) { pg.save(); pg.translate(408, 500); A.draw(pg, { t: rv.t, mode: rv.pose, speed: 1, emotion: 'cheer', look: 0, bib: bibOf(g), scale: 1.45 }); pg.restore(); }
    requestAnimationFrame(paintPortrait);
  }
  function fitName(el, maxW) {
    for (let s = 125; s >= 62; s -= 3) { el.style.fontStretch = s + '%'; if (el.scrollWidth <= maxW) return; }
    let size = parseFloat(getComputedStyle(el).fontSize);
    while (el.scrollWidth > maxW && size > 24) { size -= 4; el.style.fontSize = size + 'px'; }
  }
  function showReveal(can) {
    sizePortrait();
    revealCan = can; rv.can = can; rv.group = mode === 'board' ? null : order[turn]; rv.t = 0; rv.squash = 0; rv.pose = 'idle';
    const g = rv.group, [first, last] = ART.splitName(can.name);
    const grp = $('#rvGroup'); grp.innerHTML = '';
    if (g) grp.append(badge(g), g.name);
    else grp.append(t('pick.n', { n: board.marks.filter(m => m.kind === 'here').length + 1 }));
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
    say(t(mode === 'board' ? 's.picked' : 's.chute'), can.name);
    if (mode !== 'board') renderRows();
    if (!rv.running) { rv.running = true; rv.last = performance.now(); requestAnimationFrame(paintPortrait); }
    setTimeout(() => { if (revealCan === can) { f.classList.add('in'); sfx('sting'); rv.pose = 'cheer'; } }, reduced ? 0 : T(1100));
    setTimeout(() => { if (revealCan === can) l.classList.add('in'); }, reduced ? 0 : T(1550));
    setTimeout(() => { if (revealCan === can) $('#rvKeys').classList.add('on'); }, reduced ? 0 : T(1800));
  }
  function stamp(kind) {
    const st = $('#stamp'); st.textContent = t(kind === 'ok' ? 'stamp.present' : 'stamp.absent');
    st.className = 'stamp ' + kind; void st.offsetWidth; st.classList.add('go');
    sfx('stamp');
  }
  function holdBar(nx, ms) {
    const barEl = document.createElement('span'); barEl.className = 'bar'; nx.append(barEl);
    barEl.animate([{ transform: 'scaleX(1)' }, { transform: 'scaleX(0)' }], { duration: ms, easing: 'linear', fill: 'forwards' });
  }
  const canDecide = () => revealCan && !$('#reveal').hidden && performance.now() - revealAt > (reduced ? 200 : T(1200));
  function markHere() {
    if (!canDecide()) return;
    if (mode === 'board') return boardHere();
    const can = revealCan; revealCan = null;
    $('#here').disabled = $('#absent').disabled = true;
    stamp('ok'); setTimeout(() => sfx('popTop'), 110);
    results[turn].pick = can.name; renderRows(turn);
    lastMark = { kind: 'here', turn, can };
    $('#undo').hidden = false;
    const nextG = order[turn + 1];
    say(t('s.present'), can.name);
    const nx = $('#rvNext'); nx.innerHTML = '';
    const go = document.createElement('button'), kb = document.createElement('kbd');
    go.type = 'button'; go.className = 'rv-go'; kb.textContent = t('kbd.space');
    go.append(nextG ? t('next', { name: nextG.name }) : t('btn.results'), kb);
    go.addEventListener('click', () => { release(go); proceed(); });
    nx.append(go);
    nextReady = true; nextAt = performance.now() + 450;
  }
  function proceed() {
    if (mode === 'board') return boardClose();
    if (!nextReady || performance.now() < nextAt) return;
    nextReady = false;
    if (lastMark && lastMark.kind === 'here' && lastMark.turn === turn) lastMark = null;
    $('#undo').hidden = true;
    curtain(() => { rv.running = false; $('#reveal').hidden = true; nextTurn(); });
  }
  function crushCan(posed) {
    const t0 = performance.now();
    const crush = now => { const k = Math.min(1, (now - t0) / 320); rv.squash = .62 * k * k; if (posed) rv.pose = 'worry'; if (k < 1) requestAnimationFrame(crush); };
    if (!reduced) requestAnimationFrame(crush); else rv.squash = .62;
  }
  function markAbsent() {
    if (!canDecide()) return;
    if (mode === 'board') return boardAbsent();
    const can = revealCan; revealCan = null;
    $('#here').disabled = $('#absent').disabled = true;
    stamp('no'); setTimeout(() => sfx('crush'), 90); crushCan(true);
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
      if (left > 0) { machine.resume(); say(t('s.absent'), t('n.left', { n: left })); }
      else {
        results[turn].none = true; renderRows();
        say(t('s.nobody'), g.name);
        pendingNext = setTimeout(nextTurn, T(2400));
      }
    }, T(1300));
  }
  // ---------- board: present, absent, undo ----------
  function boardHere() {
    const can = revealCan; revealCan = null;
    $('#here').disabled = $('#absent').disabled = true;
    stamp('ok'); setTimeout(() => sfx('popTop'), 110);
    boardPending = { name: can.name, kind: 'here' };
    lastMark = { kind: 'here', board: true, can };
    $('#undo').hidden = false;
    say(t('s.present'), can.name);
    const holdMs = HOLD(3000), nx = $('#rvNext'); nx.innerHTML = '';
    nx.append(board.left - 1 ? t('n.left', { n: board.left - 1 }) : t('all.picked'));
    holdBar(nx, holdMs);
    holdTimer = setTimeout(boardClose, holdMs);
  }
  function boardClose() {
    clearTimeout(holdTimer); holdTimer = null;
    rv.running = false; $('#reveal').hidden = true;
    board.clearWin();
    return landPending().then(boardIdle);
  }
  // the card is gone: now the picked tile flies off the board into the tray
  function landPending() {
    const p = boardPending;
    if (!p) return Promise.resolve();
    boardPending = null; landing = true;
    $('#spin').disabled = true; $('#lbShuffle').disabled = true;
    return Promise.resolve(board.mark(p.name, p.kind)).then(() => { landing = false; });
  }
  function boardAbsent() {
    const can = revealCan; revealCan = null;
    $('#here').disabled = $('#absent').disabled = true;
    stamp('no'); setTimeout(() => sfx('crush'), 90); crushCan(false);
    boardPending = { name: can.name, kind: 'absent' };
    lastMark = { kind: 'absent', board: true, can };
    $('#undo').hidden = false;
    clearTimeout(absentTimer);
    absentTimer = setTimeout(() => {
      absentTimer = null;
      rv.running = false; $('#reveal').hidden = true; board.clearWin();
      landPending().then(() => {
        if (!boardOn()) return;
        if (board.left) {
          say(t('s.absent'), t('n.left', { n: board.left }));
          pendingNext = setTimeout(() => { pendingNext = null; if (boardOn() && $('#reveal').hidden && !board.busy && !boardPending && !landing) board.pick(); }, T(700));
        } else boardIdle();
      });
    }, T(1300));
  }
  function boardUndo() {
    if (board.editing) return;
    const m = lastMark;
    if (holdTimer && m && m.kind === 'here') {
      // still on the name: take the mark back and decide again
      clearTimeout(holdTimer); holdTimer = null;
      boardPending = null;
      revealCan = m.can; revealAt = 0; lastMark = null;
      $('#stamp').className = 'stamp'; $('#rvNext').innerHTML = ''; $('#undo').hidden = true;
      $('#here').disabled = $('#absent').disabled = false;
      say(t('s.undone'), m.can.name);
      return;
    }
    if (absentTimer && m && m.kind === 'absent') {
      clearTimeout(absentTimer); absentTimer = null;
      boardPending = null;
      rv.squash = 0; revealCan = m.can; revealAt = 0; lastMark = null;
      $('#stamp').className = 'stamp'; $('#undo').hidden = true; $('#here').disabled = $('#absent').disabled = false;
      say(t('s.undone'), m.can.name);
      return;
    }
    // otherwise take back the most recent mark on the board (and stop a re-pick that has not started yet)
    if (board.busy || !$('#reveal').hidden || boardPending || landing) return;
    clearTimeout(pendingNext); pendingNext = null;
    const marks = board.marks, lastM = marks[marks.length - 1];
    if (!lastM) return;
    lastMark = null;
    Promise.resolve(board.unmark(lastM.name)).then(boardIdle);
    say(t('s.undone'), lastM.name);
  }
  function undo() {
    if (mode === 'board') return boardUndo();
    const m = lastMark;
    if (!m || m.turn !== turn) return;
    if (m.kind === 'here' && nextReady) {
      nextReady = false;
      results[turn].pick = null; revealCan = m.can; revealAt = 0; lastMark = null;
      $('#stamp').className = 'stamp'; $('#rvNext').innerHTML = ''; $('#undo').hidden = true;
      $('#here').disabled = $('#absent').disabled = false;
      say(t('s.undone'), m.can.name);
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
      } else {
        machine.restoreStudent(m.can.name);
        if (machine.mode !== 'aim' && machine.mode !== 'seek' && machine.mode !== 'load') machine.resume();
      }
      say(t('s.undone'), m.can.name);
      renderRows();
    }
  }
  $('#here').addEventListener('click', e => { markHere(); release(e.currentTarget); });
  $('#absent').addEventListener('click', e => { markAbsent(); release(e.currentTarget); });
  $('#undo').addEventListener('click', e => { undo(); release(e.currentTarget); });

  // ---------- teacher controls ----------
  function startNow() {
    const b = $('#start'); b.classList.add('hit'); setTimeout(() => b.classList.remove('hit'), 140);
    if (act !== 'play' || !$('#reveal').hidden) return;
    const was = machine.armed;
    if (machine.go() && !was && machine.mode === 'aim') { say(t('s.countdown')); sfx('clack'); }
  }
  $('#start').addEventListener('click', e => { SFX.unlock(); startNow(); release(e.currentTarget); });
  function setSpeed(v) {
    speed = Math.max(.5, Math.min(3, Math.round(v * 4) / 4));
    try { localStorage.setItem('rcc-speed', speed); } catch (e) {}
    $('#speed').value = speed; $('#speedOut').textContent = `${speed}×`;
    board.setSpeed(speed);
  }
  $('#speed').addEventListener('input', e => setSpeed(+e.target.value));
  $('#speed').addEventListener('change', e => release(e.target));
  setSpeed(speed);
  let hard = false;
  const labelHard = () => { const b = $('#hard'); b.setAttribute('aria-pressed', String(hard)); b.textContent = `${t('bar.grip')}: ${t(hard ? 'on' : 'off')}`; };
  $('#hard').addEventListener('click', e => { hard = !hard; machine.setHard(hard); labelHard(); release(e.currentTarget); });
  const labelSound = () => { const b = $('#sound'); b.setAttribute('aria-pressed', String(SFX.on)); b.textContent = `${t('bar.sound')}: ${t(SFX.on ? 'on' : 'off')}`; };
  function toggleSound() { SFX.unlock(); SFX.toggle(); labelSound(); }
  $('#sound').addEventListener('click', e => { toggleSound(); release(e.currentTarget); });
  function toggleFull() {
    const d = document;
    if (d.fullscreenElement) d.exitFullscreen && d.exitFullscreen();
    else d.documentElement.requestFullscreen && d.documentElement.requestFullscreen().catch(() => {});
  }
  $('#full').addEventListener('click', e => { toggleFull(); release(e.currentTarget); });
  document.addEventListener('fullscreenchange', () => { body.classList.toggle('presenting', !!document.fullscreenElement); lightDirty = true; });
  let idleT = null;
  addEventListener('pointermove', () => { body.classList.remove('idle'); clearTimeout(idleT); idleT = setTimeout(() => body.classList.add('idle'), 2200); });
  const keys = $('#keys');
  $('#keysBtn').addEventListener('click', () => { keys.hidden = false; $('#keysClose').focus(); });
  $('#keysClose').addEventListener('click', () => { keys.hidden = true; stage.focus(); });
  function openRoster() {
    if (board.busy || landing || boardPending || !$('#reveal').hidden) { say(t('s.wait')); return; }
    const picked = mode === 'board' ? 0 : results.filter(r => r && (r.pick || r.none)).length;
    Roster.open(roster, r => {
      roster = r;
      if (mode === 'board') board.syncNames(rosterNames());   // the board follows the roster
      reset();
      if (mode === 'board') say(t('s.rostersaved'), names(board.names.length));
    }, () => stage.focus(), { midGame: mode !== 'board' && (act !== 'order' || order.length > 0), picked });
  }
  $('#openRoster').addEventListener('click', e => { release(e.currentTarget); openRoster(); });
  Roster.wire();
  $('#again').addEventListener('click', reset);
  $('#copy').addEventListener('click', e => {
    const b = e.currentTarget;
    if (mode === 'board') return copyText(boardText(), b, 'btn.copylist');
    const txt = `${t('copy.crane')} · ${today()}\n` + order.map((g, i) => {
      const r = results[i] || { absent: [] };
      return `${i + 1}. ${g.name}: ${r.pick || t('copy.nobody')}${r.absent.length ? ` (${t('copy.absent')}: ${r.absent.join(', ')})` : ''}`;
    }).join('\n');
    copyText(txt, b, 'btn.copylist');
  });

  // ---------- performance: a render-resolution governor ----------
  // Canvas modules size their backing stores from devicePixelRatio, so capping it here lowers their cost.
  // Auto steps the cap down when frames run slow for a while and back up when they are fast again.
  const NATIVE_DPR = window.devicePixelRatio || 1;
  const STEPS = [Math.min(2, NATIVE_DPR), Math.min(1.5, NATIVE_DPR), 1, .75];
  let quality = 'auto', qStep = 0, slowFor = 0, fastFor = 0, ema = 1 / 60;
  try { quality = ['auto', 'high', 'low'].includes(localStorage.getItem('rcc-quality')) ? localStorage.getItem('rcc-quality') : 'auto'; } catch (e) {}
  try { Object.defineProperty(window, 'devicePixelRatio', { configurable: true, get: () => STEPS[qStep] }); } catch (e) {}
  function setQuality(q) {
    quality = q; try { localStorage.setItem('rcc-quality', q); } catch (e) {}
    qStep = q === 'high' ? 0 : q === 'low' ? 2 : qStep;
    slowFor = fastFor = 0; labelQuality(); sizePortrait();
  }
  const labelQuality = () => { $('#quality').textContent = `${t('bar.quality')}: ${t('q.' + quality)}`; };
  $('#quality').addEventListener('click', e => { setQuality({ auto: 'high', high: 'low', low: 'auto' }[quality]); release(e.currentTarget); });
  function govern(rdt) {
    if (document.hidden) return;
    ema += (rdt - ema) * .08;
    if (quality !== 'auto') return;
    if (ema > 1 / 42) { slowFor += rdt; fastFor = 0; } else if (ema < 1 / 57) { fastFor += rdt; slowFor = 0; } else { slowFor = fastFor = 0; }
    if (slowFor > 1.5 && qStep < STEPS.length - 1) { qStep++; slowFor = 0; }
    if (fastFor > 8 && qStep > 0) { qStep--; fastFor = 0; }
  }

  // ---------- language ----------
  function relabel() {
    labelHard(); labelSound(); labelQuality(); buildGroups();
    $('#lbEdit').textContent = t(board.editing ? 'btn.done' : 'btn.edit');
    if ($('#lbClear').classList.contains('arm') === false) $('#lbClear').textContent = t('btn.clear');
    if ($('#lbRoster').classList.contains('arm') === false) $('#lbRoster').textContent = t('btn.load');
    if (act === 'order') {
      if (mode === 'board') { board.render(); boardIdle(); }
      else { applyMode(); renderRows(); }
      sign(t('sign.title'));
    } else renderRows();
  }
  $('#lang').addEventListener('click', e => { I18N.set(I18N.lang === 'ko' ? 'en' : 'ko'); release(e.currentTarget); });
  I18N.onChange(relabel);

  addEventListener('keydown', e => {
    if (e.target.closest && e.target.closest('.sheet')) return;
    if (!$('#modal').hidden) return;
    const k = e.key;
    if (!keys.hidden) { if (k === 'Escape' || k === '?') keys.hidden = true; return; }
    if (e.target.tagName === 'INPUT' && e.target.type === 'range') { if (k === ' ' || k === 'Enter') release(e.target); else return; }
    else if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
    if (e.repeat && (k === ' ' || k === 'Enter' || k === 'ArrowRight' || k === 'PageDown')) { e.preventDefault(); return; }
    SFX.unlock();
    const lower = k.length === 1 ? k.toLowerCase() : k;
    if (lower === 'escape' || k === 'Escape') { if (board.editing) { setEditing(false); e.preventDefault(); } return; }
    if (lower === 'f') { toggleFull(); e.preventDefault(); return; }
    if (lower === 'm') { toggleSound(); e.preventDefault(); return; }
    if (k === '[' || k === '-') { setSpeed(speed - .25); e.preventDefault(); return; }
    if (k === ']' || k === '=' || k === '+') { setSpeed(speed + .25); e.preventDefault(); return; }
    if (lower === '?') { keys.hidden = false; e.preventDefault(); return; }
    if (lower === 'z' || (k === 'Backspace' && !$('#reveal').hidden)) { undo(); e.preventDefault(); return; }
    if (lower === 'r' && act === 'order' && !order.length) { openRoster(); e.preventDefault(); return; }
    if (lower === 's' && mode === 'board' && $('#reveal').hidden) { shuffleBoard(); e.preventDefault(); return; }
    if (!$('#reveal').hidden) {
      if (lower === 'p' || lower === 'h') { markHere(); e.preventDefault(); }
      else if (lower === 'a' || lower === 'x') { markAbsent(); e.preventDefault(); }
      else if ((k === ' ' || k === 'Enter' || k === 'ArrowRight') && (holdTimer || nextReady)) { if (e.target.tagName === 'BUTTON') release(e.target); proceed(); e.preventDefault(); }
      return;
    }
    if (k === ' ' || k === 'Enter' || k === 'ArrowRight' || k === 'PageDown') {
      // Space and Enter always drive the game; they never re-press whatever button was clicked last
      if (e.target.tagName === 'BUTTON') release(e.target);
      if (act === 'order') spin(); else if (act === 'play') startNow();
      e.preventDefault();
    }
  });
  addEventListener('pointerdown', () => SFX.unlock(), { capture: true });

  // ---------- the loop: time, light, sound ----------
  const bulbRows = [...document.querySelectorAll('.bulbs')];
  bulbRows.forEach(row => { for (let i = 0; i < 18; i++) row.append(document.createElement('i')); });
  const bulbs = bulbRows.map(row => [...row.children]);
  const house = $('#house'), bars = [...document.querySelectorAll('.bars i')], cnt = $('#count'), startBtn = $('#start'), reveal = $('#reveal');
  let last = performance.now(), ts = 1, drama = 0, shownDrama = -1, lastCount = 0, beat = 0, lightsDown = false, bulbKey = '', lightT = 0, drumLvl = 0, startGlow = false;
  const DRUM = { seek: .2, lower: .42, close: .6, pause: .6, raise: .4, top: .5, carry: .32, release: .55, check: .3 };
  // the house light is centred on whatever the class is looking at; measured only when the layout changes
  function lightCenter() {
    const el = act === 'order' ? (mode === 'wheel' ? $('.wheelbox') : mode === 'race' ? $('.racebox') : $('.boardbox')) : $('.glass');
    const r = el.getBoundingClientRect();
    if (!r.width) return;
    house.style.setProperty('--cx', ((r.left + r.width / 2) / innerWidth * 100).toFixed(1) + '%');
    house.style.setProperty('--cy', ((r.top + r.height / 2) / innerHeight * 100).toFixed(1) + '%');
    lightDirty = false;
  }
  function frame(now) {
    const rdt = Math.min(.05, (now - last) / 1000); last = now;
    govern(rdt);
    const dt = rdt * speed;
    let d = 0;
    if (act === 'order' && mode === 'wheel') { const want = 1 - (wheel.wantSlow || 0); ts += (want - ts) * (1 - Math.exp(-dt * 12)); wheel.step(dt * ts, dt); d = wheel.drama || 0; }
    else if (act === 'order' && mode === 'race') { race.step(dt); d = race.drama || 0; ts = race.timeScale ?? 1; }
    else if (act === 'order') { ts = 1; board.step(dt); d = board.drama; }
    else { ts = 1; machine.frame(dt, dt); d = machine.drama || 0; }
    if (!reveal.hidden) d = 1;
    drama += (d - drama) * (1 - Math.exp(-rdt * 5));
    // light and letterbox: written to their own layers, and only when the value moves
    const dq = Math.round(drama * 100) / 100;
    if (dq !== shownDrama) {
      shownDrama = dq;
      house.style.opacity = (dq * .6).toFixed(2);
      for (const b of bars) b.style.transform = `scaleY(${dq})`;
      const down = dq > .35;
      if (down !== lightsDown) { lightsDown = down; body.classList.toggle('lightsdown', down); }
    }
    if (SFX.slow) SFX.slow(act === 'play' ? (machine.wantSlow ?? 1) : ts);
    lightT += rdt;
    if (lightDirty || lightT > 1) { lightT = 0; if (dq > 0 || lightDirty) lightCenter(); }
    // countdown numerals on the glass
    const waiting = act === 'play' && reveal.hidden && (machine.mode === 'aim' || machine.mode === 'load') && !machine.armed;
    if (waiting !== startGlow) { startGlow = waiting; startBtn.classList.toggle('ready', waiting); }
    if (act === 'play' && machine.mode === 'aim' && machine.armed) {
      const n = Math.max(1, Math.ceil(machine.timer / .6));
      if (n !== lastCount) { lastCount = n; cnt.textContent = n; cnt.classList.remove('tick'); void cnt.offsetWidth; cnt.classList.add('tick'); }
    } else if (lastCount) lastCount = 0;
    const dr = act === 'play' && reveal.hidden && !reduced ? (DRUM[machine.mode] || 0) : 0;
    if (dr !== drumLvl) { drumLvl = dr; SFX.drum(dr); }
    // heartbeat while the camera is close
    if (drama > .55 && !reduced) { beat += rdt * (1.2 + drama * .6); if (beat >= 1) { beat = 0; sfx('heart', drama); } } else beat = .6;
    // bulbs: chase when idle, all on during the countdown, dark during the grab; touched only when the pattern changes
    const fl = now < flashUntil, k = Math.floor(now / (waiting ? 70 : 140)), f2 = Math.floor(now / 55) % 2;
    const allOn = act === 'play' && machine.mode === 'aim' && machine.armed, allOff = drama > .5;
    const key = fl ? `f${f2}` : `${allOn ? 'on' : allOff ? 'off' : k % 3}`;
    if (key !== bulbKey) {
      bulbKey = key;
      bulbs.forEach((row, ri) => row.forEach((b, i) => b.classList.toggle('on', fl ? (i + ri + f2) % 2 === 0 : !allOff && (allOn || reduced || (i + k + ri) % 3 === 0))));
    }
    requestAnimationFrame(frame);
  }

  I18N.apply();
  labelHard(); labelSound(); labelQuality();
  reset();
  requestAnimationFrame(frame);
  if (location.hash === '#debug') window.__claw = {
    wheel, race, machine, board, get act() { return act; }, get mode() { return mode; }, get quality() { return { quality, dpr: STEPS[qStep], ema }; },
    tick(n = 60) { for (let i = 0; i < n; i++) { if (act === 'order' && mode === 'wheel') wheel.step(1 / 60, 1 / 60); else if (act === 'order' && mode === 'race') race.step(1 / 60); else if (act === 'order') board.step(1 / 60); else machine.frame(1 / 60, 1 / 60); } },
  };
})();
