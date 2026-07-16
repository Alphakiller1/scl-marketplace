# Stuck play backlog — historical scores

## Solution shipped

Odds API has **no** historical scores endpoint. SCL composites:

1. The Odds API scores (`daysFrom≤3`, credits)
2. **ESPN public scoreboard** (last **14 days**, $0 credits)

Provider name: `the-odds-api+espn-scoreboard`. All-Star labels map
`American/National All-Stars` → `American/National League`.

## Still not auto-gradeable (admin MANUAL)

- **First Five Innings / F5 / innings** — deferred (full-game ≠ F5)
- Totals whose matchup never occurred that day — `event_not_found`

Grade or void those via `/admin/grading` with source **MANUAL**.
