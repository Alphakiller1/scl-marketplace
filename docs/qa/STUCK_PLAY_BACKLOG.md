# Stuck play backlog (Task B) — READ ONLY / OWNER DECISION

## Status

**STOP:** Do not auto-settle or void these plays until the owner chooses.

After `fix/grade-cron-diagnostics` deploys, hit cron (Bearer `CRON_SECRET`) or
open `/admin/grading` — the response/UI lists aged-out PENDING rows with:

`id, handle, sport, market, selection, odds, units, eventId, eventStartsAt`.

Paste that inventory into the PR description / below when available.

### Inventory (fill from cron `stuckPlays` or admin diagnostics)

| id               | handle | sport | market | selection | odds | units | eventId | eventStartsAt |
| ---------------- | ------ | ----- | ------ | --------- | ---- | ----- | ------- | ------------- |
| _pending deploy_ |        |       |        |           |      |       |         |               |

## Historical scores research (do not enable without approval)

| Question                                            | Finding                                                                                                                                                       |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Does `/v4/historical/sports/{sport}/scores` exist?  | **No.** Odds API docs expose historical **odds** snapshots only (`/v4/historical/sports/{sport}/odds`), paid plans, ~10 credits × regions × markets per call. |
| Live scores lookback                                | `GET /v4/sports/{sport}/scores?daysFrom=1..3` — **max 3 days**, cost **2 credits** when `daysFrom` is set.                                                    |
| Can historical odds settle WIN/LOSS?                | **No** — odds snapshots are prices, not final scores.                                                                                                         |
| Credit impact of inventing a historical-scores path | N/A (endpoint not offered). Enabling historical **odds** would burn credits without settling plays.                                                           |

**Recommendation:** do **not** spend Issue-14 budget on historical odds for this backlog. Choose:

1. **Manual settle** each play from official box scores via admin grading UI → `grading.action.ts` with source **`MANUAL`** (never `AUTO`).
2. **Void** and exclude from records (same MANUAL audit trail, outcome VOID if supported — or PUSH/admin policy).

Owner must pick (1) or (2). Implementers must not invent AUTO grades for aged-out rows.
