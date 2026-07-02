import "server-only";

import { prisma } from "@/lib/prisma";

/** Straight plays awaiting a result, oldest first — the admin grading queue. */
export async function getGradingQueue() {
  const plays = await prisma.play.findMany({
    where: { outcome: "PENDING", parlayId: null },
    select: {
      id: true,
      sport: true,
      league: true,
      market: true,
      selection: true,
      oddsAmerican: true,
      units: true,
      createdAt: true,
      capper: {
        select: { user: { select: { displayName: true, username: true } } },
      },
    },
    orderBy: { createdAt: "asc" },
    take: 100,
  });

  return plays.map((p) => ({
    id: p.id,
    sport: p.sport,
    league: p.league,
    market: p.market,
    selection: p.selection,
    oddsAmerican: p.oddsAmerican,
    units: Number(p.units),
    createdAt: p.createdAt,
    capperName:
      p.capper.user.displayName ?? p.capper.user.username ?? "Unknown capper",
  }));
}

export type GradingQueueItem = Awaited<
  ReturnType<typeof getGradingQueue>
>[number];

/** Most-recent grading actions across the platform — the append-only audit trail. */
export async function getRecentGradingAudits(limit = 25) {
  const audits = await prisma.gradingAudit.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      previousOutcome: true,
      newOutcome: true,
      source: true,
      reason: true,
      createdAt: true,
      gradedBy: { select: { displayName: true, username: true } },
      play: {
        select: {
          market: true,
          selection: true,
          capper: {
            select: { user: { select: { displayName: true, username: true } } },
          },
        },
      },
    },
  });

  return audits.map((a) => ({
    id: a.id,
    previousOutcome: a.previousOutcome,
    newOutcome: a.newOutcome,
    source: a.source,
    reason: a.reason,
    createdAt: a.createdAt,
    gradedBy: a.gradedBy?.displayName ?? a.gradedBy?.username ?? "System",
    market: a.play.market,
    selection: a.play.selection,
    capperName:
      a.play.capper.user.displayName ??
      a.play.capper.user.username ??
      "Unknown capper",
  }));
}

export type GradingAuditItem = Awaited<
  ReturnType<typeof getRecentGradingAudits>
>[number];
