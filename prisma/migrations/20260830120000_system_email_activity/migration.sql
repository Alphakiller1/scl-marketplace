CREATE TYPE scl."SystemEmailActivityStatus" AS ENUM ('SENT', 'FAILED');

CREATE TABLE scl."SystemEmailActivity" (
  "id" TEXT NOT NULL,
  "emailType" TEXT NOT NULL,
  "recipientUsername" TEXT,
  "recipientEmail" TEXT NOT NULL,
  "status" scl."SystemEmailActivityStatus" NOT NULL,
  "providerMessageId" TEXT,
  "failureReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SystemEmailActivity_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SystemEmailActivity_createdAt_idx"
  ON scl."SystemEmailActivity"("createdAt");
CREATE INDEX "SystemEmailActivity_status_createdAt_idx"
  ON scl."SystemEmailActivity"("status", "createdAt");
CREATE INDEX "SystemEmailActivity_recipientEmail_createdAt_idx"
  ON scl."SystemEmailActivity"("recipientEmail", "createdAt");
