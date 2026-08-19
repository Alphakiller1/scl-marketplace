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

test("manual temp-key population sends the key to the signed route and never stores it", () => {
  assert.match(workflow, /repository_dispatch:/);
  assert.match(workflow, /types: \[populate-odds\]/);
  assert.match(workflow, /inputs\.odds_key/);
  assert.match(
    workflow,
    /::add-mask::\$\{\{ github\.event\.client_payload\.odds_key \|\| github\.event\.inputs\.odds_key \}\}/,
  );
  assert.match(workflow, /x-scl-odds-key: \$ODDS_KEY/);
  assert.doesNotMatch(workflow, /secrets\.DATABASE_URL/);
  assert.doesNotMatch(workflow, /WRITE_DB/);
});

test("production route accepts a one-shot key after auth, expands WNBA then MLB, and retains fallback", () => {
  assert.match(route, /process\.env\.CRON_SECRET/);
  assert.match(route, /x-scl-odds-key/);
  assert.match(route, /pinOddsApiKey/);
  assert.match(route, /fetchUpcomingOdds/);
  assert.match(route, /updateOddsBoardSegment/);
  assert.match(route, /loadCachedOddsBoard/);
  assert.match(route, /EXPANDED_SPORT_ORDER = \["WNBA", "MLB"\]/);
  assert.match(route, /loadEventBoard/);
  assert.match(route, /forceRefresh: true/);
});
