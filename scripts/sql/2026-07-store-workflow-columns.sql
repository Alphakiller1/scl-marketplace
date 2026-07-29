-- Idempotent prod patch for migration 20260728033616_add_storeconnection_workflow.
--
-- Prod was patched column-by-column via docs/qa/SUPABASE_SQL_PATCHES.md, so the
-- Play columns + enums already exist but the StoreConnection *workflow* columns
-- and OddsUsageDaily table were never applied. Their absence hard-crashes:
--   * the ghost seed (prisma.storeConnection.create → "column packageCount does not exist")
--   * the Winible store-connection review workflow (affiliate/attention columns)
--
-- Everything here is IF NOT EXISTS so it is safe to re-run and never fails on
-- columns that are already present. Runs against the `scl` schema only.

SET search_path TO scl, public;

-- StoreConnection workflow columns -------------------------------------------
ALTER TABLE scl."StoreConnection" ADD COLUMN IF NOT EXISTS "affiliateAcceptedAt" TIMESTAMP(3);
ALTER TABLE scl."StoreConnection" ADD COLUMN IF NOT EXISTS "affiliatePercent"    DOUBLE PRECISION;
ALTER TABLE scl."StoreConnection" ADD COLUMN IF NOT EXISTS "lastImportedAt"      TIMESTAMP(3);
ALTER TABLE scl."StoreConnection" ADD COLUMN IF NOT EXISTS "packageCount"        INTEGER NOT NULL DEFAULT 0;
ALTER TABLE scl."StoreConnection" ADD COLUMN IF NOT EXISTS "requiresAttention"   BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "StoreConnection_requiresAttention_idx"
  ON scl."StoreConnection"("requiresAttention");

-- OddsUsageDaily (same migration; used by odds-usage accounting) --------------
CREATE TABLE IF NOT EXISTS scl."OddsUsageDaily" (
  "id"        TEXT NOT NULL,
  "date"      DATE NOT NULL,
  "purpose"   TEXT NOT NULL,
  "sport"     TEXT NOT NULL DEFAULT '',
  "calls"     INTEGER NOT NULL DEFAULT 0,
  "credits"   INTEGER NOT NULL DEFAULT 0,
  "remaining" INTEGER,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OddsUsageDaily_pkey" PRIMARY KEY ("id")
);
CREATE INDEX        IF NOT EXISTS "OddsUsageDaily_date_idx"              ON scl."OddsUsageDaily"("date");
CREATE UNIQUE INDEX IF NOT EXISTS "OddsUsageDaily_date_purpose_sport_key" ON scl."OddsUsageDaily"("date", "purpose", "sport");

-- Report the StoreConnection shape so the workflow log proves the columns landed.
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'scl'
  AND table_name = 'StoreConnection'
  AND column_name IN ('affiliateAcceptedAt','affiliatePercent','lastImportedAt','packageCount','requiresAttention')
ORDER BY column_name;
