import assert from "node:assert/strict";
import test from "node:test";

import * as policy from "@/lib/whop-push-policy";
import { loadTestModule } from "@/lib/test-support/load-module";

type Route = { GET: (req: unknown) => Promise<{ body: unknown }> };

test("the Whop cron sends due pushes and defers ones Whop refused, until their daily retry", async () => {
  const now = Date.now();
  const minutesAgo = (m: number) => new Date(now - m * 60_000);
  const headline400 =
    'Whop rejected the update (HTTP 400): {"error":{"message":"Headline is too long (maximum is 80 characters)"}}';
  const pending = [
    // Refused 5 minutes ago: wait for the daily retry.
    {
      id: "stuck",
      externalProductId: "p1",
      whopPushAttempts: 5254,
      whopPushLastError: headline400,
      updatedAt: minutesAgo(5),
    },
    // Refused over a day ago: due again.
    {
      id: "daily",
      externalProductId: "p2",
      whopPushAttempts: 9,
      whopPushLastError: headline400,
      updatedAt: minutesAgo(25 * 60),
    },
    // Network blip: retry every pass.
    {
      id: "blip",
      externalProductId: "p3",
      whopPushAttempts: 1,
      whopPushLastError: "Could not reach Whop.",
      updatedAt: minutesAgo(5),
    },
    // A fresh edit.
    {
      id: "fresh",
      externalProductId: "p4",
      whopPushAttempts: 0,
      whopPushLastError: null,
      updatedAt: minutesAgo(1),
    },
  ];
  const pushed: string[] = [];
  let scanned: { take?: number } = {};
  process.env.CRON_SECRET = "s3cret";
  const route = loadTestModule<Route>(
    "src/app/api/cron/whop-sync/route.ts",
    {
      "next/server": {
        NextResponse: { json: (body: unknown) => ({ body }) },
      },
      "@/lib/revalidate-commerce": { revalidateCommerceSurfaces: () => {} },
      "@/lib/whop-push-policy": policy,
      "@/lib/whop-sync": {
        pushPackageToWhop: async (id: string) => {
          pushed.push(id);
          return { ok: true, pushed: true };
        },
        syncWhopStorefront: async () => ({
          ok: true,
          imported: 0,
          updated: 0,
          skipped: 0,
        }),
      },
      "@/lib/prisma": {
        prisma: {
          user: { findFirst: async () => ({ id: "admin" }) },
          package: {
            findMany: async (args: { take?: number }) => {
              scanned = args;
              return pending;
            },
          },
          storeConnection: { findMany: async () => [] },
        },
      },
    },
    { process },
  );
  const response = await route.GET({
    headers: { get: () => "Bearer s3cret" },
  });
  const body = JSON.parse(JSON.stringify(response.body)) as {
    pushes: { checked: number; deferred: number };
  };
  assert.deepEqual(pushed.sort(), ["blip", "daily", "fresh"]);
  assert.equal(body.pushes.checked, 3);
  assert.equal(body.pushes.deferred, 1);
  // Scans past a batch's worth so deferred rows never starve new edits.
  assert.ok((scanned.take ?? 0) > 25);
});
