/* AWECRAP — ai.js
 * Archetype AI (§8). Plays readably, not optimally. Enemy decks draw only from
 * the base AI_CARD_SET, so scoring covers exactly those cards.
 */
window.SO = window.SO || {};

(function () {
  const pause = (g, ms) => g._h('delay', ms) || Promise.resolve();
  const lineOf = (g, cur, roll) => SO.craps.lineOutcome(roll.total, g.point, cur.lineStyle, { crapless: cur.roundMods.crapless, elevenIs7: cur.roundMods.elevenIs7 });

  function oppExposed(g, cur) {
    const opp = cur === g.player ? g.opponent : g.player;
    return opp.table.reduce((s, b) => s + b.amount, 0) > 0;
  }

  const AI = {
    choosePoint(g, setter) {
      const def = setter.def, rng = g.rng;
      if (def.archetype === 'boss' && def.alwaysSetsPoint) {
        const ph = def.phases[g.bossPhaseIdx];
        if (ph.stopsBadPoints) return rng.pick(SO.CONFIG.LEGAL_POINTS);
        const playerPass = g.player.lineStyle !== 'dont';
        return rng.pick(playerPass ? [4, 10] : [6, 8]);
      }
      return rng.pick(def.setsPoint || SO.CONFIG.LEGAL_POINTS);
    },

    async actionPhase(g, cur) {
      await pause(g, 650);
      cur.lineStyle = cur.def.style === 'dont' ? 'dont' : (cur.def.style === 'adaptive' ? 'pass' : cur.def.style);
      const aggro = (cur.def.interfere || 0) * (g.diff ? g.diff.interfereMult || 1 : 1);
      const wantInterfere = oppExposed(g, cur) && g.rng.next() < Math.min(0.95, aggro);

      let guard = 0;
      while (guard++ < 12) {
        const idx = this._pickActionCard(g, cur, wantInterfere);
        if (idx < 0) break;
        g._applyCard(cur, idx);
        await g._h('render', g); await pause(g, 520);
      }

      this._placeFavoredBet(g, cur);
      await g._h('render', g); await pause(g, 550);
    },

    _pickActionCard(g, cur, wantInterfere) {
      let best = -1, bestScore = 0;
      for (let i = 0; i < cur.hand.length; i++) {
        const id = cur.hand[i]; const def = SO.getCard(id);
        if (!def || def.timing !== 'action') continue;
        if (g._cardCost(cur, id) > cur.nerve) continue;
        const s = this._scoreAction(g, cur, SO.baseId(id), wantInterfere);
        if (s > bestScore) { bestScore = s; best = i; }
      }
      return best;
    },

    _scoreAction(g, cur, id, wantInterfere) {
      const a = cur.def.archetype;
      const interfereOK = wantInterfere ? 1 : 0;
      switch (id) {
        case 'sure_thing': return (a === 'point' || a === 'boss') ? 6 : 0;
        case 'boxcar_special': return a === 'prop' ? 7 : 1;
        case 'devils_markup': return a === 'prop' ? 6 : 0;
        case 'let_it_ride': return a === 'prop' ? 4 : 0;
        case 'third_bone': return 4;
        case 'weighted_faces': return cur.lineStyle === 'pass' && g.point >= 6 ? 3 : 0;
        case 'crapless': return cur.lineStyle === 'pass' ? 2 : 0;
        case 'all_odds': return (a === 'attrition' || a === 'control' || a === 'boss') && !cur.roundMods.noOdds ? 3 : 1;
        case 'patience': return (a === 'control' || a === 'attrition' || a === 'boss') ? 5 : 1;
        case 'reapers_cut': return (a === 'attrition' || a === 'control' || a === 'boss') ? 4 : 2;
        case 'field_medic': return 3;
        case 'tourniquet': return cur.hp < (cur.def.betSize || 5) ? 6 : 0;
        case 'sleight_of_hand': return interfereOK * 7;
        case 'cooler': return interfereOK * 6;
        case 'jinx': return interfereOK * 5;
        case 'pickpocket': return interfereOK * 4;
        case 'last_rites': return cur.hp < cur.maxHp * 0.4 ? 5 : 1;
        default: return 0;
      }
    },

    _placeFavoredBet(g, cur) {
      const a = cur.def.archetype;
      const lineType = cur.lineStyle === 'dont' ? 'dontpass' : 'passline';
      // Normally: don't re-bet while anything of ours is still riding. A 'come'
      // bettor is the exception — its travelling bets stay on the felt for
      // rounds, so the plain guard would starve it after the first bet. It
      // re-bets whenever its LINE is empty instead.
      const busy = a === 'come'
        ? cur.table.some((b) => b.betType === lineType)
        : cur.table.reduce((s, b) => s + b.amount, 0) > 0;
      if (busy) return;
      let size = Math.min(cur.def.betSize || 5, cur.hp);
      if (cur.forceBigBet) { size = Math.min(size * 2, cur.hp); cur.forceBigBet = false; }
      if (size <= 0) return;
      if (a === 'prop') {
        if ([4, 6, 8, 10].includes(g.point)) g.placeBet(cur, { betType: 'hard', amount: size, num: g.point });
        else g.placeBet(cur, { betType: 'field', amount: size });
        return;
      }
      // Split the stake between the line and a fresh bet down the road.
      if (a === 'come') {
        const half = Math.max(1, Math.floor(size / 2));
        g.placeBet(cur, { betType: lineType, amount: Math.min(half, cur.hp) });
        const travel = Math.min(half, cur.hp);
        if (travel > 0) g.placeBet(cur, { betType: cur.lineStyle === 'dont' ? 'dontcome' : 'come', amount: travel, num: null });
        return;
      }
      const type = lineType;
      g.placeBet(cur, { betType: type, amount: size });
      if (cur.hp >= size && !cur.roundMods.noOdds && (a === 'attrition' || a === 'control' || a === 'point' || a === 'boss')) {
        const oType = cur.lineStyle === 'dont' ? 'dontodds' : 'passodds';
        const odds = Math.min(size, cur.hp, g.maxOdds(cur));
        if (odds > 0) g.placeBet(cur, { betType: oType, amount: odds });
      }
    },

    async rollWindow(g, cur) {
      if (cur.roundMods.noRollCardsThisTurn) return;
      let guard = 0;
      while (guard++ < 5) {
        const roll = g.pendingRoll;
        const line = lineOf(g, cur, roll);
        if (line === 'make') break;
        const pick = this._pickRollCard(g, cur, roll, line);
        if (pick < 0) break;
        const id = cur.hand[pick]; const def = SO.getCard(id);
        const opp = cur === g.player ? g.opponent : g.player;
        g._applyCard(cur, pick, def.aiChoose ? def.aiChoose(g, cur, opp) : {});
        await g._h('diceUpdated', g, cur, g.pendingRoll); await pause(g, 480);
      }
    },

    _pickRollCard(g, cur, roll, line) {
      const goal = cur.lineStyle === 'dont' ? 7 : g.point;
      let best = -1, bestScore = 0;
      for (let i = 0; i < cur.hand.length; i++) {
        const id = cur.hand[i]; const def = SO.getCard(id);
        if (!def || def.timing !== 'rollwindow') continue;
        if (g._cardCost(cur, id) > cur.nerve) continue;
        const predicted = this._predict(g, cur, SO.baseId(id), roll, goal);
        let score = 0;
        if (predicted === 'make') score = 10 - def.nerve;
        else if (line === 'bust' && SO.baseId(id) === 'reroll') score = 4;
        else if (line === 'bust' && predicted === 'neutral') score = 6 - def.nerve;
        if (score > bestScore) { bestScore = score; best = i; }
      }
      return best;
    },

    _predict(g, cur, id, roll, goal) {
      const test = (t) => SO.craps.lineOutcome(t, g.point, cur.lineStyle, { crapless: cur.roundMods.crapless, elevenIs7: cur.roundMods.elevenIs7 });
      if (id === 'cold_bones') return test(7);
      if (id === 'pocket_aces' || id === 'loaded_die' || id === 'nudge') {
        const def = SO.getCard(id);
        const ch = def.aiChoose(g, cur, cur === g.player ? g.opponent : g.player);
        let t;
        if (id === 'pocket_aces') t = ch.f0 + ch.f1;
        else if (id === 'loaded_die') t = ch.die === 0 ? ch.face + roll.d2 : roll.d1 + ch.face;
        else t = ch.die === 0 ? (roll.d1 + ch.delta) + roll.d2 : roll.d1 + (roll.d2 + ch.delta);
        return test(t);
      }
      return 'unknown';
    },
  };

  SO.AI = AI;
})();
