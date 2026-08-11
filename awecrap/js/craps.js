/* AWECRAP — craps.js
 * The pure dice/bet resolution module (§13.4). No DOM, no RNG, no state.
 * Knows the full craps betting menu (line, odds, come/don't come, place,
 * field, hardways, one-roll props) plus the don't-pass polarity.
 * Unit-tested in tests/craps.test.js.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.SO = root.SO || {};
  root.SO.craps = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // §3.1 — ways to make each two-dice total (out of 36).
  const WAYS = { 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6, 8: 5, 9: 4, 10: 3, 11: 2, 12: 1 };
  function probability(total) { return (WAYS[total] || 0) / 36; }

  // §3.3 payout ratios [num, den] -> win = stake * num / den.
  const PASS_ODDS = { 4: [2, 1], 10: [2, 1], 5: [3, 2], 9: [3, 2], 6: [6, 5], 8: [6, 5] };
  const DONT_ODDS = { 4: [1, 2], 10: [1, 2], 5: [2, 3], 9: [2, 3], 6: [5, 6], 8: [5, 6] };
  const PLACE     = { 4: [9, 5], 10: [9, 5], 5: [7, 5], 9: [7, 5], 6: [7, 6], 8: [7, 6] };
  const PROP = {
    any7: [4, 1], anycraps: [7, 1], eleven: [15, 1], acedeuce: [15, 1],
    aces: [30, 1], boxcars: [30, 1],
    hard4: [7, 1], hard6: [9, 1], hard8: [9, 1], hard10: [7, 1],
  };

  function ratio(amount, r) { return (amount * r[0]) / r[1]; }

  function classifyPointRoll(total, point) {
    if (total === 7) return 'seven';
    if (total === point) return 'point';
    return 'neutral';
  }

  /* Line outcome for this participant's roll, given their style.
   * opts: { crapless (2/3/11/12 also make, pass only), elevenIs7 (11 counts as
   * a 7 for the line — a don't-build rig) }
   */
  function lineOutcome(total, point, style, opts) {
    opts = opts || {};
    let t = total;
    if (opts.elevenIs7 && t === 11) t = 7;
    if (style === 'dont') {
      if (t === 7) return 'make';
      if (t === point) return 'bust';
      return 'neutral';
    }
    if (t === point) return 'make';
    if (opts.crapless && [2, 3, 11, 12].includes(t)) return 'make';
    if (t === 7) return 'bust';
    return 'neutral';
  }

  /* Resolve one bet for one roll.
   * bet  : { betType, amount, num?, payMult?, sureThing? }
   *        come/dontcome use num as their own travelling point (null until set).
   * line : this roll's line outcome for the bettor ('make'|'bust'|'neutral')
   * mods : { lineMult, oddsMult, placeMult, fieldMult, propMult, comeMult,
   *          sureThing, fieldPlus5, placeImmune7, hardEasyWins, comeImmune7 }
   * Returns { result:'win'|'lose'|'stay'|'push', credit, remove, numSet? }
   *   credit = HP back to the bar (stake+winnings for auto-returning bets;
   *   winnings only for riding bets like place/hardway wins).
   */
  function resolveBet(bet, roll, point, line, mods) {
    mods = mods || {};
    const t = roll.total, d1 = roll.d1, d2 = roll.d2;
    const mult = bet.payMult || 1;
    const amt = bet.amount;
    const lineMult = (mods.lineMult || 1) * ((mods.sureThing || bet.sureThing) ? 2 : 1);

    switch (bet.betType) {
      case 'passline': {
        if (line === 'make') return { result: 'win', credit: amt + amt * lineMult * mult, remove: true };
        if (line === 'bust') return { result: 'lose', credit: 0, remove: true };
        return { result: 'stay', credit: 0, remove: false };
      }
      case 'dontpass': {
        if (line === 'make') return { result: 'win', credit: amt + amt * (mods.lineMult || 1) * mult, remove: true };
        if (line === 'bust') return { result: 'lose', credit: 0, remove: true };
        return { result: 'stay', credit: 0, remove: false };
      }
      case 'passodds': {
        if (line === 'make') return { result: 'win', credit: amt + ratio(amt, PASS_ODDS[point]) * (mods.oddsMult || 1) * mult, remove: true };
        if (line === 'bust') return { result: 'lose', credit: 0, remove: true };
        return { result: 'stay', credit: 0, remove: false };
      }
      case 'dontodds': {
        if (line === 'make') return { result: 'win', credit: amt + ratio(amt, DONT_ODDS[point]) * (mods.oddsMult || 1) * mult, remove: true };
        if (line === 'bust') return { result: 'lose', credit: 0, remove: true };
        return { result: 'stay', credit: 0, remove: false };
      }
      case 'come': {
        // travels: first resolution roll sets its own number, then it's a
        // private pass line on that number (§3.3 Table 1).
        const comeMult = mods.comeMult || 1;
        if (bet.num == null) {
          if (t === 7 || t === 11) return { result: 'win', credit: amt + amt * comeMult * mult, remove: true };
          if (t === 2 || t === 3 || t === 12) return { result: 'lose', credit: 0, remove: true };
          return { result: 'stay', credit: 0, remove: false, numSet: t };
        }
        if (t === bet.num) return { result: 'win', credit: amt + amt * comeMult * mult, remove: true };
        if (t === 7) {
          // a travelling come bet normally dies to the seven — unless shielded
          if (mods.comeImmune7) return { result: 'push', credit: amt, remove: true };
          return { result: 'lose', credit: 0, remove: true };
        }
        return { result: 'stay', credit: 0, remove: false };
      }
      case 'dontcome': {
        const dcMult = mods.comeMult || 1;
        if (bet.num == null) {
          if (t === 2 || t === 3) return { result: 'win', credit: amt + amt * dcMult * mult, remove: true };
          if (t === 12) return { result: 'push', credit: amt, remove: true }; // bar 12
          if (t === 7 || t === 11) return { result: 'lose', credit: 0, remove: true };
          return { result: 'stay', credit: 0, remove: false, numSet: t };
        }
        if (t === 7) return { result: 'win', credit: amt + amt * dcMult * mult, remove: true };
        if (t === bet.num) return { result: 'lose', credit: 0, remove: true };
        return { result: 'stay', credit: 0, remove: false };
      }
      case 'place': {
        if (t === 7) {
          if (mods.placeImmune7) return { result: 'push', credit: amt, remove: true };
          return { result: 'lose', credit: 0, remove: true };
        }
        if (t === bet.num) return { result: 'win', credit: ratio(amt, PLACE[bet.num]) * (mods.placeMult || 1) * mult, remove: false };
        return { result: 'stay', credit: 0, remove: false };
      }
      case 'field': {
        if ([2, 3, 4, 9, 10, 11, 12].includes(t) || (mods.fieldPlus5 && t === 5)) {
          const r = t === 2 ? [2, 1] : t === 12 ? [3, 1] : [1, 1];
          return { result: 'win', credit: amt + ratio(amt, r) * (mods.fieldMult || 1) * mult, remove: true };
        }
        return { result: 'lose', credit: 0, remove: true };
      }
      case 'hard': {
        const isHard = d1 === d2 && t === bet.num;
        const easyWin = mods.hardEasyWins && t === bet.num && d1 !== d2;
        if (isHard || easyWin) return { result: 'win', credit: ratio(amt, PROP['hard' + bet.num]) * (mods.propMult || 1) * mult, remove: false };
        if (t === 7 || t === bet.num) return { result: 'lose', credit: 0, remove: true };
        return { result: 'stay', credit: 0, remove: false };
      }
      // one-roll props (§3.3 Table 4) — 30:1 on a single throw, never standing
      case 'boxcars': return oneRoll(t === 12, amt, PROP.boxcars, mods, mult);
      case 'aces':   return oneRoll(t === 2, amt, PROP.aces, mods, mult);
      case 'any7':   return oneRoll(t === 7, amt, PROP.any7, mods, mult);
      case 'eleven': return oneRoll(t === 11, amt, PROP.eleven, mods, mult);
      case 'anycraps': return oneRoll([2, 3, 12].includes(t), amt, PROP.anycraps, mods, mult);
      default: return { result: 'stay', credit: 0, remove: false };
    }
  }

  function oneRoll(won, amt, r, mods, mult) {
    if (won) return { result: 'win', credit: amt + ratio(amt, r) * (mods.propMult || 1) * mult, remove: true };
    return { result: 'lose', credit: 0, remove: true };
  }

  // §5.2 — idle bleed on the Nth turn of a round.
  function bleedFor(turnInRound, baseBleed, bleedRamp) {
    return baseBleed + (turnInRound - 1) * bleedRamp;
  }

  return {
    WAYS, PASS_ODDS, DONT_ODDS, PLACE, PROP,
    probability, ratio, classifyPointRoll, lineOutcome, resolveBet, bleedFor,
  };
});
