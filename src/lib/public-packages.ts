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

/** Whether an offer can appear on the public profile / marketplace today. */
export function isPackagePubliclyPublishable(input: {
  isActive: boolean;
  checkoutUrl: string | null;
  hasTrackingUrl: boolean;
  storeConnectionId: string | null;
  storeConnectionStatus?: string | null;
}): boolean {
  return (
    input.isActive &&
    Boolean(input.checkoutUrl?.trim()) &&
    input.hasTrackingUrl &&
    (input.storeConnectionId === null || input.storeConnectionStatus === "LIVE")
  );
}

export type PackageUnpublishableReason =
  | "missing_checkout"
  | "missing_tracking"
  | "awaiting_mark_live";

/** Why an active offer still does not appear on the public profile. */
export function packageUnpublishableReason(input: {
  isActive: boolean;
  checkoutUrl: string | null;
  hasTrackingUrl: boolean;
  storeConnectionId: string | null;
  storeConnectionStatus?: string | null;
}): PackageUnpublishableReason | null {
  if (!input.isActive || isPackagePubliclyPublishable(input)) return null;
  if (!input.checkoutUrl?.trim()) return "missing_checkout";
  if (!input.hasTrackingUrl) return "missing_tracking";
  if (input.storeConnectionId && input.storeConnectionStatus !== "LIVE") {
    return "awaiting_mark_live";
  }
  return "missing_checkout";
}

export function packageUnpublishableMessage(
  reason: PackageUnpublishableReason,
  count = 1,
): string {
  const noun = count === 1 ? "package" : "packages";
  const verb = count === 1 ? "it does" : "they do";
  switch (reason) {
    case "missing_checkout":
      return `${count} active ${noun} ${count === 1 ? "is" : "are"} missing a Whop/Winible checkout link, so ${verb} not appear publicly.`;
    case "missing_tracking":
      return `${count} active ${noun} ${count === 1 ? "is" : "are"} missing an SCL tracking URL — save the package again to generate one.`;
    case "awaiting_mark_live":
      return `${count} active ${noun} already ${count === 1 ? "has" : "have"} a checkout link saved — click Mark live on this storefront to publish ${count === 1 ? "it" : "them"} on the profile.`;
  }
}

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
