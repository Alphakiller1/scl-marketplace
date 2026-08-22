import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { formatPerfValue, perfScale } from "@/lib/perf-scale";
import { formatClvPts } from "@/lib/proof-receipt";
import { summarizeClvTracker } from "@/lib/clv-tracker";

describe("a CLV that rounds to zero never carries a sign", () => {
  /*
   * Three separate places format CLV, and only one of them went through
   * formatClvPts. Production shipped a receipt whose visible value was an
   * em-dash while its aria-label read "CLV: -0.00 pts" and the distribution
   * sentence read "average -0.00 pts" — a screen-reader user was told the
   * capper finished behind the close on a value that is zero at the precision
   * anyone can see. Pinned together so the three cannot drift apart again.
   */
  it("the displayed value defers to an em-dash", () => {
    assert.equal(formatClvPts(-0.0001), "—");
    assert.equal(formatClvPts(0.0001), "—");
  });

  it("the aria-label keeps the number but drops the sign", () => {
    assert.equal(formatPerfValue("clv", -0.0001), "0.00 pts");
    assert.equal(formatPerfValue("clv", 0.0001), "0.00 pts");
    // A real value is still signed.
    assert.equal(formatPerfValue("clv", 0.04), "+0.04 pts");
    assert.equal(formatPerfValue("clv", -0.04), "-0.04 pts");
  });

  it("the distribution sentence drops the sign too", () => {
    // Ten snapshots clears the signal floor; they average a hair below zero.
    const points = Array.from({ length: 10 }, () => -0.0001);
    const summary = summarizeClvTracker(points).distributionSummary;
    assert.match(summary, /average 0\.00 pts/);
    assert.doesNotMatch(summary, /-0\.00|\+0\.00/);
  });
});

describe("perfScale ROI boundaries", () => {
  it("strong / solid / soft / weak", () => {
    assert.equal(perfScale("roi", 8, { gradedCount: 20 }).band, "strong");
    assert.equal(perfScale("roi", 3, { gradedCount: 20 }).band, "solid");
    assert.equal(perfScale("roi", 0, { gradedCount: 20 }).band, "neutral");
    assert.equal(perfScale("roi", -3, { gradedCount: 20 }).band, "soft");
    assert.equal(perfScale("roi", -8, { gradedCount: 20 }).band, "weak");
  });

  it("each metric is toned from its own value, even on an early sample", () => {
    const roi = perfScale("roi", 12, { gradedCount: 3 });
    const units = perfScale("units", 0.4, { gradedCount: 3 });
    assert.equal(roi.band, "strong");
    assert.equal(roi.tone, "pos");
    assert.equal(units.band, "neutral");
    assert.equal(units.tone, "muted");
    assert.match(roi.ariaLabel, /early sample/);

    const mixedUnits = perfScale("units", -6, { gradedCount: 5 });
    assert.equal(mixedUnits.tone, "neg");
    assert.notEqual(mixedUnits.tone, "amber");
    assert.notEqual(roi.tone, mixedUnits.tone);
  });

  it("any plus ROI is green and any minus ROI is red", () => {
    assert.equal(perfScale("roi", 0.1, { gradedCount: 20 }).tone, "pos");
    assert.equal(perfScale("roi", 2.9, { gradedCount: 20 }).tone, "pos");
    assert.equal(perfScale("roi", 0, { gradedCount: 20 }).tone, "muted");
    assert.equal(perfScale("roi", -0.1, { gradedCount: 20 }).tone, "neg");
    assert.equal(perfScale("roi", -2.9, { gradedCount: 20 }).tone, "neg");
    assert.equal(perfScale("roi", 0.1, { gradedCount: 20 }).band, "neutral");
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
