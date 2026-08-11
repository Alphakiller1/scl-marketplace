import assert from "node:assert/strict";
import { test } from "node:test";

import {
  parsePeriodTotal,
  overUnderOutcome,
  periodScores,
  resolvePeriodMoneyline,
  resolvePeriodSpread,
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

test("resolvePeriodMoneyline settles from the segment, not the final score", () => {
  // Reds 2, Athletics 1 through five (final 3-2) — the real game that exposed
  // the gap: the segment and the final agree here.
  const real: BoxScore = {
    homePeriods: [0, 1, 0, 0, 1, 1, 0, 0, 0],
    awayPeriods: [1, 0, 0, 0, 0, 1, 0, 0, 0],
  };
  assert.equal(resolvePeriodMoneyline(real, 5, true), "WIN"); // home led 2-1
  assert.equal(resolvePeriodMoneyline(real, 5, false), "LOSS");

  // The case that matters: away wins the segment 2-0 but loses the game 2-5.
  // Reading the final score would flip both sides' results.
  const diverges: BoxScore = {
    homePeriods: [0, 0, 0, 0, 0, 5, 0, 0, 0],
    awayPeriods: [1, 1, 0, 0, 0, 0, 0, 0, 0],
  };
  assert.equal(resolvePeriodMoneyline(diverges, 5, false), "WIN");
  assert.equal(resolvePeriodMoneyline(diverges, 5, true), "LOSS");
  assert.equal(resolvePeriodMoneyline(diverges, 9, true), "WIN");
});

test("resolvePeriodMoneyline settles an explicit Draw selection", () => {
  const tied: BoxScore = {
    homePeriods: [1, 0, 0, 0, 0],
    awayPeriods: [0, 0, 1, 0, 0],
  };
  assert.equal(resolvePeriodMoneyline(tied, 5, null), "WIN");
  assert.equal(resolvePeriodMoneyline(tied, 5, true), "PUSH");
  const decided: BoxScore = {
    homePeriods: [1, 1, 0, 0, 0],
    awayPeriods: [0, 0, 1, 0, 0],
  };
  assert.equal(resolvePeriodMoneyline(decided, 5, null), "LOSS");
});

test("resolvePeriodSpread pushes on the exact number", () => {
  const box: BoxScore = {
    homePeriods: [0, 1, 0, 0, 1],
    awayPeriods: [1, 0, 0, 0, 0],
  };
  // home 2, away 1 after five
  assert.equal(resolvePeriodSpread(box, 5, true, -1), "PUSH");
  assert.equal(resolvePeriodSpread(box, 5, true, -0.5), "WIN");
  assert.equal(resolvePeriodSpread(box, 5, true, -1.5), "LOSS");
  assert.equal(resolvePeriodSpread(box, 5, false, 1.5), "WIN");
});

test("period resolvers defer when line-scores don't reach the segment", () => {
  const partial: BoxScore = { homePeriods: [0, 1, 0], awayPeriods: [1, 0, 0] };
  assert.equal(resolvePeriodMoneyline(partial, 5, true), null);
  assert.equal(resolvePeriodSpread(partial, 5, true, -1.5), null);
  assert.equal(periodScores(partial, 3)?.home, 1);
});
