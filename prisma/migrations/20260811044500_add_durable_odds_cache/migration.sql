CREATE TABLE "OddsCacheSnapshot" (
    "key" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "savedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OddsCacheSnapshot_pkey" PRIMARY KEY ("key")
);

CREATE INDEX "OddsCacheSnapshot_expiresAt_idx" ON "OddsCacheSnapshot"("expiresAt");
