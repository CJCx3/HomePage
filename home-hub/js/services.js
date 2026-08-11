/* ═══════════════════════════════════════
   SERVICES.JS — Network service status checking
   Uses fetch with no-cors for reliable local network detection
   ═══════════════════════════════════════ */

function servicesInit() {
  const settings = HUB.get('settings', {});
  const jfUrl = settings.jellyfinUrl || 'http://localhost:8096';
  const rtUrl = settings.routerUrl   || 'http://192.168.1.1';

  // Set links
  ['jellyfin-link','jellyfin-link2'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.href = jfUrl;
  });
  ['router-link','router-link2'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.href = rtUrl;
  });
  document.querySelectorAll('.jellyfin-url-label').forEach(el => el.textContent = jfUrl);
  document.querySelectorAll('.router-url-label').forEach(el => el.textContent = rtUrl);

  // Check all services
  checkService(jfUrl, 'status-jellyfin');
  checkService(rtUrl, 'status-router');

  // (Re)render custom service cards + check their status
  if (typeof renderCustomServiceCards === 'function') renderCustomServiceCards();

  // Re-check every 2 minutes (named so it never stacks on re-init)
  HUB.every('services', () => {
    const s = HUB.get('settings', {});
    checkService(s.jellyfinUrl || 'http://localhost:8096', 'status-jellyfin');
    checkService(s.routerUrl   || 'http://192.168.1.1',        'status-router');
    const c = HUB.get('customServices', []);
    c.forEach((svc, i) => { if (svc.url) checkService(svc.url, `status-custom-${i}`); });
  }, 2 * 60 * 1000);
}

function checkService(url, statusId) {
  const el = document.getElementById(statusId);
  if (!el) return;
  setStatus(el, 'checking');

  // Use fetch no-cors — an opaque response means reachable
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  fetch(url, { mode: 'no-cors', signal: controller.signal, cache: 'no-store' })
    .then(() => { clearTimeout(timeout); setStatus(el, 'online'); })
    .catch(err => {
      clearTimeout(timeout);
      setStatus(el, err.name === 'AbortError' ? 'offline' : 'offline');
    });
}

function setStatus(el, state) {
  const labels = { online: 'Online', checking: 'Checking…', offline: 'Offline' };
  el.className = `status-pill s-${state}`;
  el.innerHTML = `<span class="s-dot"></span> ${labels[state]}`;
}

// Called from settings when user adds/removes custom services
function refreshServices() {
  servicesInit();
}
