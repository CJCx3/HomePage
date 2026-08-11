/* ═══════════════════════════════════════
   FAMILY.JS — Messages, Grocery list, Watchlist
   ═══════════════════════════════════════ */

const AVATAR_COLORS = ['#38bdf8','#22c55e','#a78bfa','#fb923c','#f472b6','#fbbf24'];

/* ─── MESSAGE BOARD ─── */
function familyInit() {
  renderMessages();
  const input = document.getElementById('msg-input');
  if (input) input.addEventListener('keydown', e => { if (e.ctrlKey && e.key === 'Enter') postMessage(); });
}

function postMessage() {
  const body   = (document.getElementById('msg-input')?.value || '').trim();
  const fromEl = document.getElementById('msg-from');
  const settings = HUB.get('settings', {});
  const names    = settings.familyNames || ['CJC'];
  const from  = fromEl?.value || names[0] || 'CJC';
  if (!body) return;
  const msgs = HUB.get('messages', []);
  msgs.unshift({ id: Date.now(), from, body, time: new Date().toISOString() });
  HUB.set('messages', msgs.slice(0, 50)); // keep last 50
  const inp = document.getElementById('msg-input'); if (inp) inp.value = '';
  renderMessages();
  HUB.updateStats();
  HUB.toast('Message posted ✔', 'success');
}

function deleteMessage(id) {
  HUB.set('messages', HUB.get('messages', []).filter(m => m.id !== id));
  renderMessages(); HUB.updateStats();
}

function renderMessages() {
  const el   = document.getElementById('msg-list');
  if (!el) return;
  const msgs = HUB.get('messages', []);

  // Update from dropdown with saved names
  const settings = HUB.get('settings', {});
  const names = settings.familyNames || ['CJC'];
  const fromEl = document.getElementById('msg-from');
  if (fromEl) {
    fromEl.innerHTML = names.map(n => `<option value="${HUB.esc(n)}">${HUB.esc(n)}</option>`).join('');
  }

  // Update ambient rotating message
  updateAmbientMessage(msgs);

  if (!msgs.length) {
    el.innerHTML = '<div class="empty-state"><div class="es-icon">💬</div>No messages yet. Post one for the family!</div>';
    return;
  }
  el.innerHTML = msgs.map(m => {
    const nameIdx = (names.indexOf(m.from) + 4) % AVATAR_COLORS.length;
    const color   = AVATAR_COLORS[nameIdx] || AVATAR_COLORS[0];
    const initials = m.from.split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2);
    const timeStr  = new Date(m.time).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    return `<div class="msg-item">
      <div class="msg-header">
        <div style="display:flex;align-items:center;gap:10px;">
          <div class="msg-avatar" style="background:${color}22;color:${color};border:1px solid ${color}44;">${initials}</div>
          <span class="msg-from" style="color:${color}">${HUB.esc(m.from)}</span>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          <span class="msg-time">${timeStr}</span>
          <button class="btn btn-ghost btn-xs" onclick="deleteMessage(${m.id})">✕</button>
        </div>
      </div>
      <div class="msg-body">${HUB.esc(m.body).replace(/\n/g,'<br>')}</div>
    </div>`;
  }).join('');
}

/* ─── AMBIENT MESSAGE ROTATOR ─── */
let _ambientMsgIndex = 0;
function updateAmbientMessage(msgs) {
  const el = document.getElementById('ambient-msg');
  if (!el) return;
  if (!msgs.length) { el.textContent = 'Welcome home.'; return; }
  el.textContent = `${msgs[_ambientMsgIndex % msgs.length].from}: "${msgs[_ambientMsgIndex % msgs.length].body}"`;
  _ambientMsgIndex = (_ambientMsgIndex + 1) % msgs.length;
}
setInterval(() => {
  const msgs = HUB.get('messages', []);
  updateAmbientMessage(msgs);
}, 10000); // rotate every 10 seconds

/* ─── GROCERY LIST ─── */
function groceryInit() { renderGrocery(); }

function addGroceryItem() {
  const name = (document.getElementById('grocery-input')?.value || '').trim();
  const qty  = (document.getElementById('grocery-qty')?.value  || '').trim();
  if (!name) return;
  const list = HUB.get('grocery', []);
  list.push({ id: Date.now(), name, qty, checked: false });
  HUB.set('grocery', list);
  ['grocery-input','grocery-qty'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  renderGrocery(); HUB.updateStats();
}

function toggleGrocery(id) {
  const list = HUB.get('grocery', []);
  const item = list.find(g => g.id === id);
  if (item) item.checked = !item.checked;
  HUB.set('grocery', list);
  renderGrocery();
}

function deleteGrocery(id) {
  HUB.set('grocery', HUB.get('grocery', []).filter(g => g.id !== id));
  renderGrocery(); HUB.updateStats();
}

function clearCheckedGrocery() {
  HUB.set('grocery', HUB.get('grocery', []).filter(g => !g.checked));
  renderGrocery(); HUB.updateStats();
  HUB.toast('Cleared checked items');
}

function renderGrocery() {
  const el = document.getElementById('grocery-list');
  if (!el) return;
  const list = HUB.get('grocery', []);
  if (!list.length) {
    el.innerHTML = '<div class="empty-state"><div class="es-icon">🛒</div>Shopping list is empty!</div>';
    return;
  }
  const unchecked = list.filter(g => !g.checked);
  const checked   = list.filter(g =>  g.checked);
  const renderItem = g => `<div class="grocery-item ${g.checked ? 'checked' : ''}">
    <input type="checkbox" ${g.checked ? 'checked' : ''} onchange="toggleGrocery(${g.id})" style="width:18px;height:18px;">
    <span class="grocery-name">${HUB.esc(g.name)}</span>
    ${g.qty ? `<span class="grocery-qty">${HUB.esc(g.qty)}</span>` : ''}
    <button class="btn btn-ghost btn-xs" onclick="deleteGrocery(${g.id})">✕</button>
  </div>`;
  el.innerHTML = unchecked.map(renderItem).join('') +
    (checked.length ? `<div class="divider"></div><div style="font-size:.78rem;color:var(--muted);margin-bottom:6px;">✔ Checked off</div>` + checked.map(renderItem).join('') : '');
}

/* ─── MOVIE/SHOW WATCHLIST ─── */
let _watchFilter = 'all';   // persisted active filter

function watchlistInit() { renderWatchlist(); }

function addWatchItem() {
  const title  = (document.getElementById('watch-input')?.value || '').trim();
  const type   = document.getElementById('watch-type')?.value || 'movie';
  const note   = (document.getElementById('watch-note')?.value || '').trim();
  if (!title) return;
  const list = HUB.get('watchlist', []);
  list.push({ id: Date.now(), title, type, note, watched: false, addedAt: new Date().toISOString() });
  HUB.set('watchlist', list);
  ['watch-input','watch-note'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  renderWatchlist();
  HUB.toast('Added to watchlist ✔', 'success');
}

function toggleWatched(id) {
  const list = HUB.get('watchlist', []);
  const item = list.find(w => w.id === id);
  if (item) item.watched = !item.watched;
  HUB.set('watchlist', list);
  renderWatchlist();
}

function deleteWatchItem(id) {
  HUB.set('watchlist', HUB.get('watchlist', []).filter(w => w.id !== id));
  renderWatchlist();
}

function filterWatchlist(f) {
  _watchFilter = f;
  renderWatchlist();
}

function renderWatchlist() {
  const filter = _watchFilter;
  document.querySelectorAll('.watch-filter-btn').forEach(b => b.classList.toggle('active', b.dataset.wf === filter));
  const el = document.getElementById('watch-list');
  if (!el) return;
  let list = HUB.get('watchlist', []);
  if (filter === 'unwatched') list = list.filter(w => !w.watched);
  if (filter === 'watched')   list = list.filter(w =>  w.watched);
  if (filter === 'movies')    list = list.filter(w => w.type === 'movie');
  if (filter === 'shows')     list = list.filter(w => w.type === 'show');

  if (!list.length) {
    el.innerHTML = '<div class="empty-state"><div class="es-icon">🎬</div>Nothing here yet!</div>';
    return;
  }
  const typeIcons = { movie: '🎬', show: '📺', doc: '🎞️', anime: '⛩️' };
  const badgeClass = { movie: 'wb-movie', show: 'wb-show', doc: 'wb-movie', anime: 'wb-show' };
  el.innerHTML = list.map(w => `<div class="watch-item ${w.watched ? 'done' : ''}">
    <div class="watch-icon">${typeIcons[w.type] || '🎬'}</div>
    <div style="flex:1;min-width:0;">
      <div class="watch-title" style="${w.watched ? 'text-decoration:line-through;opacity:.6' : ''}">${HUB.esc(w.title)}</div>
      ${w.note ? `<div class="watch-meta">${HUB.esc(w.note)}</div>` : ''}
    </div>
    <span class="watch-badge ${w.watched ? 'wb-watched' : badgeClass[w.type] || 'wb-movie'}">${w.watched ? '✔ Watched' : w.type}</span>
    <button class="btn ${w.watched ? 'btn-secondary' : 'btn-success'} btn-sm" onclick="toggleWatched(${w.id})">${w.watched ? 'Unmark' : '✔ Watched'}</button>
    <button class="btn btn-ghost btn-xs" onclick="deleteWatchItem(${w.id})">✕</button>
  </div>`).join('');
}
