# SCL Competitive Visual Implementation

This document translates the approved concept renders into production UI. Their hierarchy,
proportions, alignment grid, density, and evidence-first composition are implementation
contracts. Production keeps real navigation, real data, honest empty states, and the current
brand source of truth (`design/SCL-DESIGN-SPEC.md` v2.0). Mature-data examples in the renders
must never be copied as fabricated production data.

## Product read

The experience should communicate three ideas within seconds:

1. SCL is a public ranking system, not a picks feed with decorative stats.
2. Performance is inspectable through record, win rate, units, ROI, sample size, and form.
3. A capper earns status through tracked results.

## Design matrix (color roles)

| Role           | Token / hue                                                       | Used for                                                                | Never used for                                   |
| -------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------ |
| Conviction     | `--scl-pink` (magenta)                                            | Primary CTAs, verified stamps, selected odds, rank medals, slip accents | Nav chrome, passive filters, decorative fills    |
| Navigation     | `--scl-blue` (cobalt)                                             | Active nav/tabs/pills, focus rings, border-strong, chart-2, logo bridge | Primary CTAs, verified stamps                    |
| Atmosphere art | Magenta market chart + cobalt sports ambient + solid trophy/crown | Home hero WebPs only                                                    | Padded letterbox voids; ornate close-up trophies |
| Settlement     | `--scl-win` / `--scl-loss`                                        | Graded W/L only                                                         | Decoration, CTAs, ambient lighting               |
| Ink surfaces   | `--scl-ink-*`                                                     | Page/card/chip depth                                                    | Brand identity                                   |

**Balance rule:** pink is scarce (conviction). Cobalt blue carries chrome so the product does not
read as all-magenta. Do **not** push hero or UI blues into washed sky/electric territory — cobalt
stays deep; only a **slight** lift from the prior grade is allowed when owners ask for “lighter.”

Current chrome blues (exact cobalt baseline — do not drift toward sky/electric):

| Theme | Token     |
| ----- | --------- |
| Dark  | `#105FD9` |
| Light | `#044CB6` |

The photographic hero is a forced-dark campaign surface in both page themes. Its scoped
interaction tokens are `--scl-hero-blue:#6EA8FF` for focus/active marks and
`--scl-hero-pink-text:#FF74C8` for title hover; both exceed 8:1 on hero ink and must not leak
into routine product chrome.

Source of truth for roles remains `design/SCL-DESIGN-SPEC.md` v2.0; hexes above sync
`src/app/globals.css`.

## Visual layers

### Foundation

- Dark-first layered surfaces remain token-driven.
- Page sections are unframed; cards are reserved for repeated cappers, picks, and tools.
- Hairline borders and spacing create depth before glow does.
- Typography stays compact and readable. Large type is reserved for the home hero.

### Data

- Signed performance uses `pos` and `neg`; neutral values use foreground or muted foreground.
- Every performance number uses tabular figures.
- A metric is always paired with a plain-language label.
- Trend graphics supplement the numeric value and never replace it.
- Zero-data, low-sample, and missing-data states remain explicit.

### Competition

- Rank is the first scan target.
- Rank 1–3 use the v2 pink medal treatment. No gold status or rank chrome is permitted.
- Atmospheric crown metal in owner-approved hero artwork is an image-art exception, not a UI
  status token.
- Second and third place receive distinct, restrained pink treatments.
- Verification, sample size, recent form, and streaks stay visible near the result they qualify.

### Atmosphere (hero — superseded)

> **Superseded for home.** Marketing home uses **ink + radial atmosphere only** (no
> photographic WebP plate). See `design/HOME_DESIGN_LAYER_SCHEMA.md` and
> `design/MOCKUP_FIDELITY_HOME_CONTRACT.md`. Campaign-scale artwork elsewhere may still
> use magenta/cobalt trophy assets from the manifest — not as the live home hero plane.

### Home hero compositing stack (current)

Implemented in `src/components/scl/competition-hero.tsx` + `live-board-shell.tsx`.

| Z   | Layer                       | Purpose                                                            |
| --- | --------------------------- | ------------------------------------------------------------------ |
| 0   | Theme-independent hero ink  | Prevents flash and keeps campaign copy AA-safe in both page themes |
| 1   | Soft pink / blue radials    | Brand atmosphere without photographic plate                        |
| 2   | Dual-column grid            | Copy rail + elevated Rank-schema Live board (`LiveBoardShell`)     |
| 3   | Unboxed grid-stacked slides | Locked CTA language; opacity-only swaps prevent layout movement    |
| 4   | Carousel controls           | Dots and arrows outside slide content                              |

**Do not:** reintroduce WebP trophy plate; use `CompactCapperRow` in the hero board; overlay Featured Proof on the snapshot; fork a second Rank table dialect for Top Cappers.

**Layer investigation notes (locked):**

1. Board rail width must host Rank-schema columns — prefer board share over copy (`minmax(26rem,1.15fr)`).
2. Slide changes must not remount with `scl-reveal` translateY. Stack slides in one CSS grid cell and fade opacity.
3. One Rank body: `RankBoardTable` for hero snapshot and Top Cappers.

## Responsive composition

- The home hero uses ink + radial atmosphere with a dual-column Rank-schema Live board (see `design/HOME_DESIGN_LAYER_SCHEMA.md`).
- Mobile copy sits above the board stack; board is full-width below the copy rail.
- Leaderboards use full rows at `md` and purpose-built ranked cards below `md`.
- Filters remain operable at 375px with 40px minimum controls and no horizontal page overflow.
- Fixed chart and rank dimensions prevent data changes from shifting layout.

## Data integrity

- Public metrics come from Prisma-backed plays.
- No concept-art totals, fake users, or fabricated growth lines appear in production.
- Ranking scope is visible through sport, time window, minimum-pick, verification, and sort
  controls.
- Public picks are labeled from available source fields. Missing event-time data is not inferred.

## Implementation order

1. Responsive artwork and home hero.
2. Rank badge, performance sparkline, metric band, and leaderboard filter primitives.
3. Live leaderboard rows and mobile cards.
4. Home command center, capper directory, public profile, dashboard, picks, and storefront.
5. Responsive, accessibility, performance, and browser QA.

## Acceptance standard

- A first-time visitor can explain what SCL ranks and why the records are credible.
- A returning user can compare cappers without decoding jargon.
- Every displayed statistic is real or explicitly unavailable.
- Desktop and mobile preserve the same decision hierarchy.
- The experience remains fast and useful after the visual artwork is removed.
- Hero still reads as **magenta + cobalt** after any “lighten blue” request.
