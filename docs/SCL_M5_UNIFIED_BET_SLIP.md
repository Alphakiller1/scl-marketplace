# SCL M5 — Unified Bet Slip, Odds-Movement Guard & Lifecycle States

**Status:** implementation spec for delegation. Turns the owner's post-M4 feedback into an
executable roadmap. Build ON the current M2-passing, v1.1 design system — no visual redesign.

## 0. Design-law reconciliation (read first)

The owner's brief says "gold remains scarce." That predates the **v1.1 brand correction**
(#110), which is the current law in `design/SCL-DESIGN-SPEC.md`:

- **Pink = conviction** (scarce): primary CTA, selected chips, VERIFIED badges/stamps,
  rank 1-3, combined-odds figures, section hairlines, slip-bar border + VIEW SLIP.
- **Blue = navigation**: active sport/category/book pills, active segmented segment/tabs,
  links, focus rings, informational chips.
- Win/loss stay semantic-only. Gold is removed.

This brief preserves the **scarcity principle** but the hue is **pink, not gold**. Anywhere the
owner's text says "gold," read "the pink conviction role." Do not reintroduce gold.

## 1. What's already shipped (build on, don't rebuild)

- Board + `GamePicker` (#112): multi-sport slate, search, blue category pills, **blue book rail**.
- `MarketChip` with selected state + book tag; `EventDetail` (featured/props/alt).
- `slip.ts`: `pickKey`, `findConflict` (dupe + same-market conflict), `toSlipLeg`.
- `SlipConflictPrompt` (Replace/Cancel), `BetSlip`/`MobileSlipDock`, `StakeQuickChips`.
- Verification: `decidePickIntegrity` (C1 pre-game lock, C2 event binding, C3 odds tolerance),
  `verifyPick`, `collectAvailablePrices`, `getOddsForBook` (per-book, honest `—`).
- Persistence: `Play.book`, `Parlay`, `CapperProfile.books`. `VerificationReceipt` = the Ticket.
- Entry pages (#113): mode cards → GamePicker → slip → submit → Ticket.

The M5 change is a **slip-model unification** + a **submit-time odds guard** + **clearer
lifecycle language**, not a new board or a new verification engine.

## 2. Unified sportsbook-style bet slip

### 2.1 One board, multi-select, decide mode in the slip

Today the slip holds one selection (straight page) or N legs (parlay page) as **separate
routes**. M5 unifies them: **one board interaction model** where tapping market chips
accumulates selections into **one slip that holds N picks**, and a **mode toggle inside the
slip** decides how they submit. The user never leaves the board to choose singles vs parlay.

- This **supersedes the #113 mode cards** (which route to two pages). The mode cards become an
  in-slip **segmented control: `Singles | Parlay`** (blue active segment). Keep both routes
  alive as thin wrappers if link-in from elsewhere is needed, but the primary flow is one
  unified pick-entry surface.

### 2.2 Singles mode

- Each selected line is its own row with **its own units input** (+ `StakeQuickChips`).
- Combined "to-risk / to-win" summary is the sum across rows.
- Submit = **bulk**: create N **separate verified Plays**, each independently odds-guarded
  (§3). Partial success is allowed (see §3.5 / edge cases).
- No conflict rules between singles (Over 9 and Under 9 as two separate singles is legal).

### 2.3 Parlay mode

- **One stake** applies to the parlay; **combined odds** shown (existing american→decimal→
  american math). Existing `findConflict` dupe + same-market conflict prevention applies
  (Replace/Cancel via `SlipConflictPrompt`).
- Submit = one `Parlay` with its legs, each leg odds-guarded (§3); any hard-changed/unavailable
  leg blocks the parlay until resolved.

### 2.4 Mode-switch behavior

- Switching Singles→Parlay: if the current selections contain a same-market conflict, surface
  it immediately (a leg must be removed/replaced before Parlay is valid). Per-line units
  entered in Singles are dropped in favor of the single parlay stake (warn once).
- Switching Parlay→Singles: each leg becomes a single row seeded with the parlay's per-unit
  stake (editable). No data loss.
- `< 2` selections in Parlay mode: submit disabled with the reason inline ("Add at least 2
  legs, or switch to Singles").

## 3. Odds-movement guard (submit-time re-verification)

The server **re-verifies every line at submit** (extends `verifyPick`). The client selected an
odds value at chip-tap; between then and submit the market can move. Never silently submit a
stale price.

### 3.1 Tolerance classes (decide in implied-probability space)

Let `Δp` = |implied-prob(updated) − implied-prob(selected)|.

| Class                       | Rule                                                                        | Behavior                                                      |
| --------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------- |
| **Unchanged**               | updated == selected                                                         | submit silently                                               |
| **Favorable**               | updated price better for the capper (lower implied prob)                    | auto-accept; note on receipt "line improved -110 → -105"      |
| **Minor**                   | `Δp ≤ TOLERANCE` (reuse C3 tolerance, e.g. ~1.5% implied) and not favorable | auto-accept; note "line moved -110 → -112 (within tolerance)" |
| **Changed**                 | `Δp > TOLERANCE`                                                            | **must confirm** (§3.2)                                       |
| **Unavailable / suspended** | book no longer offers the line                                              | **block**; must remove the leg                                |

`TOLERANCE` is a single named constant shared with C3 so verification and the guard agree.

### 3.2 Confirmation UX (the "line moved" prompt)

A slip-level modal/sheet (Ticket-adjacent styling, no generic dialog) listing each affected
line:

```
LINE MOVED — review before submit
  <selection>  ·  <event>  ·  <market/line>
  <book/source>            captured <timestamp> ET
  YOU SELECTED   -110      NOW   -125        (mono, pink delta if worse / blue if better)
  [ Accept -125 ]   [ Remove leg ]
Unaffected lines submit as-is.
[ Cancel submission ]
```

- **Accept updated odds** → that line submits at the new price (recorded as accepted-moved).
- **Remove changed leg** → drop it; the rest proceed (Singles) / recompute parlay (Parlay).
- **Cancel submission** → nothing is written; slip is preserved.
- Unavailable lines cannot be accepted — only removed.

### 3.3 What the confirmation must show per line

original selected odds · updated odds · event · market · line · book/source (when available) ·
capture timestamp. All numerics in IBM Plex Mono.

### 3.4 Server contract

`createPlays` / `createParlay` re-fetch live odds per line, classify each (§3.1), and return a
typed result: `{ ok: false, needsConfirm: MovedLine[] }` when any line is Changed/Unavailable
and the client has not passed an `acceptedMoves` map. On resubmit with `acceptedMoves`, only
still-valid accepted lines are written; anything that moved again re-prompts (bounded retry).

### 3.5 Bulk-singles partial outcome

If 3 singles submit and 1 is Unavailable: write the 2 clean ones, keep the unavailable one in
the slip with its state, and report "2 of 3 submitted; 1 line suspended." Never fail the whole
batch for one bad leg (parlay is all-or-nothing; singles are independent).

## 4. Sportsbook / source surfacing

Book capture already exists (`Play.book`, `getOddsForBook`, book rail). M5 defines where it
**shows**:

| Surface                           | Treatment                                                                                                 |
| --------------------------------- | --------------------------------------------------------------------------------------------------------- |
| **Board**                         | blue book rail (done #112); each chip's mono book tag (done #111)                                         |
| **Bet slip**                      | per-line mono book tag next to the odds; slip header shows the active book                                |
| **Verification receipt (Ticket)** | capture line: `ODDS CAPTURED <ts> ET / SOURCE: <BOOK NAME> BOARD · GRADES AUTOMATICALLY` (v1.1 recipe 1d) |
| **Public pick Ticket / feed**     | book attribution shown when present; absent → "LIVE BOARD"                                                |

**Do not overbuild integrations.** Book selection is per-profile only for now. **Capture
server-side now** (so future credibility is intact even before richer book UI): `book` key,
the exact captured `oddsAmerican`, capture `timestamp`, `eventId`, `market`, `side`, `line`,
`loggedPreGame`, and the tolerance-class outcome (unchanged/favorable/minor/accepted-moved).
Most exist; add only the missing **accepted-moved flag** + **selected-vs-captured** pair.

## 5. Status language taxonomy

Separate **authenticity** (Verified) from **lifecycle/result**. Never conflate.

### 5.1 Authenticity badge (unchanged)

`Verified` (pink shield — odds captured pre-game + checked against live market) /
`Self-reported` / `NN% Verified`. Refers to _how the pick was recorded_, never the outcome.

### 5.2 Lifecycle / result chip (new, replaces bare "Pending")

Derived from `outcome` + `eventStartsAt` + grading time (no new source of truth needed):

| State                 | Derivation                              | Label               | Tone                 |
| --------------------- | --------------------------------------- | ------------------- | -------------------- |
| Pre-game verified     | outcome=PENDING, now < eventStartsAt    | **Pre-Game**        | blue (informational) |
| Live, ungraded        | PENDING, now ≥ eventStartsAt, not final | **Live**            | blue                 |
| Final, awaiting grade | PENDING, past expected final + buffer   | **Awaiting Grade**  | muted                |
| Graded win            | outcome=WIN                             | **Won**             | win-green            |
| Graded loss           | outcome=LOSS                            | **Lost**            | loss-red             |
| Push / Void           | outcome=PUSH/VOID                       | **Push** / **Void** | push-neutral         |

Result: a card reads e.g. "**Verified** · **Pre-Game**" (authenticity + lifecycle), removing
the "does Pending mean unverified?" confusion. Pink (Verified) and win/loss red/green never
collide — pink is conviction, not a negative state.

## 6. Receipt (Ticket) evolution

Keep the Ticket identity. **No generic confirmation screen.** Four receipt shapes:

1. **One straight pick** — current Ticket (already prod-verified). Baseline.
2. **Bulk singles** — a Ticket _stack_: one receipt header ("N picks verified") over N compact
   Ticket rows, each with its own selection/odds/stake/book + Verified stamp. Partial batches
   show submitted rows + a muted "1 line suspended — still in your slip" note.
3. **Parlay** — the existing parlay Ticket (legs + combined odds + one stake + TO WIN in pink).
4. **Odds-moved accepted** — same Ticket, with a mono sub-line on the moved leg:
   `LINE MOVED -110 → -125 · ACCEPTED <ts> ET`, so the record is honest about the captured price.

All four keep: mono eyebrow, VERIFIED (pink) stamp, mono stat row, tear line, capture block,
TO WIN (pink), "GRADES AUTOMATICALLY."

## 7. Data model implications

Additive only; apply `scl`-qualified DDL via Supabase SQL before merge (no prisma on build box).

- `Play`: add `selectedOddsAmerican Int?` (what the capper tapped) — `oddsAmerican` stays the
  **captured/submitted** price; `oddsMovedAccepted Boolean @default(false)`. (`book`, `line`,
  `side`, `eventStartsAt`, `loggedPreGame` already exist.)
- No new lifecycle column — Pre-Game/Live/Awaiting Grade are **derived** from
  `outcome`+`eventStartsAt`+time in the query/UI layer.
- `Parlay`: same `oddsMovedAccepted` semantics per leg (legs are `Play` rows).
- No schema change for Singles-vs-Parlay: Singles = N `Play` rows (parlayId null); Parlay =
  `Parlay` + legs. The slip mode only decides which server action runs.

## 8. Server action implications

- New `createPlays(inputs[], acceptedMoves?)` for bulk singles (loop createPlay's verified path
  per input; independent success; partial result). Existing `createPlay` stays for single.
- `createParlay(input, acceptedMoves?)` extended with the odds guard (all-or-nothing).
- Shared `reverifyLine(selected, live)` → tolerance class (§3.1); both actions call it and,
  when any line is Changed/Unavailable without an accept, return `{ needsConfirm }`.
- Persist `selectedOddsAmerican` + `oddsMovedAccepted`; capture `book` + timestamp (exists).
- All server-validated with Zod; never trust client odds.

## 9. Component architecture

- `SlipStore` (context or the existing slip state) → holds `Selection[]` + `mode` +
  per-line units (singles) + parlay stake. One source of truth the board chips subscribe to
  for selected state (already partly via `selectedKeys`).
- `BetSlip` gains: `SlipModeToggle` (Singles|Parlay, blue active), Singles list (per-row units),
  Parlay body (existing), a shared summary + submit.
- New `LineMovedPrompt` (§3.2) — Ticket-adjacent, not a generic dialog.
- New `LifecycleChip` (§5.2) — derives label/tone; used on pick rows, feed, profile, receipt.
- `ReceiptStack` (§6.2) wrapping `Ticket` for bulk singles.
- Reuse: `GamePicker`, `MarketChip`, `EventDetail`, `slip.ts`, `SlipConflictPrompt`,
  `StakeQuickChips`, `MobileSlipDock`, `VerificationReceipt`/`Ticket`.

## 10. Recommended PR sequence

1. **Lifecycle chip + taxonomy** — `LifecycleChip`, derive states, replace bare "Pending"
   everywhere (pick rows, feed, profile, receipt). Pure UI/derivation; ships alone, immediate
   clarity win. (No schema.)
2. **Odds-movement guard (server + prompt)** — `reverifyLine`, extend `createPlay`/`createParlay`
   to return `needsConfirm`, `LineMovedPrompt`, `selectedOddsAmerican`/`oddsMovedAccepted`
   schema (DDL). Straight/parlay only (pre-unification). High trust value.
3. **Unified slip — Singles mode + bulk submit** — `SlipModeToggle`, per-line units,
   `createPlays` bulk, `ReceiptStack`. Board multi-select accumulation.
4. **Unified slip — Parlay mode in the same surface** — fold the parlay builder into the unified
   slip; retire the separate mode-card routing (§2.1). Mode-switch behavior (§2.4).
5. **Source surfacing polish** — slip per-line book tag + slip header book; receipt/public
   Ticket SOURCE line audit (§4). Small.

Each PR: solo, branch+PR, CI green, mobile-first, v1.1 conformance. 1 and 2 are independent and
can parallelize; 3→4 are sequential (same slip files).

## 11. User flow diagrams (plain text)

**Unified entry (singles or parlay):**

```
Board (GamePicker) ──tap chip──▶ Slip accumulates selection (chip = selected/blue-book)
      ▲                                   │
      └──── tap more chips ───────────────┘
Slip: [ Singles | Parlay ]  (blue active segment)
   Singles ▶ each row: units input → SUBMIT ALL ─┐
   Parlay  ▶ one stake + combined odds → SUBMIT ──┤
                                                  ▼
                              Server re-verify every line (§3)
                    ┌──────────────┬───────────────┬───────────────┐
               unchanged/minor   changed/unavail    all clean
                    │              │                │
                 submit       LineMovedPrompt      submit
                              (accept/remove/cancel)
                                     │
                              resubmit accepted
                                     ▼
                    Ticket: straight | stack (singles) | parlay | moved-accepted
                                     ▼
                              lands in record (Pre-Game lifecycle chip)
```

**Odds-moved decision:**

```
submit ─▶ needsConfirm? ─no─▶ write ─▶ Ticket
             │yes
             ▼
   LineMovedPrompt per affected line
   ├ Accept updated  ─▶ mark accepted, include
   ├ Remove leg      ─▶ drop (singles: others proceed; parlay: recompute/if <2 block)
   └ Cancel          ─▶ write nothing, keep slip
```

## 12. Edge cases

- All selected lines move beyond tolerance → prompt lists all; user can accept all / remove all.
- Parlay drops below 2 legs after removals → block submit with inline reason; offer "switch to
  Singles."
- Event ticks live (past `eventStartsAt`) between selection and submit → line is no longer
  pre-game → **reject that pick** (C1 lock); surface "no longer pre-game — removed," never write
  a non-pre-game verified pick.
- Book suspends the market entirely → Unavailable; remove-only.
- Duplicate exact selection tapped twice → existing dupe no-op (unchanged).
- Odds move again during the confirm round-trip → re-prompt (bounded, e.g. 2 rounds, then cancel).
- Capper has no book selected → board/verify falls back to regions=us (unchanged); receipt SOURCE
  = "LIVE BOARD."
- Mixed favorable + adverse moves in one submit → auto-accept favorable, prompt only adverse.
- Bulk singles: some pre-game, one already live → live one rejected (C1), others proceed.

## 13. Acceptance criteria

- One board surface; user selects multiple lines and chooses Singles/Parlay **without leaving
  the board**.
- Singles: per-line units; bulk submit writes N independent verified Plays; partial success
  handled (§3.5).
- Parlay: one stake, combined odds, existing dupe/same-market conflict prevention enforced.
- Server re-verifies **every** line at submit; unchanged/favorable/minor auto-submit; changed
  requires explicit accept; unavailable is remove-only; nothing silently submits a stale price.
- Confirmation shows selected vs updated odds + event + market + line + book + timestamp; offers
  accept / remove / cancel.
- `Verified` unchanged and never conflated with result; bare "Pending" replaced by
  Pre-Game/Live/Awaiting Grade/Won/Lost/Push/Void.
- Receipts: straight, singles-stack, parlay, moved-accepted — all keep the Ticket identity; no
  generic confirmation screen.
- Book/source shown on board, slip, receipt, public Ticket; captured fields persisted (§4).
- Mobile-first, no 375px overflow, ≥40px targets, mono on every number, tokens only, no
  gold/blur/non-slip gradient, pink scarce, board verification still mandatory, no free-text path.

## 14. QA matrix

Run each on `/`, the unified entry route, `/dashboard/picks` (record), and a receipt, at
**375 / 1280 × dark / light**:

- Select 3 lines → Singles → set 3 different unit values → submit all → 3-row Ticket stack →
  3 Pre-Game picks in record.
- Same 3 → Parlay → one stake → combined odds correct → parlay Ticket → 1 record entry.
- Over X then Under X same market in Parlay → Replace/Cancel fires.
- Force an odds move (or mock) → LineMovedPrompt shows selected vs updated + book + ts →
  test accept, remove, cancel independently.
- Suspend a line (mock) → remove-only; batch still submits the rest.
- Lifecycle labels render correctly across Pre-Game / Live / Awaiting Grade / Won / Lost.
- Book rail + per-line book tag + receipt SOURCE line all agree.
- Golden parlay-odds math test (mixed +/− legs).
- No gold anywhere; pink only in the conviction slots; blue only in navigation slots.

## 15. What should NOT change

- SCL identity: logo, background/banner, Ledger/Board/Ticket language.
- The v1.1 token system + pink/blue role rules (the scarcity principle — now pink).
- Board-based mandatory verification; C1/C2/C3 integrity; no free-text path.
- The verification engine (`decidePickIntegrity`, `verifyPick`, `collectAvailablePrices`) —
  extend for the guard, don't rewrite.
- `GamePicker`, `EventDetail`, `slip.ts`, `SlipConflictPrompt`, `Ticket`/`VerificationReceipt` —
  reuse.
- Existing routes/data contracts except the additive schema in §7.

## 16. Risk list

- **Slip unification touches the highest-traffic files** (both entry pages + slip) → do it solo,
  sequenced (PR-3 then PR-4), never concurrent with other agents (shared-dir collisions).
- **Odds-guard round-trips** could feel slow → keep re-verify per-line parallel; show a compact
  "re-checking lines…" state; bound retries.
- **Partial bulk success** is easy to get wrong → explicit per-line result objects + tests.
- **Lifecycle derivation** depends on `eventStartsAt` accuracy + an "expected final" buffer →
  keep the buffer generous; Awaiting Grade is a soft state.
- **Mode-switch data handling** (units ↔ stake) can lose input → warn once, seed sensibly (§2.4).
- **Gold regression risk** — the owner's brief says "gold"; any executor must apply §0 and use
  pink. Grep the diff for gold before merge.
- **Schema/DDL drift** — the `scl` DDL must be applied in Supabase before merge or submits break
  (as with `Play.book`).

## 17. Owner-facing summary

M5 turns the current one-pick-at-a-time board into a **single sportsbook-style bet slip**: tap
as many lines as you want, then decide **Singles** (each with its own stake, submitted as
separate verified picks) or **Parlay** (one stake, combined odds) — all without leaving the
board. At submit, SCL **re-checks every line against the live market**; if a price moved, you
see exactly what changed (old vs new odds, event, book, timestamp) and choose to accept, drop
that leg, or cancel — no stale odds ever slip into your record. "**Verified**" stays exactly as
it is (it proves the odds/timestamp were captured honestly, not that you won), while the
confusing "Pending" becomes clear lifecycle labels — **Pre-Game → Live → Awaiting Grade → Won/
Lost**. Sportsbook source shows on the slip and the Ticket, and the Ticket receipt grows to
cover single picks, bulk singles, and parlays without ever becoming a generic confirmation
screen. Everything stays on the corrected blue/pink brand, mobile-first, with board-based
verification mandatory. Shipped as 5 sequenced PRs; the two highest-value ones (clearer status
labels, the odds-movement guard) can land first and independently.

```

```
