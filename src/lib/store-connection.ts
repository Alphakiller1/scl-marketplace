import type {
  PackageImportStatus,
  StoreConnectionStatus,
  StoreProvider,
} from "@prisma/client";

import { SCL_WHOP_AFFILIATE_USERNAME } from "@/lib/whop-config";

export const STORE_PROVIDERS = ["WINIBLE", "WHOP"] as const;

export const SCL_AFFILIATE_EMAIL = "scleaderboard@gmail.com";

export { SCL_WHOP_AFFILIATE_USERNAME };

/**
 * Public SCL Whop storefront. Manual onboarding opens this page directly —
 * cappers should not have to search Discover or Refer Buyers.
 */
export const SCL_WHOP_AFFILIATE_PAGE_URL =
  "https://whop.com/sports-cappers-leaderboard/";

/** @deprecated Use SCL_WHOP_AFFILIATE_PAGE_URL */
export const WHOP_AFFILIATES_HUB_URL = SCL_WHOP_AFFILIATE_PAGE_URL;

/** Commission the capper must select when adding SCL on Whop. */
export const SCL_WHOP_AFFILIATE_COMMISSION = {
  percent: 35,
  duration: "Recurring",
} as const;

/** SCL's Winible creator-onboarding referral; never use as a package checkout. */
export const WINIBLE_CAPPER_REFERRAL_URL =
  "https://winible.com/refer/usergif4lfuf?utm_source=1332059342148489371&utm_medium=winible_referral";

/** SCL's Whop creator-onboarding referral; never use as a package checkout. */
export const WHOP_CAPPER_REFERRAL_URL =
  "https://whop.com/network/?a=scleaderboard";

export const WINIBLE_INVITE_VALUES = {
  email: SCL_AFFILIATE_EMAIL,
  rewardType: "Recurring payments",
  rewardAmount: "35.00% / Percentage",
  plans: "Include All Current and Future Plans",
} as const;

export function providerLabel(provider: StoreProvider): string {
  return provider === "WINIBLE" ? "Winible" : "Whop";
}

export {
  isWhopCheckoutUrl,
  whopAffiliateParamIssues,
} from "@/lib/whop-affiliate";
export {
  isWinibleCheckoutUrl,
  winibleCheckoutUrlIssues,
} from "@/lib/winible-affiliate";

export function isWinibleCreatorReferralUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    if (url.protocol !== "https:" || hostname !== "winible.com") return false;
    // The SCL onboarding referral is identified either by a /refer/<code> path
    // (legacy) or a ?refer=<code> query (current signup?onboarding=true&refer=…).
    return (
      /^\/refer\/[a-z0-9_-]+\/?$/i.test(url.pathname) ||
      url.searchParams.has("refer")
    );
  } catch {
    return false;
  }
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
      // The capper has submitted; SCL is the party that must act next. Naming
      // SCL keeps the chip from contradicting the "request submitted" status.
      return "Awaiting SCL Acceptance";
    case "PENDING_SCL_LINK_IMPORT":
      return "Pending SCL Review";
    case "LINKS_RECEIVED":
      return "Approved · Links Received";
    case "PACKAGES_IMPORTED":
      return "Approved · Packages Imported";
    case "LIVE":
      return "Storefront Live";
    case "NEEDS_ACTION":
      return "Needs Attention";
    case "DISABLED":
      return "Suspended";
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

export function isResumableStoreStatus(status: StoreConnectionStatus): boolean {
  return status === "NOT_STARTED" || status === "INSTRUCTIONS_VIEWED";
}

/**
 * Pick the connection the capper should see when the storefront wizard loads.
 *
 * An unfinished connection must win over a reviewed/live connection on the
 * other platform. Otherwise the reviewed connection forces the wizard into
 * its status view while the unfinished provider still counts as "connected",
 * leaving no route back to its setup or OAuth button.
 */
export function selectInitialStoreConnection<
  T extends { status: StoreConnectionStatus },
>(connections: readonly T[]): T | null {
  return (
    connections.find((connection) =>
      isResumableStoreStatus(connection.status),
    ) ??
    connections.find((connection) => connection.status !== "DISABLED") ??
    connections.find((connection) => connection.status === "DISABLED") ??
    null
  );
}

/**
 * Static reminder steps for admins. Prefer `adminStorefrontReadiness` for the
 * live computed checklist on store-setup detail.
 */
export function adminChecklist(provider: StoreProvider): string[] {
  if (provider === "WHOP") {
    return [
      "Capper added SCL as Whop affiliate + submitted confirmation",
      "Capper connected SCL on Whop (enables package sync)",
      "Record 35% recurring affiliate commission on this request",
      "Sync packages from Whop or paste attributed ?a= checkout links",
      "Set prices, activate packages, then Mark live",
    ];
  }
  return [
    "Accept the Winible affiliate invite email (off-platform)",
    "Record affiliate commission % on this request",
    "Paste package-level Winible checkout links (not the creator referral)",
    "Set prices, activate packages, then Mark live",
  ];
}

export function pendingStatusLabel(provider: StoreProvider): string {
  return provider === "WHOP" ? "Pending SCL review" : "Awaiting SCL acceptance";
}

/**
 * How one billing term reads: "/ day", "/ 4 days", "/ 2 weeks".
 *
 * A term is a COUNT of periods, so the unit alone is not enough — a 4-day pass
 * and a 1-day pass are both DAY. A count of 1 stays in the singular short form
 * a price is normally read in ("$20 / month", not "$20 / 1 month").
 *
 * ONE_TIME and SEASON have no count: "3 one time" is not a thing, and a season
 * is a season. Both ignore the number rather than rendering nonsense if one is
 * ever stored.
 */
export function billingTermLabel(
  billingPeriod: string,
  intervalCount = 1,
): string {
  if (billingPeriod === "ONE_TIME") return "";
  if (billingPeriod === "SEASON") return "season";

  const unit =
    billingPeriod === "DAY"
      ? "day"
      : billingPeriod === "WEEK"
        ? "week"
        : billingPeriod === "MONTH"
          ? "month"
          : billingPeriod === "YEAR"
            ? "year"
            : "";
  if (!unit) return "";

  // Guard the stored value rather than trusting it: a 0 or negative count would
  // read as "$20 / 0 days", and the price label is public.
  const count = Number.isFinite(intervalCount) ? Math.trunc(intervalCount) : 1;
  if (count <= 1) return unit;
  return `${count} ${unit}s`;
}

/**
 * Public price label, or null when there is nothing to say.
 *
 * A price of zero is a real price and now says so. It used to return null,
 * which dropped the card through to "See provider for current price" — so an
 * admin could set an offer to $0, see it saved, and watch the storefront keep
 * asking buyers to go and ask. Every zero-priced package on the platform is a
 * free trial ("3 Days Free VIP BANKERS", "VIP 2 Days FREE"), so "Free" is both
 * accurate and the word a buyer is looking for.
 *
 * Free deliberately carries no billing term. Those packages inherited a cadence
 * that was invisible while the price was hidden and is frequently wrong — a
 * three-day trial stored as MONTH, a two-day trial stored as WEEK — so
 * rendering it would publish "Free / month" on a three-day trial the moment
 * this shipped. A trial's real length belongs in billingIntervalCount, and it
 * can be shown here once someone has actually set it.
 *
 * Known gap: the schema cannot tell "free" from "price never entered", because
 * priceCents is a non-nullable Int defaulting to 0. That is fine today —
 * nothing is sitting at 0 by accident — but a future import could reintroduce
 * the ambiguity, and the fix would be to make the column nullable.
 */
export function formatPriceCents(
  cents: number,
  billingPeriod: string,
  intervalCount = 1,
): string | null {
  if (!Number.isFinite(cents) || cents < 0) return null;
  if (cents === 0) return "Free";
  const dollars = (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  });
  const term = billingTermLabel(billingPeriod, intervalCount);
  return term ? `${dollars} / ${term}` : dollars;
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
