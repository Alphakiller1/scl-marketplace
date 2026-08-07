import assert from "node:assert/strict";
import test from "node:test";

import { reviveCachedDates } from "@/lib/cache-dates";
import { formatLastPickDate } from "@/lib/capper-activity";
import { formatJoinedDate } from "@/lib/format";

/** What `unstable_cache` does to a payload on the hit path. */
function throughCache<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

test("revives Dates that a cache hit flattened into ISO strings", () => {
  const cached = throughCache({
    joinedAt: new Date("2026-02-14T12:30:00.000Z"),
  });
  assert.equal(typeof cached.joinedAt, "string"); // the bug, before revival

  const revived = reviveCachedDates(cached);
  assert.ok(revived.joinedAt instanceof Date);
  assert.equal(revived.joinedAt.toISOString(), "2026-02-14T12:30:00.000Z");
});

test("revives Dates nested in arrays and objects", () => {
  const cached = throughCache({
    capper: { lastPlayAt: new Date("2026-08-01T00:00:00.000Z") },
    plays: [
      {
        createdAt: new Date("2026-07-31T18:00:00.000Z"),
        eventStartsAt: null,
      },
    ],
  });

  const revived = reviveCachedDates(cached);
  assert.ok(revived.capper.lastPlayAt instanceof Date);
  assert.ok(revived.plays[0].createdAt instanceof Date);
  assert.equal(revived.plays[0].eventStartsAt, null);
});

test("leaves non-date strings and other primitives alone", () => {
  const cached = throughCache({
    handle: "battle",
    selection: "Yankees -1.5",
    day: "2026-08-07", // date-ish, but not what Date.prototype.toJSON emits
    units: 2.5,
    outcome: null,
    verified: true,
  });

  const revived = reviveCachedDates(cached);
  assert.equal(revived.handle, "battle");
  assert.equal(revived.selection, "Yankees -1.5");
  assert.equal(revived.day, "2026-08-07");
  assert.equal(revived.units, 2.5);
  assert.equal(revived.outcome, null);
  assert.equal(revived.verified, true);
});

test("passes live Dates through untouched on the cache-miss path", () => {
  const lastPlayAt = new Date("2026-08-01T00:00:00.000Z");
  const revived = reviveCachedDates({ capper: { lastPlayAt } });

  assert.ok(revived.capper.lastPlayAt instanceof Date);
  assert.equal(revived.capper.lastPlayAt.getTime(), lastPlayAt.getTime());
});

// The regression this locks: a cached profile threw `RangeError: Invalid time
// value` and `getFullYear is not a function` on every cache hit, which is a
// 500 on /cappers/[handle].
test("profile date formatters survive a cache round trip", () => {
  const cached = throughCache({
    joinedAt: new Date("2026-02-14T12:30:00.000Z"),
    lastPlayAt: new Date("2026-08-01T15:00:00.000Z"),
  });

  assert.throws(() => formatJoinedDate(cached.joinedAt), RangeError);
  assert.throws(() => formatLastPickDate(cached.lastPlayAt), TypeError);

  const revived = reviveCachedDates(cached);
  assert.equal(formatJoinedDate(revived.joinedAt), "Feb 2026");
  assert.match(formatLastPickDate(revived.lastPlayAt)!, /Aug/);
});
