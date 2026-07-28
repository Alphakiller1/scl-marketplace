-- CreateTable
CREATE TABLE "scl"."GradeJobRun" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "provider" TEXT NOT NULL,
    "graded" INTEGER NOT NULL DEFAULT 0,
    "skipped" INTEGER NOT NULL DEFAULT 0,
    "parlaysGraded" INTEGER NOT NULL DEFAULT 0,
    "skippedByReason" JSONB NOT NULL,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "meta" JSONB,

    CONSTRAINT "GradeJobRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GradeJobRun_status_idx" ON "scl"."GradeJobRun"("status");

-- CreateIndex
CREATE INDEX "GradeJobRun_createdAt_idx" ON "scl"."GradeJobRun"("createdAt");
