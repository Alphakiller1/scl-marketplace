-- In-app storefront conversation thread between admins and cappers.
CREATE TYPE "StorefrontMessageSender" AS ENUM ('ADMIN', 'CAPPER');

CREATE TABLE "StorefrontMessage" (
  "id" TEXT NOT NULL,
  "storeConnectionId" TEXT NOT NULL,
  "senderId" TEXT NOT NULL,
  "senderRole" "StorefrontMessageSender" NOT NULL,
  "body" TEXT NOT NULL,
  "readByAdminAt" TIMESTAMP(3),
  "readByCapperAt" TIMESTAMP(3),
  "emailNotifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "StorefrontMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StorefrontMessage_storeConnectionId_createdAt_idx"
  ON "StorefrontMessage"("storeConnectionId", "createdAt");
CREATE INDEX "StorefrontMessage_storeConnectionId_readByAdminAt_idx"
  ON "StorefrontMessage"("storeConnectionId", "readByAdminAt");
CREATE INDEX "StorefrontMessage_storeConnectionId_readByCapperAt_idx"
  ON "StorefrontMessage"("storeConnectionId", "readByCapperAt");

ALTER TABLE "StorefrontMessage"
  ADD CONSTRAINT "StorefrontMessage_storeConnectionId_fkey"
  FOREIGN KEY ("storeConnectionId") REFERENCES "StoreConnection"("id")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "StorefrontMessage_senderId_fkey"
  FOREIGN KEY ("senderId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
