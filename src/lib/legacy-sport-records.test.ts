import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  mergeCareerSportRecords,
  sortLegacySportRecords,
  toLegacySportRecordView,
} from "./legacy-sport-records";

test("toLegacySportRecordView derives win% and ROI from settled totals", () => {
  const view = toLegacySportRecordView({
    sport: "MLB",
    wins: 10,
    losses: 10,
    pushes: 2,
    unitsRisked: 20,
    unitsNet: 2,
  });
  assert.equal(view.label, "MLB");
  assert.equal(view.settled, 22);
  assert.equal(view.winPct, 50);
  assert.equal(view.roi, 10);
});

test("sortLegacySportRecords drops ALL and ranks by units then ROI", () => {
  const sorted = sortLegacySportRecords([
    {
      sport: "ALL",
      wins: 100,
      losses: 80,
      pushes: 0,
      unitsRisked: 200,
      unitsNet: 40,
    },
    {
      sport: "NBA",
      wins: 20,
      losses: 20,
      pushes: 0,
      unitsRisked: 40,
      unitsNet: 5,
    },
    {
      sport: "MLB",
      wins: 40,
      losses: 30,
      pushes: 0,
      unitsRisked: 70,
      unitsNet: 12,
    },
    {
      sport: "NFL",
      wins: 10,
      losses: 10,
      pushes: 0,
      unitsRisked: 20,
      unitsNet: 5,
    },
  ]);
  assert.deepEqual(
    sorted.map((r) => r.sport),
    ["MLB", "NFL", "NBA"],
  );
  // NFL and NBA tie on units; higher ROI (25% vs 12.5%) wins.
  assert.equal(sorted[1]!.sport, "NFL");
  assert.equal(sorted[1]!.roi, 25);
});

test("sortLegacySportRecords omits zero-settled noise rows", () => {
  const sorted = sortLegacySportRecords([
    {
      sport: "NHL",
      wins: 0,
      losses: 0,
      pushes: 0,
      unitsRisked: 0,
      unitsNet: 0,
    },
  ]);
  assert.equal(sorted.length, 0);
});

test("push-only legacy rows cannot publish profit, loss, or nonzero ROI", () => {
  const view = toLegacySportRecordView({
    sport: "NCAAB",
    wins: 0,
    losses: 0,
    pushes: 2,
    unitsRisked: 489.29,
    unitsNet: 134.43,
  });

  assert.equal(view.settled, 2);
  assert.equal(view.winPct, null);
  assert.equal(view.units, 0);
  assert.equal(view.roi, 0);
});

test("mergeCareerSportRecords folds SCL positions into legacy sports", () => {
  const merged = mergeCareerSportRecords({
    legacyBySport: [
      toLegacySportRecordView({
        sport: "MLB",
        wins: 10,
        losses: 10,
        pushes: 0,
        unitsRisked: 20,
        unitsNet: 2,
      }),
    ],
    allBaseline: {
      wins: 10,
      losses: 10,
      pushes: 0,
      stakedUnits: 20,
      units: 2,
    },
    sclBySport: [
      {
        sport: "MLB",
        wins: 2,
        losses: 0,
        pushes: 0,
        pending: 0,
        settled: 2,
        stakedUnits: 2,
        winPct: 100,
        units: 1.8,
        roi: 90,
      },
      {
        sport: "NBA",
        wins: 1,
        losses: 1,
        pushes: 0,
        pending: 0,
        settled: 2,
        stakedUnits: 2,
        winPct: 50,
        units: 0,
        roi: 0,
      },
    ],
  });

  assert.deepEqual(
    merged.map((row) => row.sport),
    ["MLB", "NBA"],
  );
  const mlb = merged[0]!;
  assert.equal(mlb.wins, 12);
  assert.equal(mlb.losses, 10);
  assert.equal(mlb.settled, 22);
  assert.equal(mlb.units, 3.8);
  assert.equal(mlb.unitsRisked, 22);
  assert.equal(merged[1]!.sport, "NBA");
  assert.equal(merged[1]!.settled, 2);
});

test("mergeCareerSportRecords puts ALL leftover in Other so sample matches Evidence Brief", () => {
  const merged = mergeCareerSportRecords({
    legacyBySport: [
      toLegacySportRecordView({
        sport: "MLB",
        wins: 100,
        losses: 100,
        pushes: 0,
        unitsRisked: 200,
        unitsNet: 10,
      }),
    ],
    allBaseline: {
      wins: 140,
      losses: 140,
      pushes: 4,
      stakedUnits: 300,
      units: 18,
    },
    sclBySport: [
      {
        sport: "NFL",
        wins: 3,
        losses: 1,
        pushes: 0,
        pending: 0,
        settled: 4,
        stakedUnits: 4,
        winPct: 75,
        units: 2,
        roi: 50,
      },
    ],
  });

  const settled = merged.reduce((sum, row) => sum + row.settled, 0);
  // ALL (284) + SCL (4) = 288. Per-sport legacy was 200, leftover 84 → Other.
  assert.equal(settled, 288);
  const other = merged.find((row) => row.sport === "OTHER");
  assert.ok(other);
  assert.equal(other.label, "Other");
  assert.equal(other.settled, 84);
  assert.equal(other.wins, 40);
  assert.equal(other.losses, 40);
  assert.equal(other.pushes, 4);
});

test("mergeCareerSportRecords does not invent Other when ALL matches per-sport legacy", () => {
  const merged = mergeCareerSportRecords({
    legacyBySport: [
      toLegacySportRecordView({
        sport: "NBA",
        wins: 5,
        losses: 5,
        pushes: 0,
        unitsRisked: 10,
        unitsNet: 1,
      }),
    ],
    allBaseline: {
      wins: 5,
      losses: 5,
      pushes: 0,
      stakedUnits: 10,
      units: 1,
    },
    sclBySport: [],
  });
  assert.equal(merged.length, 1);
  assert.equal(merged[0]!.sport, "NBA");
});

test("successful legacy data repair invalidates public record caches", () => {
  const route = readFileSync("src/app/api/admin/db-patch/route.ts", "utf8");

  assert.match(
    route,
    /if \(ok\) \{\s*revalidateTag\("leaderboard", \{ expire: 0 \}\)/,
  );
  assert.match(route, /legacyRecordInvariant: \{[\s\S]*cacheInvalidated/);
  assert.match(route, /extremeStakeRepair: \{[\s\S]*cacheInvalidated/);
});
