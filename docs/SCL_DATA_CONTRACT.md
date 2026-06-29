# SCL Data Contract

How data is modeled, accessed, and trusted. Pairs with `.cursor/rules/scl-data-model.mdc`.

## Source of truth

Prisma schema at `prisma/schema.prisma`. SCL data lives in the isolated **`scl`** Postgres
schema on Supabase. The `public` schema is a **separate analytics database** — never read or
write it.

## Core entities

- **User** (auth) — email, username, `passwordHash`, `role` (CAPPER/ADMIN),
  `accountStatus` (PENDING/ACTIVE/SUSPENDED/DISABLED), `emailVerified`.
- **CapperProfile** — `headline`, `bio`, `avatarUrl`, `bannerUrl`, `specialties[]`, `sports[]`,
  `betTypes[]`, `dailyVolume`, `writtenAnalysis`, `biggestBetWon`, socials, offering model
  (`providerType` in the current schema), editable default storefront title/description/
  visibility, `isLegacy`.
- **Play** — `sport`, `league`, `market`, `selection`, `oddsAmerican` (int), `units`
  (Decimal, **0.25–5**), `outcome` (PENDING/WIN/LOSS/PUSH/VOID), `profitUnits`, `parlayId`.
- **Parlay** — legs (`Play[]`), `combinedOddsAmerican`, `units`, `outcome`, `profitUnits`.
- **Package** — `title`, `priceCents`, `billingPeriod`, external `checkoutUrl`, offering model
  (`providerType` in the current schema). Storefront provider is a separate Phase 1 concept.
- **TrackingUrl** / **ClickEvent** — package tracking + click capture.
- **GradingAudit** — append-only: `previousOutcome`, `newOutcome`, `source`
  (AUTO/ADMIN_OVERRIDE/MANUAL), `gradedById`, `reason`, timestamp.
- **PasswordResetToken** — hashed, single-use, one-hour recovery token keyed to a user.
- **VerificationToken** — hashed, single-use, 24-hour email-verification token with resend
  cooldown.
- **AccountStatusAudit** — append-only account lifecycle change with actor, prior/new status,
  reason, and timestamp.
- **RequestThrottle** — hashed request/email identity, attempt count, and rolling-window start
  used to enforce persistent abuse limits across server instances.

## Computed/derived (not stored raw)

Win %, ROI, unit profit totals, staked units, settled sample size, cumulative unit trend,
streaks, recent form, rank, rank movement, and trophy eligibility are **derived** from graded
plays. Compute these in `src/lib` (e.g. `src/lib/grading`, `src/lib/leaderboard`) — aggregate in
the DB where possible, never inline in components. Mock shapes live in `src/lib/mock.ts` and
must mirror the eventual query output.

Public leaderboard scope is explicit and URL-driven: sport, time window, sort metric, minimum
settled-pick sample, verification state, and capper search. Public surfaces never substitute
mock metrics when the database is empty or unavailable.

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
