import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPerformanceTrend,
  hasLeaderboardSample,
  leaderboardWindowStart,
  parseLeaderboardFilters,
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
      sort: "units",
      minPicks: 0,
      verifiedOnly: false,
      search: "edge",
    },
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

test("scoped leaderboards exclude cappers without a settled sample", () => {
  const filters = parseLeaderboardFilters({ sport: "MLB", minPicks: "0" });
  const capper = { settledPicks: 0 } as CapperSummary;

  assert.equal(hasLeaderboardSample(capper, filters), false);
  assert.equal(
    hasLeaderboardSample({ settledPicks: 1 } as CapperSummary, filters),
    true,
  );
});

test("leaderboard summary is weighted from tracked records", () => {
  const cappers = [
    {
      verified: true,
      record: { w: 6, l: 4, p: 0 },
      settledPicks: 10,
      units: 2,
      stakedUnits: 10,
    },
    {
      verified: false,
      record: { w: 1, l: 4, p: 0 },
      settledPicks: 5,
      units: -1,
      stakedUnits: 5,
    },
  ] as CapperSummary[];

  assert.deepEqual(summarizeLeaderboard(cappers), {
    rankedCappers: 2,
    verifiedCappers: 1,
    trackedPicks: 15,
    winPct: (7 / 15) * 100,
    netUnits: 1,
    roi: (1 / 15) * 100,
    profitableCappers: 1,
  });
});
