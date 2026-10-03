import assert from "node:assert/strict";
import test from "node:test";

import { withSclSchema } from "./normalize-database-url.mjs";

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
