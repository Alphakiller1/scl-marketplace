# CLV verification — 2026-09-09

## Finding

CLV calculation is implemented and covered by the existing closing-snapshot and grading tests. `Play.clvPts` is calculated only when SCL has both the submitted American price and a stored same-book closing price.

## Why some established cappers show `Avg CLV —`

The profile and leaderboard intentionally average only settled, straight, Odds-Verified plays with a non-null `clvPts`. Imported/self-reported history, parlay legs, pending plays, and picks for which no closing snapshot was captured do not receive an invented zero. A capper may therefore have hundreds of graded picks but zero qualifying closing snapshots.

There are two additional display rules:

- The tracker does not publish an average until it has at least 10 qualifying closing snapshots.
- A calculated average that rounds to `0.00 pts` is deliberately rendered as an em dash. This prevents a misleading `+0.00` or `-0.00`, but it can make a measured neutral average look like missing data.

The live `@clownsportspick` profile demonstrates the second case: it reports 35 closing snapshots and a neutral `0.00 pts` average in its accessible description, while the visible `Avg CLV` value is an em dash. That is display behavior, not a failed calculation.

The reported em dash can therefore mean insufficient qualifying closing data or a measured average that rounds to zero. No CLV correction is included in the Honors/Supermax scope.

## Local checks

- `computeClvPts` and closing snapshot backfill paths remain active.
- Auto-grading writes CLV when a closing price exists.
- Profile and leaderboard reads exclude null CLV values rather than treating them as zero.
- The UI formatter intentionally turns values that round to zero into an em dash.
- The UI copy explains that historical picks without a captured close remain em dashes, but does not currently distinguish those from a measured zero average.
