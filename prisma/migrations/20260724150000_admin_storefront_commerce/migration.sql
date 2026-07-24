-- CreateEnum
CREATE TYPE "CommercePlatform" AS ENUM ('NONE', 'WINIBLE', 'WHOP');

-- CreateEnum
CREATE TYPE "StorefrontStatus" AS ENUM (
  'NOT_STARTED',
  'AWAITING_AFFILIATE_INVITE',
  'PENDING_SCL_REVIEW',
  'APPROVED',
  'STOREFRONT_LIVE',
  'NEEDS_ATTENTION'
);

-- CreateEnum
CREATE TYPE "PackageVisibility" AS ENUM ('DRAFT', 'HIDDEN', 'LIVE');

-- AlterTable
ALTER TABLE "CapperProfile"
ADD COLUMN "commercePlatform" "CommercePlatform" NOT NULL DEFAULT 'NONE',
ADD COLUMN "storefrontStatus" "StorefrontStatus" NOT NULL DEFAULT 'NOT_STARTED',
ADD COLUMN "adminNotes" TEXT,
ADD COLUMN "lastReviewedAt" TIMESTAMP(3),
ADD COLUMN "lastReviewedById" TEXT;

-- AlterTable
ALTER TABLE "Package"
ADD COLUMN "trialTerms" TEXT,
ADD COLUMN "displayOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "visibility" "PackageVisibility" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN "affiliatePercent" INTEGER,
ADD COLUMN "approvedAt" TIMESTAMP(3),
ADD COLUMN "approvedById" TEXT,
ADD COLUMN "suspendedAt" TIMESTAMP(3),
ADD COLUMN "suspendedReason" TEXT;

-- CreateIndex
CREATE INDEX "Package_visibility_idx" ON "Package"("visibility");

-- AddForeignKey
ALTER TABLE "CapperProfile"
ADD CONSTRAINT "CapperProfile_lastReviewedById_fkey"
FOREIGN KEY ("lastReviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Package"
ADD CONSTRAINT "Package_approvedById_fkey"
FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
