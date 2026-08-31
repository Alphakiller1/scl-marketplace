# SCL API Credit Dashboard — Quick Owner Manual

Open **Admin → API Credits**.

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
