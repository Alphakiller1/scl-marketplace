# SCL API Credit Dashboard — Quick Owner Manual

Open **Admin → API Credits**.

## Choose an 80K–95K owner playbook

The dashboard includes three preview-only starting points. Their 31-day
forecasts assume every cadence slot runs and every expanded pull reaches its
event cap, so actual usage may be lower when fresh boards are skipped.

| Playbook             | Modeled monthly usage | Allocation left | Best use                                     |
| -------------------- | --------------------: | --------------: | -------------------------------------------- |
| Efficient 80K        |                80,972 |          19,028 | Broad access with the most recovery room     |
| Demand-balanced 88K  |                88,040 |          11,960 | Recommended balance of freshness and reserve |
| Maximum coverage 95K |                94,736 |           5,264 | Highest safe cadence with tight monitoring   |

Each playbook card shows separate Standard and Expanded cadence for every
enabled sport. Loading a playbook does not activate or save it.

Use **Export current playbook** to download a Markdown file containing the
current forecast, every sport cadence, markets, leagues, guardrails,
verification policy, and activation checklist. Export after any edits if the
owners need a record of the exact plan under review.

## 1. Check usage before changing anything

- **Used today / week / month:** credits already consumed.
- **Provider remaining:** credits reported by the odds provider.
- **Projected month:** expected month-end use at the current pace.
- **Credits by sport / purpose / market:** where credits are going.
- **League pick demand:** unique active cappers and pick volume by league over
  the last 30 days. Give priority to leagues with broad capper demand—not just
  one capper posting many picks.

If the provider says **Exhausted**, optional odds pulls will not run even when
the scheduler is enabled.

## 2. Set safety limits

Under **Credit guardrails**, set:

- **Daily, weekly, and monthly limits:** maximum allowed use.
- **Per-run limit:** maximum one job may reserve.
- **Protected reserve:** credits held for results and pick verification.
- **Warning threshold:** when the dashboard should warn owners.

The system blocks a run before it exceeds a hard limit or protected reserve.

### Verification controls

Use **Verification controls** to manage live per-event price checks separately:

- **Allow live verification requests:** master on/off switch for new checks.
- **Daily verifications:** maximum number of provider-check attempts per day.
- **Daily verify credits:** verification-only daily credit budget.
- **Credits per verification:** blocks an unusually large single check.
- **Reuse window:** how long a result can be reused; a longer window reduces repeat calls.

These settings do not disable results grading. Expanded-board population is
reported and controlled as Board usage, not Verification.

### Schedule slate or league verification

In **Slate & league verification schedules**:

1. Name the schedule and choose a sport.
2. Choose **Whole slate**, or **One league** for soccer and tennis.
3. Select standard lines, the sport's currently configured markets, or all supported markets.
4. Set the maximum events. Use `99` when the intent is the entire available slate.
5. Choose **Run once** with an Eastern date/time, or **Repeat weekly** with weekdays and an Eastern time.
6. Review the maximum-credit preview, then create the schedule.

Due schedules run within five minutes of their selected time. Pause or resume a
recurring schedule from the saved-schedule list. The verification-specific and
overall credit limits can block a run before it spends credits.

## 3. Choose coverage

Open each sport under **Sports, markets & cadence**:

1. Turn the sport on or off.
2. Enable **Standard** and/or **Expanded** coverage.
3. Select only the markets SCL needs.
4. Select leagues where available.
5. Set the maximum events per run.
6. Set separate refresh timing for Standard and Expanded coverage.

More markets, leagues, events, and frequent refreshes use more credits.

## 4. Activate safely

1. Turn on **Owner-managed scheduling**.
2. Keep **Pause optional API pulls** on while reviewing settings.
3. Click **Save API strategy**.
4. Open a sport and run **Dry run**. It checks the strategy without spending
   credits.
5. If the estimate is acceptable, turn Pause off and save again.
6. Use **Run now** only when an immediate refresh is necessary.

All schedules are displayed in Eastern Time and follow daylight-saving changes.

## 5. Confirm the result

Use **Activity & change history** to verify:

- what ran and whether it completed, failed, or was blocked;
- estimated versus actual credits;
- markets, leagues, events processed, and skipped work;
- who changed the strategy and what changed.

## Recommended testing setup

Start with one sport, Standard coverage, a small event cap, a conservative
per-run limit, and a Dry run. Confirm the estimate and league demand before
adding Expanded markets or shortening the refresh cadence.

Pausing optional pulls does **not** stop results settlement or pick verification.
