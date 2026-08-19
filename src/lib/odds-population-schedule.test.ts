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

test("scheduled population calls the signed production route, never a stored Odds API key", () => {
  assert.match(workflow, /secrets\.CRON_SECRET/);
  assert.match(workflow, /Authorization: Bearer \$CRON_SECRET/);
  assert.match(workflow, /api\/cron\/odds-populate/);
  assert.doesNotMatch(workflow, /secrets\.ODDS_API_KEY/);
  assert.match(
    workflow,
    /event_name == 'schedule' \|\| \(github\.event_name == 'workflow_dispatch' && inputs\.odds_key == ''\)/,
  );
});

test("manual temp-key population writes via DATABASE_URL and never stores the key", () => {
  assert.match(workflow, /inputs\.odds_key/);
  assert.match(workflow, /::add-mask::\$\{\{ inputs\.odds_key \}\}/);
  assert.match(workflow, /ODDS_KEY: \$\{\{ inputs\.odds_key \}\}/);
  assert.match(workflow, /secrets\.DATABASE_URL/);
  assert.match(workflow, /WRITE_DB: "1"/);
  assert.match(workflow, /npx tsx scripts\/populate-odds-today\.ts/);
});

test("production route warms surfaces, expands WNBA then MLB, and retains fallback", () => {
  assert.match(route, /process\.env\.CRON_SECRET/);
  assert.match(route, /fetchUpcomingOdds/);
  assert.match(route, /updateOddsBoardSegment/);
  assert.match(route, /loadCachedOddsBoard/);
  assert.match(route, /EXPANDED_SPORT_ORDER = \["WNBA", "MLB"\]/);
  assert.match(route, /loadEventBoard/);
  assert.match(route, /forceRefresh: true/);
});
