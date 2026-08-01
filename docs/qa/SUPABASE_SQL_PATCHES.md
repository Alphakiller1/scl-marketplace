# Supabase SQL Patches — Owner Runbook

Run these in the **Supabase SQL Editor** (Production).  
Additive only. These are a **fallback**, not the primary path: `npm run build`
is `prisma migrate deploy && next build`, so Vercel already applies migrations
on deploy. Apply a patch here when a migration has not landed — or to make an
additive change without waiting for one.

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

## Storefront reviews — audited approval and suspension

Run before deploying the audited Store Setup workflow. This adds the last
human reviewer fields and preserves every approval, live transition, change
request, suspension, restoration, notes update, and package-readiness change.

```sql
DO $$
BEGIN
  CREATE TYPE "StorefrontReviewAction" AS ENUM (
    'APPROVED',
    'MARKED_LIVE',
    'CHANGES_REQUESTED',
    'SUSPENDED',
    'RESTORED',
    'NOTES_UPDATED',
    'PACKAGE_SYNC'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

ALTER TABLE "StoreConnection"
  ADD COLUMN IF NOT EXISTS "reviewedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "reviewedById" TEXT;

CREATE TABLE IF NOT EXISTS "StorefrontReviewEvent" (
  "id" TEXT NOT NULL,
  "storeConnectionId" TEXT NOT NULL,
  "action" "StorefrontReviewAction" NOT NULL,
  "previousStatus" "StoreConnectionStatus" NOT NULL,
  "newStatus" "StoreConnectionStatus" NOT NULL,
  "reviewedById" TEXT NOT NULL,
  "reason" TEXT,
  "adminNotes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StorefrontReviewEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StorefrontReviewEvent_storeConnectionId_fkey"
    FOREIGN KEY ("storeConnectionId") REFERENCES "StoreConnection"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "StorefrontReviewEvent_reviewedById_fkey"
    FOREIGN KEY ("reviewedById") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

DO $$
BEGIN
  ALTER TABLE "StoreConnection"
    ADD CONSTRAINT "StoreConnection_reviewedById_fkey"
    FOREIGN KEY ("reviewedById") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

CREATE INDEX IF NOT EXISTS "StoreConnection_reviewedById_idx"
  ON "StoreConnection"("reviewedById");
CREATE INDEX IF NOT EXISTS "StorefrontReviewEvent_storeConnectionId_createdAt_idx"
  ON "StorefrontReviewEvent"("storeConnectionId", "createdAt");
CREATE INDEX IF NOT EXISTS "StorefrontReviewEvent_reviewedById_idx"
  ON "StorefrontReviewEvent"("reviewedById");
```

## LegacyRecord — carried-over totals from the previous SCL platform

The old platform pruned individual picks on a rolling 90-day basis and kept only
summary totals beyond that. `LegacyRecord` stores those totals so a capper's
history still counts, while keeping them separable from pick-backed `Play` data.

`PRE_IMPORT` is the leaderboard baseline: the legacy season total **minus** the
plays that were imported as real `Play` rows. Adding it to computed stats
reproduces the legacy season total without double-counting the overlap.

```sql
SET search_path TO scl;

DO $$
BEGIN
  CREATE TYPE "LegacyRecordScope" AS ENUM (
    'PRE_IMPORT', 'CURRENT_SEASON', 'CURRENT_YEAR', 'YEAR_2025', 'SEASON_2025',
    'LAST_7D', 'LAST_30D', 'LAST_60D', 'LAST_90D'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

CREATE TABLE IF NOT EXISTS "LegacyRecord" (
  "id"          TEXT NOT NULL,
  "capperId"    TEXT NOT NULL,
  "scope"       "LegacyRecordScope" NOT NULL,
  "sport"       TEXT NOT NULL,
  "wins"        INTEGER NOT NULL DEFAULT 0,
  "losses"      INTEGER NOT NULL DEFAULT 0,
  "pushes"      INTEGER NOT NULL DEFAULT 0,
  "unitsRisked" DECIMAL(12,2) NOT NULL,
  "unitsNet"    DECIMAL(12,2) NOT NULL,
  "capturedAt"  TIMESTAMP(3) NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LegacyRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "LegacyRecord_scope_sport_idx"
  ON "LegacyRecord"("scope", "sport");
CREATE UNIQUE INDEX IF NOT EXISTS "LegacyRecord_capperId_scope_sport_key"
  ON "LegacyRecord"("capperId", "scope", "sport");

DO $$
BEGIN
  ALTER TABLE "LegacyRecord"
    ADD CONSTRAINT "LegacyRecord_capperId_fkey"
    FOREIGN KEY ("capperId") REFERENCES "CapperProfile"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;
```

## PackageAuditEvent — attribution for admin package changes

Storefront transitions are audited through `StorefrontReviewEvent`, but that
requires a `storeConnectionId` and records a status change. It cannot cover
package edits, and cannot cover packages with no connection at all — which is
every offer carried over from the previous platform. Package price, title and
visibility are revenue-affecting and publicly visible, so they need their own
trail.

`packageId` is nulled rather than cascaded on delete: an audit trail should
outlive the thing it describes.

```sql
SET search_path TO scl;

DO $$
BEGIN
  CREATE TYPE "PackageAuditAction" AS ENUM (
    'CREATED', 'UPDATED', 'ACTIVATED', 'DEACTIVATED', 'REORDERED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

CREATE TABLE IF NOT EXISTS "PackageAuditEvent" (
  "id"        TEXT NOT NULL,
  "packageId" TEXT,
  "capperId"  TEXT NOT NULL,
  "action"    "PackageAuditAction" NOT NULL,
  "actorId"   TEXT NOT NULL,
  "summary"   TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PackageAuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PackageAuditEvent_capperId_createdAt_idx"
  ON "PackageAuditEvent"("capperId", "createdAt");
CREATE INDEX IF NOT EXISTS "PackageAuditEvent_packageId_idx"
  ON "PackageAuditEvent"("packageId");
CREATE INDEX IF NOT EXISTS "PackageAuditEvent_actorId_idx"
  ON "PackageAuditEvent"("actorId");

DO $$
BEGIN
  ALTER TABLE "PackageAuditEvent"
    ADD CONSTRAINT "PackageAuditEvent_packageId_fkey"
    FOREIGN KEY ("packageId") REFERENCES "Package"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  ALTER TABLE "PackageAuditEvent"
    ADD CONSTRAINT "PackageAuditEvent_capperId_fkey"
    FOREIGN KEY ("capperId") REFERENCES "CapperProfile"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  ALTER TABLE "PackageAuditEvent"
    ADD CONSTRAINT "PackageAuditEvent_actorId_fkey"
    FOREIGN KEY ("actorId") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END
$$;
```
