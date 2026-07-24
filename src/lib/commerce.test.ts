import assert from "node:assert/strict";
import test from "node:test";

import {
  deriveStorefrontStatus,
  formatPackagePrice,
  packageTrackingSlug,
} from "@/lib/commerce";
import { adminPackageUpsertSchema } from "@/lib/schemas/admin-package.schema";

test("formatPackagePrice renders common billing periods", () => {
  assert.equal(formatPackagePrice(2999, "MONTH"), "$29.99/mo");
  assert.equal(formatPackagePrice(5000, "ONE_TIME"), "$50");
});

test("packageTrackingSlug normalizes handle and package id", () => {
  assert.equal(
    packageTrackingSlug("@Chase_HQ", "clxyz1234567890"),
    "chase-hq-34567890",
  );
});

test("deriveStorefrontStatus promotes approved storefronts with live packages", () => {
  assert.equal(
    deriveStorefrontStatus({
      current: "APPROVED",
      livePackageCount: 2,
    }),
    "STOREFRONT_LIVE",
  );
  assert.equal(
    deriveStorefrontStatus({
      current: "NEEDS_ATTENTION",
      livePackageCount: 2,
    }),
    "NEEDS_ATTENTION",
  );
});

test("admin package schema accepts live checkout links", () => {
  const parsed = adminPackageUpsertSchema.parse({
    capperProfileId: "profile_1",
    title: "Weekly Card",
    priceCents: 4900,
    billingPeriod: "WEEK",
    checkoutUrl: "https://winible.com/checkout/abc",
    displayOrder: 1,
    visibility: "LIVE",
  });
  assert.equal(parsed.visibility, "LIVE");
});
