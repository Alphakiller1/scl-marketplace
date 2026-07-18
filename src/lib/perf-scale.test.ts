import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { perfScale } from "@/lib/perf-scale";

describe("perfScale ROI boundaries", () => {
  it("strong / solid / soft / weak", () => {
    assert.equal(perfScale("roi", 8, { gradedCount: 20 }).band, "strong");
    assert.equal(perfScale("roi", 3, { gradedCount: 20 }).band, "solid");
    assert.equal(perfScale("roi", 0, { gradedCount: 20 }).band, "neutral");
    assert.equal(perfScale("roi", -3, { gradedCount: 20 }).band, "soft");
    assert.equal(perfScale("roi", -8, { gradedCount: 20 }).band, "weak");
  });

  it("early sample never red", () => {
    const soft = perfScale("roi", -5, { gradedCount: 3 });
    assert.equal(soft.band, "soft");
    assert.equal(soft.tone, "amber");
    const weak = perfScale("roi", -20, { gradedCount: 5 });
    assert.equal(weak.tone, "amber");
    assert.notEqual(weak.tone, "neg");
  });

  it("mature sample may be red", () => {
    assert.equal(perfScale("roi", -10, { gradedCount: 25 }).tone, "neg");
  });
});

describe("perfScale Units / CLV / winPct", () => {
  it("units thresholds", () => {
    assert.equal(perfScale("units", 5, { gradedCount: 20 }).band, "strong");
    assert.equal(perfScale("units", 1.5, { gradedCount: 20 }).band, "solid");
    assert.equal(perfScale("units", -1.5, { gradedCount: 20 }).band, "soft");
    assert.equal(perfScale("units", -5, { gradedCount: 20 }).band, "weak");
  });

  it("clv thresholds", () => {
    assert.equal(perfScale("clv", 0.03, { gradedCount: 20 }).band, "strong");
    assert.equal(perfScale("clv", 0.01, { gradedCount: 20 }).band, "solid");
    assert.equal(perfScale("clv", -0.01, { gradedCount: 20 }).band, "soft");
    assert.equal(perfScale("clv", -0.03, { gradedCount: 20 }).band, "weak");
  });

  it("winPct thresholds", () => {
    assert.equal(perfScale("winPct", 58, { gradedCount: 20 }).band, "strong");
    assert.equal(perfScale("winPct", 53, { gradedCount: 20 }).band, "solid");
    assert.equal(perfScale("winPct", 47, { gradedCount: 20 }).band, "soft");
    assert.equal(perfScale("winPct", 42, { gradedCount: 20 }).band, "weak");
  });

  it("null is unavailable muted", () => {
    const r = perfScale("clv", null, { gradedCount: 20 });
    assert.equal(r.band, "unavailable");
    assert.equal(r.tone, "muted");
  });
});
