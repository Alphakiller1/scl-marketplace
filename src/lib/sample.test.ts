import assert from "node:assert/strict";
import { test } from "node:test";

import {
  MATURITY,
  MATURITY_LABELS,
  MATURITY_LEGEND,
  MIN_GRADED_FOR_SIGNAL,
  hasSignal,
  isProvisional,
  maturityBucket,
  maturityLabel,
} from "@/lib/sample";

test("MIN_GRADED_FOR_SIGNAL is 10", () => {
  assert.equal(MIN_GRADED_FOR_SIGNAL, 10);
  assert.equal(MATURITY.DEVELOPING, 10);
  assert.equal(MATURITY.ESTABLISHED, 50);
});

test("maturity buckets Early / Developing / Established", () => {
  assert.equal(maturityBucket(0), "early");
  assert.equal(maturityBucket(9), "early");
  assert.equal(maturityBucket(10), "developing");
  assert.equal(maturityBucket(49), "developing");
  assert.equal(maturityBucket(50), "established");
  assert.equal(maturityLabel(3), MATURITY_LABELS.early);
  assert.equal(maturityLabel(25), MATURITY_LABELS.developing);
  assert.equal(maturityLabel(50), MATURITY_LABELS.established);
  assert.equal(
    MATURITY_LEGEND,
    "Established 50+ · Developing 10–49 · Early 0–9",
  );
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
