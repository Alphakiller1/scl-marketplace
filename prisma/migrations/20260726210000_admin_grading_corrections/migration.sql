-- Immutable before/after settlement snapshots for admin correction workflows.

ALTER TABLE "GradingAudit"
  ADD COLUMN "previousProfitUnits" DECIMAL(10, 2),
  ADD COLUMN "newProfitUnits" DECIMAL(10, 2);

CREATE TABLE "ParlayGradingAudit" (
  "id" TEXT NOT NULL,
  "parlayId" TEXT NOT NULL,
  "previousOutcome" "Outcome" NOT NULL,
  "newOutcome" "Outcome" NOT NULL,
  "previousProfitUnits" DECIMAL(10, 2),
  "newProfitUnits" DECIMAL(10, 2),
  "source" "GradingSource" NOT NULL,
  "gradedById" TEXT,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ParlayGradingAudit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ParlayGradingAudit_parlayId_createdAt_idx"
  ON "ParlayGradingAudit"("parlayId", "createdAt");
CREATE INDEX "ParlayGradingAudit_gradedById_idx"
  ON "ParlayGradingAudit"("gradedById");

ALTER TABLE "ParlayGradingAudit"
  ADD CONSTRAINT "ParlayGradingAudit_parlayId_fkey"
  FOREIGN KEY ("parlayId") REFERENCES "Parlay"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ParlayGradingAudit"
  ADD CONSTRAINT "ParlayGradingAudit_gradedById_fkey"
  FOREIGN KEY ("gradedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
