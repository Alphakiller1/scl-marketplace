-- AlterTable
ALTER TABLE "Play" ADD COLUMN "selectedOddsAmerican" INTEGER;
ALTER TABLE "Play" ADD COLUMN "oddsMovedAccepted" BOOLEAN NOT NULL DEFAULT false;
