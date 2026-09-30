import assert from "node:assert/strict";
import test from "node:test";

import { probeOddsProviderBalance } from "@/lib/odds-provider-balance";

function quotaResponse(remaining: number, used: number): Response {
  return new Response("[]", {
    status: 200,
    headers: {
      "x-requests-last": "0",
      "x-requests-remaining": String(remaining),
      "x-requests-used": String(used),
    },
  });
}

test("live provider balance sums every configured key", async () => {
  const readings = new Map([
    ["first", quotaResponse(100_000, 0)],
    ["second", quotaResponse(8_000, 2_000)],
  ]);
  const result = await probeOddsProviderBalance({
    keys: ["first", "second", "first"],
    now: new Date("2026-09-30T12:00:00.000Z"),
    fetchImpl: async (input) => {
      const key = new URL(String(input)).searchParams.get("apiKey") ?? "";
      const response = readings.get(key);
      assert.ok(response);
      return response;
    },
  });

  assert.deepEqual(result, {
    configuredKeys: 2,
    reachedKeys: 2,
    remaining: 108_000,
    used: 2_000,
    capacity: 110_000,
    checkedAt: "2026-09-30T12:00:00.000Z",
    complete: true,
  });
});

test("a refused retired key counts as zero without hiding an active key", async () => {
  const result = await probeOddsProviderBalance({
    keys: ["reachable", "missing"],
    fetchImpl: async (input) => {
      const key = new URL(String(input)).searchParams.get("apiKey");
      return key === "reachable"
        ? quotaResponse(100_000, 0)
        : new Response("unauthorized", { status: 401 });
    },
  });

  assert.equal(result.complete, true);
  assert.equal(result.reachedKeys, 2);
  assert.equal(result.remaining, 100_000);
  assert.equal(result.capacity, 100_000);
});

test("a network failure does not publish a partial account balance", async () => {
  const result = await probeOddsProviderBalance({
    keys: ["reachable", "offline"],
    fetchImpl: async (input) => {
      const key = new URL(String(input)).searchParams.get("apiKey");
      if (key === "offline") throw new Error("network unavailable");
      return quotaResponse(100_000, 0);
    },
  });

  assert.equal(result.complete, false);
  assert.equal(result.reachedKeys, 1);
  assert.equal(result.remaining, null);
});

test("missing provider keys produce an unavailable balance", async () => {
  const result = await probeOddsProviderBalance({ keys: [] });
  assert.equal(result.configuredKeys, 0);
  assert.equal(result.complete, false);
  assert.equal(result.remaining, null);
});
