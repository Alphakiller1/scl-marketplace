-- Add workflow tracking columns to StoreConnection for admin storefront operations

ALTER TABLE "StoreConnection" ADD COLUMN "affiliateAcceptedAt" TIMESTAMP;
ALTER TABLE "StoreConnection" ADD COLUMN "lastImportedAt" TIMESTAMP;
ALTER TABLE "StoreConnection" ADD COLUMN "packageCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "StoreConnection" ADD COLUMN "affiliatePercent" DOUBLE PRECISION;
ALTER TABLE "StoreConnection" ADD COLUMN "requiresAttention" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "StoreConnection_requiresAttention_idx" ON "StoreConnection" ("requiresAttention");
