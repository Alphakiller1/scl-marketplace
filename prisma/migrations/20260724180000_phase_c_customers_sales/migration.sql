-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'CUSTOMER';

-- CreateEnum
CREATE TYPE "EmailRecipientKind" AS ENUM ('CAPPER', 'CUSTOMER');

-- CreateEnum
CREATE TYPE "SaleSource" AS ENUM ('MANUAL', 'WINIBLE', 'WHOP', 'SCL_NATIVE');

-- CreateEnum
CREATE TYPE "SaleStatus" AS ENUM ('REPORTED', 'CONFIRMED', 'REFUNDED', 'DISPUTED');

-- AlterEnum
ALTER TYPE "BulkEmailAudience" ADD VALUE 'ALL_CUSTOMERS';
ALTER TYPE "BulkEmailAudience" ADD VALUE 'ACTIVE_CUSTOMERS';
ALTER TYPE "BulkEmailAudience" ADD VALUE 'MARKETING_OPT_IN_CUSTOMERS';

-- AlterTable
ALTER TABLE "CapperProfile"
ADD COLUMN "nativeStoreEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "defaultAffiliatePercent" INTEGER;

-- AlterTable
ALTER TABLE "ClickEvent"
ADD COLUMN "customerUserId" TEXT;

-- AlterTable
ALTER TABLE "BulkEmailCampaign"
ADD COLUMN "recipientKind" "EmailRecipientKind" NOT NULL DEFAULT 'CAPPER';

-- CreateTable
CREATE TABLE "CustomerProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "marketingOptIn" BOOLEAN NOT NULL DEFAULT true,
    "adminNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformCommerceSettings" (
    "id" TEXT NOT NULL,
    "nativeStoreEnabled" BOOLEAN NOT NULL DEFAULT false,
    "platformAffiliatePercent" INTEGER NOT NULL DEFAULT 20,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "PlatformCommerceSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackageSale" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "customerUserId" TEXT,
    "customerProfileId" TEXT,
    "clickEventId" TEXT,
    "source" "SaleSource" NOT NULL,
    "status" "SaleStatus" NOT NULL DEFAULT 'REPORTED',
    "grossCents" INTEGER NOT NULL,
    "affiliateCents" INTEGER,
    "affiliatePercent" INTEGER,
    "externalOrderId" TEXT,
    "purchasedAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "recordedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PackageSale_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CustomerProfile_userId_key" ON "CustomerProfile"("userId");

-- CreateIndex
CREATE INDEX "CustomerProfile_marketingOptIn_idx" ON "CustomerProfile"("marketingOptIn");

-- CreateIndex
CREATE INDEX "ClickEvent_customerUserId_idx" ON "ClickEvent"("customerUserId");

-- CreateIndex
CREATE INDEX "BulkEmailCampaign_recipientKind_idx" ON "BulkEmailCampaign"("recipientKind");

-- CreateIndex
CREATE INDEX "PackageSale_packageId_idx" ON "PackageSale"("packageId");

-- CreateIndex
CREATE INDEX "PackageSale_purchasedAt_idx" ON "PackageSale"("purchasedAt");

-- CreateIndex
CREATE INDEX "PackageSale_status_idx" ON "PackageSale"("status");

-- CreateIndex
CREATE INDEX "PackageSale_source_idx" ON "PackageSale"("source");

-- AddForeignKey
ALTER TABLE "CustomerProfile" ADD CONSTRAINT "CustomerProfile_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClickEvent" ADD CONSTRAINT "ClickEvent_customerUserId_fkey"
FOREIGN KEY ("customerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformCommerceSettings" ADD CONSTRAINT "PlatformCommerceSettings_updatedById_fkey"
FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageSale" ADD CONSTRAINT "PackageSale_packageId_fkey"
FOREIGN KEY ("packageId") REFERENCES "Package"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageSale" ADD CONSTRAINT "PackageSale_customerUserId_fkey"
FOREIGN KEY ("customerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageSale" ADD CONSTRAINT "PackageSale_customerProfileId_fkey"
FOREIGN KEY ("customerProfileId") REFERENCES "CustomerProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageSale" ADD CONSTRAINT "PackageSale_clickEventId_fkey"
FOREIGN KEY ("clickEventId") REFERENCES "ClickEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageSale" ADD CONSTRAINT "PackageSale_recordedById_fkey"
FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed default commerce settings row
INSERT INTO "PlatformCommerceSettings" ("id", "nativeStoreEnabled", "platformAffiliatePercent", "updatedAt")
VALUES ('default', false, 20, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
