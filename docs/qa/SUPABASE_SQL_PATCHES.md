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
