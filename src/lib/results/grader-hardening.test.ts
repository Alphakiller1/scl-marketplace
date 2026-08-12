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
  assert.match(route, /Recovered stale RUNNING grader lock/);
  assert.match(route, /listOverduePendingPlays/);
  assert.match(route, /status: gradeOk \? 200 : 503/);
  assert.match(route, /status: gradeOk \? "SUCCESS" : "FAILED"/);
  assert.match(route, /revalidateTag\("leaderboard", \{ expire: 0 \}\)/);
  assert.match(route, /revalidatePath\("\/cappers\/\[handle\]", "page"\)/);
  assert.match(health, /pendingPastExpectedFinal/);
  assert.match(workflow, /7,22,37,52 \* \* \* \*/);
  assert.match(workflow, /--retry 3/);
  assert.match(workflow, /overduePending/);

  const grader = fs.readFileSync(
    path.join(root, "src/lib/results/auto-grade.ts"),
    "utf8",
  );
  assert.match(grader, /One immutable provider snapshot per job/);
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
