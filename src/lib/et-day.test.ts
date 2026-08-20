import assert from "node:assert/strict";
import test from "node:test";

import { etDayBounds } from "@/lib/et-day";

test("etDayBounds returns exclusive Eastern midnight endpoints", () => {
  const summer = etDayBounds(0, new Date("2026-08-17T16:00:00Z"));
  assert.equal(summer.start.toISOString(), "2026-08-17T04:00:00.000Z");
  assert.equal(summer.end.toISOString(), "2026-08-18T04:00:00.000Z");

  const winter = etDayBounds(0, new Date("2026-01-17T16:00:00Z"));
  assert.equal(winter.start.toISOString(), "2026-01-17T05:00:00.000Z");
  assert.equal(winter.end.toISOString(), "2026-01-18T05:00:00.000Z");
});

test("etDayBounds(-1) is the previous Eastern calendar day", () => {
  const yesterday = etDayBounds(-1, new Date("2026-08-17T16:00:00Z"));
  assert.equal(yesterday.start.toISOString(), "2026-08-16T04:00:00.000Z");
  assert.equal(yesterday.end.toISOString(), "2026-08-17T04:00:00.000Z");
});

test("etDayBounds keeps a 23-hour Eastern day across the spring DST change", () => {
  const spring = etDayBounds(-1, new Date("2026-03-09T04:30:00Z"));
  assert.equal(spring.start.toISOString(), "2026-03-08T05:00:00.000Z");
  assert.equal(spring.end.toISOString(), "2026-03-09T04:00:00.000Z");
});
