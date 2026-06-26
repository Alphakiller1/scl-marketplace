import "server-only";

import type { Outcome } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export type PlayView = {
  id: string;
  sport: string;
  league: string | null;
  market: string;
  selection: string;
  oddsAmerican: number;
  units: number;
  outcome: Outcome;
  profitUnits: number | null;
  createdAt: Date;
};

/** A capper's plays (most recent first), with Decimals serialized to numbers. */
export async function getCapperPlays(
  userId: string,
  take?: number,
): Promise<PlayView[]> {
  const profile = await prisma.capperProfile.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!profile) return [];

  const plays = await prisma.play.findMany({
    where: { capperId: profile.id },
    orderBy: { createdAt: "desc" },
    take,
  });

  return plays.map((p) => ({
    id: p.id,
    sport: p.sport,
    league: p.league,
    market: p.market,
    selection: p.selection,
    oddsAmerican: p.oddsAmerican,
    units: Number(p.units),
    outcome: p.outcome,
    profitUnits: p.profitUnits == null ? null : Number(p.profitUnits),
    createdAt: p.createdAt,
  }));
}
