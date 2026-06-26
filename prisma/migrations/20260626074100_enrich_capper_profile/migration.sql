-- CreateEnum
CREATE TYPE "DailyVolume" AS ENUM ('LOW', 'MODERATE', 'HIGH', 'VERY_HIGH');

-- CreateEnum
CREATE TYPE "BetType" AS ENUM ('STRAIGHT', 'PARLAY', 'PROP', 'TEASER', 'TOTAL');

-- CreateEnum
CREATE TYPE "BillingPeriod" AS ENUM ('ONE_TIME', 'DAY', 'WEEK', 'MONTH', 'SEASON', 'YEAR');

-- AlterTable
ALTER TABLE "CapperProfile" ADD COLUMN     "betTypes" "BetType"[] DEFAULT ARRAY[]::"BetType"[],
ADD COLUMN     "biggestBetWon" TEXT,
ADD COLUMN     "dailyVolume" "DailyVolume",
ADD COLUMN     "facebook" TEXT,
ADD COLUMN     "headline" TEXT,
ADD COLUMN     "instagram" TEXT,
ADD COLUMN     "sports" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "tiktok" TEXT,
ADD COLUMN     "twitter" TEXT,
ADD COLUMN     "website" TEXT,
ADD COLUMN     "writtenAnalysis" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Package" ADD COLUMN     "billingPeriod" "BillingPeriod" NOT NULL DEFAULT 'MONTH',
ADD COLUMN     "checkoutUrl" TEXT;
