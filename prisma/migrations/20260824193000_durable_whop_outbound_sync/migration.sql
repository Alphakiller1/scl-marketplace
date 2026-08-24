ALTER TABLE scl."Package"
  ADD COLUMN IF NOT EXISTS "whopPushPendingAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "whopLastPushedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "whopPushAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "whopPushLastError" TEXT;

CREATE INDEX IF NOT EXISTS "Package_whopPushPendingAt_idx"
  ON scl."Package"("whopPushPendingAt");
