import assert from "node:assert/strict";
import test from "node:test";

import {
  previewParlayCorrection,
  previewStraightCorrection,
  profitUnitsEqual,
} from "@/lib/grading-correction";

test("profit comparison follows the database's two-decimal precision", () => {
  assert.equal(profitUnitsEqual(0.909, 0.91), true);
  assert.equal(profitUnitsEqual(null, null), true);
  assert.equal(profitUnitsEqual(null, 0), false);
});

test("straight preview detects a same-outcome profit recalculation", () => {
  const preview = previewStraightCorrection({
    current: { outcome: "WIN", profitUnits: 0.5 },
    nextOutcome: "WIN",
    oddsAmerican: -110,
    units: 1,
  });

  assert.equal(preview.changed, true);
  assert.equal(preview.after.outcome, "WIN");
  assert.equal(preview.after.profitUnits, 0.91);
});

test("parlay preview recalculates parent outcome and profit from corrected legs", () => {
  const preview = previewParlayCorrection({
    current: { outcome: "WIN", profitUnits: 2.64 },
    units: 1,
    legs: [
      { id: "leg-1", outcome: "WIN", oddsAmerican: -110 },
      { id: "leg-2", outcome: "WIN", oddsAmerican: -110 },
    ],
    nextOutcomes: { "leg-1": "WIN", "leg-2": "LOSS" },
  });

  assert.equal(preview.changedLegCount, 1);
  assert.equal(preview.after.outcome, "LOSS");
  assert.equal(preview.after.profitUnits, -1);
});
