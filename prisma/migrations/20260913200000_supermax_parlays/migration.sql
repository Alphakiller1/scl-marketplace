ALTER TABLE scl."Parlay"
  ADD COLUMN "isSupermax" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "supermaxDay" DATE;

CREATE INDEX "Parlay_capperId_isSupermax_createdAt_idx"
  ON scl."Parlay"("capperId", "isSupermax", "createdAt");

CREATE UNIQUE INDEX "Parlay_capperId_supermaxDay_key"
  ON scl."Parlay"("capperId", "supermaxDay");
