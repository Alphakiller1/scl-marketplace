import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { americanToImplied, computeClvPts } from "@/lib/clv";

describe("clv", () => {
  it("americanToImplied converts favorites and dogs", () => {
    assert.ok(Math.abs(americanToImplied(-110) - 0.5238) < 0.001);
    assert.ok(Math.abs(americanToImplied(150) - 0.4) < 0.001);
  });

  it("computeClvPts: positive when captured better than close", () => {
    // Captured +150 (40% implied) vs close -110 (~52%) → beat the close
    const better = computeClvPts(150, -110);
    assert.ok(better != null && better > 0);

    // Captured -120 vs close -105 → negative (close was better)
    const worse = computeClvPts(-120, -105);
    assert.ok(worse != null && worse < 0);
  });

  it("computeClvPts returns null for invalid inputs", () => {
    assert.equal(computeClvPts(null, -110), null);
    assert.equal(computeClvPts(-110, null), null);
    assert.equal(computeClvPts(50, -110), null);
  });
});
