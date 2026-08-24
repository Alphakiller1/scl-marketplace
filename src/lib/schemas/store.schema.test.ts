import assert from "node:assert/strict";
import test from "node:test";

import {
  adminPackageSchema,
  adminUpdateStoreConnectionSchema,
  capperWhopPackageUpdateSchema,
} from "@/lib/schemas/store.schema";
import {
  isWinibleCreatorReferralUrl,
  WINIBLE_CAPPER_REFERRAL_URL,
} from "@/lib/store-connection";

test("the supplied Winible creator referral link is accepted for onboarding", () => {
  assert.equal(
    WINIBLE_CAPPER_REFERRAL_URL,
    "https://winible.com/refer/usergif4lfuf?utm_source=1332059342148489371&utm_medium=winible_referral",
  );
  assert.equal(isWinibleCreatorReferralUrl(WINIBLE_CAPPER_REFERRAL_URL), true);
  assert.equal(
    isWinibleCreatorReferralUrl("https://winible.com/store/capper/packages"),
    false,
  );
});

test("creator referral links cannot be saved as customer package checkout URLs", () => {
  const basePackage = {
    capperId: "capper_1",
    affiliateProvider: "WINIBLE" as const,
    title: "Premium picks",
    priceCents: 4999,
    billingPeriod: "MONTH" as const,
    sortOrder: 0,
    isActive: false,
  };

  assert.equal(
    adminPackageSchema.safeParse({
      ...basePackage,
      checkoutUrl: WINIBLE_CAPPER_REFERRAL_URL,
    }).success,
    false,
  );
  assert.equal(
    adminPackageSchema.safeParse({
      ...basePackage,
      checkoutUrl: "https://winible.com/capper/premium-package",
    }).success,
    true,
  );
});

test("storefront suspension requires a reason and stale-status guard", () => {
  assert.equal(
    adminUpdateStoreConnectionSchema.safeParse({
      connectionId: "store_1",
      action: "SUSPEND",
      expectedStatus: "LIVE",
      expectedUpdatedAt: "2026-07-26T12:00:00.000Z",
      reason: "bad",
    }).success,
    false,
  );
  assert.equal(
    adminUpdateStoreConnectionSchema.safeParse({
      connectionId: "store_1",
      action: "SUSPEND",
      expectedStatus: "LIVE",
      expectedUpdatedAt: "2026-07-26T12:00:00.000Z",
      reason: "Affiliate relationship ended",
    }).success,
    true,
  );
});

test("capper Whop edits accept only safe presentation fields", () => {
  const valid = capperWhopPackageUpdateSchema.safeParse({
    packageId: "pkg_1",
    expectedUpdatedAt: "2026-08-24T22:00:00.000Z",
    title: "Premium picks",
    description: "Daily researched selections",
    isActive: true,
  });
  assert.equal(valid.success, true);

  const withProviderOwnedPrice = capperWhopPackageUpdateSchema.safeParse({
    packageId: "pkg_1",
    expectedUpdatedAt: "2026-08-24T22:00:00.000Z",
    title: "Premium picks",
    description: "Daily researched selections",
    isActive: true,
    priceCents: 1,
  });
  assert.equal(withProviderOwnedPrice.success, true);
  assert.equal(
    withProviderOwnedPrice.success &&
      "priceCents" in withProviderOwnedPrice.data,
    false,
  );

  assert.equal(
    capperWhopPackageUpdateSchema.safeParse({
      packageId: "pkg_1",
      expectedUpdatedAt: "2026-08-24T22:00:00.000Z",
      title: "x".repeat(81),
      description: "Too long for Whop's product title limit",
      isActive: true,
    }).success,
    false,
  );
});
