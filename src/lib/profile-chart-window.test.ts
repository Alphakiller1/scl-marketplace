import assert from "node:assert/strict";
import test from "node:test";

import {
  buildProfileChartSeries,
  profileProfitUnitsForWindow,
} from "./profile-chart-window";

const asOf = new Date("2026-07-19T12:00:00.000Z");
const plays = [
  {
    createdAt: new Date("2025-06-01T12:00:00.000Z"),
    outcome: "WIN",
    profitUnits: 1.2,
  },
  {
    createdAt: new Date("2025-12-01T12:00:00.000Z"),
    outcome: "LOSS",
    profitUnits: -1,
  },
  {
    createdAt: new Date("2026-05-01T12:00:00.000Z"),
    outcome: "WIN",
    profitUnits: 0.91,
  },
  {
    createdAt: new Date("2026-06-01T12:00:00.000Z"),
    outcome: "PENDING",
    profitUnits: null,
  },
];

test("profile chart windows include only settled points inside the scope", () => {
  assert.deepEqual(profileProfitUnitsForWindow(plays, "3m", asOf), [0.91]);
  assert.deepEqual(profileProfitUnitsForWindow(plays, "12m", asOf), [-1, 0.91]);
});

test("profile chart All keeps every settled point in chronological order", () => {
  assert.deepEqual(
    profileProfitUnitsForWindow(plays, "all", asOf),
    [1.2, -1, 0.91],
  );
});

test("profile chart excludes future-dated and non-numeric points", () => {
  assert.deepEqual(
    profileProfitUnitsForWindow(
      [
        ...plays,
        {
          createdAt: new Date("2026-08-01T12:00:00.000Z"),
          outcome: "WIN",
          profitUnits: 1,
        },
        {
          createdAt: new Date("2026-07-01T12:00:00.000Z"),
          outcome: "WIN",
          profitUnits: Number.NaN,
        },
      ],
      "all",
      asOf,
    ),
    [1.2, -1, 0.91],
  );
});

test("profile chart series bounds payload while retaining the true count and end", () => {
  const many = Array.from({ length: 200 }, (_, index) => ({
    createdAt: new Date(Date.UTC(2026, 0, 1 + index)),
    outcome: "WIN",
    profitUnits: 1,
  }));
  const series = buildProfileChartSeries(
    many,
    new Date("2026-12-31T23:59:59.999Z"),
    12,
  ).all;
  assert.equal(series.gradedCount, 200);
  assert.equal(series.points.length, 12);
  assert.equal(series.points.at(-1)?.units, 200);
});
