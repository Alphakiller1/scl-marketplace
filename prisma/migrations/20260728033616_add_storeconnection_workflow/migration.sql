-- CreateEnum
CREATE TYPE "PickSource" AS ENUM ('MANUAL', 'IMPORTED_X', 'IMPORTED_DISCORD', 'IMPORTED_TELEGRAM', 'SCREENSHOT_OCR');

-- CreateEnum
CREATE TYPE "PickStatus" AS ENUM ('DRAFT', 'COMMITTED');

-- CreateEnum
CREATE TYPE "VerificationTier" AS ENUM ('AUTO_VERIFIED', 'VERIFIED', 'SELF_REPORTED');

-- AlterTable
ALTER TABLE "Play" ADD COLUMN     "closingCapturedAt" TIMESTAMP(3),
ADD COLUMN     "closingOddsAmerican" INTEGER,
ADD COLUMN     "clvPts" DECIMAL(10,4),
ADD COLUMN     "eventId" TEXT,
ADD COLUMN     "eventStartsAt" TIMESTAMP(3),
ADD COLUMN     "line" DECIMAL(10,2),
ADD COLUMN     "loggedPreGame" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "notesPublic" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "oddsVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "side" TEXT,
ADD COLUMN     "source" "PickSource" NOT NULL DEFAULT 'MANUAL',
ADD COLUMN     "sourceRef" TEXT,
ADD COLUMN     "status" "PickStatus" NOT NULL DEFAULT 'COMMITTED',
ADD COLUMN     "verificationTier" "VerificationTier" NOT NULL DEFAULT 'SELF_REPORTED';

-- AlterTable
ALTER TABLE "StoreConnection" ADD COLUMN     "affiliateAcceptedAt" TIMESTAMP(3),
ADD COLUMN     "affiliatePercent" DOUBLE PRECISION,
ADD COLUMN     "lastImportedAt" TIMESTAMP(3),
ADD COLUMN     "packageCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "requiresAttention" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "OddsUsageDaily" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "purpose" TEXT NOT NULL,
    "sport" TEXT NOT NULL DEFAULT '',
    "calls" INTEGER NOT NULL DEFAULT 0,
    "credits" INTEGER NOT NULL DEFAULT 0,
    "remaining" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OddsUsageDaily_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OddsUsageDaily_date_idx" ON "OddsUsageDaily"("date");

-- CreateIndex
CREATE UNIQUE INDEX "OddsUsageDaily_date_purpose_sport_key" ON "OddsUsageDaily"("date", "purpose", "sport");

-- CreateIndex
CREATE INDEX "Play_eventId_idx" ON "Play"("eventId");

-- CreateIndex
CREATE INDEX "StoreConnection_requiresAttention_idx" ON "StoreConnection"("requiresAttention");
