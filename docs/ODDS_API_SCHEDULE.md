# Odds API call schedule

Owner-facing reference for when SCL spends The Odds API credits, and what a
capper sees when the board is stale.

Prices on the pick form are **not live ticks**. They come from the last
successful provider call for that sport. The form says so:

> Showing odds from the last API call. Prices may have moved.

## What actually runs today

Two jobs exist. Only the **populate** job is on a clock.

| Job               | Workflow                                                       | Cadence (America/New_York)                                                            | What it warms                                                                                                                                                                                                                                                       |
| ----------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Surface populate  | `.github/workflows/populate-odds.yml` plus `vercel.json` crons | **08:00 ET** and **20:00 ET** daily                                                   | Game lists + basic prices (`h2h` / spreads / totals) for the default sports below. Tennis is fetched before NFL so a cheap Masters board is not skipped after NFL burns the key. GitHub’s scheduled workflow can miss a tick; Vercel hits the same route as backup. |
| Strategic refresh | `.github/workflows/odds-refresh.yml`                           | **Paused** — `workflow_dispatch` only (owner request while credits are under control) | Expanded per-event boards (44 credits/MLB event). Restoring the clock requires all five UTC times in that file; a two-run day misses MLB day games                                                                                                                  |

Scheduled populate calls:

`POST /api/cron/odds-populate?sports=MLB,WNBA,TENNIS,SOCCER,NFL&expanded=0&surface=1`

`expanded=0` on the clock: tomorrow’s MLB/WNBA event boards are **not** rebuilt
on the schedule. They stay on the last-good cache (up to 30 days) unless someone
runs the workflow by hand.

## By sport — scheduled surface refresh

| SCL sport     | 08:00 ET | 20:00 ET | Notes                                                                                                                                       |
| ------------- | -------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| MLB           | yes      | yes      | Default populate sport. Expanded event boards only on manual dispatch                                                                       |
| WNBA          | yes      | yes      | Same as MLB                                                                                                                                 |
| NFL           | yes      | yes      | Includes preseason when the provider is carrying it                                                                                         |
| Tennis        | yes      | yes      | In-season ATP/WTA tournaments from the Odds API catalog, ranked by fixtures so Cincinnati is not dropped when the US Open is already listed |
| Soccer        | yes      | yes      | MLS / Liga MX / Leagues Cup / La Liga / Primeira Liga / UCL qualification as covered                                                        |
| NBA           | —        | —        | No scheduled populate; board uses last cache + on-demand event fetch                                                                        |
| NCAAF / NCAAB | —        | —        | Same                                                                                                                                        |
| NHL           | —        | —        | Same                                                                                                                                        |
| CFL / UFL     | —        | —        | Same                                                                                                                                        |
| MMA / Boxing  | —        | —        | MMA has a strategic slot (daily + before first fight) that only runs when the paused refresh job is dispatched                              |
| PGA / NASCAR  | —        | —        | Same                                                                                                                                        |

Times above are Eastern. The GitHub cron strings are UTC (`0 12 * * *` and
`0 0 * * *`) and therefore shift one hour relative to ET when daylight time
ends.

## On-demand (not a schedule)

Opening a matchup in the pick form can fetch that event’s markets when the
cached event board is missing or stale. That is a **per-event** credit spend,
not a league-wide refresh, and it is why a capper can still log a verified
price between the two daily surface runs.

Props stay lazy. They are not part of the twice-daily surface populate.
The MLB event bundle includes pitcher earned runs plus batter hits, total
bases, home runs, RBIs, runs scored, and hits+runs+RBIs. Opening a matchup
loads these when covered books have posted them.

## If we turn strategic refresh back on

Do **not** restore a subset of the five times. The minimum that still hits
every `before-first` window (`src/lib/strategic-odds-policy.ts`, 240-minute
lead) is:

| UTC cron     | ET (EDT) |
| ------------ | -------- |
| `0 12 * * *` | 08:00    |
| `0 16 * * *` | 12:00    |
| `0 20 * * *` | 16:00    |
| `0 0 * * *`  | 20:00    |
| `0 3 * * *`  | 23:00    |

Cadence is not the credit lever — **what each run warms** is (expanded MLB is
the expensive path). `src/lib/strategic-odds-cadence.test.ts` fails if those
times and the lead window drift.
