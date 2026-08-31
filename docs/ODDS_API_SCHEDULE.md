# Odds API call schedule

Owner-facing reference for when SCL spends The Odds API credits, and what a
capper sees when the board is stale.

Prices on the pick form are **not live ticks**. They come from the last
successful provider call for that sport. The form says so:

> Showing odds from the last API call. Prices may have moved.

## What actually runs today

The owner-managed control plane is documented in
[`ODDS_CREDIT_CONTROL.md`](ODDS_CREDIT_CONTROL.md). Its dispatcher checks every
15 minutes but defaults to a zero-credit no-op. Until an owner explicitly
enables managed scheduling, the fixed cadence below remains authoritative.

The paid cadence lives in **`vercel.json`**. It runs inside the deployment that
holds the provider keys, and it fires on time.

| UTC          | ET (EDT) | Surface | Expanded | Purpose                                                  |
| ------------ | -------- | ------- | -------- | -------------------------------------------------------- |
| `0 11 * * *` | 07:00    | yes     | —        | Prices only, before the 08:00 ET buy day opens           |
| `0 15 * * *` | 11:00    | yes     | today    | **Buy 1 of 2** — build the day's expanded board          |
| `0 18 * * *` | 14:00    | yes     | —        | Prices only, afternoon move                              |
| `0 21 * * *` | 17:00    | yes     | today    | **Buy 2 of 2** — prop cards and alternate ladders are up |
| `0 23 * * *` | 19:00    | yes     | —        | Prices only, as the evening slate starts                 |
| `0 3 * * *`  | 23:00    | yes     | tomorrow | Build tomorrow's board                                   |

## An event is bought at most three times a day

This is the rule the bill turns on, and it is enforced as a **count**, not an
age. Measured 2026-08-30, a fifteen-game MLB slate was being bought 87–130 times
a day — six to eight times per game at ~50 credits a call — which was 83% of the
entire provider bill. Scheduled runs are only one source of those buys; a capper
opening a matchup is another. No cadence setting can bound a number that other
paths are free to add to.

So every paid refresh of an event board is logged on the board's own snapshot,
and `MAX_EVENT_BUYS_PER_DAY` (3) refuses the next one. A refused buy returns the
cached board flagged stale rather than an empty one — hours-old prices beat
paying fifty markets for a line that has barely moved.

**The buy day starts at 08:00 ET, not midnight.** A midnight boundary would hand
the 23:00 ET build its own allowance: three daytime buys plus an overnight one is
four inside twenty-four hours, which is the behaviour being removed. Anchored at
08:00, the overnight build and the following day's two buys share one budget.

The two buys on a slate's own day both land after 08:00 ET, which is what the
cadence above encodes and `odds-population-schedule.test.ts` asserts. An owner
forcing a rebuild can pass `ignoreBuyCap=1`; nothing scheduled does.

Every expanded run carries `skipPopulated=1`, so an event whose card is already
complete costs nothing — but "complete" alone is not enough to skip it.
Completeness is permanent: a board filled once was skipped on every later run
and its prop and alternate prices never moved again. The 13:22 UTC populate on
2026-08-26 refreshed all five surface boards and skipped 13 of 15 MLB games as
covered, 11 of them serving expanded prices captured the previous evening.

So a covered board is also refetched once it ages past
`expandedMaxAgeMinutes` (set per cron URL; the workflow input still defaults to
120). The paid crons pass **330**, and that number is a budget decision.

At 120 the threshold sat below every gap between runs, so no board was ever
young enough to skip and each of the five paid runs re-bought the entire slate.
MLB asks for 58 markets per event, so a seven-game card cost ~400 credits a run
and ~2,000 a day for one sport — 6,485 credits went on MLB alone on 2026-08-26.
Five re-buys is not five times the coverage; it is the same board, five times.

At 330 the buys land at 03:00, 11:00 and 18:00 UTC and the 15:00 and 21:00 runs
skip boards that are still fresh. Prices still move morning, midday and evening,
every market and every fixture is still carried, and the deep-board spend drops
about 40%. Nothing about coverage changes: `canSkipExpandedEvent` returns false
for any board that is missing or only partly covered, so a fixture the books
posted after the last run is always fetched, whatever its age.

Surface boards are unaffected — every run still passes `surface=1` and refreshes
them, which is what the 4-hour freshness audit reads. Pass
`expandedMaxAgeMinutes=0` — or the workflow's `expanded_max_age_minutes` input —
to rebuild every board now.

Through the hours games are priced and played, no gap exceeds the four hours a
board is considered fresh for. The overnight gap is deliberately longer —
nothing starts between 23:00 and 07:00 ET, and the 03:00 UTC run has already
built the next day's board. `src/lib/odds-population-schedule.test.ts` enforces
both halves of that.

### Why the GitHub workflow no longer has a paid schedule

`.github/workflows/populate-odds.yml` used to run `0 12` and `0 0` against the
same endpoint `vercel.json` already hit at those minutes, so **every scheduled
surface refresh was billed twice for one board**. Vercel owns the schedule now.
The workflow keeps:

- **`audit`** — one scheduled run at 13:00 UTC that spends **nothing**
  (`expanded=0&surface=0` answers from the cache) and fails the job when the key
  is out of credits or a board has stopped moving.
- **`populate` / `populate-temp-key`** — manual, on demand.
- **`write-snapshots`** — replays an already-fetched slate into the database.

### What a run reports

`/api/cron/odds-populate` returns a `provider` block: `requestsRemaining`,
observed `capacity`, `exhausted`, how many sports were refreshed from the
provider, and which are stale. `ok` is false when a run that asked for fresh
prices got none.

That last part is not cosmetic. `ok` previously asked only whether the cached
board held events — which is true of yesterday's board too. When the production
key hit zero credits, every scheduled run reported success while writing
nothing: five sports came back `stale_provider_failure`, the job went green, and
the board silently stopped moving.

## Market depth by sport

Owner decision, and the shape of the credit bill. Depth is set in
`expandedBoardMarkets()` (`src/lib/odds-verify.ts`).

| Sport           | Expanded markets | What a capper can log                                                                                       |
| --------------- | ---------------- | ----------------------------------------------------------------------------------------------------------- |
| MLB             | 58               | Full pitcher and hitter cards with milestone ladders, alternate spreads/totals, team totals, F1/F3/F5/F7    |
| WNBA            | 36               | Points/rebounds/assists/threes, blocks/steals/turnovers, the combo card, halves, team totals, alt ladders   |
| Tennis          | 4                | Game spread and total plus their alternate ladders. Set markets stay out until set-score grading is trusted |
| Soccer          | 1                | Double Chance — the one soccer bet the three surface markets cannot express                                 |
| Everything else | 0                | Surface only: `h2h` / spreads / totals from the shared slate                                                |

### Keeping the bill down

The odds endpoint bills `markets x regions` **whether or not a market comes
back with anything**, so a fixed 58-key MLB request pays for every prop no book
posts. Two things stop that:

- **Catalog first.** `/events/{id}/markets` costs one credit and names the keys
  a covered book is actually pricing; only those are requested. Used where the
  request list is long enough to pay for itself (MLB, WNBA) and skipped where it
  is not (tennis's four keys, soccer's one) — see
  `CATALOG_WORTH_READING_MARKETS`.
- **Unpriced competitions are dropped mid-run.** Books post non-surface markets
  by competition, not by fixture. After two fixtures in a competition come back
  empty, the rest of it is left alone for that run — one populate had been
  paying a call for all twenty EFL Cup ties and getting Double Chance on none.

A fixture nobody prices never reaches full coverage, so `skipPopulated` alone
cannot learn to skip it. That is why the miss limit exists.

## On-demand (not a schedule)

Opening a matchup still fetches that event's markets on demand when the cached
board is missing or stale, which is how a capper logs a verified price between
scheduled runs. Props are no longer lazy-only, though: the expanded runs above
warm the full MLB and WNBA cards on a schedule.

Tennis surface calls request the featured game spread and total. The per-event
call additionally fetches the full-match alternate spread and total ladders.
Set-specific markets remain excluded until SCL has a trustworthy set-score
grading source.

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
