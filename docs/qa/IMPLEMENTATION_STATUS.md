# Implementation Status — Fable 5 / Milestone Blockers

**Spec:** `docs/qa/SCL_GPT_CLAUDE_DELIVERABLES.md`  
**SQL patches:** `docs/qa/SUPABASE_SQL_PATCHES.md` (owner runs in Supabase SQL Editor)  
**Main as of:** `#150` 3-slide hero (after `#143`–`#149` polish)

## Shipped on main

| Area                                                           | Status                                             |
| -------------------------------------------------------------- | -------------------------------------------------- |
| Auto-grade cron `/api/cron/grade` + CLV snapshot pass          | Done — Vercel daily (Hobby) + GH Actions `*/30`    |
| Spread + eventId matching; sport-scoped scores + ESPN fallback | Done                                               |
| Parlay auto-settle after legs grade                            | Done                                               |
| Props auto-grade deferred (`props_deferred` log)               | Done                                               |
| QA handle + &lt;0.25U public exclusion + invalid-stake badge   | Done                                               |
| Track Your Record / Start Tracking CTAs                        | Done — hero/bottom; founding apply on hero slide 1 |
| 4U/5U chips; Pending label; Logged tier                        | Done                                               |
| Verified badge (no 100% text; pink at ~100% share)             | Done                                               |
| Odds purpose logging + circuit-break + `OddsUsageDaily`        | Done — needs SQL table                             |
| Pick analysis + `notesPublic` toggle                           | Done — needs SQL column                            |
| Grading health honesty on public tickets                       | Done                                               |
| CLV schema + compute + profile avg CLV + explainer             | Done — needs SQL columns                           |
| **Rank-by-CLV leaderboard sort**                               | Done — `sort=clv`; signal sample + avgClv required |
| Soccer GamePicker (`SOCCER` + league fan-out)                  | Done                                               |
| Odds board diagnostics meta on `GET /api/odds`                 | Done                                               |
| BookMark monograms on slip/list/ticket/chips/profile           | Done                                               |
| Leaderboard row declutter + league monograms                   | Done                                               |
| Legal pages (no placeholder footer)                            | Done                                               |
| SEO templates + cold-start founding copy                       | Done                                               |
| Dynamic capper OG images (Inter tabular nums)                  | Done                                               |
| League Action Report (volume board + tabs)                     | Done                                               |
| ROI Leaders = Performance Leaderboard row chrome               | Done                                               |
| Yesterday / Recent graded wins ticker (horizontal marquee)     | Done — hide when empty; 7d fallback                |
| Homepage How Verification Works (top of content)               | Done                                               |
| 3-slide clickable hero + extended trophy art                   | Done                                               |
| UIX polish (empty states, BookRail taps, Ticket capture)       | Done                                               |
| Inter tabular data face (app UI)                               | Done                                               |

## Owner deploy checklist

1. Confirm SQL in `docs/qa/SUPABASE_SQL_PATCHES.md` applied (CLV, notesPublic, OddsUsageDaily).
2. Vercel env: `CRON_SECRET`, `ODDS_API_KEY`.
3. GitHub secrets: `CRON_SECRET` (+ optional `CRON_GRADE_URL`).
4. After deploys, Bearer-hit `/api/cron/grade` if backlog grows.
5. Ticker appears when any WIN exists in yesterday ET or last 7 days.

## Still deferred / out of scope

| Item                             | Why                                                                            |
| -------------------------------- | ------------------------------------------------------------------------------ |
| Real trademark league/book logos | SCL sport-icon / book monograms shipped; trademarks need licensed owner assets |
| Soccer 3-way ML auto-grade       | Gated until draw/home/away settlement keys                                     |
| Parlay-level analysis column     | Needs `Parlay.notes` migration                                                 |
| Analysis edit after grade        | No edit UI path; immutability locked                                           |

## Author note

Commits: `Alphakiller1 <chase4sichi@gmail.com>`. Never push `main` directly.
