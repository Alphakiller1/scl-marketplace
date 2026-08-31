import assert from "node:assert/strict";
import test from "node:test";

import {
  buyDayKey,
  buysInBuyDay,
  DEFAULT_EVENT_BUYS_PER_DAY,
  eventBuyBudgetExhausted,
  EVENT_BUY_DAY_START_HOUR_ET,
  HARD_MAX_EVENT_BUYS_PER_DAY,
  recordEventBuy,
  remainingEventBuys,
  resolveEventBuyLimit,
  SAME_DAY_EXPANDED_RUNS,
} from "@/lib/odds-event-buy-budget";

/**
 * Eastern wall-clock time as an epoch, during EDT (UTC-4).
 *
 * Built through `Date.UTC` so an hour that carries past midnight (23:00 ET is
 * 03:00 UTC the next day) rolls the date instead of producing an invalid one.
 */
function et(day: number, hour: number, minute = 0): number {
  return Date.UTC(2026, 7, day, hour + 4, minute);
}

test("no league may exceed four a day, and three is the default", () => {
  assert.equal(HARD_MAX_EVENT_BUYS_PER_DAY, 4);
  assert.equal(DEFAULT_EVENT_BUYS_PER_DAY, 3);
  assert.equal(SAME_DAY_EXPANDED_RUNS, 2);
  assert.ok(DEFAULT_EVENT_BUYS_PER_DAY < HARD_MAX_EVENT_BUYS_PER_DAY);
});

test("a league allowance is clamped, and junk falls back to the default", () => {
  assert.equal(resolveEventBuyLimit(1), 1);
  assert.equal(resolveEventBuyLimit(4), 4);
  // The ceiling holds against anything a league is given.
  assert.equal(resolveEventBuyLimit(5), HARD_MAX_EVENT_BUYS_PER_DAY);
  assert.equal(resolveEventBuyLimit(999), HARD_MAX_EVENT_BUYS_PER_DAY);
  assert.equal(resolveEventBuyLimit(0), 1);
  assert.equal(resolveEventBuyLimit(-3), 1);
  assert.equal(resolveEventBuyLimit(2.9), 2);
  // A missing or unusable value must never read as "no cap".
  assert.equal(resolveEventBuyLimit(undefined), DEFAULT_EVENT_BUYS_PER_DAY);
  assert.equal(resolveEventBuyLimit(null), DEFAULT_EVENT_BUYS_PER_DAY);
  assert.equal(resolveEventBuyLimit(Number.NaN), DEFAULT_EVENT_BUYS_PER_DAY);
});

test("a league given its own allowance is held to it, not to the default", () => {
  const buys = [et(20, 9), et(20, 12)];
  // Two spent: a league on the tightest allowance is already done.
  assert.equal(eventBuyBudgetExhausted(buys, et(20, 13), 2), true);
  assert.equal(remainingEventBuys(buys, et(20, 13), 2), 0);
  // The default still has one left, and the ceiling two.
  assert.equal(remainingEventBuys(buys, et(20, 13)), 1);
  assert.equal(
    remainingEventBuys(buys, et(20, 13), HARD_MAX_EVENT_BUYS_PER_DAY),
    2,
  );
});

test("the schedule's three buys fit the default, and a fourth needs the ceiling", () => {
  // 23:00 ET the day before, then 08:00 and 15:00 ET — the exact pattern.
  const dayBefore = et(20, 23);
  const morning = et(21, 8);
  const evening = et(21, 15);
  assert.equal(buyDayKey(dayBefore), "2026-08-20");
  assert.equal(buyDayKey(morning), "2026-08-21");
  assert.equal(buyDayKey(evening), "2026-08-21");

  // The 20th's budget holds its own two plus the day-before build: exactly three.
  const twentieth = [et(20, 8), et(20, 15), dayBefore];
  assert.equal(remainingEventBuys(twentieth, dayBefore), 0);
  assert.equal(eventBuyBudgetExhausted(twentieth, dayBefore), true);
  // A league raised to the ceiling would still have one in hand.
  assert.equal(
    eventBuyBudgetExhausted(twentieth, dayBefore, HARD_MAX_EVENT_BUYS_PER_DAY),
    false,
  );
});

test("the buy day opens at 08:00 ET, so an overnight run shares the day before's budget", () => {
  assert.equal(EVENT_BUY_DAY_START_HOUR_ET, 8);
  // 07:59 ET still belongs to the previous buy day.
  assert.equal(buyDayKey(et(20, 7, 59)), "2026-08-19");
  assert.equal(buyDayKey(et(20, 8, 0)), "2026-08-20");
  assert.equal(buyDayKey(et(20, 23, 0)), "2026-08-20");
  // 01:00 ET the next calendar day is still the 20th's budget.
  assert.equal(buyDayKey(et(21, 1, 0)), "2026-08-20");
});

test("no twenty-four hours can contain more than three buys", () => {
  // The exact pattern the schedule produces: an overnight build for tomorrow,
  // then two daytime buys on that slate. A midnight-anchored day would have put
  // the 23:00 build in its own budget and allowed a fourth.
  const overnightBuild = et(20, 23, 0);
  const morningBuy = et(21, 11, 0);
  const eveningBuy = et(21, 17, 0);

  assert.equal(buyDayKey(overnightBuild), "2026-08-20");
  assert.equal(buyDayKey(morningBuy), "2026-08-21");
  assert.equal(buyDayKey(eveningBuy), "2026-08-21");

  const afterAll = [overnightBuild, morningBuy, eveningBuy];
  // Within the 21st's budget only two have been spent, so one remains.
  assert.equal(remainingEventBuys(afterAll, eveningBuy), 1);
  assert.equal(eventBuyBudgetExhausted(afterAll, eveningBuy), false);

  // The next overnight build takes the third and closes the 21st out.
  const nextBuild = et(21, 23, 0);
  const spent = recordEventBuy(afterAll, nextBuild);
  assert.equal(eventBuyBudgetExhausted(spent, nextBuild), true);
});

test("a fourth buy in one day is refused on the default allowance", () => {
  const buys = [et(20, 9), et(20, 12), et(20, 17)];
  assert.equal(buysInBuyDay(buys, et(20, 18)).length, 3);
  assert.equal(remainingEventBuys(buys, et(20, 18)), 0);
  assert.equal(eventBuyBudgetExhausted(buys, et(20, 18)), true);
});

test("a fifth buy is refused even on the highest allowance a league can hold", () => {
  const buys = [et(20, 9), et(20, 11), et(20, 14), et(20, 17)];
  assert.equal(
    eventBuyBudgetExhausted(buys, et(20, 18), HARD_MAX_EVENT_BUYS_PER_DAY),
    true,
  );
  // And an out-of-range value cannot buy a fifth either.
  assert.equal(eventBuyBudgetExhausted(buys, et(20, 18), 99), true);
});

test("the allowance resets when the next buy day opens", () => {
  const buys = [et(20, 9), et(20, 12), et(20, 17)];
  assert.equal(eventBuyBudgetExhausted(buys, et(21, 7, 59)), true);
  assert.equal(eventBuyBudgetExhausted(buys, et(21, 8, 0)), false);
  assert.equal(
    remainingEventBuys(buys, et(21, 8, 0)),
    DEFAULT_EVENT_BUYS_PER_DAY,
  );
});

test("recording a buy drops earlier days rather than accumulating", () => {
  const stale = [et(18, 10), et(19, 10), et(20, 10)];
  const recorded = recordEventBuy(stale, et(21, 11));
  assert.deepEqual(recorded, [et(21, 11)]);
});

test("a snapshot written before the cap shipped starts with a full allowance", () => {
  assert.equal(
    remainingEventBuys(undefined, et(20, 12)),
    DEFAULT_EVENT_BUYS_PER_DAY,
  );
  assert.equal(eventBuyBudgetExhausted(undefined, et(20, 12)), false);
  assert.deepEqual(buysInBuyDay(undefined, et(20, 12)), []);
});

test("a timestamp in the future cannot buy back an allowance", () => {
  // Clock skew between isolates must not read as "not spent yet".
  const buys = [et(20, 9), et(20, 12), et(20, 23)];
  assert.equal(buysInBuyDay(buys, et(20, 13)).length, 2);
  assert.equal(remainingEventBuys(buys, et(20, 13)), 1);
});

test("the cap survives the daylight-saving boundary", () => {
  // 2026-11-01 is the EDT→EST transition; the buy day must still step back one
  // calendar day rather than landing on the same date or skipping one.
  const beforeOpen = Date.parse("2026-11-01T10:30:00.000Z"); // 06:30 EDT
  assert.equal(buyDayKey(beforeOpen), "2026-10-31");
  const afterOpen = Date.parse("2026-11-01T14:00:00.000Z"); // 09:00 EST
  assert.equal(buyDayKey(afterOpen), "2026-11-01");
});
