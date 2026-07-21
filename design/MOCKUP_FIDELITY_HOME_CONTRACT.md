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

**Structural SoT:** `design/HOME_DESIGN_LAYER_SCHEMA.md` (one `RankBoardTable`, dual sorts, no photo plate).

### Hero

- Dual-column ≥1024: **copy rail left** · **Leaderboard snapshot board right**
- Left: locked slide stack, Barlow Condensed display (38/40 mobile · 56/56 desktop), pink primary CTA only
- Right: elevated **Leaderboard snapshot** as **Rank-schema dense table** (`RankBoardTable` density=`snapshot`) — **not** soft `CompactCapperRow` résumé rows; **no overlapping graded-proof receipt** in the first viewport (proof lives under the fold)
- Capper cell includes specialty (or top sport) under identity — same Rank anatomy as full board
- Hero height restrained — board shares first viewport; grid favors board width (`minmax(26rem,1.15fr)`); ink + subtle radial atmosphere only (no photographic trophy plate)
- Carousel controls remain; 44px hit targets

### What changed today

- Full-width thin ticker/strip under hero (pulse + compact `h-8`/`px-2` chips)
- Not a tall second board competing with Top Cappers

### Top cappers

- Dense **table** via shared `RankBoardTable` density=`live` (not soft avatar list; not a private table dialect): Rank · Capper · Sports marks · Record · ROI · Units · Sample · Verified meter
- Header: trophy mark + “Top cappers” + “Ranked by …” + window chips (7D / 30D / 90D / ALL) that open `/leaderboard?window=…&sort=verified` (honest to this surface’s sort)
- Compact rows (~56px), hairline dividers, chevron affordance, “View full leaderboard” link
- **No dollar Handle column** (data honesty — units only)

### Featured proof

- Section weight matches mockup: paper receipt as documentary artifact, pink VERIFIED dominant over settlement color
- Blue “View all…” style link, not a soft card wall

### Design layer

- Premium gloss = hairline boards + scanline live panes + elevated paper receipt only
- Chips max compact (`px-2`, `text-[10px]`–`11px`, no wide soft pills)
- Sports as circular marks, not wide `SportTag` text chips in table cells
- Inter tabular on every metric; Barlow Condensed on section titles
- Forbidden: `HomeEvidenceField` board‖proof row-1 anatomy; overlapping-proof collage; WebP hero plate

## Intentional product overrides (not mockup bugs)

- Follow = blue; Join / Track Your Record = pink
- No fabricated Handle $ or Avg Odds unless a real field exists
- Empty / provisional / failed states stay honest

## Craft micro-rules (home + board chips)

- Window / scope chips: `h-8`, `px-2`, `text-[10px]`, `rounded-[var(--scl-radius-chip)]` — never `rounded-full` soft pills
- Featured proof empty states sit in warm `scl-proof-paper` shell (receipt radius), under the fold only
- Leaderboard desktop rows target ~56px; specialty (or top sport) sits under identity
- League / team logos: **transparent** tiles when a mark image loads — no white boxes, no hairline frames around logos
- Section titles: Barlow Condensed **Title Case** at ~22/26 (`text-[1.375rem] leading-7`); eyebrows stay uppercase Barlow (CSS)
- Premium gloss = `.scl-elevated` (hairline + card shadow) + solid ink boards + scanline on Live panes — **no** `backdrop-blur` glass
- Metrics: Inter tabular via `.scl-data` on every numeric column
- Home UI copy (titles, CTAs, empty-state titles, helpers, filter labels): **Title Case** every word. Locked hero slide **bodies** stay as locked sentence case. Eyebrows remain CSS-uppercase accents.

## Acceptance

- Side-by-side screenshot review at 375 / 768 / 1280 / 1440 dark (+ light smoke)
- Locked slide strings byte-equal to this contract
- No horizontal overflow; AA text; 44px primary controls
- No graded-proof overlay in hero; no white boxes around league logos
