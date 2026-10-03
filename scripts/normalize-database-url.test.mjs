import assert from "node:assert/strict";
import test from "node:test";

import {
  toSupabasePoolerDatabaseUrl,
  toSessionDatabaseUrl,
  withSclSchema,
} from "./normalize-database-url.mjs";

test("adds schema=scl while preserving pooler parameters", () => {
  assert.equal(
    withSclSchema(
      "postgresql://user:p%40ss@pooler.example:6543/postgres?pgbouncer=true",
    ),
    "postgresql://user:p%40ss@pooler.example:6543/postgres?pgbouncer=true&schema=scl",
  );
});

test("corrects an explicit non-SCL schema", () => {
  assert.equal(
    withSclSchema(
      "postgres://user:pass@db.example:5432/postgres?schema=public",
    ),
    "postgres://user:pass@db.example:5432/postgres?schema=scl",
  );
});

test("rejects malformed and non-Postgres values", () => {
  assert.throws(() => withSclSchema("not a URL"), /invalid/);
  assert.throws(
    () => withSclSchema("prisma://accelerate.example/key"),
    /postgres/i,
  );
});

test("derives Supabase session-pooler URL for migrations", () => {
  assert.equal(
    toSessionDatabaseUrl(
      "postgresql://postgres.ref:p%40ss@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=5",
    ),
    "postgresql://postgres.ref:p%40ss@aws-0-us-east-1.pooler.supabase.com:5432/postgres?connection_limit=5&schema=scl",
  );
});

test("leaves non-Supabase hosts unchanged apart from the SCL schema", () => {
  assert.equal(
    toSessionDatabaseUrl("postgresql://user:pass@example.com:6543/db"),
    "postgresql://user:pass@example.com:6543/db?schema=scl",
  );
});

test("converts a Supabase IPv6-only direct URL to its regional transaction pooler", () => {
  assert.equal(
    toSupabasePoolerDatabaseUrl(
      "postgresql://postgres:p%40ss@db.projectref.supabase.co:5432/postgres",
      "aws-0-us-west-2.pooler.supabase.com",
    ),
    "postgresql://postgres.projectref:p%40ss@aws-0-us-west-2.pooler.supabase.com:6543/postgres?schema=scl&pgbouncer=true",
  );
});

test("requires an explicit trusted pooler host before rewriting a direct URL", () => {
  assert.throws(
    () =>
      toSupabasePoolerDatabaseUrl(
        "postgresql://postgres:pass@db.projectref.supabase.co:5432/postgres",
        "example.com",
      ),
    /pooler host/i,
  );
});
