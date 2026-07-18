import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPerformanceTrend,
  hasLeaderboardSample,
  isBuildingARecord,
  isLeaderboardEligible,
  leaderboardWindowStart,
  parseLeaderboardFilters,
  partitionLeaderboard,
  sortLeaderboard,
  summarizeLeaderboard,
} from "@/lib/leaderboard";
import type { CapperSummary } from "@/lib/mock";

test("leaderboard filters reject unsupported query values", () => {
  assert.deepEqual(
    parseLeaderboardFilters({
      sport: "made-up",
      window: "forever",
      sort: "followers",
      minPicks: "13",
      record: "all",
      q: "  edge  ",
    }),
    {
      sport: "ALL",
      window: "all",
      sort: "roi",
      minPicks: 0,
      verifiedOnly: false,
      search: "edge",
      limit: 10,
    },
  );
});

test("leaderboard filters accept clv sort", () => {
  assert.equal(parseLeaderboardFilters({ sort: "clv" }).sort, "clv");
});

test("leaderboard filters preserve expansion and verified checkbox values", () => {
  const filters = parseLeaderboardFilters({
    limit: "20",
    record: ["all", "verified"],
  });
  assert.equal(filters.limit, 20);
  assert.equal(filters.verifiedOnly, true);
});

test("metric columns support sample, verification, and recent-form sorts", () => {
  const cappers = [
    {
      id: "a",
      name: "A",
      units: 0,
      winPct: 50,
      settledPicks: 12,
      verifiedShare: 100,
      recentForm: ["W", "W"],
    },
    {
      id: "b",
      name: "B",
      units: 0,
      winPct: 50,
      settledPicks: 40,
      verifiedShare: 60,
      recentForm: ["L", "L"],
    },
  ] as CapperSummary[];

  assert.equal(sortLeaderboard(cappers, "sample")[0].id, "b");
  assert.equal(sortLeaderboard(cappers, "verified")[0].id, "a");
  assert.equal(sortLeaderboard(cappers, "form")[0].id, "a");
});

test("sortLeaderboard ranks by avgClv when sort=clv", () => {
  const sorted = sortLeaderboard(
    [
      { id: "a", name: "A", avgClv: 0.01, settledPicks: 12 } as CapperSummary,
      { id: "b", name: "B", avgClv: 0.05, settledPicks: 12 } as CapperSummary,
      { id: "c", name: "C", avgClv: null, settledPicks: 12 } as CapperSummary,
    ],
    "clv",
  );
  assert.deepEqual(
    sorted.map((c) => c.id),
    ["b", "a", "c"],
  );
});

test("CLV sort requires signal sample and avgClv", () => {
  const filters = parseLeaderboardFilters({ sort: "clv", minPicks: "0" });
  assert.equal(
    isLeaderboardEligible(
      {
        settledPicks: 12,
        units: 1,
        roi: 1,
        avgClv: 0.02,
      } as CapperSummary,
      filters,
    ),
    true,
  );
  assert.equal(
    isLeaderboardEligible(
      {
        settledPicks: 12,
        units: 1,
        roi: 1,
        avgClv: null,
      } as CapperSummary,
      filters,
    ),
    false,
  );
  assert.equal(
    isLeaderboardEligible(
      {
        settledPicks: 5,
        units: 1,
        roi: 1,
        avgClv: 0.02,
      } as CapperSummary,
      filters,
    ),
    false,
  );
});

test("year window begins at the UTC calendar-year boundary", () => {
  assert.equal(
    leaderboardWindowStart(
      "year",
      new Date("2026-06-29T12:00:00Z"),
    )?.toISOString(),
    "2026-01-01T00:00:00.000Z",
  );
});

test("performance trend is cumulative and excludes unsettled plays", () => {
  assert.deepEqual(
    buildPerformanceTrend([
      { outcome: "WIN", profitUnits: 1.2 },
      { outcome: "PENDING", profitUnits: null },
      { outcome: "LOSS", profitUnits: -1 },
      { outcome: "PUSH", profitUnits: 0 },
    ]),
    [0, 1.2, 0.2, 0.2],
  );
});

test("zero-sample cappers are never ranking-eligible", () => {
  const unscoped = parseLeaderboardFilters({ minPicks: "0" });
  const scoped = parseLeaderboardFilters({ sport: "MLB", minPicks: "0" });
  const zero = { settledPicks: 0 } as CapperSummary;

  assert.equal(isLeaderboardEligible(zero, unscoped), false);
  assert.equal(isLeaderboardEligible(zero, scoped), false);
  assert.equal(hasLeaderboardSample(zero, unscoped), false);
});

test("below-minimum-sample cappers are not ranking-eligible", () => {
  const filters = parseLeaderboardFilters({ minPicks: "10" });
  assert.equal(
    isLeaderboardEligible({ settledPicks: 9 } as CapperSummary, filters),
    false,
  );
  assert.equal(
    isLeaderboardEligible(
      { settledPicks: 10, units: 0, roi: 0 } as CapperSummary,
      filters,
    ),
    true,
  );
});

test("sample-eligible negative records remain honestly ranked", () => {
  const filters = parseLeaderboardFilters({ minPicks: "10" });
  assert.equal(
    isLeaderboardEligible(
      { settledPicks: 20, units: -0.01, roi: -0.1 } as CapperSummary,
      filters,
    ),
    true,
  );
  assert.equal(
    isLeaderboardEligible(
      { settledPicks: 20, units: 0, roi: 0 } as CapperSummary,
      filters,
    ),
    true,
  );
});

test("isBuildingARecord agrees with the leaderboard partition gate", () => {
  // Prefer partitioned rank when present (feed cards use this).
  assert.equal(isBuildingARecord({ rank: 0, settledPicks: 0 }), true);
  assert.equal(isBuildingARecord({ rank: 1, settledPicks: 0 }), false);
  // Default minPicks=0 matches getLeaderboardResult(): zero graded = building.
  assert.equal(isBuildingARecord({ settledPicks: 0 }), true);
  assert.equal(isBuildingARecord({ settledPicks: 1 }), false);
  // Unknown sample is not treated as building (mock cards without partition data).
  assert.equal(isBuildingARecord({}), false);
  // Higher threshold matches leaderboard min-sample filter.
  assert.equal(isBuildingARecord({ settledPicks: 9 }, 10), true);
  assert.equal(isBuildingARecord({ settledPicks: 10 }, 10), false);
  // Performance does not decide eligibility; negative records remain rankable.
  assert.equal(
    isBuildingARecord({ settledPicks: 10, units: -0.25, roi: -2 }, 10),
    false,
  );
});

test("partitionLeaderboard ranks every sample-eligible capper and clears unranked places", () => {
  const filters = parseLeaderboardFilters({ minPicks: "10", sort: "units" });
  const cappers = [
    {
      id: "a",
      name: "Alpha",
      settledPicks: 12,
      units: 4,
      roi: 10,
      winPct: 55,
      rank: 99,
    },
    {
      id: "b",
      name: "Bravo",
      settledPicks: 0,
      units: 0,
      roi: 0,
      winPct: 0,
      rank: 99,
    },
    {
      id: "c",
      name: "Charlie",
      settledPicks: 5,
      units: 20,
      roi: 40,
      winPct: 80,
      rank: 99,
    },
    {
      id: "d",
      name: "Delta",
      settledPicks: 15,
      units: 8,
      roi: 12,
      winPct: 60,
      rank: 99,
    },
    {
      id: "e",
      name: "Echo",
      settledPicks: 18,
      units: -2,
      roi: -4,
      winPct: 45,
      rank: 99,
    },
  ] as CapperSummary[];

  const { ranked, unranked } = partitionLeaderboard(cappers, filters);
  assert.equal(ranked.length + unranked.length, cappers.length);

  assert.deepEqual(
    ranked.map((c) => ({ id: c.id, rank: c.rank })),
    [
      { id: "d", rank: 1 },
      { id: "a", rank: 2 },
      { id: "e", rank: 3 },
    ],
  );
  assert.deepEqual(
    unranked.map((c) => ({ id: c.id, rank: c.rank })),
    [
      { id: "c", rank: 0 },
      { id: "b", rank: 0 },
    ],
  );
});

test("leaderboard summary keeps ranked count separate from scoped totals", () => {
  const ranked = [
    {
      verified: true,
      verifiedShare: 100,
      record: { w: 6, l: 4, p: 0 },
      settledPicks: 10,
      units: 2,
      stakedUnits: 10,
    },
  ] as CapperSummary[];
  const unranked = [
    {
      verified: false,
      verifiedShare: 0,
      record: { w: 1, l: 4, p: 0 },
      settledPicks: 5,
      units: -1,
      stakedUnits: 5,
    },
  ] as CapperSummary[];

  assert.deepEqual(summarizeLeaderboard(ranked, unranked), {
    rankedCappers: 1,
    verifiedCappers: 1,
    trackedPicks: 15,
    winPct: (7 / 15) * 100,
    netUnits: 1,
    roi: (1 / 15) * 100,
    profitableCappers: 1,
  });
});
