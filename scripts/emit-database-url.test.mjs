import assert from "node:assert/strict";
import { test } from "node:test";

import {
  isPostgresUrl,
  readConnectionVars,
  unquote,
} from "./emit-database-url.mjs";

test("unquote strips every layer the sync path adds", () => {
  assert.equal(
    unquote("postgresql://u:p@h:6543/db"),
    "postgresql://u:p@h:6543/db",
  );
  assert.equal(
    unquote('"postgresql://u:p@h:6543/db"'),
    "postgresql://u:p@h:6543/db",
  );
  // The real shape: quoted into Vercel, quoted again on the way out. One pass
  // leaves a leading quote and Prisma rejects it as a bad protocol.
  assert.equal(
    unquote('"\\"postgresql://u:p@h:6543/db\\""'.replace(/\\/g, "")),
    "postgresql://u:p@h:6543/db",
  );
  assert.equal(unquote("  'postgresql://x'  "), "postgresql://x");
});

test("connection vars are read with their query strings intact", () => {
  const file = [
    "# pulled from vercel",
    'DATABASE_URL="postgresql://u:p%40ss@host:6543/db?schema=scl&pgbouncer=true"',
    "export DIRECT_URL='postgresql://u:p@host:5432/db?schema=scl'",
    "AUTH_SECRET=not-a-connection-string",
    "DATABASE_URL_EXTRA=ignored",
  ].join("\n");
  assert.deepEqual(readConnectionVars(file), [
    [
      "DATABASE_URL",
      "postgresql://u:p%40ss@host:6543/db?schema=scl&pgbouncer=true",
    ],
    ["DIRECT_URL", "postgresql://u:p@host:5432/db?schema=scl"],
  ]);
});

test("only Postgres URLs pass, so a mangled value fails before Prisma sees it", () => {
  assert.equal(isPostgresUrl("postgresql://h/db"), true);
  assert.equal(isPostgresUrl("postgres://h/db"), true);
  assert.equal(isPostgresUrl('"postgresql://h/db'), false);
  assert.equal(isPostgresUrl("https://h/db"), false);
  assert.equal(isPostgresUrl(""), false);
});
