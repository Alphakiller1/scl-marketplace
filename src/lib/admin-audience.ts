import type { AudienceFilters } from "@/lib/schemas/audience.schema";

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

const DAY_MS = 24 * 60 * 60 * 1_000;

export function matchesAudienceFilters(
  capper: AudienceSnapshot,
  filters: AudienceFilters,
  now: Date = new Date(),
): boolean {
  if (
    capper.isTest ||
    capper.campaignUndeliverable ||
    filters.excludeUserIds.includes(capper.id)
  ) {
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
  if (filters.accountActivity !== "ANY") {
    parts.push(filters.accountActivity.toLowerCase());
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
  return parts.length ? parts.join(" · ") : "All eligible cappers";
}

export function audienceMessagesHref(filters: AudienceFilters): string {
  return `/admin/messages?filters=${encodeURIComponent(JSON.stringify(filters))}`;
}
