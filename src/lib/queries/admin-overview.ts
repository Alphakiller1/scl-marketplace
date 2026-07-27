import "server-only";

import type { StoreConnectionStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  buildPublishedParlayWhere,
  buildPublishedStraightPlayWhere,
} from "@/lib/queries/published-play-where";

const EMPTY_STOREFRONT_COUNTS: Record<StoreConnectionStatus, number> = {
  NOT_STARTED: 0,
  INSTRUCTIONS_VIEWED: 0,
  PENDING_SCL_ACCEPTANCE: 0,
  PENDING_SCL_LINK_IMPORT: 0,
  LINKS_RECEIVED: 0,
  PACKAGES_IMPORTED: 0,
  LIVE: 0,
  NEEDS_ACTION: 0,
  DISABLED: 0,
};

export async function getAdminOperationsOverview() {
  const [straightWhere, parlayWhere] = await Promise.all([
    buildPublishedStraightPlayWhere(),
    buildPublishedParlayWhere(),
  ]);

  const [
    capperAccounts,
    ghostAccounts,
    suspendedAccounts,
    totalPlays,
    pendingStraight,
    pendingParlays,
    publishedStraight,
    publishedParlays,
    storefrontGroups,
    packages,
    trackedClicks,
    policyDocuments,
    policyRevisions,
  ] = await Promise.all([
    prisma.user.count({ where: { role: "CAPPER" } }),
    prisma.user.count({ where: { role: "CAPPER", isTest: true } }),
    prisma.user.count({
      where: { role: "CAPPER", accountStatus: "SUSPENDED" },
    }),
    prisma.play.count(),
    prisma.play.count({ where: { outcome: "PENDING" } }),
    prisma.parlay.count({ where: { outcome: "PENDING" } }),
    prisma.play.count({ where: straightWhere }),
    prisma.parlay.count({ where: parlayWhere }),
    prisma.storeConnection.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    prisma.package.count(),
    prisma.clickEvent.count(),
    prisma.policyDocument.count(),
    prisma.policyDocumentRevision.count(),
  ]);

  const storefronts = { ...EMPTY_STOREFRONT_COUNTS };
  for (const row of storefrontGroups) {
    storefronts[row.status] = row._count._all;
  }

  const pendingStorefrontReview =
    storefronts.PENDING_SCL_ACCEPTANCE + storefronts.PENDING_SCL_LINK_IMPORT;
  const approvedStorefronts =
    storefronts.LINKS_RECEIVED + storefronts.PACKAGES_IMPORTED;

  return {
    accounts: {
      cappers: capperAccounts,
      ghosts: ghostAccounts,
      suspended: suspendedAccounts,
    },
    plays: {
      total: totalPlays,
      published: publishedStraight + publishedParlays,
      pendingGrade: pendingStraight + pendingParlays,
    },
    storefronts: {
      total: storefrontGroups.reduce((sum, row) => sum + row._count._all, 0),
      pendingReview: pendingStorefrontReview,
      approved: approvedStorefronts,
      live: storefronts.LIVE,
      needsAttention: storefronts.NEEDS_ACTION,
      suspended: storefronts.DISABLED,
      packages,
      trackedClicks,
    },
    policies: {
      documents: policyDocuments,
      revisions: policyRevisions,
    },
  };
}
