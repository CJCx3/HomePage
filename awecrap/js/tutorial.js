/* AWECRAP — tutorial.js
 * The interactive "How to Play" system + reference encyclopedia.
 * Builds its own full-screen overlay (so index.html stays lean), reads all
 * content from SO.TUTORIAL, and resolves the practice table through the real
 * SO.craps module so it teaches the game's true numbers.
 *
 * Public API:
 *   SO.Tutor.open(resume?)   — launch the tutorial (offers resume if progress)
 *   SO.Tutor.close()
 *   SO.Tutor.openReference() — jump straight to the encyclopedia
 */
window.SO = window.SO || {};

SO.Tutor = (function () {
  'use strict';

  const T = SO.TUTORIAL;
  const SAVE_KEY = 'awecrap_tutorial_v1';
  const PIPS = { 1: [5], 2: [1, 9], 3: [1, 5, 9], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9] };
  const RISK_WORDS = ['', 'Very safe', 'Safe', 'Moderate', 'Risky', 'Wild'];

  // ---- tiny DOM helper ----
  function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); }
  function d2(n) { return Math.round(n * 100) / 100; }

  const S = {
    built: false, open: false, pages: [], idx: 0,
    save: { page: 0, done: false, bookmarks: [], spoilers: false },
    typer: null,           // active typewriter token
    pad: { active: false, last: 0, prevPressed: false },
    dom: {},
  };

  /* ============================ persistence ============================ */
  function load() {
    try { const raw = localStorage.getItem(SAVE_KEY); if (raw) Object.assign(S.save, JSON.parse(raw)); } catch (e) {}
    if (!Array.isArray(S.save.bookmarks)) S.save.bookmarks = [];
  }
  function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(S.save)); } catch (e) {} }

  /* ============================ page assembly ============================ */
  function buildPages() {
    const pages = [];
    T.chapters.forEach((ch, ci) => {
      let cps;
      if (ch.source === 'bets') cps = T.bets.map((b) => ({ type: 'bet', bet: b, title: b.name }));
      else if (ch.source === 'features') cps = T.features.map((f) => ({ type: 'feature', feature: f, title: f.title }));
      else if (ch.source === 'bosses') cps = T.bosses.map((b) => ({ type: 'boss', boss: b, title: b.name }));
      else if (ch.source === 'strategy') cps = T.strategy.map((s) => ({ type: 'strategy', topic: s, title: s.title }));
      else if (ch.source === 'archetypes') cps = T.archetypes.map((a) => ({ type: 'archetype', arch: a, title: a.name }));
      else cps = (ch.pages || []).slice();
      cps.forEach((p) => pages.push(Object.assign({ chapterId: ch.id, chapterTitle: ch.title, chapterIcon: ch.icon, chapterIndex: ci }, p)));
    });
    return pages;
  }

  /* ============================ overlay scaffold ============================ */
  function build() {
    if (S.built) return;
    const ov = el('div', 'overlay tut hidden');
    ov.id = 'tutorial-overlay';
    ov.innerHTML = `
      <div class="tut-frame"></div>
      <div class="tut-shell">
        <header class="tut-top">
          <button class="tut-icobtn" data-act="chapters" title="Chapters (C)">☰ <span class="tut-lbl">CHAPTERS</span></button>
          <div class="tut-crumb"><span class="tut-crumb-ico"></span><span class="tut-crumb-txt"></span></div>
          <div class="tut-top-right">
            <button class="tut-icobtn" data-act="reference" title="Reference (R)">📖 <span class="tut-lbl">REFERENCE</span></button>
            <button class="tut-icobtn ghost" data-act="close" title="Close (Esc)">✕</button>
          </div>
        </header>
        <div class="tut-progress"><div class="tut-progress-fill"></div></div>
        <main class="tut-stage" tabindex="0"></main>
        <div class="tut-instructor">
          <div class="tut-dealer"><span class="tut-dealer-face">♠</span></div>
          <div class="tut-speech"><p class="tut-speech-txt"></p><span class="tut-speech-hint">click to skip ▸</span></div>
        </div>
        <footer class="tut-nav">
          <button class="btn tut-prev" data-act="prev">◀ Previous</button>
          <div class="tut-nav-mid"><span class="tut-pageinfo"></span></div>
          <button class="btn tut-next" data-act="next">Next ▶</button>
        </footer>
      </div>
      <aside class="tut-chapters"><h3 class="ornate-title">Chapters</h3><div class="tut-chapters-list"></div><button class="btn btn-mini tut-skip" data-act="skip">Skip tutorial</button></aside>
      <section class="tut-reference hidden"></section>
    `;
    document.body.appendChild(ov);

    S.dom = {
      ov,
      crumbIco: ov.querySelector('.tut-crumb-ico'),
      crumbTxt: ov.querySelector('.tut-crumb-txt'),
      progress: ov.querySelector('.tut-progress-fill'),
      stage: ov.querySelector('.tut-stage'),
      speech: ov.querySelector('.tut-speech-txt'),
      speechBox: ov.querySelector('.tut-speech'),
      instructor: ov.querySelector('.tut-instructor'),
      pageinfo: ov.querySelector('.tut-pageinfo'),
      prev: ov.querySelector('.tut-prev'),
      next: ov.querySelector('.tut-next'),
      chapters: ov.querySelector('.tut-chapters'),
      chaptersList: ov.querySelector('.tut-chapters-list'),
      reference: ov.querySelector('.tut-reference'),
    };

    // event delegation for [data-act]
    ov.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]'); if (!b) return;
      const a = b.dataset.act;
      if (a === 'close') close();
      else if (a === 'next') next();
      else if (a === 'prev') prev();
      else if (a === 'chapters') toggleChapters();
      else if (a === 'reference') toggleReference();
      else if (a === 'skip') { S.save.done = true; persist(); close(); }
    });
    // click the speech box to finish the typewriter
    S.dom.speechBox.addEventListener('click', () => { if (S.typer) S.typer.finish(); });

    S.built = true;
  }

  /* ============================ open / close ============================ */
  function open(forceResume) {
    if (!T) return;
    load(); build();
    S.pages = buildPages();
    S.dom.ov.classList.remove('hidden');
    S.open = true;
    document.addEventListener('keydown', onKey, true);
    startPad();
    S.dom.reference.classList.add('hidden');
    S.dom.chapters.classList.remove('shown');

    const resumable = S.save.page > 0 && S.save.page < S.pages.length && !S.save.done;
    if (forceResume) { goto(Math.min(S.save.page, S.pages.length - 1)); }
    else if (resumable) resumePrompt();
    else goto(0);
  }

  function close() {
    if (!S.open) return;
    if (S.typer) S.typer.finish();
    S.dom.ov.classList.add('hidden');
    S.open = false;
    document.removeEventListener('keydown', onKey, true);
    S.pad.active = false;
  }

  function resumePrompt() {
    const p = S.pages[Math.min(S.save.page, S.pages.length - 1)];
    S.dom.crumbIco.textContent = '⏸';
    S.dom.crumbTxt.textContent = 'Welcome back';
    S.dom.progress.style.width = '0%';
    S.dom.pageinfo.textContent = '';
    S.dom.prev.style.visibility = 'hidden'; S.dom.next.style.visibility = 'hidden';
    speak(['Back for more, soul? You left off in “' + p.chapterTitle + '.” Pick up where you were, or start fresh — your call.']);
    const st = S.dom.stage; clear(st);
    const card = el('div', 'tut-resume');
    card.innerHTML = `<div class="tut-hero-ico">🎓</div><h2 class="tut-h1">Resume the lesson?</h2>
      <p class="tut-lead">You were on <b>${p.chapterTitle}</b> — ${p.title}.</p>`;
    const row = el('div', 'tut-resume-btns');
    const r1 = el('button', 'btn btn-primary', 'Resume');
    r1.onclick = () => { S.dom.prev.style.visibility = ''; S.dom.next.style.visibility = ''; goto(Math.min(S.save.page, S.pages.length - 1)); };
    const r2 = el('button', 'btn', 'Start from the beginning');
    r2.onclick = () => { S.dom.prev.style.visibility = ''; S.dom.next.style.visibility = ''; goto(0); };
    row.appendChild(r1); row.appendChild(r2);
    card.appendChild(row); st.appendChild(card);
  }

  /* ============================ navigation ============================ */
  function goto(i) {
    i = Math.max(0, Math.min(S.pages.length - 1, i));
    S.idx = i;
    S.save.page = i;
    if (i >= S.pages.length - 1) S.save.done = true;
    persist();
    if (S.dom.reference && !S.dom.reference.classList.contains('hidden')) S.dom.reference.classList.add('hidden');
    S.dom.chapters.classList.remove('shown');
    render();
  }
  function next() { if (S.idx < S.pages.length - 1) goto(S.idx + 1); else close(); }
  function prev() { if (S.idx > 0) goto(S.idx - 1); }

  function toggleChapters() {
    const on = S.dom.chapters.classList.toggle('shown');
    if (on) renderChapterList();
  }
  function renderChapterList() {
    const list = S.dom.chaptersList; clear(list);
    let curChapter = null;
    S.pages.forEach((p, i) => {
      if (p.chapterId !== curChapter) {
        curChapter = p.chapterId;
        const firstIdx = i;
        const done = S.save.page > i;
        const b = el('button', 'tut-chapter-item' + (p.chapterIndex === S.pages[S.idx].chapterIndex ? ' current' : '') + (done ? ' done' : ''));
        b.innerHTML = `<span class="tci-ico">${p.chapterIcon}</span> ${p.chapterTitle}`;
        b.onclick = () => goto(firstIdx);
        list.appendChild(b);
      }
    });
  }

  function toggleReference() {
    const ref = S.dom.reference;
    if (ref.classList.contains('hidden')) { ref.classList.remove('hidden'); renderReference(); }
    else ref.classList.add('hidden');
  }
  function openReference() { open(true); setTimeout(() => { S.dom.reference.classList.remove('hidden'); renderReference(); }, 30); }

  /* ============================ render dispatch ============================ */
  function render() {
    const p = S.pages[S.idx];
    S.dom.crumbIco.textContent = p.chapterIcon || '♠';
    S.dom.crumbTxt.textContent = p.chapterTitle;
    S.dom.progress.style.width = ((S.idx) / (S.pages.length - 1) * 100).toFixed(1) + '%';
    S.dom.pageinfo.textContent = 'Chapter ' + (p.chapterIndex + 1) + ' / ' + T.chapters.length + '  ·  page ' + (S.idx + 1) + ' of ' + S.pages.length;
    S.dom.prev.disabled = S.idx === 0;
    S.dom.next.textContent = S.idx === S.pages.length - 1 ? 'Finish ✦' : 'Next ▶';

    const st = S.dom.stage; clear(st); st.scrollTop = 0;
    let lines = p.instructor;
    const R = {
      intro: renderIntro, tableZone: renderTableZone, diceDemo: renderDiceDemo,
      rulesCard: renderRulesCard, bet: renderBet, practice: renderPractice,
      feature: renderFeature, boss: renderBoss, strategy: renderStrategy, archetype: renderArchetype,
      referenceIntro: renderReferenceIntro,
    };
    (R[p.type] || renderIntro)(st, p);
    if (!lines) lines = autoLines(p);
    S.dom.instructor.style.display = lines && lines.length ? '' : 'none';
    if (lines && lines.length) speak(lines);
  }

  function autoLines(p) {
    if (p.type === 'bet' && p.bet) return [p.bet.short];
    if (p.type === 'feature' && p.feature) return [p.feature.what];
    if (p.type === 'boss' && p.boss) return [p.boss.danger];
    if (p.type === 'strategy' && p.topic) return [p.topic.body.split('. ')[0] + '.'];
    if (p.type === 'archetype' && p.arch) return ['Read the point they set — it tells you everything. ' + p.arch.tell];
    return null;
  }

  /* ============================ instructor typewriter ============================ */
  function speak(lines) {
    if (S.typer) S.typer.finish();
    const full = lines.map((l) => l).join('\n\n');
    const box = S.dom.speech;
    box.innerHTML = '';
    let i = 0; let done = false; let timer = null;
    const html = full.replace(/\n\n/g, '<br><br>');
    // type over the plain text, then swap to the html (keeps <b>/<i> intact)
    const plain = full;
    function tick() {
      if (done) return;
      i += 2;
      box.textContent = plain.slice(0, i);
      if (i >= plain.length) { finish(); return; }
      timer = setTimeout(tick, 9);
    }
    function finish() { done = true; if (timer) clearTimeout(timer); box.innerHTML = html; S.typer = null; S.dom.speechBox.classList.remove('typing'); }
    S.typer = { finish };
    S.dom.speechBox.classList.add('typing');
    tick();
  }

  /* ============================ dice widget ============================ */
  function makeDie() {
    const d = el('div', 'die');
    for (let i = 0; i < 9; i++) d.appendChild(el('span', 'cell'));
    return d;
  }
  function setDie(d, val) {
    const set = PIPS[val] || [];
    const cells = d.children;
    for (let i = 0; i < 9; i++) cells[i].className = set.includes(i + 1) ? 'pip' : 'cell';
  }
  function rollDice(dieA, dieB, a, b, cb) {
    dieA.classList.add('rolling'); dieB.classList.add('rolling');
    setTimeout(() => {
      dieA.classList.remove('rolling'); dieB.classList.remove('rolling');
      setDie(dieA, a); setDie(dieB, b);
      dieA.classList.add('settle'); dieB.classList.add('settle');
      setTimeout(() => { dieA.classList.remove('settle'); dieB.classList.remove('settle'); }, 280);
      if (cb) cb();
    }, 520);
  }
  function rnd(n) { return Math.floor(Math.random() * n); }

  /* ============================ renderers: static ============================ */
  function renderIntro(st, p) {
    const wrap = el('div', 'tut-page tut-intro');
    if (p.showcase) {
      wrap.appendChild(el('div', 'tut-hero-ico', '♠'));
      wrap.appendChild(el('h2', 'tut-h1 logo-mini', 'AweCrap'));
      wrap.appendChild(el('div', 'tut-kicker', '· A CASINO FROM PURGATORY ·'));
    } else {
      wrap.appendChild(el('h2', 'tut-h1', (p.icon ? p.icon + '  ' : '') + p.title));
    }
    if (p.body) wrap.appendChild(el('p', 'tut-lead', p.body));
    if (p.bullets) {
      const g = el('div', 'tut-cardgrid');
      p.bullets.forEach(([h, t]) => { const c = el('div', 'tut-minicard'); c.innerHTML = `<b>${h}</b><span>${t}</span>`; g.appendChild(c); });
      wrap.appendChild(g);
    }
    if (p.showcase) {
      const show = el('div', 'tut-showcase');
      const dice = el('div', 'dice tut-dice');
      const a = makeDie(), b = makeDie(); setDie(a, 5); setDie(b, 2);
      dice.appendChild(a); dice.appendChild(b);
      const chips = el('div', 'tut-chipstack');
      ['♥', '♥', '♥'].forEach(() => chips.appendChild(el('span', 'tut-chip', '5')));
      show.appendChild(labeled('THE DICE', dice));
      show.appendChild(labeled('THE CHIPS (your HP)', chips));
      wrap.appendChild(show);
    }
    st.appendChild(wrap);
  }
  function labeled(label, node) { const w = el('div', 'tut-labeled'); w.appendChild(node); w.appendChild(el('div', 'tut-label', label)); return w; }

  /* ============================ renderers: table tour ============================ */
  function tableDiagram() {
    const t = el('div', 'tut-table');
    t.innerHTML = `
      <div class="tt-brand">✦ AWECRAP ✦</div>
      <div class="tt-zone" data-zone="place">
        <div class="tt-boxes">
          ${[4, 5, 6, 8, 9, 10].map((n) => `<span class="tt-box"><b>${n}</b><small>${placePay(n)}</small></span>`).join('')}
        </div>
        <span class="tt-tag">PLACE / BUY</span>
      </div>
      <div class="tt-row">
        <div class="tt-zone tt-dc" data-zone="dontcome">DON'T<br>COME</div>
        <div class="tt-zone tt-come" data-zone="come">C O M E</div>
      </div>
      <div class="tt-zone tt-field" data-zone="field"><b>FIELD</b><span>2 3 4 · 9 10 11 · 12</span><small>2 pays 2:1 · 12 pays 3:1</small></div>
      <div class="tt-zone tt-props" data-zone="props">
        <span class="tt-tag">CENTER — PROPS &amp; HARDWAYS</span>
        <div class="tt-propgrid">
          <span>HARD 4 · 7:1</span><span>HARD 6 · 9:1</span><span>HARD 8 · 9:1</span><span>HARD 10 · 7:1</span>
          <span>ANY 7 · 4:1</span><span>YO 11 · 15:1</span><span>ACES · 30:1</span><span>BOXCARS · 30:1</span>
        </div>
      </div>
      <div class="tt-zone tt-odds" data-zone="odds"><b>ODDS</b><small>true odds · no house edge</small></div>
      <div class="tt-zone tt-dp" data-zone="dontpass"><b>DON'T PASS BAR</b> ⚅⚅</div>
      <div class="tt-zone tt-pl" data-zone="passline"><b>P A S S&nbsp;&nbsp;L I N E</b></div>
    `;
    return t;
  }
  function placePay(n) { const r = SO.craps.PLACE[n]; return r[0] + ':' + r[1]; }

  function renderTableZone(st, p) {
    const wrap = el('div', 'tut-page tut-tablepage');
    const t = tableDiagram();
    t.querySelectorAll('.tt-zone').forEach((z) => {
      if (z.dataset.zone === p.zone) z.classList.add('lit'); else z.classList.add('dim');
    });
    wrap.appendChild(t);

    const bet = p.betRef ? T.betById(p.betRef) : null;
    const call = el('div', 'tut-callout');
    call.innerHTML = `<h3>${p.title}</h3>`;
    if (bet) {
      call.innerHTML += `
        <p class="tut-call-short">${bet.short}</p>
        <ul class="tut-call-list">
          <li><span class="k win">Wins</span> ${bet.wins}</li>
          <li><span class="k lose">Loses</span> ${bet.loses}</li>
          <li><span class="k pay">Pays</span> ${bet.payout}</li>
        </ul>
        <p class="tut-call-eg"><b>Example.</b> ${bet.example}</p>`;
    }
    wrap.appendChild(call);
    st.appendChild(wrap);
  }

  /* ============================ renderers: dice demos ============================ */
  function renderDiceDemo(st, p) {
    const wrap = el('div', 'tut-page tut-dicepage');
    const arena = el('div', 'tut-dice-arena');
    const dice = el('div', 'dice tut-dice big');
    const a = makeDie(), b = makeDie(); setDie(a, 3); setDie(b, 4);
    dice.appendChild(a); dice.appendChild(b);
    arena.appendChild(dice);
    const total = el('div', 'tut-dtotal', '—');
    arena.appendChild(total);
    wrap.appendChild(arena);

    const verdict = el('div', 'tut-verdict', p.seq === 'comeout'
      ? 'Press <b>Roll</b> for a come-out throw. 7 or 11 wins · 2, 3, 12 loses · anything else sets the point.'
      : 'A point of <b>8</b> is set. Press <b>Roll</b> and hope for another 8 before a 7.');
    wrap.appendChild(verdict);

    const btn = el('button', 'btn btn-primary tut-rollbtn', '🎲 Roll the dice');
    wrap.appendChild(btn);
    st.appendChild(wrap);

    let point = p.seq === 'point' ? 8 : null;
    let rolling = false;
    btn.onclick = () => {
      if (rolling) return; rolling = true; btn.disabled = true;
      let da, db;
      if (p.seq === 'comeout') { da = rnd(6) + 1; db = rnd(6) + 1; }
      else {
        // point demo: bias toward a decisive outcome so the lesson lands
        const script = [[5, 3], [6, 1], [4, 4], [2, 5]]; // 8(win), 7(out), 8(win), 7(out)
        const pick = script[rnd(script.length)]; da = pick[0]; db = pick[1];
      }
      rollDice(a, b, da, db, () => {
        const tot = da + db; total.textContent = tot;
        let msg, cls;
        if (p.seq === 'comeout') {
          if (tot === 7 || tot === 11) { msg = `<b>${tot}</b> — a natural! Pass Line wins instantly. 🎉`; cls = 'win'; }
          else if (tot === 2 || tot === 3 || tot === 12) { msg = `<b>${tot}</b> — craps. Pass Line loses. Set it and forget it.`; cls = 'lose'; }
          else { msg = `<b>${tot}</b> — no instant result. The point is now <b>${tot}</b>. Roll it again before a 7 to win.`; cls = 'point'; point = tot; }
        } else {
          if (tot === point) { msg = `<b>${tot}</b> — the point is made! Pass Line wins. 🎉`; cls = 'win'; }
          else if (tot === 7) { msg = `<b>7</b> — seven-out. The point dies and the Pass Line loses. The dice pass on.`; cls = 'lose'; }
          else { msg = `<b>${tot}</b> — nothing yet. The point is still ${point}. Keep rolling.`; cls = 'point'; }
        }
        verdict.className = 'tut-verdict ' + cls; verdict.innerHTML = msg;
        rolling = false; btn.disabled = false;
      });
    };
  }

  function renderRulesCard(st) {
    const wrap = el('div', 'tut-page');
    wrap.appendChild(el('h2', 'tut-h1', 'The Rules on One Card'));
    const card = el('div', 'tut-ruleset');
    card.innerHTML = `
      <div class="tut-rulecol">
        <h4>COME-OUT ROLL</h4>
        <div class="rr win"><b>7 · 11</b><span>Pass Line WINS</span></div>
        <div class="rr lose"><b>2 · 3 · 12</b><span>Pass Line LOSES (“craps”)</span></div>
        <div class="rr point"><b>4·5·6·8·9·10</b><span>becomes the POINT</span></div>
      </div>
      <div class="tut-rulecol">
        <h4>POINT PHASE</h4>
        <div class="rr win"><b>Point again</b><span>Pass Line WINS</span></div>
        <div class="rr lose"><b>7 (“seven-out”)</b><span>Pass Line LOSES</span></div>
        <div class="rr point"><b>Anything else</b><span>roll again</span></div>
      </div>
      <div class="tut-rulenote">Don’t Pass is the mirror: it wins on the come-out 2/3, loses on 7/11 (12 pushes), then wins on the 7 and loses on the point.</div>`;
    wrap.appendChild(card);
    st.appendChild(wrap);
  }

  /* ============================ renderers: bet pages ============================ */
  function renderBet(st, p) {
    const b = p.bet;
    const wrap = el('div', 'tut-page tut-betpage');
    const head = el('div', 'tut-bet-head');
    head.innerHTML = `<span class="tut-bet-ico">${b.icon || '◈'}</span>
      <div><h2 class="tut-h1">${b.name}</h2><div class="tut-bet-cat">${catName(b.category)}${b.realOnly ? ' · <i>real-craps concept</i>' : ''}</div></div>
      <div class="tut-risk risk-${b.risk}"><span>${RISK_WORDS[b.risk]}</span><em>${'◆'.repeat(b.risk)}${'◇'.repeat(5 - b.risk)}</em></div>`;
    wrap.appendChild(head);
    wrap.appendChild(el('p', 'tut-lead', b.short));

    const grid = el('div', 'tut-bet-grid');
    grid.appendChild(field('WHEN IT WINS', b.wins, 'win'));
    grid.appendChild(field('WHEN IT LOSES', b.loses, 'lose'));
    grid.appendChild(field('PAYOUT', b.payout, 'pay'));
    grid.appendChild(field('HOUSE EDGE / RISK', b.edge, 'edge'));
    wrap.appendChild(grid);

    wrap.appendChild(field('EXAMPLE', b.example, 'eg block'));
    wrap.appendChild(field('IN AWECRAP', b.awecrap, 'awe block'));

    if (b.try && !b.realOnly) {
      const tryBtn = el('button', 'btn btn-primary tut-try', '⚅ Try it on the practice table');
      tryBtn.onclick = () => gotoPracticeWith(b.try);
      wrap.appendChild(tryBtn);
    }
    st.appendChild(wrap);
  }
  function field(label, val, cls) { const f = el('div', 'tut-field ' + (cls || '')); f.innerHTML = `<div class="tut-field-l">${label}</div><div class="tut-field-v">${val}</div>`; return f; }
  function catName(c) { return ({ line: 'Line bet · with the shooter', against: 'Line bet · against the shooter', come: 'Traveling bet', odds: 'The free bet', place: 'Standing number bet', field: 'One-roll bet', prop: 'One-roll proposition', hard: 'Standing proposition' })[c] || c; }

  function gotoPracticeWith(betSpec) {
    const pi = S.pages.findIndex((p) => p.type === 'practice');
    if (pi < 0) return;
    S._armBet = betSpec;
    goto(pi);
  }

  /* ============================ renderers: feature / boss / strategy ============================ */
  function renderFeature(st, p) {
    const f = p.feature;
    const wrap = el('div', 'tut-page');
    wrap.appendChild(el('h2', 'tut-h1', (f.icon ? f.icon + '  ' : '') + f.title));
    wrap.appendChild(field('WHAT IT IS', f.what, 'block'));
    wrap.appendChild(field('WHY IT MATTERS', f.why, 'block awe'));
    wrap.appendChild(field('HOW TO USE IT', f.how, 'block'));
    wrap.appendChild(field('EXAMPLE', f.example, 'block eg'));
    st.appendChild(wrap);
  }

  function renderBoss(st, p) {
    const b = p.boss;
    const wrap = el('div', 'tut-page tut-bosspage');
    const head = el('div', 'tut-boss-head');
    const portrait = (SO.BOSS_PORTRAITS && SO.BOSS_PORTRAITS[b.id]) || null;
    head.innerHTML = `<div class="tut-boss-portrait${portrait ? '' : ' none'}">${portrait ? `<img src="${portrait}" alt="">` : '☠'}</div>
      <div><div class="tut-boss-act">ACT ${b.act} BOSS</div><h2 class="tut-h1">${b.name}</h2><p class="tut-boss-blurb serif-i">${b.blurb}</p></div>`;
    wrap.appendChild(head);
    wrap.appendChild(field('THE DANGER', b.danger, 'block lose'));

    if (b.spoiler && !S.save.spoilers) {
      const veil = el('div', 'tut-spoiler');
      veil.innerHTML = `<p>Detailed mechanics &amp; the winning strategy are hidden to keep the fight a surprise.</p>`;
      const btn = el('button', 'btn btn-mini', '👁 Show spoilers');
      btn.onclick = () => { S.save.spoilers = true; persist(); render(); };
      veil.appendChild(btn);
      wrap.appendChild(veil);
    } else {
      wrap.appendChild(field('HOW IT WORKS', b.detail, 'block'));
      wrap.appendChild(field('HOW TO WIN', b.strategy, 'block awe'));
      if (S.save.spoilers) {
        const off = el('button', 'btn btn-mini tut-spoiler-off', '🙈 Hide spoilers');
        off.onclick = () => { S.save.spoilers = false; persist(); render(); };
        wrap.appendChild(off);
      }
    }
    st.appendChild(wrap);
  }

  function renderStrategy(st, p) {
    const s = p.topic;
    const wrap = el('div', 'tut-page');
    wrap.appendChild(el('h2', 'tut-h1', (s.icon ? s.icon + '  ' : '') + s.title));
    wrap.appendChild(el('p', 'tut-lead', s.body));
    if (s.chart) wrap.appendChild(edgeChart(s.chart));
    st.appendChild(wrap);
  }

  function renderArchetype(st, p) {
    const a = p.arch;
    const wrap = el('div', 'tut-page');
    const head = el('div', 'tut-arch-head');
    head.innerHTML = `<span class="tut-arch-ico">${a.icon}</span>
      <div><h2 class="tut-h1">${a.name}</h2><div class="tut-arch-line">plays the <b>${a.line}</b> line</div></div>`;
    wrap.appendChild(head);
    wrap.appendChild(field('THE TELL', a.tell, 'block'));
    wrap.appendChild(field('WHO', a.who, 'block'));
    wrap.appendChild(field('HOW TO BEAT THEM', a.plan, 'block awe'));
    const tag = el('div', 'tut-arch-counter');
    tag.innerHTML = `<span>⚔ Counter</span> ${a.counter}`;
    wrap.appendChild(tag);
    st.appendChild(wrap);
  }
  function edgeChart(chart) {
    const c = el('div', 'tut-chart');
    c.appendChild(el('div', 'tut-chart-title', chart.title));
    const max = Math.max.apply(null, chart.rows.map((r) => r[1])) || 1;
    chart.rows.forEach(([label, val, grade]) => {
      const row = el('div', 'tut-bar-row');
      row.innerHTML = `<span class="tut-bar-lbl">${label}</span><span class="tut-bar-track"><span class="tut-bar-fill g-${grade}" style="width:${Math.max(2, val / max * 100)}%"></span></span><span class="tut-bar-val">${val === 0 ? '0%' : val + '%'}</span>`;
      c.appendChild(row);
    });
    return c;
  }

  /* ============================ PRACTICE TABLE ============================ */
  const PRACTICE_BETS = [
    { key: 'passline', label: 'Pass', hint: 'with the shooter' },
    { key: 'dontpass', label: "Don't Pass", hint: 'against' },
    { key: 'passodds', label: 'Odds', hint: 'needs a point + line' },
    { key: 'come', label: 'Come', hint: 'travels' },
    { key: 'field', label: 'Field', hint: 'one-roll' },
    { key: 'place6', label: 'Place 6', bet: { betType: 'place', num: 6 } },
    { key: 'place8', label: 'Place 8', bet: { betType: 'place', num: 8 } },
    { key: 'place5', label: 'Place 5', bet: { betType: 'place', num: 5 } },
    { key: 'place4', label: 'Place 4', bet: { betType: 'place', num: 4 } },
    { key: 'hard8', label: 'Hard 8', bet: { betType: 'hard', num: 8 } },
    { key: 'any7', label: 'Any 7', hint: '4:1 trap' },
    { key: 'boxcars', label: 'Boxcars', hint: '30:1' },
  ];

  function renderPractice(st) {
    const P = {
      bank: 100, wager: 5, phase: 'comeout', point: null,
      bets: {}, // key -> {betType, amount, num}
      log: [],
    };
    const wrap = el('div', 'tut-page tut-practice');

    const hud = el('div', 'tut-prac-hud');
    hud.innerHTML = `<div class="tp-bank">CHIPS <b class="tp-bankv">100</b></div>
      <div class="tp-phase">PHASE <b class="tp-phasev">Come-out</b></div>
      <div class="tp-point">POINT <b class="tp-pointv">—</b></div>
      <div class="tp-wager">CHIP <button class="tp-w" data-w="5">5</button><button class="tp-w" data-w="10">10</button><button class="tp-w" data-w="25">25</button></div>`;
    wrap.appendChild(hud);

    const felt = el('div', 'tut-prac-felt');
    PRACTICE_BETS.forEach((pb) => {
      const z = el('button', 'tp-zone'); z.dataset.key = pb.key;
      z.innerHTML = `<span class="tp-zl">${pb.label}</span>${pb.hint ? `<small>${pb.hint}</small>` : ''}<span class="tp-chips"></span>`;
      z.onclick = () => placeChip(pb);
      felt.appendChild(z);
    });
    wrap.appendChild(felt);

    const arena = el('div', 'tut-prac-arena');
    const dice = el('div', 'dice tut-dice');
    const a = makeDie(), b = makeDie(); setDie(a, 4); setDie(b, 3);
    dice.appendChild(a); dice.appendChild(b);
    arena.appendChild(dice);
    const btns = el('div', 'tut-prac-btns');
    const rollBtn = el('button', 'btn btn-primary', '🎲 Roll');
    const resetBtn = el('button', 'btn btn-mini', '↺ Reset');
    btns.appendChild(rollBtn); btns.appendChild(resetBtn);
    arena.appendChild(btns);
    wrap.appendChild(arena);

    const logBox = el('div', 'tut-prac-log');
    wrap.appendChild(logBox);
    st.appendChild(wrap);

    // ---- helpers bound to this instance ----
    function refresh() {
      wrap.querySelector('.tp-bankv').textContent = P.bank;
      wrap.querySelector('.tp-phasev').textContent = P.phase === 'comeout' ? 'Come-out' : 'Point';
      wrap.querySelector('.tp-pointv').textContent = P.point || '—';
      wrap.querySelectorAll('.tp-w').forEach((w) => w.classList.toggle('on', +w.dataset.w === P.wager));
      felt.querySelectorAll('.tp-zone').forEach((z) => {
        const bet = P.bets[z.dataset.key];
        z.classList.toggle('has', !!bet);
        z.querySelector('.tp-chips').textContent = bet ? bet.amount : '';
      });
      logBox.innerHTML = P.log.slice(-7).map((l) => `<div class="tpl ${l.c || ''}">${l.t}</div>`).join('');
      logBox.scrollTop = logBox.scrollHeight;
    }
    function say(t, c) { P.log.push({ t, c }); }

    function placeChip(pb) {
      if (pb.key === 'passodds' && !(P.phase === 'point' && (P.bets.passline || P.bets.dontpass))) {
        say('You can only bet Odds once a point is set and you have a line bet behind it.', 'warn'); refresh(); return;
      }
      if ((pb.key === 'passline' || pb.key === 'dontpass') && P.phase === 'point' && !P.bets[pb.key]) {
        say('The line is only bet on the come-out (before a point). Try Come instead — it works now.', 'warn'); refresh(); return;
      }
      if (P.bank < P.wager) { say('Not enough chips. Press Reset for a fresh 100.', 'warn'); refresh(); return; }
      P.bank -= P.wager;
      const key = pb.key;
      if (P.bets[key]) P.bets[key].amount += P.wager;
      else {
        let spec;
        if (pb.bet) spec = { betType: pb.bet.betType, num: pb.bet.num };
        else if (key === 'passodds') spec = { betType: P.bets.dontpass ? 'dontodds' : 'passodds' };
        else spec = { betType: key };
        P.bets[key] = Object.assign({ amount: P.wager }, spec);
      }
      say(`Placed ${P.wager} on ${pb.label}.` + advice(pb.key), 'place');
      refresh();
    }

    function advice(key) {
      if (key === 'any7') return ' ⚠ Any Seven pays 4:1 but carries a 16.67% edge — the worst bet here.';
      if (key === 'boxcars') return ' ⚠ A 30:1 lottery ticket — a 12 is 1-in-36.';
      if (key === 'place4') return ' Note: placing the 4 (or 10) carries a 6.67% edge — the 6 & 8 are far better.';
      if (key === 'passodds') return ' ✓ Smart — Odds is the only zero-edge bet on the felt.';
      if (key === 'place6' || key === 'place8') return ' ✓ The 6 and 8 are the strongest place bets (1.52% edge).';
      if (key === 'field') return ' A one-roll bet — it resolves on the very next throw.';
      return '';
    }

    function lineFor(style, total) {
      if (P.phase !== 'point') return 'neutral';
      if (style === 'dont') return total === 7 ? 'make' : total === P.point ? 'bust' : 'neutral';
      return total === P.point ? 'make' : total === 7 ? 'bust' : 'neutral';
    }

    function doRoll() {
      if (!Object.keys(P.bets).length) { say('Put a chip on the felt first — then roll.', 'warn'); refresh(); return; }
      rollBtn.disabled = true;
      const da = rnd(6) + 1, db = rnd(6) + 1, tot = da + db;
      rollDice(a, b, da, db, () => {
        say(`🎲 Rolled ${da} + ${db} = ${tot}.`, 'roll');
        const roll = { d1: da, d2: db, total: tot };
        let pointJustSet = null, sevenOut = false;

        // resolve each bet
        Object.keys(P.bets).forEach((key) => {
          const bet = P.bets[key];
          let res;
          if (bet.betType === 'passline' || bet.betType === 'dontpass') {
            res = resolveLine(bet, tot, key);
          } else if (bet.betType === 'passodds' || bet.betType === 'dontodds') {
            const style = bet.betType === 'dontodds' ? 'dont' : 'pass';
            res = SO.craps.resolveBet(bet, roll, P.point, lineFor(style, tot), {});
          } else {
            res = SO.craps.resolveBet(bet, roll, P.point, 'neutral', {});
          }
          applyResult(key, bet, res, tot);
        });

        // phase transition from the line bets (come-out establishing a point)
        if (P.phase === 'comeout') {
          const hasLine = P.bets.passline || P.bets.dontpass;
          if (hasLine && [4, 5, 6, 8, 9, 10].includes(tot)) { P.phase = 'point'; P.point = tot; pointJustSet = tot; }
        } else if (tot === 7) { sevenOut = true; }

        if (pointJustSet) say(`The point is set to ${pointJustSet}. Your line bet rides — now add Odds behind it!`, 'point');
        if (sevenOut && P.phase === 'point') { say('Seven-out — the point dies. Back to a come-out.', 'lose'); P.phase = 'comeout'; P.point = null; }
        if (!P.bank && !Object.keys(P.bets).length) say('Out of chips. Press Reset to try again — no souls were harmed.', 'warn');
        rollBtn.disabled = false;
        refresh();
      });
    }

    function resolveLine(bet, tot, key) {
      const style = bet.betType === 'dontpass' ? 'dont' : 'pass';
      if (P.phase === 'comeout') {
        if (style === 'pass') {
          if (tot === 7 || tot === 11) return { result: 'win', credit: bet.amount * 2, remove: true };
          if (tot === 2 || tot === 3 || tot === 12) return { result: 'lose', credit: 0, remove: true };
          return { result: 'stay', credit: 0, remove: false };
        } else {
          if (tot === 2 || tot === 3) return { result: 'win', credit: bet.amount * 2, remove: true };
          if (tot === 12) return { result: 'push', credit: bet.amount, remove: true };
          if (tot === 7 || tot === 11) return { result: 'lose', credit: 0, remove: true };
          return { result: 'stay', credit: 0, remove: false };
        }
      }
      // point phase
      const line = lineFor(style, tot);
      return SO.craps.resolveBet(bet, { d1: 0, d2: 0, total: tot }, P.point, line, {});
    }

    function applyResult(key, bet, res, tot) {
      if (!res) return;
      if (res.numSet != null) { bet.num = res.numSet; say(`Come bet travels to the ${res.numSet}.`, 'point'); }
      if (res.credit) P.bank += Math.round(res.credit);
      if (res.result === 'win') say(`✓ ${label(key)} wins — +${Math.round(res.credit || bet.amount)} chips.`, 'win');
      else if (res.result === 'lose') say(`✗ ${label(key)} loses.`, 'lose');
      else if (res.result === 'push') say(`${label(key)} pushes — chips returned.`, 'warn');
      if (res.remove) delete P.bets[key];
    }
    function label(key) { const pb = PRACTICE_BETS.find((x) => x.key === key); return pb ? pb.label : key; }

    function reset() {
      P.bank = 100; P.wager = 5; P.phase = 'comeout'; P.point = null; P.bets = {}; P.log = [];
      say('Fresh table — 100 practice chips. Place a bet and roll.', 'point');
      refresh();
    }

    rollBtn.onclick = doRoll;
    resetBtn.onclick = reset;
    hud.querySelectorAll('.tp-w').forEach((w) => w.onclick = () => { P.wager = +w.dataset.w; refresh(); });

    say('Fresh table — 100 practice chips. Place a bet and roll. Nothing here is real.', 'point');
    // honor a "Try it" arming from a bet page
    if (S._armBet) {
      const spec = S._armBet; S._armBet = null;
      const match = PRACTICE_BETS.find((pb) => (pb.bet && pb.bet.betType === spec.betType && pb.bet.num === spec.num) || pb.key === spec.betType || (spec.betType === 'passodds' && pb.key === 'passodds'));
      if (match) setTimeout(() => { placeChip(match); }, 200);
    }
    refresh();
  }

  /* ============================ REFERENCE ENCYCLOPEDIA ============================ */
  function refEntries() {
    const out = [];
    T.bets.forEach((b) => out.push({ id: 'bet:' + b.id, cat: 'Bets', title: b.name, sub: catName(b.category), kw: (b.name + ' ' + b.category + ' ' + b.short).toLowerCase(),
      html: `<p class="tut-lead">${b.short}</p>${miniList([['Wins', b.wins], ['Loses', b.loses], ['Pays', b.payout], ['Edge', b.edge], ['In AweCrap', b.awecrap]])}` }));
    out.push({ id: 'ref:prob', cat: 'Probability', title: 'Dice Probabilities', sub: 'ways to roll each total (out of 36)', kw: 'probability odds dice ways chance percent 36',
      html: probTable() });
    T.strategy.forEach((s) => out.push({ id: 'strat:' + s.id, cat: 'Strategy', title: s.title, sub: 'advanced play', kw: (s.title + ' ' + s.body).toLowerCase(),
      html: `<p class="tut-lead">${s.body}</p>${s.chart ? edgeChart(s.chart).outerHTML : ''}` }));
    (T.archetypes || []).forEach((a) => out.push({ id: 'arch:' + a.id, cat: 'Enemies', title: a.name, sub: 'AI archetype · ' + a.line + ' line', kw: (a.name + ' ' + a.who + ' ' + a.tell + ' ' + a.plan).toLowerCase(),
      html: miniList([['The tell', a.tell], ['Who', a.who], ['How to beat', a.plan], ['Counter', a.counter]]) }));
    // Bestiary — the regular enemies, unlocked as you meet them in a run
    var _archName = { point: 'Point Specialist', attrition: 'Attrition Grinder', prop: 'Prop Cannon', control: 'Controller' };
    Object.keys(SO.ENEMIES || {}).forEach((id) => {
      const e = SO.ENEMIES[id];
      const met = SO.Profile ? SO.Profile.hasMet(id) : true;
      const arch = (T.archetypes || []).find((a) => a.id === e.archetype);
      const aName = _archName[e.archetype] || e.archetype;
      out.push({ id: 'bestiary:' + id, cat: 'Bestiary',
        title: met ? e.name : '??? — unmet soul',
        sub: met ? (aName + ' · ' + (e.style === 'dont' ? "Don't" : 'Pass') + ' line') : 'defeat it in a run to unlock',
        kw: met ? (e.name + ' ' + e.archetype + ' ' + (e.tell || '')).toLowerCase() : 'bestiary locked unmet ??? ' + id,
        html: met
          ? `<p class="serif-i tut-lead">${e.blurb}</p>${miniList([['Style', (e.style === 'dont' ? "Don't" : 'Pass') + ' line · ' + aName], ['Sets point', (e.setsPoint || []).join(' / ') || '—'], ['Base HP', e.hp], ['The tell', e.tell || '—'], ['Counter', arch ? arch.counter : '—']])}`
          : `<p class="tut-lead tut-locked">🔒 You haven’t faced this soul yet. Beat it in a run and its full dossier — style, tell, and how to counter it — unlocks here.</p>` });
    });
    T.features.forEach((f) => out.push({ id: 'feat:' + f.id, cat: 'Mechanics', title: f.title, sub: 'AweCrap system', kw: (f.title + ' ' + f.what).toLowerCase(),
      html: miniList([['What', f.what], ['Why', f.why], ['How', f.how], ['Example', f.example]]) }));
    if (SO.ascensionInfo) out.push({ id: 'sys:ascension', cat: 'Mechanics', title: 'The Ascension Ladder', sub: 'AweCrap system', kw: 'ascension ladder difficulty unlock rung climb damned luck',
      html: `<p class="tut-lead">Difficulty is a ladder you <b>climb by winning</b>. You open on <b>Soft Touch</b>; beat a run and the next rung unlocks. The first five rungs are the base difficulties, up to <b>Damned Luck</b>. Beyond it wait ${SO.ASCENSION_EXTRA} <b>Ascension</b> rungs (I–${SO.ROMAN[SO.ASCENSION_EXTRA]}) that keep pressing — tougher souls, bigger bets, deeper wounds, leaner coin.</p>${miniList([['Unlock', 'Win a run to reach the next rung'], ['Choose', 'Pick any rung you have unlocked in Settings'], ['Rungs', (SO.ASCENSION_MAX + 1) + ' in all'], ['Payoff', 'Higher rungs, higher stakes — and the bragging rights']])}` });
    T.bosses.forEach((b) => out.push({ id: 'boss:' + b.id, cat: 'Bosses', title: b.name, sub: 'Act ' + b.act + ' boss', kw: (b.name + ' boss ' + b.danger).toLowerCase(),
      html: `<p class="serif-i tut-lead">${b.blurb}</p>${miniList([['Danger', b.danger]].concat(S.save.spoilers ? [['How it works', b.detail], ['How to win', b.strategy]] : []))}${S.save.spoilers ? '' : '<p class="tut-ref-spoil">Enable “Show spoilers” on a boss page to reveal strategy.</p>'}` }));
    T.relicList().forEach((r) => out.push({ id: 'relic:' + r.id, cat: 'Relics', title: r.name, sub: r.rarity + ' relic', kw: (r.name + ' relic ' + r.text).toLowerCase(),
      html: `<p class="tut-lead">${r.text}</p>` }));
    T.glossary.forEach(([term, tag, def], i) => out.push({ id: 'gloss:' + i, cat: 'Terms', title: term, sub: tag === 'awecrap' ? 'AweCrap term' : 'craps term', kw: (term + ' ' + def).toLowerCase(),
      html: `<p class="tut-lead">${def}</p>` }));
    return out;
  }
  function miniList(rows) { return '<div class="tut-reflist">' + rows.map(([k, v]) => `<div class="tut-refrow"><span class="k">${k}</span><span class="v">${v}</span></div>`).join('') + '</div>'; }
  function probTable() {
    let h = '<table class="tut-probtable"><thead><tr><th>Total</th><th>Ways /36</th><th>Chance</th><th>Combos</th></tr></thead><tbody>';
    T.probabilities.forEach((p) => { h += `<tr class="${p.total === 7 ? 'seven' : ''}"><td><b>${p.total}</b></td><td>${p.ways}</td><td>${d2(p.ways / 36 * 100)}%</td><td>${p.combos}</td></tr>`; });
    h += '</tbody></table>';
    return h;
  }

  const REF = { q: '', cat: 'All', sel: null };
  function renderReference() {
    const ref = S.dom.reference;
    const entries = refEntries();
    const cats = ['All', 'Bookmarks', 'Bets', 'Probability', 'Strategy', 'Mechanics', 'Enemies', 'Bestiary', 'Bosses', 'Relics', 'Terms'];
    ref.innerHTML = `
      <div class="tut-ref-top">
        <h2 class="ornate-title">The House Ledger</h2>
        <button class="tut-icobtn ghost tut-ref-close">✕</button>
      </div>
      <div class="tut-ref-controls">
        <input class="tut-ref-search" type="text" placeholder="Search bets, payouts, bosses, terms…" value="${REF.q}">
        <div class="tut-ref-cats">${cats.map((c) => `<button class="tut-cat${c === REF.cat ? ' on' : ''}" data-cat="${c}">${c}</button>`).join('')}</div>
      </div>
      <div class="tut-ref-body"><div class="tut-ref-list"></div><div class="tut-ref-detail"></div></div>`;

    ref.querySelector('.tut-ref-close').onclick = () => ref.classList.add('hidden');
    const search = ref.querySelector('.tut-ref-search');
    search.oninput = () => { REF.q = search.value; paint(); };
    ref.querySelectorAll('.tut-cat').forEach((c) => c.onclick = () => { REF.cat = c.dataset.cat; ref.querySelectorAll('.tut-cat').forEach((x) => x.classList.toggle('on', x === c)); paint(); });

    const listEl = ref.querySelector('.tut-ref-list');
    const detailEl = ref.querySelector('.tut-ref-detail');

    function filtered() {
      const q = REF.q.trim().toLowerCase();
      return entries.filter((e) => {
        if (REF.cat === 'Bookmarks') { if (!S.save.bookmarks.includes(e.id)) return false; }
        else if (REF.cat !== 'All' && e.cat !== REF.cat) return false;
        if (q && e.kw.indexOf(q) < 0 && e.title.toLowerCase().indexOf(q) < 0) return false;
        return true;
      });
    }
    function paint() {
      const fs = filtered();
      listEl.innerHTML = fs.length ? '' : '<div class="tut-ref-empty">Nothing matches. Try another word or category.</div>';
      fs.forEach((e) => {
        const item = el('button', 'tut-ref-item' + (REF.sel === e.id ? ' sel' : ''));
        const marked = S.save.bookmarks.includes(e.id);
        item.innerHTML = `<span class="tri-star${marked ? ' on' : ''}">${marked ? '★' : '☆'}</span><span class="tri-main"><b>${e.title}</b><small>${e.cat} · ${e.sub}</small></span>`;
        item.querySelector('.tri-star').onclick = (ev) => { ev.stopPropagation(); toggleBookmark(e.id); paint(); };
        item.onclick = () => { REF.sel = e.id; showDetail(e); ref.querySelectorAll('.tut-ref-item').forEach((x) => x.classList.remove('sel')); item.classList.add('sel'); };
        listEl.appendChild(item);
      });
      if (!fs.find((e) => e.id === REF.sel)) { REF.sel = fs.length ? fs[0].id : null; }
      const cur = fs.find((e) => e.id === REF.sel);
      if (cur) showDetail(cur); else detailEl.innerHTML = '<div class="tut-ref-empty">Select an entry to read it.</div>';
      const selItem = Array.from(listEl.children).find((n) => n.querySelector && n.textContent && cur && n.textContent.includes(cur.title));
      if (selItem) selItem.classList.add('sel');
    }
    function showDetail(e) {
      const marked = S.save.bookmarks.includes(e.id);
      detailEl.innerHTML = `<div class="tut-ref-dhead"><h3>${e.title}</h3><button class="tut-bookmark${marked ? ' on' : ''}">${marked ? '★ Bookmarked' : '☆ Bookmark'}</button></div><div class="tut-ref-dcat">${e.cat} · ${e.sub}</div><div class="tut-ref-dbody">${e.html}</div>`;
      detailEl.querySelector('.tut-bookmark').onclick = () => { toggleBookmark(e.id); showDetail(e); paint(); };
    }
    function toggleBookmark(id) {
      const i = S.save.bookmarks.indexOf(id);
      if (i < 0) S.save.bookmarks.push(id); else S.save.bookmarks.splice(i, 1);
      persist();
    }
    paint();
    setTimeout(() => search.focus(), 20);
  }

  function renderReferenceIntro(st, p) {
    const wrap = el('div', 'tut-page tut-intro');
    wrap.appendChild(el('div', 'tut-hero-ico', '📖'));
    wrap.appendChild(el('h2', 'tut-h1', 'You’re Ready'));
    wrap.appendChild(el('p', 'tut-lead', 'You now know real Craps <i>and</i> the twists that make it AweCrap. This last page opens <b>The House Ledger</b> — a searchable reference to every bet, payout, probability, boss, relic and term. It’s always one tap away from the top bar (📖 Reference).'));
    const b = el('button', 'btn btn-primary', '📖 Open the Reference');
    b.onclick = () => toggleReference();
    wrap.appendChild(b);

    // Secret seeds — revealed ONLY here, on the last page.
    if (T.secretSeeds && T.secretSeeds.length) {
      const seeds = el('div', 'tut-seeds');
      seeds.innerHTML = `<h3 class="tut-seeds-h">✦ Secret Seeds ✦</h3>
        <p class="tut-seeds-sub">Type one of these into the menu's <b>Custom Seed</b> box for a twist. Our little secret.</p>`;
      const list = el('div', 'tut-seeds-list');
      T.secretSeeds.forEach(([word, desc]) => {
        const row = el('div', 'tut-seed-row');
        row.innerHTML = `<span class="tut-seed-word">${word}</span><span class="tut-seed-desc">${desc}</span>`;
        list.appendChild(row);
      });
      seeds.appendChild(list);
      wrap.appendChild(seeds);
    }

    const b2 = el('button', 'btn tut-finish', '✦ Finish & return to the menu');
    b2.onclick = () => { S.save.done = true; persist(); close(); };
    wrap.appendChild(b2);
    st.appendChild(wrap);
  }

  /* ============================ keyboard + controller ============================ */
  function onKey(e) {
    if (!S.open) return;
    const refOpen = !S.dom.reference.classList.contains('hidden');
    if (e.key === 'Escape') { if (refOpen) { S.dom.reference.classList.add('hidden'); } else if (S.dom.chapters.classList.contains('shown')) { S.dom.chapters.classList.remove('shown'); } else close(); e.preventDefault(); return; }
    if (refOpen) return; // let the search field take arrows/typing
    if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
    if (e.key === 'ArrowRight' || e.key === 'PageDown') { next(); e.preventDefault(); }
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { prev(); e.preventDefault(); }
    else if (e.key === 'Home') { goto(0); e.preventDefault(); }
    else if (e.key.toLowerCase() === 'c') { toggleChapters(); e.preventDefault(); }
    else if (e.key.toLowerCase() === 'r') { toggleReference(); e.preventDefault(); }
  }

  // lightweight gamepad polling — only while the tutorial is open
  function startPad() {
    if (!navigator.getGamepads) return;
    S.pad.active = true;
    function poll() {
      if (!S.pad.active) return;
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      const gp = Array.prototype.find.call(pads, (g) => g);
      if (gp) {
        const ax = gp.axes[0] || 0;
        const dpadL = (gp.buttons[14] && gp.buttons[14].pressed) || ax < -0.6;
        const dpadR = (gp.buttons[15] && gp.buttons[15].pressed) || ax > 0.6;
        const aBtn = gp.buttons[0] && gp.buttons[0].pressed;
        const bBtn = gp.buttons[1] && gp.buttons[1].pressed;
        const now = Date.now();
        if ((dpadR || aBtn) && !S.pad.prevPressed && now - S.pad.last > 260) { next(); S.pad.last = now; }
        else if ((dpadL || bBtn) && !S.pad.prevPressed && now - S.pad.last > 260) { prev(); S.pad.last = now; }
        S.pad.prevPressed = dpadL || dpadR || aBtn || bBtn;
      }
      requestAnimationFrame(poll);
    }
    requestAnimationFrame(poll);
  }

  /* ============================ boot ============================
   * The written guide is launched from the menu's LEARN chooser
   * (main.js wires #learn-read → SO.Tutor.open()); no button binding here. */
  return { open, close, openReference };
})();
