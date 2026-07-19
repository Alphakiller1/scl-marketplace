-- CI migration catch-up for columns that were added to schema.prisma via the
-- Supabase SQL runbook (docs/qa/SUPABASE_SQL_PATCHES.md) but never got a Prisma
-- migration file:
--   * User.isTest      — publication eligibility (#226)
--   * Play.needsReview — extreme-odds operator review (#224)
--
-- Production applies these through the SQL runbook (Vercel build runs no
-- migrations). This file exists only so `prisma migrate deploy` — used by the
-- CI `marketplace-smoke` job to build its throwaway Postgres — stays in sync
-- with schema.prisma. The `?schema=scl` in DATABASE_URL sets the search path,
-- so the unqualified table names resolve to the scl schema (matching the
-- existing migrations).

ALTER TABLE "User" ADD COLUMN "isTest" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Play" ADD COLUMN "needsReview" BOOLEAN NOT NULL DEFAULT false;
