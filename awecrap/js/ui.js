/* AWECRAP — ui.js
 * Presentation layer: settings (localStorage), the craps-table board, hand &
 * cards, the run screens (map / reward / event / act / shop / rest), and all
 * duel hooks. Routes player input back into the duel / run.
 */
window.SO = window.SO || {};

(function () {
  const $ = (id) => document.getElementById(id);
  const PIPS = { 1: [5], 2: [1, 9], 3: [1, 5, 9], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9] };
  const CHIP_LABEL = {
    passline: 'Pass', dontpass: "Don't", passodds: 'Odds', dontodds: 'Lay',
    come: 'Come', dontcome: "D-Come", place: 'Place', field: 'Field', hard: 'Hard',
    any7: 'Any 7', eleven: 'Yo 11', boxcars: 'Box 12', aces: 'Aces',
  };
  const TYPE_COLOR = { roll: '#7da9c9', bet: '#c9a24b', interfere: '#c96d6d', survival: '#6dc98a', economy: '#b08adb', curse: '#8a6d9c' };
  const TYPE_BADGE = { roll: '⚄', bet: '¢', interfere: '✕', survival: '✚', economy: '◆', curse: '☠' };
  const NODE_ICON = { duel: '⚔', elite: '☠', event: '❓', shop: '🛒', rest: '🔥', boss: '💀', exit: '🪜' };
  // Keyword tooltips — the tricky terms get an inline definition on hover/tap.
  const KEYWORDS = {
    cut: ['The Cut', 'When a soul MAKES their point, the soul across the table takes a flat hit (8 HP). There is no pot — round wins are how you kill.'],
    bleed: ['Bleed', 'Roll with no chips on the felt and your wound opens. It deepens every idle turn until you get a bet back down.'],
    anger: ['Anger', 'Place NO bet for a whole round and the house strikes — harder each idle round in a row. Betting, or De-escalation, calms it.'],
    sevenout: ['Seven-out', 'After a point is set, rolling a 7 loses your Pass line — you “seven out.” The origin of the name.'],
    lastcall: ['Last Call', 'If a duel drags on too long the house calls it: the wound now pierces chips AND tourniquets and deepens every round — for BOTH souls.'],
    deescalation: ['De-escalation', 'Negates the next Anger strike (and stops that round escalating it). You open every duel with one in hand.'],
  };
  // Rich tooltips for the felt bet zones (attached once at init). Keyed by the
  // zone's data-bet (+ data-num for place/hard). [title, text].
  const BET_TIPS = {
    passline: ['Pass Line', 'Bet WITH the shooter. Wins when the point is made, loses on a seven-out. Even money. The line locks once the point is set.'],
    dontpass: ['Don’t Pass', 'Bet AGAINST the shooter. Wins on the seven-out, loses if the point is made. Even money; the 12 is a push.'],
    odds: ['Odds', 'A side bet behind your line, after the point is set. Paid at TRUE odds — no house edge, the best value on the felt. Pullable.'],
    field: ['Field', 'One-roll bet on 2, 3, 4, 9, 10, 11 or 12. The 2 pays double and the 12 triple; everything else even.'],
    come: ['Come', 'A fresh Pass Line placed after the point. It travels to its own number, then wins if that repeats before a 7.'],
    dontcome: ['Don’t Come', 'A fresh Don’t Pass placed after the point. It travels to its number, then wins when the 7 shows.'],
    any7: ['Any Seven', 'One-roll bet the next throw is a 7. Pays 4:1 — the worst edge on the table.'],
    eleven: ['Yo (11)', 'One-roll bet on 11. Pays 15:1.'],
    aces: ['Aces (2)', 'One-roll bet on snake eyes. Pays 30:1.'],
    boxcars: ['Boxcars (12)', 'One-roll bet on double sixes. Pays 30:1.'],
    'place-4': ['Place 4', 'Bet the 4 rolls before a 7. Pays 9:5 — rides until it hits or a 7 clears it.'],
    'place-10': ['Place 10', 'Bet the 10 rolls before a 7. Pays 9:5.'],
    'place-5': ['Place 5', 'Bet the 5 rolls before a 7. Pays 7:5.'],
    'place-9': ['Place 9', 'Bet the 9 rolls before a 7. Pays 7:5.'],
    'place-6': ['Place 6', 'Bet the 6 rolls before a 7. Pays 7:6 — the strongest place bet.'],
    'place-8': ['Place 8', 'Bet the 8 rolls before a 7. Pays 7:6 — the strongest place bet.'],
    'hard-4': ['Hard 4', 'Wins on 2+2 before a 7 or an easy 4. Pays 7:1.'],
    'hard-10': ['Hard 10', 'Wins on 5+5 before a 7 or an easy 10. Pays 7:1.'],
    'hard-6': ['Hard 6', 'Wins on 3+3 before a 7 or an easy 6. Pays 9:1.'],
    'hard-8': ['Hard 8', 'Wins on 4+4 before a 7 or an easy 8. Pays 9:1.'],
  };
  // What a card TYPE does, for the tooltip on a card's type chip.
  const TYPE_TIPS = {
    roll: ['Roll card', 'Played in the roll window, AFTER the dice land — rig or reroll the throw.'],
    bet: ['Bet card', 'Played on your turn to place or boost bets, or bend the payouts.'],
    interfere: ['Interfere card', 'Reaches across the table — damage, theft, or a hex on the other soul.'],
    survival: ['Survival card', 'Heals, stalls your bleed, or buys tempo — keeps you in the fight.'],
    economy: ['Economy card', 'Turns your board into coins, or spends coins for an edge.'],
    curse: ['Curse', 'A dead card that clogs your draws and can’t be played. Burn it at a Chapel or a Shop.'],
  };
  // Tooltips for the in-duel status badge.
  const STATUS_TIPS = {
    busted: ['Busted', 'Rolled a 7 after the point (a seven-out) — this soul’s standing bets are swept.'],
    made: ['Made it', 'Rolled the point — a round win. The Cut wounds the soul across the table.'],
    brink: ['On the Brink', 'At 0 HP but chips are still riding — one more loss ends it, but a win still pulls you back.'],
  };
  const KW_RE = /\b(last call|seven[\s-]?out|de-?escalation|the cut|anger|bleed(?:ing|s)?)\b/gi;
  const KW_ID = (w) => {
    w = w.toLowerCase();
    if (w === 'last call') return 'lastcall';
    if (w.indexOf('seven') === 0) return 'sevenout';
    if (/^de-?escalation/.test(w)) return 'deescalation';
    if (w === 'the cut') return 'cut';
    if (w.indexOf('bleed') === 0) return 'bleed';
    if (w === 'anger') return 'anger';
    return null;
  };
  const PACE_NAMES = [[60, 'Snappy'], [90, 'Brisk'], [110, 'Standard'], [140, 'Cinematic'], [999, 'Leisurely']];
  const GFX_NAMES = [
    ['Low', 'flat — smoothest on weak machines'],
    ['Medium', 'no drifting embers'],
    ['High', 'the intended look'],
    ['Ultra', 'full ambience'],
  ];

  const SETTINGS_KEY = 'awecrap_settings_v1';

  class UI {
    constructor() {
      this.duel = null; this.run = null;
      this.settings = this._loadSettings();
      this.speed = this.settings.pace / 100;
      this.pendingCard = null;
      this._deckCancel = null;
      this._sig = {};          // render memoization — skip innerHTML rebuilds when unchanged
      this._applyGfx();
      this._applyColorblind();
      this._applyReducedMotion();
      this._applyTextScale();
      this._applyHighContrast();
      if (SO.Audio) SO.Audio.setVolume(this.settings.music);
      this._wire();
      this._wireKeywordTips();
      this._wireBetTips();
      this._renderSettings();
      this._renderCredits();
    }

    // ---------------- settings ----------------
    _loadSettings() {
      let s = {};
      try { s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'); } catch (e) {}
      // migrate the old ambience checkbox -> graphics quality
      let gfx = s.gfx != null ? s.gfx : (s.fx === false ? 1 : 2);
      return {
        difficulty: s.difficulty != null ? s.difficulty : SO.DEFAULT_DIFFICULTY,
        pace: s.pace || 100,
        gfx: Math.max(0, Math.min(3, gfx)),
        music: s.music != null ? s.music : 0.7,
        colorblind: !!s.colorblind,
        checkpoints: !!s.checkpoints,
        reducedMotion: !!s.reducedMotion,
        textScale: Math.max(0, Math.min(2, s.textScale || 0)),   // 0 Normal · 1 Large · 2 Larger
        highContrast: !!s.highContrast,
      };
    }
    _saveSettings() { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings)); } catch (e) {} }
    _applyGfx() {
      const b = document.body;
      b.classList.remove('gfx-0', 'gfx-1', 'gfx-2', 'gfx-3');
      b.classList.add('gfx-' + this.settings.gfx);
    }
    _applyColorblind() { document.body.classList.toggle('cb', !!this.settings.colorblind); }
    _applyReducedMotion() { document.body.classList.toggle('reduce-motion', !!this.settings.reducedMotion); }
    _applyTextScale() {
      const b = document.body;
      b.classList.remove('text-scale-1', 'text-scale-2');
      if (this.settings.textScale > 0) b.classList.add('text-scale-' + this.settings.textScale);
    }
    _applyHighContrast() { document.body.classList.toggle('high-contrast', !!this.settings.highContrast); }
    _renderSettings() {
      // Ascension ladder: the slider only reaches the highest rung you've unlocked.
      const cap = SO.ASCENSION_MAX != null ? SO.ASCENSION_MAX : (SO.DIFFICULTY.length - 1);
      const maxUnlocked = SO.Profile ? Math.min(cap, SO.Profile.maxAscension()) : cap;
      if (this.settings.difficulty > maxUnlocked) { this.settings.difficulty = maxUnlocked; this._saveSettings(); }
      const slider = $('difficulty-slider');
      slider.max = maxUnlocked;
      slider.value = this.settings.difficulty;
      const info = SO.ascensionInfo ? SO.ascensionInfo(this.settings.difficulty)
        : { name: SO.DIFFICULTY[this.settings.difficulty].name, desc: SO.DIFFICULTY[this.settings.difficulty].desc, asc: false };
      $('diff-name').textContent = (info.asc ? '☠ ' : '') + info.name;
      let desc = info.desc;
      // name the extra RULES this rung carries (they stack as you climb)
      const twists = SO.ascensionTwistsFor ? SO.ascensionTwistsFor(this.settings.difficulty) : [];
      if (twists.length) desc += '  ·  RULES: ' + twists.map((t) => t.name).join(' + ') + '.';
      desc += maxUnlocked < cap
        ? '  ·  ' + (maxUnlocked + 1) + '/' + (cap + 1) + ' rungs unlocked — win a run to climb the ladder.'
        : '  ·  The whole ladder is yours.';
      $('diff-desc').textContent = desc;
      $('pace-slider').value = this.settings.pace;
      $('pace-name').textContent = (PACE_NAMES.find(([v]) => this.settings.pace <= v) || PACE_NAMES[4])[1];
      $('gfx-slider').value = this.settings.gfx;
      $('gfx-name').textContent = GFX_NAMES[this.settings.gfx][0];
      $('gfx-desc').textContent = GFX_NAMES[this.settings.gfx][1];
      $('music-slider').value = Math.round(this.settings.music * 100);
      $('music-name').textContent = this.settings.music === 0 ? 'Muted' : Math.round(this.settings.music * 100) + '%';
      const cbEl = $('cb-toggle'); if (cbEl) cbEl.checked = !!this.settings.colorblind;
      const cpEl = $('checkpoint-toggle'); if (cpEl) cpEl.checked = !!this.settings.checkpoints;
      const rmEl = $('reduce-motion-toggle'); if (rmEl) rmEl.checked = !!this.settings.reducedMotion;
      const tsEl = $('textscale-slider');
      if (tsEl) { tsEl.value = this.settings.textScale; const nm = $('textscale-name'); if (nm) nm.textContent = ['Normal', 'Large', 'Larger'][this.settings.textScale] || 'Normal'; }
      const hcEl = $('contrast-toggle'); if (hcEl) hcEl.checked = !!this.settings.highContrast;
    }
    /* RECORDS modal — achievements, milestone unlocks, and past runs. */
    renderRecords(tab) {
      this._recTab = tab || this._recTab || 'ach';
      const P = SO.Profile, body = $('rec-body');
      if (!body || !P) return;
      document.querySelectorAll('.rec-tab').forEach((b) => b.classList.toggle('on', b.dataset.rec === this._recTab));
      const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
      let html = '';
      if (this._recTab === 'ach') {
        const list = SO.ACHIEVEMENTS || [];
        const got = list.filter((a) => P.hasAch(a.id)).length;
        html = `<div class="rec-count">${got} / ${list.length} earned</div><div class="rec-list">` + list.map((a) => {
          const on = P.hasAch(a.id);
          return `<div class="rec-row ${on ? 'on' : 'off'}"><span class="rec-ico">${on ? '🏆' : '🔒'}</span><span class="rec-main"><b>${esc(a.name)}</b><span>${esc(a.desc)}</span></span></div>`;
        }).join('') + '</div>';
      } else if (this._recTab === 'unlocks') {
        const list = SO.UNLOCKS || [];
        const got = list.filter((u) => SO.isUnlocked(u.id)).length;
        html = `<div class="rec-count">${got} / ${list.length} unlocked</div><div class="rec-list">` + list.map((u) => {
          const on = SO.isUnlocked(u.id);
          const have = P.milestone(u.req);
          const prog = on ? '' : `<span class="rec-prog">${Math.min(have, u.n)} / ${u.n} ${esc(SO.MILESTONE_LABEL[u.req] || u.req)}</span>`;
          return `<div class="rec-row ${on ? 'on' : 'off'}"><span class="rec-ico">${on ? '🔓' : '🔒'}</span><span class="rec-main"><b>${on ? esc(SO.unlockName(u)) : '???'} <em>${esc(u.kind)}</em></b><span>${esc(u.hint)}</span>${prog}</span></div>`;
        }).join('') + '</div>';
      } else if (this._recTab === 'codex') {
        html = this._codexHTML(P, esc);
      } else {
        const h = P.history();
        html = h.length ? '<div class="rec-list">' + h.map((r) => {
          let date = '';
          try { date = new Date(r.ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); } catch (e) {}
          const bits = [r.soul, r.ascName, r.toughestFoe ? 'toughest: ' + r.toughestFoe : '', r.cheat ? r.cheat + ' seed' : ''].filter(Boolean).join(' · ');
          return `<div class="rec-row ${r.won ? 'win' : 'loss'}"><span class="rec-ico">${r.won ? '♛' : '☠'}</span><span class="rec-main"><b>${r.won ? 'Victory' : 'Fell on Act ' + r.act} · ${(r.score || 0).toLocaleString()}</b><span>${esc(bits)}</span><span class="rec-prog">${esc(date)} · seed ${esc(r.seed)}</span></span></div>`;
        }).join('') + '</div>' : '<p class="rec-empty">No runs on the books yet. Go and lose one.</p>';
      }
      body.innerHTML = html;
      if (this._recTab === 'codex') {
        body.querySelectorAll('.deck-filter').forEach((b) => b.onclick = () => { this._codex.filter = b.dataset.filter; this.renderRecords('codex'); });
        body.querySelectorAll('.deck-sortbtn').forEach((b) => b.onclick = () => { this._codex.sort = b.dataset.sort; this.renderRecords('codex'); });
      }
    }
    /* CODEX — the whole catalog, with what you've seen and what you've mastered.
     * A card you've never been offered and never played stays a silhouette;
     * one still behind a milestone shows its lock and how to open it. */
    _codexHTML(P, esc) {
      const v = (this._codex = this._codex || { filter: 'all', sort: 'name' });
      if (!v.sort) v.sort = 'name';
      const MASTER = 10;                                   // plays before a card counts as mastered
      const cardIds = Object.keys(SO.CARDS || {});
      const relicIds = Object.keys(SO.RELICS || {});
      const c = P.codexCounts();
      const mastered = cardIds.filter((id) => P.cardPlayed(id) >= MASTER).length;

      const TYPES = ['roll', 'bet', 'interfere', 'survival', 'economy', 'curse'];
      const filters = ['all'].concat(TYPES).concat(['relics']);
      const tools = `<div class="deck-tools"><div class="deck-filters">` +
        filters.map((f) => `<button class="deck-filter${v.filter === f ? ' on' : ''}" data-filter="${f}">${f === 'all' ? 'All' : f}</button>`).join('') +
        `</div><div class="deck-sort"><span>sort</span>` +
        ['name', 'played', 'rarity'].map((s) => `<button class="deck-sortbtn${v.sort === s ? ' on' : ''}" data-sort="${s}">${s}</button>`).join('') +
        `</div></div>`;

      const head = `<div class="rec-count">${c.cardsKnown} / ${c.cards} cards · ${c.relicsKnown} / ${c.relics} relics · ${mastered} mastered</div>`;

      // shared comparators: name A–Z, most-played first, or rarest first (name break tie)
      const rank = { common: 0, uncommon: 1, rare: 2, curse: -1 };
      const byName = (a, b) => (a.name > b.name ? 1 : a.name < b.name ? -1 : 0);
      const cardCmp = (ia, ib) => {
        const a = SO.getCard(ia) || {}, b = SO.getCard(ib) || {};
        if (v.sort === 'played') return (P.cardPlayed(ib) - P.cardPlayed(ia)) || byName(a, b);
        if (v.sort === 'rarity') return ((rank[b.rarity] || 0) - (rank[a.rarity] || 0)) || byName(a, b);
        return byName(a, b);
      };
      const relicCmp = (ia, ib) => {
        const a = SO.RELICS[ia] || {}, b = SO.RELICS[ib] || {};
        if (v.sort === 'played') return (P.relicHeld(ib) - P.relicHeld(ia)) || byName(a, b);
        if (v.sort === 'rarity') return ((rank[b.rarity] || 0) - (rank[a.rarity] || 0)) || byName(a, b);
        return byName(a, b);
      };

      let rows = '';
      if (v.filter !== 'relics') {
        const show = cardIds.filter((id) => v.filter === 'all' || (SO.getCard(id) || {}).type === v.filter);
        rows += show.sort(cardCmp).map((id) => {
          const def = SO.getCard(id) || {};
          const locked = SO.UNLOCK_BY_ID && SO.UNLOCK_BY_ID[id] && !SO.isUnlocked(id);
          const seen = P.cardSeen(id), played = P.cardPlayed(id), known = seen > 0 || played > 0;
          const meta = `${esc(def.type || '')} · ${esc(def.rarity || '')}${def.nerve != null ? ' · ' + def.nerve + ' nerve' : ''}`;
          if (locked) {
            const u = SO.UNLOCK_BY_ID[id];
            return `<div class="rec-row off"><span class="rec-ico">🔒</span><span class="rec-main"><b>??? <em>${meta}</em></b><span>${esc(u.hint || 'Locked')}</span></span></div>`;
          }
          if (!known) return `<div class="rec-row off"><span class="rec-ico">❔</span><span class="rec-main"><b>??? <em>${meta}</em></b><span>Not yet encountered.</span></span></div>`;
          const star = played >= MASTER ? ' <span class="cdx-star">★</span>' : '';
          return `<div class="rec-row on"><span class="rec-ico">🃏</span><span class="rec-main"><b>${esc(def.name)}${star} <em>${meta}</em></b><span>${esc(def.text || '')}</span><span class="rec-prog">seen ${seen} · played ${played}</span></span></div>`;
        }).join('');
      }
      if (v.filter === 'all' || v.filter === 'relics') {
        if (v.filter === 'all') rows += `<div class="cdx-sep">Relics</div>`;
        rows += relicIds.slice().sort(relicCmp).map((id) => {
          const def = SO.RELICS[id] || {};
          const locked = SO.UNLOCK_BY_ID && SO.UNLOCK_BY_ID[id] && !SO.isUnlocked(id);
          const held = P.relicHeld(id);
          const meta = esc(def.rarity || '');
          if (locked) {
            const u = SO.UNLOCK_BY_ID[id];
            return `<div class="rec-row off"><span class="rec-ico">🔒</span><span class="rec-main"><b>??? <em>${meta}</em></b><span>${esc(u.hint || 'Locked')}</span></span></div>`;
          }
          if (!held) return `<div class="rec-row off"><span class="rec-ico">❔</span><span class="rec-main"><b>??? <em>${meta}</em></b><span>Never carried.</span></span></div>`;
          return `<div class="rec-row on"><span class="rec-ico">💎</span><span class="rec-main"><b>${esc(def.name)} <em>${meta}</em></b><span>${esc(def.text || '')}</span><span class="rec-prog">carried ${held}×</span></span></div>`;
        }).join('');
      }
      return head + tools + `<div class="rec-list">${rows}</div>`;
    }
    _renderCredits() {
      if (!SO.CREDITS) return;
      $('credits-list').innerHTML = SO.CREDITS.map((sec) =>
        `<div class="credits-section"><h3>${sec.section}</h3>${sec.lines.map(([what, who]) =>
          `<div class="credit-row"><span class="credit-what">${what}</span><span class="credit-dots"></span><span class="credit-who">${who}</span></div>`).join('')}</div>`
      ).join('');
    }

    wait(ms) { return new Promise((r) => setTimeout(r, ms * this.speed)); }
    attach(duel) { this.duel = duel; }
    setRun(run) { this.run = run; }

    // ---------------- wiring ----------------
    _wire() {
      // menu side buttons -> open a modal; any [data-modal] opens, .modal-close hides
      document.querySelectorAll('[data-modal]').forEach((b) => b.addEventListener('click', () => $(b.dataset.modal).classList.remove('hidden')));
      // re-render settings each time it opens so a newly-unlocked Ascension rung shows
      const setBtn = document.querySelector('[data-modal="modal-settings"]');
      if (setBtn) setBtn.addEventListener('click', () => this._renderSettings());
      document.querySelectorAll('.modal-close').forEach((b) => b.addEventListener('click', () => b.closest('.overlay').classList.add('hidden')));
      // settings inputs
      $('difficulty-slider').addEventListener('input', (e) => { this.settings.difficulty = +e.target.value; this._saveSettings(); this._renderSettings(); });
      $('pace-slider').addEventListener('input', (e) => { this.settings.pace = +e.target.value; this.speed = this.settings.pace / 100; this._saveSettings(); this._renderSettings(); });
      $('gfx-slider').addEventListener('input', (e) => { this.settings.gfx = +e.target.value; this._applyGfx(); this._saveSettings(); this._renderSettings(); });
      $('music-slider').addEventListener('input', (e) => {
        this.settings.music = (+e.target.value) / 100;
        if (SO.Audio) SO.Audio.setVolume(this.settings.music);
        this._saveSettings(); this._renderSettings();
      });
      const cbEl = $('cb-toggle');
      if (cbEl) cbEl.addEventListener('change', (e) => { this.settings.colorblind = e.target.checked; this._applyColorblind(); this._saveSettings(); });
      const cpEl = $('checkpoint-toggle');
      if (cpEl) cpEl.addEventListener('change', (e) => { this.settings.checkpoints = e.target.checked; this._saveSettings(); });
      const rmEl = $('reduce-motion-toggle');
      if (rmEl) rmEl.addEventListener('change', (e) => { this.settings.reducedMotion = e.target.checked; this._applyReducedMotion(); this._saveSettings(); });
      const tsEl = $('textscale-slider');
      if (tsEl) tsEl.addEventListener('input', (e) => { this.settings.textScale = +e.target.value; this._applyTextScale(); this._saveSettings(); this._renderSettings(); });
      const hcEl = $('contrast-toggle');
      if (hcEl) hcEl.addEventListener('change', (e) => { this.settings.highContrast = e.target.checked; this._applyHighContrast(); this._saveSettings(); });

      $('controls').addEventListener('click', (e) => {
        if (e.target.getAttribute('data-act') === 'roll' && this.duel) this.duel.submitRoll();
      });
      $('craps-table').addEventListener('click', (e) => {
        const zone = e.target.closest('[data-bet]'); if (!zone || !this.duel) return;
        const d = this.duel; if (!d.canAct()) return;
        const bet = zone.dataset.bet; const num = zone.dataset.num ? +zone.dataset.num : null;
        const step = this._betStep || SO.CONFIG.BET_STEP;
        const before = d._tableTotal(d.player);
        if (bet === 'passline') { d.setStyle('pass'); d.addLine(step); }
        else if (bet === 'dontpass') { d.setStyle('dont'); d.addLine(step); }
        else if (bet === 'odds') d.addOdds(step);
        else d.addSideBet(bet, num, step);
        if (d._tableTotal(d.player) > before) this.flyChip(zone);
        else this.nudgeZone(zone);
      });
      // Betting QOL: chip-size presets, one-click max odds, and undo-last-chip
      $('bet-steps').addEventListener('click', (e) => {
        const b = e.target.closest('.step'); if (!b) return;
        this._betStep = +b.dataset.step;
        $('bet-steps').querySelectorAll('.step').forEach((x) => x.classList.toggle('on', x === b));
        const bh = $('bet-hint'); if (bh) bh.textContent = `Click the felt to bet · ${this._betStep} HP a tap`;
      });
      $('max-odds-btn').addEventListener('click', () => { if (this.duel) this.duel.addOdds(999999); });
      $('undo-bet-btn').addEventListener('click', () => { if (this.duel) this.duel.undoBet(); });
      // Run-summary: copy the recap to the clipboard (user gesture => allowed)
      const copyBtn = $('btn-copy-summary');
      if (copyBtn) copyBtn.addEventListener('click', () => {
        const txt = this._lastSummary || 'AweCrap';
        const done = () => { const s = $('copy-summary-sub'); if (s) { const old = s.textContent; s.textContent = 'Copied!'; setTimeout(() => { s.textContent = old; }, 1400); } };
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done, () => this._fallbackCopy(txt, done));
          else this._fallbackCopy(txt, done);
        } catch (e) { this._fallbackCopy(txt, done); }
      });
      $('style-toggle').addEventListener('click', (e) => { const s = e.target.getAttribute('data-style'); if (s && this.duel) this.duel.setStyle(s); });
      $('point-opts').addEventListener('click', (e) => { const o = e.target.closest('.point-opt'); if (o && this.duel) this.duel.choosePoint(parseInt(o.dataset.n, 10)); });
      $('resolve-btn').addEventListener('click', () => this.duel && this.duel.finishRollWindow());
      $('hand').addEventListener('click', (e) => { const card = e.target.closest('.card'); if (card) this._onCardClick(parseInt(card.dataset.i, 10)); });
      $('pull-row').addEventListener('click', (e) => { const b = e.target.closest('[data-pull]'); if (b && this.duel) this.duel.pullBet(parseInt(b.dataset.pull, 10)); });
      $('choice-cancel').addEventListener('click', () => this._closeChoice());
      $('view-deck-btn').addEventListener('click', () => this.showDeck());
      $('tb-relics').addEventListener('click', () => { if (this.run && this.run.player.relics.length) this.showDeck(); });
      // Closing the deck modal must never strand the player: if it was opened
      // as a PICKER (sharpen/removal/events), closing runs the cancel path.
      $('close-deck').addEventListener('click', () => {
        $('deck-modal').classList.add('hidden');
        if (this._deckCancel) { const c = this._deckCancel; this._deckCancel = null; c(); }
      });
      // QOL: Escape dismisses the top open modal. Reuses each modal's own close
      // control so cleanup still runs (updates 'seen' flag, deck picker-cancel).
      // Scoped to menu/deck modals — the tutorial & practice own their own Escape.
      document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        const deck = $('deck-modal');
        if (deck && !deck.classList.contains('hidden')) { $('close-deck').click(); e.preventDefault(); return; }
        const open = [...document.querySelectorAll('.overlay.menu-modal:not(.hidden)')];
        if (!open.length) return;
        const top = open[open.length - 1];
        const btn = top.querySelector('.modal-close, [data-close-updates], .modal-x');
        if (btn) btn.click(); else top.classList.add('hidden');
        e.preventDefault();
      });
    }

    // ---------------- screens ----------------
    show(id) {
      ['start-screen', 'map-screen', 'board', 'reward-screen', 'event-screen', 'act-screen', 'shop-screen', 'rest-screen'].forEach((s) => $(s).classList.toggle('hidden', s !== id));
      // music routing: the run screens share the floor theme and it keeps
      // looping across them; duels pick their own track in duelStart.
      if (SO.Audio) {
        if (id === 'start-screen') SO.Audio.play('menu');
        else if (id === 'shop-screen') SO.Audio.play('shop');
        else if (id === 'rest-screen') SO.Audio.play('rest');
        else if (id !== 'board') SO.Audio.play('map');
      }
    }

    topbar(show) {
      $('topbar').classList.toggle('hidden', !show);
      if (!show || !this.run) return;
      const roman = ['I', 'II', 'III', 'IV', 'V'];
      $('tb-act').textContent = 'ACT ' + (roman[this.run.actIdx] || this.run.actIdx + 1) + (this.run.godMode ? ' · GOD' : '');
      $('tb-hp').textContent = this.run.player.hp;
      $('tb-maxhp').textContent = '/' + this.run.player.maxHp;
      $('tb-coins').textContent = this.run.coins;
      $('tb-deck').textContent = this.run.player.deck.length;
      // rarity-coloured chips (the first letter alone is ambiguous across 38 relics);
      // the whole strip opens the deck/relic viewer for the full text.
      const esc = (s) => String(s).replace(/"/g, '&quot;');
      $('tb-relics').innerHTML = this.run.player.relics.map((id) => {
        const r = SO.RELICS[id]; if (!r) return '';
        return `<span class="relic ${r.rarity || 'common'}" data-tip-title="${esc(r.name)}" data-tip="${esc(r.text)}">${r.name[0]}</span>`;
      }).join('');
    }

    // ================= DUEL HOOKS =================
    async duelStart(d) {
      this._sig = {}; // the board DOM persists between duels — force a fresh render
      this.show('board'); this.topbar(false);
      if (SO.Audio) SO.Audio.play(SO.Audio.trackForDuel(d));
      $('opp-name').textContent = d.opponent.name;
      const gim = d.opponent.def.gimmickName;
      $('opp-arch').textContent = (d.opponent.def.archetype ? '· ' + d.opponent.def.archetype : '') + (gim ? ' · ' + gim : '');
      $('log').innerHTML = ''; $('duel-coins').textContent = '';
      // boss profile portrait
      const portrait = SO.BOSS_PORTRAITS && SO.BOSS_PORTRAITS[d.opponent.def.id];
      $('opp-portrait-wrap').classList.toggle('hidden', !portrait);
      $('opp-portrait-wrap').classList.toggle('boss', !!(portrait && d.isBoss));
      if (portrait) $('opp-portrait').src = portrait;
      this.render(d);
      this.log(`<b>${d.opponent.name}.</b> ${d.opponent.def.blurb}`, 'gold');
      if (d.opponent.def.tell) this.log(`<i>Tell: ${d.opponent.def.tell}</i>`);
      if (d.opponent.def.eliteTell) this.log(`<b>Elite ${d.opponent.def.gimmickName}</b> — <i>${d.opponent.def.eliteTell}</i>`, 'bad');
      if (d.isBoss) await this.banner(d.opponent.name, d.opponent.def.blurb, 'bad', 1600);
    }
    async roundStart(d) {
      $('round-pill').textContent = `ROUND ${d.roundNumber}`;
      if (this.run && this.run.stats) this.run.stats.rounds++;
      this.setStatus(d.player, ''); this.setStatus(d.opponent, '');
      this.render(d);
      if (d.roundNumber > 1) await this.banner(`Round ${d.roundNumber}`, 'Fresh hands. The bleed resets.', '', 1000);
    }
    async rolloff(d, pr, or_, playerWon) {
      this.turn('Roll-off…'); await this.rollDice(d.player, pr, null); await this.rollDice(d.opponent, or_, null); await this.wait(450);
      this.log(`Roll-off: you ${pr.total} vs ${or_.total} — <b>${playerWon ? 'you win' : d.opponent.name + ' wins'}.</b>`, playerWon ? 'good' : 'bad');
    }
    requestPointChoice(d, pts) {
      $('controls').classList.add('hidden'); $('point-chooser').classList.remove('hidden');
      $('point-opts').innerHTML = pts.map((n) => { const od = SO.craps.PASS_ODDS[n]; return `<button class="point-opt" data-n="${n}"><span class="pnum">${n}</span><span class="phint">${SO.craps.WAYS[n]}/36 · ${od[0]}:${od[1]}</span></button>`; }).join('');
      this.turn('You won the roll-off — <span class="accent">set the point</span>.');
    }
    async opponentPoint(d, point, setter) {
      const tell = setter.def.archetype === 'attrition' || setter.def.archetype === 'control' ? " — a don't build, hunting the 7." : setter.def.archetype === 'prop' ? ' — a prop cannon.' : setter.def.archetype === 'boss' ? ' — the worst number for you.' : '';
      this.log(`${setter.name} sets the point to <b>${point}</b>${tell}`, 'gold'); await this.wait(550);
    }
    async pointSet(d, point) {
      $('point-chooser').classList.add('hidden'); $('controls').classList.remove('hidden'); this.render(d);
      const sub = d.player.lineStyle === 'dont' ? `roll a 7 before the ${point} — the ${point} busts you` : `make ${point} and your bets pay — a 7 busts you`;
      await this.banner(`Point is ${point}`, sub, '', 1100);
    }
    async turnStart(d, cur) {
      $('opp-panel').classList.toggle('active-turn', !cur.isPlayer);
      $('you-panel').classList.toggle('active-turn', cur.isPlayer);
      $('stage-who').textContent = cur.isPlayer ? 'YOUR DICE' : `${cur.name.toUpperCase()} ROLLS`;
      this.turn(cur.isPlayer ? `<span class="accent">Your turn</span> — ${d.player.lineStyle === 'dont' ? 'you want the 7 before the ' + d.point : 'make the ' + d.point}.` : `${cur.name} takes a turn…`);
      this.render(d);
      await this.wait(420);
    }
    enableControls(d, on) {
      const inRoll = d._awaiting === 'rollwindow';
      $('rollwin').classList.toggle('hidden', !(on && inRoll));
      $('roll-btn').disabled = !(on && !inRoll);
      $('roll-btn').classList.toggle('ready', on && !inRoll);
      $('craps-table').classList.toggle('live', !!(on && !inRoll));
      this.render(d);
    }
    async diceLanded(d, cur, roll) { if (cur.isPlayer && this.run && this.run.stats) this.run.stats.rolls++; await this.rollDice(cur, roll, d.point); }
    async diceUpdated(d, cur, roll) { this.setDicePair(cur, roll, d.point); this.bumpDice(cur); await this.wait(420); }
    async diceFinal(d, cur, roll) { this.setDicePair(cur, roll, d.point); this.render(d); }
    async forcedReroll(d, cur, roll, why) { this.log(`<b>${why}!</b> ${cur.isPlayer ? 'Your' : cur.name + "'s"} dice are wrenched back up.`, 'bad'); await this.rollDice(cur, roll, d.point); }
    async bustSaved(d, cur, which, roll) { this.log(`<b>${which}!</b> ${cur.isPlayer ? 'You' : cur.name} dodge the bust.`, 'good'); await this.rollDice(cur, roll, d.point); }
    async madePoint(d, cur) { this.log(`<b>${cur.isPlayer ? 'You' : cur.name}</b> rolled ${cur.lastRoll.total} — <b>made the ${d.point}!</b>`, 'good'); this.render(d); await this.wait(250); await this.banner(cur.isPlayer ? `MADE THE ${d.point}` : `${cur.name} hits`, '', cur.isPlayer ? 'good' : 'bad', 1150); }
    async busted(d, cur) { const seven = cur.lastRoll.total === 7; this.log(`<b>${cur.isPlayer ? 'You' : cur.name}</b> rolled ${cur.lastRoll.total} — <b>${seven ? 'SEVEN OUT' : 'busts'}.</b>`, 'bad'); this.render(d); await this.wait(250); await this.banner(seven ? 'SEVEN OUT' : 'BUST', '', cur.isPlayer ? 'bad' : 'good', 1100); }
    async bleed(d, cur, dmg) { this.log(`${cur.isPlayer ? 'You' : cur.name} rolled with no chips out — <b>bleed ${dmg}</b> (turn ${cur.turnInRound}).`, 'bad'); this.render(d); await this.wait(600); }
    async noBleed(d, cur, reason) {
      if (reason === 'tourniquet') this.log(`${cur.isPlayer ? 'Your' : cur.name + "'s"} tourniquet holds.`, 'good');
      else if (reason === 'numb') this.log(`${cur.isPlayer ? 'You feel' : cur.name + ' feels'} nothing at all.`, 'good');
      this.render(d); await this.wait(220);
    }
    async afterTurn(d) { this.render(d); await this.wait(420); }
    async roundResolve(d) { $('opp-panel').classList.remove('active-turn'); $('you-panel').classList.remove('active-turn'); this.render(d); await this.wait(650); }
    async roundCut(d, winner, loser, amt) {
      this.log(`The round goes to <b>${winner.isPlayer ? 'you' : winner.name}</b> — ${loser.isPlayer ? 'you take' : loser.name + ' takes'} <b>the Cut (−${amt})</b>.`, winner.isPlayer ? 'good' : 'bad');
      this.render(d); await this.wait(500);
    }
    async sweep(d, p, amt) {
      this.log(`The house sweeps <b>${amt} HP</b> of ${p.isPlayer ? 'your' : p.name + "'s"} unresolved chips off the felt.`, p.isPlayer ? 'bad' : 'good');
      this.render(d); await this.wait(350);
    }
    async anger(d, p, dmg, streak) {
      this.log(`<b>The house is ANGRY.</b> ${p.isPlayer ? "You placed" : p.name + ' placed'} no bet — <b>Anger ${dmg}</b>${streak > 1 ? ` (bet or it climbs)` : ''}.`, p.isPlayer ? 'bad' : 'good');
      this.render(d);
      if (p.isPlayer) await this.banner('ANGER −' + dmg, 'The house resents idleness. Bet, or it grows.', 'bad', 1100);
      else await this.wait(450);
    }
    deescalate(d, p) { this.log(`${p.isPlayer ? 'You' : p.name} play it cool — <b>Anger negated</b>.`, p.isPlayer ? 'good' : 'bad'); this.render(d); }
    async lastCall(d) {
      this.log(`<b>LAST CALL.</b> The house wants this table back — the wound ignores chips now, and deepens every round.`, 'bad');
      await this.banner('LAST CALL', 'The wound refuses the tourniquet. Finish it.', 'bad', 1500);
      this.hint('lastcall', 'Last Call', 'The fight dragged on, so the house called it. From now the bleed pierces chips and tourniquets and grows every round — for you AND them. Close it out fast.');
    }
    async godSmite(d, opp) {
      this.log(`<b>GOD MODE.</b> Your point lands like a thunderbolt — ${opp.name} is unmade.`, 'gold');
      await this.banner('GOD MODE', `${opp.name} is unmade.`, 'good', 1000);
    }
    async bossPhase(d, idx, phase) { this.log(`<b>Floor reset.</b> ${phase.note}`, 'gold'); await this.banner('FLOOR RESET', phase.note, 'good', 1500); }
    bossCurse(d, id) { this.log(`<b>${SO.getCard(id).name}</b> is forced into your draw pile.`, 'bad'); }
    async bossSteal(d, boss, amt) { this.log(`<b>${boss.name}</b> skims <b>${amt} HP</b> from your table.`, 'bad'); this.render(d); await this.wait(450); }
    async phoenixSave(d, p, what) { this.log(`<b>${what}!</b> ${p.isPlayer ? 'You refuse' : p.name + ' refuses'} to die.`, 'gold'); this.render(d); await this.banner(what.toUpperCase(), 'Death is refused — this once.', 'good', 1300); }
    cardPlayed(d, p, def, msg, id) { if (p.isPlayer && this.run && this.run.stats) this.run.stats.cards++; if (p.isPlayer && SO.Profile) SO.Profile.noteCardPlayed(id); this.log(`${p.isPlayer ? 'You play' : p.name + ' plays'} <b>${def.name}</b>${msg ? ' — ' + msg : ''}.`, p.isPlayer ? 'good' : 'bad'); this.render(d); }
    cardFizzle(d, def) { this.log(`<b>${def.name}</b> fizzles — they cannot be touched.`, 'bad'); }
    cardBlocked(d, def, p) { this.log(`<b>${def.name}</b> is blocked this turn.`, 'bad'); }
    pullTax(d, p, tax) {
      if (p.isPlayer && this.run && this.run.stats) this.run.stats.pulls = (this.run.stats.pulls || 0) + 1; // Iron Nerve watches this
      this.log(`Pulled a bet${tax ? ` — ${tax} HP pull-tax` : ' (no tax)'}.`);
    }
    healBlocked(d, p) { this.log(`Cold Streak — no healing on round 1.`, 'bad'); }
    coins(d, n) {
      $('duel-coins').textContent = d.coinsEarned > 0 ? `+${d.coinsEarned}¢ this duel` : '';
      if (n > 0) this.log(`<b>+${n} coins</b>.`, 'gold');
    }
    hpChange(d, p, delta, kind) {
      this.updateBar(p);
      if (delta === 0) return;
      const m = { bet: ['gold', '−'], bleed: ['bleed', '−'], anger: ['anger', '−'], steal: ['heal', '+'], win: ['heal', '+'], push: ['heal', '+'], pull: ['heal', '+'], reclaim: ['heal', '+'], medic: ['heal', '+'], reaper: ['heal', '+'], leech: ['heal', '+'], relic: ['heal', '+'], hex: ['heal', '+'], collect: ['dmg', '−'], hit: ['dmg', '−'] };
      const [cls, sign] = m[kind] || [delta < 0 ? 'dmg' : 'heal', delta < 0 ? '−' : '+'];
      this.floater(p, `${sign}${Math.abs(delta)}`, cls);
    }
    async duelEnd(d) { /* orchestrated by main */ }

    // ---------------- card play ----------------
    _onCardClick(i) {
      const d = this.duel; if (!d) return;
      const p = d.player; const id = p.hand[i]; if (id == null) return;
      const def = SO.getCard(id);
      const phaseOk = (def.timing === 'rollwindow' && d._awaiting === 'rollwindow') || (def.timing === 'action' && d._awaiting === 'action');
      if (!phaseOk || d._cardCost(p, id) > p.nerve) return;
      if (def.needs === 'dieFace' || def.needs === 'dieDelta' || def.needs === 'bothFaces') { this._openChoice(i, def); return; }
      const wasRoll = def.timing === 'rollwindow';
      const cardEl = $('hand').querySelector(`.card[data-i="${i}"]`);   // grab it before the hand re-renders
      if (d.playCard(i)) { this.flyCard(cardEl); if (wasRoll) this.bumpDice(d.player); }
    }
    _openChoice(i, def) {
      this.pendingCard = i;
      $('choice-title').textContent = def.name;
      const roll = this.duel.pendingRoll || { d1: 1, d2: 1 };
      let html = '';
      if (def.needs === 'dieFace') {
        html = ['A', 'B'].map((lbl, di) => `<div class="choice-row"><span>Set die ${lbl} →</span>${[1, 2, 3, 4, 5, 6].map((f) => `<button class="facebtn" data-die="${di}" data-face="${f}">${f}</button>`).join('')}</div>`).join('');
      } else if (def.needs === 'dieDelta') {
        html = `<div class="choice-row"><span>Die A (${roll.d1})</span><button class="facebtn" data-die="0" data-delta="-1">−1</button><button class="facebtn" data-die="0" data-delta="1">+1</button></div>` +
               `<div class="choice-row"><span>Die B (${roll.d2})</span><button class="facebtn" data-die="1" data-delta="-1">−1</button><button class="facebtn" data-die="1" data-delta="1">+1</button></div>`;
      } else if (def.needs === 'bothFaces') {
        html = `<div class="choice-row"><span>Total wanted:</span>${[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((t) => `<button class="facebtn" data-total="${t}">${t}</button>`).join('')}</div>`;
      }
      const body = $('choice-body'); body.innerHTML = html;
      body.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
        let choice;
        if (def.needs === 'dieFace') choice = { die: +b.dataset.die, face: +b.dataset.face };
        else if (def.needs === 'dieDelta') choice = { die: +b.dataset.die, delta: +b.dataset.delta };
        else { const t = +b.dataset.total; let a = Math.min(6, t - 1); let bb = t - a; if (bb < 1) { bb = 1; a = t - 1; } choice = { f0: Math.max(1, Math.min(6, a)), f1: Math.max(1, Math.min(6, bb)) }; }
        const ok = this.duel.playCard(this.pendingCard, choice); this._closeChoice(); if (ok) this.bumpDice(this.duel.player);
      }));
      $('choice-modal').classList.remove('hidden');
    }
    _closeChoice() { this.pendingCard = null; $('choice-modal').classList.add('hidden'); }

    // ---------------- board rendering ----------------
    render(d) {
      this.updateBar(d.player); this.updateBar(d.opponent);
      this.renderBoardChips(d); this.renderOppChips(d.opponent);
      $('risk-amt').textContent = d.player.table.reduce((s2, b) => s2 + b.amount, 0);
      this.renderPoint(d); this.renderStatuses(d); this.renderHand(d); this.renderControls(d);
      this.renderThreats(d);
      $('opp-hand').textContent = d.opponent.hand.length ? `✋${d.opponent.hand.length}` : '';
      if (d._awaiting === 'rollwindow' && d.pendingRoll && d.active) this.setDicePair(d[d.active], d.pendingRoll, d.point);
    }
    // The two threat meters: how hard the next Anger / Bleed would hit, and how
    // scaled each is (bar fill grows with the escalation).
    renderThreats(d) {
      const p = d.player;
      const A = $('threat-anger'), B = $('threat-bleed');
      if (!A || !B) return;
      const step = (SO.CONFIG && SO.CONFIG.ANGER_STEP) || 3;
      // ---- Anger ----
      const aNext = d.angerThreat(p);                       // damage if idle this round
      const aVal = A.querySelector('.threat-val'), aFill = A.querySelector('.threat-fill');
      A.classList.remove('safe', 'armed');
      if (p._betThisRound) { A.classList.add('safe'); aVal.textContent = '✓'; aFill.style.width = '0%';
        A.title = 'You bet this round — the house is calm. No Anger.'; }
      else if (p.deescalateArmed) { A.classList.add('armed'); aVal.textContent = '🛡'; aFill.style.width = '100%';
        A.title = 'De-escalation armed — the next Anger strike is negated.'; }
      else if (!p._couldBetThisRound) { A.classList.add('safe'); aVal.textContent = '—'; aFill.style.width = '0%';
        A.title = 'No bet was possible this round — no Anger.'; }
      else { aVal.textContent = '−' + aNext; aFill.style.width = Math.min(100, aNext / 24 * 100) + '%';
        A.title = `Don't bet this round and the house strikes for −${aNext}, then grows +${step} each idle round.`; }
      // ---- Bleed ----
      const bNext = d.bleedPreview(p);
      const bVal = B.querySelector('.threat-val'), bFill = B.querySelector('.threat-fill');
      const held = p.tourniquetTurns > 0 || (p.roundMods && p.roundMods.bleedImmune);
      B.classList.toggle('safe', held || bNext === 0);
      if (held) { bVal.textContent = '⛨'; bFill.style.width = '0%'; B.title = 'Bleed is held (tourniquet).'; }
      else { bVal.textContent = '−' + bNext; bFill.style.width = Math.min(100, bNext / 18 * 100) + '%';
        B.title = `Roll with an empty felt and you bleed −${bNext} — it ramps +${(SO.CONFIG && SO.CONFIG.BLEED_RAMP) || 2} each turn. Keep a chip out to pause it.`; }
    }
    updateBar(p) {
      const pct = Math.max(0, Math.min(100, (p.hp / p.maxHp) * 100));
      const you = p.isPlayer;
      $(you ? 'you-fill' : 'opp-fill').style.width = pct + '%';
      $(you ? 'you-trail' : 'opp-trail').style.width = pct + '%';
      const exposed = p.table.reduce((s, b) => s + b.amount, 0);
      $(you ? 'you-hptext' : 'opp-hptext').textContent = exposed > 0 ? `${p.hp} (+${exposed} out)` : `${p.hp}`;
      const bar = $(you ? 'you-hpbar' : 'opp-hpbar');
      bar.classList.toggle('high', pct >= 60); bar.classList.toggle('low', pct > 0 && pct <= 25);
    }
    _zoneFor(b) {
      if (b.betType === 'passodds' || b.betType === 'dontodds') return 'odds';
      if (b.betType === 'place' || b.betType === 'hard') return b.betType + '-' + b.num;
      if ((b.betType === 'come' || b.betType === 'dontcome') && b.num != null) return 'place-' + b.num; // travelled
      return b.betType;
    }
    _chipClass(b) {
      if (b.betType === 'come' || b.betType === 'dontcome') return 'come';
      if (b.betType === 'dontpass' || b.betType.includes('odds')) return 'dont';
      if (['hard', 'any7', 'eleven', 'boxcars', 'aces', 'field'].includes(b.betType)) return 'prop';
      return 'pass';
    }
    // Colorblind: a one-letter bet-type badge that shows even when colour can't
    // be read (owner is carried by chip SHAPE — round = you, square = the house).
    _cbLabel(b) { return ({ pass: 'P', dont: 'D', prop: 'R', come: 'C' })[this._chipClass(b)] || 'P'; }
    // Both souls' chips ride the same felt now: yours in their bet colors,
    // the enemy's in a distinct dark-green "house" chip so you can read the
    // table at a glance.
    renderBoardChips(d) {
      const p = d.player, o = d.opponent;
      const zsig = (t) => t.map((b) => this._zoneFor(b) + ':' + b.amount).join('|');
      const sig = 'you|' + zsig(p.table) + '~opp|' + zsig(o.table);
      if (sig === this._sig.boardChips) return; // nothing on the felt changed
      this._sig.boardChips = sig;
      const table = $('craps-table');
      table.querySelectorAll('.chips-here').forEach((c) => { c.innerHTML = ''; });
      for (const b of p.table) {
        const el = table.querySelector(`.chips-here[data-zone="${this._zoneFor(b)}"]`);
        if (el) el.innerHTML += `<span class="bchip ${this._chipClass(b)}" data-cbl="${this._cbLabel(b)}" title="You — ${(CHIP_LABEL[b.betType] || b.betType)}${b.num ? ' on ' + b.num : ''}">${b.amount}</span>`;
      }
      for (const b of o.table) {
        const el = table.querySelector(`.chips-here[data-zone="${this._zoneFor(b)}"]`);
        if (el) el.innerHTML += `<span class="bchip enemy" data-cbl="${this._cbLabel(b)}" title="${o.name} — ${(CHIP_LABEL[b.betType] || b.betType)}${b.num ? ' on ' + b.num : ''}">${b.amount}</span>`;
      }
    }
    renderOppChips(p) {
      const sig = p.table.map((b) => this._zoneFor(b) + ':' + b.amount).join('|');
      if (sig === this._sig.oppChips) return;
      this._sig.oppChips = sig;
      if (!p.table.length) { $('opp-chips').innerHTML = '<span class="oc-empty">no chips out</span>'; return; }
      $('opp-chips').innerHTML = p.table.map((b) => `<span class="oc-chip ${this._chipClass(b)}">${CHIP_LABEL[b.betType]}${b.num ? ' ' + b.num : ''} · ${b.amount}</span>`).join('');
    }
    renderPoint(d) {
      const table = $('craps-table');
      table.querySelectorAll('.puck').forEach((pk) => pk.classList.remove('on'));
      if (d.point) { const pk = table.querySelector(`.puck[data-puck="${d.point}"]`); if (pk) pk.classList.add('on'); }
    }
    renderStatuses(d) {
      for (const p of [d.player, d.opponent]) {
        const exposed = p.table.reduce((s, b) => s + b.amount, 0);
        const s = p.roundStatus === 'busted' ? 'busted' : p.roundStatus === 'made' ? 'made' : (p.hp <= 0 && exposed > 0 ? 'brink' : '');
        this.setStatus(p, s);
      }
    }
    setStatus(p, s) {
      const el = $(p.isPlayer ? 'you-status' : 'opp-status');
      el.className = 'status-badge' + (s ? ' ' + s : '');
      el.textContent = s === 'busted' ? 'BUSTED' : s === 'made' ? 'MADE IT' : s === 'brink' ? 'ON THE BRINK' : '';
      const t = STATUS_TIPS[s];
      if (t) { el.dataset.tipTitle = t[0]; el.dataset.tip = t[1]; } else { delete el.dataset.tip; delete el.dataset.tipTitle; }
    }

    _cardHTML(id, i, opts) {
      opts = opts || {};
      const def = SO.getCard(id);
      const cls = ['card', def.type, opts.state || '', def.upgraded ? 'upgraded' : ''].join(' ');
      return `<div class="${cls}" data-i="${i}" data-id="${id}" style="--ct:${TYPE_COLOR[def.type] || '#888'}">
        <div class="card-cost${opts.free ? ' free' : ''}">${def.type === 'curse' ? '✖' : (opts.cost != null ? opts.cost : def.nerve)}</div>
        <div class="card-badge">${TYPE_BADGE[def.type] || '?'}</div>
        <div class="card-name">${def.name}</div>
        <div class="card-type"${TYPE_TIPS[def.type] ? ` data-tip-title="${TYPE_TIPS[def.type][0]}" data-tip="${TYPE_TIPS[def.type][1]}"` : ''}>${def.type}${opts.rarity ? ' · ' + def.rarity : ''}</div>
        <div class="card-text">${def.text}</div>
        <div class="card-gem ${def.rarity}"></div>
        ${opts.price != null ? `<div class="card-price">${opts.price}¢</div>` : ''}
      </div>`;
    }
    renderHand(d) {
      const p = d.player;
      const inRoll = d._awaiting === 'rollwindow', inAction = d._awaiting === 'action';
      // memoize: hand contents + phase + nerve + per-card cost drive the display
      const sig = d._awaiting + '|' + p.nerve + '|' + p.hand.map((id) => id + '@' + d._cardCost(p, id)).join(',');
      if (sig === this._sig.hand) return;
      this._sig.hand = sig;
      $('hand').innerHTML = p.hand.map((id, i) => {
        const def = SO.getCard(id); const cost = d._cardCost(p, id);
        const playable = (def.timing === 'rollwindow' && inRoll) || (def.timing === 'action' && inAction);
        const afford = cost <= p.nerve;
        return this._cardHTML(id, i, { state: playable && afford && def.type !== 'curse' ? 'playable' : 'dim', cost, free: cost === 0 && def.nerve > 0 });
      }).join('');
      const pips = $('nerve-pips'); pips.innerHTML = '';
      const maxN = SO.CONFIG.NERVE_PER_TURN + (p.relicMods.nerveDelta || 0);
      for (let i = 0; i < Math.max(maxN, p.nerve); i++) pips.innerHTML += `<span class="np${i < p.nerve ? ' on' : ''}"></span>`;
    }
    renderControls(d) {
      const p = d.player;
      // Betting-tools state (cheap; kept out of the memoised block since canAct
      // and the undo stack change every action). Max Odds needs a line + room;
      // Undo needs something placed this turn.
      const bt = $('bet-tools');
      if (bt) {
        const act = d.canAct();
        const oddsRoom = act && d._lineBet(p) && !p.roundMods.noOdds && !d.runMods.noOdds && (d.maxOdds(p) - d._betAmt(p, p.lineStyle === 'dont' ? 'dontodds' : 'passodds')) > 0;
        const mo = $('max-odds-btn'), ub = $('undo-bet-btn');
        if (mo) mo.disabled = !oddsRoom;
        if (ub) ub.disabled = !(act && p._betLog && p._betLog.length);
        bt.classList.toggle('dim', !act);
      }
      const locked = !!d._lineBet(p);
      const pulls = [];
      p.table.forEach((b, i) => { if (d._pullable(p, b)) pulls.push([i, CHIP_LABEL[b.betType] + (b.num ? ' ' + b.num : ''), b.amount]); });
      const sig = p.lineStyle + '|' + locked + '|' + pulls.map((x) => x.join(':')).join('|');
      if (sig === this._sig.controls) return;
      this._sig.controls = sig;
      $('style-pass').classList.toggle('on', p.lineStyle !== 'dont');
      $('style-dont').classList.toggle('on', p.lineStyle === 'dont');
      $('style-pass').disabled = locked; $('style-dont').disabled = locked;
      $('pull-row').innerHTML = pulls.map(([i, lbl, amt]) => `<button class="btn btn-mini" data-pull="${i}">Pull ${lbl} (${amt})</button>`).join('');
    }

    // ---------------- dice ----------------
    // reuse the 9 pip cells and just flip classNames — avoids an innerHTML
    // rebuild ~18× per roll during the tumble.
    setDie(el, v, hot) {
      if (el.childElementCount !== 9) { let h = ''; for (let i = 0; i < 9; i++) h += '<span></span>'; el.innerHTML = h; }
      const set = PIPS[v] || [];
      const cells = el.children;
      const pipCls = hot ? 'pip hot' : 'pip';
      for (let i = 0; i < 9; i++) cells[i].className = set.includes(i + 1) ? pipCls : '';
      el.classList.remove('empty');
    }
    setDicePair(p, roll, point) { const dice = $(p.isPlayer ? 'you-dice' : 'opp-dice').querySelectorAll('.die'); const hot = roll.total === 7 || (point && roll.total === point); this.setDie(dice[0], roll.d1, hot); this.setDie(dice[1], roll.d2, hot); }
    /* Snappier tumble → a landing "thunk" → a beat to read it. A roll that
     * MATTERS (the point made, or a 7) lands harder and holds a little longer —
     * the closest thing to slow-mo without stalling the game. */
    async rollDice(p, roll, point) {
      const dice = $(p.isPlayer ? 'you-dice' : 'opp-dice').querySelectorAll('.die');
      const still = document.body.classList.contains('reduce-motion');
      const hot = roll.total === 7 || (point && roll.total === point);
      if (still) { this.setDicePair(p, roll, point); await this.wait(420); return; }
      dice.forEach((dd) => dd.classList.add('rolling'));
      for (let f = 0; f < 6; f++) { this.setDie(dice[0], 1 + Math.floor(Math.random() * 6)); this.setDie(dice[1], 1 + Math.floor(Math.random() * 6)); await this.wait(55); }
      this.setDicePair(p, roll, point);
      dice.forEach((dd) => { dd.classList.remove('rolling'); dd.classList.add('land'); if (hot) dd.classList.add('land-hot'); });
      await this.wait(hot ? 250 : 150);
      dice.forEach((dd) => dd.classList.remove('land', 'land-hot'));
      await this.wait(hot ? 470 : 370);
    }
    bumpDice(p) { const dice = $(p.isPlayer ? 'you-dice' : 'opp-dice').querySelectorAll('.die'); dice.forEach((d) => { d.classList.remove('settle'); void d.offsetWidth; d.classList.add('settle'); setTimeout(() => d.classList.remove('settle'), 260); }); }

    // ---------------- effects ----------------
    floater(p, txt, cls) { const bar = $(p.isPlayer ? 'you-hpbar' : 'opp-hpbar'); const r = bar.getBoundingClientRect(); const f = document.createElement('div'); f.className = `floater ${cls}`; f.textContent = txt; f.style.left = (r.left + r.width / 2) + 'px'; f.style.top = (r.top - 6) + 'px'; $('floaters').appendChild(f); setTimeout(() => f.remove(), 1100); }
    /* A played card sails from your hand onto the felt. Purely cosmetic — the
     * card is already gone from the hand by the time this ghost animates. */
    flyCard(cardEl) {
      if (!cardEl || document.body.classList.contains('reduce-motion')) return;
      const from = cardEl.getBoundingClientRect();
      const tableEl = $('craps-table'); if (!tableEl) return;
      const to = tableEl.getBoundingClientRect();
      const ghost = document.createElement('div');
      ghost.className = 'flycard';
      ghost.style.left = from.left + 'px'; ghost.style.top = from.top + 'px';
      ghost.style.width = from.width + 'px'; ghost.style.height = from.height + 'px';
      $('floaters').appendChild(ghost);
      const dx = (to.left + to.width / 2) - (from.left + from.width / 2);
      const dy = (to.top + to.height / 2) - (from.top + from.height / 2);
      requestAnimationFrame(() => { ghost.style.transform = `translate(${dx}px, ${dy}px) scale(0.5) rotate(-9deg)`; ghost.style.opacity = '0'; });
      setTimeout(() => ghost.remove(), 500);
    }
    /* A spill of chips across the screen — the house paying out. */
    chipBurst(count) {
      if (document.body.classList.contains('reduce-motion')) return;
      const host = $('floaters'); if (!host) return;
      const n = count || 20;
      for (let i = 0; i < n; i++) {
        const c = document.createElement('div');
        c.className = 'burstchip';
        c.style.left = (window.innerWidth / 2 + (Math.random() - 0.5) * 180) + 'px';
        c.style.top = (window.innerHeight * 0.4) + 'px';
        c.style.setProperty('--dx', ((Math.random() - 0.5) * 640).toFixed(0) + 'px');
        c.style.setProperty('--dy', (200 + Math.random() * 420).toFixed(0) + 'px');
        c.style.setProperty('--rot', ((Math.random() - 0.5) * 720).toFixed(0) + 'deg');
        c.style.animationDelay = (Math.random() * 240).toFixed(0) + 'ms';
        host.appendChild(c);
        setTimeout(() => c.remove(), 2000);
      }
    }
    flyChip(zoneEl) {
      const from = $('you-hpbar').getBoundingClientRect();
      const to = zoneEl.getBoundingClientRect();
      const c = document.createElement('div'); c.className = 'flychip';
      const sx = from.left + from.width / 2, sy = from.top;
      c.style.left = sx + 'px'; c.style.top = sy + 'px';
      $('floaters').appendChild(c);
      requestAnimationFrame(() => { c.style.transform = `translate(${to.left + to.width / 2 - sx}px, ${to.top + to.height / 2 - sy}px) scale(0.6)`; c.style.opacity = '0.15'; });
      zoneEl.classList.remove('placed'); void zoneEl.offsetWidth; zoneEl.classList.add('placed');
      setTimeout(() => c.remove(), 480);
    }
    nudgeZone(zoneEl) { zoneEl.classList.remove('denied'); void zoneEl.offsetWidth; zoneEl.classList.add('denied'); setTimeout(() => zoneEl.classList.remove('denied'), 400); }
    turn(html) { $('turn-banner').innerHTML = html; }
    log(html, cls) { const e = document.createElement('div'); e.className = 'entry' + (cls ? ' ' + cls : ''); e.innerHTML = this._linkifyKw(html); $('log').appendChild(e); $('log').scrollTop = $('log').scrollHeight; while ($('log').children.length > 80) $('log').removeChild($('log').firstChild); }
    // Wrap known game terms in the log with a hoverable/tappable keyword span.
    _linkifyKw(html) {
      if (html == null) return '';
      const s = String(html);
      if (s.indexOf('class="kw"') >= 0) return s;
      return s.split(/(<[^>]+>)/).map((seg, i) => {
        if (i % 2 === 1) return seg;                 // a tag — leave it be
        return seg.replace(KW_RE, (m) => { const id = KW_ID(m); return id ? `<span class="kw" data-kw="${id}">${m}</span>` : m; });
      }).join('');
    }
    // Attach the felt bet-zone tooltips once (the zones are static in the HTML).
    _wireBetTips() {
      document.querySelectorAll('#craps-table [data-bet]').forEach((z) => {
        const key = z.dataset.num ? z.dataset.bet + '-' + z.dataset.num : z.dataset.bet;
        const t = BET_TIPS[key]; if (!t) return;
        z.dataset.tipTitle = t[0]; z.dataset.tip = t[1];
      });
    }
    _wireKeywordTips() {
      const tip = $('kw-tip'); if (!tip) return;
      // content comes from either a log keyword (.kw + data-kw) or a generic
      // rich tooltip (data-tip [+ data-tip-title]) — relics, bet zones, statuses…
      const content = (el) => {
        if (el.dataset.kw) { const k = KEYWORDS[el.dataset.kw]; return k ? [k[0], k[1]] : null; }
        if (el.dataset.tip) return [el.dataset.tipTitle || '', el.dataset.tip];
        return null;
      };
      const SEL = '.kw, [data-tip]';
      const show = (el) => {
        const c = content(el); if (!c) return;
        tip.innerHTML = '';
        if (c[0]) { const b = document.createElement('b'); b.textContent = c[0]; tip.appendChild(b); }
        const sp = document.createElement('span'); sp.textContent = c[1]; tip.appendChild(sp);
        tip.classList.remove('hidden');
        const r = el.getBoundingClientRect();
        tip.style.left = Math.max(8, Math.min(window.innerWidth - tip.offsetWidth - 8, r.left + r.width / 2 - tip.offsetWidth / 2)) + 'px';
        const above = r.top - tip.offsetHeight - 8;
        tip.style.top = (above < 8 ? r.bottom + 8 : above) + 'px';
      };
      const hide = () => { tip.classList.add('hidden'); tip._for = null; };
      document.addEventListener('mouseover', (e) => { const k = e.target.closest && e.target.closest(SEL); if (k) show(k); });
      document.addEventListener('mouseout', (e) => { const k = e.target.closest && e.target.closest(SEL); if (k && !tip._for) hide(); });
      // Only LOG KEYWORDS (.kw) pin on click/tap — they have no other action.
      // A [data-tip] element (bet zone, relic chip, card) keeps its own click
      // action; its tooltip is hover-only, and any click just dismisses a pin.
      document.addEventListener('click', (e) => {
        const kw = e.target.closest && e.target.closest('.kw');
        if (kw) { if (tip._for === kw) hide(); else { show(kw); tip._for = kw; } return; }
        if (!(e.target.closest && e.target.closest('#kw-tip'))) hide();
      });
    }
    async banner(main, sub, cls, ms) { $('banner-main').textContent = main; $('banner-main').className = 'banner-main' + (cls ? ' ' + cls : ''); $('banner-sub').textContent = sub || ''; $('banner').classList.remove('hidden'); const inner = $('banner').querySelector('.banner-inner'); inner.style.animation = 'none'; void inner.offsetWidth; inner.style.animation = ''; await this.wait(ms || 1000); $('banner').classList.add('hidden'); }

    // Non-blocking corner note. Auto-dismisses; click ✕ to close early.
    toast(icon, title, text, cls) {
      const host = $('hint-host'); if (!host) return;
      const t = document.createElement('div');
      t.className = 'hint-toast' + (cls ? ' ' + cls : '');
      t.innerHTML = `<span class="hint-ico"></span><div class="hint-body"><b></b><span></span></div><button class="hint-x" title="Dismiss">✕</button>`;
      t.querySelector('.hint-ico').textContent = icon;
      t.querySelector('b').textContent = title;
      t.querySelector('.hint-body span').textContent = text;
      const kill = () => { if (t._dead) return; t._dead = true; t.classList.add('out'); setTimeout(() => t.remove(), 360); };
      t.querySelector('.hint-x').addEventListener('click', kill);
      host.appendChild(t);
      requestAnimationFrame(() => t.classList.add('in'));
      setTimeout(kill, 9000);
    }
    // One-time contextual nudge for players who skipped the tutorial. Shows at
    // most once ever per id (tracked in SO.Profile).
    hint(id, title, text) {
      if (SO.Profile) { if (SO.Profile.hintSeen(id)) return; SO.Profile.markHint(id); }
      this.toast('💡', title, text);
    }
    unlockToast(u) { this.toast('🔓', 'Unlocked · ' + (u.kind === 'relic' ? 'Relic' : 'Card'), `${SO.unlockName(u)} — ${u.hint}. It can turn up in drafts and shops from now on.`, 'unlock'); }
    achToast(a) { this.toast('🏆', 'Achievement · ' + a.name, a.desc, 'ach'); }
    /* Drain anything the DOM-free layers queued (run.js can't talk to the UI). */
    drainProfileToasts() {
      if (!SO.Profile) return;
      SO.Profile.drainUnlocks().forEach((u) => this.unlockToast(u));
      SO.Profile.drainAwards().forEach((a) => this.achToast(a));
    }

    // ================= RUN SCREENS =================
    showDeck() {
      this._deckCancel = null; // plain viewer: closing does nothing special
      this._deckView = this._deckView || { filter: 'all', sort: 'name', peek: false };
      this.renderDeckView();
      $('deck-modal').classList.remove('hidden');
    }
    renderDeckView() {
      const v = this._deckView;
      const player = this.run ? this.run.player : (this.duel ? this.duel.player : { deck: [], relics: [] });
      const deck = player.deck || [];
      const relics = player.relics || [];
      const inDuel = !!(this.duel && !this.duel.over);
      $('deck-title').textContent = 'Your deck';

      // relics — full name + text, readable any time (topbar only shows initials)
      let relicHTML = '';
      if (relics.length) {
        relicHTML = `<div class="deck-sec-h">Relics · ${relics.length}</div><div class="deck-relics">` +
          relics.map((id) => { const r = SO.RELICS[id]; if (!r) return ''; return `<div class="drelic"><span class="relic-gem ${r.rarity || ''}"></span><span class="drelic-body"><b>${r.name}</b><span>${r.text}</span></span></div>`; }).join('') +
          `</div>`;
      }

      // draw-pile peek (only meaningful mid-duel: shows the live draw order)
      let peekHTML = '';
      if (inDuel) {
        const dp = this.duel.player.drawPile || [], disc = this.duel.player.discardPile || [], hand = this.duel.player.hand || [];
        peekHTML = `<button class="deck-peek-toggle" data-act="peek">${v.peek ? '▾' : '▸'} Draw pile · ${dp.length} left <span class="dp-sub">hand ${hand.length} · discard ${disc.length}</span></button>`;
        if (v.peek) {
          peekHTML += '<div class="deck-peek-list">' + (dp.length
            ? dp.map((id, i) => { const def = SO.getCard(id); return `<span class="dp-card" style="--ct:${TYPE_COLOR[def.type] || '#888'}">${i + 1}. ${def.name}</span>`; }).join('')
            : '<span class="dr-note">Draw pile empty — it reshuffles from the discard.</span>') + '</div>';
        }
      }

      // filter + sort tools
      const types = [];
      deck.forEach((id) => { const t = SO.getCard(id).type; if (types.indexOf(t) < 0) types.push(t); });
      const filters = ['all'].concat(types);
      const toolsHTML = `<div class="deck-tools"><div class="deck-filters">` +
        filters.map((f) => `<button class="deck-filter${v.filter === f ? ' on' : ''}" data-filter="${f}">${f === 'all' ? 'All' : f}</button>`).join('') +
        `</div><div class="deck-sort"><span>sort</span>` +
        ['name', 'nerve', 'type'].map((s) => `<button class="deck-sortbtn${v.sort === s ? ' on' : ''}" data-sort="${s}">${s}</button>`).join('') +
        `</div></div>`;

      // cards, count-collapsed, filtered + sorted
      const counts = {};
      deck.forEach((id) => { if (v.filter === 'all' || SO.getCard(id).type === v.filter) counts[id] = (counts[id] || 0) + 1; });
      const nn = (id) => { const n = SO.getCard(id).nerve; return n === 99 ? 999 : n; };
      const ids = Object.keys(counts).sort((a, b) => {
        const A = SO.getCard(a), B = SO.getCard(b);
        if (v.sort === 'nerve') return nn(a) - nn(b) || A.name.localeCompare(B.name);
        if (v.sort === 'type') return (A.type > B.type ? 1 : A.type < B.type ? -1 : 0) || A.name.localeCompare(B.name);
        return A.name.localeCompare(B.name);
      });
      const cardsHTML = '<div class="deck-cards">' + (ids.length
        ? ids.map((id) => { const def = SO.getCard(id); return `<div class="deck-row ${def.upgraded ? 'upgraded' : ''}" style="--ct:${TYPE_COLOR[def.type] || '#888'}"><b>${counts[id]}×</b> ${def.name} <span class="dr-type">${def.type} · ${def.nerve === 99 ? '—' : def.nerve}N</span><span class="dr-text">${def.text}</span></div>`; }).join('')
        : '<p class="dr-note">No cards match this filter.</p>') + '</div>';

      const host = $('deck-list');
      host.innerHTML = relicHTML + peekHTML + toolsHTML + cardsHTML;
      host.querySelectorAll('.deck-filter').forEach((b) => b.onclick = () => { v.filter = b.dataset.filter; this.renderDeckView(); });
      host.querySelectorAll('.deck-sortbtn').forEach((b) => b.onclick = () => { v.sort = b.dataset.sort; this.renderDeckView(); });
      const pk = host.querySelector('[data-act="peek"]'); if (pk) pk.onclick = () => { v.peek = !v.peek; this.renderDeckView(); };
    }

    /* Deck picker: opens the deck modal in pick mode. filter(id)=>bool, cb(index).
     * onCancel runs if the player closes the modal without picking — callers
     * MUST pass it when the pick gates screen navigation (events). */
    pickFromDeck(title, filter, cb, onCancel) {
      this._deckCancel = onCancel || null;
      const deck = this.run.player.deck;
      $('deck-title').textContent = title;
      $('deck-list').innerHTML = deck.map((id, i) => {
        const def = SO.getCard(id);
        if (!filter(id)) return '';
        return `<button class="deck-row pickable ${def.upgraded ? 'upgraded' : ''}" data-i="${i}" style="--ct:${TYPE_COLOR[def.type]}"><b>${def.name}</b> <span class="dr-type">${def.type} · ${def.nerve === 99 ? '—' : def.nerve}N</span><span class="dr-text">${def.text}</span></button>`;
      }).join('') || '<p class="dr-note">Nothing eligible.</p>';
      $('deck-list').querySelectorAll('.pickable').forEach((b) => b.addEventListener('click', () => { this._deckCancel = null; $('deck-modal').classList.add('hidden'); cb(parseInt(b.dataset.i, 10)); }));
      $('deck-modal').classList.remove('hidden');
    }

    renderMap(run, onPick) {
      this.show('map-screen'); this.topbar(true);
      $('map-title').textContent = run.bossRush ? 'The Gauntlet' : run.act.name;
      $('map-sub').textContent = run.bossRush ? 'Five bosses. One staircase. No rest.' : run.act.sub;
      const svg = $('map-svg'); const rows = run.map.rows; const R = rows.length;
      // botPad leaves room for the bottom row's node + its label so they never
      // clip into the scene-frame; topPad clears the top boss node's glow.
      const W = 760, rowH = 110, topPad = 56, botPad = 72, H = (R - 1) * rowH + topPad + botPad;
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      const pos = {};
      rows.forEach((row, r) => { const y = H - botPad - r * rowH; row.forEach((n, cc) => { const x = (W / (row.length + 1)) * (cc + 1); pos[n.id] = { x, y }; }); });
      const avail = new Set(run.available().map((n) => n.id));
      const done = new Set(run.completedNodes);
      let edges = '', nodes = '';
      rows.forEach((row) => row.forEach((n) => { n.edges.forEach((e) => { const a = pos[n.id], b = pos[e]; edges += `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" class="${done.has(n.id) ? 'edge-done' : 'edge'}"/>`; }); }));
      rows.forEach((row) => row.forEach((n) => {
        const pp = pos[n.id];
        const cls = ['mnode', n.type, avail.has(n.id) ? 'avail' : '', done.has(n.id) ? 'done' : '', run.currentNodeId === n.id ? 'cur' : ''].join(' ');
        const label = (n.type === 'duel' || n.type === 'elite') ? (SO.ENEMIES[n.enemy] ? SO.ENEMIES[n.enemy].name : 'Duel') : n.type === 'boss' ? (SO.BOSSES[n.boss || run.act.boss] || {}).name : n.type[0].toUpperCase() + n.type.slice(1);
        const r = n.type === 'boss' ? 30 : 22;
        nodes += `<g class="${cls}" data-id="${n.id}" transform="translate(${pp.x},${pp.y})">
          <circle r="${r}" class="mnode-c"/><circle r="${r - 5}" class="mnode-ring"/>
          <text class="mnode-ico" y="7" text-anchor="middle">${NODE_ICON[n.type] || '?'}</text>
          <text class="mnode-lbl" y="${r + 16}" text-anchor="middle">${label}</text>
        </g>`;
      }));
      svg.innerHTML = edges + nodes;
      svg.querySelectorAll('.mnode.avail').forEach((g) => g.addEventListener('click', () => onPick(g.dataset.id)));
    }

    showReward(run, opts, handlers) {
      this.show('reward-screen'); this.topbar(true);
      $('reward-title').textContent = opts.title || 'Victory';
      $('reward-sub').innerHTML = opts.sub || '';
      const rr = $('reward-relics');
      if (opts.relics && opts.relics.length) {
        rr.innerHTML = opts.relics.map((id, i) => this._relicCardHTML(id, i)).join('');
        rr.querySelectorAll('.relic-card').forEach((el) => el.addEventListener('click', () => handlers.pickRelic(parseInt(el.dataset.i, 10))));
        rr.classList.remove('hidden');
      } else { rr.innerHTML = ''; rr.classList.add('hidden'); }
      this._noteSeen(opts.cards);
      $('reward-cards').innerHTML = (opts.cards || []).map((id, i) => this._cardHTML(id, i, { state: 'choice', rarity: true })).join('');
      $('reward-cards').querySelectorAll('.card').forEach((el) => el.addEventListener('click', () => handlers.pickCard(parseInt(el.dataset.i, 10))));
      $('skip-reward').onclick = handlers.skip;
      $('skip-reward').classList.toggle('hidden', !(opts.cards && opts.cards.length));
    }
    /* A card is "seen" the moment it's offered — a draft, a shelf, an event's
     * spread. Only counts the first time it appears in a given offer. */
    _noteSeen(ids) {
      if (!SO.Profile || !ids || !ids.length) return;
      ids.forEach((id) => SO.Profile.noteCardSeen(id));
    }
    _relicCardHTML(id, i, price) {
      const def = SO.RELICS[id];
      return `<div class="relic-card" data-i="${i}"><span class="relic-gem ${def.rarity}"></span><b>${def.name}</b><span>${def.text}</span>${price != null ? `<div class="card-price">${price}¢</div>` : ''}</div>`;
    }

    showEvent(run, ev, onDone) {
      this.show('event-screen'); this.topbar(true);
      $('event-title').textContent = ev.title;
      $('event-text').textContent = ev.text;
      $('event-result').classList.add('hidden');
      $('event-continue').classList.add('hidden');
      const box = $('event-choices');
      box.innerHTML = ev.choices.map((ch, i) => {
        const usable = !ch.can || ch.can(run);
        return `<button class="btn event-btn${usable ? '' : ' disabled'}" data-i="${i}" ${usable ? '' : 'disabled'}><b>${ch.label}</b><span>${ch.hint}</span></button>`;
      }).join('');
      box.querySelectorAll('button[data-i]').forEach((b) => b.addEventListener('click', () => {
        const ch = ev.choices[parseInt(b.dataset.i, 10)];
        const result = ch.effect(run);
        box.innerHTML = '';
        this.topbar(true);
        if (result) { $('event-result').textContent = result; $('event-result').classList.remove('hidden'); }
        $('event-continue').classList.remove('hidden');
        $('event-continue').onclick = () => onDone();
        if (!result) onDone(); // effects that open their own follow-up screen
      }));
    }

    showActTransition(run, healed, relics, onPick) {
      this.show('act-screen'); this.topbar(true);
      const roman = ['I', 'II', 'III', 'IV', 'V'];
      $('act-title').textContent = `ACT ${roman[run.actIdx]} — ${run.act.name}`;
      $('act-sub').textContent = run.act.sub;
      $('act-heal').textContent = healed > 0 ? `The climb steadies you: +${healed} HP.` : '';
      const rr = $('act-relics');
      rr.innerHTML = relics.map((id, i) => this._relicCardHTML(id, i)).join('');
      rr.querySelectorAll('.relic-card').forEach((el) => el.addEventListener('click', () => onPick(parseInt(el.dataset.i, 10))));
    }

    showShop(run, stock, handlers) {
      this.show('shop-screen'); this.topbar(true);
      const cc = $('shop-cards');
      cc.innerHTML = stock.cards.map((c, i) => c.sold ? `<div class="card sold">SOLD</div>` : this._cardHTML(c.id, i, { state: 'choice', rarity: true, price: c.price })).join('');
      cc.querySelectorAll('.card[data-i]').forEach((el) => el.addEventListener('click', () => handlers.buyCard(parseInt(el.dataset.i, 10))));
      const rc = $('shop-relics');
      rc.innerHTML = stock.relics.map((r, i) => r.sold ? `<div class="relic-card sold">SOLD</div>` : this._relicCardHTML(r.id, i, r.price)).join('');
      rc.querySelectorAll('.relic-card[data-i]').forEach((el) => el.addEventListener('click', () => handlers.buyRelic(parseInt(el.dataset.i, 10))));
      $('removal-cost').textContent = run.effectiveRemovalCost;
      $('facedown-cost').textContent = SO.CONFIG.SHOP_FACEDOWN_CARD;
      $('lever-cost').textContent = SO.CONFIG.SHOP_LEVER;
      $('shop-remove').disabled = run.coins < run.effectiveRemovalCost;
      $('shop-facedown').disabled = stock.facedownUsed || run.coins < SO.CONFIG.SHOP_FACEDOWN_CARD;
      $('shop-lever').disabled = stock.leverUsed || run.coins < SO.CONFIG.SHOP_LEVER;
      $('shop-remove').onclick = handlers.remove;
      $('shop-facedown').onclick = handlers.facedown;
      $('shop-lever').onclick = handlers.lever;
      $('leave-shop').onclick = handlers.leave;
    }

    showRest(run, handlers) {
      this.show('rest-screen'); this.topbar(true);
      $('rest-mend').disabled = false; $('rest-sharpen').disabled = false;
      $('rest-mend').innerHTML = '<b>Mend</b><span>Restore 30% of max HP</span>';
      $('rest-sharpen').innerHTML = '<b>Sharpen</b><span>Upgrade a card permanently</span>';
      $('rest-cleanse').innerHTML = '<b>Cleanse</b><span>Remove one curse</span>';
      const hasCurse = run.player.deck.some((id) => SO.getCard(id) && SO.getCard(id).type === 'curse');
      const hasUpgradable = run.player.deck.some((id) => !id.endsWith('+') && SO.getCard(id).type !== 'curse');
      $('rest-cleanse').disabled = !hasCurse;
      $('rest-sharpen').disabled = !hasUpgradable;
      $('leave-rest').classList.add('hidden');
      $('rest-mend').onclick = handlers.mend;
      $('rest-sharpen').onclick = handlers.sharpen;
      $('rest-cleanse').onclick = handlers.cleanse;
      $('leave-rest').onclick = handlers.leave;
    }
    restDone(label, detail) {
      for (const id of ['rest-mend', 'rest-sharpen', 'rest-cleanse']) $(id).disabled = true;
      if (label) $(label).innerHTML = detail;
      $('leave-rest').classList.remove('hidden');
      this.topbar(true);
    }

    endScreen(opts) {
      if (SO.Audio) SO.Audio.play('menu');
      const r = this.run, s = (r && r.stats) || {};
      const won = !!opts.won;
      const roman = ['I', 'II', 'III', 'IV', 'V'];
      $('end-kicker').textContent = opts.kicker || (won ? 'YOU BEAT' : 'SENT DOWN BY');
      $('end-title').textContent = 'AweCrap';
      $('end-sub').textContent = opts.sub || (won ? 'THE HOUSE BOWS. FOR NOW.' : 'PURGATORY KEEPS YOU.');
      $('end-quote').textContent = opts.quote || (won
        ? '“You played the game. You broke the rules. But purgatory never closes.”'
        : '“Everyone comes back. The house can wait forever.”');
      $('end-score').textContent = this._score(s, r, won).toLocaleString();
      $('end-seed').textContent = r ? this._seedTag(r.seed) : '—';
      const floor = r && r.inDepth ? r.act.name.toUpperCase()
        : r && r.endless ? 'DESCENT · FLOOR ' + (r.endlessDepth || 1)
          : 'ACT ' + (roman[r ? r.actIdx : 0] || '?');
      const rows = [
        ['ROUNDS SURVIVED', s.rounds || 0],
        ['CARDS PLAYED', s.cards || 0],
        ['ROLLS MADE', s.rolls || 0],
        ['SOULS FELLED', s.duels || 0],
        ['REST FIRES', s.rests || 0],
        ['EVENTS FACED', s.events || 0],
        ['DEEPEST FLOOR', floor],
        ['TOUGHEST FOE', s.toughestFoe ? (s.toughestFoe + ' · R' + s.toughestFoeRound) : '—'],
        ['FINAL HP', (r ? r.player.hp : 0) + ' / ' + (r ? r.player.maxHp : 100)],
      ];
      if (r && r.modifiers && r.modifiers.length) rows.push(['MODIFIERS', r.modifiers.length + ' · ×' + (r.scoreMult || 1).toFixed(2) + ' score']);
      $('end-stats').innerHTML = rows.map(([l, v]) => `<div class="stat-row"><span class="sr-label">${l}</span><span class="sr-dots"></span><span class="sr-val">${v}</span></div>`).join('');
      // "Descend Deeper" appears only when the caller offers it (a fresh win)
      const dbtn = $('btn-descend'); if (dbtn) dbtn.classList.toggle('hidden', !opts.canDescend);
      // Loss-recovery: on a defeat, show the last few log lines so the death
      // teaches. (The duel log still holds them — it's only cleared at duelStart.)
      const elog = $('end-log');
      if (elog) {
        const entries = won ? [] : [...document.querySelectorAll('#log .entry')].slice(-5);
        if (entries.length) {
          $('end-log-lines').innerHTML = entries.map((e) => `<div class="ell">${e.innerHTML}</div>`).join('');
          elog.classList.remove('hidden');
        } else { elog.classList.add('hidden'); }
      }
      // Run-summary share card (a copyable, postable recap + run-it-back seed)
      this._lastSummary = this._shareText(r, s, won, floor);
      const sub = $('copy-summary-sub'); if (sub) sub.textContent = r ? this._seedTag(r.seed) : 'copy recap';
      $('end-screen').classList.remove('hidden');
      if (opts.fanfare) this.chipBurst();   // only a genuine win spills chips
    }
    // clipboard fallback for older webviews (no navigator.clipboard)
    _fallbackCopy(txt, done) {
      try {
        const ta = document.createElement('textarea');
        ta.value = txt; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select();
        document.execCommand('copy'); document.body.removeChild(ta);
        if (done) done();
      } catch (e) { /* clipboard unavailable — the recap is still on-screen */ }
    }
    /* A shareable recap: score, soul, difficulty, depth, and the seed to run it
     * back. Plain text so it pastes anywhere. */
    _shareText(r, s, won, floor) {
      if (!r) return 'AweCrap';
      const soul = (r.character && r.character.name) || 'The Gambler';
      const rung = (SO.ascensionInfo ? SO.ascensionInfo(r.difficultyIdx || 0).name : '');
      const score = this._score(s, r, won).toLocaleString();
      const foe = won ? 'THE HOUSE' : (s.toughestFoe || 'the floor');
      const lines = [
        `AweCrap 🎲 — ${won ? 'I beat ' + foe : 'fell to ' + foe}`,
        `Score ${score} · ${soul}${rung ? ' · ' + rung : ''}`,
        `Deepest: ${floor} · ${s.duels || 0} souls felled`,
        `Seed ${this._seedTag(r.seed)} — run it back`,
      ];
      if (r.modifiers && r.modifiers.length) lines.splice(2, 0, `${r.modifiers.length} modifier${r.modifiers.length > 1 ? 's' : ''} · ×${(r.scoreMult || 1).toFixed(2)} score`);
      return lines.join('\n');
    }
    _seedTag(seed) {
      const b36 = (seed >>> 0).toString(36).toUpperCase().padStart(8, '0');
      return 'AWECRAP-' + b36.slice(0, 4) + '-' + b36.slice(4);
    }
    _score(s, r, won) {
      if (!r) return 0;
      const diffMult = 1 + (r.difficultyIdx || 0) * 0.35;
      const base = (s.nodes || 0) * 8000 + (r.actIdx + 1) * 42000 + r.player.hp * 2600
        + (s.cards || 0) * 550 + (s.rolls || 0) * 350 + (s.duels || 0) * 6000 + (won ? 250000 : 0);
      return Math.round(base * diffMult * (r.scoreMult || 1));
    }
  }

  SO.UI = UI;
})();
