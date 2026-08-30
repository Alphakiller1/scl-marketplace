-- Complete owner reporting and run-level guardrails without rewriting the
-- original rollout migration. Safe for both fresh and previously migrated DBs.
ALTER TABLE scl."OddsUsageDaily"
  ADD COLUMN IF NOT EXISTS "capacity" INTEGER;

ALTER TABLE scl."OddsControlConfig"
  ADD COLUMN IF NOT EXISTS "perRunCreditLimit" INTEGER NOT NULL DEFAULT 2000;

ALTER TABLE scl."OddsControlConfig"
  ALTER COLUMN "timezone" SET DEFAULT 'America/New_York';

UPDATE scl."OddsControlConfig"
SET "timezone" = 'America/New_York'
WHERE "timezone" = 'UTC';

CREATE TABLE IF NOT EXISTS scl."OddsUsageMarketDaily" (
  "id" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "purpose" TEXT NOT NULL,
  "sport" TEXT NOT NULL DEFAULT '',
  "market" TEXT NOT NULL,
  "calls" INTEGER NOT NULL DEFAULT 0,
  "credits" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "OddsUsageMarketDaily_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "OddsUsageMarketDaily_date_purpose_sport_market_key"
  ON scl."OddsUsageMarketDaily"("date", "purpose", "sport", "market");
CREATE INDEX IF NOT EXISTS "OddsUsageMarketDaily_date_idx"
  ON scl."OddsUsageMarketDaily"("date");
CREATE INDEX IF NOT EXISTS "OddsUsageMarketDaily_sport_date_idx"
  ON scl."OddsUsageMarketDaily"("sport", "date");
