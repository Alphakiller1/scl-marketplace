import assert from "node:assert/strict";
import test from "node:test";

import {
  PUBLIC_PICK_EMBARGO_MS,
  publicPickEmbargoState,
} from "@/lib/public-pick-embargo";

const START = new Date("2026-08-04T23:00:00.000Z");

test("pending picks remain sealed until 90 minutes after event start", () => {
  const before = publicPickEmbargoState(
    { outcome: "PENDING", eventStartsAt: START },
    new Date(START.getTime() + PUBLIC_PICK_EMBARGO_MS - 1),
  );
  const atRelease = publicPickEmbargoState(
    { outcome: "PENDING", eventStartsAt: START },
    new Date(START.getTime() + PUBLIC_PICK_EMBARGO_MS),
  );

  assert.equal(before.isEmbargoed, true);
  assert.equal(
    before.embargoedUntil?.toISOString(),
    "2026-08-05T00:30:00.000Z",
  );
  assert.equal(atRelease.isEmbargoed, false);
});

test("pending picks without a confirmed start fail closed", () => {
  assert.deepEqual(
    publicPickEmbargoState({ outcome: "PENDING", eventStartsAt: null }),
    { isEmbargoed: true, embargoedUntil: null },
  );
});

test("settled picks are never embargoed", () => {
  assert.deepEqual(
    publicPickEmbargoState({ outcome: "WIN", eventStartsAt: START }),
    { isEmbargoed: false, embargoedUntil: null },
  );
});
