import assert from "node:assert/strict";
import test from "node:test";

import { gradePlaySchema } from "@/lib/schemas/grading.schema";
import { gradeParlaySchema } from "@/lib/schemas/parlay.schema";

test("straight correction requires a useful reason and impact confirmation", () => {
  const result = gradePlaySchema.safeParse({
    playId: "play-1",
    outcome: "LOSS",
    reason: "bad",
    expectedOutcome: "WIN",
    expectedProfitUnits: 0.91,
    confirmedPublicImpact: false,
  });

  assert.equal(result.success, false);
  if (!result.success) {
    assert.deepEqual(
      result.error.issues.map((issue) => issue.path[0]),
      ["reason", "confirmedPublicImpact"],
    );
  }
});

test("ordinary pending grade remains compatible with the existing queue", () => {
  const result = gradePlaySchema.safeParse({
    playId: "play-1",
    outcome: "WIN",
    reason: "Manual result",
  });

  assert.equal(result.success, true);
});

test("parlay correction rejects duplicate legs", () => {
  const result = gradeParlaySchema.safeParse({
    parlayId: "parlay-1",
    reason: "Correcting the settled result",
    expectedOutcome: "WIN",
    expectedProfitUnits: 2.64,
    confirmedPublicImpact: true,
    legs: [
      { playId: "leg-1", outcome: "WIN", expectedOutcome: "WIN" },
      { playId: "leg-1", outcome: "LOSS", expectedOutcome: "WIN" },
    ],
  });

  assert.equal(result.success, false);
  if (!result.success) {
    assert.equal(result.error.issues[0]?.path[0], "legs");
  }
});
