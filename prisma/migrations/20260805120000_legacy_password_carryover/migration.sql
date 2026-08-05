-- Let accounts carried over from the previous platform sign in with the password
-- they already had. The imported credential is verified once, re-hashed with
-- bcrypt into "passwordHash", and then cleared — so these columns drain to NULL
-- as cappers return. All nullable: existing rows stay valid and unaffected.
--
-- Written to be safely re-runnable, for two reasons that both bit in practice:
--
--   1. docs/qa/SUPABASE_SQL_PATCHES.md tells the owner to apply additive SQL by
--      hand when a deploy hasn't landed yet. Without IF NOT EXISTS, a
--      hand-patched column fails this migration with 42701.
--   2. ALTER TABLE takes an ACCESS EXCLUSIVE lock *before* it evaluates
--      IF NOT EXISTS, so even a no-op re-apply queues behind live traffic on
--      "User" — and on the production deploy it sat there until the statement
--      timeout killed it (57014). The catalog check below means an
--      already-applied migration touches no lock at all.
--
-- Either failure leaves Prisma with a failed migration, which blocks *every*
-- later migration until someone resolves it by hand against production.
DO $$
BEGIN
  IF (
    SELECT count(*) FROM pg_attribute
    WHERE attrelid = '"User"'::regclass
      AND NOT attisdropped
      AND attname IN (
        'legacyPasswordHash',
        'legacyPasswordFormat',
        'passwordUpdateRequiredAt',
        'passwordNoticeSentAt'
      )
  ) < 4 THEN
    -- Fail fast and legibly if the table is busy, rather than hanging until the
    -- statement timeout reports a less specific error.
    PERFORM set_config('lock_timeout', '10s', true);

    ALTER TABLE "User"
      ADD COLUMN IF NOT EXISTS "legacyPasswordHash" TEXT,
      ADD COLUMN IF NOT EXISTS "legacyPasswordFormat" TEXT,
      -- A legacy password that predates the current requirements never blocks
      -- the sign-in; it flags the account so the app can prompt for an update.
      ADD COLUMN IF NOT EXISTS "passwordUpdateRequiredAt" TIMESTAMP(3),
      ADD COLUMN IF NOT EXISTS "passwordNoticeSentAt" TIMESTAMP(3);
  END IF;
END
$$;
