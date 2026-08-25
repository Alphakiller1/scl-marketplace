import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  expectedFinalAt,
  expectedFinalHours,
} from "@/lib/results/grading-window";

const root = process.cwd();

test("sport-specific final windows do not flag live games as stuck", () => {
  const starts = new Date("2026-08-12T17:40:00Z");
  assert.equal(expectedFinalHours("MLB"), 6);
  assert.equal(
    expectedFinalAt("MLB", starts).toISOString(),
    "2026-08-12T23:40:00.000Z",
  );
  assert.equal(expectedFinalHours("WNBA"), 5);
  assert.equal(expectedFinalHours("MMA"), 8);
});

test("grader has independent Plan C, key rollover, stale-lock recovery and hard alerts", () => {
  const provider = fs.readFileSync(
    path.join(root, "src/lib/results/provider.ts"),
    "utf8",
  );
  const route = fs.readFileSync(
    path.join(root, "src/app/api/cron/grade/route.ts"),
    "utf8",
  );
  const health = fs.readFileSync(
    path.join(root, "src/lib/grading-health.ts"),
    "utf8",
  );
  const workflow = fs.readFileSync(
    path.join(root, ".github/workflows/grade-cron.yml"),
    "utf8",
  );
  assert.match(provider, /fetchWithOddsKeyRollover/);
  assert.match(provider, /mlbOfficialResultsProvider/);
  assert.match(provider, /wnbaOfficialResultsProvider/);
  assert.match(provider, /sportsPuffResultsProvider/);
  assert.match(provider, /ODDS_SCORES_ONLY_SPORTS/);
  assert.match(provider, /scoresProviderForSports/);
  assert.match(provider, /"MMA"/);
  assert.match(provider, /"TENNIS"/);
  assert.match(provider, /"CFL"/);
  assert.match(route, /Recovered stale RUNNING grader lock/);
  assert.match(route, /listOverduePendingPlays/);
  assert.match(route, /status: gradeOk \? 200 : 503/);
  assert.match(route, /status: gradeOk \? "SUCCESS" : "FAILED"/);
  assert.match(route, /revalidateTag\("leaderboard", \{ expire: 0 \}\)/);
  assert.match(route, /revalidatePath\("\/cappers\/\[handle\]", "page"\)/);
  assert.match(route, /getGradingResultsProvider/);
  assert.match(route, /x-scl-odds-key/);
  assert.match(route, /pinOddsApiKey/);
  assert.match(route, /resetOddsKeyPreference/);
  assert.doesNotMatch(route, /snapshotClosingOdds/);
  assert.doesNotMatch(route, /odds-coverage-report/);
  assert.match(health, /pendingPastExpectedFinal/);
  assert.match(health, /isAutoGradeBlocked/);
  assert.match(health, /units: \{ gte: UNIT_MIN \}/);

  const stuck = fs.readFileSync(
    path.join(root, "src/lib/results/stuck-plays.ts"),
    "utf8",
  );
  // Overdue inventory must match health or the cron 503s a HEALTHY run.
  assert.match(stuck, /parlayId: null/);
  assert.match(stuck, /units: \{ gte: UNIT_MIN \}/);
  // Every 30 minutes — pinned so automatic grading cannot drift to a slower cadence.
  assert.match(workflow, /- cron: "7,37 \* \* \* \*"/);
  assert.match(workflow, /types: \[grade-pending\]/);
  assert.match(workflow, /--retry 3/);
  assert.match(workflow, /overduePending/);
  assert.match(workflow, /inputs\.odds_key/);
  assert.match(workflow, /::add-mask::\$ODDS_KEY/);
  assert.match(workflow, /x-scl-odds-key: \$ODDS_KEY/);

  const espn = fs.readFileSync(
    path.join(root, "src/lib/results/espn-scores.ts"),
    "utf8",
  );
  assert.match(espn, /CFL: \{ sport: "football", league: "cfl" \}/);
  assert.match(espn, /MMA: \{ sport: "mma", league: "ufc" \}/);
  assert.match(espn, /fetchEspnTennisTour/);
  assert.match(espn, /"atp"/);
  assert.match(espn, /"wta"/);

  const cflCa = fs.readFileSync(
    path.join(root, "src/lib/results/cfl-ca-scores.ts"),
    "utf8",
  );
  assert.match(cflCa, /cfl-ca/);
  assert.match(provider, /cflCaResultsProvider\(\)/);

  const grader = fs.readFileSync(
    path.join(root, "src/lib/results/auto-grade.ts"),
    "utf8",
  );
  assert.match(grader, /MAX_GRADE_ROUNDS/);
  assert.match(grader, /clvPtsForGrade/);
  assert.doesNotMatch(grader, /ensureClosingAndClv/);
  assert.match(grader, /loadOddsEventIdentity/);
  assert.match(grader, /recoverFixtureFromIdentity/);
  assert.match(grader, /recoverFixtureFromSelections/);
  assert.match(grader, /fetchWnbaOfficialPeriodBoxScore/);

  const boardCache = fs.readFileSync(
    path.join(root, "src/lib/odds-board-cache.ts"),
    "utf8",
  );
  assert.match(boardCache, /archiveOddsEventIdentities\(events\)/);
});
