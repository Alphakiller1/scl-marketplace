# SCL Competitive Visual Implementation

This document translates the approved trophy-led concept into production UI. The concept is
art direction, not a screenshot to reproduce. SCL keeps its real navigation, real data, and
existing brand source of truth (`design/SCL-DESIGN-SPEC.md`, `docs/SCL_DESIGN_CONTRACT.md`).

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

Source of truth for roles remains `design/SCL-DESIGN-SPEC.md` v1.1; hexes above sync
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
- Gold is reserved for first place and earned honors in **UI chrome** (not a requirement to
  recolor the hero crown metal — hero metal stays cobalt-lit chrome unless owners revise art).
- Second and third place receive distinct, restrained treatments.
- Verification, sample size, recent form, and streaks stay visible near the result they qualify.

### Atmosphere (hero artwork)

- Generated trophy artwork is limited to the home hero and campaign-scale surfaces.
- Canonical look: **magenta market chart + cobalt sports ambient** with a **simple solid trophy +
  gold crown** (see `docs/SCL_ASSET_MANIFEST.md`). Atmosphere reaches every edge of the hero.
- Trophy stays solid and readable — not ornate/filigree, not a tight close-up.
- Rejected treatments: flat black letterbox voids, over-light sky-cyan grades, purple-only washes
  with no cobalt, single `object-cover` crops that clip the crown/base.

### Home hero compositing stack (back → front)

Implemented in `src/components/scl/competition-hero.tsx`. Layers must stay in this order:

| Z   | Layer                       | Purpose                                                                   |
| --- | --------------------------- | ------------------------------------------------------------------------- |
| 0   | Section ink-950 fallback    | Prevents flash before bitmaps paint                                       |
| 1   | Atmosphere `<picture>` WebP | Original-design bleed (`object-cover`) — dense widen of `a9f20d3`         |
| 2   | Trophy `<picture>` WebP     | Opaque original trophy scene (`object-contain`) — framing left as-is      |
| 3   | L→R ink gradient (light)    | Softens left copy zone without washing out the solid art                  |
| 4   | B→T ink gradient (light)    | Anchors lower edge                                                        |
| 5   | Slide panel (grid-stacked)  | All slides share one cell; opacity crossfade only — no translateY remount |
| 6   | Carousel controls           | Dots / prev-next outside the slide panel so height stays stable           |

**Why two bitmaps:** one `object-fit` cannot both stretch edge-to-edge and keep the full original
trophy scene at a stable size. The bleed layer is derived from the same original art (not a sparse
or translucent overlay). The trophy layer stays opaque RGB — never punched alpha.

**Layer investigation notes (locked):**

1. Scrims are ink overlays only — they must not hue-shift magenta/cobalt art toward pink or sky blue.
2. Slide changes must not remount with `scl-reveal` translateY (that “rumbles” the page). Stack
   slides in one CSS grid cell and fade opacity.
3. Do not punch transparency into the trophy scene or invent sparse chart overlays on top of it.
4. If art feels “too dark,” prefer a **tiny** pixel-level cobalt lift or owner review — never a
   full regrade to electric/sky blue, and never leave a programmatic lighten pass that changes
   the magenta/cobalt identity.

## Responsive composition

- The home hero uses separate landscape and portrait artwork.
- Mobile copy occupies the calm upper / left portion of the portrait asset.
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
