# SCL Competitive Visual Implementation

This document translates the approved trophy-led concept into production UI. The concept is
art direction, not a screenshot to reproduce. SCL keeps its real navigation, real data, and
existing brand source of truth.

## Product read

The experience should communicate three ideas within seconds:

1. SCL is a public ranking system, not a picks feed with decorative stats.
2. Performance is inspectable through record, win rate, units, ROI, sample size, and form.
3. A capper earns status through tracked results.

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
- Gold is reserved for first place and earned honors.
- Second and third place receive distinct, restrained treatments.
- Verification, sample size, recent form, and streaks stay visible near the result they qualify.

### Atmosphere

- The generated trophy artwork is limited to the home hero and campaign-scale surfaces.
- Data routes favor density, speed, and clear comparisons.
- Magenta and blue edge lighting supports brand identity without turning the interface into a
  casino or crypto dashboard.
- Decorative motion is excluded. Interaction and status changes may use subtle motion that
  respects reduced-motion preferences.

## Responsive composition

- The home hero uses separate landscape and portrait artwork.
- Mobile copy occupies the calm upper portion of the portrait asset.
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
