/**
 * How many times one event's expanded board may be bought in a day.
 *
 * Cadence alone never enforced this. The scheduled runs are one source of
 * expanded buys; a capper opening a matchup is another, and pick submission a
 * third, so "how often the cron fires" and "how often we pay for this event"
 * are different numbers. Measured on 2026-08-30, a fifteen-game MLB slate was
 * being bought 87–130 times a day — six to eight times per game — at roughly 50
 * credits a call, which was 83% of the entire provider bill.
 *
 * A price that has moved between two buys four hours apart has not moved enough
 * to justify re-buying fifty markets, so the ceiling is a COUNT, not an age. An
 * age threshold cannot bound spend: every path that asks outside the window
 * pays again, and there is no limit on how many paths ask.
 *
 * The allowance is per league and per event: three a day by default, four at the
 * absolute most, spent by the schedule as one build the day before plus 08:00
 * and 15:00 ET on the day itself.
 */

const EASTERN_ZONE = "America/New_York";

/**
 * The ceiling no league may exceed, whatever it is configured for.
 *
 * A league can be given its own allowance, but not one above this — the cap
 * exists to bound the bill, and an override that could raise it without limit
 * would only move the problem behind one more setting.
 */
export const HARD_MAX_EVENT_BUYS_PER_DAY = 4;

/** The allowance a league gets unless it has been given its own. */
export const DEFAULT_EVENT_BUYS_PER_DAY = 3;

/**
 * The three the schedule plans for: one the day before, one at 08:00 ET and one
 * at 15:00 ET. Every sport runs on these same times.
 */
export const SAME_DAY_EXPANDED_RUNS = 2;

/**
 * A league's allowance, clamped into range.
 *
 * Anything absent, unparseable or out of bounds falls back to the default
 * rather than to "unlimited" — a bad value must never be the thing that lifts
 * the cap.
 */
export function resolveEventBuyLimit(configured?: number | null): number {
  if (configured == null || !Number.isFinite(configured)) {
    return DEFAULT_EVENT_BUYS_PER_DAY;
  }
  return Math.max(
    1,
    Math.min(HARD_MAX_EVENT_BUYS_PER_DAY, Math.floor(configured)),
  );
}

/**
 * The buy day starts at 08:00 ET, not midnight.
 *
 * Anchoring at midnight would hand the overnight run its own fresh allowance:
 * a 23:00 ET build plus two daytime buys is three, and then the next overnight
 * run starts a new day and buys again — four in twenty-four hours, which is the
 * behaviour being removed. Starting the day at 08:00 puts the overnight build
 * and the following day's two buys in the same budget, so twenty-four hours
 * never contains more than the league's allowance.
 */
export const EVENT_BUY_DAY_START_HOUR_ET = 8;

function easternParts(at: number): { date: string; hour: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: EASTERN_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(at));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    hour: Number(get("hour")),
  };
}

/**
 * The buy day a timestamp falls in, as an ET calendar date.
 *
 * Date arithmetic goes through midday UTC so that stepping back one day is
 * never bent by a daylight-saving transition.
 */
export function buyDayKey(at: number): string {
  const { date, hour } = easternParts(at);
  if (hour >= EVENT_BUY_DAY_START_HOUR_ET) return date;
  const previous = new Date(`${date}T12:00:00.000Z`);
  previous.setUTCDate(previous.getUTCDate() - 1);
  return previous.toISOString().slice(0, 10);
}

/** The buys on this event that count against the current day's allowance. */
export function buysInBuyDay(
  buys: readonly number[] | undefined,
  now: number = Date.now(),
): number[] {
  if (!buys?.length) return [];
  const today = buyDayKey(now);
  return buys.filter(
    (at) => Number.isFinite(at) && at <= now && buyDayKey(at) === today,
  );
}

/** True when this event has already spent its allowance for the day. */
export function eventBuyBudgetExhausted(
  buys: readonly number[] | undefined,
  now: number = Date.now(),
  limit?: number | null,
): boolean {
  return buysInBuyDay(buys, now).length >= resolveEventBuyLimit(limit);
}

/** Buys left before this event stops being re-priced today. */
export function remainingEventBuys(
  buys: readonly number[] | undefined,
  now: number = Date.now(),
  limit?: number | null,
): number {
  return Math.max(
    0,
    resolveEventBuyLimit(limit) - buysInBuyDay(buys, now).length,
  );
}

/**
 * The buy log after paying for one refresh.
 *
 * Buys from earlier days are dropped rather than accumulated — the log rides
 * inside a cached snapshot and only ever has to answer for today.
 */
export function recordEventBuy(
  buys: readonly number[] | undefined,
  now: number = Date.now(),
): number[] {
  return [...buysInBuyDay(buys, now), now];
}
