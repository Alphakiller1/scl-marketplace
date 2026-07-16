# Route conformance QA — Milestone 2 application pass

Base: local production build (`next start`) after this PR’s changes.  
Viewports: 375×812 and 1280×800 · themes: dark + light.  
Automated: `BASE_URL=http://127.0.0.1:3010 npx tsx scripts/route-conformance-qa.ts`

## Summary

| Status | Count                                                                  |
| ------ | ---------------------------------------------------------------------- |
| PASS   | 108                                                                    |
| FAIL   | 0                                                                      |
| WARN   | 12 (empty numeric samples on empty pick boards / no live odds session) |
| SKIP   | 0                                                                      |

## Violations fixed in this PR

1. **Parlay / units input ≥40px** — shared `Input` no longer shrinks to `md:h-8` (32px). Stays `h-11` / `min-h-10` at all breakpoints; numeric inputs use `scl-data` (tabular Inter). `Select` trigger also raised to ≥40px.
2. **Leaderboard search field** — `#q` was a 20px inner input inside a tall wrapper; now `h-11` so the control itself meets the tap-target rule.
3. **Ticket / slip / chip numeric typography** — `BettingTitle` + `splitBettingTitle` wrap betting numbers (Over 170.5, spreads, odds, leg counts) in `scl-data` while keeping display type for team/market words. Applied on Ticket selection titles, single-play slip, parlay legs, and MarketChip labels.
4. **Homepage blur** — already cleared by system PR #107; matrix `no-blur` PASS on `/` (and all scoped routes). No glass/glow replacements added.
5. **VerificationReceipt CTA** — gold primary CTA aligned with Ticket footer recipe.

## Route matrix (strict checks)

| Route                         | Overflow @375 | Taps ≥40 | Inputs ≥40 | No blur | Gold scarcity | Numeric mono              |
| ----------------------------- | ------------- | -------- | ---------- | ------- | ------------- | ------------------------- |
| `/`                           | PASS          | PASS     | PASS       | PASS    | PASS          | PASS (tabular Inter)      |
| `/leaderboard`                | PASS          | PASS     | PASS       | PASS    | PASS          | PASS                      |
| `/picks`                      | PASS          | PASS     | PASS       | PASS    | PASS          | WARN (empty board)        |
| `/dashboard/picks/new`        | PASS          | PASS     | PASS       | PASS    | PASS          | WARN (empty / auth shell) |
| `/dashboard/picks/new/parlay` | PASS          | PASS     | PASS       | PASS    | PASS          | WARN (empty / auth shell) |

Dark + light and 375 + 1280 all covered in the automated matrix above.

## Post-submit Ticket

**Intentionally skipped in production** — no local `.env` / staging credentials in this environment; submitting would mutate live capper data.

Receipt UI path (code + `/picks` Ticket faces):

- Eyebrow muted mono `SCL · Pick Receipt`
- Selection title: display + mono numeric tokens
- Gold VERIFIED stamp / odds / To Win
- Capture line mono + Grades Automatically (win-green)
- Gold “View on your record” / “View My Picks” CTA

Re-verify post-submit on staging with a disposable test account before Milestone 2 sign-off.

## Known remaining risk

- Live board expand / chip select / sticky slip with 2 legs needs signed-in session + odds API.
- WARN rows are empty-state numeric sampling, not font regressions (home/leaderboard use tabular Inter via `.scl-data`).

## How to re-run

```bash
npm run build && npx next start -p 3010
BASE_URL=http://127.0.0.1:3010 npx tsx scripts/route-conformance-qa.ts
```
