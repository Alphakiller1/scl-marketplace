import assert from "node:assert/strict";
import { test } from "node:test";

import { asDate, formatJoinedDate } from "@/lib/format";

/**
 * The About block on every public profile threw "RangeError: Invalid time
 * value" because `Intl.DateTimeFormat#format` coerces a non-Date to NaN. A
 * join month is not worth a broken page — it degrades to an em-dash instead.
 */

test("formatJoinedDate reads a date that arrived as a string", () => {
  assert.equal(
    formatJoinedDate("2026-02-03T10:00:00.000Z" as unknown as Date),
    "Feb 2026",
  );
  assert.equal(formatJoinedDate(new Date("2026-02-03T10:00:00Z")), "Feb 2026");
});

test("formatJoinedDate degrades instead of throwing", () => {
  assert.equal(formatJoinedDate(null), "—");
  assert.equal(formatJoinedDate(undefined), "—");
  assert.equal(formatJoinedDate("whenever" as unknown as Date), "—");
});

test("asDate accepts dates, ISO strings and epoch millis; rejects junk", () => {
  const at = new Date("2026-08-08T01:46:00.000Z");
  assert.equal(asDate(at), at);
  assert.equal(asDate("2026-08-08T01:46:00.000Z")?.getTime(), at.getTime());
  assert.equal(asDate(at.getTime())?.getTime(), at.getTime());
  assert.equal(asDate(""), null);
  assert.equal(asDate("nope"), null);
  assert.equal(asDate(null), null);
  assert.equal(asDate(undefined), null);
});
