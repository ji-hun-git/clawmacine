// The light board: every name still in play sits on an enamel tile in a walnut frame. A press sends a light chasing
// across the tiles; it slows, teases the neighbours and stops on one name. Fair by construction: the winner is drawn
// uniformly from the names still in play before the first light, then the chase is choreographed to end there.
// A picked name (present or absent) leaves the board for the tray beside it and sits out every later pick.
// Shuffle only moves tiles around (one of five animations, chosen at random); it never changes the odds.
window.Board = function (box, hooks, tray) {
  const KEY = 'rcc-board-v1';
  const grid = box.querySelector('.lb-grid');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const sfx = (n, v) => hooks.sfx && hooks.sfx(n, v);
  const clean = s => ART.properName(s).slice(0, 40);
  const rnd = (a, b) => a + Math.random() * (b - a);

  let names = [], marks = [], editing = false, busy = false, shuffling = false, drama = 0, dramaTo = 0, cols = 1, timers = [];
  let lastStyle = '', speed = 1;           // speed: the game-speed slider, 0.5 to 3
  let pend = null, shuf = null;            // the pick and the shuffle in progress, for skip()
  const anims = new Set(), flying = new Set();   // tile animations still running; marks in the air, by their landing
  const markOf = n => marks.find(m => m.name === n);
  const eligible = () => names.filter(n => !markOf(n));

  function load(fallback) {
    try {
      const v = JSON.parse(localStorage.getItem(KEY));
      if (v && Array.isArray(v.names)) {
        names = [...new Set(v.names.filter(n => !ART.isRetired(n)).map(clean).filter(Boolean))];
        marks = (v.marks || []).filter(m => m && names.includes(m.name) && (m.kind === 'here' || m.kind === 'absent'));
        return;
      }
    } catch (e) {}
    names = fallback.filter(n => !ART.isRetired(n)).map(clean); marks = [];
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify({ names, marks })); } catch (e) {} }

  // ---------- layout: the column count that keeps tiles near 2 : 1 and leaves the fewest empty cells ----------
  function layout() {
    const n = Math.max(1, eligible().length + (editing ? 1 : 0));
    const r = box.querySelector('.lb-frame').getBoundingClientRect();
    const ratio = r.width && r.height ? r.width / r.height : 1.45;
    let best = 1, bestScore = Infinity;
    for (let c = 1; c <= n; c++) {
      const rw = Math.ceil(n / c), aspect = ratio * rw / c;
      const score = Math.abs(Math.log(aspect / 2)) + (rw * c - n) / n * 2.2;
      if (score < bestScore) { bestScore = score; best = c; }
    }
    cols = best;
    const rows = Math.max(1, Math.ceil(n / cols));
    grid.style.setProperty('--cols', cols); grid.style.setProperty('--rows', rows);
    const fw = (box.clientWidth || 1000) - 80, fh = (box.clientHeight || 700) - 80;
    grid.style.setProperty('--tf', Math.max(11, Math.min(fw / cols * .13, fh / rows * .3)).toFixed(1) + 'px');
  }

  function tileEl(name, cls) {
    const t = document.createElement('div');
    t.className = 'tile ' + cls; t.dataset.name = name; t.setAttribute('role', 'listitem'); t.setAttribute('aria-label', name);
    const [first, ...rest] = name.split(' ');
    t.innerHTML = '<i class="bulb" aria-hidden="true"></i><span class="nm" aria-hidden="true"><b></b><small></small></span>';
    t.querySelector('b').textContent = first; t.querySelector('small').textContent = rest.join(' ');
    if (editing) {
      const x = document.createElement('button'); x.className = 'del'; x.type = 'button'; x.textContent = '×';
      x.setAttribute('aria-label', `Remove ${name}`);
      x.addEventListener('click', () => remove(name));
      t.append(x);
    }
    return t;
  }

  function render() {
    grid.innerHTML = '';
    const live = eligible();
    layout();
    live.forEach((name, i) => grid.append(tileEl(name, (Math.floor(i / cols) + i % cols) % 2 ? 'dark' : 'light')));
    if (editing) {
      const add = document.createElement('form'); add.className = 'tile add';
      const tr = (window.I18N ? I18N.t : (k => k));
      add.innerHTML = '<input id="lbAdd" autocomplete="off" spellcheck="false">';
      const inp = add.querySelector('input');
      inp.placeholder = tr('add.name'); inp.setAttribute('aria-label', tr('add.name'));
      // true when the box can be cleared; an empty Enter leaves edit mode
      const submit = text => {
        if (!text.trim()) { hooks.onEditExit && hooks.onEditExit(); return true; }
        const r = addNames(text);
        if (r.dupe) hooks.onDuplicate && hooks.onDuplicate(r.dupe);
        if (r.added) { render(); const again = grid.querySelector('#lbAdd'); if (again) again.focus(); return true; }
        return false;
      };
      add.addEventListener('submit', e => { e.preventDefault(); if (submit(inp.value)) inp.value = ''; else inp.select(); });
      // a pasted column of names becomes one tile per line
      inp.addEventListener('paste', e => {
        const text = (e.clipboardData || window.clipboardData).getData('text');
        if (/[\r\n\t]/.test(text)) { e.preventDefault(); submit(text); }
      });
      inp.addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); hooks.onEditExit && hooks.onEditExit(); } });
      grid.append(add);
    }
    const cells = cols * Math.max(1, Math.ceil(Math.max(1, live.length + (editing ? 1 : 0)) / cols));
    for (let k = live.length + (editing ? 1 : 0); k < cells; k++) { const sk = document.createElement('div'); sk.className = 'socket'; sk.setAttribute('aria-hidden', 'true'); grid.append(sk); }
    renderTray();
    hooks.onChange && hooks.onChange();
  }

  // the tray: picked names in order, absent names below them
  function renderTray() {
    if (!tray) return;
    const here = marks.filter(m => m.kind === 'here'), away = marks.filter(m => m.kind === 'absent');
    const list = tray.querySelector('.tray-list'), abs = tray.querySelector('.tray-absent');
    list.innerHTML = ''; abs.innerHTML = '';
    const total = marks.length;
    list.classList.toggle('two', total > 5 && total <= 12);
    list.classList.toggle('three', total > 12);
    tray.classList.toggle('dense', total > 12);
    here.forEach((m, i) => {
      const t = tileEl(m.name, 'mini'); t.classList.add('here');
      const s = document.createElement('span'); s.className = 'mark'; s.textContent = `#${i + 1}`; s.setAttribute('aria-hidden', 'true'); t.prepend(s);
      t.setAttribute('aria-label', `${m.name}, #${i + 1}`);
      list.append(t);
    });
    away.forEach(m => { const t = tileEl(m.name, 'mini'); t.classList.add('absent'); t.setAttribute('aria-label', `${m.name}, ${(window.I18N ? I18N.t : (k => k))('tray.absent')}`); abs.append(t); });
    tray.querySelector('.tray-absent-wrap').hidden = !away.length;
  }

  function addNames(text) {
    const have = new Set(names.map(n => n.toLowerCase()));
    let added = 0, dupe = '';
    text.split(/[,\r\n\t;]/).map(clean).filter(n => n && !ART.isRetired(n)).forEach(n => {
      if (!have.has(n.toLowerCase())) { names.push(n); have.add(n.toLowerCase()); added++; } else dupe = dupe || n;
    });
    if (added) save();
    return { added, dupe };
  }
  function remove(name) {
    if (busy || shuffling) return;
    names = names.filter(n => n !== name); marks = marks.filter(m => m.name !== name);
    save(); animateTo(() => render(), 'reflow');
    if (editing) { const a = grid.querySelector('#lbAdd'); if (a) a.focus(); }
  }
  const tileOf = name => [...grid.querySelectorAll('.tile')].find(t => t.dataset.name === name);

  // ---------- FLIP: animate tiles from where they were to where the new layout puts them ----------
  function snapshot() {
    const m = new Map();
    grid.querySelectorAll('.tile[data-name]').forEach(t => m.set(t.dataset.name, { x: t.offsetLeft, y: t.offsetTop, w: t.offsetWidth, h: t.offsetHeight }));
    return m;
  }
  // every animation is kept until it settles, so skip() can finish it
  const track = a => { anims.add(a); const f = a.finished.catch(() => {}); f.then(() => anims.delete(a)); return f; };
  const settle = () => { anims.forEach(a => { try { a.finish(); } catch (e) { a.cancel(); } }); anims.clear(); };
  function animateTo(change, style) {
    const before = snapshot();
    change();
    if (reduced) return Promise.resolve();
    const tiles = [...grid.querySelectorAll('.tile[data-name]')];
    const gw = grid.clientWidth, gh = grid.clientHeight, cx = gw / 2, cy = gh / 2;
    let longest = 0;
    const jobs = tiles.map((t, idx) => {
      const a = before.get(t.dataset.name), b = { x: t.offsetLeft, y: t.offsetTop, w: t.offsetWidth, h: t.offsetHeight };
      if (!a) {          // a tile that was not on the board before: pop in
        t.style.transformOrigin = '50% 50%';
        return track(t.animate([{ opacity: 0, transform: 'scale(.6)' }, { opacity: 1, transform: 'none' }], { duration: 380 / speed, delay: 120 / speed, easing: 'cubic-bezier(.2,1.4,.4,1)', fill: 'backwards' }));
      }
      const dx = a.x - b.x, dy = a.y - b.y, sx = a.w / b.w, sy = a.h / b.h;
      // a re-flow changes tile sizes, so it scales from the corner; a shuffle keeps sizes and spins about the centre
      t.style.transformOrigin = style === 'reflow' ? '0 0' : '50% 50%';
      const start = `translate(${dx}px,${dy}px) scale(${sx},${sy})`;
      const k = keyframes(style, { t, idx, a, b, dx, dy, start, gw, gh, cx, cy });
      const opts = { ...k.opts, duration: k.opts.duration / speed, delay: (k.opts.delay || 0) / speed };
      longest = Math.max(longest, opts.duration + opts.delay);
      return track(t.animate(k.frames, { fill: 'backwards', ...opts }));
    });
    return Promise.all(jobs).then(() => tiles.forEach(t => { t.style.transformOrigin = ''; }));
  }
  function keyframes(style, p) {
    const { idx, a, b, start, gw, gh, cx, cy } = p;
    const bx = b.x + b.w / 2, by = b.y + b.h / 2;
    const col = Math.round(b.x / Math.max(1, b.w));
    switch (style) {
      case 'scatter': {
        const mx = rnd(-.15, 1.15) * gw - bx, my = rnd(-.15, 1.15) * gh - by;
        return { frames: [{ transform: start }, { transform: `translate(${mx}px,${my}px) rotate(${rnd(-50, 50)}deg) scale(.82)`, offset: .48 }, { transform: 'none' }],
          opts: { duration: rnd(900, 1300), delay: rnd(0, 260), easing: 'cubic-bezier(.3,.7,.2,1)' } };
      }
      case 'swirl': {
        const a0 = Math.atan2(a.y + a.h / 2 - cy, a.x + a.w / 2 - cx), r0 = Math.hypot(a.x + a.w / 2 - cx, a.y + a.h / 2 - cy) + 30;
        const pts = [1, 2, 3].map(k => {
          const ang = a0 + k * 2.1, rad = r0 * (1 - k * .18) + 40;
          return { transform: `translate(${cx + Math.cos(ang) * rad - bx}px,${cy + Math.sin(ang) * rad * .7 - by}px) rotate(${k * 120}deg) scale(${1 - k * .08})`, offset: k * .22 };
        });
        return { frames: [{ transform: start }, ...pts, { transform: 'none' }], opts: { duration: 1500, delay: idx * 14, easing: 'cubic-bezier(.45,0,.25,1)' } };
      }
      case 'tornado': {
        const spin = rnd(-720, 720);
        return { frames: [{ transform: start }, { transform: `translate(${cx - bx}px,${cy - by}px) rotate(${spin}deg) scale(.32)`, offset: .45 },
          { transform: `translate(${cx - bx}px,${cy - by}px) rotate(${spin + 180}deg) scale(.3)`, offset: .58 }, { transform: 'none' }],
          opts: { duration: 1450, delay: rnd(0, 120), easing: 'cubic-bezier(.5,0,.3,1)' } };
      }
      case 'flip':
        return { frames: [{ transform: `${start} rotateY(0deg)` }, { transform: `translate(${p.dx * .5}px,${p.dy * .5}px) translateZ(60px) rotateY(90deg) scale(.92)`, offset: .4 },
          { transform: 'translateZ(30px) rotateY(270deg)', offset: .75 }, { transform: 'rotateY(360deg)' }],
          opts: { duration: 1000, delay: idx * 38, easing: 'cubic-bezier(.4,0,.2,1)' } };
      case 'rain': {
        const up = -(b.y + b.h + 80);
        return { frames: [{ transform: start }, { transform: `translate(${p.dx}px,${up + p.dy}px) rotate(${rnd(-25, 25)}deg)`, offset: .32 },
          { transform: `translate(0px,${up}px) rotate(${rnd(-20, 20)}deg)`, offset: .5, easing: 'cubic-bezier(.55,0,.8,.4)' },
          { transform: 'translate(0,6px) scale(1.04,.94)', offset: .9 }, { transform: 'none' }],
          opts: { duration: 1350, delay: col * 90 + rnd(0, 140), easing: 'cubic-bezier(.3,.6,.3,1)' } };
      }
      default:             // reflow: the board closing up after a tile leaves
        return { frames: [{ transform: start }, { transform: 'none' }], opts: { duration: 620, delay: idx * 12, easing: 'cubic-bezier(.2,.9,.25,1)' } };
    }
  }

  // ---------- shuffle ----------
  function shuffle() {
    if (busy || shuffling || editing) return false;
    const live = eligible();
    if (live.length < 2) return false;
    const styles = ['scatter', 'swirl', 'tornado', 'flip', 'rain'].filter(s => s !== lastStyle);
    const style = reduced ? 'reflow' : styles[Math.random() * styles.length | 0];
    lastStyle = style;
    // new order for the names in play; marked names keep their place in the list
    let order;
    do { order = live.slice(); for (let i = order.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [order[i], order[j]] = [order[j], order[i]]; } }
    while (order.length > 2 && order.every((n, i) => n === live[i]));
    let k = 0;
    names = names.map(n => markOf(n) ? n : order[k++]);
    save();
    shuffling = true; dramaTo = .25;
    hooks.onShuffle && hooks.onShuffle(style);
    sfx('whoosh');
    const ticks = reduced ? [] : Array.from({ length: 14 }, () => rnd(80, 1150) / speed).sort((x, y) => x - y);
    ticks.forEach(t => timers.push(setTimeout(() => sfx('tick', rnd(.4, 1)), t)));
    // finish on the animations, or after 2.8 s at the latest, so a paused or throttled tab can never jam the board
    let finished = false;
    const finish = () => {
      if (finished) return; finished = true; if (shuf === finish) shuf = null;
      shuffling = false; dramaTo = 0; sfx('clack');
      hooks.onShuffled && hooks.onShuffled();
    };
    shuf = finish;
    animateTo(() => render(), style).then(finish);
    timers.push(setTimeout(finish, 2800 / speed));
    return style;
  }

  // ---------- the chase ----------
  function neighbours(i, n) {
    const r = Math.floor(i / cols), c = i % cols, out = [];
    for (const [dr, dc] of [[0, -1], [0, 1], [-1, 0], [1, 0], [-1, -1], [1, 1], [-1, 1], [1, -1]]) {
      const rr = r + dr, cc = c + dc, j = rr * cols + cc;
      if (rr >= 0 && cc >= 0 && cc < cols && j < n) out.push(j);
    }
    return out;
  }
  function stopAll() { timers.forEach(clearTimeout); timers = []; pend = shuf = null; }
  function pick() {
    if (busy || shuffling || editing) return false;
    const live = eligible();
    if (!live.length) return false;
    const win = live[Math.random() * live.length | 0];
    const winI = live.indexOf(win), idx = live.map((n, i) => i);
    const steps = Math.max(8, Math.min(38, 16 + live.length));
    const route = [];
    let prev = -1;
    for (let k = 0; k < steps; k++) {
      let next = idx[Math.random() * idx.length | 0];
      if (idx.length > 1) while (next === prev) next = idx[Math.random() * idx.length | 0];
      route.push(next); prev = next;
    }
    // the last few steps tease the winner's neighbours
    const near = neighbours(winI, live.length).filter(j => j !== winI);
    for (let k = 0; k < Math.min(3, near.length); k++) route.push(near[Math.random() * near.length | 0]);
    for (let k = 1; k < route.length; k++) if (route[k] === route[k - 1] && idx.length > 1) route[k] = idx.find(j => j !== route[k - 1]);
    if (route[route.length - 1] === winI && idx.length > 1) route.push(idx.find(j => j !== winI));
    route.push(winI);
    busy = true; dramaTo = .15;
    hooks.onStart && hooks.onStart();
    const tiles = [...grid.querySelectorAll('.tile[data-name]')];
    const pk = pend = { win, el: tiles[winI], tiles, rung: false };
    let t = 0;
    route.forEach((ti, k) => {
      const p = k / (route.length - 1);
      t += (reduced ? 35 : 48 + Math.pow(p, 3) * 560 + (k === route.length - 1 ? 380 : 0)) / speed;
      timers.push(setTimeout(() => {
        tiles.forEach(el => el.classList.remove('lit'));
        const el = tiles[ti];
        if (!el) return;
        el.classList.add('lit');
        const trail = tiles[route[k - 1]]; if (trail) { trail.classList.add('trail'); setTimeout(() => trail.classList.remove('trail'), 260 / speed); }
        dramaTo = .15 + p * .8;
        if (k === route.length - 1) {
          el.classList.add('win'); sfx('ding'); pk.rung = true;
          timers.push(setTimeout(() => { busy = false; dramaTo = 0; pend = null; hooks.onPick && hooks.onPick(win); }, (reduced ? 200 : 1100) / speed));
        } else sfx('tick', .5 + p);
      }, t));
    });
    return true;
  }

  // ---------- marks: the picked tile flies off the board into the tray ----------
  function mark(name, kind) {
    const tile = tileOf(name), from = tile && tile.getBoundingClientRect();
    const ghost = tile && !reduced ? tile.cloneNode(true) : null;
    marks = marks.filter(m => m.name !== name); marks.push({ name, kind });
    save();
    const done = animateTo(() => render(), 'reflow');
    if (!ghost || !tray) return reduced ? done : aloft(done);
    const target = [...tray.querySelectorAll('.tile')].find(t => t.dataset.name === name);
    if (!target) return aloft(done);
    const bed = tray.querySelector('.tray-bed');
    if (bed) { const tr = target.getBoundingClientRect(), br = bed.getBoundingClientRect(); if (tr.bottom > br.bottom || tr.top < br.top) bed.scrollTop += tr.top - br.top - 8; }
    const to = target.getBoundingClientRect();
    target.style.visibility = 'hidden';
    ghost.classList.remove('lit', 'trail');
    ghost.classList.add('flying', kind === 'here' ? 'is-here' : 'is-absent');
    Object.assign(ghost.style, { left: from.left + 'px', top: from.top + 'px', width: from.width + 'px', height: from.height + 'px' });
    ghost.style.setProperty('--tf', getComputedStyle(grid).getPropertyValue('--tf'));
    document.body.append(ghost);
    const dx = to.left - from.left, dy = to.top - from.top, sx = to.width / from.width, sy = to.height / from.height;
    const lift = Math.min(0, dy) - 140;
    const fly = ghost.animate([
      { transform: 'translate(0,0) rotate(0) scale(1)' },
      { transform: `translate(${dx * .45}px,${lift}px) rotate(${rnd(-14, 14)}deg) scale(1.08)`, offset: .45 },
      { transform: `translate(${dx}px,${dy}px) scale(${sx},${sy})` }], { duration: 950 / speed, easing: 'cubic-bezier(.45,0,.2,1)', fill: 'forwards' });
    sfx('whoosh');
    let down = false;
    const land = () => { if (down) return; down = true; ghost.remove(); target.style.visibility = ''; target.classList.add('landed'); sfx('clack'); };
    const landed = track(fly).then(land);
    aloft(landed, land);
    return landed;
  }
  // a mark can be skipped until it lands (a skip also snaps the reflow)
  function aloft(p, land = () => {}) { flying.add(land); p.then(() => flying.delete(land)); return p; }
  function unmark(name) {
    const i = marks.map(m => m.name).lastIndexOf(name);
    if (i >= 0) marks.splice(i, 1);
    save(); return animateTo(() => render(), 'reflow');
  }
  function clearWin() { grid.querySelectorAll('.tile').forEach(el => el.classList.remove('lit', 'win', 'trail')); }

  // ---------- skip: end what is playing now with the result it already has ----------
  // the pick's winner and the shuffle's order are drawn before their animations, so skipping never touches the odds
  function skip() {
    const p = busy && pend, f = shuffling && shuf, lands = [...flying];
    if (!p && !f && !lands.length) return false;
    if (p) {
      stopAll(); p.tiles.forEach(el => el.classList.remove('lit', 'trail'));
      if (p.el) p.el.classList.add('lit', 'win');
      if (!p.rung) sfx('ding');
      busy = false; dramaTo = 0; pend = null;
      hooks.onPick && hooks.onPick(p.win);
    }
    if (f || lands.length) settle();
    if (f) { stopAll(); f(); }
    lands.forEach(l => { flying.delete(l); l(); });
    return true;
  }

  let rt = null;
  addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (box.offsetParent && !busy && !shuffling) render(); }, 150); });

  return {
    load(fallback) { load(fallback); render(); },
    render, pick, shuffle, mark, unmark, clearWin, skip,
    get canSkip() { return !!(busy && pend) || !!(shuffling && shuf) || flying.size > 0; },
    clearMarks() { stopAll(); busy = false; shuffling = false; dramaTo = 0; marks = []; save(); return animateTo(() => render(), 'reflow'); },
    setNames(list) { stopAll(); busy = false; names = [...new Set(list.map(clean).filter(Boolean))]; marks = []; save(); render(); },
    // the roster changed: take its names, keep the marks of names that are still there
    syncNames(list) {
      stopAll(); busy = false; shuffling = false; dramaTo = 0;
      names = [...new Set(list.filter(n => !ART.isRetired(n)).map(clean).filter(Boolean))];
      marks = marks.filter(m => names.includes(m.name));
      save(); render();
    },
    stop() { stopAll(); busy = false; shuffling = false; dramaTo = 0; clearWin(); },
    edit(on) { if (busy || shuffling) return editing; editing = on; render(); if (on) { const a = grid.querySelector('#lbAdd'); if (a) a.focus(); } return editing; },
    step(dt) { drama += (dramaTo - drama) * (1 - Math.exp(-dt * 4)); },
    setSpeed(v) { speed = Math.max(.25, Math.min(4, +v || 1)); },
    get names() { return names.slice(); },
    get marks() { return marks.slice(); },
    get left() { return eligible().length; },
    get busy() { return busy || shuffling; },
    get editing() { return editing; },
    get drama() { return drama; },
    tileOf,
  };
};
