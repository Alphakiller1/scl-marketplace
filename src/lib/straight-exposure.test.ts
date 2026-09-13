import assert from "node:assert/strict";
import test from "node:test";

import {
  straightExposureError,
  straightExposureEventIds,
  type StraightExposure,
} from "@/lib/straight-exposure";

const straight = (units: number): StraightExposure => ({
  eventId: "event-1",
  market: "Spread",
  selection: "Boston Celtics",
  side: "Boston Celtics",
  line: -3.5,
  units,
  isSupermax: false,
});

test("duplicate standard straights may total exactly 10u", () => {
  assert.equal(straightExposureError([straight(6)], [straight(4)]), null);
});

test("duplicate standard straights cannot exceed 10u across writes", () => {
  assert.match(
    straightExposureError([straight(6)], [straight(4), straight(0.01)]) ?? "",
    /cannot exceed 10u/i,
  );
});

test("duplicate exposure lookup spans every incoming event without duplicates", () => {
  assert.deepEqual(
    straightExposureEventIds([
      straight(1),
      { ...straight(1), eventId: "event-2" },
      straight(1),
      { ...straight(1), eventId: null },
    ]),
    ["event-1", "event-2"],
  );
});

test("daily Supermax reporting is separate from the standard exposure cap", () => {
  assert.equal(
    straightExposureError([], [{ ...straight(20), isSupermax: true }]),
    null,
  );
  assert.match(
    straightExposureError(
      [{ ...straight(20), isSupermax: true }],
      [{ ...straight(20), isSupermax: true }],
    ) ?? "",
    /only one/i,
  );
});
