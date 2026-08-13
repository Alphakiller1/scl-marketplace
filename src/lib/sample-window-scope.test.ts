import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * Two different samples live on a leaderboard row and they must not be mixed up.
 *
 * `settledPicks` is scoped to the selected filter window; `lifetimeGraded` is
 * the capper's whole record. Filtering the board to 1D used to shrink both,
 * which sent established cappers into the Early maturity bucket because three
 * of their 1,218 graded picks happened to settle yesterday.
 *
 * The split has to hold in both directions:
 *   - maturity claims (meter, rank badge, Early flag) read the career sample,
 *     because they describe the capper;
 *   - signal gating (perfScale on ROI and Units) reads the window sample,
 *     because those figures are computed from the window and a career-sized
 *     denominator would vouch for a three-pick ROI.
 *
 * Source-level assertions, matching the convention in
 * profile-link-reliability.test.ts — these are wiring invariants, and the
 * components render too much surrounding chrome to assert on cheaply.
 */

const leaderboard = readFileSync("src/components/scl/leaderboard.tsx", "utf8");
const compactRow = readFileSync(
  "src/components/scl/compact-capper-row.tsx",
  "utf8",
);
const leaderboardQuery = readFileSync("src/lib/queries/leaderboard.ts", "utf8");

test("maturity surfaces read the career sample, not the filter window", () => {
  // Both row layouts derive a career sample with a fallback for surfaces that
  // never window (the profile, Discover) and so do not send lifetimeGraded.
  for (const source of [leaderboard, compactRow]) {
    assert.match(source, /const career = capper\.lifetimeGraded \?\? graded;/);
  }

  // Every maturity meter and rank badge on these rows takes the career sample.
  for (const source of [leaderboard, compactRow]) {
    const meters = [...source.matchAll(/<SampleMaturityMeter[\s\S]*?\/>/g)];
    for (const [meter] of meters) {
      assert.match(
        meter,
        /graded=\{career\}/,
        `SampleMaturityMeter must use the career sample:\n${meter}`,
      );
    }
    const badges = [...source.matchAll(/<RankBadge[\s\S]*?\/>/g)];
    for (const [badge] of badges) {
      assert.match(
        badge,
        /settledPicks=\{career\}/,
        `RankBadge must use the career sample:\n${badge}`,
      );
    }
  }

  // The provisional / "Early" flag is a claim about the capper too.
  assert.match(leaderboard, /isProvisional\(career\)/);
  assert.match(compactRow, /isProvisional\(career\)/);
});

test("ROI and Units stay gated on the window that produced them", () => {
  const scales = [
    ...leaderboard.matchAll(/perfScale\(\s*"(?:roi|units)"[\s\S]*?\)\;/g),
  ];
  assert.ok(
    scales.length >= 4,
    "expected ROI and Units scales on both layouts",
  );
  for (const [scale] of scales) {
    assert.match(
      scale,
      /gradedCount: graded/,
      `perfScale must gate on the window sample:\n${scale}`,
    );
  }
});

test("the lifetime sample ignores the window and includes carried results", () => {
  // Deliberately no windowStart / createdAt bound on the grouped counts.
  const grouped = leaderboardQuery.slice(
    leaderboardQuery.indexOf("async function fetchLifetimeGraded"),
    leaderboardQuery.indexOf("function topSport"),
  );
  assert.ok(grouped.length > 0, "fetchLifetimeGraded not found");
  assert.doesNotMatch(grouped, /windowStart|createdAt/);
  assert.match(grouped, /prisma\.play\.groupBy/);
  assert.match(grouped, /prisma\.parlay\.groupBy/);

  // A carried-over legacy record is a settled history, so it counts toward the
  // career sample under every window — not only the all-time board.
  assert.match(
    leaderboardQuery,
    /const carriedResults = p\.legacyRecords\[0\]/,
  );
  assert.match(
    leaderboardQuery,
    /lifetimeGradedPositions\?\.get\(p\.id\) \?\? stats\.settled\) \+ carriedResults/,
  );
});
