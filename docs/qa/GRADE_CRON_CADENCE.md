# Grade cron cadence — options (Task C)

## Observed reality

`.github/workflows/grade-cron.yml` requests `*/30 * * * *`, but GitHub Actions
**throttles** scheduled workflows on free/standard plans. Recent production
pings clustered every **~1.5–2.5 hours**, not 30 minutes.

`vercel.json` already has a Hobby-safe daily fallback: `0 8 * * *` →
`/api/cron/grade`.

**Conclusion:** a “graded within 60 minutes of final” acceptance criterion is
**not achievable** on the current GH Actions + Vercel Hobby setup without an
external pinger or a paid Vercel plan.

## Options (owner chooses)

| Option                   | Cadence                                                                                                     | Cost / ops | Tradeoff                                        |
| ------------------------ | ----------------------------------------------------------------------------------------------------------- | ---------- | ----------------------------------------------- |
| **(a) Accept ~2h**       | Rewrite SLA to “usually within 3h of final, best-effort”                                                    | $0         | Honest; cliff risk higher if outages >2 days    |
| **(b) External pinger**  | Upstash QStash / cron-job.org → `GET /api/cron/grade` with `Authorization: Bearer CRON_SECRET` every 15–30m | Low $      | Restores near-30m without Vercel Pro            |
| **(c) Vercel Pro crons** | Real `*/30` (or tighter) in `vercel.json`                                                                   | Pro plan   | Simplest ops; removes GH Actions grade workflow |

## Cliff early-warning (shipped with diagnostics)

Any PENDING play with `eventStartsAt` older than
`(RESULTS_LOOKBACK_DAYS - 1)` = **2 days** increments `health.cliffRisk` on
the cron JSON. That is the guardrail that would have flagged the July 13
backlog before the 3-day Odds API scores window made it permanently
`aged_out`.

Do **not** unilaterally enable historical scores (paid) — see Task B.
