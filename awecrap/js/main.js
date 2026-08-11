/* AWECRAP — main.js
 * Orchestrates the whole game: menu/settings → 5-act run → map →
 * (duel | elite | event | shop | rest | boss) → rewards → act transitions →
 * victory or the long drop.
 */
(function () {
  const $ = (id) => document.getElementById(id);
  const ui = new SO.UI();
  let run = null;
  let lastSeed = null, lastCheat = null;
  // Checkpoints (opt-in setting): a JSON snapshot of the run taken at the top of
  // each act. With the setting on, dying rewinds here instead of ending the run.
  let checkpoint = null;
  function captureCheckpoint() { if (run) { try { checkpoint = JSON.stringify(run.serialize()); } catch (e) {} } }

  // Crash guard: if anything throws mid-run, show a friendly screen with the seed
  // instead of a frozen board. One-shot (a cascade of errors shows it once).
  let crashed = false;
  function showCrash(err) {
    if (crashed) return;
    crashed = true;
    try {
      const seedTag = (run && ui._seedTag) ? ui._seedTag(run.seed) : (lastSeed != null ? String(lastSeed) : '—');
      const el = $('crash-seed'); if (el) el.textContent = seedTag;
      const eel = $('crash-err'); if (eel) eel.textContent = err ? String(err && err.message ? err.message : err).slice(0, 160) : '';
      document.querySelectorAll('.overlay:not(#crash-screen), .screen').forEach((o) => { if (o.id !== 'crash-screen') o.classList.add('hidden'); });
      $('crash-screen').classList.remove('hidden');
      if (SO.Audio) { try { SO.Audio.play('menu'); } catch (e) {} }
    } catch (e) { /* the crash screen itself must never throw */ }
  }
  let selectedChar = (SO.Profile ? SO.Profile.lastChar() : 'gambler');
  if (!SO.CHARACTERS || !SO.CHARACTERS[selectedChar]) selectedChar = 'gambler';
  // a remembered soul can become locked again (e.g. after a data wipe) — never start locked
  if (soulLocked(selectedChar)) selectedChar = 'gambler';

  // pre-run modifiers (opt-in rule toggles), remembered across sessions
  const MODS_KEY = 'awecrap_modifiers_v1';
  let selectedMods = [];
  try { const s = JSON.parse(localStorage.getItem(MODS_KEY) || '[]'); if (Array.isArray(s)) selectedMods = s.filter((id) => SO.MODIFIER_BY_ID && SO.MODIFIER_BY_ID[id]); } catch (e) {}
  function saveMods() { try { localStorage.setItem(MODS_KEY, JSON.stringify(selectedMods)); } catch (e) {} }
  function applyRunModifiers(r) {
    r.modifiers = selectedMods.slice(); r.mods = {}; r.scoreMult = 1;
    r.modifiers.forEach((id) => { const m = SO.MODIFIER_BY_ID[id]; if (m) { m.apply(r); r.scoreMult *= (m.scoreMult || 1); } });
  }

  // secret seed words (documented only on the readable tutorial's last page)
  const CHEATS = ['god', 'boss', 'rich', 'loaded', 'fortune', 'stacked', 'phoenix'];

  function startRun(explicitSeed) {
    $('start-screen').classList.add('hidden');
    $('end-screen').classList.add('hidden');
    const raw = ($('seed-input').value || '').trim();
    const cheat = explicitSeed != null ? lastCheat : (CHEATS.includes(raw.toLowerCase()) ? raw.toLowerCase() : null);
    let seed;
    if (explicitSeed != null) seed = explicitSeed;
    else seed = raw && /^\d+$/.test(raw) ? (parseInt(raw, 10) >>> 0) : SO.randomSeed();
    run = new SO.Run(seed, ui.settings.difficulty, (SO.CHARACTERS && SO.CHARACTERS[selectedChar]) || null);
    if (cheat) run.applyCheat(cheat);
    applyRunModifiers(run);                       // resets run.mods, so it goes first
    if (SO.applyAscensionTwists) SO.applyAscensionTwists(run);   // then the rung's named rules stack on
    run.stats = { rolls: 0, cards: 0, rounds: 0, duels: 0, rests: 0, events: 0, nodes: 0, pulls: 0, toughestFoe: null, toughestFoeHp: 0, toughestFoeRound: 0 };
    lastSeed = seed; lastCheat = cheat;
    ui._noteSeen(run.player.deck);                // codex: your soul's opening hand counts as seen
    ui.setRun(run);
    captureCheckpoint();   // the top of Act 1 is the first checkpoint
    showMap();
  }

  function showMap() {
    if (run.player.hp <= 0) return gameOver('You bled out on the floor.');
    // first time a curse ever lands in the deck, explain what it means
    if (run.player.deck.some((id) => { const c = SO.getCard(id); return c && c.type === 'curse'; })) {
      ui.hint('curse', 'A Curse in your Deck', 'Something nasty just joined your deck. Curses can’t be played and clog your draws — they’re the price of a bargain. Pay a Shop’s removal cost or find a Chapel to burn them out.');
    }
    if (SO.Profile && SO.Profile.milestone('coinsSpent') >= 1000) SO.Profile.award('whale');
    ui.drainProfileToasts();   // anything run.js queued while we were off-screen
    ui.renderMap(run, onPick);
  }

  function onPick(nodeId) {
    const node = run.enter(nodeId);
    run.stats.nodes++;
    ui.topbar(true);
    if (node.type === 'duel' || node.type === 'elite' || node.type === 'boss') startDuel(node);
    else if (node.type === 'shop') startShop(node);
    else if (node.type === 'rest') startRest(node);
    else if (node.type === 'event') startEvent(node);
    else if (node.type === 'exit') escapeDepth();
  }

  // ---------------- the Depths (side-boards) ----------------
  function fallToDepth(depthId) {
    run.fallIntoDepth(depthId);
    if (SO.Audio) SO.Audio.sting('defeat');
    ui.hint('depths', 'The Depths', 'A failed gamble dropped you off the floor. There are no events, shops or bosses down here — just fight your way to the EXIT to climb back to where you were. Mind your HP.');
    showMap();
    ui.banner('YOU FALL', run.act.name.toUpperCase() + ' — CLAW YOUR WAY OUT', 'bad', 1500);
  }
  // A lucky gambit tumbles you UP into the Vault — a jackpot, not a punishment.
  function fallToVault() {
    run.fallIntoDepth('vault');
    if (SO.Audio) SO.Audio.sting('victory');
    ui.hint('vault', 'The Counting Room', 'You fell UP — into the house’s own vault. It’s short and easy, and the EXIT pays out. Fight to the stairs and take the loot.');
    showMap();
    ui.banner('THE VAULT', 'YOU FELL UP — LOOT AT THE STAIRS', 'good', 1500);
  }
  function escapeDepth() {
    const wasTreasure = !!(run.depthAct && run.depthAct.treasure);
    const escaped = run.ascendFromDepth();
    if (SO.Profile && escaped) {
      SO.Profile.recordDepthType(escaped);
      SO.Profile.bumpMilestone('depthsEscaped');
      SO.Profile.award('spelunker');
      if (SO.Profile.depthTypesEscaped().length >= 3) SO.Profile.award('caver');
    }
    const heal = Math.round(run.player.maxHp * 0.1);   // catch your breath on the climb out
    run.player.hp = Math.min(run.player.maxHp, run.player.hp + heal);
    if (SO.Audio) SO.Audio.play('map');
    // Escape rewards make the gamble pay even when it "fails": coins always, and
    // a relic — guaranteed out of the Vault, a chance out of a regular Depth.
    const coins = wasTreasure ? 40 + run.actIdx * 15 : 12 + run.actIdx * 6;
    run.addCoins(coins);
    const relicId = (wasTreasure || run.rng.next() < 0.4) ? run.randomRelic() : null;
    showMap();
    if (relicId) {
      const rn = (SO.RELICS[relicId] || {}).name || 'a relic';
      ui.banner(wasTreasure ? 'THE VAULT PAYS' : 'BACK ON THE FLOOR', `+${coins} coins, +${heal} HP, and ${rn}.`, 'good', 1600);
    } else {
      ui.banner('BACK ON THE FLOOR', `You claw your way out. +${coins} coins, +${heal} HP.`, 'good', 1400);
    }
    ui.drainProfileToasts();
  }

  // ---------------- duels ----------------
  async function startDuel(node) {
    const enemyDef = run.buildEnemy(node);
    // Bestiary: remember this soul so its reference entry unlocks.
    if (SO.Profile) {
      if (node.type === 'boss') SO.Profile.seeBoss(node.boss || run.act.boss); else SO.Profile.seeEnemy(node.enemy);
      if (Object.keys(SO.ENEMIES).every((id) => SO.Profile.hasMet(id))) SO.Profile.award('know_thy');
    }
    const player = run.duelParticipant();
    // God mode ("God" typed as the seed): the duel plays out normally — full
    // board, music, portraits — but the player's FIRST made point annihilates
    // the enemy. For testing looks and flow, not for skipping them.
    const duel = new SO.Duel({
      player, enemyDef, rng: run.rng, hooks: ui,
      difficulty: run.diff, coinsBase: run.coins, runFlags: run.flags,
      godMode: run.godMode, runMods: run.mods,
    });
    ui.attach(duel);
    const winner = await duel.start();
    run.syncAfterDuel(player);
    if (duel.coinsEarned) run.addCoins(duel.coinsEarned);

    const won = winner.isPlayer;
    if (SO.Audio && won) SO.Audio.sting(node.type === 'boss' ? 'boss_down' : 'victory');
    if (won && node.type === 'boss') ui.chipBurst(12);   // a boss falling is worth a small spill
    await ui.banner(won ? 'YOU SURVIVE' : 'SENT DOWN', '', won ? 'good' : 'bad', 900);
    if (!won) return gameOver(deathReason(duel, enemyDef));

    run.stats.duels++;
    if (duel.lastCall && SO.Profile) SO.Profile.award('last_stand'); // won a fight that went the distance
    if (enemyDef.hp > run.stats.toughestFoeHp) {
      run.stats.toughestFoe = enemyDef.name; run.stats.toughestFoeHp = enemyDef.hp; run.stats.toughestFoeRound = duel.roundNumber;
    }
    const coins = run.coinsFor(node);
    run.addCoins(coins);

    // In the Depths, fights pay coins but offer no card draft — falling is a
    // risk, not a shortcut to loot. Just head back to the depth map.
    if (run.inDepth) return showMap();
    if (node.type === 'boss') return bossVictory(coins);
    duelRewards(node, coins);
  }

  function duelRewards(node, coins) {
    const cards = run.cardReward();
    const relics = node.elite ? run.relicChoice(2) : null;
    let relicPicked = !node.elite;
    ui.showReward(run, {
      title: node.elite ? `The elite falls` : 'Victory',
      sub: `+<b>${coins}</b> coins.${node.elite ? ' Elites carry tribute — take a relic, then a card.' : ' Choose a card to draft, or skip.'}`,
      relics, cards,
    }, {
      pickRelic(i) { if (relicPicked) return; run.addRelic(relics[i]); relicPicked = true; $('reward-relics').classList.add('hidden'); ui.topbar(true); },
      pickCard(i) { run.addCard(cards[i]); showMap(); },
      skip() { showMap(); },
    });
  }

  function bossVictory(coins) {
    if (SO.Profile) { SO.Profile.bumpMilestone('bossesDown'); SO.Profile.award('first_boss'); }
    // Endless: beating an endless floor's boss drops you to the next floor.
    if (run.endless) {
      const healed = run.descend();
      const relics = run.relicChoice(2);
      ui.showActTransition(run, healed, relics, (i) => { run.addRelic(relics[i]); showMap(); });
      return;
    }
    // Boss-rush ("Boss" seed): all five bosses in a row on one map — advance
    // along the chain, heal a little, no act regen; victory after the fifth.
    if (run.bossRush) {
      const beaten = run.completedNodes.filter((id) => (run.map.byId[id] || {}).type === 'boss').length;
      if (beaten >= SO.ACTS.length) { run.won = true; return victory(); }
      const heal = Math.round(run.player.maxHp * SO.CONFIG.ACT_TRANSITION_HEAL_PCT);
      run.player.hp = Math.min(run.player.maxHp, run.player.hp + heal);
      const relics = run.relicChoice(2);
      ui.showActTransition(run, heal, relics, (i) => { run.addRelic(relics[i]); captureCheckpoint(); showMap(); });
      return;
    }
    const wasFinal = run.actIdx >= SO.ACTS.length - 1;
    if (wasFinal) { run.won = true; return victory(); }
    const before = run.player.hp;
    run.nextAct();
    const healed = run.player.hp - before;
    const relics = run.relicChoice(2);
    ui.showActTransition(run, healed, relics, (i) => { run.addRelic(relics[i]); showMap(); });
  }

  // ---------------- events ----------------
  function startEvent(node) {
    run.stats.events++;
    const ev = run.event();
    ui.showEvent(run, ev, () => {
      // follow-ups some events request
      if (run.pendingCardChoice) {
        const cards = run.pendingCardChoice; run.pendingCardChoice = null;
        ui.showReward(run, { title: 'The machine pays out', sub: 'Take one.', cards }, {
          pickCard(i) { run.addCard(cards[i]); showMap(); },
          skip() { showMap(); },
          pickRelic() {},
        });
        return;
      }
      if (run.pendingRemoval) {
        run.pendingRemoval = false;
        // closing without picking must still return to the map (no stranding)
        ui.pickFromDeck('Let one go — remove a card', () => true, (i) => { run.removeCard(i); showMap(); }, () => showMap());
        return;
      }
      if (run.pendingVault) { run.pendingVault = null; return fallToVault(); }
      if (run.pendingDepth) { const id = run.pendingDepth; run.pendingDepth = null; return fallToDepth(id); }
      showMap();
    });
  }

  // ---------------- shop ----------------
  function startShop(node) {
    const stock = run.rollShop();
    ui._noteSeen(stock.cards.map((c) => c.id));   // codex: the shelf counts as seen, once per visit
    ui.hint('shop', 'The Shop', 'Spend coins on cards and relics, or pay to REMOVE a weak card and thin your deck. The face-down gamble is a random relic — usually. Buy what fits your soul, then leave.');
    const refresh = () => ui.showShop(run, stock, handlers);
    const handlers = {
      buyCard(i) { const c = stock.cards[i]; if (!c || c.sold || !run.spendCoins(c.price)) return; run.addCard(c.id); c.sold = true; refresh(); },
      buyRelic(i) { const r = stock.relics[i]; if (!r || r.sold || !run.spendCoins(r.price)) return; run.addRelic(r.id); r.sold = true; refresh(); },
      remove() {
        if (run.coins < run.effectiveRemovalCost) return;
        ui.pickFromDeck(`Remove which card? (${run.effectiveRemovalCost}¢)`, () => true, (i) => {
          if (!run.spendCoins(run.effectiveRemovalCost)) return refresh();
          run.removeCard(i);
          run.removalCost += SO.CONFIG.CARD_REMOVAL_ESCALATION;
          refresh();
        });
      },
      facedown() {
        if (stock.facedownUsed || !run.spendCoins(SO.CONFIG.SHOP_FACEDOWN_CARD)) return;
        stock.facedownUsed = true;
        const id = SO.drawCardChoices(run.rng, 1)[0];
        run.addCard(id); ui._noteSeen([id]);
        $('shop-gamble-note').innerHTML = `The face-down card was <b>${SO.getCard(id).name}</b>. It's yours now.`;
        refresh();
      },
      lever() {
        if (stock.leverUsed || !run.spendCoins(SO.CONFIG.SHOP_LEVER)) return;
        stock.leverUsed = true;
        if (run.rng.next() < 0.75) {
          const id = run.randomRelic();
          $('shop-gamble-note').innerHTML = id ? `The lever clunks. A relic drops: <b>${SO.RELICS[id].name}</b>.` : 'The lever clunks. The hopper is empty.';
        } else {
          $('shop-gamble-note').innerHTML = 'The lever clunks. Nothing drops. The house thanks you.';
        }
        refresh();
      },
      leave() { showMap(); },
    };
    refresh();
  }

  // ---------------- rest ----------------
  function startRest(node) {
    run.stats.rests++;
    ui.showRest(run, {
      mend() { const h = run.rest('mend'); ui.restDone('rest-mend', `<b>Mended</b><span>+${h} HP</span>`); },
      sharpen() {
        ui.pickFromDeck('Sharpen which card?', (id) => !id.endsWith('+') && SO.getCard(id).type !== 'curse', (i) => {
          const up = run.upgradeCard(i);
          ui.restDone('rest-sharpen', `<b>Sharpened</b><span>${up ? SO.getCard(up).name : 'nothing'}</span>`);
        });
      },
      cleanse() { const id = run.rest('cleanse'); ui.restDone('rest-cleanse', `<b>Cleansed</b><span>${id ? SO.getCard(id).name + ' removed' : 'no curse'}</span>`); },
      leave() { showMap(); },
    });
  }

  // ---------------- endings ----------------
  /* Log the finished run to the profile's history (menu → RECORDS → History). */
  function recordRunHistory(won) {
    if (!SO.Profile || !run) return;
    const ch = run.character;
    SO.Profile.addRun({
      ts: Date.now(), seed: run.seed, won: !!won,
      score: ui._score(run.stats || {}, run, won),
      act: (run.actIdx || 0) + 1,
      soul: ch ? ch.name : 'The Gambler',
      ascension: run.ascension || 0,
      ascName: SO.ascensionInfo ? SO.ascensionInfo(run.ascension || 0).name : '',
      toughestFoe: (run.stats && run.stats.toughestFoe) || null,
      cheat: run.cheat || null,
    });
  }

  function victory() {
    let unlockedMsg = '';
    if (SO.Profile) {
      const before = SO.Profile.maxAscension();
      SO.Profile.recordWin(run.ascension || 0);
      const after = SO.Profile.maxAscension();
      if (after > before && SO.ascensionInfo) unlockedMsg = SO.ascensionInfo(after).name + ' unlocked';
      // milestones: a win counts toward the line style of the soul you brought
      const style = run.character ? run.character.style : 'pass';
      SO.Profile.bumpMilestone(style === 'dont' ? 'winDont' : 'winPass');
      if (run.character) SO.Profile.recordCharWin(run.character.id);
      // achievements
      SO.Profile.award('beat_house');
      if ((run.ascension || 0) >= 4) SO.Profile.award('damned_win');
      if ((run.ascension || 0) >= (SO.ASCENSION_MAX != null ? SO.ASCENSION_MAX : 9)) SO.Profile.award('ascend_v');
      if (!(run.stats && run.stats.pulls)) SO.Profile.award('iron_nerve');
      if (run.player.deck.length <= 10) SO.Profile.award('lean_deck');
      const cw = SO.Profile.charWins();
      if ((SO.CHARACTER_ORDER || []).every((id) => cw[id])) SO.Profile.award('four_faces');
      ui._renderSettings();
    }
    recordRunHistory(true);
    if (SO.Audio) SO.Audio.sting('victory');
    ui.endScreen({
      won: true, kicker: 'YOU BEAT',
      sub: unlockedMsg ? ('THE HOUSE BOWS · ' + unlockedMsg.toUpperCase()) : 'THE HOUSE BOWS. FOR NOW.',
      quote: '“You played the game. You broke the rules. But purgatory never closes.”',
      canDescend: !run.bossRush,   // offer the endless descent (not on boss-rush)
      fanfare: true,
    });
    ui.drainProfileToasts();
  }
  // Endless mode: leave The House behind and keep dropping floors for score.
  function startDescent() {
    $('end-screen').classList.add('hidden');
    run.descend();
    if (SO.Audio) SO.Audio.play('map');
    ui.banner('THE DESCENT', 'Floor ' + run.endlessDepth + ' — no way back up now.', 'bad', 1400);
    showMap();
  }
  // Loss-recovery: name what actually struck the killing blow, not just "outlasted you".
  function deathReason(duel, enemyDef) {
    const foe = enemyDef.name;
    const map = {
      bleed: duel.deathAtLastCall ? "Last Call's bleed ran you dry" : 'the bleed ran you dry',
      anger: "the House's Anger struck you down for going idle",
      cut: `${foe} made the point — the Cut finished you`,
      collect: `${foe} collected the debt in blood`,
      steal: `${foe} skimmed your chips down to nothing`,
      hex: `${foe}'s hex bled you out`,
      leech: `${foe} drained the life from you`,
      bet: 'you staked more than you could cover',
    };
    return (map[duel.deathCause] || `${foe} outlasted you`) + '.';
  }
  function gameOver(reason) {
    // Checkpoints (opt-in): rewind to the top of the current act instead of ending.
    // In-act spoils (cards/coins/HP earned since the last boss) are forfeit — the
    // snapshot is restored wholesale — so it softens the run without erasing stakes.
    if (ui.settings.checkpoints && checkpoint && !run.won) {
      run = SO.Run.deserialize(JSON.parse(checkpoint));
      lastSeed = run.seed; lastCheat = run.cheat || null;
      ui.setRun(run);
      if (SO.Audio) SO.Audio.sting('defeat');
      const where = run.bossRush ? 'the last floor' : 'the top of ' + run.act.name;
      ui.toast('♻️', 'Checkpoint', `${reason.replace(/\.$/, '')} — but the house drags you back to ${where}. Your run goes on; this floor’s spoils are forfeit.`);
      return showMap();
    }
    // Endless: the win is already banked; falling in the Descent just ends the
    // score chase (no second loss recorded, no checkpoint — endless is permadeath).
    if (run.endless) {
      if (SO.Audio) SO.Audio.sting('defeat');
      ui.endScreen({
        won: true, kicker: 'THE DESCENT TAKES YOU',
        sub: 'YOU FELL ON FLOOR ' + (run.endlessDepth || 1) + ' OF THE DESCENT',
        quote: '“Down and down. You beat the House — but the stairs never end.”',
      });
      return ui.drainProfileToasts();
    }
    recordRunHistory(false);
    if (SO.Audio) SO.Audio.sting('defeat');
    ui.endScreen({
      won: false, kicker: 'SENT DOWN', sub: reason.replace(/\.$/, '').toUpperCase(),
      quote: '“Another soul beats the odds. Until the next. The house remembers — so will you.”',
    });
    ui.drainProfileToasts();
  }
  function toMenu() {
    $('end-screen').classList.add('hidden');
    $('start-screen').classList.remove('hidden');
    refreshContinueBtn();
    if (SO.Audio) SO.Audio.play('menu');
  }

  // ---------------- save slots ----------------
  const SAVE_KEYS = ['awecrap_run_1', 'awecrap_run_2', 'awecrap_run_3'];
  let savesMode = 'save';
  let delConfirm = -1;   // slot index awaiting delete confirmation

  function readSlot(i) { try { return JSON.parse(localStorage.getItem(SAVE_KEYS[i]) || 'null'); } catch (e) { return null; } }
  function anySaves() { return SAVE_KEYS.some((k) => localStorage.getItem(k)); }
  function refreshContinueBtn() { const b = $('continue-btn'); if (b) b.classList.toggle('hidden', !anySaves()); }

  function saveToSlot(i) {
    if (!run) return;
    const D = (SO.ascensionInfo ? SO.ascensionInfo(run.difficultyIdx) : SO.DIFFICULTY[run.difficultyIdx]) || {};
    const meta = {
      title: run.bossRush ? 'The Gauntlet' : run.act.name,
      act: run.actIdx + 1, hp: run.player.hp, maxHp: run.player.maxHp,
      coins: run.coins, diff: D.name || '', cheat: run.cheat || null, ts: Date.now(),
    };
    try { localStorage.setItem(SAVE_KEYS[i], JSON.stringify({ meta, run: run.serialize() })); } catch (e) {}
  }
  function loadFromSlot(i) {
    const data = readSlot(i);
    if (!data || !data.run) return false;
    run = SO.Run.deserialize(data.run);
    if (!run.stats) run.stats = { rolls: 0, cards: 0, rounds: 0, duels: 0, rests: 0, events: 0, nodes: 0, pulls: 0, toughestFoe: null, toughestFoeHp: 0, toughestFoeRound: 0 };
    lastSeed = run.seed; lastCheat = run.cheat || null;
    ui.setRun(run);
    captureCheckpoint();   // treat the resume point as a checkpoint
    return true;
  }

  function returnToMenu() {
    ['map-screen', 'board', 'reward-screen', 'event-screen', 'act-screen', 'shop-screen', 'rest-screen', 'end-screen', 'pause-overlay', 'saves-overlay'].forEach((id) => { const e = $(id); if (e) e.classList.add('hidden'); });
    $('topbar').classList.add('hidden');
    $('start-screen').classList.remove('hidden');
    refreshContinueBtn();
    if (SO.Audio) SO.Audio.play('menu');
  }

  function openSaves(mode) {
    savesMode = mode; delConfirm = -1;
    $('saves-title').textContent = mode === 'save' ? 'Save & Quit' : 'Continue a Run';
    $('saves-sub').textContent = mode === 'save' ? 'Pick a slot to save into (a filled slot is overwritten). 🗑 deletes.' : 'Pick a run to continue. 🗑 deletes a slot.';
    renderSaveSlots();
    $('saves-overlay').classList.remove('hidden');
  }
  function renderSaveSlots() {
    const host = $('save-slots'); host.innerHTML = '';
    for (let i = 0; i < SAVE_KEYS.length; i++) {
      const data = readSlot(i);
      const filled = !!(data && data.meta);
      const slot = document.createElement('div');
      slot.className = 'save-slot' + (filled ? ' filled' : ' empty') + (savesMode === 'load' && !filled ? ' disabled' : '');
      const main = document.createElement('button');
      main.className = 'ss-click';
      main.disabled = (savesMode === 'load' && !filled);
      if (filled) {
        const m = data.meta; const w = new Date(m.ts);
        main.innerHTML = `<div class="ss-main"><b>Slot ${i + 1}</b><span class="ss-loc">${m.title}${m.cheat ? ` · <i>${m.cheat}</i>` : ''}</span></div>
          <div class="ss-stat">Act ${m.act} · ♥ ${m.hp}/${m.maxHp} · ◎ ${m.coins}${m.diff ? ' · ' + m.diff : ''}</div>
          <div class="ss-when">${w.toLocaleDateString()} ${w.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>`;
      } else {
        main.innerHTML = `<div class="ss-main"><b>Slot ${i + 1}</b><span class="ss-loc">— empty —</span></div>`;
      }
      main.onclick = () => onSlotClick(i, filled);
      slot.appendChild(main);
      if (filled) {
        if (delConfirm === i) {
          const conf = document.createElement('div'); conf.className = 'ss-delconfirm';
          const yes = document.createElement('button'); yes.className = 'ss-del-yes'; yes.textContent = 'Delete';
          yes.onclick = (e) => { e.stopPropagation(); deleteSlot(i); };
          const no = document.createElement('button'); no.className = 'ss-del-no'; no.textContent = 'Keep';
          no.onclick = (e) => { e.stopPropagation(); delConfirm = -1; renderSaveSlots(); };
          conf.appendChild(document.createElement('span')).textContent = 'Delete?';
          conf.appendChild(yes); conf.appendChild(no);
          slot.appendChild(conf);
        } else {
          const del = document.createElement('button'); del.className = 'ss-del'; del.title = 'Delete this save'; del.textContent = '🗑';
          del.onclick = (e) => { e.stopPropagation(); delConfirm = i; renderSaveSlots(); };
          slot.appendChild(del);
        }
      }
      host.appendChild(slot);
    }
  }
  function deleteSlot(i) {
    try { localStorage.removeItem(SAVE_KEYS[i]); } catch (e) {}
    delConfirm = -1; refreshContinueBtn();
    if (savesMode === 'load' && !anySaves()) { $('saves-overlay').classList.add('hidden'); returnToMenu(); return; }
    renderSaveSlots();
  }
  function onSlotClick(i, filled) {
    if (savesMode === 'save') { saveToSlot(i); returnToMenu(); }
    else if (filled) { $('saves-overlay').classList.add('hidden'); if (loadFromSlot(i)) { $('start-screen').classList.add('hidden'); $('end-screen').classList.add('hidden'); showMap(); } }
  }

  function quitGame() {
    if (SO.Audio && SO.Audio.stop) SO.Audio.stop();
    window.close();
    setTimeout(() => $('quit-overlay').classList.remove('hidden'), 150);
  }

  // ---------------- wipe all data ----------------
  // Erase every key this game owns (anything prefixed awecrap_ — saves, settings,
  // tutorial/free-play progress, the seen-update flag, and the profile) then hard-
  // reload so the game boots exactly as it would on a first-ever launch.
  function wipeAllData() {
    try {
      const doomed = [];
      for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.indexOf('awecrap_') === 0) doomed.push(k); }
      doomed.forEach((k) => { try { localStorage.removeItem(k); } catch (e) {} });
    } catch (e) {}
    if (SO.Audio && SO.Audio.stop) SO.Audio.stop();
    try { location.reload(); } catch (e) { location.href = location.pathname; }
  }
  function wireWipe() {
    const btn = $('wipe-data-btn'), confirm = $('wipe-confirm'), yes = $('wipe-yes'), no = $('wipe-no');
    if (!btn || !confirm) return;
    const reset = () => { confirm.classList.add('hidden'); btn.classList.remove('hidden'); };
    btn.addEventListener('click', () => { confirm.classList.remove('hidden'); btn.classList.add('hidden'); try { confirm.scrollIntoView({ block: 'nearest' }); } catch (e) {} });
    if (no) no.addEventListener('click', reset);
    if (yes) yes.addEventListener('click', wipeAllData);
    // reset the confirm each time Settings opens, so it never re-opens mid-confirm
    const setBtn = document.querySelector('[data-modal="modal-settings"]');
    if (setBtn) setBtn.addEventListener('click', reset);
  }

  // ---------------- run modifiers ----------------
  function updateModsCount() { const el = $('mods-count'); if (el) el.textContent = selectedMods.length ? (selectedMods.length + (selectedMods.length === 1 ? ' on' : ' on')) : 'None'; }
  function renderModifiers() {
    const host = $('mod-choices'); if (!host || !SO.RUN_MODIFIERS) return;
    host.innerHTML = '';
    SO.RUN_MODIFIERS.forEach((m) => {
      const on = selectedMods.indexOf(m.id) >= 0;
      const btn = document.createElement('button');
      btn.className = 'mod-choice' + (on ? ' on' : '');
      btn.innerHTML = `<span class="mod-ico">${m.icon}</span><span class="mod-body"><b>${m.name} <em>×${m.scoreMult.toFixed(2)}</em></b><span>${m.desc}</span></span><span class="mod-check">${on ? '✓' : ''}</span>`;
      btn.onclick = () => { const i = selectedMods.indexOf(m.id); if (i >= 0) selectedMods.splice(i, 1); else selectedMods.push(m.id); saveMods(); renderModifiers(); updateModsCount(); };
      host.appendChild(btn);
    });
    const mult = selectedMods.reduce((p, id) => p * ((SO.MODIFIER_BY_ID[id] || {}).scoreMult || 1), 1);
    const sc = $('mod-score'); if (sc) sc.textContent = selectedMods.length ? `${selectedMods.length} active · score ×${mult.toFixed(2)}` : 'No modifiers — a standard run.';
  }

  // ---------------- character (soul) select ----------------
  function updateSoulName() { const c = SO.CHARACTERS && SO.CHARACTERS[selectedChar]; if (c && $('soul-name')) $('soul-name').textContent = c.name; }
  function soulLocked(id) { return !!(SO.isUnlocked && !SO.isUnlocked(id)); }
  function renderCharChoices() {
    const host = $('char-choices'); if (!host || !SO.CHARACTERS) return;
    host.innerHTML = '';
    (SO.CHARACTER_ORDER || Object.keys(SO.CHARACTERS)).forEach((id) => {
      const c = SO.CHARACTERS[id];
      const btn = document.createElement('button');
      if (soulLocked(id)) {
        // earned, not given — show the name and exactly how to get them
        const u = (SO.UNLOCK_BY_ID || {})[id] || {};
        const have = SO.Profile ? SO.Profile.milestone(u.req) : 0;
        const prog = u.n ? ` · ${Math.min(have, u.n)}/${u.n} ${(SO.MILESTONE_LABEL || {})[u.req] || u.req}` : '';
        btn.className = 'char-choice locked';
        btn.disabled = true;
        btn.innerHTML = `<span class="char-ico">🔒</span>
          <div class="char-body"><b>${c.name}</b><span class="char-blurb">A soul you haven’t earned yet.</span>
          <span class="char-meta">Unlock: ${u.hint || '—'}${prog}</span></div>`;
      } else {
        const relics = (c.relics || []).map((r) => (SO.RELICS[r] || {}).name).filter(Boolean).join(', ');
        btn.className = 'char-choice' + (id === selectedChar ? ' sel' : '');
        btn.innerHTML = `<span class="char-ico">${c.icon}</span>
          <div class="char-body"><b>${c.name}</b><span class="char-blurb">${c.blurb}</span>
          <span class="char-meta">${c.deck.length} cards · ${c.style === 'dont' ? "Don't" : 'Pass'} line${relics ? ' · ' + relics : ''}</span></div>`;
        btn.onclick = () => { selectedChar = id; if (SO.Profile) SO.Profile.setLastChar(id); updateSoulName(); renderCharChoices(); };
      }
      host.appendChild(btn);
    });
  }

  $('begin-btn').addEventListener('click', () => startRun());
  $('btn-again-seed').addEventListener('click', () => startRun(lastSeed));
  $('btn-new-run').addEventListener('click', () => { $('seed-input').value = ''; startRun(); });
  $('btn-menu').addEventListener('click', toMenu);
  $('btn-descend').addEventListener('click', startDescent);
  $('seed-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') startRun(); });

  // save slots + pause + quit
  $('map-menu-btn').addEventListener('click', () => $('pause-overlay').classList.remove('hidden'));
  $('pause-resume').addEventListener('click', () => $('pause-overlay').classList.add('hidden'));
  $('pause-save').addEventListener('click', () => { $('pause-overlay').classList.add('hidden'); openSaves('save'); });
  $('pause-abandon').addEventListener('click', () => { $('pause-overlay').classList.add('hidden'); returnToMenu(); });
  $('saves-x').addEventListener('click', () => $('saves-overlay').classList.add('hidden'));
  $('continue-btn').addEventListener('click', () => openSaves('load'));
  $('quit-btn').addEventListener('click', quitGame);
  $('quit-back').addEventListener('click', () => { $('quit-overlay').classList.add('hidden'); if (SO.Audio) SO.Audio.play('menu'); });
  // LEARN chooser → written guide or the playable tutorial
  $('learn-read').addEventListener('click', () => { $('modal-learn').classList.add('hidden'); if (SO.Tutor) SO.Tutor.open(); });
  $('learn-play').addEventListener('click', () => { $('modal-learn').classList.add('hidden'); if (SO.PlayTutorial) SO.PlayTutorial.open(); });
  // soul select
  $('soul-btn').addEventListener('click', renderCharChoices);
  renderCharChoices(); updateSoulName();
  // run modifiers
  $('mods-btn').addEventListener('click', renderModifiers);
  renderModifiers(); updateModsCount();
  // records (achievements / unlocks / history)
  $('records-btn').addEventListener('click', () => ui.renderRecords());
  document.querySelectorAll('.rec-tab').forEach((b) => b.addEventListener('click', () => ui.renderRecords(b.dataset.rec)));
  wireWipe();
  refreshContinueBtn();

  // menu theme from the first moment (deferred until the first click/keypress
  // by the browser's autoplay policy — SO.Audio handles the unlock).
  if (SO.Audio) SO.Audio.play('menu');

  // URL helpers for testing: ?fast=0 instant, ?seed=N, ?auto=1, ?diff=0..MAX (also unlocks that rung)
  const params = new URLSearchParams(location.search);
  if (params.get('fast') != null) ui.speed = parseFloat(params.get('fast')) || 0;
  if (params.has('seed')) $('seed-input').value = params.get('seed');
  if (params.has('diff')) {
    const dmax = SO.ASCENSION_MAX != null ? SO.ASCENSION_MAX : 4;
    const dv = Math.max(0, Math.min(dmax, parseInt(params.get('diff'), 10) || 0));
    // a debug ?diff also unlocks that rung so the gated slider can reach it
    if (SO.Profile) SO.Profile.unlockAscension(dv);
    ui.settings.difficulty = dv; ui._saveSettings(); ui._renderSettings();
  }
  if (params.get('auto')) startRun();
  window.__ui = ui; window.__getRun = () => run; window.__onPick = onPick;

  // ---- crash resilience: a friendly screen instead of a frozen board ----
  // The run is driven by fire-and-forget async calls, so an in-run throw surfaces
  // as an unhandled rejection (or a window error) — both are caught here.
  window.addEventListener('error', (e) => { if (run && !run.won) showCrash(e.error || e.message); });
  window.addEventListener('unhandledrejection', (e) => { if (run && !run.won) showCrash(e.reason); });
  $('crash-copy').addEventListener('click', () => {
    const txt = $('crash-seed').textContent;
    const done = () => { $('crash-copy').textContent = 'Copied!'; };
    try { if (navigator.clipboard) navigator.clipboard.writeText(txt).then(done, () => ui._fallbackCopy(txt, done)); else ui._fallbackCopy(txt, done); } catch (e) { ui._fallbackCopy(txt, done); }
  });
  $('crash-menu').addEventListener('click', () => { crashed = false; run = null; $('crash-screen').classList.add('hidden'); toMenu(); });
  window.__crashTest = (msg) => showCrash(new Error(msg || 'test'));   // manual crash-screen probe
})();
