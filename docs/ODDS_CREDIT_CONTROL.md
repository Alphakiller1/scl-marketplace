# API Credit Control

The admin workspace at `/admin/odds` is SCL's owner control plane for The Odds
API. It reports existing daily usage and stores future owner-managed population
rules without exposing provider keys to the browser.

## Safe rollout

`OddsControlConfig.managedSchedulingEnabled` defaults to `false`. In that state:

- the new 15-minute dispatcher is a zero-credit no-op;
- the six existing `odds-populate` production schedules continue unchanged;
- admins can inspect the dashboard after the migration, but no owner rule can
  alter provider activity until the rollout switch is explicitly saved.

Once an owner enables managed scheduling, legacy population calls return
`managed_scheduler_active` without reaching the provider. The dispatcher then
claims due surface or expanded work from `OddsSportControl` and calls the same
signed population route with validated market and league headers.

Do not enable the switch until the migration has been applied and the owner has
reviewed every enabled sport, market group, cadence, event cap, and credit limit.
The initial strategy preserves the existing five-sport production footprint;
additional supported sports are visible but disabled until an owner opts in.

## Guardrails

Before a managed run begins, its conservative maximum cost is reserved inside a
serializable database transaction. Completed usage plus active reservations must
fit the per-run, daily, rolling-seven-day, and calendar-month limits. Usage
dates and limit resets use UTC, matching `OddsUsageDaily`; owner-facing
timestamps are rendered in `America/New_York` with automatic EST/EDT handling. The latest provider
balance, when observed within 24 hours, must also retain the configured
protected reserve. Older provider balance data is treated as unknown so a
retired key cannot block every future key; the provider-aware circuit breaker
still stops subsequent calls once a live response reports the active balance.
A rejected run is recorded as `BLOCKED`; it never calls the provider.

Results and pick verification do not run through the optional population
dispatcher. Pausing board population therefore does not disable settlement or
the protected integrity path.

## Reporting

`OddsUsageDaily` remains the source of truth for credits by day, sport, and
purpose. `OddsUsageMarketDaily` records exact response-level cost attribution
for every requested market key, including the one-credit market catalog probe.
This instrumentation begins with this migration; older aggregate rows cannot be
reliably reconstructed by market. `OddsApiRun` adds estimated versus actual
cost, selected markets, leagues, execution status, processed/skipped counts,
provider status, and error detail for managed runs.

Every settings save, immediate run, and zero-credit dry run creates an append-only
`OddsControlAuditEvent` with the acting administrator.

## Owner operations

- **Run now** reserves the estimated maximum inside the same serializable
  guardrail transaction as scheduled work, then executes immediately.
- **Dry run** performs the same configuration and guardrail evaluation, records
  the estimate and result, and never calls the provider.
- Provider balance is considered current for 24 hours. A stale observation is
  clearly labeled and does not permanently block a replacement key.
- Usage spikes are days at least 10 credits above and at least twice the prior
  seven-day average.

See `docs/ODDS_CREDIT_OWNER_GUIDE.md` for the owner-facing operating procedure.

## Pre-production verification

Use a staging database and provider key before any production rollout:

1. Apply the migration and load `/admin/odds` as an administrator.
2. Leave managed scheduling off and confirm the dispatcher reports `disabled`.
3. Save a reviewed strategy with population paused; confirm the activity event.
4. Enable managed scheduling while still paused; confirm legacy population is
   skipped and the dispatcher reports `paused`, with zero provider spend.
5. Enable one low-cost surface tier with a small limit, unpause, and verify one
   completed run, its actual usage, and its audit/history display.
6. Disable managed scheduling and confirm the legacy cadence becomes
   authoritative again.

Do not treat a successful build as a substitute for this database-backed,
authenticated staging exercise.
