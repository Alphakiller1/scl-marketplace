-- Owner-editable copy for capper-facing email.
--
-- Idempotent throughout, matching the convention in this directory: production
-- DDL has been applied by hand here before, and a migration that cannot be
-- re-run is what wedges the chain.
--
-- No seed rows. A template nobody has edited has no row, and the loader falls
-- back to the copy bundled in the build — so this migration cannot change what
-- any capper receives, and an unavailable table degrades to the same default
-- rather than failing a signup.

CREATE TABLE IF NOT EXISTS scl."EmailTemplate" (
  "slug"        TEXT NOT NULL,
  "subject"     TEXT NOT NULL,
  "body"        TEXT NOT NULL,
  "actionLabel" TEXT NOT NULL,
  "footnote"    TEXT NOT NULL,
  "updatedById" TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmailTemplate_pkey" PRIMARY KEY ("slug")
);

CREATE TABLE IF NOT EXISTS scl."EmailTemplateRevision" (
  "id"          TEXT NOT NULL,
  "slug"        TEXT NOT NULL,
  "subject"     TEXT NOT NULL,
  "body"        TEXT NOT NULL,
  "actionLabel" TEXT NOT NULL,
  "footnote"    TEXT NOT NULL,
  "editedById"  TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmailTemplateRevision_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "EmailTemplate_updatedById_idx"
  ON scl."EmailTemplate" ("updatedById");

CREATE INDEX IF NOT EXISTS "EmailTemplateRevision_slug_createdAt_idx"
  ON scl."EmailTemplateRevision" ("slug", "createdAt");

CREATE INDEX IF NOT EXISTS "EmailTemplateRevision_editedById_idx"
  ON scl."EmailTemplateRevision" ("editedById");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EmailTemplate_updatedById_fkey') THEN
    ALTER TABLE scl."EmailTemplate"
      ADD CONSTRAINT "EmailTemplate_updatedById_fkey"
      FOREIGN KEY ("updatedById") REFERENCES scl."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EmailTemplateRevision_slug_fkey') THEN
    ALTER TABLE scl."EmailTemplateRevision"
      ADD CONSTRAINT "EmailTemplateRevision_slug_fkey"
      FOREIGN KEY ("slug") REFERENCES scl."EmailTemplate"("slug") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EmailTemplateRevision_editedById_fkey') THEN
    ALTER TABLE scl."EmailTemplateRevision"
      ADD CONSTRAINT "EmailTemplateRevision_editedById_fkey"
      FOREIGN KEY ("editedById") REFERENCES scl."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
