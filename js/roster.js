// Roster: who is in which group, which animal runs for the group, and who is absent today.
// Saved in this browser only.
window.Roster = (() => {
  const KEY = 'tin-can-roulette-roster-v1';   // old product name, kept so saved rosters survive the rename
  const CLASS_LIST = [
    ['Group 1', ['Minjun Kim', 'Sojeong Lee', 'Hojae Lee', 'Martin Vladimirov Karastoyanov']],
    ['Group 2', ['Jeongseop Park', 'Fengjian Jiang', 'Helen Ha']],
    ['Group 3', ['Han Yin', 'Jua Im', 'Sungjoon Kim', 'Kangeun Lee']],
    ['Group 4', ['Jun Wang', 'Valeriia Lvova', 'Minhyeok Seo', 'Hoyeol Sohn']],
  ];
  const MAX_GROUPS = 8;
  const ANIMAL_KEYS = ['redpanda', 'turtle', 'axolotl', 'shark', 'pangolin'];
  const COMMON = { redpanda: 'Red panda', turtle: 'Sea turtle', axolotl: 'Axolotl', shark: 'Hammerhead', pangolin: 'Pangolin' };
  const art = k => (window.ANIMALS || {})[k];
  const animalName = k => (art(k) && art(k).name) || COMMON[k] || String(k);
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

  const fresh = () => ({ groups: CLASS_LIST.map(([name, m], i) => ({ name, animal: ANIMAL_KEYS[i % ANIMAL_KEYS.length], members: m.map(n => ({ name: n, away: false })) })) });
  const copy = r => JSON.parse(JSON.stringify(r));
  const clean = s => String(s).replace(/^\s*(?:[-*•·–]|\d+[.)])\s+/, '').replace(/[,;]+\s*$/, '').replace(/\s+/g, ' ').trim();
  const nameOf = s => { const n = ART.properName(clean(s)).slice(0, 40); return /\p{L}/u.test(n) && !ART.isRetired(n) ? n : ''; };

  // "Group 2", "Team Red", "Group 2: Jun Wang". Korean class-list headers ("2조", "조 2") still parse and become "Group 2".
  const HEAD = /^((?:group|team|grp)(?![a-z])[^:：]*?|\d+\s*(?:조|팀|반)|(?:조|팀)\s*\d+)\s*(?:[:：]\s*(.*))?$/i;
  function header(s) {
    const m = HEAD.exec(clean(s)); if (!m) return null;
    const ko = /[조팀반]/.test(m[1]) && /\d+/.exec(m[1]);
    return { name: (ko ? `Group ${+ko[0]}` : m[1].trim()).slice(0, 24), rest: (m[2] || '').trim() };
  }
  const gname = c => { if (/^\d{1,2}$/.test(c)) return `Group ${+c}`; const h = header(c); return h && !h.rest ? h.name : ''; };

  function valid(v) {
    return v && Array.isArray(v.groups) && v.groups.length > 0 &&
      v.groups.every(g => typeof g.name === 'string' && Array.isArray(g.members) && g.members.every(m => typeof m.name === 'string'));
  }
  // every group gets an animal; missing or unknown ones take the first free animal, starting from the group's own index
  function free(used, i) {
    for (let k = 0; k < ANIMAL_KEYS.length; k++) { const a = ANIMAL_KEYS[(i + k) % ANIMAL_KEYS.length]; if (!used.has(a)) return a; }
    return ANIMAL_KEYS[i % ANIMAL_KEYS.length];
  }
  function normalize(r) {
    const used = new Set(r.groups.map(g => g.animal).filter(a => ANIMAL_KEYS.includes(a)));
    r.groups = r.groups.map((g, i) => {
      let a = g.animal;
      if (!ANIMAL_KEYS.includes(a)) { a = free(used, i); used.add(a); }
      const members = (g.members || []).filter(m => !ART.isRetired(m.name)).map(m => ({ name: ART.properName(m.name), away: !!m.away }));
      return { name: String(g.name == null ? `Group ${i + 1}` : g.name), animal: a, members };
    });
    return r;
  }
  function load() {
    try { const v = JSON.parse(localStorage.getItem(KEY)); if (valid(v)) return normalize(v); } catch (e) {}
    return fresh();
  }
  function save(r) { try { localStorage.setItem(KEY, JSON.stringify(r)); } catch (e) {} }

  // A spreadsheet paste (tabs) is read as a table first: group names across the top row, or one name and one group per row.
  function table(rows) {
    const top = rows[0].filter(Boolean);
    if (top.length > 1 && top.every(gname)) {
      const cols = rows[0].map(c => c ? { name: gname(c), members: [] } : null);
      rows.slice(1).forEach(r => r.forEach((c, i) => { const n = nameOf(c); if (n && cols[i]) cols[i].members.push({ name: n, away: false }); }));
      return { headed: true, groups: cols.filter(Boolean), names: [] };
    }
    const body = rows.filter(r => !r.every(c => !c || /^(?:names?|students?|groups?|teams?|이름|조|팀)$/i.test(c)));
    const pairs = body.map(r => {
      const c = r.filter(Boolean); if (c.length !== 2) return null;
      const a = gname(c[0]), b = gname(c[1]);
      return a && !b ? [a, c[1]] : b && !a ? [b, c[0]] : null;
    });
    if (!pairs.length || pairs.some(p => !p)) return null;
    const by = new Map();
    pairs.forEach(([g, s]) => {
      const n = nameOf(s); if (!n) return;
      if (!by.has(g)) by.set(g, { name: g, members: [] });
      by.get(g).members.push({ name: n, away: false });
    });
    return { headed: true, groups: [...by.values()].sort((x, y) => x.name.localeCompare(y.name, undefined, { numeric: true })), names: [] };
  }
  // "Group 1 / name / name / Group 2 / ..." or a plain list of names (one per line, or separated by commas)
  function parse(text) {
    const rows = String(text || '').split(/\r?\n/).map(r => r.split('\t').map(c => c.trim())).filter(r => r.some(Boolean));
    const t = rows.some(r => r.filter(Boolean).length > 1) && table(rows);
    if (t) return t;
    const groups = [], loose = []; let cur = null;
    const add = s => { const n = nameOf(s); if (n) (cur ? cur.members : loose).push({ name: n, away: false }); };
    rows.forEach(r => r.forEach(cell => cell.split(/[,;](?=\s*\S)/).forEach(part => {
      const h = header(part);
      if (!h) return add(part);
      cur = { name: h.name, members: [] }; groups.push(cur);
      if (h.rest) add(h.rest);
    })));
    if (loose.length && groups.length) groups.unshift({ name: (window.I18N ? I18N.t : ((k) => k))('r.ungrouped'), members: loose.slice() });
    return { headed: groups.length > 0, groups, names: loose };
  }
  const present = r => r.groups.reduce((s, g) => s + g.members.filter(m => !m.away).length, 0);
  const total = r => r.groups.reduce((s, g) => s + g.members.length, 0);

  // ---------- editor sheet ----------
  const $ = s => document.querySelector(s);
  const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const now = () => performance.now() / 1000;
  const PREV_H = 110, THUMB_H = 34, REST = 1.3, CHEER = 1.4;
  let draft = null, base = '', onSave = null, onClose = null, opts = {};
  let live = [], raf = 0, hot = null, armT = 0;
  const state = new WeakMap(), broken = new Set();
  const st = g => { let s = state.get(g); if (!s) state.set(g, s = { cheer: 0 }); return s; };
  const dirty = () => !!draft && JSON.stringify(draft) !== base;

  function note(msg) { const e = $('#rErr'); e.textContent = msg; e.hidden = !msg; }
  const here = g => g.members.filter(m => !m.away).length;
  function smallest() { return draft.groups.reduce((b, g, i) => here(g) < here(draft.groups[b]) ? i : b, 0); }
  function dedupe(groups, have) {
    let n = 0;
    groups.forEach(g => { g.members = g.members.filter(m => { const k = m.name.toLowerCase(); if (have.has(k)) { n++; return false; } have.add(k); return true; }); });
    return n;
  }
  const skippedNote = n => n ? `Skipped ${plural(n, 'name')} that ${n === 1 ? 'was' : 'were'} already listed.` : '';
  const listed = () => new Set(draft.groups.flatMap(g => g.members.map(m => m.name.toLowerCase())));

  function setCount(n) {
    n = Math.max(1, Math.min(MAX_GROUPS, n));
    while (draft.groups.length < n) { draft.groups.push({ name: `Group ${draft.groups.length + 1}`, animal: null, members: [] }); normalize(draft); }
    while (draft.groups.length > n) draft.groups.pop().members.forEach(m => draft.groups[smallest()].members.push(m));
    render();
  }
  function shuffleInto() {
    const all = draft.groups.flatMap(g => g.members);
    for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [all[i], all[j]] = [all[j], all[i]]; }
    draft.groups.forEach(g => g.members = []);
    // deal the students who are here first, so no group ends up with only absent names
    [...all.filter(m => !m.away), ...all.filter(m => m.away)].forEach((m, i) => draft.groups[i % draft.groups.length].members.push(m));
    render();
  }
  function addNames(gi, text) {
    const got = [{ members: text.split(/[,;\n\t]/).map(nameOf).filter(Boolean).map(n => ({ name: n, away: false })) }];
    const skipped = dedupe(got, listed());
    draft.groups[gi].members.push(...got[0].members);
    render(`add${gi}`); note(skippedNote(skipped));
  }
  // picking an animal another group has swaps the two, so up to five groups always run five different animals
  function choose(gi, key) {
    const g = draft.groups[gi]; if (!g) return;
    if (g.animal !== key) {
      const other = draft.groups.length <= ANIMAL_KEYS.length && draft.groups.find((x, j) => j !== gi && x.animal === key);
      if (other) { other.animal = g.animal; st(other).cheer = now() + CHEER; }
      g.animal = key; st(g).cheer = now() + CHEER;
    }
    render(`a${gi}-${key}`);
  }

  // ---------- animal previews: one warm lamp up and to the left, the animal standing in its pool ----------
  function stage(cv, key, o) {
    const w = cv.clientWidth, h = cv.clientHeight; if (!w || !h) return;
    const d = Math.min(2, window.devicePixelRatio || 1), W = Math.round(w * d), H = Math.round(h * d);
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    const g = cv.getContext('2d');
    g.setTransform(d, 0, 0, d, 0, 0); g.clearRect(0, 0, w, h);
    const fx = w * .5, fy = h - Math.max(5, h * .11), r = Math.min(w * .5, h * 1.5);
    g.save(); g.translate(fx - w * .06, fy); g.scale(1, .2);
    const pool = g.createRadialGradient(0, 0, 0, 0, 0, r);
    pool.addColorStop(0, 'rgba(255,222,165,.8)'); pool.addColorStop(.55, 'rgba(255,233,196,.3)'); pool.addColorStop(1, 'rgba(255,233,196,0)');
    g.fillStyle = pool; g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill();
    g.restore();
    const A = art(key); if (!A || broken.has(key)) return;
    g.save(); g.translate(fx, fy);
    try { A.draw(g, Object.assign(o, { scale: Math.min(fy * .84 / 100, w * .88 / 160) })); }
    catch (e) { broken.add(key); console.error(`Roster: the ${key} preview failed to draw`, e); }
    g.restore();
  }
  function tick() {
    raf = requestAnimationFrame(tick);
    const t = now();
    for (const v of live) {
      const w = v.cv.clientWidth, on = !v.btn || v.btn === hot || v.btn === document.activeElement;
      if (v.btn && !on && !v.on && v.w === w) continue;   // a still thumbnail that is already drawn
      v.on = on && !!v.btn; v.w = w;
      stage(v.cv, v.key, v.o(on ? t : REST));
    }
  }

  function render(focusKey) {
    const box = $('#gcols'); box.innerHTML = ''; live = [];
    const inks = (window.ART && ART.GROUP) || [{ bg: '#1c1b1f', fg: '#fbf8f1' }];
    draft.groups.forEach((g, gi) => box.append(column(g, gi, inks)));
    const n = draft.groups.length, p = present(draft), t = total(draft);
    const L = window.I18N;
    $('#gOut').textContent = L ? L.count(n, 'n.group', 'n.groups') : plural(n, 'group');
    $('#gMinus').disabled = n <= 1; $('#gPlus').disabled = n >= MAX_GROUPS;
    $('#rCount').textContent = L ? `${L.t('r.here', { p })}${t - p ? ` · ${L.t('r.absentn', { n: t - p })}` : ''} · ${L.count(n, 'n.group', 'n.groups')}`
      : `${p} here${t - p ? ` · ${t - p} absent` : ''} · ${plural(n, 'group')}`;
    note('');
    foot();
    if (focusKey) { const f = box.querySelector(`[data-k="${focusKey}"]`); if (f) f.focus(); }
  }

  function column(g, gi, inks) {
    const ink = inks[gi % inks.length], h = here(g), away = g.members.length - h;
    const col = mk('div', 'gcol'); col.dataset.gi = gi;
    col.style.setProperty('--g', ink.bg); col.style.setProperty('--gfg', ink.fg);
    const head = mk('div', 'ghead');
    const bar = mk('i', 'gbar'); bar.setAttribute('aria-hidden', 'true');
    const nm = mk('input'); nm.value = g.name; nm.maxLength = 24; nm.id = `gname${gi}`; nm.autocomplete = 'off'; nm.spellcheck = false;
    nm.setAttribute('aria-label', `Name of group ${gi + 1}`);
    nm.addEventListener('input', () => { g.name = nm.value; foot(); });
    head.append(bar, nm, mk('span', 'ct', away ? `${h} here · ${away} absent` : plural(h, 'name')));
    const names = mk('div', 'names');
    g.members.forEach((m, mi) => names.append(chip(m, gi, mi)));
    const add = mk('form', 'add');
    const inp = mk('input'); inp.id = `add${gi}`; inp.dataset.k = `add${gi}`; inp.placeholder = (window.I18N ? I18N.t : ((k) => k))('r.addname'); inp.autocomplete = 'off';
    inp.setAttribute('aria-label', `Add a name to group ${gi + 1}`);
    const btn = mk('button', '', 'Add'); btn.type = 'submit';
    add.append(inp, btn);
    add.addEventListener('submit', e => { e.preventDefault(); if (inp.value.trim()) addNames(gi, inp.value); });
    col.append(head, animals(g, gi, inks, h), names, add);
    return col;
  }

  function animals(g, gi, inks, h) {
    const ink = inks[gi % inks.length], box = mk('div', 'apick'), A = art(g.animal);
    if (A) {
      const cv = mk('canvas', 'aprev'); cv.style.width = '100%'; cv.style.height = `${PREV_H}px`; cv.setAttribute('aria-hidden', 'true');
      box.append(cv);
      const bib = { n: String(gi + 1), bg: ink.bg, fg: ink.fg };
      // it cheers for a moment when chosen, and worries while nobody in its group is here
      live.push({ cv, key: g.animal, o: t => ({ t: t + gi * .77, mode: st(g).cheer > t ? 'cheer' : h ? 'idle' : 'worry', speed: 0, emotion: 'focus', look: 0, bib }) });
    }
    const cap = mk('div', 'acap');
    cap.append(mk('b', 'aname', animalName(g.animal)));
    if (A && A.status) cap.append(mk('span', 'astat', A.status));
    const row = mk('div', 'aopts'); row.setAttribute('role', 'radiogroup'); row.setAttribute('aria-label', `Animal for group ${gi + 1}`);
    ANIMAL_KEYS.forEach((k, ki) => {
      const on = g.animal === k, who = on ? -1 : draft.groups.findIndex((x, j) => j !== gi && x.animal === k);
      const b = mk('button', 'aopt' + (on ? ' on' : '')); b.type = 'button'; b.dataset.k = `a${gi}-${k}`;
      b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', String(on)); b.tabIndex = on ? 0 : -1;
      const label = who < 0 ? animalName(k) : `${animalName(k)}. ${draft.groups[who].name} has it; choosing it swaps.`;
      b.setAttribute('aria-label', label); b.title = label;
      if (art(k)) {
        const tc = mk('canvas'); tc.style.width = '100%'; tc.style.height = `${THUMB_H}px`; tc.setAttribute('aria-hidden', 'true'); b.append(tc);
        live.push({ cv: tc, key: k, btn: b, o: t => ({ t, mode: 'idle', speed: 0, emotion: 'focus', look: 0, bib: null }) });
      } else { b.classList.add('noart'); b.append(mk('span', '', animalName(k))); }
      if (who >= 0) { const s = mk('small', 'held', String(who + 1)); s.style.setProperty('--h', inks[who % inks.length].bg); b.append(s); }
      b.addEventListener('click', () => choose(gi, k));
      b.addEventListener('keydown', e => {
        const dir = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
        if (dir) { e.preventDefault(); choose(gi, ANIMAL_KEYS[(ki + dir + ANIMAL_KEYS.length) % ANIMAL_KEYS.length]); }
      });
      b.addEventListener('pointerenter', () => { hot = b; });
      b.addEventListener('pointerleave', () => { if (hot === b) hot = null; });
      row.append(b);
    });
    box.append(cap, row);
    return box;
  }

  function chip(m, gi, mi) {
    const el = mk('div', 'nchip' + (m.away ? ' away' : '')); el.dataset.k = `c${gi}-${mi}`;
    el.tabIndex = 0; el.setAttribute('role', 'button');
    el.setAttribute('aria-label', m.away ? `${m.name}, absent today. Enter marks present. Delete removes.` : `${m.name}. Enter marks absent. Delete removes.`);
    const members = draft.groups[gi].members;
    const drop = () => { members.splice(mi, 1); render(members.length ? `c${gi}-${Math.min(mi, members.length - 1)}` : `add${gi}`); };
    const x = mk('button', 'x', 'remove'); x.type = 'button'; x.tabIndex = -1; x.setAttribute('aria-label', `Remove ${m.name}`);
    x.addEventListener('click', e => { e.stopPropagation(); drop(); });
    x.addEventListener('pointerdown', e => e.stopPropagation());
    el.append(mk('span', '', m.name), x);
    el.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); m.away = !m.away; render(`c${gi}-${mi}`); }
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); drop(); }
    });
    // tap marks absent or present; drag moves the name to another group (mouse and touch)
    el.addEventListener('pointerdown', e => {
      if (e.button > 0) return;
      const sx = e.clientX, sy = e.clientY; let ghost = null, over = null;
      el.setPointerCapture(e.pointerId);
      const move = ev => {
        if (!ghost && Math.hypot(ev.clientX - sx, ev.clientY - sy) > 6) {
          ghost = el.cloneNode(true); ghost.classList.add('ghost'); document.body.append(ghost); el.classList.add('lifted');
        }
        if (!ghost) return;
        ghost.style.left = `${ev.clientX - 20}px`; ghost.style.top = `${ev.clientY - 16}px`;
        const hit = document.elementFromPoint(ev.clientX, ev.clientY), col = hit && hit.closest('.gcol');
        if (over && over !== col) over.classList.remove('over');
        over = col; if (over) over.classList.add('over');
      };
      const up = () => {
        el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up);
        if (ghost) {
          ghost.remove(); el.classList.remove('lifted'); if (over) over.classList.remove('over');
          const to = over ? +over.dataset.gi : gi;
          if (to !== gi && draft.groups[to]) { members.splice(mi, 1); draft.groups[to].members.push(m); }
          render();
        } else { m.away = !m.away; render(`c${gi}-${mi}`); }
      };
      el.addEventListener('pointermove', move); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    });
    return el;
  }

  function foot() {
    const b = $('#rSave'); if (!b || !draft) return;
    b.disabled = !dirty();
    if (!opts.midGame) { b.textContent = (window.I18N ? I18N.t : ((k) => k))('r.save'); return; }
    b.textContent = (window.I18N ? I18N.t : ((k) => k))('r.saveover');
    const n = opts.picked | 0;
    if (n > 0) b.append(mk('small', '', window.I18N && I18N.lang === 'ko' ? I18N.t('r.loses', { n }) : `Loses ${plural(n, 'pick')}`));
  }
  function validate() {
    draft.groups.forEach((g, i) => { g.name = g.name.trim() || `Group ${i + 1}`; });
    if (draft.groups.length < 2) return { msg: (window.I18N ? I18N.t : ((k) => k))('r.need2'), focus: 'gPlus' };
    const empty = draft.groups.filter(g => !here(g));
    if (empty.length) return {
      msg: `${empty.map(g => g.name).join(', ')} ${empty.length === 1 ? 'has' : 'have'} nobody here. Add a name or use fewer groups.`,
      focus: `add${draft.groups.indexOf(empty[0])}`,
    };
    return null;
  }
  function disarm() {
    clearTimeout(armT); armT = 0;
    const b = $('#rDefault'); if (b) { b.textContent = (window.I18N ? I18N.t : ((k) => k))('r.restore'); b.classList.remove('arm'); }
  }
  function close() {
    if (!draft) return;
    $('#modal').hidden = true; cancelAnimationFrame(raf); raf = 0; hot = null;
    $('#gcols').innerHTML = ''; live = []; draft = null; disarm();
    // focus goes to the stage, not back to the Roster button, so the next Space does not reopen the sheet
    const sg = $('#stage');
    if (sg && sg.hasAttribute('tabindex')) sg.focus({ preventScroll: true });
    else if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    const cb = onClose; onSave = onClose = null; cb && cb();
  }
  // Esc and the backdrop only close a sheet with nothing to lose
  function tryClose() {
    if (!draft) return;
    if (!dirty() && !$('#pasteText').value.trim()) return close();
    note((window.I18N ? I18N.t : ((k) => k))('r.unsaved'));
    const s = $('#modal .sheet'); if (s) { s.classList.remove('shake'); void s.offsetWidth; s.classList.add('shake'); }
  }

  // open(current roster, onSave(newRoster), onClose(), { midGame, picked })
  function open(current, cb, closeCb, o) {
    draft = normalize(copy(current)); base = JSON.stringify(draft);
    onSave = cb; onClose = closeCb; opts = o || {};
    disarm();
    $('#paste').hidden = true; $('#togglePaste').setAttribute('aria-expanded', 'false'); $('#pasteText').value = '';
    render(); $('#modal').hidden = false;
    const s = $('#modal .sheet'); (s || $('#gPlus')).focus();
    if (!raf && window.requestAnimationFrame) raf = requestAnimationFrame(tick);
  }

  function wire() {
    const modal = $('#modal'), sheet = $('#modal .sheet');
    if (sheet) {
      if (!sheet.hasAttribute('tabindex')) sheet.tabIndex = -1;
      sheet.addEventListener('animationend', () => sheet.classList.remove('shake'));
    }
    $('#gMinus').addEventListener('click', () => setCount(draft.groups.length - 1));
    $('#gPlus').addEventListener('click', () => setCount(draft.groups.length + 1));
    $('#shuffle').addEventListener('click', shuffleInto);
    $('#togglePaste').addEventListener('click', e => {
      const p = $('#paste'); p.hidden = !p.hidden; e.currentTarget.setAttribute('aria-expanded', String(!p.hidden));
      if (!p.hidden) $('#pasteText').focus();
    });
    const doPaste = replace => {
      const res = parse($('#pasteText').value);
      const got = res.headed ? res.groups : [{ name: '', members: res.names }];
      const skipped = dedupe(got, replace ? new Set() : listed());
      if (!got.some(g => g.members.length)) { note((window.I18N ? I18N.t : ((k) => k))(skipped ? 'r.dupes' : 'r.nonames')); return; }
      let spill = [];
      if (res.headed && replace) {
        const keep = draft.groups.map(g => g.animal), gs = got.filter(g => g.members.length);
        spill = gs.splice(MAX_GROUPS).flatMap(g => g.members);
        draft.groups = gs.map((g, i) => ({ name: g.name, animal: keep[i], members: g.members }));
      } else if (res.headed) {
        got.forEach(pg => {
          if (!pg.members.length) return;
          const g = draft.groups.find(x => x.name.toLowerCase() === pg.name.toLowerCase());
          if (g) g.members.push(...pg.members);
          else if (draft.groups.length < MAX_GROUPS) draft.groups.push({ name: pg.name, animal: null, members: pg.members });
          else spill.push(...pg.members);
        });
      } else {
        if (replace) draft.groups.forEach(g => g.members = []);
        spill = got[0].members;
      }
      normalize(draft);
      const folded = res.headed && spill.length;
      spill.forEach(m => draft.groups[smallest()].members.push(m));
      $('#pasteText').value = ''; $('#paste').hidden = true; $('#togglePaste').setAttribute('aria-expanded', 'false');
      render();
      note([skippedNote(skipped), folded ? `Only ${MAX_GROUPS} groups fit, so the rest joined the smallest groups.` : ''].filter(Boolean).join(' '));
    };
    $('#pasteReplace').addEventListener('click', () => doPaste(true));
    $('#pasteAdd').addEventListener('click', () => doPaste(false));
    // two clicks, so one stray click cannot replace a real class with the built-in list
    $('#rDefault').addEventListener('click', e => {
      if (!draft) return;
      if (!armT) { const b = e.currentTarget; b.textContent = (window.I18N ? I18N.t : ((k) => k))('r.restore2'); b.classList.add('arm'); armT = setTimeout(disarm, 3000); return; }
      disarm();
      const keep = draft.groups.map(g => g.animal);
      draft = fresh(); draft.groups.forEach((g, i) => { if (keep[i]) g.animal = keep[i]; });
      render();
    });
    $('#rCancel').addEventListener('click', close);
    $('#rSave').addEventListener('click', () => {
      if (!draft || !dirty()) return;
      const err = validate();
      if (err) { render(); note(err.msg); const f = document.getElementById(err.focus); if (f) f.focus(); return; }
      const out = copy(draft), cb = onSave; save(out); close(); cb && cb(out);
    });
    // keys typed in the sheet never reach the game's shortcuts
    modal.addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); tryClose(); } e.stopPropagation(); });
    addEventListener('keydown', e => {   // focus fell out of the sheet (a click on the backdrop): still no game keys
      if (!draft || modal.contains(e.target)) return;
      e.stopImmediatePropagation(); e.preventDefault();
      if (e.key === 'Escape') tryClose(); else (sheet || $('#gPlus')).focus();
    }, true);
    modal.addEventListener('pointerdown', e => { if (e.target === modal) tryClose(); });
    document.addEventListener('focusin', e => { if (draft && !modal.contains(e.target)) (sheet || $('#gPlus')).focus(); });
  }

  const isOpen = () => !!draft;
  return { load, save, fresh, open, wire, present, total, parse, isOpen, animalName, ANIMAL_KEYS };
})();
