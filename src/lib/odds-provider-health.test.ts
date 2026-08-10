import assert from "node:assert/strict";
import test from "node:test";

import { probeOddsProvider } from "@/lib/odds-provider-health";

test("odds provider probe distinguishes missing, reachable, and rejected keys", async () => {
  assert.equal((await probeOddsProvider({ apiKey: null })).configured, false);

  const reachable = await probeOddsProvider({
    apiKey: "test",
    fetchImpl: async () =>
      new Response(JSON.stringify([{ key: "baseball_mlb" }]), {
        status: 200,
      }),
  });
  assert.deepEqual(
    {
      configured: reachable.configured,
      reachable: reachable.reachable,
      statusCode: reachable.statusCode,
      activeSports: reachable.activeSports,
    },
    { configured: true, reachable: true, statusCode: 200, activeSports: 1 },
  );

  const rejected = await probeOddsProvider({
    apiKey: "bad",
    fetchImpl: async () => new Response("unauthorized", { status: 401 }),
  });
  assert.equal(rejected.configured, true);
  assert.equal(rejected.reachable, false);
  assert.equal(rejected.statusCode, 401);
});
