import assert from "node:assert/strict";
import test from "node:test";

import {
  buyDayKey,
  buysInBuyDay,
  eventBuyBudgetExhausted,
  EVENT_BUY_DAY_START_HOUR_ET,
  MAX_EVENT_BUYS_PER_DAY,
  PLANNED_EVENT_BUYS_PER_DAY,
  recordEventBuy,
  remainingEventBuys,
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

test("the ceiling is three buys, and the schedule plans for two", () => {
  assert.equal(MAX_EVENT_BUYS_PER_DAY, 3);
  assert.equal(PLANNED_EVENT_BUYS_PER_DAY, 2);
  assert.ok(PLANNED_EVENT_BUYS_PER_DAY < MAX_EVENT_BUYS_PER_DAY);
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

test("a fourth buy in one day is refused", () => {
  const buys = [et(20, 9), et(20, 12), et(20, 17)];
  assert.equal(buysInBuyDay(buys, et(20, 18)).length, 3);
  assert.equal(remainingEventBuys(buys, et(20, 18)), 0);
  assert.equal(eventBuyBudgetExhausted(buys, et(20, 18)), true);
});

test("the allowance resets when the next buy day opens", () => {
  const buys = [et(20, 9), et(20, 12), et(20, 17)];
  assert.equal(eventBuyBudgetExhausted(buys, et(21, 7, 59)), true);
  assert.equal(eventBuyBudgetExhausted(buys, et(21, 8, 0)), false);
  assert.equal(remainingEventBuys(buys, et(21, 8, 0)), 3);
});

test("recording a buy drops earlier days rather than accumulating", () => {
  const stale = [et(18, 10), et(19, 10), et(20, 10)];
  const recorded = recordEventBuy(stale, et(21, 11));
  assert.deepEqual(recorded, [et(21, 11)]);
});

test("a snapshot written before the cap shipped starts with a full allowance", () => {
  assert.equal(remainingEventBuys(undefined, et(20, 12)), 3);
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
