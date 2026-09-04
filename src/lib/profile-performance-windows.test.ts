import assert from "node:assert/strict";
import test from "node:test";

import {
  PROFILE_PERF_HIDDEN_WINDOWS,
  PROFILE_PERF_VISIBLE_WINDOWS,
  PROFILE_PERF_WINDOWS,
  buildProfileWindowStats,
  positionInProfilePerfWindow,
  profilePerfWindowBounds,
  selectDefaultProfileWindow,
  type ProfilePosition,
} from "./profile-performance-windows";

// 2pm ET on a Friday in EDT (UTC-4).
const now = new Date("2026-09-04T18:00:00.000Z");

function position(
  slate: string,
  overrides: Partial<ProfilePosition> = {},
): ProfilePosition {
  return {
    slateAt: new Date(slate),
    createdAt: new Date(slate),
    outcome: "WIN",
    units: 1,
    profitUnits: 0.91,
    sport: "NFL",
    ...overrides,
  };
}

function wins(count: number, slate: string): ProfilePosition[] {
  return Array.from({ length: count }, () => position(slate));
}

function losses(count: number, slate: string): ProfilePosition[] {
  return Array.from({ length: count }, () =>
    position(slate, { outcome: "LOSS", profitUnits: -1 }),
  );
}

test("Yesterday is the last completed Eastern slate day, bounded both sides", () => {
  const { start, end } = profilePerfWindowBounds("1d", now);
  assert.equal(start?.toISOString(), "2026-09-03T04:00:00.000Z");
  assert.equal(end?.toISOString(), "2026-09-04T04:00:00.000Z");
});

test("a late West Coast game still counts on the day it was played", () => {
  // 10pm ET Sept 3 - grades after midnight UTC but belongs to yesterday's slate.
  const lateGame = position("2026-09-04T02:00:00.000Z");
  assert.ok(positionInProfilePerfWindow(lateGame, "1d", now));

  // 1am ET Sept 4 is today, not yesterday.
  const today = position("2026-09-04T05:00:00.000Z");
  assert.ok(!positionInProfilePerfWindow(today, "1d", now));
});

test("scope membership follows the slate instant, not the log time", () => {
  // Logged a week early, played yesterday: it belongs to yesterday's slate.
  const bookedEarly = position("2026-09-03T23:00:00.000Z", {
    createdAt: new Date("2026-08-27T12:00:00.000Z"),
  });
  assert.ok(positionInProfilePerfWindow(bookedEarly, "1d", now));

  // Logged yesterday, but for a game played in March. Log time would drag a
  // months-old result into Yesterday.
  const backfilled = position("2026-03-10T23:00:00.000Z", {
    createdAt: new Date("2026-09-03T12:00:00.000Z"),
  });
  assert.ok(!positionInProfilePerfWindow(backfilled, "1d", now));
  assert.ok(positionInProfilePerfWindow(backfilled, "ytd", now));
});

test("YTD is anchored to the Eastern calendar year, not UTC", () => {
  assert.equal(
    profilePerfWindowBounds("ytd", now).start?.toISOString(),
    "2026-01-01T05:00:00.000Z",
  );
  // 9pm ET New Year's Eve - already Jan 1 in UTC, still last year in ET.
  const nye = position("2026-01-01T02:00:00.000Z");
  assert.ok(!positionInProfilePerfWindow(nye, "ytd", now));
  assert.ok(
    positionInProfilePerfWindow(
      position("2026-01-01T06:00:00.000Z"),
      "ytd",
      now,
    ),
  );
});

test("a graded pick dated in the future is in no scope at all", () => {
  const future = position("2026-12-25T18:00:00.000Z");
  for (const { key } of PROFILE_PERF_WINDOWS) {
    assert.ok(
      !positionInProfilePerfWindow(future, key, now),
      `future position leaked into ${key}`,
    );
  }
});

test("the carried legacy balance reaches All Time and no rolling scope", () => {
  const byWindow = buildProfileWindowStats({
    positions: wins(3, "2026-09-02T18:00:00.000Z"),
    now,
    allTimeBaseline: {
      wins: 1000,
      losses: 900,
      pushes: 10,
      stakedUnits: 1910,
      units: 120,
    },
  });

  assert.equal(byWindow.all.graded, 1913);
  assert.ok(byWindow.all.carriesLegacy);
  // The rolling scopes see only the three receipts.
  assert.equal(byWindow["7d"].graded, 3);
  assert.ok(!byWindow["7d"].carriesLegacy);
  assert.equal(byWindow.ytd.graded, 3);
});

test("YTD drops the plays already inside the old site's year-to-date total", () => {
  // The legacy CURRENT_YEAR aggregate already contains the imported rows, so
  // counting those plays beside it would double-count the overlap.
  const snapshot = new Date("2026-07-29T00:00:00.000Z");
  const byWindow = buildProfileWindowStats({
    positions: [
      ...wins(5, "2026-05-01T18:00:00.000Z"), // imported, inside the aggregate
      ...wins(2, "2026-08-15T18:00:00.000Z"), // logged after the export
    ],
    now,
    ytdBaseline: {
      wins: 60,
      losses: 40,
      pushes: 0,
      stakedUnits: 100,
      units: 12,
    },
    legacySnapshotAt: snapshot,
  });

  // 100 carried + the 2 post-snapshot receipts. The 5 imported plays are not
  // added a second time.
  assert.equal(byWindow.ytd.graded, 102);
  // Without the guard this would be 107.
  assert.notEqual(byWindow.ytd.graded, 107);
});

test("a strong 7-day stretch can take the default slot from wider scopes", () => {
  const byWindow = buildProfileWindowStats({
    positions: [
      ...wins(12, "2026-09-01T18:00:00.000Z"), // inside 7D
      ...losses(20, "2026-08-25T18:00:00.000Z"), // inside 14D, outside 7D
    ],
    now,
  });

  assert.ok(byWindow["7d"].qualifies);
  assert.ok(byWindow["7d"].stats.roi > byWindow["14d"].stats.roi);
  assert.equal(selectDefaultProfileWindow(byWindow), "7d");
});

test("a hot two-pick sample cannot drive the profile", () => {
  const byWindow = buildProfileWindowStats({
    positions: [
      ...wins(2, "2026-09-03T18:00:00.000Z"), // perfect, but 2 picks
      ...wins(6, "2026-08-20T18:00:00.000Z"),
      ...losses(6, "2026-08-20T18:00:00.000Z"),
    ],
    now,
  });

  assert.equal(byWindow["1d"].graded, 2);
  assert.ok(!byWindow["1d"].qualifies, "2 graded must not clear the gate");
  assert.notEqual(selectDefaultProfileWindow(byWindow), "1d");
});

test("the default is ranked on ROI so volume alone cannot win the slot", () => {
  const byWindow = buildProfileWindowStats({
    positions: [
      ...wins(11, "2026-09-01T18:00:00.000Z"), // recent: +10.01u on 11 staked
      // February: inside YTD and All, outside every trailing scope. A big book
      // of picks that nets a positive number at a poor rate.
      ...wins(400, "2026-02-01T18:00:00.000Z"),
      ...losses(350, "2026-02-01T18:00:00.000Z"),
    ],
    now,
  });

  // All Time holds far more units than the recent scopes, at a worse rate.
  assert.ok(byWindow.all.stats.units > byWindow["90d"].stats.units);
  assert.ok(byWindow.all.stats.roi < byWindow["90d"].stats.roi);

  // Ranking on units would hand the slot to All Time. Ranking on ROI does not.
  const selected = selectDefaultProfileWindow(byWindow);
  assert.notEqual(selected, "all");
  assert.notEqual(selected, "ytd");
  // 90D is the widest scope holding only the strong recent run.
  assert.equal(selected, "90d");
});

test("with nothing qualifying, the profile opens on the widest scope with results", () => {
  const byWindow = buildProfileWindowStats({
    positions: wins(4, "2026-08-01T18:00:00.000Z"),
    now,
  });

  for (const { key } of PROFILE_PERF_WINDOWS) {
    assert.ok(!byWindow[key].qualifies, `${key} should not qualify`);
  }
  assert.equal(selectDefaultProfileWindow(byWindow), "all");
});

test("a capper with no settled results still resolves to a real scope", () => {
  const byWindow = buildProfileWindowStats({ positions: [], now });
  assert.equal(selectDefaultProfileWindow(byWindow), "all");
});

test("ties prefer the wider scope, which carries more evidence", () => {
  // The same 12 receipts are the entire record, so every scope that contains
  // them reports an identical rate. The widest one should win.
  const byWindow = buildProfileWindowStats({
    positions: wins(12, "2026-09-01T18:00:00.000Z"),
    now,
  });

  assert.equal(byWindow["7d"].stats.roi, byWindow.all.stats.roi);
  assert.equal(selectDefaultProfileWindow(byWindow), "all");
});

test("the sport breakdown is scoped to the selected window", () => {
  const byWindow = buildProfileWindowStats({
    positions: [
      ...wins(3, "2026-09-01T18:00:00.000Z"),
      ...losses(2, "2026-01-15T18:00:00.000Z").map((p) => ({
        ...p,
        sport: "NBA",
      })),
    ],
    now,
  });

  assert.deepEqual(
    byWindow["7d"].bySport.map((row) => row.sport),
    ["NFL"],
  );
  assert.deepEqual(byWindow.ytd.bySport.map((row) => row.sport).sort(), [
    "NBA",
    "NFL",
  ]);
});

test("the scope bar offers exactly the periods the owners asked for", () => {
  assert.deepEqual(
    PROFILE_PERF_VISIBLE_WINDOWS.map((entry) => entry.key),
    ["1d", "7d", "14d", "30d", "90d", "all"],
  );
  assert.deepEqual([...PROFILE_PERF_HIDDEN_WINDOWS], ["ytd"]);
});

test("a hidden scope is still computed but can never become the default", () => {
  const byWindow = buildProfileWindowStats({
    positions: [
      // Inside YTD and All Time, outside every rolling scope.
      ...wins(12, "2026-02-01T18:00:00.000Z"),
      // Last year: drags All Time down but is outside YTD.
      ...losses(30, "2025-06-01T18:00:00.000Z"),
    ],
    now,
  });

  // YTD is built, and on the numbers alone it would win the slot outright.
  assert.equal(byWindow.ytd.graded, 12);
  assert.ok(byWindow.ytd.qualifies);
  assert.ok(byWindow.ytd.stats.roi > byWindow.all.stats.roi);

  // It is not offered, so it cannot be what the profile opens on.
  assert.equal(selectDefaultProfileWindow(byWindow), "all");
});
