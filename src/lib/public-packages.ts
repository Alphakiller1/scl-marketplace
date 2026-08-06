import type { Prisma } from "@prisma/client";

/**
 * Hosts that mean "nobody filled this in yet".
 *
 * A checkout link is the one place on this marketplace where a bettor spends
 * money, so a placeholder is worse than a missing package — it takes a real
 * click and lands on nothing. One `example.com` offer was live and sellable on
 * the public storefront, which is what this excludes at the source rather than
 * relying on catching every seeder and importer.
 */
export const PLACEHOLDER_CHECKOUT_HOSTS = [
  "example.com",
  "example.org",
  "example.net",
] as const;

/** Active offer requirements shared by public listings, profiles, and redirects. */
export const activePublicPackageWhere = {
  isActive: true,
  checkoutUrl: { not: null },
  trackingUrls: { some: {} },
  AND: PLACEHOLDER_CHECKOUT_HOSTS.map((host) => ({
    checkoutUrl: { not: { contains: host } },
  })),
  OR: [
    { storeConnection: { status: "LIVE" as const } },
    { storeConnectionId: null },
  ],
} satisfies Prisma.PackageWhereInput;

/**
 * One fail-closed public package predicate. A stale /go slug must not outlive
 * the account, offer, storefront, or publication eligibility behind it.
 */
export function publicPackagePublicationWhere(
  userPublicationWhere: Prisma.UserWhereInput,
): Prisma.PackageWhereInput {
  return {
    ...activePublicPackageWhere,
    capper: {
      user: {
        AND: [
          {
            username: { not: null },
            accountStatus: "ACTIVE",
          },
          userPublicationWhere,
        ],
      },
    },
  };
}
