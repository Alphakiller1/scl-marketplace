import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflow = readFileSync(".github/workflows/populate-odds.yml", "utf8");
const route = readFileSync("src/app/api/cron/odds-populate/route.ts", "utf8");

test("population performs exactly two scheduled surface refreshes per day", () => {
  const cronLines = workflow.match(/^\s*- cron:/gm) ?? [];
  assert.equal(cronLines.length, 2);
  assert.match(workflow, /EXPANDED:.*event_name == 'schedule'.*'0'/);
  assert.match(workflow, /cancel-in-progress: false/);
});

test("population calls only the signed production route", () => {
  assert.match(workflow, /secrets\.CRON_SECRET/);
  assert.match(workflow, /Authorization: Bearer \$CRON_SECRET/);
  assert.match(workflow, /api\/cron\/odds-populate/);
  assert.doesNotMatch(workflow, /secrets\.DATABASE_URL/);
  assert.doesNotMatch(workflow, /secrets\.ODDS_API_KEY/);
});

test("production route warms surfaces, expands MLB and WNBA, and retains fallback", () => {
  assert.match(route, /process\.env\.CRON_SECRET/);
  assert.match(route, /fetchUpcomingOdds/);
  assert.match(route, /updateOddsBoardSegment/);
  assert.match(route, /loadCachedOddsBoard/);
  assert.match(route, /new Set\(\["MLB", "WNBA"\]\)/);
  assert.match(route, /loadEventBoard/);
  assert.match(route, /forceRefresh: true/);
});
