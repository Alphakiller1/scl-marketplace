-- CreateEnum
CREATE TYPE "PackageAuditAction" AS ENUM ('CREATED', 'UPDATED', 'ACTIVATED', 'DEACTIVATED', 'REORDERED');

-- CreateTable
CREATE TABLE "PackageAuditEvent" (
    "id" TEXT NOT NULL,
    "packageId" TEXT,
    "capperId" TEXT NOT NULL,
    "action" "PackageAuditAction" NOT NULL,
    "actorId" TEXT NOT NULL,
    "summary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PackageAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PackageAuditEvent_capperId_createdAt_idx" ON "PackageAuditEvent"("capperId", "createdAt");

-- CreateIndex
CREATE INDEX "PackageAuditEvent_packageId_idx" ON "PackageAuditEvent"("packageId");

-- CreateIndex
CREATE INDEX "PackageAuditEvent_actorId_idx" ON "PackageAuditEvent"("actorId");

-- AddForeignKey
ALTER TABLE "PackageAuditEvent" ADD CONSTRAINT "PackageAuditEvent_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "Package"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageAuditEvent" ADD CONSTRAINT "PackageAuditEvent_capperId_fkey" FOREIGN KEY ("capperId") REFERENCES "CapperProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageAuditEvent" ADD CONSTRAINT "PackageAuditEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
