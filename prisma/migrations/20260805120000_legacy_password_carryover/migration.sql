-- Let accounts carried over from the previous platform sign in with the password
-- they already had. The imported credential is verified once, re-hashed with
-- bcrypt into "passwordHash", and then cleared — so these columns drain to NULL
-- as cappers return. All nullable: existing rows stay valid and unaffected.
ALTER TABLE "User"
  ADD COLUMN "legacyPasswordHash" TEXT,
  ADD COLUMN "legacyPasswordFormat" TEXT,
  -- A legacy password that predates the current requirements never blocks the
  -- sign-in; it flags the account so the app can prompt for an update.
  ADD COLUMN "passwordUpdateRequiredAt" TIMESTAMP(3),
  ADD COLUMN "passwordNoticeSentAt" TIMESTAMP(3);
