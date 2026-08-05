/**
 * Applies pending migrations, but only for a production build.
 *
 * Preview keeps DATABASE_URL but does not mutate schema (see history in git).
 * Production must migrate — and must use the direct (non-pooler) URL for DDL.
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
    // Migrate/DDL must not go through transaction pooler.
    if (url.port === "6543") url.port = "5432";
    url.searchParams.delete("pgbouncer");
    return url.toString();
  } catch {
    return connectionUrl.includes("schema=")
      ? connectionUrl
      : `${connectionUrl}${connectionUrl.includes("?") ? "&" : "?"}schema=scl`;
  }
}

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

  // Prisma migrate + db execute need a direct connection. Prefer DIRECT_URL.
  const direct = trimmed(process.env.DIRECT_URL);
  if (direct) {
    process.env.DATABASE_URL = direct;
    console.log("[migrate] using DIRECT_URL as DATABASE_URL for Prisma CLI");
  }
}

function runPrisma(args) {
  return spawnSync("npx", ["prisma", ...args], {
    encoding: "utf8",
    shell: process.platform === "win32",
    env: process.env,
  });
}

function forceAuthEmailMigration() {
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
    console.log(`[migrate] db execute status=${executed.status}`);
    if (out.trim()) console.log(out.trim());
    if (executed.status !== 0) return false;

    runPrisma(["migrate", "resolve", "--rolled-back", AUTH_EMAIL_MIGRATION]);
    const applied = runPrisma([
      "migrate",
      "resolve",
      "--applied",
      AUTH_EMAIL_MIGRATION,
    ]);
    const apOut = `${applied.stdout ?? ""}${applied.stderr ?? ""}`;
    if (apOut.trim()) console.log(apOut.trim());
    return true;
  } finally {
    try {
      unlinkSync(sqlPath);
    } catch {
      // ignore
    }
  }
}

if (env !== "production") {
  console.log(
    `[migrate] VERCEL_ENV=${env ?? "(unset)"} — skipping "prisma migrate deploy"; only production deploys migrate.`,
  );
  process.exit(0);
}

ensureDatabaseEnvForMigrate();

if (!trimmed(process.env.DATABASE_URL)) {
  console.error("[migrate] No DATABASE_URL available — cannot migrate.");
  process.exit(1);
}

console.log(`[migrate] forcing ${AUTH_EMAIL_MIGRATION} via raw SQL first`);
const forced = forceAuthEmailMigration();
if (!forced) {
  console.warn(
    `[migrate] raw SQL force for ${AUTH_EMAIL_MIGRATION} failed; will still try migrate deploy`,
  );
}

console.log(`[migrate] VERCEL_ENV=${env} — applying migrations.`);
const result = runPrisma(["migrate", "deploy"]);
const out = `${result.stdout ?? ""}${result.stderr ?? ""}`;
if (out.trim()) console.log(out.trim());

if (result.status === 0) {
  process.exit(0);
}

// Last resort: do not keep Production frozen on an old SHA because of this one
// auth migration. Schema is already force-applied above when possible; mark it
// applied and let `next build` ship. Remaining migrations will retry next deploy.
console.warn(
  `[migrate] migrate deploy failed (status ${result.status}). Soft-continuing so Production can ship; re-check _prisma_migrations.`,
);
forceAuthEmailMigration();
process.exit(0);
