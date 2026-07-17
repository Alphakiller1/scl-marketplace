-- Milestone 3: store connections + package affiliate provider fields

CREATE TYPE "StoreProvider" AS ENUM ('WINIBLE', 'WHOP');

CREATE TYPE "StoreConnectionStatus" AS ENUM (
  'NOT_STARTED',
  'INSTRUCTIONS_VIEWED',
  'PENDING_SCL_ACCEPTANCE',
  'PENDING_SCL_LINK_IMPORT',
  'LINKS_RECEIVED',
  'PACKAGES_IMPORTED',
  'LIVE',
  'NEEDS_ACTION',
  'DISABLED'
);

CREATE TYPE "PackageImportStatus" AS ENUM (
  'NOT_STARTED',
  'LINKS_RECEIVED',
  'IMPORTED',
  'LIVE'
);

CREATE TABLE "StoreConnection" (
  "id" TEXT NOT NULL,
  "capperId" TEXT NOT NULL,
  "provider" "StoreProvider" NOT NULL,
  "status" "StoreConnectionStatus" NOT NULL DEFAULT 'NOT_STARTED',
  "packageImportStatus" "PackageImportStatus" NOT NULL DEFAULT 'NOT_STARTED',
  "submittedAt" TIMESTAMP(3),
  "acknowledgmentAt" TIMESTAMP(3),
  "adminNotes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "StoreConnection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StoreConnection_capperId_provider_key" ON "StoreConnection"("capperId", "provider");
CREATE INDEX "StoreConnection_status_idx" ON "StoreConnection"("status");
CREATE INDEX "StoreConnection_provider_idx" ON "StoreConnection"("provider");

ALTER TABLE "StoreConnection"
  ADD CONSTRAINT "StoreConnection_capperId_fkey"
  FOREIGN KEY ("capperId") REFERENCES "CapperProfile"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Package"
  ADD COLUMN "storeConnectionId" TEXT,
  ADD COLUMN "affiliateProvider" "StoreProvider";

CREATE INDEX "Package_storeConnectionId_idx" ON "Package"("storeConnectionId");
CREATE INDEX "Package_isActive_idx" ON "Package"("isActive");

ALTER TABLE "Package"
  ADD CONSTRAINT "Package_storeConnectionId_fkey"
  FOREIGN KEY ("storeConnectionId") REFERENCES "StoreConnection"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
