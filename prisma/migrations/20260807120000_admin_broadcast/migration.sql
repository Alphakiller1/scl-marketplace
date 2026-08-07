-- Admin broadcasts: one capper, or the roster.
--
-- Idempotent throughout, matching the convention in this directory: production
-- DDL has been applied by hand here before, and a migration that cannot be
-- re-run is what wedges the chain.

ALTER TABLE scl."User"
  ADD COLUMN IF NOT EXISTS "marketingOptOut" BOOLEAN NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t
                 JOIN pg_namespace n ON n.oid = t.typnamespace
                 WHERE t.typname = 'BroadcastAudience' AND n.nspname = 'scl') THEN
    CREATE TYPE scl."BroadcastAudience" AS ENUM ('ALL_CAPPERS', 'VERIFIED_CAPPERS', 'SINGLE_CAPPER');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS scl."AdminBroadcast" (
  "id"             TEXT NOT NULL,
  "subject"        TEXT NOT NULL,
  "body"           TEXT NOT NULL,
  "audience"       scl."BroadcastAudience" NOT NULL,
  "sentById"       TEXT NOT NULL,
  "recipientCount" INTEGER NOT NULL DEFAULT 0,
  "deliveredCount" INTEGER NOT NULL DEFAULT 0,
  "failedCount"    INTEGER NOT NULL DEFAULT 0,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt"    TIMESTAMP(3),
  CONSTRAINT "AdminBroadcast_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS scl."AdminBroadcastRecipient" (
  "id"          TEXT NOT NULL,
  "broadcastId" TEXT NOT NULL,
  "userId"      TEXT,
  "address"     TEXT NOT NULL,
  "delivered"   BOOLEAN NOT NULL DEFAULT false,
  "error"       TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminBroadcastRecipient_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AdminBroadcast_createdAt_idx" ON scl."AdminBroadcast"("createdAt");
CREATE INDEX IF NOT EXISTS "AdminBroadcastRecipient_broadcastId_idx" ON scl."AdminBroadcastRecipient"("broadcastId");
CREATE INDEX IF NOT EXISTS "AdminBroadcastRecipient_userId_idx" ON scl."AdminBroadcastRecipient"("userId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AdminBroadcast_sentById_fkey') THEN
    ALTER TABLE scl."AdminBroadcast"
      ADD CONSTRAINT "AdminBroadcast_sentById_fkey"
      FOREIGN KEY ("sentById") REFERENCES scl."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AdminBroadcastRecipient_broadcastId_fkey') THEN
    ALTER TABLE scl."AdminBroadcastRecipient"
      ADD CONSTRAINT "AdminBroadcastRecipient_broadcastId_fkey"
      FOREIGN KEY ("broadcastId") REFERENCES scl."AdminBroadcast"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AdminBroadcastRecipient_userId_fkey') THEN
    ALTER TABLE scl."AdminBroadcastRecipient"
      ADD CONSTRAINT "AdminBroadcastRecipient_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES scl."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
