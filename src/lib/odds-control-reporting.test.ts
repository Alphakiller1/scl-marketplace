import assert from "node:assert/strict";
import test from "node:test";

import {
  describeOddsAuditChange,
  formatEasternDateTime,
  identifyUsageSpikes,
  summarizeOddsRunDetails,
} from "@/lib/odds-control-reporting";

test("usage spikes compare a day with its trailing seven-day baseline", () => {
  const history = identifyUsageSpikes([
    { date: "2026-08-01", credits: 5 },
    { date: "2026-08-02", credits: 6 },
    { date: "2026-08-03", credits: 30 },
  ]);
  assert.equal(history[1]?.spike, false);
  assert.equal(history[2]?.spike, true);
  assert.equal(history[2]?.trailingAverage, 5.5);
});

test("Eastern schedule display handles EST and EDT explicitly", () => {
  assert.match(
    formatEasternDateTime("2026-01-15T17:00:00.000Z"),
    /12:00 PM EST/,
  );
  assert.match(
    formatEasternDateTime("2026-07-15T16:00:00.000Z"),
    /12:00 PM EDT/,
  );
});

test("settings audit produces readable exact field changes", () => {
  const changes = describeOddsAuditChange({
    action: "SETTINGS_SAVED",
    target: "odds-control",
    before: {
      config: { dailyCreditLimit: 100, paused: true },
      sports: [{ sport: "NFL", enabled: false }],
    },
    after: {
      dailyCreditLimit: 200,
      paused: false,
      sports: [{ sport: "NFL", enabled: true }],
    },
  });
  assert.ok(changes.includes("Daily Credit Limit: 100 → 200"));
  assert.ok(changes.includes("Paused: On → Off"));
  assert.ok(changes.includes("NFL Enabled: Off → On"));
});

test("run details expose provider, processed, skipped, and held activity", () => {
  const detail = summarizeOddsRunDetails({
    surface: { NFL: { events: 4, source: "provider", stale: false } },
    expanded: {
      NFL: {
        events: 3,
        populated: 2,
        fetched: 2,
        skipped: 1,
        held: 1,
        stale: 0,
        unpriced: 1,
      },
    },
    provider: { refreshedSports: 1, staleSports: ["NBA"] },
  });
  assert.deepEqual(detail, {
    events: 7,
    populated: 2,
    skipped: 1,
    fetched: 3,
    held: 1,
    stale: 0,
    unpriced: 1,
    refreshedSports: 1,
    staleSports: ["NBA"],
    dryRun: false,
    wouldRun: null,
    blockedReason: null,
  });
});
