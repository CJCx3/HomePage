# Made by Connor — the collection

A single-page hub for everything Connor Corkum has built, styled as a
**comic-book page**: every project is a hand-inked panel you press to launch. Plain
static site — **HTML, CSS, a little JS, no build step**. Published on **GitHub Pages** →
`https://cjcx3.github.io/HomePage/`.

## The panels

| Panel | What it is | Button |
|---|---|---|
| **AweCrap** | Roguelike deckbuilder × casino craps — 5 acts, 127 cards, 5 bosses | Play → `awecrap/` |
| **Metanoia** | A quiet narrative game about noticing | Play → `metanoia/` |
| **The Counter** | Offline PWA: fridge photo → on-device OCR → deli-ticket board | Open → `the-counter/` |
| **Ledger** | Private, offline budgeting — envelopes, reports, net worth | Open → `ledger/` |
| **Home Hub** | Personal dashboard — time, weather, tasks, groceries | Open → `home-hub/` |
| **ModernTools** | Modern Exteriors field sales tools — financing, templates, quotes | Open → `moderntools/` |
| **MTTD** | Desktop music player (Electron) that controls Spotify | Install → `mttd/` |
| **DayTrader** | A small, honest day-trading bot | Install → `daytrader/` |

The two desktop/CLI projects have their own install pages (download + instructions +
what the project is for). Their downloads are hosted as **GitHub Releases**, not in
the repo:

- **MTTD installer** → release `mttd-v1.0.0` (79 MB Windows installer).
- **AweCrap audio** → release `awecrap-audio-v1`; the web game streams its music from
  there so the 177 MB of mp3s stay out of the repo. Without it the game runs silent.
- **DayTrader source** → `daytrader/daytrader-source.zip` (code only, no keys).

## Privacy

This is a **public** site — anything shipped here is readable by anyone, so the
protection is simply that **no sensitive data is published**:

- Home Hub's source is **scrubbed** of personal IPs, location, and identifiers on every
  sync (see the `homehubScrub` transform in `scripts/sync.mjs`).
- The DayTrader zip carries no `.env`/keys.

(There is no password gate. To make the whole thing genuinely private instead, host it
from a private repo.)

## Add or change a panel

Each panel is an `<a class="cab" …>` block in [`index.html`](index.html) with
`data-accent`, `data-kind` (`play` / `open` / `install`), `data-live`, and an `href`.
Copy a block, swap the emblem SVG, title, tagline and stats; add a colour rule
`.cab[data-accent="x"]{ --a:#hex }` and place it in the `grid-template-areas` in
[`styles.css`](styles.css) (desktop + both breakpoints).

## Editing a project

Most panels have **two copies**: the *source* you develop (a full app, in the workspace
folder next to this repo) and the trimmed *web copy* that ships here. Edit the source,
then run one command to rebuild the shipped copies:

```bash
node scripts/sync.mjs            # all projects   (or e.g. node scripts/sync.mjs the-counter)
```

It rebuilds the shipped copies from their sources and re-applies every deploy transform
automatically — rewriting AweCrap's music to the GitHub Release and scrubbing Home Hub's
personal data — so you never hand-edit a shipped copy. Review with `git status`, then
commit. `node scripts/sync.mjs --list` prints the source→dest mapping. (MTTD and DayTrader
are hand-written install pages, not built from a source app, so they aren't synced.)

## Files

- `index.html` · `styles.css` · `main.js` — the hub (panels, online counter, toast)
- `awecrap/` · `metanoia/` · `the-counter/` · `ledger/` · `home-hub/` · `moderntools/` — the web builds
- `mttd/` · `daytrader/` — install pages
- `scripts/sync.mjs` — rebuilds the web builds from their sources
- `favicon.svg` — the coin-gold **C** mark · `.nojekyll` — serve files as-is on Pages

## Publishing on GitHub Pages

**Settings → Pages → Deploy from a branch → `main` / `root`.**
Live at `https://cjcx3.github.io/HomePage/`.
