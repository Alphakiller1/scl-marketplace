-- Allow multiple SCL accounts to share an email when usernames differ.
-- Login and account recovery identify users by email + username.
--
-- Production deploys failed when this ran as DROP INDEX only: on some Postgres
-- / Prisma histories the email uniqueness is a TABLE CONSTRAINT, not an index.
-- Be idempotent so a retried production deploy can finish cleanly.

ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_email_key";
DROP INDEX IF EXISTS "User_email_key";

-- Composite uniqueness. NULL usernames remain distinct under Postgres unique
-- index rules (multiple (email, NULL) rows are allowed).
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_username_key" ON "User"("email", "username");
