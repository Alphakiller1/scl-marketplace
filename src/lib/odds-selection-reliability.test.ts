import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  loadOddsSlate,
  resetOddsSlateClientCache,
} from "@/lib/odds-slate-client";

const root = process.cwd();

test("Log a Pick loads one aggregate board instead of nine sport requests", () => {
  const source = fs.readFileSync(
    path.join(root, "src/components/scl/game-picker.tsx"),
    "utf8",
  );
  assert.match(source, /loadOddsSlate\(fetch, forceRefresh\)/);
  assert.match(source, /setInterval\([\s\S]*requestSlate\(true\)/);
  assert.doesNotMatch(source, /ODDS_BOARD_SPORTS\.map\(async/);
  assert.doesNotMatch(source, /api\/odds\?sport=.*sport\.key/);
  assert.match(source, /flex flex-wrap gap-2/);
});

test("the aggregate odds route orders every sport by kickoff", () => {
  const route = fs.readFileSync(
    path.join(root, "src/app/api/odds/route.ts"),
    "utf8",
  );
  assert.match(route, /sortByKickoff\(/);
});

test("a receipt remount reuses the same browser slate request", async () => {
  resetOddsSlateClientCache();
  let calls = 0;
  const fetchImpl: typeof fetch = async () => {
    calls += 1;
    return Response.json({
      events: [
        {
          id: "event-1",
          sport: "MLB",
          commenceTime: "2026-08-10T22:00:00.000Z",
          home: "Home",
          away: "Away",
          selections: [],
        },
      ],
      configured: true,
      books: [],
      meta: {},
    });
  };

  const first = await loadOddsSlate(fetchImpl);
  const afterReceipt = await loadOddsSlate(fetchImpl);

  assert.equal(first.events.length, 1);
  assert.equal(afterReceipt.events.length, 1);
  assert.equal(calls, 1);
  resetOddsSlateClientCache();
});

test("an empty picker slate is not pinned in the browser", async () => {
  resetOddsSlateClientCache();
  let calls = 0;
  const fetchImpl: typeof fetch = async () => {
    calls += 1;
    return Response.json({
      events: [],
      configured: true,
      books: [],
      meta: { warning: "no_upcoming_events" },
    });
  };

  await loadOddsSlate(fetchImpl);
  await loadOddsSlate(fetchImpl);

  assert.equal(calls, 2);
  resetOddsSlateClientCache();
});

test("opening a matchup keeps every game in the visible slate", () => {
  const source = fs.readFileSync(
    path.join(root, "src/components/scl/game-picker.tsx"),
    "utf8",
  );
  // The rule is that the whole slate keeps rendering and the detail opens
  // inline — not that the callback has one parameter. It takes an index now,
  // to date-group the upcoming list.
  assert.match(source, /visible\.map\(\(e(?:,\s*\w+)?\) =>/);
  assert.match(source, /open \? \(\s*<EventDetail/);
  assert.doesNotMatch(source, /Focused Matchup/);
  assert.doesNotMatch(source, /Back to slate/);
});

test("server cache is shared across users and retains last-good boards", () => {
  const source = fs.readFileSync(
    path.join(root, "src/lib/odds-board-cache.ts"),
    "utf8",
  );
  const durable = fs.readFileSync(
    path.join(root, "src/lib/odds-durable-cache.ts"),
    "utf8",
  );
  const schema = fs.readFileSync(
    path.join(root, "prisma/schema.prisma"),
    "utf8",
  );
  const route = fs.readFileSync(
    path.join(root, "src/app/api/odds/route.ts"),
    "utf8",
  );
  assert.match(source, /getCache\(\{ namespace: "scl-odds" \}\)/);
  assert.match(source, /readDurableOddsSnapshot/);
  assert.match(source, /writeDurableOddsSnapshot/);
  assert.match(durable, /prisma\.oddsCacheSnapshot\.upsert/);
  assert.match(schema, /model OddsCacheSnapshot/);
  assert.match(source, /stale_circuit_break/);
  assert.match(source, /stale_provider_failure/);
  assert.match(route, /loadOddsBoard\(sport\)/);
  assert.doesNotMatch(route, /fetchUpcomingOdds\(sport, \{ books \}\)/);
});

test("scheduled refreshes preserve omitted future captures and verify durable coverage", () => {
  const cache = fs.readFileSync(
    path.join(root, "src/lib/odds-board-cache.ts"),
    "utf8",
  );
  const scheduler = fs.readFileSync(
    path.join(root, "src/lib/strategic-odds-refresh.ts"),
    "utf8",
  );
  assert.match(cache, /\.\.\.events, \.\.\.retained/);
  assert.match(cache, /loadDurableOddsBoard/);
  assert.match(cache, /30 \* 24 \* 60 \* 60/);
  assert.match(scheduler, /missingProviderIds/);
  assert.match(scheduler, /missing-event-odds/);
  assert.match(scheduler, /stillMissing/);
  assert.match(scheduler, /schedule-unavailable/);
  assert.match(scheduler, /loadDurableOddsBoard/);
});

test("production cron rejects incomplete MLB expanded markets and event fetches roll over keys", () => {
  const route = fs.readFileSync(
    path.join(root, "src/app/api/cron/odds-refresh/route.ts"),
    "utf8",
  );
  const coverage = fs.readFileSync(
    path.join(root, "src/lib/odds-coverage-report.ts"),
    "utf8",
  );
  const api = fs.readFileSync(path.join(root, "src/lib/odds-api.ts"), "utf8");
  assert.match(route, /warmMissingOddsCoverage/);
  assert.match(route, /expandedFailures/);
  assert.match(route, /!game\.fullyCovered/);
  assert.match(coverage, /!game\.fullyCovered/);
  assert.match(api, /fetchWithOddsKeyRollover/);
});

test("deployment health reads cached boards without spending odds credits", () => {
  const health = fs.readFileSync(
    path.join(root, "src/app/api/health/deep/route.ts"),
    "utf8",
  );
  const cache = fs.readFileSync(
    path.join(root, "src/lib/odds-board-cache.ts"),
    "utf8",
  );
  assert.match(health, /loadCachedOddsBoard\(sport\.key\)/);
  assert.doesNotMatch(health, /loadOddsBoard\(sport\.key\)/);
  assert.match(cache, /source: "cache_empty"/);
  assert.match(cache, /source: stale \? "stale_cache_only"/);
});

test("event snapshots use one provider scope across capper profiles", () => {
  const source = fs.readFileSync(
    path.join(root, "src/lib/odds-api.ts"),
    "utf8",
  );
  const verificationStart = source.indexOf(
    "export async function fetchEventOddsForVerification",
  );
  const verificationEnd = source.indexOf(
    "export async function verifyPick",
    verificationStart,
  );
  const verification = source.slice(verificationStart, verificationEnd);
  assert.match(verification, /return await attempt\(undefined\)/);
  assert.doesNotMatch(verification, /attempt\(preferred\)/);
});

test("board provider refresh is measured in hours, not per pick", () => {
  const source = fs.readFileSync(
    path.join(root, "src/lib/odds-api.ts"),
    "utf8",
  );
  assert.match(source, /export const BOARD_TTL = 4 \* 60 \* 60/);
});

test("today's pick board exposes Best plus the five owner books", () => {
  const source = fs.readFileSync(
    path.join(root, "src/components/scl/game-picker.tsx"),
    "utf8",
  );
  assert.match(source, /function BookRail/);
  assert.match(source, /setBookChoice/);
  assert.match(source, /Best is the most favorable price among MGM/);
  assert.doesNotMatch(source, /Best available · all books/);
  assert.doesNotMatch(source, /lockedBook/);
  assert.doesNotMatch(source, /Parlay locked/);
});

test("confirmed picks never render an Odds Not Verified designation", () => {
  const verification = fs.readFileSync(
    path.join(root, "src/lib/verification.ts"),
    "utf8",
  );
  const badge = fs.readFileSync(
    path.join(root, "src/components/scl/verified-badge.tsx"),
    "utf8",
  );
  const ledger = fs.readFileSync(
    path.join(root, "src/components/scl/public-picks-ledger.tsx"),
    "utf8",
  );
  const publicCopy = `${verification}\n${badge}\n${ledger}`;
  assert.doesNotMatch(publicCopy, /odds not verified/i);
  assert.match(badge, /verified \? "Verified" : "Recorded"/);
});

test("event details retain the last populated prop and period board", () => {
  const cache = fs.readFileSync(
    path.join(root, "src/lib/odds-event-board-cache.ts"),
    "utf8",
  );
  const route = fs.readFileSync(
    path.join(root, "src/app/api/odds/event/route.ts"),
    "utf8",
  );
  assert.match(cache, /source: "stale_circuit_break"/);
  assert.match(cache, /source: "stale_provider_failure"/);
  assert.match(cache, /selections: cached\.selections/);
  assert.match(cache, /readDurableOddsSnapshot/);
  assert.match(cache, /writeDurableOddsSnapshot/);
  assert.match(route, /loadEventBoard\(sport, eventId\)/);
  assert.match(route, /"Cache-Control": "private, no-store"/);
});
