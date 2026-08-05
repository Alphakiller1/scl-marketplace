/**
 * Applies pending migrations, but only for a production build.
 *
 * `build` used to be `prisma migrate deploy && next build`, and Vercel gives
 * Preview the same DATABASE_URL as Production. Every preview deployment
 * therefore migrated the production database — a branch that was never
 * reviewed, never merged, and possibly never intended to ship could alter the
 * live schema just by opening a PR. This is not hypothetical: a preview build
 * created the `LegacyRecord` table in production before its PR was merged.
 *
 * Preview keeps DATABASE_URL, so previews still read live data and behave
 * normally. They simply no longer mutate the schema.
 *
 * If a preview needs a column that production does not have yet, that preview
 * will error on the missing column — which is the correct, visible failure.
 * The alternative was silent, unreviewed schema drift in production.
 */
import { spawnSync } from "node:child_process";

const env = process.env.VERCEL_ENV;

function trimmed(value) {
  const next = value?.trim();
  return next ? next : null;
}

function withSclSchema(connectionUrl) {
  try {
    const url = new URL(connectionUrl);
    if (!url.searchParams.has("schema")) {
      url.searchParams.set("schema", "scl");
    }
    return url.toString();
  } catch {
    return connectionUrl.includes("schema=")
      ? connectionUrl
      : `${connectionUrl}${connectionUrl.includes("?") ? "&" : "?"}schema=scl`;
  }
}

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    encoding: "utf8",
    shell: process.platform === "win32",
    env: process.env,
    ...options,
  });
}

function runOutput(command, args, options = {}) {
  const result = run(command, args, options);
  return {
    result,
    output: `${result.stdout ?? ""}${result.stderr ?? ""}`,
  };
}

/** Mirror runtime Supabase ↔ Vercel integration aliases before Prisma CLI runs. */
function ensureDatabaseEnvForMigrate() {
  if (!trimmed(process.env.DATABASE_URL)) {
    const pooled =
      trimmed(process.env.POSTGRES_PRISMA_URL) ??
      trimmed(process.env.POSTGRES_URL);
    if (pooled) {
      process.env.DATABASE_URL = withSclSchema(pooled);
      console.log(
        "[migrate] mapped DATABASE_URL from Supabase integration env",
      );
    }
  } else if (!process.env.DATABASE_URL.includes("schema=")) {
    process.env.DATABASE_URL = withSclSchema(process.env.DATABASE_URL);
  }

  if (!trimmed(process.env.DIRECT_URL)) {
    const direct = trimmed(process.env.POSTGRES_URL_NON_POOLING);
    if (direct) {
      process.env.DIRECT_URL = withSclSchema(direct);
      console.log("[migrate] mapped DIRECT_URL from Supabase integration env");
    }
  } else if (!process.env.DIRECT_URL.includes("schema=")) {
    process.env.DIRECT_URL = withSclSchema(process.env.DIRECT_URL);
  }

  if (!trimmed(process.env.DIRECT_URL) && trimmed(process.env.DATABASE_URL)) {
    process.env.DIRECT_URL = process.env.DATABASE_URL;
    console.warn(
      "[migrate] DIRECT_URL unset — falling back to DATABASE_URL for migrate deploy",
    );
  }
}

function resolveMigration(flag, migration) {
  process.stdout.write(`[migrate] resolve --${flag} ${migration} ... `);
  const { result, output } = runOutput("npx", [
    "prisma",
    "migrate",
    "resolve",
    `--${flag}`,
    migration,
  ]);
  const ignorable =
    output.includes("P3008") ||
    output.includes("P3010") ||
    output.includes("not found") ||
    output.includes("already been applied");
  if (result.status !== 0 && !ignorable) {
    process.stdout.write(`warn (${result.status})\n`);
    return false;
  }
  process.stdout.write("ok\n");
  return true;
}

/**
 * Production-only escape hatch for the auth email index swap (#372).
 *
 * A failed Vercel build can leave `_prisma_migrations` in a bad state while
 * the live schema is half-updated. Apply the DDL idempotently, then mark the
 * migrations applied so `migrate deploy` can continue with the rest of the queue.
 */
function preflightAuthEmailIndex() {
  const sql = `
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY email, username
      ORDER BY "createdAt" ASC, id ASC
    ) AS rn
  FROM scl."User"
  WHERE username IS NOT NULL
)
UPDATE scl."User" u
SET username = u.username || '_' || substr(u.id, 1, 6)
FROM ranked r
WHERE u.id = r.id AND r.rn > 1;

DROP INDEX IF EXISTS scl."User_email_key";
DROP INDEX IF EXISTS "User_email_key";

CREATE UNIQUE INDEX IF NOT EXISTS "User_email_username_key"
  ON scl."User"("email", "username");
`.trim();

  console.log("[migrate] preflight auth email index swap");
  const { result, output } = runOutput(
    "npx",
    ["prisma", "db", "execute", "--stdin", "--schema", "prisma/schema.prisma"],
    { input: sql },
  );
  if (result.status !== 0) {
    console.error("[migrate] preflight auth email index failed:\n", output);
    return false;
  }

  for (const migration of [
    "20260805230000_allow_duplicate_email_per_username",
    "20260805230100_auth_email_index_scl",
  ]) {
    resolveMigration("rolled-back", migration);
    resolveMigration("applied", migration);
  }
  return true;
}

// Only a real production deploy migrates. CI builds have no database, so an
// unset VERCEL_ENV must skip as well — otherwise `next build` in CI dies on
// P1001 trying to reach localhost.
if (env !== "production") {
  console.log(
    `[migrate] VERCEL_ENV=${env ?? "(unset)"} — skipping "prisma migrate deploy"; only production deploys migrate.`,
  );
  process.exit(0);
}

ensureDatabaseEnvForMigrate();

if (!trimmed(process.env.DATABASE_URL)) {
  console.error("[migrate] DATABASE_URL is unset — cannot apply migrations.");
  process.exit(1);
}

if (!preflightAuthEmailIndex()) {
  process.exit(1);
}

console.log(`[migrate] VERCEL_ENV=${env ?? "(local)"} — applying migrations.`);
const result = run("npx", ["prisma", "migrate", "deploy"], {
  stdio: "inherit",
});
process.exit(result.status ?? 1);
