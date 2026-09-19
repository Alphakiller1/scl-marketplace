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
3. Select only the markets SCL needs. Each expanded market has its own switch;
   the group switch is a shortcut that selects or clears every market in that
   group.
4. Select competitions where available (soccer and tennis).
5. Set the maximum events per run.
6. Set separate refresh timing for Standard and Expanded coverage.
7. **Verifications per event, per day** — how many times one event of this
   league may be re-priced, counted from 8am ET. The default is 3, which is what
   the schedule spends: one the day before, one at 8am and one at 3pm. **4 is
   the ceiling and no league may go above it.**

Anything you leave alone keeps the universal value. More markets, competitions,
events and frequent refreshes use more credits — and every league draws from the
same pool.

For **NCAAF alternate spreads and totals**, enable NCAAF, enable **Expanded**
coverage, and select **Alternate game lines**. Save the strategy, run **Dry run
expanded**, review the estimate, and only then use **Run expanded now** or allow
the saved expanded cadence to run. That expanded pass also refreshes the
featured NCAAF board (so DraftKings moneyline/spread/total prices land) and
looks a week ahead — Saturday's card is buyable on Thursday, not only Friday
afternoon.

For **NFL Anytime Touchdown**, enable NFL, enable **Expanded** coverage, open
**Player props**, and turn on **Anytime Touchdown**. The group-level **select
all** switch remains available, but is not required. Save the strategy and run
**Dry run expanded** before the first paid run. Anytime Touchdown is intentionally
off for an existing saved strategy until an owner selects and saves it.

### Team-total ladders (MLB)

The alternate team-total ladder — each club's Over/Under from 0.5 up, including
the Over 2.5 cappers ask for most — is posted game by game, mostly by Caesars,
and often hours after the rest of the card. SCL now handles that on its own:

- A game counts as covered only when **both** clubs carry their own ladder.
- When the ladder is the only thing missing, SCL asks for team totals alone (one
  or two credits a game), adds the new lines to the board, and leaves every
  price already on it untouched. This does **not** use the game's daily
  verification allowance.
- It retries each thin game at most once an hour and at most 8 times per buy
  day (counted from 8am ET), then leaves that game until the next day.

To fill them immediately, open **MLB** and press **Fill team-total ladders**. It
only asks about games still missing a ladder, and reports how many it filled and
how many no book has posted yet. It is refused if team totals are switched off
for the league.

### Scheduled verification runs

A verification run re-prices events from the provider so cappers see current
lines. Each run spends credits.

1. Name the schedule and choose a sport.
2. **Which events** — only soccer and tennis ask, because only they are split
   into separately billed competitions. Every other sport is one league, and the
   field says so instead of offering a choice with one answer.
3. **Markets to price** — game lines only (three credits an event), whatever
   that sport is configured to pull, or every market SCL supports.
4. **How many events** — _All events on the slate_, or a set number. Events are
   taken in kickoff order, soonest first.
5. **When it runs** — _One time, on a date I pick_, or _Every week, on days I
   pick_. Select all seven days for a daily run.
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
