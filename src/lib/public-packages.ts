import type { Prisma } from "@prisma/client";

/** Active offer requirements shared by public listings, profiles, and redirects. */
export const activePublicPackageWhere = {
  isActive: true,
  checkoutUrl: { not: null },
  trackingUrls: { some: {} },
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
