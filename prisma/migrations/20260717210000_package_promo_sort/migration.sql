-- AlterTable
ALTER TABLE "scl"."Package" ADD COLUMN IF NOT EXISTS "promoOffer" TEXT;
ALTER TABLE "scl"."Package" ADD COLUMN IF NOT EXISTS "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Package_sortOrder_idx" ON "scl"."Package"("sortOrder");
