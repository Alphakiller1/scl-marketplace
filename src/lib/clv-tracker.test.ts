import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { CLV_HISTOGRAM_EDGES, summarizeClvTracker } from "@/lib/clv-tracker";
import { MIN_GRADED_FOR_SIGNAL } from "@/lib/sample";

describe("summarizeClvTracker", () => {
  it("returns honest nulls when there are no snapshots", () => {
    const s = summarizeClvTracker([]);
    assert.equal(s.snapshotCount, 0);
    assert.equal(s.hasSignal, false);
    assert.equal(s.avgClv, null);
    assert.equal(s.beatClosePct, null);
    assert.equal(s.beatCloseCount, 0);
    assert.equal(s.bins.length, CLV_HISTOGRAM_EDGES.length - 1);
    assert.ok(s.bins.every((b) => b.count === 0));
  });

  it("gates avg and beat% below MIN_GRADED_FOR_SIGNAL snapshots", () => {
    const pts = Array.from({ length: MIN_GRADED_FOR_SIGNAL - 1 }, (_, i) =>
      i % 2 === 0 ? 0.02 : -0.01,
    );
    const s = summarizeClvTracker(pts);
    assert.equal(s.snapshotCount, MIN_GRADED_FOR_SIGNAL - 1);
    assert.equal(s.hasSignal, false);
    assert.equal(s.avgClv, null);
    assert.equal(s.beatClosePct, null);
    assert.ok(s.beatCloseCount > 0);
  });

  it("computes avg and beat% at signal size — reads values only", () => {
    const pts = [0.02, 0.04, -0.01, 0.01, 0.03, -0.02, 0.05, 0.0, 0.015, 0.025];
    assert.equal(pts.length, MIN_GRADED_FOR_SIGNAL);
    const s = summarizeClvTracker(pts);
    assert.equal(s.hasSignal, true);
    assert.ok(s.avgClv != null);
    assert.ok(s.beatClosePct != null);
    // beat close = clvPts > 0 (exact 0 does not count)
    assert.equal(s.beatCloseCount, 7);
    assert.equal(s.beatClosePct, 70);
  });

  it("ignores non-finite inputs and never invents zeros", () => {
    const s = summarizeClvTracker([0.02, Number.NaN, Number.POSITIVE_INFINITY]);
    assert.equal(s.snapshotCount, 1);
    assert.equal(s.hasSignal, false);
  });

  it("bins keep a stable zero-centered domain", () => {
    const s = summarizeClvTracker([-0.08, -0.04, -0.02, 0, 0.02, 0.04, 0.08]);
    assert.equal(
      s.bins.reduce((n, b) => n + b.count, 0),
      7,
    );
    assert.ok(s.bins.some((b) => b.from < 0 && b.to > 0));
  });
});
