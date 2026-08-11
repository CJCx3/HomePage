/* ═══════════════════════════════════════
   BOOKMARKS.JS — Bookmark manager with categories and quick launch
   ═══════════════════════════════════════ */

function bookmarksInit() { renderBookmarks(); }

function addBookmark() {
  const title = (document.getElementById('bm-title')?.value || '').trim();
  let   url   = (document.getElementById('bm-url')?.value   || '').trim();
  const cat   = (document.getElementById('bm-cat')?.value   || '').trim() || 'General';
  const icon  = (document.getElementById('bm-icon')?.value  || '').trim();
  if (!title || !url) { HUB.toast('Title and URL required', 'error'); return; }
  if (!url.match(/^https?:\/\//)) url = 'https://' + url;
  const list = HUB.get('bookmarks', []);
  list.push({ id: Date.now(), title, url, cat, icon });
  HUB.set('bookmarks', list);
  ['bm-title','bm-url','bm-cat','bm-icon'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  renderBookmarks(); HUB.updateStats();
  HUB.toast('Bookmark saved ✔', 'success');
}

function deleteBookmark(id) {
  HUB.set('bookmarks', HUB.get('bookmarks', []).filter(b => b.id !== id));
  renderBookmarks(); HUB.updateStats();
}

// Copy by id — avoids breaking inline onclick when a URL contains quotes
function copyBookmark(id) {
  const b = (HUB.get('bookmarks', []) || []).find(x => x.id === id);
  if (!b) return;
  navigator.clipboard.writeText(b.url);
  HUB.toast('Copied!', 'success');
}

function renderBookmarks() {
  const list = HUB.get('bookmarks', []);
  const el   = document.getElementById('bm-container');
  if (!el) return;

  if (!list.length) {
    el.innerHTML = '<div class="empty-state"><div class="es-icon">⭐</div>No bookmarks yet — add one above!</div>';
    return;
  }

  const cats = [...new Set(list.map(b => b.cat))];
  el.innerHTML = cats.map(cat => {
    const items = list.filter(b => b.cat === cat);
    return `<div class="section">
      <div class="section-title">${HUB.esc(cat)}</div>
      <div class="bm-grid">
        ${items.map(b => {
          // Try to get favicon
          let domain = '';
          try { domain = new URL(b.url).hostname; } catch {}
          const faviconUrl = domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=32` : '';
          return `<div class="bm-card">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
              ${b.icon ? `<span style="font-size:1.2rem;">${b.icon}</span>` : (domain ? `<img src="${faviconUrl}" width="16" height="16" style="border-radius:3px;flex-shrink:0;" onerror="this.style.display='none'">` : '')}
              <a href="${HUB.esc(b.url)}" target="_blank">${HUB.esc(b.title)}</a>
            </div>
            <div class="bm-url">${HUB.esc(b.url)}</div>
            <div class="bm-actions">
              <button class="btn btn-secondary btn-xs" onclick="copyBookmark(${b.id})">📋</button>
              <button class="btn btn-danger btn-xs" onclick="deleteBookmark(${b.id})">✕</button>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>`;
  }).join('');
}

/* ─── CALENDAR & EVENTS ─── */
let _calYear = new Date().getFullYear(), _calMonth = new Date().getMonth();
const _DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const _MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function calendarInit() { renderCalendar(); }

function renderCalendar() {
  const today  = new Date();
  document.getElementById('cal-title') && (document.getElementById('cal-title').textContent = _MONTHS[_calMonth] + ' ' + _calYear);
  const g = document.getElementById('cal-grid');
  if (!g) return;
  const firstDay    = new Date(_calYear, _calMonth, 1).getDay();
  const daysInMonth = new Date(_calYear, _calMonth + 1, 0).getDate();
  const events      = HUB.get('events', []);
  g.innerHTML = _DAYS.map(d => `<div class="cal-dn">${d}</div>`).join('');
  for (let i = 0; i < firstDay; i++) g.innerHTML += `<div class="cal-d empty"></div>`;
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${_calYear}-${String(_calMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const isToday = d === today.getDate() && _calMonth === today.getMonth() && _calYear === today.getFullYear();
    const hasEv   = events.some(e => e.date === dateStr);
    g.innerHTML += `<div class="cal-d ${isToday ? 'today' : ''} ${hasEv ? 'has-event' : ''}" onclick="calDayClick('${dateStr}')">${d}</div>`;
  }
}
function prevMonth() { _calMonth--; if (_calMonth < 0) { _calMonth = 11; _calYear--; } renderCalendar(); }
function nextMonth() { _calMonth++; if (_calMonth > 11) { _calMonth = 0; _calYear++; } renderCalendar(); }
function calDayClick(date) {
  const input = document.getElementById('event-date');
  if (input) { input.value = date; document.getElementById('event-input')?.focus(); }
}

/* ─── EVENTS ─── */
function eventsInit() { renderEvents(); }

function addEvent() {
  const title = (document.getElementById('event-input')?.value || '').trim();
  const date  = document.getElementById('event-date')?.value || '';
  const color = document.getElementById('event-color')?.value || '#38bdf8';
  if (!title || !date) { HUB.toast('Title and date required', 'error'); return; }
  const list = HUB.get('events', []);
  list.push({ id: Date.now(), title, date, color });
  list.sort((a,b) => a.date.localeCompare(b.date));
  HUB.set('events', list);
  ['event-input','event-date'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  renderEvents(); renderCalendar();
  HUB.toast('Event added ✔', 'success');
}

function deleteEvent(id) {
  HUB.set('events', HUB.get('events', []).filter(e => e.id !== id));
  renderEvents(); renderCalendar();
}

function renderEvents() {
  const el = document.getElementById('event-list');
  if (!el) return;
  const events = HUB.get('events', []);
  const today  = new Date().toISOString().slice(0,10);
  const upcoming = events.filter(e => e.date >= today).slice(0, 10);
  const past     = events.filter(e => e.date < today);

  if (!events.length) {
    el.innerHTML = '<div class="empty-state"><div class="es-icon">📅</div>No events. Click a date to add one!</div>';
    return;
  }

  const renderEv = (e) => {
    const isToday = HUB.isToday(e.date);
    const dayDiff = Math.ceil((new Date(e.date + 'T00:00:00') - new Date()) / 86400000);
    const label   = isToday ? 'Today!' : dayDiff === 1 ? 'Tomorrow' : dayDiff > 0 ? `In ${dayDiff} days` : '';
    return `<div class="event-item">
      <div class="event-dot" style="background:${HUB.esc(e.color)}"></div>
      <div style="flex:1;">
        <div class="event-title">${HUB.esc(e.title)}</div>
        <div class="event-time">${HUB.fmtDate(e.date)} ${label ? `· <strong style="color:var(--accent)">${label}</strong>` : ''}</div>
      </div>
      <button class="btn btn-ghost btn-xs" onclick="deleteEvent(${e.id})">✕</button>
    </div>`;
  };

  el.innerHTML = upcoming.map(renderEv).join('') +
    (past.length ? `<details style="margin-top:10px;"><summary style="cursor:pointer;font-size:.82rem;color:var(--muted);padding:4px 0;">Past events (${past.length})</summary><div style="margin-top:8px;">${past.slice(-5).reverse().map(renderEv).join('')}</div></details>` : '');
}
