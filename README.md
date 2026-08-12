# Made by Connor — the arcade

A single-page hub for everything Connor Corkum has built, styled as a
**comic-book page**: every project is a hand-inked panel you press to launch. Plain
static site — **HTML, CSS, a little JS, no build step**.

The whole site sits behind a **password gate** (shown on entry and on every refresh;
see *Security* below), and it's published on **GitHub Pages** →
`https://cjcx3.github.io/HomePage/`.

## The cabinets

| Cabinet | What it is | Button |
|---|---|---|
| **AweCrap** | Roguelike deckbuilder × casino craps — 5 acts, 127 cards, 5 bosses | Play → `awecrap/` |
| **Metanoia** | A quiet narrative game about noticing | Play → `metanoia/` |
| **The Counter** | Offline PWA: fridge photo → on-device OCR → deli-ticket board | Open → `the-counter/` |
| **Home Hub** | Personal dashboard — time, weather, tasks, groceries | Open → `home-hub/` |
| **MTTD** | Desktop music player (Electron) that controls Spotify | Install → `mttd/` |
| **DayTrader** | A small, honest day-trading bot | Install → `daytrader/` |

The two desktop/CLI projects have their own install pages (download + instructions +
what the project is for). Their downloads are hosted as **GitHub Releases**, not in
the repo:

- **MTTD installer** → release `mttd-v1.0.0` (79 MB Windows installer).
- **AweCrap audio** → release `awecrap-audio-v1`; the web game streams its music from
  there so the 177 MB of mp3s stay out of the repo. Without it the game runs silent.
- **DayTrader source** → `daytrader/daytrader-source.zip` (code only, no keys).

## Security

- **Password gate** — [`gate.js`](gate.js) is included on every page. On first visit it
  shows a full-screen prompt; the password is stored only as a SHA-256 **hash** (no
  plaintext in the source) and checked in-browser via `crypto.subtle` (needs HTTPS,
  which Pages provides). Unlock is remembered for the session.
  > This is a *soft* barrier, not real security: anyone can read a public site's source
  > or this repo. The real protection is that **no sensitive data is published** —
  > Home Hub's source was scrubbed of personal IPs, location, and identifiers, and
  > DayTrader's zip carries no `.env`/keys. To make it genuinely private, host from a
  > private repo instead.
- Change the password by replacing the `HASH` constant in `gate.js` with the SHA-256 of
  the new password (`printf '%s' 'NEWPASS' | sha256sum`).

## Add or change a cabinet

Each cabinet is an `<a class="cab" …>` block in [`index.html`](index.html) with
`data-accent`, `data-kind` (`play` / `open` / `install`), `data-live`, and an `href`.
Copy a block, swap the emblem SVG, title, tagline and stats; add a colour rule
`.cab[data-accent="x"]{ --a:#hex }` in [`styles.css`](styles.css) for a new accent.

## Editing a project

Each web project has **two copies**: the *source* you develop (a full app, in the
workspace folder next to this repo) and the trimmed *web copy* that ships here and gets
served. Edit the source, then run one command to rebuild the shipped copies:

```bash
node scripts/sync.mjs            # all projects   (or e.g. node scripts/sync.mjs the-counter)
```

It rebuilds `awecrap/ metanoia/ the-counter/ home-hub/` from their sources and
re-applies every deploy transform automatically — injecting the password gate,
rewriting AweCrap's music to the GitHub Release, and scrubbing Home Hub's personal/network
data — so you never hand-edit a shipped copy. Review with `git status`, then commit.
`node scripts/sync.mjs --list` prints the source→dest mapping. (MTTD and DayTrader are
hand-written install pages, not built from a source app, so they aren't synced.)

## Files

- `index.html` · `styles.css` · `main.js` — the hub (six cabinets, online counter, toast)
- `gate.js` — the site password gate
- `awecrap/` · `metanoia/` · `the-counter/` · `home-hub/` — the playable web builds
- `mttd/` · `daytrader/` — install pages
- `favicon.svg` — the coin-gold **C** mark · `.nojekyll` — serve files as-is on Pages

## Publishing on GitHub Pages

**Settings → Pages → Deploy from a branch → `main` / `root`.**
Live at `https://cjcx3.github.io/HomePage/`.
