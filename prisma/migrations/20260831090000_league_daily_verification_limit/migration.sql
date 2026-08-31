-- How many times one event of a league may be re-priced in a buy day.
--
-- The ceiling is four and the default is three, spent by the schedule as one
-- build the day before plus 08:00 ET and 17:00 ET on the day itself. Before
-- this, a fifteen-game MLB slate was being bought six to eight times a day.
--
-- Existing rows take the default: nothing has been deliberately configured yet,
-- and starting every league at the safe number is the point.

ALTER TABLE "scl"."OddsSportControl"
  ADD COLUMN IF NOT EXISTS "dailyVerificationLimit" INTEGER NOT NULL DEFAULT 3;

-- Belt and braces: the application clamps to 4, but a value written by hand
-- must not be able to lift the cap either.
ALTER TABLE "scl"."OddsSportControl"
  DROP CONSTRAINT IF EXISTS "OddsSportControl_dailyVerificationLimit_range";
ALTER TABLE "scl"."OddsSportControl"
  ADD CONSTRAINT "OddsSportControl_dailyVerificationLimit_range"
  CHECK ("dailyVerificationLimit" BETWEEN 1 AND 4);
