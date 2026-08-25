import assert from "node:assert/strict";
import { test } from "node:test";

import {
  describeUrl,
  isPostgresUrl,
  readConnectionVars,
  selectPostgresUrl,
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

test("an Accelerate DATABASE_URL falls through to the direct Postgres string", () => {
  // The shape that broke the replay: Prisma Accelerate in front, the real
  // database in DIRECT_URL. A name-based pick hands Prisma a `prisma://` URL
  // it cannot open.
  const found = [
    ["DATABASE_URL", "prisma://accelerate.prisma-data.net/?api_key=xxx"],
    ["DIRECT_URL", "postgresql://u:p@host:5432/db?schema=scl"],
  ];
  assert.deepEqual(selectPostgresUrl(found), {
    name: "DIRECT_URL",
    value: "postgresql://u:p@host:5432/db?schema=scl",
  });
});

test("a Postgres DATABASE_URL still wins over DIRECT_URL", () => {
  const found = [
    ["DATABASE_URL", "postgresql://u:p@pooler:6543/db?schema=scl"],
    ["DIRECT_URL", "postgresql://u:p@host:5432/db?schema=scl"],
  ];
  assert.equal(selectPostgresUrl(found).name, "DATABASE_URL");
});

test("neither being Postgres reports the shape and no credentials", () => {
  const found = [
    ["DATABASE_URL", "prisma://accelerate.prisma-data.net/?api_key=secret"],
  ];
  assert.equal(selectPostgresUrl(found), null);
  const described = describeUrl(found[0][1]);
  assert.match(described, /prisma:\/\/ scheme/);
  assert.doesNotMatch(described, /secret/);
  assert.equal(describeUrl("garbage"), "no scheme, 7 chars");
});
