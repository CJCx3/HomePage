/* AWECRAP — updates.js
 * The "What's New" popup. Renders SO.UPDATES (newest first, capped to
 * SO.UPDATES_MAX so old entries roll off), stamps the title's version tag
 * from SO.VERSION, auto-shows once per version on startup, and reopens from
 * the menu's UPDATES button. Closable with the corner ✕ or Close.
 *
 * SO.Updates.open() / .close()
 */
window.SO = window.SO || {};

SO.Updates = (function () {
  'use strict';
  const SEEN_KEY = 'awecrap_seen_update';
  let modal, body;

  function render() {
    if (!body || !SO.UPDATES) return;
    const max = SO.UPDATES_MAX || 5;
    const entries = SO.UPDATES.slice(0, max);
    // Accordion: the newest build is expanded; older builds collapse to a
    // one-line header (version · title · date) you can click to unfold.
    body.innerHTML = entries.map((u, i) => `
      <div class="update-entry${i === 0 ? ' latest open' : ''}">
        <button class="update-head" type="button">
          <span class="update-ver">${u.version || ''}</span>
          ${i === 0 ? '<span class="update-badge">LATEST</span>' : ''}
          <span class="update-title-inline">${u.title || ''}</span>
          <span class="update-date">${u.date || ''}</span>
          <span class="update-chev" aria-hidden="true">${i === 0 ? '▾' : '▸'}</span>
        </button>
        <div class="update-panel">
          <ul class="update-notes">${(u.notes || []).map((n) => `<li>${n}</li>`).join('')}</ul>
        </div>
      </div>`).join('');
    body.querySelectorAll('.update-head').forEach((h) => h.addEventListener('click', () => {
      const entry = h.closest('.update-entry');
      const open = entry.classList.toggle('open');
      const chev = entry.querySelector('.update-chev'); if (chev) chev.textContent = open ? '▾' : '▸';
    }));
  }

  function open() { if (modal) modal.classList.remove('hidden'); }
  function close() { if (modal) modal.classList.add('hidden'); try { localStorage.setItem(SEEN_KEY, SO.VERSION || ''); } catch (e) {} }

  function init() {
    modal = document.getElementById('modal-updates');
    body = document.getElementById('updates-body');
    if (!modal) return;
    render();

    // version tag on the title is driven by the same source of truth
    if (SO.VERSION) { const vt = document.querySelector('.version-tag'); if (vt) vt.textContent = SO.VERSION; }

    modal.querySelectorAll('[data-close-updates]').forEach((b) => b.addEventListener('click', close));
    const btn = document.getElementById('updates-btn'); if (btn) btn.addEventListener('click', open);

    // auto-show once per version
    let seen = null; try { seen = localStorage.getItem(SEEN_KEY); } catch (e) {}
    if (seen !== SO.VERSION) open();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  return { open, close };
})();
