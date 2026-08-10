-- Curate the verified Whop offers supplied by the SCL owner. Every destination
-- was opened before this migration; prices/cadences below match the checkout,
-- not inferred marketing copy. Re-running is safe.

-- Existing carried-over offers: correct their public copy and destinations.
UPDATE scl."Package" AS package
SET
  title = 'Super Picks 3-Day Free VIP Trial',
  description = 'Try Super Picks VIP free for three days. Unless canceled during the trial, access renews at $49.99 per month.',
  "promoOffer" = '3 days free, then $49.99/month',
  "priceCents" = 4999,
  "billingPeriod" = 'MONTH',
  "checkoutUrl" = 'https://whop.com/checkout/plan_WDBMS1kVzsn54?a=scleaderboard',
  "affiliateProvider" = 'WHOP',
  "providerType" = 'PREMIUM',
  "sortOrder" = 0,
  "isActive" = TRUE,
  "updatedAt" = CURRENT_TIMESTAMP
FROM scl."CapperProfile" AS capper
JOIN scl."User" AS owner ON owner.id = capper."userId"
WHERE package."capperId" = capper.id
  AND lower(owner.username) = 'superpicks1'
  AND (
    package."checkoutUrl" LIKE '%plan_WDBMS1kVzsn54%'
    OR lower(package.title) = lower('3 Free Days of VIP')
  );

UPDATE scl."Package" AS package
SET
  title = 'Super Picks Single-Day VIP',
  description = 'Get one full day of Super Picks VIP access and premium picks.',
  "promoOffer" = NULL,
  "priceCents" = 1499,
  "billingPeriod" = 'ONE_TIME',
  "checkoutUrl" = 'https://whop.com/checkout/plan_sujbuYWnK69Cw?a=scleaderboard',
  "affiliateProvider" = 'WHOP',
  "providerType" = 'PREMIUM',
  "sortOrder" = 2,
  "isActive" = TRUE,
  "updatedAt" = CURRENT_TIMESTAMP
FROM scl."CapperProfile" AS capper
JOIN scl."User" AS owner ON owner.id = capper."userId"
WHERE package."capperId" = capper.id
  AND lower(owner.username) = 'superpicks1'
  AND (
    package."checkoutUrl" LIKE '%best-sports-picks-best-price%'
    OR package."checkoutUrl" LIKE '%plan_sujbuYWnK69Cw%'
    OR lower(package.title) = lower('Single Day of VIP')
  );

UPDATE scl."Package" AS package
SET
  title = 'Bankroll Blueprint Weekly VIP',
  description = 'Get seven days of Bankroll Blueprint exclusive VIP picks and member access.',
  "promoOffer" = NULL,
  "priceCents" = 19900,
  "billingPeriod" = 'WEEK',
  "checkoutUrl" = 'https://whop.com/the-bankroll-blueprint-2f72/bankroll-blueprint-exclusive?a=scleaderboard',
  "affiliateProvider" = 'WHOP',
  "providerType" = 'PREMIUM',
  "sortOrder" = 0,
  "isActive" = TRUE,
  "updatedAt" = CURRENT_TIMESTAMP
FROM scl."CapperProfile" AS capper
JOIN scl."User" AS owner ON owner.id = capper."userId"
WHERE package."capperId" = capper.id
  AND lower(owner.username) = 'bblueprints'
  AND (
    package."checkoutUrl" LIKE '%the-bankroll-blueprint-2f72%'
    OR lower(package.title) = lower('🔥 Bankroll Blueprint Exclusive')
  );

UPDATE scl."Package" AS package
SET
  title = 'Super Picks Monthly VIP',
  description = 'Get a full month of Super Picks VIP access and premium picks.',
  "promoOffer" = NULL,
  "priceCents" = 3999,
  "billingPeriod" = 'MONTH',
  "checkoutUrl" = 'https://whop.com/checkout/plan_XQPxDbBRLRKM3?a=scleaderboard',
  "affiliateProvider" = 'WHOP',
  "providerType" = 'PREMIUM',
  "sortOrder" = 1,
  "isActive" = TRUE,
  "updatedAt" = CURRENT_TIMESTAMP
FROM scl."CapperProfile" AS capper
JOIN scl."User" AS owner ON owner.id = capper."userId"
WHERE package."capperId" = capper.id
  AND lower(owner.username) = 'superpicks1'
  AND (
    package."checkoutUrl" LIKE '%plan_XQPxDbBRLRKM3%'
    OR lower(package.title) = lower('Super Picks Monthly VIP')
  );

UPDATE scl."Package" AS package
SET
  title = 'Inevitable Picks Weekly VIP',
  description = 'Get seven days of Inevitable Picks VIP access and premium selections.',
  "promoOffer" = NULL,
  "priceCents" = 1499,
  "billingPeriod" = 'WEEK',
  "checkoutUrl" = 'https://whop.com/checkout/plan_L2zzDCtIjiSIE?a=scleaderboard',
  "affiliateProvider" = 'WHOP',
  "providerType" = 'PREMIUM',
  "sortOrder" = 0,
  "isActive" = TRUE,
  "updatedAt" = CURRENT_TIMESTAMP
FROM scl."CapperProfile" AS capper
JOIN scl."User" AS owner ON owner.id = capper."userId"
WHERE package."capperId" = capper.id
  AND lower(owner.username) = 'inevitablepicks'
  AND (
    package."checkoutUrl" LIKE '%plan_L2zzDCtIjiSIE%'
    OR lower(package.title) = lower('Inevitable Picks Weekly VIP')
  );

-- New curated offers. The fixed ids make these inserts idempotent.
INSERT INTO scl."Package" (
  id, "capperId", title, description, "promoOffer", "priceCents",
  "billingPeriod", "checkoutUrl", "affiliateProvider", "providerType",
  "sortOrder", "isActive", "createdAt", "updatedAt"
)
SELECT
  'migration-20260810-superpicks-monthly',
  capper.id,
  'Super Picks Monthly VIP',
  'Get a full month of Super Picks VIP access and premium picks.',
  NULL,
  3999,
  'MONTH',
  'https://whop.com/checkout/plan_XQPxDbBRLRKM3?a=scleaderboard',
  'WHOP',
  'PREMIUM',
  1,
  TRUE,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM scl."CapperProfile" AS capper
JOIN scl."User" AS owner ON owner.id = capper."userId"
WHERE lower(owner.username) = 'superpicks1'
  AND NOT EXISTS (
    SELECT 1
    FROM scl."Package" AS existing
    WHERE existing."capperId" = capper.id
      AND existing."checkoutUrl" LIKE '%plan_XQPxDbBRLRKM3%'
  );

INSERT INTO scl."Package" (
  id, "capperId", title, description, "promoOffer", "priceCents",
  "billingPeriod", "checkoutUrl", "affiliateProvider", "providerType",
  "sortOrder", "isActive", "createdAt", "updatedAt"
)
SELECT
  'migration-20260810-inevitable-weekly',
  capper.id,
  'Inevitable Picks Weekly VIP',
  'Get seven days of Inevitable Picks VIP access and premium selections.',
  NULL,
  1499,
  'WEEK',
  'https://whop.com/checkout/plan_L2zzDCtIjiSIE?a=scleaderboard',
  'WHOP',
  'PREMIUM',
  0,
  TRUE,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM scl."CapperProfile" AS capper
JOIN scl."User" AS owner ON owner.id = capper."userId"
WHERE lower(owner.username) = 'inevitablepicks'
  AND NOT EXISTS (
    SELECT 1
    FROM scl."Package" AS existing
    WHERE existing."capperId" = capper.id
      AND existing."checkoutUrl" LIKE '%plan_L2zzDCtIjiSIE%'
  );

-- Keep existing SCL tracking redirects aligned with the corrected destinations.
UPDATE scl."TrackingUrl" AS tracking
SET "targetUrl" = package."checkoutUrl"
FROM scl."Package" AS package
JOIN scl."CapperProfile" AS capper ON capper.id = package."capperId"
JOIN scl."User" AS owner ON owner.id = capper."userId"
WHERE tracking."packageId" = package.id
  AND lower(owner.username) IN ('superpicks1', 'bblueprints', 'inevitablepicks')
  AND package."affiliateProvider" = 'WHOP';

INSERT INTO scl."TrackingUrl" (id, "packageId", slug, "targetUrl", "createdAt")
SELECT
  'migration-20260810-superpicks-trial-tracking',
  package.id,
  'superpicks1-curated-trial-vip',
  package."checkoutUrl",
  CURRENT_TIMESTAMP
FROM scl."Package" AS package
JOIN scl."CapperProfile" AS capper ON capper.id = package."capperId"
JOIN scl."User" AS owner ON owner.id = capper."userId"
WHERE lower(owner.username) = 'superpicks1'
  AND package."checkoutUrl" LIKE '%plan_WDBMS1kVzsn54%'
  AND NOT EXISTS (
    SELECT 1 FROM scl."TrackingUrl" AS tracking WHERE tracking."packageId" = package.id
  )
ON CONFLICT (slug) DO NOTHING;

INSERT INTO scl."TrackingUrl" (id, "packageId", slug, "targetUrl", "createdAt")
SELECT
  'migration-20260810-superpicks-day-tracking',
  package.id,
  'superpicks1-curated-single-day-vip',
  package."checkoutUrl",
  CURRENT_TIMESTAMP
FROM scl."Package" AS package
JOIN scl."CapperProfile" AS capper ON capper.id = package."capperId"
JOIN scl."User" AS owner ON owner.id = capper."userId"
WHERE lower(owner.username) = 'superpicks1'
  AND package."checkoutUrl" LIKE '%plan_sujbuYWnK69Cw%'
  AND NOT EXISTS (
    SELECT 1 FROM scl."TrackingUrl" AS tracking WHERE tracking."packageId" = package.id
  )
ON CONFLICT (slug) DO NOTHING;

INSERT INTO scl."TrackingUrl" (id, "packageId", slug, "targetUrl", "createdAt")
SELECT
  'migration-20260810-bankroll-weekly-tracking',
  package.id,
  'bblueprints-curated-weekly-vip',
  package."checkoutUrl",
  CURRENT_TIMESTAMP
FROM scl."Package" AS package
JOIN scl."CapperProfile" AS capper ON capper.id = package."capperId"
JOIN scl."User" AS owner ON owner.id = capper."userId"
WHERE lower(owner.username) = 'bblueprints'
  AND package."checkoutUrl" LIKE '%bankroll-blueprint-exclusive%'
  AND NOT EXISTS (
    SELECT 1 FROM scl."TrackingUrl" AS tracking WHERE tracking."packageId" = package.id
  )
ON CONFLICT (slug) DO NOTHING;

INSERT INTO scl."TrackingUrl" (id, "packageId", slug, "targetUrl", "createdAt")
SELECT
  'migration-20260810-superpicks-monthly-tracking',
  package.id,
  'superpicks1-curated-monthly-vip',
  package."checkoutUrl",
  CURRENT_TIMESTAMP
FROM scl."Package" AS package
JOIN scl."CapperProfile" AS capper ON capper.id = package."capperId"
JOIN scl."User" AS owner ON owner.id = capper."userId"
WHERE lower(owner.username) = 'superpicks1'
  AND package."checkoutUrl" LIKE '%plan_XQPxDbBRLRKM3%'
  AND NOT EXISTS (
    SELECT 1 FROM scl."TrackingUrl" AS tracking WHERE tracking."packageId" = package.id
  )
ON CONFLICT (slug) DO NOTHING;

-- Attribute corrections to existing offers without changing lineage counts.
INSERT INTO scl."PackageAuditEvent" (
  id, "packageId", "capperId", action, "actorId", summary, "createdAt"
)
SELECT
  'migration-20260810-curated-update-' || substr(md5(package.id), 1, 20),
  package.id,
  package."capperId",
  'UPDATED',
  actor.id,
  'Verified Whop price, cadence, description, and affiliate checkout destination',
  CURRENT_TIMESTAMP
FROM scl."Package" AS package
JOIN scl."CapperProfile" AS capper ON capper.id = package."capperId"
JOIN scl."User" AS owner ON owner.id = capper."userId"
CROSS JOIN LATERAL (
  SELECT admin.id
  FROM scl."User" AS admin
  WHERE admin.role = 'ADMIN' AND admin."accountStatus" = 'ACTIVE'
  ORDER BY admin."createdAt" ASC, admin.id ASC
  LIMIT 1
) AS actor
WHERE (
    lower(owner.username) = 'superpicks1'
    AND package."checkoutUrl" LIKE ANY (ARRAY['%plan_WDBMS1kVzsn54%', '%plan_sujbuYWnK69Cw%'])
  )
  OR (
    lower(owner.username) = 'bblueprints'
    AND package."checkoutUrl" LIKE '%bankroll-blueprint-exclusive%'
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO scl."TrackingUrl" (id, "packageId", slug, "targetUrl", "createdAt")
SELECT
  'migration-20260810-inevitable-weekly-tracking',
  package.id,
  'inevitablepicks-curated-weekly-vip',
  package."checkoutUrl",
  CURRENT_TIMESTAMP
FROM scl."Package" AS package
JOIN scl."CapperProfile" AS capper ON capper.id = package."capperId"
JOIN scl."User" AS owner ON owner.id = capper."userId"
WHERE lower(owner.username) = 'inevitablepicks'
  AND package."checkoutUrl" LIKE '%plan_L2zzDCtIjiSIE%'
  AND NOT EXISTS (
    SELECT 1 FROM scl."TrackingUrl" AS tracking WHERE tracking."packageId" = package.id
  )
ON CONFLICT (slug) DO NOTHING;

-- Attribute the two new revenue-bearing offers to the oldest active admin.
INSERT INTO scl."PackageAuditEvent" (
  id, "packageId", "capperId", action, "actorId", summary, "createdAt"
)
SELECT
  'migration-20260810-superpicks-monthly-audit',
  package.id,
  package."capperId",
  'CREATED',
  actor.id,
  'Added verified Super Picks Monthly VIP checkout - $39.99/month',
  CURRENT_TIMESTAMP
FROM scl."Package" AS package
CROSS JOIN LATERAL (
  SELECT admin.id
  FROM scl."User" AS admin
  WHERE admin.role = 'ADMIN' AND admin."accountStatus" = 'ACTIVE'
  ORDER BY admin."createdAt" ASC, admin.id ASC
  LIMIT 1
) AS actor
WHERE package.id = 'migration-20260810-superpicks-monthly'
ON CONFLICT (id) DO NOTHING;

INSERT INTO scl."PackageAuditEvent" (
  id, "packageId", "capperId", action, "actorId", summary, "createdAt"
)
SELECT
  'migration-20260810-inevitable-weekly-audit',
  package.id,
  package."capperId",
  'CREATED',
  actor.id,
  'Added verified Inevitable Picks Weekly VIP checkout - $14.99/week',
  CURRENT_TIMESTAMP
FROM scl."Package" AS package
CROSS JOIN LATERAL (
  SELECT admin.id
  FROM scl."User" AS admin
  WHERE admin.role = 'ADMIN' AND admin."accountStatus" = 'ACTIVE'
  ORDER BY admin."createdAt" ASC, admin.id ASC
  LIMIT 1
) AS actor
WHERE package.id = 'migration-20260810-inevitable-weekly'
ON CONFLICT (id) DO NOTHING;
