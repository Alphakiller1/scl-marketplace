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
 *   - performance color (perfScale on ROI, Units, and Win%) reads each figure
 *     on its own — a small window must not paint both ROI and Units amber.
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

test("ROI, Units, and Win% are colored independently on both layouts", () => {
  const scales = [
    ...leaderboard.matchAll(
      /perfScale\(\s*"(?:roi|units|winPct)"[\s\S]*?\)\;/g,
    ),
  ];
  assert.ok(
    scales.length >= 6,
    "expected ROI, Units, and Win% scales on both layouts",
  );
  for (const [scale] of scales) {
    assert.match(
      scale,
      /gradedCount: graded/,
      `perfScale must receive the window sample:\n${scale}`,
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
    /const carriedResults = carriedResultsFromLegacyRows\(p\.legacyRecords\)/,
  );
  assert.match(leaderboardQuery, /lifetimeGradedSample\(/);
  assert.match(
    leaderboardQuery,
    /playLifetime: lifetimeGradedPositions\?\.get\(p\.id\)/,
  );
});

test("1D ranks from the slate-day helpers, not settlement timestamps", () => {
  const fetch = leaderboardQuery.slice(
    leaderboardQuery.indexOf("async function fetchRankableProfiles"),
    leaderboardQuery.indexOf("type ProfileRow"),
  );
  assert.match(fetch, /leaderboardPlayDateFilter/);
  assert.match(fetch, /leaderboardParlayDateFilter/);
  assert.doesNotMatch(
    fetch,
    /gradedAt:\s*\{\s*gte/,
    "1D must not bucket positions by gradedAt",
  );
});
