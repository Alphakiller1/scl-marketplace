-- SCL — AdminLoginChallenge (emailed second factor for ADMIN sign-in)
-- Run in Supabase SQL Editor BEFORE merge if migrate cannot apply first.
-- Touches `scl` only; public must stay unchanged.
--
-- Equivalent to prisma/migrations/20260725120000_admin_login_challenge.
-- Admin login breaks until this table exists, so apply it first.

CREATE TABLE IF NOT EXISTS "scl"."AdminLoginChallenge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expires" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminLoginChallenge_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AdminLoginChallenge_userId_idx"
  ON "scl"."AdminLoginChallenge"("userId");

CREATE INDEX IF NOT EXISTS "AdminLoginChallenge_expires_idx"
  ON "scl"."AdminLoginChallenge"("expires");

ALTER TABLE "scl"."AdminLoginChallenge"
DROP CONSTRAINT IF EXISTS "AdminLoginChallenge_userId_fkey";

ALTER TABLE "scl"."AdminLoginChallenge"
ADD CONSTRAINT "AdminLoginChallenge_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "scl"."User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
