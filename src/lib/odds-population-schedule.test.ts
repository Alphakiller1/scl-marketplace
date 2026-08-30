import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { REFRESH_MAX_GAP_MINUTES } from "@/lib/strategic-odds-policy";

/**
 * Read with line endings normalized.
 *
 * A Windows checkout writes CRLF into the working tree, and the assertions
 * below match patterns that span a line break — so this suite passed on CI and
 * failed on any Windows machine, a red test no CI run would ever reproduce.
 * `.gitattributes` now pins checkout to LF; normalizing here as well means the
 * test does not depend on a developer's git config to be correct.
 */
function readRepoFile(path: string): string {
  return readFileSync(path, "utf8").replaceAll("\r\n", "\n");
}

const workflow = readRepoFile(".github/workflows/populate-odds.yml");
const route = readRepoFile("src/app/api/cron/odds-populate/route.ts");
const dispatcher = readRepoFile("src/app/api/cron/odds-dispatch/route.ts");
const executor = readRepoFile("src/lib/odds-control-executor.ts");
const controlActions = readRepoFile("src/lib/actions/odds-control.action.ts");
const controlRuntime = readRepoFile("src/lib/odds-control-runtime.ts");
const vercel = readRepoFile("vercel.json");

/**
 * Exactly one schedule, and it is the free one.
 *
 * Both this workflow and `vercel.json` used to fire at `0 12` and `0 0` against
 * the same paid endpoint, so every scheduled surface refresh was billed twice
 * for one board. Vercel owns the paid cadence now — it runs inside the
 * deployment holding the provider keys and it fires on time, where a GitHub
 * `0 0` schedule was landing at 00:50. What is left here spends nothing.
 */
test("the workflow schedules the free audit and no paid population", () => {
  const cronLines = workflow.match(/^\s*- cron:/gm) ?? [];
  assert.equal(cronLines.length, 1);
  assert.match(workflow, /cancel-in-progress: false/);
  // The audit reads the cache: no surface refresh, no expanded events, so the
  // route answers without calling the provider.
  assert.match(workflow, /audit:\n\s+if: github\.event_name == 'schedule'/);
  assert.match(workflow, /expanded=0&surface=0/);
  // Nothing else may run on a schedule — that is what double-billed.
  for (const job of ["populate", "populate-temp-key", "write-snapshots"]) {
    const start = workflow.indexOf(`\n  ${job}:`);
    assert.ok(start > 0, `${job} job not found`);
    const condition = workflow.slice(start, start + 400);
    assert.doesNotMatch(
      condition,
      /event_name == 'schedule'/,
      `${job} must not run on a schedule`,
    );
  }
});

test("the audit fails loudly on a spent key or a board that stopped moving", () => {
  assert.match(workflow, /\.provider\.exhausted/);
  assert.match(workflow, /\.provider\.staleSports/);
  assert.match(
    workflow,
    /::error::The Odds API key on Vercel is out of credits/,
  );
});

test("scheduled population calls the signed production route, never a stored Odds API key", () => {
  assert.match(workflow, /secrets\.CRON_SECRET/);
  assert.match(workflow, /Authorization: Bearer \$CRON_SECRET/);
  assert.match(workflow, /api\/cron\/odds-populate/);
  // The manual dispatch reaches the paid route only when it carries neither a
  // temporary key nor a snapshot file to replay — a replay must never spend
  // credits just because it was dispatched from the same workflow.
  assert.match(
    workflow,
    /github\.event_name == 'workflow_dispatch' && !inputs\.use_temp_key && inputs\.odds_key == '' && inputs\.snapshot_file == ''/,
  );
});

/**
 * A key reaches the route from a SECRET and never from a dispatch input.
 *
 * Actions masks `secrets.*` and nothing else. Registering an input with
 * `::add-mask::` is what leaked one: the runner echoes each `run:` body with
 * its expressions already expanded, before the step runs, so the masking
 * command printed the key it was about to hide — into a public run log. The
 * `env:` block is printed resolved too, so no ordering makes an input safe.
 */
test("manual temp-key population takes the key from a secret, never an input", () => {
  assert.match(workflow, /repository_dispatch:/);
  assert.match(workflow, /types: \[populate-odds\]/);
  assert.doesNotMatch(workflow, /::add-mask::/);
  assert.match(workflow, /ODDS_KEY: \$\{\{ secrets\.ODDS_API_KEY_TEMP \}\}/);
  // A run that passes a key as an input is refused before any credit is spent,
  // rather than quietly publishing it.
  assert.match(workflow, /SUPPLIED_INPUT/);
  assert.match(workflow, /An Odds API key was passed as a dispatch input/);
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

/**
 * Vercel owns the paid cadence, and it has to be an INTRADAY one.
 *
 * Two surface-only runs a day is not a live board: books post the alternate
 * ladders and the prop cards a few hours before first pitch, so an overnight
 * populate writes the featured lines and nothing else, and `expanded=0` meant
 * the expanded markets were never fetched on a schedule at all — only by hand.
 */
test("Vercel runs the paid cadence through the day, expanded boards included", () => {
  const crons = (
    JSON.parse(vercel) as { crons: { path: string; schedule: string }[] }
  ).crons.filter((cron) => cron.path.startsWith("/api/cron/odds-populate"));

  assert.ok(
    crons.length >= 5,
    `expected an intraday cadence, found ${crons.length} populate crons`,
  );
  assert.ok(
    crons.some((cron) => cron.path.includes("expandedDays=today")),
    "no cron warms today's expanded boards",
  );
  assert.ok(
    crons.some((cron) => cron.path.includes("expandedDays=today,tomorrow")),
    "no cron builds tomorrow's board overnight",
  );
  for (const cron of crons) {
    assert.match(cron.path, /sports=MLB,WNBA,TENNIS,SOCCER,NFL/);
    assert.match(cron.schedule, /^\S+ \S+ \* \* \*$/);
    // Every expanded run tops up what is missing rather than re-billing a card
    // already on the board.
    if (cron.path.includes("expanded=99")) {
      assert.match(cron.path, /skipPopulated=1/);
    }
  }

  // Through the hours US games are priced and played, no gap may outlive the
  // window a board is considered fresh for — otherwise the site serves prices
  // it has already marked stale, and the audit reports a fault on a cadence
  // that ran exactly as written. The overnight gap is deliberately longer:
  // nothing starts between 23:00 and 07:00 ET, and the 03:00 UTC run builds the
  // next day's board.
  const ACTIVE_FROM = 11 * 60; // 07:00 ET
  const ACTIVE_TO = 23 * 60; // 19:00 ET
  const active = crons
    .map((cron) => cron.schedule.trim().split(/\s+/))
    .map(([minute, hour]) => Number(hour) * 60 + Number(minute))
    .filter((slot) => slot >= ACTIVE_FROM && slot <= ACTIVE_TO)
    .sort((a, b) => a - b);
  assert.ok(active.length >= 2, "no daytime cadence to check");
  const gaps = active.slice(1).map((slot, index) => slot - active[index]!);
  assert.ok(
    Math.max(...gaps) <= REFRESH_MAX_GAP_MINUTES,
    `a daytime gap of ${Math.max(...gaps)} minutes outlives the freshness window`,
  );
});

test("owner scheduling is a signed, dormant-by-default dispatcher", () => {
  const crons = (
    JSON.parse(vercel) as { crons: { path: string; schedule: string }[] }
  ).crons;
  assert.ok(
    crons.some(
      (cron) =>
        cron.path === "/api/cron/odds-dispatch" &&
        cron.schedule === "*/15 * * * *",
    ),
  );
  assert.match(dispatcher, /process\.env\.CRON_SECRET/);
  assert.match(dispatcher, /Authorization|authorization/);
  assert.match(dispatcher, /claimDueOddsRuns/);
  assert.match(executor, /x-scl-managed-run/);
  assert.match(dispatcher, /status: ok \? 200 : 502/);
  assert.match(route, /managedOddsSchedulingEnabled/);
  assert.match(route, /managed_scheduler_active/);
});

test("owner mutations authenticate and immediate runs retain every guardrail", () => {
  assert.ok(
    (controlActions.match(/requireAdmin\(\)/g) ?? []).length >= 3,
    "save, run-now, and dry-run actions must each authenticate",
  );
  assert.match(controlActions, /claimManualOddsRun/);
  assert.match(controlActions, /executeClaimedOddsRun/);
  assert.match(controlRuntime, /perRunLimit: config\.perRunCreditLimit/);
  assert.match(controlRuntime, /TransactionIsolationLevel\.Serializable/);
  assert.match(controlRuntime, /reservedCredits: estimate/);
  assert.match(executor, /authorization: `Bearer \$\{secret\}`/);
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
