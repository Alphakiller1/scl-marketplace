-- Hardening for the Brevo campaign queue. Additive and safe to re-run.
--
-- 1. `provider` defaults to RESEND. The pre-queue sender (still serving traffic
--    until the new build is promoted) never sets it, so any row it creates is
--    recognisably legacy and is never picked up by the Brevo worker. The queue
--    path sets 'BREVO' explicitly and always carries a `requestKey`.
-- 2. `requestKey` makes campaign creation idempotent per composer submission.
-- 3. `attempts` bounds retries of provider calls that were definitively refused.
-- 4. `queuedCount` reports recipients still waiting.
-- 5. `sentAt` index backs the rolling daily-limit count.

ALTER TABLE scl."AdminBroadcast" ALTER COLUMN "provider" SET DEFAULT 'RESEND';

ALTER TABLE scl."AdminBroadcast"
  ADD COLUMN IF NOT EXISTS "requestKey" TEXT,
  ADD COLUMN IF NOT EXISTS "queuedCount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE scl."AdminBroadcastRecipient"
  ADD COLUMN IF NOT EXISTS "attempts" INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS "AdminBroadcast_requestKey_key"
  ON scl."AdminBroadcast"("requestKey");
CREATE INDEX IF NOT EXISTS "AdminBroadcastRecipient_sentAt_idx"
  ON scl."AdminBroadcastRecipient"("sentAt");

-- Any 'BREVO' row without a requestKey was written by the old sender between
-- the previous migration and this deploy (the queue path always sets one). The
-- old sender already mailed it through Resend, so record it as legacy history
-- rather than leaving it QUEUED for the Brevo worker to send again.
UPDATE scl."AdminBroadcastRecipient" r
SET "status" = CASE
  WHEN r."delivered" THEN 'SENT'::scl."AdminBroadcastRecipientStatus"
  ELSE 'FAILED'::scl."AdminBroadcastRecipientStatus"
END
FROM scl."AdminBroadcast" b
WHERE r."broadcastId" = b."id"
  AND b."requestKey" IS NULL
  AND b."provider" = 'BREVO'
  AND r."status" = 'QUEUED';

UPDATE scl."AdminBroadcast"
SET "status" = CASE
  WHEN "completedAt" IS NULL THEN 'PARTIAL_FAILED'::scl."AdminBroadcastStatus"
  WHEN "failedCount" > 0 THEN 'PARTIAL_FAILED'::scl."AdminBroadcastStatus"
  ELSE 'COMPLETED'::scl."AdminBroadcastStatus"
END,
"sentCount" = "deliveredCount",
"deliveredCount" = 0,
"provider" = 'RESEND'
WHERE "requestKey" IS NULL AND "provider" = 'BREVO';

-- Legacy rows got the migration time as scheduledAt; they were sent on creation.
UPDATE scl."AdminBroadcast"
SET "scheduledAt" = "createdAt"
WHERE "provider" = 'RESEND' AND "scheduledAt" <> "createdAt";
