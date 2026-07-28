import assert from "node:assert/strict";
import { test } from "node:test";

import {
  parsePeriodTotal,
  overUnderOutcome,
  resolvePeriodTotal,
  type BoxScore,
} from "@/lib/results/prop-resolve";

test("parsePeriodTotal reads First-Five / first-N innings totals", () => {
  assert.deepEqual(parsePeriodTotal("PHI/PIT u4.5 First Five"), {
    periods: 5,
    side: "under",
    line: 4.5,
  });
  assert.deepEqual(parsePeriodTotal("First 5 Innings Over 4.5"), {
    periods: 5,
    side: "over",
    line: 4.5,
  });
  assert.deepEqual(parsePeriodTotal("F5 Under 5"), {
    periods: 5,
    side: "under",
    line: 5,
  });
  assert.deepEqual(parsePeriodTotal("First 3 innings o2.5"), {
    periods: 3,
    side: "over",
    line: 2.5,
  });
});

test("parsePeriodTotal returns null on non-period or ambiguous selections", () => {
  assert.equal(parsePeriodTotal("Dodgers ML"), null); // full-game
  assert.equal(parsePeriodTotal("Yankees/Sox Over 8.5"), null); // full-game total, no period
  assert.equal(parsePeriodTotal("Bucks Star Over 11.34 Pts"), null); // player prop
  assert.equal(parsePeriodTotal("First Five"), null); // no line
});

test("overUnderOutcome pushes on the exact line", () => {
  assert.equal(overUnderOutcome(5, 4.5, "over"), "WIN");
  assert.equal(overUnderOutcome(4, 4.5, "over"), "LOSS");
  assert.equal(overUnderOutcome(4, 4.5, "under"), "WIN");
  assert.equal(overUnderOutcome(5, 4.5, "under"), "LOSS");
  assert.equal(overUnderOutcome(5, 5, "over"), "PUSH");
  assert.equal(overUnderOutcome(5, 5, "under"), "PUSH");
});

test("resolvePeriodTotal sums the first N periods for both teams", () => {
  // First 5 innings: home 0,1,0,2,0 = 3 ; away 1,0,0,0,1 = 2 ; total 5
  const box: BoxScore = {
    homePeriods: [0, 1, 0, 2, 0, 3, 0, 0, 1],
    awayPeriods: [1, 0, 0, 0, 1, 0, 2, 0, 0],
  };
  assert.equal(resolvePeriodTotal("First Five Over 4.5", box), "WIN"); // 5 > 4.5
  assert.equal(resolvePeriodTotal("First Five Under 4.5", box), "LOSS");
  assert.equal(resolvePeriodTotal("F5 Over 5", box), "PUSH"); // exactly 5
});

test("resolvePeriodTotal defers (null) when line-scores don't cover the periods", () => {
  const partial: BoxScore = { homePeriods: [0, 1, 0], awayPeriods: [1, 0, 0] };
  assert.equal(resolvePeriodTotal("First Five Over 4.5", partial), null);
});

test("resolvePeriodTotal returns null for non-period markets (defers)", () => {
  const box: BoxScore = {
    homePeriods: [0, 1, 0, 2, 0],
    awayPeriods: [1, 0, 0, 0, 1],
  };
  assert.equal(resolvePeriodTotal("Dodgers ML", box), null);
  assert.equal(resolvePeriodTotal("Jokic Over 27.5 Pts", box), null);
});
