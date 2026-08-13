-- Flexible billing cadence: a term is now a COUNT of billing periods, so a
-- package can last 4 days or 2 weeks rather than only whole single units.
--
-- Idempotent, matching this directory's convention.
--
-- Defaulting to 1 preserves every existing package exactly: "MONTH" becomes
-- "1 x MONTH", which formats and prices identically to before.
ALTER TABLE scl."Package"
  ADD COLUMN IF NOT EXISTS "billingIntervalCount" INTEGER NOT NULL DEFAULT 1;

-- A count is meaningless for these two, and letting one drift above 1 would
-- render "$20 / 3 one time". Pin them.
UPDATE scl."Package"
SET "billingIntervalCount" = 1
WHERE "billingPeriod" IN ('ONE_TIME', 'SEASON')
  AND "billingIntervalCount" <> 1;
