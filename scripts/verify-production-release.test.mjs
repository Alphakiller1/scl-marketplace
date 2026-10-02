import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  verifyDeepHealth,
  verifyPageMarker,
  verifyPublicHealth,
} from "./verify-production-release.mjs";

const release = "a".repeat(40);

test("production builds stop when Prisma migrations fail", () => {
  const migrationScript = readFileSync(
    new URL("./migrate-on-production-only.mjs", import.meta.url),
    "utf8",
  );

  assert.match(
    migrationScript,
    /if \(result\.status !== 0\) \{[\s\S]*?process\.exit\(1\);\s*\}/,
  );
});

test("public health requires a reachable provider and concurrency-safe pool", () => {
  const healthy = {
    status: "ok",
    release,
    database: "reachable",
    schema: { campaignQueue: true },
    databasePool: { pooled: true, connectionLimit: 5 },
    odds: { configured: true, reachable: true },
  };
  assert.doesNotThrow(() => verifyPublicHealth(healthy, release));
  assert.throws(
    () =>
      verifyPublicHealth(
        {
          ...healthy,
          databasePool: { pooled: true, connectionLimit: 1 },
        },
        release,
      ),
    /Fluid Compute safe/,
  );
  assert.throws(
    () =>
      verifyPublicHealth(
        { ...healthy, schema: { campaignQueue: false } },
        release,
      ),
    /campaign queue schema is not ready/,
  );
});

test("deep health rejects a 200-shaped payload with failed data checks", () => {
  const healthy = {
    status: "ok",
    release,
    checks: { databaseSchema: true, picksData: true },
    counts: {
      publicCappers: 1,
      publicPicks: 1,
      publicPackages: 1,
      selectableOddsBoardEvents: 1,
    },
    legacy: { errors: [] },
  };
  assert.doesNotThrow(() => verifyDeepHealth(healthy, release));
  assert.throws(
    () =>
      verifyDeepHealth(
        { ...healthy, checks: { ...healthy.checks, picksData: false } },
        release,
      ),
    /picksData/,
  );
  assert.throws(
    () =>
      verifyDeepHealth(
        {
          ...healthy,
          counts: { ...healthy.counts, selectableOddsBoardEvents: 0 },
        },
        release,
      ),
    /no selectable Today\/Tomorrow events/,
  );
});

test("page verification rejects silent HTTP 200 fallback content", () => {
  assert.doesNotThrow(() =>
    verifyPageMarker(
      '<main data-scl-verification="picks" data-data-status="ok" data-pick-count="24">',
      "picks",
      "data-pick-count",
    ),
  );
  assert.throws(
    () =>
      verifyPageMarker(
        '<main data-scl-verification="picks" data-data-status="degraded" data-pick-count="0">',
        "picks",
        "data-pick-count",
      ),
    /degraded/,
  );
  assert.doesNotThrow(() =>
    verifyPageMarker(
      '<section data-scl-verification="home-honors" data-data-status="ok" data-honor-count="0">',
      "home-honors",
      "data-honor-count",
      { allowEmpty: true },
    ),
  );
  assert.throws(
    () =>
      verifyPageMarker(
        '<section data-scl-verification="home-honors" data-data-status="ok" data-honor-count="0">',
        "home-honors",
        "data-honor-count",
      ),
    /empty data set/,
  );
});
