-- Shared admin audiences, durable campaign queue, and provider event tracking.

ALTER TYPE scl."BroadcastAudience" ADD VALUE IF NOT EXISTS 'FILTERED_CAPPERS';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
                 WHERE t.typname = 'AdminBroadcastStatus' AND n.nspname = 'scl') THEN
    CREATE TYPE scl."AdminBroadcastStatus" AS ENUM
      ('QUEUED', 'PROCESSING', 'COMPLETED', 'PARTIAL_FAILED', 'CANCELLED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
                 WHERE t.typname = 'AdminBroadcastRecipientStatus' AND n.nspname = 'scl') THEN
    CREATE TYPE scl."AdminBroadcastRecipientStatus" AS ENUM
      ('QUEUED', 'SENT', 'DELIVERED', 'OPENED', 'BOUNCED', 'FAILED', 'UNSUBSCRIBED', 'SKIPPED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS scl."AudienceGroup" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "filters" JSONB NOT NULL,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AudienceGroup_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AudienceGroup_createdById_name_key"
  ON scl."AudienceGroup"("createdById", "name");
CREATE INDEX IF NOT EXISTS "AudienceGroup_updatedAt_idx"
  ON scl."AudienceGroup"("updatedAt");

ALTER TABLE scl."AdminBroadcast"
  ADD COLUMN IF NOT EXISTS "audienceName" TEXT,
  ADD COLUMN IF NOT EXISTS "filters" JSONB,
  ADD COLUMN IF NOT EXISTS "groupId" TEXT,
  ADD COLUMN IF NOT EXISTS "sentCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "openedCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "bouncedCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "unsubscribedCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "status" scl."AdminBroadcastStatus" NOT NULL DEFAULT 'QUEUED',
  ADD COLUMN IF NOT EXISTS "provider" TEXT NOT NULL DEFAULT 'BREVO',
  ADD COLUMN IF NOT EXISTS "scheduledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "startedAt" TIMESTAMP(3);

ALTER TABLE scl."AdminBroadcastRecipient"
  ADD COLUMN IF NOT EXISTS "status" scl."AdminBroadcastRecipientStatus" NOT NULL DEFAULT 'QUEUED',
  ADD COLUMN IF NOT EXISTS "providerMessageId" TEXT,
  ADD COLUMN IF NOT EXISTS "sentAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "deliveredAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "openedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "bouncedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "unsubscribedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "AdminBroadcast_status_scheduledAt_idx"
  ON scl."AdminBroadcast"("status", "scheduledAt");
CREATE INDEX IF NOT EXISTS "AdminBroadcast_groupId_idx"
  ON scl."AdminBroadcast"("groupId");
CREATE INDEX IF NOT EXISTS "AdminBroadcastRecipient_status_createdAt_idx"
  ON scl."AdminBroadcastRecipient"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "AdminBroadcastRecipient_providerMessageId_idx"
  ON scl."AdminBroadcastRecipient"("providerMessageId");
CREATE UNIQUE INDEX IF NOT EXISTS "AdminBroadcastRecipient_broadcastId_address_key"
  ON scl."AdminBroadcastRecipient"("broadcastId", "address");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AudienceGroup_createdById_fkey') THEN
    ALTER TABLE scl."AudienceGroup" ADD CONSTRAINT "AudienceGroup_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES scl."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AdminBroadcast_groupId_fkey') THEN
    ALTER TABLE scl."AdminBroadcast" ADD CONSTRAINT "AdminBroadcast_groupId_fkey"
      FOREIGN KEY ("groupId") REFERENCES scl."AudienceGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Existing broadcasts pre-date the queue. Preserve their historical truth.
UPDATE scl."AdminBroadcast"
SET "status" = CASE
  WHEN "completedAt" IS NULL THEN 'PARTIAL_FAILED'::scl."AdminBroadcastStatus"
  WHEN "failedCount" > 0 THEN 'PARTIAL_FAILED'::scl."AdminBroadcastStatus"
  ELSE 'COMPLETED'::scl."AdminBroadcastStatus"
END,
"sentCount" = "deliveredCount",
"deliveredCount" = 0,
"provider" = 'RESEND'
WHERE "provider" = 'BREVO' AND "createdAt" < CURRENT_TIMESTAMP;

UPDATE scl."AdminBroadcastRecipient"
SET "status" = CASE
  WHEN "delivered" THEN 'SENT'::scl."AdminBroadcastRecipientStatus"
  ELSE 'FAILED'::scl."AdminBroadcastRecipientStatus"
END
WHERE "status" = 'QUEUED';
