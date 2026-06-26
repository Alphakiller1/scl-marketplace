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

## Phase 2 follow-up

A **profile claim flow** (let a real capper take ownership of their imported
handle, set a password, and continue posting) is deferred to Phase 2. See the
Phase 2 parking lot.
