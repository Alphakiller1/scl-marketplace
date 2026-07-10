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

- A pick MUST be submitted **strictly before** its event's scheduled start (with a small
  clock-skew buffer, e.g. lock at `eventStartsAt`). Submissions at/after start are **rejected**,
  not silently downgraded.
- Store `submittedAt` (= `createdAt`) and `eventStartsAt`; derive `loggedPreGame`.
- Only `loggedPreGame` picks are eligible for the **verified leaderboard**. A late pick can exist
  on a profile but is `SELF-REPORTED` and excluded from headline ranking.
- **Fairness:** the error is explicit — _"This game started 6 minutes ago; picks lock at start
  time."_ No ambiguity about why it failed.

### C2 · Structured, event-bound selection (no free-text picks)

- Every pick binds to a **real scheduled event** from an official schedule source (event id,
  teams, start time) — not typed free text.
- `selection` becomes a **structured `{ market, side, line }`** chosen from that event's real
  markets (e.g. `spread / LAL / -3.5`, `total / over / 8.5`, `moneyline / LAL`), resolving to
  **exactly one gradeable outcome**.
- This simultaneously kills T2 (ambiguity), enables reliable auto-grading, and is the anchor for
  C3 (line verification).
- **Fairness:** typeahead over today's slate; free text is only a fallback that lands the pick as
  `SELF-REPORTED`.

### C3 · Line & odds verification

- At submission, capture the event/market's **available line and price** from the
  official/odds source. Validate the capper's claimed `oddsAmerican` and `line` against a **real,
  available number** (within a defined tolerance, or against best-available at capture time).
- Reject implausible odds (e.g. +150 on a −110 market). Optionally snap to the verified price and
  mark `oddsVerified = true`.
- **Fairness:** a tolerance band absorbs normal book-to-book variance; only clearly fabricated
  prices are blocked.

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

On `Play`, add: `eventId String?`, `eventStartsAt DateTime?`, `loggedPreGame Boolean @default(false)`,
`line Decimal? @db.Decimal(10,2)`, `side String?` (structured selection), `source PickSource @default(MANUAL)`,
`sourceRef String?`, `oddsVerified Boolean @default(false)`, `status PickStatus @default(COMMITTED)` (DRAFT/COMMITTED).
Add a `SportingEvent` reference (id, teams, `startsAt`, official status) sourced from the official
schedule, and a partial unique index on active `(capperId, eventId, market, side)`. Keep all of
this in the `scl` schema; migrations never touch `public`.

Enforcement points: the `playSchema` (Zod) validates structure/odds/units; `createPlay` enforces
the pre-game lock, event binding, line check, dedup, and throttle **server-side before the
write**; the DB guards immutability + dedup; grading stays official + audited.

## Milestone 2 sequence

1. **Event binding + `eventStartsAt` + pre-game lock (C1–C2)** — the keystone; unlocks tiers and
   auto-grading. Structured selection replaces free text.
2. **Formal immutability (C4)** — server invariant + `scl` DB guard.
3. **Dedup/hedge (C6)** + **throttle (C8)** — cheap, close obvious gaming.
4. **Line/odds verification (C3)** — needs the official odds source in place.
5. **Provenance/tiers (C5)** — ties into the connector work (§M2-4) and tier surfacing (§M2-3).
6. **Official-only grading hardening (C7)** — mostly formalizing what exists.

The result: a capper _cannot_ log a pick after the game starts, cannot write a vague pick, cannot
claim a price that never existed, cannot delete or edit a committed pick, and cannot self-grade —
so the leaderboard measures real ability, and a strong record is provably earned.
