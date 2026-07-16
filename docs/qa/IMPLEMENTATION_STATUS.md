# Implementation Status — Milestone Blockers Branch

**Branch:** `fix/milestone-blockers-g0a-j`  
**Spec:** `docs/qa/SCL_GPT_CLAUDE_DELIVERABLES.md`  
**Verified:** `npm run typecheck` + `npm run test` (194+) green as of last local run.

## Shipped on this branch

| Area                                           | Status                                     |
| ---------------------------------------------- | ------------------------------------------ |
| Auto-grade cron `/api/cron/grade` every 30m    | Done — set `CRON_SECRET` in Vercel         |
| Spread + eventId matching; sport-scoped scores | Done                                       |
| Parlay auto-settle after legs grade            | Done                                       |
| QA handle + &lt;0.25U public exclusion         | Done                                       |
| Track Your Record / Start Tracking CTAs        | Done                                       |
| 4U/5U chips; Pending label; Logged tier        | Done                                       |
| Verified badge (no 100% text)                  | Done                                       |
| Odds purpose logging + circuit-break helper    | Done                                       |
| Pick analysis field + moderation               | Done (straight; parlay-level needs DB col) |
| League Action categories                       | Done                                       |
| Yesterday's Graded Wins ticker                 | Done (hides until real wins)               |
| ROI Leaders horizontal layout                  | Done                                       |
| Soccer league registry stub                    | Done (not wired into picker)               |
| Book monogram SVGs + BookMark in rail/slip     | Done                                       |

## Deploy checklist (owner)

1. Merge/PR this branch (do not push main directly).
2. Vercel env: `CRON_SECRET=<strong secret>`, confirm `ODDS_API_KEY`.
3. After deploy, manually `GET /api/cron/grade` with Bearer once to clear backlog, or wait for cron.
4. Confirm GamePicker board populates (odds empty board was observed pre-fix — may be slate/key).

## Still deferred

| Item                              | Why                                                      |
| --------------------------------- | -------------------------------------------------------- |
| CLV columns + closing snapshots   | Needs Supabase SQL additive columns + cron purpose=`clv` |
| OddsUsageDaily DB table           | Optional persistence beyond console logs                 |
| Real trademark book logos         | Monograms shipped; swap SVGs when legal OK               |
| Soccer GamePicker enable          | Validate Odds API keys live first                        |
| Parlay analysis column            | No `Parlay.notes` without migration                      |
| Analysis immutability after grade | No update path today — add if edit UI appears            |

## Author note

Commits on this repo should use `chase4sichi@gmail.com` for Vercel CI if that email gate is still enforced.
