import type { AudienceFilters } from "@/lib/schemas/audience.schema";

/**
 * The shared audience engine's filter rules. Pure and client-safe (the composer
 * renders labels from it); resolution into recipients lives in
 * `admin-audience-members.ts`. The dashboard, the audience list, and the
 * campaign composer all go through the same functions, so a dashboard number,
 * the list behind it, and the email recipient count cannot drift apart.
 */

export type AudienceSnapshot = {
  id: string;
  email: string;
  username: string | null;
  displayName: string | null;
  emailVerified: Date | null;
  accountStatus: string;
  isTest: boolean;
  marketingOptOut: boolean;
  campaignUndeliverable: boolean;
  createdAt: Date;
  playCount: number;
  parlayCount: number;
  lastPlayAt: Date | null;
  hasConnectedStorefront: boolean;
  storefrontAwaitingReview: boolean;
};

/** Why a matching capper will not receive a campaign. */
export type IneligibleReason =
  | "opted_out"
  | "restricted"
  | "no_inbox"
  | "bounced"
  | "duplicate_inbox";

export type AudienceMember = AudienceSnapshot & {
  eligible: boolean;
  ineligibleReason: IneligibleReason | null;
};

export const INELIGIBLE_REASON_LABEL: Record<IneligibleReason, string> = {
  opted_out: "Opted out of announcements",
  restricted: "Suspended or disabled",
  no_inbox: "No reachable inbox (placeholder address)",
  bounced: "Address bounced or was blocked",
  duplicate_inbox: "Inbox shared with another account",
};

const DAY_MS = 24 * 60 * 60 * 1_000;

/**
 * Does this capper belong to the group? Membership only — whether they can be
 * emailed is decided separately, so the dashboard can show the real size of a
 * group and how many of them a campaign would reach.
 */
export function matchesAudienceFilters(
  capper: AudienceSnapshot,
  filters: AudienceFilters,
  now: Date = new Date(),
): boolean {
  if (capper.isTest || filters.excludeUserIds.includes(capper.id)) {
    return false;
  }

  if (
    filters.joinedWithinDays !== null &&
    capper.createdAt <
      new Date(now.getTime() - filters.joinedWithinDays * DAY_MS)
  ) {
    return false;
  }

  if (
    filters.accountActivity === "ACTIVE" &&
    capper.accountStatus !== "ACTIVE"
  ) {
    return false;
  }
  if (
    filters.accountActivity === "INACTIVE" &&
    capper.accountStatus === "ACTIVE"
  ) {
    return false;
  }

  if (filters.verification === "VERIFIED" && !capper.emailVerified) {
    return false;
  }
  if (filters.verification === "UNVERIFIED" && capper.emailVerified) {
    return false;
  }

  const hasPlays = capper.playCount + capper.parlayCount > 0;
  if (filters.playHistory === "HAS_PLAYS" && !hasPlays) return false;
  if (filters.playHistory === "NEVER_SUBMITTED" && hasPlays) return false;

  if (filters.playedWithinDays !== null) {
    const cutoff = new Date(now.getTime() - filters.playedWithinDays * DAY_MS);
    if (!capper.lastPlayAt || capper.lastPlayAt < cutoff) return false;
  }
  if (filters.noPlaysWithinDays !== null) {
    const cutoff = new Date(now.getTime() - filters.noPlaysWithinDays * DAY_MS);
    if (capper.lastPlayAt && capper.lastPlayAt >= cutoff) return false;
  }

  if (filters.storefront === "CONNECTED" && !capper.hasConnectedStorefront) {
    return false;
  }
  if (filters.storefront === "NOT_CONNECTED" && capper.hasConnectedStorefront) {
    return false;
  }
  if (
    filters.storefront === "AWAITING_REVIEW" &&
    !capper.storefrontAwaitingReview
  ) {
    return false;
  }

  return true;
}

export function audienceLabel(filters: AudienceFilters): string {
  const parts: string[] = [];
  if (filters.joinedWithinDays) {
    parts.push(`joined in ${filters.joinedWithinDays} days`);
  }
  if (filters.accountActivity === "ACTIVE") parts.push("active accounts");
  if (filters.accountActivity === "INACTIVE") parts.push("inactive accounts");
  if (filters.playedWithinDays) {
    parts.push(`played in ${filters.playedWithinDays} days`);
  }
  if (filters.noPlaysWithinDays) {
    parts.push(`no plays in ${filters.noPlaysWithinDays} days`);
  }
  if (filters.verification !== "ANY") {
    parts.push(filters.verification.toLowerCase());
  }
  if (filters.playHistory === "HAS_PLAYS") parts.push("has submitted plays");
  if (filters.playHistory === "NEVER_SUBMITTED") {
    parts.push("never submitted");
  }
  if (filters.storefront === "CONNECTED") parts.push("connected storefront");
  if (filters.storefront === "NOT_CONNECTED") {
    parts.push("no connected storefront");
  }
  if (filters.storefront === "AWAITING_REVIEW") {
    parts.push("storefront awaiting review");
  }
  return parts.length ? parts.join(" · ") : "All cappers";
}

/** Drop defaults so dashboard links stay short and readable. */
function compactFilters(filters: AudienceFilters): Partial<AudienceFilters> {
  const out: Partial<AudienceFilters> = {};
  if (filters.joinedWithinDays !== null) {
    out.joinedWithinDays = filters.joinedWithinDays;
  }
  if (filters.accountActivity !== "ANY") {
    out.accountActivity = filters.accountActivity;
  }
  if (filters.playedWithinDays !== null) {
    out.playedWithinDays = filters.playedWithinDays;
  }
  if (filters.noPlaysWithinDays !== null) {
    out.noPlaysWithinDays = filters.noPlaysWithinDays;
  }
  if (filters.verification !== "ANY") out.verification = filters.verification;
  if (filters.playHistory !== "ANY") out.playHistory = filters.playHistory;
  if (filters.storefront !== "ANY") out.storefront = filters.storefront;
  if (filters.excludeUserIds.length) {
    out.excludeUserIds = filters.excludeUserIds;
  }
  return out;
}

function filtersQuery(filters: AudienceFilters): string {
  return `filters=${encodeURIComponent(JSON.stringify(compactFilters(filters)))}`;
}

/** The capper list behind a dashboard number. */
export function audienceListHref(filters: AudienceFilters): string {
  return `/admin/audiences?${filtersQuery(filters)}`;
}

/** The campaign composer, pre-loaded with the same group. */
export function audienceMessagesHref(filters: AudienceFilters): string {
  return `/admin/messages?${filtersQuery(filters)}`;
}
