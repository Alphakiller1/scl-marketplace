import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflow = readFileSync(".github/workflows/populate-odds.yml", "utf8");
const route = readFileSync("src/app/api/cron/odds-populate/route.ts", "utf8");
const vercel = readFileSync("vercel.json", "utf8");

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
  // The manual dispatch reaches the paid route only when it carries neither a
  // temporary key nor a snapshot file to replay — a replay must never spend
  // credits just because it was dispatched from the same workflow.
  assert.match(
    workflow,
    /event_name == 'schedule' \|\| \(github\.event_name == 'workflow_dispatch' && inputs\.odds_key == '' && inputs\.snapshot_file == ''\)/,
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
  assert.match(workflow, /skipPopulated=\$\{SKIP_POPULATED\}/);
  assert.match(workflow, /expandedOrder=\$\{encoded_order\}/);
  assert.match(workflow, /client_payload\.skipPopulated \|\| '1'/);
  // Soccer joins the expanded order last: its per-event call is Double Chance
  // only, and it is the sport that can be cut short without leaving a fixture
  // unbettable.
  assert.match(
    workflow,
    /client_payload\.expandedOrder \|\| 'MLB,WNBA,TENNIS,SOCCER'/,
  );
  assert.match(
    workflow,
    /\(\.sports \| index\("MLB"\) \| not\) or \(\.surface\.MLB\.events/,
  );
  assert.match(
    workflow,
    /\(\.sports \| index\("WNBA"\) \| not\) or \(\.surface\.WNBA\.events/,
  );
  assert.match(
    workflow,
    /\(\.sports \| index\("TENNIS"\) \| not\) or \(\.surface\.TENNIS\.events/,
  );
  assert.match(
    workflow,
    /\(\.sports \| index\("SOCCER"\) \| not\) or \(\.surface\.SOCCER\.events/,
  );
  assert.match(
    workflow,
    /\(\.sports \| index\("NFL"\) \| not\) or \(\.surface\.NFL\.events/,
  );
  assert.doesNotMatch(
    workflow,
    /jq -e '\.ok == true and \.surface\.MLB\.events > 0 and \.surface\.WNBA\.events > 0'/,
  );
  // Scoped to the paid job rather than the file: a temp-key population must
  // still reach the database only through the signed route, but the replay job
  // added alongside it writes the database directly and by design — it spends
  // no credits and has no route to go through.
  const tempKeyJob = workflow.slice(
    workflow.indexOf("populate-temp-key:"),
    workflow.indexOf("\n  populate:"),
  );
  assert.doesNotMatch(tempKeyJob, /secrets\.DATABASE_URL/);
  assert.doesNotMatch(workflow, /WRITE_DB/);
});

test("production route accepts a one-shot key, expands supported sports, and retains fallback", () => {
  assert.match(route, /process\.env\.CRON_SECRET/);
  assert.match(route, /x-scl-odds-key/);
  assert.match(route, /pinOddsApiKey/);
  assert.match(route, /resetOddsKeyPreference/);
  assert.match(route, /resetLastOddsApiUsage/);
  assert.match(route, /setOddsCircuitBreakSuspended\(true\)/);
  assert.match(route, /fetchUpcomingOdds/);
  assert.match(route, /updateOddsBoardSegment/);
  assert.match(route, /loadCachedOddsBoard/);
  assert.match(route, /parseExpandedSportOrder/);
  assert.match(route, /shouldHoldCreditsForLater/);
  assert.match(route, /loadCachedEventBoard/);
  assert.match(route, /summarizeEventMarketCoverage/);
  assert.match(route, /coverage\.fullyCovered/);
  assert.match(route, /skipPopulated/);
  assert.match(route, /loadEventBoard/);
  assert.match(route, /forceRefresh: true/);
  assert.match(
    route,
    /DEFAULT_SPORTS = \["MLB", "WNBA", "TENNIS", "SOCCER", "NFL"\]/,
  );
  assert.match(route, /DEFAULT_SPORTS\.every\(surfaceReady\)/);
});

test("Vercel cron is a backup when GitHub misses the 20:00 ET populate", () => {
  assert.match(vercel, /\/api\/cron\/odds-populate/);
  assert.match(vercel, /0 12 \* \* \*/);
  assert.match(vercel, /0 0 \* \* \*/);
  assert.match(vercel, /TENNIS,SOCCER,NFL/);
});

test("a snapshot replay writes the database and spends no Odds API credits", () => {
  assert.match(workflow, /write-snapshots:/);
  assert.match(workflow, /inputs\.snapshot_file != ''/);
  assert.match(workflow, /scripts\/write-odds-snapshots\.ts/);
  assert.match(workflow, /SNAPSHOT_FILE: data\/odds-snapshots\//);
  assert.match(workflow, /DATABASE_URL: \$\{\{ secrets\.DATABASE_URL \}\}/);
  // The replay job must never touch the provider: no key input, no odds route.
  const replayJob = workflow.slice(
    workflow.indexOf("write-snapshots:"),
    workflow.indexOf("populate-temp-key:"),
  );
  assert.doesNotMatch(replayJob, /x-scl-odds-key/);
  assert.doesNotMatch(replayJob, /the-odds-api\.com/);
  assert.doesNotMatch(replayJob, /api\/cron\/odds-populate/);
});
