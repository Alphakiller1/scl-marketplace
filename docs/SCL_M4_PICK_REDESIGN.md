# SCL M4 — Pick-Making Redesign + Sportsbook-Driven Options

**Status:** design spec for delegation. Translates the SportsDataNow (SDN) pick-making
reference into SCL's own flow, inside SCL's verification contract. Implement as the sequenced
PRs in §7.

## 1. Goal

Rebuild straight + parlay entry so it reads like a modern sportsbook (SDN reference):
game search, category filters with counts, team/player avatars, a symmetric leg builder, and
a de-congested capture area — **and** couple it to the books a capper actually uses, so the
lines they log come from their books.

Two owner asks drive this:

- The capture space (pick, league, unit allocation, etc.) is **too congested** and **lacks
  symmetry/definition** vs. SDN.
- A capper should **select their sportsbooks in their profile**, and those books should drive
  the options shown during pick entry.

## 2. Non-negotiables (the SCL contract this must respect)

These do not change — the redesign is presentation + a book filter, not a loosening of trust:

- **Board-based verification stays mandatory.** Every pick is event-bound and price-checked
  (`decidePickIntegrity`, C1 pre-game lock + C2 event binding + C3 odds). No free-text pick
  path returns.
- **The SDN "add manually / log a manual bet" escape hatch is NOT ported as a verified path.**
  Replace it with a **"Request coverage"** affordance: it records that a capper wanted a
  league/market we don't cover yet; it does **not** create a pick. (Optionally it can create a
  clearly-labeled `SELF_REPORTED` draft, but only if the owner reverses the "no free-text"
  rule — default is no.)
- **Mobile-first**, ≥40px targets, no 375px overflow, both themes, design tokens only.
- Reuse existing SCL pieces — `OddsAssist`/`EventDetail` (market + props + alt lines),
  `slip.ts` (`pickKey`, `findConflict`, `toSlipLeg`), `BetSlip`/`MobileSlipDock`,
  `StakeQuickChips`, `TeamMark`, verification tiers/receipt. This is a re-composition, not a
  rewrite of the verification engine.

## 3. Reconciliation principle

Adopt SDN's **structure and interaction**; keep SCL's **trust model**. Concretely: SDN's
"pick a game from a searchable, filtered list, then pick a market" maps cleanly onto SCL's
"event → market" board — we're adding a better game-browsing front end to the same
event-bound pipeline, plus a book filter.

## 4. Information architecture

### 4.1 Mode selector (from screenshot 1)

A two-card selector under any auto-import area: **Straight bet** ("One pick, one bet.") and
**Parlay** ("Multiple legs, all must hit."). Cards route to the existing `/dashboard/picks/new`
and `/dashboard/picks/new/parlay` (keep routes; the cards are the entry).

### 4.2 Shared `GamePicker` (from screenshot 2 — the core new component)

Both straight and parlay use the **same** game-picker so the two flows are symmetric:

1. **Slate pill** — `Today, <date>` / Tomorrow toggle (reuse the existing day logic).
2. **Search** — "Search teams, leagues, or matchups…" filters the game list live.
3. **Category pills with counts** — `All 115 · basketball 2 · tennis 113 …` derived from the
   loaded slate. This replaces "pick one sport first": the board loads the multi-sport slate
   and the pills filter it. (Reuse `SportPills` styling; add counts; add an "All".)
4. **Game rows** — team/player avatar pair · `Away @ Home` · start time · **league badge**.
   Avatars use `TeamMark` (real logos once the logo-assets PR lands, initials until then).
5. **"Request coverage"** row at the bottom (replaces SDN's manual fallback — see §2).

Selecting a game expands the existing `EventDetail` (featured lines → props → alt ladders),
i.e. market selection is unchanged — only the way you _reach_ a game is new.

### 4.3 Straight flow

Mode card → `GamePicker` → pick a market chip → `BetSlip` (stake + `StakeQuickChips` +
to-win + notes) → submit → verified receipt. Board stays visible beside the slip on desktop
(the existing two-column sticky layout).

### 4.4 Parlay flow (from screenshot 2)

Vertical **collapsible leg cards**: `LEG 1`, `LEG 2`, … Each leg embeds a `GamePicker`;
once a leg's selection is made the card collapses to a one-line summary (selection · odds ·
league) with expand/remove. Header shows `PARLAY · N-leg parlay` + combined odds. Reuse
`slip.ts` dedupe + `SlipConflictPrompt` (same-market Replace/Cancel) already shipped.

### 4.5 De-congestion rules (owner: "capture space too congested")

- One primary action per row; push secondary metadata (league, unit allocation) to a muted
  sub-line, not competing at the same weight.
- Consistent vertical rhythm between legs; a leg collapsed vs. expanded must not shift layout.
- Unit allocation lives in the slip, not inline on every game row.
- Max one badge cluster per row (tier OR league OR status leads; others subordinate).

## 5. Sportsbook-driven options

### 5.1 Profile: book selection

- New `CapperProfile.books String[]` (canonical book keys; additive, defaulted `[]`).
- Profile form: a multi-select of supported books (a curated list mapping to The Odds API
  `bookmakers` keys — e.g. `draftkings`, `fanduel`, `betmgm`, `caesars`, …).
- Public profile may show "Books: DK, FD, MGM" as trust/context (optional).

### 5.2 Odds fetch reflects the capper's books

- `odds-api.ts` currently requests `regions=us`. Add an optional `bookmakers=` param built
  from the current capper's `books`. When the capper has books selected, request those books;
  otherwise fall back to `regions=us` (all US books).
- Board prices show **book attribution** (which book the price is from). When multiple selected
  books offer a market, show the capper's best price and label the book.
- **Verification uses the capper's book prices**: `verifyOdds`/`collectAvailablePrices`
  already work in implied-probability space — feed them the book-filtered price set so a
  capper is verified against the books they actually bet.

### 5.3 Edge cases

- A selected book has no line for an event/market → fall back to other selected books, then to
  `regions=us`; never show an empty board because of a book filter.
- Capper changes books after logging picks → historical picks keep the book they were captured
  at (store the book on the leg/play when captured).

## 6. Schema / data changes

- `CapperProfile.books String[] @default([])` (additive; apply via Supabase SQL, scl-qualified,
  before merge — no Node/prisma on the build machine).
- Optional `Play.book String?` / `Parlay`… to record capture book (recommended for §5.3).
- `odds-api.ts`: `bookmakers` support + book attribution on `OddsSelection`.

## 7. Sequenced PRs (delegation plan)

Build in order; each ships independently. Same shared constraints as the M4 prompts.

1. **Profile book selection** — `CapperProfile.books` (schema + Supabase DDL), multi-select in
   the profile form from a curated book list, optional public display. No pick-flow change yet.
2. **Odds reflect books** — `odds-api.ts` `bookmakers` param from the capper's books + book
   attribution on prices; verification consumes the filtered price set; safe fallbacks (§5.3).
3. **`GamePicker` component** — slate pill + search + category pills-with-counts + avatar/league
   game rows + "Request coverage" row. Wraps the existing multi-sport slate; expands into the
   current `EventDetail`. No parlay/straight page restructure yet — land the component + tests.
4. **Restructure entry pages** — mode cards (screenshot 1); straight + parlay rebuilt around
   `GamePicker`; parlay collapsible leg cards (screenshot 2); apply the §4.5 de-congestion +
   symmetry rules. Reuse slip/dedupe/conflict/receipt as-is.

Logos (team/league) come from the separate M4 logo-assets PR and drop into `GamePicker` rows
via `TeamMark`/`LeagueMark` with no rework here.

## 8. Acceptance criteria

- Straight and parlay use the **same** `GamePicker`; the two flows are visually symmetric.
- A game is reachable by search or category pill in ≤2 interactions; no view dumps an
  uncontrolled wall of games/chips.
- Every submitted pick is still event-bound + verified; no free-text verified path exists.
- A capper's board prices come from their selected books (with attribution); with no books
  selected, behavior matches today (`regions=us`).
- Capture area passes the §4.5 density rules at 375px and desktop, both themes.
- The parlay leg builder collapses/expands without layout shift; dedupe + same-market
  Replace/Cancel still enforced.
