-- Records a package deletion in the audit trail.
--
-- `PackageAuditEvent.packageId` is nullable with ON DELETE SET NULL precisely so
-- the audit row outlives the package it describes, but there was no action value
-- to write into it — an admin deleting a package would have failed on the enum.
--
-- IF NOT EXISTS keeps this idempotent against the prod database, where the value
-- may already have been added by hand via docs/qa/SUPABASE_SQL_PATCHES.md.
ALTER TYPE scl."PackageAuditAction" ADD VALUE IF NOT EXISTS 'DELETED';
