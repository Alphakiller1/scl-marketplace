import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(relativePath: string) {
  return readFileSync(relativePath, "utf8");
}

test("By sport is a single career table, not a legacy/SCL split", () => {
  const dashboard = source("src/app/(capper)/dashboard/page.tsx");
  const breakdown = source("src/components/scl/legacy-sport-breakdown.tsx");
  const badges = source("src/components/scl/badges.tsx");
  const capper = source("src/lib/queries/capper.ts");
  const leaderboard = source("src/lib/queries/leaderboard.ts");

  assert.match(dashboard, /mergeCareerSportRecords/);
  assert.doesNotMatch(dashboard, /PerformanceBySport/);
  assert.match(breakdown, /By sport/);
  assert.doesNotMatch(breakdown, /Legacy by sport/);
  assert.match(breakdown, /forceLabel/);
  assert.match(badges, /sportLabel\(sport\)/);
  assert.match(capper, /mergeCareerSportRecords/);
  assert.match(capper, /sclBySportByCapperId\[capper\.id\]/);
  assert.doesNotMatch(capper, /computeStatsBySport\(chartRows\)/);
  assert.match(leaderboard, /sclBySportByCapperId: Object\.fromEntries/);
});

test("dashboard trend uses the same straight and parlay positions as its stats", () => {
  const dashboard = source("src/app/(capper)/dashboard/page.tsx");

  assert.match(
    dashboard,
    /const positions = mergeRecordEntries\(plays, parlays\)/,
  );
  assert.match(
    dashboard,
    /buildPerformanceTrend\(\s*\[\.\.\.positions\]\.reverse\(\)/,
  );
});

test("Top Purchase Packages has no subtext under the heading", () => {
  const packages = source("src/components/scl/profile-top-packages.tsx");
  assert.match(packages, /Top Purchase Packages/);
  assert.doesNotMatch(packages, /Offers this capper currently sells/);
});

test("pick form names the last API call and the schedule is documented", () => {
  const picker = source("src/components/scl/game-picker.tsx");
  const schedule = source("docs/ODDS_API_SCHEDULE.md");
  assert.match(
    picker,
    /Showing odds from the last API call\. Prices may have moved\./,
  );
  // The doc has to state WHEN the board is refreshed, since the form's copy
  // ("the last API call") is only meaningful next to a cadence. It named the
  // two old run times literally, which broke the moment the cadence became an
  // intraday one — assert the shape instead: an ET column, several runs, and
  // the sports the pick form offers.
  assert.match(schedule, /ET \(EDT\)/);
  const etTimes = schedule.match(/^\| `0 \d+ \* \* \*` \| \d{2}:\d{2}/gm) ?? [];
  assert.ok(
    etTimes.length >= 5,
    `expected an intraday cadence in the doc, found ${etTimes.length} runs`,
  );
  assert.match(schedule, /\bMLB\b/);
  assert.match(schedule, /\bWNBA\b/);
});

test("999u sentinel stakes are clamped to 5u on public records and in db-patch", () => {
  const extreme = source("src/lib/extreme-stake.ts");
  const patch = source("src/app/api/admin/db-patch/route.ts");
  const leaderboard = source("src/lib/queries/leaderboard.ts");
  assert.match(extreme, /EXTREME_STAKE_UNITS = 100/);
  assert.match(extreme, /PREDICTION_UNIT_MAX/);
  assert.match(patch, /normalizeExtremeStake/);
  assert.match(leaderboard, /stakeFromStored/);
});
