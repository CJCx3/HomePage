/* AWECRAP — profile.js
 * The cross-run profile in localStorage: everything that outlives a single run.
 *
 * Bestiary      — seen[]            which souls you've met
 * Ascension     — maxAscension      how far up the ladder you've unlocked
 * Hints         — hints{}           one-time contextual nudges already shown
 * Unlockables   — miles{}           lifetime milestones that open cards/relics
 * Achievements  — ach{}             earned achievement ids
 * Run history   — history[]         the last HISTORY_MAX finished runs
 * Codex         — cardSeen{}/cardPlayed{}/relicHeld{}   mastery counters
 *
 * Unlock/award notifications are queued (drainUnlocks / drainAwards) so the
 * DOM-free layers (run.js) can trigger them and the UI can drain them later.
 */
window.SO = window.SO || {};

SO.Profile = (function () {
  'use strict';
  const KEY = 'awecrap_profile_v1';
  const HISTORY_MAX = 20;
  function fresh() {
    return {
      v: 3, seen: [], wins: 0, maxAscension: 0, lastChar: 'gambler', hints: {},
      miles: { bossesDown: 0, coinsSpent: 0, winPass: 0, winDont: 0 },
      ach: {}, winsByChar: {}, history: [], depthTypes: {},
      cardSeen: {}, cardPlayed: {}, relicHeld: {},
    };
  }
  const data = fresh();
  const pendingUnlocks = [];
  const pendingAwards = [];

  function load() {
    try { const r = JSON.parse(localStorage.getItem(KEY) || 'null'); if (r && typeof r === 'object') Object.assign(data, r); } catch (e) {}
    // older profiles (v1) simply lack the newer fields — backfill them
    if (!Array.isArray(data.seen)) data.seen = [];
    if (typeof data.wins !== 'number') data.wins = 0;
    if (typeof data.maxAscension !== 'number') data.maxAscension = 0;
    if (!data.lastChar) data.lastChar = 'gambler';
    if (!data.hints || typeof data.hints !== 'object') data.hints = {};
    if (!data.miles || typeof data.miles !== 'object') data.miles = { bossesDown: 0, coinsSpent: 0, winPass: 0, winDont: 0 };
    if (!data.ach || typeof data.ach !== 'object') data.ach = {};
    if (!data.winsByChar || typeof data.winsByChar !== 'object') data.winsByChar = {};
    if (!Array.isArray(data.history)) data.history = [];
    if (!data.depthTypes || typeof data.depthTypes !== 'object') data.depthTypes = {};
    // v3 — codex counters
    if (!data.cardSeen || typeof data.cardSeen !== 'object') data.cardSeen = {};
    if (!data.cardPlayed || typeof data.cardPlayed !== 'object') data.cardPlayed = {};
    if (!data.relicHeld || typeof data.relicHeld !== 'object') data.relicHeld = {};
    data.v = 3;
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) {} }
  load();

  function cap() { return (SO.ASCENSION_MAX != null) ? SO.ASCENSION_MAX : 4; }

  return {
    data,
    // ---- bestiary ----
    seeEnemy(id) { if (id && !data.seen.includes(id)) { data.seen.push(id); save(); } },
    seeBoss(id) { if (id && !data.seen.includes(id)) { data.seen.push(id); save(); } },
    hasMet(id) { return data.seen.includes(id); },
    metCount() { return data.seen.length; },

    // ---- ascension ----
    recordWin(ascension) {
      data.wins = (data.wins || 0) + 1;
      const lvl = ascension || 0;
      const next = Math.min(cap(), lvl + 1);
      if (next > data.maxAscension) data.maxAscension = next;
      save();
    },
    wins() { return data.wins || 0; },
    maxAscension() { return data.maxAscension || 0; },
    unlockAscension(level) { const n = Math.min(cap(), Math.max(0, level | 0)); if (n > data.maxAscension) { data.maxAscension = n; save(); } },

    // ---- hints ----
    hintSeen(id) { return !!(data.hints && data.hints[id]); },
    markHint(id) { if (id) { data.hints[id] = 1; save(); } },

    // ---- souls ----
    lastChar() { return data.lastChar || 'gambler'; },
    setLastChar(id) { if (id) { data.lastChar = id; save(); } },
    recordCharWin(id) { if (id) { data.winsByChar[id] = (data.winsByChar[id] || 0) + 1; save(); } },
    charWins() { return data.winsByChar || {}; },

    // ---- milestones / unlockables ----
    milestone(k) { return (data.miles && data.miles[k]) || 0; },
    /* Bump a lifetime milestone. Returns (and queues) any unlocks it just
     * crossed, so a jump straight past the threshold still fires exactly once. */
    bumpMilestone(k, n) {
      if (!data.miles) data.miles = {};
      const before = data.miles[k] || 0;
      const after = before + (n == null ? 1 : n);
      data.miles[k] = after;
      save();
      const newly = (SO.UNLOCKS || []).filter((u) => u.req === k && before < u.n && after >= u.n);
      if (newly.length) pendingUnlocks.push.apply(pendingUnlocks, newly);
      return newly;
    },
    drainUnlocks() { const out = pendingUnlocks.slice(); pendingUnlocks.length = 0; return out; },

    // ---- achievements ----
    hasAch(id) { return !!(data.ach && data.ach[id]); },
    /* Award once. Returns true only the first time, and queues it for a toast. */
    award(id) {
      if (!id || data.ach[id]) return false;
      data.ach[id] = Date.now();
      save();
      const def = (SO.ACHIEVEMENTS || []).find((a) => a.id === id);
      if (def) pendingAwards.push(def);
      return true;
    },
    drainAwards() { const out = pendingAwards.slice(); pendingAwards.length = 0; return out; },
    achCount() { return Object.keys(data.ach || {}).length; },

    // ---- depths ----
    recordDepthType(t) { if (t) { data.depthTypes[t] = 1; save(); } },
    depthTypesEscaped() { return Object.keys(data.depthTypes || {}); },

    /* ---- codex / mastery ----
     * Two counters per card: SEEN (it was offered to you — a draft, a shop
     * shelf, an event's spread) and PLAYED (you actually spent it in a duel).
     * Ids are always base ids: a card and its Sharpened '+' form share an entry.
     */
    noteCardSeen(id) {
      if (!id) return;
      const b = SO.baseId ? SO.baseId(id) : id;
      data.cardSeen[b] = (data.cardSeen[b] || 0) + 1;
      save();
    },
    noteCardPlayed(id) {
      if (!id) return;
      const b = SO.baseId ? SO.baseId(id) : id;
      data.cardPlayed[b] = (data.cardPlayed[b] || 0) + 1;
      save();
    },
    noteRelicHeld(id) { if (id) { data.relicHeld[id] = (data.relicHeld[id] || 0) + 1; save(); } },
    cardSeen(id) { return (data.cardSeen && data.cardSeen[id]) || 0; },
    cardPlayed(id) { return (data.cardPlayed && data.cardPlayed[id]) || 0; },
    relicHeld(id) { return (data.relicHeld && data.relicHeld[id]) || 0; },
    /* A card counts as DISCOVERED once you've laid eyes on it either way. */
    cardKnown(id) { return this.cardSeen(id) > 0 || this.cardPlayed(id) > 0; },
    codexCounts() {
      const cards = Object.keys(SO.CARDS || {});
      const relics = Object.keys(SO.RELICS || {});
      return {
        cards: cards.length, cardsKnown: cards.filter((id) => this.cardKnown(id)).length,
        relics: relics.length, relicsKnown: relics.filter((id) => this.relicHeld(id) > 0).length,
      };
    },

    // ---- run history ----
    addRun(entry) {
      if (!entry) return;
      data.history.unshift(entry);
      if (data.history.length > HISTORY_MAX) data.history.length = HISTORY_MAX;
      save();
    },
    history() { return (data.history || []).slice(); },

    reset() {
      const d = fresh();
      Object.keys(data).forEach((k) => { delete data[k]; });  // keep the same object identity
      Object.assign(data, d);
      pendingUnlocks.length = 0; pendingAwards.length = 0;
      save();
    },
  };
})();
