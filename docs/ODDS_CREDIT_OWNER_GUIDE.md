# SCL API Credit Dashboard — Owner Guide

Open **Admin → API Credits**. The page is organized into Usage, Guardrails,
Sports & Markets, and Activity. Provider credentials are never displayed or
sent to the browser.

## Read the dashboard

- **Used today/week/month** comes from provider response headers and includes
  board, verification, results, and CLV purposes.
- **Provider remaining** is the latest balance reported by the provider. A
  balance older than 24 hours is labeled stale.
- **Projected month** extends the current calendar-month burn rate through the
  end of the month.
- Orange points identify daily spikes against the prior seven-day average.
- Market reporting is exact for requests recorded after the credit-control
  migration. Historical aggregate usage is not guessed.

## Change the strategy safely

1. Leave **Pause optional API pulls** on while editing.
2. Set the daily, weekly, monthly, and per-run hard limits. The per-run limit
   must not exceed the daily limit.
3. Keep enough **Protected reserve** for results and pick verification.
4. Open each sport and choose standard markets, expanded market groups,
   leagues, event caps, and separate refresh cadences.
5. Save the strategy. The Activity panel records the administrator and every
   changed value.
6. Use **Dry run** first. It validates the saved strategy and guardrails without
   calling the provider or spending credits.
7. When the dry run passes, turn off Pause and save. Use **Run now** only when an
   immediate refresh is needed; otherwise the next scheduled time applies.

All displayed schedules use Eastern Time and automatically change between EST
and EDT. The scheduler itself stores instants in UTC to prevent daylight-saving
ambiguity.

## What stops spending

A run cannot start if its reservation would exceed the per-run, daily, weekly,
or monthly limit; overlap an active reservation beyond those limits; or breach
the current provider reserve. The provider circuit breaker also stops later
calls when a live response reports insufficient credits. Blocked and failed
runs remain visible in Activity with their reason.

Pausing optional population does not pause results settlement or pick
verification. Those integrity operations retain access to the protected
reserve.

## Recommended rollout

Use a staging database and provider key first. Apply the migration, keep managed
scheduling paused, save a small one-sport strategy, run a dry run, then perform
one low-cost standard-board Run now. Confirm exact market usage, actual versus
estimated cost, provider remaining, board freshness, and the audit change list
before enabling the production scheduler.
