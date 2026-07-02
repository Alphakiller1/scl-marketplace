import assert from "node:assert/strict";
import { test } from "node:test";

import { settleParlay } from "@/lib/grading";

test("all legs win: odds recombine and pay on the combined price", () => {
  const s = settleParlay(
    [
      { outcome: "WIN", oddsAmerican: 100 },
      { outcome: "WIN", oddsAmerican: 100 },
    ],
    1,
  );
  assert.equal(s.outcome, "WIN");
  assert.equal(s.effectiveOddsAmerican, 300); // 2 × 2 = 4.0 decimal → +300
  assert.equal(s.profitUnits, 3);
  assert.equal(s.activeLegs, 2);
});

test("any losing leg loses the whole parlay", () => {
  const s = settleParlay(
    [
      { outcome: "WIN", oddsAmerican: 100 },
      { outcome: "LOSS", oddsAmerican: -110 },
    ],
    2,
  );
  assert.equal(s.outcome, "LOSS");
  assert.equal(s.profitUnits, -2);
});

test("push/void legs are removed and odds recombine over survivors", () => {
  const s = settleParlay(
    [
      { outcome: "WIN", oddsAmerican: 100 },
      { outcome: "PUSH", oddsAmerican: -110 },
    ],
    1,
  );
  assert.equal(s.outcome, "WIN");
  assert.equal(s.effectiveOddsAmerican, 100); // only the +100 leg survives
  assert.equal(s.profitUnits, 1);
  assert.equal(s.activeLegs, 1);
});

test("all legs push/void → parlay pushes, stake returned", () => {
  const s = settleParlay(
    [
      { outcome: "PUSH", oddsAmerican: 100 },
      { outcome: "VOID", oddsAmerican: -110 },
    ],
    1,
  );
  assert.equal(s.outcome, "PUSH");
  assert.equal(s.profitUnits, 0);
});

test("any pending leg keeps the parlay pending", () => {
  const s = settleParlay(
    [
      { outcome: "WIN", oddsAmerican: 100 },
      { outcome: "PENDING", oddsAmerican: -110 },
    ],
    1,
  );
  assert.equal(s.outcome, "PENDING");
  assert.equal(s.profitUnits, null);
});
