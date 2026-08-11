/* AWECRAP — config.js
 * Every tunable, the 5-act structure, difficulty table, full enemy roster,
 * five bosses, and the relic catalog. All numbers are [TUNE] starting points.
 */
window.SO = window.SO || {};

SO.CONFIG = {
  // --- Core HP / economy ---
  PLAYER_MAX_HP: 100,
  PLAYER_START_HP: 100,

  // --- The bleed (§5.2) ---
  BASE_BLEED: 2,
  BLEED_RAMP: 2,

  // --- Anger: the house resents a soul that won't bet ---
  // Every round you place NO bet, the wrath grows by ANGER_STEP and strikes
  // (3, 6, 9, …). Betting appeases it (resets to 0). De-escalation negates one
  // strike (and stops that round from escalating it). Forces you to play.
  ANGER_STEP: 3,

  // --- Round stakes (no pot by design) ---
  // The round loser takes the Cut — flat, never escalating. This is the only
  // way winning a round touches the other soul.
  ROUND_CUT: 8,
  // Last Call: past this round the wound ignores chips and bleeds everyone,
  // harder each round — a failsafe so no table runs forever.
  LAST_CALL_ROUND: 15,
  LAST_CALL_ROUND_BOSS: 25,
  LAST_CALL_RAMP: 2,

  // --- Pulling bets (§5.4) ---
  PULL_TAX: 2,

  // --- Bets ---
  MAX_ODDS_MULTIPLE: 3,
  BET_STEP: 5,

  // --- Cards (§6) ---
  NERVE_PER_TURN: 3,
  HAND_SIZE: 5,
  CARD_REWARD_CHOICES: 3,

  // --- Economy / shop (§9) ---
  COINS_PER_NORMAL_DUEL: 12,
  COINS_PER_ELITE: 20,
  COINS_PER_BOSS: 30,
  CARD_REMOVAL_COST: 18,
  CARD_REMOVAL_ESCALATION: 12,
  SHOP_CARD_PRICES: { common: 18, uncommon: 28, rare: 40 },
  SHOP_RELIC_PRICE: [50, 75],
  SHOP_FACEDOWN_CARD: 12,   // the casino gamble: a face-down card
  SHOP_LEVER: 35,           // the lever: a discounted random relic

  // --- Run / map (§11) ---
  REST_HEAL_PCT: 0.30,
  ACT_ROWS: 6,
  SHORT_RUN_ROWS: 4,   // the Short Run modifier's reduced act length (see SO.RUN_MODIFIERS)
  NODES_PER_ROW_MIN: 2,
  NODES_PER_ROW_MAX: 4,
  ACT_TRANSITION_HEAL_PCT: 0.30,
  ELITE_HP_MULT: 1.5,
  ELITE_BET_BONUS: 2,
  ELITE_INTERFERE_BONUS: 0.2,

  // --- Craps reference (§3) ---
  LEGAL_POINTS: [4, 5, 6, 8, 9, 10],
};

/* ===================== Difficulty (5 notches) =====================
 * enemyHp/enemyBet scale the roster, bleedMult scales YOUR bleed,
 * coinMult scales rewards, interfereMult scales AI aggression,
 */
SO.DIFFICULTY = [
  { key: 'soft',  name: 'Soft Touch',  desc: 'Learn the felt. The house goes easy.',      enemyHp: 0.55, enemyBet: 0.70, bleedMult: 0.70, coinMult: 1.4, interfereMult: 0.50 },
  { key: 'loose', name: 'Loose Slots', desc: 'A forgiving table.',                        enemyHp: 0.70, enemyBet: 0.85, bleedMult: 0.85, coinMult: 1.2, interfereMult: 0.75 },
  { key: 'fair',  name: 'Even Odds',   desc: 'The game as designed.',                     enemyHp: 0.82, enemyBet: 1.00, bleedMult: 1.00, coinMult: 1.0, interfereMult: 1.00 },
  { key: 'mean',  name: 'House Rules', desc: 'The souls play sharper. The wound is deep.', enemyHp: 1.00, enemyBet: 1.20, bleedMult: 1.15, coinMult: 0.9, interfereMult: 1.30 },
  { key: 'cruel', name: 'Damned Luck', desc: 'Everything is against you. Good.',          enemyHp: 1.20, enemyBet: 1.40, bleedMult: 1.30, coinMult: 0.75, interfereMult: 1.60 },
];
SO.DEFAULT_DIFFICULTY = 2;

/* ===================== Ascension ladder =====================
 * The 5 base difficulties are ladder rungs 0..4 (Soft Touch → Damned Luck),
 * unlocked in order by winning. Past Damned Luck are ASCENSION_EXTRA modifier
 * rungs (Ascension I..V) that keep escalating the same scalars — no new
 * mechanics, just a harder house. SO.ascensionInfo(level) hands back a
 * per-run `diff` scalar object so a run never mutates SO.DIFFICULTY. */
SO.ASCENSION_EXTRA = 5;
SO.ASCENSION_MAX = (SO.DIFFICULTY.length - 1) + SO.ASCENSION_EXTRA; // highest selectable level
SO.ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
SO.ascensionInfo = function (level) {
  const max = SO.ASCENSION_MAX;
  level = Math.max(0, Math.min(max, level | 0));
  const lastBase = SO.DIFFICULTY.length - 1;
  if (level <= lastBase) {
    const b = SO.DIFFICULTY[level];
    return { level: level, name: b.name, desc: b.desc, asc: false, rung: 0,
      diff: { key: b.key, name: b.name, desc: b.desc, enemyHp: b.enemyHp, enemyBet: b.enemyBet, bleedMult: b.bleedMult, coinMult: b.coinMult, interfereMult: b.interfereMult } };
  }
  const d = SO.DIFFICULTY[lastBase]; // Damned Luck as the base to escalate
  const r = level - lastBase; // 1..ASCENSION_EXTRA
  const name = 'Ascension ' + (SO.ROMAN[r] || r);
  const desc = 'Damned Luck, and then some — rung ' + r + ' of ' + SO.ASCENSION_EXTRA + '. The house presses harder.';
  const round3 = (n) => Math.round(n * 1000) / 1000;
  return { level: level, name: name, desc: desc, asc: true, rung: r,
    diff: { key: 'asc' + r, name: name, desc: desc,
      enemyHp: round3(d.enemyHp + 0.10 * r),
      enemyBet: round3(d.enemyBet + 0.08 * r),
      bleedMult: round3(d.bleedMult + 0.08 * r),
      coinMult: round3(Math.max(0.5, d.coinMult - 0.04 * r)),
      interfereMult: round3(Math.min(2, d.interfereMult + 0.06 * r)) } };
};

/* ===================== Enemies =====================
 * archetype: 'point' | 'attrition' | 'prop' | 'control'
 * style: line polarity. setsPoint: choices at roll-off. interfere: 0..1.
 * Decks draw only from the base card set the AI knows how to play.
 */
SO.ENEMIES = {
  // ---- Act 1 — The Basement ----
  newcomer: {
    id: 'newcomer', name: 'The Newcomer', hp: 30,
    blurb: 'Just arrived. Barely knows the rules. Always sets an easy point.',
    archetype: 'point', style: 'pass', setsPoint: [6, 8], interfere: 0, betSize: 4,
    // A rookie's deck: two fumbling riggers buried in chaff she barely knows
    // how to use — she can't rig-race anyone, which is the point of a tutorial.
    deck: ['nudge', 'nudge', 'loaded_die', 'tourniquet', 'tourniquet', 'second_wind', 'marked_cards', 'field_medic'],
    tell: 'Sets 6 or 8 — a pass build. Race it or steal its line.',
  },
  tony: {
    id: 'tony', name: 'Tap-Out Tony', hp: 55,
    blurb: "A weary gambler who's learned to play the long game. Bets against you and waits for the 7.",
    archetype: 'attrition', style: 'dont', setsPoint: [4, 10], interfere: 0.15, betSize: 5,
    deck: ['cold_bones', 'cold_bones', 'cold_bones', 'reapers_cut', 'reapers_cut', 'patience', 'patience', 'tourniquet'],
    tell: "Sets 4 or 10 — a don't build. He wants the 7. Don't over-commit.",
  },
  mariah: {
    id: 'mariah', name: 'Hot-Hand Mariah', hp: 50,
    blurb: 'A reckless soul chasing the big one. Dumps HP onto hardways and boxcars.',
    archetype: 'prop', style: 'pass', setsPoint: [4, 5, 6, 8, 9, 10], interfere: 0.1, betSize: 5,
    deck: ['devils_markup', 'devils_markup', 'boxcar_special', 'boxcar_special', 'let_it_ride', 'let_it_ride', 'pocket_aces', 'nudge'],
    tell: 'Sets the point all over — a prop cannon. Survive her variance.',
  },
  shark: {
    id: 'shark', name: 'The Shark', hp: 60,
    blurb: 'A predatory regular who plays your game against you.',
    archetype: 'control', style: 'dont', setsPoint: [4, 10], interfere: 0.6, betSize: 5,
    deck: ['sleight_of_hand', 'sleight_of_hand', 'cooler', 'cooler', 'jinx', 'jinx', 'patience', 'patience', 'tourniquet', 'tourniquet'],
    tell: 'The skill check. Expect steals, denials, and stalling.',
  },

  // ---- Act 2 — The Gaming Floor ----
  chalk_eddie: {
    id: 'chalk_eddie', name: 'Chalk Eddie', hp: 55,
    blurb: 'A handicapper who has done the math on every number. The math says 6 and 8.',
    archetype: 'point', style: 'pass', setsPoint: [6, 8], interfere: 0.15, betSize: 6,
    deck: ['loaded_die', 'loaded_die', 'third_bone', 'third_bone', 'sure_thing', 'sure_thing', 'nudge', 'nudge', 'tourniquet'],
    tell: 'A sharper pass build — he rigs hard toward easy points.',
  },
  widow_vane: {
    id: 'widow_vane', name: 'Widow Vane', hp: 65,
    blurb: 'She has buried three husbands and outlasted every one of them.',
    archetype: 'attrition', style: 'dont', setsPoint: [4, 10], interfere: 0.3, betSize: 6,
    deck: ['cold_bones', 'cold_bones', 'reapers_cut', 'reapers_cut', 'patience', 'patience', 'all_odds', 'all_odds', 'tourniquet', 'jinx'],
    tell: "Patient, laying odds, healing off your busts. Don't race her — starve her.",
  },
  two_bit: {
    id: 'two_bit', name: 'Two-Bit Tommy', hp: 50,
    blurb: 'Every chip he has ever held went onto a hardway. Every single one.',
    archetype: 'prop', style: 'pass', setsPoint: [4, 6, 8, 10], interfere: 0.1, betSize: 7,
    deck: ['devils_markup', 'devils_markup', 'boxcar_special', 'let_it_ride', 'let_it_ride', 'pocket_aces', 'third_bone', 'nudge'],
    tell: 'A louder prop cannon. His cold streaks are your window.',
  },

  // ---- Act 3 — The Mezzanine ----
  bonesetter: {
    id: 'bonesetter', name: 'The Bonesetter', hp: 70,
    blurb: 'They say he can feel the pips through the felt. The dice obey.',
    archetype: 'point', style: 'pass', setsPoint: [6, 8], interfere: 0.25, betSize: 7,
    deck: ['loaded_die', 'loaded_die', 'pocket_aces', 'third_bone', 'third_bone', 'sure_thing', 'sure_thing', 'weighted_faces', 'tourniquet', 'nudge'],
    tell: 'The strongest dice-rigger on the floor. Deny his point or beat him to it.',
  },
  sister_riches: {
    id: 'sister_riches', name: 'Sister Riches', hp: 75,
    blurb: 'A defrocked nun who tithes from other souls’ tables.',
    archetype: 'control', style: 'dont', setsPoint: [4, 10], interfere: 0.65, betSize: 6,
    deck: ['sleight_of_hand', 'sleight_of_hand', 'pickpocket', 'pickpocket', 'cooler', 'jinx', 'jinx', 'patience', 'patience', 'reapers_cut'],
    tell: 'She will take what is yours. Keep your table lean when she has Nerve.',
  },

  // ---- Act 4 — The High-Roller Suite ----
  madame_zero: {
    id: 'madame_zero', name: 'Madame Zero', hp: 85,
    blurb: 'Nothing sticks to her. Nothing ever has.',
    archetype: 'attrition', style: 'dont', setsPoint: [4, 10], interfere: 0.5, betSize: 8,
    deck: ['cold_bones', 'cold_bones', 'cold_bones', 'reapers_cut', 'reapers_cut', 'patience', 'patience', 'all_odds', 'all_odds', 'jinx', 'last_rites'],
    tell: 'An iron don’t build with an escape hatch. Bring your own sevens.',
  },
  the_collector: {
    id: 'the_collector', name: 'The Collector', hp: 80,
    blurb: 'He keeps a ledger of every soul who ever owed the house. You’re in it.',
    archetype: 'prop', style: 'pass', setsPoint: [4, 10, 6, 8], interfere: 0.4, betSize: 9,
    deck: ['devils_markup', 'devils_markup', 'boxcar_special', 'boxcar_special', 'let_it_ride', 'let_it_ride', 'pocket_aces', 'pickpocket', 'pickpocket', 'field_medic'],
    tell: 'A prop cannon that steals. His swings are enormous — survive the peaks.',
  },

  // ---- Act 5 — The Penthouse ----
  concierge: {
    id: 'concierge', name: 'The Concierge', hp: 95,
    blurb: 'Whatever you need, he already has it. Whatever you have, he already wants.',
    archetype: 'control', style: 'dont', setsPoint: [4, 10], interfere: 0.8, betSize: 8,
    deck: ['sleight_of_hand', 'sleight_of_hand', 'cooler', 'cooler', 'jinx', 'jinx', 'pickpocket', 'pickpocket', 'patience', 'patience', 'reapers_cut', 'last_rites'],
    tell: 'The most vicious controller in the building. Every chip you expose is his.',
  },

  // ---- The travelling bettors (acts 2-4) ----
  // The 'come' archetype opens a line bet AND a travelling come bet every
  // round, so their felt is never still — you can't wait them out.
  the_runner: {
    id: 'the_runner', name: 'The Runner', hp: 58,
    blurb: 'Never stops moving. Lays a fresh bet down the road before the last one lands.',
    archetype: 'come', style: 'pass', setsPoint: [5, 6, 8, 9], interfere: 0.2, betSize: 6,
    deck: ['nudge', 'nudge', 'loaded_die', 'third_bone', 'sure_thing', 'let_it_ride', 'patience', 'tourniquet', 'field_medic'],
    tell: 'Two bets every round — a line and a come. Hitting his number twice is how he wins.',
  },
  backdoor_bettina: {
    id: 'backdoor_bettina', name: 'Backdoor Bettina', hp: 72,
    blurb: 'She takes the long way round and comes in behind you, every time.',
    archetype: 'come', style: 'dont', setsPoint: [4, 10], interfere: 0.35, betSize: 8,
    deck: ['cold_bones', 'cold_bones', 'reapers_cut', 'reapers_cut', 'patience', 'patience', 'jinx', 'all_odds', 'tourniquet'],
    tell: 'A don’t build that doubles up behind the line. Every seven pays her twice.',
  },
};

/* ===================== Bosses (one per act) =====================
 * Gimmick flags read by the duel:
 *   alwaysSetsPoint, immuneToInterfere, winsTies, pullTaxMult,
 *   stealOnTurn, healWhenOppBleeds, oppCardCostDelta,
 *   phases: [{to, curseEveryOther?, stopsBadPoints?, note}]
 */
SO.BOSSES = {
  floor_manager: {
    id: 'floor_manager', name: 'The Floor Manager', hp: 120,
    blurb: 'Middle management of the purgatory casino — the soul who decides whether you advance.',
    archetype: 'boss', style: 'adaptive', interfere: 0, betSize: 6,
    immuneToInterfere: true, alwaysSetsPoint: true,
    deck: ['patience', 'patience', 'tourniquet', 'tourniquet', 'all_odds', 'devils_markup', 'field_medic', 'reapers_cut', 'crapless'],
    phases: [
      { from: 120, to: 80, note: 'Standard. He sets the worst point each round.' },
      { from: 80, to: 40, curseEveryOther: 'bad_beat', note: 'He tightens up. Every other round he forces a Bad Beat into your draw.' },
      { from: 40, to: 0, stopsBadPoints: true, note: 'Last call. He stops setting bad points and swings big.' },
    ],
    tell: 'He sets the point every round (the worst one for you) and is immune to interference.',
  },
  pit_boss: {
    id: 'pit_boss', name: 'The Pit Boss', hp: 120,
    blurb: 'He wrote the fee schedule. Every motion at his table costs extra.',
    archetype: 'boss', style: 'pass', setsPoint: [6, 8], interfere: 0.3, betSize: 7,
    pullTaxMult: 3,
    deck: ['loaded_die', 'loaded_die', 'third_bone', 'sure_thing', 'sure_thing', 'patience', 'tourniquet', 'tourniquet', 'field_medic'],
    phases: [
      { from: 120, to: 60, note: 'House fees: pulling a bet against him is triple-taxed.' },
      { from: 60, to: 0, curseEveryOther: 'trembling_hands', note: 'Audit: he slips Trembling Hands into your draw every other round.' },
    ],
    tell: 'Pulling bets against him is triple-taxed. Commit or bleed.',
  },
  countess: {
    id: 'countess', name: 'The Countess', hp: 130,
    blurb: 'She drinks from other souls’ wounds. Yours smells fresh.',
    archetype: 'boss', style: 'dont', setsPoint: [4, 10], interfere: 0.5, betSize: 8,
    stealOnTurn: 3, healWhenOppBleeds: 4,
    deck: ['cold_bones', 'cold_bones', 'reapers_cut', 'reapers_cut', 'patience', 'patience', 'jinx', 'jinx', 'sleight_of_hand', 'tourniquet'],
    phases: [
      { from: 130, to: 65, note: 'She skims 3 HP from your table each of her turns, and feeds on your bleed.' },
      { from: 65, to: 0, curseEveryOther: 'cold_streak', note: 'Deep draught: Cold Streak curses join your draw.' },
    ],
    tell: 'Your bleed heals her, and exposed chips feed her. Stay bandaged, hit hard.',
  },
  auditor: {
    id: 'auditor', name: 'The Auditor', hp: 140,
    blurb: 'Every card you have ever drafted has a line item. He is disputing all of them.',
    archetype: 'boss', style: 'dont', setsPoint: [4, 10], interfere: 0.55, betSize: 9,
    oppCardCostDelta: 1,
    deck: ['cold_bones', 'cold_bones', 'jinx', 'jinx', 'cooler', 'patience', 'patience', 'reapers_cut', 'all_odds', 'tourniquet', 'last_rites'],
    phases: [
      { from: 140, to: 70, note: 'Processing fee: all your cards cost +1 Nerve.' },
      { from: 70, to: 0, curseEveryOther: 'bad_beat', note: 'Final audit: Bad Beats join your draw, and his patience runs out.' },
    ],
    tell: 'Your whole deck costs +1 Nerve against him. Zero-cost cards are gold.',
  },
  the_house: {
    id: 'the_house', name: 'The House', hp: 180,
    blurb: 'Not a soul. The building itself, wearing a suit. It has never lost. It cannot imagine losing.',
    archetype: 'boss', style: 'adaptive', interfere: 0, betSize: 10,
    immuneToInterfere: true, alwaysSetsPoint: true, winsTies: true,
    deck: ['patience', 'patience', 'tourniquet', 'tourniquet', 'all_odds', 'all_odds', 'devils_markup', 'field_medic', 'field_medic', 'reapers_cut', 'crapless', 'last_rites'],
    phases: [
      { from: 180, to: 120, note: 'The House sets every point, wins every tie, and cannot be touched.' },
      { from: 120, to: 60, curseEveryOther: 'bad_beat', note: 'The walls lean in. Bad Beats join your draw.' },
      { from: 60, to: 0, stopsBadPoints: true, note: 'The House is rattled. It has never been rattled. Finish it.' },
    ],
    tell: 'Every gimmick on the floor at once. This is the way out.',
  },
};

/* ===================== Elite gimmicks (V.0.4.8) =====================
 * An elite (☠) is a scaled enemy PLUS one signature twist — a rule of its own,
 * reusing the boss gimmick flags the duel already reads. Assigned deterministically
 * at map-gen (run.assignTypes stores node.gimmick) and applied in run.buildEnemy.
 * `apply(def)` sets a flag; `tell` is surfaced to the player at duel start. */
SO.ELITE_GIMMICKS = [
  { id: 'rigger',  name: 'the Rigger',  tell: 'Always makes its point — race it, don’t wait it out.', apply(def) { def.alwaysSetsPoint = true; } },
  { id: 'leech',   name: 'the Leech',   tell: 'Heals whenever YOU bleed — keep chips on the felt.',   apply(def) { def.healWhenOppBleeds = 3; } },
  { id: 'cooler',  name: 'the Cooler',  tell: 'Skims your exposed chips every turn — don’t over-commit.', apply(def) { def.stealOnTurn = 3; } },
  { id: 'sharp',   name: 'the Sharp',   tell: 'Wins roll-off ties — you must out-roll it clean.',      apply(def) { def.winsTies = true; } },
  { id: 'bruiser', name: 'the Bruiser', tell: 'Immune to your interference — beat it straight.',        apply(def) { def.immuneToInterfere = true; } },
  { id: 'usurer',  name: 'the Usurer',  tell: 'Your cards cost +1 Nerve here — play lean.',             apply(def) { def.oppCardCostDelta = 1; } },
];
SO.ELITE_GIMMICK_BY_ID = {};
SO.ELITE_GIMMICKS.forEach((g) => { SO.ELITE_GIMMICK_BY_ID[g.id] = g; });

/* ===================== The 5 Acts ===================== */
SO.ACTS = [
  { n: 1, name: 'The Basement',          sub: 'Where broken souls learn the rules.',
    enemies: ['newcomer', 'tony', 'mariah', 'shark'], boss: 'floor_manager', hpScale: 1.00, betScale: 1.0 },
  { n: 2, name: 'The Gaming Floor',      sub: 'Louder. Brighter. Hungrier.',
    enemies: ['tony', 'mariah', 'shark', 'chalk_eddie', 'widow_vane', 'two_bit', 'the_runner'], boss: 'pit_boss', hpScale: 1.25, betScale: 1.2 },
  { n: 3, name: 'The Mezzanine',         sub: 'The regulars up here have been dead a long time.',
    enemies: ['chalk_eddie', 'widow_vane', 'two_bit', 'bonesetter', 'sister_riches', 'the_runner', 'backdoor_bettina'], boss: 'countess', hpScale: 1.55, betScale: 1.5 },
  { n: 4, name: 'The High-Roller Suite', sub: 'Stakes nobody alive could cover.',
    enemies: ['bonesetter', 'sister_riches', 'madame_zero', 'the_collector', 'backdoor_bettina'], boss: 'auditor', hpScale: 1.85, betScale: 1.8 },
  { n: 5, name: 'The Penthouse',         sub: 'One table. One door. One way up.',
    enemies: ['madame_zero', 'the_collector', 'concierge'], boss: 'the_house', hpScale: 2.20, betScale: 2.2 },
];

/* ===================== The Depths (side-boards) =====================
 * A failed "gambit" event drops you off the floor into one of these — a short,
 * easier sub-map you must fight out of to return to where you were. No events,
 * shops or bosses down here: just a couple of fights and a way back up. Enemies
 * reuse the roster (themed by the place) at a gentle, fixed low-act scaling, so
 * a depth is "a little challenging," never a wall — regardless of how deep in
 * the run you fell. Gambits (and thus depths) only appear once you're past the
 * first boss (act 2+). */
SO.DEPTHS = {
  ravine:   { id: 'ravine',   name: 'The Ravine',  sub: 'You went over the edge. Claw your way back up.', enemies: ['newcomer', 'two_bit', 'tony'],       rows: 3, hpScale: 0.9, betScale: 0.85 },
  sewers:   { id: 'sewers',   name: 'The Sewers',  sub: 'Down in the muck with the things that live here.', enemies: ['mariah', 'chalk_eddie', 'two_bit'],  rows: 3, hpScale: 0.95, betScale: 0.85 },
  cistern:  { id: 'cistern',  name: 'The Flooded Cistern', sub: 'You sank. Wade back to the stairs.',        enemies: ['tony', 'bonesetter', 'widow_vane'],  rows: 4, hpScale: 1.0, betScale: 0.9 },
  catacomb: { id: 'catacomb', name: 'The Catacombs', sub: 'Down among the ones who never cashed out.',       enemies: ['tony', 'widow_vane', 'sister_riches'], rows: 3, hpScale: 0.95, betScale: 0.85 },
  boiler:   { id: 'boiler',   name: 'The Boiler Room', sub: 'Below the floor, where the house keeps its heat.', enemies: ['chalk_eddie', 'two_bit', 'bonesetter'], rows: 4, hpScale: 1.0, betScale: 0.9 },
  // A rare GOOD fall — the counting-room. Trivially short, and the exit hands you
  // guaranteed loot. Reached only on a lucky gambit (never a punishment).
  vault:    { id: 'vault',    name: 'The Counting Room', sub: 'You fell UP — into the house’s vault. Grab what you can and go.', enemies: ['newcomer', 'mariah'], rows: 2, hpScale: 0.7, betScale: 0.7, treasure: true },
};
// The "bad fall" pool (a failed gambit lands in one of these). The Vault is NOT
// here — it's the rare jackpot, entered only via a lucky gambit success.
SO.DEPTH_ORDER = ['ravine', 'sewers', 'cistern', 'catacomb', 'boiler'];

/* ===================== Relics ===================== */
SO.RELICS = {
  clipped_wings:     { id: 'clipped_wings', name: 'Clipped Wings', rarity: 'common', text: 'Start each duel at +10 HP.' },
  charons_coin:      { id: 'charons_coin', name: "Charon's Coin", rarity: 'common', text: '+5 coins each duel won.' },
  marked_bones:      { id: 'marked_bones', name: 'Marked Bones', rarity: 'uncommon', text: 'Your Loaded Die and Nudge cards cost 0 Nerve.' },
  tourniquet_ring:   { id: 'tourniquet_ring', name: 'Tourniquet Ring', rarity: 'uncommon', text: 'Your bleed ramp is reduced by 1 permanently.' },
  gamblers_talisman: { id: 'gamblers_talisman', name: "Gambler's Talisman", rarity: 'uncommon', text: '+25% to all your prop/hardway payouts.' },
  house_edge:        { id: 'house_edge', name: 'The House Edge', rarity: 'uncommon', text: 'You win roll-off ties (you set the point).' },
  leech_stone:       { id: 'leech_stone', name: 'Leech Stone', rarity: 'rare', text: 'Heal 2 HP whenever an opponent busts.' },
  loaded_conscience: { id: 'loaded_conscience', name: 'Loaded Conscience', rarity: 'rare', text: 'Once per duel, automatically prevent the first bust.' },
  dead_mans_hand:    { id: 'dead_mans_hand', name: "Dead Man's Hand", rarity: 'uncommon', text: 'Draw 6 cards each round instead of 5.' },
  velvet_rope:       { id: 'velvet_rope', name: 'Velvet Rope', rarity: 'uncommon', text: 'Shop prices are 25% lower.' },
  rabbits_foot:      { id: 'rabbits_foot', name: "Rabbit's Foot", rarity: 'common', text: '+1 to your roll-off totals.' },
  iron_stomach:      { id: 'iron_stomach', name: 'Iron Stomach', rarity: 'uncommon', text: 'Your base bleed is reduced by 1.' },
  meal_ticket:       { id: 'meal_ticket', name: 'Meal Ticket', rarity: 'common', text: '+3 coins every node you enter.' },
  pawn_ticket:       { id: 'pawn_ticket', name: 'Pawn Ticket', rarity: 'common', text: 'Card removal costs 10 less.' },
  golden_tooth:      { id: 'golden_tooth', name: 'Golden Tooth', rarity: 'uncommon', text: 'Heal +3 whenever you win a round.' },
  nerve_tonic:       { id: 'nerve_tonic', name: 'Nerve Tonic', rarity: 'rare', text: '+1 Nerve on your first turn each round.' },
  ghost_grip:        { id: 'ghost_grip', name: 'Ghost Grip', rarity: 'uncommon', text: 'Your first pull each round is tax-free.' },
  phoenix_feather:   { id: 'phoenix_feather', name: 'Phoenix Feather', rarity: 'rare', text: 'Once per run, survive death at 25% of max HP.' },
  // bet-type depth — the travelling bets and the number boxes finally pay to build around
  travellers_chip:   { id: 'travellers_chip', name: "Traveller's Chip", rarity: 'uncommon', text: '+30% to all your Come / Don’t-Come payouts.' },
  street_ledger:     { id: 'street_ledger', name: 'Street Ledger', rarity: 'uncommon', text: '+30% to all your Place-bet payouts.' },

  /* ===================== Relic expansion (V.0.4.7) =====================
   * The roster was thin — 20 relics behind 149 cards. This batch fills every
   * archetype: rig, don't-line, prop, line/odds, survival, economy, and a new
   * CURSE-SYNERGY line that turns a deck full of curses into an asset. All read
   * hooks live in duel._computeRelicMods / _betMods / resolveRound / run.js. */
  // -- rig: control the dice --
  weighted_bones:    { id: 'weighted_bones', name: 'Weighted Bones', rarity: 'uncommon', text: '+2 to your roll-off totals.' },
  false_shuffle:     { id: 'false_shuffle', name: 'False Shuffle', rarity: 'uncommon', text: 'Draw one extra card at the start of each round.' },
  crooked_dealer:    { id: 'crooked_dealer', name: 'Crooked Dealer', rarity: 'rare', text: 'The first 3 rig cards you play each duel are free.' },
  // -- line & odds --
  ivory_dice:        { id: 'ivory_dice', name: 'Ivory Dice', rarity: 'rare', text: '+20% to your Pass / Don’t-Pass line payouts.' },
  true_odds:         { id: 'true_odds', name: 'True Odds', rarity: 'rare', text: '+25% to your Odds payouts.' },
  // -- don't-line: profit from ruin --
  black_veil:        { id: 'black_veil', name: 'Black Veil', rarity: 'uncommon', text: 'Heal 3 whenever an opponent busts.' },
  mourning_band:     { id: 'mourning_band', name: 'Mourning Band', rarity: 'rare', text: 'You deal +2 on the Cut when you make your point.' },
  // -- prop & place --
  horns_charm:       { id: 'horns_charm', name: "Horn's Charm", rarity: 'uncommon', text: '+20% to your prop / hardway payouts.' },
  field_marshal:     { id: 'field_marshal', name: 'Field Marshal', rarity: 'uncommon', text: 'Your Field bets also pay on the 5.' },
  numbers_racket:    { id: 'numbers_racket', name: 'Numbers Racket', rarity: 'uncommon', text: '+15% to your Place payouts.' },
  // -- survival --
  guardian_angel:    { id: 'guardian_angel', name: 'Guardian Angel', rarity: 'uncommon', text: 'Start each duel at +15 HP.' },
  communion_wine:    { id: 'communion_wine', name: 'Communion Wine', rarity: 'uncommon', text: 'Heal +2 whenever you win a round.' },
  hospice_key:       { id: 'hospice_key', name: 'Hospice Key', rarity: 'rare', text: 'You take 1 less from the Cut.' },
  slow_bleed:        { id: 'slow_bleed', name: 'Slow Bleed', rarity: 'uncommon', text: 'Your bleed ramp is reduced by 1.' },
  // -- economy --
  house_account:     { id: 'house_account', name: 'House Account', rarity: 'common', text: '+2 coins every node you enter.' },
  counting_room:     { id: 'counting_room', name: 'Counting Room', rarity: 'uncommon', text: '+8 coins each duel you win.' },
  // -- curse synergy: a deck full of curses becomes an asset --
  martyrs_brand:     { id: 'martyrs_brand', name: "Martyr's Brand", rarity: 'rare', text: 'Start each duel at +6 HP for every curse in your deck.' },
  penance:           { id: 'penance', name: 'Penance', rarity: 'rare', text: 'Your base bleed is reduced by 1 for every curse in your deck (max 3).' },
  indulgence:        { id: 'indulgence', name: 'Indulgence', rarity: 'uncommon', text: '+1 Nerve every turn for every 2 curses in your deck.' },
};
SO.RELIC_POOL = Object.keys(SO.RELICS);

/* ===================== Unlockable cards & relics =====================
 * A small slice of the pools starts locked and opens as you hit lifetime
 * milestones (tracked in SO.Profile). Anything NOT listed here is always
 * available, and with no profile at all (the node test harness) nothing is
 * gated — so tests stay deterministic. Never lock a soul's signature relic
 * (leech_stone / gamblers_talisman / iron_stomach) or a starter card. */
SO.UNLOCKS = [
  { id: 'gods_thumb',        kind: 'card',  req: 'bossesDown', n: 1,    hint: 'Beat your first boss' },
  { id: 'nerve_tonic',       kind: 'relic', req: 'bossesDown', n: 1,    hint: 'Beat your first boss' },
  { id: 'golden_horseshoe',  kind: 'card',  req: 'bossesDown', n: 3,    hint: 'Beat 3 bosses' },
  { id: 'whales_shadow',     kind: 'card',  req: 'coinsSpent', n: 300,  hint: 'Spend 300 coins (all runs)' },
  { id: 'war_chest',         kind: 'card',  req: 'coinsSpent', n: 300,  hint: 'Spend 300 coins (all runs)' },
  { id: 'phoenix_ash',       kind: 'card',  req: 'winPass',    n: 1,    hint: 'Win a run with a Pass-line soul' },
  { id: 'phoenix_feather',   kind: 'relic', req: 'winPass',    n: 1,    hint: 'Win a run with a Pass-line soul' },
  { id: 'blacklist',         kind: 'card',  req: 'winDont',    n: 1,    hint: 'Win a run with a Don’t-line soul' },
  { id: 'loaded_conscience', kind: 'relic', req: 'winDont',    n: 1,    hint: 'Win a run with a Don’t-line soul' },
  { id: 'all_or_nothing',    kind: 'card',  req: 'depthsEscaped', n: 1, hint: 'Escape the Depths' },
  { id: 'dead_mans_hand',    kind: 'relic', req: 'depthsEscaped', n: 3, hint: 'Escape the Depths three times' },
  // ---- the four later souls are earned, not given (kind:'soul' — same gate) ----
  { id: 'mechanic',  kind: 'soul', req: 'winPass',       n: 1,   hint: 'Win a run with a Pass-line soul' },
  { id: 'mortician', kind: 'soul', req: 'winDont',       n: 1,   hint: 'Win a run with a Don’t-line soul' },
  { id: 'baron',     kind: 'soul', req: 'coinsSpent',    n: 500, hint: 'Spend 500 coins (all runs)' },
  { id: 'sister',    kind: 'soul', req: 'depthsEscaped', n: 2,   hint: 'Escape the Depths twice' },
];
SO.UNLOCK_BY_ID = {};
SO.UNLOCKS.forEach((u) => { SO.UNLOCK_BY_ID[u.id] = u; });
SO.isUnlocked = function (id) {
  const u = SO.UNLOCK_BY_ID[id];
  if (!u) return true;            // not gated
  if (!SO.Profile) return true;   // no profile (tests) → nothing gated
  return SO.Profile.milestone(u.req) >= u.n;
};
SO.unlockName = function (u) {
  if (!u) return '';
  if (u.kind === 'soul') return ((SO.CHARACTERS || {})[u.id] || {}).name || u.id;
  if (u.kind === 'relic') return (SO.RELICS[u.id] || {}).name || u.id;
  const c = SO.getCard ? SO.getCard(u.id) : null;
  return (c && c.name) || u.id;
};
SO.MILESTONE_LABEL = { bossesDown: 'bosses beaten', coinsSpent: 'coins spent', winPass: 'Pass-line wins', winDont: 'Don’t-line wins', depthsEscaped: 'Depths escaped' };

/* ===================== Ascension rule-twists =====================
 * Past Damned Luck the rungs no longer just scale numbers — each adds its own
 * NAMED rule, and they STACK (at Ascension III you carry I, II and III). They
 * ride the same `run.mods` passthrough the Run Modifiers use, so the duel and
 * run layers need no special casing. Applied in main.startRun AFTER the
 * modifiers (which reset run.mods). */
SO.ASCENSION_TWISTS = [
  { rung: 1, name: 'Sharpened Elites',     desc: 'Elites carry +30% HP and bet bigger.',            apply(r) { r.mods.eliteHpBonus = (r.mods.eliteHpBonus || 0) + 0.30; r.mods.eliteBetBonus = (r.mods.eliteBetBonus || 0) + 2; } },
  { rung: 2, name: 'The House Takes More', desc: 'Everything in the shop costs 30% more.',          apply(r) { r.mods.shopMult = (r.mods.shopMult || 1) * 1.30; } },
  { rung: 3, name: 'Marked from the Start', desc: 'You begin the run with a Bad Beat curse.',       apply(r) { r.player.deck.push('bad_beat'); } },
  { rung: 4, name: 'Impatient House',      desc: 'Last Call arrives 4 rounds sooner.',              apply(r) { r.mods.lastCallDelta = (r.mods.lastCallDelta || 0) + 4; } },
  { rung: 5, name: 'No Quarter',           desc: 'Rest fires mend only half as much.',              apply(r) { r.mods.halfRest = true; } },
];
// which twists are live at an ascension level (0-4 = base difficulties → none)
SO.ascensionTwistsFor = function (level) {
  const rungs = Math.max(0, (level | 0) - (SO.DIFFICULTY.length - 1));
  return SO.ASCENSION_TWISTS.filter((t) => t.rung <= rungs);
};
SO.applyAscensionTwists = function (run) {
  const live = SO.ascensionTwistsFor(run.ascension || 0);
  live.forEach((t) => t.apply(run));
  return live;
};

/* ===================== Run modifiers =====================
 * Optional pre-run rule toggles for spice and challenge. Each apply(run) runs
 * once at run start; it may scale the run's per-run `diff` copy (safe — it's a
 * fresh object, never the shared SO.DIFFICULTY), touch run.player, or set a
 * flag on run.mods (the object handed to the Duel as `runMods`). Harder mods
 * carry a score multiplier. Everything here is opt-in; default is no modifiers. */
SO.RUN_MODIFIERS = [
  { id: 'sturdy_house', name: 'Sturdy House', icon: '🏛', scoreMult: 1.15, desc: 'Every enemy has +30% HP.', apply(r) { r.diff.enemyHp *= 1.3; } },
  { id: 'high_rollers', name: 'High Rollers', icon: '💰', scoreMult: 1.15, desc: 'Enemies bet 30% bigger.', apply(r) { r.diff.enemyBet *= 1.3; } },
  { id: 'open_wound', name: 'Open Wound', icon: '🩸', scoreMult: 1.2, desc: 'Your bleed runs 50% deeper.', apply(r) { r.diff.bleedMult *= 1.5; } },
  { id: 'cutthroat', name: 'Cutthroat Floor', icon: '🔪', scoreMult: 1.15, desc: 'Enemies interfere far more often.', apply(r) { r.diff.interfereMult *= 1.5; } },
  { id: 'poverty', name: 'Vow of Poverty', icon: '🕳️', scoreMult: 1.15, desc: 'You earn 40% fewer coins.', apply(r) { r.diff.coinMult *= 0.6; } },
  { id: 'glass_soul', name: 'Glass Soul', icon: '🔮', scoreMult: 1.3, desc: 'Start with 60 max HP instead of 100.', apply(r) { r.player.maxHp = 60; r.player.hp = 60; } },
  { id: 'cursed_hand', name: 'Cursed Hand', icon: '☠️', scoreMult: 1.2, desc: 'Begin with two Bad Beat curses in your deck.', apply(r) { r.player.deck.push('bad_beat', 'bad_beat'); } },
  { id: 'wrathful', name: 'Wrathful House', icon: '😡', scoreMult: 1.2, desc: 'Anger strikes twice as hard.', apply(r) { r.mods.angerMult = 2; } },
  { id: 'no_odds', name: 'No Odds', icon: '🚫', scoreMult: 1.15, desc: 'You cannot take or lay Odds.', apply(r) { r.mods.noOdds = true; } },
  { id: 'no_rest', name: 'No Rest for the Wicked', icon: '🔥', scoreMult: 1.15, desc: 'Rest fires mend only half as much.', apply(r) { r.mods.halfRest = true; } },
  // The only EASIER modifier — a shorter gauntlet for the permadeath purist, at a
  // score penalty. Fewer rows/act = fewer required fights before each boss.
  { id: 'short_run', name: 'Short Run', icon: '⏱️', scoreMult: 0.65, desc: 'Fewer nodes each act — a shorter, kinder climb. (Lower score.)', apply(r) { r.mods.actRows = SO.CONFIG.SHORT_RUN_ROWS; r.map = SO.generateMap(r.rng, r.act); } },
];
SO.MODIFIER_BY_ID = {};
SO.RUN_MODIFIERS.forEach((m) => { SO.MODIFIER_BY_ID[m.id] = m; });

// Endless mode: each floor past The House ramps the run's diff by these factors.
SO.ENDLESS_HP_STEP = 1.25;
SO.ENDLESS_BET_STEP = 1.18;
SO.ENDLESS_BLEED_STEP = 1.10;

/* ===================== Achievements =====================
 * Awarded imperatively at the moment they happen (see main.js) — simpler and
 * harder to get wrong than re-deriving them from stats. */
SO.ACHIEVEMENTS = [
  { id: 'first_boss',  name: 'Floor Manager',   desc: 'Beat your first boss.' },
  { id: 'beat_house',  name: 'The House Bows',  desc: 'Win a run — all five acts.' },
  { id: 'damned_win',  name: 'Damned Luck',     desc: 'Win a run on Damned Luck or higher.' },
  { id: 'ascend_v',    name: 'Ascended',        desc: 'Win a run at the top of the Ascension ladder.' },
  { id: 'last_stand',  name: 'Time, Gentlemen', desc: 'Win a duel that went to Last Call.' },
  { id: 'iron_nerve',  name: 'Iron Nerve',      desc: 'Win a run without ever pulling a bet.' },
  { id: 'lean_deck',   name: 'Sharp Practice',  desc: 'Win a run holding 10 cards or fewer.' },
  { id: 'four_faces',  name: 'Four Faces',      desc: 'Win a run with each of the four souls.' },
  { id: 'know_thy',    name: 'Know Thy Enemy',  desc: 'Meet all twelve souls of the floor.' },
  { id: 'whale',       name: 'Whale',           desc: 'Spend 1,000 coins across all runs.' },
  { id: 'against_odds', name: 'Against All Odds', desc: 'Beat the 25% and pull a relic from the brink.' },
  { id: 'spelunker',    name: 'Spelunker',        desc: 'Fall into the Depths — and climb back out.' },
  { id: 'caver',        name: 'Nine Lives Down',  desc: 'Escape three different Depths.' },
];

/* ===================== Media: music, portraits, credits ===================== */
// Track id -> file. Loops are handled by the audio manager (js/audio.js).
SO.MUSIC = {
  menu: 'https://github.com/CJCx3/HomePage/releases/download/awecrap-audio-v1/music_menu.mp3',
  map: 'https://github.com/CJCx3/HomePage/releases/download/awecrap-audio-v1/music_map.mp3',
  duel_point: 'https://github.com/CJCx3/HomePage/releases/download/awecrap-audio-v1/music_duel_point.mp3',
  duel_attrition: 'https://github.com/CJCx3/HomePage/releases/download/awecrap-audio-v1/music_duel_attrition.mp3',
  duel_prop: 'https://github.com/CJCx3/HomePage/releases/download/awecrap-audio-v1/music_duel_prop.mp3',
  duel_control: 'https://github.com/CJCx3/HomePage/releases/download/awecrap-audio-v1/music_duel_control.mp3',
  boss_floor_manager: 'https://github.com/CJCx3/HomePage/releases/download/awecrap-audio-v1/music_boss_floor_manager.mp3',
  boss_pit_boss: 'https://github.com/CJCx3/HomePage/releases/download/awecrap-audio-v1/music_boss_pit_boss.mp3',
  boss_countess: 'https://github.com/CJCx3/HomePage/releases/download/awecrap-audio-v1/music_boss_countess.mp3',
  boss_auditor: 'https://github.com/CJCx3/HomePage/releases/download/awecrap-audio-v1/music_boss_auditor.mp3',
  boss_the_house: 'https://github.com/CJCx3/HomePage/releases/download/awecrap-audio-v1/music_boss_the_house.mp3',
  shop: 'https://github.com/CJCx3/HomePage/releases/download/awecrap-audio-v1/music_shop.mp3',
  rest: 'https://github.com/CJCx3/HomePage/releases/download/awecrap-audio-v1/music_rest.mp3',
};

// Continuous background bed — loops under the music at a fraction of the master
// volume (see AMB_SCALE in audio.js), starts on first gesture, never swaps.
SO.AMBIENCE = {
  casino: 'https://github.com/CJCx3/HomePage/releases/download/awecrap-audio-v1/amb_casino.mp3',
};

// One-shot stingers fired at story beats (non-looping; played over the music).
SO.SFX = {
  victory: 'https://github.com/CJCx3/HomePage/releases/download/awecrap-audio-v1/sting_victory.mp3',
  defeat: 'https://github.com/CJCx3/HomePage/releases/download/awecrap-audio-v1/sting_defeat.mp3',
  boss_down: 'https://github.com/CJCx3/HomePage/releases/download/awecrap-audio-v1/sting_boss_down.mp3',
};

// Boss id -> profile portrait shown on the duel board.
SO.BOSS_PORTRAITS = {
  floor_manager: 'AweCrapBossPics/Act1.png',
  pit_boss: 'AweCrapBossPics/Act2.png',
  countess: 'AweCrapBossPics/Act3.png',
  auditor: 'AweCrapBossPics/Act4.png',
  the_house: 'AweCrapBossPics/Act5.png',
};

// Rendered on the main-menu Credits tab (see https://github.com/CJCx3/HomePage/releases/download/awecrap-audio-v1/Credits.txt).
SO.CREDITS = [
  { section: 'Game', lines: [
    ['Design & direction', 'Connor Corkum'],
    ['Built with', 'Claude'],
  ]},
  { section: 'Testing', lines: [
    ['Playtester', 'Denzel Johnson'],
    ['Playtester', 'Cole Corkum'],
  ]},
  { section: 'Music', lines: [
    ['Main menu theme', 'Mozart AI'],
    ['The floor (map) theme', 'Suno AI'],
    ['Duel — Point Specialists', 'Mureka'],
    ['Duel — Attrition', 'Mureka'],
    ['Duel — Prop Cannons', 'MusicSeed AI'],
    ['Duel — Controllers', 'MusicAI'],
    ['Boss — The Floor Manager', 'TadAi'],
    ['Boss — The Pit Boss', 'MusicGPT'],
    ['Boss — The Countess', 'MusicGPT'],
    ['Boss — The Auditor', 'MusicGPT'],
    ['Boss — The House', 'MusicGPT'],
    ['Shop theme', 'MusicGPT'],
    ['Rest fire theme', 'MusicGPT'],
  ]},
  { section: 'Ambience & SFX', lines: [
    ['Casino ambience', 'Freesounds'],
    ['Victory & defeat stings', 'Freesounds'],
  ]},
];

/* ===================== Version & changelog =====================
 * SO.VERSION is the single source of truth — it stamps the title's neon tag
 * and the "What's New" popup. The popup auto-shows once per version on startup.
 * MAINTENANCE: add each new build to the TOP of SO.UPDATES. Only the most
 * recent SO.UPDATES_MAX entries are shown; older ones simply fall off (delete
 * them from the array when you like). Bump SO.VERSION so the popup re-appears.
 */
SO.VERSION = 'V.0.4.11';
SO.UPDATES_MAX = 5;   // keep only the newest N updates; older ones roll off
SO.UPDATES = [
  {
    version: 'V.0.4.11', date: 'July 2026', title: 'The room breathes; the numbers settle.',
    notes: [
      '<b>Board ambience</b> — the table has idle life now: cigarette smoke drifting up behind the felt, a flickering neon sign, and a dealer’s silhouette at the head of the table. All of it stills under <b>Reduced motion</b> or <b>Low/Medium graphics</b>.',
      '<b>A full rebalancing pass.</b> The soul spread closed from 45 points to 32 (“workable — nobody is unplayable”): <b>The Baron</b> was the floor at 32% duel-win and is now mid-pack — two of his dead-weight cards became riggers so he can actually make his points while still raking coin.',
      '<b>Two overtuned relics reined in:</b> <b>Nerve Tonic</b> now gives its +1 Nerve on your first turn each round (was every turn), and <b>Hospice Key</b> blunts the Cut by 1 (was 2). Every other relic measured inside the healthy band.',
    ],
  },
  {
    version: 'V.0.4.10', date: 'July 2026', title: 'A shorter climb, a deeper fall.',
    notes: [
      'New <b>Short Run</b> modifier — fewer nodes each act, for a kinder permadeath climb (at a lower score). A real shot for the one-life purist, alongside the Phoenix Feather revive.',
      '<b>The Depths run deeper.</b> Two new places to fall — the <b>Catacombs</b> and the <b>Boiler Room</b> — and a rare GOOD fall: tumble UP into <b>the Counting Room</b>, the house’s own vault, and walk out with loot. Every escape now pays coins, and a relic (guaranteed from the Vault).',
      '<b>A curse build.</b> Five new cards WANT a cursed deck — <b>Bad Penny</b>, <b>Spite</b>, <b>Ballast</b>, <b>Scapegoat</b>, <b>Gallows Humor</b> — plus the <b>Indulgence</b> relic. With Cursed Hand or the curse events, a deck full of curses becomes a weapon.',
      '<b>Under the hood:</b> a friendly “the table folded — here’s your seed” screen if the game ever hits an error, and a new scripted QA gate that already caught a card quietly lost to a name clash back in the bet-type update.',
    ],
  },
  {
    version: 'V.0.4.9', date: 'July 2026', title: 'Hover to learn, lose to learn.',
    notes: [
      '<b>Tooltips everywhere.</b> Hover (or tap) any <b>bet zone</b> on the felt for what it does and what it pays, any <b>relic</b> in the top bar for its full text, a card’s <b>type</b> chip for what that type means, or a duel <b>status</b> badge — not just the six log keywords anymore.',
      '<b>A death that teaches.</b> When you fall, the end screen now <b>names what struck the killing blow</b> — the bleed, the House’s Anger, the Cut, a seven-out — and shows the <b>last few lines of the fight</b>, so a loss tells you what to change.',
    ],
  },
  {
    version: 'V.0.4.8', date: 'July 2026', title: 'Sharper elites, smoother table.',
    notes: [
      '<b>Elites now have RULES, not just bigger numbers.</b> Every ☠ elite carries a signature gimmick: <b>the Rigger</b> always makes its point · <b>the Leech</b> heals when you bleed · <b>the Cooler</b> skims your exposed chips · <b>the Sharp</b> wins roll-off ties · <b>the Bruiser</b> shrugs off your interference · <b>the Usurer</b> taxes your cards +1 Nerve. The gimmick is named up front, so you can plan for it.',
      '<b>Betting is less fiddly.</b> Pick your chip size (<b>5 / 10 / 25</b> per tap), fill your <b>Odds to the max</b> in one click, and <b>↶ Undo</b> a mis-tapped chip — free — before you roll.',
      '<b>A copyable run recap</b> on the end screen: score, soul, rung, deepest floor and the seed to run it back — one tap to the clipboard.',
      '<b>Accessibility:</b> a <b>Text size</b> slider (Normal / Large / Larger) and a <b>High contrast</b> mode join Colorblind and Reduced motion in Settings.',
      'A <b>touch pass</b> — bigger tap targets and no tap-delay on phones and tablets.',
    ],
  },
  {
    version: 'V.0.4.7', date: 'July 2026', title: 'A fuller treasury.',
    notes: [
      '<b>18 new relics</b> — the vault was thin (20 relics behind 149 cards); it is now 38. Every playstyle gets support: rig (Weighted Bones, Crooked Dealer), the line & odds (Ivory Dice, True Odds), the Don’t side (Black Veil, Mourning Band), props & the number boxes (Horn’s Charm, Field Marshal, Numbers Racket), survival (Guardian Angel, Hospice Key, Communion Wine, Slow Bleed), and the coin game (House Account, Counting Room).',
      'A whole new <b>curse-synergy line</b>: <b>Martyr’s Brand</b> and <b>Penance</b> reward a deck stuffed with curses — the more curses you carry, the stronger they get. A reason to embrace Cursed Hand instead of fearing it.',
      'Every new relic was <b>run through the balance bot</b> and checked for lift; the one true outlier (Crooked Dealer) was toned from a free rig every round to a pool of three per duel.',
    ],
  },
  {
    version: 'V.0.4.6', date: 'July 2026', title: 'The rest of the board.',
    notes: [
      'New <b>CODEX</b> tab in RECORDS — every card and every relic in the game, with its text, its lock, and how many times you have <b>seen</b> and <b>played</b> it. Play one ten times and it is marked <b>mastered</b>. Filter by type; anything you have never met stays a silhouette.',
      '<b>Come and Don’t-Come finally matter.</b> Nine new cards build around the travelling bets and the prop table — send a bet down the road, double every payout on it, or shield it from the seven — plus two relics (<b>Traveller’s Chip</b>, <b>Street Ledger</b>) and two new souls to fight: <b>The Runner</b> and <b>Backdoor Bettina</b>, who bet the line and the road at once.',
      '<b>Soul balance pass.</b> The Baron was winning 13% of his fights and the Mechanic 82% — a 69-point gap. Decks retuned across five souls; the gap is now 40 and nobody is unplayable.',
      'The balance report now breaks results down <b>by soul</b> and flags dead or oppressive <b>relics</b>, matched on soul, act and node type so a signature relic no longer just reports its owner’s strength.',
    ],
  },
  {
    version: 'V.0.4.5', date: 'July 2026', title: 'Souls worth earning, rungs worth fearing.',
    notes: [
      'The four later souls — <b>Mechanic, Mortician, Baron, Sister</b> — are now <b>earned, not given</b>. Each shows in the SOUL selector with exactly what it takes to unlock (a Pass-line win, a Don’t-line win, 500 coins spent, two Depths escaped).',
      'The <b>Ascension rungs now change the RULES</b>, not just the numbers — and they stack: <b>I</b> Sharpened Elites · <b>II</b> The House Takes More · <b>III</b> Marked from the Start · <b>IV</b> Impatient House · <b>V</b> No Quarter. Settings names the rules live at your rung.',
      'Played cards now <b>sail onto the felt</b>, and a win <b>spills chips</b> across the screen (a smaller spill when a boss goes down).',
      'The dice feel <b>snappier</b> — a quicker tumble, a real landing thunk, and a harder hit that holds a beat longer when the roll actually matters (your point, or a 7).',
      'All of the new motion respects the <b>Reduced motion</b> toggle.',
    ],
  },
  {
    version: 'V.0.4.1', date: 'July 2026', title: 'Clearer, calmer.',
    notes: [
      'New <b>keyword tooltips</b> — hover or tap the underlined terms in the combat log (and the ANGER / BLEED meters) for a plain-English definition of the Cut, Bleed, Anger, seven-out, De-escalation and Last Call. No more digging through the guide mid-fight.',
      'New <b>Reduced motion</b> toggle in Settings — stills the flicker, pulse and dice-tumble animations for motion-sensitive players, at any graphics quality.',
    ],
  },
  {
    version: 'V.0.4.0', date: 'July 2026', title: 'The Depths, and four new souls.',
    notes: [
      'New <b>gambit</b> events (act 2 onward): a relic dangles somewhere dangerous — reach for it and it’s <b>1-in-4</b> you grab it, <b>3-in-4</b> you fall.',
      'Fall and you drop into <b>The Depths</b> — the Ravine, the Sewers, or the Flooded Cistern. A short, easier side-board with no events or shops: just fight your way to the <b>EXIT</b> and climb back to exactly where you were.',
      'Four <b>new souls</b> to pick, one for each classic style: the <b>Mechanic</b> (pass, all rigging), the <b>Mortician</b> (don’t-line, cold and cruel), the <b>Baron</b> (props &amp; coin), and the <b>Sister</b> (survival, simply won’t die). Eight souls now.',
      'New <b>achievements</b> — Against All Odds, Spelunker, Nine Lives Down — and new <b>unlocks</b> earned by escaping the Depths.',
    ],
  },
  {
    version: 'V.0.3.6', date: 'July 2026', title: 'Deeper, and harder if you dare.',
    notes: [
      'New <b>Endless mode</b> — beat The House and a <b>Descend Deeper</b> button appears. Keep dropping floors that get worse and worse, chasing the highest score you can before you fall. (No way back up — the Descent is one life.)',
      'New <b>Run Modifiers</b> on the menu — ten opt-in challenges you can stack before a run: <b>Glass Soul</b>, <b>Wrathful House</b>, <b>Open Wound</b>, <b>Cursed Hand</b>, <b>No Odds</b>, and more. Each one raises your score multiplier.',
      'Pick your poison from the <b>MODIFIERS</b> selector next to your Soul; your choices stick between runs and show on the end-screen scorecard.',
    ],
  },
  {
    version: 'V.0.3.5', date: 'July 2026', title: 'Twelve new tricks.',
    notes: [
      'A full audit of all 128 cards — every effect verified to actually fire — plus <b>12 new cards</b> to fill the gaps.',
      'New aggro: <b>Sucker Punch</b> (harder if their felt is empty) and <b>Bleed Them Dry</b>. New bet tech: <b>Press the Bet</b> (doubles your biggest) and the all-or-nothing <b>All or Nothing</b>.',
      'New survival and tempo: <b>Stitch Up</b>, <b>Fresh Hand</b>, <b>Cold Sweat</b>, and <b>Closing Time</b> — which pays off huge if you drag a fight to Last Call.',
      'Plus <b>Thumb on the Scale</b>, <b>Even the Odds</b>, <b>Windfall</b>, and <b>Bankroll</b>. 140 cards in the deck now.',
    ],
  },
  {
    version: 'V.0.3.4', date: 'July 2026', title: 'A second chance, if you want it.',
    notes: [
      'New <b>Checkpoints</b> toggle in Settings. With it on, dying no longer ends your run — the house drags you back to the top of your current act to try again. That floor’s spoils (the cards, coins, and HP you’d gathered since the last boss) are forfeit, so it softens the run without erasing the stakes.',
      'Leave it <b>off</b> for the true one-life gauntlet. Your call, every run.',
    ],
  },
  {
    version: 'V.0.3.3', date: 'July 2026', title: 'The house, recalibrated.',
    notes: [
      'A <b>data-driven balance pass</b> — thousands of simulated runs went into these numbers.',
      'Duels are now <b>decisive</b>: a made point cuts harder (5 → 8), so fights end before they grind. <b>Last Call</b> now fires in a fraction of duels instead of half of them.',
      'The <b>floor eases up</b>, especially on the lower difficulties — Soft Touch finally plays like a soft touch, and the whole ladder was re-scaled around it.',
      'The <b>economy</b> loosened: removing a card is cheaper (25 → 18) and stays cheaper as you thin, so a lean deck is actually reachable. Drafts skew a little richer, too.',
      'A little more <b>rest</b> between fights. (Anger &amp; Bleed were measured and left alone — they only ever bite a soul that won’t bet.)',
    ],
  },
  {
    version: 'V.0.3.2', date: 'July 2026', title: 'Something to chase.',
    notes: [
      'New <b>RECORDS</b> book on the menu, gathering three new things to chase in one place.',
      '<b>Achievements</b> — ten of them, from beating your first boss to winning without ever pulling a bet, or taking The House down on Damned Luck.',
      '<b>Unlockable cards &amp; relics</b> — nine of the floor’s nastiest tricks now start locked and open as you hit lifetime milestones: beat bosses, spend coin, win with each line style.',
      '<b>Run history</b> — your last 20 runs are kept on the books: score, soul, rung, deepest act, toughest foe, and the seed to run it back.',
    ],
  },
  {
    version: 'V.0.3.1', date: 'July 2026', title: 'Fresh floors, clearer felt.',
    notes: [
      '<b>Nine new events</b> — the tab, a shell game, a back-room forge, a confession booth and more now shuffle into the run, so the floor stops repeating itself.',
      'New <b>Colorblind mode</b> (Settings) — chips carry a shape and an always-on letter, damage numbers gain direction arrows, so nothing rides on colour alone.',
      '<b>First-run hints</b> — one-time nudges the first time you hit a shop, pick up a curse, or reach Last Call, for anyone who skipped the tutorial.',
      '<b>Deck screen polish</b> — filter and sort your deck, read every relic in full, and peek at your live draw pile mid-fight.',
    ],
  },
  {
    version: 'V.0.3.0', date: 'July 2026', title: 'Souls, the Bestiary & the Ascension ladder.',
    notes: [
      'Choose your <b>Soul</b> on the menu — four starting characters: the <b>Gambler</b> (the honest hand), the <b>Widow</b> (a don’t-line leech), the <b>High-Roller</b> (props and big swings), and the <b>Penitent</b> (grind and outlast). Each brings its own deck, signature relic, and line style.',
      'New <b>Bestiary</b> in the House Ledger — every soul you defeat unlocks its full dossier: style, tell, and how to counter it. Twelve to collect.',
      'The <b>Ascension ladder</b> — difficulty is now something you climb. Win to unlock the next rung, from Soft Touch up through Damned Luck and on into five escalating <b>Ascension</b> rungs beyond.',
      'A quiet <b>profile</b> now remembers your souls met, runs won, and how far you’ve climbed.',
      'New <b>Wipe all data</b> button in Settings — erase every save, unlock, and record for a clean first-time start.',
    ],
  },
  {
    version: 'V.0.2.3', date: 'July 2026', title: 'Menu tidy-up.',
    notes: [
      'How to Play and the playable tutorial are now one <b>LEARN</b> button — choose “Read the Rules” or “Guided Practice”.',
      'The <b>Quit</b> button moved to a small corner button, so the menu row is less crowded.',
    ],
  },
  {
    version: 'V.0.2.2', date: 'July 2026', title: 'Learn the ropes.',
    notes: [
      'The <b>playable tutorial</b> is now slow and gated — one mechanic at a time, and it waits for you to click Continue.',
      'New <b>Anger</b> and <b>Bleed</b> meters on the board show exactly how hard the next hit lands.',
      '<b>Anger is fairer</b> — it only strikes if you actually had a chance to bet that round.',
      'New <b>Know Your Enemy</b> guide in How to Play: the four AI types, their tells, and how to counter each.',
      'You can now <b>see the enemy’s bets</b> on the felt — their chips ride the table in their own colour.',
    ],
  },
  {
    version: 'V.0.2.1', date: 'July 2026', title: 'Housekeeping.',
    notes: [
      'You can now <b>delete a save slot</b> (with a quick confirm).',
      'Map fix — the bottom-row nodes no longer clip into the frame.',
    ],
  },
  {
    version: 'V.0.2.0', date: 'July 2026', title: 'Anger, seeds & saved runs.',
    notes: [
      'New <b>Anger</b> — the house punishes you for finishing a round without betting, and it escalates every idle round. Your new <b>De-escalation</b> card (you start with one) holds off the next strike.',
      '<b>Save &amp; Quit</b> from the map, then <b>Continue</b> your run later from the menu — three save slots.',
      'A new <b>playable</b>, guided tutorial alongside the written How to Play.',
      'Secret seeds hidden on the tutorial’s last page — a Boss gauntlet, Rich, Loaded, and more.',
      'A <b>Quit</b> button on the menu, and a <b>Menu</b> button on the map.',
    ],
  },
  {
    version: 'V.0.1.0', date: 'July 2026', title: 'The doors open.',
    notes: [
      'New How to Play — a full interactive tutorial with a searchable reference.',
      'New Practice table (🎲) — free-play craps with real payouts, no stakes.',
      'Menu options moved to a tidy row along the bottom.',
      'Music, casino ambience and victory / defeat stings throughout.',
      'Graphics-quality slider + a big performance pass for smoother play.',
    ],
  },
];
