# Milestone 2 Closeout — Play Tracking & Performance Engine

**Status:** Feature-complete; production acceptance pending  
**Last reviewed:** 2026-07-03

## Scope

Milestone 2 includes:

- Structured play entry
- Sportsbook/API-assisted workflow to the extent included in Phase 1
- Manual entry fallback
- Parlay support
- WIN/LOSS/PUSH/VOID grading
- Profit/loss, units, ROI, and record calculations
- Append-only grading audit trail
- Performance dashboard calculations

## Implementation evidence

| Requirement              | Status   | Evidence                                                                                          |
| ------------------------ | -------- | ------------------------------------------------------------------------------------------------- |
| Structured play entry    | Complete | Board-first entry and sportsbook-style bet slip; PRs #46, #48, and #52                            |
| API-assisted workflow    | Complete | Authenticated The Odds API board for moneyline, spread, and total selection; PRs #42 and #46      |
| Manual fallback          | Complete | Manual play-entry mode remains available from the bet slip flow                                   |
| Parlay support           | Complete | 2–12 leg entry, settlement, grading, and statistics; PR #41                                       |
| Grading workflow         | Complete | WIN/LOSS/PUSH/VOID straight and parlay grading with admin override; PRs #37, #38, and #41         |
| Profit/loss and units    | Complete | Central American-odds payout and settlement helpers; PR #37                                       |
| ROI and record           | Complete | Straight plays and parlay positions feed the shared statistics layer without double-counting legs |
| Audit trail              | Complete | Append-only manual, automatic, and override grading records; PRs #37–#39                          |
| Performance calculations | Complete | Overall, per-sport, streak/form, trend, and trailing-window calculation helpers; PR #40           |

Phase 1 intentionally retains manual grading for outcomes the automatic matcher cannot
resolve confidently. The automatic matcher currently handles moneyline and game totals;
unsupported or ambiguous markets remain pending for admin review.

## Acceptance gate

The milestone is ready to close after all of these checks pass:

- [x] Formatting, lint, typecheck, and production build run in CI.
- [x] Unit tests are enforced by CI.
- [ ] Production smoke: authenticated user selects a live board price and submits a straight play.
- [ ] Production smoke: authenticated user submits a parlay.
- [ ] Production smoke: admin grades WIN, LOSS, PUSH, and VOID outcomes.
- [ ] Production smoke: live provider settles a supported moneyline or total.
- [ ] Production smoke: manual fallback handles an unsupported or ambiguous market.
- [ ] Production smoke: units, ROI, record, dashboard, and leaderboard update correctly.
- [ ] Production smoke: every grade and override creates the expected audit record.

## Deferred enhancements

These improvements are not required by the approved Milestone 2 definition:

- Scheduled unattended auto-grading
- Automatic spread and prop settlement
- Native sportsbook account integrations
- Native payments
- Advanced performance visualizations

They must be scoped as later work rather than silently expanding Milestone 2.
