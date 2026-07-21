# Mockup fidelity contract — Home (owner lock)

**Status:** acceptance law for home visual fidelity work.  
**Owner constraint:** Hero **CTA language is locked verbatim** — do not rewrite eyebrows, titles, bodies, CTAs, or hrefs.

## Locked hero language (do not change)

| Slide    | Eyebrow                 | Title                                     | CTA                 | Href           |
| -------- | ----------------------- | ----------------------------------------- | ------------------- | -------------- |
| founding | Founding Roster Forming | Apply As A Founding Capper                | Track Your Record   | `/signup`      |
| discover | Discover Cappers        | Find & Tail The Best Cappers In The World | Explore Leaderboard | `/leaderboard` |
| verify   | Track & Verify          | Sell, Track, & Verify Your Predictions    | Track Your Record   | `/signup`      |

Bodies remain the three strings currently in `competition-hero.tsx` `SLIDES`.

**Do not** replace titles with mockup marketing lines such as “See whose edge is holding up.”  
**Do not** replace CTAs with “Explore rankings” unless that string already appears in the locked table.

## Mockup composition that MUST match (visual)

### Hero

- Dual-column ≥1024: **copy rail left** · **Leaderboard snapshot board right**
- Left: locked slide stack, Barlow Condensed display (38/40 mobile · 56/56 desktop), pink primary CTA only
- Right: elevated **Leaderboard snapshot** only — **no overlapping graded-proof receipt** in the first viewport (proof lives under the fold)
- Hero height restrained — board shares first viewport; no photographic trophy/hero plate behind the board (ink + subtle radial atmosphere only)
- Carousel controls remain; 44px hit targets

### What changed today

- Full-width thin ticker/strip under hero (pulse + compact moves)
- Not a tall second board competing with Top Cappers

### Top cappers

- Dense **table** (not soft avatar list): Rank · Capper · Sports marks · Record · ROI · Units · Sample · Verified meter
- Header: trophy mark + “Top cappers” + “Ranked by …” + window chips (7D / 30D / 90D / ALL) when data supports it
- Compact rows, hairline dividers, chevron affordance, “View full leaderboard” link
- **No dollar Handle column** (data honesty — units only)

### Featured proof

- Section weight matches mockup: paper receipt as documentary artifact, pink VERIFIED dominant over settlement color
- Blue “View all…” style link, not a soft card wall

### Design layer

- Premium gloss = hairline boards + scanline live panes + elevated paper receipt only
- Chips max compact (`px-2`, `text-[10px]`–`11px`, no wide soft pills)
- Sports as circular marks, not wide `SportTag` text chips in table cells
- Inter tabular on every metric; Barlow Condensed on section titles

## Intentional product overrides (not mockup bugs)

- Follow = blue; Join / Track Your Record = pink
- No fabricated Handle $ or Avg Odds unless a real field exists
- Empty / provisional / failed states stay honest

## Craft micro-rules (home + board chips)

- Window / scope chips: `h-8`, `px-2`, `text-[10px]`, `rounded-[var(--scl-radius-chip)]` — never `rounded-full` soft pills
- Featured proof empty states sit in warm `scl-proof-paper` shell (receipt radius), under the fold only
- Leaderboard desktop rows target ~56px; specialty (or top sport) sits under identity
- League / team logos: **transparent** tiles when a mark image loads — no white boxes, no hairline frames around logos
- Section titles: Barlow Condensed **sentence case** at ~22/26 (`text-[1.375rem] leading-7`); eyebrows stay uppercase Barlow
- Metrics: Inter tabular via `.scl-data` on every numeric column

## Acceptance

- Side-by-side screenshot review at 375 / 768 / 1280 / 1440 dark (+ light smoke)
- Locked slide strings byte-equal to this contract
- No horizontal overflow; AA text; 44px primary controls
- No graded-proof overlay in hero; no white boxes around league logos
