-- Raise the shared credit ceilings to the plan actually in force (100,000/month
-- provider plan, live since 2026-08-25) and restate both windows as ROLLING.
--
-- The stored values matter more than the column defaults here: a default only
-- applies to a row being inserted, and the singleton config row ("primary")
-- already exists, so without the UPDATE below the dashboard would keep
-- enforcing 10,000/25,000 against a 100,000 plan.
--
-- Only rows still sitting on the old defaults are moved. An owner who has
-- deliberately set a different ceiling keeps it.

ALTER TABLE "scl"."OddsControlConfig"
  ALTER COLUMN "weeklyCreditLimit" SET DEFAULT 25000,
  ALTER COLUMN "monthlyCreditLimit" SET DEFAULT 100000;

UPDATE "scl"."OddsControlConfig"
   SET "weeklyCreditLimit" = 25000
 WHERE "weeklyCreditLimit" = 10000;

UPDATE "scl"."OddsControlConfig"
   SET "monthlyCreditLimit" = 100000
 WHERE "monthlyCreditLimit" = 20000;
