import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  CLV_HISTOGRAM_EDGES,
  CLV_TRACKER_EMPTY_BODY,
  CLV_TRACKER_PROVISIONAL_BODY,
  PLATFORM_CLV_EMPTY_BODY,
  summarizeClvTracker,
} from "@/lib/clv-tracker";
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
    assert.equal(
      s.distributionSummary,
      "No closing snapshots are recorded. CLV distribution is unavailable.",
    );
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
    assert.equal(
      s.distributionSummary,
      `CLV distribution unavailable — ${MIN_GRADED_FOR_SIGNAL - 1} of ${MIN_GRADED_FOR_SIGNAL} required snapshots recorded.`,
    );
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

describe("CLV zero-state copy (GPT P2)", () => {
  it("locks empty / provisional / platform empty strings", () => {
    assert.equal(
      CLV_TRACKER_EMPTY_BODY,
      "No closing snapshots are available for this record. CLV appears after SCL captures a closing line for a board-verified pick. Historical picks without a close remain em dashes.",
    );
    assert.equal(
      CLV_TRACKER_PROVISIONAL_BODY,
      `CLV distribution requires ${MIN_GRADED_FOR_SIGNAL} closing snapshots. Until then, the distribution remains unavailable.`,
    );
    assert.equal(
      PLATFORM_CLV_EMPTY_BODY,
      "No board-verified closing snapshots are available across publicly listed cappers. Platform CLV remains unavailable until SCL captures closing lines for future board-verified picks.",
    );
  });
});
