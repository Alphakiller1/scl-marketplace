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
  assert.match(
    workflow,
    /event_name == 'schedule' \|\| \(github\.event_name == 'workflow_dispatch' && inputs\.odds_key == ''\)/,
  );
});

test("manual temp-key population sends the key to the signed route and never stores it", () => {
  assert.match(workflow, /repository_dispatch:/);
  assert.match(workflow, /types: \[populate-odds\]/);
  assert.match(workflow, /inputs\.odds_key/);
  // Masked from the environment, never inlined into the command. The runner
  // echoes each command before it runs, so an interpolated key is printed in
  // full one line above the mask meant to hide it — which is how a one-shot key
  // ended up readable in a run log.
  assert.match(
    workflow,
    /ODDS_KEY: \$\{\{ github\.event\.client_payload\.odds_key \|\| github\.event\.inputs\.odds_key \}\}/,
  );
  assert.match(workflow, /::add-mask::\$ODDS_KEY/);
  assert.doesNotMatch(workflow, /::add-mask::\$\{\{/);
  assert.match(workflow, /x-scl-odds-key: \$ODDS_KEY/);
  assert.match(workflow, /skipPopulated=\$\{SKIP_POPULATED\}/);
  assert.match(workflow, /expandedOrder=\$\{encoded_order\}/);
  assert.match(workflow, /client_payload\.skipPopulated \|\| '1'/);
  assert.match(
    workflow,
    /client_payload\.expandedOrder \|\| 'MLB,WNBA,TENNIS'/,
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
  assert.doesNotMatch(workflow, /secrets\.DATABASE_URL/);
  assert.doesNotMatch(workflow, /WRITE_DB/);
});

test("a market top-up bills one market an event and merges into the stored board", () => {
  assert.match(workflow, /markets=\$\{encoded_markets\}/);
  assert.match(
    workflow,
    /MARKETS: \$\{\{ github\.event\.client_payload\.markets/,
  );
  // Still the signed route, still no database credentials on the runner.
  assert.doesNotMatch(workflow, /secrets\.DATABASE_URL/);
  assert.doesNotMatch(workflow, /WRITE_DB/);

  assert.match(route, /searchParams\.get\("markets"\)/);
  // Coverage calls a board with four team totals "covered", so a top-up that
  // honoured skipPopulated would skip every event and write nothing.
  assert.match(route, /marketOverride\.length === 0 &&/);
  assert.match(route, /markets: marketOverride/);

  const cache = readFileSync("src/lib/odds-event-board-cache.ts", "utf8");
  // The merge is what makes a partial fetch safe: 48 team totals must fold into
  // a 590-selection board, never replace it.
  assert.match(cache, /mergeEventBoardSelections/);
  assert.match(cache, /markets\?: readonly string\[\]/);
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
