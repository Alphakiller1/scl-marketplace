import assert from "node:assert/strict";
import test from "node:test";

import { databasePoolConfiguration, tunedDatabaseUrl } from "@/lib/prisma-url";

test("uses five connections per Fluid Compute instance for Supabase pooler URLs", () => {
  const url = new URL(
    tunedDatabaseUrl(
      "postgresql://user:pass@aws-1-us-west-2.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=5",
    )!,
  );

  assert.equal(url.searchParams.get("connection_limit"), "5");
  assert.equal(url.searchParams.get("pool_timeout"), "15");
});

test("a stale one-connection environment override cannot reintroduce P2024", () => {
  const previous = process.env.PRISMA_POOL_CONNECTION_LIMIT;
  process.env.PRISMA_POOL_CONNECTION_LIMIT = "1";
  try {
    const url = new URL(
      tunedDatabaseUrl(
        "postgresql://user:pass@pooler.supabase.com:6543/postgres?pgbouncer=true",
      )!,
    );
    assert.equal(url.searchParams.get("connection_limit"), "5");
  } finally {
    if (previous === undefined) {
      delete process.env.PRISMA_POOL_CONNECTION_LIMIT;
    } else {
      process.env.PRISMA_POOL_CONNECTION_LIMIT = previous;
    }
  }
});

test("reports the effective production pool without exposing credentials", () => {
  assert.deepEqual(
    databasePoolConfiguration(
      "postgresql://user:pass@aws-1-us-west-2.pooler.supabase.com:6543/postgres?pgbouncer=true",
    ),
    { pooled: true, connectionLimit: 5, poolTimeoutSeconds: 15 },
  );
});

test("does not alter direct database URLs", () => {
  const direct =
    "postgresql://user:pass@db.example.com:5432/postgres?schema=scl";
  assert.equal(tunedDatabaseUrl(direct), direct);
});
