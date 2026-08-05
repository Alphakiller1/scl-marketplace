-- In-app storefront conversation thread between admins and cappers.
DO $$ BEGIN
  CREATE TYPE scl."StorefrontMessageSender" AS ENUM ('ADMIN', 'CAPPER');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS scl."StorefrontMessage" (
  "id" TEXT NOT NULL,
  "storeConnectionId" TEXT NOT NULL,
  "senderId" TEXT NOT NULL,
  "senderRole" scl."StorefrontMessageSender" NOT NULL,
  "body" TEXT NOT NULL,
  "readByAdminAt" TIMESTAMP(3),
  "readByCapperAt" TIMESTAMP(3),
  "emailNotifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StorefrontMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "StorefrontMessage_storeConnectionId_createdAt_idx"
  ON scl."StorefrontMessage"("storeConnectionId", "createdAt");
CREATE INDEX IF NOT EXISTS "StorefrontMessage_storeConnectionId_readByAdminAt_idx"
  ON scl."StorefrontMessage"("storeConnectionId", "readByAdminAt");
CREATE INDEX IF NOT EXISTS "StorefrontMessage_storeConnectionId_readByCapperAt_idx"
  ON scl."StorefrontMessage"("storeConnectionId", "readByCapperAt");

DO $$ BEGIN
  ALTER TABLE scl."StorefrontMessage"
    ADD CONSTRAINT "StorefrontMessage_storeConnectionId_fkey"
    FOREIGN KEY ("storeConnectionId") REFERENCES scl."StoreConnection"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE scl."StorefrontMessage"
    ADD CONSTRAINT "StorefrontMessage_senderId_fkey"
    FOREIGN KEY ("senderId") REFERENCES scl."User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
