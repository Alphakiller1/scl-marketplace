import assert from "node:assert/strict";
import { test } from "node:test";

import {
  MIN_CIRCUIT_BREAK_RESERVE,
  MONTHLY_CAP,
  REMAINING_CIRCUIT_BREAK,
  circuitBreakThreshold,
  shouldCircuitBreak,
  shouldCircuitBreakTennisSurface,
} from "@/lib/odds-budget";
import { TENNIS_SURFACE_CREDIT_COST } from "@/lib/tennis-tours";

test("the reserve scales to the plan the key is actually on", () => {
  // The bug this exists for: a 500-credit key starts BELOW the flat 1,000
  // floor, so the breaker tripped on the first response and every board served
  // circuit_break_empty for the life of the key — a permanent outage in which
  // the credits were never spent, only refused.
  assert.equal(circuitBreakThreshold(500), MIN_CIRCUIT_BREAK_RESERVE);
  assert.equal(shouldCircuitBreak(497, 500), false);
  assert.equal(shouldCircuitBreak(24, 500), true);

  // The 20,000 plan keeps exactly its historical reserve.
  assert.equal(circuitBreakThreshold(MONTHLY_CAP), REMAINING_CIRCUIT_BREAK);
  assert.equal(shouldCircuitBreak(999, MONTHLY_CAP), true);
  assert.equal(shouldCircuitBreak(1000, MONTHLY_CAP), false);

  // Unknown capacity falls back to the historical constant, so a response that
  // omits the usage headers cannot quietly widen the reserve.
  assert.equal(circuitBreakThreshold(null), REMAINING_CIRCUIT_BREAK);
  assert.equal(circuitBreakThreshold(0), REMAINING_CIRCUIT_BREAK);

  // A tiny plan still holds something back, so the last credits go to the pick
  // a capper is submitting rather than to a board refresh.
  assert.equal(circuitBreakThreshold(100), MIN_CIRCUIT_BREAK_RESERVE);
});

test("shouldCircuitBreak trips below 5% remaining", () => {
  assert.equal(shouldCircuitBreak(null), false);
  assert.equal(shouldCircuitBreak(1000), false);
  assert.equal(shouldCircuitBreak(999), true);
  assert.equal(shouldCircuitBreak(0), true);
});

test("circuit threshold aligns with monthly cap", () => {
  assert.equal(REMAINING_CIRCUIT_BREAK, MONTHLY_CAP * 0.05);
});

test("tennis surface still fetches when the expanded-MLB reserve would skip it", () => {
  // 29 remaining is what the 12:49 ET populate left after NFL. The 1,000-credit
  // breaker treats that as empty; 12 credits is enough to price Cincinnati.
  assert.equal(shouldCircuitBreak(29, MONTHLY_CAP), true);
  assert.equal(shouldCircuitBreakTennisSurface(29), false);
  assert.equal(
    shouldCircuitBreakTennisSurface(TENNIS_SURFACE_CREDIT_COST),
    false,
  );
  assert.equal(
    shouldCircuitBreakTennisSurface(TENNIS_SURFACE_CREDIT_COST - 1),
    true,
  );
  assert.equal(shouldCircuitBreakTennisSurface(null), false);
});
