import { hasDeliverableEmail } from "@/lib/account-claim";
import {
  matchesAudienceFilters,
  type AudienceMember,
  type AudienceSnapshot,
  type IneligibleReason,
} from "@/lib/admin-audience";
import { resolveBroadcastRecipients } from "@/lib/broadcast";
import type { AudienceFilters } from "@/lib/schemas/audience.schema";

function ineligibleReason(capper: AudienceSnapshot): IneligibleReason | null {
  if (
    capper.accountStatus === "SUSPENDED" ||
    capper.accountStatus === "DISABLED"
  )
    return "restricted";
  if (!hasDeliverableEmail(capper.email)) return "no_inbox";
  if (capper.marketingOptOut) return "opted_out";
  if (capper.campaignUndeliverable) return "bounced";
  return null;
}

/**
 * Every capper in the group, each marked with whether a campaign reaches them.
 *
 * A manual removal withdraws the inbox, not only the account: removing one of
 * two accounts that share an address must not hand the email to the other.
 * Snapshots are ordered oldest account first, the same order the roster-wide
 * audiences use, so a shared inbox resolves to the same account everywhere.
 */
export function resolveAudienceMembers(
  snapshots: readonly AudienceSnapshot[],
  filters: AudienceFilters,
  now: Date = new Date(),
): AudienceMember[] {
  const excluded = new Set(filters.excludeUserIds);
  const excludedInboxes = new Set(
    snapshots
      .filter((capper) => excluded.has(capper.id))
      .map((capper) => capper.email.trim().toLowerCase()),
  );
  const matching = snapshots.filter(
    (capper) =>
      matchesAudienceFilters(capper, filters, now) &&
      !excludedInboxes.has(capper.email.trim().toLowerCase()),
  );
  const eligibleIds = new Set(
    resolveBroadcastRecipients(
      "FILTERED_CAPPERS",
      matching.filter((capper) => !capper.campaignUndeliverable),
    ).map((recipient) => recipient.userId),
  );
  return matching.map((capper) => {
    const eligible = eligibleIds.has(capper.id);
    return {
      ...capper,
      eligible,
      ineligibleReason: eligible
        ? null
        : (ineligibleReason(capper) ?? "duplicate_inbox"),
    };
  });
}

/** Group size and how many of them a campaign would reach. */
export function audienceCounts(members: readonly AudienceMember[]) {
  return {
    total: members.length,
    emailable: members.filter((member) => member.eligible).length,
  };
}
