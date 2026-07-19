# Latest Picks evidence-ledger contract

This contract turns the v2 evidence-first direction into testable acceptance criteria for `/picks`.
The visual target is an original public record desk, not a generic dashboard grid.

## Composition

- The default surface is one chronological ledger, never a grid or wall of Proof Receipts.
- At `>=1024px`, render a semantic table with: Captured, Capper, Sport, Pick, Odds, Stake,
  Status, Proof, and one disclosure control.
- Below `1024px`, render the same records as compact ledger rows. Rows remain flat and share
  structural hairlines; they do not become individually elevated cards.
- Only one row may be expanded at a time. Expansion reveals one canonical warm
  `expanded-paper` Proof Receipt. No second receipt may remain open.
- Empty production data is an honest empty state. Never seed or fabricate rows for visual density.

## Hierarchy and surface grammar

- Page heading and scope controls precede the ledger without a marketing-card wrapper.
- Static ledger regions use hairlines only: no routine shadow, glow, or gradient.
- Pink means board-verified submission evidence. Blue is reserved for navigation and the active
  scope/control state. Win/loss/push colors appear only on settlement.
- Receipt paper is the sole elevated documentary artifact in the ledger.
- Numerals use the v2 tabular-data treatment. Headings remain sentence case.

## Interaction

- Time, sport, and status filters are encoded in the URL and survive a reload or shared link.
- The open receipt ID is URL-addressable and only opens a record already present in the bounded
  result set.
- Every disclosure and filter target is at least 44px. Mobile select text is at least 16px.
- Disclosure state uses `aria-expanded` and `aria-controls`; expanded content has a stable ID.
- No decorative motion. State changes are immediate and reduced-motion safe.

## Data honesty

- `Verified` means board-verified at submission and is visually separate from settlement.
- Close and CLV remain em dashes until a real closing snapshot exists.
- Stakes and results are units-only. SCL does not imply money processed or winnings promised.
- The query remains bounded. The client must not receive an unbounded public play history.

## Release matrix

- Verify at 375, 768, 1280, and 1440 pixels in dark and light themes.
- No horizontal page scroll, clipped labels, duplicate visible responsive content, or normal-size
  text below WCAG 2.2 AA contrast.
- Test empty, one-row, mixed-status, verified/logged, long-selection, and expanded-receipt states.
