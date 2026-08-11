/* AWECRAP — duel.js
 * The duel controller / state machine (§4.2, §13.3). Owns all duel state and
 * all HP mutation; talks to the world only through `hooks`.
 *
 * Implements the full card vocabulary (roundMods), the five bosses' gimmicks,
 * difficulty scaling, card upgrades (id+'+'), come/don't-come bets, and the
 * economy hooks (coins earned mid-duel).
 */
window.SO = window.SO || {};

(function () {
  const CFG = () => SO.CONFIG;
  const c = () => SO.craps;

  function makeParticipant(opts) {
    return {
      id: opts.id, name: opts.name, isPlayer: !!opts.isPlayer, def: opts.def || null,
      hp: opts.hp, maxHp: opts.maxHp,
      lineStyle: opts.style || 'pass',
      table: [],
      deck: (opts.deck || []).slice(),
      drawPile: [], hand: [], discardPile: [], exhausted: [],
      ridingBets: [],
      nerve: 0,
      roundStatus: 'active', turnInRound: 0, lastRoll: null, prevRoll: null,
      roundMods: {}, relicMods: {}, oncePerRoundUsed: {},
      relics: opts.relics || [],
      tourniquetTurns: 0, jinxed: false, rerollNext: false,
      noRollCardsTurns: 0, forceBigBet: false,
      nextTurnNerveDelta: 0, nextRoundDrawDelta: 0, nextRoundNoInterfere: false,
      scarTissue: 0, phoenixCard: 0, badBeatImmune: false, bleedFirstFree: false,
      coinsOnRoundWin: 0, coinsPerRound: 0,
      lastRites: false, lastRitesUsed: false, loadedConscienceUsed: false,
      angerStreak: 0, deescalateArmed: false, _betThisRound: false, _couldBetThisRound: false,
      _bleedFreeUsedThisRound: false, _firstPullUsedThisRound: false, _freeRigLeft: 0, _rollsThisTurn: 0, _betLog: [],
    };
  }

  class Duel {
    constructor({ player, enemyDef, rng, hooks, difficulty, coinsBase, runFlags, godMode, runMods }) {
      this.rng = rng;
      this.hooks = hooks || {};
      this.diff = difficulty || SO.DIFFICULTY[SO.DEFAULT_DIFFICULTY];
      this.runFlags = runFlags || {};
      this.runMods = runMods || {};   // pre-run rule toggles (anger mult, no-odds, …)
      this.coinsBase = coinsBase || 0;
      this.coinsEarned = 0;
      this.godMode = !!godMode; // testing: the player's first made point kills
      this.lastCall = false;
      this.player = player;
      this.opponent = makeParticipant({
        id: enemyDef.id, name: enemyDef.name, isPlayer: false, def: enemyDef,
        hp: enemyDef.hp, maxHp: enemyDef.hp,
        style: enemyDef.style === 'adaptive' ? 'pass' : enemyDef.style,
        deck: enemyDef.deck,
      });
      this.isBoss = !!enemyDef.phases;
      this.bossPhaseIdx = 0;

      this.point = null; this.roundNumber = 0;
      this.rolloffWinner = null; this.active = null; this.pendingRoll = null;
      this.coolerSetter = null;
      this.over = false; this.winner = null; this.loser = null;

      this._resolvers = {};
      this._awaiting = null;

      this._computeRelicMods(player);
      player._freeRigLeft = player.relicMods.freeRigCharges || 0;   // Crooked Dealer: per-duel pool
      if (player.relicMods.startBonusHp) this._changeHp(player, player.relicMods.startBonusHp, 'relic');
    }

    _computeRelicMods(p) {
      const m = {
        propMult: 1, comeMult: 1, placeMult: 1, lineMult: 1, oddsMult: 1,
        bleedRampDelta: 0, baseBleedDelta: 0, handSizeDelta: 0, nerveDelta: 0, firstTurnNerve: 0, rolloffBonus: 0,
        startBonusHp: 0, roundWinHeal: 0, leechAmount: 0, cutDealt: 0, cutResist: 0,
      };
      // curse-synergy relics scale off how many curses ride in the deck
      const curses = (p.deck || []).filter((id) => { const c = SO.getCard(id); return c && c.type === 'curse'; }).length;
      for (const id of p.relics || []) {
        if (id === 'tourniquet_ring') m.bleedRampDelta -= 1;
        else if (id === 'gamblers_talisman') m.propMult *= 1.25;
        else if (id === 'travellers_chip') m.comeMult *= 1.3;
        else if (id === 'street_ledger') m.placeMult *= 1.3;
        else if (id === 'marked_bones') m.markedBones = true;
        else if (id === 'house_edge') m.houseEdgeTies = true;
        else if (id === 'leech_stone') m.leechAmount = Math.max(m.leechAmount, 2);
        else if (id === 'loaded_conscience') m.loadedConscience = true;
        else if (id === 'clipped_wings') m.startBonusHp += 10;
        else if (id === 'dead_mans_hand') m.handSizeDelta += 1;
        else if (id === 'rabbits_foot') m.rolloffBonus += 1;
        else if (id === 'iron_stomach') m.baseBleedDelta -= 1;
        else if (id === 'golden_tooth') m.roundWinHeal += 3;
        else if (id === 'nerve_tonic') m.firstTurnNerve += 1;   // V.0.4.11: once/round, was every turn
        else if (id === 'ghost_grip') m.firstPullFree = true;
        else if (id === 'phoenix_feather') m.phoenixFeather = true;
        // -- V.0.4.7 expansion --
        else if (id === 'weighted_bones') m.rolloffBonus += 2;
        else if (id === 'false_shuffle') m.handSizeDelta += 1;
        else if (id === 'crooked_dealer') m.freeRigCharges = (m.freeRigCharges || 0) + 3;
        else if (id === 'ivory_dice') m.lineMult *= 1.2;
        else if (id === 'true_odds') m.oddsMult *= 1.25;
        else if (id === 'black_veil') m.leechAmount = Math.max(m.leechAmount, 3);
        else if (id === 'mourning_band') m.cutDealt += 2;
        else if (id === 'horns_charm') m.propMult *= 1.2;
        else if (id === 'field_marshal') m.fieldPlus5 = true;
        else if (id === 'numbers_racket') m.placeMult *= 1.15;
        else if (id === 'guardian_angel') m.startBonusHp += 15;
        else if (id === 'communion_wine') m.roundWinHeal += 2;
        else if (id === 'hospice_key') m.cutResist += 1;   // V.0.4.11: was 2 (read +9.6 lift @ n=135)
        else if (id === 'slow_bleed') m.bleedRampDelta -= 1;
        else if (id === 'martyrs_brand') m.startBonusHp += 6 * curses;
        else if (id === 'penance') m.baseBleedDelta -= Math.min(3, curses);
        else if (id === 'indulgence') m.nerveDelta += Math.floor(curses / 2);
      }
      p.relicMods = m;
    }

    // ===================== lifecycle =====================
    async start() {
      await this._h('duelStart', this);
      for (const p of [this.player, this.opponent]) p.drawPile = SO.shuffle(p.deck, this.rng);
      // You open every duel with a De-escalation in hand if you own one.
      this._frontloadCard(this.player, 'de_escalation');
      while (!this.over) {
        await this.playRound();
        if (this.over) break;
      }
      if (this.winner) {
        // No reclaim — the table keeps whatever the survivor still had riding.
        // But a brink victory (0 HP with chips out when the other soul died)
        // doesn't kill you AFTER winning: you stagger off the table at 1 HP.
        this.winner.table = [];
        this.winner.ridingBets = [];
        if (this.winner.hp <= 0) this.winner.hp = 1;
      }
      await this._h('duelEnd', this);
      return this.winner;
    }

    async playRound() {
      this.roundNumber++;
      this._maybeBossPhase(true);
      for (const p of [this.player, this.opponent]) {
        p.roundStatus = 'active'; p.turnInRound = 0; p.roundMods = {}; p.oncePerRoundUsed = {};
        p._bleedFreeUsedThisRound = false; p._firstPullUsedThisRound = false; p._betThisRound = false; p._couldBetThisRound = false;
        if (p.nextRoundNoInterfere) { p.roundMods.noInterfere = true; p.nextRoundNoInterfere = false; }
        p.discardPile.push(...p.hand); p.hand = [];
        const draws = Math.max(1, CFG().HAND_SIZE + (p.relicMods.handSizeDelta || 0) + (p.nextRoundDrawDelta || 0));
        p.nextRoundDrawDelta = 0;
        this._draw(p, draws);
        p.table = p.ridingBets.splice(0);
      }
      this.point = null;
      // Last Call: past the threshold the house wants this table back — the
      // bleed pierces exposure for BOTH souls and deepens every round.
      // Ascension IV ("Impatient House") pulls Last Call forward.
      const lastCallAt = Math.max(3, (this.isBoss ? CFG().LAST_CALL_ROUND_BOSS : CFG().LAST_CALL_ROUND) - (this.runMods.lastCallDelta || 0));
      if (!this.lastCall && this.roundNumber > lastCallAt) {
        this.lastCall = true;
        await this._h('lastCall', this);
      }
      await this._h('roundStart', this);
      if (this.player.coinsPerRound) this.earnCoins(this.player.coinsPerRound); // Skim

      await this.rolloff();
      if (this.over) return;

      this.active = this.rolloffWinner;
      let guard = 0;
      while (true) {
        const cur = this[this.active];
        if (cur.roundStatus === 'active') { await this.turn(cur); if (this.over) return; }
        if (this.player.roundStatus === 'made' || this.opponent.roundStatus === 'made') break;
        if (this.player.roundStatus === 'busted' && this.opponent.roundStatus === 'busted') break;
        const other = this.active === 'player' ? 'opponent' : 'player';
        if (this[other].roundStatus === 'active') this.active = other;
        if (++guard > 2000) break;
      }

      await this.resolveRound();
    }

    // ===================== Phase B: roll-off + point =====================
    // (There is NO ante and NO pot — by design. The only HP you gain in a duel
    // comes from your own bets resolving in your favor. Damage comes from your
    // busts and the bleed; the duel's clock is the bleed plus bust attrition.)
    async rolloff() {
      const bonus = this.player.relicMods.rolloffBonus || 0;
      let pr = this.rng.roll(), or_ = this.rng.roll();
      let playerWon = pr.total + bonus > or_.total;
      let tie = pr.total + bonus === or_.total;
      while (tie) {
        if (this.opponent.def && this.opponent.def.winsTies) { playerWon = false; break; }
        if (this.player.relicMods.houseEdgeTies) { playerWon = true; break; }
        pr = this.rng.roll(); or_ = this.rng.roll();
        playerWon = pr.total + bonus > or_.total; tie = pr.total + bonus === or_.total;
      }
      this.player.lastRoll = pr; this.opponent.lastRoll = or_;
      this.rolloffWinner = playerWon ? 'player' : 'opponent';
      await this._h('rolloff', this, pr, or_, playerWon);

      let setter;
      if (this.coolerSetter) { setter = this.coolerSetter; this.coolerSetter = null; }
      else if (this.opponent.def.alwaysSetsPoint) setter = this.opponent;
      else setter = playerWon ? this.player : this.opponent;

      if (setter.isPlayer) {
        this.point = await this._awaitPointChoice();
      } else {
        this.point = SO.AI ? SO.AI.choosePoint(this, setter) : this.rng.pick(CFG().LEGAL_POINTS);
        await this._h('opponentPoint', this, this.point, setter);
      }
      this.pointSetter = setter.isPlayer ? 'player' : 'opponent';
      await this._h('pointSet', this, this.point, this.rolloffWinner);
    }

    // ===================== Phase C: a turn =====================
    async turn(cur) {
      cur.turnInRound++;
      cur._rollsThisTurn = 0;
      cur._betLog = [];   // per-turn undo stack (QOL: take back a mis-tapped chip)
      // this soul is getting a turn — if it has any HP, it CAN place a bet, so
      // Anger for idleness is fair this round. (No turn / 0 HP → no Anger.)
      if (cur.hp > 0) cur._couldBetThisRound = true;
      if (cur.turnInRound > 1) this._draw(cur, 1);
      const firstTurnNerve = (cur.turnInRound === 1) ? (cur.relicMods.firstTurnNerve || 0) : 0;
      cur.nerve = Math.max(0, CFG().NERVE_PER_TURN + (cur.relicMods.nerveDelta || 0) + firstTurnNerve + (cur.nextTurnNerveDelta || 0));
      cur.nextTurnNerveDelta = 0;
      if (cur.noRollCardsTurns > 0) { cur.noRollCardsTurns--; cur.roundMods.noRollCardsThisTurn = true; }
      else cur.roundMods.noRollCardsThisTurn = false;
      this.active = cur.isPlayer ? 'player' : 'opponent';

      // The Countess skims exposed chips at the start of her turns.
      if (!cur.isPlayer && cur.def.stealOnTurn) {
        const other = this.player;
        const totl = this._tableTotal(other);
        if (totl > 0) {
          const take = Math.min(cur.def.stealOnTurn, totl);
          let left = take;
          other.table.sort((a, b) => b.amount - a.amount);
          for (const b of other.table) { const d = Math.min(left, b.amount); b.amount -= d; left -= d; if (!left) break; }
          other.table = other.table.filter((b) => b.amount > 0);
          this._changeHp(cur, take, 'steal');
          await this._h('bossSteal', this, cur, take);
        }
      }

      await this._h('turnStart', this, cur);

      if (cur.isPlayer) await this._awaitAction();
      else { if (SO.AI) await SO.AI.actionPhase(this, cur); }
      if (this.over) return;

      // Exposure is judged at the moment the dice leave the hand (§5.2). A bet
      // that RESOLVES on this roll (field, props) still counted as exposure —
      // the bleed punishes stillness, and betting is not stillness. Without
      // this, one-roll bettors bled every turn despite always having chips out.
      const exposedAtRoll = this._tableTotal(cur) > 0;

      this.pendingRoll = this.rollDice(cur);
      await this._h('diceLanded', this, cur, this.pendingRoll);

      if (cur.isPlayer) await this._awaitRollWindow(cur);
      else { if (SO.AI) await SO.AI.rollWindow(this, cur); }

      // forced rerolls: Pit Viper (any roll), then Jinx (successful rolls)
      if (cur.rerollNext) {
        cur.rerollNext = false;
        this.pendingRoll = this.rollDice(cur);
        await this._h('forcedReroll', this, cur, this.pendingRoll, 'Pit Viper');
      }
      let roll = this.pendingRoll;
      const lineOpts = () => ({ crapless: cur.roundMods.crapless, elevenIs7: cur.roundMods.elevenIs7 });
      let line = c().lineOutcome(roll.total, this.point, cur.lineStyle, lineOpts());

      if (cur.jinxed && line === 'make') {
        cur.jinxed = false;
        this.pendingRoll = roll = this.rollDice(cur);
        await this._h('forcedReroll', this, cur, roll, 'Jinx');
        line = c().lineOutcome(roll.total, this.point, cur.lineStyle, lineOpts());
      }

      if (line === 'bust') {
        if (cur.lastRites && !cur.lastRitesUsed) {
          cur.lastRitesUsed = true; this.pendingRoll = roll = this.rollDice(cur);
          await this._h('bustSaved', this, cur, 'Last Rites', roll);
          line = c().lineOutcome(roll.total, this.point, cur.lineStyle, lineOpts());
        } else if (cur.relicMods.loadedConscience && !cur.loadedConscienceUsed) {
          cur.loadedConscienceUsed = true; this.pendingRoll = roll = this.rollDice(cur);
          await this._h('bustSaved', this, cur, 'Loaded Conscience', roll);
          line = c().lineOutcome(roll.total, this.point, cur.lineStyle, lineOpts());
        }
      }

      cur.lastRoll = roll;
      cur.prevRoll = roll;
      await this._h('diceFinal', this, cur, roll, line);
      await this._resolveRollOutcome(cur, roll, line, exposedAtRoll);
      await this._h('afterTurn', this, cur);
      this._duelEndCheck();
    }

    /* Dice generation honoring the participant's rig mods. Pure enough to be
     * called by cards (Reroll etc.) — always via this method so mods hold. */
    rollDice(cur) {
      const m = cur.roundMods || {};
      const floor = m.faceFloor || 1, ceil = m.faceCeil || 6;
      const die = () => Math.min(ceil, Math.max(floor, this.rng.die()));
      cur._rollsThisTurn = (cur._rollsThisTurn || 0) + 1;
      let extra = m.extraDice || 0;
      if (m.extraDiceFirstOnly && cur._rollsThisTurn > 1) extra = 0;

      let d1, d2;
      if (extra > 0) {
        const pool = [];
        for (let i = 0; i < 2 + extra; i++) pool.push(die());
        const goal = cur.lineStyle === 'dont' ? 7 : (this.point || 7);
        let best = null;
        for (let i = 0; i < pool.length; i++) for (let j = i + 1; j < pool.length; j++) {
          const t = pool[i] + pool[j];
          const score = (t === goal ? 100 : 0) - Math.abs(t - goal) - (cur.lineStyle !== 'dont' && t === 7 ? 50 : 0);
          if (!best || score > best.score) best = { d1: pool[i], d2: pool[j], score };
        }
        d1 = best.d1; d2 = best.d2;
      } else { d1 = die(); d2 = die(); }

      let roll = { d1, d2, total: d1 + d2 };
      // auto-adjustments (applied to generated rolls only)
      if (m.rerollCraps && [2, 3, 12].includes(roll.total) && !cur._rerolledCrapsThisTurn) {
        cur._rerolledCrapsThisTurn = true;
        const a = die(), b = die();
        roll = { d1: a, d2: b, total: a + b };
      }
      const slide = (r) => { if (r.d1 < 6) r.d1++; else if (r.d2 > 1) r.d2--; r.total = r.d1 + r.d2; };
      if (m.no7 && roll.total === 7) slide(roll);
      if (m.notPoint && roll.total === this.point) slide(roll);
      return roll;
    }

    async _resolveRollOutcome(cur, roll, line, exposedAtRoll) {
      const other = cur === this.player ? this.opponent : this.player;
      const mods = this._betMods(cur);
      const survivors = [];
      for (const bet of cur.table) {
        const res = c().resolveBet(bet, roll, this.point, line, mods);
        if (res.numSet != null) bet.num = res.numSet;
        if (res.credit > 0) {
          this._heal(cur, res.credit, res.result === 'push' ? 'push' : 'win');
          if (res.result === 'win' && cur.roundMods.healPerWin) this._heal(cur, cur.roundMods.healPerWin, 'medic');
        }
        if (res.result === 'lose') {
          if (bet.hexHeal) this._heal(other, bet.hexHeal, 'hex');
          if (cur.roundMods.refundNextLoss > 0) {
            const back = Math.floor(bet.amount * cur.roundMods.refundNextLoss);
            cur.roundMods.refundNextLoss = 0;
            if (back > 0) this._heal(cur, back, 'push');
          }
        }
        if (!res.remove) survivors.push(bet);
      }
      cur.table = survivors;

      if (cur.roundMods.healPerNon7 && roll.total !== 7) this._heal(cur, cur.roundMods.healPerNon7, 'medic');

      if (line === 'make') {
        cur.roundStatus = 'made';
        await this._h('madePoint', this, cur, roll);
        // God mode (testing): the player's made point is a thunderbolt — the
        // enemy is annihilated on the spot, whatever their HP or chips.
        if (this.godMode && cur.isPlayer && !this.over && this.opponent.hp > 0) {
          this.opponent.table = [];
          this.opponent.ridingBets = [];
          await this._h('godSmite', this, this.opponent);
          this._changeHp(this.opponent, -this.opponent.hp, 'hit');
        }
      } else if (line === 'bust') {
        // chips on the table are lost — minus the escape hatches
        let refund = 0;
        const kept = [];
        for (const bet of cur.table) {
          if (cur.roundMods.oddsImmuneBust && (bet.betType === 'passodds' || bet.betType === 'dontodds')) { refund += bet.amount; continue; }
          if (bet.hexHeal) this._heal(other, bet.hexHeal, 'hex');
          if (cur.roundMods.bustRefundHalf) refund += Math.floor(bet.amount / 2);
        }
        cur.table = kept;
        if (refund > 0) this._heal(cur, refund, 'push');
        cur.roundStatus = 'busted';
        await this._h('busted', this, cur, roll);
        if (cur.roundMods.healOnSelfBust) this._heal(cur, cur.roundMods.healOnSelfBust, 'medic');
        if (other.roundMods.healOnOppBust) this._heal(other, other.roundMods.healOnOppBust, 'reaper');
        if (other.relicMods.leechAmount > 0) this._heal(other, other.relicMods.leechAmount, 'leech');
        this._maybeDeath(cur);
      } else {
        if (this.lastCall) {
          // Last Call: the wound refuses chips, tourniquets, everything.
          // Deepens every round past the threshold — this table WILL end.
          const past = this.roundNumber - (this.isBoss ? CFG().LAST_CALL_ROUND_BOSS : CFG().LAST_CALL_ROUND);
          const dmg = Math.max(1, CFG().BASE_BLEED + (cur.turnInRound - 1) * CFG().BLEED_RAMP + past * CFG().LAST_CALL_RAMP);
          this._changeHp(cur, -dmg, 'bleed');
          await this._h('bleed', this, cur, dmg);
        } else if (!exposedAtRoll && this._tableTotal(cur) === 0) {
          // The bleed punishes STILLNESS: it ticks only if the roller had no
          // chips exposed when the dice left their hand. A field/prop bet that
          // resolved on this very roll still counts as exposure — that was a
          // bet, not idleness.
          if (cur.tourniquetTurns > 0) { cur.tourniquetTurns--; await this._h('noBleed', this, cur, 'tourniquet'); }
          else {
            const dmg = this._bleedAmount(cur);
            if (dmg > 0) {
              this._changeHp(cur, -dmg, 'bleed');
              if (other.def && other.def.healWhenOppBleeds && cur.isPlayer) this._heal(other, other.def.healWhenOppBleeds, 'leech');
              await this._h('bleed', this, cur, dmg);
            } else await this._h('noBleed', this, cur, dmg === 0 ? 'numb' : null);
          }
        } else await this._h('noBleed', this, cur);
      }
      cur._rerolledCrapsThisTurn = false;
    }

    _bleedAmount(cur) {
      const m = cur.roundMods;
      if (m.bleedImmune) return 0;
      if (cur.bleedFirstFree && !cur._bleedFreeUsedThisRound) { cur._bleedFreeUsedThisRound = true; return 0; }
      return this.bleedPreview(cur); // flag now consumed; preview computes the real amount
    }

    _betMods(cur) {
      const m = cur.roundMods;
      return {
        lineMult: (m.lineMult || 1) * (cur.relicMods.lineMult || 1),
        sureThing: !!m.sureThing,
        oddsMult: (m.oddsMult || 1) * (cur.relicMods.oddsMult || 1),
        placeMult: (m.placeMult || 1) * (cur.relicMods.placeMult || 1),
        fieldMult: m.fieldMult || 1,
        propMult: (m.propMult || 1) * (cur.relicMods.propMult || 1),
        comeMult: (m.comeMult || 1) * (cur.relicMods.comeMult || 1),
        fieldPlus5: !!m.fieldPlus5 || !!cur.relicMods.fieldPlus5,
        placeImmune7: !!m.placeImmune7,
        hardEasyWins: !!m.hardEasyWins,
        comeImmune7: !!m.comeImmune7,
      };
    }

    // ===================== Phase D: resolution =====================
    async resolveRound() {
      const winner = this.player.roundStatus === 'made' ? this.player
        : this.opponent.roundStatus === 'made' ? this.opponent : null;

      if (winner) {
        // The round's spoils are the winner's own bet payouts (already paid at
        // resolution) — there is no pot. Round-win extras fire here:
        if (winner.relicMods.roundWinHeal) this._heal(winner, winner.relicMods.roundWinHeal, 'relic'); // Golden Tooth
        if (winner.coinsOnRoundWin && winner.isPlayer) this.earnCoins(winner.coinsOnRoundWin);         // Loaded Ledger
        for (const p of [this.player, this.opponent]) {
          if (p.roundStatus === 'busted') continue;
          this._settleStandingBets(p);
        }
        // The Cut (§ no-pot design): making the point wounds the soul across
        // the table. Flat, never escalating — round wins are how you kill.
        const loser = winner === this.player ? this.opponent : this.player;
        // relics sharpen the Cut you deal (Mourning Band) and blunt the one you take (Hospice Key)
        let cut = CFG().ROUND_CUT + (winner.relicMods.cutDealt || 0);
        if (loser.relicMods.cutResist) cut = Math.max(0, cut - loser.relicMods.cutResist);
        if (cut > 0 && !this.over) {
          this._changeHp(loser, -cut, 'cut');
          await this._h('roundCut', this, winner, loser, cut);
        }
      }
      this._maybeBossPhase(false);
      // The house's Anger — the penalty for a round with no bet placed.
      for (const p of [this.player, this.opponent]) { if (!this.over) this._applyAnger(p); }
      await this._h('roundResolve', this, winner);
      this._duelEndCheck();
    }

    /* Round-end sweep: NOBODY gets their bets back from the table. Any chip
     * still standing when the round resolves belongs to the house — win your
     * bets before the round ends, or they're gone. The only exception is a
     * card that explicitly keeps a bet riding (Let It Ride / Parlay Ticket). */
    _settleStandingBets(p) {
      const keep = [];
      let swept = 0;
      for (const bet of p.table) {
        const isRideable = ['place', 'hard'].includes(bet.betType);
        if (p.roundMods.letItRide && isRideable && keep.length === 0) {
          bet.payMult = (bet.payMult || 1) * p.roundMods.letItRide;
          keep.push(bet);
        } else {
          swept += bet.amount;
        }
      }
      p.table = [];
      p.ridingBets = keep;
      if (swept > 0) this._h('sweep', this, p, swept);
    }

    // ===================== boss phases =====================
    _maybeBossPhase(atRoundStart) {
      if (!this.isBoss) return;
      const phases = this.opponent.def.phases;
      while (this.bossPhaseIdx < phases.length - 1 && this.opponent.hp <= phases[this.bossPhaseIdx].to) {
        this.bossPhaseIdx++;
        this.player.turnInRound = 0; this.opponent.turnInRound = 0; // floor reset relents the bleed clock
        this._h('bossPhase', this, this.bossPhaseIdx, phases[this.bossPhaseIdx]);
      }
      const ph = phases[this.bossPhaseIdx];
      if (atRoundStart && ph.curseEveryOther && this.roundNumber % 2 === 0) {
        this.player.drawPile.unshift(ph.curseEveryOther);
        this._h('bossCurse', this, ph.curseEveryOther);
      }
    }

    // ===================== player input surface =====================
    canAct() { return !this.over && this._awaiting === 'action' && this.active === 'player' && this.player.roundStatus === 'active'; }
    inRollWindow() { return !this.over && this._awaiting === 'rollwindow' && this.active === 'player'; }

    setStyle(style) {
      const p = this.player;
      if (!this.canAct()) return;
      if (this._lineBet(p)) return;
      p.lineStyle = style === 'dont' ? 'dont' : 'pass';
      this._h('render', this);
    }

    maxOdds(p) {
      const line = this._lineBet(p);
      if (!line) return 0;
      return line.amount * CFG().MAX_ODDS_MULTIPLE * (p.roundMods.maxOddsMult || 1);
    }

    addLine(step) {
      if (!this.canAct()) return;
      const p = this.player;
      const amt = Math.min(step != null ? step : CFG().BET_STEP, p.hp);
      if (amt <= 0) return;
      const type = p.lineStyle === 'dont' ? 'dontpass' : 'passline';
      let bet = this._lineBet(p);
      if (bet) bet.amount += amt; else { bet = { betType: type, amount: amt }; p.table.push(bet); }
      if (p.roundMods.sureThing) bet.sureThing = true;
      this._spend(p, amt);
      this._logBet(p, bet, amt);
      if (p.roundMods.healPerBet) this._heal(p, p.roundMods.healPerBet, 'medic');
      this._h('render', this);
    }

    // QOL: record a just-placed chip so undoBet() can take it back before the roll
    _logBet(p, bet, amt) { (p._betLog || (p._betLog = [])).push({ bet, amount: amt }); }
    undoBet() {
      if (!this.canAct()) return;
      const p = this.player;
      const last = (p._betLog || []).pop();
      if (!last) return;
      const idx = p.table.indexOf(last.bet);
      if (idx >= 0) {
        last.bet.amount -= last.amount;
        if (last.bet.amount <= 0) p.table.splice(idx, 1);
        this._changeHp(p, last.amount, 'pull');   // full refund, no tax — it's a mis-tap fix
      }
      this._h('render', this);
    }

    addOdds(step) {
      if (!this.canAct()) return;
      const p = this.player;
      if (p.roundMods.noOdds || this.runMods.noOdds) return;
      const line = this._lineBet(p);
      if (!line) return;
      const type = p.lineStyle === 'dont' ? 'dontodds' : 'passodds';
      const room = this.maxOdds(p) - this._betAmt(p, type);
      const amt = Math.min(step != null ? step : CFG().BET_STEP, p.hp, room);
      if (amt <= 0) return;
      let bet = p.table.find((b) => b.betType === type);
      if (bet) bet.amount += amt; else { bet = { betType: type, amount: amt }; p.table.push(bet); }
      this._spend(p, amt);
      this._logBet(p, bet, amt);
      if (p.roundMods.healPerBet) this._heal(p, p.roundMods.healPerBet, 'medic');
      this._h('render', this);
    }

    addSideBet(kind, num, step) {
      if (!this.canAct()) return;
      const p = this.player;
      const amt = Math.min(step != null ? step : CFG().BET_STEP, p.hp);
      if (amt <= 0) return;
      let bet;
      if (kind === 'place') bet = { betType: 'place', amount: amt, num: num || this.point };
      else if (kind === 'field') bet = { betType: 'field', amount: amt };
      else if (kind === 'hard') bet = { betType: 'hard', amount: amt, num: num || this.point };
      else if (kind === 'any7') bet = { betType: 'any7', amount: amt };
      else if (kind === 'eleven') bet = { betType: 'eleven', amount: amt };
      else if (kind === 'boxcars') bet = { betType: 'boxcars', amount: amt };
      else if (kind === 'aces') bet = { betType: 'aces', amount: amt };
      else if (kind === 'come') bet = { betType: 'come', amount: amt, num: null };
      else if (kind === 'dontcome') bet = { betType: 'dontcome', amount: amt, num: null };
      else return;
      if (bet.betType === 'hard' && ![4, 6, 8, 10].includes(bet.num)) return;
      if (bet.betType === 'place' && !CFG().LEGAL_POINTS.includes(bet.num)) return;
      const existing = p.table.find((b) => b.betType === bet.betType && b.num === bet.num);
      let ref;
      if (existing && !['come', 'dontcome'].includes(bet.betType)) { existing.amount += amt; ref = existing; } else { p.table.push(bet); ref = bet; }
      this._spend(p, amt);
      this._logBet(p, ref, amt);
      if (p.roundMods.healPerBet) this._heal(p, p.roundMods.healPerBet, 'medic');
      this._h('render', this);
    }

    pullBet(index) {
      if (!this.canAct()) return;
      const p = this.player;
      const bet = p.table[index];
      if (!bet || !this._pullable(p, bet)) return;
      const opp = this.opponent;
      let tax;
      if (p.roundMods.secondWind) { const heal = p.roundMods.secondWind; p.roundMods.secondWind = 0; this._heal(p, heal, 'win'); tax = 0; }
      else if (p.roundMods.pullTaxFree) tax = 0;
      else if (p.relicMods.firstPullFree && !p._firstPullUsedThisRound) { p._firstPullUsedThisRound = true; tax = 0; }
      else {
        tax = (CFG().PULL_TAX + (p.roundMods.pullTaxDelta || 0)) * ((opp.def && opp.def.pullTaxMult) || 1);
        tax = Math.min(tax, bet.amount);
      }
      const refund = bet.amount - tax;
      p.table.splice(index, 1);
      this._changeHp(p, refund, 'pull');
      if (p.roundMods.oppHealOnPull) this._heal(opp, p.roundMods.oppHealOnPull, 'hex');
      this._h('pullTax', this, p, tax);
      this._h('render', this);
    }

    // play a card from the PLAYER's hand (UI path)
    playCard(index, choice) {
      const p = this.player;
      if (this.over) return false;
      const def = SO.getCard(p.hand[index]);
      if (!def) return false;
      const phase = this._awaiting;
      const ok = (def.timing === 'rollwindow' && phase === 'rollwindow') || (def.timing === 'action' && phase === 'action');
      if (!ok) return false;
      const played = this._applyCard(p, index, choice);
      if (played) this._h('render', this);
      return played;
    }

    // shared card application for player and AI
    _applyCard(p, index, choice) {
      const id = p.hand[index];
      if (id == null) return false;
      const def = SO.getCard(id);
      if (!def || def.type === 'curse') return false;
      const baseId = SO.baseId(id);
      if (def.oncePerRound && p.oncePerRoundUsed[baseId]) return false;
      if (def.timing === 'rollwindow' && p.roundMods.noRollCardsThisTurn) { this._h('cardBlocked', this, def, p); return false; }
      if (def.type === 'interfere' && p.roundMods.noInterfere) { this._h('cardBlocked', this, def, p); return false; }
      const cost = this._cardCost(p, id);
      if (cost > p.nerve) return false;
      const opp = p === this.player ? this.opponent : this.player;
      if (def.targetsOpp && opp.def && opp.def.immuneToInterfere) { this._h('cardFizzle', this, def, p); return false; }
      p.nerve -= cost; p.hand.splice(index, 1); p.discardPile.push(id);
      if (def.oncePerRound) p.oncePerRoundUsed[baseId] = true;
      // Crooked Dealer: burn a charge only when free-rig actually paid for this
      // card — not when it was already free via Marked Bones or a 0-nerve card.
      if (def.timing === 'rollwindow' && p._freeRigLeft > 0 && def.nerve > 0) {
        const freeFromMarked = p.relicMods.markedBones && (baseId === 'loaded_die' || baseId === 'nudge');
        if (!freeFromMarked) p._freeRigLeft--;
      }
      const msg = def.play ? def.play(this, p, opp, choice || (def.aiChoose ? def.aiChoose(this, p, opp) : {}), def) : null;
      this._h('cardPlayed', this, p, def, msg, baseId);   // baseId feeds the codex's play counter
      return true;
    }

    _cardCost(p, id) {
      const def = SO.getCard(id);
      if (!def) return 99;
      const base = SO.baseId(id);
      let cost = def.nerve;
      if (p.relicMods.markedBones && (base === 'loaded_die' || base === 'nudge')) cost = 0;
      // Crooked Dealer: a pool of free rig (roll-window) cards for the whole duel.
      // The charge is DECREMENTED only when a card is actually PLAYED (_applyCard),
      // never here — _cardCost is also called for previews/affordability checks.
      if (p._freeRigLeft > 0 && def.timing === 'rollwindow') cost = 0;
      const opp = p === this.player ? this.opponent : this.player;
      if (opp.def && opp.def.oppCardCostDelta) cost += opp.def.oppCardCostDelta;
      return Math.max(0, cost);
    }

    submitRoll() { this._resolve('action'); }
    finishRollWindow() { this._resolve('rollwindow'); }
    choosePoint(n) { if (this._resolvers.point && CFG().LEGAL_POINTS.includes(n)) { const r = this._resolvers.point; this._resolvers.point = null; this._awaiting = null; r(n); } }

    _resolve(which) {
      if (this._awaiting === which && this._resolvers[which]) {
        const r = this._resolvers[which]; this._resolvers[which] = null; this._awaiting = null;
        this._h('enableControls', this, false);
        r();
      }
    }

    // ===================== helpers exposed to cards =====================
    placeBet(p, bet) { p.table.push(bet); this._spend(p, bet.amount); if (p.roundMods.healPerBet) this._heal(p, p.roundMods.healPerBet, 'medic'); }
    houseBet(p, bet) { p.table.push(bet); this._h('render', this); }
    heal(p, amt, kind) { this._heal(p, amt, kind); }
    damage(p, amt, kind) { this._changeHp(p, -Math.abs(amt), kind || 'hit'); }
    drawCards(p, n) { this._draw(p, n); }
    earnCoins(n) { this.coinsEarned += n; this._h('coins', this, n); }
    coinsAvailable() { return Math.max(0, this.coinsBase + this.coinsEarned); }
    // curse-synergy support: how many curses ride in this soul's whole deck
    // (across every pile), and a way to burn one out of hand for a payoff.
    curseCount(p) {
      let n = 0;
      for (const pile of [p.hand, p.drawPile, p.discardPile, p.exhausted || []]) {
        for (const id of pile) { const c = SO.getCard(id); if (c && c.type === 'curse') n++; }
      }
      return n;
    }
    exhaustCurse(p) {
      const i = p.hand.findIndex((id) => { const c = SO.getCard(id); return c && c.type === 'curse'; });
      if (i < 0) return false;
      const id = p.hand.splice(i, 1)[0];
      (p.exhausted || (p.exhausted = [])).push(id);
      return true;
    }

    // ===================== internals =====================
    _awaitAction() { this._awaiting = 'action'; this._h('enableControls', this, true); return new Promise((res) => { this._resolvers.action = res; }); }
    async _awaitRollWindow(cur) {
      if (cur.roundMods.noRollCardsThisTurn) return;
      const playable = cur.hand.some((id) => { const d = SO.getCard(id); return d && d.timing === 'rollwindow' && this._cardCost(cur, id) <= cur.nerve; });
      if (!playable) return;
      this._awaiting = 'rollwindow';
      this._h('enableControls', this, true);
      return new Promise((res) => { this._resolvers.rollwindow = res; });
    }
    _awaitPointChoice() { this._awaiting = 'point'; this._h('requestPointChoice', this, CFG().LEGAL_POINTS); return new Promise((res) => { this._resolvers.point = res; }); }

    _heal(p, amt, kind) {
      if (amt <= 0) return;
      if (this.roundNumber === 1 && this._curseCount(p, 'cold_streak') > 0) { this._h('healBlocked', this, p); return; }
      this._changeHp(p, amt, kind || 'win');
    }

    _spend(p, amt) { if (amt > 0) p._betThisRound = true; this._changeHp(p, -amt, 'bet'); }

    // Anger: resolves once per round per soul. No bet placed → the wrath grows
    // and strikes, unless a De-escalation is armed. Betting resets it.
    _applyAnger(p) {
      if (p._betThisRound) { p.angerStreak = 0; return; }
      // Fairness: only anger a soul that actually HAD the chance to bet this
      // round (got a turn with HP left). No opportunity → no punishment.
      if (!p._couldBetThisRound) return;
      if (p.deescalateArmed) { p.deescalateArmed = false; this._h('deescalate', this, p); return; }
      p.angerStreak = (p.angerStreak || 0) + 1;
      const dmg = Math.round((CFG().ANGER_STEP || 3) * p.angerStreak * (this.runMods.angerMult || 1));
      this._changeHp(p, -dmg, 'anger');
      this._h('anger', this, p, dmg, p.angerStreak);
    }

    // ---- read-only threat previews (for the UI meters; no side effects) ----
    angerThreat(p) { return Math.round((CFG().ANGER_STEP || 3) * ((p.angerStreak || 0) + 1) * (this.runMods.angerMult || 1)); }
    bleedPreview(cur) {
      const m = cur.roundMods || {};
      if (m.bleedImmune) return 0;
      if (cur.bleedFirstFree && !cur._bleedFreeUsedThisRound) return 0;
      const base = Math.max(0, CFG().BASE_BLEED + this._curseCount(cur, 'trembling_hands') + (m.bleedFlatDelta || 0) - (cur.scarTissue || 0) + (cur.relicMods.baseBleedDelta || 0));
      const ramp = m.bleedRampZero ? 0 : Math.max(0, CFG().BLEED_RAMP + (m.bleedRampDelta || 0) + (cur.relicMods.bleedRampDelta || 0));
      let dmg = Math.max(0, base + (cur.turnInRound - 1) * ramp);
      if (m.bleedCap != null) dmg = Math.min(dmg, m.bleedCap);
      if (cur.isPlayer) dmg = Math.round(dmg * (this.diff.bleedMult || 1));
      return dmg;
    }

    // ensure a specific card sits in the opening hand if the deck owns one
    _frontloadCard(p, id) {
      const hs = CFG().HAND_SIZE;
      const idx = p.drawPile.findIndex((x) => SO.baseId(x) === id);
      if (idx >= hs) { const card = p.drawPile.splice(idx, 1)[0]; p.drawPile.unshift(card); }
    }

    _changeHp(p, delta, kind) {
      const max = this._effMax(p);
      const raw = p.hp + delta;
      p.hp = Math.min(max, Math.max(0, raw));
      if (delta < 0) p._lastHurtBy = kind;   // remembered for the loss-recovery screen
      this._h('hpChange', this, p, delta, kind, raw);
      if (delta < 0) this._maybeDeath(p, raw);
    }

    _effMax(p) {
      if (p.badBeatImmune) return p.maxHp;
      return Math.max(1, p.maxHp - 10 * this._curseCount(p, 'bad_beat'));
    }

    _curseCount(p, id) { return p.hand.filter((x) => SO.baseId(x) === id).length; }

    _tableTotal(p) { return p.table.reduce((s, b) => s + b.amount, 0); }
    _lineBet(p) { return p.table.find((b) => b.betType === 'passline' || b.betType === 'dontpass'); }
    _betAmt(p, type) { const b = p.table.find((x) => x.betType === type); return b ? b.amount : 0; }
    _pullable(p, bet) {
      // §5.5 / Table 5: pass line and COME are locked; don't-side and place pull.
      if (bet.betType === 'dontpass') return !p.roundMods.lockLine;
      return ['passodds', 'dontodds', 'place', 'dontcome'].includes(bet.betType);
    }

    _draw(p, n) {
      for (let i = 0; i < n; i++) {
        if (!p.drawPile.length) {
          if (!p.discardPile.length) break;
          p.drawPile = SO.shuffle(p.discardPile, this.rng); p.discardPile = [];
        }
        p.hand.push(p.drawPile.shift());
      }
    }

    _maybeDeath(p, raw) {
      const hp = raw == null ? p.hp : raw;
      if (this.over || hp > 0 || this._tableTotal(p) > 0) return;
      // escape hatches: Phoenix Ash (card), then Phoenix Feather (relic, once per run)
      if (p.phoenixCard > 0) {
        p.hp = p.phoenixCard; p.phoenixCard = 0;
        this._h('phoenixSave', this, p, 'Phoenix Ash');
        return;
      }
      if (p.isPlayer && p.relicMods.phoenixFeather && !this.runFlags.phoenixUsed) {
        this.runFlags.phoenixUsed = true;
        p.hp = Math.max(1, Math.ceil(this._effMax(p) * 0.25));
        this._h('phoenixSave', this, p, 'Phoenix Feather');
        return;
      }
      this.over = true; this.loser = p; this.winner = p === this.player ? this.opponent : this.player;
      // record what struck the killing blow, so the loss screen can name it
      if (p.isPlayer) { this.deathCause = p._lastHurtBy || 'hit'; this.deathAtLastCall = !!this.lastCall; }
    }
    _duelEndCheck() { for (const p of [this.player, this.opponent]) this._maybeDeath(p); return this.over; }

    _h(name, ...args) { const fn = this.hooks[name]; if (typeof fn === 'function') return fn.apply(this.hooks, args); }
  }

  SO.makeParticipant = makeParticipant;
  SO.Duel = Duel;
})();
