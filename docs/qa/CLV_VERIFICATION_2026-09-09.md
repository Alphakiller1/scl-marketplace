# CLV verification — 2026-09-09

## Finding

CLV calculation is implemented and covered by the existing closing-snapshot and grading tests. `Play.clvPts` is calculated only when SCL has both the submitted American price and a stored same-book closing price.

## Why some established cappers show `Avg CLV —`

The profile and leaderboard intentionally average only settled, straight, Odds-Verified plays with a non-null `clvPts`. Imported/self-reported history, parlay legs, pending plays, and picks for which no closing snapshot was captured do not receive an invented zero. A capper may therefore have hundreds of graded picks but zero qualifying closing snapshots.

This is a data-availability/display-explanation issue, not evidence that those historical picks were included in a failed average. No CLV correction is included in the Honors/Supermax scope.

## Local checks

- `computeClvPts` and closing snapshot backfill paths remain active.
- Auto-grading writes CLV when a closing price exists.
- Profile and leaderboard reads exclude null CLV values rather than treating them as zero.
- The UI copy explains that historical picks without a captured close remain em dashes.
