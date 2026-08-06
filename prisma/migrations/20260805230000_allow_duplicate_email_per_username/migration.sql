-- Allow multiple SCL accounts to share an email when usernames differ.
-- Login and account recovery identify users by email + username.
-- Qualified to scl schema so this succeeds even when search_path drifts.
-- Drop both constraint and index forms — Prisma/Postgres history varies.

ALTER TABLE scl."User" DROP CONSTRAINT IF EXISTS "User_email_key";
DROP INDEX IF EXISTS scl."User_email_key";
DROP INDEX IF EXISTS "User_email_key";

CREATE UNIQUE INDEX IF NOT EXISTS "User_email_username_key"
  ON scl."User"("email", "username");
