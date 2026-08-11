/* AWECRAP — tutorial-data.js
 * The tutorial's content/data layer. Pure data, no DOM. The engine
 * (tutorial.js) reads these structures and renders them; the reference
 * encyclopedia is built from the same arrays. Adding a bet / boss / page
 * here is all it takes to expand the tutorial — that's the point.
 *
 * SOURCE OF TRUTH: every payout below is taken from js/craps.js so the
 * tutorial teaches the exact numbers the live game pays. House-edge figures
 * are standard real-craps values (for the education chapter) with a note
 * where AweCrap's HP-as-stake changes the picture.
 */
window.SO = window.SO || {};

SO.TUTORIAL = (function () {
  'use strict';

  /* ---------------------------------------------------------------- BETS --
   * category: line | against | come | odds | place | field | prop | hard
   * risk: 1 (safest) .. 5 (wildest)
   * try:  a bet spec the Practice table can pre-arm ({betType, num?}), or null
   * realOnly: taught as real-craps knowledge; AweCrap folds it into another bet
   */
  const bets = [
    {
      id: 'passline', name: 'Pass Line', category: 'line', risk: 2, icon: '➤',
      short: 'Betting WITH the shooter. The bread-and-butter bet.',
      wins: 'Come-out 7 or 11 wins instantly. After a point is set, rolling the point again (before a 7) wins.',
      loses: 'Come-out 2, 3, or 12 (“craps”) loses instantly. After a point, a 7 loses (“seven-out”).',
      payout: 'Even money — 1 : 1.',
      edge: 'House edge 1.41% — one of the best bets on the table.',
      example: 'You bet the Pass Line. Come-out roll is 8 → the point is 8. Roll another 8 before a 7 and you win even money.',
      awecrap: 'Your default line. In AweCrap the point is set by the roll-off, and Pass builds toward the point while a 7 busts you.',
      try: { betType: 'passline' },
    },
    {
      id: 'dontpass', name: "Don't Pass", category: 'against', risk: 2, icon: '⛔',
      short: 'Betting AGAINST the shooter. The mirror of the Pass Line.',
      wins: 'Come-out 2 or 3 wins. After a point, a 7 (before the point) wins.',
      loses: 'Come-out 7 or 11 loses. After a point, rolling the point loses.',
      payout: 'Even money — 1 : 1. Come-out 12 is a push (“bar 12”) — you keep your bet.',
      edge: 'House edge 1.36% — very slightly better than the Pass Line.',
      example: 'You bet Don’t Pass. Point becomes 5. Now you WANT a 7 before another 5. A 7 rolls → you win.',
      awecrap: 'The “Don’t” style. Flip your line with the Pass / Don’t toggle. Now the point busts you and the 7 makes your hand.',
      try: { betType: 'dontpass' },
    },
    {
      id: 'come', name: 'Come', category: 'come', risk: 2, icon: '↻',
      short: 'A Pass Line bet you can make AFTER the point is set. It travels.',
      wins: 'On its first roll: 7 or 11 wins. Then it locks onto whatever number rolls and wins if that number repeats before a 7.',
      loses: 'On its first roll: 2, 3, or 12 loses. After it locks a number, a 7 loses it.',
      payout: 'Even money — 1 : 1.',
      edge: 'House edge 1.41% — identical to the Pass Line.',
      example: 'Point is 6. You put a chip on COME. Next roll is 9 → your Come bet moves to the 9 box. Roll a 9 before a 7 and it pays.',
      awecrap: 'Come bets let you get more numbers “working” at once. Watch the sweep — an unresolved Come bet is swept at round end.',
      try: { betType: 'come' },
    },
    {
      id: 'dontcome', name: "Don't Come", category: 'come', risk: 2, icon: '⟲',
      short: 'A Don’t Pass bet made after the point. Also travels — against the shooter.',
      wins: 'First roll: 2 or 3 wins (12 is a push). After it locks a number, a 7 wins.',
      loses: 'First roll: 7 or 11 loses. After locking, rolling that number loses.',
      payout: 'Even money — 1 : 1. First-roll 12 is barred (push).',
      edge: 'House edge 1.36%.',
      example: 'Point is 4. You bet DON’T COME. A 9 rolls → your bet sits behind the 9, and now a 7 (before a 9) pays you.',
      awecrap: 'The traveling “Don’t”. Strong when you expect the table to seven-out.',
      try: { betType: 'dontcome' },
    },
    {
      id: 'odds', name: 'Odds (Free Odds)', category: 'odds', risk: 1, icon: '✧',
      short: 'A bonus bet behind your line bet that pays TRUE odds — zero house edge.',
      wins: 'Wins with your line bet (point made for Pass odds; 7 for Don’t odds).',
      loses: 'Loses with your line bet.',
      payout: 'True odds — Pass: 4/10 pay 2:1, 5/9 pay 3:2, 6/8 pay 6:5. Don’t odds lay the reverse (1:2, 2:3, 5:6).',
      edge: 'House edge 0.00% — the only bet in the casino with no built-in edge.',
      example: 'Point is 4, you have a Pass Line bet. You add Odds behind it. If the 4 hits, your Odds portion pays 2:1 — double.',
      awecrap: 'You may lay up to 3× your line in Odds (MAX_ODDS_MULTIPLE = 3). Odds are pullable for the pull-tax. The single most efficient HP you can put on the felt.',
      try: { betType: 'passodds' },
    },
    {
      id: 'place', name: 'Place Bets', category: 'place', risk: 3, icon: '◉',
      short: 'Bet that a specific number (4,5,6,8,9,10) rolls before a 7. No come-out needed.',
      wins: 'Your chosen number rolls.',
      loses: 'A 7 rolls first.',
      payout: '6 & 8 pay 7:6 · 5 & 9 pay 7:5 · 4 & 10 pay 9:5.',
      edge: 'House edge: 6/8 = 1.52%, 5/9 = 4.0%, 4/10 = 6.67%. Place the 6 and 8; avoid placing the 4 and 10.',
      example: 'You place the 8 for 6 HP. An 8 rolls → you win 7 (7:6). It stays up and can win again until a 7 clears it.',
      awecrap: 'Place bets ride — they win repeatedly and stay working until a 7 or the sweep. Pullable for the tax. 6 & 8 are the workhorses.',
      try: { betType: 'place', num: 8 },
    },
    {
      id: 'buy', name: 'Buy Bets', category: 'place', risk: 3, icon: '⬡', realOnly: true,
      short: 'Like a Place bet, but you pay a small commission to be paid TRUE odds.',
      wins: 'Your number rolls before a 7.',
      loses: 'A 7 rolls first.',
      payout: 'True odds (4/10 → 2:1) minus a 5% commission (“vig”).',
      edge: 'Buying the 4 or 10 (~4.76% with vig) beats placing them (6.67%).',
      example: 'In a real casino you’d BUY the 10 to be paid 2:1 instead of the Place 9:5.',
      awecrap: 'Purgatory takes no commission — AweCrap has no separate Buy bet. Just Place the number; think of it as “buying” for free. Taught here so you know the term.',
      try: { betType: 'place', num: 10 },
    },
    {
      id: 'lay', name: 'Lay Bets', category: 'place', risk: 3, icon: '⬢', realOnly: true,
      short: 'The reverse of a Buy — bet a 7 comes BEFORE a chosen number.',
      wins: 'A 7 rolls before your number.',
      loses: 'Your number rolls first.',
      payout: 'True odds against, minus a 5% commission.',
      edge: 'A “Don’t”-side tool for laying against the 4 or 10.',
      example: 'You lay the 4: you’re paid if a 7 beats the 4. Risk more to win less, but you’re the favorite.',
      awecrap: 'AweCrap expresses “laying” through the Don’t line and Don’t Odds — no separate Lay bet or commission. Taught for completeness.',
      try: { betType: 'dontodds' },
    },
    {
      id: 'field', name: 'Field', category: 'field', risk: 3, icon: '⚑',
      short: 'A ONE-ROLL bet on a spread of numbers. Resolves on the very next throw.',
      wins: '2, 3, 4, 9, 10, 11, or 12 on the next roll.',
      loses: '5, 6, 7, or 8 on the next roll.',
      payout: '3, 4, 9, 10, 11 pay 1:1 · the 2 pays 2:1 (double) · the 12 pays 3:1 (triple).',
      edge: 'With 2:1/3:1 on the corners, house edge is 2.78% (better than a “2 & 12 both double” field).',
      example: 'You bet the Field. An 11 rolls → even money. Next time a 12 rolls → triple. But an 8 rolls → you lose it.',
      awecrap: 'Seven numbers win, four lose — but the losing four are the most common totals. A one-roll thrill, not a foundation. Auto-returns each roll.',
      try: { betType: 'field' },
    },
    {
      id: 'anyseven', name: 'Any Seven', category: 'prop', risk: 5, icon: '7',
      short: 'One-roll bet that the next total is a 7. The trap bet.',
      wins: 'Next roll is any 7.',
      loses: 'Anything else.',
      payout: '4 : 1.',
      edge: 'House edge 16.67% — the worst standard bet on the table. A 7 is a 6-in-36 shot but only pays 4:1.',
      example: 'You bet Any Seven. A 7 rolls → 4:1. But over time this bet bleeds you faster than almost anything.',
      awecrap: 'Tempting on a “Don’t” build where you want the 7 anyway — but the payout is stingy. Use cards to rig the 7, not this bet.',
      try: { betType: 'any7' },
    },
    {
      id: 'anycraps', name: 'Any Craps', category: 'prop', risk: 4, icon: '✖',
      short: 'One-roll bet that the next total is 2, 3, or 12 (“craps”).',
      wins: 'Next roll is 2, 3, or 12.',
      loses: 'Anything else.',
      payout: '7 : 1.',
      edge: 'House edge 11.1%. A hedge some players ride on the come-out.',
      example: 'You bet Any Craps on the come-out. A 3 rolls → 7:1.',
      awecrap: 'Present as a concept; in duels the come-out is the roll-off, so this is a niche one-roll gamble.',
      try: { betType: 'anycraps' },
    },
    {
      id: 'horn', name: 'Horn / Yo / Aces / Boxcars', category: 'prop', risk: 5, icon: '✦',
      short: 'One-roll bets on a single exact total: 2, 3, 11, or 12.',
      wins: 'Yo = 11 · Ace-Deuce = 3 · Aces (snake eyes) = 2 · Boxcars = 12.',
      loses: 'Any other total.',
      payout: 'Yo (11) 15:1 · Ace-Deuce (3) 15:1 · Aces (2) 30:1 · Boxcars (12) 30:1.',
      edge: 'House edge 11–17%. Lottery-ticket odds — huge payout, tiny chance (a 12 is 1-in-36).',
      example: 'You throw one HP on Boxcars. Double-sixes land → 30:1. Miss and it’s just gone.',
      awecrap: 'The prop cannons (Hot-Hand Mariah, Two-Bit Tommy) live here. Cards like Boxcar Special and Pocket Aces make these swings deadly.',
      try: { betType: 'boxcars' },
    },
    {
      id: 'hardways', name: 'Hardways', category: 'hard', risk: 4, icon: '⚃',
      short: 'Bet a number rolls as a pair (“hard”) before it rolls any other way — or a 7.',
      wins: 'Hard 4 = 2+2, Hard 6 = 3+3, Hard 8 = 4+4, Hard 10 = 5+5.',
      loses: 'The number rolls “easy” (any non-pair), or a 7 rolls.',
      payout: 'Hard 6 & Hard 8 pay 9:1 · Hard 4 & Hard 10 pay 7:1.',
      edge: 'House edge: hard 6/8 = 9.09%, hard 4/10 = 11.1%. Standing bets — they ride until they win or die.',
      example: 'You bet Hard 8. Two 4s land → 9:1. But a 5+3 (easy eight) or any 7 kills it.',
      awecrap: 'A standing prop that rides across rolls. The hardEasyWins rig makes an easy number pay too — a card can flip the math.',
      try: { betType: 'hard', num: 8 },
    },
  ];

  /* ------------------------------------------------------ PROBABILITIES --
   * WAYS out of 36 — from SO.craps.WAYS.
   */
  const probabilities = [
    { total: 2, ways: 1, combos: '1+1', note: 'Snake eyes. Rarest — with the 12.' },
    { total: 3, ways: 2, combos: '1+2, 2+1', note: 'Ace-deuce.' },
    { total: 4, ways: 3, combos: '1+3, 2+2, 3+1', note: 'A “hard” point — tough to repeat.' },
    { total: 5, ways: 4, combos: '1+4, 2+3, 3+2, 4+1', note: '' },
    { total: 6, ways: 5, combos: '1+5, 2+4, 3+3, 4+2, 5+1', note: 'A favorite point — many ways to make it.' },
    { total: 7, ways: 6, combos: '1+6, 2+5, 3+4, 4+3, 5+2, 6+1', note: 'THE most common total. The seven-out.' },
    { total: 8, ways: 5, combos: '2+6, 3+5, 4+4, 5+3, 6+2', note: 'Mirror of 6 — a strong point.' },
    { total: 9, ways: 4, combos: '3+6, 4+5, 5+4, 6+3', note: '' },
    { total: 10, ways: 3, combos: '4+6, 5+5, 6+4', note: 'A “hard” point.' },
    { total: 11, ways: 2, combos: '5+6, 6+5', note: 'Yo. Wins the come-out for Pass.' },
    { total: 12, ways: 1, combos: '6+6', note: 'Boxcars. Rarest — with the 2.' },
  ];

  /* ------------------------------------------------------- AweCrap FEATURES --
   * Each: what it is, why it matters, how to use it, a concrete example.
   * These become the pages of the "AweCrap Twist" chapter and the reference.
   */
  const CFG = (SO.CONFIG || {});
  const features = [
    {
      id: 'hp_as_chips', title: 'HP Is Your Chips', icon: '♥',
      what: 'You don’t have a chip stack — you bet with your life. Every tap on the felt is ' + (CFG.BET_STEP || 5) + ' HP straight off your bar and onto the table.',
      why: 'There is no pot and no ante. The ONLY health you gain back is your own bets paying out. Bet too little and you can’t win enough to survive; bet too much and a bad roll guts you.',
      how: 'Click a zone to place ' + (CFG.BET_STEP || 5) + ' HP. Winning bets return your stake plus winnings to your bar. Manage exposure like a bankroll — because it is one.',
      example: 'You’re at 40 HP. You put 15 on the Pass Line and it makes the point → you’re paid even money and climb back toward full.',
    },
    {
      id: 'the_bleed', title: 'The Bleed', icon: '🩸',
      what: 'A wound that opens whenever you ROLL with no chips on the table. It starts at ' + (CFG.BASE_BLEED || 2) + ' and deepens by ' + (CFG.BLEED_RAMP || 2) + ' every turn you keep bleeding.',
      why: 'It punishes turtling. You cannot simply refuse to bet and outlast the enemy — standing still costs you more each turn.',
      how: 'Keep at least one chip exposed when the dice leave your hand and the bleeding pauses. Note: even a one-roll bet counts as “chips out”.',
      example: 'You roll three turns in a row with an empty felt: you take ' + (CFG.BASE_BLEED || 2) + ', then ' + ((CFG.BASE_BLEED || 2) + (CFG.BLEED_RAMP || 2)) + ', then ' + ((CFG.BASE_BLEED || 2) + 2 * (CFG.BLEED_RAMP || 2)) + '. Put a chip down and it resets.',
    },
    {
      id: 'anger', title: 'Anger — Bet or Bleed', icon: '😤',
      what: 'Finish a whole round without placing a single bet and the house takes it personally: you take <b>Anger</b> damage at round’s end — and it grows by ' + (CFG.ANGER_STEP || 3) + ' every round you keep refusing to bet.',
      why: 'It’s the hard rule that there is no turtling in AweCrap: you cannot idle at full health and wait the enemy out. You must play. Betting a round calms the house — Anger resets to nothing.',
      how: 'Put at least one chip down every round. When you truly must sit out, play your <b>De-escalation</b> card to negate the next Anger strike — you open every duel with one in hand, and can draft more.',
      example: 'You sit out three rounds running: the house hits you for ' + (CFG.ANGER_STEP || 3) + ', then ' + 2 * (CFG.ANGER_STEP || 3) + ', then ' + 3 * (CFG.ANGER_STEP || 3) + '. Bet on the fourth and it’s back to zero. (The Bleed is separate — that’s per-roll; Anger is per-round.)',
    },
    {
      id: 'the_cut', title: 'The Cut', icon: '🗡',
      what: 'Winning a round lands a flat ' + (CFG.ROUND_CUT || 5) + ' damage — the Cut — on the other soul. It never escalates.',
      why: 'With no pot, winning rounds is the main way you actually hurt the enemy. Bets keep YOU alive; the Cut brings THEM down.',
      how: 'Win the round (make your line / survive theirs) to land the Cut. Stack round wins to close out a duel.',
      example: 'You make your point and win the round → the enemy takes a flat ' + (CFG.ROUND_CUT || 5) + ', no matter how healthy they are.',
    },
    {
      id: 'last_call', title: 'Last Call', icon: '⏳',
      what: 'If a duel drags past round ' + (CFG.LAST_CALL_ROUND || 15) + ' (round ' + (CFG.LAST_CALL_ROUND_BOSS || 25) + ' against a boss), Last Call hits: the wound ignores chips and bleeds BOTH souls, deeper every round.',
      why: 'A failsafe so no table runs forever. It turns a stalemate into a countdown.',
      how: 'Don’t plan to grind to Last Call — it hurts you too. But against a heavy attrition build it can force the finish you need.',
      example: 'Round 16 with no winner in sight: both souls start taking escalating bleed that no chip can stop.',
    },
    {
      id: 'the_sweep', title: 'The Sweep', icon: '🧹',
      what: 'When a round ends, the house sweeps the felt. Any bet that hasn’t resolved is GONE — for both souls.',
      why: 'You can’t park HP on the table for safety. Every chip is a real risk; unresolved exposure is lost, not returned.',
      how: 'Time your bets to resolve within the round. A few cards (Let It Ride, insurance) are the only way a chip survives the sweep.',
      example: 'You have 20 HP sitting on the 8 when the round ends without an 8 or a 7 → the house takes it. Poof.',
    },
    {
      id: 'cards_nerve', title: 'Cards & Nerve', icon: '🂡',
      what: 'Each round you draw a hand of ' + (CFG.HAND_SIZE || 5) + ' cards and get ' + (CFG.NERVE_PER_TURN || 3) + ' Nerve per turn to spend on them.',
      why: 'Cards are your edge over pure dice — rig totals, juice payouts, sabotage the enemy, or stanch the bleed. This is the “deckbuilder” half of the game.',
      how: 'Spend Nerve before you roll to set up, then AFTER your dice land you get a rig window to change them before they resolve. Draft and upgrade a deck that fits your line.',
      example: 'You roll a 7 on a Pass build (a bust) — but in the rig window you play Nudge to bump a die and turn it into your point instead.',
    },
    {
      id: 'the_rolloff', title: 'The Roll-Off & the Point', icon: '🎯',
      what: 'A duel opens with a roll-off. The winner SETS the shared point (4,5,6,8,9,10); then both souls race to resolve it on their own dice.',
      why: 'The point an enemy sets is a TELL about their whole build (see below), and setting it yourself lets you pick the number that suits your line.',
      how: 'Win the roll-off and choose a point you can make (6/8 for a Pass racer) or one the enemy hates. Relics like Rabbit’s Foot and The House Edge tilt the roll-off.',
      example: 'You win the roll-off on a Pass build and set the 6 — the easiest point to repeat.',
    },
    {
      id: 'the_tell', title: 'The Tell', icon: '👁',
      what: 'The point an enemy sets reveals their archetype: 6/8 = a racer (Point), 4/10 = they want your 7 (Attrition/Don’t), scattered = a Prop cannon.',
      why: 'Reading the tell tells you whether to race, starve, or simply survive the variance — before you commit a single chip.',
      how: 'On a 4/10 “Don’t” build, don’t over-commit to the point — they’re fishing for the 7. On 6/8, out-race them. On scattered, ride out the swings.',
      example: 'The enemy sets 4 and lays odds → attrition. You keep your table lean and bring your own sevens.',
    },
    {
      id: 'pulling', title: 'Pulling Bets & the Pull-Tax', icon: '↩',
      what: 'Some bets (Odds, Place, Don’t bets) can be PULLED off the table before they resolve — for a pull-tax of ' + (CFG.PULL_TAX || 2) + ' HP each.',
      why: 'It’s an escape hatch when the table turns against you — but the tax means pulling is never free, and some bosses (the Pit Boss) triple it.',
      how: 'Pull when the read has changed and the risk outweighs the bet. The Ghost Grip relic makes your first pull each round free.',
      example: 'You placed the 6 but now expect a 7 — pull it for ' + (CFG.PULL_TAX || 2) + ' HP rather than lose the whole stake to the seven-out.',
    },
    {
      id: 'relics_deck', title: 'Your Toolkit: Deck, Relics, Line', icon: '⚙',
      what: 'Your “abilities” are your drafted deck, your relics (passive powers), and your chosen line style (Pass or Don’t).',
      why: 'AweCrap has no character classes — YOU build the character through what you draft and equip across the run. A coherent deck + relics is your identity.',
      how: 'Draft cards that reinforce one plan (a rig-race Pass deck, or a starve-them Don’t deck). Relics like Nerve Tonic, Leech Stone and Phoenix Feather define your strategy.',
      example: 'Marked Bones (Loaded Die & Nudge cost 0) + a rig-heavy deck = a dice-control build that reliably makes its point.',
    },
    {
      id: 'the_map', title: 'The Run: Map & Nodes', icon: '🗺',
      what: 'Each act is a branching map you climb: duels ⚔, elites ☠ (guaranteed relic, tougher), events ❓, shops 🛒, rest fires 🔥 — capped by a boss.',
      why: 'The path is a choice. Do you take the safe duel, gamble on an event, or detour for a rest before the boss? HP, deck, relics and coins carry the whole act.',
      how: 'Plan your route to reach the boss with HP, a sharpened deck, and the relics you need. There’s no backtracking.',
      example: 'You route through a rest fire before the Floor Manager to Sharpen your best card and Mend to full.',
    },
    {
      id: 'economy_shop', title: 'Coins, Shops & Rest Fires', icon: '◎',
      what: 'Winning duels pays coins (' + (CFG.COINS_PER_NORMAL_DUEL || 12) + ' normal / ' + (CFG.COINS_PER_ELITE || 20) + ' elite / ' + (CFG.COINS_PER_BOSS || 30) + ' boss). Shops sell cards, relics, card-removal, and two gambles (a face-down card, and the lever).',
      why: 'Coins are a SEPARATE currency from HP — a parallel economy that shapes your deck between fights. Rest fires are the only true healing on the floor.',
      how: 'Spend on card removal to thin your deck, buy relics that fit your plan, and at rest fires choose Mend (heal ' + Math.round((CFG.REST_HEAL_PCT || 0.3) * 100) + '%), Sharpen (upgrade a card), or Cleanse (remove a curse).',
      example: 'You remove two dead cards from your deck so your good cards come up more often — the classic deckbuilder move.',
    },
    {
      id: 'difficulty_meta', title: 'Difficulty & Fresh Runs', icon: '⚖',
      what: 'Five difficulty notches (Soft Touch → Damned Luck) scale enemy HP/bets, your bleed, AI aggression and rewards. Every run starts fresh from the menu.',
      why: 'Difficulty is your training-wheels lever while you learn. There is no cross-run unlock ladder — mastery, not grind, is the progression.',
      how: 'Start on Soft Touch to learn the felt, climb as you get comfortable. Use a custom seed to replay the exact same run and practice a hard spot.',
      example: 'On Soft Touch the house “goes easy” (enemyHp ×0.75, your bleed ×0.70) — the place to learn without dying.',
    },
  ];

  /* ------------------------------------------------------- SECRET SEEDS --
   * Typed into the menu's seed box. Shown ONLY here, on the last page of the
   * readable tutorial — never in the playable tutorial. Keep in sync with the
   * CHEATS list in main.js and Run.applyCheat in run.js.
   */
  const secretSeeds = [
    ['God', 'Every point you make instantly annihilates the enemy. For testing looks & flow — the topbar shows “· GOD”.'],
    ['Boss', 'The Gauntlet — fight all five bosses back to back on one staircase, no rest between.'],
    ['Rich', 'Start flush with 999 coins.'],
    ['Loaded', 'Your entire deck is nothing but Loaded Dice.'],
    ['Fortune', 'Start with three random relics.'],
    ['Stacked', 'Your deck comes stuffed with six powerful cards.'],
    ['Phoenix', 'Start with the Phoenix Feather and extra survival cards — die hard.'],
  ];

  /* --------------------------------------------------------------- BOSSES --
   * Curated from SO.BOSSES with a spoiler-gated "detail" + strategy.
   */
  const B = (SO.BOSSES || {});
  const bosses = [
    {
      id: 'floor_manager', act: 1, name: 'The Floor Manager',
      blurb: (B.floor_manager && B.floor_manager.blurb) || 'Middle management of the purgatory casino.',
      danger: 'Sets the WORST point for you every round, and is immune to your interference cards.',
      detail: 'Three phases (120→80→40→0). Mid-fight he forces a Bad Beat curse into your draw every other round; at low HP he stops setting bad points and swings big.',
      strategy: 'You can’t rig his dice or steal his line — so out-play the point he hands you. Lean on payout and survival cards, not interference. Race whatever he sets.',
      spoiler: true,
    },
    {
      id: 'pit_boss', act: 2, name: 'The Pit Boss',
      blurb: (B.pit_boss && B.pit_boss.blurb) || 'He wrote the fee schedule.',
      danger: 'Pulling any bet against him is TRIPLE-taxed. Commit or bleed.',
      detail: 'Two phases (120→60→0). Late, he slips Trembling Hands curses into your draw every other round.',
      strategy: 'Don’t plan to pull — bet what you’re willing to see through. Favor bets that resolve on their own (line, field) over ones you’d want to yank. Cleanse curses at rest fires beforehand.',
      spoiler: true,
    },
    {
      id: 'countess', act: 3, name: 'The Countess',
      blurb: (B.countess && B.countess.blurb) || 'She drinks from other souls’ wounds.',
      danger: 'She skims HP from your table each turn AND heals off your bleed. A “Don’t” build that punishes both exposure and turtling.',
      detail: 'Two phases (130→65→0). Deep in, Cold Streak curses join your draw.',
      strategy: 'Stay bandaged (don’t feed her bleed) but don’t over-expose (don’t feed her skim). Hit hard and fast — a long fight is exactly what she wants. Leech Stone / self-heal relics help.',
      spoiler: true,
    },
    {
      id: 'auditor', act: 4, name: 'The Auditor',
      blurb: (B.auditor && B.auditor.blurb) || 'He is disputing every card you ever drafted.',
      danger: 'Every card in your deck costs +1 Nerve against him.',
      detail: 'Two phases (140→70→0). Final phase adds Bad Beats and his patience runs out (he swings harder).',
      strategy: 'Zero-cost and cheap cards are gold here — a lean, low-cost deck barely feels the tax. Nerve Tonic (+1 Nerve/turn) directly counters him. Avoid expensive combo turns.',
      spoiler: true,
    },
    {
      id: 'the_house', act: 5, name: 'The House',
      blurb: (B.the_house && B.the_house.blurb) || 'The building itself, wearing a suit.',
      danger: 'Every gimmick at once: sets every point, wins every tie, immune to interference — and starts at 180 HP.',
      detail: 'Three phases (180→120→60→0). Bad Beats mid-fight; at the end it’s finally rattled and stops setting bad points.',
      strategy: 'The exam. Bring a self-sufficient deck that doesn’t rely on interference (useless here) and doesn’t rely on winning ties (you won’t). Payout + survival + your own rigs. This is the way out.',
      spoiler: true,
    },
  ];

  /* ------------------------------------------------------------- STRATEGY --
   * Advanced / optional chapter. chart: optional structured data for a visual.
   */
  const strategy = [
    {
      id: 'house_edge', title: 'House Edge — Why Some Bets Are Traps', icon: '📉',
      body: 'Every bet has a built-in house edge: the long-run % the casino keeps. The line bets and odds are near-fair; the center props are brutal. In real craps this decides who goes broke. In AweCrap it decides how efficiently you convert HP into more HP.',
      chart: {
        title: 'House edge by bet (lower = better for you)',
        rows: [
          ['Odds (free odds)', 0.0, 'best'],
          ["Don't Pass / Don't Come", 1.36, 'good'],
          ['Pass Line / Come', 1.41, 'good'],
          ['Place 6 & 8', 1.52, 'good'],
          ['Field (3:1 on 12)', 2.78, 'ok'],
          ['Place 5 & 9', 4.0, 'ok'],
          ['Place 4 & 10', 6.67, 'poor'],
          ['Hard 6 & 8', 9.09, 'bad'],
          ['Hard 4 & 10', 11.1, 'bad'],
          ['Any Seven', 16.67, 'worst'],
        ],
      },
    },
    {
      id: 'odds_power', title: 'Why Odds Bets Are So Powerful', icon: '✧',
      body: 'The Odds bet behind your line is the ONLY wager with zero house edge — it pays exactly true odds. Every HP you can move from a prop bet into Odds is HP working at fair value. The classic play: minimum line bet, maximum odds behind it. In AweCrap you can lay up to 3× your line in Odds — do it whenever the point is live.',
    },
    {
      id: 'bankroll', title: 'Bankroll (Read: HP) Management', icon: '💰',
      body: 'Treat your HP bar like a bankroll. Never expose more than you can afford to lose to one seven-out. Size bets to the read: bigger when you’re the favorite (your point on a Pass build), smaller when the table is against you. Keeping chips out to pause the bleed is worth a small, safe bet even when you don’t love the odds.',
    },
    {
      id: 'conservative', title: 'Conservative Play', icon: '🛡',
      body: 'The grinder’s plan: line bet + max odds, place the 6 and 8, skip every prop. Low variance, near-fair edge, steady round wins that stack the Cut. Pair it with survival cards and bleed-reduction relics (Iron Stomach, Tourniquet Ring). Slow, safe, and it beats most of the floor.',
    },
    {
      id: 'aggressive', title: 'Aggressive Play', icon: '⚔',
      body: 'The prop-cannon plan: hardways, boxcars, big Field swings, and cards that multiply payouts (Devil’s Markup, Boxcar Special). Enormous variance — you either spike a huge HP swing or crater. Best when you’re behind and need a miracle, or when your deck is built to force the rig. Know that the math is against you; the cards are how you cheat it.',
    },
    {
      id: 'systems', title: 'Betting Systems (and Their Limits)', icon: '🔁',
      body: 'Martingale (double after a loss), Paroli (double after a win), and the like feel clever but cannot beat a negative-edge game — a bad run or a table limit ends them. In AweCrap they matter even less, because CARDS and the CUT decide fights, not bet-progression. Learn the systems so you recognize the gambler’s-fallacy trap, then rely on your deck instead.',
    },
    {
      id: 'mistakes', title: 'Common Beginner Mistakes', icon: '⚠',
      body: '1) Riding Any Seven / props as a main plan (16.67% edge). 2) Turtling with an empty felt and bleeding out. 3) Placing the 4 and 10 instead of the 6 and 8. 4) Forgetting the sweep and leaving HP unresolved at round end. 5) Skipping the Odds bet — the one free lunch. 6) Ignoring the enemy’s tell and committing into a Don’t build that just wants your 7.',
    },
    {
      id: 'probability', title: 'The Shape of the Dice', icon: '🎲',
      body: 'Two dice make 36 combinations. The 7 has six of them — that’s why it’s the come-out hero and the point-phase villain. The 6 and 8 have five ways each (why they’re the best points), the 4 and 10 only three (why they’re “hard” points), and the 2 and 12 just one each (why props on them pay so big). Internalize the WAYS table on the Probabilities page and every bet on the felt starts to make sense.',
    },
  ];

  /* --------------------------------------------------------------- RELICS --
   * Reference view pulls straight from SO.RELICS.
   */
  function relicList() {
    const R = SO.RELICS || {};
    return Object.keys(R).map((k) => ({ id: k, name: R[k].name, rarity: R[k].rarity, text: R[k].text }));
  }

  /* ------------------------------------------------------- AI ARCHETYPES --
   * The four enemy playstyles, their tells, and how to beat each. (The 12
   * regular enemies are one of these four; bosses layer a gimmick on top.)
   */
  const archetypes = [
    {
      id: 'point', name: 'Point Specialists', icon: '🎯', line: 'Pass',
      who: 'The Newcomer · Chalk Eddie · The Bonesetter',
      tell: 'Sets an EASY point — 6 or 8. A straight Pass build.',
      plan: 'It’s a race to make the point before a 7. Out-race them: take the point yourself when you win the roll-off (pick 6 or 8), lay <b>max Odds</b> behind your line, and rig your dice toward it with Loaded Die / Nudge. If you have interference, <b>deny their point</b> (Jinx their make, or Cooler to set the point yourself next round).',
      counter: 'Race it. Odds + rigs win the foot-race; deny their point if you can.',
    },
    {
      id: 'attrition', name: 'Attrition / Don’t Builds', icon: '⏳', line: 'Don’t',
      who: 'Tap-Out Tony · Widow Vane · Madame Zero',
      tell: 'Sets a HARD point — 4 or 10. A Don’t build. They want your 7.',
      plan: 'They win by <b>waiting for the seven-out</b> — every chip you leave exposed is a chip the 7 sweeps. Don’t over-commit to the point; bet lean and resolve fast. Better yet, <b>bring your own 7</b> (Cold Bones) or flip to a Don’t build yourself and beat them to it. Patience beats patience.',
      counter: 'Don’t over-expose. Starve them, or race them to the 7 on your own Don’t line.',
    },
    {
      id: 'prop', name: 'Prop Cannons', icon: '✦', line: 'Pass',
      who: 'Hot-Hand Mariah · Two-Bit Tommy · The Collector',
      tell: 'Sets the point ALL OVER the place — scattered. Huge swings.',
      plan: 'They dump HP onto hardways and boxcars — colossal variance. <b>Survive the peaks</b>: keep survival cards (Tourniquet, Field Medic) ready, don’t try to out-gamble them, and treat their <b>cold streaks as your window</b> to land steady round wins. A boring line-plus-odds game beats their long-run math.',
      counter: 'Play safe and steady. Outlast the variance; strike on their cold streaks.',
    },
    {
      id: 'control', name: 'Controllers', icon: '👁', line: 'Don’t',
      who: 'The Shark · Sister Riches · The Concierge',
      tell: 'Nothing obvious — expect steals, denials, and stalling.',
      plan: 'They play <b>your</b> game against you: stealing chips off your felt, denying your key rolls, dragging the round out. <b>Keep your table lean</b> when they have Nerve (less for them to steal), resolve bets quickly so there’s nothing to skim, and hold your own interference for the moment it hurts them most.',
      counter: 'Stay lean and fast. Give them nothing to steal; save your counters for the kill.',
    },
  ];

  /* -------------------------------------------------------- QUICK GLOSSARY --
   * Short definitions for the reference search. Mixes craps terms + AweCrap.
   */
  const glossary = [
    ['Come-out roll', 'craps', 'The first roll of a betting sequence, before a point is set.'],
    ['Point', 'craps', 'A 4, 5, 6, 8, 9, or 10 established on the come-out; the number to repeat before a 7.'],
    ['Seven-out', 'craps', 'Rolling a 7 after a point is set — the shooter loses and the dice pass.'],
    ['Natural', 'craps', 'A come-out 7 or 11 — an instant Pass Line win.'],
    ['Craps', 'craps', 'A come-out 2, 3, or 12 — an instant Pass Line loss.'],
    ['Shooter', 'craps', 'The person throwing the dice. In AweCrap, each soul shoots its own.'],
    ['Hard / Easy', 'craps', '“Hard” = a number made as a pair (e.g. 4+4=hard 8); “easy” = any other way.'],
    ['Bar 12', 'craps', 'On the Don’t side, a come-out 12 is a push instead of a win — the house’s edge.'],
    ['Vig / Juice', 'craps', 'The commission on Buy/Lay bets (5%). AweCrap charges none.'],
    ['True odds', 'craps', 'A payout with zero house edge, matching the real probability. Only the Odds bet pays it.'],
    ['The Bleed', 'awecrap', 'Escalating damage taken when you roll with no chips exposed.'],
    ['Anger', 'awecrap', 'Damage the house deals at round-end if you placed no bet that round; grows by ' + (CFG.ANGER_STEP || 3) + ' each idle round, and betting resets it.'],
    ['De-escalation', 'awecrap', 'A card (you start every duel with one) that negates the next Anger strike.'],
    ['The Cut', 'awecrap', 'Flat ' + (CFG.ROUND_CUT || 5) + ' damage dealt to whoever loses a round.'],
    ['The Sweep', 'awecrap', 'At round end the house takes every unresolved chip — both souls.'],
    ['Last Call', 'awecrap', 'Past round ' + (CFG.LAST_CALL_ROUND || 15) + ', a chip-ignoring bleed on both souls, deepening each round.'],
    ['Nerve', 'awecrap', 'Per-turn resource (' + (CFG.NERVE_PER_TURN || 3) + ') spent to play cards.'],
    ['Rig window', 'awecrap', 'The moment after your dice land when you may play cards to change them before they resolve.'],
    ['Pull-tax', 'awecrap', (CFG.PULL_TAX || 2) + ' HP to pull a bet off the felt before it resolves.'],
    ['The Tell', 'awecrap', 'The point an enemy sets, which reveals their archetype.'],
    ['Sharpen', 'awecrap', 'Permanently upgrade a card (−1 Nerve, +50% effect) at a rest fire.'],
    ['Elite ☠', 'awecrap', 'A tougher optional duel that always rewards a relic.'],
  ];

  /* --------------------------------------------------------------- CHAPTERS --
   * The ordered spine. A chapter either lists explicit `pages`, or names a
   * `source` the engine expands into one page each (bets/features/bosses/strategy).
   */
  const chapters = [
    {
      id: 'welcome', title: 'Welcome to AweCrap', icon: '♠',
      pages: [
        {
          type: 'intro', title: 'Welcome to Purgatory',
          instructor: [
            'Welcome, soul. You’ve arrived at the only casino that matters — the one between places.',
            'Here, the damned gamble for a way out. Beat the House and the door opens. Lose… and you stay.',
            'It’s still the game of Craps underneath — real dice, real bets — but with a few supernatural house rules. I’ll teach you all of it.',
          ],
          body: 'This casino sits in Purgatory. Souls wager to escape it. Your goal is simple and impossible: <b>beat the House</b>. Everything you’ll learn here is real Craps — plus the twists that make it <i>AweCrap</i>.',
          showcase: true,
        },
        {
          type: 'intro', title: 'What You’re Looking At',
          instructor: [
            'Four things run this whole game: the table, the dice, the chips, and your own life.',
            'The table is where bets live. The dice decide everything. The chips are HP — your health IS your bankroll. And the UI keeps score.',
            'Don’t worry about memorizing it. We’ll walk every inch of that felt together, one glowing corner at a time.',
          ],
          body: 'The four things that run the game:',
          bullets: [
            ['▦ The Table', 'A map of every bet you can make. We’ll light up each area next.'],
            ['⚄ The Dice', 'Two six-sided dice. Their total decides every wager.'],
            ['♥ The Chips', 'In AweCrap your chips ARE your HP. You bet with your life.'],
            ['◎ The UI', 'HP bars, Nerve, your hand of cards, coins — the state of the fight.'],
          ],
        },
      ],
    },
    {
      id: 'table', title: 'Reading the Table', icon: '▦',
      // Each page lights one zone of the replica table. `zone` matches the
      // diagram's data-zone; the engine dims the rest.
      pages: [
        { type: 'tableZone', zone: 'passline', title: 'The Pass Line', betRef: 'passline',
          instructor: ['This long strip around the edge is the Pass Line — the heart of the game. Betting here means you’re WITH the shooter.', 'Come-out 7 or 11 and you win on the spot. Then a point gets set, and you just want it to come again before a 7.'] },
        { type: 'tableZone', zone: 'dontpass', title: "Don't Pass Bar", betRef: 'dontpass',
          instructor: ['Right beside it: Don’t Pass. The mirror. Bet here and you’re AGAINST the shooter.', 'Now the 7 is your friend after the point — and that little “Bar 12” means a come-out 12 just pushes.'] },
        { type: 'tableZone', zone: 'come', title: 'The Come', betRef: 'come',
          instructor: ['COME is a Pass Line bet you can start any time after the point. It “travels” — it locks onto the next number and rides it.', 'Great for getting more numbers working at once.'] },
        { type: 'tableZone', zone: 'dontcome', title: "Don't Come", betRef: 'dontcome',
          instructor: ['DON’T COME is the traveling version of Don’t Pass. Same idea, against the shooter.'] },
        { type: 'tableZone', zone: 'field', title: 'The Field', betRef: 'field',
          instructor: ['The Field is a ONE-roll bet on a whole row of numbers. It resolves on the very next throw — win or lose, then it’s gone.', 'The 2 pays double, the 12 pays triple. But 5, 6, 7, 8 all lose — and those are common.'] },
        { type: 'tableZone', zone: 'place', title: 'The Place Boxes', betRef: 'place',
          instructor: ['These numbered boxes — 4, 5, 6, 8, 9, 10 — are Place bets. Bet a number and it wins every time that number rolls, before a 7.', 'The 6 and 8 up here are the workhorses of the whole table.'] },
        { type: 'tableZone', zone: 'odds', title: 'The Odds', betRef: 'odds',
          instructor: ['This little ODDS strip is the best-kept secret in the building. It pays TRUE odds — zero house edge.', 'You can only bet it behind a line bet, but when you can, you should.'] },
        { type: 'tableZone', zone: 'props', title: 'The Center — Props & Hardways', betRef: 'hardways',
          instructor: ['The center is the carnival: hardways, boxcars, any-seven. Huge payouts, terrible odds.', 'The prop cannons of Purgatory live here. Thrilling — and how souls go broke.'] },
      ],
    },
    {
      id: 'dice', title: 'The Dice & Basic Rules', icon: '⚄',
      pages: [
        { type: 'diceDemo', seq: 'comeout', title: 'The Come-Out Roll',
          instructor: ['Let’s throw some dice. The first roll of a sequence is the COME-OUT.', 'Watch: a 7 or 11 wins for the Pass Line right away. A 2, 3, or 12 loses. Anything else becomes the Point.'] },
        { type: 'diceDemo', seq: 'point', title: 'Making the Point',
          instructor: ['Now a point is set. The one rule that matters: roll the POINT again before a 7.', 'Repeat the point — you win. Roll a 7 first — that’s the “seven-out,” and it’s over.'] },
        { type: 'rulesCard', title: 'The Rules on One Card',
          instructor: ['Here’s the whole core of Craps on a single card. Screenshot it in your mind.'] },
      ],
    },
    {
      id: 'shooter', title: 'The Shooter', icon: '✦',
      pages: [
        { type: 'intro', title: 'The Shooter & the Turn', icon: '✦',
          instructor: ['The “shooter” is whoever’s throwing the dice. At a real table one player shoots for everyone until they seven-out; then the dice pass to the next.', 'In AweCrap, you and your opponent each shoot your OWN dice on your own turns — but the point you’re racing is shared.', 'A long roll — lots of numbers before the 7 — is the dream. That’s a soul on a heater. It’s also when the felt fills with chips and the tension is highest.'],
          body: 'A <b>shooter</b> keeps the dice until a seven-out, then they pass. A long hand — many rolls before the 7 — is where fortunes are made. In a duel, each soul shoots its own dice, but you race a shared point, and the bleed means you can’t just wait out a hot opponent.',
          bullets: [
            ['Whose dice?', 'On your turn you throw; on theirs, they do. The shared point ties you together.'],
            ['When do the dice pass?', 'A seven-out ends the working point. In a duel the round resolves and a new one begins.'],
            ['Why long rolls thrill', 'Every number before the 7 can pay a working bet. The longer it runs, the more the table swings.'],
          ] },
      ],
    },
    { id: 'bets', title: 'Every Bet, Explained', icon: '◈', source: 'bets' },
    {
      id: 'practice', title: 'Practice Table', icon: '⚅',
      pages: [
        { type: 'practice', title: 'Practice Table — No Stakes, No Souls',
          instructor: ['Here’s a real table with fake money. Place chips, roll the dice, make every mistake you like — nothing here costs you a thing.', 'I’ll tell you what happened after each roll, and whether your bet was smart. Reset it as many times as you want.'] },
      ],
    },
    { id: 'awecrap', title: 'The AweCrap Twist', icon: '♦', source: 'features' },
    { id: 'archetypes', title: 'Know Your Enemy', icon: '👁', source: 'archetypes' },
    { id: 'bosses', title: 'The Five Bosses', icon: '☠', source: 'bosses' },
    { id: 'strategy', title: 'Advanced Play', icon: '♣', source: 'strategy' },
    {
      id: 'reference', title: 'The Reference', icon: '📖',
      pages: [
        { type: 'referenceIntro', title: 'The House Ledger',
          instructor: ['You’ve got the whole game now. This last page is your permanent reference — every bet, payout, probability, boss, relic and term, searchable, any time.', 'Bookmark the pages you want to keep close. Then go beat the House. I’ll be watching.'] },
      ],
    },
  ];

  return {
    version: 1,
    bets, probabilities, features, bosses, strategy, glossary, chapters, secretSeeds, archetypes,
    relicList,
    // handy lookups for the engine
    betById: (id) => bets.find((b) => b.id === id),
    legalPoints: (CFG.LEGAL_POINTS || [4, 5, 6, 8, 9, 10]),
  };
})();
