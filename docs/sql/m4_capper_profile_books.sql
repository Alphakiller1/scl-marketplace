-- SCL M4 PR-1 — CapperProfile.books
-- Run in Supabase SQL Editor BEFORE merging the app PR if migrate/deploy
-- cannot apply first. Touches `scl` only; public must stay unchanged.
--
-- Verify after:
--   SELECT column_name, data_type, column_default
--   FROM information_schema.columns
--   WHERE table_schema = 'scl' AND table_name = 'CapperProfile' AND column_name = 'books';
--   SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';

ALTER TABLE "scl"."CapperProfile"
ADD COLUMN IF NOT EXISTS "books" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
