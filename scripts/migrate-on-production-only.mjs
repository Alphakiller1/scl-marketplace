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
import { writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const env = process.env.VERCEL_ENV;

const AUTH_EMAIL_MIGRATION =
  "20260805230000_allow_duplicate_email_per_username";

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

/** Derive a direct Postgres URL from a Supabase pooler URL when non-pooling is unset. */
function deriveDirectFromPooled(pooledUrl) {
  if (!pooledUrl) return null;
  try {
    const url = new URL(pooledUrl);
    if (url.port === "6543") url.port = "5432";
    if (url.hostname.includes(".pooler.")) {
      url.hostname = url.hostname.replace(".pooler.", ".");
    }
    url.searchParams.delete("pgbouncer");
    if (!url.searchParams.has("schema")) {
      url.searchParams.set("schema", "scl");
    }
    return url.toString();
  } catch {
    return null;
  }
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
    const direct =
      trimmed(process.env.POSTGRES_URL_NON_POOLING) ??
      trimmed(process.env.POSTGRES_URL_DIRECT) ??
      deriveDirectFromPooled(trimmed(process.env.DATABASE_URL));
    if (direct) {
      process.env.DIRECT_URL = withSclSchema(direct);
      console.log("[migrate] mapped DIRECT_URL for migration CLI");
    }
  } else if (!process.env.DIRECT_URL.includes("schema=")) {
    process.env.DIRECT_URL = withSclSchema(process.env.DIRECT_URL);
  }
}

function runPrisma(args, { databaseUrl } = {}) {
  const migrateEnv = { ...process.env };
  if (databaseUrl) migrateEnv.DATABASE_URL = databaseUrl;
  return spawnSync("npx", ["prisma", ...args], {
    encoding: "utf8",
    shell: process.platform === "win32",
    env: migrateEnv,
  });
}

/**
 * Force-apply the auth email uniqueness change via raw SQL on a direct
 * connection, then mark the Prisma migration applied. Survives failed prior
 * deploys that left the migration in a bad `_prisma_migrations` state.
 */
function forceAuthEmailMigration() {
  const direct = trimmed(process.env.DIRECT_URL);
  if (!direct) {
    console.error(
      "[migrate] DIRECT_URL is required for auth email DDL but is unset",
    );
    return false;
  }

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

ALTER TABLE scl."User" DROP CONSTRAINT IF EXISTS "User_email_key";
DROP INDEX IF EXISTS scl."User_email_key";
DROP INDEX IF EXISTS "User_email_key";
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_username_key"
  ON scl."User"("email", "username");
`;
  const sqlPath = join(tmpdir(), `scl-${AUTH_EMAIL_MIGRATION}.sql`);
  writeFileSync(sqlPath, sql, "utf8");
  try {
    const executed = runPrisma(["db", "execute", "--file", sqlPath], {
      databaseUrl: direct,
    });
    const out = `${executed.stdout ?? ""}${executed.stderr ?? ""}`;
    if (executed.status !== 0) {
      console.error(
        `[migrate] raw SQL for ${AUTH_EMAIL_MIGRATION} failed:`,
        out,
      );
      return false;
    }
    console.log(`[migrate] raw SQL for ${AUTH_EMAIL_MIGRATION} applied`);

    const rolledBack = runPrisma([
      "migrate",
      "resolve",
      "--rolled-back",
      AUTH_EMAIL_MIGRATION,
    ]);
    const rbOut = `${rolledBack.stdout ?? ""}${rolledBack.stderr ?? ""}`;
    if (
      rolledBack.status !== 0 &&
      !rbOut.includes("P3008") &&
      !rbOut.includes("P3010") &&
      !rbOut.includes("not found")
    ) {
      console.warn(
        `[migrate] resolve --rolled-back returned ${rolledBack.status}; continuing`,
      );
    }

    const applied = runPrisma([
      "migrate",
      "resolve",
      "--applied",
      AUTH_EMAIL_MIGRATION,
    ]);
    const apOut = `${applied.stdout ?? ""}${applied.stderr ?? ""}`;
    if (
      applied.status !== 0 &&
      !apOut.includes("P3008") &&
      !apOut.includes("already recorded")
    ) {
      console.warn(
        `[migrate] resolve --applied returned ${applied.status}: ${apOut}`,
      );
    } else {
      console.log(`[migrate] marked ${AUTH_EMAIL_MIGRATION} as applied`);
    }
    return true;
  } finally {
    try {
      unlinkSync(sqlPath);
    } catch {
      // ignore cleanup errors
    }
  }
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

if (!trimmed(process.env.DATABASE_URL) && !trimmed(process.env.DIRECT_URL)) {
  console.warn(
    "[migrate] No DATABASE_URL / DIRECT_URL at build time — skipping migrate; runtime patch will apply.",
  );
  console.warn(
    `[migrate] env hints: POSTGRES_URL=${Boolean(process.env.POSTGRES_URL)} POSTGRES_URL_NON_POOLING=${Boolean(process.env.POSTGRES_URL_NON_POOLING)}`,
  );
  process.exit(0);
}

if (!forceAuthEmailMigration()) {
  console.error("[migrate] auth email pre-patch failed — aborting build");
  process.exit(1);
}

console.log(`[migrate] VERCEL_ENV=${env ?? "(local)"} — applying migrations.`);
const result = runPrisma(["migrate", "deploy"]);
if (result.status !== 0) {
  console.error("[migrate] prisma migrate deploy failed — continuing build");
  console.error(result.stdout ?? "");
  console.error(result.stderr ?? "");
  process.exit(0);
}
process.exit(0);
