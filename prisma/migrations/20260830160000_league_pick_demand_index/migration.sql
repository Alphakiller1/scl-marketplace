-- Supports the rolling admin demand report without scanning historical drafts.
CREATE INDEX IF NOT EXISTS "Play_status_createdAt_idx"
  ON scl."Play"("status", "createdAt");
