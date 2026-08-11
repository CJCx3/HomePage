/* ═══════════════════════════════════════
   TODOS.JS — To-do list + Habits tracker
   ═══════════════════════════════════════ */

/* ─── TODOS ─── */
let _todoFilter  = 'all';   // persisted active filter
let _todoEditId  = null;    // id of task being inline-edited
let _todoDragId  = null;    // id of task being dragged

const RECUR_LABELS = { '': 'One-time', daily: '🔁 Daily', weekly: '🔁 Weekly', monthly: '🔁 Monthly' };

function todosInit() {
  renderTodos();
  const input = document.getElementById('todo-input');
  if (input) input.addEventListener('keydown', e => { if (e.key === 'Enter') addTodo(); });
}

function addTodo() {
  const txt  = (document.getElementById('todo-input')?.value || '').trim();
  if (!txt) return;
  const pri   = document.getElementById('todo-pri')?.value   || 'med';
  const due   = document.getElementById('todo-due')?.value   || '';
  const cat   = (document.getElementById('todo-cat')?.value  || '').replace(/^#/, '').trim();
  const recur = document.getElementById('todo-recur')?.value || '';
  const list = HUB.get('todos', []);
  list.unshift({ id: Date.now(), text: txt, done: false, pri, due, cat, recur, notified: '' });
  HUB.set('todos', list);
  ['todo-input','todo-due','todo-cat'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  const rsel = document.getElementById('todo-recur'); if (rsel) rsel.value = '';
  renderTodos();
  HUB.updateStats();
  renderHomePreviewSafe();
  HUB.toast('Task added ✔', 'success');
}

// Advance an ISO date by a recurrence period
function _advanceDate(iso, recur) {
  const base = iso ? new Date(iso + 'T00:00:00') : new Date();
  if (recur === 'daily')   base.setDate(base.getDate() + 1);
  if (recur === 'weekly')  base.setDate(base.getDate() + 7);
  if (recur === 'monthly') base.setMonth(base.getMonth() + 1);
  return `${base.getFullYear()}-${String(base.getMonth()+1).padStart(2,'0')}-${String(base.getDate()).padStart(2,'0')}`;
}

function toggleTodo(id) {
  const list = HUB.get('todos', []);
  const item = list.find(t => t.id === id);
  if (!item) return;
  item.done = !item.done;
  item.doneAt = item.done ? Date.now() : null;
  // Recurring: when completed, spawn the next occurrence
  if (item.done && item.recur) {
    list.unshift({
      id: Date.now(), text: item.text, done: false, pri: item.pri,
      due: _advanceDate(item.due, item.recur), cat: item.cat, recur: item.recur, notified: ''
    });
    HUB.toast(`Next "${item.text}" scheduled`, 'info', '🔁');
  }
  HUB.set('todos', list);
  renderTodos(); HUB.updateStats(); renderHomePreviewSafe();
}

function deleteTodo(id) {
  HUB.set('todos', HUB.get('todos', []).filter(t => t.id !== id));
  if (_todoEditId === id) _todoEditId = null;
  renderTodos(); HUB.updateStats(); renderHomePreviewSafe();
}

function clearDoneTodos() {
  HUB.set('todos', HUB.get('todos', []).filter(t => !t.done));
  renderTodos(); HUB.updateStats(); renderHomePreviewSafe();
  HUB.toast('Cleared completed tasks');
}

function filterTodos(filter) {
  _todoFilter = filter;
  renderTodos();
}

/* ─── INLINE EDIT ─── */
function editTodo(id)   { _todoEditId = id; renderTodos(); }
function cancelTodoEdit(){ _todoEditId = null; renderTodos(); }
function saveTodoEdit(id) {
  const list = HUB.get('todos', []);
  const t = list.find(x => x.id === id);
  if (!t) return;
  const txt = (document.getElementById(`edit-text-${id}`)?.value || '').trim();
  if (!txt) { HUB.toast('Task text required', 'error'); return; }
  t.text  = txt;
  t.pri   = document.getElementById(`edit-pri-${id}`)?.value   || t.pri;
  t.due   = document.getElementById(`edit-due-${id}`)?.value   || '';
  t.cat   = (document.getElementById(`edit-cat-${id}`)?.value  || '').replace(/^#/, '').trim();
  t.recur = document.getElementById(`edit-recur-${id}`)?.value || '';
  t.notified = '';
  HUB.set('todos', list);
  _todoEditId = null;
  renderTodos(); HUB.updateStats(); renderHomePreviewSafe();
  HUB.toast('Task updated ✔', 'success');
}

/* ─── DRAG-TO-REORDER ─── */
function _todoDragStart(e, id) { _todoDragId = id; e.dataTransfer.effectAllowed = 'move'; e.target.closest('.todo-item')?.classList.add('dragging'); }
function _todoDragEnd(e)       { _todoDragId = null; document.querySelectorAll('.todo-item').forEach(x => x.classList.remove('dragging','drag-over')); }
function _todoDragOver(e, id)  { e.preventDefault(); const row = e.target.closest('.todo-item'); if (row && _todoDragId !== null && id !== _todoDragId) row.classList.add('drag-over'); }
function _todoDragLeave(e)     { e.target.closest('.todo-item')?.classList.remove('drag-over'); }
function _todoDrop(e, targetId) {
  e.preventDefault();
  if (_todoDragId === null || _todoDragId === targetId) return;
  const list = HUB.get('todos', []);
  const from = list.findIndex(t => t.id === _todoDragId);
  const to   = list.findIndex(t => t.id === targetId);
  if (from < 0 || to < 0) return;
  const [moved] = list.splice(from, 1);
  const newTo = list.findIndex(t => t.id === targetId);
  list.splice(newTo, 0, moved);
  HUB.set('todos', list);
  _todoDragId = null;
  renderTodos();
}

function renderTodos() {
  const filter = _todoFilter;
  // Keep filter buttons in sync
  document.querySelectorAll('.todo-filter-btn').forEach(b => b.classList.toggle('active', b.dataset.filter === filter));

  // Completion progress (computed from the full list, not the active filter)
  const fullList = HUB.get('todos', []);
  const prog = document.getElementById('todo-progress');
  if (prog) {
    const total = fullList.length;
    const done  = fullList.filter(t => t.done).length;
    const pct   = total ? Math.round(done / total * 100) : 0;
    prog.innerHTML = total
      ? `<div style="display:flex;justify-content:space-between;font-size:.78rem;color:var(--muted);margin-bottom:6px;">
           <span>${done} of ${total} complete</span><span>${pct}%</span></div>
         <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>`
      : '';
  }

  let list = HUB.get('todos', []);
  if (filter === 'active')  list = list.filter(t => !t.done);
  if (filter === 'done')    list = list.filter(t => t.done);
  if (filter === 'today')   list = list.filter(t => HUB.isToday(t.due) || (!t.due && !t.done));
  if (filter === 'overdue') list = list.filter(t => !t.done && HUB.isOverdue(t.due));

  // Done items sink to the bottom; otherwise preserve manual (drag) order
  list = [...list].sort((a, b) => (a.done === b.done ? 0 : a.done ? 1 : -1));

  const el = document.getElementById('todo-list');
  if (!el) return;

  if (!list.length) {
    el.innerHTML = `<div class="empty-state"><div class="es-icon">✅</div>
      ${filter === 'all' ? 'All clear! Add a task above.' : 'No tasks here.'}</div>`;
    return;
  }

  const pc = { high: 'p-high', med: 'p-med', low: 'p-low' };
  const pl = { high: '🔴 High', med: '🟡 Med', low: '🟢 Low' };
  const recurOpts = (sel) => Object.entries(RECUR_LABELS).map(([v, l]) =>
    `<option value="${v}" ${v === sel ? 'selected' : ''}>${l}</option>`).join('');

  el.innerHTML = list.map(t => {
    // ── Edit mode row ──
    if (t.id === _todoEditId) {
      return `<div class="todo-item editing">
        <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:8px;">
          <input id="edit-text-${t.id}" value="${HUB.esc(t.text)}" onkeydown="if(event.key==='Enter')saveTodoEdit(${t.id});if(event.key==='Escape')cancelTodoEdit()">
          <div class="row" style="flex-wrap:wrap;gap:8px;">
            <select id="edit-pri-${t.id}" style="width:auto;flex:none;">
              <option value="high" ${t.pri==='high'?'selected':''}>🔴 High</option>
              <option value="med"  ${t.pri==='med'?'selected':''}>🟡 Med</option>
              <option value="low"  ${t.pri==='low'?'selected':''}>🟢 Low</option>
            </select>
            <input type="date" id="edit-due-${t.id}" value="${t.due || ''}" style="width:auto;flex:none;">
            <input id="edit-cat-${t.id}" value="${HUB.esc(t.cat || '')}" placeholder="#tag" style="width:100px;flex:none;">
            <select id="edit-recur-${t.id}" style="width:auto;flex:none;">${recurOpts(t.recur || '')}</select>
          </div>
          <div class="row">
            <button class="btn btn-primary btn-sm" onclick="saveTodoEdit(${t.id})">💾 Save</button>
            <button class="btn btn-secondary btn-sm" onclick="cancelTodoEdit()">Cancel</button>
          </div>
        </div>
      </div>`;
    }
    // ── Normal row ──
    const overdue = !t.done && HUB.isOverdue(t.due);
    const today   = !t.done && HUB.isToday(t.due);
    return `<div class="todo-item ${t.done ? 'done' : ''}" draggable="true"
        ondragstart="_todoDragStart(event,${t.id})" ondragend="_todoDragEnd(event)"
        ondragover="_todoDragOver(event,${t.id})" ondragleave="_todoDragLeave(event)" ondrop="_todoDrop(event,${t.id})">
      <span class="drag-handle" title="Drag to reorder">⋮⋮</span>
      <div class="todo-check ${t.done ? 'checked' : ''}" onclick="toggleTodo(${t.id})" title="Mark done"></div>
      <div style="flex:1;min-width:0;cursor:pointer;" onclick="editTodo(${t.id})" title="Click to edit">
        <div class="todo-text">${HUB.esc(t.text)} ${t.recur ? `<span class="recur-tag">${RECUR_LABELS[t.recur].replace('🔁 ','🔁')}</span>` : ''}</div>
        ${t.due ? `<div class="todo-sub" style="color:${overdue ? 'var(--danger)' : today ? 'var(--warn)' : 'var(--muted)'}">
          ${overdue ? '⚠ Overdue — ' : today ? '📅 Today — ' : '📅 '}${HUB.fmtDate(t.due)}</div>` : ''}
        ${t.cat ? `<div class="todo-sub">#${HUB.esc(t.cat)}</div>` : ''}
      </div>
      <span class="pbadge ${pc[t.pri] || 'p-med'}">${pl[t.pri] || '🟡 Med'}</span>
      <button class="btn btn-ghost btn-sm btn-icon" onclick="editTodo(${t.id})" title="Edit">✎</button>
      <button class="btn btn-ghost btn-sm btn-icon" onclick="deleteTodo(${t.id})" title="Delete">✕</button>
    </div>`;
  }).join('');
}

/* ─── RECURRING ROLLOVER + DUE-TODAY REMINDERS ─── */
function processRecurringAndReminders() {
  const list = HUB.get('todos', []);
  if (!list.length) return;
  const today = HUB.todayISO();
  let changed = false;
  const dueNow = [];
  list.forEach(t => {
    if (t.done) return;
    if (HUB.isToday(t.due) && t.notified !== today) {
      dueNow.push(t.text);
      t.notified = today;
      changed = true;
    }
  });
  if (changed) HUB.set('todos', list);
  if (dueNow.length) {
    HUB.beepSimple(660, 0.4, 0.4);
    const label = dueNow.length === 1 ? `"${dueNow[0]}"` : `${dueNow.length} tasks`;
    HUB.toast(`⏰ Due today: ${label}`, 'warn', '⏰');
  }
}

// Safe wrapper — renderHomePreview lives in index.html inline script
function renderHomePreviewSafe() { try { if (typeof renderHomePreview === 'function') renderHomePreview(); } catch {} }

/* ─── HABITS ─── */
function habitsInit() { renderHabits(); }

function addHabit() {
  const txt = (document.getElementById('habit-input')?.value || '').trim();
  if (!txt) return;
  const habits = HUB.get('habits', []);
  habits.push({ id: Date.now(), name: txt, history: [] });
  HUB.set('habits', habits);
  document.getElementById('habit-input').value = '';
  renderHabits();
  HUB.toast('Habit added ✔', 'success');
}

function toggleHabit(id) {
  const habits = HUB.get('habits', []);
  const h = habits.find(x => x.id === id);
  if (!h) return;
  const today = HUB.dateISO();   // local date — matches the wall clock
  const idx   = h.history.indexOf(today);
  if (idx >= 0) h.history.splice(idx, 1);
  else          h.history.push(today);
  HUB.set('habits', habits);
  renderHabits();
}

function deleteHabit(id) {
  HUB.set('habits', HUB.get('habits', []).filter(h => h.id !== id));
  renderHabits();
}

function renderHabits() {
  const el = document.getElementById('habit-list');
  if (!el) return;
  const habits = HUB.get('habits', []);
  if (!habits.length) {
    el.innerHTML = '<div class="empty-state"><div class="es-icon">🎯</div>No habits yet. Add one to start tracking!</div>';
    return;
  }
  const today = HUB.dateISO();
  // Show last 7 days as dots (local dates)
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - 6 + i); return HUB.dateISO(d);
  });
  el.innerHTML = habits.map(h => {
    const isDoneToday = h.history.includes(today);
    // Calculate streak
    let streak = 0;
    let d = new Date(); d.setDate(d.getDate() - (isDoneToday ? 0 : 1));
    while (h.history.includes(HUB.dateISO(d))) {
      streak++;
      d.setDate(d.getDate() - 1);
    }
    return `<div class="habit-item">
      <div style="flex:1;">
        <div class="habit-name">${HUB.esc(h.name)}</div>
        <div class="habit-streak">🔥 ${streak} day streak</div>
      </div>
      <div class="habit-dots">
        ${last7.map(day => `<div class="habit-dot ${h.history.includes(day) ? 'done' : ''}" title="${day}"></div>`).join('')}
      </div>
      <button class="btn ${isDoneToday ? 'btn-success' : 'btn-secondary'} btn-sm" onclick="toggleHabit(${h.id})">
        ${isDoneToday ? '✔ Done' : 'Mark Done'}
      </button>
      <button class="btn btn-ghost btn-sm btn-icon" onclick="deleteHabit(${h.id})">✕</button>
    </div>`;
  }).join('');
}

/* ─── NOTES ─── */
let _noteTimer = null;
function noteInit() {
  const el = document.getElementById('notes');
  if (!el) return;
  el.value = HUB.get('notes', '');
  el.addEventListener('input', () => {
    clearTimeout(_noteTimer);
    _noteTimer = setTimeout(() => {
      HUB.set('notes', el.value);
      const st = document.getElementById('notes-status');
      if (st) st.textContent = 'Auto-saved at ' + new Date().toLocaleTimeString();
      HUB.updateStats();
    }, 800);
  });
}
function saveNotes() {
  const el = document.getElementById('notes');
  if (!el) return;
  HUB.set('notes', el.value);
  HUB.toast('Notes saved ✔', 'success');
  HUB.updateStats();
}
function clearNotes() {
  if (!confirm('Clear all notes?')) return;
  HUB.del('notes');
  const el = document.getElementById('notes'); if (el) el.value = '';
  const st = document.getElementById('notes-status'); if (st) st.textContent = '';
  HUB.updateStats(); HUB.toast('Notes cleared');
}
function copyNotes()   { navigator.clipboard.writeText(document.getElementById('notes')?.value || ''); HUB.toast('Copied ✔', 'success'); }
function copyScratch() { navigator.clipboard.writeText(document.getElementById('scratch')?.value || ''); HUB.toast('Copied ✔', 'success'); }
