import "server-only";

import { prisma } from "@/lib/prisma";
import {
  matchesAudienceFilters,
  type AudienceSnapshot,
} from "@/lib/admin-audience";
import { resolveBroadcastRecipients } from "@/lib/broadcast";
import type { AudienceFilters } from "@/lib/schemas/audience.schema";

const PENDING_STOREFRONT_STATUSES = new Set([
  "PENDING_SCL_ACCEPTANCE",
  "PENDING_SCL_LINK_IMPORT",
]);

export type AudienceMember = AudienceSnapshot & {
  eligible: boolean;
};

export async function listCampaignSuppressedAddresses(): Promise<Set<string>> {
  const rows = await prisma.adminBroadcastRecipient.findMany({
    where: {
      bouncedAt: { not: null },
      error: { in: ["hard_bounce", "blocked", "invalid"] },
    },
    distinct: ["address"],
    select: { address: true },
  });
  return new Set(rows.map((row) => row.address.trim().toLowerCase()));
}

export async function loadAudienceSnapshots(): Promise<AudienceSnapshot[]> {
  const [users, suppressedAddresses] = await Promise.all([
    prisma.user.findMany({
      where: { role: "CAPPER" },
      orderBy: [{ username: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        emailVerified: true,
        accountStatus: true,
        isTest: true,
        marketingOptOut: true,
        createdAt: true,
        capperProfile: {
          select: {
            plays: {
              where: { parlayId: null, status: "COMMITTED" },
              orderBy: { createdAt: "desc" },
              take: 1,
              select: { createdAt: true },
            },
            parlays: {
              orderBy: { createdAt: "desc" },
              take: 1,
              select: { createdAt: true },
            },
            _count: {
              select: {
                plays: { where: { parlayId: null, status: "COMMITTED" } },
                parlays: true,
              },
            },
            storeConnections: {
              select: { status: true, requiresAttention: true },
            },
            packages: {
              where: { isActive: true, checkoutUrl: { not: null } },
              take: 1,
              select: { id: true },
            },
          },
        },
      },
    }),
    listCampaignSuppressedAddresses(),
  ]);

  return users.map((user) => {
    const profile = user.capperProfile;
    const straightAt = profile?.plays[0]?.createdAt ?? null;
    const parlayAt = profile?.parlays[0]?.createdAt ?? null;
    const lastPlayAt =
      straightAt && parlayAt
        ? straightAt > parlayAt
          ? straightAt
          : parlayAt
        : (straightAt ?? parlayAt);
    const connections = profile?.storeConnections ?? [];

    return {
      id: user.id,
      email: user.email,
      username: user.username,
      displayName: user.displayName,
      emailVerified: user.emailVerified,
      accountStatus: user.accountStatus,
      isTest: user.isTest,
      marketingOptOut: user.marketingOptOut,
      campaignUndeliverable: suppressedAddresses.has(
        user.email.trim().toLowerCase(),
      ),
      createdAt: user.createdAt,
      playCount: profile?._count.plays ?? 0,
      parlayCount: profile?._count.parlays ?? 0,
      lastPlayAt,
      hasConnectedStorefront:
        connections.some((connection) => connection.status === "LIVE") ||
        Boolean(profile?.packages.length),
      storefrontAwaitingReview: connections.some(
        (connection) =>
          connection.requiresAttention ||
          PENDING_STOREFRONT_STATUSES.has(connection.status),
      ),
    };
  });
}

export function resolveAudienceMembers(
  snapshots: readonly AudienceSnapshot[],
  filters: AudienceFilters,
  now: Date = new Date(),
): AudienceMember[] {
  const matching = snapshots.filter((capper) =>
    matchesAudienceFilters(capper, filters, now),
  );
  const eligibleIds = new Set(
    resolveBroadcastRecipients(
      "FILTERED_CAPPERS",
      matching.filter((capper) => !capper.campaignUndeliverable),
    ).map((recipient) => recipient.userId),
  );
  return matching.map((capper) => ({
    ...capper,
    eligible: eligibleIds.has(capper.id),
  }));
}

export async function listAudienceMembers(filters: AudienceFilters) {
  const snapshots = await loadAudienceSnapshots();
  return resolveAudienceMembers(snapshots, filters);
}

export async function listEligibleAudienceMembers(filters: AudienceFilters) {
  return (await listAudienceMembers(filters)).filter(
    (member) => member.eligible,
  );
}
