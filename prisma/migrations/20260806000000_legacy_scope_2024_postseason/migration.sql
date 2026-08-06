-- Declare the scopes for the legacy `y2024` / `s2024` / `stats_post` tables.
--
-- These values were already added to the production enum by hand while
-- investigating whether a year of history had been dropped in the migration.
-- It had not: all three tables are empty (one scaffolding row per capper, every
-- counter zero, 0 settled results between them), so no row carries these
-- scopes and none is expected to.
--
-- They are declared anyway because Postgres cannot drop an enum value once
-- created. Production already has them; omitting them here would leave
-- schema.prisma permanently out of sync with the database.
--
-- IF NOT EXISTS makes this a no-op against production and a plain create on a
-- fresh database (CI builds a throwaway Postgres with `migrate deploy`).
-- ADD VALUE is transaction-safe on PG 12+ provided the label is not used in the
-- same transaction; nothing here writes rows.
ALTER TYPE "scl"."LegacyRecordScope" ADD VALUE IF NOT EXISTS 'YEAR_2024';
ALTER TYPE "scl"."LegacyRecordScope" ADD VALUE IF NOT EXISTS 'SEASON_2024';
ALTER TYPE "scl"."LegacyRecordScope" ADD VALUE IF NOT EXISTS 'POSTSEASON';
