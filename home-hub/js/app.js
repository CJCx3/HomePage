/* ═══════════════════════════════════════
   APP.JS — Core utilities, storage, tabs, toasts, idle detection
   ═══════════════════════════════════════ */

const HUB = {};

/* ─── STORAGE ─── */
HUB.get = (k, def = null) => {
  try { const v = localStorage.getItem('hub_' + k); return v !== null ? JSON.parse(v) : def; }
  catch { return def; }
};
HUB.set = (k, v) => { try { localStorage.setItem('hub_' + k, JSON.stringify(v)); } catch {} };
HUB.del = (k)    => { localStorage.removeItem('hub_' + k); };

/* ─── NAMED INTERVALS (prevents stacking on re-init) ─── */
HUB._intervals = {};
HUB.every = (name, fn, ms) => {
  clearInterval(HUB._intervals[name]);
  HUB._intervals[name] = setInterval(fn, ms);
  return HUB._intervals[name];
};

/* ─── TOAST ─── */
HUB.toast = (msg, type = 'info', icon = '') => {
  const wrap = document.getElementById('toasts');
  if (!wrap) return;
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  const icons = { success: '✔', error: '✕', warn: '⚠', info: 'ℹ' };
  el.innerHTML = `<span>${icon || icons[type] || 'ℹ'}</span><span>${msg}</span>`;
  wrap.appendChild(el);
  setTimeout(() => { el.style.animation = 'toastOut .22s ease forwards'; setTimeout(() => el.remove(), 220); }, 3200);
};

/* ─── TABS ─── */
HUB.switchTab = (id, btn) => {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  const panel = document.getElementById('tab-' + id);
  if (panel) panel.classList.add('active');
  if (btn) btn.classList.add('active');
  HUB.currentTab = id;
  HUB.set('lastTab', id);   // remember across reloads
  // Keep the two notes textareas (Tasks + Tools) in sync with stored value
  const noteVal = HUB.get('notes', '');
  const n1 = document.getElementById('notes');      if (n1 && document.activeElement !== n1) n1.value = noteVal;
  const n2 = document.getElementById('tools-note');  if (n2 && document.activeElement !== n2) n2.value = noteVal;
  document.querySelector('.main')?.scrollTo({ top: 0, behavior: 'smooth' });
  window.scrollTo({ top: 0, behavior: 'smooth' });
  HUB.updateStats();
  HUB.resetIdle();
};

/* ─── STATS (badge counts) ─── */
HUB.updateStats = () => {
  const todos = HUB.get('todos', []);
  const remaining = todos.filter(t => !t.done).length;
  // Tasks tab badge
  const badge = document.getElementById('tab-badge-todos');
  if (badge) { badge.textContent = remaining; badge.style.display = remaining ? 'inline-flex' : 'none'; }

  const msgs = HUB.get('messages', []);
  document.getElementById('stat-notes') && (document.getElementById('stat-notes').textContent =
    (() => { const n = HUB.get('notes',''); return n.trim() ? n.trim().split(/\s+/).length : 0; })());
  document.getElementById('stat-todos') && (document.getElementById('stat-todos').textContent = remaining);
  const bm = HUB.get('bookmarks', []);
  document.getElementById('stat-bm') && (document.getElementById('stat-bm').textContent = bm.length);
  document.getElementById('stat-msgs') && (document.getElementById('stat-msgs').textContent = msgs.length);

  const grocery = HUB.get('grocery', []);
  document.getElementById('stat-grocery') && (document.getElementById('stat-grocery').textContent =
    grocery.filter(g => !g.checked).length);

  // Personalized hero sub-line (uses the first family name from Settings)
  const sub = document.getElementById('hero-sub');
  if (sub) {
    const name = ((HUB.get('settings', {}).familyNames || ['You'])[0] || 'there').trim() || 'there';
    sub.textContent = `Welcome back, ${name}. Here's your home overview.`;
  }

  // Notes preview on home tab
  const prev = document.getElementById('notes-preview');
  if (prev) {
    const n = HUB.get('notes', '');
    prev.style.color = n ? 'var(--text)' : 'var(--muted)';
    prev.textContent  = n ? (n.length > 280 ? n.slice(0, 280) + '…' : n)
                          : 'No notes yet — head to Tasks to write something.';
  }
};

/* ─── AMBIENT MODE ─── */
HUB.ambientOpen = () => {
  const ov = document.getElementById('ambient-overlay');
  if (ov) { ov.classList.add('active'); HUB._ambientActive = true; }
};
HUB.ambientClose = () => {
  const ov = document.getElementById('ambient-overlay');
  if (ov) { ov.classList.remove('active'); HUB._ambientActive = false; HUB.resetIdle(); }
};

/* ─── IDLE DETECTION (auto ambient) ─── */
HUB._idleTimer = null;
HUB._idleMins  = 10;
HUB._ambientActive = false;
HUB.resetIdle = () => {
  clearTimeout(HUB._idleTimer);
  if (HUB._ambientActive) return;
  const mins = HUB.get('settings', {}).ambientMins ?? HUB._idleMins;
  if (mins === 0) return;
  HUB._idleTimer = setTimeout(() => { HUB.ambientOpen(); }, mins * 60 * 1000);
};
['mousemove','keydown','click','touchstart','scroll'].forEach(ev => {
  document.addEventListener(ev, () => { if (!HUB._ambientActive) HUB.resetIdle(); });
});

/* ─── ESCAPE KEY ─── */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && HUB._ambientActive) HUB.ambientClose();
});

/* ─── ALT+1…6 → jump straight to a tab ─── */
const TAB_ORDER = ['home', 'tasks', 'family', 'bookmarks', 'tools', 'settings'];
document.addEventListener('keydown', e => {
  if (!e.altKey || e.ctrlKey || e.metaKey) return;
  const idx = '123456'.indexOf(e.key);
  if (idx < 0) return;
  e.preventDefault();
  HUB.switchTab(TAB_ORDER[idx], document.querySelectorAll('.tab-btn')[idx]);
});

/* ─── ESC HTML ─── */
HUB.esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

/* ─── FORMAT DATE ─── */
HUB.fmtDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};
// Local-date ISO (YYYY-MM-DD) for any Date — never UTC, so day rollover
// matches the wall clock instead of jumping ahead in the evening.
HUB.dateISO   = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
HUB.todayISO  = () => HUB.dateISO();
// Overdue = strictly before today's date (a task due *today* is NOT overdue)
HUB.isOverdue = (iso) => { if (!iso) return false; return iso < HUB.todayISO(); };
HUB.isToday   = (iso) => { if (!iso) return false; return iso === HUB.todayISO(); };

/* ─── BEEP (for timer alerts) ───
   One shared AudioContext, reused for every tone. Creating a fresh
   context per beep (the old approach) leaks them — browsers cap how many
   can exist, so alerts would silently stop working after a few uses. */
HUB._getAudioCtx = () => {
  try {
    if (!HUB._audioCtx) HUB._audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (HUB._audioCtx.state === 'suspended') HUB._audioCtx.resume();
    return HUB._audioCtx;
  } catch { return null; }
};
// Schedule a single tone on the shared context's own clock (no setTimeout drift)
HUB._tone = (ctx, freq, dur, vol, startAt) => {
  if (!ctx) return;
  const t0   = startAt ?? ctx.currentTime;
  const osc  = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain); gain.connect(ctx.destination);
  osc.type = 'sine'; osc.frequency.value = freq;
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.start(t0); osc.stop(t0 + dur);
};
HUB.beep = (freq = 880, dur = 0.6, vol = 0.5) => {
  const ctx = HUB._getAudioCtx(); if (!ctx) return;
  const t = ctx.currentTime;
  // Triple beep for urgency — all scheduled up front on the audio clock
  HUB._tone(ctx, freq, dur,        vol,        t);
  HUB._tone(ctx, freq, dur * 0.7,  vol * 0.8,  t + dur + 0.15);
  HUB._tone(ctx, freq, dur * 0.5,  vol * 0.6,  t + dur * 2 + 0.3);
};
HUB.beepSimple = (freq = 880, dur = 0.4, vol = 0.4) => {
  const ctx = HUB._getAudioCtx(); if (!ctx) return;
  HUB._tone(ctx, freq, dur, vol);
};

/* ─── INIT ALL ─── */
function initAll() {
  // Apply saved theme
  const s = HUB.get('settings', {});

  // One-time location setup → your area (Eastern Time, °F).
  // Runs once; users can still change city/unit later in Settings.
  if (!s._locationSet) {
    s.weatherCity = 'New York';
    s.weatherUnit = s.weatherUnit || 'fahrenheit';
    s._locationSet = true;
    HUB.set('settings', s);
  }

  // Migrate Jellyfin to its current address (only replaces the old default — leaves custom values alone)
  if (!s.jellyfinUrl || s.jellyfinUrl === 'http://localhost:8096') {
    s.jellyfinUrl = 'http://localhost:8096';
    HUB.set('settings', s);
  }
  if (s.theme && s.theme !== 'default') {
    document.documentElement.setAttribute('data-theme', s.theme);
  }
  // Mark active theme swatch
  const sw = document.querySelector(`[data-t="${s.theme || 'default'}"]`);
  if (sw) { document.querySelectorAll('.tswatch').forEach(x => x.classList.remove('active')); sw.classList.add('active'); }

  // Restore ambient-mins setting
  const ambMins = document.getElementById('set-ambient-mins');
  if (ambMins) ambMins.value = s.ambientMins ?? 10;

  // Init all modules
  clockInit();
  weatherInit();
  servicesInit();
  todosInit();
  habitsInit();
  familyInit();
  groceryInit();
  watchlistInit();
  bookmarksInit();
  calendarInit();
  eventsInit();
  timersInit();
  pomodoroInit();
  stopwatchInit();
  calculatorInit();
  converterInit();
  colorToolInit();
  settingsInit();
  noteInit();
  paletteInit();

  // Roll over recurring tasks / surface due reminders (defined in todos.js)
  if (typeof processRecurringAndReminders === 'function') processRecurringAndReminders();

  HUB.updateStats();
  HUB.resetIdle();

  // Sync tools-note textarea with notes store
  const tn = document.getElementById('tools-note');
  if (tn) tn.value = HUB.get('notes', '');

  // ─── ONE-TIME WIRING (guarded so re-init via import/clear doesn't stack) ───
  if (!HUB._wired) {
    HUB._wired = true;
    // Ambient overlay click-to-close
    const ov = document.getElementById('ambient-overlay');
    if (ov) ov.addEventListener('click', e => { if (e.target === ov || e.target.closest('.ambient-exit-btn')) HUB.ambientClose(); });
    // Check for due tasks once a minute
    HUB.every('reminders', () => { if (typeof processRecurringAndReminders === 'function') processRecurringAndReminders(); }, 60 * 1000);
    // Prime the audio context on the first user gesture so later timer/pomodoro
    // beeps are allowed to play (browsers block audio before any interaction).
    ['pointerdown', 'keydown', 'touchstart'].forEach(ev =>
      document.addEventListener(ev, () => HUB._getAudioCtx(), { once: true }));
    // Restore the tab the user was last on
    const lastTab = HUB.get('lastTab', 'home');
    const lastIdx = TAB_ORDER.indexOf(lastTab);
    if (lastIdx > 0) HUB.switchTab(lastTab, document.querySelectorAll('.tab-btn')[lastIdx]);
  }
}
