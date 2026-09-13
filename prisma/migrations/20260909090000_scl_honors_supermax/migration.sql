ALTER TABLE scl."Play"
  ADD COLUMN "isSupermax" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "supermaxDay" DATE;

CREATE INDEX "Play_capperId_isSupermax_createdAt_idx"
  ON scl."Play"("capperId", "isSupermax", "createdAt");

CREATE UNIQUE INDEX "Play_capperId_supermaxDay_key"
  ON scl."Play"("capperId", "supermaxDay");

CREATE TABLE scl."HonorsContent" (
  "id" TEXT NOT NULL DEFAULT 'honors',
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "updatedById" TEXT,
  CONSTRAINT "HonorsContent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "HonorsContent_updatedById_fkey" FOREIGN KEY ("updatedById")
    REFERENCES scl."User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE scl."HonorAwardGrant" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "abbreviation" TEXT NOT NULL,
  "icon" TEXT NOT NULL,
  "period" TEXT NOT NULL,
  "sport" TEXT NOT NULL,
  "metric" TEXT NOT NULL,
  "minimumPicks" INTEGER NOT NULL,
  "visibleFrom" TIMESTAMP(3) NOT NULL,
  "visibleUntil" TIMESTAMP(3) NOT NULL,
  "capperId" TEXT NOT NULL,
  "winnerName" TEXT NOT NULL,
  "winnerHandle" TEXT NOT NULL,
  "winnerAvatarUrl" TEXT,
  "wins" INTEGER NOT NULL,
  "losses" INTEGER NOT NULL,
  "pushes" INTEGER NOT NULL,
  "units" DECIMAL(16,2) NOT NULL,
  "roi" DECIMAL(10,4) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HonorAwardGrant_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "HonorAwardGrant_capperId_fkey" FOREIGN KEY ("capperId")
    REFERENCES scl."CapperProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "HonorAwardGrant_capperId_visibleFrom_idx"
  ON scl."HonorAwardGrant"("capperId", "visibleFrom");

CREATE INDEX "HonorAwardGrant_visibleFrom_visibleUntil_idx"
  ON scl."HonorAwardGrant"("visibleFrom", "visibleUntil");
