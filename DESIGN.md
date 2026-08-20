# Design — "Made by Connor" comic-book collection

The durable visual decisions behind the hub. Keep new panels inside this system.

## The idea

A **comic-book page**, not a portfolio grid. Every project is a hand-inked **panel**
with a caption box, a speech bubble, and a bold action button. The reader lands on a
sunburst **splash panel**, scans the panels, and hits the button to dive in. A project
goes "live" by setting `data-live="true"` + an `href` on its `<a class="cab">`; the CTA
becomes Play / Open / Install (via `data-kind`).

## Palette

Cream newsprint with Ben-Day halftone; everything outlined in comic ink (near-black).

| Token | Value | Use |
|---|---|---|
| `--paper` | `#f3e6c2` | newsprint background (+ halftone dots) |
| `--panel` | `#fffdf6` | white panel interior |
| `--ink` | `#17130d` | all outlines, shadows, body text |
| `--pop-red` / `--pop-yellow` / `--pop-blue` | `#ff3b3b` / `#ffd23f` / `#2b7fff` | title, caption boxes, focus |

Per-project accents (`--a`, set by `data-accent`): AweCrap `#ff3344`, Metanoia `#2ec46b`,
MTTD `#ff9f1c`, The Counter `#ff4fa3`, DayTrader `#26b3ff`, Home Hub `#9a7bff`,
Ledger `#5b6cff`, ModernTools `#12b3a6`. A panel's screen tint, title fill and action
button all derive from `--a`.

## Type

- **Display:** Bangers (Google Fonts) — the splash title, panel titles, buttons, section
  heads. Rendered "inked": `-webkit-text-stroke` in `--ink` + `paint-order: stroke fill` +
  a hard offset `text-shadow`.
- **Dialogue / body:** Comic Neue 700 — taglines, captions, copy. Italic for emphasis.

## Ink system

- **Outlines:** `--w: 3px` solid `--ink` on panels; `2px` on chips/caption boxes.
- **Depth:** hard offset shadows (`--sh: 7px 7px 0 --ink`, `--sh-lg`, `--sh-sm`) — authentic
  pop-art, not soft blur. Panels lift on hover (shift up-left, shadow grows) and press on
  `:active`.
- **Halftone:** `radial-gradient` dots — on the paper, on panel screens (colored, masked to a
  corner), and washed over the splash sunburst.
- **Splash:** a slowly rotating `repeating-conic-gradient` sunburst behind the title (paused
  under reduced-motion). Emblems are re-inked with a black outline via stacked `drop-shadow`.

## Panel anatomy

Screen (tinted halftone + inked emblem) → caption box (yellow `data-accent` tag) + status →
Bangers title → **speech bubble** tagline (with a CSS tail) → inked stat labels → comic action
button. Bento grid (4-col desktop → 2-col ≤860 → 1-col ≤560).

## Motion

Entrance is one authored moment: panels **ink in** (opacity + blur only — never transform or
shadow, so the `:hover` pop stays free), staggered. All motion gated behind
`prefers-reduced-motion: no-preference`; the page is fully legible static.

## Adding a panel

Copy an `<a class="cab">` block in `index.html`; set `data-accent` (+ a
`.cab[data-accent="x"]{ --a:#hex }` rule in `styles.css`), `data-kind`, `data-live`, `href`;
swap the emblem SVG, tag, title, tagline, stats.
