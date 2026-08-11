/* AWECRAP — freeplay.js
 * A standalone "just play craps" table, launched from the menu (🎲 PRACTICE).
 * No HP, no roguelike — normal casino craps with a chip bankroll. It reuses the
 * real gameplay board's felt markup + CSS (.craps-table/.felt-grid/.zone…) so
 * it looks exactly like a duel, minus the opponent. All bet resolution runs
 * through the real SO.craps module, so payouts and rules are the game's own.
 *
 * SO.FreePlay.open() / .close()
 */
window.SO = window.SO || {};

SO.FreePlay = (function () {
  'use strict';

  const SAVE_KEY = 'awecrap_freeplay_v1';
  const START_BANK = 1000;
  const PIPS = { 1: [5], 2: [1, 9], 3: [1, 5, 9], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9] };
  const POINTS = [4, 5, 6, 8, 9, 10];
  const CHIPS = [5, 25, 100, 500];
  const BOXLBL = { 4: '4', 5: 'FIVE', 6: 'SIX', 8: '8', 9: 'NINE', 10: '10' };

  function el(t, c, h) { const e = document.createElement(t); if (c) e.className = c; if (h != null) e.innerHTML = h; return e; }
  function rnd(n) { return Math.floor(Math.random() * n); }

  const G = {
    built: false, open: false, dom: {}, chip: 25, rolling: false,
    bank: START_BANK, buyIn: START_BANK,
    phase: 'comeout', point: null,
    bets: {},             // slot -> amount
    come: [], dcome: [],  // arrays of {amount, num|null}
    log: [], stats: { rolls: 0, made: 0, out: 0, best: 0 },
  };

  /* --------------------------- persistence --------------------------- */
  function loadBank() { try { const r = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); if (r) { G.bank = r.bank; G.buyIn = r.buyIn; if (r.stats) G.stats = r.stats; } } catch (e) {} }
  function saveBank() { try { localStorage.setItem(SAVE_KEY, JSON.stringify({ bank: G.bank, buyIn: G.buyIn, stats: G.stats })); } catch (e) {} }

  /* --------------------------- dice widget --------------------------- */
  function makeDie() { const d = el('div', 'die'); for (let i = 0; i < 9; i++) d.appendChild(el('span', 'cell')); return d; }
  function setDie(d, v) { const set = PIPS[v] || []; for (let i = 0; i < 9; i++) d.children[i].className = set.includes(i + 1) ? 'pip' : 'cell'; }
  function animRoll(a, b, va, vb, cb) {
    a.classList.add('rolling'); b.classList.add('rolling');
    setTimeout(() => {
      a.classList.remove('rolling'); b.classList.remove('rolling');
      setDie(a, va); setDie(b, vb);
      a.classList.add('settle'); b.classList.add('settle');
      setTimeout(() => { a.classList.remove('settle'); b.classList.remove('settle'); }, 280);
      if (cb) cb();
    }, 520);
  }

  function payStr(n) { const r = SO.craps.PLACE[n]; return r[0] + ':' + r[1]; }

  /* --------------------------- build overlay --------------------------- */
  function build() {
    if (G.built) return;
    const ov = el('div', 'overlay fp hidden'); ov.id = 'freeplay-overlay';
    ov.innerHTML = `
      <div class="fp-frame"></div>
      <div class="fp-shell">
        <header class="fp-top">
          <div class="fp-title">🎲 <b>PRACTICE CRAPS</b> <span class="fp-sub">· free play · learn the felt ·</span></div>
          <button class="fp-x" data-fp="close" title="Close (Esc)">✕ CLOSE</button>
        </header>
        <div class="fp-rail craps-rail">
          <div class="craps-table live fp-table">
            <div class="ct-head">
              <div class="risk-pill"><span class="risk-label">CHIPS</span><span class="risk-amt fp-bank">1000</span><span class="fp-net"></span></div>
              <div class="table-brand"><i>✦</i> AWECRAP <i>✦</i><small>· PRACTICE TABLE ·</small></div>
              <div class="round-pill fp-pointpill">COME-OUT</div>
            </div>
            <div class="felt-grid">
              <div class="tz-places">
                ${POINTS.map((n) => `<div class="zone place" data-bet="place" data-num="${n}"><span class="boxnum">${BOXLBL[n]}</span><span class="paysml">${payStr(n)}</span><span class="puck" data-puck="${n}">ON</span><div class="chips-here" data-zone="place-${n}"></div></div>`).join('')}
              </div>
              <div class="tz-come">
                <div class="zone dontcome" data-bet="dontcome"><span class="zlabel sm">DON'T<br>COME</span><div class="chips-here" data-zone="dontcome"></div></div>
                <div class="zone come" data-bet="come"><span class="zlabel big">C O M E</span><div class="chips-here" data-zone="come"></div></div>
              </div>
              <div class="zone field" data-bet="field">
                <span class="zlabel">FIELD</span>
                <span class="field-nums"><i class="circ">2</i><i>3</i><i>4</i><i>9</i><i>10</i><i>11</i><i class="circ">12</i></span>
                <span class="paysml">2 pays double · 12 pays triple</span>
                <div class="chips-here" data-zone="field"></div>
              </div>
              <div class="tz-props">
                <div class="props-title">— CENTER BETS —</div>
                <div class="props-grid">
                  <div class="zone prop" data-bet="hard" data-num="4"><span class="zlabel sm">HARD 4</span><small>7:1</small><div class="chips-here" data-zone="hard-4"></div></div>
                  <div class="zone prop" data-bet="hard" data-num="6"><span class="zlabel sm">HARD 6</span><small>9:1</small><div class="chips-here" data-zone="hard-6"></div></div>
                  <div class="zone prop" data-bet="hard" data-num="8"><span class="zlabel sm">HARD 8</span><small>9:1</small><div class="chips-here" data-zone="hard-8"></div></div>
                  <div class="zone prop" data-bet="hard" data-num="10"><span class="zlabel sm">HARD 10</span><small>7:1</small><div class="chips-here" data-zone="hard-10"></div></div>
                  <div class="zone prop" data-bet="any7"><span class="zlabel sm">ANY SEVEN</span><small>4:1</small><div class="chips-here" data-zone="any7"></div></div>
                  <div class="zone prop" data-bet="eleven"><span class="zlabel sm">YO (11)</span><small>15:1</small><div class="chips-here" data-zone="eleven"></div></div>
                  <div class="zone prop" data-bet="aces"><span class="zlabel sm">ACES (2)</span><small>30:1</small><div class="chips-here" data-zone="aces"></div></div>
                  <div class="zone prop" data-bet="boxcars"><span class="zlabel sm">BOXCARS</span><small>30:1</small><div class="chips-here" data-zone="boxcars"></div></div>
                </div>
              </div>
              <div class="tz-stage">
                <div class="stage-who fp-stagephase">COME-OUT</div>
                <div class="dice fp-dice"></div>
                <div class="turn-banner fp-stagehint">Roll to set the point</div>
              </div>
              <div class="zone dontpass" data-bet="dontpass"><span class="zlabel">DON'T PASS BAR</span><span class="bar12">⚅⚅</span><div class="chips-here" data-zone="dontpass"></div></div>
              <div class="zone odds" data-bet="odds"><span class="zlabel sm">ODDS</span><span class="paysml">true odds · behind the line</span><div class="chips-here" data-zone="odds"></div></div>
              <div class="zone passline" data-bet="passline"><span class="zlabel">P A S S&nbsp;&nbsp;L I N E</span><div class="chips-here" data-zone="passline"></div></div>
            </div>
          </div>
        </div>
        <footer class="fp-controls">
          <div class="fp-chipsel"></div>
          <div class="fp-ctr-mid">
            <div class="fp-actions">
              <button class="btn btn-mini" data-fp="clear">Take down bets</button>
              <button class="btn btn-mini" data-fp="topup">+500 chips</button>
              <button class="btn btn-mini" data-fp="reset">Reset bankroll</button>
            </div>
            <div class="fp-hint">Left-click a spot to bet · right-click to take it down</div>
          </div>
          <button class="btn-roll fp-roll" data-fp="roll">R O L L</button>
        </footer>
        <div class="fp-logrow"><div class="fp-log"></div><div class="fp-stats"></div></div>
      </div>`;
    document.body.appendChild(ov);

    const dice = ov.querySelector('.fp-dice');
    const a = makeDie(), b = makeDie(); setDie(a, 4); setDie(b, 3);
    dice.appendChild(a); dice.appendChild(b);

    const sel = ov.querySelector('.fp-chipsel');
    CHIPS.forEach((c) => { const btn = el('button', 'fp-chipbtn' + (c === G.chip ? ' on' : ''), c); btn.dataset.chip = c; btn.onclick = () => { G.chip = c; render(); }; sel.appendChild(btn); });

    G.dom = { ov, dieA: a, dieB: b };

    ov.addEventListener('click', (e) => {
      const ctrl = e.target.closest('[data-fp]');
      if (ctrl) {
        const act = ctrl.dataset.fp;
        if (act === 'close') close();
        else if (act === 'roll') doRoll();
        else if (act === 'clear') takeDownAll();
        else if (act === 'topup') { G.bank += 500; G.buyIn += 500; toast('+500 practice chips added.', 'good'); render(); saveBank(); }
        else if (act === 'reset') resetBank();
        return;
      }
      const z = e.target.closest('.zone[data-bet]');
      if (z) placeBet(slotFromZone(z), z);
    });
    ov.addEventListener('contextmenu', (e) => {
      const z = e.target.closest('.zone[data-bet]'); if (!z) return;
      e.preventDefault(); takeDown(slotFromZone(z));
    });

    G.built = true;
  }

  function slotFromZone(z) {
    const bet = z.dataset.bet, num = z.dataset.num;
    if (bet === 'place') return 'place-' + num;
    if (bet === 'hard') return 'hard-' + num;
    return bet; // passline, dontpass, come, dontcome, odds, field, any7, eleven, aces, boxcars
  }

  /* --------------------------- open / close --------------------------- */
  function open() {
    build(); loadBank();
    G.phase = 'comeout'; G.point = null; G.bets = {}; G.come = []; G.dcome = []; G.log = [];
    toast('Welcome to the practice table. Bet the line and roll.', 'point');
    G.dom.ov.classList.remove('hidden'); G.open = true;
    document.addEventListener('keydown', onKey, true);
    render();
  }
  function close() { if (!G.open) return; G.dom.ov.classList.add('hidden'); G.open = false; document.removeEventListener('keydown', onKey, true); saveBank(); }
  function onKey(e) {
    if (!G.open) return;
    if (e.key === 'Escape') { close(); e.preventDefault(); }
    else if (e.key === ' ' || e.key === 'Enter') { doRoll(); e.preventDefault(); }
  }

  /* --------------------------- betting --------------------------- */
  function lineBetPresent() { return G.bets.passline || G.bets.dontpass; }

  function placeBet(slot, zoneEl) {
    if (G.rolling) return;
    const deny = () => { if (zoneEl) { zoneEl.classList.remove('denied'); void zoneEl.offsetWidth; zoneEl.classList.add('denied'); } };
    if (G.bank < G.chip) { toast('Not enough chips for that. Reset or top up.', 'warn'); deny(); return; }

    if (slot === 'passline' || slot === 'dontpass') {
      if (G.phase === 'point') { toast('The line is only bet on the come-out (puck OFF). Use Come instead.', 'warn'); deny(); return; }
    }
    if (slot === 'odds') {
      if (G.phase !== 'point' || !lineBetPresent()) { toast('Odds need a point established and a line bet behind them.', 'warn'); deny(); return; }
      const oslot = G.bets.dontpass ? 'dontodds' : 'passodds';
      add(oslot, G.chip); toast(`+${G.chip} Odds — the only zero-edge bet. Nice.`, 'good'); placed(zoneEl); return;
    }
    if (slot === 'come' || slot === 'dontcome') {
      if (G.phase !== 'point') { toast('Come bets work once a point is set. Bet the line first.', 'warn'); deny(); return; }
      G.bank -= G.chip;
      const arr = slot === 'come' ? G.come : G.dcome;
      let pend = arr.find((x) => x.num == null); if (!pend) { pend = { amount: 0, num: null }; arr.push(pend); }
      pend.amount += G.chip;
      toast(`+${G.chip} on ${slot === 'come' ? 'Come' : "Don't Come"}.`, 'place'); placed(zoneEl); render(); saveBank(); return;
    }
    add(slot, G.chip);
    toast(`+${G.chip} on ${label(slot)}.` + advice(slot), 'place'); placed(zoneEl);
  }
  function placed(zoneEl) { if (zoneEl) { zoneEl.classList.remove('placed'); void zoneEl.offsetWidth; zoneEl.classList.add('placed'); } }
  function add(slot, amt) { G.bank -= amt; G.bets[slot] = (G.bets[slot] || 0) + amt; render(); saveBank(); }

  function takeDown(slot) {
    if (G.rolling) return;
    if (slot === 'odds') { const os = G.bets.dontodds ? 'dontodds' : 'passodds'; return refund(os); }
    if (slot === 'come' || slot === 'dontcome') {
      const arr = slot === 'come' ? G.come : G.dcome; const pend = arr.find((x) => x.num == null);
      if (pend) { G.bank += pend.amount; arr.splice(arr.indexOf(pend), 1); toast('Took down the pending ' + (slot === 'come' ? 'Come' : "Don't Come") + ' bet.', 'point'); render(); saveBank(); }
      else toast('Traveled come bets are contract bets — they ride until they resolve.', 'warn');
      return;
    }
    if (slot === 'passline' && G.phase === 'point') { toast('A Pass Line bet is a contract once the point is set — it must ride.', 'warn'); return; }
    refund(slot);
  }
  function refund(slot) { if (!G.bets[slot]) return; G.bank += G.bets[slot]; delete G.bets[slot]; toast('Took down ' + label(slot) + '.', 'point'); render(); saveBank(); }

  function takeDownAll() {
    let any = false;
    Object.keys(G.bets).forEach((s) => {
      if (s === 'passline' && G.phase === 'point') return;   // contract
      G.bank += G.bets[s]; delete G.bets[s]; any = true;
    });
    [G.come, G.dcome].forEach((arr) => { for (let i = arr.length - 1; i >= 0; i--) { if (arr[i].num == null) { G.bank += arr[i].amount; arr.splice(i, 1); any = true; } } });
    toast(any ? 'Took down every bet that can be pulled.' : 'Nothing to take down.', 'point'); render(); saveBank();
  }

  function resetBank() { G.bank = START_BANK; G.buyIn = START_BANK; G.stats = { rolls: 0, made: 0, out: 0, best: 0 }; G.phase = 'comeout'; G.point = null; G.bets = {}; G.come = []; G.dcome = []; toast('Bankroll reset to ' + START_BANK + '.', 'point'); render(); saveBank(); }

  function advice(slot) {
    if (slot === 'any7') return ' ⚠ 16.67% house edge — the worst bet here.';
    if (slot === 'place-4' || slot === 'place-10') return ' (6 & 8 are better place bets)';
    if (slot === 'place-6' || slot === 'place-8') return ' ✓ the strongest place bets.';
    return '';
  }

  /* --------------------------- rolling & resolution --------------------------- */
  function doRoll() {
    if (G.rolling || !G.open) return;
    if (!(Object.keys(G.bets).length || G.come.length || G.dcome.length)) { toast('Place a bet before you roll.', 'warn'); return; }
    G.rolling = true; render();
    const da = rnd(6) + 1, db = rnd(6) + 1, tot = da + db;
    animRoll(G.dom.dieA, G.dom.dieB, da, db, () => { resolve(da, db, tot); G.rolling = false; render(); saveBank(); });
  }

  function lineOutcome(style, tot) {
    if (G.phase !== 'point') return 'neutral';
    if (style === 'dont') return tot === 7 ? 'make' : tot === G.point ? 'bust' : 'neutral';
    return tot === G.point ? 'make' : tot === 7 ? 'bust' : 'neutral';
  }

  function resolve(da, db, tot) {
    const roll = { d1: da, d2: db, total: tot };
    G.stats.rolls++;
    toast(`🎲 ${da} + ${db} = ${tot}${hard(da, db) ? ' (hard)' : ''}`, 'roll');
    let win = 0;
    const prevPoint = G.point;

    ['passline', 'dontpass'].forEach((slot) => {
      if (!G.bets[slot]) return;
      const style = slot === 'dontpass' ? 'dont' : 'pass'; const amt = G.bets[slot];
      const res = G.phase === 'comeout' ? comeoutLineResolve(style, amt, tot) : SO.craps.resolveBet({ betType: slot, amount: amt }, roll, G.point, lineOutcome(style, tot), {});
      win += apply(slot, res, amt);
    });
    ['passodds', 'dontodds'].forEach((slot) => {
      if (!G.bets[slot]) return;
      const style = slot === 'dontodds' ? 'dont' : 'pass'; const amt = G.bets[slot];
      win += apply(slot, SO.craps.resolveBet({ betType: slot, amount: amt }, roll, prevPoint, lineOutcome(style, tot), {}), amt);
    });
    ['field', 'any7', 'eleven', 'aces', 'boxcars'].forEach((slot) => {
      if (!G.bets[slot]) return; const amt = G.bets[slot];
      win += apply(slot, SO.craps.resolveBet({ betType: slot, amount: amt }, roll, G.point, 'neutral', {}), amt);
    });
    if (G.phase === 'point') {
      POINTS.forEach((n) => { const slot = 'place-' + n; if (!G.bets[slot]) return; const amt = G.bets[slot]; win += apply(slot, SO.craps.resolveBet({ betType: 'place', amount: amt, num: n }, roll, G.point, 'neutral', {}), amt); });
      [4, 6, 8, 10].forEach((n) => { const slot = 'hard-' + n; if (!G.bets[slot]) return; const amt = G.bets[slot]; win += apply(slot, SO.craps.resolveBet({ betType: 'hard', amount: amt, num: n }, roll, G.point, 'neutral', {}), amt); });
    }
    win += resolveTravel(G.come, 'come', roll);
    win += resolveTravel(G.dcome, 'dontcome', roll);

    if (G.phase === 'comeout') {
      if (POINTS.includes(tot)) { G.phase = 'point'; G.point = tot; toast(`Point is ${tot}. The puck is ON. Take odds behind your line!`, 'point'); }
    } else {
      if (tot === prevPoint) { G.stats.made++; toast(`Point ${prevPoint} made! Back to a come-out.`, 'win'); G.phase = 'comeout'; G.point = null; }
      else if (tot === 7) { G.stats.out++; toast('Seven-out. The dice pass — new come-out.', 'lose'); G.phase = 'comeout'; G.point = null; }
    }
    if (win > G.stats.best) G.stats.best = win;
  }

  function apply(slot, res, stake) {
    if (!res) return 0;
    if (res.credit) G.bank += Math.round(res.credit);
    const gained = res.result === 'win' ? Math.round(res.credit || 0) : 0;
    if (res.result === 'win') toast(`✓ ${label(slot)} wins +${Math.round(res.credit)}.`, 'win');
    else if (res.result === 'lose') toast(`✗ ${label(slot)} loses.`, 'lose');
    else if (res.result === 'push') toast(`${label(slot)} pushes — returned.`, 'point');
    if (res.remove) delete G.bets[slot];
    return res.result === 'win' ? Math.max(0, gained - (res.remove ? stake : 0)) : 0;
  }

  function resolveTravel(arr, betType, roll) {
    let best = 0;
    for (let i = arr.length - 1; i >= 0; i--) {
      const bet = arr[i];
      const res = SO.craps.resolveBet({ betType, amount: bet.amount, num: bet.num }, roll, G.point, 'neutral', {});
      if (res.numSet != null) { bet.num = res.numSet; toast(`${betType === 'come' ? 'Come' : "Don't Come"} bet travels to ${res.numSet}.`, 'point'); }
      if (res.credit) G.bank += Math.round(res.credit);
      if (res.result === 'win') { toast(`✓ ${betType === 'come' ? 'Come' : "Don't Come"} ${bet.num || ''} wins +${Math.round(res.credit)}.`, 'win'); best = Math.max(best, Math.round(res.credit)); }
      else if (res.result === 'lose') toast(`✗ ${betType === 'come' ? 'Come' : "Don't Come"} ${bet.num || ''} loses.`, 'lose');
      if (res.remove) arr.splice(i, 1);
    }
    return best;
  }

  // come-out line resolution (SO.craps' lineOutcome has no come-out semantics)
  function comeoutLineResolve(style, amt, tot) {
    if (style === 'pass') {
      if (tot === 7 || tot === 11) return { result: 'win', credit: amt * 2, remove: true };
      if (tot === 2 || tot === 3 || tot === 12) return { result: 'lose', credit: 0, remove: true };
      return { result: 'stay', credit: 0, remove: false };
    }
    if (tot === 2 || tot === 3) return { result: 'win', credit: amt * 2, remove: true };
    if (tot === 12) return { result: 'push', credit: amt, remove: true };
    if (tot === 7 || tot === 11) return { result: 'lose', credit: 0, remove: true };
    return { result: 'stay', credit: 0, remove: false };
  }

  function hard(a, b) { return a === b && [2, 3, 4, 5].includes(a); }

  /* --------------------------- rendering --------------------------- */
  function label(slot) {
    if (slot.startsWith('place-')) return 'Place ' + slot.slice(6);
    if (slot.startsWith('hard-')) return 'Hard ' + slot.slice(5);
    return ({ passline: 'Pass Line', dontpass: "Don't Pass", passodds: 'Odds', dontodds: 'Odds', field: 'Field', any7: 'Any 7', eleven: 'Yo (11)', aces: 'Aces (2)', boxcars: 'Boxcars (12)', come: 'Come', dontcome: "Don't Come" })[slot] || slot;
  }
  function toast(t, c) { G.log.push({ t, c }); if (G.log.length > 40) G.log.shift(); }
  function pend(arr) { return arr.filter((x) => x.num == null).reduce((s, x) => s + x.amount, 0); }

  function render() {
    const ov = G.dom.ov; if (!ov) return;
    ov.querySelector('.fp-bank').textContent = G.bank;
    const net = G.bank - G.buyIn;
    const netEl = ov.querySelector('.fp-net'); netEl.textContent = net ? (net > 0 ? ' +' + net : ' ' + net) : ''; netEl.className = 'fp-net ' + (net > 0 ? 'up' : net < 0 ? 'down' : '');
    const pp = ov.querySelector('.fp-pointpill'); pp.textContent = G.phase === 'point' ? 'POINT ' + G.point : 'COME-OUT'; pp.classList.toggle('on', G.phase === 'point');
    ov.querySelector('.fp-stagephase').textContent = G.phase === 'point' ? 'POINT ' + G.point : 'COME-OUT';
    ov.querySelector('.fp-stagehint').innerHTML = G.rolling ? 'rolling…' : (G.phase === 'point' ? `roll <span class="accent">${G.point}</span> before a <span class="accent">7</span>` : 'roll to set the point');

    ov.querySelectorAll('.fp-chipbtn').forEach((b) => b.classList.toggle('on', +b.dataset.chip === G.chip));
    const rb = ov.querySelector('.fp-roll'); rb.disabled = G.rolling; rb.classList.toggle('ready', !G.rolling); rb.textContent = G.rolling ? '· · ·' : 'R O L L';

    // pucks + come-out "off" dim on place/hard
    ov.querySelectorAll('.zone.place').forEach((z) => {
      const n = +z.dataset.num;
      z.querySelector('.puck').classList.toggle('on', G.phase === 'point' && G.point === n);
      z.classList.toggle('fp-off', G.phase === 'comeout');
    });
    ov.querySelectorAll('.zone.prop').forEach((z) => { if (z.dataset.bet === 'hard') z.classList.toggle('fp-off', G.phase === 'comeout'); });
    // locked hints
    ov.querySelector('.zone.odds').classList.toggle('fp-locked', !(G.phase === 'point' && lineBetPresent()));
    ov.querySelectorAll('.zone.come, .zone.dontcome').forEach((z) => z.classList.toggle('fp-locked', G.phase !== 'point'));
    ov.querySelectorAll('.zone.passline, .zone.dontpass').forEach((z) => z.classList.toggle('fp-locked', G.phase === 'point' && !G.bets[z.dataset.bet]));

    renderChips(ov);

    const logEl = ov.querySelector('.fp-log');
    logEl.innerHTML = G.log.slice(-7).map((l) => `<div class="fpl ${l.c || ''}">${l.t}</div>`).join('');
    logEl.scrollTop = logEl.scrollHeight;
    ov.querySelector('.fp-stats').innerHTML = `<span>ROLLS <b>${G.stats.rolls}</b></span><span>POINTS MADE <b>${G.stats.made}</b></span><span>SEVEN-OUTS <b>${G.stats.out}</b></span><span>BEST WIN <b>${G.stats.best}</b></span>`;
  }

  function bchip(amt, cls) { const s = el('span', 'bchip' + (cls ? ' ' + cls : '')); s.textContent = amt; return s; }
  function chipInto(ov, zone, amt, cls) { if (!amt) return; const c = ov.querySelector('.chips-here[data-zone="' + zone + '"]'); if (c) c.appendChild(bchip(amt, cls)); }
  function renderChips(ov) {
    ov.querySelectorAll('.chips-here').forEach((c) => { c.innerHTML = ''; });
    chipInto(ov, 'passline', G.bets.passline);
    chipInto(ov, 'dontpass', G.bets.dontpass, 'dont');
    chipInto(ov, 'field', G.bets.field);
    ['any7', 'eleven', 'aces', 'boxcars'].forEach((s) => chipInto(ov, s, G.bets[s], 'prop'));
    [4, 6, 8, 10].forEach((n) => chipInto(ov, 'hard-' + n, G.bets['hard-' + n], 'prop'));
    POINTS.forEach((n) => chipInto(ov, 'place-' + n, G.bets['place-' + n]));
    chipInto(ov, 'odds', (G.bets.passodds || 0) + (G.bets.dontodds || 0), G.bets.dontodds ? 'dont' : '');
    chipInto(ov, 'come', pend(G.come), 'come');
    chipInto(ov, 'dontcome', pend(G.dcome), 'dont');
    G.come.filter((x) => x.num).forEach((x) => chipInto(ov, 'place-' + x.num, x.amount, 'come'));
    G.dcome.filter((x) => x.num).forEach((x) => chipInto(ov, 'place-' + x.num, x.amount, 'dont'));
  }

  /* --------------------------- boot --------------------------- */
  function init() { const b = document.getElementById('freeplay-btn'); if (b) b.addEventListener('click', open); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();

  return { open, close };
})();
