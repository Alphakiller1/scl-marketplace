-- Idempotent scl-qualified follow-up when search_path or a failed first attempt
-- left production without the composite index.

DROP INDEX IF EXISTS scl."User_email_key";

CREATE UNIQUE INDEX IF NOT EXISTS "User_email_username_key"
  ON scl."User"("email", "username");
