-- Admin-managed policy documents with immutable revision history.

CREATE TYPE "PolicySlug" AS ENUM (
  'TERMS',
  'PRIVACY',
  'DISCLAIMER',
  'RESPONSIBLE_GAMING'
);

CREATE TABLE "PolicyDocument" (
  "slug" "PolicySlug" NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PolicyDocument_pkey" PRIMARY KEY ("slug")
);

CREATE TABLE "PolicyDocumentRevision" (
  "id" TEXT NOT NULL,
  "slug" "PolicySlug" NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "editedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PolicyDocumentRevision_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PolicyDocument_updatedById_idx"
  ON "PolicyDocument"("updatedById");
CREATE INDEX "PolicyDocumentRevision_slug_createdAt_idx"
  ON "PolicyDocumentRevision"("slug", "createdAt");
CREATE INDEX "PolicyDocumentRevision_editedById_idx"
  ON "PolicyDocumentRevision"("editedById");

ALTER TABLE "PolicyDocument"
  ADD CONSTRAINT "PolicyDocument_updatedById_fkey"
  FOREIGN KEY ("updatedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PolicyDocumentRevision"
  ADD CONSTRAINT "PolicyDocumentRevision_slug_fkey"
  FOREIGN KEY ("slug") REFERENCES "PolicyDocument"("slug")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PolicyDocumentRevision"
  ADD CONSTRAINT "PolicyDocumentRevision_editedById_fkey"
  FOREIGN KEY ("editedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
