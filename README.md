# Made by Connor — the arcade

A single-page hub for everything Connor Corkum has built. It's styled as a neon
**arcade hall**: every project is a lit cabinet you walk up to and press **PLAY**.
Cabinets start `OFFLINE` (red LED, *Insert coin*) and switch `ONLINE` (green LED,
*Play*) the moment you plug a project into the repo — so the arcade fills up as
projects are added one at a time.

Plain static site — **HTML, CSS, a little JS, no build step**. Open `index.html`
directly, or serve the folder.

## The cabinets

| Cabinet | What it is |
|---|---|
| **AweCrap** | Roguelike deckbuilder × casino craps — 5 acts, 127 cards, 5 bosses |
| **Metanoia** | A quiet narrative game about noticing; a grey day blooms back to colour |
| **MTTD** | Desktop music player — five era-authentic machines that control Spotify |
| **The Counter** | Offline PWA: snap the fridge list → on-device OCR → deli-ticket shopping board |
| **DayTrader** | A small, honest day-trading bot (backtest · paper · live) |
| **Home Hub** | Personal dashboard — time, weather, tasks, groceries, ambient TV mode |

## Plugging a project in

As each project is added to the repo, do three things to its cabinet in
[`index.html`](index.html):

1. Copy the project's site into a subfolder here — e.g. `metanoia/` — containing an `index.html`.
2. On that cabinet's `<a class="cab" …>` tag, set `data-live="true"`.
3. Set its `href` to the folder, e.g. `href="metanoia/"`.

The LED turns green, the button becomes **Play**, and the "online" counter ticks up.
(For desktop/CLI projects like MTTD and DayTrader, point `href` at a download or a
code link instead of a local folder.)

Adding a **new** cabinet: copy any `<a class="cab">` block, give it a `data-accent`
(add a colour in [`styles.css`](styles.css) if it's a new one), and swap the emblem,
title, tagline and stats.

## Files

- `index.html` — the page and all six cabinets
- `styles.css` — the arcade look (colours, layout, motion)
- `main.js` — online counter + "insert coin" toast (progressive enhancement)
- `favicon.svg` — the coin-gold **C** mark
- `.nojekyll` — tells GitHub Pages to serve the files as-is

## Publishing on GitHub Pages

Push this repo to GitHub, then in **Settings → Pages** choose **Deploy from a
branch** → `main` / `root`. It'll be live at `https://<username>.github.io/<repo>/`.
