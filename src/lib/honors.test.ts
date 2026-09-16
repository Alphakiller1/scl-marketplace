import assert from "node:assert/strict";
import test from "node:test";

import {
  computeHonors,
  featuredHonors,
  HONOR_MINIMUMS,
  honorsRules,
  seasonPeriod,
  type HonorCapper,
  type HonorLegacyTotal,
  type HonorPosition,
} from "@/lib/honors";
import { CROSS_SPORTS } from "@/lib/parlay-sport";

const ALICE: HonorCapper = { id: "a", name: "alice", handle: "alice" };
const BOB: HonorCapper = { id: "b", name: "bob", handle: "bob" };

function picks(
  capperId: string,
  sport: string,
  at: string,
  count: number,
  profitEach: number,
): HonorPosition[] {
  return Array.from({ length: count }, () => ({
    capperId,
    sport,
    at: new Date(at),
    outcome: profitEach >= 0 ? "WIN" : "LOSS",
    units: 1,
    profitUnits: profitEach,
  }));
}

const NOW = new Date("2026-09-16T16:00:00Z");

test("monthly awards cover the last completed month, never the current one", () => {
  const awards = computeHonors({
    cappers: [ALICE],
    positions: [
      ...picks("a", "MLB", "2026-08-10T23:00:00Z", 12, 1),
      ...picks("a", "MLB", "2026-09-05T23:00:00Z", 12, 1),
    ],
    legacy: [],
    now: NOW,
  });
  const monthly = awards.filter((a) => a.period === "monthly");
  assert.deepEqual(
    monthly.map((a) => a.id),
    ["monthly-2026-08-mlb-units", "monthly-2026-08-mlb-roi"],
  );
  assert.equal(monthly[0]!.name, "August 2026 MLB Units Champion");
  assert.equal(monthly[0]!.abbreviation, "MLB AUG26 ($)");
  assert.equal(monthly[1]!.abbreviation, "MLB AUG26 (%)");
});

test("months follow Eastern Time at the boundary", () => {
  // 02:00 UTC on Sep 1 is still Aug 31 in New York.
  const awards = computeHonors({
    cappers: [ALICE],
    positions: picks("a", "NFL", "2026-09-01T02:00:00Z", 10, 1),
    legacy: [],
    now: NOW,
  });
  assert.ok(awards.some((a) => a.id === "monthly-2026-08-nfl-units"));
});

test("a negative or below-minimum record never wins", () => {
  const awards = computeHonors({
    cappers: [ALICE, BOB],
    positions: [
      ...picks("a", CROSS_SPORTS, "2026-08-10T23:00:00Z", 12, -1),
      ...picks("b", "MLB", "2026-08-10T23:00:00Z", 9, 5),
    ],
    legacy: [],
    now: NOW,
  });
  assert.deepEqual(awards, []);
});

test("Cross Sport Parlay Allstar is units-only", () => {
  const awards = computeHonors({
    cappers: [ALICE],
    positions: picks(
      "a",
      CROSS_SPORTS,
      "2026-08-10T23:00:00Z",
      HONOR_MINIMUMS.cross,
      2,
    ),
    legacy: [],
    now: NOW,
  });
  assert.deepEqual(
    awards.map((a) => [a.name, a.metric, a.abbreviation]),
    [["August 2026 Cross Sport Parlay Allstar", "units", "AUG26 ($)"]],
  );
});

test("2025 annual and season awards come from the legacy 2025 records", () => {
  const legacy: HonorLegacyTotal[] = [
    {
      capperId: "a",
      scope: "YEAR_2025",
      sport: "ALL",
      wins: 300,
      losses: 200,
      pushes: 1,
      unitsRisked: 1500,
      unitsNet: 450,
    },
    {
      capperId: "b",
      scope: "YEAR_2025",
      sport: "ALL",
      wins: 60,
      losses: 40,
      pushes: 0,
      unitsRisked: 100,
      unitsNet: 50,
    },
    {
      capperId: "b",
      scope: "YEAR_2025",
      sport: "NBA",
      wins: 60,
      losses: 40,
      pushes: 0,
      unitsRisked: 100,
      unitsNet: 50,
    },
  ];
  const awards = computeHonors({
    cappers: [ALICE, BOB],
    positions: [],
    legacy,
    now: NOW,
  });
  const byId = new Map(awards.map((a) => [a.id, a]));
  assert.equal(
    byId.get("annual-2025-all-units")?.name,
    "2025 Capper of the Year",
  );
  assert.equal(byId.get("annual-2025-all-units")?.winner.handle, "alice");
  assert.equal(
    byId.get("annual-2025-all-roi")?.name,
    "2025 ROI Capper of the Year",
  );
  assert.equal(byId.get("annual-2025-all-roi")?.winner.handle, "bob");
  assert.equal(
    byId.get("season-2025-nba-units")?.name,
    "2025 NBA Season Units Champion",
  );
  // 2026 is still in progress on Sept 16.
  assert.ok(!awards.some((a) => a.periodKey === "2026"));
});

test("a season is granted only after its window closes", () => {
  const wnba = seasonPeriod("WNBA", 2026);
  assert.equal(wnba.key, "2026");
  const positions = picks("a", "WNBA", "2026-07-10T23:00:00Z", 30, 1);
  const during = computeHonors({
    cappers: [ALICE],
    positions,
    legacy: [],
    now: new Date("2026-10-31T12:00:00Z"),
  });
  assert.ok(!during.some((a) => a.id === "season-2026-wnba-units"));
  const after = computeHonors({
    cappers: [ALICE],
    positions,
    legacy: [],
    now: new Date("2026-11-01T12:00:00Z"),
  });
  assert.ok(after.some((a) => a.id === "season-2026-wnba-units"));
});

test("split-year seasons are labelled by both years", () => {
  const nba = seasonPeriod("NBA", 2026);
  assert.equal(nba.key, "2026-27");
  assert.ok(nba.end.getTime() > new Date("2027-06-30T12:00:00Z").getTime());
});

test("featured shows the latest period of each column", () => {
  const awards = computeHonors({
    cappers: [ALICE],
    positions: [
      ...picks("a", "MLB", "2026-07-10T23:00:00Z", 12, 1),
      ...picks("a", "MLB", "2026-08-10T23:00:00Z", 12, 1),
    ],
    legacy: [],
    now: NOW,
  });
  const featured = featuredHonors(awards);
  assert.deepEqual(
    [...new Set(featured.monthly.map((a) => a.periodKey))],
    ["2026-08"],
  );
  assert.equal(featured.annual.length, 0);
});

test("published rules state the configured minimums", () => {
  const text = honorsRules()
    .flatMap((group) => group.lines)
    .join(" ");
  assert.match(text, new RegExp(`Minimum ${HONOR_MINIMUMS.annual} settled`));
  assert.doesNotMatch(text, /Seasonal|rolling 90-day/);
});
