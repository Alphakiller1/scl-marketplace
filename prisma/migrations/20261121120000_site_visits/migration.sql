CREATE TABLE IF NOT EXISTS scl."SiteVisit" (
  "day" VARCHAR(10) NOT NULL,
  "sessionHash" VARCHAR(64) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SiteVisit_pkey" PRIMARY KEY ("day", "sessionHash")
);

CREATE INDEX IF NOT EXISTS "SiteVisit_createdAt_idx"
  ON scl."SiteVisit"("createdAt");
