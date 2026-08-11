/* AWECRAP — playtutorial.js
 * The PLAYABLE tutorial: a slow, guided, one-mechanic-at-a-time bout that
 * teaches only the AweCrap-specific twists (HP-as-chips, betting, the roll /
 * point, the Bleed & Anger meters, rigging, the Cut) — NOT the whole of craps
 * (that's the readable "How to Play").
 *
 * It reuses the real duel engine + board UI against a weak Sparring Dummy. Every
 * UI hook is wrapped: for the teaching moments the coach GATES the game (the duel
 * is paused because the engine awaits the hook) and only continues when the
 * player clicks "Continue". Each lesson fires once, in order; after the first
 * round the fight plays out at normal speed.
 *
 * SO.PlayTutorial.open()
 */
window.SO = window.SO || {};

SO.PlayTutorial = (function () {
  'use strict';

  let coach, coachText, coachTitle, coachBtn, built = false;
  let duel = null, running = false, gateResolve = null;
  const seen = {};

  function build() {
    if (built) return;
    coach = document.createElement('div'); coach.id = 'coach'; coach.className = 'hidden';
    coach.innerHTML = `
      <button class="coach-exit" title="Exit tutorial">✕</button>
      <div class="coach-head"><span class="coach-avatar">♠</span><span class="coach-title"></span></div>
      <p class="coach-text"></p>
      <button class="coach-btn btn btn-primary">Continue ▶</button>`;
    document.body.appendChild(coach);
    coachText = coach.querySelector('.coach-text');
    coachTitle = coach.querySelector('.coach-title');
    coachBtn = coach.querySelector('.coach-btn');
    coachBtn.addEventListener('click', () => {
      if (coach._mode === 'final') { exit(); return; }
      if (coach._mode === 'gate' && gateResolve) { const r = gateResolve; gateResolve = null; hideCoach(); r(); return; }
      hideCoach();
    });
    coach.querySelector('.coach-exit').addEventListener('click', exit);
    built = true;
  }

  function show(title, text, mode) {
    build();
    coachTitle.textContent = title || '';
    coachText.innerHTML = text;
    coach._mode = mode;
    coachBtn.textContent = mode === 'final' ? '↩ Return to menu' : mode === 'say' ? 'Got it ✓' : 'Continue ▶';
    coach.classList.remove('hidden', 'pop'); void coach.offsetWidth; coach.classList.add('pop');
  }
  function hideCoach() { if (coach) coach.classList.add('hidden'); }
  // returns a promise that resolves when the player clicks Continue — the duel
  // awaits the wrapping hook, so the whole fight pauses here.
  function gate(title, text) { return new Promise((resolve) => { gateResolve = resolve; show(title, text, 'gate'); }); }

  // wrap the real UI: run the UI hook (let its animation finish), then let the
  // coach maybe gate. Because the engine `await`s narrative hooks, a gate here
  // genuinely pauses the duel until "Continue".
  function makeHooks(ui, onHook) {
    const h = {}; const names = new Set();
    let o = ui; while (o && o !== Object.prototype) { Object.getOwnPropertyNames(o).forEach((n) => names.add(n)); o = Object.getPrototypeOf(o); }
    names.forEach((name) => {
      if (name === 'constructor') return;
      let fn; try { fn = ui[name]; } catch (e) { return; }
      if (typeof fn !== 'function') return;
      h[name] = async function (...args) {
        let r; try { r = fn.apply(ui, args); } catch (e) {}
        if (r && typeof r.then === 'function') { try { await r; } catch (e) {} }
        if (running) { try { await onHook(name, args); } catch (e) {} }
        return r;
      };
    });
    return h;
  }

  const P = (x) => x && x.isPlayer;
  async function onHook(name, args) {
    if (!running) return;
    const d = args[0];
    if (name === 'duelStart' && !seen.start) { seen.start = true;
      return gate('Welcome to the felt', "This is a real duel — but it's just a <b>Sparring Dummy</b>, so take all the time you want. The one big idea of AweCrap: <b>your HP bar is your chip stack.</b> You bet with your life, and the only HP you win back is your own bets paying off. See the two little meters by your name — <b>ANGER</b> and <b>BLEED</b>? They warn you what sitting idle will cost. Beat the Dummy to graduate."); }
    if (name === 'pointSet' && !seen.point) { seen.point = true;
      return gate('The point is set', "That number under the <b>ON</b> puck is the <b>point</b>. On a <b>Pass</b> line you win the round by rolling it again before a <b>7</b>. (On a <b>Don't</b> line it's the reverse — you'd want the 7 first.)"); }
    if (name === 'enableControls' && args[1] === true && d._awaiting === 'action' && !seen.bet) { seen.bet = true;
      return gate('Your turn — place a bet', "<b>Click the felt</b> to put a bet down (5 HP a tap) — the <b>Pass Line</b> is the safe start — then hit <b>ROLL</b>. Bet <i>something</i> every round: watch the <b>BLEED</b> meter (rolling on an empty felt hurts, and it ramps up each turn) and the <b>ANGER</b> meter (a whole round with no bet makes the house strike, harder each time). Click Continue, then give it a go."); }
    if (name === 'diceLanded' && P(args[1]) && !seen.rig) { seen.rig = true;
      return gate('Rig the dice', "Your dice are down — this is the <b>rig window</b>. Spend <b>Nerve</b> to play a card like <b>Loaded Die</b> or <b>Nudge</b> and shove a die toward your point, or just <b>Resolve</b> to take the roll as it landed."); }
    if (name === 'turnStart' && !P(args[1]) && !seen.oppturn) { seen.oppturn = true;
      return gate('The enemy shoots', "Now the <b>Dummy takes its turn</b> — it throws its own dice at the same shared point. You're both racing it. Just watch this one play out."); }
    if (name === 'madePoint' && P(args[1]) && !seen.made) { seen.made = true;
      return gate('You made it!', "You rolled the point — you <b>win the round</b>, and that lands <b>the Cut</b> on the Dummy (flat damage). <b>Winning rounds is how you actually bring a soul down</b> — stack them up."); }
    if (name === 'busted' && P(args[1]) && !seen.bust) { seen.bust = true;
      return gate('Seven-out', "That was a <b>bust</b> — the 7 came up (or your point, on a Don't line). Any chips still on the felt get <b>swept by the house</b>. It happens to everyone; shake it off and keep betting."); }
    if (name === 'bleed' && P(args[1]) && !seen.bled) { seen.bled = true;
      return gate('You bled', "You rolled with <b>no chips on the felt</b>, so the wound opened — that's the <b>Bleed</b>. Keep at least one bet out and it pauses. The BLEED meter shows how bad the next one would be — it climbs every turn."); }
    if (name === 'roundCut' && !seen.cut) { seen.cut = true;
      return gate('The Cut', "There's <b>the Cut</b> — whoever loses the round takes flat damage. This, plus your bets paying out, is how the fight is won. A few more rounds and the Dummy is finished."); }
  }

  async function open() {
    if (running) return;
    build(); running = true; gateResolve = null; Object.keys(seen).forEach((k) => delete seen[k]);
    const ui = window.__ui;
    if (!ui) { running = false; return; }

    document.getElementById('start-screen').classList.add('hidden');
    document.getElementById('end-screen').classList.add('hidden');
    const fakeRun = { actIdx: 0, godMode: false, coins: 0, tutorial: true,
      player: { name: 'You', hp: 100, maxHp: 100, deck: SO.STARTER_DECK.slice(), relics: [] },
      stats: { rolls: 0, cards: 0, rounds: 0, duels: 0, rests: 0, events: 0, nodes: 0, toughestFoe: null, toughestFoeHp: 0, toughestFoeRound: 0 } };
    ui.setRun(fakeRun);

    // Pretty stupid on purpose: NO deck (so it can never rig a die, heal, or
    // interfere — it just bets the minimum and hopes), tiny bets, low HP, and
    // it always sets the same easy point. A total pushover to learn against.
    const enemyDef = {
      id: 'sparring_dummy', name: 'The Sparring Dummy', hp: 15,
      blurb: 'A straw-stuffed practice soul with a painted-on grin. It can’t rig a die, never heals, and mostly just hopes. A total pushover.',
      archetype: 'point', style: 'pass', setsPoint: [6], interfere: 0, betSize: 2,
      deck: [], // empty — the AI plays no cards, so it never rigs, heals, or interferes
      tell: 'It just bets small and hopes. Beat it any way you like.',
    };
    const player = SO.makeParticipant({ id: 'player', name: 'You', isPlayer: true, hp: 100, maxHp: 100, deck: SO.STARTER_DECK.slice(), relics: [] });
    const rng = SO.makeRNG(SO.randomSeed());
    duel = new SO.Duel({ player, enemyDef, rng, hooks: makeHooks(ui, onHook), difficulty: SO.DIFFICULTY[0], coinsBase: 0, runFlags: {}, godMode: false });
    ui.attach(duel);

    let winner;
    try { winner = await duel.start(); } catch (e) { winner = null; }
    if (!running) return; // exited mid-bout
    finish(winner && winner.isPlayer);
  }

  function finish(won) {
    running = false; gateResolve = null;
    show(won ? '✓ Graduated' : 'Lesson learned',
      won
        ? "That's AweCrap. You bet with your life, rigged the bones, stacked round wins to land the Cut, and learned to read the <b>Anger</b> and <b>Bleed</b> meters. Everything else — relics, the map, the bosses, the shop — builds on exactly this. You're ready for a real run."
        : "The Dummy took this practice bout — but you've got the rhythm now: <b>bet every round</b>, rig your dice in the roll window, and never let the Anger or Bleed climb. Give it another go, or dive into a real run.",
      'final');
  }

  function exit() {
    running = false;
    if (gateResolve) { const r = gateResolve; gateResolve = null; r(); }  // unstick a pending gate
    if (duel && !duel.over) {
      duel.over = true;
      try { duel.submitRoll(); } catch (e) {}
      try { duel.finishRollWindow(); } catch (e) {}
      try { if (duel._resolvers && duel._resolvers.point) duel.choosePoint(6); } catch (e) {}
    }
    duel = null;
    hideCoach();
    document.getElementById('board').classList.add('hidden');
    document.getElementById('topbar').classList.add('hidden');
    document.getElementById('start-screen').classList.remove('hidden');
    if (SO.Audio) SO.Audio.play('menu');
  }

  return { open, exit };
})();
