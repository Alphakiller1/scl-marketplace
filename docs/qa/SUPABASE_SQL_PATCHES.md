# Supabase SQL Patches — Owner Runbook

Run these in the **Supabase SQL Editor** (Production).  
Additive only — no `prisma migrate deploy` in Vercel `buildCommand`.

If `DATABASE_URL` uses `?schema=scl`, either set the search path first or
qualify tables as `scl."Play"` / `scl."OddsUsageDaily"`.

```sql
SET search_path TO scl;
```

## Play — CLV + analysis visibility

```sql
ALTER TABLE "Play"
  ADD COLUMN IF NOT EXISTS "notesPublic" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "closingOddsAmerican" INTEGER,
  ADD COLUMN IF NOT EXISTS "clvPts" DECIMAL(10, 4),
  ADD COLUMN IF NOT EXISTS "closingCapturedAt" TIMESTAMP(3);
```

## OddsUsageDaily — credit persistence

```sql
CREATE TABLE IF NOT EXISTS "OddsUsageDaily" (
  "id" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "purpose" TEXT NOT NULL,
  "sport" TEXT NOT NULL DEFAULT '',
  "calls" INTEGER NOT NULL DEFAULT 0,
  "credits" INTEGER NOT NULL DEFAULT 0,
  "remaining" INTEGER,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OddsUsageDaily_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "OddsUsageDaily_date_purpose_sport_key"
  ON "OddsUsageDaily" ("date", "purpose", "sport");
```

Until this SQL runs, production soft-degrades: grading still works; CLV /
`notesPublic` / usage table writes are skipped. After running SQL, redeploy or
wait for the next cold start so process caches refresh.

## User — publication eligibility (`isTest`)

```sql
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "isTest" BOOLEAN NOT NULL DEFAULT false;

UPDATE "User"
SET "isTest" = true
WHERE lower(coalesce("username", '')) IN (
  'demo_capper', 'beetbot', 'media', 'ericlikestotest', 'solpickz'
)
OR lower(coalesce("username", '')) LIKE 'qa%'
OR lower(coalesce("username", '')) LIKE 'sclqa%';
```

Owner toggles `isTest` in Supabase to exclude/restore a handle without a code
change. App still keeps handle-prefix + `PUBLIC_EXCLUDED_HANDLES` + QA-note
guards as belt-and-suspenders (`hasIsTestColumn()` soft-degrades until SQL runs).

## Play — extreme-odds operator review

```sql
ALTER TABLE "Play"
  ADD COLUMN IF NOT EXISTS "needsReview" BOOLEAN NOT NULL DEFAULT false;
```

Until this column exists, submit still accepts extreme prices; the review flag
is omitted from the write (soft-degrade via `hasNeedsReviewColumn()`).

## Policy documents — admin-managed legal copy

Run before deploying the admin policy editor. Public policy pages continue to
use bundled launch copy if these tables are unavailable, but editing and
revision history require them.

```sql
DO $$
BEGIN
  CREATE TYPE "PolicySlug" AS ENUM (
    'TERMS',
    'PRIVACY',
    'DISCLAIMER',
    'RESPONSIBLE_GAMING'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

CREATE TABLE IF NOT EXISTS "PolicyDocument" (
  "slug" "PolicySlug" NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PolicyDocument_pkey" PRIMARY KEY ("slug"),
  CONSTRAINT "PolicyDocument_updatedById_fkey"
    FOREIGN KEY ("updatedById") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "PolicyDocumentRevision" (
  "id" TEXT NOT NULL,
  "slug" "PolicySlug" NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "editedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PolicyDocumentRevision_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PolicyDocumentRevision_slug_fkey"
    FOREIGN KEY ("slug") REFERENCES "PolicyDocument"("slug")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PolicyDocumentRevision_editedById_fkey"
    FOREIGN KEY ("editedById") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "PolicyDocument_updatedById_idx"
  ON "PolicyDocument" ("updatedById");
CREATE INDEX IF NOT EXISTS "PolicyDocumentRevision_slug_createdAt_idx"
  ON "PolicyDocumentRevision" ("slug", "createdAt");
CREATE INDEX IF NOT EXISTS "PolicyDocumentRevision_editedById_idx"
  ON "PolicyDocumentRevision" ("editedById");
```

## Grading corrections — immutable settlement snapshots

Run before deploying the admin settled-play correction detail route. This
preserves the old and new profit calculation on straight-play audits and adds
one parent-level audit event for every parlay settlement or correction.

```sql
ALTER TABLE "GradingAudit"
  ADD COLUMN IF NOT EXISTS "previousProfitUnits" DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS "newProfitUnits" DECIMAL(10, 2);

CREATE TABLE IF NOT EXISTS "ParlayGradingAudit" (
  "id" TEXT NOT NULL,
  "parlayId" TEXT NOT NULL,
  "previousOutcome" "Outcome" NOT NULL,
  "newOutcome" "Outcome" NOT NULL,
  "previousProfitUnits" DECIMAL(10, 2),
  "newProfitUnits" DECIMAL(10, 2),
  "source" "GradingSource" NOT NULL,
  "gradedById" TEXT,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ParlayGradingAudit_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ParlayGradingAudit_parlayId_fkey"
    FOREIGN KEY ("parlayId") REFERENCES "Parlay"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ParlayGradingAudit_gradedById_fkey"
    FOREIGN KEY ("gradedById") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "ParlayGradingAudit_parlayId_createdAt_idx"
  ON "ParlayGradingAudit" ("parlayId", "createdAt");
CREATE INDEX IF NOT EXISTS "ParlayGradingAudit_gradedById_idx"
  ON "ParlayGradingAudit" ("gradedById");
```
