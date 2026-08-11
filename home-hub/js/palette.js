/* ═══════════════════════════════════════
   PALETTE.JS — Command palette (Ctrl/Cmd+K)
   Jump to tabs, search tasks/bookmarks/events,
   and run quick actions. TV-remote friendly.
   ═══════════════════════════════════════ */

let _pResults = [];   // current visible results
let _pSel     = 0;    // selected index
let _pWired   = false;

const TAB_INDEX = { home: 0, tasks: 1, family: 2, bookmarks: 3, tools: 4, settings: 5 };

/* Navigate to a tab by id and activate the matching button */
function goTab(id) {
  const btns = [...document.querySelectorAll('.tab-btn')];
  HUB.switchTab(id, btns[TAB_INDEX[id]]);
}

function _focusSoon(elId) {
  setTimeout(() => document.getElementById(elId)?.focus(), 120);
}

/* Build the full command list (static actions + dynamic content) */
function buildCommands() {
  const cmds = [];

  // ── Navigation ──
  [['home','🏠','Home'],['tasks','📋','Tasks'],['family','👨‍👩‍👧','Family'],
   ['bookmarks','⭐','Bookmarks'],['tools','🛠','Tools'],['settings','⚙','Settings']]
    .forEach(([id, icon, name]) => cmds.push({
      icon, title: `Go to ${name}`, sub: 'Navigation', keys: name + ' tab nav',
      run: () => goTab(id)
    }));

  // ── Quick actions ──
  cmds.push(
    { icon:'➕', title:'Add a task',        sub:'Action', keys:'new todo task', run:()=>{ goTab('tasks'); _focusSoon('todo-input'); } },
    { icon:'⭐', title:'Add a bookmark',    sub:'Action', keys:'new bookmark link', run:()=>{ goTab('bookmarks'); _focusSoon('bm-title'); } },
    { icon:'💬', title:'Post a message',    sub:'Action', keys:'family message board', run:()=>{ goTab('family'); _focusSoon('msg-input'); } },
    { icon:'🛒', title:'Add grocery item',  sub:'Action', keys:'shopping grocery list', run:()=>{ goTab('family'); _focusSoon('grocery-input'); } },
    { icon:'🎬', title:'Add to watchlist',  sub:'Action', keys:'movie show watch', run:()=>{ goTab('family'); _focusSoon('watch-input'); } },
    { icon:'📺', title:'Enter TV Mode',     sub:'Action', keys:'ambient screensaver tv', run:()=>{ HUB.paletteClose(); HUB.ambientOpen(); } },
    { icon:'🍅', title:'Start Pomodoro',    sub:'Action', keys:'focus timer pomodoro', run:()=>{ goTab('tasks'); setTimeout(()=>{ if(typeof pomoToggle==='function') pomoToggle(); }, 150); } },
    { icon:'↻',  title:'Refresh weather',   sub:'Action', keys:'weather refresh update', run:()=>{ if(typeof weatherFetch==='function') weatherFetch(); HUB.toast('Refreshing weather…'); } },
    { icon:'⬇', title:'Export backup',     sub:'Action', keys:'backup export download save data', run:()=>{ if(typeof exportData==='function') exportData(); } },
  );

  // ── Themes ──
  [['default','Sky'],['violet','Violet'],['emerald','Emerald'],['ember','Ember'],['gold','Gold'],['rose','Rose']]
    .forEach(([t, name]) => cmds.push({
      icon:'🎨', title:`Theme: ${name}`, sub:'Theme', keys:`theme color ${name}`,
      run: () => { if (typeof setTheme === 'function') setTheme(t, document.querySelector(`[data-t="${t}"]`)); }
    }));

  // ── Services ──
  const s = HUB.get('settings', {});
  cmds.push(
    { icon:'🎬', title:'Open Jellyfin', sub:'Service', keys:'jellyfin media stream', run:()=>window.open(s.jellyfinUrl || 'http://localhost:8096','_blank') },
    { icon:'🌐', title:'Open Router',   sub:'Service', keys:'router network admin', run:()=>window.open(s.routerUrl || 'http://192.168.1.1','_blank') },
  );
  (HUB.get('customServices', []) || []).forEach(svc => svc.url && cmds.push({
    icon: svc.icon || '🔗', title: `Open ${svc.name}`, sub:'Service', keys:`${svc.name} service`,
    run: () => window.open(svc.url, '_blank')
  }));

  // ── Dynamic: bookmarks (open directly) ──
  (HUB.get('bookmarks', []) || []).forEach(b => cmds.push({
    icon: b.icon || '🔖', title: b.title, sub: `Bookmark · ${b.cat || 'General'}`, keys: `${b.title} ${b.url} ${b.cat}`,
    run: () => window.open(b.url, '_blank')
  }));

  // ── Dynamic: active tasks ──
  (HUB.get('todos', []) || []).filter(t => !t.done).slice(0, 40).forEach(t => cmds.push({
    icon:'☐', title: t.text, sub: 'Task' + (t.due ? ` · due ${HUB.fmtDate(t.due)}` : ''), keys: `${t.text} ${t.cat || ''} task todo`,
    run: () => goTab('tasks')
  }));

  // ── Dynamic: upcoming events ──
  const today = HUB.todayISO();
  (HUB.get('events', []) || []).filter(e => e.date >= today).slice(0, 20).forEach(e => cmds.push({
    icon:'📅', title: e.title, sub: `Event · ${HUB.fmtDate(e.date)}`, keys: `${e.title} event calendar`,
    run: () => goTab('tasks')
  }));

  // ── Dynamic: watchlist (unwatched) ──
  (HUB.get('watchlist', []) || []).filter(w => !w.watched).slice(0, 20).forEach(w => cmds.push({
    icon:'🎞️', title: w.title, sub: 'Watchlist', keys: `${w.title} watch movie show`,
    run: () => goTab('family')
  }));

  return cmds;
}

function _renderPaletteResults(q) {
  const list = document.getElementById('cmdk-results');
  if (!list) return;
  const all = buildCommands();
  const query = q.trim().toLowerCase();
  _pResults = query
    ? all.filter(c => (c.title + ' ' + (c.sub||'') + ' ' + (c.keys||'')).toLowerCase().includes(query)).slice(0, 40)
    : all.slice(0, 14);
  _pSel = 0;

  if (!_pResults.length) {
    list.innerHTML = `<div class="cmdk-empty">No matches for "${HUB.esc(q)}"</div>`;
    return;
  }
  list.innerHTML = _pResults.map((c, i) => `
    <div class="cmdk-item ${i === _pSel ? 'sel' : ''}" data-i="${i}" onmousemove="_paletteHover(${i})" onclick="_paletteRun(${i})">
      <span class="cmdk-icon">${c.icon || '•'}</span>
      <span class="cmdk-title">${HUB.esc(c.title)}</span>
      <span class="cmdk-sub">${HUB.esc(c.sub || '')}</span>
    </div>`).join('');
}

function _scrollSelIntoView() {
  document.querySelector('.cmdk-item.sel')?.scrollIntoView({ block: 'nearest' });
}

function _paletteHover(i) {
  _pSel = i;
  document.querySelectorAll('.cmdk-item').forEach((el, idx) => el.classList.toggle('sel', idx === i));
}

function _paletteRun(i) {
  const c = _pResults[i];
  if (!c) return;
  HUB.paletteClose();
  try { c.run(); } catch (e) {}
}

HUB.paletteOpen = () => {
  const ov = document.getElementById('cmdk');
  if (!ov) return;
  ov.classList.add('active');
  HUB._paletteActive = true;
  const inp = document.getElementById('cmdk-input');
  if (inp) { inp.value = ''; setTimeout(() => inp.focus(), 30); }
  _renderPaletteResults('');
};
HUB.paletteClose = () => {
  const ov = document.getElementById('cmdk');
  if (!ov) return;
  ov.classList.remove('active');
  HUB._paletteActive = false;
};
HUB.paletteToggle = () => { HUB._paletteActive ? HUB.paletteClose() : HUB.paletteOpen(); };

function paletteInit() {
  if (_pWired) return;     // guard: never wire twice on re-init
  _pWired = true;

  // Global open shortcut: Ctrl+K / Cmd+K
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
      e.preventDefault();
      HUB.paletteToggle();
      return;
    }
    if (!HUB._paletteActive) return;
    if (e.key === 'Escape') { e.preventDefault(); HUB.paletteClose(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); _pSel = Math.min(_pSel + 1, _pResults.length - 1); _highlight(); }
    else if (e.key === 'ArrowUp')   { e.preventDefault(); _pSel = Math.max(_pSel - 1, 0); _highlight(); }
    else if (e.key === 'Enter')     { e.preventDefault(); _paletteRun(_pSel); }
  });

  // Typing in the input filters
  const inp = document.getElementById('cmdk-input');
  if (inp) inp.addEventListener('input', () => _renderPaletteResults(inp.value));

  // Click backdrop to close
  const ov = document.getElementById('cmdk');
  if (ov) ov.addEventListener('click', e => { if (e.target === ov) HUB.paletteClose(); });
}

function _highlight() {
  document.querySelectorAll('.cmdk-item').forEach((el, idx) => el.classList.toggle('sel', idx === _pSel));
  _scrollSelIntoView();
}
