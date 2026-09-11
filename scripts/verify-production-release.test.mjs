import assert from "node:assert/strict";
import test from "node:test";

import {
  fetchMarketingPages,
  retryAsync,
  verifyDeepHealth,
  verifyMarketingPages,
  verifyPageMarker,
  verifyProductionRelease,
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

test("retryAsync repeats until the function succeeds", async () => {
  let calls = 0;
  const result = await retryAsync(
    async () => {
      calls += 1;
      if (calls < 3) {
        throw new Error("picks rendered degraded data");
      }
      return "ok";
    },
    { attempts: 3, delayMs: 1 },
  );

  assert.equal(calls, 3);
  assert.equal(result, "ok");
});

function pageHtml(story, status = "ok", count = 24) {
  const countAttribute =
    story === "packages"
      ? "data-package-count"
      : story === "picks"
        ? "data-pick-count"
        : "data-capper-count";
  return `<main data-scl-verification="${story}" data-data-status="${status}" ${countAttribute}="${count}">`;
}

function jsonResponse(body) {
  return {
    ok: true,
    text: async () => JSON.stringify(body),
  };
}

function htmlResponse(html) {
  return {
    ok: true,
    text: async () => html,
  };
}

test("fetchMarketingPages loads public stories one at a time", async () => {
  let inFlight = 0;
  let maxInFlight = 0;
  const order = [];

  const fetchImpl = async (url) => {
    const pathname = new URL(url).pathname;
    inFlight += 1;
    maxInFlight = Math.max(maxInFlight, inFlight);
    order.push(pathname);
    await new Promise((resolve) => setTimeout(resolve, 5));
    inFlight -= 1;
    const story =
      pathname === "/picks"
        ? "picks"
        : pathname === "/packages"
          ? "packages"
          : pathname === "/leaderboard"
            ? "leaderboard"
            : "home-leaderboard";
    return htmlResponse(pageHtml(story));
  };

  const htmlByStory = await fetchMarketingPages(
    "https://sportscappersleaderboard.com",
    "nonce",
    fetchImpl,
  );

  assert.deepEqual(order, ["/picks", "/packages", "/leaderboard", "/"]);
  assert.equal(maxInFlight, 1);
  assert.doesNotThrow(() => verifyMarketingPages(htmlByStory));
});

test("verifyProductionRelease retries a degraded picks page", async () => {
  let picksFetches = 0;
  const health = {
    status: "ok",
    release,
    database: "reachable",
    databasePool: { pooled: true, connectionLimit: 5 },
    odds: { configured: true, reachable: true },
    durationMs: 12,
  };
  const deep = {
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
    durationMs: 40,
  };

  const fetchImpl = async (url) => {
    const pathname = new URL(url).pathname;
    if (pathname === "/api/health") {
      return jsonResponse(health);
    }
    if (pathname === "/api/health/deep") {
      return jsonResponse(deep);
    }
    if (pathname === "/picks") {
      picksFetches += 1;
      return htmlResponse(
        pageHtml("picks", picksFetches === 1 ? "degraded" : "ok"),
      );
    }
    if (pathname === "/packages") {
      return htmlResponse(pageHtml("packages"));
    }
    if (pathname === "/leaderboard") {
      return htmlResponse(pageHtml("leaderboard"));
    }
    return htmlResponse(pageHtml("home-leaderboard"));
  };

  await verifyProductionRelease({
    baseUrl: "https://sportscappersleaderboard.com",
    expectedRelease: release,
    cronSecret: "secret",
    rounds: 1,
    intervalMs: 0,
    pageRetryAttempts: 3,
    pageRetryDelayMs: 1,
    fetchImpl,
  });

  assert.equal(picksFetches, 2);
});
