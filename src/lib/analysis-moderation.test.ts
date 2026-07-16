import assert from "node:assert/strict";
import { test } from "node:test";

import { assertAnalysisSafe } from "@/lib/analysis-moderation";

test("assertAnalysisSafe allows empty and factual copy", () => {
  assert.equal(assertAnalysisSafe(undefined), undefined);
  assert.equal(assertAnalysisSafe(""), undefined);
  assert.equal(assertAnalysisSafe("Line moved early."), undefined);
});

test("assertAnalysisSafe rejects banned hype terms", () => {
  assert.match(assertAnalysisSafe("This is a lock")!, /lock/i);
  assert.match(assertAnalysisSafe("GUARANTEED winner")!, /guarantee/i);
  assert.match(assertAnalysisSafe("easy money play")!, /easy money/i);
});
