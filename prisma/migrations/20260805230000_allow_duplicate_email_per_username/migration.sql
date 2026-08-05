-- Allow multiple SCL accounts to share an email when usernames differ.
-- Login and account recovery identify users by email + username.
-- Qualified to scl schema so this succeeds even when search_path drifts.

DROP INDEX IF EXISTS scl."User_email_key";

CREATE UNIQUE INDEX IF NOT EXISTS "User_email_username_key"
  ON scl."User"("email", "username");
