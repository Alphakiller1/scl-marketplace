import assert from "node:assert/strict";
import test from "node:test";

import { tunedDatabaseUrl } from "@/lib/prisma-url";

test("uses one connection per serverless isolate for Supabase pooler URLs", () => {
  const url = new URL(
    tunedDatabaseUrl(
      "postgresql://user:pass@aws-1-us-west-2.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=5",
    )!,
  );

  assert.equal(url.searchParams.get("connection_limit"), "1");
  assert.equal(url.searchParams.get("pool_timeout"), "15");
});

test("does not alter direct database URLs", () => {
  const direct =
    "postgresql://user:pass@db.example.com:5432/postgres?schema=scl";
  assert.equal(tunedDatabaseUrl(direct), direct);
});
