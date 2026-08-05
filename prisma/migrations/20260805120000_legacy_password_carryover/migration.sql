-- Let accounts carried over from the previous platform sign in with the password
-- they already had. The imported credential is verified once, re-hashed with
-- bcrypt into "passwordHash", and then cleared — so these columns drain to NULL
-- as cappers return. All nullable: existing rows stay valid and unaffected.
--
-- IF NOT EXISTS is deliberate. docs/qa/SUPABASE_SQL_PATCHES.md tells the owner to
-- apply additive SQL by hand in the Supabase editor when a deploy hasn't landed
-- yet. Without these guards, a hand-patched column makes this migration fail with
-- 42701 on the next production deploy — and one failed migration blocks every
-- migration after it until someone runs `prisma migrate resolve` against
-- production. Idempotent means either order is safe.
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "legacyPasswordHash" TEXT,
  ADD COLUMN IF NOT EXISTS "legacyPasswordFormat" TEXT,
  -- A legacy password that predates the current requirements never blocks the
  -- sign-in; it flags the account so the app can prompt for an update.
  ADD COLUMN IF NOT EXISTS "passwordUpdateRequiredAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "passwordNoticeSentAt" TIMESTAMP(3);
