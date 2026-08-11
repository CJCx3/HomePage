/* AWECRAP — run.js
 * The run across all five acts: map generation (duel/elite/event/shop/rest/boss
 * nodes), HP/deck/relic persistence, difficulty scaling, rewards, events,
 * the shop (cards, relics, removal, the casino gamble) and rest fires
 * (Mend / Sharpen / Cleanse). Pure logic — no DOM.
 */
window.SO = window.SO || {};

(function () {
  const CFG = () => SO.CONFIG;

  function generateMap(rng, act) {
    const rows = act.rows || CFG().ACT_ROWS;   // depths override with a shorter map
    const grid = [];
    let idc = 0;
    for (let r = 0; r < rows; r++) {
      let count;
      if (r === rows - 1) count = 1;
      else if (r === 0) count = rng.int(2, 3);
      else count = rng.int(CFG().NODES_PER_ROW_MIN, CFG().NODES_PER_ROW_MAX);
      const rowNodes = [];
      for (let cc = 0; cc < count; cc++) rowNodes.push({ id: 'a' + act.n + 'n' + (idc++), row: r, col: cc, edges: [], type: null, enemy: null, elite: false });
      grid.push(rowNodes);
    }

    for (let r = 0; r < rows - 1; r++) {
      const cur = grid[r], nxt = grid[r + 1];
      for (const node of cur) {
        const frac = cur.length > 1 ? node.col / (cur.length - 1) : 0.5;
        const center = Math.round(frac * (nxt.length - 1));
        const targets = new Set([center]);
        if (rng.next() < 0.5 && center + 1 < nxt.length) targets.add(center + 1);
        if (rng.next() < 0.4 && center - 1 >= 0) targets.add(center - 1);
        for (const t of targets) if (!node.edges.includes(nxt[t].id)) node.edges.push(nxt[t].id);
      }
      for (let cc = 0; cc < nxt.length; cc++) {
        if (!cur.some((n) => n.edges.includes(nxt[cc].id))) {
          const srcCol = Math.round((nxt.length > 1 ? cc / (nxt.length - 1) : 0.5) * (cur.length - 1));
          cur[srcCol].edges.push(nxt[cc].id);
        }
      }
    }

    assignTypes(grid, rng, act);
    const byId = {};
    for (const row of grid) for (const n of row) byId[n.id] = n;
    return { rows: grid, byId, rowCount: rows };
  }

  function assignTypes(grid, rng, act) {
    const rows = grid.length;
    if (act.depth) return assignDepthTypes(grid, rng, act);
    let hasShop = false, hasRest = false, elites = 0;
    for (let r = 0; r < rows; r++) {
      for (const n of grid[r]) {
        if (r === rows - 1) { n.type = 'boss'; continue; }
        if (r === 0) { n.type = 'duel'; n.enemy = act.enemies[0]; continue; }
        if (r === rows - 2) {
          n.type = (n.col === 0) ? 'rest' : (rng.next() < 0.35 ? 'shop' : 'duel');
        } else {
          const x = rng.next();
          if (x < 0.40) n.type = 'duel';
          else if (x < 0.53 && r >= 2 && elites < 2) { n.type = 'elite'; elites++; }
          else if (x < 0.70) n.type = 'event';
          else if (x < 0.88) n.type = 'rest';   // a touch more recovery — the run is a gauntlet
          else n.type = 'shop';
        }
        if (n.type === 'shop') hasShop = true;
        if (n.type === 'rest') hasRest = true;
        if (n.type === 'duel' || n.type === 'elite') {
          const depth = r / Math.max(1, rows - 2);
          const pool = act.enemies;
          const idx = Math.min(pool.length - 1, Math.floor(depth * pool.length + rng.next() * 1.4));
          n.enemy = pool[Math.max(0, Math.min(pool.length - 1, idx))];
          n.elite = n.type === 'elite';
          // each elite gets a signature gimmick, fixed by the seed (survives save)
          if (n.elite && SO.ELITE_GIMMICKS && SO.ELITE_GIMMICKS.length) {
            n.gimmick = SO.ELITE_GIMMICKS[rng.int(0, SO.ELITE_GIMMICKS.length - 1)].id;
          }
        }
      }
    }
    const mid = grid[Math.max(1, Math.floor(rows / 2))];
    if (!hasShop) { mid[0].type = 'shop'; mid[0].enemy = null; mid[0].elite = false; }
    if (!hasRest) { const row = grid[rows - 2]; row[row.length - 1].type = 'rest'; row[row.length - 1].enemy = null; }
  }

  // A Depth is a short fight-out: duels + one rest, capped by an EXIT node (the
  // climb back up). No events, shops, elites or bosses — you just claw your way out.
  function assignDepthTypes(grid, rng, act) {
    const rows = grid.length;
    const pool = act.enemies;
    let restPlaced = false;
    for (let r = 0; r < rows; r++) {
      for (const n of grid[r]) {
        if (r === rows - 1) { n.type = 'exit'; n.enemy = null; continue; }
        // one rest tucked into the middle for a breather
        if (!restPlaced && r === Math.floor(rows / 2) && n.col === 0) { n.type = 'rest'; n.enemy = null; restPlaced = true; continue; }
        n.type = 'duel';
        const idx = Math.min(pool.length - 1, Math.floor((r / Math.max(1, rows - 2)) * pool.length + rng.next() * 0.9));
        n.enemy = pool[Math.max(0, Math.min(pool.length - 1, idx))];
        n.elite = false;
      }
    }
  }

  /* ===================== Events (the "?" nodes) ===================== */
  SO.EVENTS = [
    {
      id: 'beggar', title: 'A Beggar Soul', text: 'A soul with no chips left crouches by the rail. "Spare something. Anything. I\'ll remember you."',
      choices: [
        { label: 'Give 15 coins', hint: 'Gain a random relic', can: (run) => run.coins >= 15, effect(run) { run.spendCoins(15); const id = run.randomRelic(); return id ? `They press something into your palm: ${SO.RELICS[id].name}.` : 'They had nothing to give after all.'; } },
        { label: 'Give 5 HP', hint: 'Gain 25 coins', can: (run) => run.player.hp > 5, effect(run) { run.player.hp -= 5; run.addCoins(25); return 'They sell your blood to someone upstairs. You get a cut: +25 coins.'; } },
        { label: 'Walk past', hint: 'Nothing happens', effect() { return 'Their eyes follow you all the way to the stairs.'; } },
      ],
    },
    {
      id: 'backroom', title: 'High-Stakes Backroom', text: 'A velvet door hangs open. Inside, one roll of the dice decides everything.',
      choices: [
        { label: 'Wager 20 HP', hint: 'Roll 7+: win 45 coins. Under: lose the HP.', can: (run) => run.player.hp > 20, effect(run) { const r = run.rng.roll(); if (r.total >= 7) { run.addCoins(45); return `The bones come up ${r.total}. The room pays out: +45 coins.`; } run.player.hp = Math.max(1, run.player.hp - 20); return `The bones come up ${r.total}. The room keeps your blood.`; } },
        { label: 'Decline', hint: 'Nothing happens', effect() { return 'The door swings shut behind you.'; } },
      ],
    },
    {
      id: 'card_sharp', title: 'The Card Sharp', text: 'A thin man shuffles cards that aren\'t his. "Yours look dull. Let me sharpen one."',
      choices: [
        { label: 'Let him', hint: 'Upgrade a random card', can: (run) => run.player.deck.some((id) => !id.endsWith('+') && SO.getCard(id).type !== 'curse'), effect(run) { const i = run.upgradeRandomCard(); return i ? `He hands back ${SO.getCard(i).name}. It hums.` : 'Nothing he could work with.'; } },
        { label: 'Pay 20 coins', hint: 'Upgrade TWO random cards', can: (run) => run.coins >= 20, effect(run) { run.spendCoins(20); const a = run.upgradeRandomCard(); const b = run.upgradeRandomCard(); return `He works quickly: ${[a, b].filter(Boolean).map((x) => SO.getCard(x).name).join(', ') || 'nothing sharpened'}.`; } },
        { label: 'Keep walking', hint: 'Nothing happens', effect() { return '"Suit yourself," he says, to someone else\'s cards.'; } },
      ],
    },
    {
      id: 'lost_found', title: 'Lost & Found', text: 'A tray of unclaimed valuables sits unattended. Souls lose things here all the time.',
      choices: [
        { label: 'Take something', hint: 'Random relic, but gain a Bad Beat curse', effect(run) { const id = run.randomRelic(); run.player.deck.push('bad_beat'); return id ? `You pocket ${SO.RELICS[id].name}. Something pockets a piece of you: Bad Beat joins your deck.` : 'The tray was empty. The curse was not: Bad Beat joins your deck.'; } },
        { label: 'Leave it', hint: 'Nothing happens', effect() { return 'Whatever was lost stays lost.'; } },
      ],
    },
    {
      id: 'chapel', title: 'The Chapel of Chance', text: 'A shrine to the odds themselves. Cleansing is offered — for a price paid in flesh.',
      choices: [
        { label: 'Kneel', hint: 'Remove ALL curses; lose 25% of max HP', can: (run) => run.player.deck.some((id) => SO.getCard(id) && SO.getCard(id).type === 'curse'), effect(run) { const before = run.player.deck.length; run.player.deck = run.player.deck.filter((id) => SO.getCard(id).type !== 'curse'); const cut = Math.floor(run.player.maxHp * 0.25); run.player.hp = Math.max(1, run.player.hp - cut); return `${before - run.player.deck.length} curse(s) burn away. So does ${cut} HP.`; } },
        { label: 'Light a candle', hint: 'Heal 10', effect(run) { run.player.hp = Math.min(run.player.maxHp, run.player.hp + 10); return 'The flame steadies. +10 HP.'; } },
        { label: 'Leave', hint: 'Nothing happens', effect() { return 'The odds watch you go.'; } },
      ],
    },
    {
      id: 'loan_shark', title: 'The Loan Shark', text: '"Coins now, friend. The vig? We\'ll discuss the vig later."',
      choices: [
        { label: 'Take the loan', hint: '+40 coins, gain Trembling Hands', effect(run) { run.addCoins(40); run.player.deck.push('trembling_hands'); return '+40 coins. Your hands won\'t stop shaking: Trembling Hands joins your deck.'; } },
        { label: 'Refuse', hint: 'Nothing happens', effect() { return '"Everyone comes back," he says.'; } },
      ],
    },
    {
      id: 'vending', title: 'The Broken Vending Machine', text: 'A machine older than the building dispenses cards instead of cigarettes. It is jammed open.',
      choices: [
        { label: 'Reach in', hint: 'A free card (choice of 3)', effect(run) { run.pendingCardChoice = SO.drawCardChoices(run.rng, 3); return null; } },
        { label: 'Leave it', hint: 'Nothing happens', effect() { return 'It hums at you, disappointed.'; } },
      ],
    },
    {
      id: 'bone_polisher', title: 'The Bone Polisher', text: 'An old woman polishes dice that gleam like teeth. "Bring me your tools, dear."',
      choices: [
        { label: 'Hand over your dice', hint: 'Upgrade a random ROLL card; heal 5', effect(run) { const id = run.upgradeRandomCard('roll'); run.player.hp = Math.min(run.player.maxHp, run.player.hp + 5); return id ? `${SO.getCard(id).name} comes back gleaming. +5 HP.` : 'She finds nothing to polish, but pats your hand. +5 HP.'; } },
        { label: 'Decline', hint: 'Nothing happens', effect() { return 'She goes back to her teeth. Dice. Her dice.'; } },
      ],
    },
    {
      id: 'familiar_face', title: 'A Familiar Face', text: 'Someone you knew, alive. They look through you, then almost — almost — remember.',
      choices: [
        { label: 'Sit with them', hint: 'Heal 20% of max HP', effect(run) { const h = Math.floor(run.player.maxHp * 0.2); run.player.hp = Math.min(run.player.maxHp, run.player.hp + h); return `For a while, the bleeding just... stops. +${h} HP.`; } },
        { label: 'Let go of them', hint: 'Remove any card from your deck', effect(run) { run.pendingRemoval = true; return null; } },
      ],
    },
    {
      id: 'pit_fight', title: 'The Undercard', text: 'Two souls duel for scraps while a crowd jeers. A bookmaker eyes you: "Fancy a side action?"',
      choices: [
        { label: 'Bet 15 coins on Red', hint: '50/50: double or nothing', can: (run) => run.coins >= 15, effect(run) { run.spendCoins(15); if (run.rng.next() < 0.5) { run.addCoins(30); return 'Red takes it in three rounds. +30 coins.'; } return 'Red busts on a cold 7. Your coins ride off with the crowd.'; } },
        { label: 'Watch for free', hint: 'Nothing happens', effect() { return 'Blue wins. You\'d have lost anyway. Probably.'; } },
      ],
    },
    {
      id: 'the_tab', title: 'On the House', text: 'The bartender slides a whiskey down the felt without being asked. "First one\'s free, friend. First one always is."',
      choices: [
        { label: 'Drink', hint: 'Heal 12 — but the tab might come due', effect(run) { run.player.hp = Math.min(run.player.maxHp, run.player.hp + 12); if (run.rng.next() < 0.4) { run.player.deck.push('bad_beat'); return 'Warmth floods you: +12 HP. Then the room tilts a little wrong — Bad Beat joins your deck.'; } return 'Warmth floods you: +12 HP. Tonight, at least, it\'s on the house.'; } },
        { label: 'Pour it out', hint: 'Nothing happens', effect() { return 'The whiskey hisses on the felt. The bartender only shrugs.'; } },
      ],
    },
    {
      id: 'shell_game', title: 'The Shell Game', text: 'Three cups, one bead, and a huckster whose hands are faster than your eye. "Watch close now."',
      choices: [
        { label: 'Play — 10 coins', hint: '1-in-3: win 35 coins', can: (run) => run.coins >= 10, effect(run) { run.spendCoins(10); if (run.rng.int(0, 2) === 0) { run.addCoins(35); return 'You call the middle cup. Against all odds, the bead is there. +35 coins.'; } return 'The bead was never under any of them. It never is.'; } },
        { label: 'Walk away', hint: 'Nothing happens', effect() { return 'The cups keep shuffling, waiting for the next mark.'; } },
      ],
    },
    {
      id: 'the_understudy', title: 'The Understudy', text: 'A hollow-eyed soul steps close. "I\'ll carry your worst habit a while. I\'ve nothing left to lose."',
      choices: [
        { label: 'Hand one over', hint: 'Remove a single curse from your deck', can: (run) => run.player.deck.some((id) => SO.getCard(id) && SO.getCard(id).type === 'curse'), effect(run) { const i = run.player.deck.findIndex((id) => SO.getCard(id) && SO.getCard(id).type === 'curse'); if (i >= 0) { const nm = SO.getCard(run.player.deck[i]).name; run.removeCard(i); return `${nm} slides off your shoulders and onto theirs. They almost smile.`; } return 'You search yourself and find nothing to give.'; } },
        { label: 'Keep your burden', hint: 'Nothing happens', effect() { return '"Suit yourself," they whisper, and fold back into the crowd.'; } },
      ],
    },
    {
      id: 'the_vault', title: 'The Blood Vault', text: 'A locked strongbox sits on a side table, its keyhole rusted the colour of old wounds. The key, it seems, is pain.',
      choices: [
        { label: 'Pay 15 HP', hint: 'Gain a random relic', can: (run) => run.player.hp > 15, effect(run) { run.player.hp = Math.max(1, run.player.hp - 15); const id = run.randomRelic(); return id ? `The lock tastes your blood and springs open: ${SO.RELICS[id].name}.` : 'The box swings open on nothing. The price was not refunded.'; } },
        { label: 'Leave it locked', hint: 'Nothing happens', effect() { return 'Some boxes are kinder left shut.'; } },
      ],
    },
    {
      id: 'crossroads_card', title: 'Neon in the Gutter', text: 'A single card floats face-down in a puddle of spilled neon light. It hums as you reach for it.',
      choices: [
        { label: 'Fish it out', hint: 'A free card (choice of 3) — but the neon burns for 6 HP', can: (run) => run.player.hp > 6, effect(run) { run.player.hp = Math.max(1, run.player.hp - 6); run.pendingCardChoice = SO.drawCardChoices(run.rng, 3); return null; } },
        { label: 'Leave it', hint: 'Nothing happens', effect() { return 'The light gutters out. Whatever it was, it stays lost.'; } },
      ],
    },
    {
      id: 'generous_ghost', title: 'The Generous Ghost', text: 'A pale soul presses coins into your hand and asks for nothing at all. In this place, nothing is exactly the price to fear.',
      choices: [
        { label: 'Accept the coins', hint: '+30 coins — probably', effect(run) { run.addCoins(30); if (run.rng.next() < 0.35) { run.player.deck.push('bad_beat'); return '+30 coins. The ghost smiles a touch too wide — Bad Beat slips into your deck.'; } return '+30 coins, and the ghost drifts off, satisfied. Strange, to be given anything here.'; } },
        { label: 'Refuse kindly', hint: 'Heal 5', effect(run) { run.player.hp = Math.min(run.player.maxHp, run.player.hp + 5); return 'The ghost nods, grateful just to be seen. A little of your ache lifts. +5 HP.'; } },
      ],
    },
    {
      id: 'the_forge', title: 'The Back-Room Forge', text: 'A furnace glows behind the bar. The smith wipes his hands. "Feed the fire, and what comes out comes out stronger. It just costs a little heat."',
      choices: [
        { label: 'Feed the furnace', hint: 'Upgrade TWO random cards; lose 8 HP', can: (run) => run.player.hp > 8 && run.player.deck.some((id) => !id.endsWith('+') && SO.getCard(id).type !== 'curse'), effect(run) { run.player.hp = Math.max(1, run.player.hp - 8); const a = run.upgradeRandomCard(); const b = run.upgradeRandomCard(); const names = [a, b].filter(Boolean).map((x) => SO.getCard(x).name).join(', '); return names ? `The furnace roars: ${names} come out gleaming. −8 HP.` : 'The fire finds nothing worth forging. −8 HP for the trouble.'; } },
        { label: 'Stay cold', hint: 'Nothing happens', effect() { return 'The smith lets the fire die back down. "Another time, maybe."'; } },
      ],
    },
    {
      id: 'street_medic', title: 'The Street Medic', text: 'A medic waves you over between fights, needle already threaded. "You\'re leaking, friend. Sit. Cheap at the price."',
      choices: [
        { label: 'Patch up — 15 coins', hint: 'Heal 25', can: (run) => run.coins >= 15, effect(run) { run.spendCoins(15); const h = Math.min(run.player.maxHp, run.player.hp + 25) - run.player.hp; run.player.hp += h; return `Gauze, gin, and a steady hand. +${h} HP.`; } },
        { label: 'Tough it out', hint: 'Nothing happens', effect() { return 'You wave the medic off. The wound stays yours to carry.'; } },
      ],
    },
    {
      id: 'confession', title: 'The Confession Booth', text: 'A booth stands where a booth has no business being. A voice from behind the screen: "Unburden yourself, soul. It helps. It always helps."',
      choices: [
        { label: 'Confess a card', hint: 'Remove any card; heal 8', effect(run) { run.player.hp = Math.min(run.player.maxHp, run.player.hp + 8); run.pendingRemoval = true; return null; } },
        { label: 'Say nothing', hint: 'Nothing happens', effect() { return 'You keep your sins. The booth waits, patient as the grave.'; } },
      ],
    },

    // ---- GAMBITS: reach for a relic, but 3-in-4 you fall into the Depths.
    //      Only surface past the first boss (gated in Run.event). ----
    {
      id: 'gambit_ravine', title: 'The Crumbling Ledge', gambit: true,
      text: 'A relic glints on a ledge that juts out over a black ravine. The stone under it looks like it might hold your weight. It might not.',
      choices: [
        { label: 'Reach for it', hint: '1-in-4: a relic. Otherwise you fall into the Ravine.', effect(run) { return run.gambitRoll('ravine'); } },
        { label: 'Back away', hint: 'Nothing happens', effect() { return 'You step back from the edge. Some prizes aren\'t worth the drop.'; } },
      ],
    },
    {
      id: 'gambit_sewers', title: 'The Grate', gambit: true,
      text: 'Something valuable is wedged in a storm grate, just out of reach, over a long dark drop into the sewers below. You could squeeze an arm in…',
      choices: [
        { label: 'Squeeze your arm in', hint: '1-in-4: a relic. Otherwise you drop into the Sewers.', effect(run) { return run.gambitRoll('sewers'); } },
        { label: 'Leave it', hint: 'Nothing happens', effect() { return 'You pull your arm back. Whatever it was, the sewer keeps it.'; } },
      ],
    },
    {
      id: 'gambit_cistern', title: 'The Murky Pool', gambit: true,
      text: 'A relic winks up at you from the bottom of a flooded cistern, wavering under black water. You would have to dive for it. Deep.',
      choices: [
        { label: 'Dive for it', hint: '1-in-4: a relic. Otherwise the water takes you down.', effect(run) { return run.gambitRoll('cistern'); } },
        { label: 'Stay dry', hint: 'Nothing happens', effect() { return 'You watch it shimmer and let it lie. The water is patient.'; } },
      ],
    },
    {
      id: 'gambit_catacomb', title: 'The Loose Slab', gambit: true,
      text: 'A stone in the floor rocks under your heel, and a glint shows through the crack — someone was buried with their winnings. The crypt below is a long way down.',
      choices: [
        { label: 'Pry it up', hint: '1-in-4: a relic. Otherwise you drop into the Catacombs.', effect(run) { return run.gambitRoll('catacomb'); } },
        { label: 'Step over it', hint: 'Nothing happens', effect() { return 'You leave the dead their due and walk on.'; } },
      ],
    },
    {
      id: 'gambit_boiler', title: 'The Hot Vent', gambit: true,
      text: 'A relic sits on a ledge above a grate that breathes furnace heat from the boiler room below. Reach across and it is yours — if the grate holds.',
      choices: [
        { label: 'Reach across', hint: '1-in-4: a relic. Otherwise you drop into the Boiler Room.', effect(run) { return run.gambitRoll('boiler'); } },
        { label: 'Not worth the burn', hint: 'Nothing happens', effect() { return 'You back off. The heat wins this one.'; } },
      ],
    },
  ];

  /* ===================== The Run ===================== */
  class Run {
    constructor(seed, difficultyIdx, character) {
      this.seed = seed >>> 0;
      this.rng = SO.makeRNG(this.seed);
      this.difficultyIdx = difficultyIdx != null ? difficultyIdx : SO.DEFAULT_DIFFICULTY;
      // difficultyIdx doubles as the ascension level (0..SO.ASCENSION_MAX): 0-4
      // are the base difficulties, 5+ are the escalating Ascension rungs.
      this.ascension = this.difficultyIdx;
      this.diff = SO.ascensionInfo ? SO.ascensionInfo(this.difficultyIdx).diff : SO.DIFFICULTY[Math.min(this.difficultyIdx, SO.DIFFICULTY.length - 1)];
      this.actIdx = 0;
      this.map = generateMap(this.rng, SO.ACTS[0]);
      this.character = character || (SO.CHARACTERS && SO.CHARACTERS.gambler) || null;
      const ch = this.character;
      this.player = {
        name: 'You',
        hp: CFG().PLAYER_START_HP, maxHp: CFG().PLAYER_MAX_HP,
        deck: (ch && ch.deck ? ch.deck : SO.STARTER_DECK).slice(),
        relics: (ch && ch.relics ? ch.relics.slice() : []),
      };
      this.coins = 0;
      this.removalCost = CFG().CARD_REMOVAL_COST;
      this.currentNodeId = null;
      this.completedNodes = [];
      this.flags = { phoenixUsed: false };
      this.won = false; this.dead = false;
      this.modifiers = []; this.mods = {}; this.scoreMult = 1;   // run modifiers (set at startRun)
      this.endless = false; this.endlessDepth = 0;
      this.inDepth = false; this.depthId = null; this.depthAct = null; this.surface = null;
    }

    get act() {
      if (this.inDepth && this.depthAct) return this.depthAct;   // a side-board (the Depths)
      if (!this.endless && this.actIdx < SO.ACTS.length) {
        const base = SO.ACTS[this.actIdx];
        // Short Run modifier: fewer rows/act. Copy so the shared ACTS aren't mutated.
        return (this.mods && this.mods.actRows) ? Object.assign({}, base, { rows: this.mods.actRows }) : base;
      }
      // Endless: synthetic floors past The House. The escalation lives on `diff`
      // (bumped each descent), so the act just reuses act-5 scaling and cycles bosses.
      const depth = this.endlessDepth || 1;
      const last = SO.ACTS[SO.ACTS.length - 1];
      const bossKeys = Object.keys(SO.BOSSES);
      return {
        name: 'The Descent · Floor ' + depth,
        sub: 'Past the House, the stairs keep going down. Every floor is worse — chase the score.',
        enemies: last.enemies, boss: bossKeys[(depth - 1) % bossKeys.length],
        hpScale: last.hpScale, betScale: last.betScale, endless: true,
      };
    }

    // Descend one floor past The House (endless mode). Ramps the whole difficulty
    // and regenerates a fresh floor. The win is already banked; this is score-chase.
    descend() {
      this.endless = true;
      this.endlessDepth = (this.endlessDepth || 0) + 1;
      this.actIdx++;
      this.diff = Object.assign({}, this.diff, {
        enemyHp: this.diff.enemyHp * (SO.ENDLESS_HP_STEP || 1.25),
        enemyBet: this.diff.enemyBet * (SO.ENDLESS_BET_STEP || 1.18),
        bleedMult: this.diff.bleedMult * (SO.ENDLESS_BLEED_STEP || 1.1),
      });
      this.map = generateMap(this.rng, this.act);
      this.currentNodeId = null;
      this.completedNodes = [];
      const heal = Math.round(this.player.maxHp * CFG().ACT_TRANSITION_HEAL_PCT);
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + heal);
      return heal;
    }

    available() {
      if (this.currentNodeId == null) return this.map.rows[0].slice();
      const node = this.map.byId[this.currentNodeId];
      if (!node) return [];
      return node.edges.map((id) => this.map.byId[id]);
    }

    enter(nodeId) {
      this.currentNodeId = nodeId;
      this.completedNodes.push(nodeId);
      if (this.player.relics.includes('meal_ticket')) this.addCoins(3);
      if (this.player.relics.includes('house_account')) this.addCoins(2);
      return this.map.byId[nodeId];
    }

    // advance to the next act after a boss win; returns false when the run is won
    nextAct() {
      if (this.actIdx >= SO.ACTS.length - 1) { this.won = true; return false; }
      this.actIdx++;
      this.map = generateMap(this.rng, this.act);
      this.currentNodeId = null;
      this.completedNodes = [];
      const heal = Math.round(this.player.maxHp * CFG().ACT_TRANSITION_HEAL_PCT);
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + heal);
      return true;
    }

    // A gambit: 1-in-4 you WIN (snatch the relic, or — rarely — fall UP into the
    // Vault for a jackpot); otherwise you fall into the Depth. main.js reads
    // pendingDepth / pendingVault after the event closes.
    gambitRoll(depthId) {
      if (this.rng.next() < 0.25) {
        if (SO.Profile) SO.Profile.award('against_odds');
        // 1-in-4 of a win is a jackpot: you tumble UP into the house's vault.
        if (this.rng.next() < 0.25) { this.pendingVault = 'vault'; return null; }
        const id = this.randomRelic();
        return id ? `Your fingers close on it — ${SO.RELICS[id].name}!` : 'You grab it — but it crumbles to dust in your hand.';
      }
      this.pendingDepth = depthId;
      return null;
    }

    // ---- The Depths (a failed gambit drops you here) ----
    // Stash the surface (the real floor) and swap in a short depth map. You
    // walk it with the SAME map machinery; the EXIT node calls ascendFromDepth.
    fallIntoDepth(depthId) {
      const d = SO.DEPTHS[depthId] || SO.DEPTHS[SO.DEPTH_ORDER[0]];
      this.surface = { map: this.map, currentNodeId: this.currentNodeId, completedNodes: this.completedNodes, actIdx: this.actIdx };
      this.inDepth = true;
      this.depthId = d.id;
      this.depthAct = { n: 'D', depth: true, treasure: !!d.treasure, rows: d.rows || 3, name: d.name, sub: d.sub, enemies: d.enemies, boss: null, hpScale: d.hpScale, betScale: d.betScale };
      this.map = generateMap(this.rng, this.depthAct);
      this.currentNodeId = null;
      this.completedNodes = [];
    }
    ascendFromDepth() {
      const s = this.surface;
      if (!s) { this.inDepth = false; return null; }
      const escaped = this.depthId;
      this.map = s.map; this.currentNodeId = s.currentNodeId; this.completedNodes = s.completedNodes; this.actIdx = s.actIdx;
      this.inDepth = false; this.depthId = null; this.depthAct = null; this.surface = null;
      return escaped;
    }

    // ---- secret seeds (documented on the tutorial's last page) ----
    applyCheat(cheat) {
      this.cheat = cheat;
      this.godMode = cheat === 'god';
      switch (cheat) {
        case 'boss': this.bossRush = true; this.map = this.buildBossRushMap(); break;
        case 'rich': this.coins = 999; break;
        case 'loaded': this.player.deck = Array(10).fill('loaded_die'); break;
        case 'fortune': for (let i = 0; i < 3; i++) this.randomRelic(); break;
        case 'stacked': this.player.deck.push('pocket_aces', 'devils_markup', 'devils_markup', 'field_medic', 'let_it_ride', 'cooler'); break;
        case 'phoenix': this.addRelic('phoenix_feather'); this.player.deck.push('last_rites', 'tourniquet', 'field_medic', 'de_escalation'); break;
      }
    }
    // a linear chain of all five bosses, bottom (first) to top (last)
    buildBossRushMap() {
      const bosses = SO.ACTS.map((a) => a.boss);
      const rows = bosses.map((bid, i) => [{ id: 'brn' + i, row: i, col: 0, edges: i < bosses.length - 1 ? ['brn' + (i + 1)] : [], type: 'boss', boss: bid, enemy: null, elite: false }]);
      const byId = {}; rows.forEach((row) => row.forEach((n) => { byId[n.id] = n; }));
      return { rows, byId, rowCount: rows.length };
    }

    // build the (scaled) enemy for a node
    buildEnemy(node) {
      const base = node.type === 'boss' ? SO.BOSSES[node.boss || this.act.boss] : SO.ENEMIES[node.enemy];
      const def = JSON.parse(JSON.stringify(base));
      // Ascension I ("Sharpened Elites") rides on top of the base elite multipliers
      const m = this.mods || {};
      const eliteHp = node.elite ? CFG().ELITE_HP_MULT + (m.eliteHpBonus || 0) : 1;
      const eliteBet = node.elite ? CFG().ELITE_BET_BONUS + (m.eliteBetBonus || 0) : 0;
      const hpMult = (node.type === 'boss' ? 1 : this.act.hpScale) * this.diff.enemyHp * eliteHp;
      const betMult = (node.type === 'boss' ? 1 : this.act.betScale) * this.diff.enemyBet;
      def.hp = Math.max(10, Math.round(base.hp * hpMult));
      def.betSize = Math.max(2, Math.round((base.betSize || 5) * betMult)) + eliteBet;
      if (node.elite) {
        def.interfere = Math.min(0.95, (def.interfere || 0) + CFG().ELITE_INTERFERE_BONUS); def.name = 'Elite ' + def.name;
        // apply this elite's signature gimmick (rigger / leech / cooler / …)
        const g = node.gimmick && SO.ELITE_GIMMICK_BY_ID && SO.ELITE_GIMMICK_BY_ID[node.gimmick];
        if (g) { g.apply(def); def.gimmickName = g.name; def.eliteTell = g.tell; }
      }
      // boss phase HP thresholds scale with difficulty
      if (def.phases) {
        const scale = this.diff.enemyHp;
        def.hp = Math.round(base.hp * scale);
        def.phases = base.phases.map((ph) => ({ ...ph, from: Math.round(ph.from * scale), to: Math.round(ph.to * scale) }));
      }
      return def;
    }

    duelParticipant() {
      return SO.makeParticipant({
        id: 'player', name: this.player.name, isPlayer: true,
        hp: this.player.hp, maxHp: this.player.maxHp,
        deck: this.player.deck, relics: this.player.relics,
        style: this.character ? this.character.style : 'pass',
      });
    }
    syncAfterDuel(participant) { this.player.hp = participant.hp; }

    coinsFor(node) {
      const base = node.type === 'boss' ? CFG().COINS_PER_BOSS : node.elite ? CFG().COINS_PER_ELITE : CFG().COINS_PER_NORMAL_DUEL;
      let coins = Math.round((base + this.rng.int(0, 4)) * this.diff.coinMult);
      if (this.player.relics.includes('charons_coin')) coins += 5;
      if (this.player.relics.includes('counting_room')) coins += 8;
      return coins;
    }
    cardReward() { return SO.drawCardChoices(this.rng, CFG().CARD_REWARD_CHOICES); }
    // relics you already hold, and ones still locked behind a milestone, are out
    _relicPool() { return SO.RELIC_POOL.filter((id) => !this.player.relics.includes(id) && (!SO.isUnlocked || SO.isUnlocked(id))); }
    relicChoice(n) {
      const avail = this._relicPool();
      const out = [];
      for (let i = 0; i < (n || 2) && avail.length; i++) { const id = this.rng.pick(avail); out.push(id); avail.splice(avail.indexOf(id), 1); }
      return out;
    }
    randomRelic() {
      const avail = this._relicPool();
      if (!avail.length) return null;
      const id = this.rng.pick(avail);
      this.addRelic(id);
      return id;
    }

    addCard(id) { this.player.deck.push(id); }
    addRelic(id) {
      if (!this.player.relics.includes(id)) this.player.relics.push(id);
      if (SO.Profile) SO.Profile.noteRelicHeld(id);   // codex; guarded — the node harness has no profile
    }
    removeCard(index) { if (index >= 0 && index < this.player.deck.length) this.player.deck.splice(index, 1); }
    addCoins(n) { this.coins += n; }
    // spending feeds the lifetime 'coinsSpent' milestone (unlocks); any unlock it
    // crosses is queued on the profile for the UI to drain and announce.
    spendCoins(n) { if (this.coins >= n) { this.coins -= n; if (SO.Profile && n > 0) SO.Profile.bumpMilestone('coinsSpent', n); return true; } return false; }

    // ---- save / restore (called at the map, a safe point between nodes) ----
    serialize() {
      return {
        v: 1,
        seed: this.seed, rngState: this.rng.getState(),
        difficultyIdx: this.difficultyIdx, actIdx: this.actIdx,
        map: { rows: this.map.rows, rowCount: this.map.rowCount },
        player: this.player, coins: this.coins, removalCost: this.removalCost,
        currentNodeId: this.currentNodeId, completedNodes: this.completedNodes,
        flags: this.flags, cheat: this.cheat || null,
        bossRush: !!this.bossRush, godMode: !!this.godMode,
        characterId: this.character ? this.character.id : 'gambler',
        stats: this.stats || null,
        // run modifiers + endless: diff is serialized directly because mods and
        // descents mutate it away from the plain ascension scalar.
        diff: this.diff, modifiers: this.modifiers || [], mods: this.mods || {},
        scoreMult: this.scoreMult || 1, endless: !!this.endless, endlessDepth: this.endlessDepth || 0,
        // in a Depth, `map` above holds the depth map; stash the surface to restore on exit
        depth: this.inDepth ? {
          id: this.depthId, act: this.depthAct,
          surfaceRows: this.surface.map.rows, surfaceNodeId: this.surface.currentNodeId,
          surfaceCompleted: this.surface.completedNodes, surfaceActIdx: this.surface.actIdx,
        } : null,
      };
    }
    static deserialize(data) {
      const run = new Run(data.seed, data.difficultyIdx); // rebuilds a throwaway map; overwritten below
      run.rng.setState(data.rngState);
      run.actIdx = data.actIdx;
      run.map = { rows: data.map.rows, rowCount: data.map.rowCount, byId: {} };
      for (const row of run.map.rows) for (const n of row) run.map.byId[n.id] = n;
      run.player = data.player;
      run.coins = data.coins;
      run.removalCost = data.removalCost != null ? data.removalCost : CFG().CARD_REMOVAL_COST;
      run.currentNodeId = data.currentNodeId;
      run.completedNodes = data.completedNodes || [];
      run.flags = data.flags || { phoenixUsed: false };
      run.cheat = data.cheat || null;
      run.bossRush = !!data.bossRush;
      run.godMode = !!data.godMode;
      run.character = (SO.CHARACTERS && SO.CHARACTERS[data.characterId]) || (SO.CHARACTERS && SO.CHARACTERS.gambler) || null;
      run.stats = data.stats || null;
      // restore the (possibly modifier/endless-mutated) diff and run modifiers
      if (data.diff) run.diff = data.diff;
      run.modifiers = data.modifiers || [];
      run.mods = data.mods || {};
      run.scoreMult = data.scoreMult || 1;
      run.endless = !!data.endless;
      run.endlessDepth = data.endlessDepth || 0;
      // restore an in-progress Depth (surface stashed away, current map is the depth)
      if (data.depth) {
        run.inDepth = true; run.depthId = data.depth.id; run.depthAct = data.depth.act;
        const sm = { rows: data.depth.surfaceRows, byId: {} };
        for (const row of sm.rows) for (const n of row) sm.byId[n.id] = n;
        run.surface = { map: sm, currentNodeId: data.depth.surfaceNodeId, completedNodes: data.depth.surfaceCompleted, actIdx: data.depth.surfaceActIdx };
      }
      return run;
    }

    upgradeCard(index) {
      const id = this.player.deck[index];
      if (!id || id.endsWith('+')) return null;
      const def = SO.getCard(id);
      if (!def || def.type === 'curse') return null;
      this.player.deck[index] = id + '+';
      return id + '+';
    }
    upgradeRandomCard(type) {
      const idxs = this.player.deck
        .map((id, i) => ({ id, i }))
        .filter(({ id }) => !id.endsWith('+') && SO.getCard(id) && SO.getCard(id).type !== 'curse' && (!type || SO.getCard(id).type === type));
      if (!idxs.length) return null;
      const pick = this.rng.pick(idxs);
      return this.upgradeCard(pick.i);
    }

    rest(choice) {
      if (choice === 'mend') {
        let heal = Math.round(this.player.maxHp * CFG().REST_HEAL_PCT);
        if (this.mods && this.mods.halfRest) heal = Math.round(heal / 2);   // No Rest for the Wicked
        this.player.hp = Math.min(this.player.maxHp, this.player.hp + heal);
        return heal;
      }
      if (choice === 'cleanse') {
        const i = this.player.deck.findIndex((id) => SO.getCard(id) && SO.getCard(id).type === 'curse');
        if (i >= 0) return this.player.deck.splice(i, 1)[0];
        return null;
      }
      return null;
    }

    // Gambit events (the ones that can drop you into the Depths) only surface
    // once you're past the first boss — act 2 and beyond.
    event() {
      const pool = SO.EVENTS.filter((e) => !e.gambit || this.actIdx >= 1);
      return this.rng.pick(pool.length ? pool : SO.EVENTS);
    }

    shopPrice(n) {
      const mult = this.player.relics.includes('velvet_rope') ? 0.75 : 1;
      const asc = (this.mods && this.mods.shopMult) || 1;   // Ascension II: the house takes more
      return Math.max(1, Math.round(n * mult * asc));
    }
    get effectiveRemovalCost() {
      const d = this.player.relics.includes('pawn_ticket') ? 10 : 0;
      return Math.max(5, this.removalCost - d);
    }

    rollShop() {
      const cards = SO.drawCardChoices(this.rng, this.rng.int(3, 5));
      const relicCount = this.rng.int(2, 3);
      const avail = this._relicPool();
      const relics = [];
      for (let i = 0; i < relicCount && avail.length; i++) {
        const id = this.rng.pick(avail);
        relics.push(id); avail.splice(avail.indexOf(id), 1);
      }
      return {
        cards: cards.map((id) => ({ id, price: this.shopPrice(CFG().SHOP_CARD_PRICES[SO.getCard(id).rarity] || 20), sold: false })),
        relics: relics.map((id) => ({ id, price: this.shopPrice(this.rng.int(CFG().SHOP_RELIC_PRICE[0], CFG().SHOP_RELIC_PRICE[1])), sold: false })),
        facedownUsed: false,
        leverUsed: false,
      };
    }
  }

  SO.generateMap = generateMap;
  SO.Run = Run;
})();
