import assert from "node:assert/strict";
import test from "node:test";

import {
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
