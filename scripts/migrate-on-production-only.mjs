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
}

function runPrisma(args) {
  return spawnSync("npx", ["prisma", ...args], {
    encoding: "utf8",
    shell: process.platform === "win32",
    env: process.env,
  });
}

/**
 * Force-apply the auth email uniqueness change via raw SQL, then mark the
 * Prisma migration applied. Survives failed prior deploys that left the
 * migration in a bad `_prisma_migrations` state.
 */
function forceAuthEmailMigration() {
  const AUTH_EMAIL_MIGRATION =
    "20260805230000_allow_duplicate_email_per_username";
  const sql = `
ALTER TABLE scl."User" DROP CONSTRAINT IF EXISTS "User_email_key";
DROP INDEX IF EXISTS scl."User_email_key";
DROP INDEX IF EXISTS "User_email_key";
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_username_key"
  ON scl."User"("email", "username");
`;
  const sqlPath = join(tmpdir(), `scl-${AUTH_EMAIL_MIGRATION}.sql`);
  writeFileSync(sqlPath, sql, "utf8");
  try {
    const executed = runPrisma(["db", "execute", "--file", sqlPath]);
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
  console.error(
    "[migrate] No DATABASE_URL / DIRECT_URL (or Supabase aliases) — cannot migrate.",
  );
  process.exit(1);
}

forceAuthEmailMigration();

console.log(`[migrate] VERCEL_ENV=${env ?? "(local)"} — applying migrations.`);
const result = runPrisma(["migrate", "deploy"]);
if (result.status !== 0) {
  console.error(result.stdout ?? "");
  console.error(result.stderr ?? "");
}
process.exit(result.status ?? 1);
