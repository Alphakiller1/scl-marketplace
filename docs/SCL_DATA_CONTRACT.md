# SCL Data Contract

How data is modeled, accessed, and trusted. Pairs with `.cursor/rules/scl-data-model.mdc`.

## Source of truth

Prisma schema at `prisma/schema.prisma`. SCL data lives in the isolated **`scl`** Postgres
schema on Supabase. The `public` schema is a **separate analytics database** — never read or
write it.

## Core entities

- **User** (auth) — email, username, `passwordHash`, `role` (CAPPER/ADMIN), `emailVerified`.
- **CapperProfile** — `headline`, `bio`, `avatarUrl`, `specialties[]`, `sports[]`,
  `betTypes[]`, `dailyVolume`, `writtenAnalysis`, `biggestBetWon`, socials, `providerType`,
  `isLegacy`.
- **Play** — `sport`, `league`, `market`, `selection`, `oddsAmerican` (int), `units`
  (Decimal, **0.25–5**), `outcome` (PENDING/WIN/LOSS/PUSH/VOID), `profitUnits`, `parlayId`.
- **Parlay** — legs (`Play[]`), `combinedOddsAmerican`, `units`, `outcome`, `profitUnits`.
- **Package** — `title`, `priceCents`, `billingPeriod`, external `checkoutUrl`, `providerType`.
- **TrackingUrl** / **ClickEvent** — package tracking + click capture.
- **GradingAudit** — append-only: `previousOutcome`, `newOutcome`, `source`
  (AUTO/ADMIN_OVERRIDE/MANUAL), `gradedById`, `reason`, timestamp.

## Computed/derived (not stored raw)

Win %, ROI, unit profit totals, streaks, recent form, rank, rank movement, and trophy
eligibility are **derived** from graded plays. Compute these in `src/lib` (e.g.
`src/lib/grading`, `src/lib/leaderboard`) — aggregate in the DB where possible, never inline
in components. Mock shapes live in `src/lib/mock.ts` and must mirror the eventual query output.

## Money & odds rules

- American odds are integers (`-110`, `+150`). Payout math centralized in `src/lib/grading`.
- Units are `Decimal(10,2)`, standardized to **0.25–5** (enforced in Zod; see
  `src/lib/constants.ts`). This keeps cappers comparable.
- Parlays: lose if any leg loses; push/void legs drop from the parlay.

## Access rules

- Prisma is **server-only** via `@/lib/prisma`. Never expose it to the client.
- Mutations via Server Actions; webhooks/callbacks via Route Handlers.
- Validate every input with Zod, re-checked server-side before writes.
- Grading writes an audit row every time; audit is append-only, never deleted.

## Integrity

- Migrations only touch `scl`; after any migration confirm `public` table count is unchanged.
- Leaderboard timeframes/sorts and the sports taxonomy come from `src/lib/constants.ts`
  (1:1 with the legacy platform).
