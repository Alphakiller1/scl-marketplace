import type {
  PackageImportStatus,
  StoreConnectionStatus,
  StoreProvider,
} from "@prisma/client";

export const STORE_PROVIDERS = ["WINIBLE", "WHOP"] as const;

export const SCL_AFFILIATE_EMAIL = "scleaderboard@gmail.com";

export const WINIBLE_INVITE_VALUES = {
  email: SCL_AFFILIATE_EMAIL,
  rewardType: "Recurring payments",
  rewardAmount: "35.00% / Percentage",
  plans: "Include All Current and Future Plans",
} as const;

export function providerLabel(provider: StoreProvider): string {
  return provider === "WINIBLE" ? "Winible" : "Whop";
}

/**
 * Platform-adaptive purchase CTA. Public cards never expose raw affiliate URLs —
 * the button still points at `/go/[slug]`.
 */
export function packageCtaLabel(provider?: StoreProvider | null): string {
  switch (provider) {
    case "WHOP":
      return "Subscribe on Whop";
    case "WINIBLE":
      return "Subscribe on Winible";
    default:
      return "Subscribe";
  }
}

export function pendingStatusForProvider(
  provider: StoreProvider,
): StoreConnectionStatus {
  return provider === "WHOP"
    ? "PENDING_SCL_LINK_IMPORT"
    : "PENDING_SCL_ACCEPTANCE";
}

export function storeStatusLabel(status: StoreConnectionStatus): string {
  switch (status) {
    case "NOT_STARTED":
      return "Not Started";
    case "INSTRUCTIONS_VIEWED":
      return "Instructions Viewed";
    case "PENDING_SCL_ACCEPTANCE":
      return "Pending Storefront Approval";
    case "PENDING_SCL_LINK_IMPORT":
      return "Pending Storefront Approval";
    case "LINKS_RECEIVED":
      return "Links Received";
    case "PACKAGES_IMPORTED":
      return "Packages Imported";
    case "LIVE":
      return "Live";
    case "NEEDS_ACTION":
      return "Needs Action";
    case "DISABLED":
      return "Disabled";
    default:
      return status;
  }
}

export function importStatusLabel(status: PackageImportStatus): string {
  switch (status) {
    case "NOT_STARTED":
      return "Not Started";
    case "LINKS_RECEIVED":
      return "Links Received";
    case "IMPORTED":
      return "Imported";
    case "LIVE":
      return "Live";
    default:
      return status;
  }
}

/** Visual tone for status chips — pending never uses success/green. */
export function storeStatusTone(
  status: StoreConnectionStatus,
): "neutral" | "pending" | "info" | "live" | "danger" | "disabled" {
  switch (status) {
    case "PENDING_SCL_ACCEPTANCE":
    case "PENDING_SCL_LINK_IMPORT":
      return "pending";
    case "LINKS_RECEIVED":
    case "PACKAGES_IMPORTED":
      return "info";
    case "LIVE":
      return "live";
    case "NEEDS_ACTION":
      return "danger";
    case "DISABLED":
      return "disabled";
    default:
      return "neutral";
  }
}

export function isPendingStoreStatus(status: StoreConnectionStatus): boolean {
  return (
    status === "PENDING_SCL_ACCEPTANCE" || status === "PENDING_SCL_LINK_IMPORT"
  );
}

export function adminChecklist(provider: StoreProvider): string[] {
  if (provider === "WHOP") {
    return [
      "Capper confirmed SCL added as Whop affiliate",
      "Whop notification email checked if received (not always sent)",
      "Affiliate % + product/checkout links visible in Whop dashboard",
      "Recurring commission confirmed when available",
      "Package objects created (name, price, description, affiliate link, promo, order)",
      "SCL tracking URLs generated",
      "Packages marked Live on profile",
    ];
  }
  return [
    "Winible affiliate invite email received",
    "Affiliate relationship accepted in Winible",
    "Package-level affiliate links available",
    "Package objects created (name, price, description, affiliate link, promo, order)",
    "SCL tracking URLs generated",
    "Packages marked Live on profile",
  ];
}

export function formatPriceCents(
  cents: number,
  billingPeriod: string,
): string | null {
  if (!cents || cents <= 0) return null;
  const dollars = (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  });
  const period =
    billingPeriod === "ONE_TIME"
      ? ""
      : billingPeriod === "DAY"
        ? " / day"
        : billingPeriod === "WEEK"
          ? " / week"
          : billingPeriod === "MONTH"
            ? " / month"
            : billingPeriod === "SEASON"
              ? " / season"
              : billingPeriod === "YEAR"
                ? " / year"
                : "";
  return `${dollars}${period}`;
}

export function makeTrackingSlug(seed?: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  const base = (seed || "pkg")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 24);
  return `${base || "pkg"}-${rand}`;
}
