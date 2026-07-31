import assert from "node:assert/strict";
import { test } from "node:test";

import {
  computeCapperStats,
  computeStatsBySport,
  computeStatsSince,
  daysAgo,
} from "@/lib/stats";

test("computeStatsBySport groups per sport, drops unsettled, sorts by units", () => {
  const rows = [
    { sport: "nba", outcome: "WIN" as const, units: 1, profitUnits: 0.9 },
    { sport: "nba", outcome: "LOSS" as const, units: 1, profitUnits: -1 },
    { sport: "mlb", outcome: "WIN" as const, units: 2, profitUnits: 3 },
    { sport: "nfl", outcome: "PENDING" as const, units: 1, profitUnits: null },
  ];
  const bySport = computeStatsBySport(rows);
  // nfl has no settled play -> dropped; mlb (+3u) ranks above nba (-0.1u)
  assert.deepEqual(
    bySport.map((s) => s.sport),
    ["mlb", "nba"],
  );
  assert.equal(bySport[0].units, 3);
  assert.equal(bySport[1].wins, 1);
  assert.equal(bySport[1].losses, 1);
});

test("computeStatsSince filters by creation time", () => {
  const now = new Date();
  const rows = [
    {
      outcome: "WIN" as const,
      units: 1,
      profitUnits: 1,
      createdAt: daysAgo(2, now),
    },
    {
      outcome: "LOSS" as const,
      units: 1,
      profitUnits: -1,
      createdAt: daysAgo(40, now),
    },
  ];
  const last30 = computeStatsSince(rows, daysAgo(30, now));
  assert.equal(last30.settled, 1); // only the 2-day-old play is in window
  assert.equal(last30.units, 1);
});

test("computeCapperStats folds a legacy baseline into record, units and ROI", () => {
  const plays = [
    { outcome: "WIN" as const, units: 1, profitUnits: 1 },
    { outcome: "LOSS" as const, units: 1, profitUnits: -1 },
  ];
  const baseline = {
    wins: 10,
    losses: 8,
    pushes: 2,
    stakedUnits: 20,
    units: 4,
  };
  const stats = computeCapperStats(plays, baseline);

  assert.equal(stats.wins, 11);
  assert.equal(stats.losses, 9);
  assert.equal(stats.pushes, 2);
  assert.equal(stats.settled, 22);
  assert.equal(stats.stakedUnits, 22);
  assert.equal(stats.units, 4);
  // Derived metrics must come from the merged totals, not the plays alone.
  assert.equal(stats.winPct, (11 / 20) * 100);
  assert.equal(stats.roi, (4 / 22) * 100);
});

test("computeCapperStats without a baseline is unchanged", () => {
  const plays = [
    { outcome: "WIN" as const, units: 1, profitUnits: 1 },
    { outcome: "LOSS" as const, units: 1, profitUnits: -1 },
  ];
  assert.deepEqual(computeCapperStats(plays), computeCapperStats(plays, null));
});

test("a legacy baseline never adds pending — carried-over results are settled", () => {
  const stats = computeCapperStats(
    [{ outcome: "PENDING" as const, units: 1, profitUnits: null }],
    { wins: 5, losses: 5, pushes: 0, stakedUnits: 10, units: 0 },
  );
  assert.equal(stats.pending, 1);
  assert.equal(stats.settled, 10);
});
