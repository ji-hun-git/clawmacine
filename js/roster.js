// Roster: who is in which group, and who is away today. Saved in this browser only.
window.Roster = (() => {
  const KEY = 'tin-can-roulette-roster-v1';
  const CLASS_LIST = [
    ['Group 1', ['Minjun Kim', 'Sojeong Lee', 'Hojae Lee', 'Martin Vladimirov Karastoyanov']],
    ['Group 2', ['JeongSeop Park', 'Fengjian Jiang', 'Helen Ha', 'JIYOUNG LIM']],
    ['Group 3', ['Han Yin', 'Jua Im', 'Sungjoon Kim', 'Kangeun Lee']],
    ['Group 4', ['Jun Wang', 'Valeriia Lvova', 'Minhyeok Seo', 'Hoyeol Sohn']],
  ];
  const MAX_GROUPS = 8;
  const fresh = () => ({ groups: CLASS_LIST.map(([name, m]) => ({ name, members: m.map(n => ({ name: n, away: false })) })) });
  const copy = r => JSON.parse(JSON.stringify(r));
  const clean = s => s.replace(/^\s*(?:[-*•·]|\d+[.)])\s+/, '').replace(/\s+/g, ' ').trim();
  const isHeader = s => /^(?:group|team|grp)\b/i.test(s) || /^\d+\s*(?:조|팀|반)\s*:?$/.test(s) || /^(?:조|팀)\s*\d+/.test(s);

  function valid(v) {
    return v && Array.isArray(v.groups) && v.groups.length > 0 &&
      v.groups.every(g => typeof g.name === 'string' && Array.isArray(g.members) && g.members.every(m => typeof m.name === 'string'));
  }
  function load() {
    try { const v = JSON.parse(localStorage.getItem(KEY)); if (valid(v)) return v; } catch (e) {}
    return fresh();
  }
  function save(r) { try { localStorage.setItem(KEY, JSON.stringify(r)); } catch (e) {} }

  // "Group 1 / name / name / Group 2 / ..." or a plain list of names
  function parse(text) {
    const lines = text.split(/\r?\n|,(?=\s*\S)/).map(s => s.trim()).filter(Boolean);
    const groups = []; let cur = null, headed = false; const loose = [];
    for (const raw of lines) {
      const line = raw.replace(/[:：]\s*$/, '');
      if (isHeader(line)) { headed = true; cur = { name: clean(line).slice(0, 24), members: [] }; groups.push(cur); continue; }
      const n = clean(raw).slice(0, 40);
      if (!n) continue;
      (cur ? cur.members : loose).push({ name: n, away: false });
    }
    if (loose.length && headed) groups.unshift({ name: 'Group 0', members: loose });
    return { headed, groups, names: loose };
  }
  const present = r => r.groups.reduce((s, g) => s + g.members.filter(m => !m.away).length, 0);
  const total = r => r.groups.reduce((s, g) => s + g.members.length, 0);

  // ---------- editor sheet ----------
  const $ = s => document.querySelector(s);
  let draft = null, onSave = null, onClose = null, opener = null;

  function smallest() { return draft.groups.reduce((b, g, i) => g.members.length < draft.groups[b].members.length ? i : b, 0); }
  function setCount(n) {
    n = Math.max(1, Math.min(MAX_GROUPS, n));
    while (draft.groups.length < n) draft.groups.push({ name: `Group ${draft.groups.length + 1}`, members: [] });
    while (draft.groups.length > n) {
      const gone = draft.groups.pop();
      gone.members.forEach(m => draft.groups[smallest()].members.push(m));
    }
    render();
  }
  function shuffleInto() {
    const all = draft.groups.flatMap(g => g.members).sort(() => Math.random() - .5);
    draft.groups.forEach(g => g.members = []);
    all.forEach((m, i) => draft.groups[i % draft.groups.length].members.push(m));
    render();
  }
  function addNames(gi, text) {
    const names = text.split(/[,\n]/).map(clean).filter(Boolean);
    const have = new Set(draft.groups.flatMap(g => g.members.map(m => m.name.toLowerCase())));
    names.forEach(n => { if (!have.has(n.toLowerCase())) { draft.groups[gi].members.push({ name: n.slice(0, 40), away: false }); have.add(n.toLowerCase()); } });
    render();
  }

  function render(focusAdd) {
    const box = $('#gcols'); box.innerHTML = '';
    draft.groups.forEach((g, gi) => {
      const col = document.createElement('div'); col.className = 'gcol'; col.dataset.gi = gi;
      const head = document.createElement('div'); head.className = 'ghead';
      const sw = document.createElement('span'); sw.className = 'num'; sw.textContent = gi + 1;
      const sty = ART.GROUP[gi % ART.GROUP.length]; sw.style.background = sty.bg; sw.style.color = sty.fg;
      const nm = document.createElement('input'); nm.value = g.name; nm.maxLength = 24; nm.id = `gname${gi}`; nm.setAttribute('aria-label', `Name of group ${gi + 1}`);
      nm.addEventListener('input', () => { g.name = nm.value; });
      const ct = document.createElement('span'); ct.className = 'ct';
      const away = g.members.filter(m => m.away).length;
      ct.textContent = `${g.members.length - away}${away ? ` +${away} away` : ''}`;
      head.append(sw, nm, ct);
      const names = document.createElement('div'); names.className = 'names';
      g.members.forEach((m, mi) => names.append(chip(m, gi, mi)));
      const add = document.createElement('form'); add.className = 'add';
      add.innerHTML = `<input id="add${gi}" placeholder="Add a name" aria-label="Add a name to ${g.name}" autocomplete="off"><button aria-label="Add">+</button>`;
      add.addEventListener('submit', e => { e.preventDefault(); const inp = add.querySelector('input'); if (inp.value.trim()) addNames(gi, inp.value); render(gi); });
      col.append(head, names, add);
      box.append(col);
    });
    if (focusAdd != null) { const el = document.getElementById(`add${focusAdd}`); if (el) el.focus(); }
    const n = draft.groups.length;
    $('#gOut').textContent = `${n} group${n === 1 ? '' : 's'}`;
    $('#gMinus').disabled = n <= 1; $('#gPlus').disabled = n >= MAX_GROUPS;
    const p = present(draft), t = total(draft);
    $('#rCount').textContent = `${p} here${t - p ? ` · ${t - p} away` : ''} · ${n} groups`;
    $('#rErr').hidden = true;
  }

  function chip(m, gi, mi) {
    const el = document.createElement('div'); el.className = 'nchip' + (m.away ? ' away' : '');
    el.tabIndex = 0; el.setAttribute('role', 'button');
    el.setAttribute('aria-label', `${m.name}${m.away ? ', away today' : ''}. Press to toggle away. Delete removes.`);
    const t = document.createElement('span'); t.textContent = m.name;
    const x = document.createElement('button'); x.className = 'x'; x.type = 'button'; x.textContent = '×'; x.setAttribute('aria-label', `Remove ${m.name}`);
    x.addEventListener('click', e => { e.stopPropagation(); draft.groups[gi].members.splice(mi, 1); render(); });
    x.addEventListener('pointerdown', e => e.stopPropagation());
    el.append(t, x);
    el.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); m.away = !m.away; render(); }
      if (e.key === 'Delete' || e.key === 'Backspace') { draft.groups[gi].members.splice(mi, 1); render(); }
    });
    // tap toggles away; drag moves to another group (works for mouse and touch)
    el.addEventListener('pointerdown', e => {
      if (e.button > 0) return;
      const sx = e.clientX, sy = e.clientY; let ghost = null, over = null;
      el.setPointerCapture(e.pointerId);
      const move = ev => {
        if (!ghost && Math.hypot(ev.clientX - sx, ev.clientY - sy) > 6) {
          ghost = el.cloneNode(true); ghost.classList.add('ghost'); document.body.append(ghost); el.classList.add('lifted');
        }
        if (!ghost) return;
        ghost.style.left = ev.clientX - 20 + 'px'; ghost.style.top = ev.clientY - 16 + 'px';
        const hit = document.elementFromPoint(ev.clientX, ev.clientY);
        const col = hit && hit.closest('.gcol');
        if (over && over !== col) over.classList.remove('over');
        over = col; if (over) over.classList.add('over');
      };
      const up = () => {
        el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up);
        if (ghost) {
          ghost.remove(); el.classList.remove('lifted'); if (over) over.classList.remove('over');
          const to = over ? +over.dataset.gi : gi;
          if (to !== gi) { draft.groups[gi].members.splice(mi, 1); draft.groups[to].members.push(m); }
          render();
        } else { m.away = !m.away; render(); }
      };
      el.addEventListener('pointermove', move); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    });
    return el;
  }

  function validate() {
    draft.groups.forEach((g, i) => { g.name = g.name.trim() || `Group ${i + 1}`; });
    if (draft.groups.length < 2) return 'Make at least 2 groups.';
    const empty = draft.groups.filter(g => !g.members.some(m => !m.away));
    if (empty.length) return `${empty.map(g => g.name).join(', ')} ${empty.length === 1 ? 'has' : 'have'} nobody here. Add a name or use fewer groups.`;
    return '';
  }
  function close() { $('#modal').hidden = true; draft = null; if (opener) opener.focus(); onClose && onClose(); }

  function open(current, cb, closeCb) {
    draft = copy(current); onSave = cb; onClose = closeCb; opener = document.activeElement;
    $('#paste').hidden = true; $('#togglePaste').setAttribute('aria-expanded', 'false');
    render(); $('#modal').hidden = false; $('#gMinus').focus();
  }

  function wire() {
    $('#gMinus').addEventListener('click', () => setCount(draft.groups.length - 1));
    $('#gPlus').addEventListener('click', () => setCount(draft.groups.length + 1));
    $('#shuffle').addEventListener('click', shuffleInto);
    $('#togglePaste').addEventListener('click', e => {
      const p = $('#paste'); p.hidden = !p.hidden; e.currentTarget.setAttribute('aria-expanded', String(!p.hidden));
      if (!p.hidden) $('#pasteText').focus();
    });
    const doPaste = replace => {
      const res = parse($('#pasteText').value);
      if (!res.groups.length && !res.names.length) return;
      if (res.headed) {
        if (replace) draft.groups = res.groups.filter(g => g.members.length).slice(0, MAX_GROUPS);
        else res.groups.forEach(pg => {
          const g = draft.groups.find(x => x.name.toLowerCase() === pg.name.toLowerCase());
          if (g) g.members.push(...pg.members); else if (draft.groups.length < MAX_GROUPS) draft.groups.push(pg);
        });
      } else {
        if (replace) draft.groups.forEach(g => g.members = []);
        res.names.forEach(m => draft.groups[smallest()].members.push(m));
      }
      $('#pasteText').value = ''; $('#paste').hidden = true; $('#togglePaste').setAttribute('aria-expanded', 'false');
      render();
    };
    $('#pasteReplace').addEventListener('click', () => doPaste(true));
    $('#pasteAdd').addEventListener('click', () => doPaste(false));
    $('#rDefault').addEventListener('click', () => { draft = fresh(); render(); });
    $('#rCancel').addEventListener('click', close);
    $('#rSave').addEventListener('click', () => {
      const err = validate();
      if (err) { const e = $('#rErr'); e.textContent = err; e.hidden = false; return; }
      const out = copy(draft); save(out); close(); onSave && onSave(out);
    });
    $('#modal').addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
    $('#modal').addEventListener('pointerdown', e => { if (e.target.id === 'modal') close(); });
  }

  return { load, save, fresh, open, wire, present, total };
})();
