# New Pick workflow contract

Status: acceptance target for `/dashboard/picks/new` and its unified Singles / Parlay flow.

## Product posture

- SCL records picks; it does not place bets or process payments.
- The primary action is “Log pick”, “Log picks”, or “Log parlay” — never a wagering or checkout verb.
- Stakes and projected profit are shown only in units. Projected profit is conditional context, not a promise.
- Board verification means the displayed book price was checked at submission. It never means the pick won.

## Desktop composition

- Persistent two-track workspace: market board on the left, pick slip on the right.
- The empty slip remains in the right track so the board never jumps when the first price is selected.
- The slip is sticky within the viewport; the market board owns market exploration.
- Selecting a matchup enters a focused matchup workspace. Other matchups and slate filters leave the working field until the user returns to the slate.

## Mobile composition

- The market board owns the page until a price is selected.
- A selected price opens the existing bottom pick-slip dock; no empty slip card blocks the board.
- The focused matchup uses document scrolling, never a nested 448px market scroll trap.
- Controls used for selection, disclosure, removal, stake shortcuts, and slate navigation are at least 44px high.

## Board hierarchy

1. Source book.
2. Slate day, search, and only sports that have real matchups.
3. Matchup list.
4. Focused matchup: core prices, searchable props, then collapsed alternate lines.
5. Pick slip: captured line, source, capture time, units, optional analysis, and log action.

## Data honesty

- Duplicate matchup rows remain collapsed by event identity.
- Missing prices remain em dashes and cannot be selected.
- Extreme prices remain selectable but retain the quiet Review mark, source book, and capture-time context.
- Line changes require explicit confirmation; suspended prices never write silently.
- No QA action may submit a live pick merely to inspect the workflow.

## Verification matrix

- Audit empty board, focused matchup, selected line, Singles, Parlay, and mobile slip states.
- Verify 375, 768, 1280, and 1440 in dark and light.
- Require WCAG 2.2 AA, no horizontal overflow, no mobile nested scroll trap, and no control below 44px in the primary flow.
