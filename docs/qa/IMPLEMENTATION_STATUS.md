# Implementation Status — Milestone Blockers Branch

**Branch:** `fix/milestone-blockers-g0a-j`  
**Spec:** `docs/qa/SCL_GPT_CLAUDE_DELIVERABLES.md`  
**SQL patches:** `docs/qa/SUPABASE_SQL_PATCHES.md` (owner runs in Supabase SQL Editor)

## Shipped on this branch

| Area                                                                   | Status                                          |
| ---------------------------------------------------------------------- | ----------------------------------------------- |
| Auto-grade cron `/api/cron/grade` + CLV snapshot pass                  | Done — Vercel daily (Hobby) + GH Actions `*/30` |
| Spread + eventId matching; sport-scoped scores                         | Done                                            |
| Parlay auto-settle after legs grade                                    | Done                                            |
| Props auto-grade deferred (`props_deferred` log)                       | Done — left Pending until stats provider        |
| QA handle + &lt;0.25U public exclusion + dashboard invalid-stake badge | Done                                            |
| Track Your Record / Start Tracking CTAs                                | Done                                            |
| 4U/5U chips; Pending label; Logged tier                                | Done                                            |
| Verified badge (no 100% text on leaderboard)                           | Done                                            |
| Odds purpose logging + circuit-break + `OddsUsageDaily` upsert         | Done — needs SQL table                          |
| Pick analysis + `notesPublic` toggle                                   | Done — needs SQL column                         |
| Grading health honesty on public tickets                               | Done                                            |
| CLV schema + compute + profile avg CLV + explainer                     | Done — needs SQL columns                        |
| Soccer GamePicker (`SOCCER` + league fan-out)                          | Done                                            |
| Odds board diagnostics meta on `GET /api/odds`                         | Done                                            |
| BookMark on slip, list, ticket, market-chip, profile books             | Done                                            |
| Leaderboard row declutter + Building A Record compact rows             | Done                                            |
| Legal pages (no placeholder footer)                                    | Done                                            |
| SEO templates (/, leaderboard, picks, capper profile)                  | Done                                            |
| League Action + Yesterday ticker + ROI layout                          | Done                                            |

## Owner deploy checklist

1. Merge/PR this branch (do not push `main` directly).
2. Run SQL in `docs/qa/SUPABASE_SQL_PATCHES.md` in Supabase SQL Editor.
3. Vercel env: `CRON_SECRET`, confirm `ODDS_API_KEY`.
4. GitHub repo secrets: `CRON_SECRET` (+ optional `CRON_GRADE_URL`) so `.github/workflows/grade-cron.yml` can ping every 30m (Hobby cannot run `*/30` on Vercel).
5. After deploy, `GET /api/cron/grade` with Bearer once to clear backlog + warm CLV snapshots.
6. Confirm GamePicker populates (empty board now distinguishes key vs slate vs circuit-break via `meta.warning`).

## Still deferred / out of scope

| Item                            | Why                                              |
| ------------------------------- | ------------------------------------------------ |
| Rank-by-CLV leaderboard sort UI | Data stored; sort UI skipped per easy-path rule  |
| Parlay-level analysis column    | No `Parlay.notes` without separate migration     |
| Real trademark book logos       | Monograms shipped                                |
| Soccer 3-way ML auto-grade      | Gated until draw/home/away settlement keys exist |
| Analysis edit after grade       | No edit UI path today                            |

## Author note

Commits on this repo should use `chase4sichi@gmail.com` for Vercel CI if that email gate is still enforced.
