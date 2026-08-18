import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(relativePath: string) {
  return readFileSync(relativePath, "utf8");
}

test("By sport is a single career table, not a legacy/SCL split", () => {
  const dashboard = source("src/app/(capper)/dashboard/page.tsx");
  const breakdown = source("src/components/scl/legacy-sport-breakdown.tsx");
  const capper = source("src/lib/queries/capper.ts");

  assert.match(dashboard, /mergeCareerSportRecords/);
  assert.doesNotMatch(dashboard, /PerformanceBySport/);
  assert.match(breakdown, /By sport/);
  assert.doesNotMatch(breakdown, /Legacy by sport/);
  assert.match(breakdown, /forceLabel/);
  assert.match(capper, /mergeCareerSportRecords/);
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
  assert.match(schedule, /08:00 ET/);
  assert.match(schedule, /20:00 ET/);
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
