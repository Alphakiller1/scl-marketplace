import type {
  BillingPeriod,
  CommercePlatform,
  PackageVisibility,
  StorefrontStatus,
} from "@prisma/client";

export const STOREFRONT_STATUS_LABEL: Record<StorefrontStatus, string> = {
  NOT_STARTED: "Not Started",
  AWAITING_AFFILIATE_INVITE: "Awaiting Affiliate Invite",
  PENDING_SCL_REVIEW: "Pending SCL Review",
  APPROVED: "Approved",
  STOREFRONT_LIVE: "Storefront Live",
  NEEDS_ATTENTION: "Needs Attention",
};

export const COMMERCE_PLATFORM_LABEL: Record<CommercePlatform, string> = {
  NONE: "None",
  WINIBLE: "Winible",
  WHOP: "Whop",
};

export const PACKAGE_VISIBILITY_LABEL: Record<PackageVisibility, string> = {
  DRAFT: "Draft",
  HIDDEN: "Hidden",
  LIVE: "Live",
};

export const BILLING_PERIOD_LABEL: Record<BillingPeriod, string> = {
  ONE_TIME: "One-time",
  DAY: "Daily",
  WEEK: "Weekly",
  MONTH: "Monthly",
  SEASON: "Season",
  YEAR: "Yearly",
};

export function formatPackagePrice(
  priceCents: number,
  billingPeriod: BillingPeriod,
): string {
  const dollars = (priceCents / 100).toFixed(priceCents % 100 === 0 ? 0 : 2);
  const suffix: Record<BillingPeriod, string> = {
    ONE_TIME: "",
    DAY: "/day",
    WEEK: "/wk",
    MONTH: "/mo",
    SEASON: "/season",
    YEAR: "/yr",
  };
  return `$${dollars}${suffix[billingPeriod]}`;
}

export function packageTrackingSlug(
  username: string,
  packageId: string,
): string {
  const handle = username
    .replace(/^@/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");
  const shortId = packageId.slice(-8).toLowerCase();
  return `${handle}-${shortId}`.replace(/^-+|-+$/g, "");
}

export function storefrontStatusTone(
  status: StorefrontStatus,
): "muted" | "pos" | "neg" | "brand" {
  switch (status) {
    case "STOREFRONT_LIVE":
    case "APPROVED":
      return "pos";
    case "NEEDS_ATTENTION":
      return "neg";
    case "PENDING_SCL_REVIEW":
    case "AWAITING_AFFILIATE_INVITE":
      return "brand";
    default:
      return "muted";
  }
}

export function deriveStorefrontStatus(input: {
  current: StorefrontStatus;
  livePackageCount: number;
}): StorefrontStatus {
  if (input.current === "NEEDS_ATTENTION") return input.current;
  if (input.livePackageCount > 0) return "STOREFRONT_LIVE";
  if (input.current === "STOREFRONT_LIVE") return "APPROVED";
  return input.current;
}
