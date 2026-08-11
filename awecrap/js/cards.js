/* AWECRAP — cards.js
 * Card framework + the base catalog (§6.3). The expansion pool lives in
 * cards_ext.js; both register through SO.registerCards().
 *
 * Card def: { name, type, nerve, rarity, timing, text, mag?, tags?, needs?,
 *             oncePerRound?, targetsOpp?, aiChoose?, play(g,self,opp,ch,def) }
 *   - `mag` is the card's tunable magnitude; upgrades scale it.
 *   - `timing`: 'action' (your action phase) | 'rollwindow' (after dice land).
 *   - play() receives the RESOLVED def (upgraded copies pass their own def).
 *
 * Upgrades (Sharpen at rest fires): id + '+' is an upgraded copy —
 * nerve −1 (min 0) and mag ×1.5 (rounded up). SO.getCard resolves both forms.
 */
window.SO = window.SO || {};

(function () {
  const clampFace = (f) => Math.max(1, Math.min(6, f));
  const total = (r) => { r.total = r.d1 + r.d2; return r; };

  // Set one die to best serve the actor: pass wants the point, dont wants 7.
  function aiSetOneDie(self, roll, point) {
    const goal = self.lineStyle === 'dont' ? 7 : point;
    for (const die of [0, 1]) {
      const other = die === 0 ? roll.d2 : roll.d1;
      const need = goal - other;
      if (need >= 1 && need <= 6) return { die, face: need };
    }
    return { die: 0, face: clampFace((self.lineStyle === 'dont' ? 7 : point) - roll.d2) };
  }

  const CARDS = {};
  SO.CARDS = CARDS;
  SO.registerCards = function (defs) { for (const id in defs) CARDS[id] = defs[id]; };

  // Resolve an id ('foo' or upgraded 'foo+') to a def. Upgraded defs are cached.
  const upCache = {};
  SO.getCard = function (id) {
    if (!id) return null;
    if (id.endsWith('+')) {
      if (upCache[id]) return upCache[id];
      const base = CARDS[id.slice(0, -1)];
      if (!base) return null;
      const up = Object.assign({}, base, {
        id, name: base.name + '+', upgraded: true,
        nerve: base.nerve >= 99 ? base.nerve : Math.max(0, base.nerve - 1),
        mag: base.mag != null ? Math.ceil(base.mag * 1.5) : undefined,
      });
      upCache[id] = up;
      return up;
    }
    return CARDS[id] || null;
  };
  SO.baseId = (id) => (id.endsWith('+') ? id.slice(0, -1) : id);

  SO.registerCards({
    // ===================== ROLL =====================
    loaded_die: {
      name: 'Loaded Die', type: 'roll', nerve: 1, rarity: 'common', timing: 'rollwindow', tags: ['rig'],
      text: 'After rolling, set ONE of your dice to a face you choose.',
      needs: 'dieFace',
      aiChoose: (g, self) => aiSetOneDie(self, g.pendingRoll, g.point),
      play(g, self, opp, ch) { const r = g.pendingRoll; if (ch.die === 0) r.d1 = clampFace(ch.face); else r.d2 = clampFace(ch.face); total(r); },
    },
    nudge: {
      name: 'Nudge', type: 'roll', nerve: 0, rarity: 'common', timing: 'rollwindow', tags: ['rig'],
      text: 'After rolling, change one die by ±1.',
      needs: 'dieDelta',
      aiChoose: (g, self) => {
        const r = g.pendingRoll, goal = self.lineStyle === 'dont' ? 7 : g.point;
        for (const die of [0, 1]) for (const d of [1, -1]) {
          const nr = { d1: r.d1, d2: r.d2 }; if (die === 0) nr.d1 += d; else nr.d2 += d;
          if (nr.d1 >= 1 && nr.d1 <= 6 && nr.d2 >= 1 && nr.d2 <= 6 && nr.d1 + nr.d2 === goal) return { die, delta: d };
        }
        return { die: 0, delta: r.d1 < 6 ? 1 : -1 };
      },
      play(g, self, opp, ch) { const r = g.pendingRoll; if (ch.die === 0) r.d1 = clampFace(r.d1 + ch.delta); else r.d2 = clampFace(r.d2 + ch.delta); total(r); },
    },
    cold_bones: {
      name: 'Cold Bones', type: 'roll', nerve: 1, rarity: 'common', timing: 'rollwindow', tags: ['rig', 'dont'],
      text: 'After rolling, set one die so your total becomes 7.',
      play(g) { const r = g.pendingRoll; r.d1 = clampFace(7 - r.d2); total(r); },
    },
    reroll: {
      name: 'Reroll', type: 'roll', nerve: 1, rarity: 'common', timing: 'rollwindow', tags: ['rig'],
      text: 'Reroll both your dice; keep the new result.',
      play(g) { g.pendingRoll = g.rollDice(g.active === 'player' ? g.player : g.opponent); },
    },
    third_bone: {
      name: 'Third Bone', type: 'roll', nerve: 2, rarity: 'uncommon', timing: 'action', tags: ['rig'], mag: 1,
      text: 'This round, roll an extra die and keep the best two.',
      play(g, self, o, ch, def) { self.roundMods.extraDice = (self.roundMods.extraDice || 0) + (def.mag || 1); },
    },
    weighted_faces: {
      name: 'Weighted Faces', type: 'roll', nerve: 2, rarity: 'uncommon', timing: 'action', tags: ['rig'],
      text: 'This round, your dice can never roll a 1.',
      play(g, self) { self.roundMods.faceFloor = Math.max(self.roundMods.faceFloor || 1, 2); },
    },
    pocket_aces: {
      name: 'Pocket Aces', type: 'roll', nerve: 3, rarity: 'rare', timing: 'rollwindow', tags: ['rig'],
      text: 'Set BOTH dice to faces you choose (once this round).',
      needs: 'bothFaces', oncePerRound: true,
      aiChoose: (g, self) => {
        const goal = self.lineStyle === 'dont' ? 7 : g.point;
        for (let a = 1; a <= 6; a++) { const b = goal - a; if (b >= 1 && b <= 6) return { f0: a, f1: b }; }
        return { f0: 3, f1: 4 };
      },
      play(g, self, opp, ch) { const r = g.pendingRoll; r.d1 = clampFace(ch.f0); r.d2 = clampFace(ch.f1); total(r); },
    },

    // ===================== BET =====================
    sure_thing: {
      name: 'Sure Thing', type: 'bet', nerve: 1, rarity: 'common', timing: 'action', tags: ['line'],
      text: 'Your Pass Line pays 2:1 this round but is locked immediately.',
      play(g, self) { self.roundMods.sureThing = true; },
    },
    let_it_ride: {
      name: 'Let It Ride', type: 'bet', nerve: 1, rarity: 'uncommon', timing: 'action', tags: ['prop'], mag: 50,
      text: 'A Place/Prop bet survives the round and rides; +50% payout each round it survives.',
      play(g, self, o, ch, def) { self.roundMods.letItRide = 1 + (def.mag || 50) / 100; },
    },
    crapless: {
      name: 'Crapless', type: 'bet', nerve: 2, rarity: 'uncommon', timing: 'action', tags: ['line'],
      text: 'This round, 2/3/11/12 also make your line (bonus outs).',
      play(g, self) { self.roundMods.crapless = true; },
    },
    all_odds: {
      name: 'All Odds', type: 'bet', nerve: 1, rarity: 'uncommon', timing: 'action', tags: ['line'],
      text: 'Double the maximum odds you can take/lay this round.',
      play(g, self) { self.roundMods.maxOddsMult = 2; },
    },
    devils_markup: {
      name: "Devil's Markup", type: 'bet', nerve: 2, rarity: 'rare', timing: 'action', tags: ['prop'],
      text: 'All your prop/hardway payouts are doubled this round, but your bleed ramp is +1.',
      play(g, self) { self.roundMods.propMult = (self.roundMods.propMult || 1) * 2; self.roundMods.bleedRampDelta = (self.roundMods.bleedRampDelta || 0) + 1; },
    },
    boxcar_special: {
      name: 'Boxcar Special', type: 'bet', nerve: 2, rarity: 'rare', timing: 'action', tags: ['prop'], mag: 5,
      text: 'Place a 5 HP one-roll bet on 12 (Boxcars). If your next roll hits, 30:1.',
      play(g, self, o, ch, def) { const amt = Math.min(def.mag || 5, self.hp); if (amt > 0) g.placeBet(self, { betType: 'boxcars', amount: amt }); },
    },

    // ===================== INTERFERE =====================
    sleight_of_hand: {
      name: 'Sleight of Hand', type: 'interfere', nerve: 2, rarity: 'uncommon', timing: 'action', tags: ['steal'], targetsOpp: true,
      text: "Steal one of the opponent's active bets: it rides for YOU now.",
      play(g, self, opp) {
        if (!opp.table.length) return 'no bet to steal';
        opp.table.sort((a, b) => b.amount - a.amount);
        const stolen = opp.table.shift();
        self.table.push(stolen);
        return `stole a ${stolen.betType} bet (${stolen.amount})`;
      },
    },
    pickpocket: {
      name: 'Pickpocket', type: 'interfere', nerve: 1, rarity: 'common', timing: 'action', tags: ['steal'], mag: 5, targetsOpp: true,
      text: "Take 5 HP from the opponent's chips on the table.",
      play(g, self, opp, ch, def) {
        const tot = opp.table.reduce((s, b) => s + b.amount, 0);
        if (tot <= 0) return 'nothing to pick';
        const take = Math.min(def.mag || 5, tot);
        opp.table.sort((a, b) => b.amount - a.amount);
        let left = take;
        for (const b of opp.table) { const d = Math.min(left, b.amount); b.amount -= d; left -= d; if (left <= 0) break; }
        opp.table = opp.table.filter((b) => b.amount > 0);
        g.heal(self, take, 'steal');
        return `picked ${take} HP`;
      },
    },
    jinx: {
      name: 'Jinx', type: 'interfere', nerve: 2, rarity: 'uncommon', timing: 'action', tags: ['deny'], targetsOpp: true,
      text: "Force the opponent to reroll their next point-making / 7-winning roll.",
      play(g, self, opp) { opp.jinxed = true; },
    },
    cooler: {
      name: 'Cooler', type: 'interfere', nerve: 3, rarity: 'rare', timing: 'action', tags: ['deny'],
      text: 'You set the point next round regardless of the roll-off.',
      play(g, self) { g.coolerSetter = self; },
    },
    marked_cards: {
      name: 'Marked Cards', type: 'interfere', nerve: 0, rarity: 'common', timing: 'action', tags: ['info'],
      text: "Reveal the opponent's hand and their favored point.",
      play(g, self, opp) {
        const hand = opp.hand.map((id) => SO.getCard(id).name).join(', ') || 'nothing';
        const pts = (opp.def && opp.def.setsPoint) ? opp.def.setsPoint.join('/') : '?';
        return `they hold: ${hand} — they favor ${pts}`;
      },
    },

    // ===================== SURVIVAL =====================
    tourniquet: {
      name: 'Tourniquet', type: 'survival', nerve: 1, rarity: 'common', timing: 'action', tags: ['stall'], mag: 2,
      text: 'Pause your bleed for your next 2 turns even with an empty table.',
      play(g, self, o, ch, def) { self.tourniquetTurns = Math.max(self.tourniquetTurns || 0, def.mag || 2); },
    },
    second_wind: {
      name: 'Second Wind', type: 'survival', nerve: 1, rarity: 'uncommon', timing: 'action', tags: ['stall'], mag: 3,
      text: 'Your next pull this round costs no tax and instead heals 3.',
      play(g, self, o, ch, def) { self.roundMods.secondWind = def.mag || 3; },
    },
    patience: {
      name: 'Patience', type: 'survival', nerve: 2, rarity: 'uncommon', timing: 'action', tags: ['stall'],
      text: "Reduce this round's bleed ramp to 0 (bleed stays flat at base).",
      play(g, self) { self.roundMods.bleedRampZero = true; },
    },
    reapers_cut: {
      name: "Reaper's Cut", type: 'survival', nerve: 1, rarity: 'uncommon', timing: 'action', tags: ['dont'], mag: 8,
      text: 'When the opponent busts this round, heal 8 HP.',
      play(g, self, o, ch, def) { self.roundMods.healOnOppBust = (self.roundMods.healOnOppBust || 0) + (def.mag || 8); },
    },
    field_medic: {
      name: 'Field Medic', type: 'survival', nerve: 2, rarity: 'rare', timing: 'action', tags: ['heal'], mag: 4,
      text: 'Each time one of your bets wins this round, heal an extra 4 HP.',
      play(g, self, o, ch, def) { self.roundMods.healPerWin = (self.roundMods.healPerWin || 0) + (def.mag || 4); },
    },
    last_rites: {
      name: 'Last Rites', type: 'survival', nerve: 3, rarity: 'rare', timing: 'action', tags: ['stall'],
      text: 'Once per duel: the next time you would bust, your dice are rerolled instead.',
      play(g, self) { self.lastRites = true; },
    },
    de_escalation: {
      name: 'De-escalation', type: 'survival', nerve: 1, rarity: 'common', timing: 'action', tags: ['stall'],
      text: 'Calm the house: negate the next Anger strike (the penalty for not betting a round).',
      play(g, self) { self.deescalateArmed = true; },
    },

    // ===================== CURSES (not draftable) =====================
    trembling_hands: { name: 'Trembling Hands', type: 'curse', nerve: 99, rarity: 'curse', timing: 'none', text: '+1 to your bleed each turn while in hand. Remove at shop.' },
    bad_beat: { name: 'Bad Beat', type: 'curse', nerve: 99, rarity: 'curse', timing: 'none', text: '−10 max HP while in hand. Remove at shop.' },
    cold_streak: { name: 'Cold Streak', type: 'curse', nerve: 99, rarity: 'curse', timing: 'none', text: 'You cannot heal on the first round of each duel. Remove at shop.' },
  });

  // §6.5 — starter deck. You open every duel with a De-escalation in hand
  // (guaranteed by the duel's frontload) as a relief valve against Anger.
  SO.STARTER_DECK = [
    'nudge', 'nudge', 'nudge',
    'loaded_die', 'loaded_die',
    'tourniquet', 'tourniquet',
    'sure_thing', 'pickpocket', 'second_wind',
    'de_escalation',
  ];

  // ---- starting souls (characters) — pick one before a run ----------------
  // Each is a distinct starter deck + a signature relic + a default line style.
  // Every deck opens with a De-escalation (the Anger relief valve).
  SO.CHARACTERS = {
    gambler: {
      id: 'gambler', name: 'The Gambler', icon: '🂡', style: 'pass', signature: '',
      blurb: 'A balanced soul who plays the odds straight — a little rigging, a little stalling. The honest starting hand.',
      deck: SO.STARTER_DECK.slice(),
      relics: [],
    },
    widow: {
      id: 'widow', name: 'The Widow', icon: '🕸', style: 'dont', signature: 'leech_stone',
      blurb: "Plays the Don't line and waits for your 7 — starves you out and heals off your ruin. Signature: Leech Stone.",
      deck: ['de_escalation', 'cold_bones', 'cold_bones', 'reapers_cut', 'patience', 'tourniquet', 'tourniquet', 'nudge', 'nudge', 'pickpocket'],
      relics: ['leech_stone'],
    },
    highroller: {
      id: 'highroller', name: 'The High-Roller', icon: '💎', style: 'pass', signature: 'gamblers_talisman',
      blurb: 'Big bets, bigger swings — lives and dies on the props and hardways. Signature: Gambler’s Talisman.',
      // V.0.4.6 balance: one of the two coin-flip one-roll props became a rigger,
      // so the swings still swing but he can steer one of them.
      deck: ['de_escalation', 'boxcar_special', 'devils_markup', 'let_it_ride', 'loaded_die', 'loaded_die', 'nudge', 'nudge', 'sure_thing', 'tourniquet'],
      relics: ['gamblers_talisman'],
    },
    penitent: {
      id: 'penitent', name: 'The Penitent', icon: '✚', style: 'pass', signature: 'iron_stomach',
      blurb: 'Endures everything — bleeds slow, heals steady, refuses to die. Signature: Iron Stomach.',
      // V.0.4.6 balance: seven survival cards kept him alive without ever
      // closing — one traded for a second rigger.
      deck: ['de_escalation', 'tourniquet', 'tourniquet', 'field_medic', 'second_wind', 'nudge', 'last_rites', 'nudge', 'loaded_die', 'sure_thing'],
      relics: ['iron_stomach'],
    },
    // ---- V.0.4.0 souls — four more, one echoing each original playstyle ----
    mechanic: {
      id: 'mechanic', name: 'The Mechanic', icon: '🔧', style: 'pass', signature: 'marked_bones',
      blurb: 'A pass-line tinkerer who never trusts the dice to land honest — all rigging, all control. Signature: Marked Bones.',
      // V.0.4.6 balance: five riggers AND Marked Bones making two of them free
      // put him 22 points clear of every other soul — one rigger traded away.
      deck: ['de_escalation', 'nudge', 'nudge', 'loaded_die', 'tourniquet', 'thumb_on_scale', 'cold_sweat', 'tourniquet', 'sure_thing', 'pickpocket'],
      relics: ['marked_bones'],
    },
    mortician: {
      id: 'mortician', name: 'The Mortician', icon: '⚰️', style: 'dont', signature: 'house_edge',
      blurb: "A don't-line undertaker who bets on your ruin and helps it along — cold sevens and open wounds. Signature: The House Edge.",
      deck: ['de_escalation', 'cold_bones', 'cold_bones', 'reapers_cut', 'bleed_them_dry', 'sucker_punch', 'tourniquet', 'patience', 'nudge', 'pickpocket'],
      relics: ['house_edge'],
    },
    baron: {
      id: 'baron', name: 'The Baron', icon: '🎩', style: 'pass', signature: 'golden_tooth',
      blurb: 'A high-rolling showman who plays the props and rakes the coin — flash, hardways, and a fat wallet. Signature: Golden Tooth.',
      // V.0.4.11 rebalance: still the floor outlier (34%, spread 43pts) after the
      // bankroll→nudge swap, so his coin-flip Boxcar Special (1-in-36, pure
      // variance the bot bleeds on) also became a rigger — 5 rig cards now, level
      // with the Gambler, while field_day + the_hard_eight + windfall keep the
      // prop/economy fantasy. The remaining gap is the bot's known blind spot for
      // prop/economy identities, not a soul that can't win.
      deck: ['de_escalation', 'loaded_die', 'nudge', 'field_day', 'the_hard_eight', 'windfall', 'loaded_die', 'sure_thing', 'nudge', 'tourniquet'],
      relics: ['golden_tooth'],
    },
    sister: {
      id: 'sister', name: 'The Sister', icon: '🕊', style: 'pass', signature: 'tourniquet_ring',
      blurb: 'A field-nurse soul who simply will not bleed out — patch, stall, and outlast the House. Signature: Tourniquet Ring.',
      // V.0.4.6 balance: eight survival cards outlasted everything and closed
      // nothing — one traded for a second rigger.
      deck: ['de_escalation', 'tourniquet', 'nudge', 'stitch_up', 'field_medic', 'second_wind', 'patience', 'closing_time', 'nudge', 'loaded_die'],
      relics: ['tourniquet_ring'],
    },
  };
  SO.CHARACTER_ORDER = ['gambler', 'widow', 'highroller', 'penitent', 'mechanic', 'mortician', 'baron', 'sister'];

  // The base cards the enemy AI knows how to play (enemy decks draw ONLY from these).
  SO.AI_CARD_SET = [
    'nudge', 'loaded_die', 'cold_bones', 'reroll', 'third_bone', 'weighted_faces', 'pocket_aces',
    'sure_thing', 'let_it_ride', 'crapless', 'all_odds', 'devils_markup', 'boxcar_special',
    'sleight_of_hand', 'pickpocket', 'jinx', 'cooler', 'marked_cards',
    'tourniquet', 'second_wind', 'patience', 'reapers_cut', 'field_medic', 'last_rites',
  ];

  // ---- deck helpers ----------------------------------------------------
  SO.shuffle = function (arr, rng) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = rng.int(0, i); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  };

  // Rarity-weighted pools, built lazily AFTER all card files register.
  SO.cardPools = function () {
    if (SO._pools) return SO._pools;
    const pools = { common: [], uncommon: [], rare: [] };
    for (const id in CARDS) { const c = CARDS[id]; if (pools[c.rarity]) pools[c.rarity].push(id); }
    SO._pools = pools;
    return pools;
  };

  SO.drawCardChoices = function (rng, n, weights) {
    // reward pacing: a touch richer than a flat 55/33/12 so drafts feel worth it
    weights = weights || { common: 0.52, uncommon: 0.34, rare: 0.14 };
    const pools = SO.cardPools();
    // Milestone-locked cards drop out of the draft until they're earned. With
    // no profile (tests) SO.isUnlocked is always true, so this is a no-op.
    const open = (arr) => (SO.isUnlocked ? arr.filter((id) => SO.isUnlocked(id)) : arr);
    const P = { common: open(pools.common), uncommon: open(pools.uncommon), rare: open(pools.rare) };
    const out = [];
    let guard = 0;
    while (out.length < n && guard++ < 80) {
      const r = rng.next();
      const rarity = r < weights.common ? 'common' : r < weights.common + weights.uncommon ? 'uncommon' : 'rare';
      const pool = P[rarity].length ? P[rarity] : P.common;
      if (!pool.length) break;
      const id = rng.pick(pool);
      if (!out.includes(id)) out.push(id);
    }
    return out;
  };
})();
