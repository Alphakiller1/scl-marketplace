import assert from "node:assert/strict";
import test from "node:test";

import {
  inspectLegacyPackageLineage,
  inspectLegacyPackageIntegrity,
  LEGACY_WHOP_EXPECTATIONS,
  reconcileLegacyPackageSource,
  type LegacyPackageIntegrityRow,
} from "@/lib/legacy-package-integrity";
import {
  legacyPackageSlug,
  type LegacyPackageInput,
} from "@/lib/schemas/legacy-packages.schema";

function sourcePackages(): LegacyPackageInput[] {
  return Array.from({ length: 122 }, (_, index) => {
    const whop = LEGACY_WHOP_EXPECTATIONS[index];
    const bank = index === LEGACY_WHOP_EXPECTATIONS.length;
    return {
      username: whop?.username ?? (bank ? "bankofdennis" : `capper_${index}`),
      legacyRef: `AFF${String(index).padStart(4, "0")}`,
      title:
        whop?.title ??
        (bank ? "BANK OF DENNIS VIP 365 DAYS Plan" : `Package ${index}`),
      description: bank
        ? "This is a special 365-day VIP plan for $125 for the full year. Limited slots are available."
        : `Description ${index}`,
      priceCents: bank ? 12_500 : 2_500,
      billingPeriod: bank ? "ONE_TIME" : "WEEK",
      checkoutUrl: whop
        ? whop.checkoutUrl
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

test("the production gate catches a replaced Whop identity and Bankofdennis regression", () => {
  const rows = databaseRows(sourcePackages());
  rows[2] = {
    ...rows[2]!,
    username: "replacement_capper",
    title: "Replacement Whop",
    checkoutUrl: "https://whop.com/replacement",
    trackingUrls: [
      {
        ...rows[2]!.trackingUrls[0]!,
        targetUrl: "https://whop.com/replacement",
      },
    ],
  };
  const bankIndex = LEGACY_WHOP_EXPECTATIONS.length;
  rows[bankIndex] = {
    ...rows[bankIndex]!,
    priceCents: 10_000,
    billingPeriod: "MONTH",
  };

  const report = inspectLegacyPackageIntegrity(rows);
  assert.ok(
    report.errors.some((error) =>
      error.includes("expected exactly one migrated legacy Whop package"),
    ),
  );
  assert.ok(report.errors.some((error) => error.includes("expected 12500")));
  assert.ok(
    report.errors.some((error) => error.includes("expected ONE_TIME or YEAR")),
  );
});

test("the production gate accepts $125 as a yearly full-year package", () => {
  const rows = databaseRows(sourcePackages());
  const bankIndex = LEGACY_WHOP_EXPECTATIONS.length;
  rows[bankIndex] = {
    ...rows[bankIndex]!,
    billingPeriod: "YEAR",
  };

  assert.deepEqual(inspectLegacyPackageIntegrity(rows).errors, []);
});

test("the production gate catches Whop URL drift even when tracking matches it", () => {
  const rows = databaseRows(sourcePackages());
  rows[0] = {
    ...rows[0]!,
    checkoutUrl: "https://whop.com/wrong-offer",
    trackingUrls: [
      {
        ...rows[0]!.trackingUrls[0]!,
        targetUrl: "https://whop.com/wrong-offer",
      },
    ],
  };

  assert.ok(
    inspectLegacyPackageIntegrity(rows).errors.some((error) =>
      error.includes("checkout URL does not match migration source"),
    ),
  );
});

test("the production gate accepts a public handle rename when the Whop offer is unchanged", () => {
  const rows = databaseRows(sourcePackages());
  rows[0] = {
    ...rows[0]!,
    username: "bankroll_blueprints",
  };

  assert.deepEqual(inspectLegacyPackageIntegrity(rows).errors, []);
});

test("package lineage proves the source total plus audited lifecycle changes", () => {
  const events = [
    { action: "CREATED" },
    { action: "CREATED" },
    { action: "CREATED" },
    { action: "CREATED" },
    { action: "DELETED" },
    { action: "UPDATED" },
  ];

  assert.deepEqual(inspectLegacyPackageLineage(125, events), {
    sourceTotal: 122,
    created: 4,
    deleted: 1,
    expectedTotal: 125,
    currentTotal: 125,
    errors: [],
  });
  assert.ok(
    inspectLegacyPackageLineage(124, events).errors.some((error) =>
      error.includes("lineage mismatch"),
    ),
  );
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
