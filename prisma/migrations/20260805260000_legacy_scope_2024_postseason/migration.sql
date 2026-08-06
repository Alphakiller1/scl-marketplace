-- Adds scopes for the legacy `y2024` / `s2024` / `stats_post` tables.
--
-- Those tables are EMPTY in every export to date: one scaffolding row per
-- capper with the name filled and every counter at zero, 0 settled results
-- between them. So no row will carry these scopes today. They are added
-- because the extractor now maps those tables, and Postgres cannot drop an
-- enum value once created — so schema.prisma and the database must agree or
-- Prisma reports permanent drift.
--
-- Display-only if they ever populate: PRE_IMPORT is the only scope folded into
-- standings, so a prior season cannot shift anyone's rank.
--
-- ADD VALUE is safe inside a transaction on PG 12+ provided the new label is
-- not used in the same transaction; nothing here writes rows.
ALTER TYPE "scl"."LegacyRecordScope" ADD VALUE IF NOT EXISTS 'YEAR_2024';
ALTER TYPE "scl"."LegacyRecordScope" ADD VALUE IF NOT EXISTS 'SEASON_2024';
ALTER TYPE "scl"."LegacyRecordScope" ADD VALUE IF NOT EXISTS 'POSTSEASON';
