import type { PrismaClient } from "@prisma/client";

import type { LegacyPackageInput } from "@/lib/schemas/legacy-packages.schema";
import { legacyPackageSlug } from "@/lib/schemas/legacy-packages.schema";

export const LEGACY_SOURCE_OFFER_COUNT = 122;
export const LEGACY_WHOP_OFFER_FLOOR = 4;

export type LegacyPackageIntegrityRow = {
  id: string;
  userId: string;
  username: string | null;
  title: string;
  description: string | null;
  priceCents: number;
  billingPeriod: string;
  checkoutUrl: string | null;
  affiliateProvider: string | null;
  sortOrder: number;
  isActive: boolean;
  externalProductId: string | null;
  connectionStatus: string | null;
  trackingUrls: { slug: string; targetUrl: string }[];
};

export type LegacyPackageIntegrityReport = {
  stats: {
    total: number;
    active: number;
    publicEligible: number;
    whop: number;
    activeWhop: number;
    apiSynced: number;
    manualOrCarried: number;
  };
  errors: string[];
  warnings: string[];
};

export async function loadLegacyPackageIntegrityRows(
  prisma: PrismaClient,
): Promise<LegacyPackageIntegrityRow[]> {
  const packages = await prisma.package.findMany({
    where: { capper: { isLegacy: true } },
    orderBy: [{ capperId: "asc" }, { sortOrder: "asc" }, { id: "asc" }],
    select: {
      id: true,
      title: true,
      description: true,
      priceCents: true,
      billingPeriod: true,
      checkoutUrl: true,
      affiliateProvider: true,
      sortOrder: true,
      isActive: true,
      externalProductId: true,
      capper: { select: { user: { select: { id: true, username: true } } } },
      storeConnection: { select: { status: true } },
      trackingUrls: {
        select: { slug: true, targetUrl: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  return packages.map((pkg) => ({
    id: pkg.id,
    userId: pkg.capper.user.id,
    username: pkg.capper.user.username,
    title: pkg.title,
    description: pkg.description,
    priceCents: pkg.priceCents,
    billingPeriod: pkg.billingPeriod,
    checkoutUrl: pkg.checkoutUrl,
    affiliateProvider: pkg.affiliateProvider,
    sortOrder: pkg.sortOrder,
    isActive: pkg.isActive,
    externalProductId: pkg.externalProductId,
    connectionStatus: pkg.storeConnection?.status ?? null,
    trackingUrls: pkg.trackingUrls,
  }));
}

function normalizedUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    url.hash = "";
    return url.toString();
  } catch {
    return value.trim() || null;
  }
}

function providerForUrl(value: string | null): "WHOP" | "WINIBLE" | null {
  if (!value) return null;
  try {
    const host = new URL(value).hostname.toLowerCase().replace(/^www\./, "");
    if (host === "whop.com" || host.endsWith(".whop.com")) return "WHOP";
    if (host === "winible.com" || host.endsWith(".winible.com")) {
      return "WINIBLE";
    }
  } catch {
    return null;
  }
  return null;
}

function rowLabel(row: LegacyPackageIntegrityRow): string {
  return `@${row.username ?? "unknown"} · ${row.title} · ${row.id}`;
}

export function inspectLegacyPackageIntegrity(
  rows: LegacyPackageIntegrityRow[],
): LegacyPackageIntegrityReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  const slugOwners = new Map<string, string>();

  for (const row of rows) {
    const label = rowLabel(row);
    const inferredProvider = providerForUrl(row.checkoutUrl);

    if (row.isActive && !row.checkoutUrl) {
      errors.push(`${label}: active package has no checkout URL`);
    }
    if (row.isActive && !row.affiliateProvider) {
      errors.push(`${label}: active package has no provider label`);
    }
    if (row.isActive && row.trackingUrls.length !== 1) {
      errors.push(
        `${label}: active package must have exactly one tracking URL; found ${row.trackingUrls.length}`,
      );
    }
    if (
      inferredProvider &&
      row.affiliateProvider &&
      inferredProvider !== row.affiliateProvider
    ) {
      errors.push(
        `${label}: provider ${row.affiliateProvider} disagrees with checkout host ${inferredProvider}`,
      );
    }
    if (row.externalProductId && row.affiliateProvider !== "WHOP") {
      errors.push(`${label}: Whop API product is not labeled WHOP`);
    }

    for (const tracking of row.trackingUrls) {
      const prior = slugOwners.get(tracking.slug);
      if (prior && prior !== row.id) {
        errors.push(
          `${label}: tracking slug ${tracking.slug} is also owned by ${prior}`,
        );
      } else {
        slugOwners.set(tracking.slug, row.id);
      }
      if (
        row.checkoutUrl &&
        normalizedUrl(tracking.targetUrl) !== normalizedUrl(row.checkoutUrl)
      ) {
        errors.push(`${label}: tracking target does not match checkout URL`);
      }
    }
  }

  if (rows.length < LEGACY_SOURCE_OFFER_COUNT) {
    errors.push(
      `Legacy package count ${rows.length} is below the documented source count ${LEGACY_SOURCE_OFFER_COUNT}`,
    );
  }

  const whopRows = rows.filter((row) => row.affiliateProvider === "WHOP");
  if (whopRows.length < LEGACY_WHOP_OFFER_FLOOR) {
    errors.push(
      `Legacy Whop count ${whopRows.length} is below the production migration floor ${LEGACY_WHOP_OFFER_FLOOR}`,
    );
  }

  const bankRows = rows.filter(
    (row) =>
      row.username?.toLowerCase() === "bankofdennis" &&
      row.title.toLowerCase() ===
        "bank of dennis vip 365 days plan".toLowerCase(),
  );
  if (bankRows.length !== 1) {
    errors.push(
      `Expected exactly one Bankofdennis 365 DAYS package; found ${bankRows.length}`,
    );
  } else {
    const bank = bankRows[0]!;
    if (bank.priceCents !== 12_500) {
      errors.push(
        `Bankofdennis 365 DAYS price is ${bank.priceCents} cents; expected 12500`,
      );
    }
    if (bank.billingPeriod !== "ONE_TIME") {
      errors.push(
        `Bankofdennis 365 DAYS cadence is ${bank.billingPeriod}; expected ONE_TIME`,
      );
    }
    if (!bank.description?.includes("$125")) {
      errors.push("Bankofdennis 365 DAYS description does not state $125");
    }
  }

  const publicEligible = rows.filter(
    (row) =>
      row.isActive &&
      Boolean(row.checkoutUrl) &&
      row.trackingUrls.length === 1 &&
      (row.connectionStatus === null || row.connectionStatus === "LIVE"),
  ).length;

  if (publicEligible < LEGACY_SOURCE_OFFER_COUNT) {
    warnings.push(
      `${publicEligible} of ${rows.length} legacy packages currently satisfy the public publication predicate`,
    );
  }

  return {
    stats: {
      total: rows.length,
      active: rows.filter((row) => row.isActive).length,
      publicEligible,
      whop: whopRows.length,
      activeWhop: whopRows.filter((row) => row.isActive).length,
      apiSynced: rows.filter((row) => Boolean(row.externalProductId)).length,
      manualOrCarried: rows.filter((row) => !row.externalProductId).length,
    },
    errors,
    warnings,
  };
}

export function reconcileLegacyPackageSource(
  source: LegacyPackageInput[],
  rows: LegacyPackageIntegrityRow[],
): { errors: string[]; matched: number } {
  const errors: string[] = [];
  const rowsBySlug = new Map<string, LegacyPackageIntegrityRow[]>();

  for (const row of rows) {
    for (const tracking of row.trackingUrls) {
      const matches = rowsBySlug.get(tracking.slug) ?? [];
      matches.push(row);
      rowsBySlug.set(tracking.slug, matches);
    }
  }

  if (source.length !== LEGACY_SOURCE_OFFER_COUNT) {
    errors.push(
      `Source contains ${source.length} offers; expected ${LEGACY_SOURCE_OFFER_COUNT}`,
    );
  }

  let matched = 0;
  for (const expected of source) {
    const slug = legacyPackageSlug(expected.username, expected.legacyRef);
    const matches = rowsBySlug.get(slug) ?? [];
    if (matches.length !== 1) {
      errors.push(
        `@${expected.username} ${expected.legacyRef}: expected one database row for ${slug}; found ${matches.length}`,
      );
      continue;
    }

    matched += 1;
    const actual = matches[0]!;
    const comparisons: [string, unknown, unknown][] = [
      [
        "username",
        actual.username?.toLowerCase(),
        expected.username.toLowerCase(),
      ],
      ["title", actual.title, expected.title],
      ["description", actual.description, expected.description ?? null],
      ["priceCents", actual.priceCents, expected.priceCents],
      ["billingPeriod", actual.billingPeriod, expected.billingPeriod],
      [
        "checkoutUrl",
        normalizedUrl(actual.checkoutUrl),
        normalizedUrl(expected.checkoutUrl),
      ],
      [
        "affiliateProvider",
        actual.affiliateProvider,
        expected.affiliateProvider ?? null,
      ],
      ["sortOrder", actual.sortOrder, expected.sortOrder],
      ["isActive", actual.isActive, expected.isActive],
      [
        "trackingTarget",
        normalizedUrl(actual.trackingUrls[0]?.targetUrl),
        normalizedUrl(expected.checkoutUrl),
      ],
    ];

    for (const [field, actualValue, expectedValue] of comparisons) {
      if (actualValue !== expectedValue) {
        errors.push(
          `@${expected.username} ${expected.legacyRef}: ${field} mismatch`,
        );
      }
    }
  }

  return { errors, matched };
}
