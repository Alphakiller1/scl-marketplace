-- Capper "Request Regrade" / "Request Injury Protection" queue.
-- Additive only, and idempotent like every SCL migration: safe to re-run.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
                 WHERE t.typname = 'GradeRequestType' AND n.nspname = 'scl') THEN
    CREATE TYPE scl."GradeRequestType" AS ENUM ('REGRADE', 'INJURY_PROTECTION');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
                 WHERE t.typname = 'GradeRequestStatus' AND n.nspname = 'scl') THEN
    CREATE TYPE scl."GradeRequestStatus" AS ENUM ('OPEN', 'RESOLVED', 'DECLINED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS scl."GradeRequest" (
  "id" TEXT NOT NULL,
  "type" scl."GradeRequestType" NOT NULL,
  "status" scl."GradeRequestStatus" NOT NULL DEFAULT 'OPEN',
  "capperId" TEXT NOT NULL,
  "playId" TEXT,
  "parlayId" TEXT,
  "commentary" TEXT NOT NULL,
  "outcomeAtRequest" scl."Outcome" NOT NULL,
  "profitUnitsAtRequest" DECIMAL(16,2),
  "pickSummary" TEXT NOT NULL,
  "eventStartsAt" TIMESTAMP(3),
  "emailSentAt" TIMESTAMP(3),
  "emailError" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "resolvedById" TEXT,
  "resolutionNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GradeRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "GradeRequest_status_createdAt_idx"
  ON scl."GradeRequest"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "GradeRequest_capperId_status_idx"
  ON scl."GradeRequest"("capperId", "status");
CREATE INDEX IF NOT EXISTS "GradeRequest_playId_idx"
  ON scl."GradeRequest"("playId");
CREATE INDEX IF NOT EXISTS "GradeRequest_parlayId_idx"
  ON scl."GradeRequest"("parlayId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GradeRequest_capperId_fkey') THEN
    ALTER TABLE scl."GradeRequest" ADD CONSTRAINT "GradeRequest_capperId_fkey"
      FOREIGN KEY ("capperId") REFERENCES scl."CapperProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GradeRequest_playId_fkey') THEN
    ALTER TABLE scl."GradeRequest" ADD CONSTRAINT "GradeRequest_playId_fkey"
      FOREIGN KEY ("playId") REFERENCES scl."Play"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GradeRequest_parlayId_fkey') THEN
    ALTER TABLE scl."GradeRequest" ADD CONSTRAINT "GradeRequest_parlayId_fkey"
      FOREIGN KEY ("parlayId") REFERENCES scl."Parlay"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GradeRequest_resolvedById_fkey') THEN
    ALTER TABLE scl."GradeRequest" ADD CONSTRAINT "GradeRequest_resolvedById_fkey"
      FOREIGN KEY ("resolvedById") REFERENCES scl."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
