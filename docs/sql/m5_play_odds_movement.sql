-- SCL M5 PR-2 — odds-movement guard fields on Play
-- Run in Supabase SQL Editor BEFORE merge if migrate cannot apply first.
-- Touches `scl` only; public must stay unchanged.

ALTER TABLE "scl"."Play"
ADD COLUMN IF NOT EXISTS "selectedOddsAmerican" INTEGER;

ALTER TABLE "scl"."Play"
ADD COLUMN IF NOT EXISTS "oddsMovedAccepted" BOOLEAN NOT NULL DEFAULT false;
