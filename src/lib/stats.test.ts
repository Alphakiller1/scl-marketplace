import assert from "node:assert/strict";
import { test } from "node:test";

import { computeStatsBySport, computeStatsSince, daysAgo } from "@/lib/stats";

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
