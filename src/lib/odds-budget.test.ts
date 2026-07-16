import assert from "node:assert/strict";
import { test } from "node:test";

import {
  MONTHLY_CAP,
  REMAINING_CIRCUIT_BREAK,
  shouldCircuitBreak,
} from "@/lib/odds-budget";

test("shouldCircuitBreak trips below 5% remaining", () => {
  assert.equal(shouldCircuitBreak(null), false);
  assert.equal(shouldCircuitBreak(1000), false);
  assert.equal(shouldCircuitBreak(999), true);
  assert.equal(shouldCircuitBreak(0), true);
});

test("circuit threshold aligns with monthly cap", () => {
  assert.equal(REMAINING_CIRCUIT_BREAK, MONTHLY_CAP * 0.05);
});
