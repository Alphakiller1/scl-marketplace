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
  assert.match(source, /loadOddsSlate\(\)/);
  assert.doesNotMatch(source, /ODDS_BOARD_SPORTS\.map\(async/);
  assert.doesNotMatch(source, /api\/odds\?sport=.*sport\.key/);
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

test("today's pick board exposes only best-available pricing", () => {
  const source = fs.readFileSync(
    path.join(root, "src/components/scl/game-picker.tsx"),
    "utf8",
  );
  assert.match(source, /Best available · all books/);
  assert.doesNotMatch(source, /function BookRail/);
  assert.doesNotMatch(source, /setBookChoice/);
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
