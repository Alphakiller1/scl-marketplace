-- One account per email address, case-insensitive.
--
-- Signup only ever looked itself up by USERNAME, and the table's only uniqueness
-- is the composite @@unique([email, username]) -- so one address opened as many
-- accounts as it had spare handles. Four addresses in production did exactly
-- that before the rule existed.
--
-- PARTIAL on purpose. The owner's instruction was to leave those accounts alone,
-- so the extra rows are grandfathered OUT of the index and keep working: they
-- can sign in, reset a password, be suspended, be graded.
--
-- What matters is that every duplicated address still keeps exactly ONE row
-- INSIDE the index. That is what makes the address occupied, so a NEW signup on
-- georgenewyork41@gmail.com collides like any other. Excluding all three copies
-- would have left the address free to be taken a fourth time.
--
-- The row kept in the index per address is the one that should own it: verified
-- first, then has-a-password, then ACTIVE over PENDING, then oldest.
--
-- Do NOT extend this id list to resolve a future conflict. A new conflict means
-- the rule is working; adding the id would switch it back off for that address.
--
-- Prisma cannot express a partial index in schema.prisma, so it is not in the
-- schema and `prisma db push` would drop it as drift. It is idempotent -- re-run
-- this file after any push against a database that needs it.

CREATE UNIQUE INDEX IF NOT EXISTS "User_email_lower_key"
  ON scl."User" (lower(email))
  WHERE id NOT IN (
    'cmtbif2rj0000lh045a779kgq', -- apfrmda7          (angelpotorreal47@gmail.com)
    'cmssir4hf0000l104kbtxkl2g', -- pixqmssiqf65c     (chase4sichi+sclmssiqf65a@gmail.com)
    'cmsuk4z430000jo043bxq2gfq', -- bankrollboosters  (f22sliverfn@gmail.com)
    'cmspicrft0000js04k154zpfn', -- geo922            (georgenewyork41@gmail.com)
    'cmt6n35u20000l804orm8bump'  -- hiddenlinesvip1   (georgenewyork41@gmail.com)
  );

COMMENT ON INDEX scl."User_email_lower_key" IS
  'One account per email, case-insensitive. Partial: the five listed ids are accounts that already shared an address before the rule existed and are deliberately grandfathered in. Each duplicated address still keeps exactly ONE row inside the index, so a NEW signup on those addresses collides like any other. Do not add ids here to resolve a future conflict.';
