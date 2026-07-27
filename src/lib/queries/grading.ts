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
        select: { user: { select: { username: true } } },
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
    capperName: p.capper.user.username
      ? `@${p.capper.user.username.replace(/^@/, "")}`
      : "",
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
      previousProfitUnits: true,
      newProfitUnits: true,
      source: true,
      reason: true,
      createdAt: true,
      gradedBy: { select: { displayName: true, username: true } },
      play: {
        select: {
          market: true,
          selection: true,
          capper: {
            select: { user: { select: { username: true } } },
          },
        },
      },
    },
  });

  return audits.map((a) => ({
    id: a.id,
    previousOutcome: a.previousOutcome,
    newOutcome: a.newOutcome,
    previousProfitUnits:
      a.previousProfitUnits == null ? null : Number(a.previousProfitUnits),
    newProfitUnits: a.newProfitUnits == null ? null : Number(a.newProfitUnits),
    source: a.source,
    reason: a.reason,
    createdAt: a.createdAt,
    gradedBy: a.gradedBy?.username
      ? `@${a.gradedBy.username.replace(/^@/, "")}`
      : "System",
    market: a.play.market,
    selection: a.play.selection,
    capperName: a.play.capper.user.username
      ? `@${a.play.capper.user.username.replace(/^@/, "")}`
      : "",
  }));
}

export type GradingAuditItem = Awaited<
  ReturnType<typeof getRecentGradingAudits>
>[number];

/** Pending parlays with their legs — the admin parlay grading queue. */
export async function getParlayGradingQueue() {
  const parlays = await prisma.parlay.findMany({
    where: { outcome: "PENDING" },
    select: {
      id: true,
      units: true,
      combinedOddsAmerican: true,
      capper: {
        select: { user: { select: { username: true } } },
      },
      legs: {
        select: {
          id: true,
          sport: true,
          market: true,
          selection: true,
          side: true,
          oddsAmerican: true,
          outcome: true,
        },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { createdAt: "asc" },
    take: 100,
  });

  return parlays.map((p) => ({
    id: p.id,
    units: Number(p.units),
    combinedOddsAmerican: p.combinedOddsAmerican,
    capperName: p.capper.user.username
      ? `@${p.capper.user.username.replace(/^@/, "")}`
      : "",
    legs: p.legs.map((l) => ({
      id: l.id,
      sport: l.sport,
      market: l.market,
      selection: l.selection,
      side: l.side,
      oddsAmerican: l.oddsAmerican,
      outcome: l.outcome,
    })),
  }));
}

export type ParlayQueueItem = Awaited<
  ReturnType<typeof getParlayGradingQueue>
>[number];
