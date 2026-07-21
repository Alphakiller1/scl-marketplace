# Design-layer home schema (structural SoT)

**Status:** structural law for home composition. Supersedes photographic-hero
recipes in `docs/SCL_VISUAL_IMPLEMENTATION.md` for page anatomy. CTA language
remains locked in `MOCKUP_FIDELITY_HOME_CONTRACT.md`.

## First viewport (≥1024)

```
┌─────────────────────────────┬──────────────────────────────┐
│ Copy rail (locked slides)   │ Elevated Live board          │
│ eyebrow · title · body ·    │ SECTION HEAD (pink hairline) │
│ pink CTA · carousel         │ RankBoardTable density=      │
│                             │   snapshot                   │
│                             │ Rank·Capper(+specialty)·     │
│                             │ Sports·Record·ROI·Units·     │
│                             │ Sample·Verified              │
│                             │ (NOT CompactCapperRow)       │
└─────────────────────────────┴──────────────────────────────┘
 Atmosphere = ink + radial only (no WebP trophy plate)
 Grid: copy ~0.9fr · board minmax(26rem, 1.15fr) — board must host schema
```

## Under hero (thin strip only)

```
┌────────────────────────────────────────────────────────────┐
│ What changed today · horizontal ticker chips · Today · ET  │
│ Height ~44–56px. Never a multi-row second board.           │
└────────────────────────────────────────────────────────────┘
```

## Body evidence field

```
┌───────────────────────────────┬────────────────────────────┐
│ Top cappers (RankBoardTable   │ Featured proof receipt     │
│   density=live)               │ Warm paper artifact        │
│ sort: verified share → units  │ + verification context     │
│ window chips → /leaderboard   │                            │
│   ?window=&sort=verified      │                            │
└───────────────────────────────┴────────────────────────────┘
 Then platform activity / CLV / bottom CTA (secondary bands)
```

## Density models (do not cross)

| Surface         | Model                                  | Component                             | Forbidden                                         |
| --------------- | -------------------------------------- | ------------------------------------- | ------------------------------------------------- |
| Hero Live board | Rank-schema table, snapshot density    | `RankBoardTable` via `LiveBoardShell` | CompactCapperRow / soft cards / overlapping proof |
| What Changed    | Horizontal ticker chips (`h-8`/`px-2`) | `WhatChangedToday`                    | Tall headed list / second board                   |
| Top Cappers     | Rank-schema table, live density        | `RankBoardTable` via `TopCappersLive` | Soft avatar list / private table dialect          |
| Featured Proof  | Ticket paper receipt                   | `FeaturedProofReceipt`                | Soft empty card wall without paper shell          |

**One Rank body.** Hero snapshot and Top Cappers share `RankBoardTable` — do not fork column markup.

## Dual-board sorts (intentional)

- Hero snapshot = **units** (board place)
- Top Cappers = **verified share → units** (inspectability)

Do not make both boards the same ranking story. Window chips on Top Cappers
exit to `/leaderboard` preserving **verified** sort (not ROI).

## Deleted / forbidden anatomy

- `HomeEvidenceField` / `HomeLiveBoard` (board‖proof as row 1) — removed
- `HeroBoardCollage` overlapping-proof composition — replaced by `LiveBoardShell`
- Photographic WebP hero plate — ink + radial only
