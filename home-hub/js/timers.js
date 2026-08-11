/* ═══════════════════════════════════════
   TIMERS.JS — Multiple countdown timers, Stopwatch, Pomodoro
   ═══════════════════════════════════════ */

/* ─── COUNTDOWN TIMERS (up to 4 simultaneous) ─── */
const _timers = {}; // id → { total, remaining, running, label, interval }

function timersInit() {
  renderTimerSlots();
}

function renderTimerSlots() {
  const grid = document.getElementById('timer-grid');
  if (!grid) return;
  const slots = ['Timer 1', 'Timer 2', 'Timer 3', 'Timer 4'];
  grid.innerHTML = slots.map((label, i) => `
    <div class="timer-card" id="timer-slot-${i}">
      <div class="timer-label" id="timer-label-${i}">${label}</div>
      <div class="timer-display" id="timer-display-${i}">00:00</div>
      <div class="timer-track"><div class="timer-fill" id="timer-fill-${i}" style="width:100%"></div></div>
      <div style="margin-bottom:12px;">
        <div class="row" style="margin-bottom:8px;">
          <input type="text" id="timer-name-${i}" placeholder="Label (e.g. Pizza)" style="flex:1;">
        </div>
        <div class="row">
          <input type="number" id="timer-h-${i}" min="0" max="23" placeholder="h" style="width:60px;flex:none;">
          <input type="number" id="timer-m-${i}" min="0" max="59" placeholder="min" style="width:70px;flex:none;" value="5">
          <input type="number" id="timer-s-${i}" min="0" max="59" placeholder="sec" style="width:60px;flex:none;">
        </div>
      </div>
      <div class="timer-ctrls">
        <button class="btn btn-success btn-sm" onclick="startTimer(${i})">▶ Start</button>
        <button class="btn btn-secondary btn-sm" onclick="pauseTimer(${i})">⏸</button>
        <button class="btn btn-danger btn-sm" onclick="resetTimer(${i})">↺</button>
      </div>
    </div>
  `).join('');
}

function startTimer(i) {
  if (_timers[i]?.running) return;
  const h = parseInt(document.getElementById(`timer-h-${i}`)?.value) || 0;
  const m = parseInt(document.getElementById(`timer-m-${i}`)?.value) || 0;
  const s = parseInt(document.getElementById(`timer-s-${i}`)?.value) || 0;
  const label = document.getElementById(`timer-name-${i}`)?.value || `Timer ${i+1}`;
  const total = h*3600 + m*60 + s;
  if (total <= 0) { HUB.toast('Set a time first', 'warn'); return; }
  if (_timers[i]) clearInterval(_timers[i].interval);
  _timers[i] = { total, remaining: _timers[i]?.remaining ?? total, running: true, label };
  document.getElementById(`timer-label-${i}`).textContent = label;
  updateTimerDisplay(i);
  _timers[i].interval = setInterval(() => timerTick(i), 1000);
}

function pauseTimer(i) {
  if (!_timers[i]) return;
  if (_timers[i].running) { clearInterval(_timers[i].interval); _timers[i].running = false; }
  else startTimer(i);
}

function resetTimer(i) {
  if (_timers[i]) { clearInterval(_timers[i].interval); delete _timers[i]; }
  const display = document.getElementById(`timer-display-${i}`);
  if (display) { display.textContent = '00:00'; display.className = 'timer-display'; }
  const fill = document.getElementById(`timer-fill-${i}`);
  if (fill) fill.style.width = '100%';
  const label = document.getElementById(`timer-label-${i}`);
  if (label) label.textContent = `Timer ${i+1}`;
}

function timerTick(i) {
  const t = _timers[i];
  if (!t) return;
  t.remaining--;
  updateTimerDisplay(i);
  if (t.remaining <= 0) {
    clearInterval(t.interval);
    t.running = false;
    document.getElementById(`timer-display-${i}`).className = 'timer-display expired';
    document.getElementById(`timer-fill-${i}`).style.width = '0%';
    HUB.beep(880, 0.8, 0.6);
    HUB.toast(`⏰ ${t.label} is done!`, 'warn', '⏰');
    // Flash alert
    const slot = document.getElementById(`timer-slot-${i}`);
    if (slot) { slot.style.borderColor = 'var(--danger)'; setTimeout(() => slot.style.borderColor = '', 5000); }
  }
}

function updateTimerDisplay(i) {
  const t = _timers[i];
  if (!t) return;
  const rem = Math.max(0, t.remaining);
  const h   = Math.floor(rem / 3600);
  const m   = Math.floor((rem % 3600) / 60);
  const s   = rem % 60;
  const str = h > 0
    ? `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
    : `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  const disp = document.getElementById(`timer-display-${i}`);
  if (disp && rem > 0) { disp.textContent = str; disp.className = 'timer-display running'; }
  const fill = document.getElementById(`timer-fill-${i}`);
  if (fill) fill.style.width = (rem / t.total * 100) + '%';
}

/* ─── STOPWATCH ─── */
let _swOn  = false, _swT0 = 0, _swAcc = 0, _swLaps = 0, _swInt;

function stopwatchInit() { updateSwDisplay(0); }

function swFmt(ms) {
  const min = Math.floor(ms / 60000);
  const sec = Math.floor((ms % 60000) / 1000);
  const cs  = Math.floor((ms % 1000) / 10);
  return `${String(min).padStart(2,'0')}:${String(sec).padStart(2,'0')}<span style="font-size:.5em;opacity:.7">.${String(cs).padStart(2,'0')}</span>`;
}

function updateSwDisplay(ms) {
  const el = document.getElementById('sw-display');
  if (el) el.innerHTML = swFmt(ms);
}

function swToggle() {
  if (_swOn) {
    _swAcc += Date.now() - _swT0;
    clearInterval(_swInt);
    _swOn = false;
    document.getElementById('sw-start-btn') && (document.getElementById('sw-start-btn').textContent = '▶ Start');
  } else {
    _swT0 = Date.now();
    _swInt = setInterval(() => updateSwDisplay(_swAcc + Date.now() - _swT0), 50);
    _swOn = true;
    document.getElementById('sw-start-btn') && (document.getElementById('sw-start-btn').textContent = '⏸ Pause');
  }
}

function swLap() {
  if (!_swOn) return;
  const total = _swAcc + Date.now() - _swT0;
  _swLaps++;
  const el = document.getElementById('lap-list');
  if (!el) return;
  const div = document.createElement('div');
  div.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:9px 13px;border-radius:11px;background:rgba(255,255,255,.05);border:1px solid var(--border);margin-bottom:7px;font-variant-numeric:tabular-nums;';
  div.innerHTML = `<span style="color:var(--muted);font-size:.82rem;">Lap ${_swLaps}</span><span style="font-family:monospace;font-size:1rem;">${swFmt(total)}</span>`;
  el.prepend(div);
}

function swReset() {
  clearInterval(_swInt); _swOn = false; _swAcc = 0; _swLaps = 0;
  updateSwDisplay(0);
  document.getElementById('sw-start-btn') && (document.getElementById('sw-start-btn').textContent = '▶ Start');
  const el = document.getElementById('lap-list'); if (el) el.innerHTML = '';
}

/* ─── POMODORO ─── */
const POMO = { work: 25 * 60, short: 5 * 60, long: 15 * 60 };
let _pomo = { mode: 'work', remaining: POMO.work, running: false, sessions: 0, interval: null };

// Sessions completed "today" survive reloads but reset on a new day
function _loadPomoSessions() {
  const s = HUB.get('pomoStats', { date: '', count: 0 });
  return s.date === HUB.dateISO() ? (s.count || 0) : 0;
}
function _savePomoSessions(n) { HUB.set('pomoStats', { date: HUB.dateISO(), count: n }); }

function pomodoroInit() { _pomo.sessions = _loadPomoSessions(); pomoRender(); }

function pomoToggle() {
  if (_pomo.running) {
    clearInterval(_pomo.interval); _pomo.running = false;
    document.getElementById('pomo-btn').textContent = '▶ Start';
  } else {
    _pomo.interval = setInterval(pomoTick, 1000); _pomo.running = true;
    document.getElementById('pomo-btn').textContent = '⏸ Pause';
  }
}

function pomoReset() {
  clearInterval(_pomo.interval); _pomo.running = false;
  _pomo.remaining = POMO[_pomo.mode];
  document.getElementById('pomo-btn') && (document.getElementById('pomo-btn').textContent = '▶ Start');
  pomoRender();
}

function pomoMode(mode) {
  clearInterval(_pomo.interval); _pomo.running = false;
  _pomo.mode = mode; _pomo.remaining = POMO[mode];
  document.querySelectorAll('.pomo-mode-btn').forEach(b => b.classList.remove('active'));
  document.querySelector(`[data-pomo="${mode}"]`)?.classList.add('active');
  document.getElementById('pomo-btn') && (document.getElementById('pomo-btn').textContent = '▶ Start');
  pomoRender();
}

function pomoTick() {
  _pomo.remaining--;
  if (_pomo.remaining <= 0) {
    clearInterval(_pomo.interval); _pomo.running = false;
    if (_pomo.mode === 'work') {
      _pomo.sessions++;
      _savePomoSessions(_pomo.sessions);
      HUB.beep(660, 1.0, 0.6);
      HUB.toast('🍅 Pomodoro complete! Take a break.', 'success', '🍅');
      _pomo.mode = _pomo.sessions % 4 === 0 ? 'long' : 'short';
      _pomo.remaining = POMO[_pomo.mode];
    } else {
      HUB.beep(880, 0.6, 0.5);
      HUB.toast('⏰ Break over! Time to focus.', 'info', '⏰');
      _pomo.mode = 'work'; _pomo.remaining = POMO.work;
    }
    document.getElementById('pomo-btn') && (document.getElementById('pomo-btn').textContent = '▶ Start');
    _pomo.running = false;
  }
  pomoRender();
}

function pomoRender() {
  const total = POMO[_pomo.mode];
  const rem   = Math.max(0, _pomo.remaining);
  const pct   = rem / total;
  const m  = Math.floor(rem / 60), s = rem % 60;
  const timeStr = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  const labels  = { work: 'Focus Time', short: 'Short Break', long: 'Long Break' };
  const colors  = { work: 'var(--danger)', short: 'var(--accent2)', long: 'var(--accent)' };
  const color   = colors[_pomo.mode];

  // Circle
  const R = 70, C = 2 * Math.PI * R;
  const el = document.getElementById('pomo-ring');
  if (el) {
    el.innerHTML = `
      <svg width="160" height="160" viewBox="0 0 160 160">
        <circle cx="80" cy="80" r="${R}" stroke="rgba(255,255,255,.08)" stroke-width="10"/>
        <circle cx="80" cy="80" r="${R}" stroke="${color}" stroke-width="10"
          stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - pct)}"
          style="transition:stroke-dashoffset .5s linear;"/>
      </svg>
      <div style="text-align:center;">
        <div class="pomo-time" style="color:${color}">${timeStr}</div>
        <div class="pomo-label">${labels[_pomo.mode]}</div>
      </div>
    `;
  }

  // Sessions dots
  const dots = document.getElementById('pomo-sessions');
  if (dots) {
    dots.innerHTML = Array.from({length:4},(_,i) => `<div class="pomo-dot ${i < _pomo.sessions % 4 ? 'done' : (_pomo.mode==='work' && i === _pomo.sessions%4 ? 'active' : '')}"></div>`).join('');
  }

  // Session count
  const sc = document.getElementById('pomo-count');
  if (sc) sc.textContent = `${_pomo.sessions} sessions today`;

  // Keep mode buttons in sync (modes auto-advance after a session completes)
  document.querySelectorAll('.pomo-mode-btn').forEach(b => b.classList.remove('active'));
  document.querySelector(`[data-pomo="${_pomo.mode}"]`)?.classList.add('active');
}
