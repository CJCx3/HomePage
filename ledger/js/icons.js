/* ══════════════════════════════════════════════════════════════════════════
   Ledger · icons.js — authored single-weight SVG glyphs (no emoji).
   L.icon(key, size) → svg string.  L.ICON_KEYS → picker list.
   ══════════════════════════════════════════════════════════════════════════ */
(function () {
  const L = (window.L = window.L || {});

  // 24×24 inner markup, stroke uses currentColor
  const P = {
    home: '<path d="M4 11 12 4l8 7M6 10v9h12v-9M10 19v-5h4v5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>',
    bolt: '<path d="M13 3 5 13h5l-1 8 8-11h-5l1-7Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>',
    cart: '<path d="M4 5h2l2 10h9l2-7H7" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><circle cx="10" cy="19" r="1.3" fill="currentColor"/><circle cx="17" cy="19" r="1.3" fill="currentColor"/>',
    car: '<path d="M4 13l1.5-5A2 2 0 0 1 7.4 6.7h9.2a2 2 0 0 1 1.9 1.3L20 13M4 13h16v4H4zM4 17v2M20 17v2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="7.5" cy="15" r="1" fill="currentColor"/><circle cx="16.5" cy="15" r="1" fill="currentColor"/>',
    shield: '<path d="M12 3 5 6v5c0 4.4 3 8.2 7 10 4-1.8 7-5.6 7-10V6l-7-3Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>',
    heart: '<path d="M12 20s-7-4.4-7-9.5A3.8 3.8 0 0 1 12 8a3.8 3.8 0 0 1 7-2.5C19 10.6 12 20 12 20Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>',
    fork: '<path d="M7 3v7a2 2 0 0 0 4 0V3M9 12v9M17 3c-1.6 0-2.5 2-2.5 5s.9 4 2.5 4v9" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
    play: '<circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M10 8.5 16 12l-6 3.5v-7Z" fill="currentColor"/>',
    bag: '<path d="M6 8h12l-1 12H7L6 8ZM9 8V6a3 3 0 0 1 6 0v2" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>',
    plane: '<path d="M11 4c.8 0 1.2.9 1.2 2v3.3l7 4v1.9l-7-2v3.6l2 1.3v1.4l-3.2-1-3.2 1v-1.4l2-1.3v-3.6l-7 2v-1.9l7-4V6c0-1.1.4-2 1.2-2Z" fill="currentColor"/>',
    repeat: '<path d="M4 8h11l-2-2M20 16H9l2 2M6 8a6 6 0 0 0 0 8M18 16a6 6 0 0 0 0-8" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>',
    dumbbell: '<path d="M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>',
    piggy: '<path d="M4 12a6 5 0 0 1 6-5h4c2.4 0 4.4 1.4 5.2 3.4L21 11v3l-1.5.4A6 6 0 0 1 16 17v2h-2v-1.5h-3V19H9v-2.2A5 5 0 0 1 4.6 14H4v-2Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><circle cx="8" cy="11.5" r="1" fill="currentColor"/><path d="M14 7l1-2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
    minuscircle: '<circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M8 12h8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    trend: '<path d="M4 16l5-5 3 3 7-7M15 7h5v5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>',
    receipt: '<path d="M6 3h12v18l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4L6 21V3ZM9 8h6M9 12h6M9 16h4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
    gift: '<path d="M4 11h16v9H4zM4 11V8h16v3M12 8v12M12 8S11 4 8.5 4 6 8 12 8ZM12 8s1-4 3.5-4S18 8 12 8Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
    book: '<path d="M5 4h11a2 2 0 0 1 2 2v13H7a2 2 0 0 0-2 2V4ZM5 19a2 2 0 0 1 2-2h11" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
    dots: '<circle cx="6" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="18" cy="12" r="1.6" fill="currentColor"/>',
    wage: '<rect x="3" y="6" width="18" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="12" r="2.6" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M6 9v6M18 9v6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
    coins: '<ellipse cx="9" cy="7" rx="5" ry="2.4" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M4 7v4c0 1.3 2.2 2.4 5 2.4s5-1.1 5-2.4V7" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M10 13.4V16c0 1.3 2.2 2.4 5 2.4s5-1.1 5-2.4v-4c0-1.3-2.2-2.4-5-2.4" fill="none" stroke="currentColor" stroke-width="1.6"/>',
    bank: '<path d="M4 9 12 4l8 5H4ZM5 9v8M9 9v8M15 9v8M19 9v8M3 19h18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
    card: '<rect x="3" y="6" width="18" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M3 10h18M6 15h4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
    cash: '<rect x="3" y="7" width="18" height="10" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="12" r="2.4" fill="none" stroke="currentColor" stroke-width="1.6"/>',
    wallet: '<path d="M4 7h13a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a1 1 0 0 1-1-1V7ZM4 7l12-2v2M17 12h3v3h-3a1.5 1.5 0 0 1 0-3Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>',
    phone: '<rect x="7" y="3" width="10" height="18" rx="2" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M10 6h4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
    pet: '<circle cx="7" cy="9" r="1.4" fill="currentColor"/><circle cx="12" cy="7" r="1.4" fill="currentColor"/><circle cx="17" cy="9" r="1.4" fill="currentColor"/><path d="M8 15c0-2.2 1.8-4 4-4s4 1.8 4 4-1.8 3-4 3-4-.8-4-3Z" fill="none" stroke="currentColor" stroke-width="1.6"/>',
    coffee: '<path d="M5 8h11v5a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V8ZM16 9h2.5a2 2 0 0 1 0 4H16M7 4v1.5M10 4v1.5M13 4v1.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  };

  L.ICON_KEYS = Object.keys(P);

  L.icon = function (key, size) {
    const body = P[key] || P.dots;
    const s = size || 22;
    return `<svg viewBox="0 0 24 24" width="${s}" height="${s}" class="ico" aria-hidden="true">${body}</svg>`;
  };

  // account-type default icon
  L.accountIcon = function (type) {
    return { checking: "bank", savings: "piggy", credit: "card", cash: "cash", investment: "trend" }[type] || "wallet";
  };
})();
