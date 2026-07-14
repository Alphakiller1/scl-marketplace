-- SCL v1.1 / M4 — Play.book + default CapperProfile.books to all curated keys
-- Run in Supabase SQL Editor BEFORE merge if migrate cannot apply first.
-- Touches `scl` only; public must stay unchanged.

ALTER TABLE "scl"."Play"
ADD COLUMN IF NOT EXISTS "book" TEXT;

-- Existing profiles: default to ALL supported books (empty previously meant "all US"
-- at the odds layer; materialize the curated set so the profile UI matches intent).
UPDATE "scl"."CapperProfile"
SET "books" = ARRAY[
  'draftkings',
  'fanduel',
  'betmgm',
  'williamhill_us',
  'fanatics',
  'espnbet',
  'hardrockbet',
  'betrivers',
  'bovada',
  'betonlineag'
]::TEXT[]
WHERE cardinality("books") = 0 OR "books" IS NULL;
