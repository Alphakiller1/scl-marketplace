-- A capper can type a stake up to 100,000,000 units. Widen the stake and
-- derived-profit columns together so validation cannot admit a value that the
-- database or a later grading audit cannot persist.
ALTER TABLE scl."Play"
  ALTER COLUMN "units" TYPE DECIMAL(16,2),
  ALTER COLUMN "profitUnits" TYPE DECIMAL(16,2);

ALTER TABLE scl."Parlay"
  ALTER COLUMN "units" TYPE DECIMAL(16,2),
  ALTER COLUMN "profitUnits" TYPE DECIMAL(16,2);

ALTER TABLE scl."GradingAudit"
  ALTER COLUMN "previousProfitUnits" TYPE DECIMAL(16,2),
  ALTER COLUMN "newProfitUnits" TYPE DECIMAL(16,2);

ALTER TABLE scl."ParlayGradingAudit"
  ALTER COLUMN "previousProfitUnits" TYPE DECIMAL(16,2),
  ALTER COLUMN "newProfitUnits" TYPE DECIMAL(16,2);

-- The carried-over row encoded the first number found in its old copy ($100)
-- and defaulted its cadence to MONTH. The actual offer is one $125 payment for
-- 365 days. Match by owner + exact offer identity so no other package changes.
UPDATE scl."Package" AS package
SET
  "priceCents" = 12500,
  "billingPeriod" = 'ONE_TIME',
  "description" = 'This is a special 365-day VIP plan for $125 for the full year. Limited slots are available.'
FROM scl."CapperProfile" AS capper
JOIN scl."User" AS owner ON owner.id = capper."userId"
WHERE package."capperId" = capper.id
  AND lower(owner.username) = 'bankofdennis'
  AND lower(package.title) = lower('BANK OF DENNIS VIP 365 DAYS Plan');

-- Attribute the corrective data change to the oldest active owner account.
-- Fresh/local databases without an admin simply have no matching row and skip
-- the audit insert; production always has an owner.
INSERT INTO scl."PackageAuditEvent" (
  id,
  "packageId",
  "capperId",
  action,
  "actorId",
  summary,
  "createdAt"
)
SELECT
  'migration-20260809-bankofdennis-365-price',
  package.id,
  package."capperId",
  'UPDATED'::scl."PackageAuditAction",
  actor.id,
  'Corrected 365-day package from $100 / month to $125 one time',
  CURRENT_TIMESTAMP
FROM scl."Package" AS package
JOIN scl."CapperProfile" AS capper ON capper.id = package."capperId"
JOIN scl."User" AS owner ON owner.id = capper."userId"
CROSS JOIN LATERAL (
  SELECT admin.id
  FROM scl."User" AS admin
  WHERE admin.role = 'ADMIN'
    AND admin."accountStatus" = 'ACTIVE'
  ORDER BY admin."createdAt" ASC, admin.id ASC
  LIMIT 1
) AS actor
WHERE lower(owner.username) = 'bankofdennis'
  AND lower(package.title) = lower('BANK OF DENNIS VIP 365 DAYS Plan')
ON CONFLICT (id) DO NOTHING;
