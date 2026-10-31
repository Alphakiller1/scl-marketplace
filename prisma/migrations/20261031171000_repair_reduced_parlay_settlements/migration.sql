-- The previous settlement rule voided a multi-leg parlay when push/void legs
-- left exactly one winner. The surviving selection should pay at its original
-- straight-bet price. Repair every automatically settled ticket with that
-- exact shape while preserving any human/admin override.
BEGIN;

CREATE TEMP TABLE "ReducedParlayRepair" ON COMMIT DROP AS
SELECT
  p."id" AS "parlayId",
  p."outcome" AS "previousOutcome",
  p."profitUnits" AS "previousProfitUnits",
  winner."oddsAmerican" AS "effectiveOddsAmerican",
  ROUND(
    p."units" * CASE
      WHEN winner."oddsAmerican" > 0
        THEN winner."oddsAmerican"::NUMERIC / 100
      ELSE 100::NUMERIC / ABS(winner."oddsAmerican")
    END,
    2
  ) AS "newProfitUnits"
FROM scl."Parlay" p
JOIN LATERAL (
  SELECT leg."oddsAmerican"
  FROM scl."Play" leg
  WHERE leg."parlayId" = p."id"
    AND leg."outcome" = 'WIN'
) winner ON true
WHERE p."outcome" = 'VOID'
  AND (SELECT COUNT(*) FROM scl."Play" leg WHERE leg."parlayId" = p."id") >= 2
  AND (SELECT COUNT(*) FROM scl."Play" leg WHERE leg."parlayId" = p."id" AND leg."outcome" = 'WIN') = 1
  AND NOT EXISTS (
    SELECT 1
    FROM scl."Play" leg
    WHERE leg."parlayId" = p."id"
      AND leg."outcome" NOT IN ('WIN', 'PUSH', 'VOID')
  )
  AND COALESCE(
    (
      SELECT audit."source" = 'AUTO'
      FROM scl."ParlayGradingAudit" audit
      WHERE audit."parlayId" = p."id"
      ORDER BY audit."createdAt" DESC
      LIMIT 1
    ),
    true
  );

INSERT INTO scl."ParlayGradingAudit" (
  "id",
  "parlayId",
  "previousOutcome",
  "newOutcome",
  "previousProfitUnits",
  "newProfitUnits",
  "source",
  "gradedById",
  "reason",
  "createdAt"
)
SELECT
  'repair-single-survivor-' || repair."parlayId",
  repair."parlayId",
  repair."previousOutcome",
  'WIN',
  repair."previousProfitUnits",
  repair."newProfitUnits",
  'AUTO',
  NULL,
  'Rule correction: push/void legs reduced the parlay to one winning straight bet',
  CURRENT_TIMESTAMP
FROM "ReducedParlayRepair" repair
ON CONFLICT ("id") DO NOTHING;

UPDATE scl."Parlay" p
SET
  "outcome" = 'WIN',
  "profitUnits" = repair."newProfitUnits",
  "combinedOddsAmerican" = repair."effectiveOddsAmerican",
  "gradedAt" = CURRENT_TIMESTAMP
FROM "ReducedParlayRepair" repair
WHERE p."id" = repair."parlayId";

COMMIT;
