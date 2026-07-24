-- CreateEnum
CREATE TYPE "PolicyDocumentSlug" AS ENUM ('TERMS', 'PRIVACY', 'RESPONSIBLE_GAMING', 'DISCLAIMER');

-- CreateEnum
CREATE TYPE "BulkEmailAudience" AS ENUM (
  'ALL_CAPPERS',
  'ACTIVE_CAPPERS',
  'VERIFIED_CAPPERS',
  'STOREFRONT_LIVE',
  'NEEDS_ATTENTION'
);

-- CreateTable
CREATE TABLE "PolicyRelease" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "summary" TEXT,
    "requiresReacceptance" BOOLEAN NOT NULL DEFAULT true,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedById" TEXT NOT NULL,

    CONSTRAINT "PolicyRelease_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PolicyDocument" (
    "id" TEXT NOT NULL,
    "releaseId" TEXT NOT NULL,
    "slug" "PolicyDocumentSlug" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,

    CONSTRAINT "PolicyDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BulkEmailCampaign" (
    "id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "bodyHtml" TEXT NOT NULL,
    "audience" "BulkEmailAudience" NOT NULL,
    "recipientCount" INTEGER NOT NULL DEFAULT 0,
    "deliveredCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentById" TEXT NOT NULL,

    CONSTRAINT "BulkEmailCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PolicyRelease_version_key" ON "PolicyRelease"("version");

-- CreateIndex
CREATE INDEX "PolicyRelease_publishedAt_idx" ON "PolicyRelease"("publishedAt");

-- CreateIndex
CREATE INDEX "PolicyDocument_slug_idx" ON "PolicyDocument"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "PolicyDocument_releaseId_slug_key" ON "PolicyDocument"("releaseId", "slug");

-- CreateIndex
CREATE INDEX "BulkEmailCampaign_createdAt_idx" ON "BulkEmailCampaign"("createdAt");

-- AddForeignKey
ALTER TABLE "PolicyRelease" ADD CONSTRAINT "PolicyRelease_publishedById_fkey"
FOREIGN KEY ("publishedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolicyDocument" ADD CONSTRAINT "PolicyDocument_releaseId_fkey"
FOREIGN KEY ("releaseId") REFERENCES "PolicyRelease"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BulkEmailCampaign" ADD CONSTRAINT "BulkEmailCampaign_sentById_fkey"
FOREIGN KEY ("sentById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
