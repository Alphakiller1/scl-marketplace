import assert from "node:assert/strict";
import test from "node:test";

import { readDotenvValue } from "./read-dotenv-value.mjs";

test("reads Vercel-style quoted values without exposing other keys", () => {
  const contents = [
    'DATABASE_URL="postgresql://user:p%40ss@db.example.com/postgres?schema=scl"',
    'DIRECT_URL="postgresql://user:p%40ss@db.example.com/postgres?schema=scl"',
  ].join("\n");

  assert.equal(
    readDotenvValue(contents, "DATABASE_URL"),
    "postgresql://user:p%40ss@db.example.com/postgres?schema=scl",
  );
  assert.equal(readDotenvValue(contents, "MISSING"), "");
});

test("supports export, single-quoted, and unquoted values", () => {
  assert.equal(readDotenvValue("export KEY='value'", "KEY"), "value");
  assert.equal(readDotenvValue("KEY=value", "KEY"), "value");
});
