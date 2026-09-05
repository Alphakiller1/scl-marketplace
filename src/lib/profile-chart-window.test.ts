import assert from "node:assert/strict";
import test from "node:test";

import {
  PROFILE_CHART_WINDOWS,
  buildProfileChartSeries,
  profileProfitUnitsForWindow,
} from "./profile-chart-window";
import {
  buildProfileWindowStats,
  type ProfilePosition,
} from "./profile-performance-windows";

const asOf = new Date("2026-09-04T18:00:00.000Z");

function play(
  slate: string,
  profitUnits: number | null,
  overrides: Partial<ProfilePosition> = {},
): ProfilePosition {
  return {
    slateAt: new Date(slate),
    createdAt: new Date(slate),
    outcome:
      profitUnits == null ? "PENDING" : profitUnits >= 0 ? "WIN" : "LOSS",
    units: 1,
    profitUnits,
    sport: "NFL",
    ...overrides,
  };
}

test("the chart uses the performance section's scopes, not its own", () => {
  assert.deepEqual(
    PROFILE_CHART_WINDOWS.map((entry) => entry.key),
    ["1d", "7d", "14d", "30d", "60d", "90d", "ytd", "all"],
  );
});

test("chart scope membership follows the slate instant", () => {
  const plays = [
    // Played in March, logged yesterday. Log time would drag it into 7D.
    play("2026-03-10T18:00:00.000Z", 1.5, {
      createdAt: new Date("2026-09-03T12:00:00.000Z"),
    }),
    play("2026-09-02T18:00:00.000Z", 0.91),
  ];

  assert.deepEqual(profileProfitUnitsForWindow(plays, "7d", asOf), [0.91]);
  assert.deepEqual(
    profileProfitUnitsForWindow(plays, "ytd", asOf),
    [1.5, 0.91],
  );
});

test("chart points are settled, finite and chronological", () => {
  const plays = [
    play("2026-09-02T18:00:00.000Z", 0.91),
    play("2026-09-01T18:00:00.000Z", -1),
    play("2026-09-03T18:00:00.000Z", null), // pending
    play("2026-09-03T12:00:00.000Z", Number.NaN),
    play("2026-12-25T18:00:00.000Z", 5), // future slate
  ];

  assert.deepEqual(profileProfitUnitsForWindow(plays, "7d", asOf), [-1, 0.91]);
});

test("only All Time opens from the all-time carried balance", () => {
  const series = buildProfileChartSeries(
    [play("2026-09-02T18:00:00.000Z", 0.91)],
    asOf,
    120,
    { allUnits: 100 },
  );

  assert.equal(series.all.points.at(-1)?.units, 100.91);
  assert.equal(series["7d"].points.at(-1)?.units, 0.91);
  assert.equal(series.ytd.points.at(-1)?.units, 0.91);
  // Carried results have no receipts behind them.
  assert.equal(series.all.gradedCount, 1);
});

test("YTD opens from the old site's year-to-date total without redrawing it", () => {
  const snapshot = new Date("2026-07-29T00:00:00.000Z");
  const series = buildProfileChartSeries(
    [
      play("2026-05-01T18:00:00.000Z", 3), // imported, already inside the total
      play("2026-08-15T18:00:00.000Z", 0.5), // logged after the export
    ],
    asOf,
    120,
    { ytdUnits: 12, legacySnapshotAt: snapshot },
  );

  // 12 carried + 0.5 earned since. The imported +3 is not drawn on top.
  assert.equal(series.ytd.points.at(-1)?.units, 12.5);
  assert.equal(series.ytd.gradedCount, 1);

  // Without a YTD baseline the scope keeps every receipt.
  const plain = buildProfileChartSeries(
    [
      play("2026-05-01T18:00:00.000Z", 3),
      play("2026-08-15T18:00:00.000Z", 0.5),
    ],
    asOf,
    120,
  );
  assert.equal(plain.ytd.gradedCount, 2);
  assert.equal(plain.ytd.points.at(-1)?.units, 3.5);
});

test("downsampling keeps the true first and last balance", () => {
  const plays = Array.from({ length: 500 }, (_, index) =>
    play(new Date(asOf.getTime() - (index + 1) * 3_600_000).toISOString(), 1),
  );
  const series = buildProfileChartSeries(plays, asOf, 120);

  assert.ok(series["30d"].points.length <= 120);
  assert.equal(series["30d"].gradedCount, 500);
  assert.equal(series["30d"].points.at(-1)?.units, 500);
});

test("every scope's final chart point equals the units its metric row reports", () => {
  // The whole point of the feature: the graph and the numbers beside it are
  // one snapshot. If these two modules ever disagree, this fails.
  const snapshot = new Date("2026-07-29T00:00:00.000Z");
  const positions: ProfilePosition[] = [
    play("2026-09-03T18:00:00.000Z", 0.91),
    play("2026-09-01T18:00:00.000Z", -1),
    play("2026-08-20T18:00:00.000Z", 1.4),
    play("2026-06-15T18:00:00.000Z", -1),
    play("2026-05-01T18:00:00.000Z", 2.2),
    play("2025-11-02T18:00:00.000Z", 0.75),
  ];

  const allTimeBaseline = {
    wins: 40,
    losses: 30,
    pushes: 0,
    stakedUnits: 70,
    units: 18,
  };
  const ytdBaseline = {
    wins: 20,
    losses: 15,
    pushes: 0,
    stakedUnits: 35,
    units: 6,
  };

  const byWindow = buildProfileWindowStats({
    positions,
    now: asOf,
    allTimeBaseline,
    ytdBaseline,
    legacySnapshotAt: snapshot,
  });
  const series = buildProfileChartSeries(positions, asOf, 120, {
    allUnits: allTimeBaseline.units,
    ytdUnits: ytdBaseline.units,
    legacySnapshotAt: snapshot,
  });

  for (const { key } of PROFILE_CHART_WINDOWS) {
    const end = series[key].points.at(-1)?.units ?? 0;
    const metric = byWindow[key].stats.units;
    assert.equal(
      Math.round(end * 100) / 100,
      Math.round(metric * 100) / 100,
      `${key}: chart ends at ${end} but the metric row says ${metric}`,
    );
  }
});
