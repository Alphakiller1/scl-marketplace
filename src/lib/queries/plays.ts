import "server-only";

import type { Outcome } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { CapperSummary, TodayPick } from "@/lib/mock";
import type { VerificationTier } from "@/lib/verification";

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
  verificationTier: VerificationTier;
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
    // Exclude parlay legs — the parlay is the position of record, not each leg.
    where: { capperId: profile.id, parlayId: null },
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
    verificationTier: p.verificationTier,
  }));
}

const OUTCOME_TO_PICK_STATUS = {
  PENDING: "pending",
  WIN: "win",
  LOSS: "loss",
  PUSH: "push",
  VOID: "void",
} as const satisfies Record<Outcome, TodayPick["status"]>;

/**
 * Latest public plays from active cappers. The available Phase 1 schema does
 * not store event start time, so the UI labels these as pending or graded
 * rather than inventing a game time.
 */
export async function getPublicRecentPicks(
  cappers: CapperSummary[],
  take = 8,
): Promise<TodayPick[]> {
  return (await getPublicRecentPicksResult(cappers, take)).picks;
}

export async function getPublicRecentPicksResult(
  cappers: CapperSummary[],
  take = 8,
): Promise<{ picks: TodayPick[]; failed: boolean }> {
  const capperById = new Map(cappers.map((capper) => [capper.id, capper]));

  try {
    const plays = await prisma.play.findMany({
      where: {
        capper: {
          user: {
            accountStatus: "ACTIVE",
            username: { not: null },
          },
        },
      },
      select: {
        id: true,
        capperId: true,
        sport: true,
        league: true,
        market: true,
        selection: true,
        oddsAmerican: true,
        units: true,
        outcome: true,
        createdAt: true,
        verificationTier: true,
      },
      orderBy: { createdAt: "desc" },
      take,
    });

    const picks = plays.flatMap((play) => {
      const capper = capperById.get(play.capperId);
      if (!capper) return [];
      return [
        {
          id: play.id,
          capper: {
            id: capper.id,
            name: capper.name,
            handle: capper.handle,
            verified: capper.verified,
            avatarUrl: capper.avatarUrl,
          },
          capperRecord: capper.record,
          sport: play.sport,
          event: play.league ?? play.market,
          selection: play.selection,
          oddsAmerican: play.oddsAmerican,
          units: Number(play.units),
          status: OUTCOME_TO_PICK_STATUS[play.outcome],
          postedAt: play.createdAt,
          gameTime: play.outcome === "PENDING" ? "Pending" : "Graded",
          verificationTier: play.verificationTier,
        } satisfies TodayPick,
      ];
    });
    return { picks, failed: false };
  } catch (error) {
    console.error("[getPublicRecentPicks] database unavailable:", error);
    return { picks: [], failed: true };
  }
}
