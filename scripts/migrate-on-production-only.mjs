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

const AUTH_EMAIL_MIGRATION =
  "20260805230000_allow_duplicate_email_per_username";

const AUTH_EMAIL_DDL = `
DROP INDEX IF EXISTS scl."User_email_key";
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_username_key"
  ON scl."User"("email", "username");
`.trim();

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

function prismaEnv() {
  return { ...process.env };
}

function runPrisma(args, { input, inherit = false, databaseUrl } = {}) {
  const env = prismaEnv();
  if (databaseUrl) env.DATABASE_URL = databaseUrl;
  return spawnSync("npx", ["prisma", ...args], {
    input,
    encoding: "utf8",
    stdio: inherit ? "inherit" : "pipe",
    shell: process.platform === "win32",
    env,
  });
}

function outputOf(result) {
  return `${result.stdout ?? ""}${result.stderr ?? ""}`;
}

function isIgnorableResolveOutput(text) {
  return (
    text.includes("P3008") ||
    text.includes("P3010") ||
    text.includes("already been applied") ||
    text.includes("already recorded as rolled back") ||
    text.includes("not found")
  );
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

function runResolve(flag, migration) {
  const result = runPrisma(["migrate", "resolve", `--${flag}`, migration]);
  const out = outputOf(result);
  if (result.status !== 0 && !isIgnorableResolveOutput(out)) {
    console.warn(
      `[migrate] resolve --${flag} ${migration} returned ${result.status}: ${out.trim()}`,
    );
    return false;
  }
  return true;
}

function applyAuthEmailMigration() {
  const direct = trimmed(process.env.DIRECT_URL);
  if (!direct) {
    console.error(
      "[migrate] DIRECT_URL is required to apply auth email migration DDL",
    );
    return false;
  }

  const result = runPrisma(["db", "execute", "--stdin"], {
    input: AUTH_EMAIL_DDL,
    databaseUrl: direct,
  });
  const out = outputOf(result);
  if (result.status !== 0) {
    console.warn(
      `[migrate] auth email DDL returned ${result.status}: ${out.trim().slice(0, 400)}`,
    );
    // IF NOT EXISTS / DROP IF EXISTS make re-runs safe; migrate deploy verifies history.
  } else {
    console.log("[migrate] auth email DDL applied");
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
  console.error(
    "[migrate] DATABASE_URL is unset after Supabase alias mapping — cannot migrate",
  );
  process.exit(1);
}

// Clear a previously failed attempt so deploy can retry cleanly.
runResolve("rolled-back", AUTH_EMAIL_MIGRATION);

// Apply the auth email index swap on a direct connection, then mark it applied
// so `migrate deploy` does not re-run DDL through a pooler or a failed history row.
if (!applyAuthEmailMigration()) {
  console.error("[migrate] auth email migration pre-patch failed");
  process.exit(1);
}
runResolve("applied", AUTH_EMAIL_MIGRATION);

console.log(`[migrate] VERCEL_ENV=${env ?? "(local)"} — applying migrations.`);
const result = runPrisma(["migrate", "deploy"], { inherit: true });
process.exit(result.status ?? 1);
