-- Audited storefront approval, suspension, review, and package-readiness events

CREATE TYPE "StorefrontReviewAction" AS ENUM (
  'APPROVED',
  'MARKED_LIVE',
  'CHANGES_REQUESTED',
  'SUSPENDED',
  'RESTORED',
  'NOTES_UPDATED',
  'PACKAGE_SYNC'
);

ALTER TABLE "StoreConnection"
  ADD COLUMN "reviewedAt" TIMESTAMP(3),
  ADD COLUMN "reviewedById" TEXT;

CREATE TABLE "StorefrontReviewEvent" (
  "id" TEXT NOT NULL,
  "storeConnectionId" TEXT NOT NULL,
  "action" "StorefrontReviewAction" NOT NULL,
  "previousStatus" "StoreConnectionStatus" NOT NULL,
  "newStatus" "StoreConnectionStatus" NOT NULL,
  "reviewedById" TEXT NOT NULL,
  "reason" TEXT,
  "adminNotes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "StorefrontReviewEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StoreConnection_reviewedById_idx"
  ON "StoreConnection"("reviewedById");
CREATE INDEX "StorefrontReviewEvent_storeConnectionId_createdAt_idx"
  ON "StorefrontReviewEvent"("storeConnectionId", "createdAt");
CREATE INDEX "StorefrontReviewEvent_reviewedById_idx"
  ON "StorefrontReviewEvent"("reviewedById");

ALTER TABLE "StoreConnection"
  ADD CONSTRAINT "StoreConnection_reviewedById_fkey"
  FOREIGN KEY ("reviewedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "StorefrontReviewEvent"
  ADD CONSTRAINT "StorefrontReviewEvent_storeConnectionId_fkey"
  FOREIGN KEY ("storeConnectionId") REFERENCES "StoreConnection"("id")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "StorefrontReviewEvent_reviewedById_fkey"
  FOREIGN KEY ("reviewedById") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
