import assert from "node:assert/strict";
import test from "node:test";

import {
  inspectLegacyPackageIntegrity,
  reconcileLegacyPackageSource,
  type LegacyPackageIntegrityRow,
} from "@/lib/legacy-package-integrity";
import {
  legacyPackageSlug,
  type LegacyPackageInput,
} from "@/lib/schemas/legacy-packages.schema";

function sourcePackages(): LegacyPackageInput[] {
  return Array.from({ length: 122 }, (_, index) => {
    const bank = index === 0;
    const whop = index < 4;
    return {
      username: bank ? "bankofdennis" : `capper_${index}`,
      legacyRef: `AFF${String(index).padStart(4, "0")}`,
      title: bank ? "BANK OF DENNIS VIP 365 DAYS Plan" : `Package ${index}`,
      description: bank
        ? "This is a special 365-day VIP plan for $125 for the full year. Limited slots are available."
        : `Description ${index}`,
      priceCents: bank ? 12_500 : 2_500,
      billingPeriod: bank ? "ONE_TIME" : "WEEK",
      checkoutUrl: whop
        ? `https://whop.com/checkout/offer-${index}`
        : `https://winible.com/checkout/offer-${index}`,
      affiliateProvider: whop ? "WHOP" : "WINIBLE",
      sortOrder: index,
      isActive: true,
    };
  });
}

function databaseRows(
  source: LegacyPackageInput[],
): LegacyPackageIntegrityRow[] {
  return source.map((pkg, index) => ({
    id: `pkg-${index}`,
    userId: `user-${index}`,
    username: pkg.username,
    title: pkg.title,
    description: pkg.description ?? null,
    priceCents: pkg.priceCents,
    billingPeriod: pkg.billingPeriod,
    checkoutUrl: pkg.checkoutUrl,
    affiliateProvider: pkg.affiliateProvider ?? null,
    sortOrder: pkg.sortOrder,
    isActive: pkg.isActive,
    externalProductId: null,
    connectionStatus: null,
    trackingUrls: [
      {
        slug: legacyPackageSlug(pkg.username, pkg.legacyRef),
        targetUrl: pkg.checkoutUrl,
      },
    ],
  }));
}

test("a complete 122-offer source reconciles every persisted field", () => {
  const source = sourcePackages();
  const rows = databaseRows(source);

  assert.deepEqual(inspectLegacyPackageIntegrity(rows).errors, []);
  assert.deepEqual(reconcileLegacyPackageSource(source, rows), {
    errors: [],
    matched: 122,
  });
});

test("the production gate catches a missing Whop row and Bankofdennis regression", () => {
  const rows = databaseRows(sourcePackages()).filter(
    (row) => row.id !== "pkg-3",
  );
  rows[0] = { ...rows[0]!, priceCents: 10_000, billingPeriod: "MONTH" };

  const report = inspectLegacyPackageIntegrity(rows);
  assert.ok(
    report.errors.some((error) => error.includes("below the documented")),
  );
  assert.ok(report.errors.some((error) => error.includes("Whop count")));
  assert.ok(report.errors.some((error) => error.includes("expected 12500")));
  assert.ok(report.errors.some((error) => error.includes("expected ONE_TIME")));
});

test("source reconciliation catches silent tracking and price drift", () => {
  const source = sourcePackages();
  const rows = databaseRows(source);
  rows[20] = {
    ...rows[20]!,
    priceCents: 9_999,
    trackingUrls: [
      {
        ...rows[20]!.trackingUrls[0]!,
        targetUrl: "https://winible.com/checkout/wrong",
      },
    ],
  };

  const result = reconcileLegacyPackageSource(source, rows);
  assert.ok(
    result.errors.some((error) => error.includes("priceCents mismatch")),
  );
  assert.ok(
    result.errors.some((error) => error.includes("trackingTarget mismatch")),
  );
});
