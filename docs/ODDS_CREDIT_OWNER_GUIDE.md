# SCL API Credit Dashboard — Quick Owner Manual

Open **Admin → API Credits**.

## The one rule the screen is built around

Every setting has a **scope**, and the scope is what decides who a change
affects:

- **Universal** — applies to every league at once. Marked _All leagues_.
- **League** — belongs to one league and **overrides the universal value for
  that league only**. Marked _League override_. Every other league keeps the
  universal value.

A league setting that has never been changed shows as _Inherited_: it is
following the universal default and will keep following it if that default
changes.

**The credit limits and the protected reserve are the exception.** They are one
shared pool of credits and one provider balance, so they are universal and no
league can raise its own. The first league to reach the per-day limit stops every
other league for the rest of the day.

A few values are marked _Set in code_. They explain a league's cost — for
example, soccer ships with a higher event cap because one expanded soccer
fixture costs a single market — but changing them takes a deploy, not this
screen.

## 1. Read the active configuration

**Active configuration** lists everything in force right now, so you never have
to open each league to find out what is set:

- **Universal — spend and safety:** the shared limits, reserve and verification
  policy.
- **Universal — coverage defaults:** what a league uses until it is given its
  own value. Each row names the leagues currently overriding it.
- **By league:** one card per league. Enabled leagues come first, then the ones
  that can spend the most per cycle. A league with an override opens by default,
  and each row shows its value next to the universal value it replaced.
- **League pick demand:** unique active cappers and pick volume by league over
  the last 30 days. Give priority to leagues with broad capper demand—not just
  one capper posting many picks.

## 2. Check status and usage

The status band at the top carries provider remaining, when the balance was last
observed, how many leagues are enabled, and the projected 30-day total.

**Usage & budget** measures what that configuration actually spent: used today,
last 7 days and last 30 days, the projected 30-day total, the 30-day chart, and
credits by league, by purpose and by market.

If the provider says **Exhausted**, optional odds pulls will not run even when
the scheduler is enabled.

## 3. Change universal settings

Under **Change settings → Universal**:

- **Scheduling authority:** whether this dashboard controls API pulls at all,
  and the pause switch that stops every league at once.
- **Credit guardrails:** the per-day, per-7-day and per-30-day ceilings, the
  per-run limit, the protected reserve, and the warning threshold. Both longer
  windows **roll** — per-7-days means the last 7 UTC days including today, and
  per-30-days the last 30. They are not a calendar week or month, so a heavy day
  keeps counting against you until it ages out rather than being forgiven on the
  1st. Shipped values are **2,000 / 25,000 / 100,000**, matching the 100,000
  provider plan.
- **Verification controls:** the master switch for live per-event price checks,
  the daily attempt and credit budgets, the per-check ceiling, and the reuse
  window. A longer reuse window is the single largest lever on verification
  spend.

These settings do not disable results grading. Expanded-board population is
reported and controlled as Board usage, not Verification.

## 4. Change one league

Under **Change settings → Leagues**, open a league:

1. Turn the league on or off.
2. Enable **Standard** and/or **Expanded** coverage.
3. Select only the markets SCL needs.
4. Select competitions where available (soccer and tennis).
5. Set the maximum events per run.
6. Set separate refresh timing for Standard and Expanded coverage.

Anything you leave alone keeps the universal value. More markets, competitions,
events and frequent refreshes use more credits — and every league draws from the
same pool.

### Schedule slate or league verification

In **Slate & league verification**:

1. Name the schedule and choose a sport.
2. Choose **Whole slate**, or **One league** for soccer and tennis.
3. Select standard lines, the sport's currently configured markets, or all supported markets.
4. Set the maximum events. Use `99` when the intent is the entire available slate.
5. Choose **Run once** with an Eastern date/time, or **Repeat weekly** with weekdays and an Eastern time.
6. Review the maximum-credit preview, then create the schedule.

Due schedules run within five minutes of their selected time. Pause or resume a
recurring schedule from the saved-schedule list. The verification-specific and
overall credit limits can block a run before it spends credits.

## 5. Activate safely

1. Turn on **Owner-managed scheduling**.
2. Keep **Pause optional API pulls** on while reviewing settings.
3. Click **Save API strategy**.
4. Open a league and run **Dry run**. It checks the strategy without spending
   credits.
5. If the estimate is acceptable, turn Pause off and save again.
6. Use **Run now** only when an immediate refresh is necessary.

All schedules are displayed in Eastern Time and follow daylight-saving changes.

## 6. Confirm the result

Use **Activity & change history** to verify:

- what ran and whether it completed, failed, or was blocked;
- estimated versus actual credits;
- markets, leagues, events processed, and skipped work;
- who changed the strategy and what changed.

## Recommended testing setup

Start with one league, Standard coverage, a small event cap, a conservative
per-run limit, and a Dry run. Confirm the estimate and league demand before
adding Expanded markets or shortening the refresh cadence.

Pausing optional pulls does **not** stop results settlement or pick verification.
