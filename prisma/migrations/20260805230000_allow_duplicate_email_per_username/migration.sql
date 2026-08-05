-- Allow multiple SCL accounts to share an email when usernames differ.
-- Login and account recovery identify users by email + username.

DROP INDEX IF EXISTS "User_email_key";

CREATE UNIQUE INDEX "User_email_username_key" ON "User"("email", "username");
