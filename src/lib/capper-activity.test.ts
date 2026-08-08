import assert from "node:assert/strict";
import test from "node:test";

import {
  computeCapperActivity,
  formatLastPickDate,
  hasRecentPublicCapperActivity,
  publicCapperActivityCutoff,
} from "@/lib/capper-activity";

test("computeCapperActivity buckets pick counts by window", () => {
  const now = new Date("2026-07-14T16:00:00.000Z");
  const dates = [
    new Date("2026-07-14T12:00:00.000Z"), // today → 3d, 14d, month
    new Date("2026-07-12T12:00:00.000Z"), // 2d ago → 3d, 14d, month
    new Date("2026-07-01T12:00:00.000Z"), // 13d ago → 14d, month
    new Date("2026-06-20T12:00:00.000Z"), // prior month → none
  ];
  assert.deepEqual(computeCapperActivity(dates, now), {
    last3Days: 2,
    last14Days: 3,
    month: 3,
  });
});

test("formatLastPickDate returns null when empty", () => {
  assert.equal(formatLastPickDate(null), null);
  assert.equal(formatLastPickDate(undefined), null);
});

test("formatLastPickDate reads a date that arrived as a string", () => {
  // The profile header crashed the whole page with "getFullYear is not a
  // function" when the JSON cache handed back an ISO string. Degrade, never
  // throw — the label is worth less than the page.
  const label = formatLastPickDate(
    "2026-07-13T20:00:00.000Z" as unknown as Date,
    new Date("2026-07-14T16:00:00.000Z"),
  );
  assert.ok(label);
  assert.match(label!, /Jul/);
  assert.equal(formatLastPickDate("not a date" as unknown as Date), null);
});

test("formatLastPickDate is compact", () => {
  const label = formatLastPickDate(
    new Date("2026-07-13T20:00:00.000Z"),
    new Date("2026-07-14T16:00:00.000Z"),
  );
  assert.ok(label);
  assert.match(label!, /Jul/);
});

test("public capper activity expires after 30 days and resumes on a new position", () => {
  const now = new Date("2026-07-14T16:00:00.000Z");
  assert.equal(
    publicCapperActivityCutoff(now).toISOString(),
    "2026-06-14T16:00:00.000Z",
  );
  assert.equal(
    hasRecentPublicCapperActivity([new Date("2026-06-14T16:00:00.000Z")], now),
    true,
  );
  assert.equal(
    hasRecentPublicCapperActivity([new Date("2026-06-14T15:59:59.999Z")], now),
    false,
  );
});
