# Legacy Capper Migration

Imports cappers from the previous SCL platform (sportscappersleaderboard.com)
into the new `scl` schema as **public, claimable profiles**, flagged
`isLegacy = true` so their provenance is shown honestly on every surface.

No schema migration is required — it reuses the existing `User`,
`CapperProfile` (`isLegacy`), and `Play` models.

## What it creates

For each record the importer upserts:

- a **`User`** (`role: CAPPER`, **no password** — unclaimed until the Phase 2
  claim flow; `emailVerified` set only when `verified: true`). `username`
  becomes the public `/cappers/[handle]` slug.
- a **`CapperProfile`** with `isLegacy: true` plus headline/bio/sports/socials.
- the capper's **historical `Play` rows** (only if the profile has none yet).

Imported cappers appear on the live leaderboard, directory, and profile pages
with a **"Legacy"** badge. Their stats are computed from the imported plays by
the same `computeCapperStats` used for native cappers — nothing is fabricated.

## Input format

A JSON array of capper records. See [`prisma/legacy-cappers.example.json`](../prisma/legacy-cappers.example.json)
for a complete example; the contract lives in
[`src/lib/schemas/legacy-import.schema.ts`](../src/lib/schemas/legacy-import.schema.ts).

| Field                                                   | Required | Notes                                            |
| ------------------------------------------------------- | -------- | ------------------------------------------------ |
| `username`                                              | ✅       | 3–30 chars, `[a-zA-Z0-9_]`; the public handle    |
| `displayName`                                           | ✅       | shown name                                       |
| `email`                                                 | —        | defaults to `username@legacy.scl` (placeholder)  |
| `verified`                                              | —        | `true` marks the imported record verified        |
| `headline`, `bio`, `avatarUrl`                          | —        | profile copy                                     |
| `sports`, `specialties`, `betTypes`                     | —        | arrays                                           |
| `providerType`                                          | —        | `FREE` \| `PREMIUM` \| `HYBRID` (default `FREE`) |
| `instagram`, `twitter`, `facebook`, `tiktok`, `website` | —        | handles/URL                                      |
| `plays[]`                                               | —        | historical plays (see below)                     |

Each play: `sport`, `market`, `selection`, `oddsAmerican` (int), `units`
(positive), `outcome` (`WIN`/`LOSS`/`PUSH`/`VOID`/`PENDING`), optional
`profitUnits` (computed from odds/units when omitted), optional `gradedAt` /
`createdAt` (ISO dates).

## Running it

The importer writes to whatever database `DATABASE_URL` points at, so be
deliberate about the target.

```bash
# 1. Put the real export at prisma/legacy-cappers.json (gitignored), or pass a path.
npm run db:import-legacy -- path/to/legacy-cappers.json
```

- **Idempotent:** re-running upserts profiles and skips play insertion for any
  capper that already has plays.
- **Validation:** the whole file is validated first; on failure it prints the
  errors and exits non-zero without writing.
- **Per-record resilience:** a single failing record (e.g. a username clash) is
  reported and skipped; the rest still import.

> ⚠️ **Production note.** Per the "honest production" decision
> ([OWNER_DECISIONS](../../SCL/_phase1-notes/OWNER_DECISIONS.md)), only import
> **real** legacy data into production. The demo seed (`@scl.demo`) is for local
> /preview only. Because the local `.env` currently points at the production
> pooler, run imports against the intended database deliberately.

## Extracting from the raw cPanel export

`scripts/extract-legacy-mysql.py` converts the legacy MySQL dumps straight into
both import files, so nothing is hand-transcribed:

```bash
python scripts/extract-legacy-mysql.py   --site        ~/Downloads/scleaderboard_sclsite.sql   --records     ~/Downloads/scleaderboard_sclsite_records.sql   --out         prisma/legacy-cappers.json   --records-out prisma/legacy-records.json
```

Two things about the source data are worth knowing before trusting the output:

**Stakes.** Legacy `Units` is the amount played _to win_, not the amount risked.
The real stake is `urisk` (it equals risk-to-win(Units, odds) on 4432/4433 rows)
and realized profit is `uret` (`-urisk` on 100% of losses). The extractor maps
`units <- urisk` and `profitUnits <- uret`. Reading `Units` as the stake would
understate every favorite's risk and inflate ROI across the board.

**History depth.** The old platform pruned individual picks on a rolling 90-day
basis — `stats90` accounts for exactly the number of surviving pick rows. Only
~16% of its recorded history has pick-level detail; the rest survives only as
the stored totals described below.

## Carried-over records (aggregate totals)

`LegacyRecord` holds the totals the old platform kept after pruning the picks
behind them, so a capper's history still counts toward their standing.

```bash
# Run AFTER db:import-legacy — records attach to profiles it creates.
npm run db:import-legacy-records -- prisma/legacy-records.json
```

Scope names in the legacy database are misleading and were decoded against the
live site: `stats1` is the current **year** (not one day) and drives
current-year.php; `stats_current` is the current **season** and drives
current-season.php.

**`PRE_IMPORT` is the only scope that affects standings.** It is the legacy
season total _minus_ the plays imported as real `Play` rows, so adding it to
computed stats reproduces the legacy season total without counting the ~90 days
present in both. Verified across all 84 cappers at extraction time.

Where it applies:

- **All-time** leaderboard, public profile, and Discover's base summary — yes.
- **Trailing windows** (7d/30d/90d), Discover's windowed and specialty lanes —
  no. Those are about current form, and the legacy figures are a frozen snapshot
  from the export date.
- **Form, streak, and performance trend** stay play-derived everywhere. The
  export carries totals with no per-pick sequence, so seeding them would invent
  a shape the source never had.

The importer refuses to attach records to a profile that is not `isLegacy`, so
carried-over totals can never inflate a natively-grown capper. Surfaces that
include them render the `Legacy` badge with the carried count.

## Phase 2 follow-up

A **profile claim flow** (let a real capper take ownership of their imported
handle, set a password, and continue posting) is deferred to Phase 2. See the
Phase 2 parking lot.
