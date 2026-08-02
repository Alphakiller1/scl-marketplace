import assert from "node:assert/strict";
import test from "node:test";

import { summarizePackagePositions } from "@/lib/package-performance";

test("package performance includes only settled attributed positions", () => {
  const result = summarizePackagePositions([
    { outcome: "WIN", units: 1, profitUnits: 0.8 },
    { outcome: "LOSS", units: 2, profitUnits: -2 },
    { outcome: "PUSH", units: 1, profitUnits: 0 },
    { outcome: "PENDING", units: 5, profitUnits: null },
    { outcome: "VOID", units: 5, profitUnits: 0 },
  ]);

  assert.deepEqual(result?.record, { w: 1, l: 1, p: 1 });
  assert.equal(result?.settledPicks, 3);
  assert.ok(Math.abs((result?.units ?? 0) - -1.2) < 1e-9);
  assert.ok(Math.abs((result?.roi ?? 0) - -30) < 1e-9);
});

test("package performance is absent until an attributed position settles", () => {
  assert.equal(
    summarizePackagePositions([
      { outcome: "PENDING", units: 1, profitUnits: null },
    ]),
    null,
  );
});
