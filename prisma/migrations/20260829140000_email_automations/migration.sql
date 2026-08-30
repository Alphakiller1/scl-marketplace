CREATE TYPE scl."EmailAutomationDeliveryStatus" AS ENUM ('PROCESSING', 'SENT', 'FAILED', 'SKIPPED');
CREATE TYPE scl."EmailAutomationRunStatus" AS ENUM ('RUNNING', 'SUCCEEDED', 'COMPLETED_WITH_ERRORS', 'FAILED', 'SKIPPED');

CREATE TABLE scl."EmailAutomationConfig" (
  "id" TEXT NOT NULL DEFAULT 'primary',
  "verificationReminderEnabled" BOOLEAN NOT NULL DEFAULT false,
  "verificationReminderDelayHours" INTEGER NOT NULL DEFAULT 24,
  "verificationReminderActivatedAt" TIMESTAMP(3),
  "noPlaysNudgeEnabled" BOOLEAN NOT NULL DEFAULT false,
  "noPlaysNudgeDelayHours" INTEGER NOT NULL DEFAULT 72,
  "noPlaysNudgeActivatedAt" TIMESTAMP(3),
  "dailyLimit" INTEGER NOT NULL DEFAULT 25,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EmailAutomationConfig_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EmailAutomationConfig_verificationDelay_check" CHECK ("verificationReminderDelayHours" BETWEEN 24 AND 720),
  CONSTRAINT "EmailAutomationConfig_noPlaysDelay_check" CHECK ("noPlaysNudgeDelayHours" BETWEEN 24 AND 720),
  CONSTRAINT "EmailAutomationConfig_dailyLimit_check" CHECK ("dailyLimit" BETWEEN 1 AND 50)
);

CREATE TABLE scl."EmailAutomationDelivery" (
  "id" TEXT NOT NULL,
  "automationKey" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "status" scl."EmailAutomationDeliveryStatus" NOT NULL DEFAULT 'PROCESSING',
  "attemptCount" INTEGER NOT NULL DEFAULT 1,
  "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "nextAttemptAt" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EmailAutomationDelivery_pkey" PRIMARY KEY ("id")
);

CREATE TABLE scl."EmailAutomationRun" (
  "id" TEXT NOT NULL,
  "status" scl."EmailAutomationRunStatus" NOT NULL DEFAULT 'RUNNING',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  "attempted" INTEGER NOT NULL DEFAULT 0,
  "sent" INTEGER NOT NULL DEFAULT 0,
  "failed" INTEGER NOT NULL DEFAULT 0,
  "skipped" INTEGER NOT NULL DEFAULT 0,
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmailAutomationRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE scl."EmailAutomationLock" (
  "key" TEXT NOT NULL,
  "lockedBy" TEXT,
  "lockedUntil" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EmailAutomationLock_pkey" PRIMARY KEY ("key")
);

CREATE INDEX "EmailAutomationConfig_updatedById_idx" ON scl."EmailAutomationConfig"("updatedById");
CREATE UNIQUE INDEX "EmailAutomationDelivery_automationKey_userId_key" ON scl."EmailAutomationDelivery"("automationKey", "userId");
CREATE INDEX "EmailAutomationDelivery_status_nextAttemptAt_idx" ON scl."EmailAutomationDelivery"("status", "nextAttemptAt");
CREATE INDEX "EmailAutomationDelivery_sentAt_idx" ON scl."EmailAutomationDelivery"("sentAt");
CREATE INDEX "EmailAutomationDelivery_userId_idx" ON scl."EmailAutomationDelivery"("userId");
CREATE INDEX "EmailAutomationRun_createdAt_idx" ON scl."EmailAutomationRun"("createdAt");
CREATE INDEX "EmailAutomationRun_status_startedAt_idx" ON scl."EmailAutomationRun"("status", "startedAt");
CREATE INDEX "VerificationToken_identifier_createdAt_idx" ON scl."VerificationToken"("identifier", "createdAt");

ALTER TABLE scl."EmailAutomationConfig"
  ADD CONSTRAINT "EmailAutomationConfig_updatedById_fkey"
  FOREIGN KEY ("updatedById") REFERENCES scl."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE scl."EmailAutomationDelivery"
  ADD CONSTRAINT "EmailAutomationDelivery_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES scl."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
