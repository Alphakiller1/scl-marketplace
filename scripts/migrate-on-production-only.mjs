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

// Local builds (no VERCEL_ENV) keep the old behaviour so `npm run build` is
// unchanged for developers.
if (env && env !== "production") {
  console.log(
    `[migrate] VERCEL_ENV=${env} — skipping "prisma migrate deploy"; only production builds migrate.`,
  );
  process.exit(0);
}

console.log(`[migrate] VERCEL_ENV=${env ?? "(local)"} — applying migrations.`);
const result = spawnSync("npx", ["prisma", "migrate", "deploy"], {
  stdio: "inherit",
  shell: process.platform === "win32",
});
process.exit(result.status ?? 1);
