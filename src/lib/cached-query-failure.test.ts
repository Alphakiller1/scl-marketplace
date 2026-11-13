import assert from "node:assert/strict";
import test from "node:test";

import * as cacheDates from "@/lib/cache-dates";
import * as databaseRetry from "@/lib/database-retry";
import { loadTestModule } from "@/lib/test-support/load-module";

type CachedQueryModule = typeof import("@/lib/cached-query");

/** unstable_cache's contract: a resolved value is stored (as JSON); a rejection is not. */
function fakeUnstableCache() {
  const store = new Map<string, string>();
  return {
    store,
    unstable_cache:
      <A extends unknown[], T>(
        fn: (...args: A) => Promise<T>,
        keyParts: string[],
      ) =>
      async (...args: A): Promise<T> => {
        const key = JSON.stringify([keyParts, args]);
        const hit = store.get(key);
        if (hit !== undefined) return JSON.parse(hit) as T;
        const value = await fn(...args);
        store.set(key, JSON.stringify(value));
        return value;
      },
  };
}

function loadCachedQuery(cache: ReturnType<typeof fakeUnstableCache>) {
  return loadTestModule<CachedQueryModule>("src/lib/cached-query.ts", {
    "server-only": {},
    "next/cache": { unstable_cache: cache.unstable_cache },
    "@/lib/cache-dates": cacheDates,
  });
}

test("a failed result is returned but never cached; the next request recomputes", async () => {
  const cache = fakeUnstableCache();
  const { cachedQuery } = loadCachedQuery(cache);
  let calls = 0;
  const results = [
    { failed: true, n: 0 },
    { failed: false, n: 42 },
  ];
  const get = cachedQuery(async () => results[Math.min(calls++, 1)]!, ["k"], {
    revalidate: 300,
    isFailure: (r) => r.failed,
  });
  assert.deepEqual(await get(), { failed: true, n: 0 });
  assert.equal(cache.store.size, 0, "the failure was not stored");
  assert.deepEqual(await get(), { failed: false, n: 42 });
  assert.deepEqual(await get(), { failed: false, n: 42 });
  assert.equal(calls, 2, "the success was cached after one recompute");
});

test("without isFailure a failure IS cached — the behaviour this guards against", async () => {
  const cache = fakeUnstableCache();
  const { cachedQuery } = loadCachedQuery(cache);
  let calls = 0;
  const get = cachedQuery(async () => ({ failed: calls++ === 0 }), ["k"], {
    revalidate: 300,
  });
  assert.deepEqual(await get(), { failed: true });
  assert.deepEqual(await get(), { failed: true });
  assert.equal(calls, 1);
});

test("a real loader error still propagates", async () => {
  const { cachedQuery } = loadCachedQuery(fakeUnstableCache());
  const get = cachedQuery(
    async (): Promise<{ failed: boolean }> => {
      throw new Error("boom");
    },
    ["k"],
    { isFailure: (r) => r.failed },
  );
  await assert.rejects(get(), /boom/);
});

test("a database read slower than 5s is logged with its label", async () => {
  const warnings: string[] = [];
  const realWarn = console.warn;
  const realNow = Date.now;
  let clock = 1_000_000;
  console.warn = (message: string) => warnings.push(message);
  Date.now = () => clock;
  try {
    await databaseRetry.withTransientDatabaseRetry(
      async () => {
        clock += databaseRetry.SLOW_DATABASE_READ_MS + 1500;
        return 1;
      },
      { label: "leaderboard read" },
    );
    await databaseRetry.withTransientDatabaseRetry(
      async () => {
        clock += 50;
        return 1;
      },
      { label: "fast read" },
    );
  } finally {
    console.warn = realWarn;
    Date.now = realNow;
  }
  assert.deepEqual(warnings, [
    "[database] slow: leaderboard read took 6500ms (attempt 1)",
  ]);
});
