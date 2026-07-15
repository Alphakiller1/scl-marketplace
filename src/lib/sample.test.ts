import assert from "node:assert/strict";
import { test } from "node:test";

import { hasSignal, isProvisional, MIN_GRADED_FOR_SIGNAL } from "@/lib/sample";

test("MIN_GRADED_FOR_SIGNAL is 10", () => {
  assert.equal(MIN_GRADED_FOR_SIGNAL, 10);
});

test("hasSignal: below threshold is false", () => {
  assert.equal(hasSignal(0), false);
  assert.equal(hasSignal(1), false);
  assert.equal(hasSignal(9), false);
});

test("hasSignal: at/above threshold is true", () => {
  assert.equal(hasSignal(10), true);
  assert.equal(hasSignal(11), true);
  assert.equal(hasSignal(100), true);
});

test("hasSignal: non-finite counts are not signal", () => {
  assert.equal(hasSignal(Number.NaN), false);
  assert.equal(hasSignal(Number.POSITIVE_INFINITY), false);
});

test("isProvisional mirrors hasSignal", () => {
  assert.equal(isProvisional(0), true);
  assert.equal(isProvisional(9), true);
  assert.equal(isProvisional(10), false);
  assert.equal(isProvisional(null), true);
  assert.equal(isProvisional(undefined), true);
});
