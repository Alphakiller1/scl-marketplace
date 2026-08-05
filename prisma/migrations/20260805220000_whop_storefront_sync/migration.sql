-- Whop OAuth credentials on store connections + external product ids for sync upserts.
ALTER TABLE "StoreConnection"
  ADD COLUMN IF NOT EXISTS "whopCompanyId" TEXT,
  ADD COLUMN IF NOT EXISTS "whopCompanyRoute" TEXT,
  ADD COLUMN IF NOT EXISTS "whopAccessToken" TEXT,
  ADD COLUMN IF NOT EXISTS "whopRefreshToken" TEXT,
  ADD COLUMN IF NOT EXISTS "whopTokenExpiresAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "whopConnectedAt" TIMESTAMP(3);

ALTER TABLE "Package"
  ADD COLUMN IF NOT EXISTS "externalProductId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Package_storeConnectionId_externalProductId_key"
  ON "Package"("storeConnectionId", "externalProductId");

CREATE INDEX IF NOT EXISTS "Package_externalProductId_idx"
  ON "Package"("externalProductId");
