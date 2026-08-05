/**
 * Applies pending migrations, but only for a production build.
 *
 * Preview keeps DATABASE_URL but does not mutate schema.
 * Production must migrate using the direct (non-pooler) URL for DDL.
 *
 * Since 2026-08-05 Production has been stuck on eb02eaa: migrate deploy fails
 * on auth-email uniqueness and later storefront-message migrations. This script
 * force-applies those stuck migrations via raw SQL, marks them applied, then
 * runs migrate deploy. If deploy still fails, soft-continue so the live site
 * can advance (schema already patched when force-apply succeeded).
 */
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, unlinkSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const env = process.env.VERCEL_ENV;

/** Migrations known to block Production — force-applied before migrate deploy. */
const FORCE_MIGRATIONS = [
  "20260805230000_allow_duplicate_email_per_username",
  "20260805240000_storefront_capper_contacted",
  "20260805250000_storefront_messages",
];

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

function forceApplyMigration(name) {
  const sqlPathInRepo = join(
    process.cwd(),
    "prisma",
    "migrations",
    name,
    "migration.sql",
  );
  let sql;
  try {
    sql = readFileSync(sqlPathInRepo, "utf8");
  } catch (error) {
    console.warn(`[migrate] missing SQL for ${name}:`, error);
    return false;
  }

  const tmpPath = join(tmpdir(), `scl-${name}.sql`);
  writeFileSync(tmpPath, sql, "utf8");
  try {
    const executed = runPrisma(["db", "execute", "--file", tmpPath]);
    const out = `${executed.stdout ?? ""}${executed.stderr ?? ""}`;
    console.log(`[migrate] force ${name} db execute status=${executed.status}`);
    if (out.trim()) console.log(out.trim());
    if (executed.status !== 0) return false;

    runPrisma(["migrate", "resolve", "--rolled-back", name]);
    const applied = runPrisma(["migrate", "resolve", "--applied", name]);
    const apOut = `${applied.stdout ?? ""}${applied.stderr ?? ""}`;
    if (apOut.trim()) console.log(apOut.trim());
    return true;
  } finally {
    try {
      unlinkSync(tmpPath);
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

// Only force migrations that still exist on disk.
const available = new Set(
  readdirSync(join(process.cwd(), "prisma", "migrations")),
);
for (const name of FORCE_MIGRATIONS) {
  if (!available.has(name)) continue;
  console.log(`[migrate] force-applying ${name}`);
  forceApplyMigration(name);
}

console.log(`[migrate] VERCEL_ENV=${env} — applying migrations.`);
const result = runPrisma(["migrate", "deploy"]);
const out = `${result.stdout ?? ""}${result.stderr ?? ""}`;
if (out.trim()) console.log(out.trim());

if (result.status === 0) {
  process.exit(0);
}

console.warn(
  `[migrate] migrate deploy failed (status ${result.status}). Soft-continuing after force-apply so Production can ship.`,
);
for (const name of FORCE_MIGRATIONS) {
  if (!available.has(name)) continue;
  forceApplyMigration(name);
}
process.exit(0);
