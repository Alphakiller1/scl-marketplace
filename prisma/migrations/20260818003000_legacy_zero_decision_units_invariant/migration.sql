-- A push returns the stake and cannot create net profit or loss. Repair any
-- historical residual produced before the extractor enforced that invariant.
UPDATE scl."LegacyRecord"
SET "unitsNet" = 0
WHERE ("wins" + "losses") = 0
  AND "unitsNet" <> 0;

-- Keep every import path and future environment from reintroducing the same
-- internally contradictory aggregate. The DO guard makes this migration safe
-- where the production runtime repair installed the constraint first.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'LegacyRecord_zero_decision_units_check'
      AND conrelid = 'scl."LegacyRecord"'::regclass
  ) THEN
    ALTER TABLE scl."LegacyRecord"
      ADD CONSTRAINT "LegacyRecord_zero_decision_units_check"
      CHECK (("wins" + "losses") > 0 OR "unitsNet" = 0);
  END IF;
END
$$;
