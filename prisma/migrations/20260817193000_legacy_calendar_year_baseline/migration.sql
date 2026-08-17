-- A cross-sport public record needs one shared time boundary. PRE_IMPORT was
-- originally derived from CURRENT_SEASON, but "current season" starts on a
-- different date for NFL, NBA, MLB, and every other sport. That made a capper's
-- all-sports headline an arbitrary mixture of multiple calendar periods.
--
-- Rebuild the residual from CURRENT_YEAR instead. The individually imported
-- plays are subtracted only inside the captured calendar year and only through
-- the frozen legacy snapshot, so subsequent SCL results remain counted once.

CREATE TEMP TABLE "_LegacyCalendarYearBaseline" AS
SELECT
  cy."capperId",
  cy."sport",
  GREATEST(0, cy."wins" - imported."wins")::INTEGER AS "wins",
  GREATEST(0, cy."losses" - imported."losses")::INTEGER AS "losses",
  GREATEST(0, cy."pushes" - imported."pushes")::INTEGER AS "pushes",
  ROUND(GREATEST(0, cy."unitsRisked" - imported."unitsRisked"), 2)::DECIMAL(12,2) AS "unitsRisked",
  ROUND(cy."unitsNet" - imported."unitsNet", 2)::DECIMAL(12,2) AS "unitsNet",
  cy."capturedAt"
FROM "LegacyRecord" cy
CROSS JOIN LATERAL (
  SELECT
    COUNT(*) FILTER (WHERE p."outcome" = 'WIN')::INTEGER AS "wins",
    COUNT(*) FILTER (WHERE p."outcome" = 'LOSS')::INTEGER AS "losses",
    COUNT(*) FILTER (WHERE p."outcome" = 'PUSH')::INTEGER AS "pushes",
    COALESCE(SUM(p."units"), 0)::DECIMAL AS "unitsRisked",
    COALESCE(SUM(p."profitUnits"), 0)::DECIMAL AS "unitsNet"
  FROM "Play" p
  WHERE p."capperId" = cy."capperId"
    AND p."parlayId" IS NULL
    AND p."outcome" IN ('WIN', 'LOSS', 'PUSH')
    AND p."createdAt" >= date_trunc('year', cy."capturedAt")
    AND p."createdAt" <= cy."capturedAt"
) imported
WHERE cy."scope" = 'CURRENT_YEAR';

-- Remove season-derived residuals that have no valid calendar-year remainder.
DELETE FROM "LegacyRecord" existing
WHERE existing."scope" = 'PRE_IMPORT'
  AND EXISTS (
    SELECT 1
    FROM "LegacyRecord" cy
    WHERE cy."capperId" = existing."capperId"
      AND cy."scope" = 'CURRENT_YEAR'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM "_LegacyCalendarYearBaseline" corrected
    WHERE corrected."capperId" = existing."capperId"
      AND corrected."sport" = existing."sport"
      AND corrected."wins" + corrected."losses" + corrected."pushes" > 0
      AND corrected."unitsRisked" > 0
  );

INSERT INTO "LegacyRecord" (
  "id",
  "capperId",
  "scope",
  "sport",
  "wins",
  "losses",
  "pushes",
  "unitsRisked",
  "unitsNet",
  "capturedAt",
  "createdAt",
  "updatedAt"
)
SELECT
  'calendar-year-baseline-' || md5(corrected."capperId" || ':' || corrected."sport"),
  corrected."capperId",
  'PRE_IMPORT'::"LegacyRecordScope",
  corrected."sport",
  corrected."wins",
  corrected."losses",
  corrected."pushes",
  corrected."unitsRisked",
  corrected."unitsNet",
  corrected."capturedAt",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "_LegacyCalendarYearBaseline" corrected
WHERE corrected."wins" + corrected."losses" + corrected."pushes" > 0
  AND corrected."unitsRisked" > 0
ON CONFLICT ("capperId", "scope", "sport") DO UPDATE SET
  "wins" = EXCLUDED."wins",
  "losses" = EXCLUDED."losses",
  "pushes" = EXCLUDED."pushes",
  "unitsRisked" = EXCLUDED."unitsRisked",
  "unitsNet" = EXCLUDED."unitsNet",
  "capturedAt" = EXCLUDED."capturedAt",
  "updatedAt" = CURRENT_TIMESTAMP;

DROP TABLE "_LegacyCalendarYearBaseline";
