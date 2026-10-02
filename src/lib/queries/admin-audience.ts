import "server-only";

import { prisma } from "@/lib/prisma";
import type { AudienceSnapshot } from "@/lib/admin-audience";
import { resolveAudienceMembers } from "@/lib/admin-audience-members";
import { SUPPRESSING_BOUNCE_ERRORS } from "@/lib/brevo-send";
import type { AudienceFilters } from "@/lib/schemas/audience.schema";

const PENDING_STOREFRONT_STATUSES = new Set([
  "PENDING_SCL_ACCEPTANCE",
  "PENDING_SCL_LINK_IMPORT",
]);

/** Demo roster — never a real capper, never counted, never mailed. */
const GHOST_DOMAIN = "@ghost.scl.demo";

export async function listCampaignSuppressedAddresses(): Promise<Set<string>> {
  const rows = await prisma.adminBroadcastRecipient.findMany({
    where: {
      bouncedAt: { not: null },
      error: { in: [...SUPPRESSING_BOUNCE_ERRORS] },
    },
    distinct: ["address"],
    select: { address: true },
  });
  return new Set(rows.map((row) => row.address.trim().toLowerCase()));
}

/**
 * One row per real capper with everything the filters read.
 *
 * Play volume comes from two grouped aggregates rather than nested relation
 * reads: a nested `take: 1` is sliced in memory by Prisma, which would pull
 * every play on every dashboard load and every audience preview.
 */
export async function loadAudienceSnapshots(): Promise<AudienceSnapshot[]> {
  const [users, straightStats, parlayStats, suppressedAddresses] =
    await Promise.all([
      prisma.user.findMany({
        where: {
          role: "CAPPER",
          NOT: { email: { endsWith: GHOST_DOMAIN } },
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
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
              id: true,
              storeConnections: {
                select: { status: true, requiresAttention: true },
              },
              _count: {
                select: {
                  packages: {
                    where: { isActive: true, checkoutUrl: { not: null } },
                  },
                },
              },
            },
          },
        },
      }),
      prisma.play.groupBy({
        by: ["capperId"],
        where: { parlayId: null, status: "COMMITTED" },
        _count: { _all: true },
        _max: { createdAt: true },
      }),
      prisma.parlay.groupBy({
        by: ["capperId"],
        _count: { _all: true },
        _max: { createdAt: true },
      }),
      listCampaignSuppressedAddresses(),
    ]);

  const straight = new Map(straightStats.map((row) => [row.capperId, row]));
  const parlays = new Map(parlayStats.map((row) => [row.capperId, row]));

  return users.map((user) => {
    const profile = user.capperProfile;
    const plays = profile ? straight.get(profile.id) : undefined;
    const tickets = profile ? parlays.get(profile.id) : undefined;
    const straightAt = plays?._max.createdAt ?? null;
    const parlayAt = tickets?._max.createdAt ?? null;
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
      playCount: plays?._count._all ?? 0,
      parlayCount: tickets?._count._all ?? 0,
      lastPlayAt,
      hasConnectedStorefront:
        connections.some((connection) => connection.status === "LIVE") ||
        (profile?._count.packages ?? 0) > 0,
      storefrontAwaitingReview: connections.some(
        (connection) =>
          connection.requiresAttention ||
          PENDING_STOREFRONT_STATUSES.has(connection.status),
      ),
    };
  });
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
