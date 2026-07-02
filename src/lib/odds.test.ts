import assert from "node:assert/strict";
import { test } from "node:test";

import {
  americanToDecimal,
  decimalToAmerican,
  profitUnitsForOutcome,
} from "@/lib/odds";

test("americanToDecimal handles favorites and dogs", () => {
  assert.equal(americanToDecimal(100), 2);
  assert.equal(americanToDecimal(-100), 2);
  assert.equal(americanToDecimal(150), 2.5);
  assert.ok(Math.abs(americanToDecimal(-110) - 1.909090909) < 1e-6);
});

test("decimalToAmerican inverts americanToDecimal", () => {
  assert.equal(decimalToAmerican(2.5), 150);
  assert.equal(decimalToAmerican(2), 100);
  assert.equal(decimalToAmerican(americanToDecimal(-110)), -110);
  assert.equal(decimalToAmerican(americanToDecimal(-200)), -200);
});

test("profit: WIN pays net winnings on stake", () => {
  assert.equal(profitUnitsForOutcome("WIN", 150, 2), 3); // 2 × (2.5 − 1)
  assert.equal(profitUnitsForOutcome("WIN", -110, 1), 0.91); // 1 × 0.9090… → 0.91
});

test("profit: LOSS returns negative stake; PUSH/VOID zero; PENDING null", () => {
  assert.equal(profitUnitsForOutcome("LOSS", -110, 1.5), -1.5);
  assert.equal(profitUnitsForOutcome("PUSH", -110, 1.5), 0);
  assert.equal(profitUnitsForOutcome("VOID", 150, 3), 0);
  assert.equal(profitUnitsForOutcome("PENDING", 150, 3), null);
});
