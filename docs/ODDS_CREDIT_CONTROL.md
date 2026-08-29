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

## Guardrails

Before a managed run begins, its conservative maximum cost is reserved inside a
serializable database transaction. Completed usage plus active reservations must
fit the daily, rolling-seven-day, and calendar-month limits. The latest provider
balance must also retain the configured protected reserve. A rejected run is
recorded as `BLOCKED`; it never calls the provider.

Results and pick verification do not run through the optional population
dispatcher. Pausing board population therefore does not disable settlement or
the protected integrity path.

## Reporting

`OddsUsageDaily` remains the source of truth for credits by day, sport, and
purpose. `OddsApiRun` adds estimated versus actual cost, selected markets,
leagues, execution status, and error detail for managed runs. Market attribution
starts when managed runs are activated; older aggregate rows cannot be reliably
reconstructed by market.

Every settings save and manual queue request creates an immutable
`OddsControlAuditEvent` with the acting administrator.
