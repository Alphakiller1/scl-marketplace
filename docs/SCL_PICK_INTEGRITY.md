# SCL Pick Integrity — Strict Selection & Anti-Misrepresentation

The leaderboard is only worth ranking if every record reflects **real, pre-game calls** — not
hindsight, not edited-down losers, not vague picks reinterpreted after the result. This defines
the strict pick-selection process and the controls that enforce it. Pairs with
[`SCL_DATA_CONTRACT.md`](SCL_DATA_CONTRACT.md) and the verification tiers in
[`SCL_MILESTONE2_SPORTSDATANOW_LEARNINGS.md`](SCL_MILESTONE2_SPORTSDATANOW_LEARNINGS.md).

## Principle

**A pick is a claim about the future, locked before the event, resolvable to exactly one
outcome, and never altered afterward.** Strict, but not hostile: honest cappers should submit in
seconds with clear errors; only the paths that enable lying are closed.

The product ethos is already stated in the seed copy — _"posted before tip-off, graded, no
deleted losses, no fake records."_ This doc makes it enforceable rather than aspirational.

## Threat model — how a capper can misrepresent, and the control that closes it

| #   | Misrepresentation                                                                                       | Current gap                                                  | Control                                      |
| --- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | -------------------------------------------- |
| T1  | **Hindsight / backdating** — log a pick after the game started (or after it's clearly winning)          | `Play` has `createdAt` but no event start to compare against | **Pre-game lock** (C1) + `eventStartsAt`     |
| T2  | **Vague selection** — free-text "Lakers" reinterpreted favorably post-result; also can't be auto-graded | `market`/`selection` are free strings                        | **Structured, event-bound selection** (C2)   |
| T3  | **Odds/line inflation** — claim +150 when the real price was −110 to fake ROI                           | `oddsAmerican` is unvalidated free input                     | **Line/odds verification** (C3)              |
| T4  | **Delete losers / edit to hide** — quietly remove or rewrite losing picks                               | no capper edit/delete path today, but it's not _guaranteed_  | **Formal immutability** (C4)                 |
| T5  | **Selective logging** — only record winners that were posted elsewhere                                  | manual entry has no provenance                               | **Provenance + pre-game lock** (C5)          |
| T6  | **Duplicate / hedge gaming** — log the same side twice, or bet both sides, to fish win%                 | no dedup / contradiction check                               | **Dedup + hedge handling** (C6)              |
| T7  | **Result laundering** — reclassify a loss as PUSH/VOID                                                  | grading is auditable but sourcing isn't fixed                | **Official-only grading** (C7)               |
| T8  | **Spam/volume manipulation** — flood tiny throwaway picks to shape a stat                               | rate-limit exists but unused here                            | **Submission throttle + sample floors** (C8) |

## Controls

### C1 · Pre-game submission lock (the keystone)

**Status (M2):** wired in `createPlay` via the pure `decidePickIntegrity` gate (`src/lib/odds-verify.ts`,
unit-tested). The server derives the lock from its own clock (`now` vs. `eventStartsAt`) — the
client-supplied start time is never trusted.

- A pick MUST be submitted **strictly before** its event's scheduled start (with a small
  clock-skew buffer, e.g. lock at `eventStartsAt`). Submissions at/after start are **rejected**,
  not silently downgraded.
- Store `submittedAt` (= `createdAt`) and `eventStartsAt`; derive `loggedPreGame`.
- Only `loggedPreGame` picks are eligible for the **verified leaderboard**. A late pick can exist
  on a profile but is `SELF-REPORTED` and excluded from headline ranking.
- **Fairness:** the error is explicit — _"This game started 6 minutes ago; picks lock at start
  time."_ No ambiguity about why it failed.

### C2 · Structured, event-bound selection (no free-text picks)

**Status (M2 — MANDATORY):** verification is now the universal standard. The board selector
(`OddsAssist`) loads the live slate (Today/Tomorrow) and, on tap, binds the pick to a real event —
carrying `eventId`, `eventStartsAt`, structured `side`, `line`, and (for props) `player` through to
`createPlay`. Free-text manual entry has been **retired**: `createPlay` rejects any pick lacking
`eventId` + `eventStartsAt` + `side` server-side (defence in depth — the UI removed the manual path,
but the server never trusts that). The board covers **moneyline/spread/total, alternate
spreads/totals, and curated player props** (alt lines + props load lazily per event, reusing the
cached verification fetch); anything the board doesn't cover simply can't be posted until the board
covers it. Still open: a typeahead/search for large prop slates, and widening the curated prop set
per sport.

- Every pick binds to a **real scheduled event** from an official schedule source (event id,
  teams, start time) — not typed free text.
- `selection` becomes a **structured `{ market, side, line }`** chosen from that event's real
  markets (e.g. `spread / LAL / -3.5`, `total / over / 8.5`, `moneyline / LAL`), resolving to
  **exactly one gradeable outcome**.
- This simultaneously kills T2 (ambiguity), enables reliable auto-grading, and is the anchor for
  C3 (line verification).
- **Fairness:** the board is fast (Today/Tomorrow, tap a price). A market the board doesn't carry
  can't be posted until we add it — the deliberate tradeoff for one honest standard applied to
  everyone.

### C3 · Line & odds verification (game lines + alt lines + props)

**Status (M2):** wired in `createPlay` — on the event-bound path it calls `verifyPick` and feeds the
result into `decidePickIntegrity` (rejected → hard-fail; verified → eligible for VERIFIED tier;
unverifiable → `SELF-REPORTED`). Implemented as pure logic in `src/lib/odds-verify.ts` (unit-tested),
plus a server fetch in `src/lib/odds-api.ts` (`verifyPick` / `fetchEventOddsForVerification`).

- **One-sided bound, in implied-probability space.** Fraud is always claiming a price _better_
  than was obtainable; a capper has no incentive to claim a worse one. So we don't match a
  "correct" price — we bound how good it could be: **accept iff `claimedImplied ≥ bestAvailableImplied − tolerance`.**
  Compare in implied-prob (American odds are non-linear; +100→+110 ≠ −110→−120). `bestAvailable` =
  the most bettor-favorable price across covered US books for the exact `{ market, side, line }`.
  Default tolerance ~2 implied-prob points; widen per volatile market (plus-money dogs, props).
- **Covers game lines, alternate lines, and props** via one **bundled per-event** Odds API call
  (`h2h,spreads,totals,alternate_spreads,alternate_totals` + a curated per-sport prop set),
  `regions=us`, cached (Next fetch `revalidate` TTL) so picks on the same event share one snapshot.
- **Grade at the claimed price** (authenticity); expose a **median reference** price so the
  leaderboard can rank on a fabrication-proof number.
- **Degrade, never hard-block.** If no covered book offered that exact market/side/line →
  `unverifiable` → the pick is `SELF-REPORTED` (§M2-3), not rejected. Only a price clearly better
  than best-available (beyond tolerance) is **rejected**.
- **Fairness:** the tolerance band absorbs normal book-to-book + timing variance; only clearly
  fabricated prices are blocked.

**Odds API budget (dedicated key).** Cost = markets × regions; alt lines + props force the
per-event endpoint, so bundle everything into one call, stay `us`-only, curate the prop list, and
**fetch-on-submission with a per-event TTL cache** (pay per _picked event_, not per pick). At
~10 markets × 1 region ≈ ~10 credits/event-fetch, a 20k/month key ≈ ~65 event-fetches/day →
~40–65 distinct picked events/day with caching — enough for a small-to-moderate slate. Blanket
slate polling, multi-region, uncurated props, or huge slates (NCAAB 100+ games) exceed it. Usage
is logged (`x-requests-remaining`) so burn is watched against the cap; size the plan off SCL's own
projected picked-events/day.

### C4 · Formal immutability

- Once submitted, a pick's `event`, `market`, `selection`, `line`, `odds`, and `units` are
  **immutable**. There is **no capper edit and no delete** — ever.
- `outcome` changes **only** through the append-only `GradingAudit` (source `AUTO` or
  `ADMIN_OVERRIDE`), never by the capper.
- Enforce at three layers: (a) no edit/delete server action exists; (b) a code-review invariant;
  (c) a `scl`-schema DB guard (revoke `UPDATE/DELETE` on `Play` selection columns to the app
  role, or a trigger blocking post-insert changes to the locked columns). This delivers "no
  deleted losses" as a guarantee, not a promise.
- **Fairness:** a **draft** state is allowed and editable; immutability applies only once
  _committed_.

### C5 · Provenance

- Record how each pick entered: `source ∈ {MANUAL, IMPORTED_X, IMPORTED_DISCORD,
IMPORTED_TELEGRAM, SCREENSHOT_OCR}` + `sourceRef` (permalink to the capper's own post). See
  §M2-2 / §M2-4 of the learnings doc.
- Auto-captured, pre-game, structured picks earn the highest tier; they're the strongest defense
  against selective logging (T5) because the capper doesn't choose _which_ posts get imported
  after the fact.

### C6 · Duplicate & contradiction handling

- Reject a second **active** pick on the same `capperId + eventId + market + side` (dedup) —
  enforced by a DB unique constraint on active plays.
- **Hedges** (same event, opposing sides) are detected and either disallowed or explicitly
  labeled as a hedge so they can't be cherry-counted into win%.

### C7 · Official-only grading

- Grade from the **official result of the bound event**, automatically. `PUSH`/`VOID` come from
  official status (postponement, cancellation, void market) — never capper-initiated.
- Manual grading is **ADMIN-only**, always requires a `reason`, and always writes a
  `GradingAudit` row. No self-grading, ever.

### C8 · Rate limiting & sample floors

- Apply `src/lib/rate-limit.ts` (RequestThrottle) to `createPlay` to stop flood/throwaway
  submissions (T8).
- Leaderboards already support a **minimum settled-pick sample**; keep a sane floor so a 1-0
  record can't top the board.

## Verification-tier mapping (how strictness surfaces publicly)

| Tier              | Requires                                                                                                                                          |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| **AUTO-VERIFIED** | provenance = authorized connector · pre-game · structured/event-bound · official-graded                                                           |
| **VERIFIED**      | manual entry · pre-game · structured/event-bound · odds within tolerance · official-graded                                                        |
| **SELF-REPORTED** | any strictness check failed (post-start, free-text, unverifiable odds, OCR-only) — visible on profile, **excluded from the headline leaderboard** |

The tier is **computed from facts** (timing, provenance, structure, grading source), never
self-asserted. It's the single public signal that says "how much should you trust this record."

**Surfaced (M2-3):** `src/lib/verification.ts` owns the tier copy/tone; `PickTierBadge`
(`src/components/scl/badges.tsx`) renders it on every pick (profile plays, public picks feed, the
capper dashboard). Per-capper **verified share** is computed in the leaderboard query and shown on
the profile performance panel + the leaderboard cards. Ranking still uses net units/ROI; a
verified-only ranking is a follow-up.

## Fairness safeguards (strict ≠ hostile)

- **Draft → commit:** cappers can prepare/edit a draft; the lock + immutability apply only on
  commit.
- **Clear, specific errors** for every rejection (late, bad line, duplicate) — never a generic
  failure.
- **Clock-skew buffer** and an **odds tolerance band** so honest submissions near the deadline or
  at slightly different books aren't punished.
- **Official-status VOID/PUSH** so postponed games don't count as losses.
- A capper is **never penalized** for a losing pick — only for trying to hide or fake one.

## Schema deltas (Milestone 2)

**Landed** on `Play` (all additive + defaulted, so existing rows and reads are unaffected):
`eventId String?`, `eventStartsAt DateTime?`, `loggedPreGame Boolean @default(false)`,
`line Decimal? @db.Decimal(10,2)`, `side String?` (structured selection),
`source PickSource @default(MANUAL)`, `sourceRef String?`, `oddsVerified Boolean @default(false)`,
`verificationTier VerificationTier @default(SELF_REPORTED)`, `status PickStatus @default(COMMITTED)`,
plus enums `PickSource` / `PickStatus` / `VerificationTier` and an `@@index([eventId])`. Apply with
`npm run db:push` (owner step — the migration only adds nullable/defaulted columns to the `scl`
schema and never touches `public`).

**Still to add:** a `SportingEvent` reference table (id, teams, `startsAt`, official status) sourced
from the official schedule — for now `eventId` + `eventStartsAt` are denormalized on `Play` — and a
partial unique index on active `(capperId, eventId, market, side)` for C6 dedup.

Enforcement points: the `playSchema` (Zod) validates structure/odds/units and carries the optional
event fields; `createPlay` enforces the pre-game lock (C1) + odds check (C3) via `decidePickIntegrity`
**server-side before the write**, and sets `loggedPreGame` / `oddsVerified` / `verificationTier` /
`source` from verified facts. Dedup + throttle + the DB immutability guard are still to come; grading
stays official + audited.

## Milestone 2 sequence

1. **Event binding + `eventStartsAt` + pre-game lock (C1–C2)** — the keystone; unlocks tiers and
   auto-grading. Structured selection replaces free text. _Landed_: schema + server gate + the
   board selector that binds picks to real events (moneyline/spread/total). Remaining: typeahead
   for large slates + props/alt lines on the board.
2. **Line/odds verification (C3)** — _landed_: `verifyPick` wired into `createPlay` on the
   event-bound path (one-sided implied-prob bound over the bundled per-event odds).
3. **Formal immutability (C4)** — server invariant + `scl` DB guard.
4. **Dedup/hedge (C6)** + **throttle (C8)** — cheap, close obvious gaming.
5. **Provenance/tiers (C5)** — ties into the connector work (§M2-4) and tier surfacing (§M2-3).
6. **Official-only grading hardening (C7)** — mostly formalizing what exists.

The result: a capper _cannot_ log a pick after the game starts, cannot write a vague pick, cannot
claim a price that never existed, cannot delete or edit a committed pick, and cannot self-grade —
so the leaderboard measures real ability, and a strong record is provably earned.
