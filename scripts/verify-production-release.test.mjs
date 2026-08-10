import assert from "node:assert/strict";
import test from "node:test";

import {
  verifyDeepHealth,
  verifyPageMarker,
  verifyPublicHealth,
} from "./verify-production-release.mjs";

const release = "a".repeat(40);

test("public health requires a reachable provider and concurrency-safe pool", () => {
  const healthy = {
    status: "ok",
    release,
    database: "reachable",
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
});
