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

// A failed production build may leave this migration marked failed even when the
// DDL never landed (or landed partially). Roll it back so deploy can retry cleanly.
const AUTH_EMAIL_MIGRATION =
  "20260805230000_allow_duplicate_email_per_username";
const resolve = spawnSync(
  "npx",
  ["prisma", "migrate", "resolve", "--rolled-back", AUTH_EMAIL_MIGRATION],
  { encoding: "utf8", shell: process.platform === "win32", env: process.env },
);
const resolveOut = `${resolve.stdout ?? ""}${resolve.stderr ?? ""}`;
if (
  resolve.status !== 0 &&
  !resolveOut.includes("P3008") &&
  !resolveOut.includes("P3010") &&
  !resolveOut.includes("not found")
) {
  console.warn(
    `[migrate] resolve --rolled-back ${AUTH_EMAIL_MIGRATION} returned ${resolve.status}; continuing deploy.`,
  );
}

console.log(`[migrate] VERCEL_ENV=${env ?? "(local)"} — applying migrations.`);
const result = spawnSync("npx", ["prisma", "migrate", "deploy"], {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: process.env,
});
process.exit(result.status ?? 1);
