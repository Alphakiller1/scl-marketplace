-- CreateEnum
CREATE TYPE "LegacyRecordScope" AS ENUM ('PRE_IMPORT', 'CURRENT_SEASON', 'CURRENT_YEAR', 'YEAR_2025', 'SEASON_2025', 'LAST_7D', 'LAST_30D', 'LAST_60D', 'LAST_90D');

-- CreateTable
CREATE TABLE "LegacyRecord" (
    "id" TEXT NOT NULL,
    "capperId" TEXT NOT NULL,
    "scope" "LegacyRecordScope" NOT NULL,
    "sport" TEXT NOT NULL,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "pushes" INTEGER NOT NULL DEFAULT 0,
    "unitsRisked" DECIMAL(12,2) NOT NULL,
    "unitsNet" DECIMAL(12,2) NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LegacyRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LegacyRecord_scope_sport_idx" ON "LegacyRecord"("scope", "sport");

-- CreateIndex
CREATE UNIQUE INDEX "LegacyRecord_capperId_scope_sport_key" ON "LegacyRecord"("capperId", "scope", "sport");

-- AddForeignKey
ALTER TABLE "LegacyRecord" ADD CONSTRAINT "LegacyRecord_capperId_fkey" FOREIGN KEY ("capperId") REFERENCES "CapperProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
