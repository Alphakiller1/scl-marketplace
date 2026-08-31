CREATE TABLE scl."OddsVerificationSchedule" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "sport" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "league" TEXT,
  "coverage" TEXT NOT NULL,
  "markets" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "maxEvents" INTEGER NOT NULL DEFAULT 20,
  "recurrence" TEXT NOT NULL,
  "daysOfWeek" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
  "timeOfDayMinutes" INTEGER,
  "runAt" TIMESTAMP(3),
  "nextRunAt" TIMESTAMP(3),
  "lastRunAt" TIMESTAMP(3),
  "lastStatus" TEXT,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OddsVerificationSchedule_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OddsVerificationSchedule_scope_check" CHECK ("scope" IN ('SLATE', 'LEAGUE')),
  CONSTRAINT "OddsVerificationSchedule_coverage_check" CHECK ("coverage" IN ('SURFACE', 'CONFIGURED', 'ALL')),
  CONSTRAINT "OddsVerificationSchedule_recurrence_check" CHECK ("recurrence" IN ('ONCE', 'RECURRING')),
  CONSTRAINT "OddsVerificationSchedule_scope_fields_check" CHECK (
    ("scope" = 'SLATE' AND "league" IS NULL) OR
    ("scope" = 'LEAGUE' AND LENGTH(TRIM("league")) > 0)
  ),
  CONSTRAINT "OddsVerificationSchedule_recurrence_fields_check" CHECK (
    ("recurrence" = 'ONCE' AND "runAt" IS NOT NULL) OR
    ("recurrence" = 'RECURRING' AND "timeOfDayMinutes" IS NOT NULL AND CARDINALITY("daysOfWeek") > 0 AND "daysOfWeek" <@ ARRAY[0,1,2,3,4,5,6]::INTEGER[])
  ),
  CONSTRAINT "OddsVerificationSchedule_maxEvents_check" CHECK ("maxEvents" BETWEEN 1 AND 99),
  CONSTRAINT "OddsVerificationSchedule_time_check" CHECK ("timeOfDayMinutes" IS NULL OR "timeOfDayMinutes" BETWEEN 0 AND 1439),
  CONSTRAINT "OddsVerificationSchedule_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES scl."User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "OddsVerificationSchedule_enabled_nextRunAt_idx"
  ON scl."OddsVerificationSchedule"("enabled", "nextRunAt");
CREATE INDEX "OddsVerificationSchedule_sport_league_idx"
  ON scl."OddsVerificationSchedule"("sport", "league");
