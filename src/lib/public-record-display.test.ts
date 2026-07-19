import assert from "node:assert/strict";
import test from "node:test";

import { publicRecordDisplay } from "@/lib/public-record-display";

test("zero-grade public records use em dashes for every performance field", () => {
  assert.deepEqual(
    publicRecordDisplay({
      settledPicks: 0,
      record: { w: 0, l: 0, p: 0 },
      roi: 0,
      units: 0,
      winPct: 0,
    }),
    {
      hasGradedRecord: false,
      record: "—",
      roi: "—",
      units: "—",
      winPct: "—",
    },
  );
});

test("graded public records preserve measured values", () => {
  assert.deepEqual(
    publicRecordDisplay({
      settledPicks: 3,
      record: { w: 2, l: 1, p: 0 },
      roi: 5.25,
      units: 1.5,
      winPct: 66.666,
    }),
    {
      hasGradedRecord: true,
      record: "2-1",
      roi: "+5.3%",
      units: "+1.50U",
      winPct: "66.7%",
    },
  );
});
