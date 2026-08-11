# Design — "Made by Connor" arcade hub

The durable visual decisions behind the hub. Keep new cabinets inside this system.

## The idea

A neon **arcade hall**, not a portfolio grid. Every project is a lit **cabinet**
you walk up to and press **PLAY**. Cabinets start `OFFLINE` (red LED, *Insert coin*)
and switch `ONLINE` (green LED, *Play*) when a project is plugged into the repo, so
the arcade visibly fills up over time. Full neon always — only the LED colour and the
button copy carry the online/offline state.

## Palette

Deep purple-black hall; each cabinet owns one saturated neon accent.

| Token | Value | Use |
|---|---|---|
| `--bg` / `--bg-2` | `#0a0710` / `#0f0a18` | hall background |
| `--panel` / `--panel-2` | `#140d20` / `#180f26` | cabinet body |
| `--ink` / `--ink-dim` / `--ink-mute` | `#f6f1ff` / `#cdbfe4` / `#9d8cbb` | text (all ≥4.5:1 on panel) |
| `--coin` | `#ffd23f` | shared chrome: marquee "MADE BY", insert-coin chip, footer mark |

Per-project accents (`--a`, set by `data-accent`):

| Cabinet | `data-accent` | Accent |
|---|---|---|
| AweCrap | `awecrap` | `#ff3b5c` red |
| Metanoia | `metanoia` | `#37e29a` green |
| MTTD | `mttd` | `#ffb02e` amber |
| The Counter | `counter` | `#ff5cae` magenta |
| DayTrader | `daytrader` | `#25d0ff` cyan |
| Home Hub | `homehub` | `#9b8cff` violet |

A cabinet themes itself entirely from `--a` via `color-mix` — border, screen glow,
tags, stats, and the physical PLAY button all derive from that one colour.

## Type

- **Display:** Bungee (Google Fonts) — marquee, cabinet titles, buttons, toast.
- **Body / UI:** Archivo (400–900) — taglines, tags, chips.
- No gradient text; emphasis comes from weight, size and neon glow (`text-shadow`).

## Structure

Asymmetric **bento** wall (`.wall`), not uniform cards:

- Desktop (4 cols): AweCrap 2×2 flagship · Metanoia 2×1 · MTTD 1×1 · The Counter 1×2 · DayTrader 2×1 · Home Hub 1×1.
- ≤860px: 2 columns. ≤560px: single column.

Each cabinet = a **screen** (authored pixel-style SVG emblem on a scanline CRT panel)
+ a **plate** (tag, title, tagline, stat chips) + **controls** (a physical PLAY button
with a 3D press shadow, and a status LED). Icons are authored SVG in one chunky, filled,
accent+white style — never emoji.

## Motion

One authored **power-on**: the marquee flickers on like neon, cabinets focus in
(opacity + blur, never transform, so the hover lift stays free), staggered. Hover lifts
the cabinet, blooms its neon edge, sweeps a glare across the screen and nudges the arrow.
A perspective floor grid scrolls slowly. All motion is gated behind
`prefers-reduced-motion: no-preference`; the page is fully legible and static without it.

## Adding a cabinet

See the comment block above `.wall` in `index.html`. New accents get a
`.cab[data-accent="x"]{ --a:#hex }` rule in `styles.css`; everything else follows.
