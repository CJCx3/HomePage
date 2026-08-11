/* AWECRAP — cards_ext.js
 * The expansion pool: 112 new cards (the original 100 — 25 roll / 25 bet /
 * 20 interfere / 20 survival / 10 economy — plus a 12-card "Expansion II"
 * void-filler batch at the end). All effects resolve through the duel's
 * roundMods / helper vocabulary (see duel.js). Enemy decks stay on the base
 * AI_CARD_SET; this pool is the player's draft space.
 */
window.SO = window.SO || {};

(function () {
  const clampFace = (f) => Math.max(1, Math.min(6, f));
  const tot = (r) => { r.total = r.d1 + r.d2; return r; };
  const goalOf = (g, self) => (self.lineStyle === 'dont' ? 7 : g.point);
  function shiftToward(r, target) {
    for (const die of [0, 1]) {
      const other = die === 0 ? r.d2 : r.d1;
      const need = target - other;
      if (need >= 1 && need <= 6) { if (die === 0) r.d1 = need; else r.d2 = need; return tot(r); }
    }
    return tot(r);
  }
  function stealChips(g, self, opp, n) {
    const totl = opp.table.reduce((s, b) => s + b.amount, 0);
    if (totl <= 0) return 0;
    const take = Math.min(n, totl);
    let left = take;
    opp.table.sort((a, b) => b.amount - a.amount);
    for (const b of opp.table) { const d = Math.min(left, b.amount); b.amount -= d; left -= d; if (!left) break; }
    opp.table = opp.table.filter((b) => b.amount > 0);
    g.heal(self, take, 'steal');
    return take;
  }

  SO.registerCards({
    /* ============================ ROLL (25) ============================ */
    calloused_thumb: { name: 'Calloused Thumb', type: 'roll', nerve: 1, rarity: 'common', timing: 'rollwindow', tags: ['rig'],
      text: 'Set one die to 4 (whichever helps most).',
      play(g, self) { const r = g.pendingRoll; const goal = goalOf(g, self); if (Math.abs((4 + r.d2) - goal) <= Math.abs((r.d1 + 4) - goal)) r.d1 = 4; else r.d2 = 4; tot(r); } },
    split_the_bones: { name: 'Split the Bones', type: 'roll', nerve: 1, rarity: 'common', timing: 'rollwindow', tags: ['rig'],
      text: 'Even out your dice: both become half your total.',
      play(g) { const r = g.pendingRoll; const t = r.total; r.d1 = clampFace(Math.ceil(t / 2)); r.d2 = clampFace(t - r.d1); tot(r); } },
    lucky_penny: { name: 'Lucky Penny', type: 'roll', nerve: 0, rarity: 'common', timing: 'rollwindow', tags: ['rig'],
      text: 'If +1 to one die would make your number, make it so.',
      play(g, self) { const r = g.pendingRoll; if (r.total + 1 === goalOf(g, self)) { if (r.d1 < 6) r.d1++; else if (r.d2 < 6) r.d2++; tot(r); } } },
    dead_weight: { name: 'Dead Weight', type: 'roll', nerve: 0, rarity: 'common', timing: 'rollwindow', tags: ['rig'],
      text: '−1 to one die.',
      play(g, self) { const r = g.pendingRoll; if (r.d1 > 1) r.d1--; else if (r.d2 > 1) r.d2--; tot(r); } },
    mirror_dice: { name: 'Mirror Dice', type: 'roll', nerve: 1, rarity: 'uncommon', timing: 'rollwindow', tags: ['rig', 'prop'],
      text: 'Set die B equal to die A (make it hard).',
      play(g) { const r = g.pendingRoll; r.d2 = r.d1; tot(r); } },
    bones_echo: { name: "Bones' Echo", type: 'roll', nerve: 2, rarity: 'uncommon', timing: 'rollwindow', tags: ['rig'],
      text: 'Repeat your previous roll exactly.',
      play(g, self) { if (!self.prevRoll) return 'no previous roll to echo'; g.pendingRoll = { d1: self.prevRoll.d1, d2: self.prevRoll.d2, total: self.prevRoll.total }; } },
    chipped_ivory: { name: 'Chipped Ivory', type: 'roll', nerve: 1, rarity: 'common', timing: 'action', tags: ['rig', 'dont'],
      text: 'This round your dice can never roll a 6.',
      play(g, self) { self.roundMods.faceCeil = Math.min(self.roundMods.faceCeil || 6, 5); } },
    heavy_hand: { name: 'Heavy Hand', type: 'roll', nerve: 1, rarity: 'common', timing: 'action', tags: ['rig'],
      text: 'This round your dice can never roll a 1.',
      play(g, self) { self.roundMods.faceFloor = Math.max(self.roundMods.faceFloor || 1, 2); } },
    featherweight: { name: 'Featherweight', type: 'roll', nerve: 1, rarity: 'uncommon', timing: 'action', tags: ['rig', 'dont'],
      text: 'This round your dice can never roll above 4 (totals 2–8).',
      play(g, self) { self.roundMods.faceCeil = Math.min(self.roundMods.faceCeil || 6, 4); } },
    anvil_drop: { name: 'Anvil Drop', type: 'roll', nerve: 1, rarity: 'uncommon', timing: 'action', tags: ['rig'],
      text: 'This round your dice can never roll below 3 (totals 6–12).',
      play(g, self) { self.roundMods.faceFloor = Math.max(self.roundMods.faceFloor || 1, 3); } },
    bone_saw: { name: 'Bone Saw', type: 'roll', nerve: 2, rarity: 'uncommon', timing: 'rollwindow', tags: ['rig'],
      text: 'Reroll one die (the least helpful one).',
      play(g, self) { const r = g.pendingRoll; const goal = goalOf(g, self); const keep1 = Math.min(Math.abs(r.d1 + 6 - goal), Math.abs(r.d1 + 1 - goal)); const keep2 = Math.min(Math.abs(r.d2 + 6 - goal), Math.abs(r.d2 + 1 - goal)); if (keep1 <= keep2) r.d2 = g.rng.die(); else r.d1 = g.rng.die(); tot(r); } },
    cheaters_wax: { name: "Cheater's Wax", type: 'roll', nerve: 2, rarity: 'rare', timing: 'action', tags: ['rig'],
      text: 'This round your dice cannot total 7 (a 7 slides off it).',
      play(g, self) { self.roundMods.no7 = true; } },
    devils_shave: { name: "Devil's Shave", type: 'roll', nerve: 2, rarity: 'rare', timing: 'action', tags: ['rig', 'dont'],
      text: 'This round your dice cannot total the point (it slides off).',
      play(g, self) { self.roundMods.notPoint = true; } },
    twin_snakes: { name: 'Twin Snakes', type: 'roll', nerve: 1, rarity: 'common', timing: 'rollwindow', tags: ['rig', 'prop'],
      text: 'Set both dice to 1 — snake eyes.',
      play(g) { const r = g.pendingRoll; r.d1 = 1; r.d2 = 1; tot(r); } },
    boxcar_wish: { name: 'Boxcar Wish', type: 'roll', nerve: 1, rarity: 'common', timing: 'rollwindow', tags: ['rig', 'prop'],
      text: 'Set both dice to 6 — boxcars.',
      play(g) { const r = g.pendingRoll; r.d1 = 6; r.d2 = 6; tot(r); } },
    second_toss: { name: 'Second Toss', type: 'roll', nerve: 2, rarity: 'uncommon', timing: 'action', tags: ['rig'],
      text: 'This round, totals of 2, 3 or 12 are automatically rerolled once.',
      play(g, self) { self.roundMods.rerollCraps = true; } },
    knucklebones: { name: 'Knucklebones', type: 'roll', nerve: 1, rarity: 'common', timing: 'rollwindow', tags: ['rig'],
      text: 'Reroll both dice; draw a card.',
      play(g, self) { g.pendingRoll = g.rollDice(self); g.drawCards(self, 1); } },
    palm_switch: { name: 'Palm Switch', type: 'roll', nerve: 2, rarity: 'uncommon', timing: 'rollwindow', tags: ['rig'],
      text: 'Set one die toward your number; draw a card.',
      play(g, self) { shiftToward(g.pendingRoll, goalOf(g, self)); g.drawCards(self, 1); } },
    rattle: { name: 'Rattle', type: 'roll', nerve: 0, rarity: 'common', timing: 'rollwindow', tags: ['rig'],
      text: 'Move BOTH dice ±1 toward your number.',
      play(g, self) { const r = g.pendingRoll; const d = goalOf(g, self) > r.total ? 1 : -1; r.d1 = clampFace(r.d1 + d); r.d2 = clampFace(r.d2 + d); tot(r); } },
    graveyard_toss: { name: 'Graveyard Toss', type: 'roll', nerve: 2, rarity: 'uncommon', timing: 'action', tags: ['rig', 'dont'],
      text: 'This round your 11s count as 7s for your line.',
      play(g, self) { self.roundMods.elevenIs7 = true; } },
    loaded_memory: { name: 'Loaded Memory', type: 'roll', nerve: 1, rarity: 'uncommon', timing: 'action', tags: ['rig'], mag: 1,
      text: 'This round, roll an extra die and keep the best two.',
      play(g, self, o, ch, def) { self.roundMods.extraDice = (self.roundMods.extraDice || 0) + (def.mag || 1); } },
    splinters: { name: 'Splinters', type: 'roll', nerve: 0, rarity: 'common', timing: 'rollwindow', tags: ['rig', 'dont'],
      text: '−1 to both dice.',
      play(g) { const r = g.pendingRoll; r.d1 = clampFace(r.d1 - 1); r.d2 = clampFace(r.d2 - 1); tot(r); } },
    high_roller: { name: 'High Roller', type: 'roll', nerve: 0, rarity: 'common', timing: 'rollwindow', tags: ['rig'],
      text: '+1 to both dice.',
      play(g) { const r = g.pendingRoll; r.d1 = clampFace(r.d1 + 1); r.d2 = clampFace(r.d2 + 1); tot(r); } },
    gods_thumb: { name: "God's Thumb", type: 'roll', nerve: 3, rarity: 'rare', timing: 'rollwindow', tags: ['rig'], oncePerRound: true,
      text: 'Set your total to your number exactly.',
      play(g, self) { const goal = goalOf(g, self); const r = g.pendingRoll; for (let a = 1; a <= 6; a++) { const b = goal - a; if (b >= 1 && b <= 6) { r.d1 = a; r.d2 = b; break; } } tot(r); } },
    steady_wrist: { name: 'Steady Wrist', type: 'roll', nerve: 1, rarity: 'common', timing: 'action', tags: ['rig'], mag: 1,
      text: 'This round, roll an extra die and keep the best two (first roll each turn).',
      play(g, self, o, ch, def) { self.roundMods.extraDice = (self.roundMods.extraDice || 0) + (def.mag || 1); self.roundMods.extraDiceFirstOnly = true; } },

    /* ============================ BET (25) ============================ */
    down_payment: { name: 'Down Payment', type: 'bet', nerve: 0, rarity: 'common', timing: 'action', tags: ['line'], mag: 5,
      text: 'The house stakes you a free 5 HP line bet.',
      play(g, self, o, ch, def) { const type = self.lineStyle === 'dont' ? 'dontpass' : 'passline'; g.houseBet(self, { betType: type, amount: def.mag || 5 }); } },
    double_or_nothing: { name: 'Double or Nothing', type: 'bet', nerve: 2, rarity: 'uncommon', timing: 'action', tags: ['line'],
      text: 'Your line pays 2:1 this round, but you cannot take odds.',
      play(g, self) { self.roundMods.lineMult = (self.roundMods.lineMult || 1) * 2; self.roundMods.noOdds = true; } },
    insurance_slip: { name: 'Insurance Slip', type: 'bet', nerve: 1, rarity: 'common', timing: 'action', tags: ['line'], mag: 50,
      text: 'The first bet you lose this round refunds half its stake.',
      play(g, self, o, ch, def) { self.roundMods.refundNextLoss = Math.max(self.roundMods.refundNextLoss || 0, Math.min(1, (def.mag || 50) / 100)); } },
    ironclad_policy: { name: 'Ironclad Policy', type: 'bet', nerve: 2, rarity: 'uncommon', timing: 'action', tags: ['line'],
      text: 'The first bet you lose this round refunds its full stake.',
      play(g, self) { self.roundMods.refundNextLoss = 1; } },
    field_day: { name: 'Field Day', type: 'bet', nerve: 1, rarity: 'common', timing: 'action', tags: ['prop'],
      text: 'Your Field bets pay double this round.',
      play(g, self) { self.roundMods.fieldMult = (self.roundMods.fieldMult || 1) * 2; } },
    farmers_almanac: { name: "Farmer's Almanac", type: 'bet', nerve: 2, rarity: 'uncommon', timing: 'action', tags: ['prop'],
      text: 'The Field also wins on 5 this round.',
      play(g, self) { self.roundMods.fieldPlus5 = true; } },
    inside_job: { name: 'Inside Job', type: 'bet', nerve: 1, rarity: 'uncommon', timing: 'action', tags: ['prop'],
      text: 'Your Place bets pay +50% this round.',
      play(g, self) { self.roundMods.placeMult = (self.roundMods.placeMult || 1) * 1.5; } },
    corner_pocket: { name: 'Corner Pocket', type: 'bet', nerve: 1, rarity: 'common', timing: 'action', tags: ['prop'],
      text: 'Your Place bets survive a 7 this round (pushed back, not lost).',
      play(g, self) { self.roundMods.placeImmune7 = true; } },
    true_believer: { name: 'True Believer', type: 'bet', nerve: 1, rarity: 'uncommon', timing: 'action', tags: ['line'],
      text: 'Your odds bets pay +50% this round.',
      play(g, self) { self.roundMods.oddsMult = (self.roundMods.oddsMult || 1) * 1.5; } },
    max_pressure: { name: 'Max Pressure', type: 'bet', nerve: 2, rarity: 'rare', timing: 'action', tags: ['line'],
      text: 'Triple the maximum odds you can take/lay this round.',
      play(g, self) { self.roundMods.maxOddsMult = 3; } },
    hedge_fund: { name: 'Hedge Fund', type: 'bet', nerve: 2, rarity: 'uncommon', timing: 'action', tags: ['line'],
      text: 'If you bust this round, your odds bets push back instead of losing.',
      play(g, self) { self.roundMods.oddsImmuneBust = true; } },
    hot_table: { name: 'Hot Table', type: 'bet', nerve: 2, rarity: 'rare', timing: 'action', tags: ['line', 'prop'],
      text: 'ALL your payouts are +50% this round.',
      play(g, self) { const m = self.roundMods; for (const k of ['lineMult', 'oddsMult', 'placeMult', 'fieldMult', 'propMult']) m[k] = (m[k] || 1) * 1.5; } },
    petty_cash: { name: 'Petty Cash', type: 'bet', nerve: 0, rarity: 'common', timing: 'action', tags: ['prop'], mag: 3,
      text: 'The house stakes you a free 3 HP Field bet.',
      play(g, self, o, ch, def) { g.houseBet(self, { betType: 'field', amount: def.mag || 3 }); } },
    yo_eleven: { name: 'Yo Eleven!', type: 'bet', nerve: 1, rarity: 'common', timing: 'action', tags: ['prop'], mag: 5,
      text: 'Place 5 HP on Yo (11) at double payout.',
      play(g, self, o, ch, def) { const amt = Math.min(def.mag || 5, self.hp); if (amt > 0) g.placeBet(self, { betType: 'eleven', amount: amt, payMult: 2 }); } },
    snake_eyes_special: { name: 'Snake Eyes Special', type: 'bet', nerve: 1, rarity: 'common', timing: 'action', tags: ['prop'], mag: 5,
      text: 'Place 5 HP on Aces (2) — one roll at 30:1.',
      play(g, self, o, ch, def) { const amt = Math.min(def.mag || 5, self.hp); if (amt > 0) g.placeBet(self, { betType: 'aces', amount: amt }); } },
    hard_way_home: { name: 'Hard Way Home', type: 'bet', nerve: 2, rarity: 'uncommon', timing: 'action', tags: ['prop'],
      text: 'Your hardways also win the easy way this round.',
      play(g, self) { self.roundMods.hardEasyWins = true; } },
    anything_but_seven: { name: 'Anything But Seven', type: 'bet', nerve: 2, rarity: 'uncommon', timing: 'action', tags: ['heal'], mag: 2,
      text: 'Each of your rolls this round that is not a 7 heals 2.',
      play(g, self, o, ch, def) { self.roundMods.healPerNon7 = (self.roundMods.healPerNon7 || 0) + (def.mag || 2); } },
    kelly_criterion: { name: 'Kelly Criterion', type: 'bet', nerve: 1, rarity: 'uncommon', timing: 'action', tags: ['line'],
      text: 'The house doubles your smallest active bet for free.',
      play(g, self) { if (!self.table.length) return 'no bets out'; const min = self.table.reduce((m, b) => (b.amount < m.amount ? b : m)); min.amount *= 2; return `${min.betType} doubled to ${min.amount}`; } },
    table_minimum: { name: 'Table Minimum', type: 'bet', nerve: 0, rarity: 'common', timing: 'action', tags: ['stall'],
      text: 'Pulling bets costs no tax this round.',
      play(g, self) { self.roundMods.pullTaxFree = true; } },
    whales_shadow: { name: "Whale's Shadow", type: 'bet', nerve: 3, rarity: 'rare', timing: 'action', tags: ['line', 'prop'],
      text: 'The house doubles ALL your active bets for free.',
      play(g, self) { if (!self.table.length) return 'no bets out'; for (const b of self.table) b.amount *= 2; return 'every bet doubled'; } },
    rigged_payout: { name: 'Rigged Payout', type: 'bet', nerve: 1, rarity: 'uncommon', timing: 'action', tags: ['prop'],
      text: 'Your prop/hardway payouts are +50% this round.',
      play(g, self) { self.roundMods.propMult = (self.roundMods.propMult || 1) * 1.5; } },
    parlay_ticket: { name: 'Parlay Ticket', type: 'bet', nerve: 2, rarity: 'uncommon', timing: 'action', tags: ['prop'], mag: 75,
      text: 'A Place/Prop bet rides to next round at +75% payout.',
      play(g, self, o, ch, def) { self.roundMods.letItRide = 1 + (def.mag || 75) / 100; } },
    free_ride: { name: 'Free Ride', type: 'bet', nerve: 1, rarity: 'common', timing: 'action', tags: ['line', 'come'], mag: 5,
      text: 'The house stakes you a free 5 HP Come bet.',
      play(g, self, o, ch, def) { g.houseBet(self, { betType: 'come', amount: def.mag || 5, num: null }); } },
    wrong_way: { name: 'Wrong Way Bettor', type: 'bet', nerve: 1, rarity: 'common', timing: 'action', tags: ['line', 'dont'],
      text: "Your Don't Pass line pays +20% this round.",
      play(g, self) { if (self.lineStyle === 'dont') self.roundMods.lineMult = (self.roundMods.lineMult || 1) * 1.2; } },
    all_in_insurance: { name: 'All-In Insurance', type: 'bet', nerve: 3, rarity: 'rare', timing: 'action', tags: ['line'],
      text: 'If you bust this round, recover HALF of everything lost on the table.',
      play(g, self) { self.roundMods.bustRefundHalf = true; } },

    /* ========================== INTERFERE (20) ========================== */
    cold_read: { name: 'Cold Read', type: 'interfere', nerve: 0, rarity: 'common', timing: 'action', tags: ['info'],
      text: "Reveal the opponent's hand and their favored point.",
      play(g, self, opp) {
        const hand = opp.hand.map((id) => SO.getCard(id).name).join(', ') || 'nothing';
        const pts = (opp.def && opp.def.setsPoint) ? opp.def.setsPoint.join('/') : '?';
        return `they hold: ${hand} — they favor ${pts}`;
      } },
    chip_clip: { name: 'Chip Clip', type: 'interfere', nerve: 0, rarity: 'common', timing: 'action', tags: ['steal'], mag: 2, targetsOpp: true,
      text: "Take 2 HP from the opponent's chips on the table.",
      play(g, self, opp, ch, def) { const took = stealChips(g, self, opp, def.mag || 2); return took ? `clipped ${took}` : 'nothing there'; } },
    table_talk: { name: 'Table Talk', type: 'interfere', nerve: 1, rarity: 'common', timing: 'action', tags: ['deny'], targetsOpp: true,
      text: 'The opponent cannot play roll cards on their next turn.',
      play(g, self, opp) { opp.noRollCardsTurns = (opp.noRollCardsTurns || 0) + 1; } },
    crooked_croupier: { name: 'Crooked Croupier', type: 'interfere', nerve: 2, rarity: 'uncommon', timing: 'action', tags: ['deny'], targetsOpp: true,
      text: "The opponent's largest bet pays HALF this round.",
      play(g, self, opp) { if (!opp.table.length) return 'no bet to fix'; const big = opp.table.reduce((m, b) => (b.amount > m.amount ? b : m)); big.payMult = (big.payMult || 1) * 0.5; return `their ${big.betType} pays half`; } },
    dust_in_the_eyes: { name: 'Dust in the Eyes', type: 'interfere', nerve: 1, rarity: 'common', timing: 'action', tags: ['wound'], mag: 2, targetsOpp: true,
      text: "The opponent's bleed is +2 this round.",
      play(g, self, opp, ch, def) { opp.roundMods.bleedFlatDelta = (opp.roundMods.bleedFlatDelta || 0) + (def.mag || 2); } },
    rusted_rake: { name: 'Rusted Rake', type: 'interfere', nerve: 2, rarity: 'uncommon', timing: 'action', tags: ['deny'], mag: 4, targetsOpp: true,
      text: "The opponent's pulls cost +4 tax this round.",
      play(g, self, opp, ch, def) { opp.roundMods.pullTaxDelta = (opp.roundMods.pullTaxDelta || 0) + (def.mag || 4); } },
    dead_mans_grip: { name: "Dead Man's Grip", type: 'interfere', nerve: 2, rarity: 'uncommon', timing: 'action', tags: ['deny'], targetsOpp: true,
      text: "The opponent's line bet is locked (unpullable) this round.",
      play(g, self, opp) { opp.roundMods.lockLine = true; } },
    bad_whiskey: { name: 'Bad Whiskey', type: 'interfere', nerve: 1, rarity: 'uncommon', timing: 'action', tags: ['deny'], targetsOpp: true,
      text: 'The opponent draws 1 fewer card next round.',
      play(g, self, opp) { opp.nextRoundDrawDelta = (opp.nextRoundDrawDelta || 0) - 1; } },
    repo_man: { name: 'Repo Man', type: 'interfere', nerve: 3, rarity: 'rare', timing: 'action', tags: ['steal'], targetsOpp: true,
      text: "Steal the opponent's largest bet — and it pays +50% for you.",
      play(g, self, opp) { if (!opp.table.length) return 'nothing to repo'; opp.table.sort((a, b) => b.amount - a.amount); const b = opp.table.shift(); b.payMult = (b.payMult || 1) * 1.5; self.table.push(b); return `repossessed ${b.betType} (${b.amount})`; } },
    tilt: { name: 'Tilt', type: 'interfere', nerve: 1, rarity: 'common', timing: 'action', tags: ['deny'], targetsOpp: true,
      text: 'The opponent overbets next turn (double their usual stake).',
      play(g, self, opp) { opp.forceBigBet = true; } },
    cut_the_lights: { name: 'Cut the Lights', type: 'interfere', nerve: 2, rarity: 'uncommon', timing: 'action', tags: ['deny'], targetsOpp: true,
      text: 'The opponent cannot take or lay odds this round.',
      play(g, self, opp) { opp.roundMods.noOdds = true; } },
    voodoo_chip: { name: 'Voodoo Chip', type: 'interfere', nerve: 2, rarity: 'uncommon', timing: 'action', tags: ['wound'], mag: 5, targetsOpp: true,
      text: "Hex the opponent's largest bet: if it loses this round, you heal 5.",
      play(g, self, opp, ch, def) { if (!opp.table.length) return 'nothing to hex'; const big = opp.table.reduce((m, b) => (b.amount > m.amount ? b : m)); big.hexHeal = def.mag || 5; return 'the hex is set'; } },
    long_con: { name: 'Long Con', type: 'interfere', nerve: 0, rarity: 'common', timing: 'action', tags: ['deny'], targetsOpp: true,
      text: 'Next round: the opponent draws 1 fewer card, and you draw 1 more.',
      play(g, self, opp) { opp.nextRoundDrawDelta = (opp.nextRoundDrawDelta || 0) - 1; self.nextRoundDrawDelta = (self.nextRoundDrawDelta || 0) + 1; } },
    glass_jaw: { name: 'Glass Jaw', type: 'interfere', nerve: 2, rarity: 'uncommon', timing: 'action', tags: ['deny'], targetsOpp: true,
      text: "Strip the opponent's survival effects (bleed pauses, ramp freezes).",
      play(g, self, opp) { opp.tourniquetTurns = 0; delete opp.roundMods.bleedRampZero; delete opp.roundMods.bleedCap; delete opp.roundMods.bleedImmune; } },
    pit_viper: { name: 'Pit Viper', type: 'interfere', nerve: 1, rarity: 'uncommon', timing: 'action', tags: ['deny'], targetsOpp: true,
      text: 'Force the opponent to reroll their next roll, whatever it is.',
      play(g, self, opp) { opp.rerollNext = true; } },
    grifters_smile: { name: "Grifter's Smile", type: 'interfere', nerve: 1, rarity: 'common', timing: 'action', tags: ['deny'], targetsOpp: true,
      text: 'The opponent has 1 less Nerve next turn; you gain 1 next turn.',
      play(g, self, opp) { opp.nextTurnNerveDelta = (opp.nextTurnNerveDelta || 0) - 1; self.nextTurnNerveDelta = (self.nextTurnNerveDelta || 0) + 1; } },
    blacklist: { name: 'Blacklist', type: 'interfere', nerve: 3, rarity: 'rare', timing: 'action', tags: ['deny'],
      text: 'You set the point next round, and the opponent cannot interfere next round.',
      play(g, self, opp) { g.coolerSetter = self; opp.nextRoundNoInterfere = true; } },
    sandbag: { name: 'Sandbag', type: 'interfere', nerve: 1, rarity: 'common', timing: 'action', tags: ['wound'], mag: 1, targetsOpp: true,
      text: "The opponent's bleed ramps +1 faster this round.",
      play(g, self, opp, ch, def) { opp.roundMods.bleedRampDelta = (opp.roundMods.bleedRampDelta || 0) + (def.mag || 1); } },
    debt_collector: { name: 'Debt Collector', type: 'interfere', nerve: 2, rarity: 'rare', timing: 'action', tags: ['wound'], mag: 4, targetsOpp: true,
      text: 'Collect 4 HP directly from the opponent.',
      play(g, self, opp, ch, def) { g.damage(opp, def.mag || 4, 'collect'); g.heal(self, Math.ceil((def.mag || 4) / 2), 'steal'); } },
    marked_chips: { name: 'Marked Chips', type: 'interfere', nerve: 0, rarity: 'common', timing: 'action', tags: ['deny'], mag: 2, targetsOpp: true,
      text: 'Whenever the opponent pulls a bet this round, you heal 2.',
      play(g, self, opp, ch, def) { opp.roundMods.oppHealOnPull = (def.mag || 2); } },

    /* ========================== SURVIVAL (20) ========================== */
    stiff_drink: { name: 'Stiff Drink', type: 'survival', nerve: 0, rarity: 'common', timing: 'action', tags: ['heal'], mag: 3,
      text: 'Heal 3.', play(g, self, o, ch, def) { g.heal(self, def.mag || 3, 'win'); } },
    field_dressing: { name: 'Field Dressing', type: 'survival', nerve: 1, rarity: 'common', timing: 'action', tags: ['heal'], mag: 6,
      text: 'Heal 6.', play(g, self, o, ch, def) { g.heal(self, def.mag || 6, 'win'); } },
    transfusion: { name: 'Transfusion', type: 'survival', nerve: 2, rarity: 'uncommon', timing: 'action', tags: ['heal'], mag: 12,
      text: 'Heal 12, but your bleed is +1 this round.',
      play(g, self, o, ch, def) { g.heal(self, def.mag || 12, 'win'); self.roundMods.bleedFlatDelta = (self.roundMods.bleedFlatDelta || 0) + 1; } },
    scar_tissue: { name: 'Scar Tissue', type: 'survival', nerve: 1, rarity: 'uncommon', timing: 'action', tags: ['stall'], mag: 1,
      text: 'Your base bleed is −1 for the rest of this duel (stacks).',
      play(g, self, o, ch, def) { self.scarTissue = (self.scarTissue || 0) + (def.mag || 1); } },
    cauterize: { name: 'Cauterize', type: 'survival', nerve: 2, rarity: 'uncommon', timing: 'action', tags: ['stall'], mag: 3,
      text: 'Pause your bleed for your next 3 turns.',
      play(g, self, o, ch, def) { self.tourniquetTurns = Math.max(self.tourniquetTurns || 0, def.mag || 3); } },
    adrenaline: { name: 'Adrenaline', type: 'survival', nerve: 0, rarity: 'common', timing: 'action', tags: ['tempo'], mag: 1,
      text: '+1 Nerve this turn.', play(g, self, o, ch, def) { self.nerve += (def.mag || 1); } },
    deep_breath: { name: 'Deep Breath', type: 'survival', nerve: 1, rarity: 'common', timing: 'action', tags: ['tempo'], mag: 2,
      text: '+2 Nerve next turn.', play(g, self, o, ch, def) { self.nextTurnNerveDelta = (self.nextTurnNerveDelta || 0) + (def.mag || 2); } },
    bandage_roll: { name: 'Bandage Roll', type: 'survival', nerve: 1, rarity: 'common', timing: 'action', tags: ['tempo'], mag: 2,
      text: 'Draw 2 cards.', play(g, self, o, ch, def) { g.drawCards(self, def.mag || 2); } },
    war_chest: { name: 'War Chest', type: 'survival', nerve: 2, rarity: 'uncommon', timing: 'action', tags: ['heal'], mag: 2,
      text: 'Heal 2 for each of your active bets.',
      play(g, self, o, ch, def) { g.heal(self, (def.mag || 2) * self.table.length, 'win'); } },
    grave_insurance: { name: 'Grave Insurance', type: 'survival', nerve: 2, rarity: 'uncommon', timing: 'action', tags: ['stall'], mag: 8,
      text: 'If you bust this round, heal 8 afterward.',
      play(g, self, o, ch, def) { self.roundMods.healOnSelfBust = (self.roundMods.healOnSelfBust || 0) + (def.mag || 8); } },
    clot: { name: 'Clot', type: 'survival', nerve: 1, rarity: 'common', timing: 'action', tags: ['stall'], mag: 4,
      text: 'Your bleed cannot exceed 4 this round.',
      play(g, self, o, ch, def) { self.roundMods.bleedCap = Math.min(self.roundMods.bleedCap || 99, def.mag || 4); } },
    numb: { name: 'Numb', type: 'survival', nerve: 2, rarity: 'uncommon', timing: 'action', tags: ['stall'],
      text: 'Take no bleed at all this round.',
      play(g, self) { self.roundMods.bleedImmune = true; } },
    leech_jar: { name: 'Leech Jar', type: 'survival', nerve: 1, rarity: 'uncommon', timing: 'action', tags: ['dont'], mag: 5,
      text: 'When the opponent busts this round, heal 5.',
      play(g, self, o, ch, def) { self.roundMods.healOnOppBust = (self.roundMods.healOnOppBust || 0) + (def.mag || 5); } },
    misers_prayer: { name: "Miser's Prayer", type: 'survival', nerve: 1, rarity: 'common', timing: 'action', tags: ['heal'], mag: 6,
      text: 'Heal 1 for every 10 HP you are missing (max 6).',
      play(g, self, o, ch, def) { const missing = self.maxHp - self.hp; g.heal(self, Math.min(def.mag || 6, Math.floor(missing / 10)), 'win'); } },
    phoenix_ash: { name: 'Phoenix Ash', type: 'survival', nerve: 3, rarity: 'rare', timing: 'action', tags: ['stall'], mag: 5,
      text: 'Once per duel: when you would die, survive at 5 HP instead.',
      play(g, self, o, ch, def) { self.phoenixCard = Math.max(self.phoenixCard || 0, def.mag || 5); } },
    sober_up: { name: 'Sober Up', type: 'survival', nerve: 1, rarity: 'uncommon', timing: 'action', tags: ['tempo'],
      text: 'Exhaust a curse from your hand for the rest of this duel.',
      play(g, self) { const i = self.hand.findIndex((id) => { const d = SO.getCard(id); return d && d.type === 'curse'; }); if (i < 0) return 'no curse in hand'; const id = self.hand.splice(i, 1)[0]; self.exhausted.push(id); return `${SO.getCard(id).name} exhausted`; } },
    iron_liver: { name: 'Iron Liver', type: 'survival', nerve: 2, rarity: 'uncommon', timing: 'action', tags: ['stall'],
      text: 'Bad Beat curses do not reduce your max HP this duel.',
      play(g, self) { self.badBeatImmune = true; } },
    guardian_angel: { name: 'Guardian Angel', type: 'survival', nerve: 2, rarity: 'rare', timing: 'action', tags: ['stall'],
      text: 'The first bleed you would take each round of this duel is prevented.',
      play(g, self) { self.bleedFirstFree = true; } },
    second_skin: { name: 'Second Skin', type: 'survival', nerve: 1, rarity: 'common', timing: 'action', tags: ['heal'], mag: 1,
      text: 'Heal 1 whenever you place a bet this round.',
      play(g, self, o, ch, def) { self.roundMods.healPerBet = (self.roundMods.healPerBet || 0) + (def.mag || 1); } },
    last_call: { name: 'Last Call', type: 'survival', nerve: 1, rarity: 'common', timing: 'action', tags: ['heal', 'stall'], mag: 4,
      text: 'Heal 4 and pause your bleed for 1 turn.',
      play(g, self, o, ch, def) { g.heal(self, def.mag || 4, 'win'); self.tourniquetTurns = Math.max(self.tourniquetTurns || 0, 1); } },

    /* ========================== ECONOMY (10) ========================== */
    pawn_watch: { name: 'Pawn Watch', type: 'economy', nerve: 0, rarity: 'common', timing: 'action', tags: ['coins'], mag: 4,
      text: '+4 coins.', play(g, self, o, ch, def) { g.earnCoins(def.mag || 4); } },
    shakedown: { name: 'Shakedown', type: 'economy', nerve: 1, rarity: 'common', timing: 'action', tags: ['coins'], mag: 8,
      text: '+8 coins.', play(g, self, o, ch, def) { g.earnCoins(def.mag || 8); } },
    loaded_ledger: { name: 'Loaded Ledger', type: 'economy', nerve: 1, rarity: 'uncommon', timing: 'action', tags: ['coins'], mag: 5,
      text: '+5 coins every round you win for the rest of this duel.',
      play(g, self, o, ch, def) { self.coinsOnRoundWin = (self.coinsOnRoundWin || 0) + (def.mag || 5); } },
    casino_scrip: { name: 'Casino Scrip', type: 'economy', nerve: 0, rarity: 'common', timing: 'action', tags: ['coins', 'tempo'], mag: 3,
      text: '+3 coins; draw a card.', play(g, self, o, ch, def) { g.earnCoins(def.mag || 3); g.drawCards(self, 1); } },
    money_clip: { name: 'Money Clip', type: 'economy', nerve: 2, rarity: 'uncommon', timing: 'action', tags: ['heal', 'coins'], mag: 10,
      text: 'Convert up to 10 coins into that much HP.',
      play(g, self, o, ch, def) { const n = Math.min(def.mag || 10, g.coinsAvailable()); if (n <= 0) return 'no coins'; g.earnCoins(-n); g.heal(self, n, 'win'); return `${n} coins → ${n} HP`; } },
    blood_money: { name: 'Blood Money', type: 'economy', nerve: 1, rarity: 'uncommon', timing: 'action', tags: ['coins'], mag: 12,
      text: 'Pay 8 HP; gain 12 coins.',
      play(g, self, o, ch, def) { if (self.hp <= 8) return 'too weak to sell'; g.damage(self, 8, 'bet'); g.earnCoins(def.mag || 12); } },
    pot_sweetener: { name: 'Sweetener', type: 'economy', nerve: 1, rarity: 'common', timing: 'action', tags: ['line'], mag: 4,
      text: 'The house sweetens your largest active bet by 4 HP — free.',
      play(g, self, o, ch, def) { if (!self.table.length) return 'no bet to sweeten'; const big = self.table.reduce((m, b) => (b.amount > m.amount ? b : m)); big.amount += (def.mag || 4); return `${big.betType} sweetened to ${big.amount}`; } },
    rake_back: { name: 'Rake Back', type: 'economy', nerve: 2, rarity: 'uncommon', timing: 'action', tags: ['heal', 'coins'], mag: 4,
      text: 'The house owes you: heal 4 and take 2 coins.',
      play(g, self, o, ch, def) { g.heal(self, def.mag || 4, 'win'); g.earnCoins(2); } },
    skim: { name: 'Skim', type: 'economy', nerve: 1, rarity: 'common', timing: 'action', tags: ['coins'], mag: 2,
      text: '+2 coins at the start of every round for the rest of this duel.',
      play(g, self, o, ch, def) { self.coinsPerRound = (self.coinsPerRound || 0) + (def.mag || 2); } },
    golden_horseshoe: { name: 'Golden Horseshoe', type: 'economy', nerve: 3, rarity: 'rare', timing: 'action', tags: ['heal', 'coins', 'tempo'], mag: 4,
      text: '+1 Nerve, draw 2, heal 4, +4 coins.',
      play(g, self, o, ch, def) { self.nerve += 1; g.drawCards(self, 2); g.heal(self, def.mag || 4, 'win'); g.earnCoins(def.mag || 4); } },

    /* ===================== EXPANSION II — void-fillers (12) =====================
     * Added to plug gaps found in a full catalog audit: low-cost aggro, a
     * "largest-bet" press (kelly hits smallest, whale hits all), economy that
     * scales with your board, a Last-Call payoff, and more tempo/draw. Every
     * effect reuses vocabulary the duel engine already consumes. */

    // ROLL — a flexible mid-strength nudge between Nudge(±1) and God's Thumb(exact)
    thumb_on_scale: { name: 'Thumb on the Scale', type: 'roll', nerve: 1, rarity: 'uncommon', timing: 'rollwindow', tags: ['rig'],
      text: 'Nudge your total up to ±2 toward your number.',
      play(g, self) { const r = g.pendingRoll; let d = Math.max(-2, Math.min(2, goalOf(g, self) - r.total));
        while (d > 0) { if (r.d1 < 6) r.d1++; else if (r.d2 < 6) r.d2++; else break; d--; }
        while (d < 0) { if (r.d1 > 1) r.d1--; else if (r.d2 > 1) r.d2--; else break; d++; }
        tot(r); } },

    // BET — press the LARGEST bet (Kelly presses the smallest, Whale presses all)
    press_the_bet: { name: 'Press the Bet', type: 'bet', nerve: 1, rarity: 'common', timing: 'action', tags: ['line', 'prop'],
      text: 'Double your largest active bet, free.',
      play(g, self) { if (!self.table.length) return 'no bet to press'; const big = self.table.reduce((m, b) => (b.amount > m.amount ? b : m)); big.amount *= 2; return `${big.betType} pressed to ${big.amount}`; } },
    all_or_nothing: { name: 'All or Nothing', type: 'bet', nerve: 2, rarity: 'rare', timing: 'action', tags: ['line', 'prop'],
      text: 'ALL your payouts double this round — but your bleed ramps +2.',
      play(g, self) { const m = self.roundMods; for (const k of ['lineMult', 'oddsMult', 'placeMult', 'fieldMult', 'propMult']) m[k] = (m[k] || 1) * 2; m.bleedRampDelta = (m.bleedRampDelta || 0) + 2; } },

    // INTERFERE — cheap direct aggro, a heavier wound, and a partial skim
    sucker_punch: { name: 'Sucker Punch', type: 'interfere', nerve: 1, rarity: 'common', timing: 'action', tags: ['wound'], mag: 3,
      text: 'Deal 3 damage — or 5 if the opponent has no chips on the table.',
      play(g, self, opp, ch, def) { const dmg = (def.mag || 3) + (opp.table.length ? 0 : 2); g.damage(opp, dmg, 'collect'); return `${dmg} damage`; } },
    bleed_them_dry: { name: 'Bleed Them Dry', type: 'interfere', nerve: 2, rarity: 'uncommon', timing: 'action', tags: ['wound'], mag: 4, targetsOpp: true,
      text: "The opponent's bleed is +4 this round.",
      play(g, self, opp, ch, def) { opp.roundMods.bleedFlatDelta = (opp.roundMods.bleedFlatDelta || 0) + (def.mag || 4); } },
    even_the_odds: { name: 'Even the Odds', type: 'interfere', nerve: 1, rarity: 'common', timing: 'action', tags: ['steal'], targetsOpp: true,
      text: "Skim half the HP off the opponent's largest bet — you heal it.",
      play(g, self, opp) { if (!opp.table.length) return 'nothing to skim'; const big = opp.table.reduce((m, b) => (b.amount > m.amount ? b : m)); const take = Math.ceil(big.amount / 2); big.amount -= take; opp.table = opp.table.filter((b) => b.amount > 0); g.heal(self, take, 'steal'); return `skimmed ${take}`; } },

    // SURVIVAL — heal+stall, a Last-Call payoff, and tempo/draw
    stitch_up: { name: 'Stitch Up', type: 'survival', nerve: 1, rarity: 'uncommon', timing: 'action', tags: ['heal', 'stall'], mag: 5,
      text: 'Heal 5 and pause your bleed for your next 2 turns.',
      play(g, self, o, ch, def) { g.heal(self, def.mag || 5, 'win'); self.tourniquetTurns = Math.max(self.tourniquetTurns || 0, 2); } },
    closing_time: { name: 'Closing Time', type: 'survival', nerve: 2, rarity: 'rare', timing: 'action', tags: ['heal'], mag: 10,
      text: 'Heal 10 if it is Last Call — otherwise heal 3.',
      play(g, self, o, ch, def) { const on = !!g.lastCall; g.heal(self, on ? (def.mag || 10) : 3, 'win'); return on ? 'the wound answers' : 'not yet'; } },
    fresh_hand: { name: 'Fresh Hand', type: 'survival', nerve: 2, rarity: 'uncommon', timing: 'action', tags: ['tempo'], mag: 3,
      text: 'Draw 3 cards.', play(g, self, o, ch, def) { g.drawCards(self, def.mag || 3); } },
    cold_sweat: { name: 'Cold Sweat', type: 'survival', nerve: 1, rarity: 'common', timing: 'action', tags: ['tempo'], mag: 2,
      text: '+2 Nerve this turn; draw a card.', play(g, self, o, ch, def) { self.nerve += (def.mag || 2); g.drawCards(self, 1); } },

    // ECONOMY — coins that scale with your board, and coin→cards
    windfall: { name: 'Windfall', type: 'economy', nerve: 2, rarity: 'uncommon', timing: 'action', tags: ['coins'], mag: 3,
      text: '+3 coins for each of your active bets.',
      play(g, self, o, ch, def) { const n = (def.mag || 3) * self.table.length; if (n <= 0) return 'no bets to cash'; g.earnCoins(n); return `+${n} coins`; } },
    bankroll: { name: 'Bankroll', type: 'economy', nerve: 1, rarity: 'uncommon', timing: 'action', tags: ['coins', 'tempo'], mag: 2,
      text: 'Spend 5 coins to draw 2 cards.',
      play(g, self, o, ch, def) { if (g.coinsAvailable() < 5) return 'not enough coin'; g.earnCoins(-5); g.drawCards(self, def.mag || 2); return 'cards bought'; } },

    /* ===================== Expansion III — the rest of the board =====================
     * Come / Don't-Come and the number boxes were fully implemented in craps.js
     * and clickable on the felt, but nothing in the deck ever cared about them.
     * These give the travelling bets and the prop table a reason to exist.
     * `comeMult` / `comeImmune7` are read in craps.js resolveBet via duel._betMods.
     */
    come_along: { name: 'Come Along', type: 'bet', nerve: 1, rarity: 'common', timing: 'action', tags: ['come'], mag: 5,
      text: 'Place a 5 HP Come bet that pays double.',
      play(g, self, o, ch, def) {
        const amt = Math.min(def.mag || 5, self.hp);
        if (amt <= 0) return 'no chips to travel';
        g.placeBet(self, { betType: 'come', amount: amt, num: null, payMult: 2 });
        return `${amt} down the road`;
      } },
    no_entry: { name: 'No Entry', type: 'bet', nerve: 1, rarity: 'common', timing: 'action', tags: ['come', 'dont'], mag: 5,
      text: 'Place a 5 HP Don’t-Come bet that pays double.',
      play(g, self, o, ch, def) {
        const amt = Math.min(def.mag || 5, self.hp);
        if (amt <= 0) return 'no chips to travel';
        g.placeBet(self, { betType: 'dontcome', amount: amt, num: null, payMult: 2 });
        return `${amt} against the road`;
      } },
    traffic: { name: 'Traffic', type: 'bet', nerve: 1, rarity: 'uncommon', timing: 'action', tags: ['come'], mag: 4,
      text: 'Place two 4 HP Come bets.',
      play(g, self, o, ch, def) {
        const each = def.mag || 4;
        if (self.hp < each) return 'no chips to travel';
        let n = 0;
        for (let i = 0; i < 2 && self.hp >= each; i++) { g.placeBet(self, { betType: 'come', amount: each, num: null }); n++; }
        return `${n} on the road`;
      } },
    right_behind_you: { name: 'Right Behind You', type: 'bet', nerve: 1, rarity: 'uncommon', timing: 'action', tags: ['come'],
      text: 'Place a Come bet matching your line bet.',
      play(g, self) {
        const line = g._lineBet(self);
        if (!line) return 'no line to follow';
        const amt = Math.min(line.amount, self.hp);
        if (amt <= 0) return 'no chips to travel';
        g.placeBet(self, { betType: self.lineStyle === 'dont' ? 'dontcome' : 'come', amount: amt, num: null });
        return `${amt} behind the line`;
      } },
    the_long_way: { name: 'The Long Way', type: 'bet', nerve: 2, rarity: 'uncommon', timing: 'action', tags: ['come'],
      text: 'Your Come and Don’t-Come bets pay DOUBLE this round.',
      play(g, self) { self.roundMods.comeMult = (self.roundMods.comeMult || 1) * 2; } },
    safe_passage: { name: 'Safe Passage', type: 'bet', nerve: 2, rarity: 'rare', timing: 'action', tags: ['come', 'stall'],
      text: 'Your travelling Come bets survive the seven this round.',
      play(g, self) { self.roundMods.comeImmune7 = true; } },
    inside_numbers: { name: 'Inside Numbers', type: 'bet', nerve: 2, rarity: 'uncommon', timing: 'action', tags: ['place'], mag: 3,
      text: 'Place 3 HP on the 6 and the 8.',
      play(g, self, o, ch, def) {
        const each = def.mag || 3;
        if (self.hp < each * 2) return 'not enough to cover both';
        g.placeBet(self, { betType: 'place', amount: each, num: 6 });
        g.placeBet(self, { betType: 'place', amount: each, num: 8 });
        return 'six and eight covered';
      } },
    horn_high: { name: 'Horn High', type: 'bet', nerve: 1, rarity: 'common', timing: 'action', tags: ['prop'], mag: 2,
      text: 'Place 2 HP each on Aces, Yo and Boxcars.',
      play(g, self, o, ch, def) {
        const each = def.mag || 2;
        if (self.hp < each * 3) return 'not enough for the horn';
        ['aces', 'eleven', 'boxcars'].forEach((t) => g.placeBet(self, { betType: t, amount: each }));
        return 'the horn is up';
      } },
    the_hard_eight: { name: 'The Hard Eight', type: 'bet', nerve: 1, rarity: 'uncommon', timing: 'action', tags: ['prop'], mag: 4,
      text: 'Place 4 HP on Hard 8 — and hardways pay +50% this round.',
      play(g, self, o, ch, def) {
        const amt = Math.min(def.mag || 4, self.hp);
        if (amt <= 0) return 'no chips';
        g.placeBet(self, { betType: 'hard', amount: amt, num: 8 });
        self.roundMods.propMult = (self.roundMods.propMult || 1) * 1.5;
        return 'eight the hard way';
      } },
    clear_the_layout: { name: 'Clear the Layout', type: 'interfere', nerve: 1, rarity: 'uncommon', timing: 'action', tags: ['steal'], targetsOpp: true,
      text: 'Sweep the opponent’s prop, field and hardway bets — they get nothing back.',
      play(g, self, opp) {
        const junk = ['field', 'hard', 'any7', 'eleven', 'aces', 'boxcars', 'anycraps'];
        const hit = opp.table.filter((b) => junk.includes(b.betType));
        if (!hit.length) return 'nothing to sweep';
        const total = hit.reduce((s, b) => s + b.amount, 0);
        opp.table = opp.table.filter((b) => !junk.includes(b.betType));
        return `swept ${hit.length} bet${hit.length > 1 ? 's' : ''} (${total})`;
      } },

    /* ===================== Curse synergy (V.0.4.10) =====================
     * Cards that WANT a cursed deck — they scale off `g.curseCount(self)` (curses
     * across all your piles) or burn a curse from hand for a payoff. Dead weight
     * for a clean deck; a real build with Cursed Hand or the curse events. */
    bad_penny: { name: 'Bad Penny', type: 'economy', nerve: 1, rarity: 'uncommon', timing: 'action', tags: ['coins', 'curse'],
      text: '+4 coins for each curse in your deck.',
      play(g, self) { const n = g.curseCount(self); if (n <= 0) return 'no curses to cash'; g.earnCoins(4 * n); return `+${4 * n} coins`; } },
    spite: { name: 'Spite', type: 'interfere', nerve: 1, rarity: 'uncommon', timing: 'action', tags: ['wound', 'curse'],
      text: 'Deal 2 damage for each curse in your deck.',
      play(g, self, opp) { const n = g.curseCount(self); if (n <= 0) return 'no curses to spend'; const dmg = 2 * n; g.damage(opp, dmg, 'collect'); return `${dmg} damage`; } },
    ballast: { name: 'Ballast', type: 'bet', nerve: 0, rarity: 'common', timing: 'action', tags: ['tempo', 'curse'],
      text: '+1 Nerve this turn for each curse in your deck.',
      play(g, self) { const n = g.curseCount(self); if (n <= 0) return 'no curses to burn'; self.nerve += n; return `+${n} Nerve`; } },
    scapegoat: { name: 'Scapegoat', type: 'survival', nerve: 1, rarity: 'uncommon', timing: 'action', tags: ['heal', 'curse'], mag: 8,
      text: 'Exhaust a curse from your hand: heal 8 and draw a card.',
      play(g, self, o, ch, def) { if (!g.exhaustCurse(self)) return 'no curse in hand'; g.heal(self, def.mag || 8, 'win'); g.drawCards(self, 1); return 'a curse pays its due'; } },
    gallows_humor: { name: 'Gallows Humor', type: 'bet', nerve: 2, rarity: 'rare', timing: 'action', tags: ['line', 'prop', 'curse'],
      text: 'Your line and prop payouts +50% per curse in your deck (max +150%).',
      play(g, self) { const n = Math.min(3, g.curseCount(self)); if (n <= 0) return 'no curses to laugh at'; const m = 1 + 0.5 * n; self.roundMods.lineMult = (self.roundMods.lineMult || 1) * m; self.roundMods.propMult = (self.roundMods.propMult || 1) * m; return `payouts ×${m.toFixed(1)}`; } },
  });
})();
