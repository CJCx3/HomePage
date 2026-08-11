/* ═══════════════════════════════════════
   SETTINGS.JS — Theme, config, export/import
   ═══════════════════════════════════════ */

function settingsInit() {
  const s = HUB.get('settings', {});

  // Populate fields
  const fields = {
    'set-jellyfin':   s.jellyfinUrl  || 'http://100.86.241.110:8096',
    'set-router':     s.routerUrl    || 'http://192.168.68.1',
    'set-city':       s.weatherCity  || 'Seven Valleys',
    'set-unit':       s.weatherUnit  || 'fahrenheit',
    'set-ambient-mins': s.ambientMins ?? 10,
    'set-names':      (s.familyNames || ['CJC']).join(', '),
  };
  Object.entries(fields).forEach(([id, val]) => {
    const el = document.getElementById(id); if (el) el.value = val;
  });

  // Mark active theme
  const active = document.querySelector(`[data-t="${s.theme || 'default'}"]`);
  if (active) { document.querySelectorAll('.tswatch').forEach(x => x.classList.remove('active')); active.classList.add('active'); }

  renderCustomServicesSettings();
}

function saveSettings() {
  const s = HUB.get('settings', {});
  s.jellyfinUrl  = document.getElementById('set-jellyfin')?.value.trim()  || s.jellyfinUrl;
  s.routerUrl    = document.getElementById('set-router')?.value.trim()    || s.routerUrl;
  s.weatherCity  = document.getElementById('set-city')?.value.trim()     || 'Seven Valleys';
  s.weatherUnit  = document.getElementById('set-unit')?.value            || 'fahrenheit';
  s.ambientMins  = parseInt(document.getElementById('set-ambient-mins')?.value) || 10;
  const namesRaw = document.getElementById('set-names')?.value || 'CJC';
  s.familyNames  = namesRaw.split(',').map(n => n.trim()).filter(Boolean);
  HUB.set('settings', s);

  // Apply changes immediately
  const jfLinks = document.querySelectorAll('[id^="jellyfin-link"], [id="jellyfin-link2"]');
  jfLinks.forEach(el => { if (el) el.href = s.jellyfinUrl; });
  document.querySelectorAll('.jellyfin-url-label').forEach(el => el.textContent = s.jellyfinUrl);
  const rtLinks = document.querySelectorAll('[id^="router-link"], [id="router-link2"]');
  rtLinks.forEach(el => { if (el) el.href = s.routerUrl; });
  document.querySelectorAll('.router-url-label').forEach(el => el.textContent = s.routerUrl);

  HUB.resetIdle();
  weatherFetch();
  refreshServices();
  renderMessages();   // refresh from dropdown names
  HUB.updateStats();  // refresh personalized greeting

  HUB.toast('Settings saved ✔', 'success');
}

function setTheme(t, el) {
  document.documentElement.setAttribute('data-theme', t === 'default' ? '' : t);
  document.querySelectorAll('.tswatch').forEach(s => s.classList.remove('active'));
  if (el) el.classList.add('active');
  const s = HUB.get('settings', {}); s.theme = t; HUB.set('settings', s);
  HUB.toast('Theme updated ✔', 'success');
}

/* ─── CUSTOM SERVICES ─── */
function renderCustomServicesSettings() {
  const el = document.getElementById('custom-svc-list');
  if (!el) return;
  const list = HUB.get('customServices', []);
  if (!list.length) { el.innerHTML = '<div style="color:var(--muted);font-size:.85rem;">No custom services added yet.</div>'; return; }
  el.innerHTML = list.map((svc, i) => `<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:12px;background:rgba(255,255,255,.05);border:1px solid var(--border);margin-bottom:8px;">
    <span style="font-size:1.3rem;">${svc.icon || '🔗'}</span>
    <div style="flex:1;"><div style="font-weight:700;font-size:.9rem;">${HUB.esc(svc.name)}</div><div style="font-size:.78rem;color:var(--muted);">${HUB.esc(svc.url)}</div></div>
    <button class="btn btn-danger btn-sm" onclick="deleteCustomService(${i})">Remove</button>
  </div>`).join('');
}

function addCustomService() {
  const name = (document.getElementById('csvc-name')?.value || '').trim();
  const url  = (document.getElementById('csvc-url')?.value  || '').trim();
  const icon = (document.getElementById('csvc-icon')?.value || '').trim() || '🔗';
  const desc = (document.getElementById('csvc-desc')?.value || '').trim();
  if (!name || !url) { HUB.toast('Name and URL required', 'error'); return; }
  const list = HUB.get('customServices', []);
  list.push({ name, url, icon, desc });
  HUB.set('customServices', list);
  ['csvc-name','csvc-url','csvc-icon','csvc-desc'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  renderCustomServicesSettings();
  renderCustomServiceCards();
  HUB.toast('Service added ✔', 'success');
}

function deleteCustomService(i) {
  const list = HUB.get('customServices', []);
  list.splice(i, 1);
  HUB.set('customServices', list);
  renderCustomServicesSettings();
  renderCustomServiceCards();
}

function renderCustomServiceCards() {
  const grid = document.getElementById('custom-svc-cards');
  if (!grid) return;
  const list = HUB.get('customServices', []);
  grid.innerHTML = list.map((svc, i) => `
    <div class="card service-card card-accent">
      <div class="svc-top">
        <div class="svc-icon">${svc.icon || '🔗'}</div>
        <div class="status-pill s-checking" id="status-custom-${i}"><span class="s-dot"></span> Checking</div>
      </div>
      <div class="svc-name">${HUB.esc(svc.name)}</div>
      ${svc.desc ? `<div class="svc-desc">${HUB.esc(svc.desc)}</div>` : ''}
      <div class="svc-url">${HUB.esc(svc.url)}</div>
      <a class="svc-link" href="${HUB.esc(svc.url)}" target="_blank">Open ${HUB.esc(svc.name)} ↗</a>
    </div>`).join('');
  // Check status
  list.forEach((svc, i) => checkService(svc.url, `status-custom-${i}`));
}

/* ─── EXPORT / IMPORT ─── */
function exportData() {
  const keys = ['notes','todos','habits','messages','grocery','watchlist','bookmarks','events','settings','customServices','calcHistory'];
  const data = {};
  keys.forEach(k => { data[k] = HUB.get(k); });
  data._exportedAt = new Date().toISOString();
  data._version    = '2.0';
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = `homehub-backup-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  HUB.toast('Backup exported ✔', 'success');
}

function importData(e) {
  const f = e.target.files[0]; if (!f) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      const keys = ['notes','todos','habits','messages','grocery','watchlist','bookmarks','events','settings','customServices','calcHistory'];
      keys.forEach(k => { if (data[k] !== undefined) HUB.set(k, data[k]); });
      initAll();
      HUB.toast('Backup restored ✔', 'success');
    } catch { HUB.toast('Invalid backup file', 'error'); }
  };
  reader.readAsText(f);
  e.target.value = '';
}

/* ─── CLEAR DATA ─── */
function clearData(what) {
  const labels = { notes:'notes', todos:'all tasks', habits:'habits', messages:'messages', grocery:'grocery list', watchlist:'watchlist', bookmarks:'bookmarks', events:'events', all:'ALL DATA (cannot be undone!)' };
  if (!confirm(`Clear ${labels[what] || what}? This cannot be undone.`)) return;
  if (what === 'all') {
    ['notes','todos','habits','messages','grocery','watchlist','bookmarks','events','calcHistory','customServices'].forEach(k => HUB.del(k));
    initAll();
  } else {
    HUB.del(what);
    const refreshers = { notes: noteInit, todos: renderTodos, habits: renderHabits, messages: renderMessages, grocery: renderGrocery, watchlist: renderWatchlist, bookmarks: renderBookmarks, events: renderEvents };
    if (refreshers[what]) refreshers[what]();
  }
  HUB.updateStats();
  HUB.toast('Cleared ✔');
}
