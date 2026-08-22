import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  ALL_TIME_LEGACY_SCOPES,
  carriedResultsFromLegacyRows,
  collapseLegacyRecordsBySport,
  lifetimeGradedSample,
  statsBaselineFromLegacyRows,
} from "./legacy-all-time";

test("all-time legacy scopes are the year residual plus prior years", () => {
  assert.deepEqual(
    [...ALL_TIME_LEGACY_SCOPES],
    ["PRE_IMPORT", "YEAR_2025", "YEAR_2024"],
  );
  const scopes: readonly string[] = ALL_TIME_LEGACY_SCOPES;
  assert.ok(!scopes.includes("CURRENT_YEAR"));
  assert.ok(!scopes.includes("CURRENT_SEASON"));
  assert.ok(!scopes.includes("LAST_90D"));
});

test("statsBaselineFromLegacyRows adds a prior year onto the PRE_IMPORT residual", () => {
  const baseline = statsBaselineFromLegacyRows([
    {
      wins: 300,
      losses: 240,
      pushes: 10,
      unitsRisked: 800,
      unitsNet: -29.37,
    },
    {
      wins: 420,
      losses: 350,
      pushes: 12,
      unitsRisked: 1100,
      unitsNet: 185.5,
    },
  ]);

  assert.deepEqual(baseline, {
    wins: 720,
    losses: 590,
    pushes: 22,
    stakedUnits: 1900,
    units: 156.13,
  });
  assert.equal(
    carriedResultsFromLegacyRows([
      { wins: 300, losses: 240, pushes: 10 },
      { wins: 420, losses: 350, pushes: 12 },
    ]),
    1332,
  );
});

test("collapseLegacyRecordsBySport sums YEAR_2025 onto PRE_IMPORT per sport", () => {
  const collapsed = collapseLegacyRecordsBySport([
    {
      sport: "ALL",
      wins: 300,
      losses: 240,
      pushes: 10,
      unitsRisked: 800,
      unitsNet: -29.37,
    },
    {
      sport: "MLB",
      wins: 200,
      losses: 160,
      pushes: 6,
      unitsRisked: 500,
      unitsNet: -12,
    },
    {
      sport: "ALL",
      wins: 420,
      losses: 350,
      pushes: 12,
      unitsRisked: 1100,
      unitsNet: 185.5,
    },
    {
      sport: "MLB",
      wins: 280,
      losses: 220,
      pushes: 8,
      unitsRisked: 700,
      unitsNet: 90,
    },
  ]);

  const all = collapsed.find((row) => row.sport === "ALL");
  const mlb = collapsed.find((row) => row.sport === "MLB");
  assert.deepEqual(all, {
    sport: "ALL",
    wins: 720,
    losses: 590,
    pushes: 22,
    unitsRisked: 1900,
    unitsNet: 156.13,
  });
  assert.deepEqual(mlb, {
    sport: "MLB",
    wins: 480,
    losses: 380,
    pushes: 14,
    unitsRisked: 1200,
    unitsNet: 78,
  });
});

test("lifetimeGradedSample does not double-count carry on all-time evidence", () => {
  assert.equal(
    lifetimeGradedSample({
      windowSettled: 1118,
      carriedResults: 550,
      applyBaseline: true,
    }),
    1118,
  );
  assert.equal(
    lifetimeGradedSample({
      windowSettled: 568,
      carriedResults: 550,
      playLifetime: 568,
      applyBaseline: true,
    }),
    1118,
  );
  assert.equal(
    lifetimeGradedSample({
      windowSettled: 12,
      carriedResults: 550,
      playLifetime: 568,
      applyBaseline: false,
    }),
    1118,
  );
});

test("an empty carried set is not a zero baseline", () => {
  assert.equal(statsBaselineFromLegacyRows([]), null);
  assert.equal(carriedResultsFromLegacyRows([]), 0);
});

test("public surfaces fetch every all-time legacy scope, not only PRE_IMPORT", () => {
  const sources = [
    "src/lib/queries/leaderboard.ts",
    "src/lib/queries/discover.ts",
    "src/lib/queries/plays.ts",
    "src/lib/queries/capper.ts",
    "src/lib/queries/admin-cappers.ts",
    "scripts/audit-legacy-accounts.ts",
  ];
  for (const path of sources) {
    const source = readFileSync(path, "utf8");
    assert.match(
      source,
      /allTimeLegacyRecordWhere|ALL_TIME_LEGACY_SCOPES/,
      `${path} must read prior-year legacy totals`,
    );
    assert.doesNotMatch(
      source,
      /where:\s*\{\s*scope:\s*"PRE_IMPORT"/,
      `${path} still fetches PRE_IMPORT alone`,
    );
  }
});
